/* =====================================================================
   teste-folgas-ui.js — a camada sobreposta do Gerador de Folgas

   Sobe a aba num navegador de verdade (Chromium) e mede o que o usuário
   sente: abrir, clicar numa célula, rolar a grade. Foi escrito depois do
   relato de "não consigo movimentar a página, está muito pesado".

   Rodar:  node testes/teste-folgas-ui.js
   ===================================================================== */

'use strict';

const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const BASE = path.join(__dirname, '..');
let pass = 0, fail = 0;
const falhas = [];
const ok = (c, m) => { if (c) pass++; else { fail++; falhas.push(m); console.log('   \x1b[31m✗\x1b[0m ' + m); } };
const eq = (a, b, m) => ok(a === b, m + '  (esperado ' + JSON.stringify(b) + ', veio ' + JSON.stringify(a) + ')');
const sec = (t) => console.log('\n\x1b[36m── ' + t + '\x1b[0m');

// Página mínima: só o CSS do painel e os dois arquivos do gerador. Não sobe
// Supabase nem o resto do app — o que está sob teste é a aba.
function paginaDeTeste() {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<link rel="stylesheet" href="../css/style.css">
</head><body>
<div id="admin-host" style="padding:16px"></div>
<script src="../js/folgas-engine.js"></script>
<script src="../js/folgas.js"></script>
<script>window.addEventListener('load',()=>{adminFolgasTab(document.getElementById('admin-host'));});<\/script>
</body></html>`;
}

(async () => {
  const tmp = path.join(BASE, 'testes', '.ui-folgas.html');
  fs.writeFileSync(tmp, paginaDeTeste());

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });

  const erros = [];
  // Falha de rede não é erro do painel: aqui a página roda offline e as fontes
  // externas do style.css não carregam. O que interessa é erro de JavaScript.
  const deRede = (t) => /Failed to load resource|ERR_|net::|fonts\.googleapis/i.test(t);
  page.on('pageerror', (e) => erros.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !deRede(m.text())) erros.push(m.text()); });

  await page.goto('file://' + tmp);
  await page.waitForSelector('#fgl-open');

  /* ------------------------------------------------ 1. a aba fica leve */
  sec('1. A aba do Admin carrega leve');
  {
    const n = await page.evaluate(() => document.querySelectorAll('#admin-host *').length);
    console.log('   nós na aba: ' + n);
    ok(n < 80, 'a aba tem menos de 80 elementos (veio ' + n + ')');
    eq(await page.locator('#admin-host table').count(), 0, 'nenhuma tabela é montada na aba');
    eq(await page.locator('#fg-overlay').count(), 0, 'a camada nem existe antes de abrir');
    const larg = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    ok(larg, 'a página não ganha rolagem horizontal — era o que travava a navegação');
  }

  /* ------------------------------------------------- 2. abrir a camada */
  sec('2. Abrir sobrepõe o painel');
  {
    const t0 = Date.now();
    await page.click('#fgl-open');
    await page.waitForSelector('#fg-overlay:not([hidden]) table.grid');
    const ms = Date.now() - t0;
    console.log('   abrir + montar a grade: ' + ms + ' ms');
    ok(ms < 1500, 'abre em menos de 1,5 s (levou ' + ms + ' ms)');

    const box = await page.evaluate(() => {
      const o = document.getElementById('fg-overlay');
      const r = o.getBoundingClientRect();
      const cs = getComputedStyle(o);
      return { pos: cs.position, top: r.top, left: r.left, w: r.width, h: r.height, z: +cs.zIndex,
        travado: document.body.classList.contains('fg-locked'),
        overflowBody: getComputedStyle(document.body).overflow };
    });
    eq(box.pos, 'fixed', 'a camada é fixa na viewport');
    eq(box.top, 0, 'cobre a partir do topo');
    eq(box.left, 0, 'cobre a partir da esquerda');
    eq(box.w, 1600, 'ocupa a largura inteira');
    eq(box.h, 900, 'ocupa a altura inteira');
    ok(box.z >= 100, 'fica acima do painel (z-index ' + box.z + ')');
    ok(box.travado, 'o body trava a rolagem enquanto a camada está aberta');
    eq(box.overflowBody, 'hidden', 'o painel embaixo não rola junto');
  }

  /* ------------------------------ 3. a grade rola dentro da própria área */
  sec('3. A grade rola dentro da camada, não na página');
  {
    const r = await page.evaluate(() => {
      const m = document.getElementById('fg-scroll');
      const cs = getComputedStyle(m);
      return { overflow: cs.overflowY, bounce: cs.overscrollBehaviorY,
        rola: m.scrollHeight > m.clientHeight, alturaFixa: m.clientHeight <= window.innerHeight };
    });
    eq(r.overflow, 'auto', 'a área principal tem rolagem própria');
    eq(r.bounce, 'contain', 'a rolagem não vaza para o painel de trás');
    ok(r.alturaFixa, 'a área tem altura limitada pela tela (sticky fica barato)');

    // rola de fato e confere que a página não se mexeu
    const antes = await page.evaluate(() => window.scrollY);
    await page.evaluate(() => { document.getElementById('fg-scroll').scrollTop = 400; });
    await page.waitForTimeout(60);
    const depois = await page.evaluate(() => ({ janela: window.scrollY, area: document.getElementById('fg-scroll').scrollTop }));
    eq(depois.janela, antes, 'a janela não se mexeu');
    ok(depois.area > 0, 'a área da grade rolou (' + depois.area + 'px)');
  }

  /* ----------------------------------- 4. só pinta o que está à vista */
  sec('4. Grupos fora da tela não são desenhados');
  {
    const cv = await page.evaluate(() => {
      const g = document.querySelector('.fg-scope .grp');
      return { cv: getComputedStyle(g).contentVisibility, contida: getComputedStyle(document.querySelector('.fg-scope .block')).contain };
    });
    eq(cv.cv, 'auto', 'cada grupo usa content-visibility:auto');
    ok(/layout/.test(cv.contida), 'o bloco isola o próprio layout (contain: ' + cv.contida + ')');
  }

  /* ------------------------------- 5. célula é <td>, não <button> */
  sec('5. Célula de dia sem botão dentro');
  {
    const c = await page.evaluate(() => ({
      tds: document.querySelectorAll('td[data-cell]').length,
      botoes: document.querySelectorAll('td[data-cell] button').length,
      antigo: document.querySelectorAll('.cellbtn').length,
      total: document.querySelectorAll('#fg-overlay *').length,
    }));
    console.log('   células: ' + c.tds + ' · nós na camada: ' + c.total);
    ok(c.tds > 300, 'a grade do exemplo tem as células todas (' + c.tds + ')');
    eq(c.botoes, 0, 'nenhum <button> dentro das células');
    eq(c.antigo, 0, 'a classe .cellbtn saiu de cena');
  }

  /* --------------------------- 6. clique não redesenha a planilha toda */
  sec('6. Clicar num dia só mexe no que mudou');
  {
    const alvo = await page.evaluate(() => {
      const td = [...document.querySelectorAll('td[data-cell]:not(.locked)')].find((t) => !t.textContent.trim());
      return td ? td.getAttribute('data-cell') : null;
    });
    ok(!!alvo, 'achei um dia livre para clicar');

    // marca todas as tabelas; se o render for global, elas somem do DOM
    await page.evaluate(() => { document.querySelectorAll('table.grid').forEach((t, i) => (t.dataset.marca = 'm' + i)); });

    const t0 = Date.now();
    await page.click(`td[data-cell="${alvo}"]`);
    await page.waitForTimeout(40);
    const ms = Date.now() - t0;
    console.log('   clique → tela atualizada: ' + ms + ' ms');
    ok(ms < 350, 'o clique responde em menos de 350 ms (levou ' + ms + ' ms)');

    const r = await page.evaluate((k) => ({
      marcasVivas: document.querySelectorAll('table.grid[data-marca]').length,
      tabelas: document.querySelectorAll('table.grid').length,
      texto: document.querySelector(`td[data-cell="${k}"]`).textContent.trim(),
      manual: document.querySelector(`td[data-cell="${k}"]`).classList.contains('c-man'),
    }), alvo);
    eq(r.marcasVivas, r.tabelas, 'as tabelas continuam as mesmas — não houve redesenho geral');
    eq(r.texto, 'F', 'a célula clicada virou F');
    ok(r.manual, 'a célula ficou marcada como edição manual');
  }

  sec('7. Rodapé e conferência acompanham a edição');
  {
    const r = await page.evaluate(() => {
      const w = document.querySelector('tr.work');
      const nums = [...w.querySelectorAll('td.dc')].map((t) => +t.textContent);
      const spread = document.querySelector('.grp .spread b').textContent;
      const sit = document.querySelector('tbody tr .st.status').textContent.trim();
      return { nums, spread, sit };
    });
    ok(r.nums.every((n) => Number.isFinite(n)), 'a linha "trabalhando no dia" continua numérica');
    ok(/^\d+(–\d+)?$/.test(r.spread), 'o resumo do grupo foi reescrito (' + r.spread + ')');
    ok(r.sit.length > 0, 'a coluna Situação tem conteúdo (' + r.sit + ')');
  }

  /* ------------------------------------------------ 8. fechar a camada */
  sec('8. Fechar devolve o painel');
  {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(60);
    const r = await page.evaluate(() => ({
      escondida: document.getElementById('fg-overlay').hidden,
      travado: document.body.classList.contains('fg-locked'),
      status: document.getElementById('fgl-status').innerHTML.length,
    }));
    ok(r.escondida, 'Esc fecha a camada');
    ok(!r.travado, 'a rolagem do painel volta');

    await page.click('#fgl-open');
    await page.waitForSelector('#fg-overlay:not([hidden])');
    const voltou = await page.evaluate(() => {
      const td = document.querySelector('td[data-cell].c-man');
      return !!td && td.textContent.trim();
    });
    eq(voltou, 'F', 'reabrir mantém a edição manual — o estado não se perde');
    await page.click('#fg-btn-close');
    await page.waitForTimeout(40);
    eq(await page.evaluate(() => document.getElementById('fg-overlay').hidden), true, 'o botão × também fecha');
  }

  /* --------------------------------------------------- 9. sem erros JS */
  sec('9. Console limpo');
  {
    if (erros.length) erros.slice(0, 5).forEach((e) => console.log('   ' + e));
    eq(erros.length, 0, 'nenhum erro de JavaScript durante o teste');
  }

  await browser.close();
  fs.unlinkSync(tmp);

  console.log('\n' + '─'.repeat(58));
  if (!fail) console.log('\x1b[32m✓ ' + pass + ' verificações passaram\x1b[0m');
  else { console.log('\x1b[31m✗ ' + fail + ' falha(s) de ' + (pass + fail) + '\x1b[0m'); falhas.forEach((f, i) => console.log('  ' + (i + 1) + '. ' + f)); }
  console.log('─'.repeat(58));
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
