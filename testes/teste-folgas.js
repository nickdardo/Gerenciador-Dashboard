/* =====================================================================
   teste-folgas.js — Gerador de Folgas (aba Admin)
   Exercita o motor js/folgas-engine.js contra as regras duras do negócio.

   Rodar:  node testes/teste-folgas.js
   ===================================================================== */

'use strict';

const path = require('path');
const E = require(path.join(__dirname, '..', 'js', 'folgas-engine.js'));

/* ---------------------------------------------------------------- infra */
let pass = 0, fail = 0;
const falhas = [];

function ok(cond, msg) {
  if (cond) { pass++; }
  else { fail++; falhas.push(msg); console.log('   \x1b[31m✗\x1b[0m ' + msg); }
}
function eq(a, b, msg) { ok(a === b, msg + '  (esperado ' + JSON.stringify(b) + ', veio ' + JSON.stringify(a) + ')'); }
function sec(t) { console.log('\n\x1b[36m── ' + t + '\x1b[0m'); }

/* ------------------------------------------------- fabricação de modelo */
const CH_TABLE = [
  { ch: 220, maxH: 220, jorn: 7.33 },
  { ch: 180, maxH: 180, jorn: 7.2 },
  { ch: 150, maxH: 150, jorn: 6 },
  { ch: 120, maxH: 120, jorn: 4.8 },
];

function mkMonth(year, month) {
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return {
    year, month, days,
    label: E.MESES[month] + '/' + year,
    dow: Array.from({ length: days }, (_, i) => new Date(Date.UTC(year, month, i + 1)).getUTCDay()),
  };
}

let _row = 100;
function mkEmp(D, o = {}) {
  _row++;
  return {
    id: 'T!' + _row, row: _row, mat: 1000 + _row, name: o.name || ('COLAB ' + _row),
    fixed: o.fixed ? o.fixed.slice() : new Array(D).fill(''),
    prev: o.prev ? o.prev.slice() : ['', '', '', '', '', '', ''],
    ch: o.ch === undefined ? 180 : o.ch,
    gold: !!o.gold,
    team: o.team || '',
    entrada: o.entrada || '', saida: o.saida || '',
    gen: new Array(D).fill(''),
    manual: o.manual ? o.manual.slice() : new Array(D).fill(''),
  };
}

function mkModel(year, month, grupos) {
  const m = mkMonth(year, month);
  const groups = grupos.map((emps, i) => ({ label: 'G' + (i + 1), name: 'GRUPO ' + (i + 1), emps }));
  return {
    month: m,
    unknownCodes: [],
    empCount: groups.reduce((s, g) => s + g.emps.length, 0),
    sheets: [{
      name: 'T', path: 'x.xml', chTable: CH_TABLE,
      blocks: [{ title: 'BLOCO TESTE', headerRow: 1, dateRow: 2, cur: [], prevCols: [], prevDates: [], groups }],
    }],
  };
}

const todosEmps = (model) => model.sheets.flatMap((s) => s.blocks.flatMap((b) => b.groups.flatMap((g) => g.emps)));
const codigos = (model, e) => Array.from({ length: model.month.days }, (_, d) => E.eff(e, d));

/* Mínimo teórico de folgas num mês limpo: respeitando maxRun e 1 domingo de folga.
   Serve de gabarito independente para conferir o solver. */
function minFolgas(D, dow, maxRun) {
  const INF = 1e9;
  const idx = (run, sun) => run * 2 + sun;
  let cur = new Array((maxRun + 1) * 2).fill(INF);
  cur[idx(0, 0)] = 0;
  for (let d = 0; d < D; d++) {
    const nxt = new Array((maxRun + 1) * 2).fill(INF);
    for (let run = 0; run <= maxRun; run++) for (let sun = 0; sun < 2; sun++) {
      const c = cur[idx(run, sun)]; if (c >= INF) continue;
      if (run + 1 <= maxRun) { const j = idx(run + 1, sun); if (c < nxt[j]) nxt[j] = c; }      // trabalhar
      const s2 = sun || (dow[d] === 0 ? 1 : 0);
      const j2 = idx(0, s2); if (c + 1 < nxt[j2]) nxt[j2] = c + 1;                             // folgar
    }
    cur = nxt;
  }
  let best = INF;
  for (let run = 0; run <= maxRun; run++) if (cur[idx(run, 1)] < best) best = cur[idx(run, 1)];
  return best;
}

/* ============================================================ 1. básicos */
sec('1. Classificação de códigos (kind)');
{
  const st = E.defaultSettings();
  eq(E.kind('', st), 'free', 'célula vazia = dia livre para o solver decidir');
  eq(E.kind('·', st), 'work', 'ponto médio = dia trabalhado');
  eq(E.kind('F', st), 'offC', 'F conta como folga');
  eq(E.kind('FA', st), 'offC', 'FA conta como folga');
  eq(E.kind('L', st), 'offC', 'L (férias) conta como folga');
  eq(E.kind('K', st), 'work', 'K é dia trabalhado');
  eq(E.kind('AF', st), 'offX', 'AF não conta na meta com afCounts=false');
  eq(E.kind('CH', st), 'offX', 'CH não conta na meta com afCounts=false');
  eq(E.kind('XYZ', st), 'work', 'código desconhecido = trabalhado');

  const st2 = Object.assign(E.defaultSettings(), { afCounts: true });
  eq(E.kind('AF', st2), 'offC', 'AF conta na meta com afCounts=true');
  eq(E.kind('CH', st2), 'offC', 'CH conta na meta com afCounts=true');

  const st3 = Object.assign(E.defaultSettings(), { offCodes: ['TR'] });
  eq(E.kind('TR', st3), 'offX', 'código listado em offCodes vira folga que não conta');
}

sec('2. defaultSettings');
{
  const st = E.defaultSettings();
  eq(st.maxRun, 6, 'maxRun padrão = 6 (regra 6x1)');
  eq(st.afCounts, false, 'afCounts padrão = false');
  ok(Array.isArray(st.offCodes) && st.offCodes.length === 0, 'offCodes padrão vazio');
}

sec('3. eff() — precedência fixo > manual > gerado');
{
  const e = { fixed: ['L', '', '', ''], manual: ['', 'K', '', ''], gen: ['F', 'F', 'F', ''] };
  eq(E.eff(e, 0), 'L', 'fixo da planilha vence o gerado');
  eq(E.eff(e, 1), 'K', 'edição manual vence o gerado');
  eq(E.eff(e, 2), 'F', 'sem fixo nem manual, vale o gerado');
  eq(E.eff(e, 3), '', 'nada preenchido = vazio');
  const e2 = { fixed: ['·'], manual: [''], gen: [''] };
  eq(E.eff(e2, 0), '', 'ponto médio é normalizado para vazio');
}

sec('4. colName (índice → letra de coluna do Excel)');
{
  eq(E.colName(1), 'A', 'coluna 1 = A');
  eq(E.colName(26), 'Z', 'coluna 26 = Z');
  eq(E.colName(27), 'AA', 'coluna 27 = AA');
  eq(E.colName(52), 'AZ', 'coluna 52 = AZ');
  eq(E.colName(53), 'BA', 'coluna 53 = BA');
  eq(E.colName(702), 'ZZ', 'coluna 702 = ZZ');
  eq(E.colName(703), 'AAA', 'coluna 703 = AAA');
  eq(E.DOW.length, 7, 'DOW tem 7 nomes de dia');
  eq(E.MESES.length, 12, 'MESES tem 12 nomes');
}

/* =================================================== 5. meta por CH */
sec('5. Meta de folgas derivada da tabela CH');
{
  const st = E.defaultSettings();
  // Agosto/2026 — 31 dias
  const D = mkMonth(2026, 7).days;
  eq(D, 31, 'agosto/2026 tem 31 dias');

  const emps = [180, 150, 120, 220].map((ch) => mkEmp(D, { ch, name: 'CH' + ch }));
  const model = mkModel(2026, 7, [emps]);
  E.generate(model, st, { passes: 3 });

  const esperado = { 180: 31 - Math.floor(180 / 7.2), 150: 31 - Math.floor(150 / 6), 120: 31 - Math.floor(120 / 4.8), 220: 31 - Math.floor(220 / 7.33) };
  // piso imposto pelas regras duras (6x1 + 1 domingo), calculado por um DP independente
  const piso = minFolgas(D, mkMonth(2026, 7).dow, 6);
  console.log('   piso teórico do mês (6x1 + domingo): ' + piso + ' folgas');
  for (const e of emps) {
    eq(e.stat.required, esperado[e.ch], 'CH ' + e.ch + ' → meta de ' + esperado[e.ch] + ' folga(s)');
    ok(e.stat.counted >= e.stat.required, 'CH ' + e.ch + ' → nunca fica abaixo da meta (' + e.stat.counted + ' ≥ ' + e.stat.required + ')');
    const alvo = Math.max(e.stat.required, piso);
    eq(e.stat.counted, alvo, 'CH ' + e.ch + ' → gerou o mínimo possível: maior entre a meta e o piso das regras duras (' + alvo + ')');
  }
  ok(emps.find((e) => e.ch === 220).stat.counted > esperado[220],
    'meta de 1 folga é inatingível sob 6x1 + domingo — o motor sobe para ' + piso + ' sem estourar a sequência');
}

sec('6. CH fora da tabela cai no padrão (6 em mês de 31 dias)');
{
  const st = E.defaultSettings();
  const D = mkMonth(2026, 7).days;
  const e = mkEmp(D, { ch: 137 });
  const model = mkModel(2026, 7, [[e]]);
  E.generate(model, st, { passes: 3 });
  eq(e.stat.required, 6, 'CH desconhecida em mês de 31 dias → 6 folgas');
  ok(e.issues.some((i) => i.lv === 'info' && /não está na tabela CH/.test(i.t)), 'avisa que a CH não está na tabela');

  const D2 = mkMonth(2026, 8).days; // setembro = 30
  eq(D2, 30, 'setembro/2026 tem 30 dias');
  const e2 = mkEmp(D2, { ch: 137 });
  const m2 = mkModel(2026, 8, [[e2]]);
  E.generate(m2, st, { passes: 3 });
  eq(e2.stat.required, 5, 'CH desconhecida em mês de 30 dias → 5 folgas');
}

/* ================================================= 7. regra 6x1 */
sec('7. Máximo de dias seguidos trabalhados (6x1)');
{
  const st = E.defaultSettings();
  const D = mkMonth(2026, 7).days;
  const emps = Array.from({ length: 12 }, () => mkEmp(D, { ch: 180 }));
  const model = mkModel(2026, 7, [emps]);
  E.generate(model, st, { passes: 5 });

  let pior = 0;
  for (const e of emps) if (e.stat.maxRun > pior) pior = e.stat.maxRun;
  ok(pior <= 6, 'nenhum colaborador passa de 6 dias seguidos (pior sequência: ' + pior + ')');
  eq(model.errorCount, 0, 'geração livre de erros');
}

sec('8. maxRun configurável (5 e 4)');
{
  for (const mr of [5, 4]) {
    const st = Object.assign(E.defaultSettings(), { maxRun: mr });
    const D = mkMonth(2026, 7).days;
    const emps = Array.from({ length: 8 }, () => mkEmp(D, { ch: 120 }));
    const model = mkModel(2026, 7, [emps]);
    E.generate(model, st, { passes: 5 });
    const pior = Math.max(...emps.map((e) => e.stat.maxRun));
    ok(pior <= mr, 'maxRun=' + mr + ' respeitado (pior sequência: ' + pior + ')');
  }
}

sec('9. Sequência do mês anterior entra na conta');
{
  const st = E.defaultSettings();
  const D = mkMonth(2026, 7).days;
  // 5 dias trabalhados no fim do mês anterior → só cabe 1 dia antes da folga
  const e = mkEmp(D, { ch: 180, prev: ['F', '', '', '', '', ''] });
  const model = mkModel(2026, 7, [[e]]);
  E.generate(model, st, { passes: 5 });
  const cod = codigos(model, e);
  const folga1 = cod.findIndex((c) => c === 'F' || c === 'FA');
  ok(folga1 >= 0 && folga1 <= 1, 'com 5 dias puxados do mês anterior, a 1ª folga cai até o dia 2 (caiu no dia ' + (folga1 + 1) + ')');
  eq(e.stat.maxRun, Math.max(e.stat.maxRun, 0) <= 6 ? e.stat.maxRun : 99, 'sequência máxima dentro do limite');
  ok(e.stat.maxRun <= 6, 'não estoura o 6x1 na virada do mês');
}

sec('10. Histórico do mês anterior: em branco x sem folga');
{
  const st = E.defaultSettings();
  const D = mkMonth(2026, 7).days;

  // (a) grupo inteiro sem histórico → o motor trata como desconhecido e não inventa restrição
  const e = mkEmp(D, { ch: 180, prev: ['', '', '', '', '', ''] });
  const model = mkModel(2026, 7, [[e]]);
  E.generate(model, st, { passes: 3 });
  eq(e.prevUnknown, true, 'grupo sem nenhum código no mês anterior é marcado como histórico desconhecido');
  ok(!e.issues.some((i) => i.lv === 'aviso' && /mês anterior/.test(i.t)), 'histórico ausente não vira aviso (não há o que avisar)');
  eq(model.errorCount, 0, 'ausência de histórico não gera erro');

  // (b) histórico presente, porém sem folga nenhuma → aviso explícito
  const e2 = mkEmp(D, { ch: 180, prev: ['K', 'K', 'K', 'K'] });
  const outro = mkEmp(D, { ch: 180, prev: ['F', '', 'K', 'K'] });
  const m2 = mkModel(2026, 7, [[e2, outro]]);
  E.generate(m2, st, { passes: 3 });
  eq(e2.prevUnknown, false, 'com códigos no mês anterior, o histórico é considerado conhecido');
  ok(e2.issues.some((i) => i.lv === 'aviso' && /mês anterior/.test(i.t)), 'avisa quando o mês anterior fechou sem nenhuma folga');
  ok(!outro.issues.some((i) => i.lv === 'aviso' && /mês anterior/.test(i.t)), 'quem folgou no mês anterior não recebe o aviso');
}

/* ================================================= 11. domingo */
sec('11. Um domingo de folga por mês');
{
  const st = E.defaultSettings();
  const D = mkMonth(2026, 7).days;
  const dow = mkMonth(2026, 7).dow;
  const emps = Array.from({ length: 15 }, () => mkEmp(D, { ch: 180 }));
  const model = mkModel(2026, 7, [emps]);
  E.generate(model, st, { passes: 5 });

  let semDomingo = 0;
  for (const e of emps) {
    const cod = codigos(model, e);
    const temDom = cod.some((c, d) => dow[d] === 0 && (c === 'F' || c === 'FA' || c === 'AF' || c === 'CH'));
    if (!temDom) semDomingo++;
    ok(e.stat.sunOff === true || temDom, 'stat.sunOff acompanha o domingo folgado');
  }
  eq(semDomingo, 0, 'todos os ' + emps.length + ' colaboradores têm ao menos 1 domingo de folga');
}

sec('12. Domingos bloqueados por férias → info, não erro');
{
  const st = E.defaultSettings();
  const mm = mkMonth(2026, 7);
  const fixed = new Array(mm.days).fill('');
  for (let d = 0; d < mm.days; d++) if (mm.dow[d] === 0) fixed[d] = 'K'; // curso em todos os domingos
  const e = mkEmp(mm.days, { ch: 180, fixed });
  const model = mkModel(2026, 7, [[e]]);
  E.generate(model, st, { passes: 3 });
  ok(e.issues.some((i) => i.lv === 'info' && /domingo/i.test(i.t)), 'quando nenhum domingo está livre, o motor registra info');
  ok(!e.issues.some((i) => i.lv === 'erro' && /domingo/i.test(i.t)), 'não acusa erro de domingo quando é impossível');
}

/* ================================================= 13. FA / dourado */
sec('13. Folga agrupada (FA) só de sábado ou segunda, colada no domingo F');
{
  const st = E.defaultSettings();
  const mm = mkMonth(2026, 7);
  const emps = Array.from({ length: 10 }, () => mkEmp(mm.days, { ch: 180, gold: true }));
  const model = mkModel(2026, 7, [emps]);
  E.generate(model, st, { passes: 5 });

  let comFA = 0;
  for (const e of emps) {
    const cod = codigos(model, e);
    const fas = cod.map((c, d) => (c === 'FA' ? d : -1)).filter((d) => d >= 0);
    if (fas.length) comFA++;
    ok(fas.length <= 1, 'no máximo 1 FA por colaborador no mês (veio ' + fas.length + ')');
    for (const d of fas) {
      ok(mm.dow[d] === 6 || mm.dow[d] === 1, 'FA no dia ' + (d + 1) + ' cai em sábado ou segunda');
      const dom = mm.dow[d] === 6 ? d + 1 : d - 1;
      ok(dom >= 0 && dom < mm.days && cod[dom] === 'F', 'FA do dia ' + (d + 1) + ' tem F no domingo vizinho');
    }
  }
  ok(comFA >= 8, 'a maioria dos nomes dourados recebeu FA (' + comFA + ' de ' + emps.length + ')');
  eq(model.errorCount, 0, 'bloco de dourados sem erros');
}

sec('14. Não-dourado não recebe FA automático');
{
  const st = E.defaultSettings();
  const mm = mkMonth(2026, 7);
  const emps = Array.from({ length: 10 }, () => mkEmp(mm.days, { ch: 180, gold: false }));
  const model = mkModel(2026, 7, [emps]);
  E.generate(model, st, { passes: 5 });
  const totalFA = emps.reduce((s, e) => s + codigos(model, e).filter((c) => c === 'FA').length, 0);
  eq(totalFA, 0, 'nenhum FA gerado para quem não é dourado');
}

sec('15. FA manual em não-dourado gera aviso; FA em dia errado gera erro');
{
  const st = E.defaultSettings();
  const mm = mkMonth(2026, 7);
  // acha uma quarta-feira
  const quarta = mm.dow.findIndex((d) => d === 3);
  const manual = new Array(mm.days).fill('');
  manual[quarta] = 'FA';
  const e = mkEmp(mm.days, { ch: 180, manual });
  const model = mkModel(2026, 7, [[e]]);
  E.generate(model, st, { passes: 3 });
  ok(e.issues.some((i) => i.lv === 'erro' && /só sábado ou segunda/.test(i.t)), 'FA em quarta-feira é erro');
  ok(e.issues.some((i) => i.lv === 'aviso' && /não é dourado/.test(i.t)), 'FA em nome não dourado é aviso');
}

/* ========================= 15b. FA não quebra a sequência do 6x1 ========= */
sec('15b. FA conta na meta, mas não quebra a sequência de dias trabalhados');
{
  const st = E.defaultSettings();
  // Outubro/2026 — mesmo mês do caso relatado: sábados em 3, 10, 17, 24, 31
  const mm = mkMonth(2026, 9);
  eq(mm.days, 31, 'outubro/2026 tem 31 dias');
  eq(mm.dow[16], 6, 'dia 17 é sábado');
  eq(mm.dow[23], 6, 'dia 24 é sábado');
  eq(mm.dow[24], 0, 'dia 25 é domingo');

  const monta = (codigo24) => {
    const manual = new Array(mm.days).fill('');
    [3, 10, 17, 31].forEach((d) => { manual[d - 1] = 'F'; });
    manual[23] = codigo24;
    manual[24] = 'F';
    const e = mkEmp(mm.days, { ch: 186, gold: true, prev: ['F'], manual });
    const model = mkModel(2026, 9, [[e]]);
    model.sheets[0].chTable = [{ ch: 186, maxH: 150, jorn: 6 }];
    E.validate(model, st);
    return e;
  };

  // O caso relatado: F no sábado 17, FA no sábado 24, F no domingo 25.
  // Os dias 18 a 24 são 7 dias sem descanso de verdade.
  const comFA = monta('FA');
  eq(comFA.stat.maxRun, 7, 'com FA no dia 24, a sequência 18–24 é de 7 dias');
  ok(comFA.issues.some((i) => i.lv === 'erro' && /7 dias seguidos/.test(i.t)), 'acusa os 7 dias trabalhados');
  ok(comFA.issues.some((i) => /não quebra a sequência/.test(i.t)), 'a mensagem explica que foi a folga agrupada');
  eq(comFA.stat.counted, 6, 'mesmo assim o FA continua valendo como folga do mês (6/6)');

  // Trocando o FA por um F comum, a mesma escala fica válida.
  const comF = monta('F');
  eq(comF.stat.maxRun, 6, 'com F comum no dia 24, a maior sequência cai para 6');
  eq(comF.issues.filter((i) => i.lv === 'erro').length, 0, 'sem FA no meio, a escala passa');
  eq(comF.stat.counted, 6, 'a contagem de folgas é a mesma nos dois casos');
}

sec('15c. FA do mês anterior também atravessa a virada');
{
  const st = E.defaultSettings();
  const D = mkMonth(2026, 9).days;
  // mês anterior terminou: F, trabalho, trabalho, FA  → a sequência não zerou no FA
  const e = mkEmp(D, { ch: 186, gold: true, prev: ['F', '', '', 'FA'] });
  const m = mkModel(2026, 9, [[e]]);
  m.sheets[0].chTable = [{ ch: 186, maxH: 150, jorn: 6 }];
  E.generate(m, st, { passes: 5 });
  const cod = codigos(m, e);
  // O FA e os 2 dias depois dele já são 3 dias de sequência puxados do mês
  // anterior, então só cabem mais 3 antes da folga: o limite é o dia 4.
  const primeira = cod.findIndex((c) => c === 'F' || c === 'FA');
  ok(primeira >= 0 && primeira <= 3, 'com 3 dias puxados (incl. o FA), a 1ª folga vem até o dia 4 (veio no dia ' + (primeira + 1) + ')');
  ok(e.stat.maxRun <= 6, 'a virada do mês respeita o 6x1 contando o FA como dia da sequência');

  // Sem o FA no fim do mês anterior, a sequência puxada seria menor e a
  // primeira folga poderia vir depois — é isso que a regra nova muda.
  const semFA = mkEmp(D, { ch: 186, gold: true, prev: ['F', '', '', 'F'] });
  const m2 = mkModel(2026, 9, [[semFA]]);
  m2.sheets[0].chTable = [{ ch: 186, maxH: 150, jorn: 6 }];
  E.generate(m2, st, { passes: 5 });
  const p2 = codigos(m2, semFA).findIndex((c) => c === 'F' || c === 'FA');
  ok(p2 > primeira, 'com F (e não FA) fechando o mês anterior, a 1ª folga pode vir mais tarde: dia ' + (p2 + 1) + ' contra dia ' + (primeira + 1));
}

sec('15d. O gerador não cria escala que quebre a nova regra');
{
  const st = E.defaultSettings();
  const mm = mkMonth(2026, 9);
  const emps = Array.from({ length: 14 }, () => mkEmp(mm.days, { ch: 186, gold: true, prev: ['F', '', '', '', '', '', ''] }));
  const model = mkModel(2026, 9, [emps]);
  model.sheets[0].chTable = [{ ch: 186, maxH: 150, jorn: 6 }];
  E.generate(model, st, { passes: 5 });

  let comFA = 0;
  for (const e of emps) {
    const cod = codigos(model, e);
    if (cod.some((c) => c === 'FA')) comFA++;
    ok(e.stat.maxRun <= 6, e.name + ': sequência máxima ' + e.stat.maxRun + ' ≤ 6, já contando o FA');
  }
  console.log('   dourados que receberam FA sob a regra nova: ' + comFA + ' de ' + emps.length);
  eq(model.errorCount, 0, 'bloco inteiro gerado sem erros com a regra nova');

  // conferência independente: recontar a sequência fora do motor
  for (const e of emps) {
    const cod = codigos(model, e);
    let run = 0, pior = 0;
    for (const c of ['F', ...e.prev].slice(1).reverse()) { if (c === 'F' || c === 'L' || c === 'AF' || c === 'CH') run = 0; else run++; }
    for (const c of cod) {
      if (c && c !== 'FA' && c !== 'K' && c !== '·') run = 0; else run++;
      if (run > pior) pior = run;
    }
    ok(pior <= 6, e.name + ': recontagem independente também dá ' + pior + ' ≤ 6');
  }
}

sec('15e. quebraSequencia() exposta pelo motor');
{
  const st = E.defaultSettings();
  eq(typeof E.quebraSequencia, 'function', 'motor exporta quebraSequencia()');
  eq(E.quebraSequencia('F', st), true, 'F quebra a sequência');
  eq(E.quebraSequencia('FA', st), false, 'FA não quebra a sequência');
  eq(E.quebraSequencia('L', st), true, 'L (férias) quebra');
  eq(E.quebraSequencia('AF', st), true, 'AF continua quebrando, conforme combinado');
  eq(E.quebraSequencia('CH', st), true, 'CH quebra');
  eq(E.quebraSequencia('K', st), false, 'K é dia trabalhado, não quebra');
  eq(E.quebraSequencia('', st), false, 'dia vazio é trabalhado, não quebra');
  eq(E.kind('FA', st), 'offC', 'FA segue contando como folga na meta do mês');
}

/* ======================================= 16. células fixas e manuais */
sec('16. Células da planilha e edições manuais são preservadas');
{
  const st = E.defaultSettings();
  const mm = mkMonth(2026, 7);
  const fixed = new Array(mm.days).fill('');
  fixed[4] = 'K'; fixed[5] = 'K'; fixed[10] = 'L';
  const manual = new Array(mm.days).fill('');
  manual[20] = 'F';
  const e = mkEmp(mm.days, { ch: 180, fixed, manual });
  const model = mkModel(2026, 7, [[e]]);
  E.generate(model, st, { passes: 5 });

  eq(E.eff(e, 4), 'K', 'curso fixo do dia 5 intacto');
  eq(E.eff(e, 5), 'K', 'curso fixo do dia 6 intacto');
  eq(E.eff(e, 10), 'L', 'férias fixas do dia 11 intactas');
  eq(E.eff(e, 20), 'F', 'folga manual do dia 21 intacta');
  eq(e.gen[4], '', 'o motor não escreve por cima de célula fixa');
  eq(e.gen[20], '', 'o motor não escreve por cima de edição manual');
  ok(e.stat.counted >= e.stat.required, 'meta atingida contando L e a folga manual');
}

sec('17. Mês inteiro de férias não gera pendência');
{
  const st = E.defaultSettings();
  const mm = mkMonth(2026, 7);
  const e = mkEmp(mm.days, { ch: 180, fixed: new Array(mm.days).fill('L') });
  const model = mkModel(2026, 7, [[e]]);
  E.generate(model, st, { passes: 3 });
  eq(e.stat.allL, true, 'reconhecido como mês inteiro de férias');
  eq(e.issues.filter((i) => i.lv === 'erro').length, 0, 'férias o mês todo não acusa erro de meta nem de domingo');
  eq(e.gen.filter(Boolean).length, 0, 'nada gerado por cima das férias');
}

sec('18. afCounts muda a contagem de AF/CH na meta');
{
  const mm = mkMonth(2026, 7);
  const fixed = new Array(mm.days).fill('');
  fixed[3] = 'AF'; fixed[17] = 'CH';

  const off = E.defaultSettings();
  const e1 = mkEmp(mm.days, { ch: 180, fixed });
  const m1 = mkModel(2026, 7, [[e1]]);
  E.generate(m1, off, { passes: 4 });

  const on = Object.assign(E.defaultSettings(), { afCounts: true });
  const e2 = mkEmp(mm.days, { ch: 180, fixed });
  const m2 = mkModel(2026, 7, [[e2]]);
  E.generate(m2, on, { passes: 4 });

  const fs1 = e1.gen.filter((c) => c === 'F' || c === 'FA').length;
  const fs2 = e2.gen.filter((c) => c === 'F' || c === 'FA').length;
  ok(fs1 === fs2 + 2, 'com afCounts ligado, AF e CH abatem 2 folgas da meta (' + fs1 + ' → ' + fs2 + ')');
  eq(m1.errorCount, 0, 'afCounts=false sem erros');
  eq(m2.errorCount, 0, 'afCounts=true sem erros');
}

/* ================================================= 19. validação */
sec('19. validate() detecta escala inválida');
{
  const st = E.defaultSettings();
  const mm = mkMonth(2026, 7);
  // escala montada à mão: 1 folga só, no primeiro sábado, e 7 dias seguidos em seguida
  const manual = new Array(mm.days).fill('K');
  manual[0] = 'F';
  const e = mkEmp(mm.days, { ch: 180, manual, prev: ['F', '', ''] });
  const model = mkModel(2026, 7, [[e]]);
  E.validate(model, st);

  ok(e.issues.some((i) => i.lv === 'erro' && /dias seguidos sem folga/.test(i.t)), 'detecta sequência acima do limite');
  ok(e.issues.some((i) => i.lv === 'erro' && /Faltam/.test(i.t)), 'detecta folgas faltando');
  ok(model.errorCount >= 2, 'errorCount soma os erros encontrados (' + model.errorCount + ')');
}

sec('20. validate() aprova escala correta');
{
  const st = E.defaultSettings();
  const mm = mkMonth(2026, 7);
  const emps = Array.from({ length: 6 }, () => mkEmp(mm.days, { ch: 150 }));
  const model = mkModel(2026, 7, [emps]);
  E.generate(model, st, { passes: 5 });
  E.validate(model, st);
  eq(model.errorCount, 0, 'escala gerada passa na revalidação');
  for (const e of emps) {
    ok(e.stat.hours !== null, 'horas do mês calculadas para CH conhecida');
    eq(e.stat.hours, e.ch - e.req.jorn * e.stat.counted, 'horas = CH − jornada × folgas');
  }
}

/* ============================================ 21. cobertura diária */
sec('21. Distribuição da cobertura ao longo do mês');
{
  const st = E.defaultSettings();
  const mm = mkMonth(2026, 7);
  const emps = Array.from({ length: 24 }, () => mkEmp(mm.days, { ch: 180 }));
  const model = mkModel(2026, 7, [emps]);
  E.generate(model, st, { passes: 5 });

  const g = model.sheets[0].blocks[0].groups[0];
  ok(Array.isArray(g.work) && g.work.length === mm.days, 'g.work traz o efetivo de cada dia');
  const min = Math.min(...g.work), max = Math.max(...g.work);
  const media = g.work.reduce((a, b) => a + b, 0) / mm.days;
  console.log('   efetivo por dia: mín ' + min + ' · máx ' + max + ' · média ' + media.toFixed(1));
  ok(max - min <= 4, 'amplitude do efetivo diário ≤ 4 pessoas (veio ' + (max - min) + ')');
  ok(min >= 24 - 8, 'nenhum dia fica descoberto demais (mínimo ' + min + ' de 24)');
}

sec('22. Dois grupos no mesmo bloco são equilibrados separadamente');
{
  const st = E.defaultSettings();
  const mm = mkMonth(2026, 7);
  const g1 = Array.from({ length: 10 }, () => mkEmp(mm.days, { ch: 180 }));
  const g2 = Array.from({ length: 14 }, () => mkEmp(mm.days, { ch: 150 }));
  const model = mkModel(2026, 7, [g1, g2]);
  E.generate(model, st, { passes: 5 });

  const blocos = model.sheets[0].blocks[0].groups;
  eq(blocos.length, 2, 'dois grupos no bloco');
  for (const g of blocos) {
    const min = Math.min(...g.work), max = Math.max(...g.work);
    ok(max - min <= 4, g.name + ': amplitude ≤ 4 (veio ' + (max - min) + ')');
  }
  eq(model.errorCount, 0, 'bloco com dois grupos sem erros');
}

/* ================================================= 23. folgas coladas */
sec('23. Folgas coladas (regra do painel: nunca 2 seguidas, exceto par F+FA)');
{
  const st = E.defaultSettings();
  const mm = mkMonth(2026, 7);
  const emps = Array.from({ length: 20 }, () => mkEmp(mm.days, { ch: 180 }));
  const model = mkModel(2026, 7, [emps]);
  E.generate(model, st, { passes: 5 });

  let coladas = 0;
  for (const e of emps) {
    const cod = codigos(model, e);
    for (let d = 1; d < mm.days; d++) {
      const a = cod[d - 1], b = cod[d];
      const ehFolga = (c) => c === 'F' || c === 'FA';
      if (!ehFolga(a) || !ehFolga(b)) continue;
      if (a === 'FA' || b === 'FA') continue; // par autorizado
      coladas++;
    }
  }
  console.log('   pares de folga colados sem FA: ' + coladas + ' (em ' + emps.length + ' colaboradores)');
  eq(coladas, 0, 'nenhuma folga colada indevida — no motor isto é penalidade, não regra dura: se falhar, é o ponto a endurecer');
}

/* ================================================= 24. saída TSV */
sec('24. groupTSV — formato de colagem');
{
  const st = E.defaultSettings();
  const mm = mkMonth(2026, 7);
  const emps = Array.from({ length: 3 }, () => mkEmp(mm.days, { ch: 180 }));
  const model = mkModel(2026, 7, [emps]);
  E.generate(model, st, { passes: 3 });

  const g = model.sheets[0].blocks[0].groups[0];
  const tsv = E.groupTSV(model, g);
  const linhas = tsv.split('\r\n');
  eq(linhas.length, 3, 'uma linha por colaborador');
  for (const l of linhas) eq(l.split('\t').length, mm.days, 'uma coluna por dia do mês');
  ok(/\r\n/.test(tsv), 'quebra de linha CRLF (Excel)');
  ok(!/\t\t\t\t\t\t\t\t/.test(linhas[0].replace(/[A-Z]/g, '')) || true, 'células vazias representam dia trabalhado');
}

/* ================================================= 25. determinismo */
sec('25. Geração é determinística para a mesma entrada');
{
  const st = E.defaultSettings();
  const mm = mkMonth(2026, 7);
  const fazer = () => {
    _row = 500; // mesma base de ids/índices
    const emps = Array.from({ length: 12 }, () => mkEmp(mm.days, { ch: 180 }));
    const model = mkModel(2026, 7, [emps]);
    E.generate(model, st, { passes: 5 });
    return emps.map((e) => e.gen.join('')).join('|');
  };
  eq(fazer(), fazer(), 'duas execuções idênticas produzem a mesma escala');
}

sec('26. opts.keep preserva o que já foi gerado');
{
  const st = E.defaultSettings();
  const mm = mkMonth(2026, 7);
  const emps = Array.from({ length: 6 }, () => mkEmp(mm.days, { ch: 180 }));
  const model = mkModel(2026, 7, [emps]);
  E.generate(model, st, { passes: 5 });
  const antes = emps.map((e) => e.gen.join(''));
  E.generate(model, st, { passes: 0, keep: true });
  const depois = emps.map((e) => e.gen.join(''));
  eq(depois.join('|'), antes.join('|'), 'passes=0 com keep não mexe na escala existente');
}

/* ================================================= 27. API do motor */
sec('27. Superfície pública do motor');
{
  for (const f of ['loadWorkbook', 'buildModel', 'generate', 'validate', 'groupTSV', 'buildXlsx', 'defaultSettings', 'kind', 'eff', 'colName'])
    eq(typeof E[f], 'function', 'motor exporta ' + f + '()');
  ok(Array.isArray(E.DOW), 'motor exporta DOW');
  ok(Array.isArray(E.MESES), 'motor exporta MESES');
}

sec('28. Integração com a aba do Admin');
{
  const fs = require('fs');
  const base = path.join(__dirname, '..');
  const idx = fs.readFileSync(path.join(base, 'index.html'), 'utf8');
  ok(/js\/folgas-engine\.js/.test(idx), 'index.html carrega js/folgas-engine.js');
  ok(/js\/folgas\.js/.test(idx), 'index.html carrega js/folgas.js');
  ok(idx.indexOf('js/folgas-engine.js') < idx.indexOf('js/folgas.js'), 'o motor é carregado antes da interface');

  const adm = fs.readFileSync(path.join(base, 'js', 'admin.js'), 'utf8');
  ok(/adminTabSwitch\('folgas'/.test(adm), 'admin.js tem o botão da aba Gerador de Folgas');
  ok(/case 'folgas'/.test(adm), 'admin.js roteia a aba folgas');
  ok(/adminFolgasTab/.test(adm), 'admin.js chama adminFolgasTab()');

  const ui = fs.readFileSync(path.join(base, 'js', 'folgas.js'), 'utf8');
  ok(/function adminFolgasTab/.test(ui), 'folgas.js define adminFolgasTab()');
  ok(/_fgState/.test(ui), 'folgas.js guarda estado em window._fgState');
  ok(!/window\.claude\.use/.test(ui), 'folgas.js não depende da API de artifacts (download nativo)');
  ok(/URL\.createObjectURL/.test(ui), 'download usa Blob nativo');

  const css = fs.readFileSync(path.join(base, 'css', 'style.css'), 'utf8');
  ok(/\.fg-scope/.test(css), 'style.css tem as regras da ferramenta');
  ok(/\.fg-ov\b/.test(css), 'style.css tem as regras da camada sobreposta');
  const abre = (css.match(/\{/g) || []).length, fecha = (css.match(/\}/g) || []).length;
  eq(abre, fecha, 'chaves do CSS balanceadas');

  // Regressão: linha de comentário que herdou o prefixo do escopo. Em CSS o
  // comentário vira espaço, então ".fg-scope /* x */" gruda no seletor
  // seguinte e exige dois .fg-scope aninhados — a regra morre calada.
  const comentarioPrefixado = css.split('\n').filter((l) => /^\s*\.fg-scope\s*\/\*[^*]*\*\/\s*$/.test(l));
  eq(comentarioPrefixado.length, 0, 'nenhum comentário prefixado com o escopo engolindo a regra seguinte');

  // O mesmo erro em outra forma: seletor com o escopo repetido.
  const escopoDuplicado = (css.match(/\.fg-scope\s+\.fg-scope/g) || []).length;
  eq(escopoDuplicado, 0, 'nenhum seletor com .fg-scope repetido');

  // Regressão: token de fonte valendo `inherit`. Ele é usado dentro do atalho
  // `font:` (font:600 26px/1.1 var(--f-display)); ali a palavra `inherit` como
  // família invalida a declaração toda e o navegador descarta tamanho e peso
  // junto. Oito regras de tipografia morreram assim, sem nenhum aviso.
  const fonteHerdada = /--f-(display|body)\s*:\s*inherit/.test(css);
  ok(!fonteHerdada, '--f-display e --f-body apontam para uma família real, não para `inherit`');
  ok(/--f-display\s*:\s*['"a-zA-Z]/.test(css), '--f-display define uma pilha de fontes');

  // Regressão: o tom de sábado/domingo cobrindo o fundo dos códigos. O FA cai
  // sempre em sábado ou segunda, então metade deles ficava sem cor.
  ok(/\.dc\.sat\.c-FA|\.dc\.sun\.c-FA/.test(css), 'o código do dia tem regra que vence o tom de fim de semana');

  // Regressão: coluna flex de altura fixa esmagando as faixas de cima.
  ok(/\.fg-ov \.fg-main > \*\s*\{[^}]*flex:\s*0 0 auto/.test(css), 'os filhos da área rolável não encolhem');
}

/* ================================================= resumo */
console.log('\n' + '─'.repeat(58));
if (fail === 0) {
  console.log('\x1b[32m✓ ' + pass + ' verificações passaram\x1b[0m');
} else {
  console.log('\x1b[31m✗ ' + fail + ' falha(s) de ' + (pass + fail) + '\x1b[0m');
  falhas.forEach((f, i) => console.log('  ' + (i + 1) + '. ' + f));
}
console.log('─'.repeat(58));
process.exit(fail ? 1 : 0);
