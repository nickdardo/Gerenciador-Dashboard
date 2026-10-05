/* =====================================================================
   teste-dp.js — exportação da escala para o sistema do DP

   O DP recebe um número por pessoa por dia. A planilha que faz essa
   tradução hoje entrega dado errado sem ninguém ver: na base BEL de
   outubro, 15 pessoas saem com #N/D nos 31 dias, a coluna de horas está
   com #VALOR! em todas as 262 linhas, e a folga agrupada diverge em 43
   pessoas entre a aba de controle e a matriz enviada.

   O que está sob teste é justamente o que a planilha não faz: quando o
   painel não consegue resolver uma célula, ele REPORTA em vez de gravar
   um erro. Um código inventado o DP aceitaria calado.

   Rodar:  node testes/teste-dp.js
   ===================================================================== */

'use strict';

const path = require('path');
const fs = require('fs');

// O módulo usa o SheetJS pelo escopo global, como no navegador.
try { globalThis.XLSX = require(path.join(__dirname, '..', 'node_modules', 'xlsx')); }
catch (_) { try { globalThis.XLSX = require('xlsx'); } catch (_2) { globalThis.XLSX = null; } }
const DP = require(path.join(__dirname, '..', 'js', 'dp.js'));

let pass = 0, fail = 0;
const falhas = [];
const ok = (c, m) => { if (c) pass++; else { fail++; falhas.push(m); console.log('   \x1b[31m✗\x1b[0m ' + m); } };
const eq = (a, b, m) => ok(a === b, m + '  (esperado ' + JSON.stringify(b) + ', veio ' + JSON.stringify(a) + ')');
const sec = (t) => console.log('\n\x1b[36m── ' + t + '\x1b[0m');

/* ------------------------------------------------------- catálogo falso
   Reproduz a forma do arquivo real: horários com entrada/saída, turnos
   A–D com código, cadastro com número de escala. */
const mkCat = (over) => Object.assign({
  horarios: {
    porCodigo: new Map([
      ['57',  { codigo: '57',  entrada: '11:00', saida: '17:00', horas: 6, faixa: '11:00 - 17:00 (6h)' }],
      ['123', { codigo: '123', entrada: '22:00', saida: '04:00', horas: 6, faixa: '22:00 - 04:00 (6h)' }],
      ['364', { codigo: '364', entrada: '15:30', saida: '21:30', horas: 6, faixa: '15:30 - 21:30 (6h)' }],
      ['7',   { codigo: '7',   entrada: '13:00', saida: '17:00', horas: 4, faixa: '13:00 - 17:00 (4h)' }],
      ['99',  { codigo: '99',  entrada: '13:00', saida: '16:00', horas: 3, faixa: '13:00 - 16:00 (3h)' }],
    ]),
    porFaixa: new Map([
      ['11:00-17:00', { codigo: '57',  entrada: '11:00', saida: '17:00', horas: 6, faixa: '11:00 - 17:00 (6h)' }],
      ['22:00-04:00', { codigo: '123', entrada: '22:00', saida: '04:00', horas: 6, faixa: '22:00 - 04:00 (6h)' }],
      ['15:30-21:30', { codigo: '364', entrada: '15:30', saida: '21:30', horas: 6, faixa: '15:30 - 21:30 (6h)' }],
      ['13:00-17:00', { codigo: '7',   entrada: '13:00', saida: '17:00', horas: 4, faixa: '13:00 - 17:00 (4h)' }],
      ['13:00-16:00', { codigo: '99',  entrada: '13:00', saida: '16:00', horas: 3, faixa: '13:00 - 16:00 (3h)' }],
    ]),
  },
  turnos: { porSigla: new Map([['C1', { sigla: 'C1', faixa: '11:00 - 17:00 (6h)', codigo: '57' }]]),
            porCodigo: new Map([['57', 'C1'], ['123', 'D17'], ['364', 'C17']]) },
  cadastro: new Map([
    ['160010', { matricula: '160010', nome: 'FULANO DA SILVA', escala: '2385', turno: 'C1', ch: 6 }],
    ['160028', { matricula: '160028', nome: 'BELTRANO SOUZA',  escala: '1253', turno: '',   ch: 6 }],
  ]),
  cargos: new Map(), feriados: [], codigos: DP.codigosPadrao(), avisos: [],
  resumo: { horarios: 5, faixas: 5, turnos: 1, pessoas: 2, comEscala: 2, comTurno: 1, cargos: 0, feriados: 0 },
}, over || {});

const dias = (n, f) => Array.from({ length: n }, (_, i) => f(i + 1) || '');

/* ============================================== 1. horas */
sec('1. Leitura de hora — o Excel guarda hora como fração do dia');
{
  eq(DP.hhmm('08:30'), '08:30', 'texto normal');
  eq(DP.hhmm('8:30'), '08:30', 'uma casa na hora vira duas');
  eq(DP.hhmm('08:30:00'), '08:30', 'com segundos');
  // 0,354166… é como "08:30" chega quando a célula é lida crua
  eq(DP.hhmm(0.3541666666666667), '08:30', 'fração do dia do Excel vira hora');
  eq(DP.hhmm(0), '00:00', 'meia-noite');
  eq(DP.hhmm(0.5), '12:00', 'meio-dia');
  eq(DP.hhmm(''), null, 'vazio é nulo');
  eq(DP.hhmm('25:00'), null, 'hora impossível é recusada, não arredondada');
  eq(DP.hhmm(null), null, 'nulo é nulo');
}

sec('2. Código do DP — às vezes número, às vezes texto');
{
  eq(DP.codigoTxt(57), '57', 'número puro');
  eq(DP.codigoTxt(57.0), '57', 'número com casa zero não vira "57.0"');
  eq(DP.codigoTxt('9996'), '9996', 'texto passa direto');
  eq(DP.codigoTxt('9996.0'), '9996', 'texto com casa zero também normaliza');
  eq(DP.codigoTxt(''), '', 'vazio');
  ok(DP.codigoTxt(57) === DP.codigoTxt('57.0'), 'as duas formas do mesmo código são iguais — senão ele contaria duas vezes');
}

/* ============================================== 3. horário → código */
sec('3. Achar o código do horário');
{
  const cat = mkCat();
  const a = DP.acharCodigo('11:00', '17:00', cat);
  eq(a.codigo, '57', 'horário idêntico acha o código');
  eq(a.confianca, 'alta', 'com confiança alta');

  const b = DP.acharCodigo('22:00', '04:00', cat);
  eq(b.codigo, '123', 'turno que vira o dia também');

  // O painel calcula a saída pela CH; o DP pode ter arredondado diferente.
  const c = DP.acharCodigo('15:30', '21:00', cat);
  eq(c.codigo, '364', 'saída diferente ainda casa quando a entrada é única');
  eq(c.confianca, 'média', 'mas com confiança média, para você conferir');

  // 13:00 existe em dois códigos (4h e 3h) — chutar seria pior que parar
  const d = DP.acharCodigo('13:00', '18:00', cat);
  eq(d.codigo, null, 'entrada que existe em dois códigos não é chutada');
  eq(d.via, 'ambíguo', 'é marcada como ambígua');
  eq(d.opcoes.length, 2, 'e as duas opções são oferecidas');

  const e = DP.acharCodigo('03:33', '09:33', cat);
  eq(e.codigo, null, 'horário que não existe no catálogo não inventa código');
  eq(e.via, 'fora do catálogo', 'e diz o motivo');

  eq(DP.acharCodigo('', '', cat).via, 'sem horário no painel', 'sem horário, o motivo é outro');
}

/* ============================================== 4. a matriz */
sec('4. A matriz no layout que o DP recebe');
{
  const cat = mkCat();
  const pessoas = [{
    matricula: '160010', nome: 'FULANO DA SILVA', entrada: '11:00', saida: '17:00', ch: 6,
    // 31 dias: folga nos dias 5 e 12, folga agrupada no 19, resto trabalha
    dias: dias(31, (d) => (d === 5 || d === 12 ? 'F' : d === 19 ? 'FA' : '')),
  }];
  const r = DP.montarMatrizDP(pessoas, cat, { ano: 2026, mes: 10, base: 'BEL' });

  eq(r.cabecalho[0], 'MATRICULA', 'a primeira coluna é a matrícula');
  eq(r.cabecalho[2], 'ESCALA', 'a terceira é o número de escala');
  eq(r.cabecalho[4], 'D1', 'depois começam os pares de dia e código');
  eq(r.cabecalho[5], 'C1', 'data e código, lado a lado');
  eq(r.cabecalho.length, 4 + 62 + 9, 'ao todo 75 colunas, como o arquivo de hoje');
  eq(r.cabecalho[r.cabecalho.length - 1], 'MATPER', 'e a última é a chave do período');

  const l = r.linhas[0];
  eq(l[2], '2385', 'o número de escala veio do cadastro do DP');
  eq(l[3], 'C1', 'e o turno também');
  // 1/10/2026 = serial 46296, como no arquivo real
  eq(l[4], 46296, 'a data do dia 1 sai como serial do Excel');
  eq(l[5], '57', 'o dia 1 é trabalhado, com o código do horário');
  eq(l[4 + 2 * 4], 46300, 'a data do dia 5');
  eq(l[5 + 2 * 4], '9996', 'e o dia 5 é folga');
  eq(l[5 + 2 * 18], '9998', 'o dia 19 é folga agrupada — código próprio');

  const i = 4 + 62;
  eq(l[i], 3, 'conta 3 folgas (duas F e uma FA)');
  eq(l[i + 1], 28, 'e 28 dias trabalhados');
  eq(l[i + 2], 168, 'as horas são dias × CH — a coluna que hoje sai com #VALOR!');
  eq(l[i + 3], 'BEL', 'base');
  eq(l[i + 4], 'OUTUBRO', 'mês por extenso, como o DP espera');
  eq(l[i + 5], 2026, 'ano');
  eq(l[i + 6], '11:00 - 17:00 (6h)', 'a faixa do horário, escrita como no catálogo');
  eq(l[i + 7], 'FA', 'a marca de folga agrupada do mês');
  eq(l[i + 8], '160010OUTUBRO2026', 'e a chave matrícula+período');

  eq(r.resumo.vazias, 0, 'nenhuma célula ficou em branco');
  eq(r.resumo.completo, 100, 'a matriz saiu 100% preenchida');
}

sec('5. Fevereiro tem 28 dias, e a matriz acompanha');
{
  const cat = mkCat();
  const r = DP.montarMatrizDP(
    [{ matricula: '160010', nome: 'X', entrada: '11:00', saida: '17:00', ch: 6, dias: dias(28, () => '') }],
    cat, { ano: 2026, mes: 2, base: 'BEL' });
  eq(r.diasNoMes, 28, 'fevereiro de 2026 tem 28 dias');
  eq(r.cabecalho.length, 4 + 56 + 9, 'e a matriz tem 56 colunas de dia, não 62');
  eq(r.linhas[0][4 + 56], 0, 'nenhuma folga');
  eq(r.linhas[0][4 + 56 + 1], 28, 'e 28 dias trabalhados');
}

/* ============================================== 6. o que não dá para resolver */
sec('6. O que não dá para resolver é reportado, nunca inventado');
{
  const cat = mkCat();
  const pessoas = [
    // sem número de escala no cadastro do DP
    { matricula: '999999', nome: 'SEM CADASTRO', entrada: '11:00', saida: '17:00', ch: 6, dias: dias(31, () => '') },
    // horário que não existe no catálogo
    { matricula: '160028', nome: 'BELTRANO SOUZA', entrada: '03:33', saida: '09:33', ch: 6, dias: dias(31, () => '') },
    // status de curso, que ainda não tem código conhecido
    { matricula: '160010', nome: 'FULANO DA SILVA', entrada: '11:00', saida: '17:00', ch: 6,
      dias: dias(31, (d) => (d === 7 ? 'K' : '')) },
  ];
  const r = DP.montarMatrizDP(pessoas, cat, { ano: 2026, mes: 10, base: 'BEL' });

  eq(r.pendencias.semEscala.length, 1, 'a pessoa sem cadastro no DP é apontada');
  eq(r.pendencias.semEscala[0].matricula, '999999', 'com a matrícula dela');
  eq(r.pendencias.semCodigo.length, 1, 'o horário fora do catálogo é apontado');
  eq(r.pendencias.semCodigo[0].entrada, '03:33', 'com o horário que não casou');

  eq(r.pendencias.semStatus.length, 1, 'o status sem código conhecido é apontado uma vez');
  eq(r.pendencias.semStatus[0].status, 'K', 'e é o curso');
  eq(r.pendencias.semStatus[0].rotulo, 'Curso', 'com o nome que a legenda do DP usa');

  // O que importa: a célula sai VAZIA, não com um número qualquer.
  const lk = r.linhas.find((x) => x[0] === '160010');
  eq(lk[5 + 2 * 6], '', 'o dia de curso sai em branco em vez de um código inventado');
  const lsem = r.linhas.find((x) => x[0] === '160028');
  eq(lsem[5], '', 'e o dia da pessoa sem código de horário também');
  ok(r.resumo.vazias === 32, 'as 32 células não resolvidas são contadas (' + r.resumo.vazias + ')');
  ok(r.resumo.completo < 100, 'e o resumo não diz que está completo: ' + r.resumo.completo + '%');
}

sec('7. Ambiguidade de horário não vira escolha silenciosa');
{
  const cat = mkCat();
  const r = DP.montarMatrizDP(
    [{ matricula: '160010', nome: 'X', entrada: '13:00', saida: '18:00', ch: 5, dias: dias(31, () => '') }],
    cat, { ano: 2026, mes: 10, base: 'BEL' });
  eq(r.pendencias.ambiguos.length, 1, 'a entrada que existe em dois códigos vira pendência');
  eq(r.pendencias.ambiguos[0].opcoes.length, 2, 'com as duas opções à mostra');
  eq(r.linhas[0][5], '', 'e nenhum dos dois é gravado por conta própria');
}

sec('8. Os códigos de ausência podem ser corrigidos sem mexer no código');
{
  const cat = mkCat();
  const r = DP.montarMatrizDP(
    [{ matricula: '160010', nome: 'X', entrada: '11:00', saida: '17:00', ch: 6,
       dias: dias(31, (d) => (d === 7 ? 'K' : '')) }],
    cat, { ano: 2026, mes: 10, base: 'BEL', codigos: { K: { codigo: '7777', rotulo: 'Curso' } } });
  eq(r.linhas[0][5 + 2 * 6], '7777', 'informado o código do curso, ele passa a sair na célula');
  eq(r.pendencias.semStatus.length, 0, 'e some do relatório de pendências');
}

sec('9. Os códigos deduzidos do arquivo real');
{
  const c = DP.codigosPadrao();
  eq(c.F.codigo, '9996', 'folga regulamentar');
  eq(c.FA.codigo, '9998', 'folga agrupada');
  eq(c.L.codigo, '8886', 'férias');
  eq(c.J.codigo, '8883', 'afastamento');
  eq(c.K.codigo, null, 'curso fica nulo — outubro não teve nenhum caso para deduzir');
  eq(c.M.codigo, null, 'licença idem');
  eq(c.CH.codigo, null, 'compensação idem');
  ok(/confirmar com o DP/.test(c.K.origem), 'e o painel diz que falta confirmar, em vez de fingir que sabe');
  // Mexer no retorno não pode contaminar a próxima chamada.
  c.F.codigo = 'XXX';
  eq(DP.codigosPadrao().F.codigo, '9996', 'cada chamada devolve uma cópia nova');
}

sec('9b. Quem troca de horário no meio do mês');
{
  const cat = mkCat();
  // 221 das 262 pessoas do arquivo real usam um horário só; as outras trocam.
  const r = DP.montarMatrizDP([{
    matricula: '160010', nome: 'X', entrada: '11:00', saida: '17:00', ch: 6,
    dias: dias(31, () => ''),
    diasHorario: dias(31, (d) => (d <= 15 ? { entrada: '11:00', saida: '17:00' } : { entrada: '22:00', saida: '04:00' })),
  }], cat, { ano: 2026, mes: 10, base: 'BEL' });
  eq(r.linhas[0][5], '57', 'o dia 1 usa o horário da primeira quinzena');
  eq(r.linhas[0][5 + 2 * 20], '123', 'e o dia 21 já usa o da segunda');
  eq(r.linhas[0][4 + 62 + 1], 31, 'todos os 31 dias contam como trabalhados');
  eq(r.pendencias.semCodigo.length, 0, 'sem pendência — os dois horários existem no catálogo');
}

/* ============================================== 10. leitura do arquivo */
sec('10. Leitura de um arquivo do DP');
{
  const dir = path.join(__dirname, 'fixtures');
  const alvo = fs.existsSync(dir)
    ? fs.readdirSync(dir).filter((f) => /\.(xlsb|xlsx)$/i.test(f) && /escala/i.test(f))[0]
    : null;
  if (!globalThis.XLSX) {
    console.log('   \x1b[33mPULADO\x1b[0m — rode "npm install xlsx" nesta pasta para exercitar a leitura.');
  } else if (!alvo) {
    console.log('   \x1b[33mPULADO\x1b[0m — ponha a escala do DP (.xlsb) em testes/fixtures/ para exercitar a leitura.');
  } else {
    const b = fs.readFileSync(path.join(dir, alvo));
    const cat = DP.lerCatalogoDP(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
    ok(cat.resumo.horarios > 100, 'leu a tabela de horários (' + cat.resumo.horarios + ' códigos)');
    ok(cat.resumo.faixas > 100, 'com faixas distintas de entrada/saída (' + cat.resumo.faixas + ')');
    ok(cat.resumo.turnos > 20, 'leu o catálogo de turnos (' + cat.resumo.turnos + ')');
    ok(cat.resumo.pessoas > 100, 'leu o cadastro (' + cat.resumo.pessoas + ' pessoas)');
    ok(cat.resumo.comEscala > 100, 'com número de escala (' + cat.resumo.comEscala + ')');
    const h = [...cat.horarios.porCodigo.values()][0];
    ok(/^\d{2}:\d{2}$/.test(h.entrada) && /^\d{2}:\d{2}$/.test(h.saida), 'e as horas saíram no formato certo: ' + h.entrada + '-' + h.saida);
    ok(DP.oQueImportar(cat).every((x) => typeof x.n === 'number'), 'o resumo do que importar está completo');
  }
}

console.log('\n' + '─'.repeat(58));
if (!fail) console.log('\x1b[32m✓ ' + pass + ' verificações passaram\x1b[0m');
else { console.log('\x1b[31m✗ ' + fail + ' falha(s) de ' + (pass + fail) + '\x1b[0m'); falhas.forEach((f, i) => console.log('  ' + (i + 1) + '. ' + f)); }
console.log('─'.repeat(58));
process.exit(fail ? 1 : 0);
