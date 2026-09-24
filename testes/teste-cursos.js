/* =====================================================================
   teste-cursos.js — arquivo mensal de cursos → K na escala

   As regras confirmadas com o cliente:
     · do arquivo de cursos só interessam MATRÍCULA e DATA;
     · o K ocupa o dia e a sequência do 6x1 atravessa ele;
     · curso caindo em folga (F/FA): o K entra e o gerador repõe a folga;
     · curso caindo em férias (L): nunca sobrescreve — reporta;
     · data de outro mês ou linha sem data legível: ignora e reporta.

   Rodar:  node testes/teste-cursos.js
   ===================================================================== */

'use strict';

const path = require('path');
const E = require(path.join(__dirname, '..', 'js', 'folgas-engine.js'));

/* ---------------------------------------------------------------- infra */
let pass = 0, fail = 0;
const falhas = [];
const ok = (c, m) => { if (c) pass++; else { fail++; falhas.push(m); console.log('   \x1b[31m✗\x1b[0m ' + m); } };
const eq = (a, b, m) => ok(a === b, m + '  (esperado ' + JSON.stringify(b) + ', veio ' + JSON.stringify(a) + ')');
const sec = (t) => console.log('\n\x1b[36m── ' + t + '\x1b[0m');

/* ------------------------------------------------- fabricação de modelo */
const CH = [{ ch: 186, maxH: 150, jorn: 6 }];

function mkMonth(year, month) {
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return { year, month, days, label: E.MESES[month] + '/' + year,
    dow: Array.from({ length: days }, (_, i) => new Date(Date.UTC(year, month, i + 1)).getUTCDay()) };
}

let _row = 8;
function mkEmp(D, mat, o = {}) {
  return { id: 'T!' + mat, row: _row++, mat, name: o.nome || ('COLAB ' + mat),
    fixed: o.fixed ? o.fixed.slice() : new Array(D).fill(''),
    prev: o.prev || ['F', '', '', ''], ch: 186, gold: !!o.gold, team: '', entrada: '', saida: '',
    gen: new Array(D).fill(''), manual: new Array(D).fill('') };
}

function mkModel(Y, M, emps) {
  const m = mkMonth(Y, M);
  return { month: m, unknownCodes: [], empCount: emps.length,
    sheets: [{ name: 'T', path: 'p', chTable: CH,
      blocks: [{ title: 'B', headerRow: 1, dateRow: 2, cur: Array.from({ length: m.days }, (_, i) => 10 + i),
        prevCols: [], prevDates: [], groups: [{ label: 'g', name: 'G', emps }] }] }] };
}

// Um "arquivo de cursos" já parseado — é o que loadCursos() devolve.
const D_UTC = (Y, M, dia) => new Date(Date.UTC(Y, M, dia));
function mkCursos(linhas, semData = []) {
  return { regs: linhas.map((l) => ({ mat: l.mat, nome: l.nome || 'X', func: '', curso: l.curso || 'CURSO', aba: 'A', linha: 1, data: l.data })),
    semData, arquivoVazio: !linhas.length };
}
const todos = (m) => m.sheets.flatMap((s) => s.blocks.flatMap((b) => b.groups.flatMap((g) => g.emps)));
const diasCom = (m, e, cod) => Array.from({ length: m.month.days }, (_, d) => d).filter((d) => E.eff(e, d) === cod).map((d) => d + 1);

/* =================================================== 1. normalização */
sec('1. Matrícula normalizada (o arquivo mistura texto e número)');
{
  eq(E.matNum(160622), 160622, 'número passa direto');
  eq(E.matNum('160622'), 160622, 'texto vira número — sem isto um terço dos registros não casaria');
  eq(E.matNum(' 160622 '), 160622, 'espaços em volta não atrapalham');
  eq(E.matNum('160622.0'), 0, 'texto que não é só dígitos é descartado');
  eq(E.matNum('X'), 0, 'placeholder "X" não vira matrícula');
  eq(E.matNum(''), 0, 'vazio não vira matrícula');
  eq(E.matNum(null), 0, 'nulo não vira matrícula');
  eq(E.matNum(160622.0), 160622, 'número com casa decimal zero é arredondado');
}

/* =================================================== 2. indexação */
sec('2. Cruzamento com o mês da escala');
{
  const mm = mkMonth(2026, 9); // outubro/2026
  const cursos = mkCursos([
    { mat: 111111, data: D_UTC(2026, 9, 5) },
    { mat: 111111, data: D_UTC(2026, 9, 20) },
    { mat: 222222, data: D_UTC(2026, 6, 6) },   // julho — fora do mês
    { mat: 333333, data: D_UTC(2026, 9, 6), curso: 'AVSEC OPS' },
    { mat: 333333, data: D_UTC(2026, 9, 6), curso: 'DGR CAT8' }, // mesmo dia, 2 cursos
  ], [{ mat: 444444, texto: 'X', curso: 'AIRSIDE', linha: 47, nome: 'FULANO' }]);

  const idx = E.indexarCursos(cursos, mm);
  eq(idx.porMat.size, 2, 'só as matrículas com data dentro do mês entram');
  eq(idx.porMat.get(111111).size, 2, 'duas datas da mesma pessoa viram dois dias');
  ok(idx.porMat.get(111111).has(4) && idx.porMat.get(111111).has(19), 'os dias são convertidos para índice 0 (dia 5 → 4)');
  eq(idx.porMat.get(333333).size, 1, 'dois cursos no mesmo dia viram um K só');
  eq(idx.foraDoMes.length, 1, 'a data de julho é separada');
  eq(idx.foraDoMes[0].mat, 222222, 'e identificada pela matrícula');
  eq(idx.semData.length, 1, 'as linhas sem data seguem para o relatório');
  ok(!idx.porMat.has(222222) && !idx.porMat.has(444444), 'nenhuma delas vira K');
}

/* =================================================== 3. aplicação */
sec('3. O K entra nos dias certos');
{
  const st = E.defaultSettings();
  const mm = mkMonth(2026, 9);
  const e1 = mkEmp(mm.days, 111111);
  const e2 = mkEmp(mm.days, 222222);
  const model = mkModel(2026, 9, [e1, e2]);
  const cursos = mkCursos([
    { mat: 111111, data: D_UTC(2026, 9, 7) },
    { mat: 111111, data: D_UTC(2026, 9, 21) },
  ]);
  const rel = E.aplicarCursos(model, cursos, st);

  eq(rel.aplicados, 2, 'dois K lançados');
  eq(rel.pessoas, 1, 'para uma pessoa só');
  eq(JSON.stringify(diasCom(model, e1, 'K')), JSON.stringify([7, 21]), 'nos dias 7 e 21');
  eq(e1.curso.size, 2, 'os dias ficam marcados como vindos do arquivo');
  eq(e2.curso.size, 0, 'quem não tem curso não é tocado');
  eq(diasCom(model, e2, 'K').length, 0, 'e não ganha K nenhum');
  eq(model.errorCount, 0, 'a escala continua válida');
  eq(e1.stat.counted, e1.stat.required, 'a meta de folgas é cumprida mesmo com os cursos ocupando dias');
  ok(e1.stat.maxRun <= st.maxRun, 'o 6x1 é respeitado (maior sequência ' + e1.stat.maxRun + ')');
  eq(e1.stat.sun, 1, 'continua com exatamente 1 domingo');
}

sec('4. Curso em cima de folga: o K entra e a folga é remanejada');
{
  const st = E.defaultSettings();
  const mm = mkMonth(2026, 9);

  // primeiro sem curso, para saber quantas folgas a pessoa tinha
  const semCurso = mkEmp(mm.days, 111111);
  const m0 = mkModel(2026, 9, [semCurso]);
  E.generate(m0, st, { passes: 4 });
  const metaOriginal = semCurso.stat.required;

  const fixed = new Array(mm.days).fill('');
  fixed[9] = 'F';                       // folga pré-configurada no dia 10
  const e = mkEmp(mm.days, 111111, { fixed });
  const model = mkModel(2026, 9, [e]);
  const rel = E.aplicarCursos(model, mkCursos([{ mat: 111111, data: D_UTC(2026, 9, 10) }]), st);

  eq(rel.remanejadas.length, 1, 'a folga substituída é registrada');
  eq(rel.remanejadas[0].atual, 'F', 'sabendo o que havia lá (F)');
  eq(rel.remanejadas[0].d, 9, 'e em que dia');
  eq(E.eff(e, 9), 'K', 'o dia 10 virou curso');
  eq(e.stat.counted, metaOriginal, 'a folga perdida foi reposta em outro dia (' + e.stat.counted + '/' + metaOriginal + ')');
  eq(model.errorCount, 0, 'sem erros');
  eq(e._fixed0[9], 'F', 'o que havia na planilha fica guardado para o Excel e para o relatório');

  // mesma coisa com FA
  const f2 = new Array(mm.days).fill('');
  const sab = mm.dow.findIndex((d) => d === 6);
  f2[sab] = 'FA'; f2[sab + 1] = 'F';
  const e2 = mkEmp(mm.days, 222222, { fixed: f2, gold: true });
  const m2 = mkModel(2026, 9, [e2]);
  const r2 = E.aplicarCursos(m2, mkCursos([{ mat: 222222, data: D_UTC(2026, 9, sab + 1) }]), st);
  eq(r2.remanejadas.length, 1, 'FA também cede lugar ao curso');
  eq(r2.remanejadas[0].atual, 'FA', 'e é registrado como FA');
  eq(E.eff(e2, sab), 'K', 'o sábado virou curso');
}

sec('5. Curso em dia de férias: não sobrescreve, reporta');
{
  const st = E.defaultSettings();
  const mm = mkMonth(2026, 9);
  const fixed = new Array(mm.days).fill('');
  for (let d = 0; d < 14; d++) fixed[d] = 'L';   // férias na 1ª quinzena
  const e = mkEmp(mm.days, 111111, { fixed, nome: 'DE FÉRIAS' });
  const model = mkModel(2026, 9, [e]);
  const rel = E.aplicarCursos(model, mkCursos([
    { mat: 111111, data: D_UTC(2026, 9, 3), curso: 'SGSO' },   // dentro das férias
    { mat: 111111, data: D_UTC(2026, 9, 20) },                  // fora das férias
  ]), st);

  eq(rel.ferias.length, 1, 'o conflito com férias é reportado');
  eq(rel.ferias[0].d, 2, 'no dia certo');
  eq(rel.ferias[0].reg.curso, 'SGSO', 'dizendo qual curso, para cobrar a correção na origem');
  eq(E.eff(e, 2), 'L', 'o L do dia 3 continua intacto');
  eq(E.eff(e, 19), 'K', 'o curso fora das férias entra normalmente');
  eq(rel.aplicados, 1, 'só um K foi lançado');
  eq(e.curso.has(2), false, 'o dia de férias não é marcado como curso');
}

sec('6. Dia já ocupado por outro código não é sobrescrito');
{
  const st = E.defaultSettings();
  const mm = mkMonth(2026, 9);
  const fixed = new Array(mm.days).fill('');
  fixed[11] = 'AF';
  const e = mkEmp(mm.days, 111111, { fixed });
  const model = mkModel(2026, 9, [e]);
  const rel = E.aplicarCursos(model, mkCursos([{ mat: 111111, data: D_UTC(2026, 9, 12) }]), st);
  eq(rel.ocupados.length, 1, 'o conflito é reportado');
  eq(rel.ocupados[0].atual, 'AF', 'dizendo o que havia lá');
  eq(E.eff(e, 11), 'AF', 'a folga aniversário fica');
  eq(rel.aplicados, 0, 'nenhum K forçado por cima');
}

sec('7. K que já estava na planilha não é contado como novo');
{
  const st = E.defaultSettings();
  const mm = mkMonth(2026, 9);
  const fixed = new Array(mm.days).fill('');
  fixed[5] = 'K';
  const e = mkEmp(mm.days, 111111, { fixed });
  const model = mkModel(2026, 9, [e]);
  const rel = E.aplicarCursos(model, mkCursos([{ mat: 111111, data: D_UTC(2026, 9, 6) }]), st);
  eq(E.eff(e, 5), 'K', 'o K continua lá');
  eq(rel.remanejadas.length, 0, 'não conta como folga remanejada');
  eq(rel.ocupados.length, 0, 'nem como conflito');
  ok(e.curso.has(5), 'mas é marcado como coberto pelo arquivo de cursos');
}

sec('8. Matrícula que não existe na escala é reportada');
{
  const st = E.defaultSettings();
  const mm = mkMonth(2026, 9);
  const e = mkEmp(mm.days, 111111);
  const model = mkModel(2026, 9, [e]);
  const rel = E.aplicarCursos(model, mkCursos([
    { mat: 111111, data: D_UTC(2026, 9, 5) },
    { mat: 999999, nome: 'GERENTE FULANO', data: D_UTC(2026, 9, 8) },
    { mat: 999999, nome: 'GERENTE FULANO', data: D_UTC(2026, 9, 9) },
  ]), st);
  eq(rel.naoEncontrados.length, 1, 'uma matrícula sem par na escala');
  eq(rel.naoEncontrados[0].mat, 999999, 'identificada');
  eq(rel.naoEncontrados[0].nome, 'GERENTE FULANO', 'com o nome, para você localizar a pessoa');
  eq(rel.naoEncontrados[0].dias, 2, 'e quantas datas ficaram de fora');
  eq(rel.aplicados, 1, 'só o K de quem está na escala foi lançado');
}

sec('9. Trocar de arquivo de cursos não acumula K da leitura anterior');
{
  const st = E.defaultSettings();
  const mm = mkMonth(2026, 9);
  const e = mkEmp(mm.days, 111111);
  const model = mkModel(2026, 9, [e]);

  E.aplicarCursos(model, mkCursos([{ mat: 111111, data: D_UTC(2026, 9, 5) }]), st);
  eq(JSON.stringify(diasCom(model, e, 'K')), JSON.stringify([5]), 'primeira leitura: K no dia 5');

  E.aplicarCursos(model, mkCursos([{ mat: 111111, data: D_UTC(2026, 9, 18) }]), st);
  eq(JSON.stringify(diasCom(model, e, 'K')), JSON.stringify([18]), 'segunda leitura: só o dia 18 — o dia 5 foi desfeito');
  eq(e.curso.size, 1, 'a marcação acompanha');

  E.limparCursos(model, st);
  eq(diasCom(model, e, 'K').length, 0, 'limparCursos devolve a escala ao que veio na planilha');
  eq(e.curso.size, 0, 'e apaga as marcações');
  eq(model.cursos, null, 'e o relatório');
  eq(e.stat.counted, e.stat.required, 'a escala volta a fechar a meta');
}

sec('10. A planilha original é preservada ao aplicar e desfazer');
{
  const st = E.defaultSettings();
  const mm = mkMonth(2026, 9);
  const fixed = new Array(mm.days).fill('');
  fixed[9] = 'F'; fixed[14] = 'L'; fixed[20] = 'K';
  const e = mkEmp(mm.days, 111111, { fixed });
  const original = fixed.slice();
  const model = mkModel(2026, 9, [e]);
  E.aplicarCursos(model, mkCursos([{ mat: 111111, data: D_UTC(2026, 9, 10) }]), st);
  eq(JSON.stringify(e._fixed0), JSON.stringify(original), 'o estado lido do arquivo fica guardado intacto');
  E.limparCursos(model, st);
  eq(JSON.stringify(e.fixed), JSON.stringify(original), 'e é restaurado por inteiro ao remover os cursos');
}

/* ============================================ 11. em escala cheia */
sec('11. Escala cheia continua dentro das regras depois dos cursos');
{
  const st = E.defaultSettings();
  const mm = mkMonth(2026, 9);
  const hist = [['F', '', '', ''], ['', 'F', '', ''], ['', '', 'F', ''], ['', '', '', 'F']];
  const emps = Array.from({ length: 30 }, (_, i) => {
    const fixed = new Array(mm.days).fill('');
    fixed[(i * 3) % mm.days] = 'F';              // escala pré-configurada
    if (i === 5) for (let d = 0; d < 12; d++) fixed[d] = 'L';
    return mkEmp(mm.days, 200000 + i, { fixed, gold: i % 4 === 0, prev: hist[i % hist.length] });
  });
  const model = mkModel(2026, 9, emps);

  // 3 cursos por pessoa, espalhados
  const linhas = [];
  emps.forEach((e, i) => { for (const k of [0, 1, 2]) linhas.push({ mat: e.mat, data: D_UTC(2026, 9, 2 + ((i * 7 + k * 9) % 28)) }); });
  const rel = E.aplicarCursos(model, mkCursos(linhas), st);

  console.log('   ' + rel.aplicados + ' K · ' + rel.remanejadas.length + ' folga(s) remanejada(s) · ' + rel.ferias.length + ' em férias');
  eq(model.errorCount, 0, 'nenhum erro na escala inteira');
  const ruins = todos(model).filter((e) => !e.stat.allL && (e.stat.counted < e.stat.required || e.stat.maxRun > st.maxRun || e.stat.sun !== 1));
  eq(ruins.length, 0, 'todos dentro de meta, 6x1 e domingo único' + (ruins.length ? ': ' + ruins.map((e) => e.mat).join(', ') : ''));
  ok(rel.aplicados > 60, 'a maioria dos cursos entrou (' + rel.aplicados + ' de ' + linhas.length + ')');

  // o K não pode quebrar a sequência: quem tem curso no meio da semana
  // continua acumulando dias trabalhados
  const comK = todos(model).find((e) => e.curso.size >= 2 && !e.stat.allL);
  ok(!!comK, 'achei alguém com 2+ cursos para conferir a sequência');
  ok(comK && comK.stat.maxRun >= 1, 'a sequência dele é contada normalmente (' + (comK ? comK.stat.maxRun : '?') + ')');
}

sec('12. K continua sendo dia trabalhado que não quebra a sequência');
{
  const st = E.defaultSettings();
  const mm = mkMonth(2026, 9);
  const e = mkEmp(mm.days, 111111, { prev: ['F'] });
  const model = mkModel(2026, 9, [e]);
  // curso no dia 4: se o K zerasse a sequência, a pessoa poderia trabalhar
  // 6 dias antes e 6 depois sem folga nenhuma
  E.aplicarCursos(model, mkCursos([{ mat: 111111, data: D_UTC(2026, 9, 4) }]), st);
  eq(E.eff(e, 3), 'K', 'o K está no dia 4');
  eq(E.quebraSequencia('K', st), false, 'K não quebra a sequência');
  ok(e.stat.maxRun <= st.maxRun, 'e mesmo assim o 6x1 é respeitado (' + e.stat.maxRun + ')');
  eq(model.errorCount, 0, 'sem erros');
}

/* ======================================= 13. leitura do .xlsx real */
sec('13. Leitura do arquivo de cursos (.xlsx)');
{
  const fs = require('fs');
  let XLSX = null;
  try { XLSX = require('xlsx'); } catch (_) { /* opcional */ }
  if (!XLSX) {
    console.log('   \x1b[33mPULADO\x1b[0m — rode "npm install xlsx" nesta pasta para exercitar o parser.');
  } else {
    // monta um arquivo no formato do real: blocos por curso, cabeçalho
    // repetido, matrícula ora texto ora número, datas e placeholders "X"
    const linhas = [
      [null, null, null, null, null, null, null],
      [null, null, 'PCA', null, null, null, null],
      [null, null, 'MATRÍCULA', 'NOME', 'FUNÇÃO', 'HORA', 'DATA'],
      [null, null, 160622, 'THAIZE', 'ASG LIMPEZA I', null, '09/10/2026'],
      [null, null, '160821', 'DENILSON', 'AUX RAMPA I', null, '28/10/2026'],
      [null, null, null, null, null, null, null],
      [null, null, 'AVSEC OPS', null, null, null, null],
      [null, null, 'MATRÍCULA', 'NOME', 'FUNÇÃO', 'HORA', 'DATA'],
      [null, null, 160622, 'THAIZE', 'ASG LIMPEZA I', null, 46317.8746],
      [null, null, 220148, 'SEM DATA', 'AUX RAMPA I', null, 'X'],
      [null, null, 220149, 'ANO TRUNCADO', 'AUX RAMPA I', null, '29/10/202'],
    ];
    const ws = XLSX.utils.aoa_to_sheet(linhas, { cellDates: true });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'OUTUBRO');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);

    E.loadCursos(ab).then((c) => {
      eq(c.regs.length, 3, 'leu os 3 lançamentos com data');
      eq(c.semData.length, 2, 'e separou as linhas sem data utilizável');
      const textos = c.semData.map((r) => r.texto).sort();
      eq(JSON.stringify(textos), JSON.stringify(['29/10/202', 'X']), 'guardando o texto que estava lá, para você conferir na origem');
      ok(c.regs.some((r) => r.data.getUTCDate() === 22), 'serial com hora junto vira data (46317,87 → 22/10, a fração é descartada)');
      ok(c.regs.some((r) => r.data.getUTCDate() === 9), 'data escrita como texto também é lida');
      const mats = c.regs.map((r) => r.mat);
      ok(mats.every((m) => typeof m === 'number'), 'as matrículas saem normalizadas como número');
      ok(mats.includes(160821), 'inclusive a que veio como texto');
      const cursos = [...new Set(c.regs.map((r) => r.curso))];
      ok(cursos.includes('PCA') && cursos.includes('AVSEC OPS'), 'os títulos dos blocos viram o nome do curso');
      eq(c.regs.filter((r) => r.mat === 160622).length, 2, 'a mesma pessoa aparece nos dois blocos');
      resumo();
    }).catch((err) => { ok(false, 'loadCursos falhou: ' + err.message); resumo(); });
    return;
  }
}

resumo();

function resumo() {
  console.log('\n' + '─'.repeat(58));
  if (!fail) console.log('\x1b[32m✓ ' + pass + ' verificações passaram\x1b[0m');
  else { console.log('\x1b[31m✗ ' + fail + ' falha(s) de ' + (pass + fail) + '\x1b[0m'); falhas.forEach((f, i) => console.log('  ' + (i + 1) + '. ' + f)); }
  console.log('─'.repeat(58));
  process.exit(fail ? 1 : 0);
}
