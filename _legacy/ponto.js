// ══════════════════════════════════════════════════════
// MÓDULO PONTO
// ══════════════════════════════════════════════════════
// Parses Horarios.xlsx (planejado) and Marcacao.xlsx (realizado)
// and exposes comparison + auto-fill utilities.
//
// Horarios:  Filial(0)|Mat(1)|Nome(2)|_(3)|_(4)|Data(5)|E1(6)|S1(7)|E2(8)|S2(9)
// Marcacao:  Filial(0)|Mat(1)|Nome(2)|Data(3)|Bat1(4)|Bat2(5)|Bat3(6)|Bat4(7)

const pontoHorarios = new Map();  // key "MAT_YYYY-MM-DD" → record
const pontoMarcacao = new Map();  // key "MAT_YYYY-MM-DD" → record

// ── Key ──────────────────────────────────────────────
function pontoKey(mat, date) {
  const d = (date instanceof Date) ? date : new Date(date);
  return `${mat}_${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// ── Time helpers ──────────────────────────────────────
function pontoTimeToMin(t) {
  if (!t) return null;
  const m = String(t).match(/(\d{1,2}):(\d{2})/);
  return m ? parseInt(m[1])*60 + parseInt(m[2]) : null;
}

function pontoFmtDiff(min) {
  if (min === 0 || min === null) return '—';
  const abs  = Math.abs(min);
  const sign = min > 0 ? '+' : '-';
  const h    = Math.floor(abs / 60);
  const m    = abs % 60;
  return h > 0
    ? `${sign}${h}h${String(m).padStart(2,'0')}`
    : `${sign}${abs}min`;
}

// ── Parse Horarios.xlsx ───────────────────────────────
function pontoParseHorarios(wb, base) {
  pontoHorarios.clear();
  const ws   = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header:1, defval:null, raw:false });
  let count  = 0;

  rows.forEach((r, i) => {
    if (i === 0 || !r || !r[1] || !r[5]) return;
    const filial = String(r[0] || '').trim().toUpperCase();
    if (base && filial !== base.toUpperCase()) return;

    const mat  = String(r[1]).trim();
    const nome = String(r[2] || '').trim();
    const raw  = r[5];
    const date = (raw instanceof Date) ? raw : new Date(raw);
    if (!date || isNaN(date)) return;

    pontoHorarios.set(pontoKey(mat, date), {
      filial, mat, nome, date,
      ent1: r[6] || null, sai1: r[7] || null,
      ent2: r[8] || null, sai2: r[9] || null,
      entrada: r[6] || null,
      saida:   r[9] || r[7] || null,
    });
    count++;
  });

  console.log(`[ponto] Horarios: ${count} registros (base=${base||'todas'})`);
  return count;
}

// ── Parse Marcacao.xlsx ───────────────────────────────
function pontoParseMarcacao(wb, base) {
  pontoMarcacao.clear();
  const ws   = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header:1, defval:null, raw:false });
  let count  = 0;

  rows.forEach((r, i) => {
    if (!r || !r[1] || !r[3]) return;
    const filial = String(r[0] || '').trim().toUpperCase();
    if (base && filial !== base.toUpperCase()) return;

    const mat  = String(r[1]).trim();
    const nome = String(r[2] || '').trim();
    const raw  = r[3];
    const date = (raw instanceof Date) ? raw : new Date(raw);
    if (!date || isNaN(date)) return;

    pontoMarcacao.set(pontoKey(mat, date), {
      filial, mat, nome, date,
      bat1: r[4] || null, bat2: r[5] || null,
      bat3: r[6] || null, bat4: r[7] || null,
    });
    count++;
  });

  console.log(`[ponto] Marcacao: ${count} registros (base=${base||'todas'})`);
  return count;
}

// ══════════════════════════════════════════════════════
// COMPARISON ENGINE
// ══════════════════════════════════════════════════════

const TOLERANCE_MIN = 10;   // minutes tolerance for on-time
const LATE_MIN      = 30;   // minutes to flag as "atraso"
const EARLY_MIN     = 30;   // minutes to flag as "saida_antecipada"

function pontoCompareRecord(hor, marc) {
  if (!marc) {
    return { status:'falta', ...hor, planEntrada:hor.ent1, planSaida:hor.sai2||hor.sai1, realEntrada:null, realSaida:null, diffEntMin:null, diffSaiMin:null };
  }

  const diffEnt = pontoMinDiff(hor.ent1, marc.bat1);
  const diffSai = pontoMinDiff(hor.sai2||hor.sai1, marc.bat4||marc.bat2);

  let status = 'ok';
  if (diffEnt !== null && diffEnt >  LATE_MIN)  status = 'atraso';
  else if (diffSai !== null && diffSai < -EARLY_MIN) status = 'saida_antecipada';
  else if ((diffEnt !== null && Math.abs(diffEnt) > TOLERANCE_MIN) ||
           (diffSai !== null && Math.abs(diffSai) > TOLERANCE_MIN)) status = 'desvio';

  return {
    status,
    mat:         hor.mat,
    nome:        hor.nome,
    filial:      hor.filial,
    date:        hor.date,
    planEntrada: hor.ent1,
    planSaida:   hor.sai2 || hor.sai1,
    realEntrada: marc.bat1,
    realSaida:   marc.bat4 || marc.bat2,
    diffEntMin:  diffEnt,
    diffSaiMin:  diffSai,
  };
}

function pontoMinDiff(planned, real) {
  const tp = pontoTimeToMin(planned);
  const tr = pontoTimeToMin(real);
  if (tp === null || tr === null) return null;
  return tr - tp;
}

// Build full comparison for a given base/year/month
function pontoBuildComparison(base, year, month) {
  const results = [];
  for (const [key, hor] of pontoHorarios) {
    const d = (hor.date instanceof Date) ? hor.date : new Date(hor.date);
    if (year  && d.getFullYear()  !== parseInt(year))  continue;
    if (month && d.getMonth()+1   !== parseInt(month)) continue;
    if (base  && hor.filial !== base.toUpperCase())    continue;
    results.push(pontoCompareRecord(hor, pontoMarcacao.get(key)));
  }
  return results;
}

// ── Summary stats from comparison results ─────────────
function pontoBuildStats(results) {
  const total   = results.length;
  const byStatus = { ok:0, desvio:0, atraso:0, saida_antecipada:0, falta:0, sem_horario:0 };
  let   totalLateMin = 0, lateCount = 0;

  results.forEach(r => {
    byStatus[r.status] = (byStatus[r.status] || 0) + 1;
    if (r.diffEntMin > 0) { totalLateMin += r.diffEntMin; lateCount++; }
  });

  return {
    total,
    ...byStatus,
    adherencePct: total > 0 ? Math.round((byStatus.ok / total) * 100) : 0,
    avgLateMin:   lateCount > 0 ? Math.round(totalLateMin / lateCount) : 0,
  };
}

// ══════════════════════════════════════════════════════
// AUTO-FILL ESCALA ONLINE
// ══════════════════════════════════════════════════════

/**
 * Auto-fill the Escala Online grid from Horarios data.
 * - Fills name fields where mat matches
 * - Marks days without planned schedule as F (folga)
 * Returns { namesFilled, folgasMarked }
 */
function pontoAutoFillEscala(base, year, month) {
  if (!pontoHorarios.size) return { namesFilled:0, folgasMarked:0 };

  const totalDays = new Date(year, month, 0).getDate();

  // Build mat → { nome, workedDays Set }
  const matData = new Map();
  for (const [, hor] of pontoHorarios) {
    const d = (hor.date instanceof Date) ? hor.date : new Date(hor.date);
    if (d.getFullYear() !== year  || d.getMonth()+1 !== month) continue;
    if (base && hor.filial !== base.toUpperCase()) continue;

    if (!matData.has(hor.mat)) matData.set(hor.mat, { nome: hor.nome, days: new Set() });
    matData.get(hor.mat).days.add(d.getDate());
  }

  let namesFilled = 0, folgasMarked = 0;

  document.querySelectorAll('.eo-mat-input').forEach(el => {
    const mat = el.value.trim();
    if (!mat) return;
    const data = matData.get(mat);
    if (!data) return;

    const rid = parseInt(el.id.replace('eo-mat-', ''));

    // Fill name
    const nameEl = document.getElementById(`eo-name-${rid}`);
    if (nameEl && (!nameEl.value || nameEl.dataset.autofilled === '1')) {
      nameEl.value              = data.nome;
      nameEl.dataset.autofilled = '1';
      eoNames[rid]              = data.nome;
      nameEl.dispatchEvent(new Event('input'));
      namesFilled++;
    }

    // Mark days not in worked set as F
    for (let day = 1; day <= totalDays; day++) {
      const key = `${rid}_${day}`;
      if (!data.days.has(day) && !eoCells[key]) {
        eoCells[key] = 'F';
        eoPaintCell(rid, day);
        folgasMarked++;
      }
    }
  });

  return { namesFilled, folgasMarked };
}
