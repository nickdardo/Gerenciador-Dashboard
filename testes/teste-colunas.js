// Carrega pages.js num sandbox com o mínimo de stub e conta, linha por
// linha, quantas colunas a tabela realmente emite (respeitando colspan).
// Se alguma linha divergir do cabeçalho, o desalinhamento voltou.
const fs = require('fs');
const vm = require('vm');

const noop = () => {};
const elFalso = {
  style: { setProperty: noop }, classList: { toggle: noop, add: noop, remove: noop, contains: () => false },
  querySelector: () => null, querySelectorAll: () => [], getBoundingClientRect: () => ({ height: 36 }),
  addEventListener: noop, innerHTML: '', textContent: '', dataset: {},
};

const sandbox = {
  console,
  document: { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], addEventListener: noop, body: elFalso },
  window: {},
  setTimeout, clearTimeout, Date, Math, JSON, Intl, Map, Set, Array, String, Number, Object,
  addEventListener: noop, removeEventListener: noop,
  localStorage: { getItem: () => null, setItem: noop },
  db: { from: () => ({ select: () => ({ eq: () => ({}) }) }) },
  XLSX: undefined,
  navigator: { language: 'pt-BR' },
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

// pages.js referencia funções de outros módulos — stub do que é chamado
// durante a montagem da tabela.
vm.runInContext(`
  var currentUserProfile = { role: 'admin', id: 'u1' };
  var currentUser = { id: 'u1' };
  var pontoHorarios = new Map();
  function adhMonthLabel(m) { return m; }
  function hcAllBases() { return ['BEL']; }
  function navigateTo() {}
`, sandbox);

vm.runInContext(fs.readFileSync(__dirname + '/../js/escala.js', 'utf8'), sandbox);

// ── Cenário de teste ────────────────────────────────────
const ANO = 2026, MES = 9, DIAS = new Date(ANO, MES, 0).getDate();
const FUNCOES = ['Supervisor de Operações', 'Auxiliar de Rampa', 'Agente de Aeroporto', 'Auxiliar de Limpeza'];

const colabs = Array.from({ length: 12 }, (_, i) => ({
  matricula: String(30100 + i), nome: `Colaborador de Teste ${i + 1}`,
  turno: i % 3 === 0 ? 'Setor Manhã' : null,
  bloco_horario: i % 4 === 0 ? 'Virada 22h' : null,
  entrada_manual: ['04:00', '06:00', '12:00', '22:00'][i % 4],
  saida_manual: ['11:20', '13:20', '19:20', '05:20'][i % 4],
  ordem_manual: null,
}));

const eoColabs = new Map(colabs.map((c, i) => [c.matricula,
  { nome: c.nome, funcao: FUNCOES[i % FUNCOES.length], ch: i % 3 === 0 ? '180' : '210', station: 'BEL' }]));

const dias = new Map();
colabs.forEach((c, i) => { for (let d = 1 + (i % 6); d <= DIAS; d += 7) dias.set(`${c.matricula}|${d}`, { status: 'F' }); });

Object.assign(sandbox.window, {
  _escalaBase: 'BEL', _escalaMes: `${ANO}-0${MES}`, _escalaColabs: colabs,
  _escalaDias: dias, _escalaFeriados: new Map([[`${ANO}-09-07`, { nome: 'Independência', tipo: 'nacional' }]]),
  _escalaTravada: false, _escalaSelecionados: new Set(),
  _escalaOrdemColuna: null, _escalaOrdemDirecao: 'asc',
  _escalaGruposVisiveis: null, _escalaBlocosRecolhidos: false,
  eoColabs, eoFerias: new Map(),
});

// ── Contador de colunas por linha, respeitando colspan ──
function analisar(html) {
  const linhas = html.split(/<tr[^>]*>/i).slice(1);
  return linhas.map(bloco => {
    const corpo = bloco.split('</tr>')[0];
    let total = 0;
    const re = /<(td|th)\b([^>]*)>/gi;
    let m;
    while ((m = re.exec(corpo)) !== null) {
      const cs = /colspan\s*=\s*["']?(\d+)/i.exec(m[2]);
      total += cs ? parseInt(cs[1], 10) : 1;
    }
    return total;
  });
}

function rodar(nome, opcoes) {
  Object.assign(sandbox.window, opcoes);
  const html = sandbox.escalaGradeTabelaHTML(ANO, MES, DIAS);
  const contagens = analisar(html);
  const cabecalho = contagens[0];
  const cols = (html.match(/<col\b/gi) || []).length;
  const divergentes = contagens.filter(n => n !== cabecalho).length;

  const ok = divergentes === 0 && cols === cabecalho;
  console.log(`${ok ? 'PASSOU' : 'FALHOU'}  ${nome}`);
  console.log(`   cabeçalho: ${cabecalho} colunas · <col> declarados: ${cols} · linhas: ${contagens.length} · fora do padrão: ${divergentes}`);
  if (!ok) {
    const errados = contagens.map((n, i) => [i, n]).filter(([, n]) => n !== cabecalho).slice(0, 6);
    errados.forEach(([i, n]) => console.log(`   linha ${i}: ${n} colunas (esperado ${cabecalho})`));
  }
  return ok;
}

let tudoOk = true;
tudoOk &= rodar('lista simples, colunas extras ligadas', { _escalaColunasSecundarias: true, _escalaAgruparPorTurno: false });
tudoOk &= rodar('lista simples, colunas essenciais', { _escalaColunasSecundarias: false, _escalaAgruparPorTurno: false });
tudoOk &= rodar('agrupado, colunas extras ligadas', { _escalaColunasSecundarias: true, _escalaAgruparPorTurno: true });
tudoOk &= rodar('agrupado, colunas essenciais', { _escalaColunasSecundarias: false, _escalaAgruparPorTurno: true });

// ── Largura mínima nos dois modos ───────────────────────
[true, false].forEach(sec => {
  sandbox.window._escalaColunasSecundarias = sec;
  sandbox.window._escalaAgruparPorTurno = false;
  const html = sandbox.escalaGradeTabelaHTML(ANO, 1, 31); // janeiro: pior caso, 31 dias
  const min = parseInt(/min-width:(\d+)px/.exec(html)[1], 10);
  const uteis = 1920 - 220 - 40 - 15;
  const larguraDia = Math.floor((uteis - (min - 24 * 31)) / 31);
  console.log(`${min <= uteis ? 'PASSOU' : 'FALHOU'}  largura mínima em mês de 31 dias ${sec ? 'com extras' : 'essenciais'}: ${min}px (útil em Full HD: ${uteis}px) · dia fica com ~${larguraDia}px`);
  tudoOk &= (min <= uteis);
});

process.exit(tudoOk ? 0 : 1);
