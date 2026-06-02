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
  const ICO_TRASH  = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>`;
  const ICO_XLS    = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`;
  const ICO_PRINT  = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>`;

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
      <button class="eo-btn eo-btn-sec" onclick="eoClearAll()">${ICO_TRASH} Limpar tudo</button>
      <button class="eo-btn eo-btn-xls" onclick="eoExportExcel()">${ICO_XLS} Excel</button>
      <button class="eo-btn eo-btn-print" onclick="window.print()">${ICO_PRINT} Imprimir</button>
    </div>
  </div>
  ${legend}
  <div class="eo-wrap">
    <table class="eo-table">
      <thead>
        <tr>
          <th class="eo-th eo-col-func">Função</th>
          <th class="eo-th eo-col-horario">Horário</th>
          <th class="eo-th eo-col-carga">CH</th>
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
}

// ── Clear all folgas and names ────────────────────────
function eoClearAll() {
  if (!confirm('Limpar todos os nomes e folgas?')) return;
  Object.keys(eoCells).forEach(k => delete eoCells[k]);
  Object.keys(eoNames).forEach(k => delete eoNames[k]);
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
  const headers    = ['FUNÇÃO','HORÁRIO','CH','COLABORADOR', ...dayHeaders];
  const wsData     = [headers];

  let rowIdx = 0;
  Object.keys(eoGroups).sort().forEach(funcao => {
    Object.values(eoGroups[funcao])
      .sort((a,b)=>a.entrada.localeCompare(b.entrada))
      .forEach(slot => {
        for (let i = 0; i < slot.count; i++) {
          const nome = eoNames[rowIdx] || '';
          const dayCells = days.map(d => {
            const state = eoCells[`${rowIdx}_${d.num}`] || '';
            return state || slot.horario;
          });
          wsData.push([funcao, slot.horario, slot.carga, nome, ...dayCells]);
          rowIdx++;
        }
      });
  });

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws['!cols'] = [{wch:28},{wch:14},{wch:5},{wch:32},...days.map(()=>({wch:10}))];

  // Style header row bold (basic)
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'ESCALA');
  XLSX.writeFile(wb, `EscalaOnline${basePart}_${dateStr}.xlsx`);
}
