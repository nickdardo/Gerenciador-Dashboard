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
  // Espelha o caso real de BEL: cada grupo tem 2 pessoas na virada da
  // noite (22:00 e 23:00 = Turno Delta) e 1 de manha (11:00 = Bravo).
  // Assim o teste exercita sub-bloco com mais de um turno E com par
  // dentro do mesmo turno (necessario pra validar o arrastar).
  entrada_manual: ['22:00', '23:00', '11:00'][i % 3],
  saida_manual: ['02:00', '03:00', '14:00'][i % 3],
  ordem_manual: null,
}));

const eoColabs = new Map(colabs.map((c, i) => [c.matricula,
  { nome: c.nome, funcao: FUNCOES[Math.floor(i / 3)], ch: i % 3 === 0 ? '180' : '210', station: 'BEL' }]));

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

// O colspan tem que continuar batendo em TODOS os critérios de sub-bloco —
// é onde nascem as linhas novas de cabeçalho e de contagem.
['turno', 'horario', 'setor', 'bloco', 'nenhum'].forEach(crit => {
  tudoOk &= rodar(`agrupado, sub-bloco por "${crit}"`, {
    _escalaColunasSecundarias: true, _escalaAgruparPorTurno: true, _escalaCriterioSubBloco: crit,
  });
});

// ── Sub-blocos separam por horário e cada um traz sua contagem ──────────
(function () {
  Object.assign(sandbox.window, {
    _escalaColunasSecundarias: true, _escalaAgruparPorTurno: true, _escalaCriterioSubBloco: 'turno',
  });
  const html = sandbox.escalaGradeTabelaHTML(ANO, MES, DIAS);

  // Cabecalho de sub-bloco = o que traz "subBloco" no filtro dos botoes.
  // Contar /Turno (Alpha|Bravo)/ pegaria tambem o valor da coluna Turno de
  // cada linha de pessoa, inflando o numero.
  const cabecalhosSub = (html.match(/&quot;subBloco&quot;|"subBloco":/g) || []).length / 2;
  const linhasContagem = (html.match(/trabalhando no dia/g) || []).length;
  const botoesGerar = (html.match(/escalaGerarFolgasAuto\(/g) || []).length;
  const botoesRemover = (html.match(/escalaRemoverFolgas\(/g) || []).length;
  const totaisGrupo = (html.match(/Total [^<]*trabalhando no dia/g) || []).length;

  // Cada sub-bloco tem cabecalho + contagem propria; grupo com mais de um
  // sub-bloco ganha ainda a linha "Total <grupo>".
  const okSub = cabecalhosSub >= 4;
  const okContagem = linhasContagem === cabecalhosSub + totaisGrupo;
  const okPar = botoesGerar === botoesRemover && botoesGerar > 0;

  console.log(`${okSub ? 'PASSOU' : 'FALHOU'}  sub-blocos por turno: ${cabecalhosSub} cabeçalhos de turno gerados`);
  console.log(`${okContagem ? 'PASSOU' : 'FALHOU'}  contagem por dia: ${linhasContagem} linhas = ${cabecalhosSub} sub-blocos + ${totaisGrupo} totais de grupo`);
  console.log(`${okPar ? 'PASSOU' : 'FALHOU'}  gerar/remover folgas em par: ${botoesGerar} gerar, ${botoesRemover} remover`);
  tudoOk &= okSub && okContagem && okPar;
})();

// ── Ordem manual (arrastar) vence no modo agrupado ─────────────────────
(function () {
  const alvo = colabs[3], vizinho = colabs.find(c => c !== alvo
    && sandbox.escalaSetorDoTurno(c.entrada_manual) === sandbox.escalaSetorDoTurno(alvo.entrada_manual)
    && sandbox.escalaFuncaoGrupoDoColab(c).label === sandbox.escalaFuncaoGrupoDoColab(alvo).label);
  if (!vizinho) { console.log('PULADO  ordem manual: sem par no mesmo sub-bloco'); return; }

  const posicoes = (html) => [...html.matchAll(/data-escala-linha="(\d+)"/g)].map(m => m[1]);
  Object.assign(sandbox.window, { _escalaAgruparPorTurno: true, _escalaCriterioSubBloco: 'turno', _escalaOrdemColuna: null });

  colabs.forEach(c => { c.ordem_manual = null; });
  const antes = posicoes(sandbox.escalaGradeTabelaHTML(ANO, MES, DIAS));

  // Inverte os dois na ordem manual e confere se a tela obedece.
  alvo.ordem_manual = 0; vizinho.ordem_manual = 1;
  const depois = posicoes(sandbox.escalaGradeTabelaHTML(ANO, MES, DIAS));
  const iAlvo = depois.indexOf(alvo.matricula), iViz = depois.indexOf(vizinho.matricula);
  const ok = iAlvo !== -1 && iViz !== -1 && iAlvo < iViz;

  console.log(`${ok ? 'PASSOU' : 'FALHOU'}  ordem manual respeitada no modo agrupado (${alvo.matricula} antes de ${vizinho.matricula})`);
  if (!ok) console.log(`   antes: ${antes.slice(0,4).join(', ')} · depois: ${depois.slice(0,4).join(', ')}`);
  tudoOk &= ok;
  colabs.forEach(c => { c.ordem_manual = null; });
})();

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

// ══════════════════════════════════════════════════════
// REGRESSÃO — trava o comportamento acordado com o cliente.
// Se algum destes quebrar, algo saiu do combinado.
// ══════════════════════════════════════════════════════
(function () {
  const ok = (nome, cond, detalhe) => {
    console.log(`${cond ? 'PASSOU' : 'FALHOU'}  ${nome}${detalhe ? ` · ${detalhe}` : ''}`);
    tudoOk &= cond;
  };

  // ── Meta de folgas ──────────────────────────────────
  // CH 120 segue a regra da 100 (decisão do cliente) e ninguém fica abaixo
  // de um descanso semanal, seja qual for a CH.
  const meta = (ch, dias) => sandbox.escalaMetaFolgasDoColab(ch, dias);
  ok('CH 120 usa a regra da CH 100', meta(120, 31) === meta(100, 31), `120→${meta(120,31)}, 100→${meta(100,31)}`);
  ok('CH 120 não devolve mais 1 folga no mês', meta(120, 31) >= 5, `meta = ${meta(120,31)}`);
  const piso31 = Math.ceil(31 / 7);
  ok('piso de descanso semanal em toda CH',
    [60, 90, 100, 120, 180, 210, 999].every(ch => meta(ch, 31) >= piso31),
    `piso = ${piso31}`);

  // ── Saída calculada = entrada + jornada + intervalo ──
  const saida = (e, ch) => sandbox.escalaSaidaCalculada(e, ch);
  ok('CH 210 (7h + 1h intervalo) soma 8h', saida('22:00', 210) === '06:00', `22:00 → ${saida('22:00', 210)}`);
  ok('CH 180 (6h + 15min) soma 6h15', saida('00:00', 180) === '06:15', `00:00 → ${saida('00:00', 180)}`);
  ok('CH 100 (4h, sem intervalo) soma 4h', saida('08:00', 100) === '12:00', `08:00 → ${saida('08:00', 100)}`);
  ok('vira o dia sem estourar 24h', saida('20:00', 210) === '04:00', `20:00 → ${saida('20:00', 210)}`);
  ok('sem CH conhecida não inventa saída', saida('08:00', 999) === null);

  // ── Férias: todos os períodos, não só o último ───────
  sandbox.window.eoFeriasAll = [
    { matricula: '30100', data_inicio: '2026-09-05', data_fim: '2026-09-20' },
    { matricula: '30100', data_inicio: '2026-12-01', data_fim: '2026-12-20' },
  ];
  sandbox.window.eoFerias = new Map([['30100', { matricula: '30100', data_inicio: '2026-12-01', data_fim: '2026-12-20' }]]);
  ok('férias de setembro aparecem mesmo havendo período posterior',
    sandbox.escalaEstaDeFerias('30100', 2026, 9, 10) === true);
  ok('dia fora de qualquer período não vira férias',
    sandbox.escalaEstaDeFerias('30100', 2026, 9, 25) === false);

  // Exceção lançada na escala anula o L daquele dia, sem tocar no RH.
  sandbox.window._escalaDias.set('30100|10', { status: 'T' });
  ok('exceção "T" anula as férias só naquele dia',
    sandbox.escalaEstaDeFerias('30100', 2026, 9, 10) === false);
  sandbox.window._escalaDias.delete('30100|10');
  sandbox.window.eoFeriasAll = [];

  // ── Colunas: Setor e Bloco saíram da grade ──────────
  Object.assign(sandbox.window, { _escalaColunasSecundarias: true, _escalaAgruparPorTurno: false });
  const html = sandbox.escalaGradeTabelaHTML(ANO, MES, DIAS);
  ok('coluna Setor removida do cabeçalho', !/>Setor</.test(html));
  ok('coluna Bloco removida do cabeçalho', !/>Bloco</.test(html));
  ok('Turno auto continua na grade', html.includes('Turno auto'));
  ok('Saída não é mais campo editável',
    !/escalaEditarHorario\('[^']+','saida'/.test(html));
  ok('Saída aparece como valor calculado', html.includes('escala-calculado'));

  // ── Bloco fixo do topo ──────────────────────────────
  ok('linha de contagem marcada pra medição', html.includes('escala-linha-trabalhando'));
  ok('linha de cadastro presa no topo', html.includes('escala-linha-add'));
  ok('cadastro manual disponível na linha de adicionar', html.includes('escala-form-manual'));
  ok('CH é campo obrigatório do cadastro manual', html.includes('escala-man-ch'));

  // ── Critérios de sub-bloco somem quando não há dado ──
  // O fixture traz Setor/Bloco preenchidos de propósito (pra exercitar esses
  // critérios acima). Aqui simula uma base como BEL, onde os dois estão
  // vazios — é nela que as opções devem sumir do seletor.
  const guardado = sandbox.window._escalaColabs.map(c => [c.turno, c.bloco_horario]);
  sandbox.window._escalaColabs.forEach(c => { c.turno = null; c.bloco_horario = null; });
  const disp = sandbox.escalaCriteriosSubBlocoDisponiveis().map(c => c.valor);
  ok('sem Setor/Bloco preenchido, os critérios somem do seletor',
    !disp.includes('setor') && !disp.includes('bloco'), `disponíveis: ${disp.join(', ')}`);
  ok('critério salvo inválido cai pro padrão Turno', (() => {
    sandbox.window._escalaCriterioSubBloco = 'setor';
    const efetivo = sandbox.escalaCriterioSubBloco();
    sandbox.window._escalaCriterioSubBloco = 'turno';
    return efetivo === 'turno';
  })());
  sandbox.window._escalaColabs.forEach((c, i) => { [c.turno, c.bloco_horario] = guardado[i]; });
  sandbox.window._escalaColabs[0].turno = 'Setor Manhã';
  ok('com Setor preenchido, o critério volta',
    sandbox.escalaCriteriosSubBlocoDisponiveis().map(c => c.valor).includes('setor'));
  sandbox.window._escalaColabs[0].turno = guardado[0][0];
})();

process.exit(tudoOk ? 0 : 1);

