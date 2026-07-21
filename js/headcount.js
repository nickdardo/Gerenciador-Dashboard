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
      const data = await dbFetchAll('colaboradores_ferias', 'matricula,data_inicio,data_fim,dias');
      const byMat = new Map();
      for (const r of (data||[])) {
        const prev = byMat.get(r.matricula);
        if (!prev || (r.data_fim||'') > (prev.data_fim||'')) byMat.set(r.matricula, r);
      }
      window.eoFerias = byMat;
    } catch(e) { console.warn('[headcount] ferias:', e.message); window.eoFerias = new Map(); }
  }
  if (!window.eoDesligadosAll) {
    try {
      const data = await dbFetchAll('colaboradores_desligados', 'matricula,filial,nome,cargo,ch,data_demissao,causa_texto');
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
    headcount, ativos, inativos, afastados, totalCadastro, pcd, atestados, feriasAtivas, desligados12m,
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
  window.eoColabs = null; window.eoFerias = null; window.eoDesligados = null; window.eoDesligadosAll = null; window.eoPcd = null;
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
        { key:'red', icon:'ti-calendar-off', title:'Ausências', rows: [
          { label:'Férias', sub:'ativas agora', value: stats.feriasAtivas.toLocaleString('pt-BR') },
          { label:'Desligados', sub:'últimos 12 meses · clique para ver a lista', value: stats.desligados12m.toLocaleString('pt-BR'), color:'#b56666', onclick:'hcOpenDesligados()' },
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

      <div class="hc-panel">
        <div class="adh-search-wrap" style="margin-bottom:12px;max-width:340px">
          <i class="ti ti-search" aria-hidden="true"></i>
          <input type="text" class="adh-search-input" placeholder="Buscar por nome, matrícula ou causa..." oninput="hcSetDeslSearch(this.value)" value="${window._hcDeslSearch||''}">
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
