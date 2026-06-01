// ══════════════════════════════════════════════════════
// NAVIGATION
// ══════════════════════════════════════════════════════
function showPage(p) {
  document.getElementById('page-gen').classList.toggle('active', p === 'gen');
  document.getElementById('page-comp').classList.toggle('active', p === 'comp');
  document.getElementById('tab-gen').className  = 'nav-tab' + (p === 'gen'  ? ' active-gen'  : '');
  document.getElementById('tab-comp').className = 'nav-tab' + (p === 'comp' ? ' active-comp' : '');
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
 * Read a File as an ArrayBuffer and parse it with SheetJS.
 * cb(workbook) is called when ready.
 */
function readXlsx(file, cb) {
  const r = new FileReader();
  r.onload = e => cb(XLSX.read(e.target.result, { type: 'array' }));
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
