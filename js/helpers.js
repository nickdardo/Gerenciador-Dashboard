// ══════════════════════════════════════════════════════
// NAVIGATION
// ══════════════════════════════════════════════════════
function showPage(p) {
  ['gen','comp','eo','ad'].forEach(id => {
    document.getElementById('page-' + id).classList.toggle('active', p === id);
  });
  document.getElementById('tab-gen').className  = 'nav-tab' + (p === 'gen'  ? ' active-gen'  : '');
  document.getElementById('tab-comp').className = 'nav-tab' + (p === 'comp' ? ' active-comp' : '');
  document.getElementById('tab-eo').className   = 'nav-tab' + (p === 'eo'   ? ' active-eo'   : '');
  document.getElementById('tab-ad').className   = 'nav-tab' + (p === 'ad'   ? ' active-ad'   : '');
}

// ══════════════════════════════════════════════════════
// SHARED HELPERS
// ══════════════════════════════════════════════════════

/**
 * Convert a time value to total minutes from midnight.
 * Accepts: "HH:MM" string, Excel fractional number, or null/undefined.
 */
function toMinutes(val) {
  if (val === null || val === undefined || val === '' || val === 'X') return null;
  if (typeof val === 'string') {
    const m = val.match(/(\d{1,2}):(\d{2})/);
    return m ? parseInt(m[1]) * 60 + parseInt(m[2]) : null;
  }
  if (typeof val === 'number') {
    const frac = val - Math.floor(val);
    return Math.round(frac * 24 * 60) % 1440;
  }
  return null;
}

/**
 * Format minutes from midnight as "HH:MM".
 */
function fmtTime(min) {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}

/**
 * Wire up drag-over / drop / change events for a drop-zone + file input pair.
 * onFile(File) is called when a file is selected or dropped.
 */
function setupDrop(dzId, inputId, onFile) {
  const dz  = document.getElementById(dzId);
  const inp = document.getElementById(inputId);
  dz.addEventListener('dragover',  e => { e.preventDefault(); dz.classList.add('over'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('over'));
  dz.addEventListener('drop', e => {
    e.preventDefault();
    dz.classList.remove('over');
    if (e.dataTransfer.files[0]) onFile(e.dataTransfer.files[0]);
  });
  inp.addEventListener('change', e => {
    if (e.target.files[0]) onFile(e.target.files[0]);
  });
}

/**
 * Read any spreadsheet file (xlsx, xls, xlsb) as an ArrayBuffer and parse with SheetJS.
 * SheetJS supports xlsb natively — no extra library needed.
 * cb(workbook) is called when ready.
 */
function readXlsx(file, cb) {
  const r = new FileReader();
  r.onload = e => {
    try {
      const wb = XLSX.read(e.target.result, { type: 'array' });
      cb(wb);
    } catch (err) {
      console.error('SheetJS parse error:', err);
      cb(null, err);
    }
  };
  r.readAsArrayBuffer(file);
}

/**
 * Show/hide status banners for a given prefix.
 * type: 'load' | 'ok' | 'err' | null (hides all)
 */
function setStatus(prefix, type, msg) {
  ['load', 'ok', 'err'].forEach(t => {
    document.getElementById(`${prefix}-${t}`).classList.remove('show');
  });
  if (!type) return;
  const el = document.getElementById(`${prefix}-${type}`);
  el.classList.add('show');
  if (type === 'load') document.getElementById(`${prefix}-load-txt`).textContent = msg || 'Processando...';
  if (type === 'ok')   document.getElementById(`${prefix}-ok-txt`).textContent   = msg || '';
  if (type === 'err')  document.getElementById(`${prefix}-err-txt`).textContent  = msg || '';
}

/**
 * Update the nav brand and base badge with detected base name.
 * Called by both the Gerador and the Comparador when a file is loaded.
 */
function setBaseBadge(base) {
  const badge = document.getElementById('nav-base-badge');
  if (!badge) return;
  if (base) {
    badge.textContent = base;
    badge.style.display = 'inline-flex';
  } else {
    badge.style.display = 'none';
  }
}

/**
 * Try to detect the base sigla from a SheetJS workbook.
 * Strategy 1: look for the cell pattern used in the dimensionamento
 *             (row 1, col C = sigla like "GRU", "BEL", etc.)
 * Strategy 2: look for a column named "BASE" in any sheet and
 *             return its first data value.
 * Returns string like "GRU" or null if not found.
 */
function detectBase(wb) {
  if (!wb) return null;

  // Strategy 1 — Dimensionamento format: sheet row 1 has "Base" in col B, sigla in col C
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, range: 0 });
    for (let ri = 0; ri <= Math.min(5, data.length - 1); ri++) {
      const row = data[ri];
      if (!row) continue;
      for (let ci = 0; ci < Math.min(row.length - 1, 10); ci++) {
        const cell = row[ci];
        if (typeof cell === 'string' && cell.trim().toLowerCase() === 'base') {
          const next = row[ci + 1];
          if (typeof next === 'string' && /^[A-Z]{2,4}$/.test(next.trim())) {
            return next.trim();
          }
        }
      }
    }
  }

  // Strategy 2 — Escala real (xlsb) format: column named "BASE" in any sheet
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    try {
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
      if (!rows.length) continue;
      // Find header row
      const header = rows[0];
      const baseCol = header.findIndex(h => typeof h === 'string' && h.trim().toUpperCase() === 'BASE');
      if (baseCol === -1) continue;
      // Find first data row with a value in that column
      for (let ri = 1; ri < Math.min(rows.length, 10); ri++) {
        const val = rows[ri]?.[baseCol];
        if (typeof val === 'string' && /^[A-Z]{2,4}$/.test(val.trim())) {
          return val.trim();
        }
      }
    } catch (e) { /* skip */ }
  }

  return null;
}
