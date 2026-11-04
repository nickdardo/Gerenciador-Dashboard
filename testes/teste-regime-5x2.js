/* =====================================================================
   teste-regime-5x2.js — o segundo regime e as regras que vieram com ele

   O Gerador nasceu 6x1: a quantidade de folgas do mês saía do TETO DE
   HORAS da CH, e a folga era o resto. O 5x2 inverte isso — são 8 folgas
   no mês, fechadas, e o teto deixa de decidir.

   Junto vieram duas regras que valem nos DOIS regimes, porque os dois
   problemas já aconteciam no 6x1:

   1. Nunca 3 folgas seguidas. Era só uma penalidade de 60 pontos contra
      1.000.000 das regras duras, e na escala real de novembro/2026 cinco
      pessoas em 277 saíam com três. A causa era a folga agrupada: o bloco
      FA + domingo já ocupa dois dias, e uma folga encostada fecha o três.

   2. Cursos nunca em sábado ou domingo. O fim de semana era o último
      degrau do planejador, usado quando a janela do curso não tinha dia
      útil livre. Esse degrau saiu — agora a janela é que cede.

   Rodar:  node testes/teste-regime-5x2.js
   ===================================================================== */

'use strict';

const path = require('path');
const E = require(path.join(__dirname, '..', 'js', 'folgas-engine.js'));

let pass = 0, fail = 0;
const falhas = [];
const ok = (c, m) => { if (c) pass++; else { fail++; falhas.push(m); console.log('   \x1b[31m✗\x1b[0m ' + m); } };
const eq = (a, b, m) => ok(a === b, m + '  (esperado ' + JSON.stringify(b) + ', veio ' + JSON.stringify(a) + ')');
const sec = (t) => console.log('\n\x1b[36m── ' + t + '\x1b[0m');

/* ------------------------------------------------- fabricação de modelo */
// A tabela real lida do arquivo de BEL: CH, teto de horas no mês, jornada.
const CH_TABLE = [
  { ch: 210, maxH: 168, jorn: 7 },
  { ch: 180, maxH: 150, jorn: 6 },
  { ch: 120, maxH: 100, jorn: 4 },
  { ch: 90, maxH: 72, jorn: 3 },
];

const diasDoMes = (Y, M) => new Date(Date.UTC(Y, M + 1, 0)).getUTCDate();
function mkMonth(Y, M) {
  const days = diasDoMes(Y, M);
  return { year: Y, month: M, days, label: E.MESES[M] + '/' + Y,
    dow: Array.from({ length: days }, (_, i) => new Date(Date.UTC(Y, M, i + 1)).getUTCDay()) };
}
let _r = 100;
function mkEmp(D, o = {}) {
  _r++;
  return { id: 'T!' + _r, row: _r, mat: 1000 + _r, name: o.name || ('COLAB ' + _r),
    fixed: o.fixed ? o.fixed.slice() : new Array(D).fill(''),
    prev: o.prev ? o.prev.slice() : ['', '', '', '', '', '', ''],
    ch: o.ch === undefined ? 180 : o.ch, gold: !!o.gold, team: '',
    entrada: '', saida: '', gen: new Array(D).fill(''),
    manual: o.manual ? o.manual.slice() : new Array(D).fill('') };
}
function mkModel(Y, M, emps) {
  const m = mkMonth(Y, M);
  return { month: m, unknownCodes: [], empCount: emps.length,
    sheets: [{ name: 'T', path: 'x.xml', chTable: CH_TABLE,
      blocks: [{ title: 'BLOCO', headerRow: 1, dateRow: 2, cur: [], prevCols: [], prevDates: [],
        groups: [{ label: 'G1', name: 'GRUPO 1', emps }] }] }] };
}
const todos = (m) => m.sheets.flatMap((s) => s.blocks.flatMap((b) => b.groups.flatMap((g) => g.emps)));
const codigos = (m, e) => Array.from({ length: m.month.days }, (_, d) => E.eff(e, d));
const cfg = (regime, extra) => ({ ...E.defaultSettings(), regime, ...(extra || {}) });

// Maior sequência de folgas seguidas. Férias ficam de fora: um mês inteiro
// de L é um bloco de 30 e acusar isso seria ruído, não defeito.
function maiorBlocoDeFolga(m, e, st) {
  const c = codigos(m, e);
  let seq = 0, mx = 0;
  for (const x of c) {
    const k = E.kind(x, st);
    if ((k === 'offC' || k === 'offX') && x !== 'L') { seq++; if (seq > mx) mx = seq; } else seq = 0;
  }
  return mx;
}

/* ===================================================================== */

sec('1. O regime existe e o 6x1 continua sendo o padrão');
{
  const nomes = Object.keys(E.REGIMES);
  eq(nomes.length, 2, 'são dois regimes (' + nomes.join(', ') + ')');
  ok(nomes.includes('6x1') && nomes.includes('5x2'), 'chamados 6x1 e 5x2');
  eq(E.REGIME_PADRAO, '6x1', 'o padrão é o 6x1 — quem não escolher nada continua como antes');
  eq(E.defaultSettings().regime, '6x1', 'e as configurações de fábrica trazem o padrão');
  eq(E.regimeDe({}), '6x1', 'sem regime definido, cai no padrão');
  eq(E.regimeDe({ regime: '7x0' }), '6x1', 'regime desconhecido também cai no padrão, em vez de quebrar');
  eq(E.REGIMES['6x1'].folgasSemana, null, 'no 6x1 não há cota semanal — as folgas saem do teto de horas');
  eq(E.REGIMES['5x2'].folgasSemana, 2, 'no 5x2 são 2 por semana');
}

sec('1b. As semanas de segunda a domingo que o mês atravessa');
{
  const sheet = { chTable: CH_TABLE };
  const st = cfg('5x2');
  const semPrev = { ch: 180, prev: ['', '', '', '', '', '', ''] };

  // Novembro/2026 começa num DOMINGO: a semana do dia 1º começou em 26/10.
  const nov = E.requirement(semPrev, sheet, 30, st, mkMonth(2026, 10).dow);
  eq(nov.semanas.length, 6, 'novembro/2026 atravessa 6 semanas');
  eq(nov.semanas[0].antes, 6, 'a primeira tem 6 dias no mês anterior');
  eq(nov.semanas[0].ini, 0, 'e um dia só aqui: o próprio dia 1º');
  ok(nov.semanas[5].aberta, 'a última fica aberta — fecha em dezembro');
  eq(nov.alvos[0], 1, 'a semana da virada não pode pedir 2 folgas em 1 dia: pede 1');
  eq(nov.alvos[1], 2, 'as semanas inteiras pedem 2');
  eq(nov.alvos[5], 0, 'e a aberta de um dia não pede nenhuma');
  eq(nov.required, 9, 'o total do mês é a soma das semanas, não um número escolhido');

  // Fevereiro/2027 começa numa SEGUNDA: quatro semanas exatas, sem pontas.
  const fev = E.requirement(semPrev, sheet, 28, st, mkMonth(2027, 1).dow);
  eq(fev.semanas.length, 4, 'fevereiro/2027 cabe em 4 semanas exatas');
  eq(fev.semanas[0].antes, 0, 'sem rabicho do mês anterior');
  ok(!fev.semanas[3].aberta, 'e sem semana aberta no fim');
  eq(fev.required, 8, 'oito folgas, 2 em cada semana');

  // O que o mês anterior já entregou na semana da virada desconta aqui.
  const comFolga = { ch: 180, prev: ['', '', '', '', 'F', '', ''] };
  const nov2 = E.requirement(comFolga, sheet, 30, st, mkMonth(2026, 10).dow);
  eq(nov2.alvos[0], 1, 'uma folga no rabicho de outubro deixa 1 para novembro');
  const comDuas = { ch: 180, prev: ['', '', '', 'F', '', 'F', ''] };
  const nov3 = E.requirement(comDuas, sheet, 30, st, mkMonth(2026, 10).dow);
  eq(nov3.alvos[0], 0, 'duas no rabicho e a semana já está paga');
  eq(nov3.required, 8, 'e o total do mês cai junto');
}

sec('2. Quantas folgas cada regime pede');
{
  const sheet = { chTable: CH_TABLE };
  // 6x1: o teto de horas manda, então o número muda com a CH e com o mês.
  for (const [ch, D, esperado] of [[180, 30, 5], [180, 31, 6], [90, 30, 6], [210, 31, 7]]) {
    eq(E.requirement({ ch }, sheet, D, cfg('6x1')).required, esperado,
      `6x1, CH ${ch}, mês de ${D} dias`);
  }
  // 5x2: a cota é a mesma para todo mundo, venha ou não a CH na tabela.
  const novDow = mkMonth(2026, 10).dow;
  const vazio = ['', '', '', '', '', '', ''];
  for (const ch of [210, 180, 120, 90, null, 999]) {
    eq(E.requirement({ ch, prev: vazio }, sheet, 30, cfg('5x2'), novDow).required, 9,
      `5x2, CH ${ch === null ? 'ausente' : ch}: a CH não muda a cota`);
  }
  // O teto de horas segue reportado: a tela usa para mostrar o saldo.
  eq(E.requirement({ ch: 180, prev: vazio }, sheet, 30, cfg('5x2'), novDow).maxH, 150, 'o teto de horas continua disponível para a tela');
  eq(E.requirement({ ch: 180, prev: vazio }, sheet, 30, cfg('5x2'), novDow).jorn, 6, 'e a jornada também');
}

sec('3. Duas folgas em CADA semana — não oito no mês');
{
  /* É aqui que a regra velha passava e a nova não: um total mensal de 8
     fecha igual com 2+2+2+2 e com 4+4+0+0. A conta é semana a semana. */
  for (const [Y, M, rot] of [[2026, 10, 'novembro/2026, que começa num domingo'],
                             [2027, 1, 'fevereiro/2027, que começa numa segunda'],
                             [2026, 11, 'dezembro/2026, que começa numa terça']]) {
    const D = diasDoMes(Y, M);
    const m = mkModel(Y, M, Array.from({ length: 12 }, () => mkEmp(D)));
    const st = cfg('5x2');
    E.generate(m, st, { passes: 4 });
    E.validate(m, st);
    let fora = 0, piorSemana = null;
    for (const e of todos(m)) {
      const c = codigos(m, e);
      e.req.semanas.forEach((sm, i) => {
        if (sm.aberta) return;
        let n = 0;
        for (let d = sm.ini; d <= sm.fim; d++) { const k = E.kind(c[d], st); if (k === 'offC' || k === 'offX') n++; }
        if (n !== e.req.alvos[i]) { fora++; if (!piorSemana) piorSemana = `semana ${i + 1} com ${n} de ${e.req.alvos[i]}`; }
      });
    }
    eq(fora, 0, `${rot}: toda semana fechada bate o alvo${piorSemana ? ' — ' + piorSemana : ''}`);
    eq(m.errorCount, 0, `${rot}: e nenhuma regra quebrada`);
  }
}

sec('3b. Quatro numa semana e zero na outra não passa mais');
{
  /* O teste que separa a regra semanal da mensal: uma planilha que traz 4
     folgas travadas numa semana e nada na seguinte soma o total certo e
     ainda assim está errada. */
  const D = diasDoMes(2027, 1);                 // fevereiro/2027, começa numa segunda
  const fixed = new Array(D).fill('');
  for (const d of [0, 1, 2, 3]) fixed[d] = 'F'; // 4 folgas na primeira semana
  const e = mkEmp(D, { fixed, name: 'SEMANA DESEQUILIBRADA' });
  const m = mkModel(2027, 1, [e]);
  const st = cfg('5x2');
  E.generate(m, st, { passes: 4 });
  E.validate(m, st);
  const erro = (e.issues || []).find((x) => /Semana 1/.test(x.t));
  ok(!!erro, 'o validador acusa a semana cheia: "' + (erro ? erro.t : 'nada') + '"');
  ok(erro && erro.lv === 'erro', 'como erro');
  ok(erro && /4 folga/.test(erro.t), 'dizendo quantas achou');
  ok(erro && /pede 2/.test(erro.t), 'e quantas a regra pede');
}

sec('4. Nunca 3 folgas seguidas — nos dois regimes');
{
  for (const regime of ['6x1', '5x2']) {
    const st = cfg(regime);
    // Mês que começa num domingo é o pior caso: foi onde os três apareceram.
    const m = mkModel(2026, 10, Array.from({ length: 30 }, (_, i) => mkEmp(30, { gold: i % 3 === 0 })));
    E.generate(m, st, { passes: 4 });
    E.validate(m, st);
    let pior = 0;
    for (const e of todos(m)) { const b = maiorBlocoDeFolga(m, e, st); if (b > pior) pior = b; }
    ok(pior <= 2, `${regime}: o maior bloco de folga é ${pior} (o limite é 2)`);
    eq(m.errorCount, 0, `${regime}: e nenhuma regra quebrada`);
  }
}

sec('5. A folga agrupada é justamente onde o três aparecia');
{
  /* O FA mora em sábado ou segunda, colado a um domingo F. Esse bloco já
     são dois dias. Com a regra nova, nenhuma folga pode encostar nele. */
  const st = cfg('6x1');
  const m = mkModel(2026, 10, Array.from({ length: 20 }, () => mkEmp(30, { gold: true })));
  E.generate(m, st, { passes: 4 });
  E.validate(m, st);
  const comFA = todos(m).filter((e) => codigos(m, e).includes('FA'));
  ok(comFA.length > 0, `${comFA.length} dos 20 dourados receberam FA — o cenário está exercitado`);
  let pior = 0;
  for (const e of comFA) { const b = maiorBlocoDeFolga(m, e, st); if (b > pior) pior = b; }
  ok(pior <= 2, `mesmo com FA, o maior bloco é ${pior}`);
}

sec('6. Três folgas que já vêm travadas na planilha não quebram a geração');
{
  /* O solver não pode mudar célula travada. Se a planilha já traz três
     folgas seguidas, ele aceita e o validador acusa — mesmo desenho que o
     dos dois domingos fixos. Estragar o resto do mês seria pior. */
  const st = cfg('6x1');
  const fixed = new Array(30).fill('');
  fixed[10] = 'F'; fixed[11] = 'F'; fixed[12] = 'F';
  const e = mkEmp(30, { fixed, name: 'TRES TRAVADAS' });
  const m = mkModel(2026, 10, [e]);
  E.generate(m, st, { passes: 4 });
  E.validate(m, st);
  const c = codigos(m, e);
  ok(c[10] === 'F' && c[11] === 'F' && c[12] === 'F', 'as três travadas continuam onde estavam');
  const erro = (e.issues || []).find((x) => /folgas seguidas/.test(x.t));
  ok(!!erro, 'o validador acusa: "' + (erro ? erro.t : 'nada') + '"');
  ok(erro && erro.lv === 'erro', 'como erro, não aviso');
  // A mensagem traz dia, dia da semana e código: "11 (QUA, F), 12 (QUI, F)…"
  ok(erro && /\b11 \(\w+, F\)/.test(erro.t) && /\b13 \(\w+, F\)/.test(erro.t),
    'nomeando os dias (1-based) com o dia da semana e o código');
  // E não piora: o gerador não encosta uma quarta.
  eq(maiorBlocoDeFolga(m, e, st), 3, 'o gerador não acrescentou uma quarta folga ao bloco');
}

sec('7. Mês anterior terminando em folga não ganha a terceira no dia 1º');
{
  const st = cfg('5x2');
  // prev são os últimos 7 dias do mês anterior; os dois últimos são folga.
  const e = mkEmp(30, { prev: ['', '', '', '', '', 'F', 'F'], name: 'VIRADA DE MES' });
  const m = mkModel(2026, 10, [e]);
  E.generate(m, st, { passes: 4 });
  const c = codigos(m, e);
  const k = E.kind(c[0], st);
  ok(!(k === 'offC' || k === 'offX'), `o dia 1º não é folga (veio "${c[0] || 'trabalho'}")`);
}

sec('8. Férias não são confundidas com folgas seguidas');
{
  const st = cfg('6x1');
  const fixed = new Array(30).fill('');
  for (let d = 0; d < 20; d++) fixed[d] = 'L';
  const e = mkEmp(30, { fixed, name: 'FERIAS LONGAS' });
  const m = mkModel(2026, 10, [e]);
  E.generate(m, st, { passes: 4 });
  E.validate(m, st);
  const erro = (e.issues || []).find((x) => /folgas seguidas/.test(x.t));
  ok(!erro, 'vinte dias de férias não viram "20 folgas seguidas"');
}

sec('8b. Vaga aberta recebe folga como qualquer um');
{
  /* "CONTRATAR" e "REPOSIÇÃO" são linhas de escala sem gente ainda: a
     matrícula é um código curto no lugar do número. Antes elas não eram
     lidas como pessoa — o código caía no ramo de rótulo e virava NOME DE
     GRUPO, quebrando o grupo em pedaços de uma linha. Ninguém recebia
     folga, e a cobertura do mês saía errada justamente onde falta gente. */
  for (const regime of ['6x1', '5x2']) {
    const st = cfg(regime);
    const D = 30;
    const vagas = [
      { ...mkEmp(D, { ch: 90, name: 'CONTRATAR' }), mat: 'C16', vaga: true },
      { ...mkEmp(D, { ch: 90, name: 'CONTRATAR' }), mat: 'C17', vaga: true },
      { ...mkEmp(D, { ch: 180, name: 'REPOSIÇÃO' }), mat: 'A1', vaga: true },
    ];
    const gente = [mkEmp(D, { ch: 180, name: 'PESSOA REAL' }), mkEmp(D, { ch: 90, name: 'OUTRA REAL' })];
    const m = mkModel(2026, 10, [...vagas, ...gente]);
    E.generate(m, st, { passes: 4 });
    E.validate(m, st);
    for (const e of vagas) {
      const n = codigos(m, e).filter((c) => { const k = E.kind(c, st); return k === 'offC' || k === 'offX'; }).length;
      ok(n === e.req.required && n > 0, `${regime}: a vaga ${e.mat} recebeu ${n} folga(s), o mesmo que a regra pede`);
    }
    eq(m.errorCount, 0, `${regime}: e a aba fecha sem regra quebrada`);
    // A vaga não pode virar grupo: todo mundo tem que ficar no mesmo.
    const grupos = m.sheets[0].blocks[0].groups;
    eq(grupos.length, 1, `${regime}: as vagas não quebram o grupo em pedaços`);
    eq(grupos[0].emps.length, 5, `${regime}: as 5 linhas ficam juntas`);
  }
}

sec('8c. Vaga não recebe curso, e isso é de propósito');
{
  // O arquivo de cursos é indexado por matrícula numérica. Uma vaga não
  // tem matrícula, então nunca casa — e não deve mesmo: não há quem vá.
  eq(E.matNum('C16'), 0, 'o código de vaga não vira número de matrícula');
  eq(E.matNum('A1'), 0, 'nem o de reposição');
  eq(E.matNum('161153'), 161153, 'e a matrícula de verdade continua passando');
  eq(E.matNum(161153), 161153, 'venha ela como texto ou como número');
}

sec('9. O que a mudança NÃO podia mexer');
{
  // O 6x1 tem que sair idêntico ao de antes do regime existir: mesma conta,
  // mesma quantidade. É o teste que protege quem não vai migrar.
  const sheet = { chTable: CH_TABLE };
  const semRegime = E.requirement({ ch: 180 }, sheet, 30, { maxRun: 6, afCounts: false, offCodes: [] });
  const com6x1 = E.requirement({ ch: 180 }, sheet, 30, cfg('6x1'));
  eq(semRegime.required, com6x1.required, 'configuração antiga, sem o campo regime, dá o mesmo resultado do 6x1');
  eq(E.requirement({ ch: 180 }, sheet, 30, undefined).required, 5, 'e sem configuração nenhuma também');

  // Um domingo, nos dois regimes.
  for (const regime of ['6x1', '5x2']) {
    const st = cfg(regime);
    const m = mkModel(2026, 10, Array.from({ length: 15 }, () => mkEmp(30)));
    E.generate(m, st, { passes: 4 });
    E.validate(m, st);
    let piorDom = 0, semDom = 0;
    for (const e of todos(m)) {
      const n = codigos(m, e).filter((c, d) => m.month.dow[d] === 0 && (c === 'F' || c === 'AF' || c === 'CH')).length;
      if (n > piorDom) piorDom = n;
      if (n === 0) semDom++;
    }
    eq(piorDom, 1, `${regime}: ninguém passa de 1 domingo de folga`);
    eq(semDom, 0, `${regime}: e ninguém fica sem domingo`);
  }
}

console.log('\n' + '─'.repeat(58));
if (!fail) console.log('\x1b[32m✓ ' + pass + ' verificações passaram\x1b[0m');
else { console.log('\x1b[31m✗ ' + fail + ' falha(s) de ' + (pass + fail) + '\x1b[0m'); falhas.forEach((f, i) => console.log('  ' + (i + 1) + '. ' + f)); }
console.log('─'.repeat(58));
process.exit(fail ? 1 : 0);
