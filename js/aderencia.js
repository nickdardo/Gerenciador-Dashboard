// ══════════════════════════════════════════════════════
// PONTO DATA STORE — Global Maps used by aderencia engine
// ══════════════════════════════════════════════════════

// Map<"Filial|MAT_zfill6|dd/mm/yyyy", {filial,mat,nome,ent1,sai1,ent2,sai2}>
let pontoHorarios = new Map();

// Map<"Filial|MAT_zfill6|dd/mm/yyyy", {filial,mat,nome,bat1..bat8}>
let pontoMarcacao = new Map();

function adhFmtDate(d) {
  if (!d) return '';
  if (d instanceof Date || (d && d.getDate)) {
    return String(d.getDate()).padStart(2,'0') + '/' +
           String(d.getMonth()+1).padStart(2,'0') + '/' +
           d.getFullYear();
  }
  // Already a string like "2026-06-01"
  const s = String(d);
  if (s.includes('-') && s.length >= 10) {
    const [y,m,dd] = s.split('T')[0].split('-');
    return `${dd}/${m}/${y}`;
  }
  return s;
}

function adhFmtTime(t) {
  if (!t) return '';
  if (typeof t === 'string') return t.slice(0,5);
  if (t instanceof Date) return String(t.getHours()).padStart(2,'0')+':'+String(t.getMinutes()).padStart(2,'0');
  // Excel time fraction (number between 0 and 1)
  if (typeof t === 'number') {
    const totalMin = Math.round(t * 1440);
    return String(Math.floor(totalMin/60)).padStart(2,'0')+':'+String(totalMin%60).padStart(2,'0');
  }
  return String(t).slice(0,5);
}

// ── Parse Horarios.xlsx workbook → pontoHorarios ──────
// Cols: Filial(0)|Mat(1)|Nome(2)|_|_|Data(3→5 in original)|E1|S1|E2|S2
// Based on actual structure: col0=Filial,1=Mat,2=Nome,3=_,4=_,5=Data,6=E1,7=S1,8=E2,9=S2
// But in the Aderencia-escala.xlsx Horarios sheet: A=Filial,B=Mat,C=Nome,D=Data,E=E1,F=S1,G=E2,H=S2
function pontoParseHorarios(wb, base) {
  pontoHorarios = new Map();
  adhBaseKPI = null; adhColabKPI = null; // reset computed KPI

  const ws   = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header:1, defval:null, raw:true });

  // Detect column layout by header
  const header = (rows[0] || []).map(h => String(h||'').toLowerCase());
  // Support both original Horarios.xlsx and Aderencia-escala version
  const iC = { filial:0, mat:1, nome:2, data:-1, e1:-1, s1:-1, e2:-1, s2:-1 };

  header.forEach((h, i) => {
    if (h.includes('data')) iC.data = i;
    else if (h.includes('prev_entrada1') || (h.includes('entr') && iC.e1<0)) iC.e1 = i;
    else if (h.includes('prev_saida1')   || (h.includes('said') && iC.s1<0)) iC.s1 = i;
    else if (h.includes('prev_entrada2') || (h.includes('entr') && iC.e2<0 && i>iC.e1)) iC.e2 = i;
    else if (h.includes('prev_saida2')   || (h.includes('said') && iC.s2<0 && i>iC.s1)) iC.s2 = i;
  });
  // Fallback positions for original Horarios.xlsx (Filial|Mat|Nome|?|?|Data|E1|S1|E2|S2)
  if (iC.data < 0) iC.data = 5;
  if (iC.e1   < 0) iC.e1   = 6;
  if (iC.s1   < 0) iC.s1   = 7;
  if (iC.e2   < 0) iC.e2   = 8;
  if (iC.s2   < 0) iC.s2   = 9;

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || !r[iC.mat] || !r[iC.data]) continue;
    const filial = String(r[iC.filial]||'').trim().toUpperCase();
    if (base && filial !== base.toUpperCase()) continue;
    const mat  = String(r[iC.mat]).trim().padStart(6,'0');
    const dstr = adhFmtDate(r[iC.data]);
    if (!dstr) continue;
    const key = `${filial}|${mat}|${dstr}`;
    pontoHorarios.set(key, {
      filial, mat, nome: String(r[iC.nome]||'').trim(),
      ent1: adhFmtTime(r[iC.e1]), sai1: adhFmtTime(r[iC.s1]),
      ent2: adhFmtTime(r[iC.e2]), sai2: adhFmtTime(r[iC.s2]),
      date: dstr
    });
  }
  console.log(`[aderencia] Horarios parsed: ${pontoHorarios.size} keys`);
}

// ── Parse Marcacao.xlsx workbook → pontoMarcacao ──────
// Cols: Filial|Mat|Nome|Data|Bat1..Bat8
function pontoParseMarcacao(wb, base) {
  pontoMarcacao = new Map();
  adhBaseKPI = null; adhColabKPI = null;

  const ws   = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header:1, defval:null, raw:true });

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || !r[1] || !r[3]) continue;
    const filial = String(r[0]||'').trim().toUpperCase();
    if (base && filial !== base.toUpperCase()) continue;
    const mat  = String(r[1]).trim().padStart(6,'0');
    const dstr = adhFmtDate(r[3]);
    if (!dstr) continue;
    const key = `${filial}|${mat}|${dstr}`;
    pontoMarcacao.set(key, {
      filial, mat, nome: String(r[2]||'').trim(),
      bat1: adhFmtTime(r[4]),  bat2: adhFmtTime(r[5]),
      bat3: adhFmtTime(r[6]),  bat4: adhFmtTime(r[7]),
      bat5: adhFmtTime(r[8]),  bat6: adhFmtTime(r[9]),
      bat7: adhFmtTime(r[10]), bat8: adhFmtTime(r[11]),
    });
  }
  console.log(`[aderencia] Marcacao parsed: ${pontoMarcacao.size} keys`);
}

// ══════════════════════════════════════════════════════
// ADERÊNCIA — Motor com fórmula correta da planilha Excel
//
// FÓRMULA (replicada de Aderencia-escala.xlsx):
//  KEY = Filial|MAT_zfill6|dd/mm/yyyy
//  Min_Programados = (S1-E1) + (S2-E2)  por linha de Horarios
//  Min_Trabalhados = (S1-E1) + (S2-E2) + ... por linha de Marcacao
//  Desvio_min  = ABS(Min_Trab - Min_Prog)  por linha
//  HE_min      = MAX(0, Min_Trab - Min_Prog)
//  Falta_min   = MAX(0, Min_Prog - Min_Trab)
//  Por colaborador: soma de tudo
//  % Aderência base = MAX(0, 100 - SUM(Desvio)/SUM(MinProg) * 100)
//  Excluir: HQ2, SEDE, GSE
// ══════════════════════════════════════════════════════

const ADH_EXCLUDE = new Set(['HQ2', 'SEDE', 'GSE']);

// Ensure the full colaborador roster (window.eoColabs) is loaded, so the
// Aderência table can show everyone at a base — not just who has ponto data.
// Usually already populated by adminAutoLoadFiles() shortly after login; this
// is a fallback for when the page is reached before that finishes.
async function adhEnsureRoster() {
  if (window.eoColabs?.size) return;
  try {
    const { count } = await db.from('colaboradores').select('*', { count:'exact', head:true });
    if (!count) return;
    const all = [];
    const PAGE = 1000;
    for (let from = 0; from < count; from += PAGE) {
      const { data, error } = await db.from('colaboradores')
        .select('matricula,nome,station,funcao,ch,situacao')
        .range(from, from + PAGE - 1);
      if (error) throw new Error(error.message);
      if (data) all.push(...data);
    }
    window.eoColabs = new Map(all.map(r => [r.matricula, r]));
    console.log(`[aderencia] roster: ${window.eoColabs.size} colaboradores`);
  } catch (e) { console.warn('[aderencia] ensureRoster:', e.message); }
}

// ── In-memory computed data ───────────────────────────
// Built once per session when files are loaded
let adhBaseKPI  = null;  // Map<base, {minProg, desvio, he, falta, colabs}>
let adhColabKPI = null;  // Map<"base|mat", {nome, minProg, desvio, he, falta}>

// ── Time string → minutes ─────────────────────────────
function adhTimeToMin(t) {
  if (!t) return 0;
  try {
    const s = String(t).trim();
    if (s.includes(':')) {
      const [h, m] = s.split(':');
      return parseInt(h) * 60 + parseInt(m);
    }
    // Excel time fraction
    const f = parseFloat(s);
    if (!isNaN(f)) return Math.round(f * 1440);
  } catch(_) {}
  return 0;
}

// ── Minutes diff, handling midnight crossover ─────────
function adhMinDiff(start, end) {
  if (!start || !end) return 0;
  let d = end - start;
  if (d < 0) d += 1440;
  return d;
}

// ── Build KPI from parsed files ───────────────────────
function adhBuildKPI() {
  if (!pontoHorarios?.size || !pontoMarcacao?.size) return false;

  const baseKPI  = new Map();
  const colabKPI = new Map();

  // Step 1: Build horario minutes per key
  const horMin = new Map(); // key → min_prog
  for (const [key, h] of pontoHorarios) {
    if (ADH_EXCLUDE.has((h.filial||'').toUpperCase())) continue;
    let min_prog = 0;
    min_prog += adhMinDiff(adhTimeToMin(h.ent1), adhTimeToMin(h.sai1));
    if (h.ent2 && h.sai2)
      min_prog += adhMinDiff(adhTimeToMin(h.ent2), adhTimeToMin(h.sai2));
    horMin.set(key, { min_prog, filial: h.filial, mat: h.mat, nome: h.nome });
  }

  // Step 2: Init colabAcc from horarios (all planned colabs), then cross with marcacao
  const colabAcc = new Map(); // "filial|mat" → accum

  for (const [key, h] of horMin) {
    const filial = (h.filial||'').toUpperCase();
    const ck = `${filial}|${h.mat}`;
    if (!colabAcc.has(ck)) {
      colabAcc.set(ck, { filial, mat: h.mat, nome: h.nome||'', min_prog:0, min_trab:0, desvio:0, he:0, falta:0 });
    }
    colabAcc.get(ck).min_prog += h.min_prog;
  }

  for (const [key, m] of pontoMarcacao) {
    const filial = (m.filial||'').toUpperCase();
    if (ADH_EXCLUDE.has(filial)) continue;

    // Compute min trabalhados from all batidas
    let min_trab = 0;
    const bats = [
      [m.bat1, m.bat2],
      [m.bat3, m.bat4],
      [m.bat5, m.bat6],
      [m.bat7, m.bat8],
    ];
    for (const [e, s] of bats) {
      if (e && s) min_trab += adhMinDiff(adhTimeToMin(e), adhTimeToMin(s));
    }

    const hor = horMin.get(key);
    const min_prog = hor ? hor.min_prog : 0;

    const ck = `${filial}|${m.mat}`;
    if (!colabAcc.has(ck)) {
      const nome = hor?.nome || m.nome || '';
      colabAcc.set(ck, { filial, mat: m.mat, nome, min_prog: 0, min_trab: 0, desvio: 0, he: 0, falta: 0 });
    }
    const acc = colabAcc.get(ck);
    acc.min_trab += min_trab;
    acc.desvio   += Math.abs(min_trab - min_prog);
    acc.he       += Math.max(0, min_trab - min_prog);
    acc.falta    += Math.max(0, min_prog - min_trab);
  }

  // For colabs only in horarios (no marcacao at all), falta = all planned time
  for (const [ck, acc] of colabAcc) {
    if (acc.min_trab === 0 && acc.min_prog > 0) {
      acc.falta = acc.min_prog; acc.desvio = acc.min_prog; acc.he = 0;
    }
  }

  // Step 3: Build colab KPI list + aggregate per base. People with marcação
  // but no horarios entry still get a row (pct=null, no baseline to compare
  // against), but don't count toward the base's % aderência totals.
  for (const [ck, c] of colabAcc) {
    if (!c.min_prog && !c.min_trab) continue; // truly nothing at all

    const pct = c.min_prog > 0
      ? Math.max(0, Math.round((100 - c.desvio / c.min_prog * 100) * 10) / 10)
      : null;
    colabKPI.set(ck, { ...c, pct, he_h: Math.round(c.he/60*10)/10, falta_h: Math.round(c.falta/60*10)/10 });

    if (c.min_prog > 0) {
      const base = c.filial;
      if (!baseKPI.has(base)) {
        baseKPI.set(base, { min_prog: 0, desvio: 0, he: 0, falta: 0, colabs: 0 });
      }
      const bk = baseKPI.get(base);
      bk.min_prog += c.min_prog;
      bk.desvio   += c.desvio;
      bk.he       += c.he;
      bk.falta    += c.falta;
      bk.colabs++;
    }
  }

  // Step 4: Compute % per base
  for (const [base, bk] of baseKPI) {
    bk.pct    = bk.min_prog > 0
      ? Math.max(0, Math.round((100 - bk.desvio / bk.min_prog * 100) * 10) / 10)
      : 0;
    bk.he_h   = Math.round(bk.he   / 60 * 10) / 10;
    bk.falta_h= Math.round(bk.falta/ 60 * 10) / 10;
    bk.prog_h = Math.round(bk.min_prog / 60 * 10) / 10;
  }

  adhBaseKPI  = baseKPI;
  adhColabKPI = colabKPI;
  return true;
}

// ── Global % ─────────────────────────────────────────
function adhGlobalPct() {
  if (!adhBaseKPI) return 0;
  let totProg = 0, totDesvio = 0;
  for (const d of adhBaseKPI.values()) { totProg += d.min_prog; totDesvio += d.desvio; }
  return totProg > 0 ? Math.max(0, Math.round((100 - totDesvio/totProg*100)*10)/10) : 0;
}

function adhPctColor(p) { return p >= 88 ? '#72c02c' : p >= 80 ? '#f59e0b' : '#ef4444'; }

function adhFmtH(h) {
  if (h >= 10000) return (h/1000).toFixed(1)+' Mil';
  if (h >= 1000)  return (h/1000).toFixed(1)+'k';
  return h.toFixed(1)+'h';
}

// ══════════════════════════════════════════════════════
// ENTRY POINT
// ══════════════════════════════════════════════════════
async function pageAderencia(el) {
  const role  = currentUserProfile?.role;
  const bases = currentUserProfile?.bases || [];
  const ROLES_OK = ['admin','gerente','coordenador','supervisor','lideranca'];

  if (!ROLES_OK.includes(role)) {
    el.innerHTML = `
      <div class="page-header"><div>
        <h1 class="page-title">Aderência ao Ponto</h1>
        <p class="page-sub">Acesso restrito</p>
      </div></div>
      <div class="adh-denied">
        <i class="ti ti-lock" style="font-size:36px;opacity:.2" aria-hidden="true"></i>
        <p>Seu perfil não tem acesso a este módulo.</p>
      </div>`;
    return;
  }

  el.innerHTML = `
    <div class="page-header">
      <div><h1 class="page-title">Aderência ao Ponto</h1>
        <p class="page-sub">Planejado vs realizado · fórmula: MAX(0, 100 - Desvio/Programado × 100)</p>
      </div>
    </div>
    <div class="adm-progress-wrap" id="adh-load-progress">
      <i class="ti ti-loader-2" style="font-size:26px;opacity:.5;animation:spin 1s linear infinite" aria-hidden="true"></i>
      <div class="adm-progress-label" id="adh-load-msg">Carregando dados...</div>
      <div class="adm-progress-track"><div class="adm-progress-fill" id="adh-load-fill" style="width:0%"></div></div>
      <div class="adm-progress-count" id="adh-load-count"></div>
    </div>`;

  const setMsg = m => { const e = document.getElementById('adh-load-msg'); if(e) e.textContent = m; };
  const setProg = (loaded, total) => {
    const fill  = document.getElementById('adh-load-fill');
    const count = document.getElementById('adh-load-count');
    const pct = total ? Math.min(100, Math.round(loaded/total*100)) : 0;
    if (fill)  fill.style.width = pct + '%';
    if (count) count.textContent = `${loaded.toLocaleString('pt-BR')} / ${total.toLocaleString('pt-BR')} registros · ${pct}%`;
  };

  // Kick off the full colaborador roster load in parallel (doesn't block the
  // KPI cache paths below) — awaited right before rendering the base detail.
  const rosterPromise = adhEnsureRoster();

  // ── LAYER 1: localStorage cache (instantâneo) ──────
  const CACHE_KEY = 'adh_kpi_cache';
  const CACHE_TS  = 'adh_kpi_ts';
  const CACHE_MAX = 8 * 60 * 60 * 1000; // 8 hours

  try {
    const ts    = parseInt(localStorage.getItem(CACHE_TS) || '0');
    const fresh = (Date.now() - ts) < CACHE_MAX;
    if (fresh) {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        const cached = JSON.parse(raw);
        adhBaseKPI  = new Map(cached.baseKPI.map(r => [r.filial, r]));
        adhColabKPI = new Map(cached.colabKPI.map(r => [r.filial+'|'+r.matricula, {...r, mat: r.matricula}]));
        console.log('[aderencia] Loaded from localStorage cache');
        // Skip loading, go straight to render
        await rosterPromise;
        if (role === 'admin') { adhRenderMultiBase(el); return; }
        const myBase = bases.includes('*') ? null : (bases[0] || null);
        adhRenderDetalhe(el, myBase, false);
        return;
      }
    }
  } catch(_) {}

  // ── LAYER 2: banco aderencia_kpi (rápido ~30 rows) ──
  setMsg('Carregando KPI do banco...');
  try {
    const [{ data: kpiRows, error: e1 }, { data: colabRows, error: e2 }] = await Promise.all([
      db.from('aderencia_kpi').select('*'),
      db.from('aderencia_colab').select('*').limit(50000),
    ]);
    if (e1||e2) console.warn('[aderencia] DB KPI query error', e1||e2);

    if (kpiRows?.length && colabRows?.length) {
      adhBaseKPI  = new Map(kpiRows.map(r => [r.filial, {
        pct: parseFloat(r.pct), he_h: parseFloat(r.he_h),
        falta_h: parseFloat(r.falta_h), prog_h: parseFloat(r.prog_h),
        colabs: r.colabs, min_prog: r.min_prog, desvio: r.desvio,
        he: r.he, falta: r.falta
      }]));
      adhColabKPI = new Map(colabRows.map(r => [r.filial+'|'+r.matricula, {
        filial: r.filial, mat: r.matricula, matricula: r.matricula, nome: r.nome,
        pct: r.pct == null ? null : parseFloat(r.pct), he_h: parseFloat(r.he_h),
        falta_h: parseFloat(r.falta_h), min_prog: r.min_prog,
        he: r.he, falta: r.falta
      }]));
      console.log(`[aderencia] Loaded ${kpiRows.length} bases from DB KPI`);

      // Save to localStorage cache
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({
          baseKPI:  kpiRows,
          colabKPI: colabRows
        }));
        localStorage.setItem(CACHE_TS, Date.now().toString());
      } catch(_) {}

      if (role === 'admin') { adhRenderMultiBase(el); return; }
      const myBase = bases.includes('*') ? null : (bases[0] || null);
      await rosterPromise;
      adhRenderDetalhe(el, myBase, false);
      return;
    }
  } catch(e) {
    console.warn('[aderencia] DB KPI error:', e.message);
  }

  // ── LAYER 3: calcular na hora (só 1ª vez ou se banco vazio) ──
  setMsg('Primeira vez: baixando dados para calcular...');
  if (!pontoHorarios?.size) {
    setMsg('Baixando Horários...');
    await adminLoadFileOnDemand('horarios', setProg);
  }
  if (!pontoMarcacao?.size) {
    setMsg('Baixando Marcação...');
    await adminLoadFileOnDemand('marcacao', setProg);
  }

  if (!pontoHorarios?.size || !pontoMarcacao?.size) {
    el.innerHTML = `
      <div class="page-header"><div><h1 class="page-title">Aderência ao Ponto</h1></div></div>
      <div class="adh-denied">
        <i class="ti ti-clock-off" style="font-size:36px;opacity:.2" aria-hidden="true"></i>
        <p>Arquivos de ponto não disponíveis.<br>
          <a href="#" onclick="navigateTo('admin')" style="color:#00a0d2">Admin → Arquivos</a> para carregar.</p>
      </div>`;
    return;
  }

  setMsg('Calculando aderência...');
  await new Promise(r => setTimeout(r, 20));
  adhBaseKPI = null; adhColabKPI = null;
  adhBuildKPI();

  // Trigger precompute to save for next time
  if (typeof adminPrecomputeAderencia === 'function') {
    adminPrecomputeAderencia().catch(console.warn);
  }

  await rosterPromise;
  if (role === 'admin') {
    adhRenderMultiBase(el);
  } else {
    const myBase = bases.includes('*') ? null : (bases[0] || null);
    adhRenderDetalhe(el, myBase, false);
  }
}

// ══════════════════════════════════════════════════════
// VIEW 1 — ADMIN: Multi-base overview
// ══════════════════════════════════════════════════════
function adhRenderMultiBase(el) {
  const global  = adhGlobalPct();
  const gColor  = adhPctColor(global);

  const sorted = [...adhBaseKPI.entries()]
    .filter(([,d]) => d.min_prog > 0)
    .sort((a,b) => b[1].pct - a[1].pct);

  let totHE = 0, totFalta = 0, totColabs = 0, totProg = 0;
  for (const [,d] of adhBaseKPI) {
    totHE     += d.he_h;
    totFalta  += d.falta_h;
    totColabs += d.colabs;
    totProg   += d.prog_h;
  }

  el.innerHTML = `
    <div class="adh-full-wrap">

      <!-- Header -->
      <div class="adh-full-header">
        <div>
          <h1 class="adh-full-title">Aderência ao Ponto</h1>
          <p class="adh-full-sub">Todas as bases · clique em uma base para detalhar</p>
        </div>
        <span class="adh-global-badge" style="color:${gColor}">${global}% escala realizada</span>
      </div>

      <!-- KPI strip -->
      <div class="adh-full-kpis">
        <div class="adh-full-kpi" style="border-top:3px solid ${gColor}">
          <div class="adh-full-kpi-v" style="color:${gColor}">${global}%</div>
          <div class="adh-full-kpi-l">% Escala realizada</div>
          <div class="adh-full-kpi-bar"><div style="width:${global}%;background:${gColor}"></div></div>
        </div>
        <div class="adh-full-kpi" style="border-top:3px solid #f6ad55">
          <div class="adh-full-kpi-v" style="color:#f6ad55">${adhFmtH(totHE)}</div>
          <div class="adh-full-kpi-l">Total horas extras</div>
        </div>
        <div class="adh-full-kpi" style="border-top:3px solid #fc8181">
          <div class="adh-full-kpi-v" style="color:#fc8181">${adhFmtH(totFalta)}</div>
          <div class="adh-full-kpi-l">Total horas a menos</div>
        </div>
        <div class="adh-full-kpi" style="border-top:3px solid #8896aa">
          <div class="adh-full-kpi-v" style="color:#8896aa">${totColabs.toLocaleString()}</div>
          <div class="adh-full-kpi-l">Colaboradores</div>
        </div>
        <div class="adh-full-kpi" style="border-top:3px solid #9f7aea">
          <div class="adh-full-kpi-v" style="color:#9f7aea">${adhFmtH(totProg)}</div>
          <div class="adh-full-kpi-l">Horas programadas</div>
        </div>
      </div>

      <!-- Main content: cards + chart side by side -->
      <div class="adh-main-layout">

        <!-- Left: base cards -->
        <div class="adh-cards-section">
          <div class="adh-full-grid-label">% Escala realizada por base</div>
          <div class="adh-full-grid" id="adh-base-grid">
            ${sorted.map(([base, d]) => {
              const cl = adhPctColor(d.pct);
              return `
                <div class="adh-full-card" onclick="adhOpenBase('${base}')">
                  <div class="adh-full-card-top">
                    <span class="adh-full-card-name">${base}</span>
                    <span class="adh-full-card-pct" style="color:${cl}">${d.pct}%</span>
                  </div>
                  <div class="adh-full-card-bar">
                    <div style="width:${d.pct}%;background:${cl};height:100%;border-radius:2px"></div>
                  </div>
                  <div class="adh-full-card-stats">
                    <span><span style="color:#f6ad55">+</span>${adhFmtH(d.he_h)}</span>
                    <span><span style="color:#fc8181">−</span>${adhFmtH(d.falta_h)}</span>
                    <span><span style="color:#8896aa">▲</span>${d.colabs}</span>
                  </div>
                </div>`;
            }).join('')}
          </div>
        </div>

        <!-- Right: analytics chart -->
        <div class="adh-chart-section">
          <div class="adh-chart-panel">
            <div class="adh-chart-panel-title">% Escala realizada por base</div>
            <div class="adh-chart-panel-sub">Ordenado por aderência</div>
            <div class="adh-bar-chart" id="adh-bar-chart">
              ${sorted.map(([base, d]) => {
                const cl = adhPctColor(d.pct);
                const w  = Math.round(d.pct);
                return `
                  <div class="adh-chart-row" onclick="adhOpenBase('${base}')">
                    <span class="adh-chart-base">${base}</span>
                    <div class="adh-chart-track">
                      <div class="adh-chart-fill" style="width:${w}%;background:${cl}"></div>
                    </div>
                    <span class="adh-chart-val" style="color:${cl}">${d.pct}%</span>
                  </div>`;
              }).join('')}
            </div>
          </div>

          <div class="adh-chart-panel adh-chart-panel-he">
            <div class="adh-chart-panel-title">HE × Horas a Menos por base</div>
            <div class="adh-chart-panel-sub">Top 10 por volume total</div>
            <div class="adh-he-chart" id="adh-he-chart">
              ${[...sorted].sort((a,b)=>(b[1].he_h+b[1].falta_h)-(a[1].he_h+a[1].falta_h)).slice(0,10).map(([base,d]) => {
                const maxVal = Math.max(d.he_h, d.falta_h, 1);
                const totalMax = Math.max(...[...adhBaseKPI.values()].map(x=>x.he_h+x.falta_h), 1);
                const scale = (v) => Math.round(v / (totalMax * 0.7) * 100);
                return `
                  <div class="adh-he-row" onclick="adhOpenBase('${base}')">
                    <span class="adh-chart-base">${base}</span>
                    <div class="adh-he-bars">
                      <div class="adh-he-bar-he"  style="width:${Math.min(scale(d.he_h),100)}%;background:#f6ad55"></div>
                      <div class="adh-he-bar-gap" style="height:2px"></div>
                      <div class="adh-he-bar-fat" style="width:${Math.min(scale(d.falta_h),100)}%;background:#fc8181"></div>
                    </div>
                    <div class="adh-he-vals">
                      <span style="color:#f6ad55">+${adhFmtH(d.he_h)}</span>
                      <span style="color:#fc8181">−${adhFmtH(d.falta_h)}</span>
                    </div>
                  </div>`;
              }).join('')}
              <div class="adh-he-legend">
                <span><span class="adh-leg-dot" style="background:#f6ad55"></span>Horas extras</span>
                <span><span class="adh-leg-dot" style="background:#fc8181"></span>Horas a menos</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  `;
}

function adhOpenBase(base) {
  const el = document.getElementById('page-content');
  if (el) adhRenderDetalhe(el, base, true);
}

// ══════════════════════════════════════════════════════
// VIEW 2 — DETALHE por base
// ══════════════════════════════════════════════════════
function adhRenderDetalhe(el, base, showBack) {
  const bk = base ? adhBaseKPI?.get(base) : null;
  if (!bk && base) {
    if (!adhBaseKPI) adhBuildKPI();
    const bk2 = adhBaseKPI?.get(base);
    if (!bk2) {
      el.innerHTML = `
        <div class="page-header"><div>
          <h1 class="page-title">Aderência · ${base}</h1>
        </div></div>
        <div class="adh-denied">
          <i class="ti ti-clock-off" style="font-size:36px;opacity:.2" aria-hidden="true"></i>
          <p>Nenhum dado para <strong>${base}</strong>. Verifique os arquivos no Admin.</p>
        </div>`;
      return;
    }
    return adhRenderDetalhe(el, base, showBack);
  }

  const pct    = bk ? bk.pct    : adhGlobalPct();
  const he_h   = bk ? bk.he_h   : [...adhBaseKPI.values()].reduce((a,d)=>a+d.he_h,0);
  const fat_h  = bk ? bk.falta_h: [...adhBaseKPI.values()].reduce((a,d)=>a+d.falta_h,0);
  const prog_h = bk ? bk.prog_h  : [...adhBaseKPI.values()].reduce((a,d)=>a+d.prog_h,0);
  const pctClr = adhPctColor(pct);

  // Build collaborator list for this base — merges the FULL roster
  // (colaboradores table, window.eoColabs) with the computed KPI, so people
  // without ponto data for this period still show up (with dashes).
  const colabListFull = adhBuildFullColabList(base);
  window._adhColabListFull  = colabListFull;
  window._adhSituacaoFilter = 'all';
  window._adhSortField = 'desvio';
  window._adhSortDir   = -1;
  const colabList = adhSortColabs(colabListFull.slice(), 'desvio', -1);

  // Total colaboradores: full roster count when we have one for this base,
  // otherwise fall back to the KPI-derived count (e.g. "todas as bases" view).
  const colabs = base && colabListFull.length ? colabListFull.length
               : (bk ? bk.colabs : [...adhBaseKPI.values()].reduce((a,d)=>a+d.colabs,0));

  el.innerHTML = `
    <div class="adh-det-wrap">

      <!-- Header -->
      <div class="adh-det-header">
        <div style="display:flex;align-items:center;gap:12px">
          ${showBack ? `<button class="adh-back-btn" onclick="pageAderencia(document.getElementById('page-content'))">
            <i class="ti ti-arrow-left" aria-hidden="true"></i>
          </button>` : ''}
          <div>
            <h1 class="adh-full-title">
              Aderência ao Ponto
              ${base ? `<span class="adh-base-badge">${base}</span>` : ''}
            </h1>
            <p class="adh-full-sub">Horas trabalhadas ÷ horas programadas</p>
          </div>
        </div>
      </div>

      <!-- KPIs -->
      <div class="adh-det-kpis-row">
        <div class="adh-det-kpi-card" style="border-top:3px solid ${pctClr}">
          <div class="adh-det-kpi-v" style="color:${pctClr}">${pct}%</div>
          <div class="adh-det-kpi-l">% Escala realizada</div>
          <div class="adh-full-kpi-bar" style="margin-top:8px"><div style="width:${pct}%;background:${pctClr}"></div></div>
        </div>
        <div class="adh-det-kpi-card" style="border-top:3px solid #f6ad55">
          <div class="adh-det-kpi-v" style="color:#f6ad55">${adhFmtH(he_h)}</div>
          <div class="adh-det-kpi-l">Horas extras</div>
        </div>
        <div class="adh-det-kpi-card" style="border-top:3px solid #fc8181">
          <div class="adh-det-kpi-v" style="color:#fc8181">${adhFmtH(fat_h)}</div>
          <div class="adh-det-kpi-l">Horas a menos</div>
        </div>
        <div class="adh-det-kpi-card" style="border-top:3px solid #9f7aea">
          <div class="adh-det-kpi-v" style="color:#9f7aea">${adhFmtH(prog_h)}</div>
          <div class="adh-det-kpi-l">Horas programadas</div>
        </div>
        <div class="adh-det-kpi-card" style="border-top:3px solid #8896aa">
          <div class="adh-det-kpi-v" style="color:#8896aa">${colabs.toLocaleString()}</div>
          <div class="adh-det-kpi-l">Colaboradores</div>
        </div>
      </div>

      <!-- Table -->
      <div class="adh-colab-section">
        <div class="adh-colab-header-row">
          <span id="adh-colab-count" style="font-size:10px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--text-muted)">
            ${colabList.length} colaboradores · passe o mouse para ver detalhes diários
          </span>
          <div class="adh-sort-btns">
            <button class="adh-sort-btn adh-situ-filter-btn active" onclick="adhFilterSituacao('all',this)">Todos</button>
            <button class="adh-sort-btn adh-situ-filter-btn" onclick="adhFilterSituacao('ativo',this)">Ativos</button>
            <button class="adh-sort-btn adh-situ-filter-btn" onclick="adhFilterSituacao('afastado',this)">Afastados</button>
            <span class="adh-filter-divider"></span>
            <button class="adh-sort-btn active" data-quick onclick="adhSort('desvio',this)">Maior desvio</button>
            <button class="adh-sort-btn" data-quick onclick="adhSort('he',this)">Mais HE</button>
            <button class="adh-sort-btn" data-quick onclick="adhSort('falta',this)">Mais falta</button>
            <button class="adh-sort-btn" data-quick onclick="adhSort('pct',this)">Menor %</button>
          </div>
        </div>

        <div class="adh-colab-table-wrap">
          <table class="adh-colab-table" id="adh-colab-table">
            <thead>
              <tr>
                <th data-sort="mat"      onclick="adhSortByCol('mat',this)">Matrícula</th>
                <th data-sort="nome"     onclick="adhSortByCol('nome',this)">Nome</th>
                <th data-sort="cargo"    onclick="adhSortByCol('cargo',this)">Cargo</th>
                <th data-sort="situacao" onclick="adhSortByCol('situacao',this)" style="text-align:center">Situação</th>
                <th class="r" data-sort="prog"  onclick="adhSortByCol('prog',this)">Prog(h)</th>
                <th class="r" data-sort="he"    onclick="adhSortByCol('he',this)" style="color:#f6ad55">HE(h)</th>
                <th class="r" data-sort="falta" onclick="adhSortByCol('falta',this)" style="color:#fc8181">Falta(h)</th>
                <th class="r" data-sort="pct"   onclick="adhSortByCol('pct',this)">% Ader.</th>
              </tr>
            </thead>
            <tbody id="adh-colab-tbody">
              ${adhRenderColabRows(colabList, base)}
            </tbody>
          </table>
        </div>
      </div>

    </div>

    <!-- Tooltip -->
    <div class="adh-tooltip" id="adh-tooltip" style="display:none"></div>
  `;

  // Store for sorting
  window._adhColabList = colabList;
  window._adhBase = base;

  // Setup tooltip
  adhSetupTooltip();
}

// Merge the full colaborador roster (window.eoColabs, from HRCL204.xlsx) with
// the computed aderência KPI — so people without ponto data this period still
// show up in the list (with dashes), instead of silently disappearing.
function adhBuildFullColabList(base) {
  const kpiByMat = new Map();
  for (const [k, d] of adhColabKPI) {
    if (base && !k.startsWith(base + '|')) continue;
    kpiByMat.set(String(d.mat || d.matricula || '').padStart(6,'0'), d);
  }

  if (!base || !window.eoColabs?.size) {
    // Admin "todas as bases" view, or roster not loaded yet: fall back to KPI-only
    return [...kpiByMat.values()];
  }

  const out = [];
  const seen = new Set();
  for (const [mat, r] of window.eoColabs) {
    if ((r.station || '').toUpperCase() !== base.toUpperCase()) continue;
    const matPad = String(mat).padStart(6,'0');
    seen.add(matPad);
    const kpi = kpiByMat.get(matPad);
    if (kpi) {
      out.push({ ...kpi, funcao: r.funcao, situacao: r.situacao });
    } else {
      out.push({
        filial: base, mat: matPad, matricula: matPad, nome: r.nome,
        funcao: r.funcao, situacao: r.situacao,
        min_prog: 0, min_trab: 0, desvio: 0, he: 0, falta: 0,
        he_h: 0, falta_h: 0, pct: null, semDados: true
      });
    }
  }
  // Edge case: someone with KPI data but missing from the roster snapshot
  for (const [matPad, kpi] of kpiByMat) {
    if (!seen.has(matPad)) out.push(kpi);
  }
  return out;
}

function adhIsAtivo(situacao) {
  return /trabalh/i.test(situacao || '');
}

function adhRenderColabRows(list, base) {
  return list.map(c => {
    const mat     = c.mat || c.matricula || '';
    const cargo   = c.funcao   || window.eoColabs?.get(mat)?.funcao   || '';
    const situacao= c.situacao || window.eoColabs?.get(mat)?.situacao || '';
    const ativo   = adhIsAtivo(situacao);
    const situBadge = situacao
      ? `<span class="adh-situ-badge ${ativo ? 'adh-situ-ativo' : 'adh-situ-afastado'}">${situacao}</span>`
      : '';
    const rowClass = 'adh-colab-row' + (c.semDados ? ' adh-colab-row-nodata' : '');
    const pctCell = (c.pct == null)
      ? `<td class="r" style="color:var(--text-muted);font-size:10px" title="${c.semDados ? 'Sem dados de ponto neste período' : 'Tem marcação mas nenhum horário programado neste período'}">${c.semDados ? '—' : 's/ prog.'}</td>`
      : `<td class="r" style="font-weight:700;color:${adhPctColor(c.pct)}">${c.pct}%</td>`;
    return `<tr class="${rowClass}"
      data-mat="${mat}"
      data-filial="${c.filial||base||''}"
      data-nome="${c.nome}"
      data-cargo="${cargo}"
      data-nodata="${c.semDados?1:0}"
      onmouseenter="adhShowTooltip(event,this,false).catch(console.warn)"
      onmouseleave="adhHideTooltip()">
      <td style="font-family:monospace;font-size:11px">${mat}</td>
      <td style="font-weight:500">${c.nome}</td>
      <td style="color:var(--text-muted);font-size:11px">${cargo}</td>
      <td style="text-align:center">${situBadge}</td>
      <td class="r">${c.semDados ? '—' : (c.min_prog/60).toFixed(1)+'h'}</td>
      <td class="r" style="color:#f6ad55">${c.semDados ? '—' : c.he_h.toFixed(1)+'h'}</td>
      <td class="r" style="color:#fc8181">${c.semDados ? '—' : c.falta_h.toFixed(1)+'h'}</td>
      ${pctCell}
    </tr>`;
  }).join('');
}

// Generic column comparator used by both the quick-filter buttons and the
// clickable table headers.
function adhSortColabs(list, field, dir) {
  const getVal = (c) => {
    switch (field) {
      case 'mat':      return c.mat || c.matricula || '';
      case 'nome':     return (c.nome || '').toLowerCase();
      case 'cargo':    return (c.funcao || window.eoColabs?.get(c.mat)?.funcao || '').toLowerCase();
      case 'situacao': return (c.situacao || window.eoColabs?.get(c.mat)?.situacao || '').toLowerCase();
      case 'prog':     return c.min_prog || 0;
      case 'he':       return c.he || 0;
      case 'falta':    return c.falta || 0;
      case 'pct':      return c.pct == null ? -1 : c.pct;
      case 'desvio':
      default:         return (c.he || 0) + (c.falta || 0);
    }
  };
  return list.sort((a, b) => {
    const va = getVal(a), vb = getVal(b);
    if (va < vb) return -1 * dir;
    if (va > vb) return  1 * dir;
    return 0;
  });
}

// Re-applies the current situação filter + sort, and redraws just the table.
function adhRerenderColabTable() {
  let list = (window._adhColabListFull || []).slice();
  if (window._adhSituacaoFilter === 'ativo')    list = list.filter(c => adhIsAtivo(c.situacao));
  if (window._adhSituacaoFilter === 'afastado') list = list.filter(c => !adhIsAtivo(c.situacao));
  list = adhSortColabs(list, window._adhSortField || 'desvio', window._adhSortDir || -1);
  window._adhColabList = list;

  const tbody = document.getElementById('adh-colab-tbody');
  if (tbody) tbody.innerHTML = adhRenderColabRows(list, window._adhBase);

  const total = (window._adhColabListFull || []).length;
  const countEl = document.getElementById('adh-colab-count');
  if (countEl) {
    countEl.textContent = list.length === total
      ? `${total} colaboradores · passe o mouse para ver detalhes diários`
      : `${list.length} de ${total} colaboradores · passe o mouse para ver detalhes diários`;
  }

  adhSetupTooltip();
}

// Situação filter buttons (Todos / Ativos / Afastados)
function adhFilterSituacao(mode, btn) {
  document.querySelectorAll('.adh-situ-filter-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  window._adhSituacaoFilter = mode;
  adhRerenderColabTable();
}

// Quick-filter buttons (Maior desvio / Mais HE / Mais falta / Menor %)
function adhSort(by, btn) {
  document.querySelectorAll('.adh-sort-btn[data-quick]').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  const map = { desvio: ['desvio', -1], he: ['he', -1], falta: ['falta', -1], pct: ['pct', 1] };
  const [field, dir] = map[by] || ['desvio', -1];
  window._adhSortField = field;
  window._adhSortDir   = dir;
  document.querySelectorAll('.adh-colab-table th[data-sort]').forEach(th => th.classList.remove('adh-sort-asc','adh-sort-desc'));
  adhRerenderColabTable();
}

// Clickable column headers — toggles asc/desc on repeat clicks
function adhSortByCol(field, thEl) {
  let dir;
  if (window._adhSortField === field) {
    dir = -(window._adhSortDir || 1);
  } else {
    const descDefault = new Set(['he','falta','desvio','prog']);
    dir = descDefault.has(field) ? -1 : 1;
  }
  window._adhSortField = field;
  window._adhSortDir   = dir;

  document.querySelectorAll('.adh-sort-btn[data-quick]').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.adh-colab-table th[data-sort]').forEach(th => th.classList.remove('adh-sort-asc','adh-sort-desc'));
  if (thEl) thEl.classList.add(dir === 1 ? 'adh-sort-asc' : 'adh-sort-desc');

  adhRerenderColabTable();
}

// ── Tooltip + Panel ──────────────────────────────────
function adhSetupTooltip() {
  document.querySelectorAll('.adh-colab-row').forEach(row => {
    row.addEventListener('mouseenter', e => { if (!_adhPanelFrozen) adhShowTooltip(e, row, false).catch(console.warn); });
    row.addEventListener('mousemove',  e => { if (!_adhPanelFrozen) adhPositionTooltip(e); });
    row.addEventListener('mouseleave', ()=> { if (!_adhPanelFrozen) adhHideTooltip(); });
    row.addEventListener('click',      e => adhShowTooltip(e, row, true).catch(console.warn));
  });
}

let _adhPanelFrozen = false;

function adhBuildPanelContent(mat, filial, nome, cargo) {
  // Get daily records — union of dates present in horarios OR marcacao, so
  // days with punches but no planned schedule (and vice-versa) both show up.
  const prefix = filial + '|' + mat + '|';
  const tm = t => { if(!t)return 0; const p=String(t).split(':'); return parseInt(p[0])*60+parseInt(p[1]||0); };
  const diff = (a,b) => { if(!a||!b)return 0; const d=tm(b)-tm(a); return d<0?d+1440:d; };

  const dateSet = new Set();
  for (const key of pontoHorarios.keys()) { if (key.startsWith(prefix)) dateSet.add(key.split('|')[2]); }
  for (const key of pontoMarcacao.keys()) { if (key.startsWith(prefix)) dateSet.add(key.split('|')[2]); }

  const days = [];
  for (const dstr of dateSet) {
    const key  = prefix + dstr;
    const h    = pontoHorarios.get(key);
    const marc = pontoMarcacao.get(key);
    const minP = h ? diff(h.ent1,h.sai1) + (h.ent2&&h.sai2?diff(h.ent2,h.sai2):0) : 0;
    let minT=0;
    if (marc) [[marc.bat1,marc.bat2],[marc.bat3,marc.bat4],[marc.bat5,marc.bat6],[marc.bat7,marc.bat8]]
      .forEach(([a,b])=>{ minT+=diff(a,b); });
    const he=Math.max(0,minT-minP), falta=Math.max(0,minP-minT);
    const pct = minP>0 ? Math.max(0,Math.round((1-falta/minP)*100)) : null; // no schedule to compare against
    days.push({dstr,ent1:h?.ent1,sai1:h?.sai1,ent2:h?.ent2,sai2:h?.sai2,
      bat1:marc?.bat1,bat2:marc?.bat2,bat3:marc?.bat3,bat4:marc?.bat4,
      minP,minT,he,falta,pct});
  }
  days.sort((a,b)=>a.dstr.split('/').reverse().join('').localeCompare(b.dstr.split('/').reverse().join('')));

  const totP = days.reduce((s,d)=>s+d.minP,0);
  const totHE = days.reduce((s,d)=>s+d.he,0);
  const totF  = days.reduce((s,d)=>s+d.falta,0);
  const totPct = totP>0 ? Math.max(0,Math.round((1-totF/totP)*100)) : null;
  const pctClr = p => p==null ? 'var(--text-muted)' : (p>=88?'#48bb78':p>=70?'#f6ad55':'#fc8181');
  const fmtH = m => m>0?(m/60).toFixed(1)+'h':'—';

  // Hour chart — smooth area lines for planned vs real
  const hourPlan = new Array(24).fill(0);
  const hourReal = new Array(24).fill(0);
  days.forEach(d => {
    const tm = t => { if(!t)return null; const p=String(t).split(':'); return parseInt(p[0])*60+parseInt(p[1]||0); };
    [[d.ent1,d.sai1],[d.ent2,d.sai2]].forEach(([e,s])=>{
      const em=tm(e),sm=tm(s); if(em==null||!sm) return;
      for(let h=0;h<24;h++){const hs=h*60,he2=hs+60;const os=Math.max(em,hs),oe=Math.min(sm>em?sm:sm+1440,he2);if(oe>os)hourPlan[h]+=oe-os;}
    });
    [[d.bat1,d.bat2],[d.bat3,d.bat4]].forEach(([a,b])=>{
      const am=tm(a),bm=tm(b); if(am==null||!bm) return;
      for(let h=0;h<24;h++){const hs=h*60,he2=hs+60;const os=Math.max(am,hs),oe=Math.min(bm>am?bm:bm+1440,he2);if(oe>os)hourReal[h]+=oe-os;}
    });
  });
  const maxH = Math.max(...hourPlan,...hourReal,1);
  const W=760, H=80, PAD=28;
  const pts = (arr) => arr.map((v,i)=>`${PAD+i*(W-PAD*2)/23},${H-4-Math.round(v/maxH*(H-8))}`).join(' ');
  const planPts = pts(hourPlan);
  const realPts = pts(hourReal);
  // Smooth polyline using SVG
  const svgPath = (points, close=false) => {
    const arr = points.split(' ').map(p=>p.split(',').map(Number));
    let d = `M ${arr[0][0]} ${arr[0][1]}`;
    for(let i=1;i<arr.length;i++){
      const [px,py]=arr[i-1], [x,y]=arr[i];
      const cx=(px+x)/2;
      d+=` C ${cx},${py} ${cx},${y} ${x},${y}`;
    }
    if(close) d+=` L ${arr[arr.length-1][0]},${H} L ${arr[0][0]},${H} Z`;
    return d;
  };

  const hLabels = Array.from({length:24},(_,h)=>h%3===0?`<text x="${PAD+h*(W-PAD*2)/23}" y="${H+12}" text-anchor="middle" font-size="9" fill="#4a5568">${String(h).padStart(2,'0')}h</text>`:'').join('');
  // Horizontal grid lines
  const grid = [0.25,0.5,0.75,1].map(v=>{
    const y=H-4-Math.round(v*(H-8));
    return `<line x1="${PAD}" y1="${y}" x2="${W-PAD}" y2="${y}" stroke="rgba(255,255,255,0.05)" stroke-width="1"/>`;
  }).join('');

  const chartBars = `<svg width="100%" viewBox="0 0 ${W} ${H+20}" xmlns="http://www.w3.org/2000/svg" style="overflow:visible">
    ${grid}
    <defs>
      <linearGradient id="gradPlan" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#00a0d2" stop-opacity="0.3"/>
        <stop offset="100%" stop-color="#00a0d2" stop-opacity="0.02"/>
      </linearGradient>
      <linearGradient id="gradReal" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#48bb78" stop-opacity="0.4"/>
        <stop offset="100%" stop-color="#48bb78" stop-opacity="0.02"/>
      </linearGradient>
    </defs>
    <path d="${svgPath(planPts,true)}" fill="url(#gradPlan)"/>
    <path d="${svgPath(realPts,true)}" fill="url(#gradReal)"/>
    <path d="${svgPath(planPts)}" fill="none" stroke="#00a0d2" stroke-width="2" stroke-linecap="round"/>
    <path d="${svgPath(realPts)}" fill="none" stroke="#48bb78" stroke-width="2" stroke-linecap="round"/>
    ${hLabels}
  </svg>`;

  // Table rows
  const tableRows = days.map(d => {
    const c2 = pctClr(d.pct);
    const planEnt = [d.ent1,d.ent2].filter(Boolean).join(' / ') || '—';
    const planSai = [d.sai1,d.sai2].filter(Boolean).join(' / ') || '—';
    return `<tr>
      <td>${d.dstr}</td>
      <td style="color:#00a0d2">${planEnt}</td>
      <td style="color:#00a0d2">${planSai}</td>
      <td style="color:#48bb78">${d.bat1||'—'}</td>
      <td style="color:#48bb78">${d.bat2||'—'}</td>
      <td style="color:#48bb78">${d.bat3||'—'}</td>
      <td style="color:#48bb78">${d.bat4||'—'}</td>
      <td style="text-align:right;color:#f6ad55">${fmtH(d.he)}</td>
      <td style="text-align:right;color:#fc8181">${fmtH(d.falta)}</td>
      <td style="text-align:right;font-weight:700;color:${c2}">${d.pct==null?'—':d.pct+'%'}</td>
    </tr>`;
  }).join('');

  return `
    <div class="adh-panel-topbar">
      <div>
        <div class="adh-panel-name">${nome}</div>
        <div class="adh-panel-sub">${mat} · ${cargo}</div>
      </div>
      <div class="adh-panel-summary">
        <span style="color:#8896aa">Prog: <strong style="color:#e8edf5">${fmtH(totP)}</strong></span>
        <span style="color:#f6ad55">HE: <strong>${fmtH(totHE)}</strong></span>
        <span style="color:#fc8181">Falta: <strong>${fmtH(totF)}</strong></span>
        <span style="color:${pctClr(totPct)}">Aderência: <strong>${totPct==null?'—':totPct+'%'}</strong></span>
      </div>
    </div>

    <!-- Chart -->
    <div class="adh-tip-chart-wrap">
      <div class="adh-tip-chart-label">Distribuição por hora · planejado vs realizado</div>
      <div class="adh-tip-chart-svg">${chartBars}</div>
      <div class="adh-tip-chart-legend">
        <span><span class="adh-leg-dot" style="background:#00a0d2"></span>Planejado</span>
        <span><span class="adh-leg-dot" style="background:#48bb78"></span>Realizado</span>
      </div>
    </div>

    <!-- Table -->
    <div class="adh-tip-table-section">
      <table class="adh-tip-table">
        <thead>
          <tr>
            <th>Data</th>
            <th><span class="adh-leg-dot" style="background:#00a0d2"></span>Plan. entrada</th>
            <th><span class="adh-leg-dot" style="background:#00a0d2"></span>Plan. saída</th>
            <th><span class="adh-leg-dot" style="background:#48bb78"></span>Bat.1</th>
            <th><span class="adh-leg-dot" style="background:#48bb78"></span>Bat.2</th>
            <th><span class="adh-leg-dot" style="background:#48bb78"></span>Bat.3</th>
            <th><span class="adh-leg-dot" style="background:#48bb78"></span>Bat.4</th>
            <th style="text-align:right">HE</th>
            <th style="text-align:right">Falta</th>
            <th style="text-align:right">%</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>
    </div>`;
}

function adhLoadingHTML(label) {
  return `
    <div class="adm-progress-wrap" style="padding:28px 20px">
      <i class="ti ti-loader-2" style="font-size:24px;opacity:.5;animation:spin 1s linear infinite" aria-hidden="true"></i>
      <div class="adm-progress-label" id="adh-tip-load-label">${label}</div>
      <div class="adm-progress-track"><div class="adm-progress-fill" id="adh-tip-load-fill" style="width:0%"></div></div>
      <div class="adm-progress-count" id="adh-tip-load-count"></div>
    </div>`;
}

function adhRenderFrozenPanel(html) {
  let panel = document.getElementById('adh-panel');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'adh-panel';
    panel.className = 'adh-panel';
    document.body.appendChild(panel);
  }
  // Add overlay for click-outside-to-close
  let overlay = document.getElementById('adh-panel-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'adh-panel-overlay';
    overlay.className = 'adh-panel-overlay';
    overlay.onclick = () => adhClosePanel();
    document.body.appendChild(overlay);
  }
  overlay.style.display = 'block';

  panel.style.display = 'flex';
  panel.innerHTML = `
    <div class="adh-panel-body">${html}</div>
    <button class="adh-panel-close" onclick="adhClosePanel()" title="Fechar (Esc)">
      <i class="ti ti-x" aria-hidden="true"></i>
    </button>`;

  // Close on Escape key
  window._adhEscHandler = (e) => { if (e.key === 'Escape') adhClosePanel(); };
  window.addEventListener('keydown', window._adhEscHandler);
}

async function adhShowTooltip(e, row, freeze) {
  const mat    = row.dataset.mat;
  const filial = row.dataset.filial;
  const nome   = row.dataset.nome;
  const cargo  = row.dataset.cargo;

  // Collaborator has no ponto data at all for this period — don't bother
  // downloading horarios/marcacao just to show an empty table.
  if (row.dataset.nodata === '1') {
    const msgHTML = `
      <div style="padding:28px 20px;text-align:center">
        <div class="adh-panel-name" style="margin-bottom:4px">${nome}</div>
        <div class="adh-panel-sub" style="margin-bottom:14px">${mat} · ${cargo}</div>
        <p style="color:var(--text-muted);font-size:12px">Sem dados de ponto (Horários/Marcação) para este colaborador neste período.</p>
      </div>`;
    if (freeze) {
      _adhPanelFrozen = true;
      adhHideTooltip();
      adhRenderFrozenPanel(msgHTML);
    } else {
      let tip = document.getElementById('adh-tooltip');
      if (!tip) {
        tip = document.createElement('div');
        tip.id = 'adh-tooltip';
        tip.className = 'adh-tooltip';
        document.body.appendChild(tip);
      }
      tip.innerHTML = msgHTML;
      tip.style.display = 'block';
      adhPositionTooltip(e);
    }
    return;
  }

  // ── Load daily data from DB if not in memory (first hover/click only) ──
  // Horarios (~240k) + Marcacao (~140k) rows take a few seconds even parallelized,
  // so show a real loading state immediately instead of doing nothing visible.
  if (!pontoHorarios?.size || !pontoMarcacao?.size) {
    const loadingHTML = adhLoadingHTML('Baixando dados de ponto (só na 1ª vez)...');

    if (freeze) {
      _adhPanelFrozen = true;
      adhHideTooltip();
      adhRenderFrozenPanel(loadingHTML);
    } else {
      let tip = document.getElementById('adh-tooltip');
      if (!tip) {
        tip = document.createElement('div');
        tip.id = 'adh-tooltip';
        tip.className = 'adh-tooltip';
        document.body.appendChild(tip);
      }
      tip.innerHTML = loadingHTML;
      tip.style.display = 'block';
      adhPositionTooltip(e);
    }

    const prog = (loaded, total) => {
      const fill  = document.getElementById('adh-tip-load-fill');
      const count = document.getElementById('adh-tip-load-count');
      const pct = total ? Math.min(100, Math.round(loaded/total*100)) : 0;
      if (fill)  fill.style.width = pct + '%';
      if (count) count.textContent = `${loaded.toLocaleString('pt-BR')} / ${total.toLocaleString('pt-BR')} · ${pct}%`;
    };

    if (!pontoHorarios?.size) await adminLoadFileOnDemand('horarios', prog);
    if (!pontoMarcacao?.size) await adminLoadFileOnDemand('marcacao', prog);

    // If the user already moved on (closed panel / mouse left) don't force it back open
    if (freeze && !_adhPanelFrozen) return;
    if (!freeze && document.getElementById('adh-tooltip')?.style.display === 'none') return;
  }

  const html = adhBuildPanelContent(mat, filial, nome, cargo);

  if (freeze) {
    _adhPanelFrozen = true;
    adhRenderFrozenPanel(html);
    return;
  }

  // Hover tooltip
  let tip = document.getElementById('adh-tooltip');
  if (!tip) {
    tip = document.createElement('div');
    tip.id = 'adh-tooltip';
    tip.className = 'adh-tooltip';
    document.body.appendChild(tip);
  }
  tip.innerHTML = html;
  tip.style.display = 'block';
  adhPositionTooltip(e);
}

function adhClosePanel() {
  _adhPanelFrozen = false;
  const panel = document.getElementById('adh-panel');
  if (panel) panel.style.display = 'none';
  const overlay = document.getElementById('adh-panel-overlay');
  if (overlay) overlay.style.display = 'none';
  if (window._adhEscHandler) {
    window.removeEventListener('keydown', window._adhEscHandler);
    window._adhEscHandler = null;
  }
  // Hide tooltip too
  adhHideTooltip();
}

function adhPositionTooltip(e) {
  const tip = document.getElementById('adh-tooltip');
  if (!tip || tip.style.display==='none') return;
  const vw=window.innerWidth, vh=window.innerHeight;
  const tw=Math.min(tip.offsetWidth||720, vw-16);
  const th=Math.min(tip.offsetHeight||400, vh-16);
  let x=e.clientX+18, y=e.clientY+18;
  if (x+tw>vw-8) x=e.clientX-tw-8;
  if (y+th>vh-8) y=e.clientY-th-8;
  tip.style.left=Math.max(4,x)+'px';
  tip.style.top=Math.max(4,y)+'px';
}

function adhHideTooltip() {
  const tip = document.getElementById('adh-tooltip');
  if (tip) tip.style.display='none';
}
