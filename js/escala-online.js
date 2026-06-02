// ══════════════════════════════════════════════════════
// PAGE 3 — ESCALA ONLINE
// ══════════════════════════════════════════════════════
// Receives gRows from the generator and renders a schedule
// grid (rows = collaborators, columns = days of the week).
// Only the collaborator name field is editable.

let eoRows   = [];   // raw gRows from generator
let eoBase   = null;
let eoGroups = {};   // grouped by funcao → array of slots

// ── Entry point called by generator ──────────────────
function eoInit(rows, base) {
  eoRows   = rows;
  eoBase   = base;
  eoGroups = eoGroupRows(rows);
  eoRender();
  showPage('eo');
}

// ── Group rows by funcao, then by horário ─────────────
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

// ── Render the full schedule page ────────────────────
function eoRender() {
  const page  = document.getElementById('page-eo');
  const today = new Date();
  const days  = ['DOM','SEG','TER','QUA','QUI','SEX','SÁB'];

  // Build 7 column headers starting from today's week Monday
  const monday = new Date(today);
  monday.setDate(today.getDate() - (today.getDay() === 0 ? 6 : today.getDay() - 1));
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return {
      label: days[d.getDay()],
      date:  `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`,
      iso:   d.toISOString().slice(0,10),
      isToday: d.toISOString().slice(0,10) === today.toISOString().slice(0,10)
    };
  });

  // Header
  const baseLabel = eoBase ? ` · ${eoBase}` : '';
  const monthStr  = today.toLocaleDateString('pt-BR', { month:'long', year:'numeric' });

  let html = `
  <div class="eo-header">
    <div class="eo-header-left">
      <div class="eo-title">Escala Online<span class="eo-base-tag">${eoBase || ''}</span></div>
      <div class="eo-subtitle">Dimensionamento${baseLabel} · ${monthStr}</div>
    </div>
    <div class="eo-header-right">
      <button class="eo-btn eo-btn-sec" onclick="eoClearNames()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg> Limpar nomes</button>
      <button class="eo-btn eo-btn-xls" onclick="eoExportExcel()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg> Excel</button>
      <button class="eo-btn eo-btn-print" onclick="window.print()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg> Imprimir</button>
    </div>
  </div>

  <div class="eo-wrap">
    <table class="eo-table">
      <thead>
        <tr>
          <th class="eo-th eo-col-func">Função</th>
          <th class="eo-th eo-col-horario">Horário</th>
          <th class="eo-th eo-col-carga">Carga</th>
          <th class="eo-th eo-col-nome">Colaborador</th>
          ${weekDays.map(d => `
            <th class="eo-th eo-col-day${d.isToday ? ' eo-today' : ''}">
              <span class="eo-day-name">${d.label}</span>
              <span class="eo-day-date">${d.date}</span>
            </th>`).join('')}
        </tr>
      </thead>
      <tbody>`;

  // Render rows grouped by funcao
  let rowIdx = 0;
  const funcoes = Object.keys(eoGroups).sort();

  funcoes.forEach(funcao => {
    const slots    = Object.values(eoGroups[funcao]);
    const totalFunc = slots.reduce((s, slot) => s + slot.count, 0);

    // Funcao header row
    html += `
        <tr class="eo-funcao-row">
          <td colspan="${4 + weekDays.length}" class="eo-funcao-label">
            ${funcao}
            <span class="eo-funcao-count">${totalFunc} posições</span>
          </td>
        </tr>`;

    // One row per collaborator slot
    slots.sort((a,b) => a.entrada.localeCompare(b.entrada)).forEach(slot => {
      for (let i = 0; i < slot.count; i++) {
        const id    = `eo-name-${rowIdx}`;
        const isEven = rowIdx % 2 === 0;
        html += `
        <tr class="eo-row${isEven ? '' : ' eo-row-alt'}" data-ridx="${rowIdx}">
          <td class="eo-td eo-col-func">
            <span class="eo-chip eo-chip-${funcao.replace(/[^a-zA-Z]/g,'').toLowerCase().slice(0,6)}">${funcao}</span>
          </td>
          <td class="eo-td eo-col-horario">${slot.horario}</td>
          <td class="eo-td eo-col-carga">
            <span class="eo-carga">${slot.carga}</span>
          </td>
          <td class="eo-td eo-col-nome">
            <input
              class="eo-name-input"
              id="${id}"
              type="text"
              placeholder="Nome do colaborador"
              autocomplete="off"
              oninput="eoSaveName(${rowIdx}, this.value)"
            >
          </td>
          ${weekDays.map(d => `
            <td class="eo-td eo-col-day${d.isToday ? ' eo-today-col' : ''}">
              <span class="eo-turno-pill" style="${eoTurnoStyle(slot.entrada)}">
                ${slot.horario}
              </span>
            </td>`).join('')}
        </tr>`;
        rowIdx++;
      }
    });
  });

  html += `
      </tbody>
    </table>
  </div>`;

  document.getElementById('eo-content').innerHTML = html;

  // Restore saved names if any
  eoRestoreNames();
}

// ── Turno pill color based on start time ─────────────
function eoTurnoStyle(entrada) {
  const h = parseInt(entrada.split(':')[0]);
  if (h >= 0  && h < 6)  return 'background:#1e293b;color:#94a3b8;';   // madrugada — escuro
  if (h >= 6  && h < 12) return 'background:#dbeafe;color:#1e40af;';   // manhã — azul claro
  if (h >= 12 && h < 18) return 'background:#dcfce7;color:#166534;';   // tarde — verde claro
  return 'background:#fef3c7;color:#92400e;';                           // noite — âmbar
}

// ── Name persistence ──────────────────────────────────
const eoNames = {};

function eoSaveName(idx, value) {
  eoNames[idx] = value;
}

function eoRestoreNames() {
  Object.entries(eoNames).forEach(([idx, name]) => {
    const el = document.getElementById(`eo-name-${idx}`);
    if (el) el.value = name;
  });
}

function eoClearNames() {
  Object.keys(eoNames).forEach(k => delete eoNames[k]);
  document.querySelectorAll('.eo-name-input').forEach(el => el.value = '');
}

// ── Export to Excel ───────────────────────────────────
function eoExportExcel() {
  const today    = new Date().toISOString().slice(0,10);
  const basePart = eoBase ? `_${eoBase}` : '';
  const days     = ['DOM','SEG','TER','QUA','QUI','SEX','SÁB'];

  const monday = new Date();
  monday.setDate(monday.getDate() - (monday.getDay() === 0 ? 6 : monday.getDay() - 1));
  const weekDays = Array.from({length:7}, (_,i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return `${days[d.getDay()]} ${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
  });

  const headers = ['FUNÇÃO','HORÁRIO','CARGA','COLABORADOR',...weekDays];
  const wsData  = [headers];

  let rowIdx = 0;
  Object.keys(eoGroups).sort().forEach(funcao => {
    Object.values(eoGroups[funcao])
      .sort((a,b) => a.entrada.localeCompare(b.entrada))
      .forEach(slot => {
        for (let i = 0; i < slot.count; i++) {
          const nome = eoNames[rowIdx] || '';
          wsData.push([funcao, slot.horario, slot.carga, nome, ...weekDays.map(() => slot.horario)]);
          rowIdx++;
        }
      });
  });

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws['!cols'] = [
    {wch:28},{wch:16},{wch:8},{wch:32},
    ...weekDays.map(()=>({wch:16}))
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'ESCALA ONLINE');
  XLSX.writeFile(wb, `EscalaOnline${basePart}_${today}.xlsx`);
}
