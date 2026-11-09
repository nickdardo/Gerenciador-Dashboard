/* =====================================================================
   teste-exportar-tela.js — o Excel que é a foto da tela

   Já existia "Mais ações → Baixar Excel da escala": ela sai na ordem crua
   do banco, com as colunas da grade completa, e carrega o marcador que
   permite reimportar o arquivo depois.

   Esta é outra coisa, e a diferença importa: é a FOTO do que está na
   tela — mesma ordem, mesmos grupos de função, as mesmas conferências de
   6 dias e domingo que a grade mostra. É o arquivo que se imprime e se
   leva para a reunião.

   Por isso ela NÃO carrega o marcador de reimportação. Um arquivo que
   parecesse reimportável mas perdeu a coluna Turno voltaria apagando
   turno de todo mundo.

   Rodar:  node testes/teste-exportar-tela.js
   (precisa do xlsx: npm install xlsx)
   ===================================================================== */

'use strict';

const path = require('path');
const fs = require('fs');

let XLSX;
try {
  XLSX = require('xlsx');
} catch (_) {
  console.log('PULADO  teste de exportação — rode "npm install xlsx" nesta pasta para executá-lo.');
  process.exit(0);
}
const { chromium } = require('playwright');

const BASE = path.join(__dirname, '..');
let pass = 0, fail = 0;
const falhas = [];
const ok = (c, m) => { if (c) pass++; else { fail++; falhas.push(m); console.log('   \x1b[31m✗\x1b[0m ' + m); } };
const eq = (a, b, m) => ok(a === b, m + '  (esperado ' + JSON.stringify(b) + ', veio ' + JSON.stringify(a) + ')');
const sec = (t) => console.log('\n\x1b[36m── ' + t + '\x1b[0m');

const GENTE = [
  ['251595', 'ELIENE VIEIRA SANTOS FERNANDES', 'ASG LIMPEZA I', 180, '17:00'],
  ['250120', 'ROSANA MARTA DA ANUNCIACAO BRITO', 'ASG LIMPEZA I', 180, '06:00'],
  ['250125', 'JACKSON RAFAEL DE ANDRADE', 'ENC. DE LIMPEZA II', 180, '08:00'],
];

(async () => {
  const tmp = path.join(BASE, 'testes', '.exportar.html');
  fs.writeFileSync(tmp, `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"></head><body>
<script src="file://${path.join(BASE, 'node_modules', 'xlsx', 'dist', 'xlsx.full.min.js')}"><\/script>
<script src="file://${path.join(BASE, 'js', 'escala.js')}"><\/script></body></html>`);

  const browser = await chromium.launch();
  const page = await browser.newPage();
  const erros = [];
  page.on('pageerror', (e) => erros.push(e.message));
  await page.goto('file://' + tmp, { waitUntil: 'load' });

  const exportar = (pagina) => page.evaluate(([gente, pag]) => {
    const D = 30;
    window._escalaBase = 'GRU'; window._escalaMes = '2026-11';
    currentPage = pag;
    window._escalaDias = new Map(); window._escalaFeriados = new Map();
    window._escalaColabs = gente.map(([mat, nome, funcao, ch, entrada]) =>
      ({ matricula: mat, nome, funcao_manual: funcao, ch_manual: ch, entrada_manual: entrada, saida_manual: '' }));
    window.eoColabs = new Map(window._escalaColabs.map((c) => [c.matricula, { funcao: c.funcao_manual, ch: c.ch_manual }]));
    window.escalaFuncaoGrupoDoColab = (c) => ({ label: c.funcao_manual });
    window.escalaEntradaEfetivaDoColab = (c) => c.entrada_manual;
    // Folgas de seis em seis para a primeira pessoa; as outras ficam sem.
    for (let d = 1; d <= D; d += 6) window._escalaDias.set('251595|' + d, { status: 'F' });
    window.escalaMsg = (m) => { window.__ultimaMsg = m; };

    let capturado = null;
    const orig = XLSX.writeFile;
    XLSX.writeFile = (wb, nome) => { capturado = { nome, ws: wb.Sheets.Escala, abas: wb.SheetNames }; };
    try { escalaExportarTelaExcel(); } finally { XLSX.writeFile = orig; }
    if (!capturado) return null;
    return {
      nome: capturado.nome,
      abas: capturado.abas,
      aoa: XLSX.utils.sheet_to_json(capturado.ws, { header: 1, defval: '' }),
      merges: (capturado.ws['!merges'] || []).map((m) => [m.s.r, m.s.c, m.e.c]),
      views: capturado.ws['!views'] || null,
      cols: (capturado.ws['!cols'] || []).length,
      msg: window.__ultimaMsg,
    };
  }, [GENTE, pagina]);

  try {
    sec('1. O arquivo sai com a cara da tela');
    {
      const r = await exportar('capacity');
      ok(!!r, 'a exportação gerou um arquivo');
      if (r) {
        eq(r.nome, 'Escala_Capacity_GRU_2026-11.xlsx',
          'o nome diz qual escala, qual base e qual mês');
        eq(r.abas.join(','), 'Escala', 'uma aba só');
        ok(/Escala Capacity/.test(r.aoa[0][0]) && /GRU/.test(r.aoa[0][0]),
          'a primeira linha é o título com escala, base e mês: "' + r.aoa[0][0] + '"');
        ok(/Gerado em/.test(r.aoa[1][0]), 'a segunda diz quando foi gerado');

        const cab = r.aoa[3];
        eq(cab.slice(0, 4).join('|'), 'MATRÍCULA|NOME|FUNÇÃO|CH', 'as quatro colunas de identificação');
        eq(cab.slice(-5).join('|'), '6 DIAS|DOM.|FOLGAS|ENTRADA|SAÍDA',
          'e as conferências que a grade mostra, do mesmo jeito');
        eq(cab.length, 4 + 30 + 5, 'uma coluna por dia do mês entre elas (' + cab.length + ' no total)');
        ok(/^DOM/.test(cab[4]) && /1$/.test(cab[4].trim()),
          'o cabeçalho do dia traz o dia da semana junto: ' + JSON.stringify(cab[4]));
      }
    }

    sec('2. Os grupos viram faixa, como na grade');
    {
      const r = await exportar('capacity');
      eq(r.aoa[4][0], 'ASG LIMPEZA I · 2 pessoas', 'a faixa nomeia o grupo e conta a gente');
      eq(r.aoa[7][0], 'ENC. DE LIMPEZA II · 1 pessoa', 'e concorda no singular quando é uma só');
      eq(r.merges.length, 2, 'cada faixa ocupa a linha inteira (2 mescladas)');
      ok(r.merges.every((m) => m[1] === 0 && m[2] === 38),
        'da primeira à última coluna, como na tela');
      // A ordem na planilha é a ordem dos grupos na tela, não a do banco.
      const nomes = [r.aoa[5][1], r.aoa[6][1], r.aoa[8][1]];
      eq(nomes.join(' / '), 'ELIENE VIEIRA SANTOS FERNANDES / ROSANA MARTA DA ANUNCIACAO BRITO / JACKSON RAFAEL DE ANDRADE',
        'e a gente sai agrupada, não na ordem crua');
    }

    sec('3. As conferências vão por extenso, não por símbolo');
    {
      /* ✓ e ✗ viram emoji colorido em algumas fontes, e a planilha é
         documento de trabalho — às vezes impresso em preto e branco. */
      const r = await exportar('capacity');
      const linha = r.aoa[5];
      const [seq, dom, folgas] = linha.slice(-5, -2);
      ok(!/[✓✔✕✖✗✘❌✅]/.test(r.aoa.flat().join('')), 'nenhum visto ou cruz no arquivo inteiro');
      ok(seq === 'OK' || /dias$/.test(seq), '6 dias sai como OK ou o número: ' + JSON.stringify(seq));
      ok(dom === 'OK' || /dom\.$/.test(dom), 'domingo idem: ' + JSON.stringify(dom));
      ok(/^\d+\/\d+$/.test(folgas), 'e as folgas como feitas/meta: ' + JSON.stringify(folgas));
    }

    sec('4. O cabeçalho e a identificação ficam congelados');
    {
      const r = await exportar('capacity');
      ok(r.views && r.views[0] && r.views[0].state === 'frozen', 'o painel sai congelado');
      eq(r.views[0].xSplit, 4, 'as quatro colunas de identificação ficam à vista ao rolar');
      eq(r.views[0].ySplit, 4, 'e o cabeçalho também');
      eq(r.cols, 39, 'cada coluna com largura própria — dia estreito, nome largo');
    }

    sec('5. Este arquivo não se finge de reimportável');
    {
      /* A outra exportação carrega um marcador na primeira linha, que a
         importação reconhece. Esta não pode ter: ela perdeu a coluna
         Turno, e voltar por aqui apagaria o turno de todo mundo. */
      const r = await exportar('capacity');
      const tudo = r.aoa.flat().join(' ');
      ok(!/#ESCALA-ONLINE-V1/.test(tudo), 'sem o marcador de reimportação');
      ok(!/NÃO ALTERE ESTA LINHA/.test(tudo), 'e sem a linha de aviso que acompanha o marcador');
    }

    sec('6. O nome do arquivo acompanha a escala aberta');
    {
      const base = await exportar('escala');
      eq(base.nome, 'Escala_Base_GRU_2026-11.xlsx', 'pela Escala Base, o arquivo diz Base');
      ok(/Escala Base/.test(base.aoa[0][0]), 'e o título dentro também');
    }

    sec('7. Nenhum erro de script');
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
