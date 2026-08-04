// ══════════════════════════════════════════════════════
// PAGES — Each module renders into #page-content
// ══════════════════════════════════════════════════════

// ── Escala Online ─────────────────────────────────────
// Ícones dos botões da Escala Online, no mesmo estilo (linha, stroke) dos
// ícones da barra lateral — evita ícones de emoji, que ficam menos sérios.
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
  };
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:5px" aria-hidden="true">${icones[nome]||''}</svg>`;
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
    escalaMsg(`⚠ Salvei sua última base/mês só nesse navegador (localStorage) — não consegui salvar no perfil pra valer em outros dispositivos: ${error.message}. Provavelmente falta rodar o escala-perfil-ultima-tela.sql no Supabase.`, true);
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
    escalaMsg('🔒 Essa escala está travada — destrave pra poder editar.', true);
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

  escalaMsg(travarAgora ? '🔒 Escala travada.' : '🔓 Escala destravada — já pode editar.');
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

  el.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Escala Online</h1>
        <p class="page-sub">Montar escala · ${base} · ${typeof adhMonthLabel==='function'?adhMonthLabel(mes):mes} · <span id="escala-contador-colabs" style="color:var(--text-primary);font-weight:600">${(window._escalaColabs||[]).length} colaborador${(window._escalaColabs||[]).length===1?'':'es'}</span></p>
        <p id="escala-save-indicator" style="font-size:11px;margin:4px 0 0;color:var(--text-muted)">● Nenhuma alteração ainda</p>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        ${bases.length>1
          ? `<select class="adh-month-select" onchange="escalaSetBase(this.value)">${bases.map(b=>`<option value="${b}" ${b===base?'selected':''}>${b}</option>`).join('')}</select>`
          : `<span class="adh-base-badge">${base||'—'}</span>`}
        <select class="adh-month-select" onchange="escalaSetMes(this.value)">${escalaMesOptionsHTML(mes)}</select>
        <button class="adh-refresh-btn" style="background:var(--blue);color:#0b0f1a;border:none;font-weight:600" onclick="escalaToggleVoosPanel()">✈ Voos &amp; demanda</button>
        ${travaBtnHTML}
      </div>
    </div>

    <div id="escala-voos-panel" style="display:none;margin-bottom:16px"></div>

    ${travada ? `
    <div style="font-size:11.5px;color:#fc8181;background:rgba(252,129,129,.08);border:1px solid rgba(252,129,129,.25);border-radius:8px;padding:8px 14px;margin-bottom:14px">
      🔒 Escala travada${window._escalaTravaInfo?.travada_por_nome ? ` por ${window._escalaTravaInfo.travada_por_nome}` : ''}${window._escalaTravaInfo?.travada_em ? ` em ${new Date(window._escalaTravaInfo.travada_em).toLocaleString('pt-BR')}` : ''} — ninguém pode editar folgas, colaboradores ou horário até destravar.
    </div>` : ''}

    ${window._escalaAutoPopulado ? `
    <div style="font-size:11.5px;color:#5fa87a;background:rgba(95,168,122,.08);border:1px solid rgba(95,168,122,.25);border-radius:8px;padding:8px 14px;margin-bottom:14px">
      ✓ ${(window._escalaColabs||[]).length} colaborador(es) carregados automaticamente, cruzando com o horário planejado (ponto) dessa base nesse mês. Use a busca abaixo só se faltar alguém, ou o ✕ na linha se alguém não devia estar aqui.
    </div>` : ''}

    <div class="hc-panel" style="margin-bottom:16px">
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <div style="position:relative;flex:1;min-width:260px">
          <input id="escala-busca" class="adh-search-input" ${dis} style="width:100%;box-sizing:border-box;padding:9px 12px;background:var(--bg-hover);border:1px solid var(--border-strong);border-radius:8px;color:var(--text-primary)"
            oninput="escalaBuscarColab(this.value)" placeholder="Buscar por matrícula ou nome pra adicionar...">
          <div id="escala-busca-resultados" style="position:absolute;top:calc(100% + 4px);left:0;right:0;background:#141b2c;border:1px solid var(--border-strong);border-radius:8px;z-index:20;display:none;max-height:220px;overflow-y:auto;box-shadow:var(--adh-shadow-card)"></div>
        </div>
        <button class="adh-refresh-btn" ${dis} style="background:var(--blue);color:#0b0f1a;border:none;font-weight:600" onclick="escalaPreencherTodoStaff()">${escalaIcone('users')}Preencher com Staff</button>
        <button class="adh-refresh-btn" ${dis} style="background:var(--blue);color:#0b0f1a;border:none;font-weight:600" onclick="escalaGerarFolgasAuto()">${escalaIcone('zap')}Gerar folgas automáticas</button>
        <button class="adh-refresh-btn" ${dis} style="background:var(--blue);color:#0b0f1a;border:none;font-weight:600" onclick="escalaPreencherHorarioMesAnterior()">${escalaIcone('calclock')}Horário do mês anterior</button>
        <button class="adh-refresh-btn" ${dis} onclick="escalaAdicionarFeriado()">${escalaIcone('calendarPlus')}+ Feriado dessa base</button>
        <button class="adh-refresh-btn" onclick="escalaBaixarModeloCursos()">${escalaIcone('download')}Modelo de Cursos</button>
        <button class="adh-refresh-btn" ${dis} onclick="document.getElementById('escala-cursos-input').click()">${escalaIcone('upload')}Importar Cursos</button>
        <input type="file" id="escala-cursos-input" ${dis} accept=".xlsx,.xls" style="display:none" onchange="escalaImportarCursos(this)">
        <button class="adh-refresh-btn" ${dis} style="color:#fc8181" onclick="escalaLimparStatus()">${escalaIcone('trash')}Limpar folgas/status</button>
        <button class="adh-refresh-btn" ${dis} style="color:#fc8181" onclick="escalaLimparColaboradores()">${escalaIcone('trash')}Limpar colaboradores</button>
        <button id="escala-btn-remover-sel" class="adh-refresh-btn" ${dis} style="color:#fc8181;display:none" onclick="escalaRemoverSelecionados()">${escalaIcone('trash')}Remover selecionados (0)</button>
        <button class="adh-refresh-btn" ${dis} onclick="escalaLimparOrdemManual()" title="Volta a ordenar sozinho por função + horário de entrada">${escalaIcone('sort')}Ordenar automático</button>
        <button class="adh-refresh-btn" style="${window._escalaAgruparPorTurno?'background:var(--blue);color:#0b0f1a;border:none;font-weight:600':''}" onclick="escalaToggleAgruparTurno()" title="Agrupa a lista por função e depois por turno, com subtotal por bloco">${escalaIcone('layers')}Agrupar por função/turno</button>
      </div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:8px">
        ${Array(7).fill('<button class="adh-refresh-btn" disabled style="min-width:90px;opacity:.35" title="Reservado pra uma função futura"></button>').join('')}
      </div>
      <div id="escala-status-msg" style="font-size:11px;color:var(--text-muted);margin-top:8px;min-height:14px"></div>
    </div>

    <div class="hc-panel">
      <div style="display:flex;gap:14px;margin-bottom:12px;font-size:11px;color:var(--text-secondary);flex-wrap:wrap">
        <span><span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:var(--text-muted);margin-right:5px"></span>F · Folga</span>
        <span><span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:#a78bfa;margin-right:5px"></span>FA · Folga agrupada</span>
        <span><span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:#c9a24a;margin-right:5px"></span>L · Férias (automático)</span>
        <span><span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:#fc8181;margin-right:5px"></span>J · Afastado</span>
        <span><span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:#38bdf8;margin-right:5px"></span>K · Cursos</span>
        <span><span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:#fb923c;margin-right:5px"></span>CH · Folga compensa (tecla C)</span>
        <span style="color:var(--text-muted)">clique numa célula vazia ou de trabalho pra marcar F/J/K/C · fim de semana e feriado ficam destacados nas colunas</span>
      </div>
      <div id="escala-grade-wrap" style="overflow:auto;max-height:calc(100vh - 420px);border-radius:8px">${escalaGradeTabelaHTML(ano, mesNum, diasNoMes)}</div>
    </div>
  `;
}

function escalaGradeAtualiza() {
  const [ano, mesNum] = window._escalaMes.split('-').map(Number);
  const diasNoMes = new Date(ano, mesNum, 0).getDate();
  const wrap = document.getElementById('escala-grade-wrap');
  if (wrap) wrap.innerHTML = escalaGradeTabelaHTML(ano, mesNum, diasNoMes);
  const contador = document.getElementById('escala-contador-colabs');
  if (contador) {
    const n = (window._escalaColabs||[]).length;
    contador.textContent = `${n} colaborador${n===1?'':'es'}`;
  }
}

const ESCALA_DIAS_SEMANA = ['dom','seg','ter','qua','qui','sex','sáb'];

// Descobre se um dia (dd/mm/yyyy) cai dentro de um período de férias do
// colaborador — não duplica dado, só olha o que já existe.
function escalaEstaDeFerias(matricula, ano, mesNum, dia) {
  const fer = window.eoFerias?.get(matricula);
  if (!fer?.data_inicio || !fer?.data_fim) return false;
  const alvo = `${ano}-${String(mesNum).padStart(2,'0')}-${String(dia).padStart(2,'0')}`;
  return alvo >= fer.data_inicio && alvo <= fer.data_fim;
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

// ── Agrupamento por Função + Turno ─────────────────────
// Função (bloco maior) reaproveita a mesma categorização já usada no Staff
// (hcCargoGrupo, em headcount.js) a partir do texto livre de função do
// cadastro — não precisa recadastrar nada. Turno (bloco menor, dentro de
// cada função) é um campo novo e manual por colaborador (coluna 'turno' em
// escala_colaborador), porque o nome do turno varia por função (Turno D/A
// pra Líder, Noite/Madrugada pra Operador etc.) — não dá pra calcular
// sozinho, o gestor que decide e digita.
const ESCALA_FUNCAO_GRUPO_LABEL = {
  RAMP: 'Rampa', CLEANING: 'Limpeza', GSE: 'GSE', PAX: 'Passageiros',
  SUPERVISION: 'Supervisão', SECURITY: 'Segurança', LEADERSHIP: 'Liderança',
  OPERATOR: 'Operador', OTHERS: 'Outros',
};
function escalaFuncaoGrupoDoColab(c) {
  const funcao = window.eoColabs?.get(c.matricula)?.funcao || '';
  const codigo = typeof hcCargoGrupo === 'function' ? hcCargoGrupo(funcao) : 'OTHERS';
  return { codigo, label: ESCALA_FUNCAO_GRUPO_LABEL[codigo] || 'Outros' };
}
function escalaEscapeAttr(s) {
  return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function escalaToggleAgruparTurno() {
  window._escalaAgruparPorTurno = !window._escalaAgruparPorTurno;
  escalaGradeAtualiza();
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
  escalaMsg(turno ? `✓ Turno definido: ${turno}.` : '✓ Turno removido.');
}

// Linha de um colaborador — extraída pra função própria porque é usada tanto
// na lista simples quanto dentro de cada bloco de função/turno agrupado.
function escalaLinhaColabHTML(c, ci, ctx) {
  const { ano, mesNum, diasNoMes, leftMat, leftNome, BORDA, turnosExistentes } = ctx;
  const travada = !!window._escalaTravada;
  const dis = travada ? 'disabled' : '';
  const info = window.eoColabs?.get(c.matricula);
  const funcao = info?.funcao || '—';
  const ch = info?.ch || '—';
  const horarioFixo = escalaHorarioFixoDoColab(c.matricula, ano, mesNum, diasNoMes);
  const [entradaCalc, saidaCalc] = horarioFixo ? horarioFixo.split('-') : [null, null];
  const entrada = c.entrada_manual || entradaCalc || '';
  const saida = c.saida_manual || saidaCalc || '';
  const intInicio = c.intervalo_inicio_manual || '';
  const intFim = c.intervalo_fim_manual || '';
  const setor = escalaSetorDoTurno(entrada);
  const zebra = ci % 2 === 0 ? 'var(--zebra)' : 'transparent';

  const conteudo = escalaConteudoDoMes(c, ano, mesNum, diasNoMes);

  let html = `<tr style="background:${zebra}" ondragover="event.preventDefault()" ondrop="escalaDrop(event,'${c.matricula}')">`;
  html += `<td style="text-align:center;position:sticky;left:0;background:inherit;border:${BORDA};padding:0">
    <div style="display:flex;align-items:center;justify-content:center;gap:3px">
      <span draggable="${!travada}" ondragstart="escalaDragStart(event,'${c.matricula}')" style="cursor:${travada?'default':'grab'};color:var(--text-muted);font-size:12px;user-select:none;opacity:${travada?.4:1}" title="Arrastar pra reordenar">⠿</span>
      <input type="checkbox" data-escala-check="${c.matricula}" ${window._escalaSelecionados?.has(c.matricula)?'checked':''} onchange="escalaToggleSelecao('${c.matricula}',this.checked)" title="Selecionar" style="margin:0">
    </div>
  </td>`;
  html += `<td style="padding:2px 10px;position:sticky;left:${leftMat}px;background:inherit;border:${BORDA}"><input type="text" ${dis} value="${c.matricula}" onchange="escalaEditarMatricula('${c.matricula}',this.value)" style="width:100%;box-sizing:border-box;background:transparent;border:none;color:var(--text-primary);font-weight:500;text-overflow:ellipsis;padding:6px 0" title="Editar matrícula"></td>`;
  html += `<td style="padding:8px 10px;color:var(--text-primary);font-weight:500;position:sticky;left:${leftNome}px;background:inherit;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;border:${BORDA}" title="${c.nome||''}">${c.nome||''}</td>`;
  html += `<td style="padding:8px 10px;color:var(--text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;border:${BORDA}">${setor}</td>`;
  html += `<td style="padding:2px 6px;border:${BORDA}">
    <select ${dis} onchange="escalaEditarTurno('${c.matricula}', this.value)" style="width:100%;box-sizing:border-box;background:transparent;border:none;color:var(--text-secondary);font-size:11px;padding:4px 0;cursor:pointer">
      <option value="">—</option>
      ${turnosExistentes.map(t => `<option value="${escalaEscapeAttr(t)}" ${c.turno===t?'selected':''}>${escalaEscapeAttr(t)}</option>`).join('')}
      <option value="__novo__">+ novo turno...</option>
    </select>
  </td>`;
  html += `<td style="padding:8px 10px;color:var(--text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;border:${BORDA}" title="${funcao}">${funcao}</td>`;
  html += `<td style="text-align:center;border:${BORDA};padding:2px"><input type="text" ${dis} value="${entrada}" placeholder="--:--" maxlength="5" oninput="escalaMascaraHorario(this)" onchange="escalaEditarHorario('${c.matricula}','entrada',this.value)" style="width:100%;box-sizing:border-box;background:transparent;border:none;color:var(--text-secondary);text-align:center;font-size:12px;padding:4px"></td>`;
  html += `<td style="text-align:center;border:${BORDA};padding:2px"><input type="text" ${dis} value="${intInicio}" placeholder="--:--" maxlength="5" oninput="escalaMascaraHorario(this)" onchange="escalaEditarHorario('${c.matricula}','intervalo_inicio',this.value)" style="width:100%;box-sizing:border-box;background:transparent;border:none;color:var(--text-muted);text-align:center;font-size:12px;padding:4px" title="Início do intervalo"></td>`;
  html += `<td style="text-align:center;border:${BORDA};padding:2px"><input type="text" ${dis} value="${intFim}" placeholder="--:--" maxlength="5" oninput="escalaMascaraHorario(this)" onchange="escalaEditarHorario('${c.matricula}','intervalo_fim',this.value)" style="width:100%;box-sizing:border-box;background:transparent;border:none;color:var(--text-muted);text-align:center;font-size:12px;padding:4px" title="Fim do intervalo"></td>`;
  html += `<td style="text-align:center;border:${BORDA};padding:2px"><input type="text" ${dis} value="${saida}" placeholder="--:--" maxlength="5" oninput="escalaMascaraHorario(this)" onchange="escalaEditarHorario('${c.matricula}','saida',this.value)" style="width:100%;box-sizing:border-box;background:transparent;border:none;color:var(--text-secondary);text-align:center;font-size:12px;padding:4px"></td>`;
  html += `<td style="text-align:center;color:var(--text-secondary);border:${BORDA}">${ch}</td>`;
  conteudo.forEach((item, i) => {
    const dia = i+1;
    const dow = new Date(ano, mesNum-1, dia).getDay();
    const dataISO = `${ano}-${String(mesNum).padStart(2,'0')}-${String(dia).padStart(2,'0')}`;
    const feriado = window._escalaFeriados?.get(dataISO);
    const fimDeSemana = dow === 0 || dow === 6;
    const bgCel = feriado ? 'rgba(252,129,129,.08)' : fimDeSemana ? 'var(--bg-hover)' : 'transparent';
    const editavel = item.editavel && !travada;
    html += `<td data-mat="${c.matricula}" data-dia="${dia}" onclick="${editavel?`escalaSelecionarCelula('${c.matricula}',${dia},this)`:''}" style="padding:2px;height:32px;cursor:${editavel?'pointer':'default'};background:${bgCel};border:${BORDA}" title="${feriado?feriado.nome:(item.detalhe||'')}">${escalaCelHTML(item)}</td>`;
  });
  html += `</tr>`;
  return html;
}

// Linha de cabeçalho de bloco (função ou turno) + linha de subtotal de
// folgas por dia daquele bloco — mesma definição de "folga" usada no
// restante do módulo (F/FA/J/CH conta, K não conta porque continua sendo
// dia de trabalho).
function escalaBlocoHeaderHTML(label, contagem, nivel, NCOLS) {
  const bg = nivel === 'funcao' ? 'var(--bg-surface)' : nivel === 'turno-a' ? 'rgba(0,160,210,.12)' : 'rgba(159,122,234,.12)';
  const cor = nivel === 'funcao' ? 'var(--text-primary)' : nivel === 'turno-a' ? 'var(--blue)' : 'var(--purple)';
  const paddingLeft = nivel === 'funcao' ? '10px' : '26px';
  return `<tr><td colspan="${NCOLS}" style="padding:6px ${paddingLeft};background:${bg}">
    <span style="font-weight:600;color:${cor};font-size:${nivel==='funcao'?'12.5px':'11.5px'}">${label}</span>
    <span style="color:${cor};opacity:.75;font-size:11px;margin-left:8px">${contagem} pessoa${contagem===1?'':'s'}</span>
  </td></tr>`;
}
function escalaBlocoFolgasPorDia(colabsDoBloco, ano, mesNum, diasNoMes) {
  const porDia = new Array(diasNoMes).fill(0);
  colabsDoBloco.forEach(c => {
    escalaConteudoDoMes(c, ano, mesNum, diasNoMes).forEach((item, i) => {
      if (['F','FA','J','CH','L'].includes(item.status)) porDia[i]++;
    });
  });
  return porDia;
}
function escalaBlocoSubtotalHTML(label, colabsDoBloco, ano, mesNum, diasNoMes, NCOLS_FIXAS, forte, BORDA) {
  const porDia = escalaBlocoFolgasPorDia(colabsDoBloco, ano, mesNum, diasNoMes);
  const bg = forte ? 'var(--bg-surface)' : 'var(--bg-hover)';
  const peso = forte ? '600' : '500';
  return `<tr style="background:${bg}">
    <td colspan="${NCOLS_FIXAS}" style="padding:4px 10px;color:var(--text-secondary);font-size:11px;text-align:right;font-weight:${peso};border:${BORDA}">${label} — folgas no dia →</td>
    ${porDia.map(n => `<td style="text-align:center;border:${BORDA};color:var(--text-secondary);font-weight:${peso};font-size:11px">${n}</td>`).join('')}
  </tr>`;
}

function escalaGradeTabelaHTML(ano, mesNum, diasNoMes) {
  // Mesma lógica de "entrada" usada na renderização de cada linha (entrada
  // manual, senão o horário mais frequente do mês) — pra ordenar exatamente
  // como aparece na tela: função, depois horário de entrada (menor pro maior).
  const entradaDoColab = (c) => {
    const horarioFixo = escalaHorarioFixoDoColab(c.matricula, ano, mesNum, diasNoMes);
    const [entradaCalc] = horarioFixo ? horarioFixo.split('-') : [null];
    return c.entrada_manual || entradaCalc || '';
  };
  // Se o responsável já arrastou algum colaborador antes, a lista toda
  // passa a respeitar essa ordem manual (ordem_manual) em vez de reordenar
  // sozinha por função/horário — só volta a ordenar automático se ninguém
  // tiver ordem_manual definida ainda, ou se clicar em "Ordenar automático".
  const colabs = [...(window._escalaColabs || [])].sort((a, b) => {
    const oa = a.ordem_manual, ob = b.ordem_manual;
    if (oa != null && ob != null) return oa - ob;
    if (oa != null) return -1;
    if (ob != null) return 1;
    const fa = window.eoColabs?.get(a.matricula)?.funcao || '';
    const fb = window.eoColabs?.get(b.matricula)?.funcao || '';
    return fa.localeCompare(fb) || entradaDoColab(a).localeCompare(entradaDoColab(b)) || String(a.nome||'').localeCompare(String(b.nome||''));
  });
  const temOrdemManual = colabs.some(c => c.ordem_manual != null);
  const NCOLS_FIXAS = 11; // Remover, Matrícula, Nome, Setor, Turno, Função, Entrada, Intervalo início, Intervalo fim, Saída, CH
  const NCOLS = NCOLS_FIXAS + diasNoMes;
  const BORDA = '1px solid var(--border-strong)';
  const turnosExistentes = [...new Set(colabs.map(c => c.turno).filter(Boolean))].sort((a,b) => a.localeCompare(b));

  const LARG = { remover:36, mat:80, nome:210, setor:100, turno:110, funcao:190, entrada:60, intInicio:60, intFim:60, saida:60, ch:46, dia:30 };
  const leftMat  = LARG.remover;
  const leftNome = LARG.remover + LARG.mat;
  // Largura total exata (colunas fixas + dias, todos com pixel fixo — nada
  // de calc() por coluna, que estava causando erro de arredondamento e
  // cortando o último dia). Em telas largas, a tabela cresce pra 100% do
  // espaço disponível (table-layout:fixed distribui esse espaço extra
  // proporcionalmente entre todas as colunas); em telas estreitas, mantém a
  // largura mínima exata e rola horizontalmente.
  const larguraFixas = LARG.remover + LARG.mat + LARG.nome + LARG.setor + LARG.turno + LARG.funcao + LARG.entrada + LARG.intInicio + LARG.intFim + LARG.saida + LARG.ch;
  const larguraTotal = larguraFixas + LARG.dia * diasNoMes;

  let html = `<table style="border-collapse:collapse;font-size:13px;width:max(100%, ${larguraTotal}px);table-layout:fixed"><colgroup>
    <col style="width:${LARG.remover}px"><col style="width:${LARG.mat}px"><col style="width:${LARG.nome}px"><col style="width:${LARG.setor}px"><col style="width:${LARG.turno}px"><col style="width:${LARG.funcao}px">
    <col style="width:${LARG.entrada}px"><col style="width:${LARG.intInicio}px"><col style="width:${LARG.intFim}px"><col style="width:${LARG.saida}px"><col style="width:${LARG.ch}px">
    ${Array(diasNoMes).fill(`<col style="width:${LARG.dia}px">`).join('')}
  </colgroup><thead><tr>`;
  html += `<th style="text-align:center;padding:8px 2px;position:sticky;top:0;left:0;background:var(--bg-surface);z-index:3;border:${BORDA}"><input type="checkbox" onchange="escalaSelecionarTodos(this.checked)" title="Selecionar todos" style="margin:0"></th>`;
  html += `<th style="text-align:left;padding:8px 10px;color:var(--text-muted);font-size:11px;text-transform:uppercase;position:sticky;top:0;left:${leftMat}px;background:var(--bg-surface);z-index:3;border:${BORDA}">Matrícula</th>`;
  html += `<th style="text-align:left;padding:8px 10px;color:var(--text-muted);font-size:11px;text-transform:uppercase;position:sticky;top:0;left:${leftNome}px;background:var(--bg-surface);z-index:3;border:${BORDA}">Nome</th>`;
  html += `<th style="text-align:left;padding:8px 10px;color:var(--text-muted);font-size:11px;text-transform:uppercase;position:sticky;top:0;background:var(--bg-surface);z-index:2;border:${BORDA}">Setor</th>`;
  html += `<th style="text-align:left;padding:8px 10px;color:var(--text-muted);font-size:11px;text-transform:uppercase;position:sticky;top:0;background:var(--bg-surface);z-index:2;border:${BORDA}" title="Grupo manual — usado no Agrupar por função/turno">Turno</th>`;
  html += `<th style="text-align:left;padding:8px 10px;color:var(--text-muted);font-size:11px;text-transform:uppercase;position:sticky;top:0;background:var(--bg-surface);z-index:2;border:${BORDA}">Função</th>`;
  html += `<th style="text-align:center;padding:8px 4px;color:var(--text-muted);font-size:11px;text-transform:uppercase;position:sticky;top:0;background:var(--bg-surface);z-index:2;border:${BORDA}">Entrada</th>`;
  html += `<th style="text-align:center;padding:8px 4px;color:var(--text-muted);font-size:10px;text-transform:uppercase;position:sticky;top:0;background:var(--bg-surface);z-index:2;border:${BORDA}" title="Início do intervalo">Interv. ↓</th>`;
  html += `<th style="text-align:center;padding:8px 4px;color:var(--text-muted);font-size:10px;text-transform:uppercase;position:sticky;top:0;background:var(--bg-surface);z-index:2;border:${BORDA}" title="Fim do intervalo">Interv. ↑</th>`;
  html += `<th style="text-align:center;padding:8px 4px;color:var(--text-muted);font-size:11px;text-transform:uppercase;position:sticky;top:0;background:var(--bg-surface);z-index:2;border:${BORDA}">Saída</th>`;
  html += `<th style="text-align:center;padding:8px 4px;color:var(--text-muted);font-size:11px;text-transform:uppercase;position:sticky;top:0;background:var(--bg-surface);z-index:2;border:${BORDA}">CH</th>`;
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
  html += `<tr style="background:rgba(0,160,210,.06)">
    <td colspan="${NCOLS_FIXAS}" style="border:${BORDA};padding:6px 10px;color:var(--text-secondary);font-size:11px;text-align:right;font-weight:600;position:sticky;left:0;background:var(--bg-surface);white-space:nowrap">Trabalhando no dia →</td>
    ${contagemPorDia.map(n => `<td style="text-align:center;border:${BORDA};color:var(--text-primary);font-weight:700;font-size:12px">${n}</td>`).join('')}
  </tr>`;

  html += `<tr>
    <td style="border:${BORDA};padding:2px;position:sticky;left:0;background:var(--adh-surface)"></td>
    <td style="border:${BORDA};padding:2px;position:sticky;left:${leftMat}px;background:var(--adh-surface)">
      <input type="text" id="escala-add-inline" ${window._escalaTravada ? 'disabled' : ''} placeholder="+ matrícula" onkeydown="if(event.key==='Enter') escalaAdicionarPorMatriculaInline(this.value)"
        style="width:100%;box-sizing:border-box;background:transparent;border:1px dashed var(--border-strong);border-radius:4px;color:var(--text-secondary);font-family:monospace;font-size:11px;padding:6px 8px">
    </td>
    <td colspan="${NCOLS-2}" style="border:${BORDA};padding:8px 10px;color:var(--text-muted);font-size:11px">digite a matrícula e aperte Enter — o nome aparece sozinho</td>
  </tr>`;

  if (!colabs.length) {
    html += `<tr><td colspan="${NCOLS}" style="padding:24px;text-align:center;color:var(--text-muted);font-size:12.5px;border:${BORDA}">Nenhum colaborador ativo encontrado pra essa base+mês — busque por matrícula ou nome acima.</td></tr>`;
  }

  const ctxLinha = { ano, mesNum, diasNoMes, leftMat, leftNome, BORDA, turnosExistentes };

  if (!window._escalaAgruparPorTurno) {
    // Lista simples (comportamento de sempre) — ordem manual de arrastar
    // continua valendo aqui.
    colabs.forEach((c, ci) => { html += escalaLinhaColabHTML(c, ci, ctxLinha); });
  } else {
    // Agrupado: Função (bloco maior, reaproveitando hcCargoGrupo) → Turno
    // (subgrupo manual) → colaboradores. A ordem manual de arrastar não se
    // aplica aqui (não tem um sentido único quando a lista está partida em
    // vários blocos) — ordena por horário de entrada + nome dentro de cada
    // turno, igual o critério automático da lista simples.
    const entradaDoColabOrdenacao = (c) => {
      const horarioFixo = escalaHorarioFixoDoColab(c.matricula, ano, mesNum, diasNoMes);
      const [entradaCalc] = horarioFixo ? horarioFixo.split('-') : [null];
      return c.entrada_manual || entradaCalc || '';
    };

    const gruposFuncao = new Map(); // codigo -> { label, turnos: Map(turnoLabel -> colabs[]) }
    colabs.forEach(c => {
      const { codigo, label } = escalaFuncaoGrupoDoColab(c);
      if (!gruposFuncao.has(codigo)) gruposFuncao.set(codigo, { label, turnos: new Map() });
      const grupo = gruposFuncao.get(codigo);
      const turnoLabel = c.turno || '(sem turno)';
      if (!grupo.turnos.has(turnoLabel)) grupo.turnos.set(turnoLabel, []);
      grupo.turnos.get(turnoLabel).push(c);
    });

    const funcoesOrdenadas = [...gruposFuncao.entries()].sort((a, b) => a[1].label.localeCompare(b[1].label));

    funcoesOrdenadas.forEach(([, grupo]) => {
      const todosDaFuncao = [...grupo.turnos.values()].flat();
      html += escalaBlocoHeaderHTML(grupo.label, todosDaFuncao.length, 'funcao', NCOLS);

      const turnosOrdenados = [...grupo.turnos.entries()].sort((a, b) => {
        if (a[0] === '(sem turno)') return 1;
        if (b[0] === '(sem turno)') return -1;
        return a[0].localeCompare(b[0]);
      });

      turnosOrdenados.forEach(([turnoLabel, colabsDoTurno], ti) => {
        html += escalaBlocoHeaderHTML(turnoLabel, colabsDoTurno.length, ti % 2 === 0 ? 'turno-a' : 'turno-b', NCOLS);
        colabsDoTurno
          .sort((a, b) => entradaDoColabOrdenacao(a).localeCompare(entradaDoColabOrdenacao(b)) || String(a.nome||'').localeCompare(String(b.nome||'')))
          .forEach((c, ci) => { html += escalaLinhaColabHTML(c, ci, ctxLinha); });
        html += escalaBlocoSubtotalHTML(turnoLabel, colabsDoTurno, ano, mesNum, diasNoMes, NCOLS_FIXAS, false, BORDA);
      });

      if (grupo.turnos.size > 1) {
        html += escalaBlocoSubtotalHTML(`Total ${grupo.label}`, todosDaFuncao, ano, mesNum, diasNoMes, NCOLS_FIXAS, true, BORDA);
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
    escalaMsg(`⚠ ${nome || 'Colaborador'} (matrícula ${matricula}) é da base ${r.station||'?'}, não de ${window._escalaBase} — não foi adicionado.`, true);
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
  if (ok) escalaMsg(`✓ ${window.eoColabs.get(matricula).nome} adicionado.`);
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
    escalaMsg(`⚠ ${info.nome} (matrícula ${novaMatricula}) é da base ${info.station||'?'}, não de ${window._escalaBase} — a matrícula não foi trocada.`, true);
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
  escalaMsg(`✓ Matrícula corrigida — agora é ${info.nome} (${novaMatricula}).`);
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
    const ch = window.eoColabs?.get(matricula)?.ch;
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
    escalaMsg(`✓ Horário salvo — Saída calculada automaticamente (${saidaAutoCalculada}) pela carga horária.`);
  } else {
    escalaMsg('✓ Horário atualizado.');
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

      let msg = `✓ ${inserts.length} dia(s) de curso marcados`;
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
  escalaMsg(`✓ ${novos.length} colaborador${novos.length===1?'':'es'} adicionado${novos.length===1?'':'s'} — organizados por função e horário de entrada.`);
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
  escalaMsg('✓ Todos os colaboradores foram removidos dessa escala.');
}

async function escalaLimparStatus() {
  if (escalaVerificarTravada()) return;
  if (!confirm('Limpar todas as marcações de Folga/FA/Cursos/Afastado/Compensa dessa escala (base+mês)? Os colaboradores continuam na escala, só o preenchimento some. Não dá pra desfazer.')) return;
  const base = window._escalaBase, mes = window._escalaMes;
  const { error } = await db.from('escala_dia').delete().eq('base', base).eq('mes', mes);
  if (error) { escalaMsg('Erro ao limpar: ' + error.message, true); return; }
  window._escalaDias = new Map();
  escalaGradeAtualiza();
  escalaMsg('✓ Marcações de F/FA/K/CH/J limpas (férias automáticas continuam vindo do cadastro).');
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
  escalaMsg(`✓ ${selecionados.length} colaborador${selecionados.length===1?'':'es'} removido${selecionados.length===1?'':'s'}.`);
}

// ── Arrastar pra reordenar manualmente ──────────────────
// Enquanto ninguém arrasta nada, a lista continua ordenando sozinha por
// função + horário de entrada. Assim que arrasta uma vez, a ordem vira
// manual (salva em ordem_manual) e passa a valer até clicar em "Ordenar
// automático" de novo.
function escalaDragStart(e, matricula) {
  e.dataTransfer.setData('text/plain', matricula);
  e.dataTransfer.effectAllowed = 'move';
}

async function escalaDrop(e, matriculaAlvo) {
  e.preventDefault();
  if (escalaVerificarTravada()) return;
  const matriculaArrastada = e.dataTransfer.getData('text/plain');
  if (!matriculaArrastada || matriculaArrastada === matriculaAlvo) return;

  const lista = window._escalaColabs || [];
  const idxArrastado = lista.findIndex(c => c.matricula === matriculaArrastada);
  const idxAlvo = lista.findIndex(c => c.matricula === matriculaAlvo);
  if (idxArrastado === -1 || idxAlvo === -1) return;

  const [item] = lista.splice(idxArrastado, 1);
  lista.splice(idxAlvo, 0, item);
  lista.forEach((c, i) => { c.ordem_manual = i; });

  const updates = lista.map((c, i) => ({
    base: window._escalaBase, mes: window._escalaMes, matricula: c.matricula, nome: c.nome, ordem_manual: i,
  }));
  const BATCH = 200;
  for (let i = 0; i < updates.length; i += BATCH) {
    const { error } = await db.from('escala_colaborador').upsert(updates.slice(i, i+BATCH), { onConflict: 'base,mes,matricula' });
    if (error) { escalaMsg('Erro ao salvar a ordem: ' + error.message, true); return; }
  }
  escalaGradeAtualiza();
  escalaMsg('✓ Ordem atualizada — a lista não vai mais reordenar sozinha até você clicar em "Ordenar automático".');
}

async function escalaLimparOrdemManual() {
  if (escalaVerificarTravada()) return;
  const lista = window._escalaColabs || [];
  if (!lista.some(c => c.ordem_manual != null)) { escalaMsg('Essa escala já está na ordenação automática.'); return; }
  lista.forEach(c => { c.ordem_manual = null; });
  const updates = lista.map(c => ({ base: window._escalaBase, mes: window._escalaMes, matricula: c.matricula, nome: c.nome, ordem_manual: null }));
  const BATCH = 200;
  for (let i = 0; i < updates.length; i += BATCH) {
    const { error } = await db.from('escala_colaborador').upsert(updates.slice(i, i+BATCH), { onConflict: 'base,mes,matricula' });
    if (error) { escalaMsg('Erro ao voltar a ordem: ' + error.message, true); return; }
  }
  escalaGradeAtualiza();
  escalaMsg('✓ Voltou pra ordenação automática (função → horário de entrada).');
}

// ── Digitação por teclado ──────────────────────────────
// Clica na célula pra selecionar (fica com contorno azul), depois digita
// F, J ou K pra marcar — L é recusado (férias é automático, não digitável),
// e qualquer outra tecla também é recusada. Backspace/Delete limpa.
const ESCALA_TECLAS_VALIDAS = ['F', 'J', 'K', 'CH'];

function escalaSelecionarCelula(matricula, dia, elCel) {
  if (window._escalaCelSelecionadaEl) {
    window._escalaCelSelecionadaEl.style.outline = '';
    window._escalaCelSelecionadaEl.style.outlineOffset = '';
  }
  if (elCel) {
    elCel.style.outline = '2px solid var(--blue)';
    elCel.style.outlineOffset = '-2px';
  }
  window._escalaCelSelecionadaEl = elCel;
  window._escalaCelulaSelecionada = { matricula, dia };
  escalaMsg('Célula selecionada — digite F, J, K ou C (compensa). Backspace limpa.');
}

function escalaRestaurarSelecaoVisual() {
  const sel = window._escalaCelulaSelecionada;
  if (!sel) return;
  const el = document.querySelector(`[data-mat="${sel.matricula}"][data-dia="${sel.dia}"]`);
  if (el) {
    el.style.outline = '2px solid var(--blue)';
    el.style.outlineOffset = '-2px';
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
  const { matricula, dia } = sel;
  const base = window._escalaBase, mes = window._escalaMes;
  const key = `${matricula}|${dia}`;
  const [ano, mesNum] = mes.split('-').map(Number);
  const diasNoMes = new Date(ano, mesNum, 0).getDate();

  if (tecla === 'BACKSPACE' || tecla === 'DELETE') {
    await db.from('escala_dia').delete().eq('base', base).eq('mes', mes).eq('matricula', matricula).eq('dia', dia);
    window._escalaDias.delete(key);
    escalaGradeAtualiza();
    escalaRestaurarSelecaoVisual();
    const violacao = await escalaVerificarSequencia(matricula, ano, mesNum, diasNoMes);
    escalaMsg(violacao
      ? `⚠ Célula limpa — atenção: esse colaborador ficou com ${violacao} dias seguidos trabalhando em algum trecho do mês (o máximo é 6, regra 6x1).`
      : 'Célula limpa.', !!violacao);
    return;
  }

  if (tecla === 'L') {
    escalaMsg('L não pode ser digitado — férias vem automático do cadastro, não é manual.', true);
    return;
  }

  // 'C' é o atalho de uma tecla só pra marcar CH (Folga compensa / banco de
  // horas) — o status salvo sempre é 'CH' (duas letras, igual o resto do
  // sistema já espera pra exibir e pra contar em Aderência); só o atalho de
  // digitação é de uma tecla, pro mesmo jeito de usar F/J/K.
  const statusFinal = tecla === 'C' ? 'CH' : tecla;

  if (ESCALA_TECLAS_VALIDAS.indexOf(statusFinal) === -1) {
    escalaMsg(`"${tecla}" não é uma letra válida nessa célula. Use F, J, K ou C (compensa).`, true);
    return;
  }

  const payload = {
    base, mes, matricula, dia, status: statusFinal, origem: 'manual',
    updated_at: new Date(), updated_by: currentUserProfile?.id || currentUser?.id || null,
  };
  const { error } = await db.from('escala_dia').upsert(payload, { onConflict: 'base,mes,matricula,dia' });
  if (error) { escalaMsg('Erro ao salvar: ' + error.message, true); return; }
  window._escalaDias.set(key, payload);
  escalaGradeAtualiza();
  escalaRestaurarSelecaoVisual();
  const violacao = await escalaVerificarSequencia(matricula, ano, mesNum, diasNoMes);
  escalaMsg(violacao
    ? `⚠ Marcado como ${tecla} — mas esse colaborador ficou com ${violacao} dias seguidos trabalhando em algum trecho do mês (o máximo é 6, regra 6x1). Confira se precisa de uma folga a mais em algum ponto.`
    : `✓ Marcado como ${tecla}.`, !!violacao);
}

function escalaKeydownHandler(e) {
  if (!window._escalaCelulaSelecionada) return;
  const tag = document.activeElement?.tagName;
  if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return; // não interfere na busca/seletores
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
  120: { jornadaDiaria: 4, teto30: 120, teto31: 120 },
  180: { jornadaDiaria: 6, teto30: 150, teto31: 150 },
  210: { jornadaDiaria: 7, teto30: 171, teto31: 177 },
};

// Meta de folgas no mês = dias do mês menos os dias de trabalho necessários
// pra bater (sem ultrapassar) o teto mensal de horas daquela carga horária.
// Não é mais uma tabela fixa — é calculado, porque quem manda é o teto.
// A distribuição continua respeitando o máximo de 6 dias seguidos
// trabalhando antes de uma folga (podendo ser menos: 3x1, 4x1, 5x1 também
// valem), isso fica a cargo de quem monta a sequência (escalaGerarFolgasAuto).
function escalaMetaFolgasDoColab(ch, diasNoMes) {
  const chNum = parseInt(String(ch||'').replace(/\D/g,''), 10);
  const regra = ESCALA_CH_REGRAS[chNum];
  if (!regra) return 6; // CH fora da tabela conhecida — fallback conservador
  const teto = diasNoMes >= 31 ? regra.teto31 : regra.teto30;
  const diasTrabalho = Math.ceil(teto / regra.jornadaDiaria);
  return Math.max(0, diasNoMes - diasTrabalho);
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
    const ch = window.eoColabs?.get(c.matricula)?.ch;
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
  escalaMsg(`✓ Horário preenchido pra ${updates.length} colaborador(es), copiado de ${labelMesAnt}.`);
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

async function escalaGerarFolgasAuto() {
  if (escalaVerificarTravada()) return;
  const colabs = window._escalaColabs || [];
  if (!colabs.length) { escalaMsg('Adicione pelo menos um colaborador antes.', true); return; }

  escalaMostrarLoading(`Calculando folgas para ${colabs.length} colaborador${colabs.length===1?'':'es'}...`);

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
      escalaMsg(`⚠ Salvou ${salvos} de ${inserts.length} folga(s) — parou num lote com erro: ${error.message}. Rode "Gerar folgas automáticas" de novo pra completar o restante.`, true);
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
  escalaMsg(`✓ ${inserts.length} folga(s) geradas, equilibrando a quantidade de gente por dia (meta por CH: ${[...metasUsadas].sort((a,b)=>a-b).join('/')} folgas/mês)${avisoForcado}.`);
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
function escalaMsg(texto, erro) {
  const el = document.getElementById('escala-status-msg');
  if (el) el.innerHTML = `<span style="color:${erro?'#fc8181':'#5fa87a'}">${texto}</span>`;

  const ind = document.getElementById('escala-save-indicator');
  if (ind) {
    if (erro) {
      ind.innerHTML = `<span style="color:#fc8181">⚠ ${texto.replace(/^[🔒⚠]\s*/, '')}</span>`;
    } else {
      const hora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      ind.innerHTML = `<span style="color:#5fa87a">✓ Salvo às ${hora}</span>`;
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
  escalaMsg(`✓ Feriado "${nome}" adicionado em ${dataStr} pra ${base}.`);
  escalaRenderGrade(document.getElementById('page-content'));
}


// ── Gerador state ─────────────────────────────────────
let gFile    = null;
let gRows    = [];
let gBase    = null;
let gSheets  = [];
let gHistory = JSON.parse(localStorage.getItem('gen_history') || '[]');

function pageGerador(el) {
  el.innerHTML = `
    <div class="gen3-wrap">

      <!-- LEFT: Upload + info + history -->
      <div class="gen3-left">
        <div class="gen3-section-label">Dimensionamento</div>

        <div class="gen3-drop" id="gen-drop">
          <input type="file" id="gen-file" accept=".xlsx,.xls"
            style="position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%">
          <div class="gen3-drop-icon">
            <i class="ti ti-upload" style="font-size:18px" aria-hidden="true"></i>
          </div>
          <div class="gen3-drop-t">Arraste ou clique</div>
          <div class="gen3-drop-s">Dimensionamento_*.xlsx</div>
        </div>

        <div id="gen-file-area" style="display:none">
          <div class="gen3-file-pill" id="gen-file-name"></div>
          <div class="gen3-info-list" id="gen-info-list"></div>
        </div>

        <div class="gen3-status" id="gen-status" style="display:none"></div>

        <button class="gen3-btn-primary" id="gen-btn" onclick="genGenerate()" disabled>
          <i class="ti ti-bolt" aria-hidden="true"></i> Gerar escala
        </button>

        <div id="gen-history-section" style="display:none">
          <div class="gen3-section-label" style="margin-top:4px">Histórico</div>
          <div class="gen3-history" id="gen-history-list"></div>
        </div>
      </div>

      <!-- CENTER: Stats + filters + table -->
      <div class="gen3-center">
        <div class="gen3-empty" id="gen-empty">
          <i class="ti ti-table" style="font-size:28px;opacity:.2" aria-hidden="true"></i>
          <span>O resultado aparece aqui após gerar</span>
        </div>

        <div id="gen-result" style="display:none;height:100%;display:none;flex-direction:column">
          <div class="gen3-stats-row" id="gen-stats"></div>
          <div class="gen3-filter-bar" id="gen-filters"></div>
          <div class="gen3-table-wrap">
            <table class="gen3-table">
              <thead>
                <tr>
                  <th>Função</th>
                  <th>Horário</th>
                  <th>CH</th>
                  <th>Período</th>
                  <th class="r">Qtd</th>
                </tr>
              </thead>
              <tbody id="gen-tbody"></tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- RIGHT: Charts + actions -->
      <div class="gen3-right">
        <div class="gen3-right-empty" id="gen-right-empty">
          <i class="ti ti-chart-bar" style="font-size:24px;opacity:.15" aria-hidden="true"></i>
        </div>

        <div id="gen-right-content" style="display:none;flex-direction:column;height:100%">
          <div class="gen3-rp-section">
            <div class="gen3-rp-label">Distribuição por período</div>
            <div class="gen3-mini-chart" id="gen-chart-bars"></div>
            <div class="gen3-period-list" id="gen-period-list"></div>
          </div>

          <div class="gen3-rp-section gen3-rp-scroll">
            <div class="gen3-rp-label">Posições por função</div>
            <div class="gen3-func-list" id="gen-func-list"></div>
          </div>

          <div class="gen3-rp-section">
            <div class="gen3-rp-label">Mês desse dimensionamento</div>
            <select id="gen-mes-select" class="adh-month-select" style="width:100%"></select>
          </div>

          <div class="gen3-actions">
            <button class="gen3-act gen3-act-p" onclick="genGoEscala()">Escala Online</button>
            <button class="gen3-act gen3-act-g" onclick="genGoComparador()">Comparar →</button>
            <button class="gen3-act gen3-act-s" onclick="genDownload()">
              <i class="ti ti-download" aria-hidden="true"></i> Excel
            </button>
            <button class="gen3-act gen3-act-s" onclick="genReset()">
              <i class="ti ti-refresh" aria-hidden="true"></i> Novo
            </button>
          </div>
        </div>
      </div>

    </div>
  `;

  genSetupDrop();
  genRenderHistory();

  // If we already have data (navigated away and back), re-render
  if (gRows.length) genRender();
}

// ── Drop zone ─────────────────────────────────────────
function genSetupDrop() {
  const dz  = document.getElementById('gen-drop');
  const inp = document.getElementById('gen-file');
  if (!dz || !inp) return;
  dz.addEventListener('dragover',  e => { e.preventDefault(); dz.classList.add('over'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('over'));
  dz.addEventListener('drop', e => { e.preventDefault(); dz.classList.remove('over'); if (e.dataTransfer.files[0]) genLoadFile(e.dataTransfer.files[0]); });
  inp.addEventListener('change', e => { if (e.target.files[0]) genLoadFile(e.target.files[0]); });
}

function genLoadFile(file) {
  gFile = file;
  document.getElementById('gen-file-area').style.display = 'block';
  document.getElementById('gen-file-name').innerHTML =
    `<i class="ti ti-file-spreadsheet" style="font-size:11px;margin-right:4px" aria-hidden="true"></i>${file.name}`;
  document.getElementById('gen-drop').classList.add('has-file');
  document.getElementById('gen-btn').disabled = false;
  genSetStatus('');

  genReadXlsx(file, wb => {
    gBase   = genDetectBase(wb);
    gSheets = wb.SheetNames;
    genUpdateInfo();
  });
}

function genReadXlsx(file, cb) {
  const r = new FileReader();
  r.onload = e => {
    try { cb(XLSX.read(e.target.result, { type: 'array' })); }
    catch(err) { genSetStatus('Erro ao ler: ' + err.message, 'err'); }
  };
  r.readAsArrayBuffer(file);
}

function genDetectBase(wb) {
  for (const name of wb.SheetNames) {
    const ws   = wb.Sheets[name];
    const rows = XLSX.utils.sheet_to_json(ws, { header:1, defval:null, range:0 });
    for (let ri = 0; ri <= Math.min(5, rows.length-1); ri++) {
      const row = rows[ri];
      if (!row) continue;
      for (let ci = 0; ci < Math.min(row.length-1, 10); ci++) {
        if (typeof row[ci]==='string' && row[ci].trim().toLowerCase()==='base') {
          const next = row[ci+1];
          if (typeof next==='string' && /^[A-Z]{2,4}$/.test(next.trim())) return next.trim();
        }
      }
    }
  }
  return null;
}

function genUpdateInfo() {
  const list = document.getElementById('gen-info-list');
  if (!list) return;
  list.innerHTML = `
    <div class="gen3-info-row"><span>Base detectada</span><span class="gen3-base-badge">${gBase||'—'}</span></div>
    <div class="gen3-info-row"><span>Abas</span><span>${gSheets.length} setor(es)</span></div>
    <div class="gen3-info-row"><span>Arquivo</span><span style="color:#5a6a82;font-size:10px;max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${gFile?.name||''}</span></div>
  `;
  // Update topbar base badge
  const badge = document.getElementById('tb-base');
  if (badge && gBase) { badge.textContent = gBase; badge.style.display = 'inline-flex'; }
}

// ── Generate ──────────────────────────────────────────
function genGenerate() {
  if (!gFile) return;
  genSetStatus('Processando...', 'load');
  document.getElementById('gen-btn').disabled = true;

  setTimeout(() => {
    genReadXlsx(gFile, wb => {
      try {
        gBase = genDetectBase(wb) || gBase;
        gRows = genParse(wb);
        genRender();
        genSaveHistory();
        document.getElementById('gen-btn').disabled = false;
        genSetStatus('');
      } catch(e) {
        genSetStatus('Erro: ' + e.message, 'err');
        document.getElementById('gen-btn').disabled = false;
      }
    });
  }, 50);
}

function genParse(wb) {
  const rows = [];
  for (const sheetName of wb.SheetNames) {
    const ws   = wb.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(ws, { header:1, defval:null });
    for (let ri = 99; ri < data.length; ri++) {
      const row = data[ri];
      if (!row || row.length < 7) continue;
      for (let c = 5; c <= 148; c++) {
        const qty = row[c], label = row[c+1];
        if (typeof qty==='number' && qty>0 && qty<2000 &&
            typeof label==='string' && /^[A-ZÁÉÍÓÚÂÊÔÃÕÇ].+,\d+[Hh]$/.test(label.trim())) {
          const [fn, ch] = label.split(',');
          const hours    = parseInt(ch);
          const startMin = (c-5)*10;
          const endMin   = startMin + hours*60;
          const entrada  = genFmt(startMin);
          const saida    = genFmt(endMin >= 1440 ? endMin-1440 : endMin);
          for (let i = 0; i < Math.round(qty); i++) {
            rows.push({ funcao: fn.trim(), entrada, saida, horario: entrada+' – '+saida, carga: ch.trim(), sheetName });
          }
        }
      }
    }
  }
  return rows;
}

function genFmt(min) {
  return String(Math.floor(min/60)%24).padStart(2,'0')+':'+String(min%60).padStart(2,'0');
}

function genPeriodo(h) {
  if (h>=0&&h<6)  return ['Madrugada','gen3-tma'];
  if (h>=6&&h<12) return ['Manhã',    'gen3-tm'];
  if (h>=12&&h<18)return ['Tarde',    'gen3-tt'];
  return ['Noite','gen3-tn'];
}

// ── Render ────────────────────────────────────────────
let gActiveFilter = 'all';

function genRender() {
  if (!gRows.length) { genSetStatus('Nenhum dado.', 'err'); return; }

  document.getElementById('gen-empty').style.display       = 'none';
  document.getElementById('gen-result').style.display      = 'flex';
  document.getElementById('gen-right-empty').style.display = 'none';
  document.getElementById('gen-right-content').style.display = 'flex';

  // Stats
  const funcoes = [...new Set(gRows.map(r=>r.funcao))];
  const chVals  = gRows.map(r=>parseInt(r.carga));
  document.getElementById('gen-stats').innerHTML = [
    { v: gRows.length,         l: `Total${gBase?' · '+gBase:''}`, c: '#00a0d2' },
    { v: funcoes.length,       l: 'Funções',                        c: '#72c02c' },
    { v: gSheets.length,       l: 'Setores',                        c: '#fbbf24' },
    { v: Math.min(...chVals)+'H', l: 'Menor turno',                 c: '#a78bfa' },
    { v: Math.max(...chVals)+'H', l: 'Maior turno',                 c: '#f472b6' },
  ].map(s => `<div class="gen3-stat"><div class="gen3-stat-v" style="color:${s.c}">${s.v}</div><div class="gen3-stat-l">${s.l}</div></div>`).join('');

  // Filter bar
  const filterEl = document.getElementById('gen-filters');
  filterEl.innerHTML = `<span class="gen3-filter-label">Filtrar</span>
    <span class="gen3-chip${gActiveFilter==='all'?' on':''}" onclick="genFilter('all')">Todos</span>
    ${funcoes.map(f=>`<span class="gen3-chip${gActiveFilter===f?' on':''}" onclick="genFilter('${f.replace(/'/g,"\\'")}')">
      ${f}
    </span>`).join('')}`;

  genRenderTable();
  genRenderRight(funcoes);
  genRenderHistory();
}

function genFilter(f) {
  gActiveFilter = f;
  genRender();
}

function genRenderTable() {
  const filtered = gActiveFilter==='all' ? gRows : gRows.filter(r=>r.funcao===gActiveFilter);
  const unique = {};
  filtered.forEach(r => {
    const k = r.funcao+r.horario;
    if (!unique[k]) unique[k] = { ...r, qty: 0 };
    unique[k].qty++;
  });

  document.getElementById('gen-tbody').innerHTML = Object.values(unique)
    .sort((a,b)=>a.funcao.localeCompare(b.funcao)||a.entrada.localeCompare(b.entrada))
    .map(r => {
      const [per, cls] = genPeriodo(parseInt(r.entrada.split(':')[0]));
      return `<tr>
        <td class="gen3-func-cell">${r.funcao}</td>
        <td style="font-variant-numeric:tabular-nums">${r.horario}</td>
        <td style="color:#72c02c;font-weight:600">${r.carga}</td>
        <td><span class="gen3-tag ${cls}">${per}</span></td>
        <td class="r" style="color:#e8edf3;font-weight:700">${r.qty}</td>
      </tr>`;
    }).join('');
}

function genRenderRight(funcoes) {
  const PERIODS = [
    { l:'Madrugada', h:[0,6],   c:'#94a3b8', cls:'gen3-tma' },
    { l:'Manhã',     h:[6,12],  c:'#60a5fa', cls:'gen3-tm'  },
    { l:'Tarde',     h:[12,18], c:'#34d399', cls:'gen3-tt'  },
    { l:'Noite',     h:[18,24], c:'#fbbf24', cls:'gen3-tn'  },
  ];

  const pCounts = PERIODS.map(p => ({
    ...p,
    count: gRows.filter(r => { const h=parseInt(r.entrada.split(':')[0]); return h>=p.h[0]&&h<p.h[1]; }).length
  }));
  const maxP = Math.max(...pCounts.map(p=>p.count), 1);

  document.getElementById('gen-chart-bars').innerHTML = pCounts.map(p =>
    `<div class="gen3-bar" style="height:${Math.round(p.count/maxP*100)}%;background:${p.c}22;border-top:2px solid ${p.c}" title="${p.l}: ${p.count}"></div>`
  ).join('');

  document.getElementById('gen-period-list').innerHTML = pCounts.map(p =>
    `<div class="gen3-period-row">
       <span><span class="gen3-dot" style="background:${p.c}"></span>${p.l}</span>
       <span>${p.count}</span>
     </div>`
  ).join('');

  const fCounts = funcoes.map(f => ({ f, n: gRows.filter(r=>r.funcao===f).length }))
    .sort((a,b)=>b.n-a.n);

  document.getElementById('gen-func-list').innerHTML = fCounts.map(fc =>
    `<div class="gen3-func-row">
       <span>${fc.f}</span>
       <span>${fc.n}</span>
     </div>`
  ).join('');

  genRenderMesSelect();
}

// Mês pra esse dimensionamento — geralmente feito com antecedência, então o
// padrão é o PRÓXIMO mês, mas dá pra escolher o atual ou até 2 à frente.
function genRenderMesSelect() {
  const sel = document.getElementById('gen-mes-select');
  if (!sel) return;
  const hoje = new Date();
  const opts = [];
  for (let i = 0; i < 4; i++) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth()+i, 1);
    opts.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);
  }
  const atual = opts[0];
  const padrao = window._genMesEscolhido && opts.includes(window._genMesEscolhido) ? window._genMesEscolhido : opts[1];
  sel.innerHTML = opts.map(m => `<option value="${m}" ${m===padrao?'selected':''}>${typeof adhMonthLabel==='function'?adhMonthLabel(m):m}${m===atual?' (atual)':''}</option>`).join('');
}

// ── History ───────────────────────────────────────────
function genSaveHistory() {
  const entry = { base: gBase, file: gFile?.name, total: gRows.length, date: new Date().toLocaleDateString('pt-BR') };
  gHistory = [entry, ...gHistory.filter(h=>h.file!==entry.file)].slice(0,5);
  try { localStorage.setItem('gen_history', JSON.stringify(gHistory)); } catch(_){}
  genRenderHistory();
}

function genRenderHistory() {
  const sec  = document.getElementById('gen-history-section');
  const list = document.getElementById('gen-history-list');
  if (!sec || !list || !gHistory.length) { if(sec) sec.style.display='none'; return; }
  sec.style.display = 'block';
  list.innerHTML = gHistory.map(h => `
    <div class="gen3-hist-item">
      <div class="gen3-hist-name">${h.base||'?'} · ${h.date}</div>
      <div class="gen3-hist-sub">${h.total} posições · ${h.file||''}</div>
    </div>
  `).join('');
}

// ── Actions ───────────────────────────────────────────
async function genGoEscala() {
  const mes = document.getElementById('gen-mes-select')?.value;
  if (!mes) { navigateTo('escala'); return; }
  window._genMesEscolhido = mes;

  genSetStatus('Salvando dimensionamento no banco...', 'load');
  try {
    const grupos = new Map();
    gRows.forEach(r => {
      const k = `${r.funcao}|${r.horario}|${r.sheetName}`;
      if (!grupos.has(k)) {
        grupos.set(k, {
          base: gBase, mes, setor: r.sheetName, funcao: r.funcao,
          entrada: r.entrada, saida: r.saida, carga: r.carga, qtd: 0,
          gerado_por: currentUserProfile?.id || currentUser?.id || null,
        });
      }
      grupos.get(k).qtd++;
    });
    const linhas = [...grupos.values()];

    const { error: eDel } = await db.from('escala_dimensionamento').delete().eq('base', gBase).eq('mes', mes);
    if (eDel) throw new Error(eDel.message);

    const BATCH = 500;
    for (let i = 0; i < linhas.length; i += BATCH) {
      const { error } = await db.from('escala_dimensionamento').insert(linhas.slice(i, i+BATCH));
      if (error) throw new Error(error.message);
    }
    genSetStatus('');
  } catch(e) {
    genSetStatus('Erro ao salvar no banco: ' + e.message, 'err');
    return;
  }

  window._genRows = gRows;
  window._genBase = gBase;
  window._genMes  = mes;
  navigateTo('escala');
}

function genGoComparador() {
  window.cDataDim  = gRows.map(r => ({ setor:r.sheetName, funcao:r.funcao, entrada:genTimeToMin(r.entrada), saida:genTimeToMin(r.saida) })).filter(r=>r.entrada!==null);
  window.cBaseName = gBase;
  navigateTo('comparador');
}

function genTimeToMin(t) {
  const m = String(t).match(/(\d{1,2}):(\d{2})/);
  return m ? parseInt(m[1])*60+parseInt(m[2]) : null;
}

function genDownload() {
  if (!gRows.length) return;
  const today = new Date().toISOString().slice(0,10);
  const wsData = [['SETOR','FUNÇÃO','ENTRADA','SAÍDA','HORÁRIO','CARGA']];
  gRows.forEach(r => wsData.push([r.sheetName,r.funcao,r.entrada,r.saida,r.horario,r.carga]));
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws['!cols'] = [{wch:20},{wch:28},{wch:8},{wch:8},{wch:14},{wch:8}];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'ESCALA');
  XLSX.writeFile(wb, `Escala${gBase?'_'+gBase:''}_${today}.xlsx`);
}

function genReset() {
  gFile=null; gRows=[]; gBase=null; gSheets=[]; gActiveFilter='all';
  const el = document.getElementById('page-content');
  if (el) pageGerador(el);
}

function genSetStatus(msg, type) {
  const el = document.getElementById('gen-status');
  if (!el) return;
  if (!msg) { el.style.display='none'; return; }
  el.style.display='block';
  el.className='gen3-status gen3-status-'+(type||'info');
  el.textContent=msg;
}
// ── Comparador ────────────────────────────────────────
function pageComparador(el) {
  el.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Comparador de Escalas</h1>
        <p class="page-sub">Planejado vs Real · cobertura e gap de quadro</p>
      </div>
    </div>
    <div class="page-placeholder">
      <div class="placeholder-icon">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>
      </div>
      <p class="placeholder-title">Comparador</p>
      <p class="placeholder-sub">Módulo em integração — disponível em breve.</p>
    </div>
  `;
}

// ── Aderência — handled by aderencia.js ───────────────
// Function defined in aderencia.js overwrites this placeholder
