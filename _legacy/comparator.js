// ══════════════════════════════════════════════════════
// PAGE 2 — COMPARADOR
// ══════════════════════════════════════════════════════
// Slot 1 = Escala Dimensionamento (pré-preenchida pelo Gerador ou upload manual)
// Slot 2 = Escala Real (upload: xlsx ou xlsb)

// ── State — declared on window so generator.js can inject into them ──
window.cDataDim      = null;   // slot 1 — dimensionamento
window.cDataBase     = null;   // slot 2 — escala real
window.cBaseName     = null;
window.cBaseFormat   = null;   // 'A' | 'B'

let cDataEquipes  = null;
let cChart        = null;
let cChartEntrada = null;
let cSelBase      = new Set();
let cSelDim       = new Set();
let cVinculado    = false;

// Shorthand getters — always read from window so generator injection works
function _dim()  { return window.cDataDim;    }
function _base() { return window.cDataBase;   }

// ── Drop zone wiring ──────────────────────────────────

// Slot 1 — Dimensionamento (upload manual ou pré-preenchido pelo Gerador)
setupDrop('c-drop1', 'c-file1', file => {
  document.getElementById('c-fname1').innerHTML = `<div class="file-pill">${file.name}</div>`;
  document.getElementById('c-drop1').classList.add('has-file-o');
  readXlsx(file, wb => {
    window.cDataDim = cParseDim(wb);
    if (!window.cBaseName) {
      const base = detectBase(wb);
      if (base) { window.cBaseName = base; setBaseBadge(base); }
    }
    cCheckReady();
  });
});

// Slot 2 — Escala Real (xlsx ou xlsb)
setupDrop('c-drop2', 'c-file2', file => {
  document.getElementById('c-fname2').innerHTML = `<div class="file-pill">${file.name}</div>`;
  document.getElementById('c-drop2').classList.add('has-file-g');
  readXlsx(file, (wb, err) => {
    if (err || !wb) {
      document.getElementById('c-fname2').innerHTML +=
        `<div style="color:var(--red);font-size:11px;margin-top:4px">Erro ao ler arquivo</div>`;
      return;
    }
    const hasMatriz = wb.SheetNames.some(s => s.toLowerCase().includes('matriz'));
    if (hasMatriz) {
      window.cBaseFormat = 'B';
      window.cDataBase   = cParseEscalaReal(wb);
    } else {
      window.cBaseFormat = 'A';
      window.cDataBase   = cParseBase(wb);
    }
    const fmtLabel = window.cBaseFormat === 'B' ? 'Escala Real (xlsb)' : 'Escala Base (xlsx)';
    document.getElementById('c-fmt2').textContent     = fmtLabel;
    document.getElementById('c-fmt2').style.display   = 'inline-block';
    const base = detectBase(wb);
    if (base) { window.cBaseName = base; setBaseBadge(base); }
    cCheckReady();
  });
});

// Slot 3 — Momento Calor (dimensionamento para gráfico de demanda)
setupDrop('c-drop3', 'c-file3', file => {
  document.getElementById('c-fname3').innerHTML = `<div class="file-pill">${file.name}</div>`;
  document.getElementById('c-drop3').classList.add('has-file-g');
  readXlsx(file, wb => {
    cDataEquipes = cParseDimand(wb);
    cDemandSel   = new Set();
    cRenderDemand();
  });
});

function cCheckReady() {
  const btn   = document.getElementById('c-btn');
  const ready = !!(_dim()  && _dim().length  > 0) &&
                !!(_base() && _base().length > 0);
  btn.disabled    = !ready;
  btn.textContent = 'Comparar';
  return ready;
}

// Poll every 400ms — ensures button enables as soon as both datasets are ready,
// regardless of load order or async parse timing.
setInterval(cCheckReady, 400);

// ══════════════════════════════════════════════════════
// PARSERS
// ══════════════════════════════════════════════════════

/**
 * FORMAT A — Escala Base (xlsx)
 * col 10=funcao, col 11=entrada, col 12=saida. Data from row 3.
 */
function cParseBase(wb) {
  const ws   = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });
  const out  = [];
  for (let i = 3; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    const funcao = r[10];
    if (!funcao || funcao === 'X') continue;
    const entMin = toMinutes(r[11]);
    const saiMin = toMinutes(r[12]);
    if (entMin === null || saiMin === null) continue;
    out.push({ setor: String(r[2] || ''), funcao: String(funcao), entrada: entMin, saida: saiMin });
  }
  return out;
}

/**
 * FORMAT B — Escala Real (xlsb)
 * Reads HORARIOS → code map, BANCO DE DADOS → cargo map, MATRIZ → daily records.
 * Skips folga/férias/DSR/afastamento codes.
 */
function cParseEscalaReal(wb) {
  // 1. Horario map: code → { entrada, saida } in minutes
  const horarioMap = {};
  const horSheet = wb.SheetNames.find(s => s.toUpperCase().trim() === 'HORARIOS') || wb.SheetNames.find(s => s.toUpperCase().includes('HORARIOS'));
  if (horSheet) {
    const ws   = wb.Sheets[horSheet];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });
    for (let i = 3; i < rows.length; i++) {
      const r = rows[i];
      if (!r || r[0] === null) continue;
      const code   = typeof r[0] === 'number' ? Math.round(r[0]) : String(r[0]);
      const entMin = toMinutes(r[5]);
      const saiMin = toMinutes(r[6]);
      if (entMin !== null && saiMin !== null) horarioMap[code] = { entrada: entMin, saida: saiMin };
    }
  }

  // 2. Cargo map: matricula → funcao from BANCO DE DADOS
  const cargoMap = {};
  const dbSheet = wb.SheetNames.find(s => s.toUpperCase().includes('BANCO DE DADOS')) || wb.SheetNames.find(s => s.toUpperCase().includes('BANCO'));
  if (dbSheet) {
    const ws   = wb.Sheets[dbSheet];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });
    for (let i = 3; i < rows.length; i++) {
      const r = rows[i];
      if (!r || !r[0]) continue;
      const mat   = Math.round(r[0]);
      const cargo = r[7] || r[3] || '';
      if (mat && cargo) cargoMap[mat] = String(cargo).trim();
    }
  }

  // 3. Codes to skip
  const SKIP = new Set([
    9996, 9997, 9998, 9999,
    8882, 8883, 8884, 8885, 8886, 8887, 8888,
    6662, 6663, 6664, 6665, 6666, 6667,
    7772, 7773, 7774, 7775, 7776, 7777
  ]);

  // 4. Parse MATRIZ sheet
  const matrizSheet = wb.SheetNames.find(s => s.toUpperCase().includes('ESCALA MATRIZ')) || wb.SheetNames.find(s => s.toUpperCase().includes('MATRIZ'));
  console.log('[cParseEscalaReal] Sheets:', wb.SheetNames, '| Matriz found:', matrizSheet);
  console.log('[cParseEscalaReal] Horario codes loaded:', Object.keys(horarioMap).length);
  if (!matrizSheet) return [];

  const ws   = wb.Sheets[matrizSheet];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });
  const out  = [];

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || !r[0]) continue;
    const mat   = Math.round(r[0]);
    const cargo = cargoMap[mat] || String(r[2] || '');

    for (let d = 0; d < 31; d++) {
      const colC = 4 + d * 2 + 1;
      if (colC >= r.length) break;
      const rawCode = r[colC];
      if (rawCode === null || rawCode === undefined) continue;

      let code;
      if (typeof rawCode === 'number')      code = Math.round(rawCode);
      else if (typeof rawCode === 'string') { const n = parseInt(rawCode); code = isNaN(n) ? rawCode : n; }
      else continue;

      if (SKIP.has(code)) continue;
      const hor = horarioMap[code];
      if (!hor) continue;

      out.push({ matricula: mat, setor: cargo, funcao: cargo, entrada: hor.entrada, saida: hor.saida, dayIdx: d });
    }
  }
  console.log('[cParseEscalaReal] Records parsed:', out.length, '| Days:', new Set(out.map(r=>r.dayIdx)).size);

  // ── Average daily normalisation ──────────────────────
  // The real schedule spans the full month. To compare fairly against
  // the dimensionamento (one generic day), we compute coverage per hour
  // for each calendar day, then return ONE synthetic record per
  // (funcao, hour-slot) weighted by the average across all days.
  // We encode this as virtual "1-hour" entries so the existing
  // coverage() function produces the correct averaged values.

  const uniqueDays = new Set(out.map(r => r.dayIdx));
  const nDays      = uniqueDays.size || 1;

  // Build per-funcao, per-hour average count
  const funcoes = [...new Set(out.map(r => r.funcao))];
  const avgRecords = [];

  for (const funcao of funcoes) {
    const recs = out.filter(r => r.funcao === funcao);

    // For each day, compute hourly coverage
    const hourlySums = new Array(24).fill(0);

    for (const dayIdx of uniqueDays) {
      const dayRecs = recs.filter(r => r.dayIdx === dayIdx);
      for (let h = 0; h < 24; h++) {
        const T = h * 60;
        for (const r of dayRecs) {
          const E = r.entrada, S = r.saida, mid = E > S;
          if (mid ? (T >= E || T < S) : (T >= E && T < S)) hourlySums[h]++;
        }
      }
    }

    // Emit Math.round(avg) synthetic 1-hour records per hour slot
    for (let h = 0; h < 24; h++) {
      const avg = hourlySums[h] / nDays;
      const count = Math.round(avg);
      const entrada = h * 60;
      const saida   = (h + 1) * 60 >= 1440 ? 0 : (h + 1) * 60;
      for (let k = 0; k < count; k++) {
        avgRecords.push({ setor: funcao, funcao, entrada, saida });
      }
    }
  }

  console.log('[cParseEscalaReal] Avg daily records (normalised):', avgRecords.length, '| Days averaged:', nDays);
  // Attach metadata for the stats card — avgDailyWorkers is the true daily headcount
  avgRecords._avgDailyWorkers = Math.round(out.length / nDays);
  avgRecords._nDays           = nDays;
  return avgRecords;
}

/**
 * FORMAT C — Escala Dimensionamento gerada pelo Gerador
 * col 1=setor, col 2=funcao, col 3=entrada, col 4=saida. Data from row 3.
 */
function cParseDim(wb) {
  const ws   = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });
  const out  = [];
  for (let i = 3; i < rows.length; i++) {
    const r = rows[i];
    if (!r || !r[2]) continue;
    const entMin = toMinutes(r[3]);
    const saiMin = toMinutes(r[4]);
    if (entMin === null || saiMin === null) continue;
    out.push({ setor: String(r[1] || ''), funcao: String(r[2]), entrada: entMin, saida: saiMin });
  }
  return out;
}

/**
 * Parse "Equipes em atendimento por dia" from Dimensionamento file.
 * Rows 31–38: col 4 = day label, cols 5–148 = 10-min slots.
 */
function cParseDimand(wb) {
  const ws   = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });
  const days = [];
  for (let ri = 31; ri <= 38; ri++) {
    const row = rows[ri];
    if (!row) continue;
    const label = row[4];
    if (!label || typeof label !== 'string') continue;
    const lc = label.trim().toLowerCase();
    if (!['dom','seg','ter','qua','qui','sex','sab','máx','max'].some(d => lc.startsWith(d.slice(0,3)))) continue;
    const slots = [];
    for (let s = 0; s < 144; s++) {
      const v = row[5 + s];
      slots.push(typeof v === 'number' ? Math.round(v * 10) / 10 : 0);
    }
    days.push({ label: label.trim(), slots });
  }
  return days;
}

// ══════════════════════════════════════════════════════
// COVERAGE HELPERS
// ══════════════════════════════════════════════════════
function coverage(records, sel) {
  const data   = sel.size === 0 ? records : records.filter(r => sel.has(r.funcao));
  const counts = new Array(24).fill(0);
  for (const r of data) {
    const E = r.entrada, S = r.saida, mid = E > S;
    for (let h = 0; h < 24; h++) {
      const T = h * 60;
      if (mid ? (T >= E || T < S) : (T >= E && T < S)) counts[h]++;
    }
  }
  return counts;
}

function entradas(records, sel) {
  const data   = sel.size === 0 ? records : records.filter(r => sel.has(r.funcao));
  const counts = new Array(24).fill(0);
  for (const r of data) {
    const h = Math.floor(r.entrada / 60);
    if (h >= 0 && h < 24) counts[h]++;
  }
  return counts;
}

// ══════════════════════════════════════════════════════
// MAIN COMPARE
// ══════════════════════════════════════════════════════
function cCompare() {
  const dim  = _dim();
  const base = _base();
  if (!dim || !base) return;

  const funcsDim  = [...new Set(dim.map(r  => r.funcao))].sort();
  const funcsBase = [...new Set(base.map(r => r.funcao))].sort();

  cSelDim  = new Set(funcsDim);
  cSelBase = new Set(funcsBase);

  const realLabel = window.cBaseFormat === 'B'
    ? `Escala Real${window.cBaseName ? ' · ' + window.cBaseName : ''}`
    : `Escala Real`;

  buildTags('c-tags-dim',  funcsDim,  cSelDim,  'to', () => { cUpdateChart(); cUpdateChartEntrada(); });
  buildTags('c-tags-base', funcsBase, cSelBase, 'tg', () => { cUpdateChart(); cUpdateChartEntrada(); });

  document.getElementById('c-base-label').textContent  = realLabel;
  document.getElementById('c-base-label2').textContent = realLabel;

  document.getElementById('c-analysis').style.display = 'block';
  cUpdateChart();
  cUpdateChartEntrada();
  cUpdateTable();
  if (cDataEquipes) cRenderDemand();
  if (!_dragInit) { initDrag(); _dragInit = true; }
}

// ══════════════════════════════════════════════════════
// TAG FILTER BUILDER
// ══════════════════════════════════════════════════════
function buildTags(containerId, funcs, sel, cls, onChange) {
  const el = document.getElementById(containerId);
  el.innerHTML = '';
  const allTag = mkTag('Todos', 'tall', sel.size === funcs.length);
  allTag.onclick = () => {
    sel.size === funcs.length ? sel.clear() : funcs.forEach(f => sel.add(f));
    sync();
  };
  el.appendChild(allTag);
  funcs.forEach(f => {
    const t = mkTag(f, cls, sel.has(f));
    t.onclick = () => { sel.has(f) ? sel.delete(f) : sel.add(f); sync(); };
    el.appendChild(t);
  });
  function sync() {
    el.querySelectorAll('.tag:not([data-all])').forEach(t => t.classList.toggle('on', sel.has(t.textContent)));
    allTag.classList.toggle('on', sel.size === funcs.length);
    onChange();
  }
}

function mkTag(text, cls, active) {
  const t = document.createElement('span');
  t.className   = `tag ${cls}${active ? ' on' : ''}`;
  t.textContent = text;
  if (text === 'Todos') t.dataset.all = '1';
  return t;
}

// ══════════════════════════════════════════════════════
// CHART 1 — COBERTURA POR HORA
// ══════════════════════════════════════════════════════
function cUpdateChart() {
  const dim      = _dim();
  const base     = _base();
  const labels   = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2,'0')}:00`);
  const covDim   = coverage(dim,  cSelDim);
  const covBase  = coverage(base, cSelBase);
  const realLabel = window.cBaseFormat === 'B' ? `Real${window.cBaseName ? ' · ' + window.cBaseName : ''}` : 'Real';

  const datasets = [
    {
      label: 'Dimensionamento',
      data: covDim,
      borderColor: '#0e9f6e', backgroundColor: 'rgba(14,159,110,0.07)',
      borderWidth: 2.5, borderDash: [6,3],
      pointRadius: 3, pointHoverRadius: 5,
      tension: 0.35, fill: true, yAxisID: 'y'
    },
    {
      label: realLabel,
      data: covBase,
      borderColor: '#1a56db', backgroundColor: 'rgba(26,86,219,0.07)',
      borderWidth: 2.5,
      pointRadius: 3, pointHoverRadius: 5,
      tension: 0.35, fill: true, yAxisID: 'y'
    }
  ];

  if (cVinculado && cDataEquipes && cDemandSel.size > 0) {
    cDataEquipes.filter(d => cDemandSel.has(d.label)).forEach(d => {
      const isMax = d.label.toLowerCase().startsWith('m');
      const color = isMax ? '#ff4560' : (DAY_COLORS[d.label.toLowerCase().slice(0,3)] || '#888');
      const hourly = Array.from({ length: 24 }, (_, h) => {
        const slice = d.slots.slice(h*6, h*6+6).filter(v => v > 0);
        return slice.length ? Math.round(slice.reduce((a,b)=>a+b,0)/slice.length*10)/10 : 0;
      });
      datasets.push({
        label: `Demanda (${d.label})`, data: hourly,
        borderColor: color, backgroundColor: 'transparent',
        borderWidth: isMax?2:1.5, borderDash:[3,3],
        pointRadius:0, pointHoverRadius:4, tension:0.3, fill:false, yAxisID:'y2'
      });
    });
  }

  const hasLinked = cVinculado && cDataEquipes && cDemandSel.size > 0;
  const legEl = document.getElementById('c-leg-demand');
  if (legEl) {
    legEl.style.display = hasLinked ? 'flex' : 'none';
    if (hasLinked) document.getElementById('c-leg-demand-txt').textContent = `Demanda (${[...cDemandSel].join(', ')})`;
  }
  const legBase = document.getElementById('c-leg-base-txt');
  if (legBase) legBase.textContent = realLabel;

  if (cChart) cChart.destroy();
  cChart = new Chart(document.getElementById('c-chart'), {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode:'index', intersect:false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor:'#fff', borderColor:'#e2e6ed', borderWidth:1,
          titleColor:'#1a1f2e', bodyColor:'#6b7a99', padding:12,
          callbacks: {
            afterBody: items => {
              const d = items[0]?.raw ?? 0, b = items[1]?.raw ?? 0;
              const diff = b - d;
              return ['', `Diferença: ${diff >= 0 ? '+':''}${diff}`];
            },
            labelColor: item => ({ borderColor: item.dataset.borderColor, backgroundColor: item.dataset.borderColor })
          }
        }
      },
      scales: {
        x: { grid:{color:'rgba(0,0,0,0.06)'}, ticks:{color:'#6b7a99',font:{size:10}} },
        y: { grid:{color:'rgba(0,0,0,0.06)'}, ticks:{color:'#6b7a99',font:{size:10}}, beginAtZero:true },
        y2: hasLinked
          ? { position:'right', grid:{display:false}, ticks:{color:'#a78bfa',font:{size:10}}, beginAtZero:true,
              title:{display:true,text:'Demanda (equipes)',color:'#a78bfa',font:{size:10}} }
          : { display:false }
      }
    }
  });

  // For real schedule (xlsb), use the true daily headcount stored as metadata
  const totDim  = dim.filter(r  => cSelDim.has(r.funcao)).length;
  const totBase = (window.cBaseFormat === 'B' && _base()._avgDailyWorkers)
    ? _base()._avgDailyWorkers
    : base.filter(r => cSelBase.has(r.funcao)).length;
  const diff    = totBase - totDim;
  const pkD     = Math.max(...covDim);
  const pkB     = Math.max(...covBase);

    // Coverage % and gap
  const coveragePct = totDim > 0 ? Math.round((totBase / totDim) * 100) : 0;
  const gap         = totBase - totDim;  // negative = deficit
  const gapCls      = gap >= 0 ? 'pos' : 'neg';
  const covCls      = coveragePct >= 90 ? 'pos' : coveragePct >= 70 ? 'orange' : 'neg';

  document.getElementById('c-stats').innerHTML = `
    <div class="stat">
      <div class="num o">${totDim}</div>
      <div class="lbl">Planejado</div>
    </div>
    <div class="stat">
      <div class="num g">${totBase}</div>
      <div class="lbl">${realLabel}</div>
    </div>
    <div class="stat stat-highlight">
      <div class="num ${covCls}" style="font-size:28px">${coveragePct}%</div>
      <div class="lbl">Cobertura</div>
      <div class="coverage-bar">
        <div class="coverage-fill" style="width:${Math.min(coveragePct,100)}%;background:${coveragePct>=90?'var(--green)':coveragePct>=70?'#d97706':'var(--red)'}"></div>
      </div>
    </div>
    <div class="stat">
      <div class="num ${gapCls}" style="font-size:20px">${gap >= 0 ? '+' : ''}${gap}</div>
      <div class="lbl">Gap de quadro</div>
    </div>
    <div class="stat">
      <div class="num o">${pkD}</div>
      <div class="lbl">Pico planejado</div>
    </div>
    <div class="stat">
      <div class="num g">${pkB}</div>
      <div class="lbl">Pico ${realLabel}</div>
    </div>
  `;
}

function cToggleVincular() {
  if (!cDataEquipes) return;
  cVinculado = !cVinculado;
  const btn = document.getElementById('c-vincular-btn');
  if (cVinculado) {
    btn.style.background = 'rgba(167,139,250,0.22)';
    btn.style.borderColor = '#a78bfa';
    btn.textContent = 'Vinculado ao gráfico principal';
  } else {
    btn.style.background = 'rgba(167,139,250,0.08)';
    btn.style.borderColor = 'rgba(167,139,250,0.25)';
    btn.textContent = 'Vincular ao gráfico principal';
  }
  cUpdateChart();
}

// ══════════════════════════════════════════════════════
// CHART 2 — ENTRADAS POR HORA
// ══════════════════════════════════════════════════════
function cUpdateChartEntrada() {
  const dim      = _dim();
  const base     = _base();
  const labels   = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2,'0')}:00`);
  const entDim   = entradas(dim,  cSelDim);
  const entBase  = entradas(base, cSelBase);
  const realLabel = window.cBaseFormat === 'B' ? `Real${window.cBaseName ? ' · ' + window.cBaseName : ''}` : 'Real';

  if (cChartEntrada) cChartEntrada.destroy();
  cChartEntrada = new Chart(document.getElementById('c-chart-entrada'), {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label:'Dimensionamento', data:entDim,  backgroundColor:'rgba(14,159,110,0.5)', borderColor:'#0e9f6e', borderWidth:1, borderRadius:3 },
        { label:realLabel,         data:entBase, backgroundColor:'rgba(26,86,219,0.5)',  borderColor:'#1a56db', borderWidth:1, borderRadius:3 }
      ]
    },
    options: {
      responsive:true, maintainAspectRatio:false,
      interaction:{mode:'index',intersect:false},
      plugins:{
        legend:{display:false},
        tooltip:{
          backgroundColor:'#fff', borderColor:'#e2e6ed', borderWidth:1,
          titleColor:'#1a1f2e', bodyColor:'#6b7a99', padding:12,
          callbacks:{ afterBody: items => { const d=items[0]?.raw??0,b=items[1]?.raw??0,diff=b-d; return ['',`Diferença: ${diff>=0?'+':''}${diff}`]; } }
        }
      },
      scales:{
        x:{grid:{display:false}, ticks:{color:'#6b7a99',font:{size:10}}},
        y:{grid:{color:'rgba(0,0,0,0.06)'}, ticks:{color:'#6b7a99',font:{size:10}}, beginAtZero:true}
      }
    }
  });
}

// ══════════════════════════════════════════════════════
// TABLE BREAKDOWN
// ══════════════════════════════════════════════════════
function cUpdateTable() {
  const dim  = _dim();
  const base = _base();
  const allFuncs = [...new Set([...dim.map(r=>r.funcao), ...base.map(r=>r.funcao)])].sort();
  const tbody = document.getElementById('c-tbody');
  tbody.innerHTML = '';
  const realLabel = window.cBaseFormat === 'B' ? 'Real' : 'Real';

  allFuncs.forEach(f => {
    [
      [dim,  'Dim',      'o'],
      [base, realLabel,  'g']
    ].forEach(([data, label, cls]) => {
      const recs = data.filter(r => r.funcao === f);
      if (!recs.length) return;
      const cov  = coverage(recs, new Set([f]));
      const peak = Math.max(...cov);
      const peakH = `${String(cov.indexOf(peak)).padStart(2,'0')}:00`;
      // For xlsb real schedule: total = peak coverage (max people at any hour)
      // which reflects the true daily headcount per function better than recs.length
      const total = (cls === 'g' && window.cBaseFormat === 'B') ? peak : recs.length;
      tbody.innerHTML += `<tr>
        <td>${f}</td>
        <td><span class="chip" style="background:rgba(${cls==='o'?'14,159,110':'26,86,219'},.1);color:var(--${cls==='o'?'green':'blue'})">${label}</span></td>
        <td class="r">${total}</td>
        <td class="r" style="color:var(--muted)">${peakH}</td>
        <td class="r">${peak}</td>
      </tr>`;
    });
  });
}

// ══════════════════════════════════════════════════════
// DEMAND CHART — MOMENTO CALOR
// ══════════════════════════════════════════════════════
const DAY_COLORS = {
  'dom':'#a78bfa','seg':'#1a56db','ter':'#38bdf8',
  'qua':'#fb923c','qui':'#f472b6','sex':'#facc15','sab':'#94a3b8'
};
const MAX_COLOR = '#ff4560';
let cDemandChart = null;
let cDemandSel   = new Set();

function cRenderDemand() {
  if (!cDataEquipes || !cDataEquipes.length) return;
  document.getElementById('c-demand-wrap').style.display = 'block';
  if (cDemandSel.size === 0) cDataEquipes.forEach(d => cDemandSel.add(d.label));
  const tagsEl = document.getElementById('c-demand-tags');
  tagsEl.innerHTML = '';
  const allTag = document.createElement('span');
  allTag.className   = `tag tall${cDemandSel.size === cDataEquipes.length ? ' on' : ''}`;
  allTag.textContent = 'Todos';
  allTag.onclick = () => {
    cDemandSel.size === cDataEquipes.length ? cDemandSel.clear() : cDataEquipes.forEach(d => cDemandSel.add(d.label));
    syncDemandTags(); cBuildDemandChart();
  };
  tagsEl.appendChild(allTag);
  cDataEquipes.forEach(d => {
    const isMax = d.label.toLowerCase().startsWith('m');
    const color = isMax ? MAX_COLOR : (DAY_COLORS[d.label.toLowerCase().slice(0,3)] || '#888');
    const t = document.createElement('span');
    t.className = `tag${cDemandSel.has(d.label) ? ' on' : ''}`;
    t.style.cssText = cDemandSel.has(d.label)
      ? `background:${color}22;border:1px solid ${color};color:${color}`
      : `background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.1);color:var(--muted)`;
    t.textContent = d.label;
    t.onclick = () => { cDemandSel.has(d.label) ? cDemandSel.delete(d.label) : cDemandSel.add(d.label); syncDemandTags(); cBuildDemandChart(); };
    tagsEl.appendChild(t);
  });
  function syncDemandTags() {
    tagsEl.querySelectorAll('.tag:not(:first-child)').forEach((t,i) => {
      const d = cDataEquipes[i];
      const isMax = d.label.toLowerCase().startsWith('m');
      const color = isMax ? MAX_COLOR : (DAY_COLORS[d.label.toLowerCase().slice(0,3)] || '#888');
      const on = cDemandSel.has(d.label);
      t.className = `tag${on?' on':''}`;
      t.style.cssText = on
        ? `background:${color}22;border:1px solid ${color};color:${color}`
        : `background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.1);color:var(--muted)`;
    });
    allTag.classList.toggle('on', cDemandSel.size === cDataEquipes.length);
    if (cVinculado) cUpdateChart();
  }
  cBuildDemandChart();
}

function cBuildDemandChart() {
  const labels = Array.from({length:144}, (_,i) => {
    const h=Math.floor(i/6), m=(i%6)*10;
    return m===0 ? `${String(h).padStart(2,'0')}:00` : '';
  });
  const datasets = cDataEquipes.filter(d => cDemandSel.has(d.label)).map(d => {
    const isMax = d.label.toLowerCase().startsWith('m');
    const color = isMax ? MAX_COLOR : (DAY_COLORS[d.label.toLowerCase().slice(0,3)] || '#888');
    return { label:d.label, data:d.slots, borderColor:color, backgroundColor:'transparent',
      borderWidth:isMax?2.5:1.5, borderDash:isMax?[5,3]:[], pointRadius:0, pointHoverRadius:4, tension:0.3, fill:false };
  });
  if (cDemandChart) cDemandChart.destroy();
  cDemandChart = new Chart(document.getElementById('c-demand-chart'), {
    type:'line', data:{labels,datasets},
    options:{
      responsive:true, maintainAspectRatio:false,
      interaction:{mode:'index',intersect:false},
      plugins:{
        legend:{display:false},
        tooltip:{
          backgroundColor:'#141720', borderColor:'#1e2330', borderWidth:1,
          titleColor:'#e8eaf0', bodyColor:'#6b7a99', padding:12,
          callbacks:{
            title: items => { const i=items[0].dataIndex; return `${String(Math.floor(i/6)).padStart(2,'0')}:${String((i%6)*10).padStart(2,'0')}`; },
            labelColor: item => ({ borderColor:item.dataset.borderColor, backgroundColor:item.dataset.borderColor })
          }
        }
      },
      scales:{
        x:{grid:{color:'rgba(0,0,0,0.06)'}, ticks:{color:'#6b7a99',font:{size:10},maxRotation:0,autoSkip:false}},
        y:{grid:{color:'rgba(0,0,0,0.06)'}, ticks:{color:'#6b7a99',font:{size:10}}, beginAtZero:true,
          title:{display:true,text:'Equipes simultâneas',color:'#6b7a99',font:{size:10}}}
      }
    }
  });
}

// ══════════════════════════════════════════════════════
// DRAG & DROP CARDS
// ══════════════════════════════════════════════════════
let _dragInit = false;

function initDrag() {
  const container = document.getElementById('c-cards');
  if (!container) return;
  let dragged = null;
  container.addEventListener('dragstart', e => {
    const card = e.target.closest('.draggable');
    if (!card) return;
    dragged=card; card.classList.add('dragging');
    e.dataTransfer.effectAllowed='move'; e.dataTransfer.setData('text/plain','');
  });
  container.addEventListener('dragend', () => {
    if (dragged) dragged.classList.remove('dragging');
    container.querySelectorAll('.drag-over-top,.drag-over-bottom').forEach(el=>el.classList.remove('drag-over-top','drag-over-bottom'));
    dragged=null;
  });
  container.addEventListener('dragover', e => {
    e.preventDefault();
    const target = e.target.closest('.draggable');
    if (!target||target===dragged) return;
    container.querySelectorAll('.drag-over-top,.drag-over-bottom').forEach(el=>el.classList.remove('drag-over-top','drag-over-bottom'));
    target.classList.add(e.clientY < target.getBoundingClientRect().top+target.getBoundingClientRect().height/2 ? 'drag-over-top':'drag-over-bottom');
  });
  container.addEventListener('dragleave', e => { const t=e.target.closest('.draggable'); if(t) t.classList.remove('drag-over-top','drag-over-bottom'); });
  container.addEventListener('drop', e => {
    e.preventDefault();
    const target=e.target.closest('.draggable');
    if (!target||target===dragged||!dragged) return;
    const before=e.clientY<target.getBoundingClientRect().top+target.getBoundingClientRect().height/2;
    target.classList.remove('drag-over-top','drag-over-bottom');
    container.insertBefore(dragged, before?target:target.nextSibling);
    setTimeout(()=>{ if(cChart) cChart.resize(); if(cChartEntrada) cChartEntrada.resize(); if(cDemandChart) cDemandChart.resize(); },50);
  });
  container.querySelectorAll('.draggable').forEach(card => {
    card.draggable=false;
    const handle=card.querySelector('.drag-handle');
    if (!handle) return;
    handle.addEventListener('mousedown',()=>{card.draggable=true;});
    handle.addEventListener('mouseleave',()=>{if(!dragged)card.draggable=false;});
    card.addEventListener('dragend',()=>{card.draggable=false;});
  });
}
