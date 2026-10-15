/* =====================================================================
   teste-folgas-diagnostico.js — o que o Gerador diz quando recusa

   A leitura da planilha tem quatro peneiras: aba visível, linha com os
   dias do mês, mês completo e matrículas abaixo. Todas descartavam em
   silêncio, e no fim sobrava uma frase só — "Nenhuma aba de escala
   encontrada" — que diz o que faltou mas não o que havia no lugar. Quem
   recebia essa frase não tinha como saber se o problema era a data em
   texto, a matrícula em texto, um dia faltando ou a aba oculta.

   Cada caso aqui é um arquivo que falha por um motivo diferente, e o que
   se verifica é se a mensagem aponta o motivo certo — com linha, coluna e
   exemplo. Mensagem genérica aqui é falha de teste.

   Rodar:  node testes/teste-folgas-diagnostico.js
   ===================================================================== */

'use strict';

const path = require('path');
const E = require(path.join(__dirname, '..', 'js', 'folgas-engine.js'));

let pass = 0, fail = 0;
const falhas = [];
const ok = (c, m) => { if (c) pass++; else { fail++; falhas.push(m); console.log('   \x1b[31m✗\x1b[0m ' + m); } };
const sec = (t) => console.log('\n\x1b[36m── ' + t + '\x1b[0m');

/* ------------------------------------------------- fabricação de abas */
const col = (n) => { let s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
// Serial do Excel: dias desde 30/12/1899.
const serial = (y, m, d) => Date.UTC(y, m, d) / 86400000 + 25569;

function aba(nome, preencher, estado) {
  const cells = new Map();
  const set = (r, c, v) => { if (v !== undefined && v !== null && v !== '') cells.set(col(c) + r, v); };
  preencher(set);
  return { name: nome, state: estado || 'visible', path: 'xl/worksheets/' + nome + '.xml', cells };
}

/* Uma aba que o motor lê sem reclamar: 31 dias de outubro/2026 na linha 4,
   a partir da coluna C, e duas pessoas abaixo. Cada caso de erro parte
   desta e estraga exatamente uma coisa. */
function abaBoa(o = {}) {
  const dias = o.dias === undefined ? 31 : o.dias;
  const pularDia = o.pularDia || [];
  const linhaData = o.linhaData || 4;
  return aba(o.nome || 'OPERAÇÃO', (set) => {
    set(linhaData - 1, 2, 'OPERAÇÃO · EXEMPLO');
    let c = 3;
    for (let d = 1; d <= dias; d++) {
      if (pularDia.includes(d)) continue;
      // Dia trocado por uma data de setembro: a coluna continua lá (a
       // linha segue com 31 datas), mas o dia de outubro fica sem coluna.
      const mes = (o.mesAnterior || []).includes(d) ? 8 : 9;
      const v = serial(2026, mes, d);
      set(linhaData, c, o.comoTexto ? String(d).padStart(2, '0') + '/10/2026'
        : o.comoDiaSolto ? d : v);
      c++;
    }
    set(linhaData + 1, 1, 'Matr.'); set(linhaData + 1, 2, 'Nome');
    const pessoas = o.pessoas || [[170107, 'ANA PAULA MOREIRA'], [170222, 'BRUNO SALES']];
    pessoas.forEach(([mat, nome], i) => {
      set(linhaData + 2 + i, 1, mat);
      set(linhaData + 2 + i, 2, nome);
    });
  }, o.estado);
}

const monta = (sheets) => {
  try { return { modelo: E.buildModel({ sheets }), erro: null }; }
  catch (err) { return { modelo: null, erro: err }; }
};
// Todo o texto do diagnóstico, para procurar sem depender da ordem.
const texto = (err) => (err.diagnostico || []).map((d) => d.aba + ' ' + d.motivo + ' ' + d.dica).join(' | ');

/* ===================================================================== */

sec('0. O arquivo certo continua passando — o diagnóstico não atrapalha');
{
  const { modelo, erro } = monta([abaBoa()]);
  ok(!erro, 'a aba boa é lida sem erro' + (erro ? ': ' + erro.message : ''));
  if (modelo) {
    ok(modelo.empCount === 2, 'com as duas pessoas (' + modelo.empCount + ')');
    ok(modelo.month && modelo.month.label === 'outubro/2026', 'e o mês certo (' + (modelo.month || {}).label + ')');
    ok(Array.isArray(modelo.diag) && modelo.diag.length === 0,
      'e sem nada a relatar — arquivo bom não ganha relatório de erro');
  }
}

sec('1. Datas como texto — o caso mais comum');
{
  const { erro } = monta([abaBoa({ comoTexto: true })]);
  ok(!!erro, 'o arquivo é recusado');
  ok(Array.isArray(erro.diagnostico) && erro.diagnostico.length === 1,
    'com uma entrada de diagnóstico por aba');
  const t = texto(erro);
  ok(/como texto/.test(t), 'a mensagem diz que as datas estão como texto');
  ok(/linha 4/.test(t), 'e aponta a linha onde elas estão (' + (t.match(/linha \d+/) || ['—'])[0] + ')');
  ok(/formate como Data/i.test(t), 'dizendo o que fazer no Excel');
  ok(!/Nenhuma aba de escala encontrada/.test(t),
    'sem repetir a frase genérica dentro do item');
}

sec('2. Dias como números soltos, sem mês nem ano');
{
  const { erro } = monta([abaBoa({ comoDiaSolto: true })]);
  const t = texto(erro);
  ok(/n[úu]meros soltos/.test(t), 'a mensagem reconhece os números soltos');
  ok(/linha 4/.test(t), 'e aponta a linha');
  ok(!/como texto/.test(t), 'sem confundir com o caso da data em texto');
}

sec('3. Matrícula como texto');
{
  const { erro } = monta([abaBoa({ pessoas: [['170107', 'ANA PAULA MOREIRA'], ['170222', 'BRUNO SALES']] })]);
  const t = texto(erro);
  ok(/matr[íi]cula como texto/i.test(t), 'a mensagem acusa a matrícula em texto');
  ok(/170107/.test(t), 'e mostra um exemplo do que está na coluna A');
  ok(/2 linhas têm/.test(t), 'dizendo quantas linhas estão assim, sem "linha(s)"');
  ok(!/\(s\)/.test(t), 'e sem plural entre parênteses em lugar nenhum');
  ok(/coluna A como N[úu]mero/i.test(t), 'com o conserto');
  ok(/linha 4/.test(t), 'e confirmando que os dias foram achados');
}

sec('4. Matrícula que não parece matrícula');
{
  const { erro } = monta([abaBoa({ pessoas: [[12, 'ANA PAULA MOREIRA'], [7, 'BRUNO SALES']] })]);
  const t = texto(erro);
  ok(/menor que 1000/.test(t), 'número pequeno demais é apontado como tal');
  ok(!/como texto/.test(t), 'sem culpar o formato, que aqui está certo');
}

sec('5. Matrícula sem nome ao lado');
{
  const { erro } = monta([abaBoa({ pessoas: [[170107, ''], [170222, '']] })]);
  const t = texto(erro);
  ok(/coluna B \(nome\) está vazia/.test(t), 'a falta do nome é dita com todas as letras');
}

sec('6. Mês incompleto — falta coluna de algum dia');
{
  /* Pular a coluna derruba a linha antes desta peneira: com 30 datas ela
     ainda passa, com 23 não chega a ser linha de datas. Por isso o buraco
     aqui é feito trocando o dia por uma data de setembro — a linha
     continua com 31 datas e o dia de outubro é que fica sem coluna. */
  const { erro } = monta([abaBoa({ mesAnterior: [17] })]);
  const t = texto(erro);
  ok(/incompleto/.test(t), 'o mês incompleto é reconhecido');
  ok(/o dia 17\b/.test(t), 'e o dia que ficou sem coluna é nomeado: ' + (t.match(/dias? [0-9,e ]+/) || ["—"])[0].trim());
  ok(/outubro\/2026/.test(t), 'junto do mês de que se fala');
  ok(/31 dias/.test(t), 'e de quantos dias o mês tem');
}
{
  // Vários buracos: a lista não pode virar um parágrafo.
  const { erro } = monta([abaBoa({ mesAnterior: [3, 5, 7, 9, 11, 13, 15, 17] })]);
  const t = texto(erro);
  ok(/e mais 2\b/.test(t),
    'com oito dias faltando, a lista mostra seis e resume o resto: ' + (t.match(/dias? [0-9,e ]+/) || ["—"])[0].trim());
}

sec('7. Linha de datas curta demais');
{
  const { erro } = monta([abaBoa({ dias: 12 })]);
  const t = texto(erro);
  ok(/pelo menos 28/.test(t), 'a tela diz quantos dias são necessários');
  ok(/com 12/.test(t), 'e quantos achou (' + (t.match(/com \d+/) || ['—'])[0] + ')');
}

sec('8. Aba vazia e aba oculta');
{
  const vazia = aba('PLAN1', () => {});
  const oculta = abaBoa({ nome: 'ESCALA REAL', estado: 'hidden' });
  const { erro } = monta([vazia, oculta]);
  ok(!!erro, 'nenhuma das duas serve, então o arquivo é recusado');
  ok(/A aba está vazia/.test(texto(erro)), 'a vazia é relatada como vazia');
  ok(Array.isArray(erro.ocultas) && erro.ocultas.includes('ESCALA REAL'),
    'e a oculta é nomeada à parte — é dado que resolve o caso sozinho');
  ok(!texto(erro).includes('ESCALA REAL'),
    'sem aparecer na lista de abas lidas, porque ela não foi lida');
}

sec('9. Várias abas, motivos diferentes');
{
  const { erro } = monta([
    abaBoa({ nome: 'CGH', comoTexto: true }),
    abaBoa({ nome: 'GIG', pessoas: [['170107', 'ANA']] }),
    abaBoa({ nome: 'SSA', pularDia: [20] }),
  ]);
  ok(erro.diagnostico.length === 3, 'cada aba rende o seu próprio motivo');
  const porAba = Object.fromEntries(erro.diagnostico.map((d) => [d.aba, d.motivo + ' ' + d.dica]));
  ok(/como texto/.test(porAba.CGH), 'CGH: datas em texto');
  ok(/matr[íi]cula como texto/i.test(porAba.GIG), 'GIG: matrícula em texto');
  ok(/incompleto/.test(porAba.SSA), 'SSA: mês incompleto');
  ok(new Set(Object.values(porAba)).size === 3,
    'e os três textos são diferentes — nada de mensagem única repetida');
}

sec('10. Uma aba boa no meio de abas ruins basta');
{
  const { modelo, erro } = monta([
    aba('INSTRUÇÕES', (set) => set(1, 1, 'Leia antes de preencher')),
    abaBoa({ nome: 'CGH' }),
  ]);
  ok(!erro, 'o arquivo é aceito' + (erro ? ': ' + erro.message : ''));
  ok(modelo && modelo.sheets.length === 1, 'com a aba que presta');
  ok(modelo && modelo.diag.length === 1,
    'o motivo da outra fica registrado, mas não vira erro — ninguém precisa ver');
}

console.log('\n' + '─'.repeat(58));
if (!fail) console.log('\x1b[32m✓ ' + pass + ' verificações passaram\x1b[0m');
else { console.log('\x1b[31m✗ ' + fail + ' falha(s) de ' + (pass + fail) + '\x1b[0m'); falhas.forEach((f, i) => console.log('  ' + (i + 1) + '. ' + f)); }
console.log('─'.repeat(58));
process.exit(fail ? 1 : 0);
