/* =====================================================================
   teste-paginacao.js — o corte silencioso de 1.000 linhas

   O PostgREST devolve no máximo 1.000 linhas por consulta e NÃO levanta
   erro quando corta: devolve menos. O sintoma é sempre o mesmo e é o pior
   tipo — dado que existe no banco, não aparece na tela, e nada no
   console. Foi assim que uma base de 1.200 pessoas virou "Calculando
   folgas para 1000 colaboradores".

   Este teste finge um banco que se comporta como o PostgREST de verdade:
   respeita range, corta em 1.000 e nunca reclama. Se alguém voltar a
   consultar sem paginar, o número aqui para de bater.

   Rodar:  node testes/teste-paginacao.js
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

/* Banco de mentira com as manias do PostgREST: corta em 1.000, respeita
   range, registra o que foi pedido e jamais devolve erro por corte. */
const BANCO = `
window.__consultas = [];
window.__linhas = {};
window.db = {
  from(tabela) {
    const q = { tabela, ordens: [], faixa: null, filtros: {} };
    const api = {
      select() { return api; },
      eq(col, val) { q.filtros[col] = val; return api; },
      order(col) { q.ordens.push(col); return api; },
      range(de, ate) {
        q.faixa = [de, ate];
        window.__consultas.push(JSON.parse(JSON.stringify(q)));
        const todas = window.__linhas[tabela] || [];
        const TETO = 1000;                       // o corte do PostgREST
        const fim = Math.min(ate, de + TETO - 1);
        return Promise.resolve({ data: todas.slice(de, fim + 1), error: null });
      },
      then(res) {
        // Consulta SEM range: é aqui que o corte mordia.
        window.__consultas.push(JSON.parse(JSON.stringify(q)));
        const todas = window.__linhas[tabela] || [];
        return Promise.resolve({ data: todas.slice(0, 1000), error: null }).then(res);
      },
    };
    return api;
  },
};
`;

(async () => {
  const tmp = path.join(BASE, 'testes', '.paginacao.html');
  fs.writeFileSync(tmp, `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"></head><body>
<script>${BANCO}<\/script>
<script src="file://${path.join(BASE, 'js', 'escala.js')}"><\/script></body></html>`);

  const browser = await chromium.launch();
  const page = await browser.newPage();
  const erros = [];
  page.on('pageerror', (e) => erros.push(e.message));
  await page.goto('file://' + tmp, { waitUntil: 'load' });

  const semear = (tabela, n, molde) => page.evaluate(([t, qtd, m]) => {
    window.__consultas = [];
    window.__linhas[t] = Array.from({ length: qtd }, (_, i) => {
      const linha = {};
      for (const k of Object.keys(m)) linha[k] = m[k] === '#' ? String(1000 + i) : m[k];
      return linha;
    });
  }, [tabela, n, molde]);

  try {
    sec('1. Mil e duzentos colaboradores voltam mil e duzentos');
    {
      /* O número da queixa. Com 1.200 na base, o painel anunciava 1000 —
         e as 200 pessoas que faltavam não davam erro nenhum. */
      await semear('escala_colaborador', 1200, { matricula: '#', nome: 'FULANO', cenario: 'dimensionada' });
      const r = await page.evaluate(async () => {
        window._escalaCenario = 'dimensionada';
        const lista = await escalaFetchColaboradores('GRU', '2026-11');
        return { n: lista.length, consultas: window.__consultas.length,
                 unicos: new Set(lista.map((x) => x.matricula)).size };
      });
      eq(r.n, 1200, 'a lista inteira volta, não só os primeiros mil');
      eq(r.unicos, 1200, 'e sem linha repetida entre as páginas');
      eq(r.consultas, 2, 'em duas páginas — 1.000 e depois 200');
    }

    sec('2. A paginação para quando a página vem curta');
    {
      /* Exatamente 1.000 é o caso que engana: a primeira página vem
         cheia, e só a segunda, vazia, prova que acabou. Parar antes
         deixaria de fora qualquer linha de uma base com 1.001. */
      await semear('escala_colaborador', 1000, { matricula: '#', nome: 'FULANO' });
      const cheio = await page.evaluate(async () => {
        const l = await escalaFetchColaboradores('GRU', '2026-11');
        return { n: l.length, consultas: window.__consultas.length };
      });
      eq(cheio.n, 1000, 'mil linhas voltam mil');
      eq(cheio.consultas, 2, 'com uma página a mais para confirmar o fim');

      await semear('escala_colaborador', 1001, { matricula: '#', nome: 'FULANO' });
      const umAMais = await page.evaluate(async () =>
        (await escalaFetchColaboradores('GRU', '2026-11')).length);
      eq(umAMais, 1001, 'e a milésima primeira não se perde');

      await semear('escala_colaborador', 0, { matricula: '#' });
      const vazio = await page.evaluate(async () => {
        const l = await escalaFetchColaboradores('GRU', '2026-11');
        return { n: l.length, consultas: window.__consultas.length };
      });
      eq(vazio.n, 0, 'base vazia devolve lista vazia');
      eq(vazio.consultas, 1, 'sem insistir em páginas que não existem');
    }

    sec('3. Toda consulta paginada pede ordem estável');
    {
      /* Sem ORDER BY o PostgREST não garante a mesma ordem entre
         páginas: a mesma linha pode vir duas vezes e outra, nenhuma. O
         segundo critério existe porque o preenchimento grava em lotes de
         200 — muita gente divide o mesmo created_at, e o desempate ficaria
         a cargo do banco. */
      await semear('escala_colaborador', 1200, { matricula: '#', nome: 'FULANO' });
      const q = await page.evaluate(async () => {
        await escalaFetchColaboradores('GRU', '2026-11', 'created_at');
        return window.__consultas.map((c) => c.ordens.join(','));
      });
      ok(q.every((o) => o.split(',').length >= 2),
        'a consulta de colaboradores ordena por dois critérios: ' + q[0]);
      ok(q.every((o) => o.includes('matricula')),
        'com a matrícula como desempate, que é única por escala');

      await semear('escala_dia', 1200, { matricula: '#', dia: 1 });
      const qd = await page.evaluate(async () => {
        await escalaFetchDias('GRU', '2026-11');
        return window.__consultas.map((c) => c.ordens.join(','));
      });
      ok(qd.every((o) => o === 'matricula,dia'),
        'e a de dias ordena por matrícula e dia: ' + qd[0]);
    }

    sec('4. As marcações do mês inteiro cabem na conta');
    {
      /* 1.200 pessoas × 30 dias = 36 mil linhas. Era este o número que o
         Comparador lia cortado em 1.000 — menos de 3% da escala — e o
         gráfico saía parecendo certo. */
      await semear('escala_dia', 36000, { matricula: '#', dia: 1, status: 'F' });
      const r = await page.evaluate(async () => {
        const d = await escalaFetchDias('GRU', '2026-11');
        return { n: d.length, consultas: window.__consultas.length };
      });
      eq(r.n, 36000, 'as 36 mil marcações voltam inteiras');
      // 36.000 é múltiplo exato de 1.000: a 37ª página é a vazia que
      // prova o fim, pela mesma regra da seção 2.
      eq(r.consultas, 37, 'em 36 páginas cheias mais a que confirma o fim');
    }

    sec('5. O Comparador lê os dois cenários por inteiro');
    {
      const r = await page.evaluate(async () => {
        window.__linhas['escala_colaborador'] = Array.from({ length: 1200 }, (_, i) =>
          ({ matricula: String(1000 + i), nome: 'FULANO' }));
        window.__linhas['escala_dia'] = Array.from({ length: 3000 }, (_, i) =>
          ({ matricula: String(1000 + (i % 1200)), dia: (i % 30) + 1, status: 'F' }));
        window.__consultas = [];
        window._escalaBase = 'GRU'; window._escalaMes = '2026-11';
        const c = await escalaLerCenario('planejada');
        return { colabs: c.colabs.length, dias: c.dias.size,
                 cenarios: [...new Set(window.__consultas.map((q) => q.filtros.cenario))] };
      });
      eq(r.colabs, 1200, 'o cenário comparado traz os 1.200, não 1.000');
      ok(r.dias > 1000, `e as marcações passam do corte (${r.dias})`);
      eq(r.cenarios.join(), 'planejada',
        'lendo o cenário pedido, não o que está aberto na tela');
    }

    sec('6. Nenhuma consulta grande ficou sem paginar');
    {
      /* Guarda de regressão por leitura do próprio arquivo: é fácil
         acrescentar uma consulta nova e repetir o erro, porque ele não
         dá sinal nenhum em desenvolvimento, onde a base é pequena. */
      const fonte = fs.readFileSync(path.join(BASE, 'js', 'escala.js'), 'utf8');
      const linhas = fonte.split('\n');
      const grandes = ['escala_colaborador', 'escala_dia', 'escala_dimensionamento'];
      const soltas = [];
      linhas.forEach((l, i) => {
        const m = l.match(/\.from\('([a-z_]+)'\)/);
        if (!m || !grandes.includes(m[1])) return;
        if (!/\.select\(/.test(l)) return;
        const ctx = linhas.slice(i, i + 4).join(' ');
        if (/\.range\(|\.limit\(|maybeSingle|\.single\(|count:\s*'exact'|head:\s*true/.test(ctx)) return;
        // Consulta de uma pessoa só não passa de 31 linhas.
        if (/\.eq\('matricula'/.test(ctx)) return;
        soltas.push(`${i + 1}: ${l.trim().slice(0, 90)}`);
      });
      ok(soltas.length === 0,
        'nenhuma leitura de tabela grande sem paginar' + (soltas.length ? ':\n      ' + soltas.join('\n      ') : ''));
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
