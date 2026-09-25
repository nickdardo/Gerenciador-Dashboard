/* =====================================================================
   teste-planejador.js — escolha das datas dos cursos

   Regras confirmadas:
     · EXTERNO tem os dias impostos pelo fornecedor; INTERNO é livre no mês;
     · curso ocupa o dia inteiro (não devolve a pessoa para o turno);
     · nunca fim de semana, nunca em férias;
     · evita o dia de folga já lançada (obrigaria a remanejar);
     · evita tirar a mesma pessoa duas vezes na mesma semana;
     · o impacto é medido por COBERTURA HORÁRIA, não por cabeças.

   Rodar:  node testes/teste-planejador.js
   ===================================================================== */

'use strict';

const path = require('path');
const E = require(path.join(__dirname, '..', 'js', 'folgas-engine.js'));
globalThis.FolgaEngine = E;
const P = require(path.join(__dirname, '..', 'js', 'planejador.js'));

let pass = 0, fail = 0;
const falhas = [];
const ok = (c, m) => { if (c) pass++; else { fail++; falhas.push(m); console.log('   \x1b[31m✗\x1b[0m ' + m); } };
const eq = (a, b, m) => ok(a === b, m + '  (esperado ' + JSON.stringify(b) + ', veio ' + JSON.stringify(a) + ')');
const sec = (t) => console.log('\n\x1b[36m── ' + t + '\x1b[0m');

/* ---------------------------------------------------------- fabricação */
const TURNOS = [['05:00', '11:00'], ['07:00', '13:00'], ['13:00', '19:00'], ['22:00', '06:00']];

function mkMonth(Y, M) {
  const days = new Date(Date.UTC(Y, M + 1, 0)).getUTCDate();
  return { year: Y, month: M, days, label: E.MESES[M] + '/' + Y,
    dow: Array.from({ length: days }, (_, i) => new Date(Date.UTC(Y, M, i + 1)).getUTCDay()) };
}
let _row = 8;
function mkEmp(D, mat, o = {}) {
  const [ent, sai] = o.turno || TURNOS[mat % TURNOS.length];
  return { id: 'T' + mat, row: _row++, mat, name: o.nome || ('COLAB ' + mat),
    fixed: o.fixed ? o.fixed.slice() : new Array(D).fill(''), prev: ['F', '', '', ''],
    ch: 186, gold: false, team: '', entrada: o.semHorario ? '' : ent, saida: o.semHorario ? '' : sai,
    gen: new Array(D).fill(''), manual: new Array(D).fill('') };
}
function mkModel(Y, M, emps) {
  const m = mkMonth(Y, M);
  return { month: m, unknownCodes: [], empCount: emps.length,
    sheets: [{ name: 'T', path: 'p', chTable: [{ ch: 186, maxH: 150, jorn: 6 }],
      blocks: [{ title: 'B', headerRow: 1, dateRow: 2, cur: Array.from({ length: m.days }, (_, i) => 10 + i),
        prevCols: [], prevDates: [], groups: [{ label: 'g', name: 'G', emps }] }] }] };
}
const mkProg = (linhas, janelas = [], avisos = []) => ({
  linhas: linhas.map((l, i) => Object.assign({ nome: 'N', func: '', data: null, horaIni: '', horaFim: '', linha: i + 4, aba: 'A' }, l)),
  janelas: new Map(janelas.map((j) => [j.curso, j])), avisos,
});
const todosItens = (rel) => rel.itens.filter((i) => i.dia !== null);

/* ============================================== 1. leitura de dias */
sec('1. Sintaxe dos dias permitidos');
{
  const d = (s) => { const r = P.lerDias(s, 31); return r ? [...r].sort((a, b) => a - b).map((x) => x + 1) : null; };
  eq(JSON.stringify(d('10-23')), JSON.stringify([10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23]), 'intervalo 10-23');
  eq(JSON.stringify(d('11, 28')), JSON.stringify([11, 28]), 'lista 11, 28');
  eq(JSON.stringify(d('6-9, 13-16, 27')), JSON.stringify([6, 7, 8, 9, 13, 14, 15, 16, 27]), 'mistura de intervalos e dias soltos');
  eq(JSON.stringify(d('5')), JSON.stringify([5]), 'um dia só');
  eq(d(''), null, 'vazio = mês inteiro');
  eq(d('   '), null, 'só espaços = mês inteiro');
  eq(d('abc'), null, 'texto sem número = mês inteiro');
  eq(JSON.stringify(d('23-10')), JSON.stringify(d('10-23')), 'intervalo invertido é aceito');
  eq(JSON.stringify(d('5, 99, 7')), JSON.stringify([5, 7]), 'dia fora do mês é descartado');
  eq(JSON.stringify(d('1-31')), JSON.stringify(Array.from({ length: 31 }, (_, i) => i + 1)), 'mês inteiro explícito');
  eq(JSON.stringify(P.lerDias('28-31', 30) ? [...P.lerDias('28-31', 30)].map((x) => x + 1) : []), JSON.stringify([28, 29, 30]), 'respeita mês de 30 dias');
}

sec('2. Horário → faixa de meia hora');
{
  eq(P.paraSlot('00:00'), 0, 'meia-noite é o slot 0');
  eq(P.paraSlot('07:00'), 14, '07:00 é o slot 14');
  eq(P.paraSlot('07:30'), 15, '07:30 é o slot 15');
  eq(P.paraSlot('23:30'), 47, '23:30 é o último slot');
  eq(P.paraSlot(''), null, 'vazio não vira slot');
  eq(P.paraSlot('xx'), null, 'lixo não vira slot');
  eq(P.paraSlot(0.5), 24, 'serial do Excel (meio-dia) também é aceito');
}

sec('3. Turno que vira a noite');
{
  const dia = P.turnoSlots({ entrada: '07:00', saida: '13:00' });
  eq(dia.length, 1, 'turno normal é um único trecho');
  eq(dia[0].de, 14, 'começa às 07:00'); eq(dia[0].ate, 26, 'termina às 13:00');

  const noite = P.turnoSlots({ entrada: '22:00', saida: '06:00' });
  eq(noite.length, 2, 'turno noturno é partido em dois trechos');
  eq(noite[0].dia, 0, 'o primeiro trecho é do próprio dia');
  eq(noite[0].de, 44, 'entra às 22:00'); eq(noite[0].ate, 48, 'até a virada');
  eq(noite[1].dia, 1, 'a madrugada conta no dia seguinte, que é onde ela acontece');
  eq(noite[1].de, 0, 'da meia-noite'); eq(noite[1].ate, 12, 'até as 06:00');

  eq(P.turnoSlots({ entrada: '', saida: '' }), null, 'sem horário não dá para medir');
}

/* ============================================== 4. cobertura base */
sec('4. Cobertura conta só quem está em pista');
{
  const mm = mkMonth(2026, 9);
  const fixed = new Array(mm.days).fill('');
  fixed[4] = 'F'; fixed[5] = 'L';
  const e1 = mkEmp(mm.days, 1, { turno: ['07:00', '13:00'], fixed });
  const e2 = mkEmp(mm.days, 2, { turno: ['07:00', '13:00'] });
  const model = mkModel(2026, 9, [e1, e2]);
  const { base, semHorario } = P.coberturaBase(model);
  eq(semHorario.length, 0, 'ninguém sem horário');
  eq(base[0][14], 2, 'dia 1 às 07:00: as duas pessoas');
  eq(base[4][14], 1, 'dia 5: quem está de folga não conta');
  eq(base[5][14], 1, 'dia 6: quem está de férias não conta');
  eq(base[0][13], 0, 'às 06:30 ninguém entrou ainda');
  eq(base[0][26], 0, 'às 13:00 já saíram');

  const e3 = mkEmp(mm.days, 3, { semHorario: true });
  const m2 = mkModel(2026, 9, [e3]);
  eq(P.coberturaBase(m2).semHorario.length, 1, 'quem está sem horário é separado para reporte');
}

/* ============================================== 5. regras duras */
sec('5. Nunca fim de semana, nunca férias, sempre dentro da janela');
{
  const mm = mkMonth(2026, 9);   // outubro/2026
  const emps = Array.from({ length: 12 }, (_, i) => mkEmp(mm.days, 100 + i));
  const model = mkModel(2026, 9, emps);
  const prog = mkProg(
    emps.map((e) => ({ mat: e.mat, curso: 'CGA' })),
    [{ curso: 'CGA', tipo: 'EXTERNO', dias: P.lerDias('5-9', mm.days) }]);
  const rel = P.planejar(model, prog, { tentativas: 4 });

  const dias = todosItens(rel).map((i) => i.dia);
  eq(dias.length, 12, 'todo mundo alocado');
  ok(dias.every((d) => mm.dow[d] !== 0 && mm.dow[d] !== 6), 'nenhum caiu em fim de semana');
  ok(dias.every((d) => d >= 4 && d <= 8), 'todos dentro da janela 5-9');
  const fora = dias.filter((d) => d < 4 || d > 8);
  eq(fora.length, 0, 'nenhum fora da janela' + (fora.length ? ': ' + fora : ''));
}

sec('6. Férias bloqueiam o dia');
{
  const mm = mkMonth(2026, 9);
  const fixed = new Array(mm.days).fill('');
  for (let d = 0; d < 9; d++) fixed[d] = 'L';       // férias cobrem quase toda a janela
  const e = mkEmp(mm.days, 200, { fixed });
  const outro = mkEmp(mm.days, 201);
  const model = mkModel(2026, 9, [e, outro]);
  const prog = mkProg([{ mat: 200, curso: 'X' }, { mat: 201, curso: 'X' }],
    [{ curso: 'X', tipo: 'EXTERNO', dias: P.lerDias('5-12', mm.days) }]);
  const rel = P.planejar(model, prog, { tentativas: 4 });
  const dele = rel.itens.find((i) => i.e.mat === 200);
  ok(dele.dia >= 9, 'quem está de férias até o dia 9 só pode ir depois (foi para o dia ' + (dele.dia + 1) + ')');
  eq(E.eff(e, dele.dia), '', 'e o dia escolhido está livre');
}

sec('7. Sem dia possível vira erro nomeado, não silêncio');
{
  const mm = mkMonth(2026, 9);
  const fixed = new Array(mm.days).fill('');
  for (let d = 0; d < mm.days; d++) fixed[d] = 'L';
  const e = mkEmp(mm.days, 300, { fixed, nome: 'DE FÉRIAS O MÊS' });
  const model = mkModel(2026, 9, [e]);
  const rel = P.planejar(model, mkProg([{ mat: 300, curso: 'X', nome: 'DE FÉRIAS O MÊS' }],
    [{ curso: 'X', tipo: 'INTERNO', dias: null }]), { tentativas: 2 });
  eq(todosItens(rel).length, 0, 'ninguém alocado');
  const err = rel.avisos.find((a) => a.lv === 'erro' && /nenhum dia possível/.test(a.t));
  ok(!!err, 'o motivo é reportado como erro');
  ok(err && err.t.includes('300'), 'com a matrícula (' + (err ? err.t : '') + ')');
}

sec('8. Data já preenchida na planilha fica travada');
{
  const mm = mkMonth(2026, 9);
  const emps = Array.from({ length: 6 }, (_, i) => mkEmp(mm.days, 400 + i));
  const model = mkModel(2026, 9, emps);
  const linhas = emps.map((e, i) => ({ mat: e.mat, curso: 'X',
    data: i === 0 ? new Date(Date.UTC(2026, 9, 22)) : null }));
  const rel = P.planejar(model, mkProg(linhas, [{ curso: 'X', tipo: 'INTERNO', dias: null }]), { tentativas: 4 });
  const travado = rel.itens.find((i) => i.travado);
  ok(!!travado, 'a linha com data vira item travado');
  eq(travado.dia, 21, 'no dia 22, exatamente como estava escrito');
  eq(rel.metricas.travados, 1, 'e é contado como travado');
}

sec('9. Data de outro mês é ignorada com aviso');
{
  const mm = mkMonth(2026, 9);
  const e = mkEmp(mm.days, 500);
  const model = mkModel(2026, 9, [e]);
  const rel = P.planejar(model, mkProg([{ mat: 500, curso: 'X', data: new Date(Date.UTC(2026, 6, 6)) }],
    [{ curso: 'X', tipo: 'INTERNO', dias: null }]), { tentativas: 2 });
  ok(rel.avisos.some((a) => /outro mês/.test(a.t)), 'avisa que a data é de outro mês');
  const it = rel.itens[0];
  ok(it && !it.travado && it.dia !== null, 'e o painel escolhe uma data válida no lugar');
}

/* ============================================== 10. distribuição */
sec('10. Os internos se espalham pelo mês');
{
  const mm = mkMonth(2026, 9);
  const emps = Array.from({ length: 40 }, (_, i) => mkEmp(mm.days, 600 + i));
  const model = mkModel(2026, 9, emps);
  const linhas = [];
  for (const e of emps) { linhas.push({ mat: e.mat, curso: 'A' }); linhas.push({ mat: e.mat, curso: 'B' }); }
  const rel = P.planejar(model, mkProg(linhas,
    [{ curso: 'A', tipo: 'INTERNO', dias: null }, { curso: 'B', tipo: 'INTERNO', dias: null }]), { tentativas: 6 });

  const uteis = Array.from({ length: mm.days }, (_, d) => d).filter((d) => mm.dow[d] !== 0 && mm.dow[d] !== 6);
  const ideal = 80 / uteis.length;
  const porDia = rel.porDia.map((p) => p.pessoas);
  const usados = uteis.map((d) => porDia[d]);
  const desvio = Math.max(...usados.map((v) => Math.abs(v - ideal)));
  console.log('   ' + usados.join('/') + '   ideal ' + ideal.toFixed(1));
  eq(todosItens(rel).length, 80, 'as 80 inscrições foram alocadas');
  ok(desvio <= 2.5, 'nenhum dia útil destoa mais de 2,5 do ideal (desvio ' + desvio.toFixed(1) + ')');
  eq(porDia.filter((v, d) => v > 0 && (mm.dow[d] === 0 || mm.dow[d] === 6)).length, 0, 'nada em fim de semana');
}

sec('11. Ninguém faz dois cursos no mesmo dia');
{
  const mm = mkMonth(2026, 9);
  const emps = Array.from({ length: 10 }, (_, i) => mkEmp(mm.days, 700 + i));
  const model = mkModel(2026, 9, emps);
  const linhas = [];
  for (const e of emps) for (const c of ['A', 'B', 'C']) linhas.push({ mat: e.mat, curso: c });
  const rel = P.planejar(model, mkProg(linhas,
    ['A', 'B', 'C'].map((c) => ({ curso: c, tipo: 'INTERNO', dias: null }))), { tentativas: 6 });

  const porPessoa = new Map();
  for (const it of todosItens(rel)) {
    const k = it.e.mat;
    if (!porPessoa.has(k)) porPessoa.set(k, []);
    porPessoa.get(k).push(it.dia);
  }
  let colisoes = 0, mesmaSemana = 0;
  for (const dias of porPessoa.values()) {
    const s = new Set(dias);
    colisoes += dias.length - s.size;
    const ord = [...s].sort((a, b) => a - b);
    for (let i = 1; i < ord.length; i++) if (ord[i] - ord[i - 1] <= 3) mesmaSemana++;
  }
  eq(colisoes, 0, 'nenhuma pessoa com dois cursos no mesmo dia');
  console.log('   pares a menos de 4 dias: ' + mesmaSemana + ' (penalizado, não proibido)');
  ok(mesmaSemana <= 6, 'o espaçamento por pessoa é respeitado na maioria dos casos');
}

sec('12. Curso externo com um único dia útil concentra — e o painel avisa o piso');
{
  const mm = mkMonth(2026, 9);
  eq(mm.dow[10], 0, 'em outubro/2026 o dia 11 é domingo');
  const emps = Array.from({ length: 7 }, (_, i) => mkEmp(mm.days, 800 + i));
  const model = mkModel(2026, 9, emps);
  const rel = P.planejar(model, mkProg(emps.map((e) => ({ mat: e.mat, curso: 'APGC' })),
    [{ curso: 'APGC', tipo: 'EXTERNO', dias: P.lerDias('11, 28', mm.days) }]), { tentativas: 4 });

  const dias = todosItens(rel).map((i) => i.dia);
  ok(dias.every((d) => d === 27), 'sobrando só o dia 28, todos vão para lá');
  eq(rel.metricas.picoFixo, 7, 'o piso imposto pelos externos é 7');
  eq(rel.metricas.pico.pessoas, 7, 'e o pico alcançado é o mesmo — não há o que melhorar');
}

/* ============================================== 13. medição */
sec('13. A medição não inventa buraco onde não havia gente');
{
  const mm = mkMonth(2026, 9);
  const fixed = new Array(mm.days).fill('');
  fixed[6] = 'F';                                   // folga no dia 7
  const e = mkEmp(mm.days, 900, { turno: ['07:00', '13:00'], fixed });
  const model = mkModel(2026, 9, [e]);

  const naFolga = P.medir(model, [{ emp: e, dia: 6 }]);
  eq(naFolga.piorPct, 0, 'curso no dia de folga não derruba cobertura — a pessoa já não estava em pista');
  eq(naFolga.custo, 0, 'e não gera custo de cobertura');

  const emDiaUtil = P.medir(model, [{ emp: e, dia: 7 }]);
  ok(emDiaUtil.piorPct > 0, 'curso em dia trabalhado derruba, sim');
  eq(emDiaUtil.piorPct, 1, 'sendo a única pessoa, a queda é de 100%');
}

sec('14. A mesma pessoa não é descontada duas vezes no mesmo dia');
{
  const mm = mkMonth(2026, 9);
  const e = mkEmp(mm.days, 910, { turno: ['07:00', '13:00'] });
  const model = mkModel(2026, 9, [e]);
  const uma = P.medir(model, [{ emp: e, dia: 5 }]);
  const duas = P.medir(model, [{ emp: e, dia: 5 }, { emp: e, dia: 5 }]);
  eq(duas.custo, uma.custo, 'dois cursos no mesmo dia custam o mesmo que um — ela só pode faltar uma vez');
  eq(duas.pico, 1, 'e contam como uma pessoa fora');
}

sec('15. O déficit nunca passa da cobertura planejada');
{
  const mm = mkMonth(2026, 9);
  const emps = Array.from({ length: 30 }, (_, i) => mkEmp(mm.days, 1000 + i));
  const model = mkModel(2026, 9, emps);
  const linhas = [];
  for (const e of emps) for (const c of ['A', 'B']) linhas.push({ mat: e.mat, curso: c });
  const rel = P.planejar(model, mkProg(linhas,
    [{ curso: 'A', tipo: 'INTERNO', dias: null }, { curso: 'B', tipo: 'INTERNO', dias: null }]), { tentativas: 4 });
  let ruins = 0;
  for (let d = 0; d < mm.days; d++) for (let x = 0; x < P.SLOTS; x++) if (rel.def[d][x] > rel.base[d][x] + 1e-9) ruins++;
  eq(ruins, 0, 'nenhum slot com mais gente saindo do que havia');
  ok(rel.metricas.piorQueda.pct <= 1, 'a pior queda é no máximo 100% (' + (rel.metricas.piorQueda.pct * 100).toFixed(0) + '%)');
}

sec('16. Planejar é melhor que marcar na primeira data livre');
{
  const mm = mkMonth(2026, 9);
  const emps = Array.from({ length: 40 }, (_, i) => mkEmp(mm.days, 1100 + i));
  const model = mkModel(2026, 9, emps);
  const linhas = [];
  for (const e of emps) for (const c of ['A', 'B']) linhas.push({ mat: e.mat, curso: c });
  const rel = P.planejar(model, mkProg(linhas,
    [{ curso: 'A', tipo: 'INTERNO', dias: null }, { curso: 'B', tipo: 'INTERNO', dias: null }]), { tentativas: 6 });

  const naMao = P.medir(model, rel.itens.filter((i) => i.cands.length).map((i) => ({ emp: i.e, dia: i.cands[0] })));
  const plano = P.medir(model, todosItens(rel).map((i) => ({ emp: i.e, dia: i.dia })));
  console.log('   na mão: pico ' + naMao.pico + ' · queda ' + (naMao.piorPct * 100).toFixed(0) + '%   |   planejado: pico '
    + plano.pico + ' · queda ' + (plano.piorPct * 100).toFixed(0) + '%');
  ok(plano.custo < naMao.custo / 2, 'o plano custa menos da metade do jeito manual');
  ok(plano.pico < naMao.pico, 'e derruba o pico de pessoas fora');
}

/* ============================================== 17. relatório */
sec('17. Relatório separa o que dá e o que não dá para mexer');
{
  const mm = mkMonth(2026, 9);
  const emps = Array.from({ length: 20 }, (_, i) => mkEmp(mm.days, 1200 + i));
  const model = mkModel(2026, 9, emps);
  const linhas = emps.map((e, i) => ({ mat: e.mat, curso: i < 8 ? 'EXT' : 'INT' }));
  const rel = P.planejar(model, mkProg(linhas, [
    { curso: 'EXT', tipo: 'EXTERNO', dias: P.lerDias('13-14', mm.days) },
    { curso: 'INT', tipo: 'INTERNO', dias: null }]), { tentativas: 4 });

  eq(rel.metricas.externos, 8, 'conta os externos');
  eq(rel.metricas.internos, 12, 'conta os internos');
  eq(rel.metricas.total, 20, 'e o total alocado');
  ok(rel.metricas.picoFixo >= 4, 'o piso dos externos é calculado (' + rel.metricas.picoFixo + ')');
  const d13 = rel.porDia[12], d14 = rel.porDia[13];
  eq(d13.externos + d14.externos, 8, 'os 8 externos ficam nos dias 13 e 14');
  ok(Math.abs(d13.externos - d14.externos) <= 2, 'repartidos entre os dois dias disponíveis ('
    + d13.externos + ' e ' + d14.externos + ')');
}

sec('18. Matrícula fora da escala e pessoa sem horário são reportadas');
{
  const mm = mkMonth(2026, 9);
  const e1 = mkEmp(mm.days, 1300);
  const e2 = mkEmp(mm.days, 1301, { semHorario: true, nome: 'SEM HORARIO' });
  const model = mkModel(2026, 9, [e1, e2]);
  const rel = P.planejar(model, mkProg([
    { mat: 1300, curso: 'X' }, { mat: 1301, curso: 'X' },
    { mat: 9999, curso: 'X', nome: 'NAO EXISTE' }, { mat: 9999, curso: 'Y', nome: 'NAO EXISTE' },
  ], [{ curso: 'X', tipo: 'INTERNO', dias: null }, { curso: 'Y', tipo: 'INTERNO', dias: null }]), { tentativas: 2 });

  const na = rel.avisos.find((a) => /9999/.test(a.t));
  ok(!!na, 'matrícula fora da escala é reportada');
  ok(na && /2 curso/.test(na.t), 'dizendo quantos cursos são (' + (na ? na.t : '') + ')');
  ok(na && /não está na escala/.test(na.t), 'com a causa: fora da escala');

  const sh = rel.avisos.find((a) => a.lv === 'erro' && /sem horário/.test(a.t));
  ok(!!sh, 'quem está na escala sem horário vira erro');
  ok(sh && /1301/.test(sh.t), 'com a matrícula');
  ok(sh && /na escala mas sem horário/.test(sh.t), 'e com a causa separada da anterior — a ação é outra');
  ok(sh && /Preencha entrada e saída/.test(sh.t), 'dizendo o que fazer');

  // O ponto do ajuste: ninguém volta com a data em branco.
  eq(todosItens(rel).length, 4, 'TODOS recebem data, inclusive quem não dá para medir');
  const semMedida = rel.itens.filter((i) => !i.medivel);
  eq(semMedida.length, 3, 'três itens ficam marcados como não medíveis');
  ok(semMedida.every((i) => i.dia !== null), 'e todos eles têm data');
  ok(semMedida.every((i) => i.motivo), 'cada um sabe o próprio motivo');
  const motivos = [...new Set(semMedida.map((i) => i.motivo))].sort();
  eq(JSON.stringify(motivos), JSON.stringify(['fora da escala', 'sem horário na escala']), 'os dois motivos são distinguidos');
}

sec('18b. Quem não dá para medir é espalhado, não empilhado');
{
  const mm = mkMonth(2026, 9);
  // ninguém da escala: todos fantasmas, só dá para equilibrar por cabeça
  const e = mkEmp(mm.days, 1350);
  const model = mkModel(2026, 9, [e]);
  const linhas = [];
  for (let i = 0; i < 40; i++) linhas.push({ mat: 900000 + i, nome: 'FORA ' + i, curso: 'X' });
  const rel = P.planejar(model, mkProg(linhas, [{ curso: 'X', tipo: 'INTERNO', dias: null }]), { tentativas: 5 });

  eq(todosItens(rel).length, 40, 'os 40 recebem data');
  const uteis = Array.from({ length: mm.days }, (_, d) => d).filter((d) => mm.dow[d] !== 0 && mm.dow[d] !== 6);
  const porDia = uteis.map((d) => rel.porDia[d].pessoas);
  const ideal = 40 / uteis.length;
  const desvio = Math.max(...porDia.map((v) => Math.abs(v - ideal)));
  console.log('   ' + porDia.join('/') + '   ideal ' + ideal.toFixed(1));
  ok(desvio <= 1.5, 'ficam parelhos pelos dias úteis (desvio ' + desvio.toFixed(1) + ')');
  eq(porDia.filter((v, i) => v === 0).length, 0, 'nenhum dia útil fica vazio enquanto outro acumula');
  ok(uteis.every((d) => mm.dow[d] !== 0 && mm.dow[d] !== 6), 'e nada em fim de semana');
}

sec('18c. Janela e data travada continuam valendo para quem não dá para medir');
{
  const mm = mkMonth(2026, 9);
  const e = mkEmp(mm.days, 1360);
  const model = mkModel(2026, 9, [e]);
  const linhas = [
    { mat: 900001, nome: 'FORA A', curso: 'EXT' },
    { mat: 900002, nome: 'FORA B', curso: 'EXT' },
    { mat: 900003, nome: 'FORA C', curso: 'EXT', data: new Date(Date.UTC(2026, 9, 22)) },
  ];
  const rel = P.planejar(model, mkProg(linhas, [{ curso: 'EXT', tipo: 'EXTERNO', dias: P.lerDias('5-9', mm.days) }]), { tentativas: 4 });
  const livres = rel.itens.filter((i) => !i.travado);
  ok(livres.every((i) => i.dia >= 4 && i.dia <= 8), 'respeitam a janela 5-9 mesmo sem estar na escala');
  const travado = rel.itens.find((i) => i.travado);
  eq(travado.dia, 21, 'e a data travada continua travada');
  eq(todosItens(rel).length, 3, 'os três com data');
}

sec('19. Curso ausente da aba JANELAS vira interno, com aviso');
{
  const mm = mkMonth(2026, 9);
  const e = mkEmp(mm.days, 1400);
  const model = mkModel(2026, 9, [e]);
  const rel = P.planejar(model, mkProg([{ mat: 1400, curso: 'DESCONHECIDO' }], []), { tentativas: 2 });
  const it = rel.itens[0];
  ok(it && it.dia !== null, 'ainda assim é alocado');
  eq(it.tipo, 'INTERNO', 'tratado como interno');
}

sec('20. Mesma entrada, mesmo resultado');
{
  const roda = () => {
    _row = 8;
    const mm = mkMonth(2026, 9);
    const emps = Array.from({ length: 20 }, (_, i) => mkEmp(mm.days, 1500 + i));
    const model = mkModel(2026, 9, emps);
    const linhas = emps.map((e) => ({ mat: e.mat, curso: 'A' }));
    const rel = P.planejar(model, mkProg(linhas, [{ curso: 'A', tipo: 'INTERNO', dias: null }]), { tentativas: 5 });
    return todosItens(rel).map((i) => i.e.mat + ':' + i.dia).join(' ');
  };
  eq(roda(), roda(), 'duas execuções idênticas dão o mesmo plano');
}

sec('21. Turno noturno afeta a cobertura do dia seguinte');
{
  const mm = mkMonth(2026, 9);
  const e = mkEmp(mm.days, 1600, { turno: ['22:00', '06:00'] });
  const model = mkModel(2026, 9, [e]);
  const { base } = P.coberturaBase(model);
  eq(base[4][45], 1, 'dia 5 às 22:30 a pessoa está em pista');
  eq(base[5][2], 1, 'e na madrugada do dia 6 ela ainda está');
  eq(base[5][20], 0, 'mas às 10:00 do dia 6, não');
  const med = P.medir(model, [{ emp: e, dia: 4 }]);
  ok(med.piorPct > 0, 'tirá-la do dia 5 derruba a cobertura');
}

/* ============================================== 22. abas e base */
sec('22. Papel de cada aba vem dos cabeçalhos, não da ordem');
{
  // O leitor adotava qualquer aba com coluna MATRÍCULA. Com a aba DB no
  // arquivo, os 278 colaboradores da base substituíam as inscrições — em
  // silêncio, sem erro nenhum. O que separa as três é a coluna CURSO.
  eq(P.papelDaAba('CURSOS', { mat: 1, nome: 2, func: 3, curso: 4, data: 5 }), 'CURSOS', 'matrícula + curso = aba de inscrições');
  eq(P.papelDaAba('JANELAS', { curso: 1, tipo: 2, dias: 3 }), 'JANELAS', 'curso sem matrícula = aba de janelas');
  eq(P.papelDaAba('DB', { mat: 2, nome: 3, func: 4, sit: 8, desc: 9 }), 'DB', 'matrícula sem curso = base de colaboradores');
  eq(P.papelDaAba('Base de Pessoal', { mat: 2, nome: 3, func: 4 }), 'DB', 'o nome da aba não precisa ser DB');
  eq(P.papelDaAba('INSTRUÇÕES', {}), '', 'aba sem cabeçalho conhecido é ignorada');
  eq(P.papelDaAba('CURSOS', {}), 'CURSOS', 'no empate, o nome da aba desempata');
}

sec('23. A base preenche nome e função e cobra quem não pode fazer curso');
{
  const db = new Map([
    [160830, { mat: 160830, nome: 'Anderson De Oliveira', func: 'Agente de Aviação Executiva I', situacao: 'Ativo', descricao: 'Trabalhando' }],
    [160914, { mat: 160914, nome: 'Luana Gomes De Brito', func: 'Agente Serv a Passageiro I', situacao: 'Ativo', descricao: 'Férias' }],
    [160915, { mat: 160915, nome: 'Fulano Atestado', func: 'AUX RAMPA I', situacao: 'Ativo', descricao: 'Atestado Medico' }],
    [160916, { mat: 160916, nome: 'Ciclano Desligado', func: 'AUX RAMPA I', situacao: 'Desligado', descricao: 'Trabalhando' }],
  ]);
  const linhas = [
    { mat: 160830, nome: '', func: '', curso: 'A' },
    { mat: 160914, nome: '', func: '', curso: 'A' },
    { mat: 160915, nome: '', func: '', curso: 'B' },
    { mat: 160916, nome: '', func: '', curso: 'B' },
    { mat: 999999, nome: '', func: '', curso: 'B' },
    { mat: 160830, nome: 'NOME QUE EU DIGITEI', func: '', curso: 'B' },
  ];
  const avisos = P.aplicarDB(linhas, db);

  eq(linhas[0].nome, 'Anderson De Oliveira', 'nome em branco é preenchido pela base');
  eq(linhas[0].func, 'Agente de Aviação Executiva I', 'função também');
  eq(linhas[5].nome, 'NOME QUE EU DIGITEI', 'nome digitado à mão é respeitado, não sobrescrito');

  const t = avisos.map((a) => a.t).join(' | ');
  ok(/160914/.test(t) && /Férias/.test(t), 'avisa quem está de férias na base');
  ok(/160915/.test(t) && /Atestado/i.test(t), 'avisa quem está de atestado');
  ok(/160916/.test(t) && /Desligado/.test(t), 'avisa quem não está ativo');
  ok(/1 inscrição/.test(t) && /não está na aba DB/.test(t), 'conta as matrículas fora da base');
  ok(!/160830/.test(t), 'quem está trabalhando não gera aviso');
  eq(avisos.filter((a) => /Inscrito mas/.test(a.t)).length, 3, 'três pessoas fora de condição');
}

sec('24. Sem aba DB, tudo continua funcionando');
{
  const linhas = [{ mat: 1, nome: 'MANUAL', func: 'X', curso: 'A' }];
  const avisos = P.aplicarDB(linhas, new Map());
  eq(linhas[0].nome, 'MANUAL', 'o que foi digitado permanece');
  eq(avisos.filter((a) => /Inscrito mas/.test(a.t)).length, 0, 'sem base, não há o que conferir');
}

sec('25. Curso repetido na aba JANELAS junta os dias em vez de perder um');
{
  // Numa planilha real, RAMPA DNATA e LIMPEZA DE AERONAVE apareceram duas
  // vezes. Um Map simples deixaria valer só a última linha e os dias da
  // primeira sumiriam calados.
  const mm = mkMonth(2026, 9);
  const emps = Array.from({ length: 6 }, (_, i) => mkEmp(mm.days, 1700 + i));
  const model = mkModel(2026, 9, emps);
  const janelas = new Map();
  // simula o que lerProgramacao monta ao encontrar a mesma chave duas vezes
  const dias1 = P.lerDias('5-6', mm.days), dias2 = P.lerDias('20-21', mm.days);
  for (const d of dias2) dias1.add(d);
  janelas.set('X', { curso: 'X', tipo: 'EXTERNO', dias: dias1 });
  const prog = { linhas: emps.map((e, i) => ({ mat: e.mat, curso: 'X', nome: 'N', func: '', data: null, horaIni: '', horaFim: '', linha: i + 2 })), janelas, avisos: [] };
  const rel = P.planejar(model, prog, { tentativas: 4 });
  const dias = todosItens(rel).map((i) => i.dia).sort((a, b) => a - b);
  ok(dias.every((d) => [4, 5, 19, 20].includes(d)), 'as duas janelas valem: dias 5, 6, 20 e 21 (' + dias.map((d) => d + 1).join(',') + ')');
  const usados = new Set(dias);
  ok(usados.size >= 3, 'e o painel reparte entre elas em vez de empilhar numa só');
}

sec('26. Dias que o Excel converteu em data viram erro, não "mês inteiro"');
{
  // Sem o apóstrofo, o Excel transforma "1-8" em 1 de agosto. Antes isso
  // caía calado no mês inteiro e o curso externo ficava livre no mês todo.
  eq(P.viroudata(new Date(Date.UTC(2026, 7, 1))), true, 'uma data é reconhecida como acidente');
  eq(P.viroudata(46235), true, 'um serial do Excel também');
  eq(P.viroudata('01 - 08'), false, 'o texto certo não é confundido');
  eq(P.viroudata('05, 28'), false, 'nem a lista de dias fixos');
  eq(P.viroudata(15), false, 'nem o dia solto escrito como número');
  eq(P.viroudata(31), false, 'nem o dia 31');
  eq(P.viroudata(null), false, 'nem a célula vazia');
  eq(P.lerDias(new Date(Date.UTC(2026, 7, 1)), 31), null, 'lerDias recusa a data em vez de inventar dias');
}

sec('27. As três formas de escrever os dias, no mês real');
{
  const mm = mkMonth(2026, 9);
  const dias = (t) => { const s = P.lerDias(t, mm.days); return s ? [...s].sort((a, b) => a - b).map((d) => d + 1) : null; };
  const uteis = (t) => { const s = P.lerDias(t, mm.days); return s ? [...s].sort((a, b) => a - b).filter((d) => mm.dow[d] !== 0 && mm.dow[d] !== 6).map((d) => d + 1) : null; };
  eq(JSON.stringify(dias('05, 28')), JSON.stringify([5, 28]), 'vírgula = dias fixos');
  eq(JSON.stringify(dias('15')), JSON.stringify([15]), 'número solto = só aquele dia');
  eq(JSON.stringify(dias(15)), JSON.stringify([15]), 'inclusive sem o apóstrofo, como número');
  eq(JSON.stringify(dias('01 - 08')), JSON.stringify([1, 2, 3, 4, 5, 6, 7, 8]), 'traço = período completo');
  eq(JSON.stringify(uteis('01 - 08')), JSON.stringify([1, 2, 5, 6, 7, 8]), 'e o fim de semana sai na hora de alocar');
  eq(JSON.stringify(dias('01, 06, 13, 15')), JSON.stringify([1, 6, 13, 15]), 'lista longa de dias fixos');
}

/* ============================================== resumo */
console.log('\n' + '─'.repeat(58));
if (!fail) console.log('\x1b[32m✓ ' + pass + ' verificações passaram\x1b[0m');
else { console.log('\x1b[31m✗ ' + fail + ' falha(s) de ' + (pass + fail) + '\x1b[0m'); falhas.forEach((f, i) => console.log('  ' + (i + 1) + '. ' + f)); }
console.log('─'.repeat(58));
process.exit(fail ? 1 : 0);
