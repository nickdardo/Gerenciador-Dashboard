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
  // Excel serial date number (cell wasn't recognized/formatted as a date by
  // the reader) — e.g. 46174 → 01/06/2026. Without this, raw serials leak
  // straight into the UI as-is (shows "46174" instead of a real date).
  if (typeof d === 'number') {
    const ms = Math.round((d - 25569) * 86400 * 1000);
    const dt = new Date(ms);
    return String(dt.getUTCDate()).padStart(2,'0') + '/' +
           String(dt.getUTCMonth()+1).padStart(2,'0') + '/' +
           dt.getUTCFullYear();
  }
  // Already a string like "2026-06-01"
  const s = String(d);
  if (s.includes('-') && s.length >= 10) {
    const [y,m,dd] = s.split('T')[0].split('-');
    return `${dd}/${m}/${y}`;
  }
  // String that's actually just digits (serial date stored/passed as text)
  if (/^\d{4,6}$/.test(s.trim())) {
    const ms = Math.round((parseInt(s.trim()) - 25569) * 86400 * 1000);
    const dt = new Date(ms);
    if (!isNaN(dt)) {
      return String(dt.getUTCDate()).padStart(2,'0') + '/' +
             String(dt.getUTCMonth()+1).padStart(2,'0') + '/' +
             dt.getUTCFullYear();
    }
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
  adhSplitOvernightMarcacao(pontoMarcacao);
  console.log(`[aderencia] Marcacao parsed: ${pontoMarcacao.size} keys`);
}

// Quando um turno começa tarde da noite (ex: 23:45) e continua depois da
// meia-noite, o arquivo de Marcação às vezes registra TUDO na linha do dia
// em que o turno começou, jogando as batidas 5-8 (a continuação) pra dentro
// do dia anterior — e o dia seguinte, que é onde a maior parte do turno de
// fato acontece, fica com "sem marcação nenhuma". Aqui a gente identifica
// esse padrão (uma 5ª+ batida tarde da noite) e realoca esse par pro dia
// seguinte, onde ele realmente pertence.
function adhSplitOvernightMarcacao(map) {
  const LIMIAR_HORA = 22; // batida a partir dessa hora é considerada "virada de turno"
  const mudancas = [];

  for (const [key, m] of map) {
    if (!m.bat5) continue;
    const hora = parseInt(String(m.bat5).split(':')[0], 10);
    if (isNaN(hora) || hora < LIMIAR_HORA) continue;

    const [filial, mat, dstr] = key.split('|');
    const [d, mo, y] = dstr.split('/').map(Number);
    const prox = new Date(y, mo - 1, d + 1);
    const proxDstr = `${String(prox.getDate()).padStart(2,'0')}/${String(prox.getMonth()+1).padStart(2,'0')}/${prox.getFullYear()}`;
    const proxKey = `${filial}|${mat}|${proxDstr}`;

    mudancas.push({
      key, proxKey, filial, mat, nome: m.nome,
      bat1: m.bat5, bat2: m.bat6, bat3: m.bat7, bat4: m.bat8,
    });
  }

  for (const c of mudancas) {
    // Remove as batidas 5-8 do dia original (ficam só as 1-4 de fato daquele dia)
    const original = map.get(c.key);
    if (original) {
      delete original.bat5; delete original.bat6; delete original.bat7; delete original.bat8;
    }
    // Move essas batidas para o dia seguinte
    const destino = map.get(c.proxKey);
    if (destino) {
      // já existe marcação no dia seguinte — anexa como batidas extras (5-8),
      // só se ainda não estiverem ocupadas
      if (!destino.bat5) {
        destino.bat5 = c.bat1; destino.bat6 = c.bat2; destino.bat7 = c.bat3; destino.bat8 = c.bat4;
      }
    } else {
      map.set(c.proxKey, {
        filial: c.filial, mat: c.mat, nome: c.nome,
        bat1: c.bat1, bat2: c.bat2, bat3: c.bat3, bat4: c.bat4,
      });
    }
  }
  if (mudancas.length) console.log(`[aderencia] ${mudancas.length} viradas de turno realocadas para o dia seguinte`);
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

// ── Corte por mês ──────────────────────────────────────
// O cálculo de aderência considera só o mês selecionado (por padrão, o mês
// corrente real). Isso evita que sobras de meses antigos nas tabelas de
// Horários/Marcação misturem-se com o período atual.
function adhCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
}

function adhMesDaData(dstr) {
  const p = String(dstr||'').split('/');
  if (p.length !== 3) return null;
  return `${p[2]}-${p[1]}`;
}

const ADH_MESES_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
function adhMonthLabel(mes) {
  const [y,m] = String(mes||'').split('-');
  const idx = parseInt(m,10) - 1;
  return (ADH_MESES_PT[idx] || mes) + '/' + y;
}

function adhDaysInMonth(mes) {
  const [y,m] = mes.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

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
        .select('matricula,nome,station,funcao,ch,situacao,admissao')
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
function adhBuildKPI(mes) {
  if (!pontoHorarios?.size || !pontoMarcacao?.size) return false;
  if (!mes) mes = adhCurrentMonth();

  const baseKPI  = new Map();
  const colabKPI = new Map();

  // Index horarios by "FILIAL|mat|data" so we can look up "what was planned
  // that specific day" while iterating marcação.
  const horByKey = new Map();
  for (const [key, h] of pontoHorarios) {
    const [filialRaw, mat, data] = key.split('|');
    if (adhMesDaData(data) !== mes) continue; // fora do mês alvo
    horByKey.set(`${(filialRaw||'').toUpperCase()}|${mat}|${data}`, h);
  }

  // The aderência ratio is driven PURELY by marcação rows — matching the
  // official Excel calculation (validated directly against it). A day
  // scheduled in Horários with NO row at all in Marcação (~45% of scheduled
  // days system-wide) does not count toward either side of the ratio.
  const colabAcc = new Map(); // "FILIAL|mat" → accum
  for (const [key, m] of pontoMarcacao) {
    const [filialRaw, mat, data] = key.split('|');
    if (adhMesDaData(data) !== mes) continue; // fora do mês alvo
    const filial = (filialRaw||'').toUpperCase();
    if (ADH_EXCLUDE.has(filial)) continue;

    const nk = `${filial}|${mat}|${data}`;
    const h = horByKey.get(nk);
    const min_prog = h ? (adhMinDiff(adhTimeToMin(h.ent1), adhTimeToMin(h.sai1))
      + (h.ent2 && h.sai2 ? adhMinDiff(adhTimeToMin(h.ent2), adhTimeToMin(h.sai2)) : 0)) : 0;
    // Marcação frequentemente perde a primeira batida do dia (comum em entradas
    // de madrugada, ~1.2% das linhas — bug de exportação, não falta real).
    // Se planejado começa às 00:00 e existe qualquer outra batida naquele
    // dia (prova de presença), recupera a entrada usando o planejado.
    const temOutraBatida = m.bat2||m.bat3||m.bat4||m.bat5||m.bat6||m.bat7||m.bat8;
    const bat1 = (!m.bat1 && h?.ent1 && temOutraBatida) ? h.ent1 : m.bat1;
    let min_trab = 0;
    [[bat1,m.bat2],[m.bat3,m.bat4],[m.bat5,m.bat6],[m.bat7,m.bat8]]
      .forEach(([e,s]) => { if (e && s) min_trab += adhMinDiff(adhTimeToMin(e), adhTimeToMin(s)); });

    const ck = `${filial}|${mat}`;
    if (!colabAcc.has(ck)) {
      colabAcc.set(ck, { filial, mat, nome: h?.nome || m.nome || '', min_prog:0, min_trab:0, desvio:0, he:0, falta:0 });
    }
    const acc = colabAcc.get(ck);
    acc.min_prog += min_prog;
    acc.min_trab += min_trab;
    acc.desvio   += Math.abs(min_trab - min_prog);
    acc.he       += Math.max(0, min_trab - min_prog);
    acc.falta    += Math.max(0, min_prog - min_trab);
  }

  // Desligados (HRCL106) saem do cálculo por completo.
  if (window.eoDesligados?.size) {
    for (const ck of [...colabAcc.keys()]) {
      const mat = ck.split('|')[1];
      if (window.eoDesligados.has(mat)) colabAcc.delete(ck);
    }
  }

  // Cargos isentos de bater ponto (Gerentes e Coordenadores) — não entram no
  // cálculo acima (sem marcação), mas mostramos explicitamente como 100% na
  // lista em vez de sumir, sem afetar a média da base.
  function adhCargoIsento(funcao) {
    const f = String(funcao || '').toUpperCase();
    return f.includes('GERENTE') || f.includes('COORDENADOR');
  }
  const totalMpByPerson = new Map(); // "FILIAL|mat" → { mp, nome }
  for (const [key, h] of pontoHorarios) {
    const filial = (h.filial||'').toUpperCase();
    if (ADH_EXCLUDE.has(filial)) continue;
    const [, , data] = key.split('|');
    if (adhMesDaData(data) !== mes) continue; // fora do mês alvo
    const ck = `${filial}|${h.mat}`;
    const minP = adhMinDiff(adhTimeToMin(h.ent1), adhTimeToMin(h.sai1))
      + (h.ent2 && h.sai2 ? adhMinDiff(adhTimeToMin(h.ent2), adhTimeToMin(h.sai2)) : 0);
    if (!totalMpByPerson.has(ck)) totalMpByPerson.set(ck, { mp: 0, nome: h.nome || '' });
    totalMpByPerson.get(ck).mp += minP;
  }
  for (const [ck, t] of totalMpByPerson) {
    if (colabAcc.has(ck) || t.mp <= 0) continue;
    const [filial, mat] = ck.split('|');
    if (window.eoDesligados?.has(mat)) continue; // desligado — fora do cálculo
    if (!adhCargoIsento(window.eoColabs?.get(mat)?.funcao)) continue;
    colabAcc.set(ck, { filial, mat, nome: t.nome, min_prog: t.mp, min_trab: 0, desvio: 0, he: 0, falta: 0, isento: true });
  }

  // Step 3: Build colab KPI list + aggregate per base. Exempted management
  // (isento) shows 100% in the list but doesn't count toward the base's %
  // aderência, matching the official Excel calculation exactly.
  for (const [ck, c] of colabAcc) {
    if (!c.min_prog && !c.min_trab) continue; // truly nothing at all

    const pct = c.min_prog > 0
      ? Math.max(0, Math.round((100 - c.desvio / c.min_prog * 100) * 10) / 10)
      : null;
    colabKPI.set(ck, { ...c, pct, he_h: Math.round(c.he/60*10)/10, falta_h: Math.round(c.falta/60*10)/10 });

    if (c.min_prog > 0 && !c.isento) {
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
  return Math.round(h).toLocaleString('pt-BR') + 'h';
}

// Formato mais legível pra valores por colaborador (diferente do adhFmtH,
// usado nos totais grandes da base): menos de 1h mostra em minutos,
// 1h ou mais mostra em horas fechadas (sem casas decimais).
function adhHuman(h) {
  if (h == null || isNaN(h)) return '—';
  if (h <= 0) return '0min';
  if (h < 1) return `${Math.round(h * 60)}min`;
  return `${Math.round(h)}h`;
}

// Force a fresh reload of aderência data, bypassing the localStorage cache —
// gives users a one-click way to refresh instead of clearing cache manually.
async function adhForceRefresh() {
  try {
    const toRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith('adh_kpi_cache') || k.startsWith('adh_kpi_ts'))) toRemove.push(k);
    }
    toRemove.forEach(k => localStorage.removeItem(k));
  } catch(_){}
  adhBaseKPI = null; adhColabKPI = null;
  const el = window._adhCurrentEl;
  if (el) await pageAderencia(el);
}

// Força atualização, além de trocar o mês selecionado.
async function adhChangeMonth(mes) {
  window._adhMes = mes;
  adhBaseKPI = null; adhColabKPI = null;
  const el = window._adhCurrentEl;
  if (el) await pageAderencia(el);
}

function adhMonthSelectorHTML() {
  const mes = window._adhMes || adhCurrentMonth();
  const atual = adhCurrentMonth();
  const [y,m] = atual.split('-').map(Number);
  const prevDate = new Date(y, m-2, 1); // mês anterior ao atual
  const prevMes = `${prevDate.getFullYear()}-${String(prevDate.getMonth()+1).padStart(2,'0')}`;
  const opts = [atual, prevMes];
  return `
    <select class="adh-month-select" onchange="adhChangeMonth(this.value)" title="Mês de referência">
      ${opts.map(o => `<option value="${o}" ${o===mes?'selected':''}>${adhMonthLabel(o)}${o===atual?' (atual)':''}</option>`).join('')}
    </select>`;
}

// ══════════════════════════════════════════════════════
// ENTRY POINT
// ══════════════════════════════════════════════════════
async function pageAderencia(el) {
  window._adhCurrentEl = el;
  const role  = currentUserProfile?.role;
  const bases = currentUserProfile?.bases || [];
  const ROLES_OK = ['admin','gerente','coordenador','supervisor','lideranca'];

  if (!window._adhMes) window._adhMes = adhCurrentMonth();
  const mes = window._adhMes;

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
        <p class="page-sub">Planejado vs realizado · fórmula: MAX(0, 100 - Desvio/Programado × 100) · ${adhMonthLabel(mes)}</p>
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

  // ── LAYER 1: localStorage cache (instantâneo) — uma cache por mês ──
  const CACHE_KEY = 'adh_kpi_cache_' + mes;
  const CACHE_TS  = 'adh_kpi_ts_' + mes;
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
        console.log(`[aderencia] Loaded from localStorage cache (${mes})`);
        // Skip loading, go straight to render
        await rosterPromise;
        if (role === 'admin') { adhRenderMultiBase(el); return; }
        const myBase = bases.includes('*') ? null : (bases[0] || null);
        adhRenderDetalhe(el, myBase, false);
        return;
      }
    }
  } catch(_) {}

  // ── LAYER 2: banco aderencia_kpi (rápido ~30 rows), filtrado pelo mês ──
  setMsg('Carregando KPI do banco...');
  try {
    // aderencia_colab pode ter milhares de linhas — o Supabase corta em 1000
    // por página independente do .limit() pedido, então paginamos com .range().
    async function fetchAllColabRows() {
      const PAGE = 1000;
      const { count, error: eCount } = await db.from('aderencia_colab').select('*', { count:'exact', head:true }).eq('mes', mes);
      if (eCount || !count) return [];
      const all = [];
      for (let from = 0; from < count; from += PAGE) {
        const { data, error } = await db.from('aderencia_colab').select('*').eq('mes', mes).range(from, from + PAGE - 1);
        if (error) throw new Error(error.message);
        if (data) all.push(...data);
      }
      return all;
    }

    const [{ data: kpiRows, error: e1 }, colabRows] = await Promise.all([
      db.from('aderencia_kpi').select('*').eq('mes', mes),
      fetchAllColabRows(),
    ]);
    if (e1) console.warn('[aderencia] DB KPI query error', e1);

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
      console.log(`[aderencia] Loaded ${kpiRows.length} bases, ${colabRows.length} colaboradores from DB KPI (${mes})`);

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

  // ── LAYER 3: calcular na hora (só 1ª vez, banco vazio, ou mês sem dado salvo ainda) ──
  setMsg('Baixando dados para calcular este mês...');
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
  await rosterPromise; // precisa do roster carregado p/ isenção de cargo (gerente/coordenador)
  adhBaseKPI = null; adhColabKPI = null;
  adhBuildKPI(mes);

  // Trigger precompute to save for next time (só faz sentido persistir o mês
  // corrente — meses anteriores são só consulta, não sobrescrevem nada novo)
  if (mes === adhCurrentMonth() && typeof adminPrecomputeAderencia === 'function') {
    adminPrecomputeAderencia(mes).catch(console.warn);
  }

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
        <div style="display:flex;align-items:center;gap:12px">
          ${adhMonthSelectorHTML()}
          <button class="adh-refresh-btn" onclick="adhForceRefresh()" title="Atualizar dados agora (ignora cache local)">
            <i class="ti ti-refresh" aria-hidden="true"></i> Atualizar
          </button>
          <span class="adh-global-badge" style="color:${gColor}">${global}% escala realizada</span>
        </div>
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
          <div class="adh-full-kpi-v" style="color:#8896aa">${(window.eoColabs?.size || totColabs).toLocaleString('pt-BR')}</div>
          <div class="adh-full-kpi-l">Colaboradores (total)</div>
          <div class="adh-full-kpi-sub" style="color:#72c02c">${totColabs.toLocaleString('pt-BR')} com ponto registrado</div>
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
            ${(() => {
              const rosterByBase = new Map();
              if (window.eoColabs) {
                for (const [, r] of window.eoColabs) {
                  const st = (r.station || '').toUpperCase();
                  rosterByBase.set(st, (rosterByBase.get(st) || 0) + 1);
                }
              }
              return sorted.map(([base, d]) => {
                const cl = adhPctColor(d.pct);
                const rosterTotal = rosterByBase.get(base);
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
                    <span title="Colaboradores com ponto registrado${rosterTotal?` / total no cadastro (${rosterTotal})`:''}">
                      <i class="ti ti-users" style="font-size:9px;opacity:.5" aria-hidden="true"></i>
                      ${d.colabs}${rosterTotal ? `<span style="opacity:.45">/${rosterTotal}</span>` : ''}
                    </span>
                  </div>
                </div>`;
              }).join('');
            })()}
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
  window._adhSearchQuery = '';
  window._adhCargoFilter = new Set();
  window._adhChFilter    = new Set();
  window._adhPcdFilter   = false;
  window._adhSortField = 'desvio';
  window._adhSortDir   = -1;

  // Group cargos into broad categories, and collect distinct carga horária
  // values — both used to build the quick-filter pills below.
  const catCounts = new Map();
  const chCounts  = new Map();
  for (const c of colabListFull) {
    const funcao = c.funcao || window.eoColabs?.get(c.mat)?.funcao;
    const cat = adhCargoCategoria(funcao);
    catCounts.set(cat, (catCounts.get(cat) || 0) + 1);
    const chVal = c.ch ?? window.eoColabs?.get(c.mat)?.ch ?? 0;
    if (chVal) chCounts.set(chVal, (chCounts.get(chVal) || 0) + 1);
  }
  const catList = [...catCounts.entries()].sort((a,b) => b[1]-a[1]);
  const chList  = [...chCounts.entries()].sort((a,b) => a[0]-b[0]);
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
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
            </svg>
          </button>` : ''}
          <div>
            <h1 class="adh-full-title">
              Aderência ao Ponto
              ${base ? `<span class="adh-base-badge">${base}</span>` : ''}
            </h1>
            <p class="adh-full-sub">Horas trabalhadas ÷ horas programadas</p>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:12px">
          ${adhMonthSelectorHTML()}
          <button class="adh-refresh-btn" onclick="adhForceRefresh()" title="Atualizar dados agora (ignora cache local)">
            <i class="ti ti-refresh" aria-hidden="true"></i> Atualizar
          </button>
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
          <div class="adh-det-kpi-v" style="color:#8896aa">${colabs.toLocaleString('pt-BR')}</div>
          <div class="adh-det-kpi-l">Colaboradores (total)</div>
          ${bk ? `<div class="adh-full-kpi-sub" style="color:#72c02c">${bk.colabs.toLocaleString('pt-BR')} com ponto registrado</div>` : ''}
        </div>
      </div>

      <!-- Table -->
      <div class="adh-colab-section">
        <div class="adh-search-wrap">
          <i class="ti ti-search" aria-hidden="true"></i>
          <input type="text" id="adh-search-input" placeholder="Buscar por nome ou matrícula..." oninput="adhSearchColab(this.value)">
        </div>

        <div class="adh-filter-pills-row">
          <span class="adh-filter-pills-label">Função</span>
          ${catList.map(([cat,n]) => `
            <button class="adh-cat-pill" onclick="adhToggleCargoFilter('${cat.replace(/'/g,"\\'")}',this)">
              ${cat} <span class="adh-pill-count">${n}</span>
            </button>`).join('')}
        </div>
        <div class="adh-filter-pills-row">
          <span class="adh-filter-pills-label">Carga horária</span>
          ${chList.map(([ch,n]) => `
            <button class="adh-cat-pill" onclick="adhToggleChFilter(${ch},this)">
              ${ch}h <span class="adh-pill-count">${n}</span>
            </button>`).join('')}
        </div>

        <div class="adh-colab-header-row">
          <span id="adh-colab-count" style="font-size:10px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--text-muted)">
            ${colabList.length} colaboradores · passe o mouse para ver detalhes diários
          </span>
          <div class="adh-sort-btns">
            <button class="adh-sort-btn adh-situ-filter-btn active" onclick="adhFilterSituacao('all',this)">Todos</button>
            <button class="adh-sort-btn adh-situ-filter-btn" onclick="adhFilterSituacao('ativo',this)">Ativos</button>
            <button class="adh-sort-btn adh-situ-filter-btn" onclick="adhFilterSituacao('afastado',this)">Afastados</button>
            <button class="adh-sort-btn" onclick="adhTogglePcdFilter(this)" title="Mostrar só colaboradores PCD">
              <i class="ti ti-wheelchair" style="font-size:12px;vertical-align:middle"></i> PCD
            </button>
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
                <th class="r" data-sort="ch"    onclick="adhSortByCol('ch',this)">Carga(h)</th>
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
      out.push({ ...kpi, funcao: r.funcao, situacao: r.situacao, ch: r.ch });
    } else {
      out.push({
        filial: base, mat: matPad, matricula: matPad, nome: r.nome,
        funcao: r.funcao, situacao: r.situacao, ch: r.ch,
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
  // Exact match only — "Trabalhando" means active. Anything else (including
  // things that merely mention the word, like "Acidente Trabalho") is not.
  return String(situacao || '').trim().toLowerCase() === 'trabalhando';
}

// Cruza Desligamentos (HRCL106) e Férias (HRCL107) com a situação bruta do
// cadastro (HRCL204), aplicando prioridade: Desligado > Férias > bruta.
// Retorna null quando não há nada para sobrepor (usar a situação bruta).
function adhSituacaoEfetiva(mat) {
  const desl = window.eoDesligados?.get(mat);
  if (desl) return { texto: 'Desligado', tipo: 'desligado' };

  const fer = window.eoFerias?.get(mat);
  if (fer && fer.data_fim) {
    const [y, m, d] = fer.data_fim.split('-');
    return { texto: `Férias (até ${d}/${m})`, tipo: 'ferias' };
  }
  return null;
}

// Groups varied cargo/função strings into broad categories for quick
// filtering. Order matters — checked top to bottom, first match wins.
function adhCargoCategoria(funcao) {
  const f = String(funcao || '').toUpperCase();
  if (!f) return 'Sem cargo';
  if (f.includes('RAMPA'))                              return 'Rampa';
  if (f.includes('LIMPEZA'))                             return 'Limpeza';
  if (f.includes('GERENTE'))                             return 'Gestão';
  if (f.includes('COORDENADOR'))                         return 'Coordenação';
  if (f.includes('SUPERVISOR') || f.includes('LIDER'))   return 'Supervisão';
  if (f.includes('MECANIC') || f.includes('ELETRIC') || f.includes('MANUTEN')) return 'Manutenção';
  if (f.includes('SEGURAN'))                             return 'Segurança';
  if (f.includes('PASSAGEIRO') || f.includes('AGENTE'))  return 'Atendimento';
  if (f.includes('APRENDIZ'))                            return 'Aprendiz';
  if (f.includes('ADMINISTRATIVO') || f.includes('ANALISTA') || f.includes('ESPECIALISTA') || f.includes('PLAN')) return 'Administrativo';
  if (f.includes('OPERADOR') || f.includes('OPERA'))     return 'Operações';
  return 'Outros';
}

function adhRenderColabRows(list, base) {
  return list.map(c => {
    const mat        = c.mat || c.matricula || '';
    const cargo      = c.funcao   || window.eoColabs?.get(mat)?.funcao   || '';
    const rawSituacao= c.situacao || window.eoColabs?.get(mat)?.situacao || '';
    const efetiva    = adhSituacaoEfetiva(mat);
    const situacao   = efetiva ? efetiva.texto : rawSituacao;
    const ativo      = efetiva ? false : adhIsAtivo(rawSituacao);
    const situClass  = efetiva?.tipo === 'desligado' ? 'adh-situ-desligado'
                      : efetiva?.tipo === 'ferias'    ? 'adh-situ-ferias'
                      : (ativo ? 'adh-situ-ativo' : 'adh-situ-afastado');
    const ch      = c.ch ?? window.eoColabs?.get(mat)?.ch ?? 0;
    const situBadge = situacao
      ? `<span class="adh-situ-badge ${situClass}">${situacao}</span>`
      : '';
    const pcdInfo = window.eoPcd?.get(mat);
    const pcdBadge = pcdInfo
      ? `<i class="ti ti-wheelchair" style="color:#a78bfa;font-size:12px;margin-left:6px;vertical-align:middle" title="PCD: ${pcdInfo.deficiencia||''}" aria-hidden="true"></i>`
      : '';
    const rowClass = 'adh-colab-row' + (c.semDados ? ' adh-colab-row-nodata' : '');
    // Flag deviations from people who aren't actually "Trabalhando" this
    // period (férias, afastamento, aposentadoria etc) — the falta/% here
    // often just reflects their absence, not a real scheduling problem.
    const flagAusencia = !c.semDados && !ativo && situacao && c.pct != null;
    const pctCell = (c.pct == null)
      ? `<td class="r" style="color:var(--text-muted);font-size:10px" title="${c.semDados ? 'Sem dados de ponto neste período' : 'Tem marcação mas nenhum horário programado neste período'}">${c.semDados ? '—' : 's/ prog.'}</td>`
      : `<td class="r">
          <span style="font-weight:700;color:${adhPctColor(c.pct)}">${c.pct}%</span>
          ${flagAusencia ? `<i class="ti ti-alert-triangle" style="font-size:10px;color:#f59e0b;margin-left:5px" title="Colaborador consta como &quot;${situacao}&quot; neste período — o desvio pode refletir a ausência, não um problema de escala"></i>` : ''}
        </td>`;
    return `<tr class="${rowClass}"
      data-mat="${mat}"
      data-filial="${c.filial||base||''}"
      data-nome="${c.nome}"
      data-cargo="${cargo}"
      data-nodata="${c.semDados?1:0}"
      onmouseenter="adhShowTooltip(event,this,false).catch(console.warn)"
      onmouseleave="adhHideTooltip()">
      <td style="font-family:monospace;font-size:11px">${mat}</td>
      <td style="font-weight:500">${c.nome}${pcdBadge}</td>
      <td style="color:var(--text-muted);font-size:11px">${cargo}</td>
      <td style="text-align:center">${situBadge}</td>
      <td class="r" style="color:var(--text-muted)">${ch ? ch+'h' : '—'}</td>
      <td class="r">${c.semDados ? '—' : adhHuman(c.min_prog/60)}</td>
      <td class="r" style="color:#f6ad55">${c.semDados ? '—' : adhHuman(c.he_h)}</td>
      <td class="r" style="color:#fc8181">${c.semDados ? '—' : adhHuman(c.falta_h)}</td>
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
      case 'situacao': {
        const mat = c.mat || c.matricula || '';
        const efetiva = adhSituacaoEfetiva(mat);
        return (efetiva ? efetiva.texto : (c.situacao || window.eoColabs?.get(mat)?.situacao || '')).toLowerCase();
      }
      case 'ch':       return c.ch ?? window.eoColabs?.get(c.mat)?.ch ?? 0;
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

// Re-applies the current situação filter + cargo/CH filters + search + sort,
// and redraws just the table.
function adhRerenderColabTable() {
  let list = (window._adhColabListFull || []).slice();
  if (window._adhSituacaoFilter === 'ativo')    list = list.filter(c => adhIsAtivo(c.situacao));
  if (window._adhSituacaoFilter === 'afastado') list = list.filter(c => !adhIsAtivo(c.situacao));

  if (window._adhPcdFilter) {
    list = list.filter(c => window.eoPcd?.has(c.mat || c.matricula));
  }

  if (window._adhCargoFilter?.size) {
    list = list.filter(c => {
      const funcao = c.funcao || window.eoColabs?.get(c.mat)?.funcao;
      return window._adhCargoFilter.has(adhCargoCategoria(funcao));
    });
  }
  if (window._adhChFilter?.size) {
    list = list.filter(c => window._adhChFilter.has(c.ch ?? window.eoColabs?.get(c.mat)?.ch ?? 0));
  }

  const q = (window._adhSearchQuery || '').trim().toLowerCase();
  if (q) {
    list = list.filter(c => {
      const mat  = String(c.mat || c.matricula || '').toLowerCase();
      const nome = String(c.nome || '').toLowerCase();
      return mat.includes(q) || nome.includes(q);
    });
  }

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

// Search box (by nome or matrícula)
function adhSearchColab(value) {
  window._adhSearchQuery = value;
  adhRerenderColabTable();
}

// Função (cargo category) quick-filter pills — multi-select
function adhToggleCargoFilter(cat, btn) {
  if (!window._adhCargoFilter) window._adhCargoFilter = new Set();
  if (window._adhCargoFilter.has(cat)) {
    window._adhCargoFilter.delete(cat);
    btn.classList.remove('active');
  } else {
    window._adhCargoFilter.add(cat);
    btn.classList.add('active');
  }
  adhRerenderColabTable();
}

// Carga horária quick-filter pills — multi-select
function adhToggleChFilter(ch, btn) {
  if (!window._adhChFilter) window._adhChFilter = new Set();
  if (window._adhChFilter.has(ch)) {
    window._adhChFilter.delete(ch);
    btn.classList.remove('active');
  } else {
    window._adhChFilter.add(ch);
    btn.classList.add('active');
  }
  adhRerenderColabTable();
}

// Situação filter buttons (Todos / Ativos / Afastados)
function adhFilterSituacao(mode, btn) {
  document.querySelectorAll('.adh-situ-filter-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  window._adhSituacaoFilter = mode;
  adhRerenderColabTable();
}

// PCD toggle — independent from the situação filters (combinable)
function adhTogglePcdFilter(btn) {
  window._adhPcdFilter = !window._adhPcdFilter;
  if (btn) btn.classList.toggle('active', window._adhPcdFilter);
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

function adhBuildPanelContent(mat, filial, nome, cargo, compact = false) {
  // Cargos isentos de bater ponto (Gerentes e Coordenadores) não têm falta
  // descontada em dias sem nenhuma marcação — se houver ponto batido naquele
  // dia, o cálculo real é respeitado.
  const isento = /GERENTE|COORDENADOR/i.test(cargo || '');

  // Get daily records — union of dates present in horarios OR marcacao, so
  // days with punches but no planned schedule (and vice-versa) both show up.
  const prefix = filial + '|' + mat + '|';
  const tm = t => { if(!t)return 0; const p=String(t).split(':'); return parseInt(p[0])*60+parseInt(p[1]||0); };
  const diff = (a,b) => { if(!a||!b)return 0; const d=tm(b)-tm(a); return d<0?d+1440:d; };

  // Percorre TODOS os dias do mês selecionado (não só os que têm registro),
  // para mostrar folgas programadas e diferenciar finais de semana.
  const mesAtual = window._adhMes || adhCurrentMonth();
  const [anoM, mesM] = mesAtual.split('-').map(Number);
  const diasNoMes = adhDaysInMonth(mesAtual);

  // Marcação frequentemente perde a primeira batida do dia (não só às 00:00 —
  // qualquer entrada de madrugada tem esse problema, ~1.2% de todas as linhas).
  // Se existe QUALQUER outra batida naquele dia (prova de que a pessoa esteve
  // presente), recupera a entrada usando o horário planejado daquele dia,
  // seja qual for, em vez de contar como falta.
  function adhResolveBat1(ent1, marc) {
    if (!marc) return { valor: null, recuperado: false };
    if (marc.bat1) return { valor: marc.bat1, recuperado: false };
    const temOutraBatida = marc.bat2||marc.bat3||marc.bat4||marc.bat5||marc.bat6||marc.bat7||marc.bat8;
    if (ent1 && temOutraBatida) return { valor: ent1, recuperado: true };
    return { valor: marc.bat1, recuperado: false };
  }

  const hoje = new Date();
  const hojeYMD = `${hoje.getFullYear()}${String(hoje.getMonth()+1).padStart(2,'0')}${String(hoje.getDate()).padStart(2,'0')}`;

  const days = [];
  let temBat5a8 = false; // se alguma marcação do mês usa mais de 4 batidas
  for (let dia = 1; dia <= diasNoMes; dia++) {
    const dstr = `${String(dia).padStart(2,'0')}/${String(mesM).padStart(2,'0')}/${anoM}`;
    const key  = prefix + dstr;
    const h    = pontoHorarios.get(key);
    const marc = pontoMarcacao.get(key);
    const diaYMD = `${anoM}${String(mesM).padStart(2,'0')}${String(dia).padStart(2,'0')}`;
    const futuro = diaYMD > hojeYMD; // dia ainda não aconteceu — não julgar como falta
    const minP = h ? diff(h.ent1,h.sai1) + (h.ent2&&h.sai2?diff(h.ent2,h.sai2):0) : 0;
    const { valor: bat1, recuperado: bat1Recuperado } = adhResolveBat1(h?.ent1, marc);
    let minT=0;
    if (marc) [[bat1,marc.bat2],[marc.bat3,marc.bat4],[marc.bat5,marc.bat6],[marc.bat7,marc.bat8]]
      .forEach(([a,b])=>{ minT+=diff(a,b); });
    const folga = !h; // sem horário programado neste dia = folga programada
    // Sem NENHUMA batida naquele dia (não é só "trabalhou menos") — não conta
    // como falta, igual a Lista/Excel já trata (dia fica de fora da razão).
    const semMarcacao = !folga && !futuro && !marc;
    const diaIsento = isento && minT === 0; // sem nenhuma marcação neste dia
    const he = (diaIsento || futuro || semMarcacao) ? 0 : Math.max(0,minT-minP);
    const falta = (diaIsento || futuro || semMarcacao) ? 0 : Math.max(0,minP-minT);
    const pct = (futuro || semMarcacao || !minP) ? null : Math.max(0,Math.round((1-(he+falta)/minP)*100));
    const trabalhouNaFolga = folga && minT > 0;
    const diaSemana = new Date(anoM, mesM-1, dia).getDay();
    const finalDeSemana = diaSemana === 0 || diaSemana === 6;
    if (marc && (marc.bat5||marc.bat6||marc.bat7||marc.bat8)) temBat5a8 = true;
    days.push({dstr,ent1:h?.ent1,sai1:h?.sai1,ent2:h?.ent2,sai2:h?.sai2,
      bat1,bat1Recuperado,bat2:marc?.bat2,bat3:marc?.bat3,bat4:marc?.bat4,
      bat5:marc?.bat5,bat6:marc?.bat6,bat7:marc?.bat7,bat8:marc?.bat8,
      minP,minT,he,falta,pct,folga,trabalhouNaFolga,finalDeSemana,futuro,semMarcacao});
  }

  const totP = days.reduce((s,d)=>s+((d.futuro||d.semMarcacao)?0:d.minP),0);
  const totHE = days.reduce((s,d)=>s+d.he,0);
  const totF  = days.reduce((s,d)=>s+d.falta,0);
  const totPct = totP>0 ? Math.max(0,Math.round((1-(totHE+totF)/totP)*100)) : null;
  const pctClr = p => p==null ? 'var(--text-muted)' : (p>=88?'#48bb78':p>=70?'#f6ad55':'#fc8181');
  const fmtH = m => m>0 ? adhHuman(m/60) : '—';

  // Hour chart — smooth area lines for planned vs real vs hora extra.
  // Calculado minuto a minuto (não só por hora "cheia") pra saber com
  // precisão quais minutos trabalhados caem FORA do planejado (hora extra),
  // já considerando também as batidas 5-8 quando existirem.
  const hourPlan  = new Array(24).fill(0);
  const hourReal  = new Array(24).fill(0);
  const hourExtra = new Array(24).fill(0);
  days.forEach(d => {
    const tm = t => { if(!t)return null; const p=String(t).split(':'); return parseInt(p[0])*60+parseInt(p[1]||0); };
    const marcar = (arr, ini, fim) => { for (let m=ini; m<fim; m++) arr[((m%1440)+1440)%1440] = true; };

    const planMin = new Array(1440).fill(false);
    const realMin = new Array(1440).fill(false);

    [[d.ent1,d.sai1],[d.ent2,d.sai2]].forEach(([e,s])=>{
      const em=tm(e), sm=tm(s); if(em==null||sm==null) return;
      marcar(planMin, em, sm>em?sm:sm+1440);
    });
    [[d.bat1,d.bat2],[d.bat3,d.bat4],[d.bat5,d.bat6],[d.bat7,d.bat8]].forEach(([a,b])=>{
      const am=tm(a), bm=tm(b); if(am==null||bm==null) return;
      marcar(realMin, am, bm>am?bm:bm+1440);
    });

    for (let m=0; m<1440; m++) {
      const h = Math.floor(m/60);
      if (planMin[m]) hourPlan[h]++;
      if (realMin[m]) {
        hourReal[h]++;
        if (!planMin[m]) hourExtra[h]++;
      }
    }
  });
  const maxH = Math.max(...hourPlan,...hourReal,...hourExtra,1);
  const W=760, H=80, PAD=28;
  const pts = (arr) => arr.map((v,i)=>`${PAD+i*(W-PAD*2)/23},${H-4-Math.round(v/maxH*(H-8))}`).join(' ');
  const planPts  = pts(hourPlan);
  const realPts  = pts(hourReal);
  const extraPts = pts(hourExtra);
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
      <linearGradient id="gradExtra" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#f59e0b" stop-opacity="0.45"/>
        <stop offset="100%" stop-color="#f59e0b" stop-opacity="0.02"/>
      </linearGradient>
    </defs>
    <path d="${svgPath(planPts,true)}" fill="url(#gradPlan)"/>
    <path d="${svgPath(realPts,true)}" fill="url(#gradReal)"/>
    ${hourExtra.some(v=>v>0) ? `<path d="${svgPath(extraPts,true)}" fill="url(#gradExtra)"/>` : ''}
    <path d="${svgPath(planPts)}" fill="none" stroke="#00a0d2" stroke-width="2" stroke-linecap="round"/>
    <path d="${svgPath(realPts)}" fill="none" stroke="#48bb78" stroke-width="2" stroke-linecap="round"/>
    ${hourExtra.some(v=>v>0) ? `<path d="${svgPath(extraPts)}" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round"/>` : ''}
    ${hLabels}
  </svg>`;

  // Table rows (skipped for the compact hover card — full detail only on click)
  const tableRows = compact ? '' : days.map(d => {
    const c2 = pctClr(d.pct);
    const rowClass = d.finalDeSemana ? ' class="adh-tip-weekend"' : '';
    const bat1Cell = d.bat1Recuperado
      ? `<span title="Marcação não registrou essa batida (falha comum do arquivo em entradas de madrugada) — recuperado a partir do horário planejado">${d.bat1}*</span>`
      : (d.bat1||'—');
    const bat58Cells = temBat5a8
      ? `<td style="color:#f59e0b">${d.bat5||'—'}</td><td style="color:#f59e0b">${d.bat6||'—'}</td><td style="color:#f59e0b">${d.bat7||'—'}</td><td style="color:#f59e0b">${d.bat8||'—'}</td>`
      : '';
    const bat58Colspan = temBat5a8 ? 8 : 4;

    if (d.futuro) {
      return `<tr${rowClass} style="opacity:.45">
        <td>${d.dstr}</td>
        <td style="color:#00a0d2">${d.ent1||'—'}</td>
        <td style="color:#00a0d2">${d.sai1||'—'}</td>
        <td style="color:#00a0d2">${d.ent2||'—'}</td>
        <td style="color:#00a0d2">${d.sai2||'—'}</td>
        <td colspan="${bat58Colspan}" style="color:var(--text-muted);font-style:italic">Ainda não ocorreu</td>
        <td style="text-align:right;color:var(--text-muted)">—</td>
        <td style="text-align:right;color:var(--text-muted)">—</td>
        <td style="text-align:right;color:var(--text-muted)">—</td>
      </tr>`;
    }

    if (d.folga) {
      const aviso = d.trabalhouNaFolga
        ? `<i class="ti ti-alert-triangle" style="color:#f59e0b;font-size:12px;margin-left:6px" title="Trabalhou em um dia de folga programada" aria-hidden="true"></i>`
        : '';
      return `<tr${rowClass}>
        <td>${d.dstr}</td>
        <td colspan="4" style="color:var(--text-muted);font-style:italic">Folga programada${aviso}</td>
        <td style="color:#48bb78">${bat1Cell}</td>
        <td style="color:#48bb78">${d.bat2||'—'}</td>
        <td style="color:#48bb78">${d.bat3||'—'}</td>
        <td style="color:#48bb78">${d.bat4||'—'}</td>
        ${bat58Cells}
        <td style="text-align:right;color:#f6ad55">${fmtH(d.he)}</td>
        <td style="text-align:right;color:var(--text-muted)">—</td>
        <td style="text-align:right;color:var(--text-muted)">—</td>
      </tr>`;
    }

    if (d.semMarcacao) {
      return `<tr${rowClass}>
        <td>${d.dstr}</td>
        <td style="color:#00a0d2">${d.ent1||'—'}</td>
        <td style="color:#00a0d2">${d.sai1||'—'}</td>
        <td style="color:#00a0d2">${d.ent2||'—'}</td>
        <td style="color:#00a0d2">${d.sai2||'—'}</td>
        <td colspan="${bat58Colspan}" style="color:var(--text-muted);font-style:italic" title="Nenhuma batida registrada neste dia — não entra na conta de aderência, igual o dia não tivesse sido avaliado">Sem marcação</td>
        <td style="text-align:right;color:var(--text-muted)">—</td>
        <td style="text-align:right;color:var(--text-muted)">—</td>
        <td style="text-align:right;color:var(--text-muted)">—</td>
      </tr>`;
    }

    return `<tr${rowClass}>
      <td>${d.dstr}</td>
      <td style="color:#00a0d2">${d.ent1||'—'}</td>
      <td style="color:#00a0d2">${d.sai1||'—'}</td>
      <td style="color:#00a0d2">${d.ent2||'—'}</td>
      <td style="color:#00a0d2">${d.sai2||'—'}</td>
      <td style="color:#48bb78">${bat1Cell}</td>
      <td style="color:#48bb78">${d.bat2||'—'}</td>
      <td style="color:#48bb78">${d.bat3||'—'}</td>
      <td style="color:#48bb78">${d.bat4||'—'}</td>
      ${bat58Cells}
      <td style="text-align:right;color:#f6ad55">${fmtH(d.he)}</td>
      <td style="text-align:right;color:#fc8181">${fmtH(d.falta)}</td>
      <td style="text-align:right;font-weight:700;color:${c2}">${d.pct==null?'—':d.pct+'%'}</td>
    </tr>`;
  }).join('');


  if (compact) {
    return `
      <div class="adh-panel-topbar" style="padding:10px 12px 6px;border:none">
        <div>
          <div class="adh-panel-name" style="font-size:13px">${nome}</div>
          <div class="adh-panel-sub" style="font-size:10px">${mat} · ${cargo}</div>
        </div>
      </div>
      <div class="adh-tip-chart-wrap" style="padding:0 12px 6px">
        <div class="adh-tip-chart-svg" style="height:46px;overflow:hidden">${chartBars}</div>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;padding:0 12px 8px;font-size:11px">
        <span style="color:#8896aa">Carga <b style="color:#e8edf5">${window.eoColabs?.get(mat)?.ch ? window.eoColabs.get(mat).ch+'h' : '—'}</b></span>
        <span style="color:#8896aa">Prog <b style="color:#e8edf5">${fmtH(totP)}</b></span>
        <span style="color:#f6ad55">HE <b>${fmtH(totHE)}</b></span>
        <span style="color:#fc8181">Falta <b>${fmtH(totF)}</b></span>
        <span style="color:${pctClr(totPct)};font-weight:700">${totPct==null?'—':totPct+'%'}</span>
      </div>
      <div style="font-size:9px;color:var(--text-muted);padding:0 12px 10px">Clique para ver detalhes diários</div>`;
  }

  return `
    <div class="adh-panel-topbar">
      <div>
        <div class="adh-panel-name">${nome}</div>
        <div class="adh-panel-sub">${mat} · ${cargo}</div>
      </div>
      <div class="adh-panel-summary">
        <span style="color:#8896aa">Carga: <strong style="color:#e8edf5">${window.eoColabs?.get(mat)?.ch ? window.eoColabs.get(mat).ch+'h' : '—'}</strong></span>
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
        <span><span class="adh-leg-dot" style="background:#f59e0b"></span>Hora Extra</span>
      </div>
    </div>

    <!-- Table -->
    <div class="adh-tip-table-section">
      <table class="adh-tip-table">
        <thead>
          <tr>
            <th>Data</th>
            <th><span class="adh-leg-dot" style="background:#00a0d2"></span>Ent.1</th>
            <th><span class="adh-leg-dot" style="background:#00a0d2"></span>Saí.1</th>
            <th><span class="adh-leg-dot" style="background:#00a0d2"></span>Ent.2</th>
            <th><span class="adh-leg-dot" style="background:#00a0d2"></span>Saí.2</th>
            <th><span class="adh-leg-dot" style="background:#48bb78"></span>Bat.1</th>
            <th><span class="adh-leg-dot" style="background:#48bb78"></span>Bat.2</th>
            <th><span class="adh-leg-dot" style="background:#48bb78"></span>Bat.3</th>
            <th><span class="adh-leg-dot" style="background:#48bb78"></span>Bat.4</th>
            ${temBat5a8 ? `
            <th><span class="adh-leg-dot" style="background:#f59e0b"></span>Bat.5</th>
            <th><span class="adh-leg-dot" style="background:#f59e0b"></span>Bat.6</th>
            <th><span class="adh-leg-dot" style="background:#f59e0b"></span>Bat.7</th>
            <th><span class="adh-leg-dot" style="background:#f59e0b"></span>Bat.8</th>` : ''}
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
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
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
        tip.className = 'adh-tooltip adh-tooltip-compact';
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
        tip.className = 'adh-tooltip adh-tooltip-compact';
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

  const html = adhBuildPanelContent(mat, filial, nome, cargo, !freeze);

  if (freeze) {
    _adhPanelFrozen = true;
    adhRenderFrozenPanel(html);
    return;
  }

  // Hover tooltip — compact + semi-transparent (full detail is one click away)
  let tip = document.getElementById('adh-tooltip');
  if (!tip) {
    tip = document.createElement('div');
    tip.id = 'adh-tooltip';
    tip.className = 'adh-tooltip adh-tooltip-compact';
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
