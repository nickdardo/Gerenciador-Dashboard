// ══════════════════════════════════════════════════════
// PAGE 1 — GERADOR DE ESCALA
// ══════════════════════════════════════════════════════
// Reads any Dimensionamento_*.xlsx regardless of airport/operation.
// Automatically detects BASE sigla from the file and shows it in the UI.

let gFile = null;
let gRows = [];
let gBase = null;

// ── Wire up drop zone ─────────────────────────────────
setupDrop('g-drop', 'g-file', file => {
  gFile = file;
  document.getElementById('g-fname').innerHTML = `<div class="file-pill">${file.name}</div>`;
  document.getElementById('g-drop').classList.add('has-file-g');
  document.getElementById('g-btn').disabled = false;
  setStatus('g', null);
  document.getElementById('g-result').style.display = 'none';

  // Quick pre-read to detect base before user clicks Generate
  readXlsx(file, wb => {
    gBase = detectBase(wb);
    setBaseBadge(gBase);
    if (gBase) {
      document.getElementById('g-base-info').textContent = `Base detectada: ${gBase}`;
      document.getElementById('g-base-info').style.display = 'block';
    } else {
      document.getElementById('g-base-info').style.display = 'none';
    }
  });
});

// ── Generate ──────────────────────────────────────────
function gGenerate() {
  if (!gFile) return;
  setStatus('g', 'load', 'Lendo arquivo...');
  setTimeout(() => {
    readXlsx(gFile, wb => {
      try {
        gBase = detectBase(wb) || gBase;
        setBaseBadge(gBase);
        gRows = gParse(wb);
        gRender(gRows);
      } catch (e) {
        setStatus('g', 'err', e.message);
      }
    });
  }, 50);
}

// ── Parser ────────────────────────────────────────────
// Expected structure:
//   - One or more sheets (each = a setor/function group)
//   - Data rows start at row 100 (0-indexed: ri >= 99)
//   - Column pairs from col 5 onward: [qty, "FuncaoNome,NHh"]
//   - Optional setor override at col+6
function gParse(wb) {
  const rows = [];

  for (const sheetName of wb.SheetNames) {
    const ws   = wb.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

    for (let ri = 99; ri < data.length; ri++) {
      const row = data[ri];
      if (!row || row.length < 7) continue;

      for (let c = 5; c <= 148; c++) {
        const qty   = row[c];
        const label = row[c + 1];

        if (
          typeof qty === 'number' && qty > 0 && qty < 2000 &&
          typeof label === 'string' && /^[A-ZÁÉÍÓÚÂÊÔÃÕÇ].+,\d+[Hh]$/.test(label.trim())
        ) {
          const [fn, ch] = label.split(',');
          const funcao = fn.trim();
          const carga  = ch.trim();
          const hours  = parseInt(carga);

          // Setor: prefer explicit label at col+6, fallback to sheet name
          let setor = sheetName;
          const ms = row[c + 6];
          if (ms && typeof ms === 'string' && ms.trim() && !/,\d+[Hh]$/.test(ms)) {
            setor = ms.trim();
          }

          const startMin = (c - 5) * 10;
          const endMin   = startMin + hours * 60;
          const entrada  = fmtTime(startMin);
          const saida    = fmtTime(endMin >= 1440 ? endMin - 1440 : endMin);
          const count    = Math.round(qty);

          for (let i = 0; i < count; i++) {
            rows.push({ setor, funcao, entrada, saida, horario: `${entrada} - ${saida}`, carga, sheetName });
          }
        }
      }
    }
  }

  return rows;
}

// ── Render results ────────────────────────────────────
function gRender(rows) {
  setStatus('g', null);

  if (!rows.length) {
    setStatus('g', 'err', 'Nenhum dado encontrado. Verifique o arquivo.');
    return;
  }

  // Stats — one card per sheet + total
  const counts = {};
  rows.forEach(r => { counts[r.sheetName] = (counts[r.sheetName] || 0) + 1; });

  const baseLabel = gBase ? ` · ${gBase}` : '';
  let statsHtml = `<div class="stat"><div class="num g">${rows.length}</div><div class="lbl">Total${baseLabel}</div></div>`;
  for (const [s, c] of Object.entries(counts)) {
    statsHtml += `<div class="stat"><div class="num g">${c}</div><div class="lbl">${s}</div></div>`;
  }
  document.getElementById('g-stats').innerHTML = statsHtml;

  // Table — preview first 200 rows
  const tbody = document.getElementById('g-tbody');
  tbody.innerHTML = '';
  rows.slice(0, 200).forEach((r, i) => {
    const cls = gChipClass(r.sheetName);
    tbody.innerHTML += `<tr>
      <td style="color:var(--muted)">${i + 1}</td>
      <td><span class="chip ${cls}">${r.setor}</span></td>
      <td>${r.funcao}</td>
      <td>${r.entrada}</td>
      <td>${r.saida}</td>
      <td style="color:var(--muted)">${r.horario}</td>
      <td style="color:var(--green)">${r.carga}</td>
    </tr>`;
  });

  document.getElementById('g-note').textContent = rows.length > 200
    ? `Exibindo 200 de ${rows.length} linhas. O Excel terá todos os registros.`
    : `${rows.length} registros encontrados.`;

  document.getElementById('g-result').style.display = 'block';
  setStatus('g', 'ok', `${rows.length} linhas geradas${gBase ? ` · ${gBase}` : ''}.`);
}

// ── Send generated schedule to Comparador ────────────
/**
 * Converts gRows → cDataDim format and navigates to the Comparador tab.
 * The Comparador slot 2 (Dimensionamento) is pre-filled — user only needs
 * to upload the real schedule in slot 1.
 */
function gSendToComparator() {
  if (!gRows.length) return;

  // Convert HH:MM strings → minutes for the comparator
  const dimData = gRows.map(r => ({
    setor:   r.setor,
    funcao:  r.funcao,
    entrada: toMinutes(r.entrada),
    saida:   toMinutes(r.saida),
  })).filter(r => r.entrada !== null && r.saida !== null);

  // Inject into window — comparator.js reads from window.cDataDim
  window.cDataDim = dimData;
  if (gBase) { window.cBaseName = gBase; setBaseBadge(gBase); }

  // Update slot 1 UI (Dimensionamento) to show it's pre-filled from the generator
  const fname = gFile ? gFile.name : 'Dimensionamento';
  document.getElementById('c-fname1').innerHTML =
    `<div class="file-pill" style="background:var(--green-l);color:var(--green)">✓ ${fname}</div>`;
  document.getElementById('c-drop1').classList.add('has-file-o');

  // Check if compare button can be enabled
  if (typeof cCheckReady === 'function') cCheckReady();

  // Navigate to comparador
  showPage('comp');
}

// ── Chip colour by setor name ─────────────────────────
function gChipClass(s) {
  s = s.toUpperCase();
  if (s.includes('LIMP')) return 'chip-limpeza';
  if (s.includes('RAMP')) return 'chip-rampa';
  if (s.includes('LID'))  return 'chip-lider';
  if (s.includes('OPER')) return 'chip-operador';
  if (s.includes('TRIA')) return 'chip-triagem';
  return 'chip-default';
}

// ── Download Excel ────────────────────────────────────
function gDownload() {
  if (!gRows.length) return;

  const today    = new Date().toISOString().slice(0, 10);
  const basePart = gBase ? `_${gBase}` : '';
  const wsData   = [['SETOR', 'FUNCAO', 'ENTRADA', 'SAIDA', 'HORARIO', 'CARGA HORARIA']];
  gRows.forEach(r => wsData.push([r.setor, r.funcao, r.entrada, r.saida, r.horario, r.carga]));

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws['!cols'] = [{ wch: 28 }, { wch: 30 }, { wch: 10 }, { wch: 10 }, { wch: 16 }, { wch: 14 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'ESCALA');
  XLSX.writeFile(wb, `Escala${basePart}_${today}.xlsx`);
}

// ── Reset ─────────────────────────────────────────────
function gReset() {
  gFile = null;
  gRows = [];
  gBase = null;
  document.getElementById('g-fname').innerHTML      = '';
  document.getElementById('g-base-info').style.display = 'none';
  document.getElementById('g-btn').disabled         = true;
  document.getElementById('g-drop').className       = 'drop';
  document.getElementById('g-result').style.display = 'none';
  document.getElementById('g-file').value           = '';
  setStatus('g', null);
  setBaseBadge(null);
}
