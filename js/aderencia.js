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

  // Step 2: For each marcacao row, compute desvio/HE/Falta
  const colabAcc = new Map(); // "filial|mat" → accum

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
    const desvio   = Math.abs(min_trab - min_prog);
    const he       = Math.max(0, min_trab - min_prog);
    const falta    = Math.max(0, min_prog - min_trab);

    const ck = `${filial}|${m.mat}`;
    if (!colabAcc.has(ck)) {
      const nome = hor?.nome || m.nome || '';
      colabAcc.set(ck, { filial, mat: m.mat, nome, min_prog: 0, min_trab: 0, desvio: 0, he: 0, falta: 0 });
    }
    const acc = colabAcc.get(ck);
    acc.min_prog += min_prog;
    acc.min_trab += min_trab;
    acc.desvio   += desvio;
    acc.he       += he;
    acc.falta    += falta;
  }

  // Step 3: Aggregate per base
  for (const [ck, c] of colabAcc) {
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

    // % aderencia per colab
    const pct = c.min_prog > 0
      ? Math.max(0, Math.round(100 - (c.desvio / c.min_prog * 100) * 10) / 10)
      : 0;
    colabKPI.set(ck, { ...c, pct, he_h: Math.round(c.he/60*10)/10, falta_h: Math.round(c.falta/60*10)/10 });
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
    <div class="adh-loading">
      <i class="ti ti-loader-2" style="font-size:28px;animation:spin 1s linear infinite;opacity:.5" aria-hidden="true"></i>
      <span id="adh-load-msg">Carregando dados...</span>
    </div>`;

  const setMsg = m => { const e = document.getElementById('adh-load-msg'); if(e) e.textContent = m; };

  // Load files on demand
  if (!pontoHorarios?.size) {
    setMsg('Baixando Horários do servidor...');
    await adminLoadFileOnDemand('horarios');
  }
  if (!pontoMarcacao?.size) {
    setMsg('Baixando Marcação do servidor...');
    await adminLoadFileOnDemand('marcacao');
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

  // Always rebuild KPI after fresh load from DB
  setMsg('Calculando aderência...');
  await new Promise(r => setTimeout(r, 20)); // yield to UI
  adhBaseKPI = null; adhColabKPI = null; // force fresh calculation
  adhBuildKPI();

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
    // Try to compute — maybe data was just loaded
    if (!adhBaseKPI) adhBuildKPI();
    const bk2 = adhBaseKPI?.get(base);
    if (!bk2) {
      el.innerHTML = `
        <div class="page-header"><div>
          <h1 class="page-title">Aderência · ${base}</h1>
        </div></div>
        <div class="adh-denied">
          <i class="ti ti-clock-off" style="font-size:36px;opacity:.2" aria-hidden="true"></i>
          <p>Nenhum dado encontrado para a base <strong>${base}</strong>.<br>
          Verifique se os arquivos de ponto foram carregados no Admin.</p>
        </div>`;
      return;
    }
    return adhRenderDetalhe(el, base, showBack);
  }

  // If no base specified (admin with all) pick global
  const pct    = bk ? bk.pct    : adhGlobalPct();
  const he_h   = bk ? bk.he_h   : [...adhBaseKPI.values()].reduce((a,d)=>a+d.he_h,0);
  const fat_h  = bk ? bk.falta_h: [...adhBaseKPI.values()].reduce((a,d)=>a+d.falta_h,0);
  const colabs = bk ? bk.colabs  : [...adhBaseKPI.values()].reduce((a,d)=>a+d.colabs,0);
  const prog_h = bk ? bk.prog_h  : [...adhBaseKPI.values()].reduce((a,d)=>a+d.prog_h,0);
  const pctClr = adhPctColor(pct);

  // Top 10 piores colaboradores desta base
  const colabsBase = [...adhColabKPI.entries()]
    .filter(([k,]) => !base || k.startsWith(base+'|'))
    .map(([,d]) => d)
    .filter(d => d.min_prog > 0)
    .sort((a,b) => a.pct - b.pct)
    .slice(0, 10);

  // HE x Falta comparison (for admin showing other bases, show top 10)
  let heVsFaltaRows = '';
  if (!base) {
    const sorted = [...adhBaseKPI.entries()]
      .filter(([,d]) => d.min_prog > 0)
      .sort((a,b) => b[1].he_h - a[1].he_h);
    heVsFaltaRows = sorted.map(([b, d]) => `
      <tr>
        <td><span class="adm-base-tag">${b}</span></td>
        <td style="color:#f59e0b;font-weight:600;text-align:right">${adhFmtH(d.he_h)}</td>
        <td style="color:#ef4444;font-weight:600;text-align:right">${adhFmtH(d.falta_h)}</td>
        <td style="color:#94a3b8;text-align:right">${d.colabs}</td>
      </tr>`).join('');
  }

  el.innerHTML = `
    <div class="page-header">
      <div style="display:flex;align-items:center;gap:12px">
        ${showBack ? `<button class="adh-back-btn" onclick="pageAderencia(document.getElementById('page-content'))">
          <i class="ti ti-arrow-left" aria-hidden="true"></i>
        </button>` : ''}
        <div>
          <h1 class="page-title">
            Aderência ao Ponto
            <span class="adh-base-badge">${base || 'Geral'}</span>
          </h1>
          <p class="page-sub">Horas trabalhadas ÷ horas programadas</p>
        </div>
      </div>
    </div>

    <!-- KPIs -->
    <div class="adh-det-kpis">
      <div class="adh-det-kpi" style="border-top:3px solid ${pctClr}">
        <div class="adh-det-kpi-v" style="color:${pctClr}">${pct}%</div>
        <div class="adh-det-kpi-l">% Escala realizada</div>
        <div class="adh-mini-bar" style="margin-top:8px"><div style="width:${pct}%;background:${pctClr}"></div></div>
      </div>
      <div class="adh-det-kpi" style="border-top:3px solid #f59e0b">
        <div class="adh-det-kpi-v" style="color:#f59e0b">${adhFmtH(he_h)}</div>
        <div class="adh-det-kpi-l">Horas extras</div>
      </div>
      <div class="adh-det-kpi" style="border-top:3px solid #ef4444">
        <div class="adh-det-kpi-v" style="color:#ef4444">${adhFmtH(fat_h)}</div>
        <div class="adh-det-kpi-l">Horas a menos</div>
      </div>
      <div class="adh-det-kpi" style="border-top:3px solid #a78bfa">
        <div class="adh-det-kpi-v" style="color:#a78bfa">${adhFmtH(prog_h)}</div>
        <div class="adh-det-kpi-l">Horas programadas</div>
      </div>
      <div class="adh-det-kpi" style="border-top:3px solid #94a3b8">
        <div class="adh-det-kpi-v" style="color:#94a3b8">${colabs.toLocaleString()}</div>
        <div class="adh-det-kpi-l">Colaboradores</div>
      </div>
    </div>

    <!-- Bottom: Top 10 piores + HE vs Falta -->
    <div class="adh-charts-row">

      <!-- Top 10 piores aderências -->
      <div class="adh-chart-card" style="grid-column:span 2">
        <div class="adh-chart-title">Top 10 piores aderências · colaboradores</div>
        <div class="adm-table-wrap">
          <table class="adm-table">
            <thead>
              <tr>
                <th>Base</th><th>Matrícula</th><th>Nome</th>
                <th class="r">Prog(h)</th><th class="r">HE(h)</th><th class="r">Falta(h)</th>
                <th class="r">% Ader.</th>
              </tr>
            </thead>
            <tbody>
              ${colabsBase.map(c => {
                const cc = adhPctColor(c.pct);
                return `<tr>
                  <td><span class="adm-base-tag">${c.filial}</span></td>
                  <td style="font-family:monospace">${c.mat}</td>
                  <td>${c.nome}</td>
                  <td class="r">${(c.min_prog/60).toFixed(0)}h</td>
                  <td class="r" style="color:#f59e0b">${c.he_h.toFixed(1)}h</td>
                  <td class="r" style="color:#ef4444">${c.falta_h.toFixed(1)}h</td>
                  <td class="r" style="color:${cc};font-weight:700">${c.pct}%</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- HE vs Falta por base (se não filtrado por base) -->
      <div class="adh-chart-card">
        ${base ? `
          <div class="adh-chart-title">% Aderência · ${base}</div>
          <div style="display:flex;align-items:center;justify-content:center;height:120px">
            <div style="text-align:center">
              <div style="font-size:48px;font-weight:800;color:${pctClr};line-height:1">${pct}%</div>
              <div style="font-size:11px;color:var(--text-muted);margin-top:6px">escala realizada</div>
            </div>
          </div>
          <div style="display:flex;flex-direction:column;gap:8px;margin-top:12px">
            <div style="display:flex;justify-content:space-between;font-size:12px;padding:8px;background:rgba(245,158,11,0.08);border-radius:7px">
              <span style="color:var(--text-muted)">Horas extras</span>
              <span style="color:#f59e0b;font-weight:700">+${adhFmtH(he_h)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:12px;padding:8px;background:rgba(239,68,68,0.08);border-radius:7px">
              <span style="color:var(--text-muted)">Horas a menos</span>
              <span style="color:#ef4444;font-weight:700">−${adhFmtH(fat_h)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:12px;padding:8px;background:rgba(255,255,255,0.03);border-radius:7px">
              <span style="color:var(--text-muted)">Programadas</span>
              <span style="color:#a78bfa;font-weight:700">${adhFmtH(prog_h)}</span>
            </div>
          </div>
        ` : `
          <div class="adh-chart-title">HE × Horas a Menos por base</div>
          <div class="adm-table-wrap" style="max-height:300px;overflow-y:auto">
            <table class="adm-table">
              <thead><tr><th>Base</th><th class="r">HE (h)</th><th class="r">Falta (h)</th><th class="r">Colabs</th></tr></thead>
              <tbody>${heVsFaltaRows}</tbody>
            </table>
          </div>
        `}
      </div>
    </div>`;
}
