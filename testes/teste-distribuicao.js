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

// Curva de pico real, lida da linha "Pico da malha no dia" do painel.
// É ela que faz o alvo variar — e era ela, repassada em força total, que
// produzia dias com 14 pessoas ao lado de dias com 20.
const PICO_REAL = [67,66,59,66,67,66,66,67,66,66,72,66,66,66,67,66,66,66,67,66,73,67,66,59,58,59,58,66,58,58,51];
sandbox.escalaPicoDoDia = (dia) => PICO_REAL[dia-1] || 0;

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
const otim = sandbox.escalaMelhorarDistribuicao(regs, colabs, ANO, MES, DIAS, mapa, modelo);
const movidas = otim.movidas;
const ms = Date.now() - t0;
const depois = medir(mapa);

const linha = (r) => `min ${r.min} · max ${r.max} · amplitude ${r.amplitude} · desvio padrão ${r.dp.toFixed(2)} · irregularidade do intervalo ${r.desvioIntervalo.toFixed(2)}`;
console.log(`Turno Alpha simulado — ${N} pessoas, meta ${META}, ${DIAS} dias\n`);
console.log(`  antes : ${linha(antes)}`);
console.log(`          ${antes.porDia.join(' ')}`);
console.log(`  depois: ${linha(depois)}`);
console.log(`          ${depois.porDia.join(' ')}`);
console.log(`\n  ${movidas} folga(s) realocada(s) em ${ms}ms`);
console.log(`  ${otim.tentativas} tentativas · custos ${otim.historico.map(v => v.toFixed(0)).join(' → ')} · melhor ${otim.custo.toFixed(0)}`);

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

// ── Amplitude do alvo conforme a sensibilidade à malha ─────────────
const amplitudeAlvo = (amortecimento) => {
  sandbox.window._escalaAmortecimentoDemanda = amortecimento;
  const m = sandbox.escalaModeloCobertura(colabs, ANO, MES, DIAS);
  const chave = [...m.grupos.keys()][0];
  const p = m.piso.get(chave);
  return Math.max(...p) - Math.min(...p);
};
const ampAlta = amplitudeAlvo(1.0);
const ampMedia = amplitudeAlvo(0.35);
const ampBaixa = amplitudeAlvo(0.15);
console.log(`\n  amplitude do piso conforme a sensibilidade: alta ${ampAlta} · média ${ampMedia} · baixa ${ampBaixa}`);
check('sensibilidade menor achata a variação do alvo',
  ampBaixa <= ampMedia && ampMedia < ampAlta, `${ampBaixa} <= ${ampMedia} < ${ampAlta}`);
check('no padrão, o alvo não varia mais que 3 pessoas num turno de 22',
  ampMedia <= 3, `amplitude ${ampMedia}`);
sandbox.window._escalaAmortecimentoDemanda = 0.35;

// ── Cores do desvio ────────────────────────────────────────────────
const cor = (v, med) => sandbox.escalaCorDesvioCobertura(v, med, 1).cor;
check('desvio de 1 pessoa não colore', cor(18, 18) === null && cor(17, 18) === null);
check('2 abaixo da mediana fica laranja', cor(16, 18) === '#f6ad55');
check('3 abaixo fica vermelho', cor(15, 18) === '#fc8181');
check('sobra de gente usa cor fria, não de alerta',
  cor(21, 18) === '#63b3ed' && cor(20, 18) === '#8fb8d8');
check('falta e sobra do mesmo tamanho não usam a mesma cor',
  cor(15, 18) !== cor(21, 18));

// ── Multi-tentativa: cliques diferentes, resultados diferentes ─────
check('a busca faz mais de uma tentativa', otim.tentativas > 1, `${otim.tentativas}`);
check('o custo final é o melhor de todas as tentativas',
  Math.abs(otim.custo - Math.min(...otim.historico)) < 1e-6,
  `final ${otim.custo.toFixed(1)} · melhor do histórico ${Math.min(...otim.historico).toFixed(1)}`);
check('a busca nunca termina pior do que a primeira descida',
  otim.custo <= otim.historico[0] + 1e-6,
  `${otim.historico[0].toFixed(1)} → ${otim.custo.toFixed(1)}`);

// Rodar de novo, com a semente que ficou, tem que explorar outro caminho.
const segunda = (() => {
  const { mapa: m2, regs: r2 } = distribuicaoIngenua();
  sandbox.window._escalaDias = m2;
  const mod2 = sandbox.escalaModeloCobertura(colabs, ANO, MES, DIAS);
  return { r: sandbox.escalaMelhorarDistribuicao(r2, colabs, ANO, MES, DIAS, m2, mod2), mapa: m2 };
})();
check('o segundo clique não repete exatamente o mesmo histórico',
  segunda.r.historico.join(',') !== otim.historico.join(','),
  'as buscas partem de sementes diferentes');
check('e o resultado do segundo clique também é válido', (() => {
  return colabs.every(c => {
    let n = 0;
    for (let d = 1; d <= DIAS; d++) if (segunda.mapa.get(`${c.matricula}|${d}`)) n++;
    return n === META;
  });
})());

process.exit(ok ? 0 : 1);
