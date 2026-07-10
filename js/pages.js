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

function pageGerador(el) {
  el.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Gerador de Escala</h1>
        <p class="page-sub">Converte dimensionamento em escala estruturada</p>
      </div>
      <span class="gen-base-badge" id="gen-base-badge" style="display:none"></span>
    </div>

    <div class="gen-layout">

      <!-- LEFT: Upload + info -->
      <div class="gen-left">
        <div class="gen-card">
          <div class="gen-card-label">Dimensionamento</div>

          <div class="gen-drop" id="gen-drop">
            <input type="file" id="gen-file" accept=".xlsx,.xls" style="position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%">
            <div class="gen-drop-icon">
              <i class="ti ti-upload" style="font-size:20px" aria-hidden="true"></i>
            </div>
            <div class="gen-drop-text">
              <strong>Clique ou arraste o arquivo</strong>
              Dimensionamento_*.xlsx
            </div>
          </div>

          <div id="gen-file-info" style="display:none">
            <div class="gen-file-pill" id="gen-file-name"></div>
            <div class="gen-info-rows" id="gen-info-rows"></div>
          </div>

          <div class="gen-status" id="gen-status" style="display:none"></div>

          <button class="gen-btn-primary" id="gen-btn" onclick="genGenerate()" disabled>
            Gerar escala
          </button>
        </div>
      </div>

      <!-- RIGHT: Result -->
      <div class="gen-right" id="gen-right">
        <div class="gen-empty" id="gen-empty">
          <i class="ti ti-table" style="font-size:32px;color:var(--gen-muted)" aria-hidden="true"></i>
          <p>O resultado aparece aqui após gerar</p>
        </div>

        <div id="gen-result" style="display:none">
          <div class="gen-stats" id="gen-stats"></div>

          <div class="gen-table-wrap">
            <table class="gen-table">
              <thead>
                <tr>
                  <th>Função</th>
                  <th>Horário</th>
                  <th>CH</th>
                  <th>Período</th>
                </tr>
              </thead>
              <tbody id="gen-tbody"></tbody>
            </table>
          </div>

          <div class="gen-actions" id="gen-actions"></div>
        </div>
      </div>

    </div>
  `;

  genSetupDrop();
}

// ── Drop zone ─────────────────────────────────────────
function genSetupDrop() {
  const dz  = document.getElementById('gen-drop');
  const inp = document.getElementById('gen-file');
  if (!dz || !inp) return;

  dz.addEventListener('dragover',  e => { e.preventDefault(); dz.classList.add('over'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('over'));
  dz.addEventListener('drop', e => {
    e.preventDefault();
    dz.classList.remove('over');
    if (e.dataTransfer.files[0]) genLoadFile(e.dataTransfer.files[0]);
  });
  inp.addEventListener('change', e => {
    if (e.target.files[0]) genLoadFile(e.target.files[0]);
  });
}

function genLoadFile(file) {
  gFile = file;
  document.getElementById('gen-file-info').style.display = 'block';
  document.getElementById('gen-file-name').textContent   = file.name;
  document.getElementById('gen-drop').classList.add('has-file');
  document.getElementById('gen-btn').disabled = false;
  genSetStatus('');

  // Quick pre-read to detect base
  genReadXlsx(file, wb => {
    gBase   = genDetectBase(wb);
    gSheets = wb.SheetNames;
    genUpdateInfo();
  });
}

function genReadXlsx(file, cb) {
  const r = new FileReader();
  r.onload = e => {
    try {
      const wb = XLSX.read(e.target.result, { type: 'array' });
      cb(wb);
    } catch(err) { genSetStatus('Erro ao ler arquivo: ' + err.message, 'err'); }
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
        const cell = row[ci];
        if (typeof cell === 'string' && cell.trim().toLowerCase() === 'base') {
          const next = row[ci+1];
          if (typeof next === 'string' && /^[A-Z]{2,4}$/.test(next.trim())) return next.trim();
        }
      }
    }
  }
  return null;
}

function genUpdateInfo() {
  const badge = document.getElementById('gen-base-badge');
  if (gBase) { badge.textContent = gBase; badge.style.display = 'inline-flex'; }

  const rows = document.getElementById('gen-info-rows');
  if (!rows) return;
  rows.innerHTML = `
    <div class="gen-info-row"><span>Base detectada</span><span class="gen-badge-base">${gBase || 'Não detectada'}</span></div>
    <div class="gen-info-row"><span>Abas encontradas</span><span>${gSheets.length} setores</span></div>
    <div class="gen-info-row"><span>Arquivo</span><span style="color:var(--gen-muted);font-size:10px;max-width:120px;overflow:hidden;text-overflow:ellipsis">${gFile?.name || ''}</span></div>
  `;
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
        const qty   = row[c];
        const label = row[c+1];
        if (typeof qty === 'number' && qty > 0 && qty < 2000 &&
            typeof label === 'string' && /^[A-ZÁÉÍÓÚÂÊÔÃÕÇ].+,\d+[Hh]$/.test(label.trim())) {
          const [fn, ch] = label.split(',');
          const funcao   = fn.trim();
          const carga    = ch.trim();
          const hours    = parseInt(carga);
          const startMin = (c-5)*10;
          const endMin   = startMin + hours*60;
          const entrada  = genFmtTime(startMin);
          const saida    = genFmtTime(endMin >= 1440 ? endMin-1440 : endMin);
          for (let i = 0; i < Math.round(qty); i++) {
            rows.push({ funcao, entrada, saida, horario: entrada+' – '+saida, carga, sheetName });
          }
        }
      }
    }
  }
  return rows;
}

function genFmtTime(min) {
  const h = Math.floor(min/60)%24, m = min%60;
  return String(h).padStart(2,'0')+':'+String(m).padStart(2,'0');
}

function genPeriodo(entrada) {
  const h = parseInt(entrada.split(':')[0]);
  if (h >= 0  && h < 6)  return ['Madrugada', 'gen-tag-mad'];
  if (h >= 6  && h < 12) return ['Manhã',      'gen-tag-manha'];
  if (h >= 12 && h < 18) return ['Tarde',      'gen-tag-tarde'];
  return ['Noite', 'gen-tag-noite'];
}

// ── Render result ─────────────────────────────────────
function genRender() {
  if (!gRows.length) { genSetStatus('Nenhum dado encontrado.', 'err'); return; }

  document.getElementById('gen-empty').style.display  = 'none';
  document.getElementById('gen-result').style.display = 'block';

  // Stats
  const funcoes = [...new Set(gRows.map(r => r.funcao))];
  const sheets  = [...new Set(gRows.map(r => r.sheetName))];
  document.getElementById('gen-stats').innerHTML = `
    <div class="gen-stat"><div class="gen-stat-v">${gRows.length}</div><div class="gen-stat-l">Total${gBase?' · '+gBase:''}</div></div>
    <div class="gen-stat"><div class="gen-stat-v">${funcoes.length}</div><div class="gen-stat-l">Funções</div></div>
    <div class="gen-stat"><div class="gen-stat-v">${sheets.length}</div><div class="gen-stat-l">Setores</div></div>
  `;

  // Table — unique rows by funcao+horario
  const unique = {};
  gRows.forEach(r => {
    const k = r.funcao + r.horario;
    if (!unique[k]) unique[k] = { ...r, qty: 0 };
    unique[k].qty++;
  });

  const tbody = document.getElementById('gen-tbody');
  tbody.innerHTML = Object.values(unique).map(r => {
    const [per, cls] = genPeriodo(r.entrada);
    return `<tr>
      <td><span class="gen-func">${r.funcao}</span></td>
      <td style="font-variant-numeric:tabular-nums">${r.horario}</td>
      <td style="color:var(--gen-green);font-weight:600">${r.carga}</td>
      <td><span class="${cls}">${per}</span></td>
    </tr>`;
  }).join('');

  // Actions
  document.getElementById('gen-actions').innerHTML = `
    <button class="gen-act-btn gen-act-primary" onclick="genGoEscala()">Escala Online</button>
    <button class="gen-act-btn gen-act-secondary" onclick="genGoComparador()">Comparar →</button>
    <button class="gen-act-btn gen-act-ghost" onclick="genDownload()">
      <i class="ti ti-download" aria-hidden="true"></i> Excel
    </button>
    <button class="gen-act-btn gen-act-ghost" onclick="genReset()">
      <i class="ti ti-refresh" aria-hidden="true"></i> Novo
    </button>
  `;
}

// ── Actions ───────────────────────────────────────────
function genGoEscala() {
  window._genRows = gRows;
  window._genBase = gBase;
  navigateTo('escala');
}

function genGoComparador() {
  window.cDataDim = gRows.map(r => ({
    setor:   r.sheetName,
    funcao:  r.funcao,
    entrada: genTimeToMin(r.entrada),
    saida:   genTimeToMin(r.saida),
  })).filter(r => r.entrada !== null && r.saida !== null);
  window.cBaseName = gBase;
  navigateTo('comparador');
}

function genTimeToMin(t) {
  const m = String(t).match(/(\d{1,2}):(\d{2})/);
  return m ? parseInt(m[1])*60+parseInt(m[2]) : null;
}

function genDownload() {
  if (!gRows.length) return;
  const today    = new Date().toISOString().slice(0,10);
  const basePart = gBase ? '_'+gBase : '';
  const wsData   = [['SETOR','FUNÇÃO','ENTRADA','SAÍDA','HORÁRIO','CARGA']];
  gRows.forEach(r => wsData.push([r.sheetName, r.funcao, r.entrada, r.saida, r.horario, r.carga]));
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws['!cols'] = [{wch:20},{wch:28},{wch:8},{wch:8},{wch:14},{wch:8}];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'ESCALA');
  XLSX.writeFile(wb, `Escala${basePart}_${today}.xlsx`);
}

function genReset() {
  gFile = null; gRows = []; gBase = null; gSheets = [];
  document.getElementById('gen-file').value         = '';
  document.getElementById('gen-file-info').style.display = 'none';
  document.getElementById('gen-drop').className     = 'gen-drop';
  document.getElementById('gen-btn').disabled       = true;
  document.getElementById('gen-empty').style.display  = 'block';
  document.getElementById('gen-result').style.display = 'none';
  document.getElementById('gen-base-badge').style.display = 'none';
  genSetStatus('');
}

function genSetStatus(msg, type) {
  const el = document.getElementById('gen-status');
  if (!el) return;
  if (!msg) { el.style.display = 'none'; return; }
  el.style.display = 'block';
  el.className = 'gen-status gen-status-' + (type||'info');
  el.textContent = msg;
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
