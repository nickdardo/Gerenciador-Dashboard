// ══════════════════════════════════════════════════════
// PAGES — Each module renders into #page-content
// ══════════════════════════════════════════════════════

// ── Escala Online ─────────────────────────────────────
function pageEscala(el) {
  el.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Escala Online</h1>
        <p class="page-sub">Calendário mensal · preenchimento e folgas</p>
      </div>
    </div>
    <div class="page-placeholder">
      <div class="placeholder-icon">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
      </div>
      <p class="placeholder-title">Escala Online</p>
      <p class="placeholder-sub">Módulo em integração — disponível em breve.</p>
    </div>
  `;
}

// ── Gerador ───────────────────────────────────────────
// ── Gerador state ─────────────────────────────────────
let gFile    = null;
let gRows    = [];
let gBase    = null;
let gSheets  = [];
let gHistory = JSON.parse(localStorage.getItem('gen_history') || '[]');

function pageGerador(el) {
  el.innerHTML = `
    <div class="gen3-wrap">

      <!-- LEFT: Upload + info + history -->
      <div class="gen3-left">
        <div class="gen3-section-label">Dimensionamento</div>

        <div class="gen3-drop" id="gen-drop">
          <input type="file" id="gen-file" accept=".xlsx,.xls"
            style="position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%">
          <div class="gen3-drop-icon">
            <i class="ti ti-upload" style="font-size:18px" aria-hidden="true"></i>
          </div>
          <div class="gen3-drop-t">Arraste ou clique</div>
          <div class="gen3-drop-s">Dimensionamento_*.xlsx</div>
        </div>

        <div id="gen-file-area" style="display:none">
          <div class="gen3-file-pill" id="gen-file-name"></div>
          <div class="gen3-info-list" id="gen-info-list"></div>
        </div>

        <div class="gen3-status" id="gen-status" style="display:none"></div>

        <button class="gen3-btn-primary" id="gen-btn" onclick="genGenerate()" disabled>
          <i class="ti ti-bolt" aria-hidden="true"></i> Gerar escala
        </button>

        <div id="gen-history-section" style="display:none">
          <div class="gen3-section-label" style="margin-top:4px">Histórico</div>
          <div class="gen3-history" id="gen-history-list"></div>
        </div>
      </div>

      <!-- CENTER: Stats + filters + table -->
      <div class="gen3-center">
        <div class="gen3-empty" id="gen-empty">
          <i class="ti ti-table" style="font-size:28px;opacity:.2" aria-hidden="true"></i>
          <span>O resultado aparece aqui após gerar</span>
        </div>

        <div id="gen-result" style="display:none;height:100%;display:none;flex-direction:column">
          <div class="gen3-stats-row" id="gen-stats"></div>
          <div class="gen3-filter-bar" id="gen-filters"></div>
          <div class="gen3-table-wrap">
            <table class="gen3-table">
              <thead>
                <tr>
                  <th>Função</th>
                  <th>Horário</th>
                  <th>CH</th>
                  <th>Período</th>
                  <th class="r">Qtd</th>
                </tr>
              </thead>
              <tbody id="gen-tbody"></tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- RIGHT: Charts + actions -->
      <div class="gen3-right">
        <div class="gen3-right-empty" id="gen-right-empty">
          <i class="ti ti-chart-bar" style="font-size:24px;opacity:.15" aria-hidden="true"></i>
        </div>

        <div id="gen-right-content" style="display:none;flex-direction:column;height:100%">
          <div class="gen3-rp-section">
            <div class="gen3-rp-label">Distribuição por período</div>
            <div class="gen3-mini-chart" id="gen-chart-bars"></div>
            <div class="gen3-period-list" id="gen-period-list"></div>
          </div>

          <div class="gen3-rp-section gen3-rp-scroll">
            <div class="gen3-rp-label">Posições por função</div>
            <div class="gen3-func-list" id="gen-func-list"></div>
          </div>

          <div class="gen3-actions">
            <button class="gen3-act gen3-act-p" onclick="genGoEscala()">Escala Online</button>
            <button class="gen3-act gen3-act-g" onclick="genGoComparador()">Comparar →</button>
            <button class="gen3-act gen3-act-s" onclick="genDownload()">
              <i class="ti ti-download" aria-hidden="true"></i> Excel
            </button>
            <button class="gen3-act gen3-act-s" onclick="genReset()">
              <i class="ti ti-refresh" aria-hidden="true"></i> Novo
            </button>
          </div>
        </div>
      </div>

    </div>
  `;

  genSetupDrop();
  genRenderHistory();

  // If we already have data (navigated away and back), re-render
  if (gRows.length) genRender();
}

// ── Drop zone ─────────────────────────────────────────
function genSetupDrop() {
  const dz  = document.getElementById('gen-drop');
  const inp = document.getElementById('gen-file');
  if (!dz || !inp) return;
  dz.addEventListener('dragover',  e => { e.preventDefault(); dz.classList.add('over'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('over'));
  dz.addEventListener('drop', e => { e.preventDefault(); dz.classList.remove('over'); if (e.dataTransfer.files[0]) genLoadFile(e.dataTransfer.files[0]); });
  inp.addEventListener('change', e => { if (e.target.files[0]) genLoadFile(e.target.files[0]); });
}

function genLoadFile(file) {
  gFile = file;
  document.getElementById('gen-file-area').style.display = 'block';
  document.getElementById('gen-file-name').innerHTML =
    `<i class="ti ti-file-spreadsheet" style="font-size:11px;margin-right:4px" aria-hidden="true"></i>${file.name}`;
  document.getElementById('gen-drop').classList.add('has-file');
  document.getElementById('gen-btn').disabled = false;
  genSetStatus('');

  genReadXlsx(file, wb => {
    gBase   = genDetectBase(wb);
    gSheets = wb.SheetNames;
    genUpdateInfo();
  });
}

function genReadXlsx(file, cb) {
  const r = new FileReader();
  r.onload = e => {
    try { cb(XLSX.read(e.target.result, { type: 'array' })); }
    catch(err) { genSetStatus('Erro ao ler: ' + err.message, 'err'); }
  };
  r.readAsArrayBuffer(file);
}

function genDetectBase(wb) {
  for (const name of wb.SheetNames) {
    const ws   = wb.Sheets[name];
    const rows = XLSX.utils.sheet_to_json(ws, { header:1, defval:null, range:0 });
    for (let ri = 0; ri <= Math.min(5, rows.length-1); ri++) {
      const row = rows[ri];
      if (!row) continue;
      for (let ci = 0; ci < Math.min(row.length-1, 10); ci++) {
        if (typeof row[ci]==='string' && row[ci].trim().toLowerCase()==='base') {
          const next = row[ci+1];
          if (typeof next==='string' && /^[A-Z]{2,4}$/.test(next.trim())) return next.trim();
        }
      }
    }
  }
  return null;
}

function genUpdateInfo() {
  const list = document.getElementById('gen-info-list');
  if (!list) return;
  list.innerHTML = `
    <div class="gen3-info-row"><span>Base detectada</span><span class="gen3-base-badge">${gBase||'—'}</span></div>
    <div class="gen3-info-row"><span>Abas</span><span>${gSheets.length} setor(es)</span></div>
    <div class="gen3-info-row"><span>Arquivo</span><span style="color:#5a6a82;font-size:10px;max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${gFile?.name||''}</span></div>
  `;
  // Update topbar base badge
  const badge = document.getElementById('tb-base');
  if (badge && gBase) { badge.textContent = gBase; badge.style.display = 'inline-flex'; }
}

// ── Generate ──────────────────────────────────────────
function genGenerate() {
  if (!gFile) return;
  genSetStatus('Processando...', 'load');
  document.getElementById('gen-btn').disabled = true;

  setTimeout(() => {
    genReadXlsx(gFile, wb => {
      try {
        gBase = genDetectBase(wb) || gBase;
        gRows = genParse(wb);
        genRender();
        genSaveHistory();
        document.getElementById('gen-btn').disabled = false;
        genSetStatus('');
      } catch(e) {
        genSetStatus('Erro: ' + e.message, 'err');
        document.getElementById('gen-btn').disabled = false;
      }
    });
  }, 50);
}

function genParse(wb) {
  const rows = [];
  for (const sheetName of wb.SheetNames) {
    const ws   = wb.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(ws, { header:1, defval:null });
    for (let ri = 99; ri < data.length; ri++) {
      const row = data[ri];
      if (!row || row.length < 7) continue;
      for (let c = 5; c <= 148; c++) {
        const qty = row[c], label = row[c+1];
        if (typeof qty==='number' && qty>0 && qty<2000 &&
            typeof label==='string' && /^[A-ZÁÉÍÓÚÂÊÔÃÕÇ].+,\d+[Hh]$/.test(label.trim())) {
          const [fn, ch] = label.split(',');
          const hours    = parseInt(ch);
          const startMin = (c-5)*10;
          const endMin   = startMin + hours*60;
          const entrada  = genFmt(startMin);
          const saida    = genFmt(endMin >= 1440 ? endMin-1440 : endMin);
          for (let i = 0; i < Math.round(qty); i++) {
            rows.push({ funcao: fn.trim(), entrada, saida, horario: entrada+' – '+saida, carga: ch.trim(), sheetName });
          }
        }
      }
    }
  }
  return rows;
}

function genFmt(min) {
  return String(Math.floor(min/60)%24).padStart(2,'0')+':'+String(min%60).padStart(2,'0');
}

function genPeriodo(h) {
  if (h>=0&&h<6)  return ['Madrugada','gen3-tma'];
  if (h>=6&&h<12) return ['Manhã',    'gen3-tm'];
  if (h>=12&&h<18)return ['Tarde',    'gen3-tt'];
  return ['Noite','gen3-tn'];
}

// ── Render ────────────────────────────────────────────
let gActiveFilter = 'all';

function genRender() {
  if (!gRows.length) { genSetStatus('Nenhum dado.', 'err'); return; }

  document.getElementById('gen-empty').style.display       = 'none';
  document.getElementById('gen-result').style.display      = 'flex';
  document.getElementById('gen-right-empty').style.display = 'none';
  document.getElementById('gen-right-content').style.display = 'flex';

  // Stats
  const funcoes = [...new Set(gRows.map(r=>r.funcao))];
  const chVals  = gRows.map(r=>parseInt(r.carga));
  document.getElementById('gen-stats').innerHTML = [
    { v: gRows.length,         l: `Total${gBase?' · '+gBase:''}`, c: '#00a0d2' },
    { v: funcoes.length,       l: 'Funções',                        c: '#72c02c' },
    { v: gSheets.length,       l: 'Setores',                        c: '#fbbf24' },
    { v: Math.min(...chVals)+'H', l: 'Menor turno',                 c: '#a78bfa' },
    { v: Math.max(...chVals)+'H', l: 'Maior turno',                 c: '#f472b6' },
  ].map(s => `<div class="gen3-stat"><div class="gen3-stat-v" style="color:${s.c}">${s.v}</div><div class="gen3-stat-l">${s.l}</div></div>`).join('');

  // Filter bar
  const filterEl = document.getElementById('gen-filters');
  filterEl.innerHTML = `<span class="gen3-filter-label">Filtrar</span>
    <span class="gen3-chip${gActiveFilter==='all'?' on':''}" onclick="genFilter('all')">Todos</span>
    ${funcoes.map(f=>`<span class="gen3-chip${gActiveFilter===f?' on':''}" onclick="genFilter('${f.replace(/'/g,"\\'")}')">
      ${f}
    </span>`).join('')}`;

  genRenderTable();
  genRenderRight(funcoes);
  genRenderHistory();
}

function genFilter(f) {
  gActiveFilter = f;
  genRender();
}

function genRenderTable() {
  const filtered = gActiveFilter==='all' ? gRows : gRows.filter(r=>r.funcao===gActiveFilter);
  const unique = {};
  filtered.forEach(r => {
    const k = r.funcao+r.horario;
    if (!unique[k]) unique[k] = { ...r, qty: 0 };
    unique[k].qty++;
  });

  document.getElementById('gen-tbody').innerHTML = Object.values(unique)
    .sort((a,b)=>a.funcao.localeCompare(b.funcao)||a.entrada.localeCompare(b.entrada))
    .map(r => {
      const [per, cls] = genPeriodo(parseInt(r.entrada.split(':')[0]));
      return `<tr>
        <td class="gen3-func-cell">${r.funcao}</td>
        <td style="font-variant-numeric:tabular-nums">${r.horario}</td>
        <td style="color:#72c02c;font-weight:600">${r.carga}</td>
        <td><span class="gen3-tag ${cls}">${per}</span></td>
        <td class="r" style="color:#e8edf3;font-weight:700">${r.qty}</td>
      </tr>`;
    }).join('');
}

function genRenderRight(funcoes) {
  const PERIODS = [
    { l:'Madrugada', h:[0,6],   c:'#94a3b8', cls:'gen3-tma' },
    { l:'Manhã',     h:[6,12],  c:'#60a5fa', cls:'gen3-tm'  },
    { l:'Tarde',     h:[12,18], c:'#34d399', cls:'gen3-tt'  },
    { l:'Noite',     h:[18,24], c:'#fbbf24', cls:'gen3-tn'  },
  ];

  const pCounts = PERIODS.map(p => ({
    ...p,
    count: gRows.filter(r => { const h=parseInt(r.entrada.split(':')[0]); return h>=p.h[0]&&h<p.h[1]; }).length
  }));
  const maxP = Math.max(...pCounts.map(p=>p.count), 1);

  document.getElementById('gen-chart-bars').innerHTML = pCounts.map(p =>
    `<div class="gen3-bar" style="height:${Math.round(p.count/maxP*100)}%;background:${p.c}22;border-top:2px solid ${p.c}" title="${p.l}: ${p.count}"></div>`
  ).join('');

  document.getElementById('gen-period-list').innerHTML = pCounts.map(p =>
    `<div class="gen3-period-row">
       <span><span class="gen3-dot" style="background:${p.c}"></span>${p.l}</span>
       <span>${p.count}</span>
     </div>`
  ).join('');

  const fCounts = funcoes.map(f => ({ f, n: gRows.filter(r=>r.funcao===f).length }))
    .sort((a,b)=>b.n-a.n);

  document.getElementById('gen-func-list').innerHTML = fCounts.map(fc =>
    `<div class="gen3-func-row">
       <span>${fc.f}</span>
       <span>${fc.n}</span>
     </div>`
  ).join('');
}

// ── History ───────────────────────────────────────────
function genSaveHistory() {
  const entry = { base: gBase, file: gFile?.name, total: gRows.length, date: new Date().toLocaleDateString('pt-BR') };
  gHistory = [entry, ...gHistory.filter(h=>h.file!==entry.file)].slice(0,5);
  try { localStorage.setItem('gen_history', JSON.stringify(gHistory)); } catch(_){}
  genRenderHistory();
}

function genRenderHistory() {
  const sec  = document.getElementById('gen-history-section');
  const list = document.getElementById('gen-history-list');
  if (!sec || !list || !gHistory.length) { if(sec) sec.style.display='none'; return; }
  sec.style.display = 'block';
  list.innerHTML = gHistory.map(h => `
    <div class="gen3-hist-item">
      <div class="gen3-hist-name">${h.base||'?'} · ${h.date}</div>
      <div class="gen3-hist-sub">${h.total} posições · ${h.file||''}</div>
    </div>
  `).join('');
}

// ── Actions ───────────────────────────────────────────
function genGoEscala() {
  window._genRows = gRows;
  window._genBase = gBase;
  navigateTo('escala');
}

function genGoComparador() {
  window.cDataDim  = gRows.map(r => ({ setor:r.sheetName, funcao:r.funcao, entrada:genTimeToMin(r.entrada), saida:genTimeToMin(r.saida) })).filter(r=>r.entrada!==null);
  window.cBaseName = gBase;
  navigateTo('comparador');
}

function genTimeToMin(t) {
  const m = String(t).match(/(\d{1,2}):(\d{2})/);
  return m ? parseInt(m[1])*60+parseInt(m[2]) : null;
}

function genDownload() {
  if (!gRows.length) return;
  const today = new Date().toISOString().slice(0,10);
  const wsData = [['SETOR','FUNÇÃO','ENTRADA','SAÍDA','HORÁRIO','CARGA']];
  gRows.forEach(r => wsData.push([r.sheetName,r.funcao,r.entrada,r.saida,r.horario,r.carga]));
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws['!cols'] = [{wch:20},{wch:28},{wch:8},{wch:8},{wch:14},{wch:8}];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'ESCALA');
  XLSX.writeFile(wb, `Escala${gBase?'_'+gBase:''}_${today}.xlsx`);
}

function genReset() {
  gFile=null; gRows=[]; gBase=null; gSheets=[]; gActiveFilter='all';
  const el = document.getElementById('page-content');
  if (el) pageGerador(el);
}

function genSetStatus(msg, type) {
  const el = document.getElementById('gen-status');
  if (!el) return;
  if (!msg) { el.style.display='none'; return; }
  el.style.display='block';
  el.className='gen3-status gen3-status-'+(type||'info');
  el.textContent=msg;
}
// ── Comparador ────────────────────────────────────────
function pageComparador(el) {
  el.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Comparador de Escalas</h1>
        <p class="page-sub">Planejado vs Real · cobertura e gap de quadro</p>
      </div>
    </div>
    <div class="page-placeholder">
      <div class="placeholder-icon">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>
      </div>
      <p class="placeholder-title">Comparador</p>
      <p class="placeholder-sub">Módulo em integração — disponível em breve.</p>
    </div>
  `;
}

// ── Aderência ─────────────────────────────────────────
function pageAderencia(el) {
  el.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Aderência ao Ponto</h1>
        <p class="page-sub">Horários planejados vs marcação real</p>
      </div>
    </div>
    <div class="page-placeholder">
      <div class="placeholder-icon">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
      </div>
      <p class="placeholder-title">Aderência ao Ponto</p>
      <p class="placeholder-sub">Módulo em integração — disponível em breve.</p>
    </div>
  `;
}
