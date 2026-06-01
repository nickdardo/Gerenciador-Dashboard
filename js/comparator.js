// ══════════════════════════════════════════════════════
// PAGE 2 — COMPARADOR
// ══════════════════════════════════════════════════════
// Supports two escala formats as "Escala Base":
//   Format A — ESCALA-BASE-*.xlsx  (original: col10=funcao, col11=entrada, col12=saida)
//   Format B — *_ESCALA_*.xlsb     (real schedule: BEL_ESCALA MATRIZ + HORARIOS sheets)

let cDataBase     = null;
let cDataDim      = null;
let cDataEquipes  = null;
let cChart        = null;
let cChartEntrada = null;
let cSelBase      = new Set();
let cSelDim       = new Set();
let cVinculado    = false;
let cBaseFormat   = null;   // 'A' | 'B' — detected on upload
let cBaseName     = null;   // base sigla from file (BEL, GRU, etc.)

// ── Drop zone wiring ──────────────────────────────────
setupDrop('c-drop1', 'c-file1', file => {
  document.getElementById('c-fname1').innerHTML = `<div class="file-pill">${file.name}</div>`;
  document.getElementById('c-drop1').classList.add('has-file-g');
  readXlsx(file, (wb, err) => {
    if (err || !wb) {
      document.getElementById('c-fname1').innerHTML += `<div style="color:var(--red);font-size:11px;margin-top:4px">Erro ao ler arquivo</div>`;
      return;
    }
    // Detect format
    const hasMatriz = wb.SheetNames.some(s => s.toLowerCase().includes('matriz'));
    if (hasMatriz) {
      cBaseFormat = 'B';
      cDataBase   = cParseEscalaReal(wb);
    } else {
      cBaseFormat = 'A';
      cDataBase   = cParseBase(wb);
    }
    // Show format badge
    const fmtLabel = cBaseFormat === 'B' ? 'Escala Real (xlsb)' : 'Escala Base (xlsx)';
    document.getElementById('c-fmt1').textContent = fmtLabel;
    document.getElementById('c-fmt1').style.display = 'inline-block';
    // Detect and show base
    cBaseName = detectBase(wb);
    if (cBaseName) setBaseBadge(cBaseName);
    cCheckReady();
  });
});

setupDrop('c-drop2', 'c-file2', file => {
  document.getElementById('c-fname2').innerHTML = `<div class="file-pill">${file.name}</div>`;
  document.getElementById('c-drop2').classList.add('has-file-o');
  readXlsx(file, wb => {
    cDataDim = cParseDim(wb);
    if (!cBaseName) {
      const base = detectBase(wb);
      if (base) { cBaseName = base; setBaseBadge(base); }
    }
    cCheckReady();
  });
});

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
  const btn = document.getElementById('c-btn');
  if (cDataBase && cDataDim) {
    btn.disabled    = false;
    btn.textContent = 'Comparar';
  }
}

// ══════════════════════════════════════════════════════
// PARSERS
// ══════════════════════════════════════════════════════

/**
 * FORMAT A — Escala Base (xlsx)
 * col 10 = funcao, col 11 = entrada, col 12 = saida. Data from row 3.
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
 * Reads "HORARIOS" sheet to build code→{entrada,saida} map.
 * Reads "BEL_ESCALA MATRIZ" (or any sheet with "MATRIZ" in name):
 *   MATRICULA | COLABORADOR | ESCALA | TURNO | D1 | C1 | ... | D31 | C31 | ... | BASE
 * Skip codes: 9996 (folga), 9997, 9998 (FA), 9999 (DSR), 8882-8888 (férias), 6662-6667 (maternidade), 7772-7777 (INSS)
 * Uses "BANCO DE DADOS" sheet to map ESCALA code → cargo/funcao.
 */
function cParseEscalaReal(wb) {
  // ── 1. Build horario map: code → { entrada (min), saida (min) }
  const horarioMap = {};
  const horSheet = wb.SheetNames.find(s => s.toUpperCase().includes('HORARIO'));
  if (horSheet) {
    const ws   = wb.Sheets[horSheet];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });
    for (let i = 3; i < rows.length; i++) {
      const r = rows[i];
      if (!r || r[0] === null) continue;
      const code    = typeof r[0] === 'number' ? Math.round(r[0]) : String(r[0]);
      const entStr  = r[5];
      const saiStr  = r[6];
      const entMin  = toMinutes(entStr);
      const saiMin  = toMinutes(saiStr);
      if (entMin !== null && saiMin !== null) {
        horarioMap[code] = { entrada: entMin, saida: saiMin };
      }
    }
  }

  // ── 2. Build cargo map from BANCO DE DADOS: matricula → funcao
  const cargoMap = {};
  const dbSheet = wb.SheetNames.find(s => s.toUpperCase().includes('BANCO'));
  if (dbSheet) {
    const ws   = wb.Sheets[dbSheet];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });
    for (let i = 3; i < rows.length; i++) {
      const r = rows[i];
      if (!r || !r[0]) continue;
      const mat   = Math.round(r[0]);
      // col 7 = simplified cargo name, col 9 = funcao operacional
      const cargo = r[7] || r[3] || '';
      if (mat && cargo) cargoMap[mat] = String(cargo).trim();
    }
  }

  // ── 3. Codes to skip (folga, férias, DSR, afastamentos)
  const SKIP_CODES = new Set([
    9996, 9997, 9998, 9999,
    8882, 8883, 8884, 8885, 8886, 8887, 8888,
    6662, 6663, 6664, 6665, 6666, 6667,
    7772, 7773, 7774, 7775, 7776, 7777
  ]);

  // ── 4. Parse the MATRIZ sheet
  const matrizSheet = wb.SheetNames.find(s => s.toUpperCase().includes('MATRIZ'));
  if (!matrizSheet) return [];

  const ws   = wb.Sheets[matrizSheet];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });
  const out  = [];

  // Find header row to locate D/C column pairs
  const header = rows[0] || [];
  // D1 starts at col 4; pattern is D1,C1,D2,C2,...D31,C31
  // Header: MATRICULA(0) COLABORADOR(1) ESCALA(2) TURNO(3) D1(4) C1(5) D2(6) C2(7)...
  const COL_MAT  = 0;
  const COL_NOME = 1;
  const COL_D1   = 4; // first date column

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || !r[COL_MAT]) continue;
    const mat   = Math.round(r[COL_MAT]);
    const nome  = String(r[COL_NOME] || '');
    const cargo = cargoMap[mat] || String(r[2] || '');

    // Iterate through up to 31 day pairs
    for (let d = 0; d < 31; d++) {
      const colC = COL_D1 + d * 2 + 1;  // code column
      if (colC >= r.length) break;

      const rawCode = r[colC];
      if (rawCode === null || rawCode === undefined) continue;

      // Normalise code to number
      let code;
      if (typeof rawCode === 'number') {
        code = Math.round(rawCode);
      } else if (typeof rawCode === 'string') {
        const n = parseInt(rawCode.replace(/[^0-9]/g, ''), 10);
        code = isNaN(n) ? rawCode : n;
      } else {
        continue;
      }

      if (SKIP_CODES.has(code)) continue;

      const horario = horarioMap[code];
      if (!horario) continue;

      out.push({
        matricula: mat,
        colaborador: nome,
        setor: cargo,
        funcao: cargo,
        entrada: horario.entrada,
        saida:   horario.saida,
      });
    }
  }

  return out;
}

/**
 * FORMAT C — Escala Dimensionamento (gerada pelo Gerador)
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
 * Parse "Equipes em atendimento por dia da semana" from Dimensionamento file.
 * Rows 31–38 (0-indexed): col 4 = day label, cols 5–148 = 10-min slots.
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
    if (!['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'máx', 'max'].some(d => lc.startsWith(d.slice(0, 3)))) continue;
    const slots = [];
    for (let s = 0; s < 144; s++) {
      const c = 5 + s;
      const v = c < row.length ? row[c] : null;
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
  if (!cDataBase || !cDataDim) return;

  const funcsBase = [...new Set(cDataBase.map(r => r.funcao))].sort();
  const funcsDim  = [...new Set(cDataDim.map(r => r.funcao))].sort();

  cSelBase = new Set(funcsBase);
  cSelDim  = new Set(funcsDim);

  // Label the base escala by format
  const baseLabel = cBaseFormat === 'B'
    ? `Escala Real${cBaseName ? ' · ' + cBaseName : ''}`
    : 'Escala Real';

  buildTags('c-tags-base', funcsBase, cSelBase, 'tg', () => { cUpdateChart(); cUpdateChartEntrada(); });
  buildTags('c-tags-dim',  funcsDim,  cSelDim,  'to', () => { cUpdateChart(); cUpdateChartEntrada(); });

  // Update section labels
  document.getElementById('c-base-label').textContent  = baseLabel;
  document.getElementById('c-base-label2').textContent = baseLabel;

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
  const labels  = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2,'0')}:00`);
  const covBase = coverage(cDataBase, cSelBase);
  const covDim  = coverage(cDataDim,  cSelDim);

  const baseLabel = cBaseFormat === 'B' ? `Real${cBaseName ? ' · ' + cBaseName : ''}` : 'Base';

  const datasets = [
    {
      label: baseLabel,
      data: covBase,
      borderColor: '#1a56db',
      backgroundColor: 'rgba(26,86,219,0.07)',
      borderWidth: 2.5, pointRadius: 3, pointHoverRadius: 5,
      tension: 0.35, fill: true, yAxisID: 'y'
    },
    {
      label: 'Dimensionamento',
      data: covDim,
      borderColor: '#0e9f6e',
      backgroundColor: 'rgba(14,159,110,0.07)',
      borderWidth: 2.5, borderDash: [6, 3],
      pointRadius: 3, pointHoverRadius: 5,
      tension: 0.35, fill: true, yAxisID: 'y'
    }
  ];

  if (cVinculado && cDataEquipes && cDemandSel.size > 0) {
    cDataEquipes.filter(d => cDemandSel.has(d.label)).forEach(d => {
      const isMax = d.label.toLowerCase().startsWith('m');
      const color = isMax ? '#ff4560' : (DAY_COLORS[d.label.toLowerCase().slice(0, 3)] || '#888');
      const hourly = Array.from({ length: 24 }, (_, h) => {
        const slice = d.slots.slice(h * 6, h * 6 + 6).filter(v => v > 0);
        return slice.length ? Math.round(slice.reduce((a, b) => a + b, 0) / slice.length * 10) / 10 : 0;
      });
      datasets.push({
        label: `Demanda (${d.label})`,
        data: hourly,
        borderColor: color, backgroundColor: 'transparent',
        borderWidth: isMax ? 2 : 1.5, borderDash: [3, 3],
        pointRadius: 0, pointHoverRadius: 4,
        tension: 0.3, fill: false, yAxisID: 'y2'
      });
    });
  }

  const hasLinked = cVinculado && cDataEquipes && cDemandSel.size > 0;
  const legEl = document.getElementById('c-leg-demand');
  if (legEl) {
    legEl.style.display = hasLinked ? 'flex' : 'none';
    if (hasLinked) document.getElementById('c-leg-demand-txt').textContent = `Demanda (${[...cDemandSel].join(', ')})`;
  }
  // Update legend label
  const legBase = document.getElementById('c-leg-base-txt');
  if (legBase) legBase.textContent = baseLabel;

  if (cChart) cChart.destroy();
  cChart = new Chart(document.getElementById('c-chart'), {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#fff', borderColor: '#e2e6ed', borderWidth: 1,
          titleColor: '#1a1f2e', bodyColor: '#6b7a99', padding: 12,
          callbacks: {
            afterBody: items => {
              const b = items[0]?.raw ?? 0, d = items[1]?.raw ?? 0;
              const diff = d - b;
              return ['', `Diferença: ${diff >= 0 ? '+' : ''}${diff}`];
            },
            labelColor: item => ({ borderColor: item.dataset.borderColor, backgroundColor: item.dataset.borderColor })
          }
        }
      },
      scales: {
        x: { grid: { color: 'rgba(0,0,0,0.06)' }, ticks: { color: '#6b7a99', font: { size: 10 } } },
        y: { grid: { color: 'rgba(0,0,0,0.06)' }, ticks: { color: '#6b7a99', font: { size: 10 } }, beginAtZero: true },
        y2: hasLinked
          ? { position: 'right', grid: { display: false }, ticks: { color: '#a78bfa', font: { size: 10 } }, beginAtZero: true, title: { display: true, text: 'Demanda (equipes)', color: '#a78bfa', font: { size: 10 } } }
          : { display: false }
      }
    }
  });

  const totBase = cDataBase.filter(r => cSelBase.has(r.funcao)).length;
  const totDim  = cDataDim.filter(r => cSelDim.has(r.funcao)).length;
  const diff    = totDim - totBase;
  const pkB     = Math.max(...covBase);
  const pkD     = Math.max(...covDim);

  document.getElementById('c-stats').innerHTML = `
    <div class="stat"><div class="num g">${totBase}</div><div class="lbl">${baseLabel}</div></div>
    <div class="stat"><div class="num o">${totDim}</div><div class="lbl">Dimensionamento</div></div>
    <div class="stat"><div class="num ${diff > 0 ? 'pos' : diff < 0 ? 'neg' : 'neu'}">${diff >= 0 ? '+' : ''}${diff}</div><div class="lbl">Diferença</div></div>
    <div class="stat"><div class="num g">${pkB}</div><div class="lbl">Pico ${baseLabel}</div></div>
    <div class="stat"><div class="num o">${pkD}</div><div class="lbl">Pico Dimensionamento</div></div>
  `;
}

function cToggleVincular() {
  if (!cDataEquipes) return;
  cVinculado = !cVinculado;
  const btn = document.getElementById('c-vincular-btn');
  if (cVinculado) {
    btn.style.background  = 'rgba(167,139,250,0.22)';
    btn.style.borderColor = '#a78bfa';
    btn.textContent       = 'Vinculado ao gráfico principal';
  } else {
    btn.style.background  = 'rgba(167,139,250,0.08)';
    btn.style.borderColor = 'rgba(167,139,250,0.25)';
    btn.textContent       = 'Vincular ao gráfico principal';
  }
  cUpdateChart();
}

// ══════════════════════════════════════════════════════
// CHART 2 — ENTRADAS POR HORA
// ══════════════════════════════════════════════════════
function cUpdateChartEntrada() {
  const labels  = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2,'0')}:00`);
  const entBase = entradas(cDataBase, cSelBase);
  const entDim  = entradas(cDataDim,  cSelDim);
  const baseLabel = cBaseFormat === 'B' ? `Real${cBaseName ? ' · ' + cBaseName : ''}` : 'Base';

  if (cChartEntrada) cChartEntrada.destroy();
  cChartEntrada = new Chart(document.getElementById('c-chart-entrada'), {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: baseLabel,         data: entBase, backgroundColor: 'rgba(26,86,219,0.5)',  borderColor: '#1a56db', borderWidth: 1, borderRadius: 3 },
        { label: 'Dimensionamento', data: entDim,  backgroundColor: 'rgba(14,159,110,0.5)', borderColor: '#0e9f6e', borderWidth: 1, borderRadius: 3 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#fff', borderColor: '#e2e6ed', borderWidth: 1,
          titleColor: '#1a1f2e', bodyColor: '#6b7a99', padding: 12,
          callbacks: {
            afterBody: items => {
              const b = items[0]?.raw ?? 0, d = items[1]?.raw ?? 0;
              const diff = d - b;
              return ['', `Diferença: ${diff >= 0 ? '+' : ''}${diff}`];
            }
          }
        }
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#6b7a99', font: { size: 10 } } },
        y: { grid: { color: 'rgba(0,0,0,0.06)' }, ticks: { color: '#6b7a99', font: { size: 10 } }, beginAtZero: true }
      }
    }
  });
}

// ══════════════════════════════════════════════════════
// TABLE BREAKDOWN
// ══════════════════════════════════════════════════════
function cUpdateTable() {
  const allFuncs = [...new Set([...cDataBase.map(r => r.funcao), ...cDataDim.map(r => r.funcao)])].sort();
  const tbody    = document.getElementById('c-tbody');
  tbody.innerHTML = '';
  const baseLabel = cBaseFormat === 'B' ? `Real` : 'Base';

  allFuncs.forEach(f => {
    [[cDataBase, baseLabel, 'g'], [cDataDim, 'Dim', 'o']].forEach(([data, label, cls]) => {
      const recs = data.filter(r => r.funcao === f);
      if (!recs.length) return;
      const cov  = coverage(recs, new Set([f]));
      const peak = Math.max(...cov);
      const peakH = `${String(cov.indexOf(peak)).padStart(2,'0')}:00`;
      tbody.innerHTML += `<tr>
        <td>${f}</td>
        <td><span class="chip" style="background:rgba(${cls === 'g' ? '26,86,219' : '14,159,110'},.1);color:var(--${cls === 'g' ? 'blue' : 'green'})">${label}</span></td>
        <td class="r">${recs.length}</td>
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
  'dom': '#a78bfa', 'seg': '#1a56db', 'ter': '#38bdf8',
  'qua': '#fb923c', 'qui': '#f472b6', 'sex': '#facc15', 'sab': '#94a3b8',
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
    const color = isMax ? MAX_COLOR : (DAY_COLORS[d.label.toLowerCase().slice(0, 3)] || '#888');
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
    const tags = tagsEl.querySelectorAll('.tag:not(:first-child)');
    tags.forEach((t, i) => {
      const d = cDataEquipes[i];
      const isMax = d.label.toLowerCase().startsWith('m');
      const color = isMax ? MAX_COLOR : (DAY_COLORS[d.label.toLowerCase().slice(0, 3)] || '#888');
      const on = cDemandSel.has(d.label);
      t.className = `tag${on ? ' on' : ''}`;
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
  const labels = Array.from({ length: 144 }, (_, i) => {
    const h = Math.floor(i / 6), m = (i % 6) * 10;
    return m === 0 ? `${String(h).padStart(2,'0')}:00` : '';
  });

  const datasets = cDataEquipes
    .filter(d => cDemandSel.has(d.label))
    .map(d => {
      const isMax = d.label.toLowerCase().startsWith('m');
      const color = isMax ? MAX_COLOR : (DAY_COLORS[d.label.toLowerCase().slice(0, 3)] || '#888');
      return {
        label: d.label, data: d.slots,
        borderColor: color, backgroundColor: 'transparent',
        borderWidth: isMax ? 2.5 : 1.5, borderDash: isMax ? [5, 3] : [],
        pointRadius: 0, pointHoverRadius: 4, tension: 0.3, fill: false,
      };
    });

  if (cDemandChart) cDemandChart.destroy();
  cDemandChart = new Chart(document.getElementById('c-demand-chart'), {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#141720', borderColor: '#1e2330', borderWidth: 1,
          titleColor: '#e8eaf0', bodyColor: '#6b7a99', padding: 12,
          callbacks: {
            title: items => {
              const i = items[0].dataIndex;
              return `${String(Math.floor(i/6)).padStart(2,'0')}:${String((i%6)*10).padStart(2,'0')}`;
            },
            labelColor: item => ({ borderColor: item.dataset.borderColor, backgroundColor: item.dataset.borderColor })
          }
        }
      },
      scales: {
        x: { grid: { color: 'rgba(0,0,0,0.06)' }, ticks: { color: '#6b7a99', font: { size: 10 }, maxRotation: 0, autoSkip: false } },
        y: { grid: { color: 'rgba(0,0,0,0.06)' }, ticks: { color: '#6b7a99', font: { size: 10 } }, beginAtZero: true,
          title: { display: true, text: 'Equipes simultâneas', color: '#6b7a99', font: { size: 10 } } }
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
    dragged = card; card.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', '');
  });
  container.addEventListener('dragend', () => {
    if (dragged) dragged.classList.remove('dragging');
    container.querySelectorAll('.drag-over-top,.drag-over-bottom').forEach(el => el.classList.remove('drag-over-top','drag-over-bottom'));
    dragged = null;
  });
  container.addEventListener('dragover', e => {
    e.preventDefault();
    const target = e.target.closest('.draggable');
    if (!target || target === dragged) return;
    container.querySelectorAll('.drag-over-top,.drag-over-bottom').forEach(el => el.classList.remove('drag-over-top','drag-over-bottom'));
    const rect = target.getBoundingClientRect();
    target.classList.add(e.clientY < rect.top + rect.height / 2 ? 'drag-over-top' : 'drag-over-bottom');
  });
  container.addEventListener('dragleave', e => {
    const target = e.target.closest('.draggable');
    if (target) target.classList.remove('drag-over-top','drag-over-bottom');
  });
  container.addEventListener('drop', e => {
    e.preventDefault();
    const target = e.target.closest('.draggable');
    if (!target || target === dragged || !dragged) return;
    const before = e.clientY < target.getBoundingClientRect().top + target.getBoundingClientRect().height / 2;
    target.classList.remove('drag-over-top','drag-over-bottom');
    container.insertBefore(dragged, before ? target : target.nextSibling);
    setTimeout(() => {
      if (cChart)        cChart.resize();
      if (cChartEntrada) cChartEntrada.resize();
      if (cDemandChart)  cDemandChart.resize();
    }, 50);
  });
  container.querySelectorAll('.draggable').forEach(card => {
    card.draggable = false;
    const handle = card.querySelector('.drag-handle');
    if (!handle) return;
    handle.addEventListener('mousedown',  () => { card.draggable = true; });
    handle.addEventListener('mouseleave', () => { if (!dragged) card.draggable = false; });
    card.addEventListener('dragend',      () => { card.draggable = false; });
  });
}
