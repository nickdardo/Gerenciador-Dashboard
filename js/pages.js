// ══════════════════════════════════════════════════════
// PAGES — Each module renders into #page-content
// ══════════════════════════════════════════════════════

// ── Escala Online ─────────────────────────────────────
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

  if (typeof adhEnsureRoster === 'function') await adhEnsureRoster();
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
    window._escalaBase = (window._genBase && bases.includes(window._genBase)) ? window._genBase : bases[0];
  }
  if (!window._escalaMes) {
    window._escalaMes = window._genMes || (typeof adhCurrentMonth === 'function' ? adhCurrentMonth() : null);
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

  const { data: voosRows } = await db.from('malha')
    .select('data,tipo,cia,hora_chegada,hora_saida')
    .eq('base', base).gte('data', mesInicioStr).lte('data', mesFimStr);

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
  escalaRenderGrade(document.getElementById('page-content'));
}

function escalaSetMes(mes) {
  window._escalaMes = mes;
  window._escalaDiaSelecionado = 1;
  escalaRenderGrade(document.getElementById('page-content'));
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

  if (typeof adhEnsureRoster === 'function') await adhEnsureRoster();
  if (typeof adminLoadFileOnDemand === 'function') {
    await adminLoadFileOnDemand('horarios', () => {});
  }

  const base = window._escalaBase;
  const mes  = window._escalaMes;

  const [{ data: colabsIniciais }, { data: dias }] = await Promise.all([
    db.from('escala_colaborador').select('*').eq('base', base).eq('mes', mes).order('created_at'),
    db.from('escala_dia').select('*').eq('base', base).eq('mes', mes),
  ]);

  let colabs = colabsIniciais || [];
  let autoPopulado = false;
  if (!colabs.length) {
    colabs = await escalaPopularAutomaticamente(base, mes);
    autoPopulado = colabs.length > 0;
  }
  window._escalaColabs = colabs;
  window._escalaAutoPopulado = autoPopulado;
  window._escalaDias = new Map((dias||[]).map(d => [`${d.matricula}|${d.dia}`, d]));

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

  const { data: voosRows } = await db.from('malha')
    .select('data,tipo,cia,hora_chegada,hora_saida')
    .eq('base', base).gte('data', mesInicioStr).lte('data', mesFimStr);

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

function escalaGradeRenderShell(el, ano, mesNum, diasNoMes) {
  const base = window._escalaBase;
  const mes  = window._escalaMes;
  const role = currentUserProfile?.role;
  const myBases = (currentUserProfile?.bases || []).filter(b => b !== '*');
  const isAdmin = role === 'admin';
  const bases = isAdmin ? (typeof hcAllBases === 'function' ? hcAllBases() : []) : myBases;

  el.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Escala Online</h1>
        <p class="page-sub">Montar escala · ${base} · ${typeof adhMonthLabel==='function'?adhMonthLabel(mes):mes}</p>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        ${bases.length>1
          ? `<select class="adh-month-select" onchange="escalaSetBase(this.value)">${bases.map(b=>`<option value="${b}" ${b===base?'selected':''}>${b}</option>`).join('')}</select>`
          : `<span class="adh-base-badge">${base||'—'}</span>`}
        <select class="adh-month-select" onchange="escalaSetMes(this.value)">${escalaMesOptionsHTML(mes)}</select>
      </div>
    </div>

    ${window._escalaAutoPopulado ? `
    <div style="font-size:11.5px;color:#5fa87a;background:rgba(95,168,122,.08);border:1px solid rgba(95,168,122,.25);border-radius:8px;padding:8px 14px;margin-bottom:14px">
      ✓ ${(window._escalaColabs||[]).length} colaborador(es) carregados automaticamente, cruzando com o horário planejado (ponto) dessa base nesse mês. Use a busca abaixo só se faltar alguém, ou o ✕ na linha se alguém não devia estar aqui.
    </div>` : ''}

    <div class="hc-panel" style="margin-bottom:16px">
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <div style="position:relative;flex:1;min-width:260px">
          <input id="escala-busca" class="adh-search-input" style="width:100%;box-sizing:border-box;padding:9px 12px;background:rgba(255,255,255,.03);border:1px solid var(--border-strong);border-radius:8px;color:var(--text-primary)"
            oninput="escalaBuscarColab(this.value)" placeholder="Buscar por matrícula ou nome pra adicionar...">
          <div id="escala-busca-resultados" style="position:absolute;top:calc(100% + 4px);left:0;right:0;background:#141b2c;border:1px solid var(--border-strong);border-radius:8px;z-index:20;display:none;max-height:220px;overflow-y:auto;box-shadow:var(--adh-shadow-card)"></div>
        </div>
        <button class="adh-refresh-btn" style="background:var(--blue);color:#0b0f1a;border:none;font-weight:600" onclick="escalaGerarFolgasAuto()">⚡ Gerar folgas automáticas</button>
      </div>
      <div id="escala-status-msg" style="font-size:11px;color:var(--text-muted);margin-top:8px;min-height:14px"></div>
    </div>

    <div class="hc-panel">
      <div style="display:flex;gap:14px;margin-bottom:12px;font-size:11px;color:var(--text-secondary);flex-wrap:wrap">
        <span><span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:var(--text-muted);margin-right:5px"></span>F · Folga</span>
        <span><span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:#a78bfa;margin-right:5px"></span>FA · Folga agrupada</span>
        <span><span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:#c9a24a;margin-right:5px"></span>L · Férias (automático)</span>
        <span><span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:#38bdf8;margin-right:5px"></span>K · Cursos</span>
        <span><span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:#fb923c;margin-right:5px"></span>CH · Folga compensa</span>
        <span style="color:var(--text-muted)">clique numa célula vazia ou de trabalho pra marcar F/K</span>
      </div>
      <div id="escala-grade-wrap" style="overflow-x:auto">${escalaGradeTabelaHTML(ano, mesNum, diasNoMes)}</div>
    </div>
  `;
}

function escalaGradeAtualiza() {
  const [ano, mesNum] = window._escalaMes.split('-').map(Number);
  const diasNoMes = new Date(ano, mesNum, 0).getDate();
  const wrap = document.getElementById('escala-grade-wrap');
  if (wrap) wrap.innerHTML = escalaGradeTabelaHTML(ano, mesNum, diasNoMes);
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

function escalaConteudoDoMes(c, ano, mesNum, diasNoMes) {
  const base = window._escalaBase;
  const brutos = [];
  for (let d = 1; d <= diasNoMes; d++) {
    const key = `${c.matricula}|${d}`;
    const manual = window._escalaDias.get(key);
    if (manual) { brutos.push(manual.status); continue; } // 'F' | 'K' | 'L'
    if (escalaEstaDeFerias(c.matricula, ano, mesNum, d)) { brutos.push('L'); continue; }
    brutos.push(null); // dia de trabalho
  }
  return brutos.map((s, i) => {
    if (s === 'F') {
      const antes  = brutos[i-1] === 'F';
      const depois = brutos[i+1] === 'F';
      return { status: 'F', exibido: (antes||depois) ? 'FA' : 'F', editavel: true };
    }
    if (s === 'K') return { status: 'K', exibido: 'K', editavel: true };
    if (s === 'CH') return { status: 'CH', exibido: 'CH', editavel: true };
    if (s === 'L') return { status: 'L', exibido: 'L', editavel: false };
    const dia = i+1;
    const horario = escalaHorarioPlanejado(base, c.matricula, ano, mesNum, dia);
    return { status: null, exibido: horario, editavel: true, horario: !!horario };
  });
}

function escalaCelHTML(item) {
  if (!item.exibido) return '';
  if (item.horario) {
    return `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:var(--text-secondary);font-size:9px" title="Horário planejado (automático, vem do arquivo Horários)">${item.exibido}</div>`;
  }
  const cores = { F:'#8896aa', FA:'#a78bfa', L:'#c9a24a', K:'#38bdf8', CH:'#fb923c' };
  const cor = cores[item.exibido] || '#8896aa';
  const titulo = item.status === 'L' ? 'Férias — automático, vem do cadastro' : item.status === 'CH' ? 'Folga compensa (banco de horas)' : '';
  return `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:${cor}22;color:${cor};border-radius:4px;font-weight:700;font-size:10px" title="${titulo}">${item.exibido}</div>`;
}

function escalaGradeTabelaHTML(ano, mesNum, diasNoMes) {
  const colabs = window._escalaColabs || [];
  const demandaPorDia = window._escalaDemandaPorDia;
  const voosPorDia = window._escalaVoosPorDia || [];

  let html = `<table style="border-collapse:collapse;font-size:11px;width:100%"><thead><tr>`;
  html += `<th style="text-align:left;padding:6px 8px;color:var(--text-muted);font-size:9.5px;text-transform:uppercase;position:sticky;left:0;background:var(--bg-surface);min-width:80px">Matrícula</th>`;
  html += `<th style="text-align:left;padding:6px 8px;color:var(--text-muted);font-size:9.5px;text-transform:uppercase;position:sticky;left:80px;background:var(--bg-surface);min-width:170px">Colaborador</th>`;
  html += `<th style="text-align:left;padding:6px 8px;color:var(--text-muted);font-size:9.5px;text-transform:uppercase;min-width:140px">Cargo</th>`;
  html += `<th style="text-align:center;padding:6px 4px;color:var(--text-muted);font-size:9.5px;text-transform:uppercase;width:44px">Jorn.</th>`;
  for (let d = 1; d <= diasNoMes; d++) {
    const dow = new Date(ano, mesNum-1, d).getDay();
    html += `<th style="padding:3px 2px;color:var(--text-muted);font-size:9px;font-weight:600;width:26px;text-align:center">${ESCALA_DIAS_SEMANA[dow]}<br><span style="color:var(--text-secondary);font-size:10px">${d}</span></th>`;
  }
  html += `<th style="text-align:center;padding:6px 4px;color:var(--text-muted);font-size:9.5px;text-transform:uppercase;width:50px">Folgas</th>`;
  html += `<th style="text-align:center;padding:6px 4px;color:var(--text-muted);font-size:9.5px;text-transform:uppercase;width:60px">Horas trab.</th>`;
  html += `</tr></thead><tbody>`;

  if (demandaPorDia) {
    // Demanda quebrada por turno (A/B/C/D) — vem do motor real (parâmetros
    // de solo × malha), uma linha por turno em vez de um número só do dia.
    ESCALA_TURNOS.forEach(t => {
      html += `<tr><td colspan="4" style="position:sticky;left:0;background:var(--bg-surface);padding:3px 8px;color:${t.cor};font-size:8.5px;font-weight:700">TURNO ${t.nome} · ${t.label}</td>`;
      for (let d = 1; d <= diasNoMes; d++) {
        const v = escalaDemandaPorTurno(d)[ESCALA_TURNOS.indexOf(t)];
        html += `<td style="text-align:center;font-size:8px;color:${t.cor};font-weight:600">${v}</td>`;
      }
      html += `<td></td><td></td></tr>`;
    });
  } else {
    const maxNec = Math.max(1, ...voosPorDia);
    html += `<tr><td colspan="4" style="position:sticky;left:0;background:var(--bg-surface);padding:4px 8px 10px;color:#5fa87a;font-size:9px;font-weight:700;vertical-align:bottom">VOOS/DIA</td>`;
    for (let d = 1; d <= diasNoMes; d++) {
      const v = voosPorDia[d-1] || 0;
      const baixa = maxNec > 0 && v <= maxNec*0.4;
      html += `<td style="vertical-align:bottom;padding:0 2px 4px">
        <div style="height:${Math.round(v/maxNec*30)}px;background:${baixa?'#5fa87a':'#38bdf8'};border-radius:2px 2px 0 0;margin:0 auto;width:14px" title="${v}"></div>
        <div style="font-size:7.5px;color:var(--text-muted);text-align:center;margin-top:2px">${v}</div>
      </td>`;
    }
    html += `<td></td><td></td></tr>`;
  }

  if (!colabs.length) {
    html += `<tr><td colspan="${diasNoMes+6}" style="padding:24px;text-align:center;color:var(--text-muted);font-size:11.5px;border-top:1px solid var(--border)">Nenhum colaborador adicionado ainda — busque por matrícula ou nome acima.</td></tr>`;
  }

  const totF = new Array(diasNoMes).fill(0);
  const totFA = new Array(diasNoMes).fill(0);

  colabs.forEach(c => {
    const info = window.eoColabs?.get(c.matricula);
    const cargo = info?.funcao || '—';
    const chNum = parseInt(String(info?.ch||'').replace(/\D/g,''), 10) || null;
    const jornada = chNum ? Math.round(chNum/30*10)/10 : '—';

    const conteudo = escalaConteudoDoMes(c, ano, mesNum, diasNoMes);
    conteudo.forEach((item, i) => {
      if (item.status === 'F') { if (item.exibido === 'FA') totFA[i]++; else totF[i]++; }
    });
    const folgas = conteudo.filter(x => x.status === 'F' || x.status === 'CH').length;
    const diasTrabalhados = conteudo.filter(x => !x.status).length; // sem F/FA/L/K/CH = trabalhando
    const horasTrab = jornada !== '—' ? Math.round(diasTrabalhados * jornada) : '—';
    const corFolgas = folgas > 10 ? '#fc8181' : folgas > 8 ? '#f6ad55' : 'var(--text-primary)';

    html += `<tr>`;
    html += `<td style="padding:6px 8px;color:var(--text-muted);font-family:monospace;font-size:10px;border-top:1px solid var(--border);position:sticky;left:0;background:var(--bg-surface)">${c.matricula}</td>`;
    html += `<td style="padding:6px 8px;color:var(--text-primary);font-weight:500;border-top:1px solid var(--border);position:sticky;left:80px;background:var(--bg-surface);white-space:nowrap">${c.nome||''}
      <span onclick="escalaRemoverColab('${c.matricula}')" style="cursor:pointer;color:#fc8181;margin-left:4px" title="Remover da escala">✕</span></td>`;
    html += `<td style="padding:6px 8px;color:var(--text-secondary);border-top:1px solid var(--border);white-space:nowrap">${cargo}</td>`;
    html += `<td style="padding:6px 4px;color:var(--text-secondary);text-align:center;border-top:1px solid var(--border)">${jornada}</td>`;
    conteudo.forEach((item, i) => {
      const dia = i+1;
      html += `<td onclick="${item.editavel?`escalaClicarCelula('${c.matricula}',${dia})`:''}" style="padding:2px;border-top:1px solid var(--border);height:28px;width:26px;cursor:${item.editavel?'pointer':'default'}">${escalaCelHTML(item)}</td>`;
    });
    html += `<td style="text-align:center;font-weight:700;color:${corFolgas};border-top:1px solid var(--border)">${folgas}</td>`;
    html += `<td style="text-align:center;color:var(--text-secondary);border-top:1px solid var(--border)">${horasTrab}</td>`;
    html += `</tr>`;
  });

  if (colabs.length) {
    html += `<tr><td colspan="4" style="padding:5px 8px;color:var(--text-secondary);font-size:8.5px;font-weight:700;border-top:2px solid var(--border-strong)">TOTAL FOLGA NORMAL (F)</td>`;
    totF.forEach(v => { html += `<td style="text-align:center;font-size:8px;color:var(--text-secondary);border-top:2px solid var(--border-strong)">${v}</td>`; });
    html += `<td style="border-top:2px solid var(--border-strong)"></td><td style="border-top:2px solid var(--border-strong)"></td></tr>`;

    html += `<tr><td colspan="4" style="padding:4px 8px;color:#a78bfa;font-size:8.5px;font-weight:700">TOTAL FOLGA AGRUPADA (FA)</td>`;
    totFA.forEach(v => { html += `<td style="text-align:center;font-size:8px;color:#a78bfa">${v}</td>`; });
    html += `<td></td><td></td></tr>`;

    html += `<tr><td colspan="4" style="padding:4px 8px;color:#fc8181;font-size:8.5px;font-weight:700">TOTAL FA+F (risco de cobertura)</td>`;
    for (let d = 0; d < diasNoMes; d++) {
      const soma = totF[d] + totFA[d];
      const alerta = soma >= 3;
      html += `<td style="text-align:center;font-size:8px;font-weight:700;color:${alerta?'#fc8181':'var(--text-secondary)'};background:${alerta?'rgba(252,129,129,.12)':'transparent'}">${soma}</td>`;
    }
    html += `<td></td><td></td></tr>`;
  }

  html += `</tbody></table>`;
  return html;
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
  const r = window.eoColabs?.get(matricula);
  const nome = r?.nome || '';
  const busca = document.getElementById('escala-busca');
  if (busca) busca.value = '';
  const resultados = document.getElementById('escala-busca-resultados');
  if (resultados) resultados.style.display = 'none';

  const payload = {
    base: window._escalaBase, mes: window._escalaMes, matricula, nome,
    created_by: currentUserProfile?.id || currentUser?.id || null,
  };
  const { data, error } = await db.from('escala_colaborador').upsert(payload, { onConflict: 'base,mes,matricula' }).select().single();
  if (error) { alert('Erro ao adicionar: ' + error.message); return; }
  window._escalaColabs = [...(window._escalaColabs||[]), data];
  escalaGradeAtualiza();
}

async function escalaRemoverColab(matricula) {
  if (!confirm('Remover esse colaborador dessa escala? Os F/K marcados pra ele nesse mês também somem.')) return;
  const base = window._escalaBase, mes = window._escalaMes;
  await db.from('escala_dia').delete().eq('base', base).eq('mes', mes).eq('matricula', matricula);
  const { error } = await db.from('escala_colaborador').delete().eq('base', base).eq('mes', mes).eq('matricula', matricula);
  if (error) { alert('Erro ao remover: ' + error.message); return; }
  window._escalaColabs = (window._escalaColabs||[]).filter(c => c.matricula !== matricula);
  for (const k of [...window._escalaDias.keys()]) if (k.startsWith(matricula+'|')) window._escalaDias.delete(k);
  escalaGradeAtualiza();
}

const ESCALA_CICLO_MANUAL = ['F', 'K', 'CH', null];

async function escalaClicarCelula(matricula, dia) {
  const key = `${matricula}|${dia}`;
  const atual = window._escalaDias.get(key)?.status || null;
  const idx = ESCALA_CICLO_MANUAL.indexOf(atual);
  const proximo = ESCALA_CICLO_MANUAL[(idx+1) % ESCALA_CICLO_MANUAL.length];
  const base = window._escalaBase, mes = window._escalaMes;

  if (proximo) {
    const payload = {
      base, mes, matricula, dia, status: proximo, origem: 'manual',
      updated_at: new Date(), updated_by: currentUserProfile?.id || currentUser?.id || null,
    };
    const { error } = await db.from('escala_dia').upsert(payload, { onConflict: 'base,mes,matricula,dia' });
    if (error) { alert('Erro ao salvar: ' + error.message); return; }
    window._escalaDias.set(key, payload);
  } else {
    await db.from('escala_dia').delete().eq('base', base).eq('mes', mes).eq('matricula', matricula).eq('dia', dia);
    window._escalaDias.delete(key);
  }
  escalaGradeAtualiza();
}

// Gera folgas nos dias de menor demanda de voos, pra quem ainda não tem
// folga suficiente no mês — não mexe em dias já ocupados (F/K manuais ou
// férias). Simples de propósito na v1: mesma quantidade de folga-alvo pra
// todo mundo, sem levar em conta função/carga horária ainda.
// Meta de folgas por mês, de acordo com a carga horária (CH) do colaborador
// e a quantidade de dias do mês — confirmado com o cliente:
//   180h → precisa trabalhar 150h/mês → 6 folgas
//   90h  → precisa trabalhar 72h/mês  → 6 folgas em mês de 30 dias, 7 em mês de 31 dias
// (100h/120h/210h ainda não confirmados — usam 6 como padrão até confirmar)
function escalaMetaFolgasDoColab(ch, diasNoMes) {
  const chNum = parseInt(String(ch||'').replace(/\D/g,''), 10);
  if (chNum === 180) return 6;
  if (chNum === 90)  return diasNoMes >= 31 ? 7 : 6;
  return 6; // padrão — 100h/120h/210h ainda precisam de confirmação
}

async function escalaGerarFolgasAuto() {
  const colabs = window._escalaColabs || [];
  if (!colabs.length) { escalaMsg('Adicione pelo menos um colaborador antes.', true); return; }

  const [ano, mesNum] = window._escalaMes.split('-').map(Number);
  const diasNoMes = new Date(ano, mesNum, 0).getDate();
  const voosPorDia = window._escalaVoosPorDia || new Array(diasNoMes).fill(0);
  const diasOrdenados = voosPorDia.map((v,i) => ({ dia: i+1, v })).sort((a,b) => a.v-b.v);

  const inserts = [];
  const metasUsadas = new Set();
  for (const c of colabs) {
    const chColab = window.eoColabs?.get(c.matricula)?.ch;
    const meta = escalaMetaFolgasDoColab(chColab, diasNoMes);
    metasUsadas.add(meta);

    let folgasAtuais = 0;
    for (let d = 1; d <= diasNoMes; d++) {
      const manual = window._escalaDias.get(`${c.matricula}|${d}`);
      if (manual?.status === 'F') folgasAtuais++;
      if (escalaEstaDeFerias(c.matricula, ano, mesNum, d)) folgasAtuais++; // já afastado, conta como "resolvido" no mês
    }
    let faltam = meta - folgasAtuais;
    if (faltam <= 0) continue;

    for (const { dia } of diasOrdenados) {
      if (faltam <= 0) break;
      const key = `${c.matricula}|${dia}`;
      if (window._escalaDias.has(key)) continue;
      if (escalaEstaDeFerias(c.matricula, ano, mesNum, dia)) continue;
      inserts.push({
        base: window._escalaBase, mes: window._escalaMes, matricula: c.matricula, dia, status: 'F', origem: 'auto',
        updated_at: new Date(), updated_by: currentUserProfile?.id || currentUser?.id || null,
      });
      window._escalaDias.set(key, inserts[inserts.length-1]);
      faltam--;
    }
  }

  if (!inserts.length) { escalaMsg('Ninguém precisava de mais folgas — todo mundo já está na meta do mês.'); return; }

  const { error } = await db.from('escala_dia').upsert(inserts, { onConflict: 'base,mes,matricula,dia' });
  if (error) { escalaMsg('Erro ao gerar: ' + error.message, true); return; }
  escalaGradeAtualiza();
  escalaMsg(`✓ ${inserts.length} folga(s) geradas nos dias de menor demanda de voos (meta por CH: ${[...metasUsadas].sort((a,b)=>a-b).join('/')} folgas/mês).`);
}

function escalaMsg(texto, erro) {
  const el = document.getElementById('escala-status-msg');
  if (el) el.innerHTML = `<span style="color:${erro?'#fc8181':'#5fa87a'}">${texto}</span>`;
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
