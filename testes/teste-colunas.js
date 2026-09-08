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
  // Regra revista com o cliente: o intervalo de 15 min corre DENTRO da
  // jornada, então não empurra a saída (só o de 1h do CH 210 empurra).
  ok('CH 180 (6h, intervalo dentro da jornada) soma 6h', saida('00:00', 180) === '06:00', `00:00 → ${saida('00:00', 180)}`);
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

  // ── Pilha de camadas: nenhum z-index inline na grade ─────────────
  // A ordem de empilhamento vive só no CSS. Se voltar a aparecer z-index
  // inline aqui, o cabeçalho volta a colidir com as linhas do corpo.
  ok('sem z-index inline na tabela da grade', !/z-index:\s*\d/.test(html));
  // Precisa ser render AGRUPADO — sem agrupamento não existe cabeçalho de
  // bloco nenhum, e a asserção passaria/falharia por motivo errado.
  ok('cabeçalhos de bloco marcados pra camada própria', (() => {
    sandbox.window._escalaAgruparPorTurno = true;
    const h = sandbox.escalaGradeTabelaHTML(ANO, MES, DIAS);
    sandbox.window._escalaAgruparPorTurno = false;
    return h.includes('escala-bloco-header');
  })());

  // ── Filtro por situação ─────────────────────────────────────────
  const totalColabs = sandbox.window._escalaColabs.length;
  const filtrar = (v) => {
    sandbox.window._escalaFiltroSituacao = v;
    const h = sandbox.escalaGradeTabelaHTML(ANO, MES, DIAS);
    sandbox.window._escalaFiltroSituacao = 'todos';
    return (h.match(/<tr[^>]*data-mat=/g) || []).length;
  };
  ok('filtro "todos" mostra todo mundo', filtrar('todos') === totalColabs, `${totalColabs} pessoas`);
  ok('filtro "fora do cadastro" fica vazio sem ninguém marcado', filtrar('fora_cadastro') === 0);

  sandbox.window.eoFeriasAll = [{ matricula: '30100', data_inicio: '2026-09-01', data_fim: '2026-09-15' }];
  ok('filtro "só de férias" isola quem tem período no mês', filtrar('ferias') === 1);
  ok('filtro "só quem NÃO está de férias" é o complemento', filtrar('sem_ferias') === totalColabs - 1);
  sandbox.window.eoFeriasAll = [];
})();

// ── Robustez do casamento de férias (formatos de data e matrícula) ──
(function () {
  const ok = (nome, cond, detalhe) => {
    console.log(`${cond ? 'PASSOU' : 'FALHOU'}  ${nome}${detalhe ? ` · ${detalhe}` : ''}`);
    tudoOk &= cond;
  };
  const guardado = sandbox.window.eoFeriasAll;

  // Mesmo período, escrito dos quatro jeitos que o import pode gerar.
  const casos = [
    ['date puro',            '2026-09-01', '2026-09-30'],
    ['timestamp com fuso',   '2026-09-01T00:00:00+00:00', '2026-09-30T00:00:00+00:00'],
    ['dd/mm/aaaa do Excel',  '01/09/2026', '30/09/2026'],
    ['objeto Date',          new Date('2026-09-01T00:00:00Z'), new Date('2026-09-30T00:00:00Z')],
  ];
  casos.forEach(([nome, ini, fim]) => {
    sandbox.window.eoFeriasAll = [{ matricula: '30100', data_inicio: ini, data_fim: fim }];
    const meio = sandbox.escalaEstaDeFerias('30100', 2026, 9, 15);
    const primeiro = sandbox.escalaEstaDeFerias('30100', 2026, 9, 1);
    const ultimo = sandbox.escalaEstaDeFerias('30100', 2026, 9, 30);
    ok(`férias reconhecidas com data em ${nome}`, meio && primeiro && ultimo);
  });

  // Zero à esquerda: o cadastro de férias costuma vir com a matrícula como
  // número, e a escala guarda texto.
  sandbox.window.eoFeriasAll = [{ matricula: 160590, data_inicio: '2026-09-01', data_fim: '2026-09-30' }];
  ok('matrícula numérica casa com a de texto', sandbox.escalaEstaDeFerias('160590', 2026, 9, 10));
  sandbox.window.eoFeriasAll = [{ matricula: '0160590', data_inicio: '2026-09-01', data_fim: '2026-09-30' }];
  ok('zero à esquerda não impede o casamento', sandbox.escalaEstaDeFerias('160590', 2026, 9, 10));

  // Período que atravessa a virada do mês conta nos dois meses.
  sandbox.window.eoFeriasAll = [{ matricula: '30100', data_inicio: '2026-08-20', data_fim: '2026-09-03' }];
  ok('período de agosto que vaza pra setembro aparece nos 2 meses',
    sandbox.escalaEstaDeFerias('30100', 2026, 8, 25) && sandbox.escalaEstaDeFerias('30100', 2026, 9, 3));
  ok('e não vaza pra depois do fim', !sandbox.escalaEstaDeFerias('30100', 2026, 9, 4));

  // Vários períodos do mesmo colaborador: todos valem, não só o último.
  sandbox.window.eoFeriasAll = [
    { matricula: '30100', data_inicio: '2026-09-01', data_fim: '2026-09-30' },
    { matricula: '30100', data_inicio: '2026-12-01', data_fim: '2026-12-20' },
  ];
  ok('dois períodos: setembro continua valendo', sandbox.escalaEstaDeFerias('30100', 2026, 9, 15));
  ok('dois períodos: dezembro também', sandbox.escalaEstaDeFerias('30100', 2026, 12, 5));

  // Data ilegível não pode virar "está de férias sempre".
  sandbox.window.eoFeriasAll = [{ matricula: '30100', data_inicio: 'setembro', data_fim: '' }];
  ok('data ilegível é descartada em vez de casar com tudo',
    !sandbox.escalaEstaDeFerias('30100', 2026, 9, 15));

  sandbox.window.eoFeriasAll = guardado;
})();

// ── Saída exibida é a calculada, não a gravada errada ──────────────
(function () {
  const ok = (nome, cond, detalhe) => {
    console.log(`${cond ? 'PASSOU' : 'FALHOU'}  ${nome}${detalhe ? ` · ${detalhe}` : ''}`);
    tudoOk &= cond;
  };

  // Caso exato do print: entra 11:00, CH 210, e no banco está 14:00.
  const alvo = sandbox.window._escalaColabs[0];
  const guardado = [alvo.entrada_manual, alvo.saida_manual];
  alvo.entrada_manual = '11:00';
  alvo.saida_manual = '14:00';
  sandbox.window.eoColabs.set(alvo.matricula, { nome: alvo.nome, funcao: 'SUPERVISOR', ch: '210' });

  const html = sandbox.escalaGradeTabelaHTML(ANO, MES, DIAS);
  ok('grade mostra a saída calculada (19:00), não a gravada (14:00)',
    html.includes('>19:00<') && !html.includes('>14:00<'));
  ok('divergência com o banco é contabilizada',
    (sandbox.window._escalaSaidasDivergentes || []).some(d => d.salvo === '14:00' && d.calculado === '19:00'));

  // Escopo na própria matrícula: os outros do fixture têm saídas de
  // importação que divergem de propósito, e contar o total daria falso
  // negativo aqui.
  alvo.saida_manual = '19:00';
  sandbox.escalaGradeTabelaHTML(ANO, MES, DIAS);
  ok('sem divergência quando o banco já bate',
    !(sandbox.window._escalaSaidasDivergentes || []).some(d => d.matricula === alvo.matricula));

  [alvo.entrada_manual, alvo.saida_manual] = guardado;
})();

// ── Independência do cache: a Escala não pode depender de quem carregou
//    primeiro (autoload do Admin x hcEnsureData da própria tela) ────────
(function () {
  const ok = (nome, cond, detalhe) => {
    console.log(`${cond ? 'PASSOU' : 'FALHOU'}  ${nome}${detalhe ? ` · ${detalhe}` : ''}`);
    tudoOk &= cond;
  };
  const guardado = sandbox.window.eoFeriasAll;

  // Cenário exato do bug: o autoload do Admin deixou só o mapa resumido,
  // com UM período por matrícula (o de data_fim mais tarde). Setembro
  // sumia porque a pessoa tinha outro período depois no ano.
  sandbox.window.eoFeriasAll = undefined;
  sandbox.window.eoFerias = new Map([
    ['30100', { matricula: '30100', data_inicio: '2026-12-01', data_fim: '2026-12-20' }],
  ]);
  ok('sem o histórico completo, setembro realmente some (bug reproduzido)',
    sandbox.escalaEstaDeFerias('30100', 2026, 9, 15) === false);

  // Com o histórico completo, os dois períodos valem.
  sandbox.window.eoFeriasAll = [
    { matricula: '30100', data_inicio: '2026-09-01', data_fim: '2026-09-30' },
    { matricula: '30100', data_inicio: '2026-12-01', data_fim: '2026-12-20' },
  ];
  ok('com o histórico completo, setembro volta a aparecer',
    sandbox.escalaEstaDeFerias('30100', 2026, 9, 15) === true);
  ok('e dezembro continua valendo',
    sandbox.escalaEstaDeFerias('30100', 2026, 12, 5) === true);

  // O log de diagnóstico precisa contar certo — é o que responde
  // "as férias estão no banco ou não?" sem abrir menu nenhum.
  sandbox.window._escalaColabs.push({ matricula: '30100', nome: 'Teste Férias' });
  const r = sandbox.escalaLogFerias(2026, 9, 30);
  ok('diagnóstico conta os períodos que cruzam o mês', r.cruzam === 1, `cruzam=${r.cruzam}`);
  ok('diagnóstico separa quem está na escala', r.cruzamNaEscala === 1);
  sandbox.window._escalaColabs.pop();

  sandbox.window.eoFeriasAll = [{ matricula: '30100', data_inicio: 'xx', data_fim: '' }];
  ok('diagnóstico sinaliza data ilegível', sandbox.escalaLogFerias(2026, 9, 30).ilegiveis === 1);

  sandbox.window.eoFeriasAll = guardado;
})();

// ── Registro vazio em escala_dia não pode apagar as férias ──────────
(function () {
  const ok = (nome, cond, detalhe) => {
    console.log(`${cond ? 'PASSOU' : 'FALHOU'}  ${nome}${detalhe ? ` · ${detalhe}` : ''}`);
    tudoOk &= cond;
  };
  const guardadoFer = sandbox.window.eoFeriasAll;
  const guardadoDias = sandbox.window._escalaDias;
  const c = sandbox.window._escalaColabs[0];

  sandbox.window.eoFeriasAll = [{ matricula: c.matricula, data_inicio: '2026-09-01', data_fim: '2026-09-30' }];
  sandbox.window._escalaDias = new Map();
  sandbox.window._escalaDiasIgnorados = [];

  const conteudo = () => sandbox.escalaConteudoDoMes(c, 2026, 9, 30);
  ok('férias do mês inteiro viram L', conteudo().filter(i => i.status === 'L').length === 30);

  // O caso do bug: linha existe em escala_dia, mas sem status válido.
  [null, '', undefined, 'X'].forEach(valor => {
    sandbox.window._escalaDias = new Map([[`${c.matricula}|10`, { status: valor }]]);
    sandbox.window._escalaDiasIgnorados = [];
    const item = conteudo()[9];
    ok(`status ${JSON.stringify(valor)} em escala_dia não apaga o L`, item.status === 'L');
  });

  // Marcação de verdade continua tendo prioridade sobre as férias.
  [['F','F'], ['J','J'], ['K','K'], ['CH','CH']].forEach(([gravado, esperado]) => {
    sandbox.window._escalaDias = new Map([[`${c.matricula}|10`, { status: gravado }]]);
    ok(`marcação ${gravado} continua vencendo as férias`, conteudo()[9].status === esperado);
  });

  // E a exceção 'T' segue anulando o L só naquele dia.
  sandbox.window._escalaDias = new Map([[`${c.matricula}|10`, { status: 'T' }]]);
  const r = conteudo();
  ok('exceção T anula o L do dia 10 e mantém os demais',
    r[9].status === null && r[8].status === 'L' && r[10].status === 'L');

  sandbox.window.eoFeriasAll = guardadoFer;
  sandbox.window._escalaDias = guardadoDias;
})();

// ── Staff: cruzamento de férias por matrícula ──────────────────────
// Carrega só as funções de férias do headcount.js no mesmo sandbox (ele
// depende dos normalizadores definidos em escala.js).
(function () {
  const ok = (nome, cond, detalhe) => {
    console.log(`${cond ? 'PASSOU' : 'FALHOU'}  ${nome}${detalhe ? ` · ${detalhe}` : ''}`);
    tudoOk &= cond;
  };
  // Carrega só os blocos de férias do headcount.js: o arquivo inteiro puxa
  // DOM e Supabase, que não existem aqui. São dois trechos — o índice de
  // férias e os helpers de mês, que ficam em partes diferentes do arquivo.
  const fonte = fs.readFileSync(__dirname + '/../js/headcount.js', 'utf8');
  const recorte = (de, ate) => fonte.slice(fonte.indexOf(de), fonte.indexOf(ate));
  vm.runInContext(recorte('let _hcFeriasIndice', 'function hcIsAtestado'), sandbox);
  vm.runInContext(recorte('function hcMesFerias', 'function hcFilterSitu'), sandbox);

  const guardado = sandbox.window.eoFeriasAll;

  // O caso do painel: matrícula numérica no cadastro de férias, texto no
  // cadastro de colaboradores. O lookup cru falhava e tudo dava zero.
  sandbox.window.eoFeriasAll = [
    { matricula: 160590, data_inicio: '2026-09-01', data_fim: '2026-09-30', filial: 'BEL' },
    { matricula: '0160580', data_inicio: '2026-09-10', data_fim: '2026-09-20', filial: 'BEL' },
    { matricula: '160980', data_inicio: '2026-12-01', data_fim: '2026-12-15', filial: 'BEL' },
  ];

  ok('matrícula numérica cruza com a de texto',
    sandbox.hcTemFeriasNoMes('160590', '2026-09') === true);
  ok('zero à esquerda cruza',
    sandbox.hcTemFeriasNoMes('160580', '2026-09') === true);
  ok('quem só tem férias em dezembro não entra em setembro',
    sandbox.hcTemFeriasNoMes('160980', '2026-09') === false);
  ok('e aparece em dezembro',
    sandbox.hcTemFeriasNoMes('160980', '2026-12') === true);

  // "De férias hoje" x "tem férias no mês" são perguntas diferentes: era
  // por isso que o filtro vinha vazio com 52 períodos programados.
  ok('férias no mês não exige estar de férias na data de hoje',
    sandbox.hcTemFeriasNoMes('160580', '2026-09') === true &&
    sandbox.hcIsFeriasAtiva('160580', '2026-09-05') === false);
  ok('e a checagem por data continua exata',
    sandbox.hcIsFeriasAtiva('160580', '2026-09-15') === true);

  ok('período sem data_fim não vira férias eterna sem início',
    sandbox.hcPeriodosFerias('999999').length === 0);

  sandbox.window.eoFeriasAll = guardado;
})();

// ── Staff: mês de referência do filtro de férias ───────────────────
(function () {
  const ok = (nome, cond, detalhe) => {
    console.log(`${cond ? 'PASSOU' : 'FALHOU'}  ${nome}${detalhe ? ` · ${detalhe}` : ''}`);
    tudoOk &= cond;
  };
  const guardado = sandbox.window.eoFeriasAll;
  sandbox.window.eoFeriasAll = [
    { matricula: '160590', data_inicio: '2026-09-01', data_fim: '2026-09-30', filial: 'BEL' },
    { matricula: '160580', data_inicio: '2026-08-20', data_fim: '2026-09-05', filial: 'BEL' },
    { matricula: '160980', data_inicio: '2026-10-01', data_fim: '2026-10-15', filial: 'BEL' },
  ];

  const p = sandbox.hcPeriodoNoMes('160580', '2026-09');
  ok('período que atravessa a virada é devolvido inteiro',
    p && p.ini === '2026-08-20' && p.fim === '2026-09-05',
    p ? `${p.ini} a ${p.fim}` : 'nulo');
  ok('e o mesmo período aparece em agosto', !!sandbox.hcPeriodoNoMes('160580', '2026-08'));
  ok('outubro traz só quem tem férias em outubro',
    sandbox.hcTemFeriasNoMes('160980', '2026-10') && !sandbox.hcTemFeriasNoMes('160590', '2026-10'));
  ok('mês sem férias devolve período nulo', sandbox.hcPeriodoNoMes('160590', '2026-11') === null);

  // O seletor precisa oferecer o mês corrente e marcá-lo como padrão.
  const meses = sandbox.hcMesesFeriasDisponiveis();
  const atual = new Date().toISOString().slice(0, 7);
  ok('seletor inclui o mês corrente', meses.includes(atual));
  ok('padrão do filtro é o mês corrente', sandbox.hcMesFerias() === atual, sandbox.hcMesFerias());
  ok('seletor cobre 12 meses', meses.length === 12);
  ok('rótulo do mês é legível', sandbox.hcMesLabel('2026-09') === 'set/2026', sandbox.hcMesLabel('2026-09'));

  sandbox.window.eoFeriasAll = guardado;
})();

// ── O filtro precisa achar quem COMEÇA férias no mês, não só quem
//    termina dentro dele ────────────────────────────────────────────
(function () {
  const ok = (nome, cond, detalhe) => {
    console.log(`${cond ? 'PASSOU' : 'FALHOU'}  ${nome}${detalhe ? ` · ${detalhe}` : ''}`);
    tudoOk &= cond;
  };
  const guardado = sandbox.window.eoFeriasAll;

  // Reproduz o que o painel mostrou: uma leva inteira de 05/08 a 03/09
  // (sobra de agosto) e, junto, períodos que começam em setembro.
  sandbox.window.eoFeriasAll = [
    { matricula: '160819', data_inicio: '2026-08-05', data_fim: '2026-09-03' },
    { matricula: '160590', data_inicio: '2026-08-05', data_fim: '2026-09-03' },
    { matricula: '170001', data_inicio: '2026-09-01', data_fim: '2026-09-30' },
    { matricula: '170002', data_inicio: '2026-09-15', data_fim: '2026-10-14' },
    { matricula: '170003', data_inicio: '2026-09-28', data_fim: '2026-10-27' },
  ];

  const naLista = (mes) => ['160819','160590','170001','170002','170003']
    .filter(m => sandbox.hcTemFeriasNoMes(m, mes));

  ok('setembro traz tanto a sobra de agosto quanto quem começa no mês',
    naLista('2026-09').length === 5, naLista('2026-09').join(', '));
  ok('quem começa 01/09 entra', sandbox.hcTemFeriasNoMes('170001', '2026-09'));
  ok('quem começa 28/09 e termina em outubro entra nos dois meses',
    sandbox.hcTemFeriasNoMes('170003', '2026-09') && sandbox.hcTemFeriasNoMes('170003', '2026-10'));
  ok('a sobra de agosto NÃO entra em outubro',
    !sandbox.hcTemFeriasNoMes('160819', '2026-10'));

  // Cada pessoa tem que exibir o SEU período, não o de outra — o painel
  // mostrou 21 linhas com o mesmo intervalo, e isso só é aceitável se o
  // dado for realmente igual.
  const p1 = sandbox.hcPeriodoNoMes('170001', '2026-09');
  const p2 = sandbox.hcPeriodoNoMes('170002', '2026-09');
  ok('cada matrícula devolve o próprio período',
    p1.ini === '2026-09-01' && p2.ini === '2026-09-15',
    `${p1.ini} / ${p2.ini}`);

  sandbox.window.eoFeriasAll = guardado;
})();

// ── HRCL107: separar o arquivo de Férias do de Absenteísmo ─────────
// Os dois saem do mesmo layout de relatório. A regra antiga olhava o
// cabeçalho e, como o de Férias TAMBÉM tem "Afastam.", "Situação" e "CID",
// mandava todo arquivo de férias pro importador errado.
(function () {
  const ok = (nome, cond, detalhe) => {
    console.log(`${cond ? 'PASSOU' : 'FALHOU'}  ${nome}${detalhe ? ` · ${detalhe}` : ''}`);
    tudoOk &= cond;
  };
  const fonte = fs.readFileSync(__dirname + '/../js/admin.js', 'utf8');
  const trecho = fonte.slice(fonte.indexOf('const ADM_HRCL107_SNIFF'), fonte.indexOf('function adminLoadEach'));
  // `const` no topo de um script do vm cria binding léxico, não vira
  // propriedade do global — por isso a exportação explícita.
  vm.runInContext(trecho + '\n;globalThis.ADM_HRCL107_SNIFF = ADM_HRCL107_SNIFF;', sandbox);
  const sniff = sandbox.ADM_HRCL107_SNIFF;

  // Cabeçalho REAL do arquivo do cliente — tem afastam, situa e cid.
  const cabecalho = ['Cadastro','Nome','Cargo','C.Horária','Filial','Admissão',
                     'Afastam.','Situação Afastamento','Dias','Término','CID','Observação'];
  const linhaFerias = (mat, ini, fim) =>
    [mat,'FULANO','AUX RAMPA','180:00','BEL','01/02/2013', ini, 2, '-', 'Férias', 30, fim];
  const linhaAusencia = (mat, motivo) =>
    [mat,'FULANO','AUX RAMPA','180:00','BEL','01/02/2013','01/09/2026', 5, '-', motivo, 3, '05/09/2026'];

  const arquivoFerias = [cabecalho,
    linhaFerias('160183','01/09/2026','30/09/2026'),
    linhaFerias('160815','01/09/2026','30/09/2026'),
    linhaFerias('160282','01/09/2026','30/09/2026')];
  const arquivoAusencia = [cabecalho,
    linhaAusencia('160183','Auxílio Doença'),
    linhaAusencia('160815','Acidente de Trabalho'),
    linhaAusencia('160282','Atestado Médico')];

  const rf = sniff.decidirPorLinhas(arquivoFerias);
  const ra = sniff.decidirPorLinhas(arquivoAusencia);
  ok('arquivo de férias vai pro importador de Férias', rf.fn === 'adminLoadFerias', rf.label);
  ok('arquivo de absenteísmo vai pro de Absenteísmo', ra.fn === 'adminLoadAbsenteismo', ra.label);
  ok('o cabeçalho sozinho não decide mais nada (os dois são idênticos)',
    rf.fn !== ra.fn);

  // Mistura com poucas linhas de férias não pode virar arquivo de férias.
  const misto = [cabecalho, linhaAusencia('1','Auxílio Doença'), linhaAusencia('2','Atestado'),
                 linhaAusencia('3','Acidente'), linhaFerias('4','01/09/2026','30/09/2026')];
  ok('minoria de linhas de férias continua sendo absenteísmo',
    sniff.decidirPorLinhas(misto).fn === 'adminLoadAbsenteismo');

  ok('arquivo sem linhas de dados devolve nulo', sniff.decidirPorLinhas([cabecalho]) === null);
  ok('nome do arquivo continua sendo reconhecido', sniff.test('hrcl107_setembro.xlsx'));
})();

// ── Regras de horário: saída e intervalo derivados da entrada ──────
(function () {
  const ok = (nome, cond, detalhe) => {
    console.log(`${cond ? 'PASSOU' : 'FALHOU'}  ${nome}${detalhe ? ` · ${detalhe}` : ''}`);
    tudoOk &= cond;
  };
  const saida = (e, ch) => sandbox.escalaSaidaCalculada(e, ch);
  const inter = (e, ch) => sandbox.escalaIntervaloPadraoPorCH(ch, e);

  // CH 180: 15 min de intervalo DENTRO da jornada — a saída não é
  // empurrada. Era daqui que vinham os 17:15 / 13:15 / 21:45 na tela.
  ok('CH 180 entrando 11:00 sai 17:00 (não 17:15)', saida('11:00', 180) === '17:00', saida('11:00',180));
  ok('CH 180 entrando 00:00 sai 06:00', saida('00:00', 180) === '06:00', saida('00:00',180));
  ok('CH 180 entrando 15:30 sai 21:30', saida('15:30', 180) === '21:30', saida('15:30',180));
  ok('nenhuma saída de CH 180 cai em minuto quebrado',
    ['01:00','07:00','11:00','15:30','23:45'].every(e => /:(00|30|45|15)$/.test(saida(e,180)) &&
      saida(e,180).slice(3) === e.slice(3)));

  // CH 210: 1h de intervalo fora da jornada — a saída anda 8h.
  ok('CH 210 entrando 22:00 sai 06:00', saida('22:00', 210) === '06:00', saida('22:00',210));
  ok('CH 210 entrando 11:00 sai 19:00', saida('11:00', 210) === '19:00', saida('11:00',210));

  // Intervalo começa sempre 2h depois da entrada.
  ok('intervalo do CH 180 começa 2h após a entrada e dura 15min',
    inter('11:00', 180) === '13:00-13:15', inter('11:00',180));
  ok('intervalo do CH 210 começa 2h após a entrada e dura 1h',
    inter('22:00', 210) === '00:00-01:00', inter('22:00',210));
  ok('intervalo vira o dia sem estourar 24h',
    inter('23:00', 180) === '01:00-01:15', inter('23:00',180));

  // O exemplo que o cliente deu: mover a entrada move tudo junto.
  ok('mudar 11:00 para 11:30 leva a saída de 17:00 pra 17:30',
    saida('11:00',180) === '17:00' && saida('11:30',180) === '17:30');
  ok('e o intervalo acompanha (13:00 → 13:30)',
    inter('11:00',180) === '13:00-13:15' && inter('11:30',180) === '13:30-13:45');

  // Cores trocadas na grade.
  const alvo = sandbox.window._escalaColabs[0];
  alvo.entrada_manual = '11:00';
  alvo.saida_manual = '17:00';
  sandbox.window.eoColabs.set(alvo.matricula, { nome: alvo.nome, funcao: 'AUX', ch: '180' });
  const html = sandbox.escalaGradeTabelaHTML(ANO, MES, DIAS);
  ok('entrada usa a cor de destaque', /entrada&#39;|entrada'/.test(html) && html.includes("color:#f6ad55;font-weight:600"));
  ok('saída sem divergência fica discreta', html.includes('>17:00<'));
})();

// ── Cobertura por grupo + turno ────────────────────────────────────
(function () {
  const ok = (nome, cond, detalhe) => {
    console.log(`${cond ? 'PASSOU' : 'FALHOU'}  ${nome}${detalhe ? ` · ${detalhe}` : ''}`);
    tudoOk &= cond;
  };
  const guardadoFer = sandbox.window.eoFeriasAll;
  const guardadoDias = sandbox.window._escalaDias;
  sandbox.window.eoFeriasAll = [];
  sandbox.window._escalaDias = new Map();
  sandbox.window._escalaFatorPiso = 0.85;

  const colabs = sandbox.window._escalaColabs;
  const DIAS31 = 31;
  const modelo = sandbox.escalaModeloCobertura(colabs, 2026, 1, DIAS31);

  ok('modelo separa por grupo E turno, não só por grupo',
    modelo.grupos.size > 1 && [...modelo.grupos.keys()].every(k => k.includes('||')),
    `${modelo.grupos.size} recorte(s)`);

  ok('todo grupo tem piso de pelo menos 1 pessoa por dia',
    [...modelo.piso.values()].every(dias => dias.length === DIAS31 && dias.every(v => v >= 1)));

  // O piso tem que ficar ABAIXO do efetivo, senão não sobra folga nenhuma.
  ok('piso fica abaixo do efetivo do grupo',
    [...modelo.grupos.entries()].every(([chave, g]) =>
      modelo.piso.get(chave).every(v => v <= g.membros.length)));

  // Fator mais rígido = piso mais alto. É a alavanca que o gestor controla.
  sandbox.window._escalaFatorPiso = 0.95;
  const rigido = sandbox.escalaModeloCobertura(colabs, 2026, 1, DIAS31);
  sandbox.window._escalaFatorPiso = 0.75;
  const flexivel = sandbox.escalaModeloCobertura(colabs, 2026, 1, DIAS31);
  const soma = (m) => [...m.piso.values()].flat().reduce((a, b) => a + b, 0);
  ok('piso rígido exige mais gente que o flexível',
    soma(rigido) > soma(flexivel), `${soma(rigido)} vs ${soma(flexivel)}`);
  sandbox.window._escalaFatorPiso = 0.85;

  ok('fator fora da faixa é limitado a 0..1', (() => {
    sandbox.window._escalaFatorPiso = 5;   const alto = sandbox.escalaFatorPiso();
    sandbox.window._escalaFatorPiso = -2;  const baixo = sandbox.escalaFatorPiso();
    sandbox.window._escalaFatorPiso = 0.85;
    return alto === 1 && baixo === 0;
  })());

  // Disponíveis tem que descontar folga, férias, afastado e compensação.
  const chave = [...modelo.grupos.keys()][0];
  const membros = modelo.grupos.get(chave).membros;
  const cheio = sandbox.escalaDisponiveisNoDia(membros, 5, 2026, 1, sandbox.window._escalaDias);
  ok('com ninguém de folga, todos contam como disponíveis', cheio === membros.length);

  ['F','FA','J','CH'].forEach(st => {
    const mapa = new Map([[`${membros[0].matricula}|5`, { status: st }]]);
    ok(`status ${st} sai da contagem de disponíveis`,
      sandbox.escalaDisponiveisNoDia(membros, 5, 2026, 1, mapa) === membros.length - 1);
  });

  // Curso (K) NÃO é folga — a pessoa segue indisponível pra operação? Não:
  // pela regra do painel, K continua sendo dia de trabalho.
  const comCurso = new Map([[`${membros[0].matricula}|5`, { status: 'K' }]]);
  ok('curso (K) continua contando como disponível',
    sandbox.escalaDisponiveisNoDia(membros, 5, 2026, 1, comCurso) === membros.length);

  sandbox.window.eoFeriasAll = [{ matricula: membros[0].matricula, data_inicio: '2026-01-01', data_fim: '2026-01-31' }];
  ok('quem está de férias sai da contagem de disponíveis',
    sandbox.escalaDisponiveisNoDia(membros, 5, 2026, 1, new Map()) === membros.length - 1);

  sandbox.window.eoFeriasAll = guardadoFer;
  sandbox.window._escalaDias = guardadoDias;
})();

// ── Regras duras da folga: 6x1, nada colado, domingo ───────────────
// Outubro/2026: 31 dias, começa quinta. Domingos: 4, 11, 18, 25.
(function () {
  const ok = (nome, cond, detalhe) => {
    console.log(`${cond ? 'PASSOU' : 'FALHOU'}  ${nome}${detalhe ? ` · ${detalhe}` : ''}`);
    tudoOk &= cond;
  };
  const val = (dias) => sandbox.escalaValidarRegrasFolga(new Set(dias), 2026, 10, 31);
  const DOM = [4, 11, 18, 25];
  ok('outubro/2026 tem domingo em 4, 11, 18 e 25',
    DOM.every(d => new Date(2026, 9, d).getDay() === 0));

  // 6x1
  ok('7 dias seguidos trabalhando é reprovado', val([8, 16]).ok === false, `seq=${val([8,16]).maxSequencia}`);
  ok('exatamente 6 seguidos passa', val([7, 14, 21, 28, 4]).maxSequencia <= 6);

  // Folgas coladas
  ok('duas folgas coladas são reprovadas', val([4, 5, 12, 19, 26]).coladas === 1);
  ok('folgas separadas não acusam colagem', val([4, 11, 18, 25]).coladas === 0);

  // Domingo
  ok('dois domingos são reprovados', val([4, 11, 15, 22, 29]).ok === false, `dom=${val([4,11,15,22,29]).domingos}`);
  ok('um domingo é o esperado', val([4, 9, 15, 21, 27]).domingos === 1);

  // O caso do print: 5 folgas, todas em sexta, nenhum domingo. As regras
  // duras passam (o mínimo de 1 domingo é garantido à parte), mas a rede
  // de segurança tem que corrigir.
  const sextas = [2, 9, 16, 23, 30];
  ok('5 sextas não violam 6x1 nem colagem', val(sextas).ok === true);
  ok('...mas ficam com zero domingo', val(sextas).domingos === 0);

  const c = { matricula: 'T001' };
  const mapa = new Map(sextas.map(d => [`T001|${d}`, { status: 'F' }]));
  const guardadoFer = sandbox.window.eoFeriasAll;
  sandbox.window.eoFeriasAll = [];
  const r = sandbox.escalaGarantirDomingoDeFolga([c], 2026, 10, 31, mapa,
    (matricula, dia) => ({ matricula, dia, status: 'F', origem: 'auto' }));

  ok('rede de segurança cria exatamente 1 domingo', r.criados.length === 1,
    r.criados.map(x => x.dia).join(','));
  ok('o dia criado é mesmo um domingo', DOM.includes(r.criados[0]?.dia), String(r.criados[0]?.dia));

  const depois = sandbox.escalaFolgasDoColab(c, 2026, 10, 31, mapa);
  const vDepois = sandbox.escalaValidarRegrasFolga(depois, 2026, 10, 31);
  ok('depois da rede, todas as regras duras continuam válidas', vDepois.ok === true);
  ok('e a pessoa passa a ter 1 domingo', vDepois.domingos === 1);

  // Quem já tem domingo não ganha outro.
  const mapa2 = new Map([[`T002|4`, { status: 'F' }], [`T002|12`, { status: 'F' }]]);
  const r2 = sandbox.escalaGarantirDomingoDeFolga([{ matricula: 'T002' }], 2026, 10, 31, mapa2,
    (matricula, dia) => ({ matricula, dia, status: 'F' }));
  ok('quem já tem domingo não ganha um segundo', r2.criados.length === 0);

  // Férias caindo em domingo JÁ contam como domingo de descanso — a pessoa
  // não trabalha nesse dia, então não precisa de folga extra.
  sandbox.window.eoFeriasAll = [{ matricula: 'T003', data_inicio: '2026-10-01', data_fim: '2026-10-07' }];
  const r3 = sandbox.escalaGarantirDomingoDeFolga([{ matricula: 'T003' }], 2026, 10, 31, new Map(),
    (matricula, dia) => ({ matricula, dia, status: 'F' }));
  ok('férias cobrindo um domingo já satisfazem a regra',
    r3.criados.length === 0 && !r3.semDomingo.includes('T003'));
  sandbox.window.eoFeriasAll = [];

  // Agora o caso sem saída: todo domingo já ocupado por curso (K), que
  // ocupa o dia mas NÃO é folga. Aqui tem que reportar, não inventar.
  const mapa3 = new Map(DOM.map(d => [`T004|${d}`, { status: 'K' }]));
  const r4 = sandbox.escalaGarantirDomingoDeFolga([{ matricula: 'T004' }], 2026, 10, 31, mapa3,
    (matricula, dia) => ({ matricula, dia, status: 'F' }));
  ok('sem domingo livre, reporta em vez de inventar',
    r4.criados.length === 0 && r4.semDomingo.includes('T004'),
    `criados=${r4.criados.length} semDomingo=${r4.semDomingo.join(',')}`);

  sandbox.window.eoFeriasAll = guardadoFer;
})();

process.exit(tudoOk ? 0 : 1);
