// ══════════════════════════════════════════════════════
// HEADCOUNT — visão de quadro de pessoal
// Cruza Colaboradores (HRCL204) + Férias (HRCL107) +
// Desligamentos (HRCL106) + PCD (HRCL114)
// ══════════════════════════════════════════════════════

const HC_EXCLUDE_BASES = new Set(['HQ2', 'SEDE', 'GSE']); // mesma exclusão da Aderência

// Agrupa cargos em categorias amplas (mesma ideia da Aderência, mas com os
// nomes de grupo do modelo de referência).
function hcCargoGrupo(funcao) {
  const f = String(funcao || '').toUpperCase();
  if (!f) return 'OTHERS';
  if (f.includes('RAMPA'))                                 return 'RAMP';
  if (f.includes('LIMPEZA'))                                return 'CLEANING';
  if (f.includes('MECANIC') || f.includes('ELETRIC') || f.includes('GSE')) return 'GSE';
  if (f.includes('PASSAGEIRO'))                             return 'PAX';
  if (f.includes('SUPERVISOR'))                             return 'SUPERVISION';
  if (f.includes('SEGURAN'))                                return 'SECURITY';
  if (f.includes('GERENTE') || f.includes('COORDENADOR') || f.includes('LIDER')) return 'LEADERSHIP';
  if (f.includes('OPERADOR'))                                return 'OPERATOR';
  return 'OTHERS';
}

function hcIsDesligado(mat) {
  return !!window.eoDesligados?.get(mat);
}

function hcIsFeriasAtiva(mat) {
  const f = window.eoFerias?.get(mat);
  if (!f || !f.data_inicio) return false;
  const hoje = new Date().toISOString().slice(0,10);
  const fim = f.data_fim || '9999-12-31';
  return f.data_inicio <= hoje && hoje <= fim;
}

function hcIsAtestado(situacao) {
  const s = String(situacao || '').toLowerCase();
  return s.includes('auxílio') || s.includes('auxilio') || s.includes('atestado');
}

// Confirmado com o cliente: essas 4 situações saem de Headcount/Ativos/FTE —
// contrato sem capacidade de trabalho no momento, mesmo ainda no cadastro.
// Férias e Atestado Médico (curto) continuam contando normalmente.
function hcIsAfastado(situacao) {
  const s = String(situacao || '').toLowerCase();
  return ((s.includes('auxílio') || s.includes('auxilio')) && s.includes('doen')) ||
         s.includes('aposentadoria') ||
         s.includes('invalidez') ||
         s.includes('acidente') ||
         s.includes('suspenso');
}

// Carga horária mensal → "equivalente diário" (180h/mês ≈ 6h/dia), usado só
// para rotular a tabela de Função × Carga, igual o modelo de referência.
function hcChDiario(ch) {
  if (!ch) return null;
  return Math.max(1, Math.round(ch / 30));
}

function hcAllBases() {
  const set = new Set();
  if (window.eoColabs) {
    for (const [, r] of window.eoColabs) {
      const st = (r.station || '').toUpperCase();
      if (st && !HC_EXCLUDE_BASES.has(st)) set.add(st);
    }
  }
  return [...set].sort();
}

// Garante que os 4 datasets estejam carregados (roster, férias, desligados, pcd)
async function hcEnsureData() {
  if (typeof adhEnsureRoster === 'function') await adhEnsureRoster();
  if (!window.eoFerias) {
    try {
      const data = await dbFetchAll('colaboradores_ferias', 'matricula,nome,cargo,filial,data_inicio,data_fim,dias');
      const byMat = new Map();
      for (const r of (data||[])) {
        const prev = byMat.get(r.matricula);
        if (!prev || (r.data_fim||'') > (prev.data_fim||'')) byMat.set(r.matricula, r);
      }
      window.eoFerias = byMat;
      window.eoFeriasAll = data || []; // histórico completo, pra filtro por período (igual desligados)
    } catch(e) { console.warn('[headcount] ferias:', e.message); window.eoFerias = new Map(); window.eoFeriasAll = []; }
  }
  if (!window.eoDesligadosAll) {
    try {
      const data = await dbFetchAll('colaboradores_desligados', 'matricula,filial,nome,cargo,ch,data_admissao,data_demissao,causa_texto');
      const byMat = new Map();
      for (const r of (data||[])) {
        const prev = byMat.get(r.matricula);
        if (!prev || (r.data_demissao||'') > (prev.data_demissao||'')) byMat.set(r.matricula, r);
      }
      window.eoDesligados = byMat;
      window.eoDesligadosAll = data || []; // histórico completo (pode ter + de um desligamento por matrícula)
    } catch(e) { console.warn('[headcount] desligados:', e.message); window.eoDesligados = window.eoDesligados || new Map(); window.eoDesligadosAll = []; }
  }
  if (!window.eoPcd) {
    try {
      const data = await dbFetchAll('colaboradores_pcd', 'matricula,nome,cargo,deficiencia,base');
      window.eoPcd = new Map((data||[]).map(r => [r.matricula, r]));
    } catch(e) { console.warn('[headcount] pcd:', e.message); window.eoPcd = new Map(); }
  }
}

// ── Cálculo principal ──────────────────────────────────
function hcComputeStats(base) {
  const roster = [];
  if (window.eoColabs) {
    for (const [mat, r] of window.eoColabs) {
      const st = (r.station || '').toUpperCase();
      if (HC_EXCLUDE_BASES.has(st)) continue;
      if (base && st !== base.toUpperCase()) continue;
      roster.push({ mat, ...r });
    }
  }

  const totalCadastro = roster.length;
  let inativos = 0, afastados = 0, pcd = 0, atestados = 0, feriasAtivas = 0;
  let fullTime = 0, partTime = 0, somaCh = 0;

  const grupos = new Map(); // grupo -> { staff, ferias }
  const funcoes = new Map(); // funcao -> Map(chDiario -> count)
  const chSet = new Set();
  const situacoes = new Map(); // situação (texto) -> contagem (todo mundo do cadastro, inclusive afastados)

  for (const r of roster) {
    const desligado = hcIsDesligado(r.mat);
    if (desligado) { inativos++; continue; } // não conta pro resto (só ativos abaixo)

    if (window.eoPcd?.has(r.mat)) pcd++;
    if (hcIsAtestado(r.situacao)) atestados++;
    const emFerias = hcIsFeriasAtiva(r.mat);
    if (emFerias) feriasAtivas++;

    const situ = String(r.situacao || 'Sem informação').trim() || 'Sem informação';
    situacoes.set(situ, (situacoes.get(situ) || 0) + 1);

    // Afastados de verdade (Auxílio Doença, Aposentadoria por Invalidez, Acidente
    // de Trabalho, Contrato Suspenso) — contam no cadastro, aparecem na lista e no
    // gráfico de Situação acima, mas ficam fora de Headcount/Ativos/FTE/Grupo,
    // igual o Headcount Capacity de referência (contrato sem capacidade de trabalho
    // no momento). Férias continua contando normalmente — é temporário.
    if (hcIsAfastado(r.situacao)) { afastados++; continue; }

    const ch = r.ch || 0;
    somaCh += ch;
    if (ch >= 180) fullTime++; else partTime++;

    const grupo = hcCargoGrupo(r.funcao);
    if (!grupos.has(grupo)) grupos.set(grupo, { staff: 0, ferias: 0 });
    const g = grupos.get(grupo);
    g.staff++;
    if (emFerias) g.ferias++;

    const funcao = String(r.funcao || 'SEM FUNÇÃO').trim();
    const chd = hcChDiario(ch);
    if (chd) chSet.add(chd);
    if (!funcoes.has(funcao)) funcoes.set(funcao, new Map());
    const fm = funcoes.get(funcao);
    fm.set(chd, (fm.get(chd)||0) + 1);
  }

  const ativos = totalCadastro - inativos - afastados;
  const headcount = ativos; // "Headcount" = força de trabalho efetiva, igual o Capacity de referência

  // Desligados nos últimos 12 meses (olha o histórico completo, não só
  // quem ainda aparece no cadastro — a maioria já nem está mais lá)
  const hoje = new Date();
  const ha12m = new Date(hoje.getFullYear(), hoje.getMonth()-12, hoje.getDate());
  let desligados12m = 0;
  for (const r of (window.eoDesligadosAll || [])) {
    if (base && (r.filial||'').toUpperCase() !== base.toUpperCase()) continue;
    if (!r.data_demissao) continue;
    const d = new Date(r.data_demissao);
    if (d >= ha12m && d <= hoje) desligados12m++;
  }

  // Admissões nos últimos 12 meses — vem do próprio cadastro (campo admissao)
  let admissoes12m = 0;
  if (window.eoColabs) {
    for (const [, r] of window.eoColabs) {
      if (base && (r.station||'').toUpperCase() !== base.toUpperCase()) continue;
      if (!r.admissao) continue;
      const d = new Date(r.admissao);
      if (d >= ha12m && d <= hoje) admissoes12m++;
    }
  }

  // Férias programadas (início) nos últimos 12 meses — histórico completo,
  // igual desligados (não só a última férias por matrícula)
  let feriasProgramadas12m = 0;
  for (const r of (window.eoFeriasAll || [])) {
    if (base && (r.filial||'').toUpperCase() !== base.toUpperCase()) continue;
    if (!r.data_inicio) continue;
    const d = new Date(r.data_inicio);
    if (d >= ha12m && d <= hoje) feriasProgramadas12m++;
  }

  const fte = somaCh > 0 ? Math.round(somaCh / 180 * 10) / 10 : 0; // 1 FTE = 180h (confirmado com o cliente)
  const ftPct = (fullTime+partTime) > 0 ? Math.round(fullTime/(fullTime+partTime)*1000)/10 : 0;

  // Meta = 10% do staff de cada grupo (rotatividade mensal de férias) — MAS
  // não em julho e dezembro, que são meses de alta temporada onde essa meta
  // não vale (confirmado com o cliente). Nesses dois meses, meta = 0.
  const mesAtual = new Date().getMonth(); // 0=jan ... 6=jul, 11=dez
  const altaTemporada = mesAtual === 6 || mesAtual === 11;
  for (const [, g] of grupos) {
    g.meta = altaTemporada ? 0 : Math.round(g.staff * 0.10);
    g.delta = g.ferias - g.meta;
  }

  return {
    headcount, ativos, inativos, afastados, totalCadastro, pcd, atestados, feriasAtivas, desligados12m, admissoes12m, feriasProgramadas12m,
    fullTime, partTime, ftPct, fte, grupos, funcoes, chList: [...chSet].sort((a,b)=>a-b),
    situacoes, altaTemporada,
  };
}

// ══════════════════════════════════════════════════════
// ENTRY POINT
// ══════════════════════════════════════════════════════
async function pageHeadcount(el) {
  window._hcCurrentEl = el;
  const role = currentUserProfile?.role;
  const ROLES_OK = ['admin','gerente','coordenador','supervisor','lideranca'];
  if (!ROLES_OK.includes(role)) {
    el.innerHTML = `
      <div class="page-header"><div>
        <h1 class="page-title">Staff</h1>
        <p class="page-sub">Acesso restrito</p>
      </div></div>
      <div class="adh-denied">
        <i class="ti ti-lock" style="font-size:36px;opacity:.2" aria-hidden="true"></i>
        <p>Seu perfil não tem acesso a este módulo.</p>
      </div>`;
    return;
  }

  el.innerHTML = `
    <div class="adm-progress-wrap" id="hc-load-progress">
      <i class="ti ti-loader-2" style="font-size:26px;opacity:.5;animation:spin 1s linear infinite" aria-hidden="true"></i>
      <div class="adm-progress-label">Carregando dados de headcount...</div>
    </div>`;

  await hcEnsureData();

  const bases = currentUserProfile?.bases || [];
  if (!window._hcBase) {
    window._hcBase = (role === 'admin') ? null : (bases[0] || null); // '*' não dá mais acesso a todas as bases pra quem não é admin
  }
  if (!window._hcSituFilter) window._hcSituFilter = 'todos';
  if (!window._hcSearch) window._hcSearch = '';

  hcRenderMain(el);
}

async function hcForceRefresh() {
  window.eoColabs = null; window.eoFerias = null; window.eoFeriasAll = null; window.eoDesligados = null; window.eoDesligadosAll = null; window.eoPcd = null;
  const el = window._hcCurrentEl;
  if (el) await pageHeadcount(el);
}

function hcChangeBase(base) {
  const role    = currentUserProfile?.role;
  const myBases = currentUserProfile?.bases || [];
  const isAdmin = role === 'admin'; // '*' não dá mais acesso a todas as bases pra quem não é admin
  if (!isAdmin && base && !myBases.includes(base)) return; // ignora troca pra base não autorizada
  window._hcBase = base || null;
  window._hcGrupoFilter = null;
  window._hcSituFilter = 'todos';
  window._hcSearch = '';
  hcRenderMain(window._hcCurrentEl);
}

function hcFilterSitu(mode, btn) {
  document.querySelectorAll('.hc-situ-filter-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  window._hcSituFilter = mode;
  hcRerenderColabTable();
}

function hcFilterGrupo(nome) {
  window._hcGrupoFilter = (window._hcGrupoFilter === nome) ? null : nome;
  const panel = document.getElementById('hc-grupo-panel');
  if (panel) panel.innerHTML = hcGrupoTableHTML();
  hcRerenderColabTable();
}

function hcGrupoTableHTML() {
  const stats = window._hcStats;
  if (!stats) return '';
  const gruposOrdenados = [...stats.grupos.entries()].sort((a,b) => b[1].staff - a[1].staff);
  const totalStaff  = gruposOrdenados.reduce((s,[,g])=>s+g.staff,0);
  const totalFerias = gruposOrdenados.reduce((s,[,g])=>s+g.ferias,0);
  const totalMeta   = gruposOrdenados.reduce((s,[,g])=>s+g.meta,0);
  const totalDelta  = totalFerias - totalMeta;
  const ativo = window._hcGrupoFilter || null;
  const metaLabel = stats.altaTemporada ? 'Meta suspensa (alta temporada)' : 'Meta = 10% do staff (rotatividade mensal de férias)';

  return `
    <div class="hc-panel-title" style="display:flex;align-items:center;justify-content:space-between">
      <span>Grupo</span>
      ${ativo ? `<button class="hc-grupo-clear" onclick="hcFilterGrupo(null)"><i class="ti ti-x" aria-hidden="true"></i> ${ativo}</button>` : ''}
    </div>
    <table class="hc-table">
      <thead><tr><th>Grupo</th><th class="r">Staff</th><th class="r">Férias</th><th class="r">Meta</th><th class="r">Delta</th></tr></thead>
      <tbody>
        ${gruposOrdenados.map(([nome,g]) => `
          <tr class="hc-grupo-row ${ativo===nome?'active':''}" onclick="hcFilterGrupo('${nome}')" title="Clique para filtrar a lista por ${nome}">
            <td>${nome}</td>
            <td class="r">${g.staff}</td>
            <td class="r">${g.ferias}</td>
            <td class="r" style="color:var(--text-muted)">${g.meta}</td>
            <td class="r" style="color:${g.delta<0?'#fc8181':g.delta>0?'#72c02c':'var(--text-muted)'}">${g.delta>0?'+':''}${g.delta}</td>
          </tr>`).join('')}
      </tbody>
      <tfoot><tr>
        <td>TOTAL</td><td class="r">${totalStaff}</td><td class="r">${totalFerias}</td>
        <td class="r">${totalMeta}</td>
        <td class="r" style="color:${totalDelta<0?'#fc8181':totalDelta>0?'#72c02c':'var(--text-muted)'}">${totalDelta>0?'+':''}${totalDelta}</td>
      </tr></tfoot>
    </table>
    <div style="font-size:9px;color:var(--text-muted);margin-top:8px">${metaLabel} · Delta = Férias − Meta${stats.altaTemporada ? ' · Julho e dezembro não entram na meta de 10%' : ''}</div>
  `;
}

function hcSearch(value) {
  window._hcSearch = value;
  hcRerenderColabTable();
}

// ── Main dashboard ─────────────────────────────────────
function hcRenderMain(el) {
  const base = window._hcBase;
  const stats = hcComputeStats(base);
  window._hcStats = stats;
  window._hcColabListFull = hcBuildColabList(base);

  const role     = currentUserProfile?.role;
  const myBases  = currentUserProfile?.bases || [];
  const isAdmin = role === 'admin'; // '*' não dá mais acesso a todas as bases pra quem não é admin
  const bases    = isAdmin ? hcAllBases() : hcAllBases().filter(b => myBases.includes(b));

  const ftDeg = stats.ftPct * 3.6;

  const baseControlHTML = isAdmin
    ? `<select class="adh-month-select" onchange="hcChangeBase(this.value||null)">
         <option value="">Todas as bases</option>
         ${bases.map(b => `<option value="${b}" ${b===base?'selected':''}>${b}</option>`).join('')}
       </select>`
    : bases.length > 1
      ? `<select class="adh-month-select" onchange="hcChangeBase(this.value)">
           ${bases.map(b => `<option value="${b}" ${b===base?'selected':''}>${b}</option>`).join('')}
         </select>`
      : `<span class="adm-base-tag" style="font-size:12.5px;padding:7px 14px">${bases[0] || 'Sem base atribuída'}</span>`;

  el.innerHTML = `
    <div class="hc-wrap">
      <div class="hc-header">
        <div>
          <h1 class="page-title">Staff</h1>
          <p class="page-sub">Quadro de pessoal · cruza Colaboradores, Férias, Desligamentos e PCD</p>
          ${lastUpdateBadgeHTML()}
        </div>
        <div style="display:flex;align-items:center;gap:10px">
          ${baseControlHTML}
          <button class="adh-refresh-btn" onclick="hcForceRefresh()">
            <i class="ti ti-refresh" aria-hidden="true"></i> Atualizar
          </button>
        </div>
      </div>

      ${adhKpiCardsHTML([
        { key:'blue', icon:'ti-users', title:'Quadro', rows: [
          { label:'Staff', sub:'headcount ativo · sem afastados', value: stats.headcount.toLocaleString('pt-BR') },
          { label:'Ativos', sub:'trabalhando hoje', value: stats.ativos.toLocaleString('pt-BR') },
        ]},
        { key:'amber', icon:'ti-report-medical', title:'Situação', rows: [
          { label:'Atestados', sub:'auxílio doença + atestado médico', value: stats.atestados.toLocaleString('pt-BR') },
          { label:'Afastados', sub:'aux. doença, invalidez, acidente, susp. · fora do headcount', value: stats.afastados.toLocaleString('pt-BR') },
          { label:'Inativos', sub:'no cadastro, já desligados', value: stats.inativos.toLocaleString('pt-BR') },
          { label:'PCD', sub:'pessoas com deficiência', value: stats.pcd.toLocaleString('pt-BR') },
        ]},
        { key:'red', icon:'ti-beach', title:'Férias', rows: [
          { label:'Ativas agora', sub:'colaboradores de férias hoje', value: stats.feriasAtivas.toLocaleString('pt-BR') },
          { label:'Programadas', sub:'últimos 12 meses · clique para ver a lista', value: (stats.feriasProgramadas12m||0).toLocaleString('pt-BR'), color:'#b56666', onclick:'hcOpenFerias()' },
        ]},
        { key:'purple', icon:'ti-transfer', title:'Movimentação', rows: [
          { label:'Admissões', sub:'últimos 12 meses · clique para ver a lista', value: stats.admissoes12m.toLocaleString('pt-BR'), color:'#5fa87a', onclick:'hcOpenAdmissoes()' },
          { label:'Desligados', sub:'últimos 12 meses · clique para ver a lista', value: stats.desligados12m.toLocaleString('pt-BR'), color:'#b56666', onclick:'hcOpenDesligados()' },
          { label:'Relatório completo', sub:'admissões + desligados juntos, com gráfico e exportar Excel', value: '', onclick:'hcOpenMovimentacao()' },
        ]},
      ], true)}

      <div class="hc-main-layout">

        <div class="hc-left-col">
          <div class="hc-panel">
            <div style="display:flex;align-items:center;gap:16px">
              <div class="hc-donut" style="background:conic-gradient(#00a0d2 0deg ${ftDeg}deg, #72c02c ${ftDeg}deg 360deg)">
                <div class="hc-donut-hole">
                  <div class="hc-donut-v">${stats.fte}</div>
                  <div class="hc-donut-l">FTE</div>
                </div>
              </div>
              <div style="font-size:11px">
                <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px"><span class="adh-leg-dot" style="background:#00a0d2"></span>Full Time — ${stats.ftPct}%</div>
                <div style="display:flex;align-items:center;gap:6px"><span class="adh-leg-dot" style="background:#72c02c"></span>Part Time — ${(100-stats.ftPct).toFixed(1)}%</div>
              </div>
            </div>
          </div>

          <div class="hc-panel" id="hc-grupo-panel">
            ${hcGrupoTableHTML()}
          </div>

          <div class="hc-panel">
            <div class="hc-panel-title">Situação</div>
            ${(() => {
              const situOrdenadas = [...stats.situacoes.entries()].sort((a,b) => b[1]-a[1]);
              const totalSitu = situOrdenadas.reduce((s,[,n])=>s+n,0) || 1;
              const corSitu = (nome) => {
                const n = nome.toLowerCase();
                if (n === 'trabalhando') return '#72c02c';
                if (n.includes('férias')) return '#38bdf8';
                if (n.includes('auxílio') || n.includes('auxilio') || n.includes('atestado')) return '#f59e0b';
                return '#8896aa';
              };
              return situOrdenadas.map(([nome,n]) => {
                const pct = Math.round(n/totalSitu*1000)/10;
                return `
                  <div style="margin-bottom:8px">
                    <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:3px">
                      <span>${nome}</span>
                      <span style="font-weight:700">${n} <span style="color:var(--text-muted);font-weight:400">(${pct}%)</span></span>
                    </div>
                    <div class="adh-full-card-bar"><div style="width:${pct}%;background:${corSitu(nome)};height:100%;border-radius:2px"></div></div>
                  </div>`;
              }).join('');
            })()}
          </div>
        </div>

        <div class="hc-right-col">
          <div class="hc-panel" style="height:100%">
            <div class="adh-search-wrap" style="margin-bottom:12px">
              <i class="ti ti-search" aria-hidden="true"></i>
              <input type="text" id="hc-search-input" placeholder="Buscar por nome ou matrícula..." oninput="hcSearch(this.value)">
            </div>
            <div class="adh-colab-header-row">
              <span id="hc-colab-count" style="font-size:10px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--text-muted)">
                ${window._hcColabListFull.length} colaboradores
              </span>
              <div class="adh-sort-btns">
                <button class="adh-sort-btn hc-situ-filter-btn active" onclick="hcFilterSitu('todos',this)">Todos</button>
                <button class="adh-sort-btn hc-situ-filter-btn" onclick="hcFilterSitu('ativo',this)">Ativos</button>
                <button class="adh-sort-btn hc-situ-filter-btn" onclick="hcFilterSitu('inativo',this)">Inativos</button>
                <button class="adh-sort-btn hc-situ-filter-btn" onclick="hcFilterSitu('ferias',this)">Férias</button>
              </div>
            </div>
            <div class="adh-colab-table-wrap" style="max-height:calc(100vh - 360px);min-height:320px;overflow-y:auto">
              <table class="adh-colab-table" id="hc-colab-table">
                <thead>
                  <tr>
                    <th>Matrícula</th><th>Filial</th><th>Nome</th><th>Função</th>
                    <th class="r">CH</th><th>Situação</th><th>Admissão</th><th>Observação</th>
                  </tr>
                </thead>
                <tbody id="hc-colab-tbody">${hcRenderColabRows(window._hcColabListFull)}</tbody>
              </table>
            </div>
          </div>
        </div>

      </div>

    </div>`;
}

// Build the base colaborador list (roster only, cross-referenced)
function hcBuildColabList(base) {
  const out = [];
  if (!window.eoColabs) return out;
  for (const [mat, r] of window.eoColabs) {
    const st = (r.station || '').toUpperCase();
    if (HC_EXCLUDE_BASES.has(st)) continue;
    if (base && st !== base.toUpperCase()) continue;
    const desligado = hcIsDesligado(mat);
    const desligInfo = window.eoDesligados?.get(mat);
    const feriasInfo = window.eoFerias?.get(mat);
    const emFerias = hcIsFeriasAtiva(mat);
    const afastado = !desligado && hcIsAfastado(r.situacao);
    out.push({
      mat, nome: r.nome, filial: st, funcao: r.funcao, ch: r.ch,
      situacao: r.situacao, admissao: r.admissao || null,
      desligado, demissao: desligInfo?.data_demissao || null,
      afastado,
      emFerias, feriasFim: feriasInfo?.data_fim || null,
      pcd: !!window.eoPcd?.get(mat),
    });
  }
  return out.sort((a,b) => (a.nome||'').localeCompare(b.nome||''));
}

function hcFmtISODate(iso) {
  if (!iso) return null;
  const s = String(iso).split('T')[0];
  const [y,m,d] = s.split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

function hcMesAbrev(mesStr) {
  const [ano, mes] = String(mesStr).split('-');
  const nomes = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  return `${nomes[parseInt(mes,10)-1]||'?'}/${(ano||'').slice(2)}`;
}

// Gráfico de barras por mês, com o mês/período do filtro atual destacado —
// mostra todos os meses que existirem de dado (não fixo em 12).
function hcExemploChartHTML(allRows, dataField, periodoAtual, cor) {
  const hoje = new Date();
  let de = null, ate = null;

  if (periodoAtual === '12m') {
    de = new Date(hoje.getFullYear(), hoje.getMonth()-11, 1);
    ate = hoje;
  } else if (periodoAtual !== 'todos' && periodoAtual !== 'custom') {
    // mês específico selecionado — mostra uns meses de contexto ao redor
    const [ano, mesN] = periodoAtual.split('-').map(Number);
    de = new Date(ano, mesN-1-4, 1);
    ate = new Date(ano, mesN-1+4, 1);
  }
  // 'todos' e 'custom' ficam sem limite — é exatamente o que o usuário pediu

  const porMes = new Map();
  allRows.forEach(r => {
    const mes = String(r[dataField]||'').slice(0,7);
    if (!mes || mes.length !== 7) return;
    if (de || ate) {
      const d = new Date(mes+'-01');
      if (de && d < de) return;
      if (ate && d > ate) return;
    }
    porMes.set(mes, (porMes.get(mes)||0)+1);
  });
  const meses = [...porMes.keys()].sort();
  if (!meses.length) return '';
  const max = Math.max(1, ...meses.map(m=>porMes.get(m)));
  const ha12m = new Date(hoje.getFullYear(), hoje.getMonth()-12, hoje.getDate());

  return `
    <div class="hc-panel" style="margin-bottom:16px">
      <div style="display:flex;align-items:flex-end;gap:6px;height:80px">
        ${meses.map(m => {
          const v = porMes.get(m);
          let destacado;
          if (periodoAtual === '12m') { destacado = new Date(m+'-01') >= ha12m; }
          else if (periodoAtual === 'todos' || periodoAtual === 'custom') { destacado = true; }
          else { destacado = m === periodoAtual; }
          return `<div style="flex:1;display:flex;flex-direction:column;justify-content:flex-end;height:100%;align-items:center" title="${hcMesAbrev(m)}: ${v}">
            <div style="font-size:10px;color:${destacado?'var(--text-primary)':'var(--text-secondary)'};font-weight:600;margin-bottom:2px">${v}</div>
            <div style="width:100%;height:${Math.round(v/max*54)}px;background:${destacado?cor:'rgba(255,255,255,.1)'};border-radius:3px 3px 0 0"></div>
          </div>`;
        }).join('')}
      </div>
      <div style="display:flex;gap:6px;margin-top:4px">
        ${meses.map(m => `<div style="flex:1;text-align:center;font-size:10px;color:var(--text-secondary)">${hcMesAbrev(m)}</div>`).join('')}
      </div>
    </div>`;
}

// Exporta uma lista de linhas pra Excel — usa o SheetJS (já carregado no
// projeto pra ler os arquivos de upload, reaproveitado aqui pra escrever).
function hcExportarExcel(rows, colunas, nomeArquivo) {
  if (typeof XLSX === 'undefined') { alert('Biblioteca de Excel não carregada.'); return; }
  const dados = rows.map(r => {
    const obj = {};
    colunas.forEach(c => { obj[c.header] = c.fmt ? c.fmt(r[c.field]) : (r[c.field] ?? ''); });
    return obj;
  });
  const ws = XLSX.utils.json_to_sheet(dados);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Dados');
  XLSX.writeFile(wb, nomeArquivo);
}

function hcRenderColabRows(list) {
  return list.map(c => {
    const situClass = c.desligado ? 'adh-situ-desligado' : c.emFerias ? 'adh-situ-ferias' : hcIsAtestado(c.situacao) ? 'adh-situ-afastado' : (String(c.situacao||'').trim().toLowerCase()==='trabalhando' ? 'adh-situ-ativo' : 'adh-situ-afastado');
    const situTxt = c.desligado ? 'Desligado' : (c.situacao || '—');
    const obs = c.desligado ? hcFmtISODate(c.demissao) : (c.emFerias ? `Férias até ${hcFmtISODate(c.feriasFim)}` : '');
    const pcdBadge = c.pcd ? `<i class="ti ti-wheelchair" style="color:#a78bfa;font-size:12px;margin-left:5px" title="PCD" aria-hidden="true"></i>` : '';
    return `<tr class="adh-colab-row">
      <td style="font-family:monospace">${c.mat}</td>
      <td>${c.filial}</td>
      <td style="font-weight:500">${c.nome||''}${pcdBadge}</td>
      <td>${c.funcao||''}</td>
      <td class="r">${c.ch?c.ch+'h':'—'}</td>
      <td><span class="adh-situ-badge ${situClass}">${situTxt}</span></td>
      <td>${hcFmtISODate(c.admissao)||'—'}</td>
      <td>${obs||'—'}</td>
    </tr>`;
  }).join('');
}

function hcRerenderColabTable() {
  let list = (window._hcColabListFull || []).slice();
  if (window._hcSituFilter === 'ativo')   list = list.filter(c => !c.desligado && !c.afastado);
  if (window._hcSituFilter === 'inativo') list = list.filter(c => c.desligado || c.afastado);
  if (window._hcSituFilter === 'ferias')  list = list.filter(c => c.emFerias);
  if (window._hcGrupoFilter) list = list.filter(c => hcCargoGrupo(c.funcao) === window._hcGrupoFilter);
  const q = (window._hcSearch||'').trim().toLowerCase();
  if (q) list = list.filter(c => String(c.mat).includes(q) || String(c.nome||'').toLowerCase().includes(q));

  const tbody = document.getElementById('hc-colab-tbody');
  if (tbody) tbody.innerHTML = hcRenderColabRows(list);
  const countEl = document.getElementById('hc-colab-count');
  const total = (window._hcColabListFull||[]).length;
  if (countEl) countEl.textContent = list.length===total ? `${total} colaboradores` : `${list.length} de ${total} colaboradores`;
}

// ── Drill-down: Desligados ─────────────────────────────
function hcOpenDesligados() {
  hcRenderDesligados(window._hcCurrentEl);
}

function hcDeslAllForBase() {
  const base = window._hcBase;
  return (window.eoDesligadosAll || []).filter(r => {
    if (base && (r.filial||'').toUpperCase() !== base.toUpperCase()) return false;
    return !!r.data_demissao;
  });
}

function hcDeslFilteredRows() {
  const period = window._hcDeslPeriod || '12m';
  const term = (window._hcDeslSearch || '').trim().toUpperCase();
  const hoje = new Date();
  const ha12m = new Date(hoje.getFullYear(), hoje.getMonth()-12, hoje.getDate());

  let rows = hcDeslAllForBase();
  if (period === '12m') {
    rows = rows.filter(r => { const d = new Date(r.data_demissao); return d >= ha12m && d <= hoje; });
  } else if (period === 'custom') {
    const from = window._hcDeslFrom ? new Date(window._hcDeslFrom) : null;
    const to   = window._hcDeslTo   ? new Date(window._hcDeslTo)   : null;
    rows = rows.filter(r => {
      const d = new Date(r.data_demissao);
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    });
  } else if (period !== 'todos') {
    rows = rows.filter(r => String(r.data_demissao).slice(0,7) === period);
  }
  if (term) {
    rows = rows.filter(r =>
      (r.nome||'').toUpperCase().includes(term) ||
      String(r.matricula||'').includes(term) ||
      (r.causa_texto||'').toUpperCase().includes(term));
  }
  return rows.sort((a,b) => (b.data_demissao||'').localeCompare(a.data_demissao||''));
}

function hcDeslPeriodLabel() {
  const period = window._hcDeslPeriod || '12m';
  if (period === '12m')   return 'Últimos 12 meses';
  if (period === 'todos') return 'Todo o período';
  if (period === 'custom') {
    const de  = window._hcDeslFrom ? hcFmtISODate(window._hcDeslFrom) : 'início';
    const ate = window._hcDeslTo   ? hcFmtISODate(window._hcDeslTo)   : 'hoje';
    return `De ${de} até ${ate}`;
  }
  return adhMonthLabel(period);
}

// "Últimos 12 meses" e "Tudo" sempre disponíveis; os meses específicos vêm
// dinamicamente de quais meses realmente têm desligamento nessa base — se o
// arquivo tiver 2024, 2025 e 2026, os três aparecem aqui sozinhos.
function hcDeslFilterPanelHTML() {
  const meses = [...new Set(hcDeslAllForBase().map(r => String(r.data_demissao).slice(0,7)))].sort().reverse();
  const period = window._hcDeslPeriod || '12m';
  const quick = [['12m','Últimos 12 meses'], ['todos','Tudo'], ...meses.map(m => [m, adhMonthLabel(m)])];
  return `
    <div class="hc-desl-filter-panel" id="hc-desl-filter-panel" style="display:none">
      <div class="hc-desl-filter-quick">
        ${quick.map(([v,label]) => `<button class="${period===v?'active':''}" onclick="hcSetDeslPeriod('${v}')">${label}</button>`).join('')}
      </div>
      <div class="hc-desl-filter-custom">
        <div class="hc-desl-filter-custom-label">Ou escolha um período personalizado</div>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <input type="date" id="hc-desl-from" class="adm-input" style="width:auto" value="${window._hcDeslFrom||''}">
          <span style="color:var(--text-muted);font-size:12px">até</span>
          <input type="date" id="hc-desl-to" class="adm-input" style="width:auto" value="${window._hcDeslTo||''}">
          <button class="adh-refresh-btn" onclick="hcApplyDeslCustomRange()">Aplicar</button>
        </div>
      </div>
    </div>`;
}

function hcToggleDeslFilter() {
  const panel = document.getElementById('hc-desl-filter-panel');
  if (!panel) return;
  panel.style.display = panel.style.display === 'block' ? 'none' : 'block';
}

function hcSetDeslPeriod(value) {
  window._hcDeslPeriod = value;
  hcRenderDesligados(window._hcCurrentEl);
}

function hcApplyDeslCustomRange() {
  window._hcDeslFrom = document.getElementById('hc-desl-from').value || null;
  window._hcDeslTo   = document.getElementById('hc-desl-to').value || null;
  window._hcDeslPeriod = 'custom';
  hcRenderDesligados(window._hcCurrentEl);
}

function hcSetDeslSearch(value) {
  window._hcDeslSearch = value;
  const body = document.getElementById('hc-desl-tbody');
  if (body) body.innerHTML = hcDeslRowsHTML();
  const countEl = document.getElementById('hc-desl-count');
  if (countEl) { const n = hcDeslFilteredRows().length; countEl.textContent = `${n.toLocaleString('pt-BR')} registro${n===1?'':'s'}`; }
}

function hcDeslRowsHTML() {
  const rows = hcDeslFilteredRows();
  if (!rows.length) {
    return `<tr><td colspan="7" style="padding:24px 10px;text-align:center;color:var(--text-muted);font-size:12px">Nenhum desligamento encontrado nesse período.</td></tr>`;
  }
  return rows.map(r => `<tr class="adh-colab-row">
    <td style="font-family:monospace">${r.matricula}</td>
    <td>${r.filial}</td>
    <td style="font-weight:500">${r.nome||''}</td>
    <td>${r.cargo||''}</td>
    <td class="r">${r.ch?r.ch+'h':'—'}</td>
    <td>${hcFmtISODate(r.data_demissao)||'—'}</td>
    <td>${r.causa_texto||'—'}</td>
  </tr>`).join('');
}

function hcRenderDesligados(el) {
  const base = window._hcBase;
  if (window._hcDeslPeriod == null) window._hcDeslPeriod = '12m';
  const rows = hcDeslFilteredRows();

  el.innerHTML = `
    <div class="hc-wrap">
      <div class="hc-header">
        <div style="display:flex;align-items:center;gap:12px">
          <button class="adh-back-btn" onclick="hcRenderMain(window._hcCurrentEl)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
            </svg>
          </button>
          <div style="position:relative">
            <h1 class="page-title">Desligamentos ${base?`<span class="adh-base-badge">${base}</span>`:''}</h1>
            <div style="display:flex;align-items:center;gap:8px;margin-top:4px">
              <button class="hc-desl-filter-trigger" onclick="hcToggleDeslFilter()">
                <i class="ti ti-filter" aria-hidden="true"></i> ${hcDeslPeriodLabel()} <i class="ti ti-chevron-down" aria-hidden="true"></i>
              </button>
              <span class="page-sub" style="margin:0"><span id="hc-desl-count">${rows.length.toLocaleString('pt-BR')} registro${rows.length===1?'':'s'}</span></span>
            </div>
            ${hcDeslFilterPanelHTML()}
          </div>
        </div>
      </div>

      ${hcExemploChartHTML(hcDeslAllForBase(), 'data_demissao', window._hcDeslPeriod, '#b56666')}

      <div class="hc-panel">
        <div style="display:flex;gap:10px;align-items:center;margin-bottom:12px;flex-wrap:wrap">
          <div class="adh-search-wrap" style="max-width:340px;margin-bottom:0">
            <i class="ti ti-search" aria-hidden="true"></i>
            <input type="text" class="adh-search-input" placeholder="Buscar por nome, matrícula ou causa..." oninput="hcSetDeslSearch(this.value)" value="${window._hcDeslSearch||''}">
          </div>
          <button class="adh-refresh-btn" style="margin-left:auto" onclick="hcExportarExcel(hcDeslFilteredRows(), [
            {header:'Matrícula',field:'matricula'},{header:'Filial',field:'filial'},{header:'Nome',field:'nome'},
            {header:'Cargo',field:'cargo'},{header:'CH',field:'ch'},{header:'Demissão',field:'data_demissao',fmt:hcFmtISODate},{header:'Causa',field:'causa_texto'}
          ], 'desligamentos.xlsx')"><i class="ti ti-download" aria-hidden="true"></i> Exportar Excel</button>
        </div>
        <div class="adh-colab-table-wrap">
          <table class="adh-colab-table">
            <thead><tr>
              <th>Matrícula</th><th>Filial</th><th>Nome</th><th>Cargo</th>
              <th class="r">CH</th><th>Demissão</th><th>Causa</th>
            </tr></thead>
            <tbody id="hc-desl-tbody">${hcDeslRowsHTML()}</tbody>
          </table>
        </div>
      </div>
    </div>`;
}

document.addEventListener('click', (e) => {
  if (!e.target.closest('.hc-desl-filter-panel') && !e.target.closest('.hc-desl-filter-trigger')) {
    const panel = document.getElementById('hc-desl-filter-panel');
    if (panel) panel.style.display = 'none';
  }
});

// ══════════════════════════════════════════════════════
// FÉRIAS — mesmo padrão de Desligados (filtro por período, busca, range)
// ══════════════════════════════════════════════════════
function hcOpenFerias() {
  hcRenderFerias(window._hcCurrentEl);
}

function hcFeriasAllForBase() {
  const base = window._hcBase;
  return (window.eoFeriasAll || []).filter(r => {
    if (base && (r.filial||'').toUpperCase() !== base.toUpperCase()) return false;
    return !!r.data_inicio;
  });
}

function hcFeriasFilteredRows() {
  const period = window._hcFeriasPeriod || '12m';
  const term = (window._hcFeriasSearch || '').trim().toUpperCase();
  const hoje = new Date();
  const ha12m = new Date(hoje.getFullYear(), hoje.getMonth()-12, hoje.getDate());

  let rows = hcFeriasAllForBase();
  if (period === '12m') {
    rows = rows.filter(r => { const d = new Date(r.data_inicio); return d >= ha12m && d <= hoje; });
  } else if (period === 'custom') {
    const from = window._hcFeriasFrom ? new Date(window._hcFeriasFrom) : null;
    const to   = window._hcFeriasTo   ? new Date(window._hcFeriasTo)   : null;
    rows = rows.filter(r => {
      const d = new Date(r.data_inicio);
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    });
  } else if (period !== 'todos') {
    rows = rows.filter(r => String(r.data_inicio).slice(0,7) === period);
  }
  if (term) {
    rows = rows.filter(r =>
      (r.nome||'').toUpperCase().includes(term) ||
      String(r.matricula||'').includes(term) ||
      (r.cargo||'').toUpperCase().includes(term));
  }
  return rows.sort((a,b) => (b.data_inicio||'').localeCompare(a.data_inicio||''));
}

function hcFeriasPeriodLabel() {
  const period = window._hcFeriasPeriod || '12m';
  if (period === '12m')   return 'Últimos 12 meses';
  if (period === 'todos') return 'Todo o período';
  if (period === 'custom') {
    const de  = window._hcFeriasFrom ? hcFmtISODate(window._hcFeriasFrom) : 'início';
    const ate = window._hcFeriasTo   ? hcFmtISODate(window._hcFeriasTo)   : 'hoje';
    return `De ${de} até ${ate}`;
  }
  return adhMonthLabel(period);
}

function hcFeriasFilterPanelHTML() {
  const meses = [...new Set(hcFeriasAllForBase().map(r => String(r.data_inicio).slice(0,7)))].sort().reverse();
  const period = window._hcFeriasPeriod || '12m';
  const quick = [['12m','Últimos 12 meses'], ['todos','Tudo'], ...meses.map(m => [m, adhMonthLabel(m)])];
  return `
    <div class="hc-desl-filter-panel" id="hc-ferias-filter-panel" style="display:none">
      <div class="hc-desl-filter-quick">
        ${quick.map(([v,label]) => `<button class="${period===v?'active':''}" onclick="hcSetFeriasPeriod('${v}')">${label}</button>`).join('')}
      </div>
      <div class="hc-desl-filter-custom">
        <div class="hc-desl-filter-custom-label">Ou escolha um período personalizado</div>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <input type="date" id="hc-ferias-from" class="adm-input" style="width:auto" value="${window._hcFeriasFrom||''}">
          <span style="color:var(--text-muted);font-size:12px">até</span>
          <input type="date" id="hc-ferias-to" class="adm-input" style="width:auto" value="${window._hcFeriasTo||''}">
          <button class="adh-refresh-btn" onclick="hcApplyFeriasCustomRange()">Aplicar</button>
        </div>
      </div>
    </div>`;
}

function hcToggleFeriasFilter() {
  const panel = document.getElementById('hc-ferias-filter-panel');
  if (!panel) return;
  panel.style.display = panel.style.display === 'block' ? 'none' : 'block';
}

function hcSetFeriasPeriod(value) {
  window._hcFeriasPeriod = value;
  hcRenderFerias(window._hcCurrentEl);
}

function hcApplyFeriasCustomRange() {
  window._hcFeriasFrom = document.getElementById('hc-ferias-from').value || null;
  window._hcFeriasTo   = document.getElementById('hc-ferias-to').value || null;
  window._hcFeriasPeriod = 'custom';
  hcRenderFerias(window._hcCurrentEl);
}

function hcSetFeriasSearch(value) {
  window._hcFeriasSearch = value;
  const body = document.getElementById('hc-ferias-tbody');
  if (body) body.innerHTML = hcFeriasRowsHTML();
  const countEl = document.getElementById('hc-ferias-count');
  if (countEl) { const n = hcFeriasFilteredRows().length; countEl.textContent = `${n.toLocaleString('pt-BR')} registro${n===1?'':'s'}`; }
}

function hcFeriasRowsHTML() {
  const rows = hcFeriasFilteredRows();
  if (!rows.length) {
    return `<tr><td colspan="7" style="padding:24px 10px;text-align:center;color:var(--text-muted);font-size:12px">Nenhuma férias encontrada nesse período.</td></tr>`;
  }
  return rows.map(r => `<tr class="adh-colab-row">
    <td style="font-family:monospace">${r.matricula}</td>
    <td>${r.filial}</td>
    <td style="font-weight:500">${r.nome||''}</td>
    <td>${r.cargo||''}</td>
    <td class="r">${r.dias?r.dias+' dias':'—'}</td>
    <td>${hcFmtISODate(r.data_inicio)||'—'}</td>
    <td>${hcFmtISODate(r.data_fim)||'—'}</td>
  </tr>`).join('');
}

function hcRenderFerias(el) {
  const base = window._hcBase;
  if (window._hcFeriasPeriod == null) window._hcFeriasPeriod = '12m';
  const rows = hcFeriasFilteredRows();

  el.innerHTML = `
    <div class="hc-wrap">
      <div class="hc-header">
        <div style="display:flex;align-items:center;gap:12px">
          <button class="adh-back-btn" onclick="hcRenderMain(window._hcCurrentEl)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
            </svg>
          </button>
          <div style="position:relative">
            <h1 class="page-title">Férias ${base?`<span class="adh-base-badge">${base}</span>`:''}</h1>
            <div style="display:flex;align-items:center;gap:8px;margin-top:4px">
              <button class="hc-desl-filter-trigger" onclick="hcToggleFeriasFilter()">
                <i class="ti ti-filter" aria-hidden="true"></i> ${hcFeriasPeriodLabel()} <i class="ti ti-chevron-down" aria-hidden="true"></i>
              </button>
              <span class="page-sub" style="margin:0"><span id="hc-ferias-count">${rows.length.toLocaleString('pt-BR')} registro${rows.length===1?'':'s'}</span></span>
            </div>
            ${hcFeriasFilterPanelHTML()}
          </div>
        </div>
      </div>

      ${hcExemploChartHTML(hcFeriasAllForBase(), 'data_inicio', window._hcFeriasPeriod, '#c9a24a')}

      <div class="hc-panel">
        <div style="display:flex;gap:10px;align-items:center;margin-bottom:12px;flex-wrap:wrap">
          <div class="adh-search-wrap" style="max-width:340px;margin-bottom:0">
            <i class="ti ti-search" aria-hidden="true"></i>
            <input type="text" class="adh-search-input" placeholder="Buscar por nome, matrícula ou cargo..." oninput="hcSetFeriasSearch(this.value)" value="${window._hcFeriasSearch||''}">
          </div>
          <button class="adh-refresh-btn" style="margin-left:auto" onclick="hcExportarExcel(hcFeriasFilteredRows(), [
            {header:'Matrícula',field:'matricula'},{header:'Filial',field:'filial'},{header:'Nome',field:'nome'},
            {header:'Cargo',field:'cargo'},{header:'Dias',field:'dias'},{header:'Início',field:'data_inicio',fmt:hcFmtISODate},{header:'Fim',field:'data_fim',fmt:hcFmtISODate}
          ], 'ferias.xlsx')"><i class="ti ti-download" aria-hidden="true"></i> Exportar Excel</button>
        </div>
        <div class="adh-colab-table-wrap">
          <table class="adh-colab-table">
            <thead><tr>
              <th>Matrícula</th><th>Filial</th><th>Nome</th><th>Cargo</th>
              <th class="r">Dias</th><th>Início</th><th>Fim</th>
            </tr></thead>
            <tbody id="hc-ferias-tbody">${hcFeriasRowsHTML()}</tbody>
          </table>
        </div>
      </div>
    </div>`;
}

document.addEventListener('click', (e) => {
  if (!e.target.closest('.hc-desl-filter-panel') && !e.target.closest('.hc-desl-filter-trigger')) {
    const panel = document.getElementById('hc-ferias-filter-panel');
    if (panel) panel.style.display = 'none';
  }
});

// ══════════════════════════════════════════════════════
// ADMISSÕES — mesmo padrão, direto do cadastro (campo admissao)
// ══════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════
// MOVIMENTAÇÃO — visão unificada de Admissões + Desligados, com gráfico
// de barras paralelas por mês (cores batendo com o card: verde admissão,
// vermelho-acobreado desligamento — mesmas cores já usadas ali).
// ══════════════════════════════════════════════════════
function hcOpenMovimentacao() {
  hcRenderMovimentacao(window._hcCurrentEl);
}

function hcMovAllForBase() {
  const admissoes = hcAdmissoesAllForBase().map(r => ({ ...r, tipo: 'Admissão', data: r.admissao }));
  const desligados = hcDeslAllForBase().map(r => ({ ...r, tipo: 'Desligamento', data: r.data_demissao }));
  return [...admissoes, ...desligados];
}

// Filtro extra só pra tabela (clique num pedaço de gráfico) — não mexe
// nos gráficos em si, só afeta a lista de colaboradores embaixo.
function hcMovTabelaFiltrada() {
  let rows = hcMovFilteredRows();
  const extra = window._hcMovFiltroExtra;
  if (extra) {
    if (extra.tipo === 'mes')   rows = rows.filter(r => String(r.data).slice(0,7) === extra.valor);
    else if (extra.tipo === 'cargo') rows = rows.filter(r => (r.cargo||'Sem cargo') === extra.valor);
    else if (extra.tipo === 'causa') rows = rows.filter(r => r.tipo === 'Desligamento' && (r.causa_texto||'Não informado') === extra.valor);
    else if (extra.tipo === 'base')  rows = rows.filter(r => (r.filial||'Sem filial') === extra.valor);
  }
  return rows;
}

function hcMovFiltrarPor(tipo, valor) {
  const atual = window._hcMovFiltroExtra;
  if (atual && atual.tipo === tipo && atual.valor === valor) {
    window._hcMovFiltroExtra = null;
  } else {
    window._hcMovFiltroExtra = { tipo, valor };
  }
  hcRenderMovimentacao(window._hcCurrentEl);
}

function hcMovLimparFiltroExtra() {
  window._hcMovFiltroExtra = null;
  hcRenderMovimentacao(window._hcCurrentEl);
}

function hcMovAtualizarTabela() {
  const body = document.getElementById('hc-mov-tbody');
  if (body) body.innerHTML = hcMovRowsHTML();
  const countEl = document.getElementById('hc-mov-count');
  if (countEl) { const n = hcMovTabelaFiltrada().length; countEl.textContent = `${n.toLocaleString('pt-BR')} registro${n===1?'':'s'}`; }
  const chipEl = document.getElementById('hc-mov-filtro-chip');
  if (chipEl) chipEl.outerHTML = hcMovFiltroChipHTML();
}

function hcMovFiltroChipHTML() {
  const extra = window._hcMovFiltroExtra;
  if (!extra) return `<span id="hc-mov-filtro-chip"></span>`;
  const label = extra.tipo === 'mes' ? adhMonthLabel(extra.valor) : extra.valor;
  return `<span id="hc-mov-filtro-chip" class="hc-grupo-clear" onclick="hcMovLimparFiltroExtra()" style="cursor:pointer"><i class="ti ti-x" aria-hidden="true"></i> Filtrado: ${label}</span>`;
}

function hcMovFilteredRows() {
  const period = window._hcMovPeriod || '12m';
  const term = (window._hcMovSearch || '').trim().toUpperCase();
  const hoje = new Date();
  const ha12m = new Date(hoje.getFullYear(), hoje.getMonth()-12, hoje.getDate());

  let rows = hcMovAllForBase();
  if (period === '12m') {
    rows = rows.filter(r => { const d = new Date(r.data); return d >= ha12m && d <= hoje; });
  } else if (period === 'custom') {
    const from = window._hcMovFrom ? new Date(window._hcMovFrom) : null;
    const to   = window._hcMovTo   ? new Date(window._hcMovTo)   : null;
    rows = rows.filter(r => {
      const d = new Date(r.data);
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    });
  } else if (period !== 'todos') {
    rows = rows.filter(r => String(r.data).slice(0,7) === period);
  }
  if (term) {
    rows = rows.filter(r =>
      (r.nome||'').toUpperCase().includes(term) ||
      String(r.matricula||'').includes(term) ||
      (r.cargo||'').toUpperCase().includes(term));
  }
  return rows.sort((a,b) => (b.data||'').localeCompare(a.data||''));
}

function hcMovPeriodLabel() {
  const period = window._hcMovPeriod || '12m';
  if (period === '12m')   return 'Últimos 12 meses';
  if (period === 'todos') return 'Todo o período';
  if (period === 'custom') {
    const de  = window._hcMovFrom ? hcFmtISODate(window._hcMovFrom) : 'início';
    const ate = window._hcMovTo   ? hcFmtISODate(window._hcMovTo)   : 'hoje';
    return `De ${de} até ${ate}`;
  }
  return adhMonthLabel(period);
}

function hcMovFilterPanelHTML() {
  const meses = [...new Set(hcMovAllForBase().map(r => String(r.data).slice(0,7)))].sort().reverse();
  const period = window._hcMovPeriod || '12m';
  const quick = [['12m','Últimos 12 meses'], ['todos','Tudo'], ...meses.map(m => [m, adhMonthLabel(m)])];
  return `
    <div class="hc-desl-filter-panel" id="hc-mov-filter-panel" style="display:none">
      <div class="hc-desl-filter-quick">
        ${quick.map(([v,label]) => `<button class="${period===v?'active':''}" onclick="hcSetMovPeriod('${v}')">${label}</button>`).join('')}
      </div>
      <div class="hc-desl-filter-custom">
        <div class="hc-desl-filter-custom-label">Ou escolha um período personalizado</div>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <input type="date" id="hc-mov-from" class="adm-input" style="width:auto" value="${window._hcMovFrom||''}">
          <span style="color:var(--text-muted);font-size:12px">até</span>
          <input type="date" id="hc-mov-to" class="adm-input" style="width:auto" value="${window._hcMovTo||''}">
          <button class="adh-refresh-btn" onclick="hcApplyMovCustomRange()">Aplicar</button>
        </div>
      </div>
    </div>`;
}

function hcToggleMovFilter() {
  const panel = document.getElementById('hc-mov-filter-panel');
  if (!panel) return;
  panel.style.display = panel.style.display === 'block' ? 'none' : 'block';
}

function hcSetMovPeriod(value) {
  window._hcMovPeriod = value;
  hcRenderMovimentacao(window._hcCurrentEl);
}

function hcApplyMovCustomRange() {
  window._hcMovFrom = document.getElementById('hc-mov-from').value || null;
  window._hcMovTo   = document.getElementById('hc-mov-to').value || null;
  window._hcMovPeriod = 'custom';
  hcRenderMovimentacao(window._hcCurrentEl);
}

function hcSetMovSearch(value) {
  window._hcMovSearch = value;
  const body = document.getElementById('hc-mov-tbody');
  if (body) body.innerHTML = hcMovRowsHTML();
  const countEl = document.getElementById('hc-mov-count');
  if (countEl) { const n = hcMovTabelaFiltrada().length; countEl.textContent = `${n.toLocaleString('pt-BR')} registro${n===1?'':'s'}`; }
}

function hcMovRowsHTML() {
  const rows = hcMovTabelaFiltrada();
  if (!rows.length) {
    return `<tr><td colspan="7" style="padding:24px 10px;text-align:center;color:var(--text-muted);font-size:12px">Nenhuma movimentação encontrada nesse filtro.</td></tr>`;
  }
  return rows.map(r => {
    const cor = r.tipo === 'Admissão' ? '#5fa87a' : '#b56666';
    return `<tr class="adh-colab-row">
      <td><span style="background:${cor}22;color:${cor};border-radius:4px;padding:2px 8px;font-size:11px;font-weight:600">${r.tipo}</span></td>
      <td style="font-family:monospace">${r.matricula}</td>
      <td>${r.filial}</td>
      <td style="font-weight:500">${r.nome||''}</td>
      <td>${r.cargo||''}</td>
      <td class="r">${r.ch?r.ch+'h':'—'}</td>
      <td>${hcFmtISODate(r.data)||'—'}</td>
    </tr>`;
  }).join('');
}

// Gráfico de barras paralelas (admissões x desligados) por mês, cobrindo
// os meses presentes no recorte filtrado no momento — se o filtro for
// "todos", mostra todos os meses que existirem de dado; se for um mês
// específico, mostra só aquele.
function hcMovChartHTML() {
  const rows = hcMovFilteredRows();
  const porMes = new Map();
  rows.forEach(r => {
    const mes = String(r.data).slice(0,7);
    if (!porMes.has(mes)) porMes.set(mes, { admissoes: 0, desligados: 0 });
    const info = porMes.get(mes);
    if (r.tipo === 'Admissão') info.admissoes++; else info.desligados++;
  });
  const meses = [...porMes.keys()].sort();
  if (!meses.length) return `<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:12px">Sem dados no período pra mostrar no gráfico.</div>`;

  const max = Math.max(1, ...meses.map(m => Math.max(porMes.get(m).admissoes, porMes.get(m).desligados)));
  const totalAdm = meses.reduce((s,m) => s+porMes.get(m).admissoes, 0);
  const totalDesl = meses.reduce((s,m) => s+porMes.get(m).desligados, 0);
  const saldo = totalAdm - totalDesl;

  return `
    <div class="hc-panel" style="margin-bottom:16px">
      <div style="display:flex;gap:14px;font-size:11px;color:var(--text-secondary);margin-bottom:12px;align-items:center">
        <span><span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:#5fa87a;margin-right:5px"></span>Admissões</span>
        <span><span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:#b56666;margin-right:5px"></span>Desligados</span>
        <span style="margin-left:auto;color:${saldo>=0?'#5fa87a':'#b56666'};font-weight:700">Saldo: ${saldo>=0?'+':''}${saldo}</span>
      </div>
      <div style="display:flex;align-items:flex-end;gap:10px;height:100px">
        ${meses.map(m => {
          const info = porMes.get(m);
          const ativo = window._hcMovFiltroExtra?.tipo === 'mes' && window._hcMovFiltroExtra?.valor === m;
          return `<div onclick="hcMovFiltrarPor('mes','${m}')" style="flex:1;display:flex;flex-direction:column;justify-content:flex-end;height:100%;align-items:center;cursor:pointer;border-radius:4px;background:${ativo?'rgba(0,160,210,.12)':'transparent'};padding:2px" title="Clique pra ver quem está nesse mês">
            <div style="display:flex;gap:2px;font-size:8.5px;font-weight:600;margin-bottom:2px">
              <span style="color:#5fa87a">${info.admissoes}</span><span style="color:var(--text-secondary)">/</span><span style="color:#b56666">${info.desligados}</span>
            </div>
            <div style="display:flex;gap:3px;align-items:flex-end;width:100%;height:80px">
              <div style="flex:1;height:${Math.round(info.admissoes/max*80)}px;background:#5fa87a;border-radius:2px 2px 0 0" title="${info.admissoes} admissões"></div>
              <div style="flex:1;height:${Math.round(info.desligados/max*80)}px;background:#b56666;border-radius:2px 2px 0 0" title="${info.desligados} desligados"></div>
            </div>
          </div>`;
        }).join('')}
      </div>
      <div style="display:flex;gap:10px;margin-top:4px">
        ${meses.map(m => `<div style="flex:1;text-align:center;font-size:10px;color:var(--text-secondary)">${adhMonthLabel(m)}</div>`).join('')}
      </div>
    </div>`;
}

// Ranking de bases por movimentação total — só faz sentido mostrar quando
// está vendo TODAS as bases juntas (se já tiver uma base específica
// selecionada, isso ficaria redundante, é tudo a mesma base).
function hcHeadcountPorBase() {
  const porBase = new Map();
  if (window.eoColabs) {
    for (const [, r] of window.eoColabs) {
      const base = (r.station||'').toUpperCase();
      if (!base) continue;
      if (hcIsDesligado(r.matricula)) continue;
      porBase.set(base, (porBase.get(base)||0)+1);
    }
  }
  return porBase;
}

function hcMovPorBaseHTML() {
  if (window._hcBase) return '';
  const rows = hcMovFilteredRows();
  const headcountPorBase = hcHeadcountPorBase();
  const porBase = new Map();
  rows.forEach(r => {
    const base = r.filial || 'Sem filial';
    if (!porBase.has(base)) porBase.set(base, { admissoes:0, desligados:0 });
    const info = porBase.get(base);
    if (r.tipo === 'Admissão') info.admissoes++; else info.desligados++;
  });
  const bases = [...porBase.entries()]
    .map(([base,info]) => {
      const headcount = headcountPorBase.get(base) || 0;
      const total = info.admissoes+info.desligados;
      const taxa = headcount > 0 ? Math.round(total/headcount*1000)/10 : null;
      return { base, ...info, total, headcount, taxa };
    })
    .sort((a,b) => b.total - a.total);
  if (!bases.length) return '';
  const max = Math.max(1, ...bases.map(b=>b.total));

  return `
    <div class="hc-panel" style="margin-bottom:16px">
      <div class="hc-panel-title" style="margin-bottom:2px">Bases com mais movimentação</div>
      <div style="font-size:10.5px;color:var(--text-muted);margin-bottom:12px">Taxa = movimentação ÷ headcount ativo da base — dá contexto de tamanho, não só o número bruto</div>
      ${bases.map(b => `
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
          <div style="width:48px;font-size:12.5px;color:var(--text-primary);font-weight:600">${b.base}</div>
          <div style="flex:1;display:flex;height:16px;border-radius:3px;overflow:hidden;background:rgba(255,255,255,.05)">
            <div style="width:${Math.round(b.admissoes/max*100)}%;background:#5fa87a" title="${b.admissoes} admissões"></div>
            <div style="width:${Math.round(b.desligados/max*100)}%;background:#b56666" title="${b.desligados} desligados"></div>
          </div>
          <div style="width:110px;text-align:right;font-size:11px;color:var(--text-secondary);white-space:nowrap">${b.admissoes}▲ ${b.desligados}▼</div>
          <div style="width:40px;text-align:right;font-size:13px;font-weight:700;color:var(--text-primary)">${b.total}</div>
          <div style="width:64px;text-align:right;font-size:11px;color:var(--text-secondary);white-space:nowrap">${b.taxa!=null?b.taxa+'% do HC':'—'}</div>
        </div>
      `).join('')}
    </div>`;
}

// Turnover por cargo — sempre mostra (faz sentido mesmo com uma base só
// selecionada, já que dentro de uma base ainda pode ter vários cargos).
function hcMovPorCargoHTML() {
  const rows = hcMovFilteredRows();
  const porCargo = new Map();
  rows.forEach(r => {
    const cargo = r.cargo || 'Sem cargo';
    if (!porCargo.has(cargo)) porCargo.set(cargo, { admissoes:0, desligados:0 });
    const info = porCargo.get(cargo);
    if (r.tipo === 'Admissão') info.admissoes++; else info.desligados++;
  });
  const cargos = [...porCargo.entries()]
    .map(([cargo,info]) => ({ cargo, ...info, total: info.admissoes+info.desligados }))
    .sort((a,b) => b.total - a.total)
    .slice(0, 12); // top 12 — pode ter muitos cargos distintos
  if (!cargos.length) return '';
  const max = Math.max(1, ...cargos.map(c=>c.total));

  return `
    <div class="hc-panel" style="margin-bottom:16px">
      <div class="hc-panel-title" style="margin-bottom:12px">Cargos com mais movimentação</div>
      ${cargos.map(c => { const ativo = window._hcMovFiltroExtra?.tipo === 'cargo' && window._hcMovFiltroExtra?.valor === c.cargo; return `
        <div onclick="hcMovFiltrarPor('cargo','${c.cargo.replace(/'/g,"\\'")}')" style="display:flex;align-items:center;gap:10px;margin-bottom:8px;cursor:pointer;border-radius:6px;background:${ativo?'rgba(0,160,210,.1)':'transparent'};padding:3px 6px;margin-left:-6px" title="Clique pra ver quem é desse cargo">
          <div style="width:220px;font-size:12px;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${c.cargo}">${c.cargo}</div>
          <div style="flex:1;display:flex;height:16px;border-radius:3px;overflow:hidden;background:rgba(255,255,255,.05)">
            <div style="width:${Math.round(c.admissoes/max*100)}%;background:#5fa87a" title="${c.admissoes} admissões"></div>
            <div style="width:${Math.round(c.desligados/max*100)}%;background:#b56666" title="${c.desligados} desligados"></div>
          </div>
          <div style="width:110px;text-align:right;font-size:11px;color:var(--text-secondary);white-space:nowrap">${c.admissoes}▲ ${c.desligados}▼</div>
          <div style="width:40px;text-align:right;font-size:13px;font-weight:700;color:var(--text-primary)">${c.total}</div>
        </div>
      `; }).join('')}
    </div>`;
}

// Motivo de desligamento mais comum — só entre os registros de
// Desligamento do recorte filtrado (admissão não tem causa)
function hcMovCausaHTML() {
  const rows = hcMovFilteredRows().filter(r => r.tipo === 'Desligamento');
  const porCausa = new Map();
  rows.forEach(r => {
    const causa = r.causa_texto || 'Não informado';
    porCausa.set(causa, (porCausa.get(causa)||0)+1);
  });
  const causas = [...porCausa.entries()].sort((a,b) => b[1]-a[1]);
  if (!causas.length) return '';
  const total = rows.length;
  const max = Math.max(1, ...causas.map(c=>c[1]));

  return `
    <div class="hc-panel" style="margin-bottom:16px">
      <div class="hc-panel-title" style="margin-bottom:12px">Motivos de desligamento mais comuns</div>
      ${causas.slice(0,8).map(([causa,n]) => { const ativo = window._hcMovFiltroExtra?.tipo === 'causa' && window._hcMovFiltroExtra?.valor === causa; return `
        <div onclick="hcMovFiltrarPor('causa','${causa.replace(/'/g,"\\'")}')" style="display:flex;align-items:center;gap:10px;margin-bottom:8px;cursor:pointer;border-radius:6px;background:${ativo?'rgba(0,160,210,.1)':'transparent'};padding:3px 6px;margin-left:-6px" title="Clique pra ver quem saiu por esse motivo">
          <div style="width:220px;font-size:12px;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${causa}">${causa}</div>
          <div style="flex:1;height:16px;border-radius:3px;overflow:hidden;background:rgba(255,255,255,.05)">
            <div style="width:${Math.round(n/max*100)}%;height:100%;background:#b56666"></div>
          </div>
          <div style="width:50px;text-align:right;font-size:11px;color:var(--text-secondary)">${Math.round(n/total*1000)/10}%</div>
          <div style="width:34px;text-align:right;font-size:13px;font-weight:700;color:var(--text-primary)">${n}</div>
        </div>
      `; }).join('')}
    </div>`;
}

// Tempo médio de casa de quem foi desligado — usa data_admissao ×
// data_demissao do próprio registro de desligamento (já vem junto, não
// precisa cruzar com outra tabela).
function hcMovTempoCasaHTML() {
  const rows = hcMovFilteredRows().filter(r => r.tipo === 'Desligamento' && r.data_admissao && r.data);
  if (!rows.length) return '';
  const dias = rows.map(r => {
    const ini = new Date(r.data_admissao), fim = new Date(r.data);
    return Math.max(0, Math.round((fim-ini)/(1000*60*60*24)));
  });
  const mediaDias = Math.round(dias.reduce((s,d)=>s+d,0) / dias.length);
  const mediaMeses = Math.round(mediaDias/30*10)/10;
  const menosDe90 = dias.filter(d => d < 90).length;
  const pctMenosDe90 = Math.round(menosDe90/dias.length*1000)/10;

  return `
    <div class="hc-panel" style="margin-bottom:16px">
      <div class="hc-panel-title" style="margin-bottom:12px">Tempo médio de casa até o desligamento</div>
      <div style="display:flex;gap:16px;flex-wrap:wrap">
        <div style="flex:1;min-width:160px">
          <div style="font-size:24px;font-weight:700;color:var(--text-primary)">${mediaMeses} meses</div>
          <div style="font-size:11px;color:var(--text-secondary);margin-top:2px">média (${dias.length} desligamento${dias.length===1?'':'s'} com data de admissão)</div>
        </div>
        <div style="flex:1;min-width:160px">
          <div style="font-size:24px;font-weight:700;color:${pctMenosDe90>30?'#fc8181':'var(--text-primary)'}">${pctMenosDe90}%</div>
          <div style="font-size:11px;color:var(--text-secondary);margin-top:2px">saíram com menos de 90 dias de casa</div>
        </div>
      </div>
    </div>`;
}

// Copia um resumo mês a mês (admissões/desligados/saldo) formatado como
// tabela pra colar direto no corpo de um e-mail — usa a Clipboard API com
// text/html (a maioria dos clientes de e-mail cola como tabela de verdade)
// e um fallback em texto simples, pra não depender de print de tela.
async function hcCopiarResumoEmail() {
  const rows = hcMovFilteredRows();
  const base = window._hcBase || 'Todas as bases';
  const porMes = new Map();
  rows.forEach(r => {
    const mes = String(r.data).slice(0,7);
    if (!porMes.has(mes)) porMes.set(mes, { admissoes: 0, desligados: 0 });
    const info = porMes.get(mes);
    if (r.tipo === 'Admissão') info.admissoes++; else info.desligados++;
  });
  const meses = [...porMes.keys()].sort();
  const totalAdm = meses.reduce((s,m)=>s+porMes.get(m).admissoes, 0);
  const totalDesl = meses.reduce((s,m)=>s+porMes.get(m).desligados, 0);
  const saldoTotal = totalAdm - totalDesl;

  const html = `
    <div style="font-family:Arial,sans-serif;color:#1a1a1a">
      <h2 style="margin:0 0 4px;font-size:18px">Relatório de Movimentação — ${base}</h2>
      <p style="color:#555;margin:0 0 16px;font-size:13px">${hcMovPeriodLabel()} · ${rows.length.toLocaleString('pt-BR')} registros</p>
      <table style="border-collapse:collapse;width:100%;font-size:14px">
        <thead><tr style="background:#0e766e;color:#ffffff">
          <th style="padding:8px;text-align:left;border:1px solid #0a5a54">Mês</th>
          <th style="padding:8px;text-align:right;border:1px solid #0a5a54">Admissões</th>
          <th style="padding:8px;text-align:right;border:1px solid #0a5a54">Desligados</th>
          <th style="padding:8px;text-align:right;border:1px solid #0a5a54">Saldo</th>
        </tr></thead>
        <tbody>
          ${meses.map(m => {
            const info = porMes.get(m);
            const saldo = info.admissoes - info.desligados;
            return `<tr>
              <td style="padding:8px;border:1px solid #ddd">${adhMonthLabel(m)}</td>
              <td style="padding:8px;text-align:right;border:1px solid #ddd;color:#2d7a4f">${info.admissoes}</td>
              <td style="padding:8px;text-align:right;border:1px solid #ddd;color:#a83a3a">${info.desligados}</td>
              <td style="padding:8px;text-align:right;border:1px solid #ddd;font-weight:bold">${saldo>=0?'+':''}${saldo}</td>
            </tr>`;
          }).join('')}
          <tr style="background:#f2f2f2;font-weight:bold">
            <td style="padding:8px;border:1px solid #ddd">Total</td>
            <td style="padding:8px;text-align:right;border:1px solid #ddd;color:#2d7a4f">${totalAdm}</td>
            <td style="padding:8px;text-align:right;border:1px solid #ddd;color:#a83a3a">${totalDesl}</td>
            <td style="padding:8px;text-align:right;border:1px solid #ddd">${saldoTotal>=0?'+':''}${saldoTotal}</td>
          </tr>
        </tbody>
      </table>
    </div>`;

  let texto = `Relatório de Movimentação — ${base}\n${hcMovPeriodLabel()} · ${rows.length.toLocaleString('pt-BR')} registros\n\n`;
  texto += `Mês\tAdmissões\tDesligados\tSaldo\n`;
  meses.forEach(m => {
    const info = porMes.get(m);
    const saldo = info.admissoes - info.desligados;
    texto += `${adhMonthLabel(m)}\t${info.admissoes}\t${info.desligados}\t${saldo>=0?'+':''}${saldo}\n`;
  });
  texto += `Total\t${totalAdm}\t${totalDesl}\t${saldoTotal>=0?'+':''}${saldoTotal}\n`;

  const btn = document.getElementById('hc-mov-copy-btn');
  try {
    if (navigator.clipboard && window.ClipboardItem) {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([texto], { type: 'text/plain' }),
        }),
      ]);
    } else {
      await navigator.clipboard.writeText(texto);
    }
    if (btn) {
      const original = btn.innerHTML;
      btn.innerHTML = '<i class="ti ti-check" aria-hidden="true"></i> Copiado!';
      setTimeout(() => { btn.innerHTML = original; }, 2000);
    }
  } catch(e) {
    alert('Não consegui copiar automaticamente (o navegador pode ter bloqueado). Erro: ' + e.message);
  }
}

function hcRenderMovimentacao(el) {
  const base = window._hcBase;
  if (window._hcMovPeriod == null) window._hcMovPeriod = '12m';
  const rows = hcMovTabelaFiltrada();

  el.innerHTML = `
    <div class="hc-wrap">
      <div class="hc-header">
        <div style="display:flex;align-items:center;gap:12px">
          <button class="adh-back-btn" onclick="hcRenderMain(window._hcCurrentEl)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
            </svg>
          </button>
          <div style="position:relative">
            <h1 class="page-title">Movimentação ${base?`<span class="adh-base-badge">${base}</span>`:''}</h1>
            <div style="display:flex;align-items:center;gap:8px;margin-top:4px">
              <button class="hc-desl-filter-trigger" onclick="hcToggleMovFilter()">
                <i class="ti ti-filter" aria-hidden="true"></i> ${hcMovPeriodLabel()} <i class="ti ti-chevron-down" aria-hidden="true"></i>
              </button>
              <span class="page-sub" style="margin:0"><span id="hc-mov-count">${rows.length.toLocaleString('pt-BR')} registro${rows.length===1?'':'s'}</span></span>
            </div>
            ${hcMovFilterPanelHTML()}
          </div>
        </div>
      </div>

      ${hcMovChartHTML()}
      ${hcMovPorBaseHTML()}
      ${hcMovPorCargoHTML()}
      ${hcMovCausaHTML()}
      ${hcMovTempoCasaHTML()}

      <div class="hc-panel">
        <div style="display:flex;gap:10px;align-items:center;margin-bottom:12px;flex-wrap:wrap">
          <div class="adh-search-wrap" style="max-width:340px;margin-bottom:0">
            <i class="ti ti-search" aria-hidden="true"></i>
            <input type="text" class="adh-search-input" placeholder="Buscar por nome, matrícula ou cargo..." oninput="hcSetMovSearch(this.value)" value="${window._hcMovSearch||''}">
          </div>
          ${hcMovFiltroChipHTML()}
          <button class="adh-refresh-btn" style="margin-left:auto" id="hc-mov-copy-btn" onclick="hcCopiarResumoEmail()"><i class="ti ti-clipboard" aria-hidden="true"></i> Copiar p/ e-mail</button>
          <button class="adh-refresh-btn" onclick="hcExportarExcel(hcMovTabelaFiltrada(), [
            {header:'Tipo',field:'tipo'},{header:'Matrícula',field:'matricula'},{header:'Filial',field:'filial'},
            {header:'Nome',field:'nome'},{header:'Cargo',field:'cargo'},{header:'CH',field:'ch'},{header:'Data',field:'data',fmt:hcFmtISODate}
          ], 'movimentacao.xlsx')"><i class="ti ti-download" aria-hidden="true"></i> Exportar Excel</button>
        </div>
        <div class="adh-colab-table-wrap">
          <table class="adh-colab-table">
            <thead><tr>
              <th>Tipo</th><th>Matrícula</th><th>Filial</th><th>Nome</th><th>Cargo</th><th class="r">CH</th><th>Data</th>
            </tr></thead>
            <tbody id="hc-mov-tbody">${hcMovRowsHTML()}</tbody>
          </table>
        </div>
      </div>
    </div>`;
}

document.addEventListener('click', (e) => {
  if (!e.target.closest('.hc-desl-filter-panel') && !e.target.closest('.hc-desl-filter-trigger')) {
    const panel = document.getElementById('hc-mov-filter-panel');
    if (panel) panel.style.display = 'none';
  }
});

function hcOpenAdmissoes() {
  hcRenderAdmissoes(window._hcCurrentEl);
}

function hcAdmissoesAllForBase() {
  const base = window._hcBase;
  const out = [];
  if (window.eoColabs) {
    for (const [mat, r] of window.eoColabs) {
      if (base && (r.station||'').toUpperCase() !== base.toUpperCase()) continue;
      if (!r.admissao) continue;
      out.push({ matricula: mat, filial: r.station, nome: r.nome, cargo: r.funcao, ch: r.ch, admissao: r.admissao });
    }
  }
  return out;
}

function hcAdmissoesFilteredRows() {
  const period = window._hcAdmPeriod || '12m';
  const term = (window._hcAdmSearch || '').trim().toUpperCase();
  const hoje = new Date();
  const ha12m = new Date(hoje.getFullYear(), hoje.getMonth()-12, hoje.getDate());

  let rows = hcAdmissoesAllForBase();
  if (period === '12m') {
    rows = rows.filter(r => { const d = new Date(r.admissao); return d >= ha12m && d <= hoje; });
  } else if (period === 'custom') {
    const from = window._hcAdmFrom ? new Date(window._hcAdmFrom) : null;
    const to   = window._hcAdmTo   ? new Date(window._hcAdmTo)   : null;
    rows = rows.filter(r => {
      const d = new Date(r.admissao);
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    });
  } else if (period !== 'todos') {
    rows = rows.filter(r => String(r.admissao).slice(0,7) === period);
  }
  if (term) {
    rows = rows.filter(r =>
      (r.nome||'').toUpperCase().includes(term) ||
      String(r.matricula||'').includes(term) ||
      (r.cargo||'').toUpperCase().includes(term));
  }
  return rows.sort((a,b) => (b.admissao||'').localeCompare(a.admissao||''));
}

function hcAdmPeriodLabel() {
  const period = window._hcAdmPeriod || '12m';
  if (period === '12m')   return 'Últimos 12 meses';
  if (period === 'todos') return 'Todo o período';
  if (period === 'custom') {
    const de  = window._hcAdmFrom ? hcFmtISODate(window._hcAdmFrom) : 'início';
    const ate = window._hcAdmTo   ? hcFmtISODate(window._hcAdmTo)   : 'hoje';
    return `De ${de} até ${ate}`;
  }
  return adhMonthLabel(period);
}

function hcAdmFilterPanelHTML() {
  const meses = [...new Set(hcAdmissoesAllForBase().map(r => String(r.admissao).slice(0,7)))].sort().reverse();
  const period = window._hcAdmPeriod || '12m';
  const quick = [['12m','Últimos 12 meses'], ['todos','Tudo'], ...meses.map(m => [m, adhMonthLabel(m)])];
  return `
    <div class="hc-desl-filter-panel" id="hc-adm-filter-panel" style="display:none">
      <div class="hc-desl-filter-quick">
        ${quick.map(([v,label]) => `<button class="${period===v?'active':''}" onclick="hcSetAdmPeriod('${v}')">${label}</button>`).join('')}
      </div>
      <div class="hc-desl-filter-custom">
        <div class="hc-desl-filter-custom-label">Ou escolha um período personalizado</div>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <input type="date" id="hc-adm-from" class="adm-input" style="width:auto" value="${window._hcAdmFrom||''}">
          <span style="color:var(--text-muted);font-size:12px">até</span>
          <input type="date" id="hc-adm-to" class="adm-input" style="width:auto" value="${window._hcAdmTo||''}">
          <button class="adh-refresh-btn" onclick="hcApplyAdmCustomRange()">Aplicar</button>
        </div>
      </div>
    </div>`;
}

function hcToggleAdmFilter() {
  const panel = document.getElementById('hc-adm-filter-panel');
  if (!panel) return;
  panel.style.display = panel.style.display === 'block' ? 'none' : 'block';
}

function hcSetAdmPeriod(value) {
  window._hcAdmPeriod = value;
  hcRenderAdmissoes(window._hcCurrentEl);
}

function hcApplyAdmCustomRange() {
  window._hcAdmFrom = document.getElementById('hc-adm-from').value || null;
  window._hcAdmTo   = document.getElementById('hc-adm-to').value || null;
  window._hcAdmPeriod = 'custom';
  hcRenderAdmissoes(window._hcCurrentEl);
}

function hcSetAdmSearch(value) {
  window._hcAdmSearch = value;
  const body = document.getElementById('hc-adm-tbody');
  if (body) body.innerHTML = hcAdmRowsHTML();
  const countEl = document.getElementById('hc-adm-count');
  if (countEl) { const n = hcAdmissoesFilteredRows().length; countEl.textContent = `${n.toLocaleString('pt-BR')} registro${n===1?'':'s'}`; }
}

function hcAdmRowsHTML() {
  const rows = hcAdmissoesFilteredRows();
  if (!rows.length) {
    return `<tr><td colspan="6" style="padding:24px 10px;text-align:center;color:var(--text-muted);font-size:12px">Nenhuma admissão encontrada nesse período.</td></tr>`;
  }
  return rows.map(r => `<tr class="adh-colab-row">
    <td style="font-family:monospace">${r.matricula}</td>
    <td>${r.filial}</td>
    <td style="font-weight:500">${r.nome||''}</td>
    <td>${r.cargo||''}</td>
    <td class="r">${r.ch?r.ch+'h':'—'}</td>
    <td>${hcFmtISODate(r.admissao)||'—'}</td>
  </tr>`).join('');
}

function hcRenderAdmissoes(el) {
  const base = window._hcBase;
  if (window._hcAdmPeriod == null) window._hcAdmPeriod = '12m';
  const rows = hcAdmissoesFilteredRows();

  el.innerHTML = `
    <div class="hc-wrap">
      <div class="hc-header">
        <div style="display:flex;align-items:center;gap:12px">
          <button class="adh-back-btn" onclick="hcRenderMain(window._hcCurrentEl)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
            </svg>
          </button>
          <div style="position:relative">
            <h1 class="page-title">Admissões ${base?`<span class="adh-base-badge">${base}</span>`:''}</h1>
            <div style="display:flex;align-items:center;gap:8px;margin-top:4px">
              <button class="hc-desl-filter-trigger" onclick="hcToggleAdmFilter()">
                <i class="ti ti-filter" aria-hidden="true"></i> ${hcAdmPeriodLabel()} <i class="ti ti-chevron-down" aria-hidden="true"></i>
              </button>
              <span class="page-sub" style="margin:0"><span id="hc-adm-count">${rows.length.toLocaleString('pt-BR')} registro${rows.length===1?'':'s'}</span></span>
            </div>
            ${hcAdmFilterPanelHTML()}
          </div>
        </div>
      </div>

      ${hcExemploChartHTML(hcAdmissoesAllForBase(), 'admissao', window._hcAdmPeriod, '#5fa87a')}

      <div class="hc-panel">
        <div style="display:flex;gap:10px;align-items:center;margin-bottom:12px;flex-wrap:wrap">
          <div class="adh-search-wrap" style="max-width:340px;margin-bottom:0">
            <i class="ti ti-search" aria-hidden="true"></i>
            <input type="text" class="adh-search-input" placeholder="Buscar por nome, matrícula ou cargo..." oninput="hcSetAdmSearch(this.value)" value="${window._hcAdmSearch||''}">
          </div>
          <button class="adh-refresh-btn" style="margin-left:auto" onclick="hcExportarExcel(hcAdmissoesFilteredRows(), [
            {header:'Matrícula',field:'matricula'},{header:'Filial',field:'filial'},{header:'Nome',field:'nome'},
            {header:'Cargo',field:'cargo'},{header:'CH',field:'ch'},{header:'Admissão',field:'admissao',fmt:hcFmtISODate}
          ], 'admissoes.xlsx')"><i class="ti ti-download" aria-hidden="true"></i> Exportar Excel</button>
        </div>
        <div class="adh-colab-table-wrap">
          <table class="adh-colab-table">
            <thead><tr>
              <th>Matrícula</th><th>Filial</th><th>Nome</th><th>Cargo</th>
              <th class="r">CH</th><th>Admissão</th>
            </tr></thead>
            <tbody id="hc-adm-tbody">${hcAdmRowsHTML()}</tbody>
          </table>
        </div>
      </div>
    </div>`;
}

document.addEventListener('click', (e) => {
  if (!e.target.closest('.hc-desl-filter-panel') && !e.target.closest('.hc-desl-filter-trigger')) {
    const panel = document.getElementById('hc-adm-filter-panel');
    if (panel) panel.style.display = 'none';
  }
});
