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

    sec('7. A régua não muda de valor a cada filtro');
    {
      /* Usar o próprio máximo como topo faz o eixo virar 387, depois
         112, depois 1.204 — e duas telas lado a lado deixam de ser
         comparáveis, porque a mesma altura significa coisas diferentes. */
      const r = await page.evaluate(() => ({
        a: cmpTeto(387, 4), b: cmpTeto(368, 4), c: cmpTeto(112, 4),
        d: cmpTeto(14, 4), e: cmpTeto(0, 4), f: cmpTeto(400, 4),
      }));
      eq(r.a, 400, '387 e 368 caem no mesmo teto redondo');
      eq(r.b, 400, 'o segundo deles também');
      eq(r.c, 120, '112 não precisa de uma régua até 400');
      eq(r.d, 16, 'a régua de voos acompanha a ordem de grandeza dos voos');
      eq(r.e, 4, 'série zerada ainda tem régua, em vez de dividir por zero');
      eq(r.f, 400, 'um máximo já redondo não é inflado para o degrau seguinte');
    }

    sec('8. Os voos têm eixo próprio — não entram na régua de pessoas');
    {
      /* Pessoas são centenas e voos são dezenas. Desenhar os dois na
         mesma régua ou some com os voos (14 em 400 vira meio pixel) ou
         os faz cruzar as curvas e disputar a leitura. */
      const r = await page.evaluate(() => {
        const base = [112,108,96,101,128,150,159,268,352,368,299,248,286,301,294,276,252,238,249,272,331,352,344,300];
        const cap  = [95,92,86,89,106,132,165,206,229,185,176,151,191,206,201,186,171,161,171,186,206,211,201,151];
        const voos = [4,2,1,1,2,5,9,12,14,11,8,7,9,10,9,8,7,8,10,12,13,11,8,6];
        const com = cmpGraficoCobertura(base, cap, voos);
        const sem = cmpGraficoCobertura(base, cap, new Array(24).fill(0));
        const alturas = [...com.matchAll(/fill="var\(--cmp-voo-fill\)"[^>]*/g)].length;
        const hs = [...com.matchAll(/height="([\d.]+)"\s+rx="2"\s+fill="var\(--cmp-voo-fill\)"/g)]
          .map((m) => Number(m[1]));
        return {
          barras: alturas,
          maiorBarra: Math.max(...hs),
          temEixoVoos: />voos</.test(com),
          semEixoVoos: />voos</.test(sem),
          barrasSem: [...sem.matchAll(/fill="var\(--cmp-voo-fill\)"/g)].length,
          // O estado do hover é montado pelo desenho; `sem` foi o último
          // a rodar, então é o dele que está guardado agora.
          malhaNoHover: window._cmpHover.temVoo,
        };
      });

      eq(r.barras, 24, 'uma barra por hora com voo');
      /* Área útil do gráfico: 340 − 26 − 28 = 286px. Os voos ocupam 38%
         dela, ou seja, no máximo ~109px, e o pico de 14 em 16 dá ~95. Se
         alguém puser os voos na régua de pessoas, 14 em 400 daria ~10px;
         se usar a altura cheia, ~250. Os dois erros caem fora da janela. */
      ok(r.maiorBarra > 60 && r.maiorBarra < 120,
        'a barra do pico ocupa a faixa de baixo, nem some nem toma o gráfico (veio ' + r.maiorBarra.toFixed(1) + 'px)');
      ok(r.temEixoVoos, 'com malha, o eixo da direita é rotulado');
      ok(!r.semEixoVoos, 'sem malha, o eixo da direita não aparece marcando zeros');
      eq(r.barrasSem, 0, 'e nenhuma barra é desenhada');
      ok(r.malhaNoHover === false, 'e o hover sabe que não há malha, para não oferecer uma linha de voos vazia');
    }

    sec('8b. Passar o mouse mostra a hora apontada, não o tooltip do sistema');
    {
      /* O <title> do SVG mostrava os mesmos números, mas é o tooltip do
         sistema operacional: demora quase um segundo, some sozinho, não
         acompanha o cursor e não tem como pôr as três séries lado a
         lado com as cores delas. */
      const r = await page.evaluate(() => {
        const base = [112,108,96,101,128,150,159,268,352,368,299,248,286,301,294,276,252,238,249,272,331,352,344,300];
        const cap  = [95,92,86,89,106,132,165,206,229,185,176,151,191,206,201,186,171,161,171,186,206,211,201,151];
        const voos = [4,2,1,1,2,5,9,12,14,11,8,7,9,10,9,8,7,8,10,12,13,11,8,6];

        document.body.innerHTML =
          '<div id="cmp-grafico" style="position:relative;width:1200px"></div>';
        const alvo = document.getElementById('cmp-grafico');
        alvo.innerHTML = cmpGraficoCobertura(base, cap, voos, 1200)
          + '<div class="cmp-tip" id="cmp-tip"></div>';

        const svg = alvo.querySelector('svg');
        const cx = svg.getBoundingClientRect();
        const d = window._cmpHover;
        const emCimaDe = (h) => ({ clientX: cx.left + (d.ML + h * d.largura + d.largura / 2) * cx.width / d.W });

        cmpHover(emCimaDe(9), svg);
        const tip = document.getElementById('cmp-tip');
        const ligado = {
          texto: tip.textContent.replace(/\s+/g, ' ').trim(),
          visivel: tip.classList.contains('on'),
          guia: Number(document.getElementById('cmp-guia').getAttribute('x1')),
          pontoBase: Number(document.getElementById('cmp-foco-base').getAttribute('opacity')),
          barra: Number(document.getElementById('cmp-foco-barra').getAttribute('opacity')),
        };

        // Segunda hora: a guia tem de ANDAR, não ficar presa na primeira.
        cmpHover(emCimaDe(20), svg);
        const andou = Number(document.getElementById('cmp-guia').getAttribute('x1'));
        const texto20 = tip.textContent.replace(/\s+/g, ' ').trim();

        // Fora da área das 24 horas, nada fica aceso.
        cmpHover({ clientX: cx.left + 2 }, svg);
        const foraDaArea = tip.classList.contains('on');

        cmpHover(emCimaDe(9), svg);
        cmpHoverFim();
        const depois = {
          visivel: tip.classList.contains('on'),
          guia: Number(document.getElementById('cmp-guia').getAttribute('opacity')),
        };
        return { ligado, andou, texto20, foraDaArea, depois };
      });

      ok(r.ligado.visivel, 'o cartão aparece ao passar o mouse');
      ok(/09h às 10h/.test(r.ligado.texto), 'e diz qual hora está sendo lida: ' + r.ligado.texto);
      ok(/Escala Base368/.test(r.ligado.texto), 'com o valor da Base daquela hora');
      ok(/Escala Capacity185/.test(r.ligado.texto), 'o da Capacity');
      ok(/Diferença\+183/.test(r.ligado.texto), 'a diferença já calculada, com sinal');
      ok(/Voos na hora11/.test(r.ligado.texto), 'e os voos da hora');
      eq(r.ligado.pontoBase, 1, 'o ponto na curva da Base acende');
      ok(r.ligado.barra > 0, 'e a barra de voo da hora é realçada');

      ok(r.andou > r.ligado.guia, 'a guia acompanha o cursor em vez de ficar presa na primeira hora');
      ok(/20h às 21h/.test(r.texto20), 'e o cartão troca de hora junto: ' + r.texto20.slice(0, 12));
      ok(!r.foraDaArea, 'fora da área das 24 horas o cartão some');
      ok(!r.depois.visivel && r.depois.guia === 0, 'e ao tirar o mouse some tudo, sem deixar guia acesa');
    }

    sec('8c. O desenho sai no tamanho medido, não esticado pelo CSS');
    {
      /* A primeira versão era um SVG elástico (viewBox + width:100%).
         Num monitor de 2.000px o desenho inteiro era ampliado junto: a
         fonte de 11px virava 17, a caixa da chamada ficava do tamanho de
         um cartão e as curvas se achatavam. Agora a largura é medida e
         entra na conta, e a altura não acompanha. */
      const r = await page.evaluate(() => {
        const b = new Array(24).fill(100), c = new Array(24).fill(80), v = new Array(24).fill(0);
        const medir = (larg) => {
          const s = cmpGraficoCobertura(b, c, v, larg);
          const m = /^<svg width="(\d+)" height="(\d+)"/.exec(s.trim());
          return { w: Number(m[1]), h: Number(m[2]), elastico: /width="100%"/.test(s) };
        };
        return { normal: medir(900), largo: medir(2400), estreito: medir(180), semArg: medir(undefined) };
      });

      eq(r.normal.w, 900, 'a largura pedida é a largura desenhada');
      eq(r.normal.h, 340, 'e a altura é fixa');
      eq(r.largo.h, 340, 'numa tela larga a altura continua a mesma — não estica junto');
      ok(r.largo.w <= 1600, 'a largura tem teto, para o gráfico não virar uma faixa rasa: ' + r.largo.w);
      ok(r.estreito.w >= 620, 'e piso, para as 24 horas não se esmagarem: ' + r.estreito.w);
      ok(r.semArg.w > 0, 'sem medida informada, ainda sai um tamanho utilizável');
      ok(!r.normal.elastico, 'nenhum width="100%" sobrou no SVG');
    }

    sec('9. A hora de maior diferença é escrita no gráfico');
    {
      const r = await page.evaluate(() => {
        const base = new Array(24).fill(100); base[9] = 368;
        const cap = new Array(24).fill(100); cap[9] = 185;
        const svg = cmpGraficoCobertura(base, cap, new Array(24).fill(0));
        return { txt: (/>(\d+) pessoa\(s\) (a menos|a mais)</.exec(svg) || []).slice(1).join(' '),
                 hora: (/às (\d{2})h na Capacity/.exec(svg) || [])[1] };
      });
      eq(r.txt, '183 a menos', 'a chamada diz o tamanho e o sentido da diferença');
      eq(r.hora, '09', 'e a hora em que ela acontece');
    }

    sec('10. A planilha leva a coluna de voos');
    {
      const r = await page.evaluate(() => {
        const mk = (mat, e) => [mat, { matricula: mat, nome: 'P' + mat, grupo: 'Limpeza',
          horario: { entrada: e, saida: (e + 360) % 1440 } }];
        cmpDados = {
          base: new Map([mk('1', 360)]), capacity: new Map([mk('1', 480)]),
          ano: 2026, mesNum: 11, diasNoMes: 30, nomeBase: 'GRU', mes: '2026-11',
          voos: Array.from({ length: 24 }, (_, h) => h), diasComVoo: 30,
        };
        cmpGrupo = null;
        let cap = null;
        window.XLSX = {
          utils: {
            book_new: () => ({ SheetNames: [], Sheets: {} }),
            aoa_to_sheet: (a) => ({ __aoa: a }),
            book_append_sheet: (wb, ws, nome) => { wb.SheetNames.push(nome); wb.Sheets[nome] = ws; },
          },
          writeFile: (wb) => { cap = wb; },
        };
        cmpExportar();
        const aoa = cap.Sheets['Cobertura por hora'].__aoa;
        return { cab: aoa[0], linha7: aoa[8] };
      });
      eq(r.cab.length, 5, 'a aba de cobertura ganhou uma coluna');
      eq(r.cab[4], 'VOOS (PICO DO MÊS)', 'e ela diz que é pico, não média');
      eq(r.linha7[4], 7, 'o valor da hora bate com a série da malha');
    }

    sec('10b. A tela diz qual base e qual mês está comparando');
    {
      /* Um gráfico sem endereço não se leva para reunião: quem abre a
         tela não tem como saber se aquilo é GRU ou CGH. */
      const r = await page.evaluate(() => {
        window.adhMonthLabel = (m) => (m === '2026-11' ? 'Novembro/2026' : m);
        const mk = (mat, e) => [mat, { matricula: mat, nome: 'P' + mat, grupo: 'Limpeza',
          horario: { entrada: e, saida: (e + 360) % 1440 } }];
        cmpDados = {
          base: new Map([mk('1', 360), mk('2', 420)]),
          capacity: new Map([mk('1', 480), mk('2', 420)]),
          ano: 2026, mesNum: 11, diasNoMes: 30, nomeBase: 'GRU', mes: '2026-11',
          voos: new Array(24).fill(2), diasComVoo: 30,
        };
        cmpGrupo = null;
        document.body.innerHTML = '<div id="cmp-controles"></div><div id="cmp-corpo"></div>';
        cmpRender();
        const tit = document.querySelector('.cmp-tit .ctx');
        return {
          ctx: tit ? tit.textContent.trim() : '',
          desenhou: !!document.querySelector('#cmp-grafico svg'),
        };
      });
      ok(/GRU/.test(r.ctx), 'o painel do gráfico nomeia a base: ' + r.ctx);
      ok(/Novembro\/2026/.test(r.ctx), 'e o mês por extenso, não "2026-11"');
      ok(r.desenhou, 'e o gráfico é desenhado depois de o painel entrar na tela');
    }

    sec('11. Nenhum erro de script');
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
