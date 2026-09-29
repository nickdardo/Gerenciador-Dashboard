/* =====================================================================
   teste-opex.js — Dimensionamento × OPEX

   O que está sob teste não é a soma, é a tradução: o dimensionamento fala
   em CARGO e o OPEX conta por GRUPO. Num arquivo real da base BEL, 6 de 26
   linhas não casavam sozinhas — e 32 pessoas mal classificadas inflavam o
   delta de Rampa em +32, um buraco que não existia.

   Rodar:  node testes/teste-opex.js
   ===================================================================== */

'use strict';

const path = require('path');
const E = require(path.join(__dirname, '..', 'js', 'folgas-engine.js'));
globalThis.FolgaEngine = E;
const X = require(path.join(__dirname, '..', 'js', 'opex.js'));

let pass = 0, fail = 0;
const falhas = [];
const ok = (c, m) => { if (c) pass++; else { fail++; falhas.push(m); console.log('   \x1b[31m✗\x1b[0m ' + m); } };
const eq = (a, b, m) => ok(a === b, m + '  (esperado ' + JSON.stringify(b) + ', veio ' + JSON.stringify(a) + ')');
const perto = (a, b, m, tol = 0.01) => ok(Math.abs(a - b) <= tol, m + '  (esperado ~' + b + ', veio ' + a + ')');
const sec = (t) => console.log('\n\x1b[36m── ' + t + '\x1b[0m');

/* ---------------------------------------------------------- fabricação */
// O catálogo real do OPEX, reduzido ao que importa para os testes.
const CATALOGO = new Map([
  ['AUXILIAR DE RAMPA I', 'Rampa'], ['AUXILIAR DE RAMPA III', 'Rampa'], ['AUXILIAR DE ESTEIRA', 'Rampa'],
  ['AUX DE RAMPA I (BALANCEIRO)', 'SPAX'],
  ['AGENTE SERV A PASSAGEIRO I', 'SPAX'], ['AGENTE SERV A PASSAGEIRO II', 'SPAX'],
  ['ATENDENTE A PASSAGEIRO LIDER I', 'SPAX'], ['COORD SERVICO A PASSAGEIRO I', 'SPAX'],
  ['ASG LIMPEZA I', 'Limpeza'], ['ASG LIMPEZA II', 'Limpeza'], ['ENC DE LIMPEZA I', 'Limpeza'],
  ['AUX LIDER DE RAMPA I', 'Lider_Rampa'], ['AUX LIDER DE RAMPA II', 'Lider_Rampa'],
  ['LIDER DE OPERACOES I', 'Lideranca'], ['SUPERVISOR DE OPERACOES I', 'Lideranca'],
  ['SUPERVISOR DE OPERACOES V', 'Lideranca'],
  ['OPERADOR DE EQUIPAMENTOS I', 'Operador'], ['MOTORISTA VEICULOS LEVES', 'Operador'],
  ['APRENDIZ LOGISTICA AD', 'Aprendiz'], ['APRENDIZ LEGAL LOGISTICA', 'Aprendiz'],
  ['MECANICO I', 'GSE'], ['ELETRICISTA I', 'GSE'],
  ['AUXILIAR ADMINISTRATIVO I', 'Administrativo'],
]);
const idx = () => X.montarIndice(CATALOGO);

const mkBase = (base, staff, periodo) => ({
  aba: base, base, periodo: periodo || new Date(Date.UTC(2026, 10, 1)), oculta: false,
  staff: staff.map((s, i) => ({ qtd: s[0], cargo: s[1], ch: s[2], chRot: X.chRot(s[2]), secao: s[3] || '', linha: 100 + i })),
  total: staff.reduce((a, s) => a + s[0], 0),
  fte: staff.reduce((a, s) => a + X.fteDe(s[0], s[2]), 0),
});
const mkMes = (aba, pares, data) => {
  const hc = new Map();
  for (const [g, ch, n] of pares) hc.set(g + '|' + ch, (hc.get(g + '|' + ch) || 0) + n);
  return { aba, data: data || new Date(Date.UTC(2026, 10, 1)), base: '', headcount: hc, fte: new Map(),
    chs: [2, 3, 4, 6, 7, 8], total: [...hc.values()].reduce((a, b) => a + b, 0) };
};

/* ============================================== 1. FTE */
sec('1. FTE = Qtd × CH ÷ 6 — a mesma conta dos dois lados');
{
  // Conferido contra os totais que os próprios arquivos calculam:
  // 244,83 no dimensionamento de BEL e 263,00 no OPEX de novembro.
  eq(X.fteDe(10, 6), 10, '6 horas vale 1 FTE por pessoa');
  eq(X.fteDe(24, 3), 12, '3 horas vale meio FTE (24 pessoas → 12)');
  perto(X.fteDe(19, 4), 12.667, '4 horas vale dois terços (19 → 12,67)');
  perto(X.fteDe(7, 7), 8.167, '7 horas vale 1,167 (7 → 8,17)');
  eq(X.fteDe(5, 0), 0, 'sem carga horária não gera FTE');

  // a soma da tabela de BEL, linha a linha
  const bel = [[1, 7], [1, 7], [2, 7], [4, 6], [22, 6], [2, 6], [5, 6], [30, 6], [3, 4], [5, 3],
    [77, 6], [2, 6], [5, 3], [21, 6], [11, 4], [9, 6], [2, 6], [2, 3], [24, 6], [4, 6],
    [2, 7], [1, 7], [3, 6], [7, 6], [5, 4], [12, 3]];
  eq(bel.reduce((a, x) => a + x[0], 0), 262, 'as 26 linhas de BEL somam 262 pessoas');
  perto(bel.reduce((a, x) => a + X.fteDe(x[0], x[1]), 0), 244.83, 'e 244,83 FTE — igual ao que a planilha calcula');
}

sec('2. Leitura da carga horária');
{
  eq(X.chNum('6H'), 6, '"6H" vira 6');
  eq(X.chNum('7h'), 7, 'minúscula também');
  eq(X.chNum(6), 6, 'número puro passa direto');
  eq(X.chNum('4 H'), 4, 'com espaço');
  eq(X.chNum(''), 0, 'vazio é zero');
  eq(X.chNum(null), 0, 'nulo é zero');
  eq(X.chRot(6), '6H', 'rótulo de volta');
  eq(X.chRot(0), '—', 'sem carga vira travessão');
}

/* ============================================== 3. tradução de nomes */
sec('3. Esqueleto do nome — o que permite casar escritas diferentes');
{
  const e = X.esqueleto;
  eq(e('AGENTE SERV A PAX'), e('AGENTE SERV A PASSAGEIRO I'), 'PAX abre para PASSAGEIRO e o numeral cai');
  eq(e('COOR. DE SERVIÇO A PAX'), e('COORD SERVICO A PASSAGEIRO I'), 'COOR e COORD chegam ao mesmo lugar');
  eq(e('AUXILIAR DE RAMPA I (PCD)'), e('AUXILIAR DE RAMPA I'), 'o parêntese é descartado');
  eq(e('ENC. DE LIMPEZA I'), e('ENCARREGADO LIMPEZA'), 'ENC abre para ENCARREGADO');
  eq(e('LÍDER DE OPERAÇÕES I'), e('LIDER DE OPERACOES I'), 'acento não separa');
  ok(e('ASG LIMPEZA I') !== e('ASG LIMPEZA II') ? false : true, 'numerais diferentes do mesmo cargo colapsam juntos');
  ok(e('AUXILIAR DE RAMPA') !== e('AUXILIAR DE ESTEIRA'), 'cargos de verdade diferentes não colapsam');
}

sec('4. Casamento em degraus, cada um com sua confiança');
{
  const i = idx();
  const c1 = X.casar('ASG LIMPEZA I', i, null);
  eq(c1.grupo, 'Limpeza', 'nome idêntico');
  eq(c1.via, 'nome idêntico ao catálogo', 'e diz que foi idêntico');
  eq(c1.confianca, 'alta', 'com confiança alta');

  const c2 = X.casar('AGENTE SERV A PAX', i, null);
  eq(c2.grupo, 'SPAX', 'nome abreviado cai no grupo certo');
  eq(c2.confianca, 'média', 'com confiança média — é para você conferir');

  const c3 = X.casar('OPERADOR', i, null);
  eq(c3.grupo, 'Operador', 'prefixo encontra "OPERADOR DE EQUIPAMENTOS I"');

  const c4 = X.casar('COOR. DE SERVIÇO A PAX', i, null);
  eq(c4.grupo, 'SPAX', 'abreviação dupla ainda casa');

  const c5 = X.casar('CARGO QUE NAO EXISTE EM LUGAR NENHUM', i, null);
  eq(c5.grupo, null, 'o que não existe não é chutado');
  eq(c5.via, 'fora do catálogo', 'e é reportado como fora do catálogo');
}

sec('5. Ambiguidade é admitida, não resolvida no chute');
{
  const i = idx();
  const c = X.casar('AUXILIAR DE RAMPA', i, null);
  eq(c.grupo, null, '"AUXILIAR DE RAMPA" sem numeral não é classificado sozinho');
  eq(c.via, 'ambíguo', 'é marcado como ambíguo');
  ok(c.opcoes.includes('Rampa') && c.opcoes.includes('SPAX'),
    'porque existe "AUXILIAR DE RAMPA I" (Rampa) e "AUX DE RAMPA I (BALANCEIRO)" (SPAX): ' + c.opcoes.join(', '));
  ok(c.opcoes.length === 2, 'e as duas opções são oferecidas para você decidir');
}

sec('6. A sua decisão vence tudo e é lembrada');
{
  const i = idx();
  const manual = new Map([['AUXILIAR DE RAMPA', 'Rampa'], ['ASG LIMPEZA I', 'Administrativo']]);
  const c1 = X.casar('AUXILIAR DE RAMPA', i, manual);
  eq(c1.grupo, 'Rampa', 'o ambíguo passa a casar');
  eq(c1.via, 'decidido por você', 'e fica registrado que a decisão foi sua');
  const c2 = X.casar('ASG LIMPEZA I', i, manual);
  eq(c2.grupo, 'Administrativo', 'sua decisão sobrepõe até o nome idêntico — você manda');
  const c3 = X.casar('asg limpeza i', i, manual);
  eq(c3.grupo, 'Administrativo', 'e não depende de maiúscula');
}

/* ============================================== 7. comparação */
sec('7. Delta por grupo e por carga horária');
{
  const dim = mkBase('BEL', [
    [30, 'ASG LIMPEZA I', 6], [5, 'ASG LIMPEZA I', 3],
    [77, 'AUXILIAR DE RAMPA I', 6],
    [22, 'AUX.LIDER DE RAMPA I', 6],
  ]);
  const opex = mkMes('NOVEMBRO', [
    ['Limpeza', 6, 32], ['Limpeza', 3, 5],
    ['Rampa', 6, 80],
    ['Lider_Rampa', 6, 22],
  ]);
  const c = X.comparar(dim, opex, CATALOGO, null);

  eq(c.pendentes.length, 0, 'tudo classificado');
  const lim6 = c.linhas.find((l) => l.grupo === 'Limpeza' && l.ch === 6);
  eq(lim6.dimQtd, 30, 'Limpeza 6H no dimensionamento');
  eq(lim6.opexQtd, 32, 'e no OPEX');
  eq(lim6.deltaQtd, 2, 'delta de 2 pessoas');
  eq(lim6.deltaFte, 2, 'e de 2 FTE, porque 6H vale 1');

  const ram = c.porGrupo.find((g) => g.grupo === 'Rampa');
  eq(ram.deltaQtd, 3, 'Rampa: 80 no OPEX contra 77 dimensionadas');
  eq(c.totais.deltaQtd, 80 + 32 + 5 + 22 - (30 + 5 + 77 + 22), 'o total fecha com a soma das partes');
  eq(c.totais.dimQtd, 134, 'total dimensionado');
  eq(c.totais.opexQtd, 139, 'total do OPEX');
}

sec('8. Delta de cabeças pode ser zero e o de FTE não');
{
  // Trocar um 6H por dois 3H mantém o headcount e muda o custo — é
  // exatamente o que só o FTE enxerga.
  const dim = mkBase('X', [[10, 'ASG LIMPEZA I', 6]]);
  const opex = mkMes('NOV', [['Limpeza', 3, 10]]);
  const c = X.comparar(dim, opex, CATALOGO, null);
  const g = c.porGrupo.find((x) => x.grupo === 'Limpeza');
  eq(g.deltaQtd, 0, 'mesmo número de pessoas');
  eq(g.deltaFte, -5, 'mas 5 FTE a menos — a carga horária caiu pela metade');
  eq(g.dimFte, 10, '10 pessoas de 6H = 10 FTE');
  eq(g.opexFte, 5, '10 pessoas de 3H = 5 FTE');
}

sec('9. Grupo que o dimensionamento não dimensiona fica fora do delta');
{
  const dim = mkBase('X', [[30, 'ASG LIMPEZA I', 6]]);
  const opex = mkMes('NOV', [['Limpeza', 6, 30], ['GSE', 7, 11], ['Administrativo', 7, 5]]);
  const c = X.comparar(dim, opex, CATALOGO, null);

  eq(c.totais.deltaQtd, 0, 'o delta fica zerado — Limpeza bate');
  eq(c.apoio.length, 2, 'GSE e Administrativo vão para o bloco de apoio');
  eq(c.totais.apoioQtd, 16, 'somando 16 pessoas');
  perto(c.totais.apoioFte, 16 * 7 / 6, 'e o FTE correspondente');
  ok(!c.porGrupo.some((g) => g.grupo === 'GSE'), 'GSE não aparece na tabela de delta');
  ok(c.apoio.every((a) => a.dimQtd === 0), 'todo item de apoio tem zero no dimensionamento, por definição');
}

sec('10. Pendente não é somado nem escondido');
{
  const dim = mkBase('X', [[30, 'ASG LIMPEZA I', 6], [21, 'AUXILIAR DE RAMPA', 6], [3, 'ATENDENTE LIDER', 6]]);
  const opex = mkMes('NOV', [['Limpeza', 6, 30], ['Rampa', 6, 21]]);
  const c = X.comparar(dim, opex, CATALOGO, null);

  eq(c.pendentes.length, 2, 'duas linhas ficam pendentes');
  eq(c.totais.pendQtd, 24, 'somando 24 pessoas que não entraram na conta');
  eq(c.totais.pendFte, 24, 'e 24 FTE');
  const ram = c.porGrupo.find((g) => g.grupo === 'Rampa');
  eq(ram.dimQtd, 0, 'as 21 de "AUXILIAR DE RAMPA" NÃO foram para Rampa no chute');
  eq(ram.deltaQtd, 21, 'então Rampa aparece com delta de 21 — e o painel mostra o pendente ao lado');
  const p = c.pendentes.find((x) => x.cargo === 'ATENDENTE LIDER');
  ok(p && p.via === 'fora do catálogo', 'cada pendente carrega o motivo');
}

sec('11. Resolver o pendente fecha o delta — o caso real de BEL');
{
  // Reprodução do que aconteceu com o arquivo de verdade: 32 pessoas mal
  // classificadas mostravam +32 em Rampa, um buraco que não existia.
  const dim = mkBase('BEL', [
    [77, 'AUXILIAR DE RAMPA I', 6], [21, 'AUXILIAR DE RAMPA', 6],
    [9, 'AUXILIAR DE RAMPA', 6], [2, 'AUXILIAR DE RAMPA I (PCD)', 6],
  ]);
  const opex = mkMes('NOVEMBRO', [['Rampa', 6, 109]]);

  const antes = X.comparar(dim, opex, CATALOGO, null);
  eq(antes.totais.pendQtd, 32, 'sem de-para, 32 pessoas ficam de fora');
  eq(antes.porGrupo.find((g) => g.grupo === 'Rampa').deltaQtd, 32, 'e Rampa acusa +32');

  const depois = X.comparar(dim, opex, CATALOGO, new Map([
    ['AUXILIAR DE RAMPA', 'Rampa'], ['AUXILIAR DE RAMPA I (PCD)', 'Rampa'],
  ]));
  eq(depois.totais.pendQtd, 0, 'com o de-para, nada fica pendente');
  eq(depois.porGrupo.find((g) => g.grupo === 'Rampa').dimQtd, 109, 'as 109 do dimensionamento aparecem');
  eq(depois.porGrupo.find((g) => g.grupo === 'Rampa').deltaQtd, 0, 'e o delta vira zero — o buraco não existia');
  eq(depois.totais.dimQtd, dim.total, 'o total conferido bate com o total do arquivo');
}

/* ============================================== 12. sincronização */
sec('12. Base e mês se encontram sozinhos');
{
  const dim = { bases: [mkBase('BEL', [[30, 'ASG LIMPEZA I', 6]]), mkBase('FOR', [[10, 'ASG LIMPEZA I', 6]])], avisos: [] };
  const opexBEL = { base: 'BEL', catalogo: CATALOGO,
    meses: [mkMes('OUTUBRO', [['Limpeza', 6, 28]], new Date(Date.UTC(2026, 9, 1))),
      mkMes('NOVEMBRO', [['Limpeza', 6, 30]], new Date(Date.UTC(2026, 10, 1)))] };

  const s = X.sincronizar(dim, [opexBEL], null);
  eq(s.comparacoes.length, 1, 'só a base que tem OPEX é comparada');
  eq(s.comparacoes[0].base, 'BEL', 'e é a BEL');
  eq(s.comparacoes[0].mesOpex, 'NOVEMBRO', 'escolheu o mês que bate com o dimensionamento, não o último');
  eq(s.comparacoes[0].totais.deltaQtd, 0, 'com o número certo');
  ok(s.avisos.some((a) => /FOR/.test(a.t) && /não subiu OPEX/.test(a.t)), 'e avisa que faltou o OPEX de FOR');
}

sec('13. Mês que não bate é usado, mas avisando');
{
  const dim = { bases: [mkBase('BEL', [[30, 'ASG LIMPEZA I', 6]], new Date(Date.UTC(2027, 2, 1)))], avisos: [] };
  const opex = { base: 'BEL', catalogo: CATALOGO, meses: [mkMes('NOVEMBRO', [['Limpeza', 6, 30]], new Date(Date.UTC(2026, 10, 1)))] };
  const s = X.sincronizar(dim, [opex], null);
  eq(s.comparacoes.length, 1, 'a comparação acontece');
  const a = s.avisos.find((x) => /não achei no OPEX o mês/.test(x.t));
  ok(!!a, 'mas o painel avisa que o mês não bateu');
  ok(a && /NOVEMBRO/.test(a.t), 'dizendo qual aba usou no lugar');
}

sec('14. OPEX sem par no dimensionamento também é reportado');
{
  const dim = { bases: [mkBase('BEL', [[30, 'ASG LIMPEZA I', 6]])], avisos: [] };
  const opexBEL = { base: 'BEL', catalogo: CATALOGO, meses: [mkMes('NOVEMBRO', [['Limpeza', 6, 30]])] };
  const opexMAO = { base: 'MAO', catalogo: CATALOGO, meses: [mkMes('NOVEMBRO', [['Limpeza', 6, 50]])] };
  const s = X.sincronizar(dim, [opexBEL, opexMAO], null);
  eq(s.comparacoes.length, 1, 'uma comparação');
  ok(s.avisos.some((a) => /MAO/.test(a.t)), 'e o OPEX de MAO sem aba correspondente é avisado');
}

/* ============================================== 15. lista para colar */
sec('15. A função do catálogo, não só o grupo');
{
  const orig = new Map([...CATALOGO.keys()].map((k) => [k, k.replace('AUXILIAR', 'Auxiliar')]));
  const i = X.montarIndice(CATALOGO, orig);
  eq(X.casar('ASG LIMPEZA I', i, null).funcao, 'ASG LIMPEZA I', 'nome idêntico devolve a função');
  eq(X.casar('AGENTE SERV A PAX', i, null).funcao, 'AGENTE SERV A PASSAGEIRO I', 'nome abreviado devolve a grafia do OPEX');
  eq(X.casar('AUXILIAR DE RAMPA I', i, null).funcao, 'Auxiliar DE RAMPA I', 'e devolve exatamente como o catálogo escreve');

  // O que é ambíguo no catálogo inteiro deixa de ser dentro do grupo:
  // "AUXILIAR DE RAMPA" existe em Rampa e em SPAX, mas uma vez decidido o
  // grupo só sobra um cargo com esse esqueleto.
  const m = X.casar('AUXILIAR DE RAMPA', i, new Map([['AUXILIAR DE RAMPA', 'Rampa']]));
  eq(m.grupo, 'Rampa', 'o de-para resolve o grupo');
  eq(m.funcao, 'Auxiliar DE RAMPA I', 'e a função sai sozinha dentro do grupo escolhido');

  const ig = X.casar('ASG LIMPEZA I', i, new Map([['ASG LIMPEZA I', null]]));
  ok(ig.ignorar === true, 'de-para com grupo nulo marca o cargo para ser ignorado');
}

sec('16. Repartir o total entre as linhas de noturno');
{
  const L = (not, ini) => ({ noturno: not, inicial: ini });
  eq(X.distribuir([L(0, 10)], 14)[0], 14, 'linha única recebe tudo');

  const d = X.distribuir([L(0, 30), L(6, 10)], 44);
  eq(d[0] + d[1], 44, 'a soma bate com o total dimensionado');
  eq(d[0], 33, 'e mantém a proporção de antes (30:10 → 33:11)');
  eq(d[1], 11, 'inclusive na linha noturna');

  const r = X.distribuir([L(0, 1), L(6, 1), L(3, 1)], 5);
  eq(r.reduce((a, b) => a + b, 0), 5, 'o que não divide exato não se perde');

  const z = X.distribuir([L(6, 0), L(0, 0)], 7);
  eq(z[1], 7, 'sem referência anterior, tudo vai para a linha sem noturno');
  eq(z[0], 0, 'e nada é inventado no noturno');

  eq(X.distribuir([L(0, 30), L(6, 10)], 0).join(','), '0,0', 'função que saiu do dimensionamento zera');
}

sec('17. Lista pronta para colar no OPEX');
{
  const grade = (rows) => ({ cabecalho: 12, primeira: 13, ultima: 12 + rows.length,
    colGrupo: 'Y', colInicial: 'AD', temChMes: true, temChDia: true,
    linhas: rows.map((r, i) => ({ linha: 13 + i, grupo: r[0], funcao: r[1], chMes: r[2], chDia: r[3], noturno: r[4], inicial: r[5] })) });

  const mes = { aba: 'NOVEMBRO', grade: grade([
    ['Limpeza', 'ASG LIMPEZA I', 180, 6, 0, 28],
    ['Limpeza', 'ASG LIMPEZA I', 180, 6, 6, 4],
    ['Limpeza', 'ASG LIMPEZA II', 180, 6, 0, 5],
    ['Rampa', 'AUXILIAR DE RAMPA I', 180, 6, 0, 80],
    ['Administrativo', 'AUXILIAR ADMINISTRATIVO I', 210, 7, 0, 5],
  ]) };
  const dim = mkBase('BEL', [
    [40, 'ASG LIMPEZA I', 6],        // 32 → 40, com noturno a manter
    [77, 'AUXILIAR DE RAMPA I', 6],  // 80 → 77
    [12, 'ASG LIMPEZA I', 3],        // carga horária que não existe na grade
    [3, 'MECANICO I', 7],            // função do catálogo, sem linha no mês
  ]);
  const L = X.montarLista(dim, mes, CATALOGO, null, null);

  eq(L.colunas.join('|'), 'Grupo|Função|CH mês|CH dia|noturno|inicial', 'as colunas saem na ordem da grade');

  const asg6 = L.linhas.filter((l) => X.norm(l.funcao) === 'ASG LIMPEZA I' && l.chDia === 6);
  eq(asg6.length, 2, 'a função continua com as duas linhas de noturno que tinha');
  eq(asg6[0].inicial + asg6[1].inicial, 40, 'somando o que o dimensionamento pede');
  eq(asg6[0].noturno, 0, 'a primeira sem horas noturnas');
  eq(asg6[1].noturno, 6, 'e a segunda com as 6 que já estavam lá');
  eq(asg6[1].inicial, 5, 'a proporção de antes foi mantida (28:4 de 32 → 35:5 de 40)');

  const ram = L.linhas.find((l) => l.grupo === 'Rampa');
  eq(ram.inicial, 77, 'Rampa passa a refletir o dimensionamento');
  eq(ram.antes, 80, 'guardando o que estava no OPEX');
  eq(ram.estado, 'ajustada', 'e é marcada como ajustada');

  const adm = L.linhas.find((l) => l.grupo === 'Administrativo');
  eq(adm.inicial, 5, 'grupo de apoio não é zerado — o dimensionamento não fala dele');
  eq(adm.estado, 'apoio', 'e sai marcado como mantido');

  const asg2 = L.linhas.find((l) => X.norm(l.funcao) === 'ASG LIMPEZA II');
  eq(asg2.inicial, 0, 'função do grupo dimensionado que sumiu do dimensionamento vai a zero');
  eq(asg2.estado, 'zerada', 'e é apontada, não escondida');
  ok(L.zeradas.some((z) => X.norm(z.funcao) === 'ASG LIMPEZA II'), 'aparecendo na lista de zeradas');

  eq(L.novas.length, 2, 'duas linhas novas: ASG LIMPEZA I de 3H e MECANICO I');
  const nova3 = L.novas.find((l) => l.chDia === 3);
  eq(nova3.inicial, 12, 'com a quantidade dimensionada');
  eq(nova3.noturno, 0, 'noturno zero — o dimensionamento não sabe essa quebra');
  eq(nova3.chMes, 90, 'e a CH mensal deduzida da própria grade (180/6 = 30 por hora)');
  eq(L.faltamNoCatalogo.length, 0, 'nenhuma função está fora do catálogo do OPEX');
  eq(L.semReferencia.length, 2, 'mas as duas novas saem sem referência de noturno');

  ok(L.repartidas.some((r) => X.norm(r.funcao) === 'ASG LIMPEZA I'),
    'a função que teve o total repartido entre linhas de noturno é reportada');

  const linhasTsv = L.tsv().split('\n');
  eq(linhasTsv[0], 'Grupo\tFunção\tCH mês\tCH dia\tnoturno\tinicial', 'o TSV começa pelo cabeçalho');
  eq(linhasTsv.length, L.linhas.length + 1, 'e traz uma linha por linha da lista');
  eq(linhasTsv[1].split('\t').length, 6, 'com seis colunas, prontas para colar lado a lado');
  const semCab = L.tsv(false).split('\n');
  eq(semCab.length, L.linhas.length, 'sem cabeçalho quando é para colar na grade, que já tem o dela');
  eq(semCab[0], linhasTsv[1], 'e a primeira linha é a mesma');
  eq(L.onde.coluna, 'Y', 'e o painel sabe dizer em que coluna colar');
  eq(L.onde.linha, 13, 'e em que linha');
}

sec('18. Função fora do catálogo é informada, nunca inventada');
{
  const mes = { aba: 'NOVEMBRO', grade: { cabecalho: 12, primeira: 13, ultima: 13, colGrupo: 'Y', colInicial: 'AD',
    temChMes: true, temChDia: true,
    linhas: [{ linha: 13, grupo: 'Rampa', funcao: 'AUXILIAR DE RAMPA I', chMes: 180, chDia: 6, noturno: 0, inicial: 70 }] } };
  const dim = mkBase('BEL', [[70, 'AUXILIAR DE RAMPA I', 6], [4, 'AJUDANTE DE PATIO', 6]]);
  const L = X.montarLista(dim, mes, CATALOGO, new Map([['AJUDANTE DE PATIO', 'Rampa']]), null);

  eq(L.pendentes.length, 0, 'o de-para resolveu o grupo');
  const n = L.novas.find((l) => X.norm(l.funcao) === 'AJUDANTE DE PATIO');
  ok(!!n, 'a linha entra na lista com o nome que o dimensionamento usa');
  eq(L.faltamNoCatalogo.length, 1, 'e é apontada como função que não existe no OPEX');
  eq(L.faltamNoCatalogo[0].inicial, 4, 'com as pessoas que dependem dela');
}

sec('19. Pendente trava a lista, como trava o delta');
{
  const mes = { aba: 'NOV', grade: { cabecalho: 12, primeira: 13, ultima: 13, colGrupo: 'Y', colInicial: 'AD',
    temChMes: true, temChDia: true,
    linhas: [{ linha: 13, grupo: 'Rampa', funcao: 'AUXILIAR DE RAMPA I', chMes: 180, chDia: 6, noturno: 0, inicial: 90 }] } };
  const dim = mkBase('BEL', [[77, 'AUXILIAR DE RAMPA I', 6], [21, 'AUXILIAR DE RAMPA', 6]]);
  const L = X.montarLista(dim, mes, CATALOGO, null, null);
  eq(L.pendentes.length, 1, 'o cargo ambíguo fica pendente');
  eq(L.totais.pendQtd, 21, 'com as 21 pessoas dele');
  eq(L.linhas.find((l) => l.grupo === 'Rampa').inicial, 77,
    'e a lista sai com 77 em vez de 98 — por isso o painel avisa antes de você colar');
}

sec('20. OPEX sem a grade de lançamento ainda gera lista');
{
  const mes = { aba: 'NOVEMBRO', grade: null };
  const dim = mkBase('BEL', [[30, 'ASG LIMPEZA I', 6], [5, 'ASG LIMPEZA I', 3]]);
  const L = X.montarLista(dim, mes, CATALOGO, null, null);
  eq(L.grade, false, 'o painel sabe que não achou a grade');
  eq(L.linhas.length, 2, 'e monta a lista direto do dimensionamento');
  eq(L.novas.length, 2, 'tudo entra como linha nova');
  eq(L.linhas[0].chMes, 180, 'com CH mensal no padrão de 30 dias quando não há de onde aprender');
  ok(L.linhas.every((l) => l.noturno === 0), 'e noturno zero em todas — nada a copiar');
}

/* ============================================== 21. leitura real */
sec('21. Leitura dos arquivos (.xlsx)');
{
  const fs = require('fs');
  const dir = path.join(__dirname, 'fixtures');
  const fd = path.join(dir, 'dimensionamento.xlsx'), fo = path.join(dir, 'opex.xlsx');
  if (!fs.existsSync(fd) || !fs.existsSync(fo)) {
    console.log('   \x1b[33mPULADO\x1b[0m — ponha dimensionamento.xlsx e opex.xlsx em testes/fixtures/ para exercitar a leitura.');
    resumo();
  } else {
    const ler = (f) => { const b = fs.readFileSync(f); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); };
    Promise.all([X.lerDimensionamento(ler(fd)), X.lerOpex(ler(fo))]).then(([dim, opex]) => {
      ok(dim.bases.length > 0, 'achou pelo menos uma base no dimensionamento (' + dim.bases.length + ')');
      ok(dim.bases.every((b) => b.staff.length > 0), 'todas com tabela de staff');
      ok(dim.bases.every((b) => b.total === b.staff.reduce((s, x) => s + x.qtd, 0)), 'o total de cada base fecha com as linhas');
      ok(opex.catalogo.size > 50, 'o catálogo de cargos foi lido (' + opex.catalogo.size + ')');
      ok(opex.meses.length > 0, 'e os meses (' + opex.meses.map((m) => m.aba).join(', ') + ')');
      const s = X.sincronizar(dim, [opex], null);
      ok(s.comparacoes.length > 0, 'a sincronização encontrou par para pelo menos uma base');
      const c = s.comparacoes[0];
      perto(c.totais.dimQtd + c.totais.pendQtd, c.totais.dimArquivo, 'conferido + pendente = total do arquivo', 0.01);
      resumo();
    }).catch((e) => { ok(false, 'leitura falhou: ' + e.message); resumo(); });
  }
}

function resumo() {
  console.log('\n' + '─'.repeat(58));
  if (!fail) console.log('\x1b[32m✓ ' + pass + ' verificações passaram\x1b[0m');
  else { console.log('\x1b[31m✗ ' + fail + ' falha(s) de ' + (pass + fail) + '\x1b[0m'); falhas.forEach((f, i) => console.log('  ' + (i + 1) + '. ' + f)); }
  console.log('─'.repeat(58));
  process.exit(fail ? 1 : 0);
}
