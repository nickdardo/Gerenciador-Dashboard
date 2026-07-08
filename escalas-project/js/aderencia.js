// ══════════════════════════════════════════════════════
// PAGE 4 — ADERÊNCIA AO PONTO
// ══════════════════════════════════════════════════════

let adBase  = null;
let adYear  = null;
let adMonth = null;
let adResults = [];
let adChart   = null;
let adFilterStatus = 'all';

// ── Nav entry ─────────────────────────────────────────
function showAderencia() {
  showPage('ad');
  adBase  = window.cBaseName || null;
  adYear  = new Date().getFullYear();
  adMonth = new Date().getMonth() + 1;
  adRender();
}

// ── Main render ───────────────────────────────────────
function adRender() {
  const hasH = pontoHorarios.size > 0;
  const hasM = pontoMarcacao.size > 0;

  const ICO_UPLOAD = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>`;

  document.getElementById('ad-content').innerHTML = `
  <div class="ad-header">
    <div class="ad-header-left">
      <div class="ad-title">Aderência ao Ponto
        ${adBase ? `<span class="eo-base-tag">${adBase}</span>` : ''}
      </div>
      <div class="ad-subtitle">Planejado (Horários) vs Realizado (Marcação)</div>
    </div>
    <div class="ad-header-right">
      <label class="eo-btn eo-btn-upload ad-upload-btn" title="Carregar Horarios.xlsx">
        ${ICO_UPLOAD} Horários
        <input type="file" accept=".xlsx,.xls" style="display:none" onchange="adLoadHorarios(this)">
      </label>
      <span class="eo-colab-status" id="ad-hor-status">${hasH ? pontoHorarios.size+' registros' : ''}</span>

      <label class="eo-btn eo-btn-upload ad-upload-btn" title="Carregar Marcacao.xlsx">
        ${ICO_UPLOAD} Marcação
        <input type="file" accept=".xlsx,.xls" style="display:none" onchange="adLoadMarcacao(this)">
      </label>
      <span class="eo-colab-status" id="ad-mar-status">${hasM ? pontoMarcacao.size+' registros' : ''}</span>

      ${hasH && hasM ? `<button class="eo-btn eo-btn-print" onclick="adRunComparison()">Comparar</button>` : ''}
    </div>
  </div>

  ${(!hasH || !hasM) ? `
  <div class="ad-empty">
    <div class="ad-empty-icon">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
      </svg>
    </div>
    <div class="ad-empty-title">Carregue os dois arquivos para comparar</div>
    <div class="ad-empty-sub">Horários (planejado) + Marcação (realizado)</div>
  </div>` : ''}

  <div id="ad-dashboard" style="display:none">
    <div class="stats ad-stats" id="ad-stats"></div>

    <div class="card card-top-b" style="margin:12px 24px 0">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px">
        <span style="font-size:13px;font-weight:600;color:var(--text)">Aderência por hora do dia</span>
        <div class="tags" id="ad-status-filter"></div>
      </div>
      <div style="height:260px"><canvas id="ad-chart"></canvas></div>
    </div>

    <div style="padding:12px 24px">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;flex-wrap:wrap">
        <span style="font-size:13px;font-weight:600;color:var(--text)">Detalhamento</span>
        <input id="ad-search" class="eo-name-input" placeholder="Buscar por nome ou matrícula..." style="width:240px"
          oninput="adFilterTable(this.value)">
        <span id="ad-count" style="font-size:11px;color:var(--muted)"></span>
      </div>
      <div class="table-wrap" style="max-height:420px">
        <table class="eo-table" style="min-width:900px">
          <thead>
            <tr>
              <th class="eo-th" style="min-width:80px">Base</th>
              <th class="eo-th" style="min-width:80px">Matrícula</th>
              <th class="eo-th" style="min-width:200px">Nome</th>
              <th class="eo-th">Data</th>
              <th class="eo-th">Plan. Entrada</th>
              <th class="eo-th">Real Entrada</th>
              <th class="eo-th">Desvio Ent.</th>
              <th class="eo-th">Plan. Saída</th>
              <th class="eo-th">Real Saída</th>
              <th class="eo-th">Desvio Saí.</th>
              <th class="eo-th">Status</th>
            </tr>
          </thead>
          <tbody id="ad-tbody"></tbody>
        </table>
      </div>
    </div>
  </div>`;
}

// ── Upload handlers ───────────────────────────────────
function adLoadHorarios(input) {
  const file = input.files[0];
  if (!file) return;
  const st = document.getElementById('ad-hor-status');
  if (st) { st.textContent = 'Carregando...'; st.className = 'eo-colab-status eo-colab-loading'; }

  readXlsx(file, wb => {
    if (!wb) { if (st) { st.textContent = 'Erro'; st.className = 'eo-colab-status eo-colab-err'; } return; }
    const base = window.cBaseName || adBase;
    const n    = pontoParseHorarios(wb, base);
    if (st) { st.textContent = `${n} registros`; st.className = 'eo-colab-status eo-colab-ok'; }
    input.value = '';
    adRender();
  });
}

function adLoadMarcacao(input) {
  const file = input.files[0];
  if (!file) return;
  const st = document.getElementById('ad-mar-status');
  if (st) { st.textContent = 'Carregando...'; st.className = 'eo-colab-status eo-colab-loading'; }

  readXlsx(file, wb => {
    if (!wb) { if (st) { st.textContent = 'Erro'; st.className = 'eo-colab-status eo-colab-err'; } return; }
    const base = window.cBaseName || adBase;
    const n    = pontoParseMarcacao(wb, base);
    if (st) { st.textContent = `${n} registros`; st.className = 'eo-colab-status eo-colab-ok'; }
    input.value = '';
    adRender();
  });
}

// ── Run comparison ────────────────────────────────────
function adRunComparison() {
  const base  = window.cBaseName || null;
  const now   = new Date();
  adYear  = now.getFullYear();
  adMonth = now.getMonth() + 1;

  // Detect month from data if available
  if (pontoHorarios.size) {
    const firstKey = pontoHorarios.keys().next().value;
    const parts    = firstKey.split('_')[1].split('-');
    adYear  = parseInt(parts[0]);
    adMonth = parseInt(parts[1]);
  }

  adResults = pontoBuildComparison(base, adYear, adMonth);
  adRenderDashboard(adResults);
}

// ── Render dashboard ──────────────────────────────────
function adRenderDashboard(results) {
  document.getElementById('ad-dashboard').style.display = 'block';

  const stats = pontoBuildStats(results);
  const pct   = stats.adherencePct;
  const pctCls = pct >= 90 ? 'pos' : pct >= 70 ? 'orange' : 'neg';
  const monthLabel = new Date(adYear, adMonth-1, 1).toLocaleDateString('pt-BR',{month:'long',year:'numeric'});

  document.getElementById('ad-stats').innerHTML = `
    <div class="stat"><div class="num ${pctCls}" style="font-size:28px">${pct}%</div>
      <div class="lbl">Aderência geral</div>
      <div class="coverage-bar" style="margin-top:6px">
        <div class="coverage-fill" style="width:${Math.min(pct,100)}%;background:${pct>=90?'var(--green)':pct>=70?'#d97706':'var(--red)'}"></div>
      </div>
    </div>
    <div class="stat"><div class="num g">${stats.ok}</div><div class="lbl">No horário</div></div>
    <div class="stat"><div class="num orange">${stats.desvio + stats.atraso}</div><div class="lbl">Atrasos</div></div>
    <div class="stat"><div class="num orange">${stats.saida_antecipada}</div><div class="lbl">Saída antecipada</div></div>
    <div class="stat"><div class="num neg">${stats.falta}</div><div class="lbl">Faltas</div></div>
    <div class="stat"><div class="num neu">${stats.total}</div><div class="lbl">Total · ${monthLabel}</div></div>
  `;

  // Status filter tags
  const filterEl = document.getElementById('ad-status-filter');
  const filters  = [
    { k:'all',               l:'Todos',             c:'tall' },
    { k:'ok',                l:'No horário',        c:'tg'   },
    { k:'atraso',            l:'Atraso',            c:'to'   },
    { k:'desvio',            l:'Desvio',            c:'to'   },
    { k:'saida_antecipada',  l:'Saída antecipada',  c:'to'   },
    { k:'falta',             l:'Falta',             c:'to'   },
  ];
  filterEl.innerHTML = filters.map(f => `
    <span class="tag ${f.c}${adFilterStatus===f.k?' on':''}"
      onclick="adSetFilter('${f.k}')">${f.l}
      <span style="opacity:.6;font-size:10px;margin-left:3px">${f.k==='all'?stats.total:(stats[f.k]||0)}</span>
    </span>`).join('');

  adBuildChart(results);
  adBuildTable(results);
}

function adSetFilter(status) {
  adFilterStatus = status;
  adRenderDashboard(adResults);
}

// ── Chart: hourly adherence ───────────────────────────
function adBuildChart(results) {
  const hourOk    = new Array(24).fill(0);
  const hourFail  = new Array(24).fill(0);

  results.forEach(r => {
    const h = pontoTimeToMin(r.planEntrada);
    if (h === null) return;
    const hr = Math.floor(h / 60);
    if (r.status === 'ok') hourOk[hr]++;
    else                   hourFail[hr]++;
  });

  const labels = Array.from({length:24}, (_,h) => `${String(h).padStart(2,'0')}h`);
  if (adChart) adChart.destroy();
  adChart = new Chart(document.getElementById('ad-chart'), {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label:'No horário',  data: hourOk,   backgroundColor:'rgba(14,159,110,0.7)', borderColor:'#0e9f6e', borderWidth:1, borderRadius:3 },
        { label:'Desvio/Falta',data: hourFail, backgroundColor:'rgba(224,36,36,0.55)', borderColor:'#e02424', borderWidth:1, borderRadius:3 },
      ]
    },
    options: {
      responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{ position:'top', labels:{ font:{size:11}, boxWidth:12 } },
        tooltip:{ backgroundColor:'#fff', borderColor:'#e2e6ed', borderWidth:1, titleColor:'#1a1f2e', bodyColor:'#6b7a99', padding:10 }},
      scales:{
        x:{ stacked:true, grid:{display:false}, ticks:{color:'#6b7a99',font:{size:9}} },
        y:{ stacked:true, grid:{color:'rgba(0,0,0,0.06)'}, ticks:{color:'#6b7a99',font:{size:9}}, beginAtZero:true },
      }
    }
  });
}

// ── Table ─────────────────────────────────────────────
let adTableData = [];

function adBuildTable(results) {
  const filtered = adFilterStatus === 'all'
    ? results
    : results.filter(r => r.status === adFilterStatus ||
        (adFilterStatus === 'atraso' && r.status === 'desvio'));

  adTableData = filtered;
  adRenderTable(filtered);
}

function adRenderTable(data) {
  const tbody = document.getElementById('ad-tbody');
  const count = document.getElementById('ad-count');
  if (!tbody) return;

  if (count) count.textContent = `${data.length} registros`;

  const STATUS_CHIP = {
    ok:               '<span class="chip" style="background:#dcfce7;color:#166534">✓ No horário</span>',
    desvio:           '<span class="chip" style="background:#fef3c7;color:#92400e">Desvio</span>',
    atraso:           '<span class="chip" style="background:#fef3c7;color:#92400e">Atraso</span>',
    saida_antecipada: '<span class="chip" style="background:#fef3c7;color:#92400e">Saída antecipada</span>',
    falta:            '<span class="chip" style="background:#fde8e8;color:#e02424">Falta</span>',
    sem_horario:      '<span class="chip" style="background:#f1f5f9;color:#64748b">Sem horário</span>',
  };

  tbody.innerHTML = data.slice(0, 500).map((r, i) => {
    const d   = r.date ? (r.date instanceof Date ? r.date : new Date(r.date)) : null;
    const dt  = d ? d.toLocaleDateString('pt-BR') : '—';
    const diffEntCls = r.diffEntMin > LATE_MIN  ? 'color:var(--red)'   : r.diffEntMin > 0 ? 'color:var(--orange)' : '';
    const diffSaiCls = r.diffSaiMin < -EARLY_MIN ? 'color:var(--red)'  : r.diffSaiMin < 0 ? 'color:var(--orange)' : '';
    return `<tr class="${i%2===0?'eo-row':'eo-row-alt'}">
      <td class="eo-td">${r.filial||'—'}</td>
      <td class="eo-td" style="font-family:monospace;font-size:11px">${r.mat||'—'}</td>
      <td class="eo-td" style="font-weight:500">${r.nome||'—'}</td>
      <td class="eo-td">${dt}</td>
      <td class="eo-td">${r.planEntrada||'—'}</td>
      <td class="eo-td">${r.realEntrada||'—'}</td>
      <td class="eo-td r" style="${diffEntCls}">${pontoFmtDiff(r.diffEntMin)}</td>
      <td class="eo-td">${r.planSaida||'—'}</td>
      <td class="eo-td">${r.realSaida||'—'}</td>
      <td class="eo-td r" style="${diffSaiCls}">${pontoFmtDiff(r.diffSaiMin)}</td>
      <td class="eo-td">${STATUS_CHIP[r.status]||r.status}</td>
    </tr>`;
  }).join('');

  if (data.length > 500) {
    tbody.innerHTML += `<tr><td colspan="11" class="preview-note">Exibindo 500 de ${data.length} registros</td></tr>`;
  }
}

// ── Search/filter table ───────────────────────────────
function adFilterTable(query) {
  if (!query.trim()) { adRenderTable(adTableData); return; }
  const q = query.toLowerCase();
  adRenderTable(adTableData.filter(r =>
    (r.nome||'').toLowerCase().includes(q) ||
    (r.mat||'').toLowerCase().includes(q)
  ));
}

// Constants referenced from ponto.js
const LATE_MIN  = 30;
const EARLY_MIN = 30;
