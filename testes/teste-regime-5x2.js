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
  eq(E.REGIMES['6x1'].folgasMes, null, 'no 6x1 a quantidade de folgas não é fixa — sai do teto de horas');
  eq(E.REGIMES['5x2'].folgasMes, 8, 'no 5x2 são 8, fechadas');
}

sec('2. Quantas folgas cada regime pede');
{
  const sheet = { chTable: CH_TABLE };
  // 6x1: o teto de horas manda, então o número muda com a CH e com o mês.
  for (const [ch, D, esperado] of [[180, 30, 5], [180, 31, 6], [90, 30, 6], [210, 31, 7]]) {
    eq(E.requirement({ ch }, sheet, D, cfg('6x1')).required, esperado,
      `6x1, CH ${ch}, mês de ${D} dias`);
  }
  // 5x2: 8 para todo mundo, venha ou não a CH na tabela.
  for (const ch of [210, 180, 120, 90, null, 999]) {
    eq(E.requirement({ ch }, sheet, 30, cfg('5x2')).required, 8,
      `5x2, CH ${ch === null ? 'ausente' : ch}: 8 folgas`);
  }
  // Fevereiro não pode pedir mais folgas do que tem dia.
  ok(E.requirement({ ch: 180 }, sheet, 28, cfg('5x2')).required <= 28, 'nunca pede mais folgas do que o mês tem dias');
  // O teto de horas segue reportado: a tela usa para mostrar o saldo.
  eq(E.requirement({ ch: 180 }, sheet, 30, cfg('5x2')).maxH, 150, 'o teto de horas continua disponível para a tela');
  eq(E.requirement({ ch: 180 }, sheet, 30, cfg('5x2')).jorn, 6, 'e a jornada também');
}

sec('3. O 5x2 gerando um mês inteiro');
{
  const m = mkModel(2026, 10, Array.from({ length: 12 }, () => mkEmp(30)));
  const st = cfg('5x2');
  E.generate(m, st, { passes: 4 });
  E.validate(m, st);
  const D = m.month.days;
  let min = 99, max = 0;
  for (const e of todos(m)) {
    const n = codigos(m, e).filter((c) => E.kind(c, st) === 'offC').length;
    if (n < min) min = n; if (n > max) max = n;
  }
  eq(min, 8, 'todo mundo recebe 8 folgas');
  eq(max, 8, 'e ninguém recebe mais que 8');
  eq(m.errorCount, 0, 'sem nenhuma regra quebrada');
  // Dias trabalhados: 30 − 8 = 22, que é a conta do estudo.
  const trab = codigos(m, todos(m)[0]).filter((c) => E.kind(c, st) === 'work' || !c).length;
  eq(trab, D - 8, 'sobram ' + (D - 8) + ' dias trabalhados');
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
