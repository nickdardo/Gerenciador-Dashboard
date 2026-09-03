// ══════════════════════════════════════════════════════
// ESCALA ONLINE — grade mensal (colaborador × dia)
//
// Separado de pages.js: eram 3.037 das 3.520 linhas do arquivo, e o nome
// "pages.js" não dava nenhuma pista de que a Escala morava ali. Carregado
// pelo index.html ANTES de pages.js, porque app.js chama pageEscala().
//
// Não confundir com _legacy/escala-online.js, que é a versão antiga e
// não roda mais.
// ══════════════════════════════════════════════════════

function escalaIcone(nome) {
  const icones = {
    users:  `<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>`,
    zap:    `<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>`,
    calendarPlus: `<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="12" y1="14" x2="12" y2="18"/><line x1="10" y1="16" x2="14" y2="16"/>`,
    trash:  `<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>`,
    sort:   `<path d="M8 9l4-4 4 4"/><path d="M16 15l-4 4-4-4"/>`,
    calclock: `<path d="M3 3v5h5"/><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"/><path d="M12 7v5l4 2"/>`,
    download: `<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>`,
    upload: `<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>`,
    layers: `<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>`,
    lock: `<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>`,
    unlock: `<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>`,
    columns: `<rect x="3" y="3" width="7" height="18" rx="1"/><rect x="14" y="3" width="7" height="18" rx="1"/>`,
    moreHorizontal: `<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>`,
    chevronDown: `<path d="m6 9 6 6 6-6"/>`,
    chevronUp: `<path d="m6 15 6-6 6 6"/>`,
    arrowRight: `<line x1="4" y1="12" x2="19" y2="12"/><polyline points="13 6 19 12 13 18"/>`,
    plane: `<path d="M17.8 19.2 16 11l3.5-3.5a2.1 2.1 0 0 0-3-3L13 8 4.8 6.2a1 1 0 0 0-1 1.6L8 11l-1.5 3H4l-1 2 3.5 1L8 20.5l2-1v-2.5l3-1.5 3.2 4.2a1 1 0 0 0 1.6-1z"/>`,
    printer: `<polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8" rx="1"/>`,
    sheet: `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>`,
    alert: `<path d="M10.3 3.6 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>`,
    check: `<circle cx="12" cy="12" r="10"/><polyline points="8.5 12.5 11 15 16 9.5"/>`,
  };
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:5px" aria-hidden="true">${icones[nome]||''}</svg>`;
}

// Mesmo catálogo de ícones, mas sem margem à direita e com tamanho livre —
// pra usar solto dentro de texto (setas de ordenação, avisos), onde o
// espaçamento de botão não serve.
function escalaIconeSolto(nome, tamanho) {
  const svg = escalaIcone(nome);
  const px = tamanho || 11;
  return svg
    .replace('width="14" height="14"', `width="${px}" height="${px}"`)
    .replace('margin-right:5px', 'margin-right:0');
}

async function pageEscala(el) {
  el.innerHTML = `
    <div class="page-header"><div>
      <h1 class="page-title">Escala Online</h1>
      <p class="page-sub">Calendário mensal · preenchimento e folgas</p>
    </div></div>
    <div class="adm-empty-state">
      <i class="ti ti-loader-2" style="font-size:32px;opacity:.4;animation:spin 1s linear infinite" aria-hidden="true"></i>
      <p>Carregando...</p>
    </div>`;

  const role = currentUserProfile?.role;
  const myBases = (currentUserProfile?.bases || []).filter(b => b !== '*');
  const isAdmin = role === 'admin';

  if (typeof hcEnsureData === 'function') await hcEnsureData();
  else if (typeof adhEnsureRoster === 'function') await adhEnsureRoster();
  const bases = isAdmin ? (typeof hcAllBases === 'function' ? hcAllBases() : []) : myBases;

  if (!bases.length) {
    el.innerHTML = `
      <div class="page-header"><div>
        <h1 class="page-title">Escala Online</h1>
        <p class="page-sub">Acesso restrito</p>
      </div></div>
      <div class="adh-denied">
        <i class="ti ti-map-pin-off" style="font-size:36px;opacity:.2" aria-hidden="true"></i>
        <p>Nenhuma base atribuída ao seu usuário.<br>Fale com o admin pra configurar seu acesso.</p>
      </div>`;
    return;
  }

  if (window._escalaBase === undefined || !bases.includes(window._escalaBase)) {
    // Prioridade: localStorage (instantâneo, sempre funciona) > perfil no
    // banco (funciona entre dispositivos, mas depende da coluna existir) >
    // base vinda de outro módulo (Gerador) > primeira base disponível.
    let baseLocal = null;
    try { baseLocal = localStorage.getItem('gde_escala_ultima_base'); } catch (_) {}
    const baseSalva = baseLocal || currentUserProfile?.escala_ultima_base;
    window._escalaBase = (baseSalva && bases.includes(baseSalva)) ? baseSalva
      : (window._genBase && bases.includes(window._genBase)) ? window._genBase : bases[0];
  }
  if (!window._escalaMes) {
    let mesLocal = null;
    try { mesLocal = localStorage.getItem('gde_escala_ultimo_mes'); } catch (_) {}
    window._escalaMes = mesLocal || currentUserProfile?.escala_ultimo_mes || window._genMes || (typeof adhCurrentMonth === 'function' ? adhCurrentMonth() : null);
  }
  if (!window._escalaDiaSelecionado) window._escalaDiaSelecionado = 1;
  if (window._escalaAgruparPorTurno === undefined) {
    let agruparLocal = null;
    try { agruparLocal = localStorage.getItem('gde_escala_agrupar'); } catch (_) {}
    window._escalaAgruparPorTurno = agruparLocal === '1';
  }
  if (window._escalaOrdemColuna === undefined) {
    try { window._escalaOrdemColuna = localStorage.getItem('gde_escala_ordem_coluna') || null; } catch (_) { window._escalaOrdemColuna = null; }
  }
  if (window._escalaOrdemDirecao === undefined) {
    try { window._escalaOrdemDirecao = localStorage.getItem('gde_escala_ordem_direcao') || 'asc'; } catch (_) { window._escalaOrdemDirecao = 'asc'; }
  }
  if (window._escalaGruposVisiveis === undefined) {
    try {
      const salvo = localStorage.getItem('gde_escala_grupos_visiveis');
      const lista = salvo ? JSON.parse(salvo) : null;
      window._escalaGruposVisiveis = (lista && lista.length) ? new Set(lista) : null;
    } catch (_) { window._escalaGruposVisiveis = null; }
  }
  if (window._escalaBlocosRecolhidos === undefined) {
    let recolhidoLocal = null;
    try { recolhidoLocal = localStorage.getItem('gde_escala_blocos_recolhidos'); } catch (_) {}
    window._escalaBlocosRecolhidos = recolhidoLocal === '1';
  }
  if (window._escalaColunasSecundarias === undefined) {
    let secLocal = null;
    try { secLocal = localStorage.getItem('gde_escala_colunas_secundarias'); } catch (_) {}
    window._escalaColunasSecundarias = secLocal !== '0'; // mostrado por padrão, só esconde se a pessoa já escolheu esconder antes
  }
  if (window._escalaCriterioSubBloco === undefined) {
    let critLocal = null;
    try { critLocal = localStorage.getItem('gde_escala_criterio_subbloco'); } catch (_) {}
    const valido = ESCALA_CRITERIOS_SUBBLOCO.some(c => c.valor === critLocal);
    window._escalaCriterioSubBloco = valido ? critLocal : 'turno'; // Turno automático funciona sem ninguém cadastrar nada
  }
  if (window._escalaDensidade === undefined) {
    let densLocal = null;
    try { densLocal = localStorage.getItem('gde_escala_densidade'); } catch (_) {}
    window._escalaDensidade = densLocal === 'compacto' ? 'compacto' : 'confortavel';
  }

  await escalaRenderGrade(el);
}

function escalaMesOptionsHTML(mesAtualSelecionado) {
  const hoje = new Date();
  const opts = [];
  for (let i = -1; i < 4; i++) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth()+i, 1);
    opts.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);
  }
  const atual = `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}`;
  if (!opts.includes(mesAtualSelecionado)) opts.unshift(mesAtualSelecionado);
  return opts.map(m => `<option value="${m}" ${m===mesAtualSelecionado?'selected':''}>${typeof adhMonthLabel==='function'?adhMonthLabel(m):m}${m===atual?' (atual)':''}</option>`).join('');
}

// Busca a malha de voos paginando de 1000 em 1000 — o Supabase corta em
// 1000 linhas por padrão numa consulta só, então sem isso bases com mais de
// 1000 voos no mês perdiam o resto (a curva caía de repente na hora em que
// batia o limite, e o total do mês ficava travado em "1.000" redondo).
async function escalaFetchMalha(base, mesInicioStr, mesFimStr, campos) {
  const { count } = await db.from('malha').select('*', { count: 'exact', head: true })
    .eq('base', base).gte('data', mesInicioStr).lte('data', mesFimStr);
  const todas = [];
  const PAGE = 1000;
  for (let from = 0; from < (count || 0); from += PAGE) {
    const { data, error } = await db.from('malha').select(campos)
      .eq('base', base).gte('data', mesInicioStr).lte('data', mesFimStr)
      .range(from, from + PAGE - 1);
    if (error) { console.warn('[escala] malha:', error.message); break; }
    if (data) todas.push(...data);
  }
  return todas;
}

// Mesmo problema, mesmo remédio, agora pra escala_dia (F/FA/J/K/CH de cada
// colaborador em cada dia): sem paginar, uma base com bastante gente e
// bastante marcação no mês passa fácil de 1000 linhas, e o Supabase corta o
// resto sem avisar — a marcação continua salva no banco, só não volta na
// consulta. Achado ao investigar folgas que "sumiam" mesmo depois de
// confirmadas salvas direto na tabela.
async function escalaFetchDias(base, mes) {
  const { count } = await db.from('escala_dia').select('*', { count: 'exact', head: true })
    .eq('base', base).eq('mes', mes);
  const todas = [];
  const PAGE = 1000;
  for (let from = 0; from < (count || 0); from += PAGE) {
    const { data, error } = await db.from('escala_dia').select('*')
      .eq('base', base).eq('mes', mes)
      .range(from, from + PAGE - 1);
    if (error) { console.warn('[escala] escala_dia:', error.message); break; }
    if (data) todas.push(...data);
  }
  return todas;
}

async function escalaRenderDash(el) {
  const base = window._escalaBase;
  const mes  = window._escalaMes;
  const role = currentUserProfile?.role;
  const myBases = (currentUserProfile?.bases || []).filter(b => b !== '*');
  const isAdmin = role === 'admin';
  const bases = isAdmin ? (typeof hcAllBases === 'function' ? hcAllBases() : []) : myBases;

  const [ano, mesNum] = mes.split('-').map(Number);
  const diasNoMes = new Date(ano, mesNum, 0).getDate();
  const primeiroDiaSemana = new Date(ano, mesNum-1, 1).getDay();
  const mesInicioStr = `${mes}-01`;
  const mesFimStr = `${mes}-${String(diasNoMes).padStart(2,'0')}`;

  // ── Motor de demanda real: voos de verdade da malha + parâmetros de solo ──
  const { data: paramRows } = await db.from('escala_parametro_solo')
    .select('*').in('base', [base, '']).eq('ativo', true);
  const parametrosEfetivos = escalaMesclarParametros(paramRows || [], base);

  const voosRows = await escalaFetchMalha(base, mesInicioStr, mesFimStr, 'data,tipo,cia,hora_chegada,hora_saida');

  let demandaPorDia = null; // Map<dia(1-31), Map<funcao, array(48) de 30min>>
  if (parametrosEfetivos.length && voosRows?.length) {
    const voosPorDia = new Map();
    voosRows.forEach(v => {
      const dia = parseInt(v.data.slice(8,10), 10);
      if (!voosPorDia.has(dia)) voosPorDia.set(dia, []);
      voosPorDia.get(dia).push(v);
    });
    demandaPorDia = new Map();
    for (const [dia, voosDoDia] of voosPorDia) {
      demandaPorDia.set(dia, escalaDemandaDoDia(voosDoDia, parametrosEfetivos));
    }
  }

  // ── Reserva: dimensionamento estático do Gerador (só se o motor real não tiver dado) ──
  let linhasEstaticas = [];
  if (!demandaPorDia) {
    const { data } = await db.from('escala_dimensionamento').select('*').eq('base', base).eq('mes', mes).order('entrada');
    linhasEstaticas = data || [];
  }

  window._escalaDemandaPorDia = demandaPorDia;
  window._escalaLinhasEstaticas = linhasEstaticas;
  window._escalaModoReal = !!demandaPorDia;

  const semDados = !demandaPorDia && !linhasEstaticas.length;
  const funcoesUnicas = demandaPorDia
    ? new Set([...demandaPorDia.values()].flatMap(m => [...m.keys()])).size
    : new Set(linhasEstaticas.map(r=>r.funcao)).size;
  const picoDoMes = demandaPorDia
    ? Math.max(0, ...[...demandaPorDia.keys()].map(d => escalaPicoDoDia(d)))
    : linhasEstaticas.reduce((s,r)=>s+r.qtd, 0);

  el.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Escala Online</h1>
        <p class="page-sub">Calendário mensal · ${base} · ${typeof adhMonthLabel==='function'?adhMonthLabel(mes):mes}${demandaPorDia?' · demanda real (malha de voos)':''}</p>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        ${bases.length>1
          ? `<select class="adh-month-select" onchange="escalaSetBase(this.value)">${bases.map(b=>`<option value="${b}" ${b===base?'selected':''}>${b}</option>`).join('')}</select>`
          : `<span class="adh-base-badge">${base||'—'}</span>`}
        <select class="adh-month-select" onchange="escalaSetMes(this.value)">${escalaMesOptionsHTML(mes)}</select>
      </div>
    </div>

    ${semDados ? `
      <div class="adh-denied">
        <i class="ti ti-calendar-off" style="font-size:36px;opacity:.2" aria-hidden="true"></i>
        <p>Nenhum dado ainda pra <strong>${base}</strong> em <strong>${typeof adhMonthLabel==='function'?adhMonthLabel(mes):mes}</strong>.<br>
          Configure os <a href="#" onclick="navigateTo('admin')" style="color:#00a0d2">Parâmetros de Solo</a> e confira se a
          <a href="#" onclick="navigateTo('admin')" style="color:#00a0d2">Malha aérea</a> desse mês já foi carregada —
          ou gere um dimensionamento no <a href="#" onclick="navigateTo('gerador')" style="color:#00a0d2">Gerador</a> como alternativa.</p>
      </div>
    ` : `
      ${!demandaPorDia ? `
        <div style="font-size:11.5px;color:#f6ad55;background:rgba(201,162,74,.08);border:1px solid rgba(201,162,74,.25);border-radius:8px;padding:10px 14px;margin-bottom:16px">
          Mostrando o padrão estático do Gerador (mesma coisa todo dia). Pra ver a demanda real dia a dia, configure os
          <a href="#" onclick="navigateTo('admin')" style="color:#00a0d2">Parâmetros de Solo</a> pra essa base e confirme que a Malha aérea desse mês já está carregada.
        </div>` : ''}

      ${typeof adhKpiCardsHTML === 'function' ? adhKpiCardsHTML([
        { key:'blue', icon:'ti-users', title:'Necessidade de pessoal', rows: [
          { label: demandaPorDia?'Pico do mês':'Posições por dia', sub: demandaPorDia?'maior demanda simultânea num único dia':'mesmo padrão em todos os dias do mês', value: Math.round(picoDoMes*10)/10 },
          { label:'Funções distintas', sub:'variedade de cargos', value: String(funcoesUnicas) },
        ]},
      ]) : ''}

      <div style="display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap">
        <div class="hc-panel" style="flex:2;min-width:440px">
          <div class="hc-panel-title">${typeof adhMonthLabel==='function'?adhMonthLabel(mes):mes}</div>
          ${escalaCalendarioHTML(ano, mesNum, diasNoMes, primeiroDiaSemana)}
        </div>
        <div class="hc-panel" style="flex:1;min-width:320px" id="escala-dia-detalhe">
          ${escalaDetalheDiaHTML(window._escalaDiaSelecionado)}
        </div>
      </div>
    `}
  `;
}

// ── Motor de demanda horária — puxa da malha de voos real + parâmetros de solo ──

// Janela de tempo (em minutos do dia, 0-1439) em que uma função fica ocupada
// por causa de um voo, de acordo com a referência configurada. Recorta em
// [0,1439) — não trata virada de dia por enquanto (simplificação da v1).
function escalaJanela(voo, param) {
  const chegada = typeof malhaMinutos==='function' ? malhaMinutos(voo.hora_chegada) : null;
  const saida   = typeof malhaMinutos==='function' ? malhaMinutos(voo.hora_saida)   : null;
  let inicio, fim;
  if (param.referencia === 'chegada') {
    if (chegada == null) return null;
    inicio = chegada - param.min_antes_chegada;
    fim    = chegada + param.min_depois_saida;
  } else if (param.referencia === 'saida') {
    if (saida == null) return null;
    inicio = saida - param.min_antes_chegada;
    fim    = saida + param.min_depois_saida;
  } else { // 'ambos' — turnaround completo
    if (chegada == null || saida == null) return null;
    inicio = chegada - param.min_antes_chegada;
    fim    = saida + param.min_depois_saida;
  }
  return { inicio, fim };
}

// Junta os parâmetros "padrão" (base='') com os específicos da base ativa —
// os específicos sobrescrevem o padrão quando existem pra mesma função+categoria.
function escalaMesclarParametros(rows, baseAtiva) {
  const porChave = new Map();
  rows.filter(r => r.base === '').forEach(r => porChave.set(r.funcao+'|'+r.categoria, r));
  rows.filter(r => r.base === baseAtiva && baseAtiva).forEach(r => porChave.set(r.funcao+'|'+r.categoria, r));
  return [...porChave.values()];
}

// Demanda de um dia: pra cada voo, descobre a categoria da aeronave e aplica
// o parâmetro certo de cada função (o específico da categoria tem prioridade
// sobre o "Geral"), somando pessoas em cada slot de 30min da janela.
function escalaDemandaDoDia(voosDoDia, parametrosEfetivos) {
  const porFuncao = new Map();
  const paramsPorFuncao = new Map();
  parametrosEfetivos.forEach(p => {
    if (!paramsPorFuncao.has(p.funcao)) paramsPorFuncao.set(p.funcao, []);
    paramsPorFuncao.get(p.funcao).push(p);
  });

  voosDoDia.forEach(voo => {
    const categoria = typeof escalaCategoriaDoVoo === 'function' ? escalaCategoriaDoVoo(voo.tipo, voo.cia) : null;
    for (const [funcao, params] of paramsPorFuncao) {
      let usar = categoria ? params.find(p => p.categoria === categoria) : null;
      if (!usar) usar = params.find(p => p.categoria === '');
      if (!usar) continue;

      const janela = escalaJanela(voo, usar);
      if (!janela) continue;

      if (!porFuncao.has(funcao)) porFuncao.set(funcao, new Array(48).fill(0));
      const arr = porFuncao.get(funcao);
      const iniSlot = Math.max(0, Math.floor(janela.inicio/30));
      const fimSlot = Math.min(47, Math.ceil(janela.fim/30));
      for (let s = iniSlot; s <= fimSlot; s++) arr[s] += usar.qtd_por_voo;
    }
  });

  return porFuncao;
}

// Pico de pessoas simultâneas (somando todas as funções) num dia específico.
function escalaPicoDoDia(dia) {
  if (window._escalaDemandaPorDia) {
    const porFuncao = window._escalaDemandaPorDia.get(dia);
    if (!porFuncao) return 0;
    let pico = 0;
    for (let slot = 0; slot < 48; slot++) {
      let soma = 0;
      for (const arr of porFuncao.values()) soma += arr[slot];
      if (soma > pico) pico = soma;
    }
    return Math.round(pico*10)/10;
  }
  return (window._escalaLinhasEstaticas || []).reduce((s,r)=>s+r.qtd, 0);
}

// Demanda de pessoal quebrada nos 4 turnos padrão de 6h (A 00-06h, B 06-12h,
// C 12-18h, D 18-00h) — cada slot da grade de 30min (0-47) cai num turno:
// slots 0-11=A, 12-23=B, 24-35=C, 36-47=D.
const ESCALA_TURNOS = [
  { nome:'A', label:'00-06h', slotIni:0,  slotFim:11, cor:'#38bdf8' },
  { nome:'B', label:'06-12h', slotIni:12, slotFim:23, cor:'#5fa87a' },
  { nome:'C', label:'12-18h', slotIni:24, slotFim:35, cor:'#f6ad55' },
  { nome:'D', label:'18-00h', slotIni:36, slotFim:47, cor:'#c9a24a' },
];

function escalaDemandaPorTurno(dia) {
  const porFuncao = window._escalaDemandaPorDia?.get(dia);
  if (!porFuncao) return ESCALA_TURNOS.map(() => 0);
  return ESCALA_TURNOS.map(t => {
    let pico = 0;
    for (let slot = t.slotIni; slot <= t.slotFim; slot++) {
      let soma = 0;
      for (const arr of porFuncao.values()) soma += arr[slot];
      if (soma > pico) pico = soma;
    }
    return Math.round(pico*10)/10;
  });
}

function escalaCalendarioHTML(ano, mesNum, diasNoMes, primeiroDiaSemana) {
  const diasLbl = ['dom','seg','ter','qua','qui','sex','sáb'];
  const diaSel = window._escalaDiaSelecionado || 1;
  let cells = '';
  for (let i = 0; i < primeiroDiaSemana; i++) cells += `<div class="escala-cel escala-cel-vazia"></div>`;
  for (let d = 1; d <= diasNoMes; d++) {
    const dow = new Date(ano, mesNum-1, d).getDay();
    const finalDeSemana = dow === 0 || dow === 6;
    const ativo = d === diaSel;
    const pico = escalaPicoDoDia(d);
    cells += `
      <div class="escala-cel ${ativo?'escala-cel-ativa':''} ${finalDeSemana?'escala-cel-fds':''}" onclick="escalaSelecionarDia(${d}, this)">
        <div class="escala-cel-dia">${d}</div>
        <div class="escala-cel-qtd">${pico}</div>
      </div>`;
  }
  return `
    <div class="escala-grade-semana">${diasLbl.map(d=>`<div>${d}</div>`).join('')}</div>
    <div class="escala-grade">${cells}</div>
    <div style="font-size:10px;color:var(--text-muted);margin-top:10px">
      ${window._escalaModoReal
        ? 'Pico de pessoas simultâneas necessárias naquele dia, calculado a partir dos voos reais da malha + parâmetros de solo.'
        : 'O mesmo padrão de posições se repete em todos os dias por enquanto (dado estático do Gerador) — configure os Parâmetros de Solo pra ver a demanda real por dia.'}
    </div>
  `;
}

function escalaDetalheDiaHTML(dia) {
  if (window._escalaModoReal) {
    const porFuncao = window._escalaDemandaPorDia.get(dia);
    if (!porFuncao || !porFuncao.size) {
      return `<div class="hc-panel-title">Dia ${String(dia).padStart(2,'0')}</div><div style="color:var(--text-muted);font-size:12px;padding:16px 0;text-align:center">Sem voos nesse dia.</div>`;
    }
    const linhas = [...porFuncao.entries()].map(([funcao, arr]) => {
      let pico = 0, picoSlot = 0;
      arr.forEach((v,i) => { if (v>pico) { pico=v; picoSlot=i; } });
      const totalMin = picoSlot*30, h = Math.floor(totalMin/60), m = totalMin%60;
      return { funcao, pico: Math.round(pico*10)/10, hora: `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}` };
    }).sort((a,b)=>b.pico-a.pico);

    return `
      <div class="hc-panel-title">Dia ${String(dia).padStart(2,'0')} · pico de pessoas por função</div>
      <table style="width:100%;font-size:12px;border-collapse:collapse">
        ${linhas.map(l => `
          <tr>
            <td style="padding:5px 0;color:var(--text-primary)">${l.funcao}</td>
            <td style="padding:5px 0;color:var(--text-muted);text-align:right;white-space:nowrap">pico ${l.hora}</td>
            <td style="padding:5px 0;color:var(--text-secondary);text-align:right;width:34px;font-weight:700">${l.pico}</td>
          </tr>`).join('')}
      </table>
      <div style="font-size:10px;color:var(--text-muted);margin-top:10px">Calculado a partir dos voos reais desse dia + parâmetros de solo cadastrados.</div>
    `;
  }

  const linhas = window._escalaLinhasEstaticas || [];
  const grupos = { 'Madrugada':[], 'Manhã':[], 'Tarde':[], 'Noite':[] };
  linhas.forEach(r => {
    const h = parseInt(String(r.entrada).split(':')[0], 10) || 0;
    const per = h<6 ? 'Madrugada' : h<12 ? 'Manhã' : h<18 ? 'Tarde' : 'Noite';
    grupos[per].push(r);
  });
  return `
    <div class="hc-panel-title">Dia ${String(dia).padStart(2,'0')} · posições necessárias (padrão)</div>
    ${Object.entries(grupos).filter(([,l])=>l.length).map(([per,l]) => `
      <div style="margin-bottom:14px">
        <div style="font-size:10.5px;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:6px">${per}</div>
        <table style="width:100%;font-size:12px;border-collapse:collapse">
          ${l.sort((a,b)=>String(a.entrada).localeCompare(String(b.entrada))).map(r => `
            <tr>
              <td style="padding:4px 0;color:var(--text-primary)">${r.funcao}</td>
              <td style="padding:4px 0;color:var(--text-muted);text-align:right;white-space:nowrap">${r.entrada}–${r.saida}</td>
              <td style="padding:4px 0;color:var(--text-secondary);text-align:right;width:34px">×${r.qtd}</td>
            </tr>`).join('')}
        </table>
      </div>`).join('') || `<div style="color:var(--text-muted);font-size:12px;padding:16px 0;text-align:center">Sem posições nesse dia.</div>`}
  `;
}

function escalaSelecionarDia(dia, elCel) {
  window._escalaDiaSelecionado = dia;
  document.querySelectorAll('.escala-cel').forEach(c => c.classList.remove('escala-cel-ativa'));
  if (elCel) elCel.classList.add('escala-cel-ativa');
  const det = document.getElementById('escala-dia-detalhe');
  if (det) det.innerHTML = escalaDetalheDiaHTML(dia);
}

function escalaSetBase(base) {
  window._escalaBase = base;
  window._escalaDiaSelecionado = 1;
  escalaSalvarUltimaTela(base, window._escalaMes);
  escalaRenderGrade(document.getElementById('page-content'));
}

function escalaSetMes(mes) {
  window._escalaMes = mes;
  window._escalaDiaSelecionado = 1;
  escalaSalvarUltimaTela(window._escalaBase, mes);
  escalaRenderGrade(document.getElementById('page-content'));
}

// Grava qual base/mês esse usuário estava vendo por último, pra um F5 (ou
// entrar de novo depois) voltar exatamente onde parou. Grava em DOIS
// lugares: localStorage (instantâneo, funciona mesmo se a coluna no banco
// não existir) e no perfil (profiles.escala_ultima_base/mes, pra valer
// entre dispositivos diferentes). Se o banco falhar (ex.: coluna ainda não
// criada — rodar escala-perfil-ultima-tela.sql), agora avisa em vez de
// engolir o erro — antes o try/catch não pegava nada de verdade, porque o
// supabase-js não lança exceção em erro de query, só devolve {error}.
async function escalaSalvarUltimaTela(base, mes) {
  try { localStorage.setItem('gde_escala_ultima_base', base); localStorage.setItem('gde_escala_ultimo_mes', mes); } catch (_) {}

  const uid = currentUserProfile?.id || currentUser?.id;
  if (!uid) return;
  if (currentUserProfile) { currentUserProfile.escala_ultima_base = base; currentUserProfile.escala_ultimo_mes = mes; }

  const { error } = await db.from('profiles').update({ escala_ultima_base: base, escala_ultimo_mes: mes }).eq('id', uid);
  if (error) {
    escalaMsg(`Salvei sua última base/mês só nesse navegador (localStorage) — não consegui salvar no perfil pra valer em outros dispositivos: ${error.message}. Provavelmente falta rodar o escala-perfil-ultima-tela.sql no Supabase.`, true);
  }
}

// ══════════════════════════════════════════════════════
// Montar Escala — grade manual (colaborador × dia)
//
// Só guarda o que é manual (F/K). O resto é calculado na hora:
//   J  → colaboradores_ferias (já existe, sem duplicar dado)
//   FA → 2+ F seguidos, é só um jeito de mostrar, não é status à parte
//   horário de trabalho → pontoHorarios (Horarios.xlsx, já existe)
// ══════════════════════════════════════════════════════

// Na primeira vez que uma base+mês é aberta (sem ninguém adicionado ainda),
// carrega sozinho todo mundo que tem horário planejado ali naquele mês —
// cruzando com o pontoHorarios (Horarios.xlsx já carregado). Assim o gestor
// só precisa fazer o ajuste fino (F/FA/CH), não montar a equipe do zero.
// Cargos que têm folga fixa de fim de semana (não entram na escala
// revezada automaticamente) — confirmado com o cliente. Continuam podendo
// ser adicionados manualmente pela busca, se precisar.
function escalaCargoForaDaEscalaRevezada(cargo) {
  const c = String(cargo||'').toUpperCase().trim();
  if (!c) return false;
  if (c.includes('GERENTE'))        return true;
  if (c.includes('COORDENADOR'))    return true;
  if (c.includes('ADMINISTRATIV'))  return true; // cobre "Administrativo", "Auxiliar Administrativo" etc.
  if (c.includes('ESPECIALISTA'))   return true;
  if (c.includes('ANALISTA'))       return true;
  if (/\bADM\b/.test(c))            return true; // sigla "ADM" isolada
  return false;
}

async function escalaPopularAutomaticamente(base, mes) {
  if (typeof pontoHorarios === 'undefined' || !pontoHorarios.size) return [];

  const matriculas = new Map(); // matricula -> nome
  for (const [key, h] of pontoHorarios) {
    const partes = key.split('|');
    if (partes.length !== 3) continue;
    const [filial, mat, dstr] = partes;
    if (filial !== base) continue;
    const dataPartes = dstr.split('/');
    if (dataPartes.length !== 3) continue;
    const mesDoRegistro = `${dataPartes[2]}-${dataPartes[1]}`;
    if (mesDoRegistro !== mes) continue;
    if (typeof hcIsDesligado === 'function' && hcIsDesligado(mat)) continue; // não inclui inativos
    const cargo = window.eoColabs?.get(mat)?.funcao;
    if (escalaCargoForaDaEscalaRevezada(cargo)) continue; // função fixa de fim de semana — só manual
    if (!matriculas.has(mat)) matriculas.set(mat, h.nome || window.eoColabs?.get(mat)?.nome || '');
  }
  if (!matriculas.size) return [];

  const linhas = [...matriculas.entries()].map(([matricula, nome]) => ({
    base, mes, matricula, nome,
    created_by: currentUserProfile?.id || currentUser?.id || null,
  }));

  const BATCH = 200;
  for (let i = 0; i < linhas.length; i += BATCH) {
    const { error } = await db.from('escala_colaborador').upsert(linhas.slice(i, i+BATCH), { onConflict: 'base,mes,matricula' });
    if (error) { console.warn('[escala] erro ao pré-popular:', error.message); break; }
  }

  const { data } = await db.from('escala_colaborador').select('*').eq('base', base).eq('mes', mes).order('nome');
  return data || [];
}

async function escalaRenderGrade(el) {
  el.innerHTML = `
    <div class="page-header"><div>
      <h1 class="page-title">Escala Online</h1>
      <p class="page-sub">Montar escala</p>
    </div></div>
    <div class="adm-empty-state">
      <i class="ti ti-loader-2" style="font-size:32px;opacity:.4;animation:spin 1s linear infinite" aria-hidden="true"></i>
      <p>Carregando...</p>
    </div>`;

  if (typeof hcEnsureData === 'function') await hcEnsureData();
  else if (typeof adhEnsureRoster === 'function') await adhEnsureRoster();
  if (typeof adminLoadFileOnDemand === 'function') {
    await adminLoadFileOnDemand('horarios', () => {});
  }

  const base = window._escalaBase;
  const mes  = window._escalaMes;

  const [{ data: colabsIniciais }, dias, { data: travaRow }] = await Promise.all([
    db.from('escala_colaborador').select('*').eq('base', base).eq('mes', mes).order('created_at'),
    escalaFetchDias(base, mes),
    db.from('escala_trava').select('*').eq('base', base).eq('mes', mes).maybeSingle(),
  ]);

  window._escalaTravada = !!travaRow?.travada;
  window._escalaTravaInfo = travaRow?.travada ? travaRow : null;

  let colabs = colabsIniciais || [];
  let autoPopulado = false;
  if (!colabs.length) {
    colabs = await escalaPopularAutomaticamente(base, mes);
    autoPopulado = colabs.length > 0;
  }
  window._escalaColabs = colabs;
  window._escalaAutoPopulado = autoPopulado;
  window._escalaDias = new Map((dias||[]).map(d => [`${d.matricula}|${d.dia}`, d]));

  const [ano0] = mes.split('-').map(Number);
  const { data: feriadosBase } = await db.from('escala_feriado').select('*').eq('base', base);
  window._escalaFeriados = new Map();
  escalaFeriadosNacionais(ano0).forEach(f => window._escalaFeriados.set(f.data, { nome: f.nome, tipo: 'nacional' }));
  (feriadosBase || []).forEach(f => window._escalaFeriados.set(f.data, { nome: f.nome, tipo: f.tipo }));

  // Demanda de pessoal por dia — reaproveita o motor da Parte 2 (parâmetros
  // de solo × malha de voos real). Isso alimenta a linha "NECESSÁRIO" no
  // topo da grade e a geração automática de folgas.
  const [ano, mesNum] = mes.split('-').map(Number);
  const diasNoMes = new Date(ano, mesNum, 0).getDate();
  const mesInicioStr = `${mes}-01`;
  const mesFimStr = `${mes}-${String(diasNoMes).padStart(2,'0')}`;

  const { data: paramRows } = await db.from('escala_parametro_solo')
    .select('*').in('base', [base, '']).eq('ativo', true);
  const parametrosEfetivos = escalaMesclarParametros(paramRows || [], base);

  const voosRows = await escalaFetchMalha(base, mesInicioStr, mesFimStr, 'data,tipo,cia,hora_chegada,hora_saida');

  window._escalaDemandaPorDia = null;
  const voosPorDia = new Array(diasNoMes).fill(0);
  (voosRows||[]).forEach(v => { const d = parseInt(v.data.slice(8,10),10); if (d>=1 && d<=diasNoMes) voosPorDia[d-1]++; });
  window._escalaVoosPorDia = voosPorDia;

  if (parametrosEfetivos.length && voosRows?.length) {
    const voosPorDiaMap = new Map();
    voosRows.forEach(v => {
      const dia = parseInt(v.data.slice(8,10), 10);
      if (!voosPorDiaMap.has(dia)) voosPorDiaMap.set(dia, []);
      voosPorDiaMap.get(dia).push(v);
    });
    window._escalaDemandaPorDia = new Map();
    for (const [dia, voosDoDia] of voosPorDiaMap) {
      window._escalaDemandaPorDia.set(dia, escalaDemandaDoDia(voosDoDia, parametrosEfetivos));
    }
  }

  escalaGradeRenderShell(el, ano, mesNum, diasNoMes);
}

// ── Travar/destravar a escala ──────────────────────────
// Só Gerente, Coordenador ou Admin podem travar/destravar — confirmado com
// o cliente. Enquanto travada, bloqueia TUDO que edita (folgas, adicionar/
// remover colaborador, horário) — quem tem permissão precisa destravar de
// propósito antes de editar, não dá pra editar "sem querer" com a escala
// fechada.
function escalaPodeTravar() {
  const role = currentUserProfile?.role;
  return role === 'admin' || role === 'gerente' || role === 'coordenador';
}

function escalaVerificarTravada() {
  if (window._escalaTravada) {
    escalaMsg('Essa escala está travada — destrave pra poder editar.', true);
    return true;
  }
  return false;
}

async function escalaAlternarTrava() {
  if (!escalaPodeTravar()) { escalaMsg('Só Gerente, Coordenador ou Admin podem travar/destravar a escala.', true); return; }

  const base = window._escalaBase, mes = window._escalaMes;
  const travarAgora = !window._escalaTravada;

  const confirmMsg = travarAgora
    ? 'Travar essa escala? Ninguém vai poder editar folgas, adicionar/remover colaborador ou mudar horário até destravar.'
    : 'Destravar essa escala pra edição?';
  if (!confirm(confirmMsg)) return;

  const payload = {
    base, mes, travada: travarAgora,
    travada_por: travarAgora ? (currentUserProfile?.id || currentUser?.id || null) : null,
    travada_por_nome: travarAgora ? (currentUserProfile?.nome || currentUser?.email || null) : null,
    travada_em: travarAgora ? new Date() : null,
  };
  const { error } = await db.from('escala_trava').upsert(payload, { onConflict: 'base,mes' });
  if (error) { escalaMsg(`Erro ao ${travarAgora ? 'travar' : 'destravar'}: ` + error.message, true); return; }

  escalaMsg(travarAgora ? 'Escala travada.' : 'Escala destravada — já pode editar.');
  escalaRenderGrade(document.getElementById('page-content'));
}

function escalaGradeRenderShell(el, ano, mesNum, diasNoMes) {
  const base = window._escalaBase;
  const mes  = window._escalaMes;
  const role = currentUserProfile?.role;
  const myBases = (currentUserProfile?.bases || []).filter(b => b !== '*');
  const isAdmin = role === 'admin';
  const bases = isAdmin ? (typeof hcAllBases === 'function' ? hcAllBases() : []) : myBases;

  const travada = !!window._escalaTravada;
  const podeTravar = escalaPodeTravar();
  const dis = travada ? 'disabled' : '';

  const travaBtnHTML = podeTravar
    ? `<button class="adh-refresh-btn" style="${travada?'background:#fc8181;color:#1a0b0b;border:none;font-weight:600':''}" onclick="escalaAlternarTrava()">${escalaIcone(travada?'lock':'unlock')}${travada?'Destravar escala':'Travar escala'}</button>`
    : (travada ? `<span class="adh-base-badge" style="color:#fc8181;border-color:rgba(252,129,129,.35)">${escalaIcone('lock')}Escala travada</span>` : '');

  el.classList.add('pc-flex');
  el.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Escala Online</h1>
        <p class="page-sub">Montar escala · ${base} · ${typeof adhMonthLabel==='function'?adhMonthLabel(mes):mes} · <span id="escala-contador-colabs" style="color:var(--text-primary);font-weight:600">${(window._escalaColabs||[]).length} colaborador${(window._escalaColabs||[]).length===1?'':'es'}</span></p>
        <p id="escala-save-indicator" style="font-size:11px;margin:4px 0 0;color:var(--text-muted)">Nenhuma alteração ainda</p>
        <p id="escala-fora-cadastro" style="font-size:11px;margin:4px 0 0;display:none"></p>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        ${bases.length>1
          ? `<select class="adh-month-select" onchange="escalaSetBase(this.value)">${bases.map(b=>`<option value="${b}" ${b===base?'selected':''}>${b}</option>`).join('')}</select>`
          : `<span class="adh-base-badge">${base||'—'}</span>`}
        <select class="adh-month-select" onchange="escalaSetMes(this.value)">${escalaMesOptionsHTML(mes)}</select>
        <button class="adh-refresh-btn" style="background:var(--blue);color:#0b0f1a;border:none;font-weight:600" onclick="escalaToggleVoosPanel()">${escalaIcone('plane')}Voos &amp; demanda</button>
        ${travaBtnHTML}
      </div>
    </div>

    <div id="escala-voos-panel" style="display:none;margin-bottom:16px"></div>

    ${travada ? `
    <div style="font-size:11.5px;color:#fc8181;background:rgba(252,129,129,.08);border:1px solid rgba(252,129,129,.25);border-radius:8px;padding:8px 14px;margin-bottom:14px">
      ${escalaIcone('lock')}Escala travada${window._escalaTravaInfo?.travada_por_nome ? ` por ${window._escalaTravaInfo.travada_por_nome}` : ''}${window._escalaTravaInfo?.travada_em ? ` em ${new Date(window._escalaTravaInfo.travada_em).toLocaleString('pt-BR')}` : ''} — ninguém pode editar folgas, colaboradores ou horário até destravar.
    </div>` : ''}

    ${window._escalaAutoPopulado ? `
    <div style="font-size:11.5px;color:#5fa87a;background:rgba(95,168,122,.08);border:1px solid rgba(95,168,122,.25);border-radius:8px;padding:8px 14px;margin-bottom:14px">
      ${escalaIcone('check')}${(window._escalaColabs||[]).length} colaborador(es) carregados automaticamente, cruzando com o horário planejado (ponto) dessa base nesse mês. Use a busca abaixo só se faltar alguém, ou o ✕ na linha se alguém não devia estar aqui.
    </div>` : ''}

    <div class="hc-panel" style="margin-bottom:16px">
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding-bottom:2px">
        <div style="position:relative;flex:1 1 240px;min-width:200px;max-width:320px">
          <input id="escala-busca" class="adh-search-input" ${dis} style="width:100%;box-sizing:border-box;padding:9px 12px;background:var(--bg-hover);border:1px solid var(--border-strong);border-radius:8px;color:var(--text-primary)"
            oninput="escalaBuscarColab(this.value)" placeholder="Buscar por matrícula ou nome pra adicionar...">
          <div id="escala-busca-resultados" style="position:absolute;top:calc(100% + 4px);left:0;right:0;background:var(--bg-surface);border:1px solid var(--border-strong);border-radius:8px;z-index:20;display:none;max-height:220px;overflow-y:auto;box-shadow:var(--adh-shadow-card)"></div>
        </div>

        <button class="adh-refresh-btn" ${dis} style="background:var(--blue);color:#0b0f1a;border:none;font-weight:600" onclick="escalaGerarFolgasAuto()">${escalaIcone('zap')}Gerar folgas automáticas</button>
        <button class="adh-refresh-btn" ${dis} onclick="escalaPreencherTodoStaff()">${escalaIcone('users')}Preencher com Staff</button>
        <button class="adh-refresh-btn" ${dis} onclick="escalaPreencherHorarioMesAnterior()">${escalaIcone('calclock')}Horário do mês anterior</button>
        <button id="escala-btn-remover-sel" class="adh-refresh-btn" ${dis} style="color:#fc8181;display:none" onclick="escalaRemoverSelecionados()">${escalaIcone('trash')}Remover selecionados (0)</button>

        <div style="flex:1 1 auto"></div>

        <button class="adh-refresh-btn" style="${window._escalaAgruparPorTurno?'background:var(--blue);color:#0b0f1a;border:none;font-weight:600':''}" onclick="escalaToggleAgruparTurno()" title="Agrupa a lista por grupo (função) e depois por setor, com contagem por bloco">${escalaIcone('layers')}Agrupar</button>
        <button id="escala-btn-colunas-sec" class="adh-refresh-btn" style="${window._escalaColunasSecundarias===false?'background:var(--blue);color:#0b0f1a;border:none;font-weight:600':''}" onclick="escalaToggleColunasSecundarias()" title="Esconde Setor/Turno/Bloco/Intervalos — sobra mais espaço pra grade de dias">${escalaIcone('columns')}${window._escalaColunasSecundarias===false?'Mostrar colunas':'Colunas essenciais'}</button>

        <!-- Ações que se usa uma vez por mês vão pro menu: antes eram 12
             botões numa linha só, que quebrava em duas ou três em qualquer
             tela e empurrava a grade pra baixo. -->
        <div style="position:relative">
          <button class="adh-refresh-btn" onclick="escalaToggleMenuAcoes(event)" title="Exportar, cursos, feriados e limpeza">${escalaIcone('moreHorizontal')}Mais ações${escalaIconeSolto('chevronDown', 11)}</button>
          <div id="escala-menu-acoes" style="display:none;position:absolute;top:calc(100% + 6px);right:0;background:var(--bg-surface);border:1px solid var(--border-strong);border-radius:9px;padding:5px;min-width:238px;z-index:60;box-shadow:var(--adh-shadow-card)">
            ${escalaMenuSecao('Exportar')}
            ${escalaMenuItem('sheet', 'Baixar Excel da escala', 'escalaExportarExcel()')}
            ${escalaMenuItem('printer', 'Imprimir / PDF', 'escalaImprimir()')}
            ${escalaMenuDivisor()}
            ${escalaMenuSecao('Horários e férias')}
            ${escalaMenuItem('clock', 'Recalcular saídas pela CH', 'escalaRecalcularSaidas()', travada)}
            ${escalaMenuItem('history', 'Recarregar férias do sistema', 'escalaRecarregarFerias()')}
            ${escalaMenuDivisor()}
            ${escalaMenuSecao('Cursos e feriados')}
            ${escalaMenuItem('download', 'Baixar modelo de cursos', 'escalaBaixarModeloCursos()')}
            ${escalaMenuItem('upload', 'Importar cursos (.xlsx)', `document.getElementById('escala-cursos-input').click()`, travada)}
            ${escalaMenuItem('calendarPlus', 'Adicionar feriado dessa base', 'escalaAdicionarFeriado()', travada)}
            ${escalaMenuDivisor()}
            ${escalaMenuSecao('Organização e limpeza')}
            ${escalaMenuItem('sort', 'Ordenar automático', 'escalaLimparOrdemManual()', travada)}
            ${escalaMenuItem('trash', 'Limpar folgas e status', 'escalaLimparStatus()', travada, '#fc8181')}
            ${escalaMenuItem('trash', 'Limpar colaboradores', 'escalaLimparColaboradores()', travada, '#fc8181')}
          </div>
        </div>
        <input type="file" id="escala-cursos-input" ${dis} accept=".xlsx,.xls" style="display:none" onchange="escalaImportarCursos(this)">
      </div>
      <div id="escala-grupo-organizacao" style="display:flex;gap:16px;align-items:flex-end;flex-wrap:nowrap;overflow-x:auto;margin-top:10px;padding-bottom:2px">
        <div style="position:relative">
          <label style="font-size:10.5px;color:var(--text-muted);display:block;margin-bottom:3px">Mostrar grupos</label>
          <select class="adh-month-select" onchange="escalaSetMostrarGrupos(this.value)">
            <option value="__todos__" ${!window._escalaGruposVisiveis?'selected':''}>Todos os grupos</option>
            <option value="__sup_lider__">Só Supervisores e Líderes</option>
            <option value="__escolher__">Escolher grupos...</option>
          </select>
          <div id="escala-grupos-painel" style="display:none;position:absolute;top:calc(100% + 4px);left:0;background:var(--bg-surface);border:1px solid var(--border-strong);border-radius:8px;padding:8px 10px;z-index:30;min-width:190px;box-shadow:var(--adh-shadow-card)">
            ${ESCALA_GRUPOS.map(g => `<label style="display:flex;align-items:center;gap:6px;padding:3px 0;font-size:11.5px;color:var(--text-secondary);white-space:nowrap"><input type="checkbox" value="${g}" onchange="escalaAtualizarGruposEscolhidos()" ${(!window._escalaGruposVisiveis||window._escalaGruposVisiveis.has(g))?'checked':''}>${g}</label>`).join('')}
          </div>
        </div>
        <div>
          <label style="font-size:10.5px;color:var(--text-muted);display:block;margin-bottom:3px">Dividir grupo por</label>
          <select class="adh-month-select" onchange="escalaSetCriterioSubBloco(this.value)" title="Como quebrar cada grupo de função em sub-blocos — cada sub-bloco ganha a própria contagem de gente por dia">
            ${escalaCriteriosSubBlocoDisponiveis().map(c => `<option value="${c.valor}" ${escalaCriterioSubBloco()===c.valor?'selected':''} title="${c.dica}">${c.label}</option>`).join('')}
          </select>
        </div>
        <div>
          <label style="font-size:10.5px;color:var(--text-muted);display:block;margin-bottom:3px">Blocos</label>
          <select class="adh-month-select" onchange="escalaSetBlocosRecolhidos(this.value)">
            <option value="__expandido__" ${!window._escalaBlocosRecolhidos?'selected':''}>Expandido</option>
            <option value="__recolhido__" ${window._escalaBlocosRecolhidos?'selected':''}>Recolhido (só cabeçalho e total)</option>
          </select>
        </div>
        <div>
          <label style="font-size:10.5px;color:var(--text-muted);display:block;margin-bottom:3px">Densidade</label>
          <select class="adh-month-select" onchange="escalaSetDensidade(this.value)">
            <option value="confortavel" ${window._escalaDensidade!=='compacto'?'selected':''}>Confortável</option>
            <option value="compacto" ${window._escalaDensidade==='compacto'?'selected':''}>Compacto (cabe mais na tela)</option>
          </select>
        </div>
      </div>
      <div id="escala-status-msg" style="font-size:11px;color:var(--text-muted);margin-top:8px;min-height:14px"></div>
    </div>

    <div class="hc-panel escala-fill" style="display:flex;flex-direction:column;min-height:0">
      <div style="display:flex;gap:14px;margin-bottom:12px;font-size:11px;color:var(--text-secondary);flex-wrap:wrap;flex-shrink:0">
        <span><span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:var(--text-muted);margin-right:5px"></span>F · Folga</span>
        <span><span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:#a78bfa;margin-right:5px"></span>FA · Folga agrupada</span>
        <span><span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:#c9a24a;margin-right:5px"></span>L · Férias (automático)</span>
        <span><span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:#fc8181;margin-right:5px"></span>J · Afastado</span>
        <span><span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:#38bdf8;margin-right:5px"></span>K · Cursos</span>
        <span><span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:#fb923c;margin-right:5px"></span>CH · Folga compensa (tecla C)</span>
        <span style="color:var(--text-muted)">clique numa célula vazia ou de trabalho pra marcar F/J/K/C/A · fim de semana e feriado ficam destacados nas colunas · <span style="color:#f6ad55">laranja</span>/<span style="color:#fc8181">vermelho</span> na linha "Trabalhando no dia" = bem abaixo da média do mês</span>
      </div>
      <div id="escala-grade-wrap" class="${window._escalaDensidade==='compacto'?'escala-compacto':''}" style="flex:1;min-height:120px;overflow:auto;border-radius:8px;background:var(--bg-app)">${escalaGradeTabelaHTML(ano, mesNum, diasNoMes)}</div>
    </div>
  `;
  escalaAjustarStickyOffset();
}

function escalaGradeAtualiza() {
  const [ano, mesNum] = window._escalaMes.split('-').map(Number);
  const diasNoMes = new Date(ano, mesNum, 0).getDate();
  const wrap = document.getElementById('escala-grade-wrap');
  // Guarda e devolve a rolagem: trocar o innerHTML zera scrollTop/scrollLeft,
  // e como isso roda a cada tecla digitada, a grade voltava pro canto
  // superior esquerdo toda vez que alguém marcava uma folga no meio do mês.
  const sl = wrap?.scrollLeft || 0;
  const st = wrap?.scrollTop  || 0;
  if (wrap) wrap.innerHTML = escalaGradeTabelaHTML(ano, mesNum, diasNoMes);
  if (wrap) { wrap.scrollLeft = sl; wrap.scrollTop = st; }
  const contador = document.getElementById('escala-contador-colabs');
  if (contador) {
    const n = (window._escalaColabs||[]).length;
    contador.textContent = `${n} colaborador${n===1?'':'es'}`;
  }
  escalaAjustarStickyOffset();
  escalaRestaurarSelecaoVisual();

  const fora = escalaContarForaCadastro();
  const aviso = document.getElementById('escala-fora-cadastro');
  if (aviso) {
    aviso.style.display = fora ? 'flex' : 'none';
    aviso.style.alignItems = 'center';
    aviso.style.gap = '5px';
    aviso.style.color = 'var(--amber)';
    aviso.innerHTML = fora
      ? `${escalaIconeSolto('alert', 12)}${fora} colaborador${fora===1?'':'es'} fora do cadastro do RH nesta escala — precisa${fora===1?'':'m'} de regularização.`
      : '';
  }
}

// Mede a altura de verdade do cabeçalho (varia um pouco conforme zoom/fonte
// do navegador) e grava numa variável CSS — assim a 2ª linha grudada
// ("Trabalhando no dia") encosta certinho embaixo do cabeçalho, sem
// depender de eu adivinhar um valor fixo em pixel.
function escalaAjustarStickyOffset() {
  const wrap = document.getElementById('escala-grade-wrap');
  const thead = wrap?.querySelector('thead tr');
  if (!wrap || !thead) return;
  const altura = thead.getBoundingClientRect().height;
  if (altura > 0) wrap.style.setProperty('--escala-thead-h', `${Math.round(altura)}px`);

  // O bloco fixo é uma pilha: cabeçalho → "Trabalhando no dia" → "Pico da
  // malha" → linha de cadastro. Cada uma precisa saber a altura acumulada
  // de todas as anteriores, senão elas se sobrepõem — que era exatamente o
  // efeito de "barrinha passando por baixo" ao rolar a grade.
  let topo = Math.round(altura);
  const linhaTrab = wrap.querySelector('tr.escala-linha-trabalhando');
  if (linhaTrab) topo += Math.round(linhaTrab.getBoundingClientRect().height);
  wrap.style.setProperty('--escala-topo-pico', `${topo}px`);

  const linhaPico = wrap.querySelector('tr.escala-linha-pico');
  if (linhaPico) topo += Math.round(linhaPico.getBoundingClientRect().height);
  wrap.style.setProperty('--escala-topo-add', `${topo}px`);
}

// A altura do cabeçalho muda com o zoom do navegador e com a troca de
// densidade, então remede também no resize — antes só rodava no render e a
// linha "Trabalhando no dia" descolava do cabeçalho depois de qualquer
// ajuste de janela.
if (!window._escalaResizeRegistrado) {
  window._escalaResizeRegistrado = true;
  let t = null;
  window.addEventListener('resize', () => {
    clearTimeout(t);
    t = setTimeout(escalaAjustarStickyOffset, 120);
  });
}

const ESCALA_DIAS_SEMANA = ['dom','seg','ter','qua','qui','sex','sáb'];

// Descobre se um dia cai dentro de QUALQUER período de férias do
// colaborador. Antes olhava window.eoFerias, que o hcEnsureData monta
// guardando só UM período por matrícula (o de data_fim mais recente) — quem
// tinha férias em outubro e outro período em dezembro simplesmente não
// aparecia de férias em outubro. A lista completa já vinha carregada em
// window.eoFeriasAll e não era usada aqui.
function escalaPeriodosDeFerias(matricula) {
  const todos = window.eoFeriasAll;
  if (Array.isArray(todos) && todos.length) {
    return todos.filter(r => String(r.matricula) === String(matricula) && r.data_inicio && r.data_fim);
  }
  const unico = window.eoFerias?.get(matricula);
  return unico?.data_inicio && unico?.data_fim ? [unico] : [];
}

function escalaEstaDeFerias(matricula, ano, mesNum, dia) {
  // Exceção lançada nesta escala ("trabalha mesmo constando férias") tem
  // prioridade — o cadastro do RH continua intacto, só esta base+mês
  // ignora o período naquele dia.
  if (window._escalaDias?.get(`${matricula}|${dia}`)?.status === 'T') return false;
  const alvo = `${ano}-${String(mesNum).padStart(2,'0')}-${String(dia).padStart(2,'0')}`;
  return escalaPeriodosDeFerias(matricula).some(f => alvo >= f.data_inicio && alvo <= f.data_fim);
}

function escalaHorarioPlanejado(base, matricula, ano, mesNum, dia) {
  if (typeof pontoHorarios === 'undefined') return null;
  const dstr = `${String(dia).padStart(2,'0')}/${String(mesNum).padStart(2,'0')}/${ano}`;
  const key = `${base}|${matricula}|${dstr}`;
  const h = pontoHorarios.get(key);
  if (!h || !h.ent1) return null;
  return h.sai1 ? `${h.ent1}-${h.sai1}` : h.ent1;
}

// Horário fixo do colaborador nesse mês: o horário mais frequente entre os
// dias de trabalho dele. Com isso a grade só precisa mostrar o horário nos
// dias que FOGEM do normal — o resto fica limpo.
// Horário mais frequente do colaborador no mês (moda) — usado pras colunas
// fixas de Entrada/Saída/Horário/Setor da tabela.
function escalaHorarioFixoDoColab(matricula, ano, mesNum, diasNoMes) {
  const base = window._escalaBase;
  const contagem = new Map();
  for (let d = 1; d <= diasNoMes; d++) {
    const h = escalaHorarioPlanejado(base, matricula, ano, mesNum, d);
    if (!h) continue;
    contagem.set(h, (contagem.get(h)||0) + 1);
  }
  let melhor = null, melhorN = 0;
  for (const [h, n] of contagem) { if (n > melhorN) { melhor = h; melhorN = n; } }
  return melhor;
}

// Horário de entrada "efetivo" de um colaborador — manual se tiver, senão o
// mais frequente do ponto batido no mês. Usado em vários lugares (grade,
// ordenação simples, ordenação agrupada, ordenar por coluna) — extraído
// aqui uma vez só pra não ter 4 cópias levemente diferentes se um dia
// precisar mudar a regra.
function escalaEntradaEfetivaDoColab(c, ano, mesNum, diasNoMes) {
  const horarioFixo = escalaHorarioFixoDoColab(c.matricula, ano, mesNum, diasNoMes);
  const [entradaCalc] = horarioFixo ? horarioFixo.split('-') : [null];
  return c.entrada_manual || entradaCalc || '';
}

// Mesma lógica da entrada/saída fixa (moda do mês), mas usando o segundo
// par de batida (sai1 → ent2 = saída pro almoço → volta do almoço) — assim
// descobrimos o intervalo de verdade que a pessoa já vinha batendo, em vez
// de chutar. Retorna algo como "12:00-13:00", ou null se o ponto batido
// desse mês não tiver segunda batida (mat sem intervalo registrado).
function escalaIntervaloFixoDoColab(matricula, ano, mesNum, diasNoMes) {
  const base = window._escalaBase;
  if (typeof pontoHorarios === 'undefined') return null;
  const contagem = new Map();
  for (let d = 1; d <= diasNoMes; d++) {
    const dstr = `${String(d).padStart(2,'0')}/${String(mesNum).padStart(2,'0')}/${ano}`;
    const h = pontoHorarios.get(`${base}|${matricula}|${dstr}`);
    if (!h || !h.sai1 || !h.ent2) continue;
    const par = `${h.sai1}-${h.ent2}`;
    contagem.set(par, (contagem.get(par)||0) + 1);
  }
  let melhor = null, melhorN = 0;
  for (const [par, n] of contagem) { if (n > melhorN) { melhor = par; melhorN = n; } }
  return melhor;
}

// Sem ponto batido nenhum pra se basear, cai pra uma duração padrão por
// carga horária — confirmado com o cliente: CH 210h = 1h de intervalo;
// CH 180h = 15min. As demais faixas (jornadas mais curtas, tipicamente sem
// intervalo obrigatório) não têm regra definida ainda, então ficam de fora
// desse preenchimento automático. Posiciona no meio da jornada.
function escalaIntervaloPadraoPorCH(ch, entrada) {
  const chNum = parseInt(String(ch||'').replace(/\D/g,''), 10);
  const minutosIntervalo = chNum >= 210 ? 60 : chNum === 180 ? 15 : null;
  const regra = ESCALA_CH_REGRAS[chNum];
  if (!minutosIntervalo || !regra || !entrada) return null;
  const m = entrada.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const minEntrada = parseInt(m[1],10)*60 + parseInt(m[2],10);
  const minMeio = (minEntrada + Math.floor(regra.jornadaDiaria*60/2)) % (24*60);
  const minFim  = (minMeio + minutosIntervalo) % (24*60);
  const fmt = (min) => `${String(Math.floor(min/60)).padStart(2,'0')}:${String(min%60).padStart(2,'0')}`;
  return `${fmt(minMeio)}-${fmt(minFim)}`;
}

function escalaConteudoDoMes(c, ano, mesNum, diasNoMes) {
  const brutos = [];
  const detalhes = [];
  for (let d = 1; d <= diasNoMes; d++) {
    const key = `${c.matricula}|${d}`;
    const manual = window._escalaDias.get(key);
    // 'T' é a exceção de férias: existe só pra anular o L daquele dia nesta
    // escala. Não é status visível — o dia volta a ser dia de trabalho.
    if (manual && manual.status === 'T') { brutos.push(null); detalhes.push(null); continue; }
    if (manual) { brutos.push(manual.status); detalhes.push(manual.detalhe || null); continue; } // 'F' | 'K' | 'CH' | 'J'
    if (escalaEstaDeFerias(c.matricula, ano, mesNum, d)) { brutos.push('L'); detalhes.push(null); continue; }
    brutos.push(null); detalhes.push(null); // dia de trabalho normal
  }
  return brutos.map((s, i) => {
    if (s === 'F') {
      // Conversão automática pra "FA" (sábado+domingo ou domingo+segunda)
      // foi desligada a pedido do cliente — por enquanto essa regra fica
      // manual; sempre mostra "F" simples, mesmo com folga agrupada do lado.
      return { status: 'F', exibido: 'F', editavel: true };
    }
    if (s === 'K')  return { status: 'K',  exibido: 'K',  editavel: true, detalhe: detalhes[i] };
    if (s === 'CH') return { status: 'CH', exibido: 'CH', editavel: true };
    if (s === 'J')  return { status: 'J',  exibido: 'J',  editavel: true };
    if (s === 'L')  return { status: 'L',  exibido: 'L',  editavel: false };
    return { status: null, exibido: null, editavel: true }; // dia de trabalho — célula vazia
  });
}

function escalaCelHTML(item) {
  if (!item.exibido) return '';
  const cores = { F:'#8896aa', FA:'#a78bfa', L:'#c9a24a', K:'#38bdf8', CH:'#fb923c', J:'#fc8181' };
  const cor = cores[item.exibido] || '#8896aa';
  const titulo = item.status === 'L' ? 'Férias — automático, vem do cadastro' : item.status === 'CH' ? 'Folga compensa (banco de horas)' : item.status === 'J' ? 'Afastado' : '';
  return `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:${cor}22;color:${cor};border-radius:4px;font-weight:700;font-size:10px" title="${titulo}">${item.exibido}</div>`;
}

// Setor = turno do dia, calculado a partir do horário de entrada (nomes
// estilo alfabeto fonético, igual seu arquivo de referência).
function escalaSetorDoTurno(entradaStr) {
  if (!entradaStr) return '—';
  const h = parseInt(String(entradaStr).split(':')[0], 10) || 0;
  if (h < 6)  return 'Turno Alpha';
  if (h < 12) return 'Turno Bravo';
  if (h < 18) return 'Turno Charlie';
  return 'Turno Delta';
}

// Calcula a data da Páscoa (algoritmo de Gauss/Meeus) — usado pra achar os
// feriados móveis (Carnaval, Sexta-feira Santa, Corpus Christi).
function escalaCalcularPascoa(ano) {
  const a = ano % 19, b = Math.floor(ano/100), c = ano % 100;
  const d = Math.floor(b/4), e = b % 4, f = Math.floor((b+8)/25);
  const g = Math.floor((b-f+1)/3), h = (19*a+b-d-g+15) % 30;
  const i = Math.floor(c/4), k = c % 4, l = (32+2*e+2*i-h-k) % 7;
  const m = Math.floor((a+11*h+22*l)/451);
  const mes = Math.floor((h+l-7*m+114)/31);
  const dia = ((h+l-7*m+114) % 31) + 1;
  return new Date(ano, mes-1, dia);
}

function escalaFmtISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function escalaSomaDias(d, n) {
  const novo = new Date(d);
  novo.setDate(novo.getDate() + n);
  return novo;
}

// Feriados nacionais — fixos + móveis (calculados a partir da Páscoa).
// Carnaval é ponto facultativo em muitos lugares, mas incluído aqui porque
// na prática quase todo mundo trata como feriado operacional.
function escalaFeriadosNacionais(ano) {
  const pascoa = escalaCalcularPascoa(ano);
  const feriados = [
    { data: `${ano}-01-01`, nome: 'Confraternização Universal' },
    { data: `${ano}-04-21`, nome: 'Tiradentes' },
    { data: `${ano}-05-01`, nome: 'Dia do Trabalho' },
    { data: `${ano}-09-07`, nome: 'Independência do Brasil' },
    { data: `${ano}-10-12`, nome: 'Nossa Senhora Aparecida' },
    { data: `${ano}-11-02`, nome: 'Finados' },
    { data: `${ano}-11-15`, nome: 'Proclamação da República' },
    { data: `${ano}-11-20`, nome: 'Consciência Negra' },
    { data: `${ano}-12-25`, nome: 'Natal' },
    { data: escalaFmtISO(escalaSomaDias(pascoa, -47)), nome: 'Carnaval (segunda)' },
    { data: escalaFmtISO(escalaSomaDias(pascoa, -46)), nome: 'Carnaval (terça)' },
    { data: escalaFmtISO(escalaSomaDias(pascoa, -2)),  nome: 'Sexta-feira Santa' },
    { data: escalaFmtISO(escalaSomaDias(pascoa, 60)),  nome: 'Corpus Christi' },
  ];
  return feriados;
}

// ── Agrupamento por Grupo + Setor ──────────────────────
// Grupo (bloco maior) — lista fechada, confirmada com o cliente, casando
// texto de função (sempre comparado sem acento, maiúsculo). Ordem importa:
// checa do mais específico pro mais genérico, porque alguns títulos batem
// com mais de uma palavra-chave (ex.: "Atendimento Passageiro Líder" tem
// "líder" mas é PAX, não Líder de Operações — por isso PASSAGEIRO vem
// primeiro; "Supervisor de Limpeza" tem "supervisor" mas é Limpeza, não
// Supervisores — por isso LIMPEZA vem antes do SUPERVISOR genérico).
// "Administração" é o balde final — qualquer função que não bate com
// nenhuma palavra-chave cai aqui (era chamado de "Outros" antes).
const ESCALA_GRUPOS = ['Supervisores', 'Líder de Operações', 'Auxiliar Líder', 'Auxiliar de Rampa', 'Operadores', 'PAX', 'Limpeza', 'GSE', 'Administração'];
function escalaGrupoDaFuncao(funcaoRaw) {
  const f = String(funcaoRaw || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (!f) return 'Administração';
  if (f.includes('PASSAGEIRO')) return 'PAX'; // Atendimento/Coord./Agente Serv. Passageiro (líder ou não)
  if (f.includes('LIMPEZA')) return 'Limpeza'; // ASG Limpeza, Encarregado de Limpeza, Supervisor de Limpeza
  if (f.includes('SUPERVISOR')) return 'Supervisores';
  if (f.includes('LIDER') && f.includes('RAMPA')) return 'Auxiliar Líder'; // AUX.LIDER DE RAMPA
  if (f.includes('AUXILIAR') && f.includes('RAMPA')) return 'Auxiliar de Rampa';
  if (f.includes('LIDER')) return 'Líder de Operações';
  if (f.includes('OPERADOR')) return 'Operadores';
  if (f.includes('MECANIC') || f.includes('MANUTEN') || f.includes('SERRALHEIRO') || f.includes('PINTOR') || f.includes('ELETRIC')) return 'GSE';
  return 'Administração';
}
function escalaFuncaoGrupoDoColab(c) {
  const funcao = window.eoColabs?.get(c.matricula)?.funcao || c.funcao_manual || '';
  const label = escalaGrupoDaFuncao(funcao);
  return { codigo: label, label };
}
function escalaEscapeAttr(s) {
  return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function escalaToggleAgruparTurno() {
  window._escalaAgruparPorTurno = !window._escalaAgruparPorTurno;
  try { localStorage.setItem('gde_escala_agrupar', window._escalaAgruparPorTurno ? '1' : '0'); } catch (_) {}
  escalaGradeAtualiza();
}

// ── Controles de organização dos grupos/setores ────────
// Clique no cabeçalho de Matrícula/Nome/Turno/Setor/Entrada — funciona nos
// dois modos (lista simples e agrupada por grupo/setor). Clicar nesse
// cabeçalho vale mais que a ordem manual de arrastar (é uma escolha
// explícita); "Ordenar automático" limpa e volta pro padrão de novo.
function escalaOrdenarPorColuna(coluna) {
  if (window._escalaOrdemColuna === coluna) {
    window._escalaOrdemDirecao = window._escalaOrdemDirecao === 'desc' ? 'asc' : 'desc';
  } else {
    window._escalaOrdemColuna = coluna;
    window._escalaOrdemDirecao = 'asc';
  }
  try {
    localStorage.setItem('gde_escala_ordem_coluna', window._escalaOrdemColuna);
    localStorage.setItem('gde_escala_ordem_direcao', window._escalaOrdemDirecao);
  } catch (_) {}
  escalaGradeAtualiza();
}

function escalaSetMostrarGrupos(valor) {
  const painel = document.getElementById('escala-grupos-painel');
  if (valor === '__escolher__') {
    if (painel) painel.style.display = painel.style.display === 'none' ? 'block' : 'none';
    return; // a lista de grupos escolhidos só muda quando marca/desmarca no painel
  }
  if (painel) painel.style.display = 'none';
  window._escalaGruposVisiveis = valor === '__sup_lider__' ? new Set(['Supervisores', 'Líder de Operações']) : null;
  escalaSalvarGruposVisiveis();
  escalaGradeAtualiza();
}

function escalaAtualizarGruposEscolhidos() {
  const painel = document.getElementById('escala-grupos-painel');
  if (!painel) return;
  const marcados = [...painel.querySelectorAll('input[type="checkbox"]:checked')].map(i => i.value);
  window._escalaGruposVisiveis = marcados.length ? new Set(marcados) : null;
  escalaSalvarGruposVisiveis();
  escalaGradeAtualiza();
}

function escalaSalvarGruposVisiveis() {
  try {
    localStorage.setItem('gde_escala_grupos_visiveis', window._escalaGruposVisiveis ? JSON.stringify([...window._escalaGruposVisiveis]) : '');
  } catch (_) {}
}

function escalaSetBlocosRecolhidos(valor) {
  window._escalaBlocosRecolhidos = valor === '__recolhido__';
  try { localStorage.setItem('gde_escala_blocos_recolhidos', window._escalaBlocosRecolhidos ? '1' : '0'); } catch (_) {}
  escalaGradeAtualiza();
}

// Densidade da grade — "compacto" reduz padding e fonte via classe CSS
// (.escala-compacto no wrap), pra caber mais gente na tela sem rolar,
// sem precisar duplicar cada estilo inline de célula em dois tamanhos.
function escalaSetDensidade(valor) {
  window._escalaDensidade = valor === 'compacto' ? 'compacto' : 'confortavel';
  try { localStorage.setItem('gde_escala_densidade', window._escalaDensidade); } catch (_) {}
  const wrap = document.getElementById('escala-grade-wrap');
  if (wrap) wrap.classList.toggle('escala-compacto', window._escalaDensidade === 'compacto');
  // Mudar a densidade muda a altura do cabeçalho — sem remedir, a linha
  // "Trabalhando no dia" fica flutuando por cima ou por baixo dele.
  escalaAjustarStickyOffset();
}

// Esconde/mostra as colunas Setor/Turno/Bloco/Intervalos — úteis pra
// configurar uma vez, mas não pra olhar no dia a dia. Escondidas, sobra
// mais espaço pra grade de dias (que é o que se usa o tempo todo).
function escalaToggleColunasSecundarias() {
  window._escalaColunasSecundarias = !window._escalaColunasSecundarias;
  try { localStorage.setItem('gde_escala_colunas_secundarias', window._escalaColunasSecundarias ? '1' : '0'); } catch (_) {}
  escalaGradeAtualiza();
  const btn = document.getElementById('escala-btn-colunas-sec');
  if (btn) {
    btn.style.background = window._escalaColunasSecundarias ? '' : 'var(--blue)';
    btn.style.color = window._escalaColunasSecundarias ? '' : '#0b0f1a';
  }
}

// Salva o turno digitado/selecionado pro colaborador — igual qualquer outro
// campo manual da escala (update simples, nunca upsert, pra não sobrescrever
// o resto da linha que já existe).
async function escalaEditarTurno(matricula, valorSelecionado) {
  if (escalaVerificarTravada()) { escalaGradeAtualiza(); return; }
  let turno = valorSelecionado;
  if (turno === '__novo__') {
    const novo = prompt('Nome do novo turno (ex: Turno D, Operadores Noite):');
    if (!novo || !novo.trim()) { escalaGradeAtualiza(); return; } // cancelou — desfaz a seleção
    turno = novo.trim();
  }
  turno = turno || null;

  const { error } = await db.from('escala_colaborador').update({ turno })
    .eq('base', window._escalaBase).eq('mes', window._escalaMes).eq('matricula', matricula);
  if (error) { escalaMsg('Erro ao salvar turno: ' + error.message, true); return; }

  const c = (window._escalaColabs||[]).find(x => x.matricula === matricula);
  if (c) c.turno = turno;
  escalaGradeAtualiza();
  escalaMsg(turno ? `Turno definido: ${turno}.` : 'Turno removido.');
}

// Igual escalaEditarTurno, só que pro Bloco de horário — o nível de
// agrupamento a mais dentro do Setor (pra juntar 23:00 com 00:00 no mesmo
// bloco, por exemplo, sem precisar de uma regra automática adivinhando
// isso sozinha).
async function escalaEditarBloco(matricula, valorSelecionado) {
  if (escalaVerificarTravada()) { escalaGradeAtualiza(); return; }
  let bloco = valorSelecionado;
  if (bloco === '__novo__') {
    const novo = prompt('Nome do novo bloco de horário (ex: Virada 23h-00h, Manhã):');
    if (!novo || !novo.trim()) { escalaGradeAtualiza(); return; }
    bloco = novo.trim();
  }
  bloco = bloco || null;

  const { error } = await db.from('escala_colaborador').update({ bloco_horario: bloco })
    .eq('base', window._escalaBase).eq('mes', window._escalaMes).eq('matricula', matricula);
  if (error) { escalaMsg('Erro ao salvar bloco de horário: ' + error.message, true); return; }

  const c = (window._escalaColabs||[]).find(x => x.matricula === matricula);
  if (c) c.bloco_horario = bloco;
  escalaGradeAtualiza();
  escalaMsg(bloco ? `Bloco de horário definido: ${bloco}.` : 'Bloco de horário removido.');
}

// Linha de um colaborador — extraída pra função própria porque é usada tanto
// na lista simples quanto dentro de cada bloco de função/turno agrupado.
function escalaLinhaColabHTML(c, ci, ctx) {
  const { ano, mesNum, diasNoMes, leftMat, leftNome, BORDA, turnosExistentes, blocosExistentes, secOn } = ctx;
  const travada = !!window._escalaTravada;
  const dis = travada ? 'disabled' : '';
  const info = window.eoColabs?.get(c.matricula);
  // Quem foi cadastrado manualmente não vem do RH: função e CH ficam nos
  // campos próprios da linha (funcao_manual / ch_manual).
  const funcao = info?.funcao || c.funcao_manual || '—';
  const ch = info?.ch || c.ch_manual || '—';
  const horarioFixo = escalaHorarioFixoDoColab(c.matricula, ano, mesNum, diasNoMes);
  const [entradaCalc, saidaCalc] = horarioFixo ? horarioFixo.split('-') : [null, null];
  const entrada = c.entrada_manual || entradaCalc || '';
  const saida = c.saida_manual || saidaCalc || '';
  const intInicio = c.intervalo_inicio_manual || '';
  const intFim = c.intervalo_fim_manual || '';
  const setor = escalaSetorDoTurno(entrada);

  const conteudo = escalaConteudoDoMes(c, ano, mesNum, diasNoMes);

  // Folgas do mês contra a meta da carga horária — evita ter que conferir
  // linha por linha contando F na mão.
  const folgasFeitas = conteudo.filter(i => i.status === 'F' || i.status === 'FA').length;
  const folgasMeta   = escalaMetaFolgasDoColab(ch, diasNoMes);
  const corFolgas    = folgasFeitas === folgasMeta ? '#5fa87a'
                     : folgasFeitas <  folgasMeta ? '#f6ad55' : '#fc8181';
  const dicaFolgas   = folgasFeitas === folgasMeta ? 'Meta de folgas batida'
                     : folgasFeitas <  folgasMeta ? `Faltam ${folgasMeta - folgasFeitas} folga(s) pra bater a meta de ${folgasMeta}`
                     : `${folgasFeitas - folgasMeta} folga(s) acima da meta de ${folgasMeta}`;

  // A cor de fundo vem de uma classe (não mais inline), porque as colunas
  // congeladas precisam pintar SÓLIDO com a mesma cor — antes usavam
  // background:inherit e herdavam "transparent", deixando o conteúdo dos
  // dias passar por baixo de Matrícula e Nome na rolagem horizontal.
  let html = `<tr class="${ci % 2 === 0 ? '' : 'escala-zebra'}" data-escala-linha="${c.matricula}"`
    + ` data-grupo="${escalaEscapeAttr(ctx.grupoDaLinha || '')}" data-subbloco="${escalaEscapeAttr(ctx.subBlocoDaLinha || '')}"`
    + ` ondragover="escalaDragOver(event,'${c.matricula}')" ondragleave="escalaDragLeave(event)" ondrop="escalaDrop(event,'${c.matricula}')">`;
  html += `<td class="escala-fixa escala-alca" style="text-align:center;position:sticky;left:0;border:${BORDA};padding:0"
      draggable="${!travada}" ondragstart="escalaDragStart(event,'${c.matricula}')" ondragend="escalaDragEnd(event)"
      title="${travada ? 'Escala travada' : 'Arraste esta célula pra reordenar dentro do bloco'}">
    <div style="display:flex;align-items:center;justify-content:center;gap:2px;height:100%;cursor:${travada?'default':'grab'}">
      <span style="color:var(--text-muted);font-size:13px;line-height:1;user-select:none;opacity:${travada?.4:1}">⠿</span>
      <input type="checkbox" data-escala-check="${c.matricula}" ${window._escalaSelecionados?.has(c.matricula)?'checked':''} onchange="escalaToggleSelecao('${c.matricula}',this.checked)" onclick="event.stopPropagation()" title="Selecionar" style="margin:0;cursor:pointer">
    </div>
  </td>`;
  html += `<td class="escala-fixa" style="padding:2px 8px;position:sticky;left:${leftMat}px;border:${BORDA}"><input type="text" ${dis} value="${c.matricula}" onchange="escalaEditarMatricula('${c.matricula}',this.value)" style="width:100%;box-sizing:border-box;background:transparent;border:none;color:var(--text-primary);font-weight:500;text-overflow:ellipsis;padding:6px 0" title="Editar matrícula"></td>`;
  // Selo pra quem foi cadastrado na mão: a pessoa existe só nesta escala,
  // então Aderência e Headcount não sabem dela.
  const selo = c.fora_cadastro
    ? `<span class="escala-selo-fora" title="Fora do cadastro do RH — não aparece em Aderência nem no Headcount. Peça a regularização.">fora do RH</span>`
    : '';
  html += `<td class="escala-fixa escala-fixa-borda" style="padding:8px;color:var(--text-primary);font-weight:500;position:sticky;left:${leftNome}px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;border:${BORDA}" title="${escalaEscapeAttr(c.nome||'')}">${c.nome||''}${selo}</td>`;
  // Setor e Bloco saíram da grade: com o sub-bloco por Turno fazendo a
  // separação sozinho, eram duas colunas de 82px sempre em "—" nesta base.
  // O espaço foi pro Nome e pra Função, que viviam cortados. Os campos
  // continuam no banco e voltam a aparecer sozinhos em qualquer base que
  // já os use (ver escalaCriteriosSubBlocoDisponiveis).
  if (secOn) {
    html += `<td style="padding:8px 10px;color:var(--text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;border:${BORDA}">${setor}</td>`;
  }
  html += `<td style="padding:8px 10px;color:var(--text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;border:${BORDA}" title="${funcao}">${funcao}</td>`;
  html += `<td style="text-align:center;border:${BORDA};padding:2px"><input type="text" ${dis} value="${entrada}" placeholder="--:--" maxlength="5" oninput="escalaMascaraHorario(this)" onchange="escalaEditarHorario('${c.matricula}','entrada',this.value)" style="width:100%;box-sizing:border-box;background:transparent;border:none;color:var(--text-secondary);text-align:center;font-size:12px;padding:4px"></td>`;
  if (secOn) {
    html += `<td style="text-align:center;border:${BORDA};padding:2px"><input type="text" ${dis} value="${intInicio}" placeholder="--:--" maxlength="5" oninput="escalaMascaraHorario(this)" onchange="escalaEditarHorario('${c.matricula}','intervalo_inicio',this.value)" style="width:100%;box-sizing:border-box;background:transparent;border:none;color:var(--text-muted);text-align:center;font-size:12px;padding:4px" title="Início do intervalo"></td>`;
    html += `<td style="text-align:center;border:${BORDA};padding:2px"><input type="text" ${dis} value="${intFim}" placeholder="--:--" maxlength="5" oninput="escalaMascaraHorario(this)" onchange="escalaEditarHorario('${c.matricula}','intervalo_fim',this.value)" style="width:100%;box-sizing:border-box;background:transparent;border:none;color:var(--text-muted);text-align:center;font-size:12px;padding:4px" title="Fim do intervalo"></td>`;
  }
  // Saída não é mais editável: é sempre entrada + jornada + intervalo, pela
  // CH da pessoa. Deixar aberto convidava a digitar 07:00 num colaborador de
  // 180h que entra 00:00 e deveria sair 06:15, sem nada barrar.
  const saidaEsperada = escalaSaidaCalculada(entrada, ch);
  const divergente = saidaEsperada && saida && saida !== saidaEsperada;
  html += `<td class="escala-calculado" style="text-align:center;border:${BORDA};padding:4px;color:${divergente?'#f6ad55':'var(--text-muted)'};font-size:12px;font-variant-numeric:tabular-nums"
    title="${divergente
      ? `Valor salvo (${saida}) não bate com o calculado pela CH ${ch} (${saidaEsperada}). Use \"Recalcular saídas\" no menu Mais ações.`
      : `Calculado: entrada + jornada da CH ${ch||'?'} + intervalo. Pra mudar, altere a Entrada.`}">${saida || '--:--'}</td>`;
  html += `<td style="text-align:center;color:var(--text-secondary);border:${BORDA}">${ch}</td>`;
  html += `<td style="text-align:center;border:${BORDA};color:${corFolgas};font-weight:700;font-size:11px;font-variant-numeric:tabular-nums" title="${dicaFolgas}">${folgasFeitas}/${folgasMeta}</td>`;
  conteudo.forEach((item, i) => {
    const dia = i+1;
    const dow = new Date(ano, mesNum-1, dia).getDay();
    const dataISO = `${ano}-${String(mesNum).padStart(2,'0')}-${String(dia).padStart(2,'0')}`;
    const feriado = window._escalaFeriados?.get(dataISO);
    const fimDeSemana = dow === 0 || dow === 6;
    const bgCel = feriado ? 'rgba(252,129,129,.08)' : fimDeSemana ? 'var(--bg-hover)' : 'transparent';
    const editavel = item.editavel && !travada;
    html += `<td data-mat="${c.matricula}" data-dia="${dia}" onclick="${editavel?`escalaSelecionarCelula('${c.matricula}',${dia},this)`:''}" style="padding:2px;height:var(--escala-row-h,32px);cursor:${editavel?'pointer':'default'};background:${bgCel};border:${BORDA}" title="${feriado?feriado.nome:(item.detalhe||'')}">${escalaCelHTML(item)}</td>`;
  });
  html += `</tr>`;
  return html;
}

// Linha de cabeçalho de bloco (função ou turno) + linha de subtotal de
// folgas por dia daquele bloco — mesma definição de "folga" usada no
// restante do módulo (F/FA/J/CH conta, K não conta porque continua sendo
// dia de trabalho).
// ── Sub-bloco dentro do grupo ──────────────────────────
// O agrupamento antes descia por Setor → Bloco, os dois campos MANUAIS.
// Como quase ninguém preenche, todo mundo caía no mesmo balde: os 4
// supervisores de BEL apareciam juntos mesmo sendo 2 de noite (22:00 e
// 23:00) e 2 de manhã (10:00 e 11:00). Agora o critério é escolhido, e o
// padrão é o Turno automático — que já separa esse caso sozinho, sem
// depender de ninguém cadastrar nada.
const ESCALA_CRITERIOS_SUBBLOCO = [
  { valor: 'turno',   label: 'Turno (pelo horário)', dica: 'Alpha, Bravo, Charlie ou Delta, calculado pelo horário de entrada' },
  { valor: 'horario', label: 'Horário exato',        dica: 'Separa 22:00 de 23:00 — cada horário de entrada/saída vira um sub-bloco' },
  { valor: 'setor',   label: 'Setor (manual)',       dica: 'Usa o campo Setor preenchido na linha de cada pessoa' },
  { valor: 'bloco',   label: 'Bloco (manual)',       dica: 'Usa o campo Bloco preenchido na linha de cada pessoa' },
  { valor: 'nenhum',  label: 'Sem sub-bloco',        dica: 'Só o grupo de função, sem dividir por horário' },
];

// Setor e Bloco saíram da grade, então só fazem sentido como critério de
// sub-bloco numa base que JÁ tenha esses campos preenchidos (de importação
// ou de uso anterior). Numa base onde estão todos vazios — o caso de BEL —
// a opção some do seletor em vez de virar um "(sem setor)" único e inútil.
function escalaCriteriosSubBlocoDisponiveis() {
  const colabs = window._escalaColabs || [];
  const temSetor = colabs.some(c => c.turno);
  const temBloco = colabs.some(c => c.bloco_horario);
  return ESCALA_CRITERIOS_SUBBLOCO.filter(c =>
    (c.valor !== 'setor' || temSetor) && (c.valor !== 'bloco' || temBloco));
}

function escalaCriterioSubBloco() {
  const escolhido = window._escalaCriterioSubBloco || 'turno';
  // Se a base deixou de ter Setor/Bloco preenchido e o critério salvo era
  // um desses, cai pro padrão em vez de agrupar tudo num balde só.
  return escalaCriteriosSubBlocoDisponiveis().some(c => c.valor === escolhido) ? escolhido : 'turno';
}

// Rótulo do sub-bloco de um colaborador, no critério ativo. É a chave do
// agrupamento e o texto do cabeçalho — por isso o horário exato já sai
// formatado pra leitura ("22:00 às 02:00").
function escalaSubBlocoDoColab(c, ano, mesNum, diasNoMes, criterio) {
  const crit = criterio || escalaCriterioSubBloco();
  if (crit === 'nenhum') return null;
  if (crit === 'setor')  return c.turno || '(sem setor)';
  if (crit === 'bloco')  return c.bloco_horario || '(sem bloco)';

  const entrada = escalaEntradaEfetivaDoColab(c, ano, mesNum, diasNoMes);
  if (crit === 'horario') {
    if (!entrada) return '(sem horário)';
    const horarioFixo = escalaHorarioFixoDoColab(c.matricula, ano, mesNum, diasNoMes);
    const saidaCalc = horarioFixo ? horarioFixo.split('-')[1] : null;
    const saida = c.saida_manual || saidaCalc;
    return saida ? `${entrada} às ${saida}` : entrada;
  }
  return entrada ? escalaSetorDoTurno(entrada) : '(sem horário)';
}

function escalaSetCriterioSubBloco(valor) {
  window._escalaCriterioSubBloco = valor;
  try { localStorage.setItem('gde_escala_criterio_subbloco', valor); } catch (_) {}
  escalaGradeAtualiza();
}

// Ordena os sub-blocos: primeiro pelo horário de entrada de quem está
// dentro (Alpha antes de Bravo antes de Charlie antes de Delta, e 10:00
// antes de 22:00), com os "sem X" sempre por último. Ordenar o rótulo
// como texto puro colocaria "Turno Alpha" antes de "Turno Bravo" por
// acaso, mas quebraria no critério de horário exato.
function escalaOrdenarSubBlocos(entradas, ano, mesNum, diasNoMes) {
  const chave = (lista) => {
    const entradas = lista
      .map(c => escalaEntradaEfetivaDoColab(c, ano, mesNum, diasNoMes))
      .filter(Boolean)
      .sort();
    return entradas[0] || 'zz';
  };
  return [...entradas].sort((a, b) => {
    const semA = /^\(sem /.test(a[0]), semB = /^\(sem /.test(b[0]);
    if (semA !== semB) return semA ? 1 : -1;
    return chave(a[1]).localeCompare(chave(b[1])) || a[0].localeCompare(b[0], 'pt-BR');
  });
}

function escalaBlocoHeaderHTML(label, contagem, nivel, NCOLS, filtroBotoes) {
  const bg = nivel === 'funcao' ? 'var(--bg-surface)' : nivel === 'turno-a' ? 'rgba(0,160,210,.12)' : nivel === 'turno-b' ? 'rgba(159,122,234,.12)' : 'var(--bg-hover)';
  const cor = nivel === 'funcao' ? 'var(--text-primary)' : nivel === 'turno-a' ? 'var(--blue)' : nivel === 'turno-b' ? 'var(--purple)' : 'var(--text-secondary)';
  const paddingLeft = nivel === 'funcao' ? '10px' : nivel === 'bloco' ? '42px' : '26px';

  // "Gerar folgas" e "Remover folgas" andam em par: antes só dava pra
  // gerar por grupo, e pra tirar era o "Limpar folgas/status" da barra de
  // cima, que apaga a base+mês inteiros. Agora o mesmo recorte que gera
  // também desfaz. Os dois aceitam o filtro de sub-bloco, então dá pra
  // regerar só o turno da noite dos supervisores sem tocar no da manhã.
  let botoesHtml = '';
  if (filtroBotoes) {
    // O onclick vai entre aspas SIMPLES porque o argumento é um JSON com
    // aspas duplas. Por isso o escape precisa cobrir a apóstrofe também —
    // escalaEscapeAttr sozinho não cobre, e um rótulo com apóstrofe
    // fecharia o atributo no meio.
    const arg = String(JSON.stringify(filtroBotoes))
      .replace(/&/g, '&amp;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const alvo = escalaEscapeAttr(filtroBotoes.subBloco ? `${filtroBotoes.grupo} · ${filtroBotoes.subBloco}` : filtroBotoes.grupo);
    botoesHtml = `
      <button class="adh-refresh-btn" style="padding:3px 10px;font-size:10px;margin-left:12px" onclick='escalaGerarFolgasAuto(${arg})' title="Gera folgas automáticas só pra ${alvo}">${escalaIcone('zap')}Gerar folgas</button>
      <button class="adh-refresh-btn" style="padding:3px 10px;font-size:10px;margin-left:6px;color:#fc8181" onclick='escalaRemoverFolgas(${arg})' title="Apaga as folgas (F e FA) só de ${alvo} — não mexe em férias, afastamento nem curso">${escalaIcone('trash')}Remover folgas</button>`;
  }

  return `<tr><td colspan="${NCOLS}" style="padding:6px ${paddingLeft};background:${bg}">
    <div style="display:flex;align-items:center">
      <span style="font-weight:600;color:${cor};font-size:${nivel==='funcao'?'12.5px':'11.5px'}">${label}</span>
      <span style="color:${cor};opacity:.75;font-size:11px;margin-left:8px">${contagem} pessoa${contagem===1?'':'s'}</span>
      ${botoesHtml}
    </div>
  </td></tr>`;
}
function escalaBlocoTrabalhandoPorDia(colabsDoBloco, ano, mesNum, diasNoMes) {
  const porDia = new Array(diasNoMes).fill(0);
  colabsDoBloco.forEach(c => {
    escalaConteudoDoMes(c, ano, mesNum, diasNoMes).forEach((item, i) => {
      if (!item.status) porDia[i]++; // sem status = trabalhando, mesmo critério da linha "Trabalhando no dia" do topo
    });
  });
  return porDia;
}
function escalaBlocoSubtotalHTML(label, colabsDoBloco, ano, mesNum, diasNoMes, NCOLS_FIXAS, forte, BORDA) {
  const porDia = escalaBlocoTrabalhandoPorDia(colabsDoBloco, ano, mesNum, diasNoMes);
  // Antes usava var(--bg-hover), quase invisível (3% de opacidade) — trocado
  // por um tom com um pouco mais de presença, pra separar visualmente
  // "linha de resumo" de "linha de pessoa" ao escanear a tela rápido.
  const bg = forte ? 'rgba(0,160,210,.10)' : 'rgba(255,255,255,.045)';
  const peso = forte ? '700' : '600';
  const borda = forte ? 'border-top:1px solid rgba(0,160,210,.25);border-bottom:1px solid rgba(0,160,210,.25)' : 'border-top:1px solid var(--border)';
  return `<tr style="background:${bg};${borda}">
    <td colspan="${NCOLS_FIXAS}" style="padding:5px 10px;color:${forte?'var(--blue)':'var(--text-secondary)'};font-size:11px;text-align:right;font-weight:${peso};border:${BORDA}">${label} — trabalhando no dia ${escalaIconeSolto('arrowRight', 11)}</td>
    ${porDia.map(n => `<td style="text-align:center;border:${BORDA};color:${forte?'var(--blue)':'var(--text-secondary)'};font-weight:${peso};font-size:11px">${n}</td>`).join('')}
  </tr>`;
}

function escalaGradeTabelaHTML(ano, mesNum, diasNoMes) {
  const entradaDoColab = (c) => escalaEntradaEfetivaDoColab(c, ano, mesNum, diasNoMes);

  // Valor de cada colaborador pra uma coluna clicável específica — mesmo
  // catálogo usado tanto pro clique no cabeçalho (lista simples) quanto pra
  // ordenação dentro de cada setor (lista agrupada), pra não ter dois
  // critérios "quase iguais" competindo.
  const valorColuna = (c, coluna) => {
    switch (coluna) {
      case 'matricula': return String(c.matricula || '');
      case 'nome': return String(c.nome || '');
      case 'turno': return escalaSetorDoTurno(entradaDoColab(c)); // coluna "Turno" (automático, por horário)
      case 'setor': return String(c.turno || ''); // coluna "Setor" (manual)
      case 'bloco': return String(c.bloco_horario || ''); // coluna "Bloco" (manual, agrupa horários "iguais na prática")
      case 'entrada': default: return entradaDoColab(c);
    }
  };

  const colunaAtiva = window._escalaOrdemColuna || null;
  const direcao = window._escalaOrdemDirecao === 'desc' ? -1 : 1;

  let colabs;
  if (colunaAtiva) {
    // Clicou num cabeçalho — essa escolha explícita vale mais que a ordem
    // manual de arrastar. "Ordenar automático" (ou arrastar de novo) volta
    // a valer quando limpar a coluna ativa.
    colabs = [...(window._escalaColabs || [])].sort((a, b) =>
      direcao * String(valorColuna(a, colunaAtiva)).localeCompare(String(valorColuna(b, colunaAtiva)), 'pt-BR', { numeric: true }));
  } else {
    // Se o responsável já arrastou algum colaborador antes, a lista toda
    // passa a respeitar essa ordem manual (ordem_manual) em vez de reordenar
    // sozinha por função/horário — só volta a ordenar automático se ninguém
    // tiver ordem_manual definida ainda, ou se clicar em "Ordenar automático".
    colabs = [...(window._escalaColabs || [])].sort((a, b) => {
      const oa = a.ordem_manual, ob = b.ordem_manual;
      if (oa != null && ob != null) return oa - ob;
      if (oa != null) return -1;
      if (ob != null) return 1;
      const fa = window.eoColabs?.get(a.matricula)?.funcao || '';
      const fb = window.eoColabs?.get(b.matricula)?.funcao || '';
      return fa.localeCompare(fb) || entradaDoColab(a).localeCompare(entradaDoColab(b)) || String(a.nome||'').localeCompare(String(b.nome||''));
    });
  }
  const temOrdemManual = colabs.some(c => c.ordem_manual != null);
  const secOn = window._escalaColunasSecundarias !== false; // Setor/Turno/Bloco/Intervalos — ocultáveis
  // ATENÇÃO: tem que bater EXATAMENTE com o número de <th> do cabeçalho e
  // de <td> fixas de escalaLinhaColabHTML(). Estava 11/6 (uma a menos nos
  // dois modos), e como a linha "Trabalhando no dia" e os subtotais de
  // bloco usam colspan="${NCOLS_FIXAS}", a faixa fixa ficava curta em uma
  // célula: a contagem do dia 1 caía embaixo da coluna CH, todos os
  // números apareciam deslocados uma coluna pra esquerda e o último dia do
  // mês ficava sem célula nenhuma.
  //   com extras: Seleção, Matrícula, Nome, Turno, Função, Entrada,
  //               Interv.↓, Interv.↑, Saída, CH, Folgas = 11
  //   essenciais: Seleção, Matrícula, Nome, Função, Entrada, Saída, CH,
  //               Folgas = 8
  const NCOLS_FIXAS = secOn ? 11 : 8;
  const NCOLS = NCOLS_FIXAS + diasNoMes;
  const BORDA = '1px solid var(--border-strong)';
  const turnosExistentes = [...new Set(colabs.map(c => c.turno).filter(Boolean))].sort((a,b) => a.localeCompare(b));
  const blocosExistentes = [...new Set(colabs.map(c => c.bloco_horario).filter(Boolean))].sort((a,b) => a.localeCompare(b));

  // Larguras enxugadas pra caber o mês inteiro sem rolagem horizontal.
  // Antes davam 1122px de colunas fixas + 30px × 31 dias = 2052px de
  // largura mínima, contra ~1645px úteis num monitor Full HD — ou seja,
  // 400px de rolagem permanente. Agora dá 892px de fixas com as colunas
  // extras ligadas (1636px de mínima num mês de 31 dias) e 588px com as
  // essenciais (1332px), os dois abaixo do útil em Full HD.
  // Vale lembrar: com TODAS as extras ligadas num mês de 31 dias o dia
  // fica com ~24px, que é o piso do legível. O modo confortável de
  // verdade é o de colunas essenciais, onde sobra ~34px por dia.
  // Setor (82) e Bloco (82) saíram: os 164px foram pro Nome (160→235) e pra
  // Função (120→175), que apareciam cortados com reticências em quase toda
  // linha. Sobram ainda 34px de folga pras colunas de dia.
  const LARG = { remover:30, mat:66, nome:235, turno:82, funcao:175,
                 entrada:50, intInicio:48, intFim:48, saida:50, ch:34, folgas:44, diaMin:24 };
  const leftMat  = LARG.remover;
  const leftNome = LARG.remover + LARG.mat;
  // Preenche a tela toda usando o próprio comportamento padrão do HTML pra
  // tabelas (table-layout:fixed): as colunas de identidade (matrícula,
  // nome etc.) têm largura EXPLÍCITA em pixel; as colunas de dia NÃO têm
  // nenhuma largura declarada — pela especificação do CSS, colunas sem
  // largura "dividem igualmente o espaço que sobrar" depois de descontar
  // as que já têm largura fixa. Isso é o navegador fazendo a divisão
  // igual sozinho, sem nenhum JavaScript medindo nada (as duas tentativas
  // anteriores com cálculo em JS quebraram o layout). Um min-width no
  // <table> garante que, se a tela for estreita demais, ele para de
  // encolher os dias (no mínimo 24px cada) e passa a rolar horizontalmente
  // em vez de espremer até ficar ilegível.
  //
  // O <colgroup> emitia 11 <col> pra 12 colunas (faltava o Bloco, que nem
  // existia em LARG). Com table-layout:fixed as larguras escorregavam
  // todas uma casa: o Bloco ficava com os 190px da Função, a Função com
  // os 60px da Entrada (cortando o nome do cargo) e o CH caía na largura
  // automática dos dias. Agora sai uma <col> por coluna, na mesma ordem.
  const larguraFixas = LARG.remover + LARG.mat + LARG.nome
    + (secOn ? LARG.turno : 0)
    + LARG.funcao + LARG.entrada
    + (secOn ? LARG.intInicio + LARG.intFim : 0)
    + LARG.saida + LARG.ch + LARG.folgas;
  const larguraMinima = larguraFixas + LARG.diaMin * diasNoMes;

  let html = `<table style="border-collapse:collapse;font-size:13px;width:100%;min-width:${larguraMinima}px;table-layout:fixed"><colgroup>
    <col style="width:${LARG.remover}px"><col style="width:${LARG.mat}px"><col style="width:${LARG.nome}px">
    ${secOn?`<col style="width:${LARG.turno}px">`:''}
    <col style="width:${LARG.funcao}px"><col style="width:${LARG.entrada}px">
    ${secOn?`<col style="width:${LARG.intInicio}px"><col style="width:${LARG.intFim}px">`:''}
    <col style="width:${LARG.saida}px"><col style="width:${LARG.ch}px"><col style="width:${LARG.folgas}px">
    ${Array(diasNoMes).fill(`<col>`).join('')}
  </colgroup><thead><tr>`;
  // Helper de cabeçalho — antes eram 11 <th> escritos à mão, cada um com a
  // mesma parede de estilo inline repetida. Reduz o risco de uma coluna
  // sair diferente das outras sem ninguém notar.
  const seta = (col) => window._escalaOrdemColuna === col
    ? escalaIconeSolto(window._escalaOrdemDirecao === 'desc' ? 'chevronDown' : 'chevronUp', 11)
    : '';
  const thBase = (extra) => `padding:8px 6px;font-size:11px;text-transform:uppercase;position:sticky;top:0;background:var(--bg-surface);border:${BORDA};${extra||''}`;
  const th = ({ label, col, fixaLeft, align, titulo, classe }) => {
    const ativa = col && window._escalaOrdemColuna === col;
    const estilo = thBase(`
      color:${ativa ? 'var(--blue)' : 'var(--text-muted)'};
      text-align:${align || 'left'};
      z-index:${fixaLeft != null ? 3 : 2};
      ${fixaLeft != null ? `left:${fixaLeft}px;` : ''}
      ${col ? 'cursor:pointer;user-select:none;' : ''}`.replace(/\s+/g, ' '));
    return `<th class="${classe || ''}" style="${estilo}"${col ? ` onclick="escalaOrdenarPorColuna('${col}')"` : ''}${titulo ? ` title="${titulo}"` : ''}>${label}${col ? seta(col) : ''}</th>`;
  };

  html += `<th class="escala-fixa" style="${thBase('text-align:center;z-index:3;left:0')}"><input type="checkbox" onchange="escalaSelecionarTodos(this.checked)" title="Selecionar todos" style="margin:0"></th>`;
  html += th({ label:'Matrícula', col:'matricula', fixaLeft:leftMat, titulo:'Clique pra ordenar por matrícula', classe:'escala-fixa' });
  html += th({ label:'Nome', col:'nome', fixaLeft:leftNome, titulo:'Clique pra ordenar por nome', classe:'escala-fixa escala-fixa-borda' });
  if (secOn) {
    html += th({ label:'Turno auto', col:'turno', titulo:'Alpha/Bravo/Charlie/Delta, calculado sozinho pelo horário de entrada — clique pra ordenar' });
  }
  html += th({ label:'Função' });
  html += th({ label:'Entrada', col:'entrada', align:'center', titulo:'Clique pra ordenar por horário de entrada' });
  if (secOn) {
    html += th({ label:'Entra int.', align:'center', titulo:'Início do intervalo' });
    html += th({ label:'Volta int.', align:'center', titulo:'Fim do intervalo' });
  }
  html += th({ label:'Saída', align:'center', titulo:'Calculada: entrada + jornada da CH + intervalo. Não é editável — mude a Entrada.' });
  html += th({ label:'CH', align:'center' });
  html += th({ label:'Folgas', align:'center', titulo:'Folgas marcadas no mês (F e FA) contra a meta calculada pela carga horária' });
  for (let d = 1; d <= diasNoMes; d++) {
    const dow = new Date(ano, mesNum-1, d).getDay();
    const dataISO = `${ano}-${String(mesNum).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const feriado = window._escalaFeriados?.get(dataISO);
    const fimDeSemana = dow === 0 || dow === 6;
    const bg = feriado ? 'rgba(252,129,129,.14)' : fimDeSemana ? 'var(--weekend-tint)' : 'var(--bg-surface)';
    html += `<th style="padding:5px 2px;color:${feriado?'#fc8181':'var(--text-muted)'};font-size:10.5px;font-weight:600;text-align:center;position:sticky;top:0;background:${bg};z-index:2;border:${BORDA}" title="${feriado?feriado.nome:''}">${ESCALA_DIAS_SEMANA[dow]}<br><span style="color:${feriado?'#fc8181':'var(--text-secondary)'};font-size:11px">${d}</span></th>`;
  }
  html += `</tr></thead><tbody>`;

  // Linha pra adicionar por matrícula direto na tabela — digita e aperta
  // Enter, o nome aparece sozinho (mesma busca do campo de cima). Fica no
  // topo, sempre visível, em vez de escondida lá embaixo da lista.
  // Pré-calcula quantas pessoas estão trabalhando em cada dia — recalcula
  // sozinha a cada marcação de F/K/J/CH, porque a tabela inteira já
  // re-renderiza toda vez que algo muda (escalaGradeAtualiza).
  const contagemPorDia = new Array(diasNoMes).fill(0);
  colabs.forEach(c => {
    const conteudo = escalaConteudoDoMes(c, ano, mesNum, diasNoMes);
    conteudo.forEach((item, i) => { if (!item.status) contagemPorDia[i]++; }); // sem status = trabalhando
  });
  // Destaca dias com pouca gente escalada em relação à média do mês — só
  // um alerta visual, não impede nada. <90% da média = laranja, <80% =
  // vermelho (mesmas cores já usadas em outros avisos da tela).
  const mediaContagem = contagemPorDia.reduce((s,v) => s+v, 0) / (contagemPorDia.length || 1);
  const corDoDia = (n) => {
    if (!mediaContagem) return { bg: 'var(--bg-surface)', cor: 'var(--text-primary)', aviso: '' };
    const razao = n / mediaContagem;
    if (razao < 0.8) return { bg: 'rgba(252,129,129,.16)', cor: '#fc8181', aviso: ` — ${Math.round((1-razao)*100)}% abaixo da média do mês (${Math.round(mediaContagem)})` };
    if (razao < 0.9) return { bg: 'rgba(246,173,85,.14)', cor: '#f6ad55', aviso: ` — ${Math.round((1-razao)*100)}% abaixo da média do mês (${Math.round(mediaContagem)})` };
    return { bg: 'var(--bg-surface)', cor: 'var(--text-primary)', aviso: '' };
  };
  html += `<tr class="escala-linha-trabalhando" style="background:rgba(0,160,210,.06)">
    <td colspan="${NCOLS_FIXAS}" class="escala-fixa" style="border:${BORDA};padding:6px 10px;color:var(--text-secondary);font-size:11px;text-align:right;font-weight:600;position:sticky;top:var(--escala-thead-h, 36px);left:0;z-index:16;white-space:nowrap">Trabalhando no dia ${escalaIconeSolto('arrowRight', 11)}</td>
    ${contagemPorDia.map(n => {
      const { bg, cor, aviso } = corDoDia(n);
      return `<td style="text-align:center;border:${BORDA};color:${cor};font-weight:700;font-size:12px;position:sticky;top:var(--escala-thead-h, 36px);z-index:15;background:${bg}" title="${n} trabalhando${aviso}">${n}</td>`;
    }).join('')}
  </tr>`;

  // Linha de referência: pico de demanda simultânea daquele dia, calculado
  // pela malha de voos real × parâmetros de solo. O motor já rodava em
  // escalaRenderGrade e o resultado ficava em window._escalaDemandaPorDia,
  // mas nunca chegava na grade — só aparecia no card de KPI da tela antiga.
  // Fica logo abaixo da contagem pra dar a comparação de olho: dia com
  // muita gente de folga e pico alto salta na hora.
  // Nome honesto de propósito: é PICO SIMULTÂNEO, não "quantas pessoas
  // escalar" (uma pessoa cobre um turno inteiro, então o total de gente
  // necessária no dia é maior que o pico). Serve pra comparar o formato da
  // curva, não como meta absoluta.
  if (window._escalaDemandaPorDia) {
    const picos = [];
    for (let d = 1; d <= diasNoMes; d++) picos.push(escalaPicoDoDia(d));
    const picoMax = Math.max(1, ...picos);
    html += `<tr class="escala-linha-pico">
      <td colspan="${NCOLS_FIXAS}" class="escala-fixa" style="border:${BORDA};padding:4px 10px;color:var(--text-muted);font-size:10.5px;text-align:right;position:sticky;left:0;top:var(--escala-topo-pico,72px);z-index:14;white-space:nowrap">Pico da malha no dia ${escalaIconeSolto('arrowRight', 10)}</td>
      ${picos.map(p => {
        const forca = p / picoMax;
        const cor = forca > .9 ? 'var(--blue)' : 'var(--text-muted)';
        return `<td style="text-align:center;border:${BORDA};color:${cor};font-size:10px;font-weight:${forca>.9?'700':'500'};position:sticky;top:var(--escala-topo-pico,72px);z-index:13" title="Pico de ${p} pessoas simultâneas pela malha de voos">${p}</td>`;
      }).join('')}
    </tr>`;
  }

  // Linha de cadastro. Fica GRUDADA logo abaixo das duas linhas de
  // contagem: antes ela rolava junto com o corpo e passava por baixo do
  // cabeçalho fixo, dando a impressão de sobreposição.
  //
  // Dois caminhos no mesmo lugar: matrícula que já existe no cadastro do
  // RH (o normal), ou cadastro manual completo pra quem ainda não subiu no
  // sistema. O manual exige CH porque é ela que governa a meta de folgas e
  // o cálculo da saída — sem ela a pessoa cairia no fallback de 6 folgas,
  // que pode não ser a dela.
  const chsConhecidas = Object.keys(ESCALA_CH_REGRAS).sort((a,b) => a-b);
  const inputEstilo = 'box-sizing:border-box;background:transparent;border:1px dashed var(--border-strong);border-radius:4px;color:var(--text-secondary);font-size:11px;padding:5px 7px';
  html += `<tr class="escala-linha-add">
    <td class="escala-fixa" style="border:${BORDA};padding:2px;position:sticky;left:0"></td>
    <td class="escala-fixa" style="border:${BORDA};padding:2px;position:sticky;left:${leftMat}px">
      <input type="text" id="escala-add-inline" ${window._escalaTravada ? 'disabled' : ''} placeholder="+ matrícula"
        onkeydown="if(event.key==='Enter') escalaAdicionarPorMatriculaInline(this.value)"
        style="width:100%;${inputEstilo};font-family:monospace">
    </td>
    <td colspan="${NCOLS - 2}" style="border:${BORDA};padding:5px 10px">
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <span style="color:var(--text-muted);font-size:11px">digite a matrícula e aperte Enter — o nome aparece sozinho</span>
        <span style="color:var(--text-muted);opacity:.5">|</span>
        <button class="adh-refresh-btn" style="padding:3px 10px;font-size:10px" ${window._escalaTravada ? 'disabled' : ''}
          onclick="escalaToggleFormManual()" title="Pra colaborador novo que ainda não subiu no cadastro do RH">
          ${escalaIcone('userPlus')}Cadastrar manualmente
        </button>
      </div>
      <div id="escala-form-manual" style="display:none;margin-top:8px;padding:10px;background:var(--bg-hover);border-radius:7px">
        <div style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap">
          ${[['mat','Matrícula','110px','text'],['nome','Nome completo','240px','text'],['funcao','Função','200px','text']]
            .map(([id,rot,w]) => `<div><label style="font-size:9.5px;color:var(--text-muted);display:block;margin-bottom:3px">${rot}</label>
              <input type="text" id="escala-man-${id}" style="width:${w};${inputEstilo}"></div>`).join('')}
          <div><label style="font-size:9.5px;color:var(--text-muted);display:block;margin-bottom:3px">CH (obrigatória)</label>
            <select id="escala-man-ch" style="width:90px;${inputEstilo};cursor:pointer">
              <option value="">—</option>
              ${chsConhecidas.map(ch => `<option value="${ch}">${ch}h</option>`).join('')}
            </select></div>
          <div><label style="font-size:9.5px;color:var(--text-muted);display:block;margin-bottom:3px">Entrada</label>
            <input type="text" id="escala-man-entrada" placeholder="--:--" maxlength="5" oninput="escalaMascaraHorario(this)" style="width:70px;${inputEstilo};text-align:center"></div>
          <div><label style="font-size:9.5px;color:var(--text-muted);display:block;margin-bottom:3px">Saída</label>
            <span id="escala-man-saida" style="display:inline-block;width:70px;text-align:center;font-size:11px;color:var(--text-muted);padding:5px 0">--:--</span></div>
          <button class="adh-refresh-btn" style="background:var(--blue);color:#0b0f1a;border:none;font-weight:600;padding:5px 12px;font-size:11px"
            onclick="escalaSalvarColabManual()">Adicionar</button>
          <button class="adh-refresh-btn" style="padding:5px 12px;font-size:11px" onclick="escalaToggleFormManual()">Cancelar</button>
        </div>
        <div style="margin-top:7px;color:var(--amber);font-size:10.5px;display:flex;align-items:center;gap:5px">
          ${escalaIconeSolto('alert', 12)}Colaborador fora do cadastro do RH: não aparece em Aderência nem no Headcount. Peça a regularização.
        </div>
      </div>
    </td>
  </tr>`;

  if (!colabs.length) {
    html += `<tr><td colspan="${NCOLS}" style="padding:24px;text-align:center;color:var(--text-muted);font-size:12.5px;border:${BORDA}">Nenhum colaborador ativo encontrado pra essa base+mês — busque por matrícula ou nome acima.</td></tr>`;
  }

  const ctxLinha = { ano, mesNum, diasNoMes, leftMat, leftNome, BORDA, turnosExistentes, blocosExistentes, secOn };

  if (!window._escalaAgruparPorTurno) {
    // Lista simples (comportamento de sempre) — ordem manual de arrastar
    // continua valendo aqui.
    colabs.forEach((c, ci) => { html += escalaLinhaColabHTML(c, ci, ctxLinha); });
  } else {
    // Agrupado: Grupo de função → sub-bloco (critério escolhido, padrão
    // Turno automático) → linhas → contagem de gente trabalhando por dia.
    //
    // A contagem por dia agora sai SEMPRE. Antes ela dependia do grupo ter
    // mais de um Setor ou mais de um Bloco (campos manuais, quase sempre
    // vazios), então na prática nunca aparecia.
    const criterio = escalaCriterioSubBloco();
    const colunaOrdemGrupo = colunaAtiva || 'entrada';

    const gruposFuncao = new Map(); // codigo -> { label, subBlocos: Map(label -> colabs[]) }
    colabs.forEach(c => {
      const { codigo, label } = escalaFuncaoGrupoDoColab(c);
      if (!gruposFuncao.has(codigo)) gruposFuncao.set(codigo, { label, subBlocos: new Map() });
      const grupo = gruposFuncao.get(codigo);
      const sub = escalaSubBlocoDoColab(c, ano, mesNum, diasNoMes, criterio) || '__todos__';
      if (!grupo.subBlocos.has(sub)) grupo.subBlocos.set(sub, []);
      grupo.subBlocos.get(sub).push(c);
    });

    // "Mostrar grupos" — null/ausente = mostra todos (padrão)
    const gruposVisiveis = window._escalaGruposVisiveis;
    let funcoesOrdenadas = [...gruposFuncao.entries()].sort((a, b) => ESCALA_GRUPOS.indexOf(a[1].label) - ESCALA_GRUPOS.indexOf(b[1].label));
    if (gruposVisiveis && gruposVisiveis.size) {
      funcoesOrdenadas = funcoesOrdenadas.filter(([, grupo]) => gruposVisiveis.has(grupo.label));
    }
    const recolhido = !!window._escalaBlocosRecolhidos;

    // Dentro do sub-bloco, a ordem de arrastar manda — era isso que fazia
    // o arrastar parecer quebrado no modo agrupado: ele salvava a ordem e
    // a tela reordenava por Entrada logo em seguida, ignorando o que
    // acabou de ser gravado.
    const ordenarColabs = (lista) => {
      const temManual = lista.some(c => c.ordem_manual != null);
      if (temManual) {
        return [...lista].sort((a, b) => {
          const oa = a.ordem_manual, ob = b.ordem_manual;
          if (oa != null && ob != null) return oa - ob;
          if (oa != null) return -1;
          if (ob != null) return 1;
          return 0;
        });
      }
      return [...lista].sort((a, b) =>
        direcao * String(valorColuna(a, colunaOrdemGrupo)).localeCompare(String(valorColuna(b, colunaOrdemGrupo)), 'pt-BR', { numeric: true }));
    };

    funcoesOrdenadas.forEach(([, grupo]) => {
      const todosDoGrupo = [...grupo.subBlocos.values()].flat();
      const subBlocos = escalaOrdenarSubBlocos([...grupo.subBlocos.entries()], ano, mesNum, diasNoMes);
      const semSubBloco = criterio === 'nenhum' || (subBlocos.length === 1 && subBlocos[0][0] === '__todos__');

      html += escalaBlocoHeaderHTML(grupo.label, todosDoGrupo.length, 'funcao', NCOLS, { grupo: grupo.label });

      subBlocos.forEach(([subLabel, colabsDoSub], si) => {
        if (!semSubBloco) {
          html += escalaBlocoHeaderHTML(subLabel, colabsDoSub.length, si % 2 === 0 ? 'turno-a' : 'turno-b', NCOLS,
            { grupo: grupo.label, subBloco: subLabel, criterio });
        }
        if (!recolhido) {
          ordenarColabs(colabsDoSub).forEach((c, ci) => {
            html += escalaLinhaColabHTML(c, ci, { ...ctxLinha, grupoDaLinha: grupo.label, subBlocoDaLinha: subLabel });
          });
        }
        // Contagem do sub-bloco. Se o grupo tem um sub-bloco só, essa linha
        // já é o total do grupo — não repete embaixo.
        html += escalaBlocoSubtotalHTML(
          semSubBloco ? `Total ${grupo.label}` : subLabel,
          colabsDoSub, ano, mesNum, diasNoMes, NCOLS_FIXAS, semSubBloco, BORDA);
      });

      if (!semSubBloco && subBlocos.length > 1) {
        html += escalaBlocoSubtotalHTML(`Total ${grupo.label}`, todosDoGrupo, ano, mesNum, diasNoMes, NCOLS_FIXAS, true, BORDA);
      }
      html += `<tr><td colspan="${NCOLS}" style="height:8px;border:none"></td></tr>`;
    });
  }

  return html + `</tbody></table>`;
}

function escalaBuscarColab(termo) {
  const div = document.getElementById('escala-busca-resultados');
  if (!div) return;
  if (!termo || termo.trim().length < 2) { div.style.display = 'none'; return; }
  const t = termo.trim().toUpperCase();
  const base = window._escalaBase;
  const jaAdicionados = new Set((window._escalaColabs||[]).map(c => c.matricula));
  const achados = [];
  if (window.eoColabs) {
    for (const [mat, r] of window.eoColabs) {
      if ((r.station||'').toUpperCase() !== base.toUpperCase()) continue;
      if (jaAdicionados.has(mat)) continue;
      if (mat.includes(t) || String(r.nome||'').toUpperCase().includes(t)) {
        achados.push({ mat, nome: r.nome });
        if (achados.length >= 8) break;
      }
    }
  }
  if (!achados.length) { div.innerHTML = `<div style="padding:10px 12px;color:var(--text-muted);font-size:11.5px">Nenhum colaborador encontrado nessa base.</div>`; div.style.display = 'block'; return; }
  div.innerHTML = achados.map(a => `
    <div onclick="escalaAdicionarColab('${a.mat}')" style="padding:8px 12px;cursor:pointer;border-bottom:1px solid var(--border);font-size:11.5px;color:var(--text-primary)"
      onmouseover="this.style.background='rgba(0,160,210,.08)'" onmouseout="this.style.background='transparent'">
      <span style="color:var(--text-muted);font-family:monospace;margin-right:8px">${a.mat}</span>${a.nome||''}
    </div>`).join('');
  div.style.display = 'block';
}

async function escalaAdicionarColab(matricula) {
  if (escalaVerificarTravada()) return false;
  const r = window.eoColabs?.get(matricula);
  const nome = r?.nome || '';
  const busca = document.getElementById('escala-busca');
  if (busca) busca.value = '';
  const resultados = document.getElementById('escala-busca-resultados');
  if (resultados) resultados.style.display = 'none';

  // Trava de segurança: nunca deixa entrar colaborador de outra base sem
  // avisar — antes disso, digitar/colar uma matrícula de outra base entrava
  // direto, sem nenhum aviso.
  if (r && (r.station||'').toUpperCase() !== String(window._escalaBase||'').toUpperCase()) {
    escalaMsg(`${nome || 'Colaborador'} (matrícula ${matricula}) é da base ${r.station||'?'}, não de ${window._escalaBase} — não foi adicionado.`, true);
    return false;
  }

  const payload = {
    base: window._escalaBase, mes: window._escalaMes, matricula, nome,
    created_by: currentUserProfile?.id || currentUser?.id || null,
  };
  const { data, error } = await db.from('escala_colaborador').upsert(payload, { onConflict: 'base,mes,matricula' }).select().single();
  if (error) { alert('Erro ao adicionar: ' + error.message); return false; }
  window._escalaColabs = [...(window._escalaColabs||[]), data];
  escalaGradeAtualiza();
  return true;
}

// Digitar a matrícula direto na última linha da tabela e apertar Enter —
// acha o nome sozinho no cadastro, sem precisar usar a busca de cima.
async function escalaAdicionarPorMatriculaInline(matricula) {
  matricula = String(matricula||'').trim();
  if (!matricula) return;
  if (!window.eoColabs?.has(matricula)) {
    escalaMsg(`Matrícula "${matricula}" não encontrada no cadastro.`, true);
    return;
  }
  if ((window._escalaColabs||[]).some(c => c.matricula === matricula)) {
    escalaMsg('Esse colaborador já está nessa escala.', true);
    return;
  }
  const ok = await escalaAdicionarColab(matricula);
  if (ok) escalaMsg(`${window.eoColabs.get(matricula).nome} adicionado.`);
}

// Corrigir a matrícula de uma linha já existente na escala — troca o
// colaborador daquela linha (remove o antigo, adiciona o novo), com a
// mesma trava de base e de duplicidade dos outros caminhos de adicionar.
async function escalaEditarMatricula(matriculaAntiga, novaMatriculaRaw) {
  if (escalaVerificarTravada()) { escalaGradeAtualiza(); return; }
  const novaMatricula = String(novaMatriculaRaw||'').trim();
  if (!novaMatricula || novaMatricula === matriculaAntiga) { escalaGradeAtualiza(); return; }

  const info = window.eoColabs?.get(novaMatricula);
  if (!info) {
    escalaMsg(`Matrícula "${novaMatricula}" não encontrada no cadastro.`, true);
    escalaGradeAtualiza();
    return;
  }
  if ((info.station||'').toUpperCase() !== String(window._escalaBase||'').toUpperCase()) {
    escalaMsg(`${info.nome} (matrícula ${novaMatricula}) é da base ${info.station||'?'}, não de ${window._escalaBase} — a matrícula não foi trocada.`, true);
    escalaGradeAtualiza();
    return;
  }
  if ((window._escalaColabs||[]).some(c => c.matricula === novaMatricula)) {
    escalaMsg(`${info.nome} já está nessa escala.`, true);
    escalaGradeAtualiza();
    return;
  }

  const payload = {
    base: window._escalaBase, mes: window._escalaMes, matricula: novaMatricula, nome: info.nome,
    created_by: currentUserProfile?.id || currentUser?.id || null,
  };
  const { data, error } = await db.from('escala_colaborador').upsert(payload, { onConflict: 'base,mes,matricula' }).select().single();
  if (error) { escalaMsg('Erro ao trocar matrícula: ' + error.message, true); escalaGradeAtualiza(); return; }

  await db.from('escala_colaborador').delete().eq('base', window._escalaBase).eq('mes', window._escalaMes).eq('matricula', matriculaAntiga);
  await db.from('escala_dia').delete().eq('base', window._escalaBase).eq('mes', window._escalaMes).eq('matricula', matriculaAntiga);

  window._escalaColabs = (window._escalaColabs||[]).filter(c => c.matricula !== matriculaAntiga);
  window._escalaColabs.push(data);
  escalaGradeAtualiza();
  escalaMsg(`Matrícula corrigida — agora é ${info.nome} (${novaMatricula}).`);
}

async function escalaEditarHorario(matricula, campo, valor) {
  if (escalaVerificarTravada()) { escalaGradeAtualiza(); return; }
  const COLUNAS = {
    entrada: 'entrada_manual',
    intervalo_inicio: 'intervalo_inicio_manual',
    intervalo_fim: 'intervalo_fim_manual',
    saida: 'saida_manual',
  };
  const coluna = COLUNAS[campo];
  if (!coluna) return;

  const updates = { [coluna]: valor || null };

  // Ao preencher a Entrada, se a Saída ainda estiver vazia, calcula
  // automaticamente somando a jornada diária da carga horária (CH) do
  // colaborador — poupa ter que digitar a Saída na mão toda vez. Não
  // considera o intervalo (são campos separados, editáveis à parte).
  const c = (window._escalaColabs||[]).find(x => x.matricula === matricula);
  let saidaAutoCalculada = null;
  if (campo === 'entrada' && valor && !c?.saida_manual) {
    const horaMatch = valor.match(/^(\d{1,2}):(\d{2})$/);
    const ch = window.eoColabs?.get(matricula)?.ch || (window._escalaColabs||[]).find(x=>x.matricula===matricula)?.ch_manual;
    const chNum = parseInt(String(ch||'').replace(/\D/g,''), 10);
    const regra = ESCALA_CH_REGRAS[chNum];
    if (horaMatch && regra) {
      const minutosEntrada = parseInt(horaMatch[1],10)*60 + parseInt(horaMatch[2],10);
      const minutosSaida = (minutosEntrada + regra.jornadaDiaria*60) % (24*60);
      saidaAutoCalculada = `${String(Math.floor(minutosSaida/60)).padStart(2,'0')}:${String(minutosSaida%60).padStart(2,'0')}`;
      updates.saida_manual = saidaAutoCalculada;
    }
  }

  const { error } = await db.from('escala_colaborador').update(updates)
    .eq('base', window._escalaBase).eq('mes', window._escalaMes).eq('matricula', matricula);
  if (error) { escalaMsg('Erro ao salvar horário: ' + error.message, true); return; }

  if (c) Object.assign(c, updates);
  if (saidaAutoCalculada) {
    escalaGradeAtualiza(); // precisa re-renderizar pra mostrar a Saída preenchida sozinha
    escalaMsg(`Horário salvo — Saída calculada automaticamente (${saidaAutoCalculada}) pela carga horária.`);
  } else {
    escalaMsg('Horário atualizado.');
  }
}

// Máscara de horário — o gestor só digita os números (ex.: "0800"), o ":"
// aparece sozinho ("08:00"). Aceita até 4 dígitos (HHMM).
function escalaMascaraHorario(input) {
  let digitos = input.value.replace(/\D/g, '').slice(0, 4);
  input.value = digitos.length >= 3 ? `${digitos.slice(0,2)}:${digitos.slice(2)}` : digitos;
}

// ── Importação de Cursos (Excel) ────────────────────────
// Baixa um modelo com as colunas certas; ao importar, marca "K" (curso)
// automaticamente nos dias certos pra quem já está nessa escala.
function escalaBaixarModeloCursos() {
  const linhas = [
    ['Matrícula', 'Nome', 'Função', 'Carga Horária', 'Data do Curso', 'Curso'],
    ['170019', 'ADILSON DOS SANTOS', 'AUX.LIDER DE RAMPA I', '180', '15/08/2026', 'Integração de Segurança'],
  ];
  const ws = XLSX.utils.aoa_to_sheet(linhas);
  ws['!cols'] = [{ wch: 12 }, { wch: 28 }, { wch: 24 }, { wch: 14 }, { wch: 14 }, { wch: 28 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Cursos');
  XLSX.writeFile(wb, 'modelo-cursos.xlsx');
}

// Mesma lógica de conversão de data usada no Admin (serial do Excel, ou
// texto DD/MM/AAAA) — reimplementada aqui pra não depender de admin.js
// estar carregado antes.
function escalaParseDataExcel(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') {
    const d = new Date(Date.UTC(1899, 11, 30) + v * 86400000);
    if (!isNaN(d)) return d.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return null;
}

async function escalaImportarCursos(input) {
  if (escalaVerificarTravada()) { input.value = ''; return; }
  const file = input.files[0];
  if (!file) return;
  escalaMsg('Lendo arquivo de cursos...');

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const wb = XLSX.read(e.target.result, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });

      const [ano, mesNum] = window._escalaMes.split('-').map(Number);
      const colabsNaEscala = new Set((window._escalaColabs || []).map(c => c.matricula));

      const inserts = [];
      let foraDoMes = 0, naoEncontrados = 0;
      rows.forEach((row, i) => {
        if (i === 0 || !row || row[0] == null) return; // pula cabeçalho/linha vazia
        const matRaw = String(row[0]).trim();
        if (!matRaw || isNaN(parseInt(matRaw))) return;
        const matricula = matRaw.padStart(6, '0');
        const dataCurso = escalaParseDataExcel(row[4]);
        const curso = row[5] != null ? String(row[5]).trim() : null;
        if (!dataCurso) return;

        const [anoC, mesC, diaC] = dataCurso.split('-').map(Number);
        if (anoC !== ano || mesC !== mesNum) { foraDoMes++; return; }
        if (!colabsNaEscala.has(matricula)) { naoEncontrados++; return; }

        inserts.push({
          base: window._escalaBase, mes: window._escalaMes, matricula, dia: diaC, status: 'K',
          detalhe: curso, origem: 'import_curso',
          updated_at: new Date(), updated_by: currentUserProfile?.id || currentUser?.id || null,
        });
      });

      if (!inserts.length) {
        escalaMsg(`Nenhum curso aplicável encontrado (${foraDoMes} fora do mês atual, ${naoEncontrados} matrícula(s) fora dessa escala).`, true);
        input.value = '';
        return;
      }

      const { error } = await db.from('escala_dia').upsert(inserts, { onConflict: 'base,mes,matricula,dia' });
      if (error) { escalaMsg('Erro ao importar cursos: ' + error.message, true); input.value = ''; return; }

      for (const ins of inserts) window._escalaDias.set(`${ins.matricula}|${ins.dia}`, ins);
      escalaGradeAtualiza();

      let msg = `${inserts.length} dia(s) de curso marcados`;
      if (foraDoMes) msg += ` · ${foraDoMes} fora do mês atual (ignorados)`;
      if (naoEncontrados) msg += ` · ${naoEncontrados} matrícula(s) fora dessa escala`;
      escalaMsg(msg + '.');
      input.value = '';
    } catch (err) {
      escalaMsg('Erro ao ler o arquivo: ' + err.message, true);
      input.value = '';
    }
  };
  reader.readAsArrayBuffer(file);
}

// Barra de progresso (mesmo visual usado no carregamento de ponto) — pra
// dar feedback visual em ações que demoram um pouco, tipo preencher staff
// ou gerar folgas pra uma base grande.
function escalaLoadingHTML(label) {
  return `
    <div class="adm-progress-wrap" style="padding:40px 20px">
      <i class="ti ti-loader-2" style="font-size:24px;opacity:.5;animation:spin 1s linear infinite" aria-hidden="true"></i>
      <div class="adm-progress-label" id="escala-load-label">${label}</div>
      <div class="adm-progress-track"><div class="adm-progress-fill" id="escala-load-fill" style="width:0%"></div></div>
      <div class="adm-progress-count" id="escala-load-count"></div>
    </div>`;
}
function escalaMostrarLoading(label) {
  const wrap = document.getElementById('escala-grade-wrap');
  if (wrap) wrap.innerHTML = escalaLoadingHTML(label);
}
function escalaLoadingAtualiza(feito, total) {
  const fill = document.getElementById('escala-load-fill');
  const count = document.getElementById('escala-load-count');
  if (!fill || !count) return;
  const pct = total ? Math.round(feito / total * 100) : 0;
  fill.style.width = `${pct}%`;
  count.textContent = `${feito.toLocaleString('pt-BR')} / ${total.toLocaleString('pt-BR')} · ${pct}%`;
}

// Puxa todo o staff ativo da base pro mês atual, direto do cadastro (sem
// depender do arquivo de Horários já ter sido subido pra esse mês) — usa o
// mesmo filtro de "escala revezada" já combinado (fora Gerente/Coordenador/
// Administrativo/Especialista/Analista/ADM, que continuam podendo ser
// adicionados manualmente). Não duplica quem já está na lista.
async function escalaPreencherTodoStaff() {
  if (escalaVerificarTravada()) return;
  const base = window._escalaBase;
  if (!window.eoColabs?.size) { escalaMsg('Cadastro de colaboradores ainda não carregado.', true); return; }

  const candidatos = [];
  for (const [matricula, r] of window.eoColabs) {
    if ((r.station||'').toUpperCase() !== String(base||'').toUpperCase()) continue;
    if (typeof hcIsDesligado === 'function' && hcIsDesligado(matricula)) continue;
    candidatos.push({ matricula, nome: r.nome });
  }
  if (!candidatos.length) { escalaMsg('Nenhum colaborador ativo encontrado pra essa base.', true); return; }

  const jaNaLista = new Set((window._escalaColabs||[]).map(c => c.matricula));
  const novos = candidatos.filter(c => !jaNaLista.has(c.matricula));
  if (!novos.length) { escalaMsg('Todo mundo já está nessa escala.'); return; }

  if (!confirm(`Preencher a escala de ${base} com todo o efetivo ativo (${novos.length} colaborador${novos.length===1?'':'es'})? Você poderá remover quem não for necessário depois.`)) return;

  escalaMostrarLoading(`Preenchendo ${novos.length} colaborador${novos.length===1?'':'es'}...`);

  const linhas = novos.map(c => ({
    base, mes: window._escalaMes, matricula: c.matricula, nome: c.nome,
    created_by: currentUserProfile?.id || currentUser?.id || null,
  }));
  const BATCH = 200;
  for (let i = 0; i < linhas.length; i += BATCH) {
    const { error } = await db.from('escala_colaborador').upsert(linhas.slice(i, i+BATCH), { onConflict: 'base,mes,matricula' });
    if (error) { escalaGradeAtualiza(); escalaMsg('Erro ao preencher: ' + error.message, true); return; }
    escalaLoadingAtualiza(Math.min(i + BATCH, linhas.length), linhas.length);
  }

  const { data } = await db.from('escala_colaborador').select('*').eq('base', base).eq('mes', window._escalaMes);
  window._escalaColabs = data || [];
  escalaGradeAtualiza();
  escalaMsg(`${novos.length} colaborador${novos.length===1?'':'es'} adicionado${novos.length===1?'':'s'} — organizados por função e horário de entrada.`);
}

async function escalaLimparColaboradores() {
  if (escalaVerificarTravada()) return;
  if (!confirm('Remover TODOS os colaboradores dessa escala (base+mês)? Isso também apaga todas as marcações de F/K/CH/J deles. Não dá pra desfazer.')) return;
  const base = window._escalaBase, mes = window._escalaMes;
  await db.from('escala_dia').delete().eq('base', base).eq('mes', mes);
  const { error } = await db.from('escala_colaborador').delete().eq('base', base).eq('mes', mes);
  if (error) { escalaMsg('Erro ao limpar: ' + error.message, true); return; }
  window._escalaColabs = [];
  window._escalaDias = new Map();
  escalaGradeAtualiza();
  escalaMsg('Todos os colaboradores foram removidos dessa escala.');
}

async function escalaLimparStatus() {
  if (escalaVerificarTravada()) return;
  if (!confirm('Limpar todas as marcações de Folga/FA/Cursos/Afastado/Compensa dessa escala (base+mês)? Os colaboradores continuam na escala, só o preenchimento some. Não dá pra desfazer.')) return;
  const base = window._escalaBase, mes = window._escalaMes;
  const { error } = await db.from('escala_dia').delete().eq('base', base).eq('mes', mes);
  if (error) { escalaMsg('Erro ao limpar: ' + error.message, true); return; }
  window._escalaDias = new Map();
  escalaGradeAtualiza();
  escalaMsg('Marcações de F/FA/K/CH/J limpas (férias automáticas continuam vindo do cadastro).');
}

async function escalaRemoverColab(matricula) {
  if (escalaVerificarTravada()) return;
  if (!confirm('Remover esse colaborador dessa escala? Os F/K marcados pra ele nesse mês também somem.')) return;
  const base = window._escalaBase, mes = window._escalaMes;
  await db.from('escala_dia').delete().eq('base', base).eq('mes', mes).eq('matricula', matricula);
  const { error } = await db.from('escala_colaborador').delete().eq('base', base).eq('mes', mes).eq('matricula', matricula);
  if (error) { alert('Erro ao remover: ' + error.message); return; }
  window._escalaColabs = (window._escalaColabs||[]).filter(c => c.matricula !== matricula);
  for (const k of [...window._escalaDias.keys()]) if (k.startsWith(matricula+'|')) window._escalaDias.delete(k);
  escalaGradeAtualiza();
}

// ── Seleção múltipla (checkbox) e remoção em lote ──────
function escalaToggleSelecao(matricula, checked) {
  if (!window._escalaSelecionados) window._escalaSelecionados = new Set();
  if (checked) window._escalaSelecionados.add(matricula);
  else window._escalaSelecionados.delete(matricula);
  escalaAtualizarBotaoRemoverSelecionados();
}

function escalaSelecionarTodos(checked) {
  window._escalaSelecionados = new Set();
  if (checked) {
    document.querySelectorAll('[data-escala-check]').forEach(el => {
      window._escalaSelecionados.add(el.getAttribute('data-escala-check'));
      el.checked = true;
    });
  } else {
    document.querySelectorAll('[data-escala-check]').forEach(el => { el.checked = false; });
  }
  escalaAtualizarBotaoRemoverSelecionados();
}

function escalaAtualizarBotaoRemoverSelecionados() {
  const n = window._escalaSelecionados?.size || 0;
  const btn = document.getElementById('escala-btn-remover-sel');
  if (!btn) return;
  btn.style.display = n > 0 ? 'inline-flex' : 'none';
  btn.innerHTML = `${escalaIcone('trash')}Remover selecionados (${n})`;
}

async function escalaRemoverSelecionados() {
  if (escalaVerificarTravada()) return;
  const selecionados = [...(window._escalaSelecionados || [])];
  if (!selecionados.length) return;
  if (!confirm(`Remover ${selecionados.length} colaborador${selecionados.length===1?'':'es'} dessa escala? As marcações de F/K/CH/J deles nesse mês também somem. Não dá pra desfazer.`)) return;

  const base = window._escalaBase, mes = window._escalaMes;
  await db.from('escala_dia').delete().eq('base', base).eq('mes', mes).in('matricula', selecionados);
  const { error } = await db.from('escala_colaborador').delete().eq('base', base).eq('mes', mes).in('matricula', selecionados);
  if (error) { escalaMsg('Erro ao remover: ' + error.message, true); return; }

  const removidos = new Set(selecionados);
  window._escalaColabs = (window._escalaColabs||[]).filter(c => !removidos.has(c.matricula));
  for (const k of [...window._escalaDias.keys()]) {
    const mat = k.split('|')[0];
    if (removidos.has(mat)) window._escalaDias.delete(k);
  }
  window._escalaSelecionados = new Set();
  escalaGradeAtualiza();
  escalaAtualizarBotaoRemoverSelecionados();
  escalaMsg(`${selecionados.length} colaborador${selecionados.length===1?'':'es'} removido${selecionados.length===1?'':'s'}.`);
}

// ── Arrastar pra reordenar manualmente ──────────────────
// Enquanto ninguém arrasta nada, a lista continua ordenando sozinha por
// função + horário de entrada. Assim que arrasta uma vez, a ordem vira
// manual (salva em ordem_manual) e passa a valer até clicar em "Ordenar
// automático" de novo.
//
// Estava sem efeito visível por dois motivos, os dois de ordenação e
// nenhum do arrastar em si: (1) no modo agrupado o desenho ignorava
// ordem_manual de propósito e reordenava por Entrada; (2) com qualquer
// coluna de ordenação ativa, a coluna vencia a ordem manual. O drop
// gravava certo no banco e a tela redesenhava idêntica.
function escalaDragStart(e, matricula) {
  if (window._escalaTravada) { e.preventDefault(); return; }
  window._escalaArrastando = matricula;
  e.dataTransfer.setData('text/plain', matricula);
  e.dataTransfer.effectAllowed = 'move';
  document.querySelector(`tr[data-escala-linha="${matricula}"]`)?.classList.add('escala-arrastando');
}

function escalaDragEnd() {
  window._escalaArrastando = null;
  document.querySelectorAll('.escala-arrastando, .escala-alvo-acima, .escala-alvo-abaixo')
    .forEach(el => el.classList.remove('escala-arrastando', 'escala-alvo-acima', 'escala-alvo-abaixo'));
}

// Só aceita soltar dentro do MESMO sub-bloco. Arrastar um supervisor da
// noite pro meio dos da manhã não reordenaria nada de verdade — o
// agrupamento é por horário, então ele voltaria pro lugar de origem no
// próximo desenho. Melhor recusar na hora, com o cursor mostrando isso.
function escalaMesmoBloco(origem, destino) {
  if (!window._escalaAgruparPorTurno) return true;
  const trO = document.querySelector(`tr[data-escala-linha="${origem}"]`);
  const trD = document.querySelector(`tr[data-escala-linha="${destino}"]`);
  if (!trO || !trD) return true;
  return trO.dataset.grupo === trD.dataset.grupo && trO.dataset.subbloco === trD.dataset.subbloco;
}

function escalaDragOver(e, matriculaAlvo) {
  const arrastada = window._escalaArrastando;
  if (!arrastada || arrastada === matriculaAlvo) return;
  if (!escalaMesmoBloco(arrastada, matriculaAlvo)) { e.dataTransfer.dropEffect = 'none'; return; }
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';

  // Linha-guia em cima ou embaixo, conforme a metade da linha em que o
  // cursor está — sem isso não dá pra saber onde a pessoa vai cair.
  const tr = e.currentTarget;
  const caixa = tr.getBoundingClientRect();
  const acima = (e.clientY - caixa.top) < caixa.height / 2;
  tr.classList.toggle('escala-alvo-acima', acima);
  tr.classList.toggle('escala-alvo-abaixo', !acima);
}

function escalaDragLeave(e) {
  e.currentTarget.classList.remove('escala-alvo-acima', 'escala-alvo-abaixo');
}

async function escalaDrop(e, matriculaAlvo) {
  e.preventDefault();
  const tr = e.currentTarget;
  const soltarAcima = tr.classList.contains('escala-alvo-acima');
  escalaDragEnd();
  if (escalaVerificarTravada()) return;

  const matriculaArrastada = e.dataTransfer.getData('text/plain');
  if (!matriculaArrastada || matriculaArrastada === matriculaAlvo) return;
  if (!escalaMesmoBloco(matriculaArrastada, matriculaAlvo)) {
    escalaMsg('Só dá pra reordenar dentro do mesmo bloco. Pra mudar alguém de turno, ajuste o horário de entrada dessa pessoa.', true);
    return;
  }

  // A ordem de referência é a que está NA TELA, não a do array bruto —
  // senão soltar "antes do Fábio" no visual gravava uma posição diferente.
  const naTela = escalaMatriculasNaTela();
  const lista = window._escalaColabs || [];
  const porMat = new Map(lista.map(c => [c.matricula, c]));
  const ordenada = naTela.map(m => porMat.get(m)).filter(Boolean);
  lista.forEach(c => { if (!naTela.includes(c.matricula)) ordenada.push(c); });

  const idxArrastado = ordenada.findIndex(c => c.matricula === matriculaArrastada);
  if (idxArrastado === -1) return;
  const [item] = ordenada.splice(idxArrastado, 1);
  let idxAlvo = ordenada.findIndex(c => c.matricula === matriculaAlvo);
  if (idxAlvo === -1) return;
  ordenada.splice(soltarAcima ? idxAlvo : idxAlvo + 1, 0, item);

  ordenada.forEach((c, i) => { c.ordem_manual = i; });
  window._escalaColabs = ordenada;

  // Ordenação por coluna venceria a ordem manual no próximo desenho —
  // arrastar desliga ela, senão o arrasto some na frente do usuário.
  if (window._escalaOrdemColuna) {
    window._escalaOrdemColuna = null;
    try { localStorage.removeItem('gde_escala_ordem_coluna'); } catch (_) {}
  }

  const updates = ordenada.map((c, i) => ({
    base: window._escalaBase, mes: window._escalaMes, matricula: c.matricula, nome: c.nome, ordem_manual: i,
  }));
  const BATCH = 200;
  for (let i = 0; i < updates.length; i += BATCH) {
    const { error } = await db.from('escala_colaborador').upsert(updates.slice(i, i+BATCH), { onConflict: 'base,mes,matricula' });
    if (error) { escalaMsg('Erro ao salvar a ordem: ' + error.message, true); return; }
  }
  escalaGradeAtualiza();
  escalaMsg(`${item.nome || item.matricula} movido. A lista não reordena mais sozinha até você clicar em "Ordenar automático".`);
}

async function escalaLimparOrdemManual() {
  if (escalaVerificarTravada()) return;
  const lista = window._escalaColabs || [];
  const temOrdemManual = lista.some(c => c.ordem_manual != null);
  const temOrdemColuna = !!window._escalaOrdemColuna;
  if (!temOrdemManual && !temOrdemColuna) { escalaMsg('Essa escala já está na ordenação automática.'); return; }

  window._escalaOrdemColuna = null;
  window._escalaOrdemDirecao = 'asc';
  try { localStorage.removeItem('gde_escala_ordem_coluna'); localStorage.setItem('gde_escala_ordem_direcao', 'asc'); } catch (_) {}

  if (!temOrdemManual) { escalaGradeAtualiza(); escalaMsg('Voltou pra ordenação automática (função → horário de entrada).'); return; }

  lista.forEach(c => { c.ordem_manual = null; });
  const updates = lista.map(c => ({ base: window._escalaBase, mes: window._escalaMes, matricula: c.matricula, nome: c.nome, ordem_manual: null }));
  const BATCH = 200;
  for (let i = 0; i < updates.length; i += BATCH) {
    const { error } = await db.from('escala_colaborador').upsert(updates.slice(i, i+BATCH), { onConflict: 'base,mes,matricula' });
    if (error) { escalaMsg('Erro ao voltar a ordem: ' + error.message, true); return; }
  }
  escalaGradeAtualiza();
  escalaMsg('Voltou pra ordenação automática (função → horário de entrada).');
}

// ── Digitação por teclado ──────────────────────────────
// Clica na célula pra selecionar (fica com contorno azul), depois digita
// F, J ou K pra marcar — L é recusado (férias é automático, não digitável),
// e qualquer outra tecla também é recusada. Backspace/Delete limpa.
const ESCALA_TECLAS_VALIDAS = ['F', 'J', 'K', 'CH', 'FA'];

function escalaSelecionarCelula(matricula, dia, elCel) {
  window._escalaCelulaSelecionada = { matricula, dia };
  window._escalaAncora = null;
  escalaRestaurarSelecaoVisual();
  escalaMsg('Célula selecionada — digite F, J, K, C (compensa) ou A (folga agrupada). Setas andam, Shift+setas pegam um período, Backspace limpa.');
}

// Repinta o destaque da seleção. Usa classe CSS em vez de style.outline
// inline porque agora a seleção pode ser um retângulo (Shift+setas), não
// só uma célula.
function escalaRestaurarSelecaoVisual() {
  document.querySelectorAll('#escala-grade-wrap .escala-cel-sel, #escala-grade-wrap .escala-cel-faixa')
    .forEach(el => el.classList.remove('escala-cel-sel', 'escala-cel-faixa'));
  const sel = window._escalaCelulaSelecionada;
  if (!sel) return;

  escalaCelulasSelecionadas().forEach(({ matricula, dia }) => {
    document.querySelector(`#escala-grade-wrap td[data-mat="${matricula}"][data-dia="${dia}"]`)
      ?.classList.add('escala-cel-faixa');
  });
  const el = document.querySelector(`#escala-grade-wrap td[data-mat="${sel.matricula}"][data-dia="${sel.dia}"]`);
  if (el) {
    el.classList.remove('escala-cel-faixa');
    el.classList.add('escala-cel-sel');
    window._escalaCelSelecionadaEl = el;
  }
}

// Verifica se, com o estado atual da grade (incluindo o que já vinha
// carregado do fim do mês anterior), esse colaborador tem algum trecho de
// mais de 6 dias seguidos trabalhando no mês — sinaliza sem bloquear a
// edição, já que às vezes a gestão precisa mesmo fazer exceção.
async function escalaVerificarSequencia(matricula, ano, mesNum, diasNoMes) {
  let seq = await escalaDiasSeguidosNoFimDoMesAnterior(window._escalaBase, matricula, window._escalaMes);
  let maxSeq = seq;
  for (let d = 1; d <= diasNoMes; d++) {
    const manual = window._escalaDias.get(`${matricula}|${d}`);
    const folga = (manual && ['F','FA','J','CH'].includes(manual.status)) || escalaEstaDeFerias(matricula, ano, mesNum, d);
    if (folga) { seq = 0; } else { seq++; maxSeq = Math.max(maxSeq, seq); }
  }
  return maxSeq > 6 ? maxSeq : null;
}

async function escalaAplicarTeclaNaCelula(tecla) {
  const sel = window._escalaCelulaSelecionada;
  if (!sel) return;
  if (escalaVerificarTravada()) return;
  const base = window._escalaBase, mes = window._escalaMes;
  const [ano, mesNum] = mes.split('-').map(Number);
  const diasNoMes = new Date(ano, mesNum, 0).getDate();

  // Com Shift+setas a seleção vira um retângulo — a tecla vale pra tudo
  // que está selecionado, num gravação só em vez de uma por célula.
  const alvos = escalaCelulasSelecionadas();
  const emLote = alvos.length > 1;

  if (tecla === 'BACKSPACE' || tecla === 'DELETE') {
    for (const { matricula, dia } of alvos) {
      await db.from('escala_dia').delete().eq('base', base).eq('mes', mes).eq('matricula', matricula).eq('dia', dia);
      window._escalaDias.delete(`${matricula}|${dia}`);
    }
    escalaGradeAtualiza();
    const violacao = await escalaVerificarSequencia(sel.matricula, ano, mesNum, diasNoMes);
    escalaMsg(violacao
      ? `${emLote ? `${alvos.length} células limpas` : 'Célula limpa'} — atenção: esse colaborador ficou com ${violacao} dias seguidos trabalhando em algum trecho do mês (o máximo é 6, regra 6x1).`
      : (emLote ? `${alvos.length} células limpas.` : 'Célula limpa.'), !!violacao);
    return;
  }

  if (tecla === 'L') {
    escalaMsg('L não pode ser digitado — férias vem automático do cadastro, não é manual.', true);
    return;
  }

  // 'C' é o atalho de uma tecla só pra marcar CH (Folga compensa / banco de
  // horas), e 'A' pra marcar FA (Folga agrupada) — o status salvo sempre é
  // a versão de duas letras (igual o resto do sistema já espera pra exibir
  // e pra contar em Aderência); só o atalho de digitação é de uma tecla,
  // pro mesmo jeito de usar F/J/K.
  const statusFinal = tecla === 'C' ? 'CH' : tecla === 'A' ? 'FA' : tecla;

  if (ESCALA_TECLAS_VALIDAS.indexOf(statusFinal) === -1) {
    escalaMsg(`"${tecla}" não é uma letra válida nessa célula. Use F, J, K, C (compensa) ou A (folga agrupada).`, true);
    return;
  }

  const agora = new Date();
  const autor = currentUserProfile?.id || currentUser?.id || null;
  const payloads = alvos.map(({ matricula, dia }) => ({
    base, mes, matricula, dia, status: statusFinal, origem: 'manual',
    updated_at: agora, updated_by: autor,
  }));

  const { error } = await db.from('escala_dia').upsert(payloads, { onConflict: 'base,mes,matricula,dia' });
  if (error) { escalaMsg('Erro ao salvar: ' + error.message, true); return; }
  payloads.forEach(p => window._escalaDias.set(`${p.matricula}|${p.dia}`, p));
  escalaGradeAtualiza();

  const violacao = await escalaVerificarSequencia(sel.matricula, ano, mesNum, diasNoMes);
  const feito = emLote ? `${alvos.length} células marcadas como ${statusFinal}` : `Marcado como ${statusFinal}`;
  escalaMsg(violacao
    ? `${feito} — mas esse colaborador ficou com ${violacao} dias seguidos trabalhando em algum trecho do mês (o máximo é 6, regra 6x1). Confira se precisa de uma folga a mais em algum ponto.`
    : `${feito}.`, !!violacao);
}

// Ordem das matrículas como estão na tela agora (respeita agrupamento,
// ordenação e filtros) — é o eixo vertical da navegação por seta.
function escalaMatriculasNaTela() {
  return [...document.querySelectorAll('#escala-grade-wrap td[data-mat][data-dia="1"]')]
    .map(td => td.dataset.mat);
}

// Move a seleção de célula com as setas. Sem isso, montar um mês inteiro
// exigia um clique por célula — com 200 pessoas × 31 dias isso é o gargalo
// da tela. Shift+setas estende a seleção pra um intervalo, e a letra
// digitada em seguida é aplicada no intervalo todo de uma vez.
function escalaMoverSelecao(dLinha, dDia, estendendo) {
  const sel = window._escalaCelulaSelecionada;
  if (!sel) return;
  const [ano, mesNum] = window._escalaMes.split('-').map(Number);
  const diasNoMes = new Date(ano, mesNum, 0).getDate();
  const mats = escalaMatriculasNaTela();
  const i = mats.indexOf(sel.matricula);
  if (i === -1) return;

  if (estendendo && !window._escalaAncora) window._escalaAncora = { ...sel };
  if (!estendendo) window._escalaAncora = null;

  const novaMat = mats[Math.max(0, Math.min(mats.length - 1, i + dLinha))];
  const novoDia = Math.max(1, Math.min(diasNoMes, sel.dia + dDia));
  window._escalaCelulaSelecionada = { matricula: novaMat, dia: novoDia };
  escalaRestaurarSelecaoVisual();
  document.querySelector('#escala-grade-wrap .escala-cel-sel')
    ?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

// Todas as células do retângulo entre a âncora e a célula atual. Sem
// âncora, é só a própria célula.
function escalaCelulasSelecionadas() {
  const sel = window._escalaCelulaSelecionada;
  if (!sel) return [];
  const ancora = window._escalaAncora;
  if (!ancora) return [{ ...sel }];
  const mats = escalaMatriculasNaTela();
  const i1 = Math.min(mats.indexOf(ancora.matricula), mats.indexOf(sel.matricula));
  const i2 = Math.max(mats.indexOf(ancora.matricula), mats.indexOf(sel.matricula));
  const d1 = Math.min(ancora.dia, sel.dia);
  const d2 = Math.max(ancora.dia, sel.dia);
  const lista = [];
  for (let i = i1; i <= i2; i++) for (let d = d1; d <= d2; d++) lista.push({ matricula: mats[i], dia: d });
  return lista;
}

function escalaKeydownHandler(e) {
  if (!window._escalaCelulaSelecionada) return;
  const tag = document.activeElement?.tagName;
  if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return; // não interfere na busca/seletores

  const setas = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
  if (setas[e.key]) {
    e.preventDefault();
    escalaMoverSelecao(setas[e.key][0], setas[e.key][1], e.shiftKey);
    return;
  }
  if (e.key === 'Escape') {
    e.preventDefault();
    window._escalaCelulaSelecionada = null;
    window._escalaAncora = null;
    if (window._escalaCelSelecionadaEl) {
      window._escalaCelSelecionadaEl.classList.remove('escala-cel-sel');
      window._escalaCelSelecionadaEl = null;
    }
    document.querySelectorAll('.escala-cel-faixa').forEach(el => el.classList.remove('escala-cel-faixa'));
    escalaMsg('');
    return;
  }

  const tecla = e.key.toUpperCase();
  if (tecla.length !== 1 && tecla !== 'BACKSPACE' && tecla !== 'DELETE') return;
  e.preventDefault();
  escalaAplicarTeclaNaCelula(tecla);
}

if (!window._escalaKeydownRegistrado) {
  window._escalaKeydownRegistrado = true;
  document.addEventListener('keydown', escalaKeydownHandler);
}

// Gera folgas nos dias de menor demanda de voos, pra quem ainda não tem
// folga suficiente no mês — não mexe em dias já ocupados (F/K manuais ou
// férias). Simples de propósito na v1: mesma quantidade de folga-alvo pra
// todo mundo, sem levar em conta função/carga horária ainda.
// Regras de jornada por carga horária — teto mensal de horas trabalhadas
// (nunca pode passar disso, pode ficar abaixo) e jornada diária de cada
// faixa. Confirmado com o cliente — substitui a regra antiga de "N folgas
// fixas por CH" (que só valia mesmo pra 90h, e olha lá — pro 180h o certo
// é 5 folgas, não 6 como estava antes).
const ESCALA_CH_REGRAS = {
  60:  { jornadaDiaria: 2, teto30: 48,  teto31: 48  },
  90:  { jornadaDiaria: 3, teto30: 72,  teto31: 72  },
  100: { jornadaDiaria: 4, teto30: 100, teto31: 100 },
  // CH 120 segue a MESMA regra da 100 (confirmado com o cliente). Antes
  // tinha teto 120 com jornada de 4h, o que dava 30 dias de trabalho e
  // deixava 1 folga no mês inteiro — era o "0/5"/"0/1" que aparecia na
  // grade. Repare que nas faixas maiores o teto também é menor que a CH
  // (180 → 150, 210 → 177), justamente pra descontar o descanso; só a
  // linha do 120 tinha ficado sem esse desconto.
  120: { jornadaDiaria: 4, teto30: 100, teto31: 100 },
  180: { jornadaDiaria: 6, teto30: 150, teto31: 150 },
  210: { jornadaDiaria: 7, teto30: 171, teto31: 177 },
};

// Minutos de intervalo por carga horária — confirmado com o cliente:
// CH 210h = 1h; CH 180h = 15min. Jornadas mais curtas não têm intervalo
// obrigatório definido, então ficam em zero.
function escalaIntervaloMinutosPorCH(ch) {
  const chNum = parseInt(String(ch||'').replace(/\D/g,''), 10);
  return chNum >= 210 ? 60 : chNum === 180 ? 15 : 0;
}

// Saída = entrada + jornada diária + intervalo. O intervalo entra na conta
// porque é a saída REAL (a que bate no crachá): quem cumpre 7h de jornada
// com 1h de almoço fica 8h no local. Antes só somava a jornada, e mesmo
// assim só quando o campo estava vazio — por isso a base tinha saídas
// importadas sem relação nenhuma com a entrada (10:00→12:00, 22:00→02:00
// em gente de CH 210, que deveria ser +8h).
function escalaSaidaCalculada(entrada, ch) {
  const m = String(entrada||'').match(/^(\d{1,2}):(\d{2})$/);
  const regra = ESCALA_CH_REGRAS[parseInt(String(ch||'').replace(/\D/g,''), 10)];
  if (!m || !regra) return null;
  const minEntrada = parseInt(m[1],10)*60 + parseInt(m[2],10);
  const total = (minEntrada + regra.jornadaDiaria*60 + escalaIntervaloMinutosPorCH(ch)) % (24*60);
  return `${String(Math.floor(total/60)).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`;
}

// Meta de folgas no mês = dias do mês menos os dias de trabalho necessários
// pra bater (sem ultrapassar) o teto mensal de horas daquela carga horária.
// Não é mais uma tabela fixa — é calculado, porque quem manda é o teto.
// A distribuição continua respeitando o máximo de 6 dias seguidos
// trabalhando antes de uma folga (podendo ser menos: 3x1, 4x1, 5x1 também
// valem), isso fica a cargo de quem monta a sequência (escalaGerarFolgasAuto).
function escalaMetaFolgasDoColab(ch, diasNoMes) {
  // Piso de descanso semanal: ninguém pode ficar com menos de uma folga por
  // semana, seja qual for a CH. É rede de segurança — se amanhã entrar uma
  // carga horária nova na tabela com o teto errado, o pior que acontece é a
  // meta ficar conservadora, não alguém aparecer com 1 folga no mês.
  const piso = Math.ceil(diasNoMes / 7);
  const chNum = parseInt(String(ch||'').replace(/\D/g,''), 10);
  const regra = ESCALA_CH_REGRAS[chNum];
  if (!regra) return Math.max(6, piso); // CH fora da tabela — fallback conservador
  const teto = diasNoMes >= 31 ? regra.teto31 : regra.teto30;
  const diasTrabalho = Math.ceil(teto / regra.jornadaDiaria);
  return Math.max(piso, diasNoMes - diasTrabalho);
}

function escalaMesAnterior(mes) {
  const [ano, mesNum] = mes.split('-').map(Number);
  const d = new Date(ano, mesNum-2, 1);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}

// Copia entrada/saída/intervalo do mês anterior pra quem ainda não tem
// horário definido nesse mês — prático quando o gestor quer manter o mesmo
// horário de sempre. Olha tanto o que estava manual quanto o que vinha do
// arquivo de Horários daquele mês; nunca sobrescreve quem já tem horário
// definido nesse mês (entrada + saída já preenchidos).
async function escalaPreencherHorarioMesAnterior() {
  if (escalaVerificarTravada()) return;
  const colabs = window._escalaColabs || [];
  if (!colabs.length) { escalaMsg('Adicione pelo menos um colaborador antes.', true); return; }

  const mesAnterior = escalaMesAnterior(window._escalaMes);
  const [anoAnt, mesNumAnt] = mesAnterior.split('-').map(Number);
  const diasNoMesAnt = new Date(anoAnt, mesNumAnt, 0).getDate();
  const labelMesAnt = typeof adhMonthLabel === 'function' ? adhMonthLabel(mesAnterior) : mesAnterior;

  if (!confirm(`Preencher entrada/saída/intervalo de quem ainda está sem horário completo esse mês, copiando o que valia em ${labelMesAnt}?`)) return;

  const { data, error } = await db.from('escala_colaborador')
    .select('matricula,entrada_manual,saida_manual,intervalo_inicio_manual,intervalo_fim_manual')
    .eq('base', window._escalaBase).eq('mes', mesAnterior)
    .in('matricula', colabs.map(c => c.matricula));
  if (error) { escalaMsg('Erro ao buscar o mês anterior: ' + error.message, true); return; }
  const porMatricula = new Map((data||[]).map(r => [r.matricula, r]));

  const updates = [];
  for (const c of colabs) {
    if (c.entrada_manual && c.saida_manual) continue; // já tem horário completo esse mês — não mexe

    const anterior = porMatricula.get(c.matricula);
    const horarioFixoAnt = escalaHorarioFixoDoColab(c.matricula, anoAnt, mesNumAnt, diasNoMesAnt);
    const [entradaCalcAnt, saidaCalcAnt] = horarioFixoAnt ? horarioFixoAnt.split('-') : [null, null];
    const entradaAnt = anterior?.entrada_manual || entradaCalcAnt;
    const saidaAnt   = anterior?.saida_manual   || saidaCalcAnt;
    if (!entradaAnt && !saidaAnt) continue; // não tinha horário nenhum no mês anterior também

    // Intervalo: prioriza o que já estava manual no mês anterior; senão,
    // descobre pelo ponto batido de verdade (sai1/ent2) daquele mês; senão,
    // cai pro padrão por carga horária (210h=1h, 180h=15min).
    const ch = window.eoColabs?.get(c.matricula)?.ch || c.ch_manual;
    const intervaloPontoAnt = escalaIntervaloFixoDoColab(c.matricula, anoAnt, mesNumAnt, diasNoMesAnt);
    const [intInicioCalcAnt, intFimCalcAnt] = intervaloPontoAnt ? intervaloPontoAnt.split('-') : [null, null];
    let intInicioAnt = anterior?.intervalo_inicio_manual || intInicioCalcAnt;
    let intFimAnt     = anterior?.intervalo_fim_manual    || intFimCalcAnt;
    if (!intInicioAnt && !intFimAnt) {
      const padrao = escalaIntervaloPadraoPorCH(ch, entradaAnt);
      if (padrao) [intInicioAnt, intFimAnt] = padrao.split('-');
    }

    updates.push({
      base: window._escalaBase, mes: window._escalaMes, matricula: c.matricula, nome: c.nome,
      entrada_manual: c.entrada_manual || entradaAnt || null,
      saida_manual: c.saida_manual || saidaAnt || null,
      intervalo_inicio_manual: c.intervalo_inicio_manual || intInicioAnt || null,
      intervalo_fim_manual: c.intervalo_fim_manual || intFimAnt || null,
    });
  }
  if (!updates.length) { escalaMsg('Ninguém precisava — todo mundo já tem horário completo, ou não tinha horário nenhum no mês anterior.'); return; }

  const BATCH = 200;
  for (let i = 0; i < updates.length; i += BATCH) {
    const { error: err2 } = await db.from('escala_colaborador').upsert(updates.slice(i, i+BATCH), { onConflict: 'base,mes,matricula' });
    if (err2) { escalaMsg('Erro ao salvar: ' + err2.message, true); return; }
  }
  for (const u of updates) {
    const c = window._escalaColabs.find(x => x.matricula === u.matricula);
    if (c) Object.assign(c, u);
  }
  escalaGradeAtualiza();
  escalaMsg(`Horário preenchido pra ${updates.length} colaborador(es), copiado de ${labelMesAnt}.`);
}

// Regra de rotação: quem teve folga agrupada (2+ F seguidos) no mês
// passado não recebe de novo nesse mês — evita bater sempre na mesma
// pessoa. Confirmado com o cliente.
async function escalaTeveFAMesPassado(base, matricula, mesAtual) {
  const mesAnterior = escalaMesAnterior(mesAtual);
  const { data } = await db.from('escala_dia').select('dia').eq('base', base).eq('matricula', matricula).eq('mes', mesAnterior).eq('status', 'F').order('dia');
  if (!data || data.length < 2) return false;
  const dias = data.map(r => r.dia);
  for (let i = 0; i < dias.length - 1; i++) {
    if (dias[i+1] === dias[i] + 1) return true;
  }
  return false;
}

// A sequência de dias trabalhados não zera na virada do mês — se a pessoa
// já vinha trabalhando sem folga nos últimos dias de julho, o dia 1 de
// agosto já entra "puxando" essa contagem. Olha o mês anterior só pra
// referência (nunca mexe nele), contando pra trás a partir do último dia
// até achar uma folga/férias/afastamento — isso vira o ponto de partida da
// simulação do mês novo, em vez de sempre começar do zero no dia 1.
async function escalaDiasSeguidosNoFimDoMesAnterior(base, matricula, mesAtual) {
  const mesAnterior = escalaMesAnterior(mesAtual);
  const [anoAnt, mesNumAnt] = mesAnterior.split('-').map(Number);
  const diasNoMesAnterior = new Date(anoAnt, mesNumAnt, 0).getDate();

  const { data } = await db.from('escala_dia').select('dia,status').eq('base', base).eq('matricula', matricula).eq('mes', mesAnterior);
  // Sem NENHUM registro no mês anterior pra essa matrícula (mês nunca foi
  // preenchido, por exemplo), não temos como saber se ela trabalhou ou não
  // — o seguro é assumir sequência zero, não o mês inteiro trabalhado. Sem
  // esse corte, todo mundo entrava no mês novo já "estourado" no limite de
  // 6 dias, forçando folga em todo mundo logo no dia 1.
  if (!data || !data.length) return 0;

  const statusPorDia = new Map(data.map(r => [r.dia, r.status]));
  let seq = 0;
  for (let d = diasNoMesAnterior; d >= 1; d--) {
    const st = statusPorDia.get(d);
    const folga = st === 'F' || st === 'FA' || st === 'J' || st === 'CH' || escalaEstaDeFerias(matricula, anoAnt, mesNumAnt, d);
    if (folga) break;
    seq++;
  }
  return seq;
}

// Recorte de colaboradores usado por "Gerar folgas" e "Remover folgas".
// Aceita string (só o grupo, formato antigo) ou {grupo, subBloco, criterio}.
function escalaFiltrarColabs(filtro) {
  let colabs = window._escalaColabs || [];
  if (!filtro) return { colabs, rotulo: '' };

  const f = typeof filtro === 'string' ? { grupo: filtro } : filtro;
  if (f.grupo) colabs = colabs.filter(c => escalaFuncaoGrupoDoColab(c).label === f.grupo);
  if (f.subBloco) {
    const [ano, mesNum] = window._escalaMes.split('-').map(Number);
    const diasNoMes = new Date(ano, mesNum, 0).getDate();
    colabs = colabs.filter(c => escalaSubBlocoDoColab(c, ano, mesNum, diasNoMes, f.criterio) === f.subBloco);
  }
  const rotulo = [f.grupo, f.subBloco].filter(Boolean).join(' · ');
  return { colabs, rotulo };
}

// Apaga só as folgas (F e FA) do recorte, deixando férias (L, que nem é
// manual), afastamento (J) e curso (K) intactos. É o par do "Gerar
// folgas": antes, pra desfazer uma geração era preciso usar o "Limpar
// folgas/status" da barra de cima, que apaga a base+mês inteiros e leva
// junto J, K e CH que alguém tinha marcado na mão.
async function escalaRemoverFolgas(filtro) {
  if (escalaVerificarTravada()) return;
  const { colabs, rotulo } = escalaFiltrarColabs(filtro);
  if (!colabs.length) { escalaMsg(rotulo ? `Não achei ninguém em "${rotulo}".` : 'Nenhum colaborador nessa escala.', true); return; }

  const base = window._escalaBase, mes = window._escalaMes;
  const matriculas = colabs.map(c => c.matricula);
  const alvos = [];
  for (const [chave, registro] of window._escalaDias) {
    const mat = chave.split('|')[0];
    if (matriculas.includes(mat) && (registro.status === 'F' || registro.status === 'FA')) alvos.push(chave);
  }
  if (!alvos.length) { escalaMsg(`Nenhuma folga marcada em ${rotulo || 'nesta escala'} pra remover.`); return; }

  const onde = rotulo ? `de ${rotulo}` : 'de TODA a escala';
  if (!confirm(`Remover ${alvos.length} folga(s) ${onde}?\n\nFérias, afastamento (J), curso (K) e compensação (CH) não são tocados.`)) return;

  // Apaga em lotes por matrícula — o Supabase limita o tamanho do "in".
  const LOTE = 100;
  for (let i = 0; i < matriculas.length; i += LOTE) {
    const { error } = await db.from('escala_dia').delete()
      .eq('base', base).eq('mes', mes)
      .in('matricula', matriculas.slice(i, i + LOTE))
      .in('status', ['F', 'FA']);
    if (error) { escalaMsg('Erro ao remover folgas: ' + error.message, true); return; }
  }
  alvos.forEach(chave => window._escalaDias.delete(chave));

  escalaGradeAtualiza();
  escalaMsg(`${alvos.length} folga(s) removida(s) ${onde}.`);
}

async function escalaGerarFolgasAuto(grupoFiltro) {
  if (escalaVerificarTravada()) return;
  const { colabs, rotulo: rotuloFiltro } = escalaFiltrarColabs(grupoFiltro);
  if (!colabs.length) { escalaMsg(grupoFiltro ? `Não achei ninguém em "${rotuloFiltro}".` : 'Adicione pelo menos um colaborador antes.', true); return; }

  escalaMostrarLoading(`Calculando folgas para ${colabs.length} colaborador${colabs.length===1?'':'es'}${rotuloFiltro?` (${rotuloFiltro})`:''}...`);

  const [ano, mesNum] = window._escalaMes.split('-').map(Number);
  const diasNoMes = new Date(ano, mesNum, 0).getDate();
  const voosPorDia = window._escalaVoosPorDia || new Array(diasNoMes).fill(0);

  // Quantas pessoas já ficam de folga em cada dia (F/FA/J/CH/férias) — conta
  // o que já existe antes de rodar o gerador, e cresce conforme o próprio
  // gerador vai distribuindo folgas nesse run. Esse é o critério PRINCIPAL
  // pra escolher onde colocar cada folga (equilibrar os dias); a demanda de
  // voos entra só como desempate. Sem isso, o gerador empilhava tudo no(s)
  // dia(s) de menor demanda isolado, esvaziando o efetivo só ali.
  // Mapa de trabalho separado do mapa real (window._escalaDias): o cálculo
  // precisa "enxergar" as folgas que ele mesmo vai colocando (pra equilibrar
  // e não repetir domingo/colar folga), mas só o que for de fato confirmado
  // no banco deve entrar no mapa que alimenta a tela. Antes o código escrevia
  // direto em window._escalaDias durante o cálculo, então a grade já mostrava
  // as folgas geradas mesmo se o upsert final falhasse — só um F5 revelava
  // que nada tinha sido salvo de verdade.
  const escalaDiasCalc = new Map(window._escalaDias);

  const folgasPorDia = new Array(diasNoMes).fill(0);
  for (const c of colabs) {
    for (let d = 1; d <= diasNoMes; d++) {
      const manual = escalaDiasCalc.get(`${c.matricula}|${d}`);
      const off = (manual && ['F','FA','J','CH'].includes(manual.status)) || escalaEstaDeFerias(c.matricula, ano, mesNum, d);
      if (off) folgasPorDia[d-1]++;
    }
  }

  // Escolhe o melhor dia dentro de uma lista de candidatos (já filtrada de
  // quem não serve): menos folgas já colocadas primeiro (equilíbrio); em
  // empate, menor demanda de voos; em empate total, fica com o PRIMEIRO
  // candidato da lista — por isso quem chama decide a ordem de entrada
  // (o passo 1 passa em ordem reversa, pra não cair na cascata de folgas).
  function melhorDia(candidatos) {
    let melhor = null, melhorFolgas = Infinity, melhorDemanda = Infinity;
    for (const d of candidatos) {
      const folgas = folgasPorDia[d-1];
      const demanda = voosPorDia[d-1] || 0;
      if (folgas < melhorFolgas || (folgas === melhorFolgas && demanda < melhorDemanda)) {
        melhor = d; melhorFolgas = folgas; melhorDemanda = demanda;
      }
    }
    return melhor;
  }

  const inserts = [];
  const metasUsadas = new Set();
  let colabsComQuebraForcada = 0;
  let processados = 0;

  for (const c of colabs) {
    const chColab = window.eoColabs?.get(c.matricula)?.ch;
    const meta = escalaMetaFolgasDoColab(chColab, diasNoMes);
    metasUsadas.add(meta);

    // Um dia conta como "folga" (quebra a sequência de dias trabalhados)
    // se for férias, ou já tiver F/FA/J/CH manual. Curso (K) não quebra —
    // continua sendo dia de trabalho remunerado, só muda a atividade.
    const jaFolga = (dia) => {
      if (escalaEstaDeFerias(c.matricula, ano, mesNum, dia)) return true;
      const st = escalaDiasCalc.get(`${c.matricula}|${dia}`)?.status;
      return st === 'F' || st === 'FA' || st === 'J' || st === 'CH';
    };
    const ehDomingo = (dia) => new Date(ano, mesNum-1, dia).getDay() === 0;

    // Passo 1 — regra obrigatória: nunca deixar passar de 6 dias seguidos
    // trabalhados. A sequência não começa do zero — puxa quantos dias
    // seguidos a pessoa já vinha trabalhando no fim do mês anterior. Simula
    // dia a dia; toda vez que a sequência chegaria no 7º dia sem folga,
    // escolhe o melhor dia (equilíbrio, depois demanda) dentro da janela em
    // aberto — percorrendo de trás pra frente, pra empate ficar com o dia
    // mais tarde possível (evita cascata de folgas forçadas muito seguidas).
    const folgasForcadas = new Set();
    let seq = await escalaDiasSeguidosNoFimDoMesAnterior(window._escalaBase, c.matricula, window._escalaMes);
    let inicioJanela = 1;
    for (let d = 1; d <= diasNoMes; d++) {
      if (jaFolga(d) || folgasForcadas.has(d)) { seq = 0; inicioJanela = d + 1; continue; }
      seq++;
      if (seq >= 7) {
        const todosCandidatos = [];
        for (let j = d; j >= inicioJanela; j--) { if (!jaFolga(j) && !folgasForcadas.has(j)) todosCandidatos.push(j); }
        // Prefere um dia que não fique colado em outra folga já existente —
        // regra confirmada com o cliente: nunca 2 folgas juntas. Só aceita
        // ficar colado se não sobrar nenhuma opção livre na janela (aí o
        // limite de 6 dias seguidos — que é lei — vence).
        const naoColados = todosCandidatos.filter(j => {
          const antes  = escalaDiasCalc.get(`${c.matricula}|${j-1}`)?.status === 'F' || folgasForcadas.has(j-1);
          const depois = escalaDiasCalc.get(`${c.matricula}|${j+1}`)?.status === 'F' || folgasForcadas.has(j+1);
          return !antes && !depois;
        });
        let candidatos = naoColados.length ? naoColados : todosCandidatos;

        // Mesma regra de "só 1 domingo" também vale aqui — a maioria das
        // folgas de um colaborador costuma vir justamente desse passo
        // obrigatório, então sem essa checagem aqui a regra do domingo não
        // valia na prática pra quase ninguém.
        const jaTemDomingo = [...folgasForcadas].some(ehDomingo) ||
          [...escalaDiasCalc.entries()].some(([k,v]) => k.startsWith(c.matricula+'|') && v.status==='F' && ehDomingo(parseInt(k.split('|')[1],10)));
        if (jaTemDomingo) {
          const semDomingo = candidatos.filter(j => !ehDomingo(j));
          if (semDomingo.length) candidatos = semDomingo;
        }

        const escolhido = melhorDia(candidatos) ?? d; // segurança — não deveria acontecer
        folgasForcadas.add(escolhido);
        folgasPorDia[escolhido-1]++;
        colabsComQuebraForcada++;
        seq = d - escolhido; // dias já trabalhados depois da folga forçada, até hoje
        inicioJanela = escolhido + 1;
      }
    }
    for (const dia of folgasForcadas) {
      const key = `${c.matricula}|${dia}`;
      if (escalaDiasCalc.has(key)) continue;
      const registro = {
        base: window._escalaBase, mes: window._escalaMes, matricula: c.matricula, dia, status: 'F', origem: 'auto',
        updated_at: new Date(), updated_by: currentUserProfile?.id || currentUser?.id || null,
      };
      inserts.push(registro);
      escalaDiasCalc.set(key, registro);
    }

    // Passo 2 — quantas folgas já existem no mês (manuais 'F' + férias +
    // as forçadas do passo 1), pra saber quanto ainda falta pra bater a meta.
    let folgasAtuais = folgasForcadas.size;
    for (let d = 1; d <= diasNoMes; d++) {
      if (folgasForcadas.has(d)) continue; // já contada acima
      const manual = escalaDiasCalc.get(`${c.matricula}|${d}`);
      if (manual?.status === 'F') folgasAtuais++;
      if (escalaEstaDeFerias(c.matricula, ano, mesNum, d)) folgasAtuais++;
    }
    let faltam = meta - folgasAtuais;
    if (faltam <= 0) continue;

    // Passo 3 — completa o restante da meta sempre escolhendo o dia mais
    // equilibrado disponível (menos folgas já colocadas, depois menor
    // demanda) — recalcula a cada folga colocada, em vez de uma lista fixa
    // ordenada só por demanda (que empilhava tudo no mesmo dia isolado).
    // Nunca coloca 2 folgas coladas uma na outra — regra confirmada com o
    // cliente, sem exceção (é só 1 folga por vez, nunca um par). Também
    // garante EXATAMENTE 1 domingo de folga no mês pra cada colaborador
    // (obrigatório ter 1, nunca mais que 1) — domingo tem prioridade até a
    // pessoa conseguir o primeiro, e depois disso os domingos saem da lista
    // de candidatos, pra não ganhar um segundo.
    while (faltam > 0) {
      const candidatos = [];
      for (let d = 1; d <= diasNoMes; d++) {
        const key = `${c.matricula}|${d}`;
        if (escalaDiasCalc.has(key)) continue;
        if (escalaEstaDeFerias(c.matricula, ano, mesNum, d)) continue;
        const antesOcupado = escalaDiasCalc.get(`${c.matricula}|${d-1}`)?.status === 'F';
        const depoisOcupado = escalaDiasCalc.get(`${c.matricula}|${d+1}`)?.status === 'F';
        if (antesOcupado || depoisOcupado) continue; // nunca 2 folgas coladas
        candidatos.push(d);
      }
      if (!candidatos.length) break; // não sobrou nenhum dia disponível (raro)

      let temDomingo = false;
      for (let d = 1; d <= diasNoMes; d++) {
        if (new Date(ano, mesNum-1, d).getDay() !== 0) continue;
        if (escalaDiasCalc.get(`${c.matricula}|${d}`)?.status === 'F') { temDomingo = true; break; }
      }

      let listaFinal;
      if (!temDomingo) {
        // ainda não tem nenhum domingo — prioriza domingo disponível
        const domingosDisponiveis = candidatos.filter(d => new Date(ano, mesNum-1, d).getDay() === 0);
        listaFinal = domingosDisponiveis.length ? domingosDisponiveis : candidatos;
      } else {
        // já tem 1 domingo — evita dar um segundo (só sai domingo dos
        // candidatos se ainda sobrar opção fora de domingo)
        const semDomingo = candidatos.filter(d => new Date(ano, mesNum-1, d).getDay() !== 0);
        listaFinal = semDomingo.length ? semDomingo : candidatos;
      }

      const escolhido = melhorDia(listaFinal);
      const registro = {
        base: window._escalaBase, mes: window._escalaMes, matricula: c.matricula, dia: escolhido, status: 'F', origem: 'auto',
        updated_at: new Date(), updated_by: currentUserProfile?.id || currentUser?.id || null,
      };
      inserts.push(registro);
      escalaDiasCalc.set(`${c.matricula}|${escolhido}`, registro);
      folgasPorDia[escolhido-1]++;
      faltam--;
    }
    processados++;
    escalaLoadingAtualiza(processados, colabs.length);
  }

  if (!inserts.length) { escalaGradeAtualiza(); escalaMsg('Ninguém precisava de mais folgas — todo mundo já está na meta do mês.'); return; }

  // Salva em lotes de 200 (mesmo padrão do resto do arquivo). Um upsert único
  // com centenas de linhas de uma vez era a causa raiz do bug "aparece na
  // tela mas some no F5": em bases grandes o insert podia estourar limite/
  // timeout e falhar (ou falhar no meio), e ninguém percebia porque a tela já
  // tinha sido redesenhada a partir do cálculo em memória antes de confirmar
  // que o banco realmente gravou. Agora só entra no mapa real (e na tela) o
  // que cada lote confirmar como salvo.
  const BATCH = 200;
  const loadLabel = document.getElementById('escala-load-label');
  if (loadLabel) loadLabel.textContent = `Salvando ${inserts.length} folga(s)...`;
  escalaLoadingAtualiza(0, inserts.length);

  let salvos = 0;
  for (let i = 0; i < inserts.length; i += BATCH) {
    const lote = inserts.slice(i, i + BATCH);
    const { error } = await db.from('escala_dia').upsert(lote, { onConflict: 'base,mes,matricula,dia' });
    if (error) {
      escalaGradeAtualiza();
      escalaMsg(`Salvou ${salvos} de ${inserts.length} folga(s) — parou num lote com erro: ${error.message}. Rode "Gerar folgas automáticas" de novo pra completar o restante.`, true);
      return;
    }
    for (const registro of lote) window._escalaDias.set(`${registro.matricula}|${registro.dia}`, registro);
    salvos += lote.length;
    escalaLoadingAtualiza(salvos, inserts.length);
  }

  escalaGradeAtualiza();
  const avisoForcado = colabsComQuebraForcada > 0
    ? ` · ${colabsComQuebraForcada} folga(s) extra forçada(s) pra não passar de 6 dias seguidos trabalhando`
    : '';
  escalaMsg(`${inserts.length} folga(s) geradas, equilibrando a quantidade de gente por dia (meta por CH: ${[...metasUsadas].sort((a,b)=>a-b).join('/')} folgas/mês)${avisoForcado}.`);
}

// ── Painel "Voos & demanda" — toggle no cabeçalho ──────
async function escalaToggleVoosPanel() {
  const painel = document.getElementById('escala-voos-panel');
  if (!painel) return;
  const abrindo = painel.style.display === 'none';
  if (!abrindo) { painel.style.display = 'none'; return; }

  painel.style.display = 'block';
  painel.innerHTML = `<div class="hc-panel"><div style="text-align:center;padding:20px;color:var(--text-muted);font-size:12px"><i class="ti ti-loader-2" style="font-size:22px;opacity:.4;animation:spin 1s linear infinite" aria-hidden="true"></i><br>Carregando voos...</div></div>`;

  const base = window._escalaBase, mes = window._escalaMes;
  const [ano, mesNum] = mes.split('-').map(Number);
  const diasNoMes = new Date(ano, mesNum, 0).getDate();
  const mesInicioStr = `${mes}-01`;
  const mesFimStr = `${mes}-${String(diasNoMes).padStart(2,'0')}`;

  const voosRows = await escalaFetchMalha(base, mesInicioStr, mesFimStr, 'data,cia');
  window._escalaVoosDetalhe = voosRows || [];
  escalaRenderVoosPanel(ano, mesNum, diasNoMes);
}

function escalaRenderVoosPanel(ano, mesNum, diasNoMes) {
  const rows = window._escalaVoosDetalhe || [];
  const porDia = new Map(); // dia(1-31) -> { total, cias: Map<cia,count> }
  for (let d = 1; d <= diasNoMes; d++) porDia.set(d, { total: 0, cias: new Map() });

  rows.forEach(r => {
    const d = parseInt(r.data.slice(8,10), 10);
    const info = porDia.get(d);
    if (!info) return;
    info.total++;
    const cia = r.cia || 'Sem cia';
    info.cias.set(cia, (info.cias.get(cia)||0)+1);
  });

  const totalMes = rows.length;
  let piorDia = 1, piorDiaValor = 0;
  for (const [d, info] of porDia) { if (info.total > piorDiaValor) { piorDiaValor = info.total; piorDia = d; } }

  const porSemana = new Map(); // key -> total
  rows.forEach(r => {
    const { key } = typeof malhaSemanaChave === 'function' ? malhaSemanaChave(r.data) : { key: '—' };
    porSemana.set(key, (porSemana.get(key)||0)+1);
  });
  let piorSemana = '—', piorSemanaValor = 0;
  for (const [key, total] of porSemana) { if (total > piorSemanaValor) { piorSemanaValor = total; piorSemana = key; } }

  window._escalaVoosPorDiaDetalhe = porDia;

  const painel = document.getElementById('escala-voos-panel');
  if (!painel) return;
  const mesLbl = typeof adhMonthLabel === 'function' ? adhMonthLabel(`${ano}-${String(mesNum).padStart(2,'0')}`) : `${mesNum}/${ano}`;
  const valores = [];
  for (let d = 1; d <= diasNoMes; d++) valores.push(porDia.get(d).total);

  painel.innerHTML = `
    <div class="hc-panel" style="margin-bottom:16px">
      <div style="display:flex;gap:16px;flex-wrap:wrap">
        <div style="flex:1;min-width:200px">
          <div style="font-size:10px;font-weight:700;color:#38bdf8;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">${mesLbl}</div>
          <div style="font-size:26px;font-weight:700;color:#38bdf8">${totalMes.toLocaleString('pt-BR')}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:4px">Pico ${String(piorDia).padStart(2,'0')}/${String(mesNum).padStart(2,'0')} (${piorDiaValor} voos)</div>
        </div>
        <div style="flex:1;min-width:200px">
          <div style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">Pior semana</div>
          <div style="font-size:26px;font-weight:700;color:#fc8181">${piorSemana}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:4px">${piorSemanaValor} voos nessa semana</div>
        </div>
      </div>
    </div>

    <div class="hc-panel">
      <div class="hc-panel-title" style="margin-bottom:2px">Curva de voos (${mesLbl})</div>
      <div style="font-size:11px;color:var(--text-muted);margin-bottom:14px">Passe o mouse pra ver voos e clientes do dia</div>
      ${escalaVoosChartSVG(valores, diasNoMes)}
    </div>
  `;

  requestAnimationFrame(escalaVoosAjustaLargura);
  if (!window._escalaVoosResizeRegistrado) {
    window._escalaVoosResizeRegistrado = true;
    window.addEventListener('resize', () => escalaVoosAjustaLargura());
  }
}

// Constrói o SVG do zero com uma largura específica — chamado primeiro com
// um valor padrão, depois de novo com a largura real medida (mesma técnica
// da Malha Aérea, evita a distorção/desproporção do viewBox genérico).
function escalaVoosChartSVG(valores, diasNoMes, larguraAlvo) {
  const W = larguraAlvo || 900, H = 260, padL = 32, padR = 10, padT = 10, padB = 24;
  const max = Math.max(3, ...valores);
  const stepX = (W-padL-padR)/(diasNoMes-1 || 1);
  const scaleY = v => H-padB-(v/max*(H-padB-padT));
  const pontos = valores.map((v,i) => [padL+i*stepX, scaleY(v)]);
  const linha = typeof malhaSmoothPath === 'function' ? malhaSmoothPath(pontos) : pontos.map((p,i)=>`${i===0?'M':'L'} ${p[0]} ${p[1]}`).join(' ');
  const area = `${linha} L ${(padL+(diasNoMes-1)*stepX).toFixed(1)} ${H-padB} L ${padL} ${H-padB} Z`;

  const yStep = max<=6?1:max<=12?3:Math.ceil(max/4);
  const yTicks = [];
  for (let v=0; v<=max; v+=yStep) yTicks.push(v);

  window._escalaVoosChartMeta = { valores, diasNoMes, W, H, padL, padR, padT, padB, max };

  return `
    <div id="escala-voos-wrap" style="position:relative;width:100%">
      <svg id="escala-voos-svg" viewBox="0 0 ${W} ${H}" style="display:block;width:100%;height:220px;cursor:crosshair"
        onmousemove="escalaVoosHover(event,this)" onmouseleave="escalaVoosLeave()">
        ${yTicks.map(v => `<line x1="${padL}" y1="${scaleY(v).toFixed(1)}" x2="${W-padR}" y2="${scaleY(v).toFixed(1)}" stroke="var(--border)" stroke-width="1"/><text x="4" y="${(scaleY(v)+3).toFixed(1)}" font-size="9" style="fill:var(--text-muted)">${v}</text>`).join('')}
        ${valores.map((v,i) => `<text x="${(padL+i*stepX).toFixed(1)}" y="${H-6}" font-size="8" text-anchor="middle" style="fill:var(--text-muted)">${i+1}</text>`).join('')}
        <path d="${area}" fill="#38bdf8" opacity="0.12" stroke="none"/>
        <path d="${linha}" fill="none" stroke="#38bdf8" stroke-width="2"/>
        <line id="escala-voos-crosshair" x1="0" y1="${padT}" x2="0" y2="${H-padB}" stroke="var(--text-muted)" stroke-width="1" stroke-dasharray="3,3" style="display:none"/>
        <circle id="escala-voos-dot" r="3.5" fill="#38bdf8" stroke="#0b0f1a" stroke-width="1.5" style="display:none"/>
      </svg>
      <div id="escala-voos-tooltip" style="position:absolute;display:none;pointer-events:none;background:#141b2c;border:1px solid var(--border-strong);border-radius:8px;padding:8px 10px;font-size:11px;white-space:nowrap;box-shadow:0 4px 12px rgba(0,0,0,.4);z-index:10;top:6px"></div>
    </div>`;
}

function escalaVoosAjustaLargura() {
  const wrap = document.getElementById('escala-voos-wrap');
  const meta = window._escalaVoosChartMeta;
  if (!wrap || !meta) return;
  const largura = Math.round(wrap.clientWidth);
  if (!largura || largura === meta.W) return;
  wrap.outerHTML = escalaVoosChartSVG(meta.valores, meta.diasNoMes, largura);
}

function escalaVoosHover(evt, svg) {
  const meta = window._escalaVoosChartMeta;
  const porDia = window._escalaVoosPorDiaDetalhe;
  if (!meta || !porDia) return;
  const [, mesNum] = (window._escalaMes || '').split('-').map(Number);
  const rect = svg.getBoundingClientRect();

  // Usa a fração real do mouse dentro da caixa (0 a 1) — não depende de a
  // largura guardada bater exatamente com o que está na tela agora.
  const fracX = (evt.clientX - rect.left) / rect.width;
  const padLFrac = meta.padL / meta.W, padRFrac = meta.padR / meta.W;
  const xNorm = (fracX - padLFrac) / (1 - padLFrac - padRFrac);
  let idx = Math.round(xNorm * (meta.diasNoMes-1));
  idx = Math.max(0, Math.min(meta.diasNoMes-1, idx));
  const dia = idx+1;
  const info = porDia.get(dia);
  if (!info) return;

  const stepX = (meta.W-meta.padL-meta.padR)/(meta.diasNoMes-1 || 1);
  const scaleY = v => meta.H-meta.padB-(v/meta.max*(meta.H-meta.padB-meta.padT));
  const xPos = meta.padL + idx*stepX, yPos = scaleY(info.total);

  const crosshair = document.getElementById('escala-voos-crosshair');
  const dot = document.getElementById('escala-voos-dot');
  if (crosshair) { crosshair.setAttribute('x1', xPos); crosshair.setAttribute('x2', xPos); crosshair.style.display = 'block'; }
  if (dot) { dot.setAttribute('cx', xPos); dot.setAttribute('cy', yPos); dot.style.display = 'block'; }

  const top5 = [...info.cias.entries()].sort((a,b) => b[1]-a[1]).slice(0,5);
  const tooltip = document.getElementById('escala-voos-tooltip');
  if (tooltip) {
    tooltip.innerHTML = `
      <div style="font-weight:700;color:var(--text-primary);margin-bottom:5px">${String(dia).padStart(2,'0')}/${String(mesNum).padStart(2,'0')} · ${info.total} voo(s)</div>
      ${top5.map(([cia,n]) => `<div style="color:var(--text-secondary);font-size:10.5px">${cia}: <strong>${n}</strong></div>`).join('') || '<div style="color:var(--text-muted);font-size:10.5px">Sem voos nesse dia</div>'}
    `;
    const leftPct = xPos/meta.W*100;
    if (leftPct > 65) { tooltip.style.left = 'auto'; tooltip.style.right = `${100-leftPct}%`; }
    else { tooltip.style.right = 'auto'; tooltip.style.left = `${leftPct}%`; }
    tooltip.style.display = 'block';
  }
}

function escalaVoosLeave() {
  ['escala-voos-crosshair','escala-voos-dot','escala-voos-tooltip'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
}

// Ponto único por onde toda ação da Escala Online já passa (sucesso ou
// erro) — por isso é aqui, e só aqui, que também acendemos o indicador
// fixo "✓ Salvo" no cabeçalho, sem precisar mexer em cada função que
// salva individualmente (menos risco de esquecer alguma).
// ══════════════════════════════════════════════════════
// MENU "MAIS AÇÕES" + EXPORTAR / IMPRIMIR
// ══════════════════════════════════════════════════════

function escalaMenuSecao(texto) {
  return `<div style="font-size:9.5px;color:var(--text-muted);letter-spacing:.08em;padding:8px 10px 4px;text-transform:uppercase">${texto}</div>`;
}
function escalaMenuDivisor() {
  return `<div style="border-top:1px solid var(--border);margin:4px 0"></div>`;
}
function escalaMenuItem(icone, texto, acao, desabilitado, cor) {
  const style = `display:flex;align-items:center;gap:9px;width:100%;padding:7px 10px;border-radius:6px;font-size:12px;text-align:left;background:none;border:none;color:${cor || 'var(--text-secondary)'};${desabilitado ? 'opacity:.4;cursor:not-allowed' : 'cursor:pointer'}`;
  const onclick = desabilitado ? '' : ` onclick="escalaFecharMenuAcoes();${acao}"`;
  return `<button style="${style}"${desabilitado ? ' disabled' : ''}${onclick}
    onmouseover="if(!this.disabled)this.style.background='var(--bg-hover)'"
    onmouseout="this.style.background='none'">${escalaIcone(icone)}${texto}</button>`;
}
function escalaFecharMenuAcoes() {
  const m = document.getElementById('escala-menu-acoes');
  if (m) m.style.display = 'none';
}
function escalaToggleMenuAcoes(e) {
  if (e) e.stopPropagation();
  const m = document.getElementById('escala-menu-acoes');
  if (!m) return;
  m.style.display = m.style.display === 'none' ? 'block' : 'none';
}
// Fecha ao clicar fora — registra uma vez só, igual o handler de teclado.
if (!window._escalaMenuFechaRegistrado) {
  window._escalaMenuFechaRegistrado = true;
  document.addEventListener('click', (e) => {
    const menu = document.getElementById('escala-menu-acoes');
    if (menu && menu.style.display === 'block' && !menu.parentElement.contains(e.target)) {
      menu.style.display = 'none';
    }
  });
}

// Exporta a escala montada pro Excel, uma linha por colaborador e uma
// coluna por dia — mesmo conteúdo da tela (F/FA/L/J/K/CH ou o horário do
// dia trabalhado). A grade não tinha exportação nenhuma: o único
// XLSX.writeFile do módulo era o do Gerador, que exporta o
// dimensionamento, não a escala.
function escalaExportarExcel() {
  if (typeof XLSX === 'undefined') { escalaMsg('Biblioteca de Excel não carregou — recarregue a página.', true); return; }
  const base = window._escalaBase, mes = window._escalaMes;
  const [ano, mesNum] = mes.split('-').map(Number);
  const diasNoMes = new Date(ano, mesNum, 0).getDate();
  const colabs = window._escalaColabs || [];
  if (!colabs.length) { escalaMsg('Nada pra exportar — nenhum colaborador nessa escala ainda.', true); return; }

  const cabecalhoDias = [];
  for (let d = 1; d <= diasNoMes; d++) {
    cabecalhoDias.push(`${ESCALA_DIAS_SEMANA[new Date(ano, mesNum-1, d).getDay()]} ${String(d).padStart(2,'0')}`);
  }
  const linhas = [['MATRÍCULA','NOME','FUNÇÃO','TURNO','SETOR','BLOCO','ENTRADA','SAÍDA','CH','FOLGAS','META', ...cabecalhoDias]];

  colabs.forEach(c => {
    const info = window.eoColabs?.get(c.matricula);
    const horarioFixo = escalaHorarioFixoDoColab(c.matricula, ano, mesNum, diasNoMes);
    const [entradaCalc, saidaCalc] = horarioFixo ? horarioFixo.split('-') : [null, null];
    const entrada = c.entrada_manual || entradaCalc || '';
    const saida   = c.saida_manual || saidaCalc || '';
    const conteudo = escalaConteudoDoMes(c, ano, mesNum, diasNoMes);
    const folgas = conteudo.filter(i => i.status === 'F' || i.status === 'FA').length;
    const meta   = escalaMetaFolgasDoColab(info?.ch, diasNoMes);
    // Dia sem status = dia trabalhado → sai o horário, que é o que a
    // operação precisa ver no papel.
    const celulas = conteudo.map(i => i.exibido || (entrada && saida ? `${entrada}-${saida}` : 'TRAB'));
    linhas.push([
      c.matricula, c.nome || '', info?.funcao || '', escalaSetorDoTurno(entrada),
      c.turno || '', c.bloco_horario || '', entrada, saida, info?.ch || '',
      folgas, meta, ...celulas,
    ]);
  });

  // Linha de resumo no fim, igual a da tela.
  const contagem = new Array(diasNoMes).fill(0);
  colabs.forEach(c => escalaConteudoDoMes(c, ano, mesNum, diasNoMes)
    .forEach((i, idx) => { if (!i.status) contagem[idx]++; }));
  linhas.push([]);
  linhas.push(['TRABALHANDO NO DIA','','','','','','','','','','', ...contagem]);

  const ws = XLSX.utils.aoa_to_sheet(linhas);
  ws['!cols'] = [{wch:11},{wch:30},{wch:26},{wch:14},{wch:14},{wch:14},{wch:9},{wch:9},{wch:6},{wch:8},{wch:6},
                 ...cabecalhoDias.map(() => ({ wch: 11 }))];
  ws['!freeze'] = { xSplit: 2, ySplit: 1 };
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'ESCALA');
  XLSX.writeFile(wb, `Escala_${base}_${String(mesNum).padStart(2,'0')}_${ano}.xlsx`);
  escalaMsg('Excel gerado.');
}

// Impressão: marca o body pra o @media print saber que é a Escala, deixa
// a grade abrir por inteiro (sem o scroll interno) e devolve tudo depois.
function escalaImprimir() {
  const wrap = document.getElementById('escala-grade-wrap');
  if (!wrap) return;
  const overflowAntes = wrap.style.overflow;
  const alturaAntes   = wrap.style.maxHeight;
  document.body.classList.add('escala-imprimindo');
  wrap.style.overflow = 'visible';
  wrap.style.maxHeight = 'none';

  const restaurar = () => {
    document.body.classList.remove('escala-imprimindo');
    wrap.style.overflow = overflowAntes;
    wrap.style.maxHeight = alturaAntes;
    window.removeEventListener('afterprint', restaurar);
  };
  window.addEventListener('afterprint', restaurar);
  setTimeout(() => window.print(), 60);
}

// O icone de estado (alerta ou confirmacao) e desenhado AQUI, uma vez so,
// em SVG. Antes cada chamada trazia um emoji colado no proprio texto
// ("✓ Horario salvo"), o que espalhava simbolo por dezenas de strings e
// obrigava a limpar com regex antes de reaproveitar o texto no indicador.
// ══════════════════════════════════════════════════════
// RECALCULAR SAÍDAS · FÉRIAS
// ══════════════════════════════════════════════════════

// Reescreve a Saída de todo mundo pela regra (entrada + jornada da CH +
// intervalo). Necessário porque o campo era editável e a base veio de
// importação com valores sem relação nenhuma com a entrada — e o
// auto-cálculo antigo só disparava quando a saída estava vazia, então
// nada disso se corrigia sozinho. Mostra o que vai mudar ANTES de gravar.
async function escalaRecalcularSaidas() {
  if (escalaVerificarTravada()) return;
  const colabs = window._escalaColabs || [];
  if (!colabs.length) { escalaMsg('Nenhum colaborador nessa escala.', true); return; }

  const [ano, mesNum] = window._escalaMes.split('-').map(Number);
  const diasNoMes = new Date(ano, mesNum, 0).getDate();

  const mudancas = [];
  const semCH = [];
  for (const c of colabs) {
    const ch = window.eoColabs?.get(c.matricula)?.ch || c.ch_manual;
    const entrada = escalaEntradaEfetivaDoColab(c, ano, mesNum, diasNoMes);
    if (!entrada) continue;
    const nova = escalaSaidaCalculada(entrada, ch);
    if (!nova) { semCH.push(c); continue; }
    const horarioFixo = escalaHorarioFixoDoColab(c.matricula, ano, mesNum, diasNoMes);
    const atual = c.saida_manual || (horarioFixo ? horarioFixo.split('-')[1] : null);
    if (atual !== nova) mudancas.push({ c, de: atual || '--:--', para: nova });
  }

  if (!mudancas.length) {
    escalaMsg(`Todas as saídas já batem com a regra${semCH.length?` (${semCH.length} sem CH conhecida foram ignorados)`:''}.`);
    return;
  }

  // Amostra no confirm: ver 3 exemplos concretos evita aplicar às cegas.
  const amostra = mudancas.slice(0, 3)
    .map(m => `  ${m.c.nome || m.c.matricula}: ${m.de} → ${m.para}`).join('\n');
  const resto = mudancas.length > 3 ? `\n  ...e mais ${mudancas.length - 3}` : '';
  const aviso = semCH.length ? `\n\n${semCH.length} colaborador(es) sem CH conhecida ficam de fora.` : '';
  if (!confirm(`Recalcular a saída de ${mudancas.length} colaborador(es)?\n\nRegra: entrada + jornada da CH + intervalo.\n\n${amostra}${resto}${aviso}`)) return;

  const LOTE = 200;
  for (let i = 0; i < mudancas.length; i += LOTE) {
    const linhas = mudancas.slice(i, i + LOTE).map(m => ({
      base: window._escalaBase, mes: window._escalaMes,
      matricula: m.c.matricula, nome: m.c.nome, saida_manual: m.para,
    }));
    const { error } = await db.from('escala_colaborador').upsert(linhas, { onConflict: 'base,mes,matricula' });
    if (error) { escalaMsg('Erro ao recalcular saídas: ' + error.message, true); return; }
  }
  mudancas.forEach(m => { m.c.saida_manual = m.para; });
  escalaGradeAtualiza();
  escalaMsg(`${mudancas.length} saída(s) recalculada(s).`);
}

// Relê colaboradores_ferias do banco. O painel guarda esse dado em cache
// (window.eoFeriasAll) desde a primeira tela que o carregou, então férias
// lançadas pelo RH com o painel aberto só apareciam depois de um F5.
async function escalaRecarregarFerias() {
  escalaMostrarLoading('Recarregando férias do cadastro...');
  window.eoFerias = null;
  window.eoFeriasAll = null;
  try {
    if (typeof hcEnsureData === 'function') await hcEnsureData();
    const total = (window.eoFeriasAll || []).length;
    const [ano, mesNum] = window._escalaMes.split('-').map(Number);
    const diasNoMes = new Date(ano, mesNum, 0).getDate();
    const noMes = (window._escalaColabs || []).filter(c => {
      for (let d = 1; d <= diasNoMes; d++) if (escalaEstaDeFerias(c.matricula, ano, mesNum, d)) return true;
      return false;
    }).length;
    escalaGradeAtualiza();
    escalaMsg(`Férias recarregadas: ${total} período(s) no cadastro, ${noMes} pessoa(s) com férias nesse mês.`);
  } catch (e) {
    // escalaMostrarLoading trocou o conteúdo da grade — precisa redesenhar
    // mesmo em caso de erro, senão a tela fica presa no "Recarregando...".
    escalaGradeAtualiza();
    escalaMsg('Erro ao recarregar férias: ' + e.message, true);
  }
}

// Exceção de férias: marca "trabalha mesmo constando férias" nos dias do
// mês em que o cadastro do RH diz férias. Não mexe em colaboradores_ferias
// — se o lançamento foi errado, quem corrige na origem é o RH; a escala só
// não pode ficar parada esperando isso.
async function escalaRemoverFeriasDoMes(matricula) {
  if (escalaVerificarTravada()) return;
  const [ano, mesNum] = window._escalaMes.split('-').map(Number);
  const diasNoMes = new Date(ano, mesNum, 0).getDate();
  const c = (window._escalaColabs || []).find(x => x.matricula === matricula);

  const dias = [];
  for (let d = 1; d <= diasNoMes; d++) if (escalaEstaDeFerias(matricula, ano, mesNum, d)) dias.push(d);
  if (!dias.length) { escalaMsg(`${c?.nome || matricula} não está de férias nesse mês.`, true); return; }

  if (!confirm(`Marcar ${c?.nome || matricula} como TRABALHANDO nos ${dias.length} dia(s) que constam como férias nesse mês?\n\nO cadastro de férias do RH NÃO é alterado — a exceção vale só para esta escala. Se as férias foram lançadas por engano, peça a correção ao RH também.`)) return;

  const agora = new Date();
  const autor = currentUserProfile?.id || currentUser?.id || null;
  const payloads = dias.map(dia => ({
    base: window._escalaBase, mes: window._escalaMes, matricula, dia,
    status: 'T', origem: 'excecao_ferias', updated_at: agora, updated_by: autor,
  }));
  const { error } = await db.from('escala_dia').upsert(payloads, { onConflict: 'base,mes,matricula,dia' });
  if (error) { escalaMsg('Erro ao salvar exceção: ' + error.message, true); return; }
  payloads.forEach(p => window._escalaDias.set(`${p.matricula}|${p.dia}`, p));
  escalaGradeAtualiza();
  escalaMsg(`${dias.length} dia(s) de férias ignorados nesta escala para ${c?.nome || matricula}. O RH segue com o período cadastrado.`);
}

// Desfaz a exceção acima — as férias do cadastro voltam a valer.
async function escalaRestaurarFeriasDoMes(matricula) {
  if (escalaVerificarTravada()) return;
  const chaves = [...window._escalaDias.entries()]
    .filter(([k, v]) => k.startsWith(matricula + '|') && v.status === 'T')
    .map(([k]) => k);
  if (!chaves.length) { escalaMsg('Não há exceção de férias pra esse colaborador nesse mês.', true); return; }

  const { error } = await db.from('escala_dia').delete()
    .eq('base', window._escalaBase).eq('mes', window._escalaMes)
    .eq('matricula', matricula).eq('status', 'T');
  if (error) { escalaMsg('Erro ao desfazer: ' + error.message, true); return; }
  chaves.forEach(k => window._escalaDias.delete(k));
  escalaGradeAtualiza();
  escalaMsg('Férias do cadastro voltaram a valer para esse colaborador.');
}

// ══════════════════════════════════════════════════════
// CADASTRO MANUAL DE COLABORADOR
// ══════════════════════════════════════════════════════

function escalaToggleFormManual() {
  const form = document.getElementById('escala-form-manual');
  if (!form) return;
  const abrindo = form.style.display === 'none';
  form.style.display = abrindo ? 'block' : 'none';
  if (abrindo) {
    document.getElementById('escala-man-mat')?.focus();
    // A saída acompanha a entrada em tempo real, com a mesma regra da
    // grade — quem cadastra já vê o horário que vai valer.
    const recalc = () => {
      const el = document.getElementById('escala-man-saida');
      if (!el) return;
      const saida = escalaSaidaCalculada(
        document.getElementById('escala-man-entrada')?.value,
        document.getElementById('escala-man-ch')?.value);
      el.textContent = saida || '--:--';
      el.style.color = saida ? 'var(--text-secondary)' : 'var(--text-muted)';
    };
    document.getElementById('escala-man-entrada')?.addEventListener('input', recalc);
    document.getElementById('escala-man-ch')?.addEventListener('change', recalc);
  }
}

async function escalaSalvarColabManual() {
  if (escalaVerificarTravada()) return;
  const val = (id) => String(document.getElementById(`escala-man-${id}`)?.value || '').trim();
  const matricula = val('mat'), nome = val('nome'), funcao = val('funcao');
  const ch = val('ch'), entrada = val('entrada');

  if (!matricula) { escalaMsg('Informe a matrícula.', true); return; }
  if (!nome)      { escalaMsg('Informe o nome completo.', true); return; }
  if (!funcao)    { escalaMsg('Informe a função — é ela que define o grupo na grade.', true); return; }
  if (!ch)        { escalaMsg('A CH é obrigatória: é ela que calcula a meta de folgas e a saída.', true); return; }
  if ((window._escalaColabs||[]).some(c => c.matricula === matricula)) {
    escalaMsg('Essa matrícula já está nessa escala.', true); return;
  }
  if (window.eoColabs?.has(matricula)) {
    escalaMsg(`Matrícula ${matricula} já existe no cadastro do RH — digite ela no campo "+ matrícula" em vez de cadastrar manualmente.`, true);
    return;
  }
  if (entrada && !/^\d{2}:\d{2}$/.test(entrada)) { escalaMsg('Entrada precisa estar no formato HH:MM.', true); return; }

  const linha = {
    base: window._escalaBase, mes: window._escalaMes, matricula, nome,
    funcao_manual: funcao, ch_manual: ch, fora_cadastro: true,
    entrada_manual: entrada || null,
    saida_manual: entrada ? escalaSaidaCalculada(entrada, ch) : null,
  };
  const { error } = await db.from('escala_colaborador').upsert(linha, { onConflict: 'base,mes,matricula' });
  if (error) { escalaMsg('Erro ao cadastrar: ' + error.message, true); return; }

  // Espelha no cache de cadastro pra Função e CH aparecerem na grade sem
  // recarregar — a fonte da verdade continua sendo o RH pra quem existe lá.
  if (window.eoColabs) window.eoColabs.set(matricula, { nome, funcao, ch, station: window._escalaBase, fora_cadastro: true });
  (window._escalaColabs = window._escalaColabs || []).push(linha);

  ['mat','nome','funcao','entrada'].forEach(id => { const el = document.getElementById(`escala-man-${id}`); if (el) el.value = ''; });
  const selCh = document.getElementById('escala-man-ch'); if (selCh) selCh.value = '';
  escalaGradeAtualiza();
  escalaMsg(`${nome} adicionado fora do cadastro do RH — precisa ser regularizado no sistema.`);
}

// Quantos estão na escala sem existir no cadastro do RH. Vai no rodapé pra
// que ninguém esqueça que existe gente pendente de regularização.
function escalaContarForaCadastro() {
  return (window._escalaColabs || []).filter(c => c.fora_cadastro).length;
}

function escalaMsg(texto, erro) {
  const limpo = String(texto || '').replace(/^[\u2713\u26a0\u2714\u2717]\s*/, '');
  const icone = limpo ? escalaIconeSolto(erro ? 'alert' : 'check', 12) : '';
  const cor = erro ? '#fc8181' : '#5fa87a';

  const el = document.getElementById('escala-status-msg');
  if (el) el.innerHTML = limpo
    ? `<span style="color:${cor};display:inline-flex;align-items:center;gap:6px">${icone}${limpo}</span>`
    : '';

  const ind = document.getElementById('escala-save-indicator');
  if (ind && limpo) {
    if (erro) {
      ind.innerHTML = `<span style="color:#fc8181;display:inline-flex;align-items:center;gap:6px">${escalaIconeSolto('alert', 12)}${limpo}</span>`;
    } else {
      const hora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      ind.innerHTML = `<span style="color:#5fa87a;display:inline-flex;align-items:center;gap:6px">${escalaIconeSolto('check', 12)}Salvo às ${hora}</span>`;
    }
  }
}

async function escalaAdicionarFeriado() {
  if (escalaVerificarTravada()) return;
  const base = window._escalaBase;
  const dataStr = prompt(`Data do feriado estadual/municipal de ${base} (formato DD/MM/AAAA):`);
  if (!dataStr) return;
  const partes = dataStr.trim().split('/');
  if (partes.length !== 3) { alert('Data inválida. Use o formato DD/MM/AAAA.'); return; }
  const [dd, mm, yyyy] = partes;
  const dataISO = `${yyyy}-${mm.padStart(2,'0')}-${dd.padStart(2,'0')}`;
  const nome = prompt('Nome do feriado (ex: Aniversário da cidade):');
  if (!nome) return;
  const tipo = confirm('É feriado ESTADUAL? (Cancelar = municipal)') ? 'estadual' : 'municipal';

  const { error } = await db.from('escala_feriado').upsert(
    { base, data: dataISO, nome, tipo }, { onConflict: 'base,data' }
  );
  if (error) { escalaMsg('Erro ao salvar feriado: ' + error.message, true); return; }
  escalaMsg(`Feriado "${nome}" adicionado em ${dataStr} pra ${base}.`);
  escalaRenderGrade(document.getElementById('page-content'));
}
