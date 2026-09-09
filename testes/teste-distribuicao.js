// Mede a QUALIDADE da distribuição de folgas, não só a validade.
// Reproduz o Turno Alpha do print: 22 auxiliares de rampa, CH 180
// (meta 6 folgas), outubro/2026. O objetivo é ver amplitude e desvio
// padrão da linha "trabalhando no dia" caírem.
const fs = require('fs');
const vm = require('vm');

const noop = () => {};
const sandbox = {
  console: { log: noop, warn: noop, error: noop },
  Date, Math, JSON, Map, Set, Array, String, Number, Object, Intl,
  setTimeout, clearTimeout, addEventListener: noop, removeEventListener: noop,
  document: { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], addEventListener: noop },
  localStorage: { getItem: () => null, setItem: noop },
  db: { from: () => ({ select: () => ({ eq: () => ({}) }) }) },
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(`var currentUserProfile={id:'u1'};var currentUser={id:'u1'};var pontoHorarios=new Map();
  function adhMonthLabel(m){return m;} function hcAllBases(){return['BEL'];} function navigateTo(){}`, sandbox);
vm.runInContext(fs.readFileSync(__dirname + '/../js/escala.js', 'utf8'), sandbox);

const ANO = 2026, MES = 10, DIAS = 31;
const N = 22, META = 6;

const colabs = Array.from({ length: N }, (_, i) => ({
  matricula: String(160100 + i),
  nome: `AUXILIAR ${i + 1}`,
  entrada_manual: '01:00',
  saida_manual: '07:00',
}));
const eoColabs = new Map(colabs.map(c => [c.matricula,
  { nome: c.nome, funcao: 'AUXILIAR DE RAMPA I', ch: '180', station: 'BEL' }]));

Object.assign(sandbox.window, {
  _escalaBase: 'BEL', _escalaMes: `${ANO}-${MES}`, _escalaColabs: colabs,
  _escalaDias: new Map(), _escalaFeriados: new Map(),
  eoColabs, eoFerias: new Map(), eoFeriasAll: [],
  _escalaFatorPiso: 0.85, _escalaDemandaPorDia: null,
});

// ── Distribuição "ingênua" ────────────────────────────────────────
// Reproduz o que o print mostrava: todo mundo com as 6 folgas corretas e
// sem violar nenhuma regra dura — só MAL DISTRIBUÍDAS entre os dias.
// Poucos pontos de partida distintos fazem a folga de muita gente cair no
// mesmo dia, que é exatamente a origem do 15 ao lado do 20.
function distribuicaoIngenua() {
  const mapa = new Map();
  const regs = [];
  const espacos = [5, 5, 6, 5, 5]; // 6 folgas cobrindo os 31 dias
  colabs.forEach((c, i) => {
    let d = 1 + (i % 4);           // só 4 pontos de partida pra 22 pessoas
    for (let k = 0; k < META; k++) {
      const reg = { matricula: c.matricula, dia: d, status: 'F', origem: 'auto' };
      mapa.set(`${c.matricula}|${d}`, reg);
      regs.push(reg);
      d += espacos[k % espacos.length];
    }
  });
  return { mapa, regs };
}

function medir(mapa) {
  const porDia = [];
  for (let d = 1; d <= DIAS; d++) {
    let n = 0;
    for (const c of colabs) {
      const st = mapa.get(`${c.matricula}|${d}`)?.status;
      if (st === 'F' || st === 'FA' || st === 'J' || st === 'CH') continue;
      n++;
    }
    porDia.push(n);
  }
  const media = porDia.reduce((a, b) => a + b, 0) / DIAS;
  const dp = Math.sqrt(porDia.reduce((s, v) => s + (v - media) ** 2, 0) / DIAS);

  // Regularidade: desvio dos intervalos entre folgas de cada pessoa.
  let somaEspac = 0, nEspac = 0;
  for (const c of colabs) {
    const dias = [];
    for (let d = 1; d <= DIAS; d++) if (mapa.get(`${c.matricula}|${d}`)) dias.push(d);
    if (dias.length < 2) continue;
    const ideal = DIAS / dias.length;
    for (let i = 1; i < dias.length; i++) {
      somaEspac += Math.abs(dias[i] - dias[i-1] - ideal);
      nEspac++;
    }
  }
  return {
    porDia,
    min: Math.min(...porDia), max: Math.max(...porDia),
    amplitude: Math.max(...porDia) - Math.min(...porDia),
    media, dp,
    desvioIntervalo: nEspac ? somaEspac / nEspac : 0,
  };
}

const { mapa, regs } = distribuicaoIngenua();
sandbox.window._escalaDias = mapa;
const antes = medir(mapa);
const violacoesAntes = colabs.filter(c =>
  !sandbox.escalaValidarRegrasFolga(
    sandbox.escalaFolgasDoColab(c, ANO, MES, DIAS, mapa), ANO, MES, DIAS).ok).length;

const modelo = sandbox.escalaModeloCobertura(colabs, ANO, MES, DIAS);
const t0 = Date.now();
const movidas = sandbox.escalaMelhorarDistribuicao(regs, colabs, ANO, MES, DIAS, mapa, modelo);
const ms = Date.now() - t0;
const depois = medir(mapa);

const linha = (r) => `min ${r.min} · max ${r.max} · amplitude ${r.amplitude} · desvio padrão ${r.dp.toFixed(2)} · irregularidade do intervalo ${r.desvioIntervalo.toFixed(2)}`;
console.log(`Turno Alpha simulado — ${N} pessoas, meta ${META}, ${DIAS} dias\n`);
console.log(`  antes : ${linha(antes)}`);
console.log(`          ${antes.porDia.join(' ')}`);
console.log(`  depois: ${linha(depois)}`);
console.log(`          ${depois.porDia.join(' ')}`);
console.log(`\n  ${movidas} folga(s) realocada(s) em ${ms}ms`);

// ── Verificações ────────────────────────────────────────────────────
let ok = true;
const check = (nome, cond, detalhe) => {
  console.log(`${cond ? 'PASSOU' : 'FALHOU'}  ${nome}${detalhe ? ` · ${detalhe}` : ''}`);
  ok &= cond;
};
check('a amplitude da cobertura diminui', depois.amplitude < antes.amplitude,
  `${antes.amplitude} → ${depois.amplitude}`);
check('o desvio padrão diminui', depois.dp < antes.dp,
  `${antes.dp.toFixed(2)} → ${depois.dp.toFixed(2)}`);
// A linha de base tem espaçamento artificialmente perfeito (fixo). Ao
// nivelar a cobertura, algum intervalo necessariamente se desloca — o que
// não pode é virar sorteio.
check('os intervalos entre folgas continuam regulares',
  depois.desvioIntervalo < 1.5,
  `${antes.desvioIntervalo.toFixed(2)} → ${depois.desvioIntervalo.toFixed(2)}`);
check('a quantidade de folgas de cada pessoa não muda', (() => {
  return colabs.every(c => {
    let n = 0;
    for (let d = 1; d <= DIAS; d++) if (mapa.get(`${c.matricula}|${d}`)) n++;
    return n === META;
  });
})());
// A linha de base é propositalmente ruim na DISTRIBUIÇÃO, mas pode já
// nascer violando alguma regra dura (dois domingos, por exemplo). O que
// importa é que a otimização não INTRODUZA violação nova.
const violacoes = (m) => colabs.filter(c =>
  !sandbox.escalaValidarRegrasFolga(
    sandbox.escalaFolgasDoColab(c, ANO, MES, DIAS, m), ANO, MES, DIAS).ok).length;
const vDepois = violacoes(mapa);
console.log(`  violações de regra dura: ${violacoesAntes} antes → ${vDepois} depois`);
check('a otimização não cria violação nova de regra dura', vDepois <= violacoesAntes,
  `${violacoesAntes} → ${vDepois}`);
check('roda em tempo aceitável pra uma base inteira', ms < 3000, `${ms}ms para 1 turno`);

process.exit(ok ? 0 : 1);
