/* =====================================================================
   teste-gerador-escala.js — a ponte entre o Gerador e a Escala Capacity

   Clicar em "Escala Capacity" no Gerador tem de abrir a escala NO MÊS E
   NA BASE daquele dimensionamento. Parece óbvio, e era justamente o que
   faltava: _genBase e _genMes só eram consultados como último recurso, e
   só enquanto a escala nunca tivesse sido aberta. Depois da primeira vez
   ela passava a lembrar a própria escolha, e este botão não conseguia
   mais mudá-la.

   Na prática: subia-se um dimensionamento de dezembro, clicava-se no
   botão, e caía-se em novembro — onde não há dimensionamento nenhum. A
   tela abria vazia, e a conclusão natural era que o espelhamento dos
   horários estava quebrado, quando o que estava errado era o mês.

   Rodar:  node testes/teste-gerador-escala.js
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

/* Banco de mentira: aceita delete e insert, e guarda o que foi gravado
   para conferir em que mês o dimensionamento caiu. */
const AMBIENTE = `
window.__gravado = [];
window.__apagado = [];
window.__navegou = null;
window.db = {
  from(tabela) {
    const api = {
      delete() { const q = { tabela, filtros: {} };
        const f = { eq(c, v) { q.filtros[c] = v; return f; },
                    then(r) { window.__apagado.push(q); return Promise.resolve({ error: null }).then(r); } };
        return f; },
      insert(linhas) { window.__gravado.push(...linhas); return Promise.resolve({ error: null }); },
    };
    return api;
  },
};
window.navigateTo = (p) => { window.__navegou = p; };
window.genSetStatus = () => {};
window.currentUserProfile = { id: 'u1' };
window.currentUser = { id: 'u1' };
window.gMesDetectado = null;
window.adhMonthLabel = (m) => m;
`;

(async () => {
  const tmp = path.join(BASE, 'testes', '.gerador.html');
  fs.writeFileSync(tmp, `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"></head><body>
<select id="gen-mes-select"><option value="2026-11">Novembro</option><option value="2026-12" selected>Dezembro</option></select>
<div id="gen-mes-origem"></div>
<script>${AMBIENTE}<\/script>
<script src="file://${path.join(BASE, 'js', 'pages.js')}"><\/script></body></html>`);

  const browser = await chromium.launch();
  const page = await browser.newPage();
  const erros = [];
  page.on('pageerror', (e) => erros.push(e.message));
  await page.goto('file://' + tmp, { waitUntil: 'load' });

  try {
    sec('1. A Capacity abre no mês e na base do dimensionamento');
    {
      const r = await page.evaluate(async () => {
        /* O estado que criava o bug: a escala JÁ foi aberta antes, em
           outra base e outro mês, e lembra disso. */
        window._escalaBase = 'CGH';
        window._escalaMes = '2026-11';
        try {
          localStorage.setItem('gde_escala_ultima_base', 'CGH');
          localStorage.setItem('gde_escala_ultimo_mes', '2026-11');
        } catch (_) {}

        gBase = 'GRU';
        gRows = [
          { funcao: 'ASG LIMPEZA I', horario: '07:00-13:00', sheetName: 'LIMPEZA',
            entrada: '07:00', saida: '13:00', carga: 180 },
          { funcao: 'ASG LIMPEZA I', horario: '07:00-13:00', sheetName: 'LIMPEZA',
            entrada: '07:00', saida: '13:00', carga: 180 },
          { funcao: 'ASA', horario: '05:00-11:00', sheetName: 'RAMPA',
            entrada: '05:00', saida: '11:00', carga: 180 },
        ];
        await genGoEscala();
        let guardado = {};
        try {
          guardado = { base: localStorage.getItem('gde_escala_ultima_base'),
                       mes: localStorage.getItem('gde_escala_ultimo_mes') };
        } catch (_) {}
        return {
          base: window._escalaBase, mes: window._escalaMes,
          navegou: window.__navegou, guardado,
          gravado: window.__gravado.map((l) => [l.base, l.mes, l.funcao, l.qtd]),
          aplicar: window._escalaAplicarDimAoAbrir,
        };
      });

      eq(r.mes, '2026-12',
        'a escala vai para o mês do dimensionamento, não para o que ela lembrava');
      eq(r.base, 'GRU', 'e para a base dele');
      eq(r.navegou, 'capacity', 'pela porta da Capacity, que é quem usa esses horários');
      ok(r.aplicar === true, 'marcando que os horários devem ser alocados ao abrir');

      eq(r.guardado.mes, '2026-12',
        'o mês fica guardado, para um F5 logo em seguida não voltar ao antigo');
      eq(r.guardado.base, 'GRU', 'a base também');

      // E o dimensionamento foi gravado no mesmo mês para onde se navegou.
      ok(r.gravado.every((l) => l[1] === '2026-12'),
        'o dimensionamento foi salvo no mesmo mês: ' + JSON.stringify(r.gravado));
      ok(r.gravado.every((l) => l[0] === 'GRU'), 'e na mesma base');
      eq(r.gravado.length, 2, 'duas combinações de função+horário');
      const asg = r.gravado.find((l) => l[2] === 'ASG LIMPEZA I');
      eq(asg && asg[3], 2, 'com a quantidade somada por combinação, não uma linha por posição');
    }

    sec('1b. O mês detectado no arquivo manda sobre o padrão do seletor');
    {
      /* O padrão era "próximo mês". Em novembro, dezembro — e um arquivo
         de novembro ia parar em dezembro sem ninguém notar, porque o
         seletor aparecia preenchido e preenchido parece conferido. */
      const r = await page.evaluate(() => {
        gMesDetectado = '2026-11';
        window._genMesEscolhido = null;
        genRenderMesSelect();
        const sel = document.getElementById('gen-mes-select');
        return {
          valor: sel.value,
          rotulo: [...sel.options].find((o) => o.selected)?.textContent.trim(),
          aviso: document.getElementById('gen-mes-origem')?.textContent || '',
        };
      });
      eq(r.valor, '2026-11', 'o seletor abre no mês lido do arquivo');
      ok(/do arquivo/.test(r.rotulo || ''), 'a opção diz que veio do arquivo: ' + r.rotulo);
      ok(/Período/.test(r.aviso), 'e o aviso nomeia o campo de onde saiu: ' + r.aviso);

      /* Sem detecção, o aviso tem de ser DIFERENTE — senão "preenchido"
         continua significando duas coisas. */
      const sem = await page.evaluate(() => {
        gMesDetectado = null;
        genRenderMesSelect();
        return document.getElementById('gen-mes-origem')?.textContent || '';
      });
      ok(/não traz o período/.test(sem) && /confira/.test(sem),
        'sem período no arquivo, pede conferência em vez de fingir certeza: ' + sem);
    }

    sec('2. Sem mês escolhido, não inventa um');
    {
      /* Gravar o dimensionamento num mês chutado é pior do que não
         gravar: ele passa a existir onde ninguém espera. */
      const r = await page.evaluate(async () => {
        window.__gravado = []; window.__navegou = null;
        const sel = document.getElementById('gen-mes-select');
        const antes = sel.value;
        sel.value = '';
        await genGoEscala();
        sel.value = antes;
        return { navegou: window.__navegou, gravado: window.__gravado.length };
      });
      eq(r.gravado, 0, 'nada é gravado sem mês definido');
      ok(r.navegou === 'escala', 'e a navegação cai na escala comum, sem fingir dimensionamento');
    }

    sec('3. Nenhum erro de script');
    ok(erros.length === 0, 'a página rodou sem exceção' + (erros.length ? ': ' + erros.join(' | ') : ''));
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
