/* =====================================================================
   teste-comparador.js — Escala Base × Escala Capacity

   As duas escalas respondem à mesma pergunta por caminhos opostos: a
   Base parte de quem já está lá (ponto batido, mês anterior), a Capacity
   parte do que a malha aérea pede. Comparar é medir a distância entre as
   duas — e essa medida tem duas armadilhas de relógio que, erradas,
   passam despercebidas porque o gráfico continua bonito:

   1. COBERTURA: um turno 22:00–04:00 cobre 22, 23, 0, 1, 2 e 3. Tratar
      entrada < saída como regra geral perde exatamente os turnos de
      madrugada, que são os mais críticos de dimensionar.

   2. DESLOCAMENTO: de 23:00 para 01:00 são duas horas, não vinte e duas.
      Medir a diferença crua faria a virada da meia-noite parecer a maior
      ruptura da base, quando é uma das menores.

   Rodar:  node testes/teste-comparador.js
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

(async () => {
  const tmp = path.join(BASE, 'testes', '.comparador.html');
  fs.writeFileSync(tmp, `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"></head><body>
<script>
  window.escalaFuncaoGrupoDoColab = (c) => ({ label: c.grupo || 'Limpeza' });
  window.escalaSaidaCalculada = (entrada, ch) => {
    const [h, m] = String(entrada).split(':').map(Number);
    const horas = Number(String(ch).replace(/\\D/g, '')) >= 180 ? 6 : 3;
    return String((h + horas) % 24).padStart(2, '0') + ':' + String(m).padStart(2, '0');
  };
  window.eoColabs = new Map();
<\/script>
<script src="file://${path.join(BASE, 'js', 'comparador.js')}"><\/script></body></html>`);

  const browser = await chromium.launch();
  const page = await browser.newPage();
  const erros = [];
  page.on('pageerror', (e) => erros.push(e.message));
  await page.goto('file://' + tmp, { waitUntil: 'load' });

  const pessoas = (lista) => page.evaluate((ls) =>
    new Map(ls.map((p) => [p.matricula, {
      matricula: p.matricula, nome: p.nome, grupo: p.grupo || 'Limpeza',
      horario: p.entrada === null ? null
        : { entrada: Number(p.entrada.split(':')[0]) * 60 + Number(p.entrada.split(':')[1]),
            saida: Number(p.saida.split(':')[0]) * 60 + Number(p.saida.split(':')[1]) },
    }])), lista);

  try {
    sec('1. Cobertura conta a virada da meia-noite');
    {
      const r = await page.evaluate(() => {
        const mk = (e, s) => ({ horario: { entrada: e, saida: s }, grupo: 'Limpeza' });
        const m = new Map([
          // 22:00–04:00 — atravessa a meia-noite.
          ['1', mk(22 * 60, 4 * 60)],
          // 06:00–12:00 — turno comum, para servir de controle.
          ['2', mk(6 * 60, 12 * 60)],
        ]);
        return cmpCoberturaPorHora(m, null);
      });

      eq(r[22], 1, 'às 22h o turno da madrugada já está em posto');
      eq(r[23], 1, 'às 23h também');
      eq(r[0], 1, 'à meia-noite continua — é aqui que a conta ingênua zera');
      eq(r[3], 1, 'às 3h ainda está');
      eq(r[4], 0, 'às 4h saiu, porque a saída não conta como hora coberta');
      eq(r[6], 1, 'o turno de controle entra às 6h');
      eq(r[12], 0, 'e sai às 12h');
      eq(r[13], 0, 'nenhuma hora fica coberta sem alguém em posto');
      eq(r.length, 24, 'a série tem as 24 horas do dia');
    }

    sec('2. O deslocamento é medido pelo caminho mais curto do relógio');
    {
      const r = await page.evaluate(() => {
        const mk = (mat, e) => [mat, { matricula: mat, nome: 'P' + mat, grupo: 'Limpeza',
          horario: e === null ? null : { entrada: e, saida: (e + 360) % 1440 } }];
        const dados = {
          base: new Map([mk('1', 23 * 60), mk('2', 6 * 60), mk('3', 6 * 60), mk('4', 8 * 60)]),
          capacity: new Map([mk('1', 1 * 60), mk('2', 6 * 60), mk('3', 14 * 60), mk('5', 7 * 60)]),
        };
        const linhas = cmpDisrupcao(dados, null);
        return Object.fromEntries(linhas.map((l) => [l.matricula, { d: l.delta, t: l.tipo }]));
      });

      eq(r['1'].d, 120,
        'de 23:00 para 01:00 são 2h — não 22h, que é o que a subtração crua daria');
      eq(r['2'].d, 0, 'quem não muda fica com zero');
      eq(r['3'].d, 480, 'de 06:00 para 14:00 são 8h');
      eq(r['4'].t, 'soBase', 'quem está só na Base sai da escala');
      eq(r['5'].t, 'soCapacity', 'e quem está só na Capacity entra nela');
    }

    sec('3. O resumo separa o que exige conversa do que não exige');
    {
      /* Meia hora a mais não é renegociação; virar o turno é. Juntar as
         duas numa só contagem esconde o tamanho do problema. */
      const r = await page.evaluate(() => {
        const mk = (mat, e) => [mat, { matricula: mat, nome: 'P' + mat, grupo: 'Limpeza',
          horario: { entrada: e, saida: (e + 360) % 1440 } }];
        const dados = {
          base: new Map([mk('1', 360), mk('2', 360), mk('3', 360), mk('4', 360), mk('5', 360)]),
          capacity: new Map([mk('1', 360), mk('2', 390), mk('3', 480), mk('4', 660), mk('5', 1080)]),
        };
        const res = cmpResumo(cmpDisrupcao(dados, null));
        return Object.fromEntries(res.faixas);
      });
      eq(r['Sem mudança'], 1, 'quem fica no mesmo horário');
      eq(r['Até 1h'], 1, 'meia hora entra na faixa que não exige renegociação');
      eq(r['De 1h a 3h'], 1, 'duas horas, na seguinte');
      eq(r['De 3h a 6h'], 1, 'cinco horas');
      eq(r['Mais de 6h'], 1, 'e doze horas, que é virar o turno');
    }

    sec('4. Só a Base herda o horário do ponto batido');
    {
      /* É a diferença que define as duas escalas, e o comparador precisa
         aplicá-la por cenário — não pela escala que está aberta. */
      const r = await page.evaluate(() => {
        window.escalaHorarioFixoDoColab = () => '04:30-10:30';
        const semHorario = { matricula: '9', entrada_manual: null, saida_manual: null, ch_manual: 180 };
        return {
          base: cmpHorarioDe(semHorario, 'planejada', 2026, 11, 30),
          capacity: cmpHorarioDe(semHorario, 'dimensionada', 2026, 11, 30),
        };
      });
      eq(r.base && r.base.entrada, 4 * 60 + 30, 'na Base, sem horário gravado, vale o ponto batido');
      eq(r.capacity, null, 'na Capacity, não — ali o horário só vem do dimensionamento');
    }

    sec('5. Uma escala vazia não vira gráfico');
    {
      /* Comparar uma escala pela metade com outra pronta produz um
         gráfico que parece dizer algo e não diz. */
      const r = await page.evaluate(async () => {
        cmpDados = {
          base: new Map([['1', { matricula: '1', nome: 'A', grupo: 'Limpeza',
            horario: { entrada: 360, saida: 720 } }]]),
          capacity: new Map(),
          ano: 2026, mesNum: 11, diasNoMes: 30, nomeBase: 'GRU', mes: '2026-11',
        };
        document.body.insertAdjacentHTML('beforeend',
          '<div id="cmp-controles"></div><div id="cmp-corpo"></div>');
        cmpRender();
        return document.getElementById('cmp-corpo').innerHTML;
      });
      ok(/Falta uma das escalas/.test(r), 'diz que falta uma escala em vez de desenhar');
      ok(/Escala Capacity: 0 pessoa/.test(r), 'e nomeia qual é: ' + (/Escala Capacity: \d+ pessoa/.exec(r) || [''])[0]);
    }

    sec('6. A exportação leva as duas abas');
    {
      const r = await page.evaluate(() => {
        const mk = (mat, e) => [mat, { matricula: mat, nome: 'P' + mat, grupo: 'Limpeza',
          horario: { entrada: e, saida: (e + 360) % 1440 } }];
        cmpDados = {
          base: new Map([mk('1', 360), mk('2', 1320)]),
          capacity: new Map([mk('1', 480), mk('2', 60)]),
          ano: 2026, mesNum: 11, diasNoMes: 30, nomeBase: 'GRU', mes: '2026-11',
        };
        cmpGrupo = null;
        let capturado = null;
        window.XLSX = {
          utils: {
            book_new: () => ({ SheetNames: [], Sheets: {} }),
            aoa_to_sheet: (a) => ({ __aoa: a }),
            book_append_sheet: (wb, ws, nome) => { wb.SheetNames.push(nome); wb.Sheets[nome] = ws; },
          },
          writeFile: (wb, nome) => { capturado = { wb, nome }; },
        };
        cmpExportar();
        return {
          nome: capturado.nome,
          abas: capturado.wb.SheetNames,
          horas: capturado.wb.Sheets['Cobertura por hora'].__aoa.length,
          quemMuda: capturado.wb.Sheets['Quem muda'].__aoa.slice(1).map((l) => [l[0], l[5]]),
        };
      });
      eq(r.nome, 'Comparacao_GRU_2026-11.xlsx', 'o arquivo diz base e mês');
      eq(r.abas.join(' / '), 'Cobertura por hora / Quem muda', 'duas abas, uma por pergunta');
      eq(r.horas, 25, 'a cobertura traz as 24 horas mais o cabeçalho');
      /* 22:00 → 01:00 são 3h = 180 min, pelo caminho curto. A exportação
         usa o mesmo cálculo da tela, senão as duas discordariam. */
      const p2 = r.quemMuda.find((l) => l[0] === '2');
      eq(p2 && p2[1], 180, 'e o deslocamento exportado é o mesmo da tela, pelo caminho curto');
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
