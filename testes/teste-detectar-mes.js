/* =====================================================================
   teste-detectar-mes.js — o mês do dimensionamento vem do arquivo

   O Gerador pedia o mês num seletor cujo padrão era o PRÓXIMO mês. Em
   novembro isso significa dezembro, então um arquivo de novembro era
   salvo como dezembro — e a Escala Capacity de novembro ficava sem malha
   enquanto a de dezembro recebia horários que ninguém pediu.

   O sintoma aparecia longe da causa: "horários que não existem no
   dimensionamento". Levou várias rodadas até chegar aqui, porque tudo
   funcionava — só que no mês errado.

   O arquivo sempre soube a resposta: traz "Período" com a primeira data
   do mês e "pior semana" no formato 2026-11 {24 a 30}.

   Rodar:  node testes/teste-detectar-mes.js
   (precisa do xlsx: npm install xlsx)
   ===================================================================== */

'use strict';

const path = require('path');
const fs = require('fs');

let XLSX;
try {
  XLSX = require('xlsx');
} catch (_) {
  console.log('PULADO  teste de detecção de mês — rode "npm install xlsx" nesta pasta.');
  process.exit(0);
}

const BASE = path.join(__dirname, '..');
let pass = 0, fail = 0;
const falhas = [];
const ok = (c, m) => { if (c) pass++; else { fail++; falhas.push(m); console.log('   \x1b[31m✗\x1b[0m ' + m); } };
const eq = (a, b, m) => ok(a === b, m + '  (esperado ' + JSON.stringify(b) + ', veio ' + JSON.stringify(a) + ')');
const sec = (t) => console.log('\n\x1b[36m── ' + t + '\x1b[0m');

// Carrega detectMes no escopo deste processo, com XLSX disponível.
const fonte = fs.readFileSync(path.join(BASE, 'js', 'helpers.js'), 'utf8');
const ini = fonte.indexOf('function detectMes(wb)');
const fim = fonte.indexOf('function detectBase(wb)');
const detectMes = new Function('XLSX', fonte.slice(ini, fim) + '\nreturn detectMes;')(XLSX);

/* Monta uma planilha com a mesma forma da real: rótulo na coluna B,
   valor na C, nas primeiras linhas. */
function planilha(linhas, opcoes = {}) {
  const ws = XLSX.utils.aoa_to_sheet(linhas);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, opcoes.nome || 'LIMPEZA');
  if (opcoes.date1904) wb.Workbook = { WBProps: { date1904: true } };
  return wb;
}

// Serial de uma data, nos dois sistemas de data do Excel.
const serial = (iso, d1904) => {
  const d = new Date(iso + 'T00:00:00Z');
  return Math.round(d.getTime() / 86400000) + 25569 - (d1904 ? 1462 : 0);
};

(function () {
  sec('1. "Período" é a fonte preferida');
  {
    // Como na planilha real: Base/GRU, Período/01-11-2026.
    const wb = planilha([
      [null, 'Base', 'GRU'],
      [null, 'Período', serial('2026-11-01', false)],
      [null, 'Cliente', 'ALL'],
    ]);
    eq(detectMes(wb), '2026-11', 'lê o mês do campo Período, em serial do Excel');

    const texto = planilha([
      [null, 'Base', 'GRU'],
      [null, 'Período', '01/11/2026'],
    ]);
    eq(detectMes(texto), '2026-11', 'e também quando a data vem como texto dd/mm/aaaa');

    const data = planilha([
      [null, 'Base', 'GRU'],
      [null, 'Período', new Date(2026, 10, 1)],
    ]);
    eq(detectMes(data), '2026-11', 'e quando o leitor já converteu para data');
  }

  sec('2. "pior semana" serve de reserva');
  {
    const wb = planilha([
      [null, 'Base', 'GRU'],
      [null, 'Cliente', 'ALL'],
      [null, 'pior semana', '2026-11 {24 a 30}'],
    ]);
    eq(detectMes(wb), '2026-11', 'sem Período, o mês sai da pior semana');
  }

  sec('3. O sistema de datas de 1904 não passa batido');
  {
    /* Esta armadilha já custou uma entrega inteira nesta conversa: no
       sistema de 1904 as seriais ficam 1462 dias à frente, e um arquivo
       feito no Excel para Mac devolveria o mês errado sem dar sinal
       nenhum. Dezembro/2026 viraria dezembro/2030. */
    const wb = planilha([
      [null, 'Base', 'GRU'],
      [null, 'Período', serial('2026-11-01', true)],
    ], { date1904: true });
    eq(detectMes(wb), '2026-11', 'arquivo em 1904 devolve o mês certo');

    // E o mesmo número, lido como 1900, daria outro mês — é o erro evitado.
    const comoSe1900 = planilha([
      [null, 'Base', 'GRU'],
      [null, 'Período', serial('2026-11-01', true)],
    ]);
    ok(detectMes(comoSe1900) !== '2026-11',
      'o mesmo número lido no sistema errado dá outro mês: ' + detectMes(comoSe1900));
  }

  sec('4. Quando o arquivo não diz, não inventa');
  {
    const wb = planilha([
      [null, 'Base', 'GRU'],
      [null, 'Cliente', 'ALL'],
    ]);
    eq(detectMes(wb), null, 'sem período no arquivo, devolve nada em vez de chutar');
    eq(detectMes(null), null, 'e sem arquivo também');

    /* Número que não é data não pode virar mês. A planilha tem muitos
       números nessas linhas — quantidades, contagens. */
    const ruido = planilha([
      [null, 'Período', 318],
      [null, 'Base', 'GRU'],
    ]);
    eq(detectMes(ruido), null, 'número fora da faixa de datas é ignorado');
  }

  sec('5. O valor pode não estar na célula vizinha');
  {
    // Célula mesclada empurra o valor duas colunas à frente.
    const wb = planilha([
      [null, 'Período', null, '01/11/2026'],
    ]);
    eq(detectMes(wb), '2026-11', 'acha o valor algumas células à frente do rótulo');

    const abaixo = planilha([
      [null, 'Período', null],
      [null, null, '01/11/2026'],
    ]);
    eq(detectMes(abaixo), '2026-11', 'e também na linha de baixo, como em rótulo alto');
  }

  sec('6. Procura em qualquer aba');
  {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([[null, 'nada']]), 'TABELAS');
    XLSX.utils.book_append_sheet(wb,
      XLSX.utils.aoa_to_sheet([[null, 'Período', '01/11/2026']]), 'LIMPEZA');
    eq(detectMes(wb), '2026-11', 'a primeira aba sem período não interrompe a busca');
  }

  console.log('\n' + '─'.repeat(58));
  if (!fail) console.log('\x1b[32m✓ ' + pass + ' verificações passaram\x1b[0m');
  else { console.log('\x1b[31m✗ ' + fail + ' falha(s) de ' + (pass + fail) + '\x1b[0m'); falhas.forEach((f, i) => console.log('  ' + (i + 1) + '. ' + f)); }
  console.log('─'.repeat(58));
  process.exit(fail ? 1 : 0);
})();
