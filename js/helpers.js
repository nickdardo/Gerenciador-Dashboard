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
/* ══════════════════════════════════════════════════════
   O mês do dimensionamento está dentro do arquivo

   O Gerador pedia o mês num seletor cujo padrão era o PRÓXIMO mês. Em
   novembro, isso significa dezembro — então um arquivo de novembro era
   salvo como dezembro, e a Escala Capacity de novembro ficava sem malha
   enquanto a de dezembro recebia horários que ninguém pediu. O sintoma
   aparecia longe da causa: horários "que não existem no dimensionamento".

   O arquivo sempre soube a resposta. Ele traz "Período" com a primeira
   data do mês e, logo abaixo, "pior semana" no formato 2026-11 {24 a 30}.
   Lemos os dois, na mesma região de cabeçalho que detectBase já varre.

   O sistema de datas de 1904 é conferido: nesse sistema as seriais ficam
   1462 dias à frente, e um arquivo feito no Excel para Mac devolveria o
   mês errado sem dar nenhum sinal.
   ══════════════════════════════════════════════════════ */
function detectMes(wb) {
  if (!wb) return null;
  const d1904 = !!(wb.Workbook && wb.Workbook.WBProps && wb.Workbook.WBProps.date1904);

  const deSerial = (n) => {
    if (!(n > 20000 && n < 80000)) return null;   // fora disso não é data
    /* Arredonda para o DIA inteiro antes de converter. Uma data gravada
       como 1º do mês às 00:00 em fuso negativo vira serial fracionário
       (…,875) e, convertida direto, cai no último dia do mês anterior —
       e "Período" é justamente o primeiro dia do mês, o valor mais
       provável de aparecer aqui. */
    const dias = Math.round(n + (d1904 ? 1462 : 0) - 25569);
    const d = new Date(dias * 86400000);
    if (isNaN(d.getTime())) return null;
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  };

  const deTexto = (t) => {
    const s = String(t);
    let m = s.match(/(\d{4})-(\d{1,2})\b/);                 // 2026-11 {24 a 30}
    if (m) return `${m[1]}-${String(+m[2]).padStart(2, '0')}`;
    m = s.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);      // 01/11/2026
    if (m) return `${m[3]}-${String(+m[2]).padStart(2, '0')}`;
    return null;
  };

  const valor = (cel) => {
    if (cel instanceof Date && !isNaN(cel.getTime())) {
      return `${cel.getFullYear()}-${String(cel.getMonth() + 1).padStart(2, '0')}`;
    }
    if (typeof cel === 'number') return deSerial(cel);
    if (typeof cel === 'string' && cel.trim()) return deTexto(cel);
    return null;
  };

  // "Período" é a fonte preferida; "pior semana" confirma e serve de reserva.
  const rotulos = [/^per[ií]odo$/i, /pior\s+semana/i, /^m[eê]s$/i];

  for (const rot of rotulos) {
    for (const sheetName of wb.SheetNames) {
      const ws = wb.Sheets[sheetName];
      let data;
      try { data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, range: 0 }); }
      catch (_) { continue; }
      for (let ri = 0; ri <= Math.min(14, data.length - 1); ri++) {
        const row = data[ri];
        if (!row) continue;
        for (let ci = 0; ci < Math.min(row.length, 12); ci++) {
          const cel = row[ci];
          if (typeof cel !== 'string' || !rot.test(cel.trim())) continue;
          /* O valor costuma estar na célula ao lado, mas a planilha usa
             células mescladas e linhas de rótulo alto — por isso olha
             também as duas seguintes e a linha de baixo. */
          const candidatos = [row[ci + 1], row[ci + 2], row[ci + 3],
                              (data[ri + 1] || [])[ci + 1]];
          for (const c of candidatos) {
            const m = valor(c);
            if (m) return m;
          }
        }
      }
    }
  }
  return null;
}

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
