/* =====================================================================
   teste-escala-painel.js — painel de ferramentas recolhível da Escala

   Em monitor de 768px de altura, o cabeçalho + o cartão de ferramentas +
   a legenda + as quatro linhas fixas da grade comiam metade da tela: a
   primeira pessoa aparecia na metade vertical. Recolher devolve o espaço.

   O que está sob teste é o comportamento que o usuário percebe: abre
   recolhido em tela baixa, lembra a escolha depois disso, e as etiquetas
   avisam quando tem filtro ligado — porque esconder filtro sem mostrar
   que ele existe é pior do que não esconder nada.

   Rodar:  node testes/teste-escala-painel.js
   ===================================================================== */

'use strict';

const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const BASE = path.join(__dirname, '..');
let pass = 0, fail = 0;
const falhas = [];
const ok = (c, m) => { if (c) pass++; else { fail++; falhas.push(m); console.log('   \x1b[31m✗\x1b[0m ' + m); } };
const sec = (t) => console.log('\n\x1b[36m── ' + t + '\x1b[0m');

/* Página mínima: o CSS do painel, o escala.js e só os três elementos que
   o recolhimento mexe. Não sobe Supabase nem o resto do app. */
function paginaDeTeste() {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<link rel="stylesheet" href="../css/style.css"></head><body>
<div id="escala-ferr-mini" class="escala-ferr-mini" style="display:none"><span id="escala-chips"></span></div>
<div class="hc-panel escala-ferr" id="escala-ferramentas">painel</div>
<div id="escala-legenda-linha" style="display:flex">legenda</div>
<script>window.db={from(){return{select:()=>Promise.resolve({data:[],error:null})}}};<\/script>
<script src="../js/escala.js"><\/script>
</body></html>`;
}

(async () => {
  const tmp = path.join(BASE, 'testes', '.ui-escala-painel.html');
  fs.writeFileSync(tmp, paginaDeTeste());
  const url = 'file://' + tmp;
  const browser = await chromium.launch();
  const erros = [];

  const abrir = async (altura) => {
    const p = await browser.newPage({ viewport: { width: 1280, height: altura } });
    p.on('pageerror', (e) => erros.push(e.message));
    await p.goto(url, { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => typeof window.escalaFerramentasRecolhido === 'function');
    return p;
  };
  const display = (p, sel) => p.$eval(sel, (e) => getComputedStyle(e).display);

  try {
    sec('1. Tela alta — nada muda para quem tem espaço');
    {
      const p = await abrir(1000);
      ok(await p.evaluate(() => escalaFerramentasRecolhido()) === false,
        'com 1000px de altura o painel começa expandido');
      await p.evaluate(() => escalaAplicarEstadoFerramentas());
      ok(await display(p, '#escala-ferramentas') !== 'none', 'o painel de ferramentas aparece');
      ok(await display(p, '#escala-ferr-mini') === 'none', 'e a faixa recolhida fica fora do caminho');
      ok(await display(p, '#escala-legenda-linha') === 'flex', 'a legenda continua na linha');
      await p.close();
    }

    sec('2. Tela baixa — recolhe sozinho, sem precisar descobrir o botão');
    {
      const p = await abrir(760);
      ok(await p.evaluate(() => escalaFerramentasRecolhido()) === true,
        'com 760px de altura já abre recolhido');
      await p.evaluate(() => escalaAplicarEstadoFerramentas());
      ok(await display(p, '#escala-ferramentas') === 'none', 'o painel sai');
      ok(await display(p, '#escala-ferr-mini') === 'flex', 'a faixa entra no lugar dele');
      ok(await display(p, '#escala-legenda-linha') === 'none',
        'e a legenda sai da linha — ela volta no "?" da faixa');
      await p.close();
    }

    sec('3. A escolha de quem clicou vale mais que o tamanho da tela');
    {
      const p = await abrir(760);
      await p.evaluate(() => escalaToggleFerramentas());
      ok(await p.evaluate(() => localStorage.getItem('gde_escala_ferramentas')) === '0',
        'abrir grava a preferência');
      ok(await display(p, '#escala-ferramentas') !== 'none', 'e o painel volta na hora');

      await p.evaluate(() => { localStorage.setItem('gde_escala_ferramentas', '0'); delete window._escalaFerrRecolhido; });
      ok(await p.evaluate(() => escalaFerramentasRecolhido()) === false,
        'quem escolheu "aberto" continua aberto mesmo em tela baixa');
      await p.evaluate(() => { localStorage.setItem('gde_escala_ferramentas', '1'); delete window._escalaFerrRecolhido; });
      ok(await p.evaluate(() => escalaFerramentasRecolhido()) === true,
        'e quem escolheu "recolhido" continua recolhido');
      await p.close();
    }

    sec('4. Etiquetas: a faixa avisa o que está filtrando');
    {
      const p = await abrir(1000);
      const chips = async (fn) => { await p.evaluate(fn); return p.evaluate(() => escalaChipsFiltros().map((c) => c.rot)); };

      ok((await chips(() => {})).length === 0, 'sem filtro ligado não há etiqueta nenhuma');
      ok((await chips(() => { window._escalaFiltroSituacao = 'ferias'; })).includes('Só de férias no mês'),
        'ligar um filtro cria a etiqueta com o rótulo que o seletor mostra');
      ok((await chips(() => { window._escalaDensidade = 'compacto'; })).includes('Compacto'),
        'a densidade também vira etiqueta');
      ok((await chips(() => { window._escalaBlocosRecolhidos = true; })).includes('Blocos recolhidos'),
        'e os blocos recolhidos');
      ok((await chips(() => {
        window._escalaFiltroSituacao = 'todos'; window._escalaDensidade = 'confortavel';
        window._escalaBlocosRecolhidos = false;
      })).length === 0, 'voltando tudo ao padrão, as etiquetas somem');

      // A faixa precisa dizer algo mesmo sem filtro — espaço em branco
      // pareceria defeito.
      await p.evaluate(() => escalaAtualizarChips());
      ok((await p.$eval('#escala-chips', (e) => e.textContent.trim())) === 'sem filtros',
        'sem filtro, a faixa diz "sem filtros" em vez de ficar vazia');
      await p.close();
    }

    sec('5. Botões de estado em dois lugares, um estado só');
    {
      const p = await abrir(1000);
      await p.evaluate(() => {
        document.body.insertAdjacentHTML('beforeend',
          escalaBtnAgruparHTML() + escalaBtnColunasHTML() + escalaBtnAgruparHTML());
        window._escalaAgruparPorTurno = true;
        window._escalaColunasSecundarias = false;
        escalaSincronizarBotoesEstado();
      });
      const fundos = await p.$$eval('[data-esc-toggle="agrupar"]', (bs) => bs.map((b) => b.style.background));
      ok(fundos.length === 2 && fundos.every((f) => f.includes('--blue')),
        'as duas cópias do "Agrupar" acendem juntas — antes o destaque só vinha no render inteiro');
      ok(await p.$eval('[data-esc-toggle="colunas"] [data-esc-rotulo]', (e) => e.textContent) === 'Mostrar colunas',
        'e o rótulo de "Colunas" acompanha o estado');
      await p.close();
    }

    sec('6. Nenhum erro de script');
    ok(erros.length === 0, 'a página carregou sem exceção' + (erros.length ? ': ' + erros.join(' | ') : ''));
  } finally {
    await browser.close();
    fs.unlinkSync(tmp);
  }

  console.log('\n' + '─'.repeat(58));
  if (!fail) console.log('\x1b[32m✓ ' + pass + ' verificações passaram\x1b[0m');
  else { console.log('\x1b[31m✗ ' + fail + ' falha(s) de ' + (pass + fail) + '\x1b[0m'); falhas.forEach((f, i) => console.log('  ' + (i + 1) + '. ' + f)); }
  console.log('─'.repeat(58));
  process.exit(fail ? 1 : 0);
})();
