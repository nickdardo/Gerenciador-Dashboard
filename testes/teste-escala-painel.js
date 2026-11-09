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
<div id="topbar"><div class="tb-left"><span class="tb-page-title" id="tb-title">Escala Online</span>
<button class="tb-foco-btn" id="tb-foco" onclick="escalaToggleFerramentas()" aria-label="Modo grade"></button></div></div>
<div id="page-content" class="pc-flex">
<div class="page-header"><h1 class="page-title">Escala Online</h1></div>
<div class="escala-nota">carga automática</div>
<div class="escala-nota escala-nota-trava">escala travada</div>
<div id="escala-ferr-mini" class="escala-ferr-mini" style="display:none"><span id="escala-chips"></span></div>
<div class="hc-panel escala-ferr" id="escala-ferramentas">painel</div>
<div id="escala-legenda-linha" style="display:flex">legenda</div>
</div>
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
    // 'load' e não 'domcontentloaded': as verificações olham estilo
    // calculado, e com o CSS ainda em voo a folha não valeria nada.
    await p.goto(url, { waitUntil: 'load' });
    await p.waitForFunction(() => typeof window.escalaFerramentasRecolhido === 'function');
    return p;
  };
  const display = (p, sel) => p.$eval(sel, (e) => getComputedStyle(e).display);

  try {
    sec('1. A grade fica com a tela inteira, sempre');
    {
      /* O painel ocupava uma faixa permanente acima da grade e havia um
         botão para recolhê-lo. Agora não há duas situações: a grade tem a
         tela toda o tempo todo e as ferramentas abrem como menu, sobre
         ela. A faixa fina continua visível porque carrega base, mês e
         cenário — esconder o cabeçalho sem levar o contexto junto é como
         alguém acaba editando CGH achando que está em BEL. */
      for (const altura of [1000, 760]) {
        const p = await abrir(altura);
        await p.evaluate(() => escalaAplicarEstadoFerramentas());
        ok(await p.evaluate(() => document.body.classList.contains('escala-modo-grade')),
          `${altura}px de altura: a grade está em tela cheia`);
        ok(await display(p, '#escala-ferr-mini') === 'flex',
          `${altura}px: a faixa com base, mês e cenário fica visível`);
        ok(await display(p, '#escala-legenda-linha') === 'none',
          `${altura}px: a legenda sai da linha — volta no "?" da faixa`);
        ok(await p.evaluate(() => document.getElementById('escala-ferramentas').classList.contains('escala-ferr-menu')),
          `${altura}px: o painel virou menu`);
        ok(!(await p.evaluate(() => document.getElementById('escala-ferramentas').classList.contains('aberto'))),
          `${altura}px: e começa fechado`);
        await p.close();
      }
    }

    sec('2. O botão abre e fecha o menu');
    {
      const p = await abrir(900);
      await p.evaluate(() => escalaAplicarEstadoFerramentas());
      const aberto = () => p.evaluate(() => document.getElementById('escala-ferramentas').classList.contains('aberto'));
      /* `visibility` participa da transição de 130ms, então medir no
         instante do clique pega o menu no meio do caminho. */
      const assentar = () => p.waitForTimeout(220);
      const visivel = () => p.$eval('#escala-ferramentas', (e) => getComputedStyle(e).visibility);

      await assentar();
      ok(await visivel() === 'hidden', 'fechado, o menu não aparece');
      await p.evaluate(() => escalaToggleFerramentas());
      await assentar();
      ok(await aberto(), 'o botão abre');
      ok(await visivel() === 'visible', 'e aí ele aparece');
      await p.evaluate(() => escalaToggleFerramentas());
      ok(!(await aberto()), 'e fecha de novo no segundo clique');

      // Fechado ele continua no DOM: é isso que evita remontar a grade de
      // 289 pessoas × 31 dias a cada abertura.
      ok(await display(p, '#escala-ferramentas') !== 'none',
        'fechado, o menu continua no DOM — nada é re-renderizado ao abrir');
      await p.close();
    }

    sec('3. Esc e clique fora fecham, como qualquer menu');
    {
      const p = await abrir(900);
      await p.evaluate(() => escalaAplicarEstadoFerramentas());
      const aberto = () => p.evaluate(() => document.getElementById('escala-ferramentas').classList.contains('aberto'));

      await p.evaluate(() => escalaToggleMenuFerramentas(true));
      ok(await aberto(), 'aberto');
      await p.keyboard.press('Escape');
      await p.waitForTimeout(60);
      ok(!(await aberto()), 'Esc fecha');

      await p.evaluate(() => escalaToggleMenuFerramentas(true));
      await p.mouse.click(5, 400);
      await p.waitForTimeout(60);
      ok(!(await aberto()), 'clique fora fecha');

      // Clicar DENTRO não pode fechar: senão nenhum botão do menu funciona.
      await p.evaluate(() => escalaToggleMenuFerramentas(true));
      await p.evaluate(() => {
        const el = document.getElementById('escala-ferramentas');
        el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      });
      await p.waitForTimeout(60);
      ok(await aberto(), 'clique dentro do menu não fecha');
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

    sec('6. A grade em tela cheia é o único estado, e o contexto não some junto');
    {
      /* Antes havia dois estados e um botão para alternar. Agora a grade
         tem a tela inteira sempre, e o botão abre as ferramentas sobre
         ela. O que NÃO pode sumir é o contexto: a faixa fina carrega base,
         mês e cenário, porque esconder o cabeçalho sem levar isso junto é
         como alguém acaba editando CGH achando que está em BEL. */
      const p = await abrir(1000);
      await p.evaluate(() => escalaAplicarEstadoFerramentas());

      ok(await display(p, '.page-header') === 'none', 'o cabeçalho da página sai do caminho');
      ok(await display(p, '.escala-nota:not(.escala-nota-trava)') === 'none', 'os avisos de rotina também');
      ok(await display(p, '.escala-nota-trava') !== 'none',
        'menos o de escala travada: ele muda o que você pode fazer, então fica');
      ok(await display(p, '#escala-ferr-mini') === 'flex',
        'e a faixa com base, mês e cenário fica — o contexto nunca some');

      await p.click('#tb-foco');
      await p.waitForTimeout(220);
      ok(await p.$eval('#tb-foco', (e) => e.classList.contains('aceso')),
        'o botão acende enquanto o menu está aberto');
      ok(await p.$eval('#tb-foco', (e) => e.getAttribute('aria-expanded')) === 'true',
        'e se anuncia como expandido para o leitor de tela');
      ok(/Fechar/.test(await p.$eval('#tb-foco', (e) => e.title)),
        'a dica do botão oferece o fechamento');

      await p.click('#tb-foco');
      await p.waitForTimeout(220);
      ok(!(await p.$eval('#tb-foco', (e) => e.classList.contains('aceso'))), 'e apaga ao fechar');
      ok(await p.$eval('#tb-foco', (e) => e.getAttribute('aria-expanded')) === 'false',
        'voltando a se anunciar como recolhido');
      ok(await display(p, '.page-header') === 'none',
        'o cabeçalho continua fora: a tela cheia não depende do menu');
      await p.close();
    }

    sec('7. A faixa leva o contexto junto');
    {
      const p = await abrir(1000);
      await p.evaluate(() => {
        window._escalaBase = 'CGH'; window._escalaMes = '2026-10';
        const html = escalaFaixaMiniHTML('', ['BEL', 'CGH', 'FOR'], '2026-10', 'CGH');
        document.getElementById('escala-ferr-mini').outerHTML = html;
      });
      const sels = await p.$$eval('#escala-ferr-mini select', (a) => a.length);
      // Esconder o cabeçalho sem levar base e mês junto é como alguém acaba
      // editando CGH achando que está em BEL.
      ok(sels === 3, 'base, mês e cenário continuam à mão na faixa (' + sels + ' seletores)');
      const base = await p.$eval('#escala-ferr-mini select', (e) => e.value);
      ok(base === 'CGH', 'e a base mostrada é a que está aberta, não a primeira da lista');
      await p.close();
    }

    sec('8. Atalho de teclado');
    {
      /* O atalho agora abre e fecha o MENU — a tela cheia não é mais um
         estado que se liga e desliga. As letras soltas marcam F/J/K/C/A na
         célula, por isso ele tem modificador, e dentro de um campo de
         texto não pode disparar. */
      const p = await abrir(1000);
      await p.evaluate(() => escalaAplicarEstadoFerramentas());
      const aberto = () => p.evaluate(() => document.getElementById('escala-ferramentas').classList.contains('aberto'));

      await p.keyboard.press('Control+Shift+G');
      await p.waitForTimeout(80);
      ok(await aberto(), 'Ctrl+Shift+G abre as ferramentas sem precisar de célula selecionada');
      await p.keyboard.press('Control+Shift+G');
      await p.waitForTimeout(80);
      ok(!(await aberto()), 'e fecha');

      await p.evaluate(() => {
        const i = document.createElement('input'); i.id = 'tst'; document.body.appendChild(i); i.focus();
      });
      await p.keyboard.press('Control+Shift+G');
      await p.waitForTimeout(80);
      ok(!(await aberto()), 'digitando num campo, o atalho não dispara');
      await p.close();
    }

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
