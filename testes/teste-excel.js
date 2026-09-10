// Ida e volta pro Excel. Exporta a escala, mexe na planilha como um
// usuário faria, importa de volta e confere que o painel ficou igual ao
// que estava no arquivo. É o teste que garante que o arquivo continua
// reconhecível na volta — o risco real dessa funcionalidade.
const fs = require('fs');
const vm = require('vm');
const XLSX = require('xlsx');

const noop = () => {};
let ultimaMensagem = null;
let confirmarSempre = true;
const gravados = [];
const apagados = [];

// Supabase de mentira: registra o que seria escrito, sem banco.
const fakeDb = {
  from() {
    return {
      upsert: async (linhas) => { gravados.push(...linhas); return { error: null }; },
      delete() {
        // A cadeia real é .delete().eq().eq()...  e só então aguardada.
        // Cada .eq precisa devolver O MESMO objeto aguardável, senão o
        // await final cai num objeto sem .then e o delete some silencioso.
        const filtro = {};
        const alvo = {
          eq(col, val) { filtro[col] = val; return alvo; },
          then(resolve) { apagados.push({ ...filtro }); resolve({ error: null }); },
        };
        return alvo;
      },
    };
  },
};

const sandbox = {
  console: { log: noop, warn: noop, error: console.error },
  Date, Math, JSON, Map, Set, Array, String, Number, Object, Intl, RegExp, Proxy,
  setTimeout, clearTimeout, addEventListener: noop, removeEventListener: noop,
  document: { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], addEventListener: noop },
  localStorage: { getItem: () => null, setItem: noop },
  XLSX, db: fakeDb,
  confirm: () => confirmarSempre,
  alert: noop,
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(`var currentUserProfile={id:'u1'};var currentUser={id:'u1'};var pontoHorarios=new Map();
  function adhMonthLabel(m){return m;} function hcAllBases(){return['BEL'];} function navigateTo(){}`, sandbox);
vm.runInContext(fs.readFileSync(__dirname + '/../js/escala.js', 'utf8'), sandbox);

// Captura as mensagens exibidas ao usuário.
sandbox.escalaMsg = (t, n) => { ultimaMensagem = { texto: String(t), nivel: n }; };
sandbox.escalaGradeAtualiza = noop;
sandbox.escalaMostrarLoading = noop;
sandbox.escalaLoadingAtualiza = noop;
sandbox.escalaVerificarTravada = () => false;

const ANO = 2026, MES = 10, DIAS = 31;
const colabs = [
  { matricula: '160580', nome: 'FABIO AUGUSTO', entrada_manual: '10:00' },
  { matricula: '160980', nome: 'LAERCIO DOUGLAS', entrada_manual: '11:00' },
  { matricula: '160224', nome: 'MAURO GAMA', entrada_manual: '22:00' },
];
const eoColabs = new Map(colabs.map(c => [c.matricula,
  { nome: c.nome, funcao: 'SUPERVISOR DE OPERAÇÕES I', ch: '210', station: 'BEL' }]));

Object.assign(sandbox.window, {
  _escalaBase: 'BEL', _escalaMes: '2026-10', _escalaColabs: colabs,
  _escalaDias: new Map([
    ['160580|4', { status: 'F' }],
    ['160580|11', { status: 'F' }],
    ['160980|4', { status: 'F' }],
  ]),
  _escalaFeriados: new Map(), _escalaTravada: false,
  eoColabs, eoFerias: new Map(), eoFeriasAll: [],
});

let ok = true;
const check = (nome, cond, detalhe) => {
  console.log(`${cond ? 'PASSOU' : 'FALHOU'}  ${nome}${detalhe ? ` · ${detalhe}` : ''}`);
  ok &= cond;
};

// ── Exportação ──────────────────────────────────────────────────────
let arquivoGerado = null;
sandbox.XLSX = { ...XLSX, writeFile: (wb) => { arquivoGerado = wb; } };
vm.runInContext('XLSX = window.XLSX;', sandbox);
sandbox.escalaExportarExcel();

check('exportou um arquivo', !!arquivoGerado);
check('tem as três abas esperadas',
  arquivoGerado && ['ESCALA', 'CONFERÊNCIA', 'INSTRUÇÕES'].every(n => arquivoGerado.SheetNames.includes(n)),
  arquivoGerado ? arquivoGerado.SheetNames.join(', ') : '');

const linhas = XLSX.utils.sheet_to_json(arquivoGerado.Sheets['ESCALA'], { header: 1, defval: null, raw: false });
check('linha 1 identifica base e mês',
  String(linhas[0][0]).startsWith('#ESCALA-ONLINE') && linhas[0][1] === 'BEL' && linhas[0][2] === '2026-10',
  linhas[0].slice(0, 3).join(' | '));
check('cabeçalho começa em MATRÍCULA', String(linhas[2][0]).toUpperCase().startsWith('MATR'));
check('tem uma coluna por dia do mês',
  linhas[2].length === 8 + DIAS, `${linhas[2].length} colunas`);
check('as folgas existentes vieram preenchidas',
  linhas[3][8 + 3] === 'F' && linhas[3][8 + 10] === 'F',
  `dia 4=${linhas[3][11]} dia 11=${linhas[3][18]}`);
check('dia trabalhado veio vazio', !linhas[3][8 + 5]);
check('a aba de conferência usa fórmula, não valor fixo', (() => {
  const c = arquivoGerado.Sheets['CONFERÊNCIA'];
  return Object.keys(c).some(k => c[k] && c[k].f && /COUNTBLANK/.test(c[k].f));
})());

// ── Edição, como um usuário faria no Excel ──────────────────────────
const ws = arquivoGerado.Sheets['ESCALA'];
const setCel = (linha, col, valor) => {
  const ref = XLSX.utils.encode_cell({ r: linha, c: col });
  ws[ref] = { t: 's', v: valor };
};
setCel(3, 8 + 17, 'F');    // FABIO ganha folga no dia 18
setCel(4, 8 + 3, '');      // LAERCIO perde a folga do dia 4
setCel(5, 8 + 3, 'F');     // MAURO ganha folga no domingo 4
setCel(5, 8 + 2, 'FA');    // e FA no sábado 3 (par válido)
setCel(3, 8 + 6, 'ZZ');    // código inválido, tem que ser ignorado

// ── Importação de volta ─────────────────────────────────────────────
(async () => {
  await sandbox.escalaAplicarImportacao(arquivoGerado);

  const gravou = (mat, dia, status) => gravados.some(g =>
    g.matricula === mat && Number(g.dia) === dia && g.status === status);
  const apagou = (mat, dia) => apagados.some(a =>
    a.matricula === mat && Number(a.dia) === dia);

  check('gravou a folga nova do FABIO', gravou('160580', 18, 'F'));
  check('gravou a FA do MAURO no sábado', gravou('160224', 3, 'FA'));
  check('gravou o domingo do MAURO', gravou('160224', 4, 'F'));
  check('apagou a folga removida do LAERCIO', apagou('160980', 4));
  check('não mexeu no que não mudou', !gravou('160580', 4, 'F') && !gravou('160580', 11, 'F'));
  check('ignorou o código inválido', !gravados.some(g => g.status === 'ZZ'));
  check('marcou a origem como excel', gravados.every(g => g.origem === 'excel'));

  // ── Rejeições ─────────────────────────────────────────────────────
  const wbOutroMes = XLSX.read(XLSX.write(arquivoGerado, { type: 'array', bookType: 'xlsx' }), { type: 'array' });
  wbOutroMes.Sheets['ESCALA']['C1'] = { t: 's', v: '2026-11' };
  await sandbox.escalaAplicarImportacao(wbOutroMes);
  check('recusa arquivo de outro mês', /base|mês|mes/i.test(ultimaMensagem.texto) && ultimaMensagem.nivel === true,
    ultimaMensagem.texto.slice(0, 60));

  const wbSemMarca = XLSX.read(XLSX.write(arquivoGerado, { type: 'array', bookType: 'xlsx' }), { type: 'array' });
  wbSemMarca.Sheets['ESCALA']['A1'] = { t: 's', v: 'planilha qualquer' };
  await sandbox.escalaAplicarImportacao(wbSemMarca);
  check('recusa arquivo que não saiu do painel', /não parece ter saído/i.test(ultimaMensagem.texto));

  const wbSemAba = { SheetNames: ['Plan1'], Sheets: { Plan1: XLSX.utils.aoa_to_sheet([['x']]) } };
  await sandbox.escalaAplicarImportacao(wbSemAba);
  check('recusa arquivo sem a aba ESCALA', /aba "ESCALA"/i.test(ultimaMensagem.texto));

  // Cancelar não pode gravar nada. Precisa haver diferença de verdade,
  // senão a importação nem chega a perguntar — sai por "nada mudou".
  const wbComMudanca = XLSX.read(XLSX.write(arquivoGerado, { type: 'array', bookType: 'xlsx' }), { type: 'array' });
  wbComMudanca.Sheets['ESCALA'][XLSX.utils.encode_cell({ r: 3, c: 8 + 24 })] = { t: 's', v: 'F' };
  const antesGrav = gravados.length, antesApag = apagados.length;
  confirmarSempre = false;
  await sandbox.escalaAplicarImportacao(wbComMudanca);
  check('cancelar não grava nem apaga nada',
    gravados.length === antesGrav && apagados.length === antesApag && /cancelada/i.test(ultimaMensagem.texto),
    ultimaMensagem.texto.slice(0, 40));
  confirmarSempre = true;

  process.exit(ok ? 0 : 1);
})();
