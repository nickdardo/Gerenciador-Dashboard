// ══════════════════════════════════════════════════════
// PAGE 3 — ESCALA ONLINE
// ══════════════════════════════════════════════════════

let eoRows   = [];
let eoBase   = null;
let eoGroups = {};

// Per-cell state: key = "rowIdx_dayNum" → 'F' | 'FA' | '' (working)
const eoCells = {};
// Per-row collaborator names: key = rowIdx → string
const eoNames = {};
// Per-row matriculas
const eoMats  = {};
// Colaboradores lookup: matricula (string) → nome
const eoColabs = {};

// Cycle order on click: working → F → FA → working
const EO_CYCLE = { '': 'F', 'F': 'FA', 'FA': '' };
const EO_LABELS = { '': null, 'F': 'F', 'FA': 'FA' };

// ── Entry point ───────────────────────────────────────
function eoInit(rows, base) {
  eoRows   = rows;
  eoBase   = base;
  eoGroups = eoGroupRows(rows);
  eoRender();
  showPage('eo');
}

// ── Group by funcao → horário key → slot ─────────────
function eoGroupRows(rows) {
  const groups = {};
  rows.forEach(r => {
    if (!groups[r.funcao]) groups[r.funcao] = {};
    const key = `${r.entrada}-${r.saida}`;
    if (!groups[r.funcao][key]) {
      groups[r.funcao][key] = { entrada: r.entrada, saida: r.saida, horario: r.horario, carga: r.carga, count: 0 };
    }
    groups[r.funcao][key].count++;
  });
  return groups;
}

// ── Build month days array ────────────────────────────
function eoMonthDays() {
  const now    = new Date();
  const year   = now.getFullYear();
  const month  = now.getMonth();
  const total  = new Date(year, month + 1, 0).getDate();
  const today  = now.getDate();
  const SHORT  = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

  return Array.from({ length: total }, (_, i) => {
    const d   = new Date(year, month, i + 1);
    const dow = d.getDay();
    return {
      num:     i + 1,
      label:   SHORT[dow],
      isToday: (i + 1) === today,
      isSun:   dow === 0,
      isSat:   dow === 6,
    };
  });
}

// ── Turno pill colour ─────────────────────────────────
function eoTurnoStyle(entrada) {
  const h = parseInt(entrada.split(':')[0]);
  if (h >= 0  && h < 6)  return 'background:#1e293b;color:#94a3b8;';
  if (h >= 6  && h < 12) return 'background:#dbeafe;color:#1e40af;';
  if (h >= 12 && h < 18) return 'background:#dcfce7;color:#166534;';
  return 'background:#fef3c7;color:#92400e;';
}

// ── Click cell to cycle state ─────────────────────────
function eoCellClick(rowIdx, day) {
  const key     = `${rowIdx}_${day}`;
  const current = eoCells[key] || '';
  const next    = EO_CYCLE[current];
  if (next === '') {
    delete eoCells[key];
  } else {
    eoCells[key] = next;
  }
  eoPaintCell(rowIdx, day);
}

function eoPaintCell(rowIdx, day) {
  const key   = `${rowIdx}_${day}`;
  const state = eoCells[key] || '';
  const td    = document.getElementById(`eocell-${rowIdx}-${day}`);
  if (!td) return;

  // Get slot for this row
  const slot = eoSlotForRow(rowIdx);
  if (!slot) return;

  if (state === 'F') {
    td.innerHTML = `<span class="eo-badge eo-badge-f">F</span>`;
  } else if (state === 'FA') {
    td.innerHTML = `<span class="eo-badge eo-badge-fa">FA</span>`;
  } else {
    td.innerHTML = `<span class="eo-day-block" style="${eoTurnoStyle(slot.entrada)}"></span>`;
  }
}

// ── Get slot object for a given rowIdx ────────────────
function eoSlotForRow(targetIdx) {
  let rowIdx = 0;
  for (const funcao of Object.keys(eoGroups).sort()) {
    const slots = Object.values(eoGroups[funcao]).sort((a,b)=>a.entrada.localeCompare(b.entrada));
    for (const slot of slots) {
      for (let i = 0; i < slot.count; i++) {
        if (rowIdx === targetIdx) return slot;
        rowIdx++;
      }
    }
  }
  return null;
}

// ── Render full page ──────────────────────────────────
function eoRender() {
  const days = eoMonthDays();
  const now  = new Date();
  const monthLabel = now.toLocaleDateString('pt-BR', { month:'long', year:'numeric' });
  const baseLabel  = eoBase ? ` · ${eoBase}` : '';

  // Icons
  const ICO_UPLOAD = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>`;
  const ICO_MAGIC  = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 4V2"/><path d="M15 16v-2"/><path d="M8 9h2"/><path d="M20 9h2"/><path d="M17.8 11.8 19 13"/><path d="M15 9h.01"/><path d="M17.8 6.2 19 5"/><path d="m3 21 9-9"/><path d="M12.2 6.2 11 5"/></svg>`;
  const ICO_USERS  = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`;
  const ICO_TRASH  = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>`;
  const ICO_XLS    = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`;
  const ICO_PRINT  = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>`;

  // Function filter buttons
  const filterFuncoes = Object.keys(eoGroups).sort();
  const filterBar = `
    <div class="eo-filter-bar" id="eo-filter-bar">
      <span class="eo-filter-label">Filtrar:</span>
      <button class="eo-filter-btn eo-filter-all active" onclick="eoFilterAll()">Todos</button>
      ${filterFuncoes.map(f => `
        <button
          class="eo-filter-btn"
          data-funcao="${f}"
          onclick="eoFilterFunc('${f.replace(/'/g,"\\'")}', this)"
        >${f}</button>`).join('')}
    </div>`;

  // Legend
  const legend = `
    <div class="eo-legend">
      <span class="eo-legend-item"><span class="eo-badge eo-badge-f">F</span> Folga regulamentar</span>
      <span class="eo-legend-item"><span class="eo-badge eo-badge-fa">FA</span> Folga agrupada</span>
      <span class="eo-legend-item"><span class="eo-day-block" style="background:#dbeafe;width:20px;height:14px;display:inline-block;border-radius:2px;vertical-align:middle;"></span> Manhã</span>
      <span class="eo-legend-item"><span class="eo-day-block" style="background:#dcfce7;width:20px;height:14px;display:inline-block;border-radius:2px;vertical-align:middle;"></span> Tarde</span>
      <span class="eo-legend-item"><span class="eo-day-block" style="background:#fef3c7;width:20px;height:14px;display:inline-block;border-radius:2px;vertical-align:middle;"></span> Noite</span>
      <span class="eo-legend-item"><span class="eo-day-block" style="background:#1e293b;width:20px;height:14px;display:inline-block;border-radius:2px;vertical-align:middle;"></span> Madrugada</span>
      <span class="eo-legend-hint">Clique em qualquer célula para marcar/desmarcar folga</span>
    </div>`;

  let html = `
  <div class="eo-header">
    <div class="eo-header-left">
      <div class="eo-title">Escala Online<span class="eo-base-tag">${eoBase || ''}</span></div>
      <div class="eo-subtitle">Dimensionamento${baseLabel} · ${monthLabel}</div>
    </div>
    <div class="eo-header-right">
      <label class="eo-btn eo-btn-upload" title="Carregar base de colaboradores (.xlsx)">
        ${ICO_USERS} Colaboradores
        <input type="file" id="eo-colab-file" accept=".xlsx,.xls" style="display:none" onchange="eoLoadColabs(this)">
      </label>
      <span class="eo-colab-status" id="eo-colab-status"></span>
      <label class="eo-btn eo-btn-upload" title="Carregar malha aérea (.CSV)">
        ${ICO_UPLOAD} Malha
        <input type="file" accept=".csv,.CSV" style="display:none" onchange="eoLoadMalha(this)">
      </label>
      <span class="eo-colab-status" id="eo-malha-status"></span>
      <button class="eo-btn eo-btn-folgas" id="eo-auto-btn" onclick="eoAutoFolgas()" title="Distribuir folgas automaticamente pela malha" disabled>
        ${ICO_MAGIC} Gerar folgas
      </button>
      <button class="eo-btn eo-btn-sec" onclick="eoClearAll()">${ICO_TRASH} Limpar tudo</button>
      <button class="eo-btn eo-btn-xls" onclick="eoExportExcel()">${ICO_XLS} Excel</button>
      <button class="eo-btn eo-btn-print" onclick="window.print()">${ICO_PRINT} Imprimir</button>
    </div>
  </div>
  ${legend}
  ${filterBar}
  <div class="eo-wrap">
    <table class="eo-table">
      <thead>
        <tr>
          <th class="eo-th eo-col-func">Função</th>
          <th class="eo-th eo-col-horario">Horário</th>
          <th class="eo-th eo-col-carga">CH</th>
          <th class="eo-th eo-col-fa" title="Folga Agrupada">FA</th>
          <th class="eo-th eo-col-mat">Matrícula</th>
          <th class="eo-th eo-col-nome">Colaborador</th>
          ${days.map(d => `
            <th class="eo-th eo-col-day${d.isToday ? ' eo-today' : ''}${d.isSun||d.isSat ? ' eo-weekend' : ''}">
              <span class="eo-day-name">${d.label}</span>
              <span class="eo-day-num">${d.num}</span>
            </th>`).join('')}
        </tr>
      </thead>
      <tbody>`;

  let rowIdx = 0;
  const funcoes = Object.keys(eoGroups).sort();

  funcoes.forEach(funcao => {
    const slots    = Object.values(eoGroups[funcao]).sort((a,b)=>a.entrada.localeCompare(b.entrada));
    const totalFunc = slots.reduce((s,slot) => s + slot.count, 0);

    html += `
        <tr class="eo-funcao-row">
          <td colspan="${4 + days.length}" class="eo-funcao-label">
            ${funcao}
            <span class="eo-funcao-count">${totalFunc} posições</span>
          </td>
        </tr>`;

    slots.forEach(slot => {
      for (let i = 0; i < slot.count; i++) {
        const rid    = rowIdx;
        const isEven = rowIdx % 2 === 0;

        html += `
        <tr class="eo-row${isEven ? '' : ' eo-row-alt'}">
          <td class="eo-td eo-col-func">
            <span class="eo-chip">${funcao}</span>
          </td>
          <td class="eo-td eo-col-horario">${slot.horario}</td>
          <td class="eo-td eo-col-carga"><span class="eo-carga">${slot.carga}</span></td>
          <td class="eo-td eo-col-fa" style="text-align:center">
            <input type="checkbox" id="eo-fa-${rid}" class="eo-fa-chk" title="Tem Folga Agrupada">
          </td>
          <td class="eo-td eo-col-mat">
            <input
              class="eo-mat-input"
              id="eo-mat-${rid}"
              type="text"
              placeholder="Matrícula"
              autocomplete="off"
              maxlength="10"
              oninput="eoMats[${rid}]=this.value; eoAutoFillName(${rid}, this.value)"
              onblur="eoAutoFillName(${rid}, this.value)"
            >
          </td>
          <td class="eo-td eo-col-nome">
            <input
              class="eo-name-input"
              id="eo-name-${rid}"
              type="text"
              placeholder="Nome do colaborador"
              autocomplete="off"
              oninput="eoNames[${rid}]=this.value"
            >
          </td>
          ${days.map(d => {
            const key   = `${rid}_${d.num}`;
            const state = eoCells[key] || '';
            let inner;
            if (state === 'F')       inner = `<span class="eo-badge eo-badge-f">F</span>`;
            else if (state === 'FA') inner = `<span class="eo-badge eo-badge-fa">FA</span>`;
            else                     inner = `<span class="eo-day-block" style="${eoTurnoStyle(slot.entrada)}"></span>`;
            return `<td
              id="eocell-${rid}-${d.num}"
              class="eo-td eo-col-day eo-clickable${d.isToday?' eo-today-col':''}${d.isSun||d.isSat?' eo-weekend-col':''}"
              onclick="eoCellClick(${rid},${d.num})"
              title="Clique: F = Folga · FA = Folga Agrupada"
            >${inner}</td>`;
          }).join('')}
        </tr>`;
        rowIdx++;
      }
    });
  });

  html += `</tbody></table></div>`;
  document.getElementById('eo-content').innerHTML = html;
  eoRestoreNames();
}

// ── Restore names after re-render ────────────────────
function eoRestoreNames() {
  Object.entries(eoNames).forEach(([idx, name]) => {
    const el = document.getElementById(`eo-name-${idx}`);
    if (el) el.value = name;
  });
  Object.entries(eoMats).forEach(([idx, mat]) => {
    const el = document.getElementById(`eo-mat-${idx}`);
    if (el) el.value = mat;
  });
}

// ── Clear all folgas and names ────────────────────────
function eoClearAll() {
  if (!confirm('Limpar todos os nomes e folgas?')) return;
  Object.keys(eoCells).forEach(k => delete eoCells[k]);
  Object.keys(eoNames).forEach(k => delete eoNames[k]);
  Object.keys(eoMats).forEach(k => delete eoMats[k]);
  eoRender();
}

// ── Export to Excel ───────────────────────────────────
function eoExportExcel() {
  const days    = eoMonthDays();
  const now     = new Date();
  const basePart= eoBase ? `_${eoBase}` : '';
  const dateStr = `${String(now.getMonth()+1).padStart(2,'0')}_${now.getFullYear()}`;

  // Day headers: "Seg 01", "Ter 02" ...
  const dayHeaders = days.map(d => `${d.label} ${String(d.num).padStart(2,'0')}`);
  const headers    = ['FUNÇÃO','HORÁRIO','CH','FA','MATRÍCULA','COLABORADOR', ...dayHeaders];
  const wsData     = [headers];

  let rowIdx = 0;
  Object.keys(eoGroups).sort().forEach(funcao => {
    Object.values(eoGroups[funcao])
      .sort((a,b)=>a.entrada.localeCompare(b.entrada))
      .forEach(slot => {
        for (let i = 0; i < slot.count; i++) {
          const nome = eoNames[rowIdx] || '';
          const mat  = eoMats[rowIdx]  || '';
          const faEl = document.getElementById(`eo-fa-${rowIdx}`);
          const fa   = faEl && faEl.checked ? 'SIM' : '';
          const dayCells = days.map(d => {
            const state = eoCells[`${rowIdx}_${d.num}`] || '';
            return state || slot.horario;
          });
          wsData.push([funcao, slot.horario, slot.carga, fa, mat, nome, ...dayCells]);
          rowIdx++;
        }
      });
  });

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws['!cols'] = [{wch:28},{wch:14},{wch:5},{wch:5},{wch:12},{wch:32},...days.map(()=>({wch:10}))];

  // Style header row bold (basic)
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'ESCALA');
  XLSX.writeFile(wb, `EscalaOnline${basePart}_${dateStr}.xlsx`);
}

// ══════════════════════════════════════════════════════
// COLABORADORES LOOKUP
// ══════════════════════════════════════════════════════

/**
 * Load colaboradores xlsx: col A = matricula, col B = nome.
 * Builds eoColabs map. Works with any number of rows/header.
 */
function eoLoadColabs(input) {
  const file = input.files[0];
  if (!file) return;

  const statusEl = document.getElementById('eo-colab-status');
  statusEl.textContent = 'Carregando...';
  statusEl.className   = 'eo-colab-status eo-colab-loading';

  readXlsx(file, wb => {
    if (!wb) {
      statusEl.textContent = 'Erro ao ler arquivo';
      statusEl.className   = 'eo-colab-status eo-colab-err';
      return;
    }

    const ws   = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: false });

    // Clear previous
    Object.keys(eoColabs).forEach(k => delete eoColabs[k]);

    // Detect header row — skip rows where col A is not numeric
    let count = 0;
    rows.forEach((row, i) => {
      if (!row || !row[1]) return;
      const rawMat = String(row[1]).trim();
      // Skip header row — col B must be numeric (matricula)
      if (!rawMat || rawMat.replace(/[^0-9]/g, '') === '') return;

      const station = String(row[0] || '').trim().toUpperCase();
      const mat     = rawMat;
      const nome    = String(row[2] || '').trim();
      const funcao  = String(row[3] || '').trim();
      const ch      = String(row[4] || '').trim();

      if (mat && nome) {
        eoColabs[mat] = { station, nome, funcao, ch };
        count++;
      }
    });

    statusEl.textContent = `${count} colaboradores`;
    statusEl.className   = 'eo-colab-status eo-colab-ok';
    input.value = '';

    // Re-run autofill for any matriculas already typed
    document.querySelectorAll('.eo-mat-input').forEach(el => {
      const rid = el.id.replace('eo-mat-', '');
      if (el.value) eoAutoFillName(parseInt(rid), el.value);
    });
  });
}

/**
 * When matricula field changes, look up name and auto-fill.
 * Only fills if the name field is currently empty.
 */
function eoAutoFillName(rowIdx, matValue) {
  const mat    = String(matValue || '').trim();
  const colab  = eoColabs[mat];
  if (!colab) {
    // Clear warning if mat was cleared
    const matEl = document.getElementById(`eo-mat-${rowIdx}`);
    if (matEl) matEl.title = '';
    return;
  }

  const nameEl = document.getElementById(`eo-name-${rowIdx}`);
  const matEl  = document.getElementById(`eo-mat-${rowIdx}`);
  if (!nameEl) return;

  // ── Station validation ──────────────────────────────
  if (matEl) {
    const colabStation = (colab.station || '').toUpperCase();
    const pageBase     = (eoBase || '').toUpperCase();

    if (pageBase && colabStation && colabStation !== pageBase) {
      // Wrong base — block and warn
      matEl.classList.add('eo-mat-err');
      matEl.classList.remove('eo-mat-warn');
      matEl.title = `⚠ Matrícula pertence à base ${colabStation}, não ${pageBase}`;
      // Clear name if it was auto-filled from wrong base
      if (nameEl.dataset.autofilled === '1') {
        nameEl.value = '';
        nameEl.dataset.autofilled = '';
        delete eoNames[rowIdx];
        nameEl.dispatchEvent(new Event('input'));
      }
      return; // stop here — don't fill name
    } else {
      matEl.classList.remove('eo-mat-err');
    }
  }

  // ── Auto-fill name ────────────────────────────────────
  if (!nameEl.value || nameEl.dataset.autofilled === '1') {
    nameEl.value              = colab.nome;
    nameEl.dataset.autofilled = '1';
    eoNames[rowIdx]           = colab.nome;
    nameEl.dispatchEvent(new Event('input'));
  }

  // ── CH compatibility check ────────────────────────────
  if (colab.ch && matEl) {
    const slot    = eoSlotForRow(rowIdx);
    const slotCH  = slot ? parseInt(slot.carga) : null;
    const colabCH = parseInt(colab.ch);
    if (slotCH && colabCH && slotCH !== colabCH) {
      matEl.classList.add('eo-mat-warn');
      matEl.title = `Atenção: CH do colaborador (${colabCH}h) difere do turno (${slotCH}h)`;
    } else {
      matEl.classList.remove('eo-mat-warn');
      matEl.title = colab.funcao
        ? `${colab.nome} · ${colab.funcao} · ${colabCH}h · ${colab.station}`
        : '';
    }
  }
}

// ══════════════════════════════════════════════════════
// MALHA AÉREA + FOLGAS AUTOMÁTICAS
// ══════════════════════════════════════════════════════

function eoLoadMalha(input) {
  const file = input.files[0];
  if (!file) return;
  const st = document.getElementById('eo-malha-status');
  if (st) { st.textContent = 'Carregando...'; st.className = 'eo-colab-status eo-colab-loading'; }

  malhaLoadFile(file, count => {
    if (st) {
      st.textContent = `${count} voos`;
      st.className   = 'eo-colab-status eo-colab-ok';
    }
    // Enable auto-folgas button
    const btn = document.getElementById('eo-auto-btn');
    if (btn) btn.disabled = false;
    input.value = '';
  });
}

function eoAutoFolgas() {
  const base  = eoBase;
  const now   = new Date();
  const year  = now.getFullYear();
  const month = now.getMonth() + 1;

  if (!malhaVoos || malhaVoos.size === 0) {
    alert('Carregue a malha aérea primeiro.');
    return;
  }

  const result = autoFolgas(base, year, month);

  const msg = `Folgas distribuídas!\n\n`
    + `Colaboradores processados: ${result.rowsProcessed}\n`
    + `Folgas simples (F): ${result.folgasPlaced}\n`
    + `Folgas agrupadas (FA): ${result.faPlaced * 2}\n\n`
    + `Você pode ajustar manualmente clicando nas células.`;
  alert(msg);
}

// ══════════════════════════════════════════════════════
// FILTER BY FUNCTION
// ══════════════════════════════════════════════════════
let eoActiveFilter = null;

function eoFilterFunc(funcao, btn) {
  eoActiveFilter = funcao;
  // Update button states
  document.querySelectorAll('.eo-filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  // Show/hide rows
  eoApplyFilter();
}

function eoFilterAll() {
  eoActiveFilter = null;
  document.querySelectorAll('.eo-filter-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('.eo-filter-all')?.classList.add('active');
  eoApplyFilter();
}

function eoApplyFilter() {
  const rows    = document.querySelectorAll('.eo-row, .eo-row-alt, .eo-funcao-row');
  let lastFunc  = null;

  rows.forEach(row => {
    if (row.classList.contains('eo-funcao-row')) {
      // Will show/hide funcao header based on whether any child rows are visible
      lastFunc = row;
      return;
    }
    const chip = row.querySelector('.eo-chip');
    const func = chip ? chip.textContent.trim() : '';
    const show = !eoActiveFilter || func === eoActiveFilter;
    row.style.display = show ? '' : 'none';
  });

  // Show/hide funcao section headers
  document.querySelectorAll('.eo-funcao-row').forEach(header => {
    if (!eoActiveFilter) {
      header.style.display = '';
      return;
    }
    // Check if header text matches filter
    const label = header.querySelector('.eo-funcao-label');
    const text  = label ? label.childNodes[0]?.textContent?.trim() : '';
    header.style.display = text === eoActiveFilter ? '' : 'none';
  });
}
