// ══════════════════════════════════════════════════════
// ADMIN PANEL — Modelo 1
// Abas: Usuários | Arquivos | Aderência | Malha | Log
// ══════════════════════════════════════════════════════

// Lista de bases disponíveis — calculada dinamicamente a partir do cadastro
// de colaboradores (window.eoColabs), em vez de uma lista fixa que ficava
// desatualizada. Fallback pequeno só pro caso raro do cadastro ainda não
// ter carregado quando a tela abre.
const BASES_FALLBACK = ['BEL','GRU','GIG','CGH','REC','FOR','SSA','CWB','POA','BSB','MAO','NAT','AJU','FLN','MCZ','SLZ','BVB','STM','JPA','CPV'];
function adminAllBases() {
  const set = new Set();
  if (window.eoColabs?.size) {
    for (const [, r] of window.eoColabs) {
      const st = (r.station || '').trim().toUpperCase();
      if (st && !['HQ2','SEDE','GSE'].includes(st)) set.add(st);
    }
  }
  return set.size ? [...set].sort() : BASES_FALLBACK;
}

const ROLES = {
  admin:       { label: 'Admin Master', color: '#ef4444' },
  gerente:     { label: 'Gerente',      color: '#f59e0b' },
  coordenador: { label: 'Coordenador',  color: '#a78bfa' },
  supervisor:  { label: 'Supervisor',   color: '#34d399' },
  lideranca:   { label: 'Liderança',    color: '#60a5fa' },
  operador:    { label: 'Operador',     color: '#94a3b8' },
};

// In-memory store for uploaded files (session only)
const adminFileHistory = {
  colaboradores: JSON.parse(localStorage.getItem('adm_hist_colaboradores') || '[]'),
  horarios:      JSON.parse(localStorage.getItem('adm_hist_horarios')      || '[]'),
  marcacao:      JSON.parse(localStorage.getItem('adm_hist_marcacao')      || '[]'),
  malha:         JSON.parse(localStorage.getItem('adm_hist_malha')         || '[]'),
};

function adminAddHistory(key, name) {
  const entry = { name, date: new Date().toLocaleDateString('pt-BR') + ' ' + new Date().toLocaleTimeString('pt-BR', {hour:'2-digit',minute:'2-digit'}) };
  adminFileHistory[key] = [entry, ...(adminFileHistory[key]||[]).slice(0,5)];
  try { localStorage.setItem('adm_hist_'+key, JSON.stringify(adminFileHistory[key])); } catch(_){}
}

const adminFiles = {
  colaboradores: null,  // { count, bases, date, data: Map<mat, {nome,filial,funcao,ch,situacao}> }
  horarios:      null,  // { count, period, date }
  marcacao:      null,  // { count, period, date }
  malha:         null,  // { count, bases, period, date }
  ferias:        null,  // { count, date, data: Map<mat, {data_inicio,data_fim,dias}> }
  desligados:    null,  // { count, date, data: Map<mat, {data_demissao,causa_texto}> }
  pcd:           null,  // { count, date, data: Map<mat, {deficiencia,base}> }
};

// ── Entry point ───────────────────────────────────────
async function pageAdmin(el) {
  el.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Admin Master</h1>
        <p class="page-sub">Controle de usuários, dados e aderência</p>
      </div>
    </div>
    <div id="admin-body" style="padding:0 20px 32px;width:100%">
      <div class="admin-loading">Carregando...</div>
    </div>`;

  const { data: { user } } = await db.auth.getUser();
  const { data: profile }  = await db.from('profiles').select('*').eq('id', user?.id).single();

  if (!profile || profile.role !== 'admin') {
    document.getElementById('admin-body').innerHTML = `
      <div class="admin-denied">
        <i class="ti ti-shield-off" style="font-size:36px;opacity:.3" aria-hidden="true"></i>
        <p>Acesso restrito ao Admin Master.</p>
      </div>`;
    return;
  }

  adminRender();
}

// ── Main render ───────────────────────────────────────
async function adminRender() {
  const body = document.getElementById('admin-body');
  body.innerHTML = `<div class="admin-loading">Carregando dados...</div>`;

  const [
    { data: users },
    { data: escalas },
    { data: logs },
    { data: preconfig },
  ] = await Promise.all([
    db.from('profiles').select('*').order('created_at', { ascending: false }),
    db.from('escalas').select('base,status,updated_at'),
    db.from('access_log').select('*').order('created_at', { ascending: false }).limit(100),
    db.from('usuarios_preconfigurados').select('*').order('created_at', { ascending: false }),
  ]);

  const totalUsers = users?.length || 0;
  const ativos     = users?.filter(u => u.ativo).length || 0;
  const publicadas = escalas?.filter(e => e.status === 'publicado').length || 0;
  const loginsHoje = logs?.filter(l => {
    return new Date(l.created_at).toDateString() === new Date().toDateString() && l.action === 'login';
  }).length || 0;

  // Count loaded files
  const filesOk = Object.values(adminFiles).filter(f => f !== null).length;

  body.innerHTML = `
    <!-- KPIs -->
    ${adhKpiCardsHTML([
      { key:'blue', icon:'ti-users', title:'Usuários', rows: [
        { label:'Cadastrados', sub:'perfis no sistema', value: totalUsers.toLocaleString('pt-BR') },
        { label:'Ativos', sub:'com acesso liberado', value: ativos.toLocaleString('pt-BR') },
      ]},
      { key:'amber', icon:'ti-database', title:'Dados', rows: [
        { label:'Colaboradores', sub:'no cadastro', value: adminFiles.colaboradores?.count != null ? adminFiles.colaboradores.count.toLocaleString('pt-BR') : '—' },
        { label:'Arquivos carregados', sub:'dos 4 obrigatórios', value: `${filesOk}/4`, color: filesOk===4 ? '#5fa87a' : '#c9a24a' },
      ]},
      { key:'purple', icon:'ti-login', title:'Atividade', rows: [
        { label:'Logins hoje', sub:'acessos registrados', value: loginsHoje.toLocaleString('pt-BR') },
      ]},
    ])}

    <!-- Tabs -->
    <div class="adm-tabs-bar" id="adm-tabs-bar">
      <button class="adm-tab-btn active" onclick="adminTabSwitch('users',this)">
        <i class="ti ti-users" aria-hidden="true"></i> Usuários
      </button>
      <button class="adm-tab-btn" onclick="adminTabSwitch('files',this)">
        <i class="ti ti-files" aria-hidden="true"></i> Arquivos
      </button>
      <button class="adm-tab-btn" onclick="adminTabSwitch('aderencia',this)">
        <i class="ti ti-chart-bar" aria-hidden="true"></i> Aderência
      </button>
      <button class="adm-tab-btn" onclick="adminTabSwitch('malha',this)">
        <i class="ti ti-plane" aria-hidden="true"></i> Malha aérea
      </button>
      <button class="adm-tab-btn" onclick="adminTabSwitch('parametros',this)">
        <i class="ti ti-adjustments" aria-hidden="true"></i> Parâmetros de Solo
      </button>
      <button class="adm-tab-btn" onclick="adminTabSwitch('logs',this)">
        <i class="ti ti-list" aria-hidden="true"></i> Log de acessos
      </button>
    </div>

    <div id="adm-tab-content"></div>
  `;

  window._adminData = { users: users||[], escalas: escalas||[], logs: logs||[], preconfig: preconfig||[] };
  adminTabSwitch('users', document.querySelector('.adm-tab-btn'));
}

// ── Tab switcher ──────────────────────────────────────
function adminTabSwitch(tab, btn) {
  document.querySelectorAll('.adm-tab-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  const { users, escalas, logs, preconfig } = window._adminData || {};
  const el = document.getElementById('adm-tab-content');
  if (!el) return;
  switch(tab) {
    case 'users':    el.innerHTML = adminUsersTab(users||[], preconfig||[]); break;
    case 'files':    el.innerHTML = adminFilesTab();            break;
    case 'aderencia':adminAderenciaTab(el);                    break;
    case 'malha':    adminMalhaTab(el);                        break;
    case 'parametros':adminParametrosTab(el);                  break;
    case 'logs':     el.innerHTML = adminLogsTab(logs||[]);     break;
  }
}

// ── KPI helper ────────────────────────────────────────
function adminKpi(label, value, color, icon) {
  return `
    <div class="adm-kpi">
      <i class="ti ${icon}" style="font-size:18px;color:${color};opacity:.8;margin-bottom:6px" aria-hidden="true"></i>
      <div class="adm-kpi-v" style="color:${color}">${value}</div>
      <div class="adm-kpi-l">${label}</div>
    </div>`;
}

// ══════════════════════════════════════════════════════
// TAB: USUÁRIOS
// ══════════════════════════════════════════════════════
function adminUsersTab(users, preconfig = []) {
  const pendentes = preconfig.filter(p => !p.usado);

  return `
    <div class="adm-section-header">
      <span>${users.length} usuários cadastrados</span>
      <button class="adm-btn-primary" onclick="adminNewPreconfig()">+ Pré-configurar acesso</button>
    </div>
    <div class="adm-table-wrap">
      <table class="adm-table">
        <thead>
          <tr><th>Nome</th><th>Email</th><th>Perfil</th><th>Bases</th><th>Status</th><th>Cadastro</th><th></th></tr>
        </thead>
        <tbody>
          ${users.map(u => `
            <tr>
              <td style="font-weight:500">${u.nome||'—'}</td>
              <td style="color:var(--text-muted)">${u.email}</td>
              <td><span class="adm-role-badge" style="background:${ROLES[u.role]?.color||'#666'}22;color:${ROLES[u.role]?.color||'#666'}">${ROLES[u.role]?.label||u.role}</span></td>
              <td>
                ${u.bases?.includes('*')
                  ? '<span style="color:#ef4444;font-size:11px;font-weight:600">Todas</span>'
                  : (u.bases?.length
                    ? u.bases.map(b=>`<span class="adm-base-tag">${b}</span>`).join('')
                    : '<span style="color:var(--text-muted);font-size:11px">Nenhuma</span>')}
              </td>
              <td>
                <span class="adm-status-dot ${u.ativo?'on':'off'}"></span>
                <span style="font-size:11px">${u.ativo?'Ativo':'Inativo'}</span>
              </td>
              <td style="color:var(--text-muted);font-size:11px">${new Date(u.created_at).toLocaleDateString('pt-BR')}</td>
              <td style="white-space:nowrap">
                <button class="adm-btn-edit" onclick="adminEditUser('${u.id}')">Editar</button>
                ${u.id === currentUser?.id ? '' : `<button class="adm-btn-edit" style="color:#fc8181" onclick="adminDeleteUser('${u.id}','${(u.nome||u.email).replace(/'/g,"\\'")}')">Excluir</button>`}
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>

    <div class="adm-section-header" style="margin-top:24px">
      <span>${pendentes.length} pré-configurados aguardando cadastro</span>
    </div>
    ${pendentes.length ? `
    <div class="adm-table-wrap">
      <table class="adm-table">
        <thead><tr><th>Email</th><th>Nome</th><th>Perfil</th><th>Bases</th><th>Criado em</th><th></th></tr></thead>
        <tbody>
          ${pendentes.map(p => `
            <tr>
              <td style="color:var(--text-muted)">${p.email}</td>
              <td style="font-weight:500">${p.nome||'—'}</td>
              <td><span class="adm-role-badge" style="background:${ROLES[p.role]?.color||'#666'}22;color:${ROLES[p.role]?.color||'#666'}">${ROLES[p.role]?.label||p.role}</span></td>
              <td>
                ${p.bases?.includes('*')
                  ? '<span style="color:#ef4444;font-size:11px;font-weight:600">Todas</span>'
                  : (p.bases?.length
                    ? p.bases.map(b=>`<span class="adm-base-tag">${b}</span>`).join('')
                    : '<span style="color:var(--text-muted);font-size:11px">Nenhuma</span>')}
              </td>
              <td style="color:var(--text-muted);font-size:11px">${new Date(p.created_at).toLocaleDateString('pt-BR')}</td>
              <td>
                <button class="adm-btn-edit" onclick="adminEditPreconfig(${p.id})">Editar</button>
                <button class="adm-btn-edit" style="color:#fc8181" onclick="adminDeletePreconfig(${p.id})">Remover</button>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>` : `
    <div style="padding:24px;text-align:center;color:var(--text-muted);font-size:12px;border:1px dashed var(--border);border-radius:10px">
      Nenhum e-mail pré-configurado. Clique em "+ Pré-configurar acesso" pra deixar o perfil e as bases já prontos antes da pessoa criar a conta.
    </div>`}`;
}

// ══════════════════════════════════════════════════════
// UPLOAD EM LOTE — reconhece cada arquivo pelo nome e chama o loader
// que já existe pra cada tipo, sem duplicar nenhuma lógica de parsing.
// Cada loader espera um "input" com .files[0] — passamos um objeto simples
// no lugar de um <input> de verdade, então nada dos parsers precisa mudar.
// ══════════════════════════════════════════════════════
const ADM_BATCH_PATTERNS = [
  { fn: 'adminLoadColabs',    label: 'Colaboradores',     test: n => n.includes('hrcl204') || n.includes('colaborador') },
  { fn: 'adminLoadHorarios',  label: 'Ponto planejado',   test: n => n.includes('horario') },
  { fn: 'adminLoadMarcacao',  label: 'Marcação de ponto', test: n => n.includes('marcac') },
  { fn: 'adminLoadMalha',     label: 'Malha aérea',       test: n => n.includes('rvpe') || n.includes('malha') },
  { fn: 'adminLoadFerias',    label: 'Férias',            test: n => n.includes('hrcl107') || n.includes('feria') },
  { fn: 'adminLoadDesligados',label: 'Desligamentos',     test: n => n.includes('hrcl106') || n.includes('desliga') },
  { fn: 'adminLoadPcd',       label: 'PCD',                test: n => n.includes('hrcl114') || n.includes('pcd') },
];

function adminLoadEach(input, fnName) {
  const files = [...(input.files || [])];
  const fn = window[fnName];
  if (typeof fn !== 'function') { console.warn('[adminLoadEach] função não encontrada:', fnName); return; }
  files.forEach(file => fn({ files: [file], value: '' }));
  input.value = '';
}

function adminBatchUpload(input) {
  const files = [...(input.files || [])];
  if (!files.length) return;

  const statusEl = document.getElementById('adm-batch-status');
  const matched = [];
  const unmatched = [];
  for (const file of files) {
    const nameLower = file.name.toLowerCase();
    const pat = ADM_BATCH_PATTERNS.find(p => p.test(nameLower));
    if (pat) matched.push({ file, pat }); else unmatched.push(file);
  }

  if (statusEl) {
    let html = '';
    if (matched.length) {
      html += `<div style="color:#72c02c">✓ Reconhecidos: ${matched.map(m => `${m.pat.label} (${m.file.name})`).join(', ')} — acompanhe o progresso de cada um nos cards abaixo.</div>`;
    }
    if (unmatched.length) {
      html += `<div style="color:#f6ad55;margin-top:4px">Não reconhecidos pelo nome — suba manualmente no card certo: ${unmatched.map(f => f.name).join(', ')}</div>`;
    }
    if (!matched.length && !unmatched.length) html = 'Nenhum arquivo selecionado.';
    statusEl.innerHTML = html;
  }

  // Cada loader já atualiza sozinho o status do próprio card (adminSetFileStatus) —
  // não precisamos esperar um terminar pra chamar o próximo.
  for (const { file, pat } of matched) {
    const fn = window[pat.fn];
    if (typeof fn !== 'function') { console.warn('[batchUpload] função não encontrada:', pat.fn); continue; }
    try { fn({ files: [file], value: '' }); }
    catch(e) { console.error(`[batchUpload] ${pat.label}:`, e); }
  }

  input.value = '';
}

// ══════════════════════════════════════════════════════
// TAB: ARQUIVOS
// ══════════════════════════════════════════════════════
function adminFilesTab() {
  const files = [
    {
      key: 'colaboradores',
      icon: 'ti-users',
      color: '#00a0d2',
      name: 'Colaboradores',
      desc: 'HRCL204.xlsx · base de colaboradores',
      accept: '.xlsx,.xls',
      fn: 'adminLoadColabs',
      info: adminFiles.colaboradores
        ? `${adminFiles.colaboradores.count.toLocaleString()} pessoas · ${adminFiles.colaboradores.bases} bases`
        : null,
    },
    {
      key: 'horarios',
      icon: 'ti-calendar',
      color: '#72c02c',
      name: 'Ponto planejado',
      desc: 'Horarios.xlsx · escala programada',
      accept: '.xlsx,.xls',
      fn: 'adminLoadHorarios',
      info: adminFiles.horarios
        ? `${adminFiles.horarios.count.toLocaleString()} registros · ${adminFiles.horarios.period}`
        : null,
    },
    {
      key: 'marcacao',
      icon: 'ti-clock',
      color: '#f59e0b',
      name: 'Marcação de ponto',
      desc: 'Marcacao.xlsx · ponto realizado',
      accept: '.xlsx,.xls',
      fn: 'adminLoadMarcacao',
      info: adminFiles.marcacao
        ? `${adminFiles.marcacao.count.toLocaleString()} registros · ${adminFiles.marcacao.period}`
        : null,
    },
    {
      key: 'malha',
      icon: 'ti-plane',
      color: '#a78bfa',
      name: 'Malha aérea',
      desc: 'RVPE127_*.CSV · voos por base · pode subir vários meses de uma vez',
      accept: '.csv,.CSV',
      fn: 'adminLoadMalha',
      multi: true,
      info: adminFiles.malha
        ? `${adminFiles.malha.count.toLocaleString()} voos · ${adminFiles.malha.bases} bases · ${adminFiles.malha.period}`
        : null,
    },
  ];

  // Arquivos complementares de colaboradores — renderizados como sub-linhas
  // dentro do próprio card "Colaboradores", em vez de cards separados.
  const colabExtras = [
    {
      key: 'ferias',
      icon: 'ti-beach',
      color: '#38bdf8',
      name: 'Férias',
      desc: 'HRCL107.xls',
      accept: '.xls,.xlsx',
      fn: 'adminLoadFerias',
      info: adminFiles.ferias ? `${adminFiles.ferias.count.toLocaleString()} registros` : null,
    },
    {
      key: 'desligados',
      icon: 'ti-user-x',
      color: '#ef4444',
      name: 'Desligamentos',
      desc: 'HRCL106.xls',
      accept: '.xls,.xlsx',
      fn: 'adminLoadDesligados',
      info: adminFiles.desligados ? `${adminFiles.desligados.count.toLocaleString()} registros` : null,
    },
    {
      key: 'pcd',
      icon: 'ti-wheelchair',
      color: '#a78bfa',
      name: 'PCD',
      desc: 'HRCL114.xls',
      accept: '.xls,.xlsx',
      fn: 'adminLoadPcd',
      info: adminFiles.pcd ? `${adminFiles.pcd.count.toLocaleString()} colaboradores` : null,
    },
  ];

  return `
    <div class="adm-section-header">
      <span>Hub de dados operacionais</span>
      <span style="font-size:11px;color:var(--text-muted)">Dados salvos no banco de dados</span>
    </div>

    <div class="adm-batch-upload">
      <div class="adm-batch-upload-drop"
        ondragover="event.preventDefault(); this.classList.add('dragover')"
        ondragleave="this.classList.remove('dragover')"
        ondrop="event.preventDefault(); this.classList.remove('dragover'); adminBatchUpload({files:event.dataTransfer.files})"
        onclick="document.getElementById('adm-batch-input').click()">
        <i class="ti ti-upload" aria-hidden="true"></i>
        <div>
          <div class="adm-batch-upload-title">Upload em lote</div>
          <div class="adm-batch-upload-sub">Arraste vários arquivos aqui de uma vez (ou clique pra escolher) — o painel reconhece cada um pelo nome (HRCL106, HRCL107, HRCL114, HRCL204, Horarios, Marcacao, RVPE127...) e joga pro lugar certo sozinho.</div>
        </div>
      </div>
      <input type="file" id="adm-batch-input" multiple accept=".xlsx,.xls,.csv" style="display:none" onchange="adminBatchUpload(this)">
      <div id="adm-batch-status" class="adm-batch-status"></div>
    </div>

    <div class="adm-files-grid">
      ${files.map(f => {
        const hist = adminFileHistory[f.key] || [];
        return `
          <div class="adm-file-card" ${f.key==='colaboradores' ? 'style="grid-column:1 / -1"' : ''}>
            <div class="adm-file-header">
              <div class="adm-file-icon" style="background:${f.color}18;color:${f.color}">
                <i class="ti ${f.icon}" style="font-size:18px" aria-hidden="true"></i>
              </div>
              <div class="adm-file-meta">
                <div class="adm-file-name">${f.name}</div>
                <div class="adm-file-desc">${f.desc}</div>
              </div>
            </div>

            <div class="adm-file-progress">
              <div class="adm-file-progress-fill" style="width:${f.info?'100%':'0%'};background:${f.color}"></div>
            </div>

            <div class="adm-file-footer">
              <span id="adm-status-${f.key}" class="${f.info?'adm-file-badge-ok':'adm-file-badge-no'}">
                ${f.info || 'Não carregado'}
              </span>
              <label class="adm-upload-btn">
                <i class="ti ti-upload" style="font-size:11px" aria-hidden="true"></i>
                ${f.info ? 'Atualizar' : 'Carregar'}
                <input type="file" accept="${f.accept}" ${f.multi ? 'multiple' : ''} style="display:none"
                  onchange="${f.multi ? `adminLoadEach(this,'${f.fn}')` : `${f.fn}(this)`}">
              </label>
            </div>

            ${f.key === 'colaboradores' ? `
              <div class="adm-file-subsection">
                ${colabExtras.map(x => `
                  <div class="adm-file-subrow">
                    <div class="adm-file-subicon" style="background:${x.color}18;color:${x.color}">
                      <i class="ti ${x.icon}" style="font-size:13px" aria-hidden="true"></i>
                    </div>
                    <div class="adm-file-submeta">
                      <div class="adm-file-subname">${x.name}</div>
                      <div class="adm-file-subdesc">${x.desc}</div>
                    </div>
                    <span id="adm-status-${x.key}" class="${x.info?'adm-file-badge-ok':'adm-file-badge-no'}">
                      ${x.info || 'Não carregado'}
                    </span>
                    <label class="adm-upload-btn adm-upload-btn-sm">
                      <i class="ti ti-upload" style="font-size:10px" aria-hidden="true"></i>
                      ${x.info ? 'Atualizar' : 'Carregar'}
                      <input type="file" accept="${x.accept}" style="display:none"
                        onchange="${x.fn}(this)">
                    </label>
                  </div>`).join('')}
              </div>` : ''}

            ${hist.length ? `
              <div class="adm-file-history">
                <div class="adm-file-history-title">Histórico de uploads</div>
                ${hist.slice(0,6).map(h => `
                  <div class="adm-hist-row">
                    <span>${h.name}</span>
                    <span>${h.date}</span>
                  </div>`).join('')}
              </div>` : ''}
          </div>`;
      }).join('')}
    </div>`;
}

// ── File loaders ──────────────────────────────────────
async function adminLoadColabs(input) {
  const file = input.files[0];
  if (!file) return;
  adminSetFileStatus('colaboradores', 'Lendo arquivo...', 'load');

  const r = new FileReader();
  r.onload = async e => {
    try {
      const wb   = XLSX.read(e.target.result, { type:'array' });
      const ws   = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header:1, defval:null, raw:true });

      const records = [];
      const basesSet = new Set();

      rows.forEach((row, i) => {
        if (i===0 || !row || !row[0]) return;
        const matRaw = String(row[0]).trim();
        if (!matRaw || isNaN(parseInt(matRaw))) return;
        // Zero-pad to 6 digits — must match the key format used when parsing
        // Horarios/Marcacao (String(matricula).padStart(6,'0')), or the join
        // between the roster and the aderência KPI silently fails.
        const mat      = matRaw.padStart(6, '0');
        const nome    = String(row[1]||'').trim();
        const station = String(row[2]||'').trim().toUpperCase();
        const admissao= adminXlsToISODate(row[3]);
        const hmês    = String(row[4]||'').trim();
        const situacao= String(row[10]||'').trim();
        const funcao  = String(row[12]||'').trim();
        const ch      = parseInt(hmês) || 0;
        if (station) basesSet.add(station);
        records.push({ matricula: mat, nome, station, funcao, ch, situacao, admissao, ativo: true, updated_at: new Date() });
      });

      const total = records.length;
      adminSetFileStatus('colaboradores', `Gravando ${total.toLocaleString()} no banco...`, 'load');

      // Upsert in batches of 500
      const BATCH = 500;
      let saved = 0;
      for (let i = 0; i < records.length; i += BATCH) {
        const batch = records.slice(i, i + BATCH);
        const { error } = await db.from('colaboradores')
          .upsert(batch, { onConflict: 'matricula' });
        if (error) throw new Error(error.message);
        saved += batch.length;
        adminSetFileStatus('colaboradores', `Gravando... ${saved}/${total}`, 'load');
      }

      adminFiles.colaboradores = {
        count: total,
        bases: basesSet.size,
        date: new Date().toLocaleDateString('pt-BR'),
        data: new Map(records.map(r => [r.matricula, r]))
      };

      adminSetFileStatus('colaboradores', `✓ ${total.toLocaleString()} pessoas · ${basesSet.size} bases`, 'ok');
      input.value = '';

    } catch(err) {
      adminSetFileStatus('colaboradores', 'Erro: ' + err.message, 'err');
      console.error('[adminLoadColabs]', err);
    }
  };
  r.readAsArrayBuffer(file);
}

// Converte data do Excel (Date object, serial numérico ou string "DD/MM/YYYY")
// para ISO "YYYY-MM-DD", de forma defensiva já que cada relatório HR exporta
// datas de um jeito diferente.
function adminXlsToISODate(v) {
  if (v === null || v === undefined || v === '') return null;
  if (v instanceof Date && !isNaN(v)) return v.toISOString().slice(0, 10);
  if (typeof v === 'number') {
    const d = new Date(Date.UTC(1899, 11, 30) + v * 86400000);
    if (!isNaN(d)) return d.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
  return null;
}

// ── Férias (HRCL107) ──────────────────────────────────
// Colunas: 0 Cadastro, 1 Nome, 2 Cargo, 3 C.Horária, 4 Filial, 5 Admissão,
// 6 Afastam.(início), 7 código, 8 "-", 9 Situação(texto), 10 Dias, 11 Término(fim)
async function adminLoadFerias(input) {
  const file = input.files[0];
  if (!file) return;
  adminSetFileStatus('ferias', 'Lendo arquivo...', 'load');

  const r = new FileReader();
  r.onload = async e => {
    try {
      const wb   = XLSX.read(e.target.result, { type:'array' });
      const ws   = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header:1, defval:null, raw:true });

      const records = [];
      rows.forEach((row, i) => {
        if (i===0 || !row || !row[0]) return;
        const matRaw = String(row[0]).trim();
        if (!matRaw || isNaN(parseInt(matRaw))) return;
        const mat = matRaw.padStart(6, '0');
        const nome        = String(row[1]||'').trim();
        const cargo       = String(row[2]||'').trim();
        const filial      = String(row[4]||'').trim().toUpperCase();
        const data_inicio = adminXlsToISODate(row[6]);
        const dias        = parseInt(row[10]) || 0;
        const data_fim     = adminXlsToISODate(row[11]);
        if (!data_inicio) return;
        records.push({ matricula: mat, nome, cargo, filial, data_inicio, data_fim, dias, updated_at: new Date() });
      });

      const total = records.length;
      adminSetFileStatus('ferias', `Gravando ${total.toLocaleString()} no banco...`, 'load');

      const BATCH = 500;
      let saved = 0;
      for (let i = 0; i < records.length; i += BATCH) {
        const batch = records.slice(i, i + BATCH);
        const { error } = await db.from('colaboradores_ferias')
          .upsert(batch, { onConflict: 'matricula,data_inicio' });
        if (error) throw new Error(error.message);
        saved += batch.length;
        adminSetFileStatus('ferias', `Gravando... ${saved}/${total}`, 'load');
      }

      adminFiles.ferias = {
        count: total,
        date: new Date().toLocaleDateString('pt-BR'),
        data: new Map(records.map(r => [r.matricula, r])),
      };
      adminSetFileStatus('ferias', `✓ ${total.toLocaleString()} registros de férias`, 'ok');
      adminAddHistory('ferias', file.name);
      input.value = '';
    } catch(err) {
      adminSetFileStatus('ferias', 'Erro: ' + err.message, 'err');
      console.error('[adminLoadFerias]', err);
    }
  };
  r.readAsArrayBuffer(file);
}

// ── Desligamentos (HRCL106) ───────────────────────────
// Relatório concatenado com marcadores de seção ("FILIAL:", cabeçalhos
// repetidos) — filtramos mantendo só linhas cujo Cadastro é numérico.
// Colunas: 0 Cadastro, 1 Nome, 2 C.H., 3 Filial, 4 Admissão, 5 Demissão,
// 6 Cargo, 7 código causa, 8 Causa Demissão(texto)
async function adminLoadDesligados(input) {
  const file = input.files[0];
  if (!file) return;
  adminSetFileStatus('desligados', 'Lendo arquivo...', 'load');

  const r = new FileReader();
  r.onload = async e => {
    try {
      const wb   = XLSX.read(e.target.result, { type:'array' });
      const ws   = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header:1, defval:null, raw:true });

      const records = [];
      rows.forEach((row) => {
        if (!row || !row[0]) return;
        const matRaw = String(row[0]).trim();
        if (!matRaw || isNaN(parseInt(matRaw))) return; // pula marcadores/cabeçalhos
        const mat = matRaw.padStart(6, '0');
        const nome          = String(row[1]||'').trim();
        const ch            = parseInt(row[2]) || null;
        const filial        = String(row[3]||'').trim().toUpperCase();
        const data_admissao = adminXlsToISODate(row[4]);
        const data_demissao = adminXlsToISODate(row[5]);
        const cargo         = String(row[6]||'').trim();
        const causa_codigo  = String(row[7]||'').trim();
        const causa_texto   = String(row[8]||'').trim();
        if (!data_demissao) return;
        records.push({ matricula: mat, nome, ch, filial, cargo, data_admissao, data_demissao, causa_codigo, causa_texto, updated_at: new Date() });
      });

      const total = records.length;
      adminSetFileStatus('desligados', `Gravando ${total.toLocaleString()} no banco...`, 'load');

      const BATCH = 500;
      let saved = 0;
      for (let i = 0; i < records.length; i += BATCH) {
        const batch = records.slice(i, i + BATCH);
        const { error } = await db.from('colaboradores_desligados')
          .upsert(batch, { onConflict: 'matricula,data_demissao' });
        if (error) throw new Error(error.message);
        saved += batch.length;
        adminSetFileStatus('desligados', `Gravando... ${saved}/${total}`, 'load');
      }

      // Mantém só o desligamento mais recente por matrícula em memória
      const byMat = new Map();
      for (const rec of records) {
        const prev = byMat.get(rec.matricula);
        if (!prev || rec.data_demissao > prev.data_demissao) byMat.set(rec.matricula, rec);
      }

      adminFiles.desligados = {
        count: total,
        date: new Date().toLocaleDateString('pt-BR'),
        data: byMat,
      };
      adminSetFileStatus('desligados', `✓ ${total.toLocaleString()} registros históricos`, 'ok');
      adminAddHistory('desligados', file.name);
      input.value = '';
    } catch(err) {
      adminSetFileStatus('desligados', 'Erro: ' + err.message, 'err');
      console.error('[adminLoadDesligados]', err);
    }
  };
  r.readAsArrayBuffer(file);
}

// ── PCD (HRCL114) ──────────────────────────────────────
// Colunas: 0 Cadastro, 1 Nome, 2 Admissão, 3 Cargo, 4 Deficiência, 5 Base ("REC - RECIFE")
async function adminLoadPcd(input) {
  const file = input.files[0];
  if (!file) return;
  adminSetFileStatus('pcd', 'Lendo arquivo...', 'load');

  const r = new FileReader();
  r.onload = async e => {
    try {
      const wb   = XLSX.read(e.target.result, { type:'array' });
      const ws   = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header:1, defval:null, raw:true });

      const records = [];
      rows.forEach((row) => {
        if (!row || !row[0]) return;
        const matRaw = String(row[0]).trim();
        if (!matRaw || isNaN(parseInt(matRaw))) return;
        const mat = matRaw.padStart(6, '0');
        const nome        = String(row[1]||'').trim();
        const cargo       = String(row[3]||'').trim();
        const deficiencia = String(row[4]||'').trim();
        const baseRaw     = String(row[5]||'').trim();
        const base        = baseRaw.split(' - ')[0].trim().toUpperCase();
        records.push({ matricula: mat, nome, cargo, deficiencia, base, updated_at: new Date() });
      });

      const total = records.length;
      adminSetFileStatus('pcd', `Gravando ${total.toLocaleString()} no banco...`, 'load');

      const BATCH = 500;
      let saved = 0;
      for (let i = 0; i < records.length; i += BATCH) {
        const batch = records.slice(i, i + BATCH);
        const { error } = await db.from('colaboradores_pcd')
          .upsert(batch, { onConflict: 'matricula' });
        if (error) throw new Error(error.message);
        saved += batch.length;
        adminSetFileStatus('pcd', `Gravando... ${saved}/${total}`, 'load');
      }

      adminFiles.pcd = {
        count: total,
        date: new Date().toLocaleDateString('pt-BR'),
        data: new Map(records.map(r => [r.matricula, r])),
      };
      adminSetFileStatus('pcd', `✓ ${total.toLocaleString()} colaboradores PCD`, 'ok');
      adminAddHistory('pcd', file.name);
      input.value = '';
    } catch(err) {
      adminSetFileStatus('pcd', 'Erro: ' + err.message, 'err');
      console.error('[adminLoadPcd]', err);
    }
  };
  r.readAsArrayBuffer(file);
}

async function adminLoadHorarios(input) {
  const file = input.files[0];
  if (!file) return;
  adminSetFileStatus('horarios', 'Lendo arquivo...', 'load');
  const reader = new FileReader();
  reader.onload = async e => {
    try {
      const wb   = XLSX.read(e.target.result, { type:'array' });
      const ws   = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header:1, defval:null, raw:true });
      const records = []; const datas = new Set();
      const EXCL = new Set(['HQ2','SEDE','GSE']);
      function fmtD(v) {
        if (!v) return null;
        // Date object (XLSX raw:true returns Date for date cells)
        if (v instanceof Date) {
          const y=v.getFullYear(), m=String(v.getMonth()+1).padStart(2,'0'), d=String(v.getDate()).padStart(2,'0');
          return `${y}-${m}-${d}`;
        }
        // Excel serial number
        if (typeof v === 'number') {
          const ms = Math.round((v - 25569) * 86400 * 1000);
          const dt = new Date(ms);
          const y=dt.getUTCFullYear(), m=String(dt.getUTCMonth()+1).padStart(2,'0'), d=String(dt.getUTCDate()).padStart(2,'0');
          return `${y}-${m}-${d}`;
        }
        // String: could be "2026-06-01" or "06/01/2026" (MM/DD) or "01/06/2026" (DD/MM)
        const s = String(v).trim();
        if (s.match(/^\d{4}-\d{2}-\d{2}/)) return s.slice(0,10);
        if (s.includes('/')) {
          const parts = s.split('/');
          // If first part > 12, it's DD/MM/YYYY; if second part > 12, it's MM/DD/YYYY
          const [a,b,yr] = parts;
          const year = yr && yr.length===2 ? (parseInt(yr)<50?'20':'19')+yr : (yr||'2026');
          if (parseInt(b) > 12) { // a=MM, b=DD
            return year+'-'+a.padStart(2,'0')+'-'+b.padStart(2,'0');
          } else { // a=DD, b=MM (BR format)
            return year+'-'+b.padStart(2,'0')+'-'+a.padStart(2,'0');
          }
        }
        // Purely-numeric string (serial date stored as text, e.g. "46174")
        if (/^\d{4,6}$/.test(s)) {
          const ms = Math.round((parseInt(s) - 25569) * 86400 * 1000);
          const dt = new Date(ms);
          if (!isNaN(dt)) {
            const y=dt.getUTCFullYear(), m=String(dt.getUTCMonth()+1).padStart(2,'0'), d=String(dt.getUTCDate()).padStart(2,'0');
            return `${y}-${m}-${d}`;
          }
        }
        return null;
      }
      function fmtT(v) {
        if (!v && v!==0) return null;
        if (typeof v === 'number') {
          const totalMin = Math.round(v * 1440);
          return String(Math.floor(totalMin/60)%24).padStart(2,'0')+':'+String(totalMin%60).padStart(2,'0');
        }
        if (v instanceof Date) return String(v.getHours()).padStart(2,'0')+':'+String(v.getMinutes()).padStart(2,'0');
        const s = String(v).trim();
        if (s.includes(':')) return s.slice(0,5);
        const f = parseFloat(s);
        if (!isNaN(f)) { const m=Math.round(f*1440); return String(Math.floor(m/60)%24).padStart(2,'0')+':'+String(m%60).padStart(2,'0'); }
        return null;
      }
      function mp(e1,s1,e2,s2) {
        let m=0;
        [[e1,s1],[e2,s2]].forEach(([a,b])=>{
          if(a&&b){const am=typeof adhTimeToMin==='function'?adhTimeToMin(a):0,bm=typeof adhTimeToMin==='function'?adhTimeToMin(b):0;if(am&&bm){const d=bm-am;m+=d<0?d+1440:d;}}
        });
        return m;
      }
      rows.forEach((row,i) => {
        if (i===0||!row||!row[1]) return;
        const filial=String(row[0]||'').trim().toUpperCase();
        if (EXCL.has(filial)) return;
        const mat=String(row[1]).trim().padStart(6,'0');
        const nome=String(row[2]||'').trim();
        const data=fmtD(row[5]||row[3]);
        if (!data) return;
        datas.add(data.slice(0,7));
        const e1=fmtT(row[6]),s1=fmtT(row[7]),e2=fmtT(row[8]),s2=fmtT(row[9]);
        records.push({filial,matricula:mat,nome,data,ent1:e1,sai1:s1,ent2:e2,sai2:s2,min_prog:mp(e1,s1,e2,s2),updated_at:new Date()});
      });
      const period=[...datas].sort().join(', ');
      const total=records.length;
      adminSetFileStatus('horarios',`Gravando ${total.toLocaleString()}...`,'load');
      const BATCH=500; let saved=0;
      for (let i=0;i<records.length;i+=BATCH) {
        const {error}=await db.from('horarios').upsert(records.slice(i,i+BATCH),{onConflict:'filial,matricula,data'});
        if (error) throw new Error(error.message);
        saved+=Math.min(BATCH,records.length-i);
        adminSetFileStatus('horarios',`Gravando... ${saved.toLocaleString()}/${total.toLocaleString()}`,'load');
      }
      adminFiles.horarios={count:total,period,date:new Date().toLocaleDateString('pt-BR')};
      adminAddHistory('horarios',file.name);
      adminSetFileStatus('horarios',`✓ ${total.toLocaleString()} registros · ${period}`,'ok');
      if (typeof pontoParseHorarios==='function') pontoParseHorarios(wb,null);
      if (typeof pontoDbSave === 'function') pontoDbSave('horarios', records); // atualiza cache local já
      // Auto-recalcular aderência se marcação também já estiver disponível
      if (typeof pontoMarcacao !== 'undefined' && pontoMarcacao?.size > 0 && typeof adminPrecomputeAderencia === 'function') {
        adminSetFileStatus('horarios', 'Recalculando aderência...', 'load');
        adminPrecomputeAderencia()
          .then(() => adminSetFileStatus('horarios', `✓ ${total.toLocaleString()} registros · ${period}`, 'ok'))
          .catch(err => console.warn('[adminLoadHorarios] precompute:', err));
      }
      input.value='';
    } catch(err) { adminSetFileStatus('horarios','Erro: '+err.message,'err'); console.error(err); }
  };
  reader.readAsArrayBuffer(file);
}

async function adminLoadMarcacao(input) {
  const file = input.files[0];
  if (!file) return;
  adminSetFileStatus('marcacao', 'Lendo arquivo...', 'load');
  const reader = new FileReader();
  reader.onload = async e => {
    try {
      const wb   = XLSX.read(e.target.result, { type:'array' });
      const ws   = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header:1, defval:null, raw:true });
      const records=[]; const datas=new Set();
      const EXCL=new Set(['HQ2','SEDE','GSE']);
      function fmtD(v) {
        if (!v) return null;
        // Date object (XLSX raw:true returns Date for date cells)
        if (v instanceof Date) {
          const y=v.getFullYear(), m=String(v.getMonth()+1).padStart(2,'0'), d=String(v.getDate()).padStart(2,'0');
          return `${y}-${m}-${d}`;
        }
        // Excel serial number
        if (typeof v === 'number') {
          const ms = Math.round((v - 25569) * 86400 * 1000);
          const dt = new Date(ms);
          const y=dt.getUTCFullYear(), m=String(dt.getUTCMonth()+1).padStart(2,'0'), d=String(dt.getUTCDate()).padStart(2,'0');
          return `${y}-${m}-${d}`;
        }
        // String: could be "2026-06-01" or "06/01/2026" (MM/DD) or "01/06/2026" (DD/MM)
        const s = String(v).trim();
        if (s.match(/^\d{4}-\d{2}-\d{2}/)) return s.slice(0,10);
        if (s.includes('/')) {
          const parts = s.split('/');
          // If first part > 12, it's DD/MM/YYYY; if second part > 12, it's MM/DD/YYYY
          const [a,b,yr] = parts;
          const year = yr && yr.length===2 ? (parseInt(yr)<50?'20':'19')+yr : (yr||'2026');
          if (parseInt(b) > 12) { // a=MM, b=DD
            return year+'-'+a.padStart(2,'0')+'-'+b.padStart(2,'0');
          } else { // a=DD, b=MM (BR format)
            return year+'-'+b.padStart(2,'0')+'-'+a.padStart(2,'0');
          }
        }
        // Purely-numeric string (serial date stored as text, e.g. "46174")
        if (/^\d{4,6}$/.test(s)) {
          const ms = Math.round((parseInt(s) - 25569) * 86400 * 1000);
          const dt = new Date(ms);
          if (!isNaN(dt)) {
            const y=dt.getUTCFullYear(), m=String(dt.getUTCMonth()+1).padStart(2,'0'), d=String(dt.getUTCDate()).padStart(2,'0');
            return `${y}-${m}-${d}`;
          }
        }
        return null;
      }
      function fmtT(v) {
        if (!v && v!==0) return null;
        if (typeof v === 'number') {
          const totalMin = Math.round(v * 1440);
          return String(Math.floor(totalMin/60)%24).padStart(2,'0')+':'+String(totalMin%60).padStart(2,'0');
        }
        if (v instanceof Date) return String(v.getHours()).padStart(2,'0')+':'+String(v.getMinutes()).padStart(2,'0');
        const s = String(v).trim();
        if (s.includes(':')) return s.slice(0,5);
        const f = parseFloat(s);
        if (!isNaN(f)) { const m=Math.round(f*1440); return String(Math.floor(m/60)%24).padStart(2,'0')+':'+String(m%60).padStart(2,'0'); }
        return null;
      }
      rows.forEach((row,i) => {
        if (i===0||!row||!row[1]) return;
        const filial=String(row[0]||'').trim().toUpperCase();
        if (EXCL.has(filial)) return;
        const mat=String(row[1]).trim().padStart(6,'0');
        const nome=String(row[2]||'').trim();
        const data=fmtD(row[3]);
        if (!data) return;
        datas.add(data.slice(0,7));
        records.push({filial,matricula:mat,nome,data,
          bat1:fmtT(row[4]),bat2:fmtT(row[5]),bat3:fmtT(row[6]),bat4:fmtT(row[7]),
          bat5:fmtT(row[8]),bat6:fmtT(row[9]),bat7:fmtT(row[10]),bat8:fmtT(row[11]),
          updated_at:new Date()});
      });
      const period=[...datas].sort().join(', ');
      const total=records.length;
      adminSetFileStatus('marcacao',`Gravando ${total.toLocaleString()}...`,'load');
      const BATCH=500; let saved=0;
      for (let i=0;i<records.length;i+=BATCH) {
        const {error}=await db.from('marcacao').upsert(records.slice(i,i+BATCH),{onConflict:'filial,matricula,data'});
        if (error) throw new Error(error.message);
        saved+=Math.min(BATCH,records.length-i);
        adminSetFileStatus('marcacao',`Gravando... ${saved.toLocaleString()}/${total.toLocaleString()}`,'load');
      }
      adminFiles.marcacao={count:total,period,date:new Date().toLocaleDateString('pt-BR')};
      adminAddHistory('marcacao',file.name);
      adminSetFileStatus('marcacao',`✓ ${total.toLocaleString()} registros · ${period}`,'ok');
      if (typeof pontoParseMarcacao==='function') pontoParseMarcacao(wb,null);
      if (typeof pontoDbSave === 'function') pontoDbSave('marcacao', records); // atualiza cache local já
      // Auto-recalcular aderência se horários também já estiver disponível
      if (typeof pontoHorarios !== 'undefined' && pontoHorarios?.size > 0 && typeof adminPrecomputeAderencia === 'function') {
        adminSetFileStatus('marcacao', 'Recalculando aderência...', 'load');
        adminPrecomputeAderencia()
          .then(() => adminSetFileStatus('marcacao', `✓ ${total.toLocaleString()} registros · ${period}`, 'ok'))
          .catch(err => console.warn('[adminLoadMarcacao] precompute:', err));
      }
      input.value='';
    } catch(err) { adminSetFileStatus('marcacao','Erro: '+err.message,'err'); console.error(err); }
  };
  reader.readAsArrayBuffer(file);
}

async function adminLoadMalha(input) {
  const file = input.files[0];
  if (!file) return;
  adminSetFileStatus('malha', 'Lendo arquivo...', 'load');
  const reader = new FileReader();
  reader.onload = async e => {
    try {
      const text  = e.target.result;
      const lines = text.split(/\r?\n/);
      let dataStart=0;
      for (let i=0;i<8;i++) { if (lines[i]?.trim().startsWith('Base,')) { dataStart=i+1; break; } }
      const records=[]; const basesSet=new Set();
      function fmtD(v) {
        if (!v) return null;
        // Date object (XLSX raw:true returns Date for date cells)
        if (v instanceof Date) {
          const y=v.getFullYear(), m=String(v.getMonth()+1).padStart(2,'0'), d=String(v.getDate()).padStart(2,'0');
          return `${y}-${m}-${d}`;
        }
        // Excel serial number
        if (typeof v === 'number') {
          const ms = Math.round((v - 25569) * 86400 * 1000);
          const dt = new Date(ms);
          const y=dt.getUTCFullYear(), m=String(dt.getUTCMonth()+1).padStart(2,'0'), d=String(dt.getUTCDate()).padStart(2,'0');
          return `${y}-${m}-${d}`;
        }
        // String: could be "2026-06-01" or "06/01/2026" (MM/DD) or "01/06/2026" (DD/MM)
        const s = String(v).trim();
        if (s.match(/^\d{4}-\d{2}-\d{2}/)) return s.slice(0,10);
        if (s.includes('/')) {
          const parts = s.split('/');
          // If first part > 12, it's DD/MM/YYYY; if second part > 12, it's MM/DD/YYYY
          const [a,b,yr] = parts;
          const year = yr && yr.length===2 ? (parseInt(yr)<50?'20':'19')+yr : (yr||'2026');
          if (parseInt(b) > 12) { // a=MM, b=DD
            return year+'-'+a.padStart(2,'0')+'-'+b.padStart(2,'0');
          } else { // a=DD, b=MM (BR format)
            return year+'-'+b.padStart(2,'0')+'-'+a.padStart(2,'0');
          }
        }
        // Purely-numeric string (serial date stored as text, e.g. "46174")
        if (/^\d{4,6}$/.test(s)) {
          const ms = Math.round((parseInt(s) - 25569) * 86400 * 1000);
          const dt = new Date(ms);
          if (!isNaN(dt)) {
            const y=dt.getUTCFullYear(), m=String(dt.getUTCMonth()+1).padStart(2,'0'), d=String(dt.getUTCDate()).padStart(2,'0');
            return `${y}-${m}-${d}`;
          }
        }
        return null;
      }
      for (let i=dataStart;i<lines.length;i++) {
        const parts=lines[i].split(',');
        if (parts.length<4) continue;
        const base=parts[0].trim(); if(!base) continue;
        const data=fmtD(parts[3]); if(!data) continue;
        basesSet.add(base);
        records.push({base,data,tipo:parts[5]?.trim()||null,voo:parts[6]?.trim()||null,
          hora_chegada:parts[7]?.trim()||null,hora_saida:parts[8]?.trim()||null,
          cia:parts[2]?.trim()||null,aeronave:parts[10]?.trim()||null,updated_at:new Date()});
      }
      const total=records.length;
      adminSetFileStatus('malha',`Gravando ${total.toLocaleString()} voos...`,'load');
      const BATCH=500; let saved=0;
      for (let i=0;i<records.length;i+=BATCH) {
        const {error}=await db.from('malha').upsert(records.slice(i,i+BATCH),{onConflict:'base,data,voo,hora_chegada'});
        if (error) throw new Error(error.message);
        saved+=Math.min(BATCH,records.length-i);
        adminSetFileStatus('malha',`Gravando... ${saved.toLocaleString()}/${total.toLocaleString()}`,'load');
      }
      adminFiles.malha={count:total,bases:basesSet.size,date:new Date().toLocaleDateString('pt-BR')};
      window.malhaRows = null; // força recarregar na próxima vez que abrir o dashboard, já com esse mês
      malhaVoos = undefined;
      adminAddHistory('malha',file.name);
      adminSetFileStatus('malha',`✓ ${total.toLocaleString()} voos · ${basesSet.size} bases`,'ok');
      if (typeof malhaParseCSV==='function') malhaParseCSV(text);
      input.value='';
    } catch(err) { adminSetFileStatus('malha','Erro: '+err.message,'err'); console.error(err); }
  };
  reader.readAsText(file,'ISO-8859-1');
}

function adminSetFileStatus(key, msg, type) {
  const el = document.getElementById(`adm-status-${key}`);
  if (!el) return;
  el.textContent = msg;
  el.className = type==='ok' ? 'adm-file-badge-ok'
               : type==='load' ? 'adm-file-badge-load'
               : type==='err'  ? 'adm-file-badge-err'
               : 'adm-file-badge-no';
}

// ══════════════════════════════════════════════════════
// TAB: ADERÊNCIA
// ══════════════════════════════════════════════════════
async function adminTriggerPrecompute() {
  const btn = document.getElementById('adm-recalc-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Carregando... 0%'; }
  const onProg = (label) => (loaded, total) => {
    if (btn) btn.textContent = `${label} ${total ? Math.min(100, Math.round(loaded/total*100)) : 0}%`;
  };
  try {
    // Load from DB if not in memory
    if (!pontoHorarios?.size) await adminLoadFileOnDemand('horarios', onProg('Horários'));
    if (!pontoMarcacao?.size) await adminLoadFileOnDemand('marcacao', onProg('Marcação'));
    if (!pontoHorarios?.size || !pontoMarcacao?.size) {
      alert('Carregue os arquivos Horários e Marcação primeiro.');
      return;
    }
    if (btn) btn.textContent = 'Calculando...';
    const result = await adminPrecomputeAderencia();
    // Invalidate localStorage cache (all months) — adminPrecomputeAderencia
    // already does this internally, but repeated here for safety.
    try {
      const toRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k.startsWith('adh_kpi_cache') || k.startsWith('adh_kpi_ts'))) toRemove.push(k);
      }
      toRemove.forEach(k => localStorage.removeItem(k));
    } catch(_){}
    if (result?.errors?.length) {
      alert(`Recalculado com ${result.errors.length} erro(s) ao salvar no banco. Alguns colaboradores podem não aparecer. Veja o console para detalhes.`);
    }
    if (btn) { btn.textContent = '✓ Recalculado!'; setTimeout(()=>{ btn.disabled=false; btn.textContent='↺ Recalcular Aderência'; },3000); }
  } catch(e) {
    alert('Erro: '+e.message);
    if (btn) { btn.disabled=false; btn.textContent='↺ Recalcular Aderência'; }
  }
}

// ── Reusable progress bar (for long DB loads) ─────────
function adminProgressHTML(id, label) {
  return `
    <div class="adm-progress-wrap" id="${id}">
      <i class="ti ti-loader-2" style="font-size:26px;opacity:.5;animation:spin 1s linear infinite" aria-hidden="true"></i>
      <div class="adm-progress-label" id="${id}-label">${label}</div>
      <div class="adm-progress-track"><div class="adm-progress-fill" id="${id}-fill" style="width:0%"></div></div>
      <div class="adm-progress-count" id="${id}-count">0%</div>
    </div>`;
}

function adminUpdateProgress(id, loaded, total, label) {
  const fill  = document.getElementById(id+'-fill');
  const count = document.getElementById(id+'-count');
  const lbl   = document.getElementById(id+'-label');
  const pct = total ? Math.min(100, Math.round(loaded/total*100)) : 0;
  if (fill)  fill.style.width = pct + '%';
  if (count) count.textContent = `${loaded.toLocaleString('pt-BR')} / ${total.toLocaleString('pt-BR')} registros · ${pct}%`;
  if (lbl && label) lbl.textContent = label;
}

async function adminAderenciaTab(el) {
  // Show loading state
  el.innerHTML = `
    <div class="adm-section-header">
      <span>Aderência ao Ponto</span>
      <button id="adm-recalc-btn" class="adm-btn-primary" onclick="adminTriggerPrecompute()" style="font-size:11px;padding:6px 12px">
        ↺ Recalcular
      </button>
    </div>
    <div class="adm-empty-state">
      <i class="ti ti-loader-2" style="font-size:32px;opacity:.4;animation:spin 1s linear infinite" aria-hidden="true"></i>
      <p>Verificando dados...</p>
    </div>`;

  // Check if files are available in Storage
  if (!adminFiles.horarios || !adminFiles.marcacao) {
    el.innerHTML = `
      <div class="adm-section-header"><span>Aderência ao Ponto</span></div>
      <div class="adm-empty-state">
        <i class="ti ti-clock-off" style="font-size:32px;opacity:.2" aria-hidden="true"></i>
        <p>Carregue os arquivos <strong>Ponto planejado</strong> e <strong>Marcação de ponto</strong> na aba Arquivos.</p>
        <button class="adm-btn-primary" onclick="adminTabSwitch('files', document.querySelectorAll('.adm-tab-btn')[1])">
          Ir para Arquivos
        </button>
      </div>`;
    return;
  }

  // Load on demand if not yet processed
  el.innerHTML = `
    <div class="adm-section-header"><span>Aderência ao Ponto</span></div>
    ${adminProgressHTML('adm-adh-progress', 'Carregando Horários...')}`;

  await adminLoadFileOnDemand('horarios', (loaded, total) =>
    adminUpdateProgress('adm-adh-progress', loaded, total, 'Carregando Horários...'));

  adminUpdateProgress('adm-adh-progress', 0, 1, 'Carregando Marcação...');
  const fillReset = document.getElementById('adm-adh-progress-fill');
  if (fillReset) fillReset.style.width = '0%';

  await adminLoadFileOnDemand('marcacao', (loaded, total) =>
    adminUpdateProgress('adm-adh-progress', loaded, total, 'Carregando Marcação...'));

  // Build comparison using ponto.js engine
  const results = typeof pontoBuildComparison === 'function'
    ? pontoBuildComparison(null, null, null)
    : [];

  const stats = typeof pontoBuildStats === 'function' ? pontoBuildStats(results) : null;

  // Group by base
  const byBase = {};
  results.forEach(r => {
    const b = r.filial || '?';
    if (!byBase[b]) byBase[b] = { ok:0, desvio:0, atraso:0, saida_antecipada:0, falta:0, total:0 };
    byBase[b][r.status] = (byBase[b][r.status]||0) + 1;
    byBase[b].total++;
  });

  const pct = b => b.total ? Math.round((b.ok/b.total)*100) : 0;
  const pctColor = p => p>=90?'#72c02c':p>=70?'#f59e0b':'#ef4444';

  el.innerHTML = `
    <div class="adm-section-header">
      <span>Aderência ao Ponto · ${results.length.toLocaleString()} registros</span>
      <div style="display:flex;align-items:center;gap:14px">
        <div style="display:flex;gap:8px">
          <span class="adm-legend-item"><span class="adm-dot" style="background:#72c02c"></span>≥90% ótimo</span>
          <span class="adm-legend-item"><span class="adm-dot" style="background:#f59e0b"></span>70–89% atenção</span>
          <span class="adm-legend-item"><span class="adm-dot" style="background:#ef4444"></span>&lt;70% crítico</span>
        </div>
        <button id="adm-recalc-btn" class="adm-btn-primary" onclick="adminTriggerPrecompute()" style="font-size:11px;padding:6px 12px">
          ↺ Recalcular
        </button>
      </div>
    </div>

    ${stats ? adhKpiCardsHTML([
      { key:'blue', icon:'ti-chart-bar', title:'Aderência', rows: [
        { label:'Aderência geral', sub:'todas as bases', value: stats.adherencePct+'%', color: pctColor(stats.adherencePct) },
        { label:'No horário', sub:'jornadas ok', value: stats.ok.toLocaleString('pt-BR') },
      ]},
      { key:'amber', icon:'ti-clock-exclamation', title:'Desvios', rows: [
        { label:'Atrasos', sub:'atraso + desvio', value: (stats.atraso+stats.desvio).toLocaleString('pt-BR') },
        { label:'Saída antecipada', sub:'jornada encerrada antes', value: stats.saida_antecipada.toLocaleString('pt-BR') },
      ]},
      { key:'red', icon:'ti-x', title:'Faltas', rows: [
        { label:'Faltas', sub:'sem ponto registrado', value: stats.falta.toLocaleString('pt-BR') },
      ]},
    ], true) : ''}

    <div class="adm-adh-grid">
      ${Object.entries(byBase).sort((a,b)=>pct(b[1])-pct(a[1])).map(([base, b]) => {
        const p = pct(b);
        const c = pctColor(p);
        return `
          <div class="adm-adh-card">
            <div class="adm-adh-top">
              <span class="adm-adh-base">${base}</span>
              <span class="adm-adh-pct" style="color:${c}">${p}%</span>
            </div>
            <div class="adm-adh-bar"><div style="width:${p}%;background:${c};height:100%;border-radius:2px"></div></div>
            <div class="adm-adh-rows">
              <div class="adm-adh-row"><span>No horário</span><span style="color:#72c02c">${b.ok}</span></div>
              <div class="adm-adh-row"><span>Atrasos</span><span style="color:#f59e0b">${b.atraso+b.desvio}</span></div>
              <div class="adm-adh-row"><span>Faltas</span><span style="color:#ef4444">${b.falta}</span></div>
              <div class="adm-adh-row"><span>Total</span><span>${b.total}</span></div>
            </div>
          </div>`;
      }).join('')}
    </div>`;
}

// ══════════════════════════════════════════════════════
// TAB: MALHA AÉREA
// ══════════════════════════════════════════════════════
// ── Malha aérea — cálculo de PNT e agregações ──────────
// PNT Previsto = % de voos com permanência em solo acima de 4h (confirmado
// com o cliente). Ground time = hora_saida − hora_chegada, tratando virada
// de meia-noite. Voos sem os dois horários ficam fora da conta (não dá pra
// saber quanto tempo ficaram em solo).
function malhaMinutos(hhmm) {
  if (!hhmm) return null;
  const m = String(hhmm).match(/(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return parseInt(m[1],10)*60 + parseInt(m[2],10);
}

function malhaGroundMin(row) {
  const cheg = malhaMinutos(row.hora_chegada);
  const sai  = malhaMinutos(row.hora_saida);
  if (cheg == null || sai == null) return null;
  let diff = sai - cheg;
  if (diff < 0) diff += 1440;
  return diff;
}

function malhaIsPNT(row) {
  const g = malhaGroundMin(row);
  return g == null ? null : g > 240;
}

function malhaBasesDisponiveis() {
  return [...new Set((window.malhaRows||[]).map(r => r.base))].filter(Boolean).sort();
}

function malhaMesesDisponiveis(base) {
  const rows = base ? (window.malhaRows||[]).filter(r => r.base === base) : (window.malhaRows||[]);
  return [...new Set(rows.map(r => (r.data||'').slice(0,7)))].filter(Boolean).sort();
}

// Linhas cruas de um mês — só base+mês, sem aplicar semana/cliente ainda.
// As funções abaixo compõem isso com os filtros certos pra cada uso: os
// KPIs respeitam tudo (drill-down completo); a grade semanal/horária
// respeita cliente mas não semana (senão colapsaria pra 1 linha só); e o
// comparativo por cia/aeronave respeita semana mas não o próprio cliente
// (senão só apareceria 1 barra depois de clicar).
function malhaRowsBase(mes) {
  const base = window._malhaBase;
  if (!mes) return [];
  return (window.malhaRows||[]).filter(r => (!base || r.base === base) && (r.data||'').slice(0,7) === mes);
}

function malhaAplicaSemana(rows) {
  const semana = window._malhaSemana;
  if (!semana) return rows;
  return rows.filter(r => r.data && malhaSemanaChave(r.data).key === semana);
}

function malhaAplicaCliente(rows) {
  const cliente = window._malhaCliente;
  if (!cliente) return rows;
  return rows.filter(r => (r.cia||'SEM CIA') === cliente);
}

function malhaRowsDoMes(mes) {
  return malhaAplicaCliente(malhaAplicaSemana(malhaRowsBase(mes)));
}

function malhaStatsDoMes(mes) {
  const rows = malhaRowsDoMes(mes); // respeita todos os filtros ativos
  const total = rows.length;
  const diasNoMes = mes && typeof adhDaysInMonth === 'function' ? adhDaysInMonth(mes) : 1;
  const mediaDia = diasNoMes ? Math.round(total/diasNoMes*10)/10 : 0;
  let pntSim = 0, pntElig = 0;
  rows.forEach(r => { const p = malhaIsPNT(r); if (p != null) { pntElig++; if (p) pntSim++; } });
  const pntPct = pntElig ? Math.round(pntSim/pntElig*1000)/10 : null;
  return { total, mediaDia, pntPct };
}

// Cliente/aeronave — respeita base+mês+semana, mas NÃO o cliente selecionado
// (é essa a dimensão sendo detalhada; filtrar por ele também zeraria o resto).
// Linhas de um mês que caem num slot de 30min específico, dentro da semana
// mais cheia — usado quando o usuário clica no gráfico pra filtrar.
function malhaRowsDoSlot(mes, semanaKey, idx, metrica) {
  if (idx == null || !semanaKey) return null;
  const inicioMin = idx*30, fimMin = inicioMin+30;
  return malhaAplicaCliente(malhaRowsBase(mes)).filter(r => {
    if (!r.data || malhaSemanaChave(r.data).key !== semanaKey) return false;
    if (metrica === 'movimentos') {
      const c = malhaMinutos(r.hora_chegada), s = malhaMinutos(r.hora_saida);
      return (c!=null && c>=inicioMin && c<fimMin) || (s!=null && s>=inicioMin && s<fimMin);
    }
    let c = malhaMinutos(r.hora_chegada), s = malhaMinutos(r.hora_saida);
    if (c==null || s==null) return false;
    if (s<c) s += 1440;
    return c < fimMin && s > inicioMin;
  });
}

function malhaBreakdownDoMes(mes) {
  let rows;
  const slotIdx = window._malhaSlotSelecionado;
  if (slotIdx != null) {
    const pior = malhaPiorSemana(mes);
    rows = pior ? (malhaRowsDoSlot(mes, pior.key, slotIdx, window._malhaMetrica || 'movimentos') || []) : [];
  } else {
    rows = malhaAplicaSemana(malhaRowsBase(mes));
  }
  const cias = new Map(), aeronaves = new Map();
  rows.forEach(r => {
    const c = r.cia || 'SEM CIA'; cias.set(c, (cias.get(c)||0)+1);
    const a = r.tipo || 'SEM TIPO'; aeronaves.set(a, (aeronaves.get(a)||0)+1);
  });
  return { cias, aeronaves };
}

function malhaMesLabel(mes) {
  if (!mes) return '—';
  return typeof adhMonthLabel === 'function' ? adhMonthLabel(mes) : mes;
}

// "Chave semana" = domingo a sábado, recortado nas bordas do mês (igual o
// print de referência: primeira e última semana do mês vêm parciais).
function malhaSemanaChave(dataStr) {
  const d = new Date(dataStr+'T12:00:00');
  const dow = d.getDay();
  const inicio = new Date(d); inicio.setDate(d.getDate()-dow);
  const fim = new Date(inicio); fim.setDate(inicio.getDate()+6);
  const mesInicio = new Date(d.getFullYear(), d.getMonth(), 1);
  const mesFim = new Date(d.getFullYear(), d.getMonth()+1, 0);
  const ini = inicio < mesInicio ? mesInicio : inicio;
  const fi  = fim > mesFim ? mesFim : fim;
  return { key: `${String(ini.getDate()).padStart(2,'0')} a ${String(fi.getDate()).padStart(2,'0')}`, sortKey: ini.getTime() };
}

const MALHA_DIAS = ['dom','seg','ter','qua','qui','sex','sab'];

// Grade semanal — respeita cliente, mas NÃO semana (senão colapsaria pra 1 linha).
function malhaGradeSemanal(mes) {
  const semanas = new Map();
  malhaAplicaCliente(malhaRowsBase(mes)).forEach(r => {
    if (!r.data) return;
    const { key, sortKey } = malhaSemanaChave(r.data);
    if (!semanas.has(key)) semanas.set(key, { key, sortKey, dom:0,seg:0,ter:0,qua:0,qui:0,sex:0,sab:0, total:0 });
    const d = new Date(r.data+'T12:00:00');
    const campo = MALHA_DIAS[d.getDay()];
    const s = semanas.get(key);
    s[campo]++; s.total++;
  });
  return [...semanas.values()].sort((a,b)=>a.sortKey-b.sortKey);
}

const MALHA_SLOTS = [[0,2],[3,5],[6,8],[9,11],[12,14],[15,17],[18,20],[21,23]];
const MALHA_SLOTS_LBL = MALHA_SLOTS.map(s => `${String(s[0]).padStart(2,'0')}-${String(s[1]).padStart(2,'0')}`);

function malhaSlotIdx(hhmm) {
  const min = malhaMinutos(hhmm);
  if (min == null) return null;
  const h = Math.floor(min/60);
  for (let i=0;i<MALHA_SLOTS.length;i++) if (h>=MALHA_SLOTS[i][0] && h<=MALHA_SLOTS[i][1]) return i;
  return null;
}

function malhaGradeHoraria(mes) {
  const semanas = new Map();
  malhaAplicaCliente(malhaRowsBase(mes)).forEach(r => {
    if (!r.data) return;
    const { key, sortKey } = malhaSemanaChave(r.data);
    if (!semanas.has(key)) semanas.set(key, { key, sortKey, slots: new Array(8).fill(0), total: 0 });
    const idx = malhaSlotIdx(r.hora_chegada);
    const s = semanas.get(key);
    if (idx != null) s.slots[idx]++;
    s.total++;
  });
  return [...semanas.values()].sort((a,b)=>a.sortKey-b.sortKey);
}

// Semana mais movimentada do mês (usada no comparativo por horário)
function malhaPiorSemana(mes) {
  const grade = malhaGradeSemanal(mes);
  if (!grade.length) return null;
  return grade.reduce((a,b) => b.total > a.total ? b : a);
}

function malhaHorasDaSemana(mes, semanaKey) {
  const porHora = new Array(24).fill(0);
  malhaAplicaCliente(malhaRowsBase(mes)).forEach(r => {
    if (!r.data || malhaSemanaChave(r.data).key !== semanaKey) return;
    const min = malhaMinutos(r.hora_chegada);
    if (min != null) porHora[Math.floor(min/60)]++;
  });
  return porHora;
}

function adminMalhaCurva(mes, semanaKey, metrica, agregacao) {
  const n = 48;
  const porDia = new Map();
  malhaAplicaCliente(malhaRowsBase(mes)).forEach(r => {
    if (!r.data || malhaSemanaChave(r.data).key !== semanaKey) return;
    if (!porDia.has(r.data)) porDia.set(r.data, new Array(n).fill(0));
    const arr = porDia.get(r.data);
    if (metrica === 'movimentos') {
      const c = malhaMinutos(r.hora_chegada); if (c!=null) arr[Math.min(n-1,Math.floor(c/30))]++;
      const s = malhaMinutos(r.hora_saida);   if (s!=null) arr[Math.min(n-1,Math.floor(s/30))]++;
    } else {
      // "Em solo" e "Atendimento" (mesmo cálculo por enquanto — ver observação
      // na mensagem de entrega): aeronaves simultâneas no pátio, contando cada
      // meia-hora entre a chegada e a saída.
      let c = malhaMinutos(r.hora_chegada), s = malhaMinutos(r.hora_saida);
      if (c==null || s==null) return;
      if (s < c) s += 1440;
      for (let m=c; m<s; m+=30) arr[Math.floor((m%1440)/30)]++;
    }
  });
  const dias = [...porDia.values()];
  const curva = new Array(n).fill(0);
  for (let i=0;i<n;i++) {
    const vals = dias.map(d=>d[i]);
    if (!vals.length) continue;
    curva[i] = agregacao==='maximo' ? Math.max(...vals) : Math.round(vals.reduce((a,b)=>a+b,0)/vals.length*10)/10;
  }
  return curva;
}

function adminMalhaPicoDaCurva(curva) {
  if (!curva.length) return { hora:null, valor:0 };
  let idx=0;
  curva.forEach((v,i)=>{ if (v>curva[idx]) idx=i; });
  const totalMin = idx*30;
  const h = Math.floor(totalMin/60), m = totalMin%60;
  return { hora: `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`, valor: curva[idx] };
}

function malhaSmoothPath(pontos) {
  if (!pontos.length) return '';
  if (pontos.length === 1) return `M ${pontos[0][0].toFixed(1)} ${pontos[0][1].toFixed(1)}`;
  let d = `M ${pontos[0][0].toFixed(1)} ${pontos[0][1].toFixed(1)}`;
  for (let i = 0; i < pontos.length-1; i++) {
    const [x0,y0] = pontos[i], [x1,y1] = pontos[i+1];
    const mx = (x0+x1)/2, my = (y0+y1)/2;
    d += ` Q ${x0.toFixed(1)} ${y0.toFixed(1)} ${mx.toFixed(1)} ${my.toFixed(1)}`;
  }
  const last = pontos[pontos.length-1];
  d += ` L ${last[0].toFixed(1)} ${last[1].toFixed(1)}`;
  return d;
}

function adminMalhaCurvaSVG(c1, c2, mes1, mes2, larguraAlvo) {
  const n = 48;
  const max = Math.max(3, ...c1, ...c2);
  const W = larguraAlvo || 1200, H=260, padL=32, padR=14, padT=10, padB=24;
  const stepX = (W-padL-padR)/(n-1);
  const scaleY = v => H-padB-(v/max*(H-padB-padT));
  const pontosFor = arr => arr.map((v,i) => [padL+i*stepX, scaleY(v)]);
  const pathFor = arr => malhaSmoothPath(pontosFor(arr));
  const areaFor = arr => `${pathFor(arr)} L ${(padL+(n-1)*stepX).toFixed(1)} ${(H-padB).toFixed(1)} L ${padL.toFixed(1)} ${(H-padB).toFixed(1)} Z`;
  const yStep = max<=6?1:max<=12?3:Math.ceil(max/4);
  const yTicks = [];
  for (let v=0; v<=max; v+=yStep) yTicks.push(v);
  const slotSel = window._malhaSlotSelecionado;

  // Guarda os dados crus (não só os rótulos) num lugar acessível pros
  // handlers de hover/clique e pra função que reajusta a largura depois
  // de medir o container de verdade — o gráfico é HTML puro, sem
  // framework, então a interação é feita por listeners globais.
  window._malhaCurvaData = { c1, c2, mes1raw: mes1, mes2raw: mes2, mes1: malhaMesLabel(mes1), mes2: malhaMesLabel(mes2), W, H, padL, padR, padT, padB, n, max };

  return `
    <div id="malha-curva-wrap" style="position:relative;width:100%">
      <svg id="malha-curva-svg" viewBox="0 0 ${W} ${H}" style="display:block;width:100%;height:260px;cursor:crosshair"
        onmousemove="adminMalhaCurvaHover(event,this)" onmouseleave="adminMalhaCurvaLeave()" onclick="adminMalhaCurvaClick(event,this)">
        ${yTicks.map(v => `<line x1="${padL}" y1="${scaleY(v).toFixed(1)}" x2="${W-padR}" y2="${scaleY(v).toFixed(1)}" stroke="var(--border)" stroke-width="1"/><text x="4" y="${(scaleY(v)+3).toFixed(1)}" font-size="9" style="fill:var(--text-muted)">${v}</text>`).join('')}
        ${[...Array(24).keys()].map(h => `<text x="${(padL+h*2*stepX).toFixed(1)}" y="${H-6}" font-size="8.5" text-anchor="middle" style="fill:var(--text-muted)">${String(h).padStart(2,'0')}h</text>`).join('')}
        <path d="${areaFor(c2)}" fill="#5fa87a" opacity="0.12" stroke="none"/>
        <path d="${areaFor(c1)}" fill="#38bdf8" opacity="0.12" stroke="none"/>
        <path d="${pathFor(c2)}" fill="none" stroke="#5fa87a" stroke-width="2"/>
        <path d="${pathFor(c1)}" fill="none" stroke="#38bdf8" stroke-width="2"/>
        ${slotSel != null ? `<line x1="${(padL+slotSel*stepX).toFixed(1)}" y1="${padT}" x2="${(padL+slotSel*stepX).toFixed(1)}" y2="${H-padB}" stroke="var(--blue)" stroke-width="1.5"/>` : ''}
        <line id="malha-curva-crosshair" x1="0" y1="${padT}" x2="0" y2="${H-padB}" stroke="var(--text-muted)" stroke-width="1" stroke-dasharray="3,3" style="display:none"/>
        <circle id="malha-curva-dot1" r="3.5" fill="#38bdf8" stroke="#0b0f1a" stroke-width="1.5" style="display:none"/>
        <circle id="malha-curva-dot2" r="3.5" fill="#5fa87a" stroke="#0b0f1a" stroke-width="1.5" style="display:none"/>
      </svg>
      <div id="malha-curva-tooltip" style="position:absolute;display:none;pointer-events:none;background:#141b2c;border:1px solid var(--border-strong);border-radius:8px;padding:8px 10px;font-size:11px;white-space:nowrap;box-shadow:0 4px 12px rgba(0,0,0,.4);z-index:10;top:6px"></div>
    </div>`;
}

// Depois que a página é inserida no DOM, mede a largura real do container
// e reconstrói o SVG com esse valor exato — assim o viewBox bate 1:1 com
// os pixels de verdade, sem distorcer o texto dos horários (o que
// acontecia forçando um único preserveAspectRatio genérico).
function adminMalhaCurvaAjustaLargura() {
  const wrap = document.getElementById('malha-curva-wrap');
  const d = window._malhaCurvaData;
  if (!wrap || !d) return;
  const largura = Math.round(wrap.clientWidth);
  if (!largura || largura === d.W) return;
  wrap.outerHTML = adminMalhaCurvaSVG(d.c1, d.c2, d.mes1raw, d.mes2raw, largura);
}

function adminMalhaCurvaIdxDoEvento(evt, svg) {
  const d = window._malhaCurvaData;
  if (!d) return null;
  const rect = svg.getBoundingClientRect();
  const xSvg = (evt.clientX - rect.left) * (d.W / rect.width);
  const stepX = (d.W-d.padL-d.padR)/(d.n-1);
  let idx = Math.round((xSvg - d.padL) / stepX);
  return Math.max(0, Math.min(d.n-1, idx));
}

function adminMalhaCurvaHover(evt, svg) {
  const d = window._malhaCurvaData;
  if (!d) return;
  const idx = adminMalhaCurvaIdxDoEvento(evt, svg);
  const stepX = (d.W-d.padL-d.padR)/(d.n-1);
  const scaleY = v => d.H-d.padB-(v/d.max*(d.H-d.padB-d.padT));
  const xPos = d.padL + idx*stepX;

  const crosshair = document.getElementById('malha-curva-crosshair');
  const dot1 = document.getElementById('malha-curva-dot1');
  const dot2 = document.getElementById('malha-curva-dot2');
  if (crosshair) { crosshair.setAttribute('x1', xPos); crosshair.setAttribute('x2', xPos); crosshair.style.display = 'block'; }
  if (dot1) { dot1.setAttribute('cx', xPos); dot1.setAttribute('cy', scaleY(d.c1[idx])); dot1.style.display = 'block'; }
  if (dot2) { dot2.setAttribute('cx', xPos); dot2.setAttribute('cy', scaleY(d.c2[idx])); dot2.style.display = 'block'; }

  const totalMin = idx*30;
  const h = Math.floor(totalMin/60), m = totalMin%60;
  const hora = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;

  const tooltip = document.getElementById('malha-curva-tooltip');
  if (tooltip) {
    tooltip.innerHTML = `
      <div style="font-weight:700;color:var(--text-primary);margin-bottom:5px">${hora} <span style="font-weight:400;color:var(--text-muted)">· clique pra filtrar</span></div>
      <div style="display:flex;align-items:center;gap:6px;color:#38bdf8;margin-bottom:2px"><span style="width:8px;height:8px;border-radius:2px;background:#38bdf8;display:inline-block"></span>${d.mes1}: <strong>${d.c1[idx]}</strong></div>
      <div style="display:flex;align-items:center;gap:6px;color:#5fa87a"><span style="width:8px;height:8px;border-radius:2px;background:#5fa87a;display:inline-block"></span>${d.mes2}: <strong>${d.c2[idx]}</strong></div>`;
    const leftPct = xPos/d.W*100;
    if (leftPct > 70) { tooltip.style.left = 'auto'; tooltip.style.right = `${100-leftPct}%`; }
    else { tooltip.style.right = 'auto'; tooltip.style.left = `${leftPct}%`; }
    tooltip.style.display = 'block';
  }
}

function adminMalhaCurvaLeave() {
  ['malha-curva-crosshair','malha-curva-dot1','malha-curva-dot2','malha-curva-tooltip'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
}

function adminMalhaCurvaClick(evt, svg) {
  const idx = adminMalhaCurvaIdxDoEvento(evt, svg);
  if (idx == null) return;
  window._malhaSlotSelecionado = (window._malhaSlotSelecionado === idx) ? null : idx;
  adminMalhaRenderDash(document.getElementById('adm-tab-content'));
}

function adminMalhaLimparSlot() {
  window._malhaSlotSelecionado = null;
  adminMalhaRenderDash(document.getElementById('adm-tab-content'));
}

function adminMalhaTabelaHTML(mapa1, mapa2, titulo) {
  const nomes = [...new Set([...mapa1.keys(), ...mapa2.keys()])]
    .sort((a,b) => ((mapa2.get(b)||0)+(mapa1.get(b)||0)) - ((mapa2.get(a)||0)+(mapa1.get(a)||0)));
  if (!nomes.length) return `<div style="padding:16px;text-align:center;color:var(--text-muted);font-size:12px">Sem dados.</div>`;
  let totM1=0, totM2=0;
  nomes.forEach(n => { totM1+=mapa1.get(n)||0; totM2+=mapa2.get(n)||0; });
  const totDelta = totM2-totM1;
  const totDeltaPct = totM1 ? Math.round(totDelta/totM1*1000)/10 : 0;
  const th = label => `<th style="text-align:right;padding:6px;color:var(--text-muted);font-size:10px;text-transform:uppercase">${label}</th>`;
  return `
    <table style="width:100%;border-collapse:collapse;font-size:12px">
      <thead><tr>
        <th style="text-align:left;padding:6px;color:var(--text-muted);font-size:10px;text-transform:uppercase">${titulo}</th>
        ${th('M')}${th('M2')}${th('Δ')}${th('Δ%')}
      </tr></thead>
      <tbody>
        ${nomes.map(n => {
          const v1=mapa1.get(n)||0, v2=mapa2.get(n)||0, d=v2-v1;
          const dpct = v1 ? Math.round(d/v1*1000)/10 : 0;
          const cor = d>0?'#5fa87a':d<0?'#fc8181':'var(--text-muted)';
          return `<tr>
            <td style="padding:6px;color:var(--text-primary);border-bottom:1px solid var(--border)">${n}</td>
            <td style="text-align:right;padding:6px;color:var(--text-secondary);border-bottom:1px solid var(--border)">${v1}</td>
            <td style="text-align:right;padding:6px;color:var(--text-secondary);border-bottom:1px solid var(--border)">${v2}</td>
            <td style="text-align:right;padding:6px;font-weight:700;border-bottom:1px solid var(--border);color:${cor}">${d>0?'+':''}${d}</td>
            <td style="text-align:right;padding:6px;font-weight:700;border-bottom:1px solid var(--border);color:${cor}">${dpct>0?'+':''}${dpct}%</td>
          </tr>`;
        }).join('')}
      </tbody>
      <tfoot><tr style="border-top:1px solid var(--border-strong)">
        <td style="padding:7px 6px;font-weight:700;color:var(--text-primary)">Total</td>
        <td style="text-align:right;padding:7px 6px;font-weight:700;color:var(--text-primary)">${totM1}</td>
        <td style="text-align:right;padding:7px 6px;font-weight:700;color:var(--text-primary)">${totM2}</td>
        <td style="text-align:right;padding:7px 6px;font-weight:700;color:${totDelta>0?'#5fa87a':totDelta<0?'#fc8181':'var(--text-muted)'}">${totDelta>0?'+':''}${totDelta}</td>
        <td style="text-align:right;padding:7px 6px;font-weight:700;color:${totDelta>0?'#5fa87a':totDelta<0?'#fc8181':'var(--text-muted)'}">${totDeltaPct>0?'+':''}${totDeltaPct}%</td>
      </tr></tfoot>
    </table>`;
}

function adminMalhaRenderDash(el) {
  const bases = malhaBasesDisponiveis();
  const meses = malhaMesesDisponiveis(window._malhaBase);
  const mes1 = window._malhaMes1, mes2 = window._malhaMes2;
  const metrica = window._malhaMetrica || 'movimentos';
  const agregacao = window._malhaAgregacao || 'media';
  const slotSel = window._malhaSlotSelecionado;

  const b1 = malhaBreakdownDoMes(mes1), b2 = malhaBreakdownDoMes(mes2);

  const pior1 = malhaPiorSemana(mes1), pior2 = malhaPiorSemana(mes2);
  const curva1 = pior1 ? adminMalhaCurva(mes1, pior1.key, metrica, agregacao) : new Array(48).fill(0);
  const curva2 = pior2 ? adminMalhaCurva(mes2, pior2.key, metrica, agregacao) : new Array(48).fill(0);
  const pico1 = adminMalhaPicoDaCurva(curva1), pico2 = adminMalhaPicoDaCurva(curva2);

  let total1, total2, slotLabel = null;
  if (slotSel != null) {
    total1 = pior1 ? (malhaRowsDoSlot(mes1, pior1.key, slotSel, metrica) || []).length : 0;
    total2 = pior2 ? (malhaRowsDoSlot(mes2, pior2.key, slotSel, metrica) || []).length : 0;
    const totalMin = slotSel*30, hh = Math.floor(totalMin/60), mm = totalMin%60;
    const fimMin = totalMin+30, hh2 = Math.floor(fimMin/60), mm2 = fimMin%60;
    slotLabel = `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}–${String(hh2).padStart(2,'0')}:${String(mm2).padStart(2,'0')}`;
  } else {
    total1 = pior1 ? pior1.total : 0;
    total2 = pior2 ? pior2.total : 0;
  }
  const deltaArea = total2-total1;
  const deltaAreaPct = total1 ? Math.round(deltaArea/total1*1000)/10 : 0;

  const metricaLbl = { atendimento:'Atendimento', solo:'Em solo', movimentos:'Movimentos' };

  el.innerHTML = `
    <div class="adm-section-header" style="align-items:flex-end;flex-wrap:wrap;gap:14px">
      <div style="display:flex;gap:14px;align-items:flex-end;flex-wrap:wrap">
        <div><div style="font-size:9.5px;color:var(--text-muted);text-transform:uppercase;margin-bottom:4px">Mês A</div>
          <select id="malha-sel-mesA" class="adh-month-select">${meses.map(m=>`<option value="${m}" ${m===mes1?'selected':''}>${malhaMesLabel(m)}</option>`).join('')}</select></div>
        <div><div style="font-size:9.5px;color:var(--text-muted);text-transform:uppercase;margin-bottom:4px">Mês B (comparar)</div>
          <select id="malha-sel-mesB" class="adh-month-select">${meses.map(m=>`<option value="${m}" ${m===mes2?'selected':''}>${malhaMesLabel(m)}</option>`).join('')}</select></div>
        <div><div style="font-size:9.5px;color:var(--text-muted);text-transform:uppercase;margin-bottom:4px">Base</div>
          <select id="malha-sel-base" class="adh-month-select">${bases.map(b=>`<option value="${b}" ${b===window._malhaBase?'selected':''}>${b}</option>`).join('')}</select></div>
        <button class="adh-refresh-btn" style="background:var(--blue);color:#0b0f1a;border:none;font-weight:600" onclick="adminMalhaAplicar()">Aplicar</button>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <div class="malha-toggle-group">
          <button class="malha-toggle ${metrica==='atendimento'?'active':''}" onclick="adminMalhaSetMetrica('atendimento')">Atendimento</button>
          <button class="malha-toggle ${metrica==='solo'?'active':''}" onclick="adminMalhaSetMetrica('solo')">Em solo</button>
          <button class="malha-toggle ${metrica==='movimentos'?'active':''}" onclick="adminMalhaSetMetrica('movimentos')">Movimentos</button>
        </div>
        <div class="malha-toggle-group">
          <button class="malha-toggle ${agregacao==='media'?'active':''}" onclick="adminMalhaSetAgregacao('media')">Média</button>
          <button class="malha-toggle ${agregacao==='maximo'?'active':''}" onclick="adminMalhaSetAgregacao('maximo')">Máximo</button>
        </div>
      </div>
    </div>

    ${slotSel != null ? `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
      <button class="hc-grupo-clear" onclick="adminMalhaLimparSlot()"><i class="ti ti-x" aria-hidden="true"></i> Filtrado por horário ${slotLabel}</button>
      <span style="font-size:11px;color:var(--text-muted)">KPIs, Cia e Aeronave abaixo refletem só esse horário, na semana mais cheia de cada mês</span>
    </div>` : ''}

    <div style="display:flex;gap:16px;margin-bottom:16px;flex-wrap:wrap">
      <div class="hc-panel" style="flex:1;min-width:200px">
        <div style="font-size:10px;font-weight:700;color:#38bdf8;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">${malhaMesLabel(mes1)}</div>
        <div style="font-size:26px;font-weight:700;color:#38bdf8">${total1.toLocaleString('pt-BR')}</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:4px">${slotSel!=null ? `Voos no horário selecionado` : (pico1.hora!=null ? `Pico ${pico1.hora} (${pico1.valor})` : 'Sem dados')}</div>
      </div>
      <div class="hc-panel" style="flex:1;min-width:200px">
        <div style="font-size:10px;font-weight:700;color:#5fa87a;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">${malhaMesLabel(mes2)}</div>
        <div style="font-size:26px;font-weight:700;color:#5fa87a">${total2.toLocaleString('pt-BR')}</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:4px">${slotSel!=null ? `Voos no horário selecionado` : (pico2.hora!=null ? `Pico ${pico2.hora} (${pico2.valor})` : 'Sem dados')}</div>
      </div>
      <div class="hc-panel" style="flex:1;min-width:200px">
        <div style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">Delta área</div>
        <div style="font-size:26px;font-weight:700;color:${deltaArea>=0?'#5fa87a':'#fc8181'}">${deltaArea>=0?'+':''}${deltaArea}</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:4px">${deltaAreaPct>=0?'+':''}${deltaAreaPct}%</div>
      </div>
    </div>

    <div class="hc-panel" style="margin-bottom:16px">
      <div class="hc-panel-title" style="margin-bottom:2px">Curva de demanda (24h) · ${metricaLbl[metrica]}</div>
      <div style="font-size:11px;color:var(--text-muted);margin-bottom:14px">Pior semana da base${pior1?` · ${malhaMesLabel(mes1)}: semana ${pior1.key}`:''}${pior2?` · ${malhaMesLabel(mes2)}: semana ${pior2.key}`:''} · clique num ponto do gráfico pra filtrar Cia/Aeronave por horário</div>
      ${adminMalhaCurvaSVG(curva1, curva2, mes1, mes2)}
      <div style="display:flex;gap:16px;margin-top:8px;font-size:11px;color:var(--text-secondary)">
        <span style="display:flex;align-items:center;gap:5px"><span style="width:10px;height:10px;border-radius:2px;background:#38bdf8;display:inline-block"></span>${malhaMesLabel(mes1)}</span>
        <span style="display:flex;align-items:center;gap:5px"><span style="width:10px;height:10px;border-radius:2px;background:#5fa87a;display:inline-block"></span>${malhaMesLabel(mes2)}</span>
      </div>
    </div>

    <div style="display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap">
      <div class="hc-panel" style="flex:1;min-width:300px">
        <div class="hc-panel-title">Cia</div>
        ${adminMalhaTabelaHTML(b1.cias, b2.cias, 'Item')}
      </div>
      <div class="hc-panel" style="flex:1;min-width:300px">
        <div class="hc-panel-title">Aeronave</div>
        ${adminMalhaTabelaHTML(b1.aeronaves, b2.aeronaves, 'Item')}
      </div>
    </div>
  `;

  // Corrige a largura do gráfico pro tamanho real do container assim que o
  // layout terminar de calcular (não dá pra saber isso ainda no innerHTML).
  requestAnimationFrame(adminMalhaCurvaAjustaLargura);
  if (!window._malhaResizeListenerAdded) {
    window._malhaResizeListenerAdded = true;
    window.addEventListener('resize', () => adminMalhaCurvaAjustaLargura());
  }
}

function adminMalhaAplicar() {
  const mesA = document.getElementById('malha-sel-mesA')?.value;
  const mesB = document.getElementById('malha-sel-mesB')?.value;
  const base = document.getElementById('malha-sel-base')?.value;
  if (mesA) window._malhaMes1 = mesA;
  if (mesB) window._malhaMes2 = mesB;
  window._malhaBase = base || null;
  window._malhaSlotSelecionado = null;
  adminMalhaRenderDash(document.getElementById('adm-tab-content'));
}

function adminMalhaSetMetrica(m) {
  window._malhaMetrica = m;
  window._malhaSlotSelecionado = null;
  adminMalhaRenderDash(document.getElementById('adm-tab-content'));
}

function adminMalhaSetAgregacao(a) {
  window._malhaAgregacao = a;
  adminMalhaRenderDash(document.getElementById('adm-tab-content'));
}


// ══════════════════════════════════════════════════════
// TAB: PARÂMETROS DE SOLO
// Define quantas pessoas de cada função um voo precisa, e por quanto tempo
// antes/depois do horário do voo essa função fica ocupada. É o dado que
// falta pra transformar "chegou um voo" em "preciso de X rampeiros" — base
// do motor de demanda horária que vai puxar da malha de voos real.
// ══════════════════════════════════════════════════════
// ── Classificadores confirmados com o cliente ──────────
// Categoria de aeronave: C208=C208, AT72=ATR, {B738,A320,E295,E190}=NARROW,
// A321=A321. Tipos maiores (wide-body) ainda não apareceram na malha real,
// então ficam de fora até surgir dado de verdade pra mapear.
const ESCALA_CATEGORIA_MAP = {
  'C208': 'C208',
  'AT72': 'ATR',
  'B738': 'NARROW',
  'A320': 'NARROW',
  'E295': 'NARROW',
  'E190': 'NARROW',
  'A321': 'A321',
};
function escalaCategoriaBase(tipo) {
  return ESCALA_CATEGORIA_MAP[String(tipo||'').toUpperCase().trim()] || null;
}

// Doméstico x Internacional: voos que não são AZUL/LATAM/GOL (nem
// subsidiárias, ex. Azul Conecta, Gol Cargo) contam como internacional.
function escalaDomOuInter(cia) {
  const c = String(cia||'').toUpperCase();
  if (c.includes('AZUL') || c.includes('GOL') || c.includes('TAM') || c.includes('LATAM')) return 'DOM';
  return 'INTER';
}

// Categoria completa pra um voo (usada pelo motor de demanda, passo 2) —
// C208 e ATR não variam por dom/inter, o resto varia.
function escalaCategoriaDoVoo(tipo, cia) {
  const base = escalaCategoriaBase(tipo);
  if (!base) return null;
  if (base === 'C208' || base === 'ATR') return base;
  return `${base} ${escalaDomOuInter(cia)}`;
}

const ESCALA_CATEGORIAS_OPCOES = [
  ['', 'Geral (qualquer aeronave)'],
  ['C208', 'C208'],
  ['ATR', 'ATR'],
  ['NARROW DOM', 'Narrow · Doméstico'],
  ['NARROW INTER', 'Narrow · Internacional'],
  ['A321 DOM', 'A321 · Doméstico'],
  ['A321 INTER', 'A321 · Internacional'],
  ['WIDE', 'Wide-body'],
  ['SUPER', 'Super'],
];

async function adminParametrosTab(el) {
  el.innerHTML = `
    <div class="adm-section-header"><span>Parâmetros de Solo</span></div>
    <div class="adm-empty-state">
      <i class="ti ti-loader-2" style="font-size:32px;opacity:.4;animation:spin 1s linear infinite" aria-hidden="true"></i>
      <p>Carregando...</p>
    </div>`;

  const { data, error } = await db.from('escala_parametro_solo').select('*').order('base').order('funcao');
  if (error) {
    el.innerHTML = `<div class="adm-section-header"><span>Parâmetros de Solo</span></div><div class="adm-empty-state"><p>Erro ao carregar: ${error.message}</p></div>`;
    return;
  }
  window._paramRows = data || [];
  if (window._paramBaseAtiva === undefined) window._paramBaseAtiva = '';
  adminParametrosRenderList(el);
}

function adminParametrosRenderList(el) {
  const bases = adminAllBases();
  const baseAtiva = window._paramBaseAtiva ?? '';
  const rows = (window._paramRows || []).filter(r => r.base === baseAtiva);

  el.innerHTML = `
    <div class="adm-section-header">
      <span>Parâmetros de Solo</span>
      <div style="display:flex;gap:8px;align-items:center">
        <select class="adh-month-select" onchange="adminParametrosSetBase(this.value)">
          <option value="" ${baseAtiva===''?'selected':''}>Padrão (todas as bases)</option>
          ${bases.map(b => `<option value="${b}" ${b===baseAtiva?'selected':''}>${b}</option>`).join('')}
        </select>
        <button class="adm-btn-primary" onclick="adminParametrosNovo()">+ Adicionar função</button>
      </div>
    </div>

    <div style="font-size:11.5px;color:var(--text-muted);margin-bottom:14px;line-height:1.5">
      Define quantas pessoas de cada função um voo precisa, e por quanto tempo antes/depois do horário do voo essa
      função fica ocupada. É a base pro próximo passo (calcular a demanda de cada dia a partir da malha de voos real).
      ${baseAtiva===''
        ? ' Isso aqui é o <strong>padrão</strong>, usado por qualquer base que não tenha uma configuração própria.'
        : ` Isso aqui <strong>sobrescreve o padrão só pra ${baseAtiva}</strong>.`}
    </div>

    <div class="adm-table-wrap">
      <table class="adm-table">
        <thead><tr>
          <th>Função</th><th>Categoria</th><th class="r">Pessoas/voo</th><th>Referência</th><th class="r">Antes (min)</th><th class="r">Depois (min)</th><th>Status</th><th></th>
        </tr></thead>
        <tbody>
          ${rows.length ? [...rows].sort((a,b)=>a.funcao.localeCompare(b.funcao)||a.categoria.localeCompare(b.categoria)).map(r => `
            <tr>
              <td style="font-weight:500">${r.funcao}</td>
              <td>${r.categoria ? `<span class="adm-base-tag">${r.categoria}</span>` : `<span style="color:var(--text-muted);font-size:11px">Geral</span>`}</td>
              <td class="r">${r.qtd_por_voo}</td>
              <td style="font-size:11px;color:var(--text-secondary)">${{ambos:'Turnaround',saida:'Saída',chegada:'Chegada'}[r.referencia]||'Turnaround'}</td>
              <td class="r">${r.min_antes_chegada}</td>
              <td class="r">${r.min_depois_saida}</td>
              <td><span class="adm-status-dot ${r.ativo?'on':'off'}"></span><span style="font-size:11px">${r.ativo?'Ativo':'Inativo'}</span></td>
              <td style="white-space:nowrap">
                <button class="adm-btn-edit" onclick="adminParametrosEditar(${r.id})">Editar</button>
                <button class="adm-btn-edit" style="color:#fc8181" onclick="adminParametrosExcluir(${r.id})">Excluir</button>
              </td>
            </tr>`).join('') : `<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:24px">Nenhuma função configurada ${baseAtiva===''?'no padrão':'pra '+baseAtiva} ainda.</td></tr>`}
        </tbody>
      </table>
    </div>
  `;
}

function adminParametrosSetBase(base) {
  window._paramBaseAtiva = base;
  adminParametrosRenderList(document.getElementById('adm-tab-content'));
}

async function adminParametrosNovo() {
  if (!window.eoColabs?.size && typeof adhEnsureRoster === 'function') await adhEnsureRoster();
  adminParametrosAbrirModal(null);
}

async function adminParametrosEditar(id) {
  const row = (window._paramRows || []).find(r => r.id === id);
  if (!row) return;
  if (!window.eoColabs?.size && typeof adhEnsureRoster === 'function') await adhEnsureRoster();
  adminParametrosAbrirModal(row);
}

function escalaFuncoesDisponiveis() {
  const set = new Set();
  if (window.eoColabs) {
    for (const [, r] of window.eoColabs) {
      const f = String(r.funcao || '').trim();
      if (f) set.add(f);
    }
  }
  return [...set].sort();
}

function adminParametrosAbrirModal(row) {
  const baseAtiva = window._paramBaseAtiva ?? '';
  const overlay = document.createElement('div');
  overlay.className = 'adm-overlay';
  overlay.innerHTML = `
    <div class="adm-modal">
      <div class="adm-modal-header">
        <span>${row ? 'Editar função' : 'Adicionar função'} · ${baseAtiva || 'padrão'}</span>
        <button onclick="this.closest('.adm-overlay').remove()"><i class="ti ti-x" aria-hidden="true"></i></button>
      </div>
      <div class="adm-modal-body">
        <div class="adm-field"><label>Função</label>
          ${row ? `
            <input id="param-funcao" class="adm-input" value="${row.funcao}" disabled style="opacity:.6">
          ` : `
            <select id="param-funcao-select" class="adm-input" onchange="adminParametrosToggleFuncaoManual(this)">
              <option value="">Selecione...</option>
              ${escalaFuncoesDisponiveis().map(f => `<option value="${f}">${f}</option>`).join('')}
              <option value="__outra__">+ Digitar manualmente (função ainda não cadastrada)</option>
            </select>
            <input id="param-funcao" class="adm-input" placeholder="Nome da função" style="display:none;margin-top:8px">
          `}
        </div>
        <div class="adm-field"><label>Categoria de aeronave</label>
          <select id="param-categoria" class="adm-input" ${row?'disabled style="opacity:.6"':''}>
            ${ESCALA_CATEGORIAS_OPCOES.map(([v,l]) => `<option value="${v}" ${(row?.categoria||'')===v?'selected':''}>${l}</option>`).join('')}
          </select>
        </div>
        <div class="adm-field"><label>Pessoas por voo</label>
          <input id="param-qtd" type="number" min="0" step="0.5" class="adm-input" value="${row?.qtd_por_voo ?? 1}"></div>
        <div class="adm-field"><label>Referência de horário</label>
          <select id="param-referencia" class="adm-input">
            <option value="ambos"   ${(row?.referencia||'ambos')==='ambos'?'selected':''}>Turnaround completo (chegada até saída) — ex: Rampa</option>
            <option value="saida"   ${row?.referencia==='saida'?'selected':''}>Só em relação à saída — ex: Triagem</option>
            <option value="chegada" ${row?.referencia==='chegada'?'selected':''}>Só em relação à chegada — ex: Desembarque</option>
          </select>
        </div>
        <div class="adm-field"><label>Minutos antes da referência</label>
          <input id="param-antes" type="number" min="0" class="adm-input" value="${row?.min_antes_chegada ?? 15}"></div>
        <div class="adm-field"><label>Minutos depois da referência</label>
          <input id="param-depois" type="number" min="0" class="adm-input" value="${row?.min_depois_saida ?? 15}"></div>
        <div class="adm-field" style="flex-direction:row;align-items:center;gap:10px">
          <label style="margin:0">Ativo</label>
          <input type="checkbox" id="param-ativo" ${row?.ativo!==false?'checked':''} style="width:16px;height:16px;accent-color:#00a0d2">
        </div>
      </div>
      <div class="adm-modal-footer">
        <button class="adm-btn-sec" onclick="this.closest('.adm-overlay').remove()">Cancelar</button>
        <button class="adm-btn-primary" onclick="adminParametrosSalvar(${row?.id ?? 'null'})">Salvar</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
}

function adminParametrosToggleFuncaoManual(select) {
  const manual = document.getElementById('param-funcao');
  if (!manual) return;
  if (select.value === '__outra__') {
    manual.style.display = 'block';
    manual.value = '';
    manual.focus();
  } else {
    manual.style.display = 'none';
    manual.value = select.value;
  }
}

async function adminParametrosSalvar(id) {
  const base      = window._paramBaseAtiva ?? '';
  const funcao    = document.getElementById('param-funcao').value.trim();
  const categoria = document.getElementById('param-categoria').value;
  const qtd       = parseFloat(document.getElementById('param-qtd').value) || 0;
  const referencia= document.getElementById('param-referencia').value;
  const antes     = parseInt(document.getElementById('param-antes').value) || 0;
  const depois    = parseInt(document.getElementById('param-depois').value) || 0;
  const ativo     = document.getElementById('param-ativo').checked;
  if (!funcao) { alert('Preencha a função.'); return; }

  const payload = {
    base, funcao, categoria, qtd_por_voo: qtd, referencia,
    min_antes_chegada: antes, min_depois_saida: depois, ativo,
    updated_at: new Date(), updated_by: currentUserProfile?.id || currentUser?.id || null,
  };

  const { error } = id
    ? await db.from('escala_parametro_solo').update(payload).eq('id', id)
    : await db.from('escala_parametro_solo').upsert(payload, { onConflict: 'base,funcao,categoria' });

  if (error) { alert('Erro ao salvar: ' + error.message); return; }
  document.querySelector('.adm-overlay')?.remove();
  adminParametrosTab(document.getElementById('adm-tab-content'));
}

async function adminParametrosExcluir(id) {
  if (!confirm('Remover esse parâmetro de solo? A demanda calculada vai parar de considerar essa função.')) return;
  const { error } = await db.from('escala_parametro_solo').delete().eq('id', id);
  if (error) { alert('Erro: ' + error.message); return; }
  adminParametrosTab(document.getElementById('adm-tab-content'));
}

async function adminMalhaTab(el) {
  el.innerHTML = `
    <div class="adm-section-header"><span>Malha aérea</span></div>
    <div class="adm-empty-state">
      <i class="ti ti-loader-2" style="font-size:32px;opacity:.4;animation:spin 1s linear infinite" aria-hidden="true"></i>
      <p>Verificando dados...</p>
    </div>`;

  if (!adminFiles.malha) {
    el.innerHTML = `
      <div class="adm-section-header"><span>Malha aérea</span></div>
      <div class="adm-empty-state">
        <i class="ti ti-plane-off" style="font-size:32px;opacity:.2" aria-hidden="true"></i>
        <p>Carregue o arquivo <strong>Malha aérea</strong> (RVPE127_*.CSV) na aba Arquivos. Dá pra subir os meses que quiser de uma vez, tanto pelo card quanto pelo upload em lote.</p>
        <button class="adm-btn-primary" onclick="adminTabSwitch('files', document.querySelectorAll('.adm-tab-btn')[1])">
          Ir para Arquivos
        </button>
      </div>`;
    return;
  }

  el.innerHTML = `
    <div class="adm-section-header"><span>Malha aérea</span></div>
    ${adminProgressHTML('adm-malha-progress', 'Carregando voos...')}`;

  await adminLoadFileOnDemand('malha', (loaded, total) =>
    adminUpdateProgress('adm-malha-progress', loaded, total, 'Carregando voos...'));

  if (!window.malhaRows?.length) {
    el.innerHTML = `
      <div class="adm-section-header"><span>Malha aérea</span></div>
      <div class="adm-empty-state"><p>Não foi possível carregar os dados da malha.</p></div>`;
    return;
  }

  const bases = malhaBasesDisponiveis();
  if (window._malhaBase === undefined) window._malhaBase = bases[0] || null;
  const meses = malhaMesesDisponiveis(window._malhaBase);
  if (!window._malhaMes1 || !meses.includes(window._malhaMes1)) window._malhaMes1 = meses[meses.length-2] || meses[0] || null;
  if (!window._malhaMes2 || !meses.includes(window._malhaMes2)) window._malhaMes2 = meses[meses.length-1] || null;
  window._malhaCliente = null;
  window._malhaSlotSelecionado = null;
  window._malhaSemana = null;

  adminMalhaRenderDash(el);
}

// ══════════════════════════════════════════════════════
// TAB: LOG
// ══════════════════════════════════════════════════════
function adminLogsTab(logs, page) {
  const ACTION = {
    login: 'Login', logout: 'Logout',
    view_escala:'Ver escala', edit_escala:'Editar escala', publish_escala:'Publicar escala',
  };

  const PAGE_SIZE = 20;
  const capped = logs.slice(0, 100); // limite máximo de 100 registros no total
  const totalPages = Math.max(1, Math.ceil(capped.length / PAGE_SIZE));
  page = Math.min(Math.max(1, page || 1), totalPages);
  const start = (page - 1) * PAGE_SIZE;
  const pageLogs = capped.slice(start, start + PAGE_SIZE);

  let pageBtns = '';
  for (let p = 1; p <= totalPages; p++) {
    pageBtns += `<button class="adm-page-btn ${p===page?'active':''}" onclick="adminGoToLogPage(${p})">${p}</button>`;
  }

  return `
    <div class="adm-section-header"><span>${capped.length} registros recentes${capped.length>=100?' (máx. 100)':''}</span></div>
    <div class="adm-table-wrap">
      <table class="adm-table">
        <thead><tr><th>Data / Hora</th><th>Email</th><th>Base</th><th>Ação</th></tr></thead>
        <tbody>
          ${pageLogs.map(l=>`
            <tr>
              <td style="font-size:11px;color:var(--text-muted)">${new Date(l.created_at).toLocaleString('pt-BR')}</td>
              <td>${l.email||'—'}</td>
              <td>${l.base?`<span class="adm-base-tag">${l.base}</span>`:'—'}</td>
              <td style="font-size:11px">${ACTION[l.action]||l.action}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>
    ${totalPages > 1 ? `
    <div class="adm-pagination">
      <span class="adm-page-info">Página ${page} de ${totalPages}</span>
      <div class="adm-page-btns">${pageBtns}</div>
    </div>` : ''}`;
}

function adminGoToLogPage(page) {
  const el = document.getElementById('adm-tab-content');
  if (!el) return;
  el.innerHTML = adminLogsTab(window._adminData?.logs || [], page);
}

// ══════════════════════════════════════════════════════
// EDIT USER MODAL
// ══════════════════════════════════════════════════════
async function adminEditUser(userId) {
  const { data: u } = await db.from('profiles').select('*').eq('id', userId).single();
  if (!u) return;
  if (!window.eoColabs?.size && typeof adhEnsureRoster === 'function') {
    await adhEnsureRoster();
  }

  const overlay = document.createElement('div');
  overlay.className = 'adm-overlay';
  overlay.innerHTML = `
    <div class="adm-modal">
      <div class="adm-modal-header">
        <span>Editar usuário</span>
        <button onclick="this.closest('.adm-overlay').remove()">
          <i class="ti ti-x" aria-hidden="true"></i>
        </button>
      </div>
      <div class="adm-modal-body">
        <div class="adm-field"><label>Nome</label>
          <input id="edit-nome" class="adm-input" value="${u.nome||''}"></div>
        <div class="adm-field"><label>Email</label>
          <input class="adm-input" value="${u.email}" disabled style="opacity:.5"></div>
        <div class="adm-field"><label>Perfil de acesso</label>
          <select id="edit-role" class="adm-input" onchange="adminSyncBaseAllVisibility(this)">
            <option value="admin"       ${u.role==='admin'       ?'selected':''}>Admin Master</option>
            <option value="gerente"     ${u.role==='gerente'     ?'selected':''}>Gerente</option>
            <option value="coordenador" ${u.role==='coordenador' ?'selected':''}>Coordenador</option>
            <option value="supervisor"  ${u.role==='supervisor'  ?'selected':''}>Supervisor</option>
            <option value="lideranca"   ${u.role==='lideranca'   ?'selected':''}>Liderança</option>
            <option value="operador"    ${u.role==='operador'    ?'selected':''}>Operador (padrão)</option>
          </select>
        </div>
        <div class="adm-field"><label>Bases autorizadas</label>
          <div class="adm-bases-picker">
            <label class="adm-base-chk" id="edit-base-all-wrap" style="color:#ef4444;font-weight:600;${u.role==='admin'?'':'display:none'}">
              <input type="checkbox" id="edit-base-all" ${u.bases?.includes('*')?'checked':''}
                onchange="adminToggleAllBases(this)"> Todas as bases
            </label>
            <div class="adm-bases-grid" id="edit-bases-grid">
              ${adminAllBases().map(b=>`
                <label class="adm-base-chk">
                  <input type="checkbox" name="edit-base" value="${b}"
                    ${u.bases?.includes('*')||u.bases?.includes(b)?'checked':''}
                    ${u.bases?.includes('*')?'disabled':''}>
                  ${b}
                </label>`).join('')}
            </div>
          </div>
        </div>
        <div class="adm-field" style="flex-direction:row;align-items:center;gap:10px">
          <label style="margin:0">Usuário ativo</label>
          <input type="checkbox" id="edit-ativo" ${u.ativo?'checked':''} style="width:16px;height:16px;accent-color:#00a0d2">
        </div>
      </div>
      <div class="adm-modal-footer">
        <button class="adm-btn-sec" onclick="this.closest('.adm-overlay').remove()">Cancelar</button>
        <button class="adm-btn-primary" onclick="adminSaveUser('${userId}')">Salvar</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
}

function adminToggleAllBases(chk) {
  const grid = document.getElementById('edit-bases-grid');
  grid.querySelectorAll('input').forEach(c => { c.checked=chk.checked; c.disabled=chk.checked; });
}

function adminSyncBaseAllVisibility(roleSelect) {
  const wrap = document.getElementById('edit-base-all-wrap');
  const chk  = document.getElementById('edit-base-all');
  if (!wrap || !chk) return;
  if (roleSelect.value === 'admin') {
    wrap.style.display = '';
  } else {
    wrap.style.display = 'none';
    if (chk.checked) { chk.checked = false; adminToggleAllBases(chk); }
  }
}

async function adminSaveUser(userId) {
  const nome  = document.getElementById('edit-nome').value.trim();
  const role  = document.getElementById('edit-role').value;
  const ativo = document.getElementById('edit-ativo').checked;
  const allBases = role === 'admin' && document.getElementById('edit-base-all').checked;
  const bases = allBases
    ? ['*']
    : [...document.querySelectorAll('input[name="edit-base"]:checked')].map(c=>c.value);

  const { error } = await db.from('profiles').update({ nome, role, bases, ativo, updated_at: new Date() }).eq('id', userId);
  if (error) { alert('Erro: '+error.message); return; }
  document.querySelector('.adm-overlay')?.remove();
  adminRender();
}

// ══════════════════════════════════════════════════════
// PRÉ-CONFIGURAÇÃO DE ACESSO (por e-mail, antes do cadastro)
// ══════════════════════════════════════════════════════
async function adminNewPreconfig() {
  if (!window.eoColabs?.size && typeof adhEnsureRoster === 'function') {
    await adhEnsureRoster();
  }
  adminPreconfigModal(null);
}

async function adminEditPreconfig(id) {
  const { data: p } = await db.from('usuarios_preconfigurados').select('*').eq('id', id).single();
  if (!p) return;
  if (!window.eoColabs?.size && typeof adhEnsureRoster === 'function') {
    await adhEnsureRoster();
  }
  adminPreconfigModal(p);
}

function adminPreconfigModal(p) {
  const isEdit = !!p;
  const overlay = document.createElement('div');
  overlay.className = 'adm-overlay';
  overlay.innerHTML = `
    <div class="adm-modal">
      <div class="adm-modal-header">
        <span>${isEdit ? 'Editar pré-configuração' : 'Pré-configurar acesso'}</span>
        <button onclick="this.closest('.adm-overlay').remove()">
          <i class="ti ti-x" aria-hidden="true"></i>
        </button>
      </div>
      <div class="adm-modal-body">
        <p style="font-size:11px;color:var(--text-muted);margin:-4px 0 4px">
          Cadastre o e-mail com o perfil e as bases certas antes da pessoa criar a conta —
          quando ela se cadastrar com esse e-mail, tudo já entra configurado automaticamente.
        </p>
        <div class="adm-field"><label>Email</label>
          <input id="pre-email" class="adm-input" type="email" placeholder="nome@dnata.com.br"
            value="${p?.email||''}" ${isEdit?'disabled style="opacity:.5"':''}></div>
        <div class="adm-field"><label>Nome (opcional)</label>
          <input id="pre-nome" class="adm-input" placeholder="Ex: João Silva" value="${p?.nome||''}"></div>
        <div class="adm-field"><label>Perfil de acesso</label>
          <select id="pre-role" class="adm-input" onchange="adminSyncBaseAllVisibility(this)">
            <option value="admin"       ${p?.role==='admin'       ?'selected':''}>Admin Master</option>
            <option value="gerente"     ${!p||p?.role==='gerente' ?'selected':''}>Gerente</option>
            <option value="coordenador" ${p?.role==='coordenador' ?'selected':''}>Coordenador</option>
            <option value="supervisor"  ${p?.role==='supervisor'  ?'selected':''}>Supervisor</option>
            <option value="lideranca"   ${p?.role==='lideranca'   ?'selected':''}>Liderança</option>
            <option value="operador"    ${p?.role==='operador'    ?'selected':''}>Operador</option>
          </select>
        </div>
        <div class="adm-field"><label>Bases autorizadas</label>
          <div class="adm-bases-picker">
            <label class="adm-base-chk" id="edit-base-all-wrap" style="color:#ef4444;font-weight:600;${p?.role==='admin'?'':'display:none'}">
              <input type="checkbox" id="edit-base-all" ${p?.bases?.includes('*')?'checked':''}
                onchange="adminToggleAllBases(this)"> Todas as bases
            </label>
            <div class="adm-bases-grid" id="edit-bases-grid">
              ${adminAllBases().map(b=>`
                <label class="adm-base-chk">
                  <input type="checkbox" name="edit-base" value="${b}"
                    ${p?.bases?.includes('*')||p?.bases?.includes(b)?'checked':''}
                    ${p?.bases?.includes('*')?'disabled':''}>
                  ${b}
                </label>`).join('')}
            </div>
          </div>
        </div>
      </div>
      <div class="adm-modal-footer">
        <button class="adm-btn-sec" onclick="this.closest('.adm-overlay').remove()">Cancelar</button>
        <button class="adm-btn-primary" onclick="adminSavePreconfig(${p?.id||'null'})">Salvar</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
}

async function adminSavePreconfig(id) {
  const email = document.getElementById('pre-email').value.trim().toLowerCase();
  const nome  = document.getElementById('pre-nome').value.trim();
  const role  = document.getElementById('pre-role').value;
  const allBases = role === 'admin' && document.getElementById('edit-base-all').checked;
  const bases = allBases
    ? ['*']
    : [...document.querySelectorAll('input[name="edit-base"]:checked')].map(c=>c.value);

  if (!email || !email.endsWith('@dnata.com.br')) {
    alert('Informe um email @dnata.com.br válido.');
    return;
  }

  const payload = { email, nome, role, bases, updated_at: new Date() };
  const { error } = id
    ? await db.from('usuarios_preconfigurados').update(payload).eq('id', id)
    : await db.from('usuarios_preconfigurados').insert(payload);

  if (error) {
    alert(error.message.includes('duplicate') || error.message.includes('unique')
      ? 'Esse email já está pré-configurado. Edite o registro existente na lista.'
      : 'Erro: ' + error.message);
    return;
  }
  document.querySelector('.adm-overlay')?.remove();
  adminRender();
}

async function adminDeletePreconfig(id) {
  if (!confirm('Remover essa pré-configuração? A pessoa vai entrar com o perfil padrão (Operador, sem bases) se se cadastrar depois.')) return;
  const { error } = await db.from('usuarios_preconfigurados').delete().eq('id', id);
  if (error) { alert('Erro: '+error.message); return; }
  adminRender();
}

async function adminDeleteUser(userId, nome) {
  if (!confirm(`Excluir a conta de ${nome}?\n\nEssa ação é irreversível: a pessoa perde o acesso agora mesmo e o cadastro é apagado de vez.`)) return;
  const { error } = await db.rpc('admin_delete_user', { p_user_id: userId });
  if (error) { alert('Não foi possível excluir: ' + error.message); return; }
  adminRender();
}

// ══════════════════════════════════════════════════════
// AUTO-LOAD — Lightweight startup, heavy files on demand
// ══════════════════════════════════════════════════════

async function adminAutoLoadFiles() {
  try {
    // ── Última atualização — usado como selo em Staff e Aderência pra
    //    mostrar de quando é o dado que está sendo exibido. Pega o
    //    updated_at mais recente do cadastro (colaboradores), que é
    //    atualizado toda vez que alguém sobe uma planilha nova.
    try {
      const { data: lastUpd } = await db.from('colaboradores')
        .select('updated_at').order('updated_at', { ascending:false }).limit(1);
      window._lastDataUpdateAt = lastUpd?.[0]?.updated_at || null;
    } catch(e) { console.warn('[autoLoad] última atualização:', e.message); window._lastDataUpdateAt = null; }

    // ── Colaboradores from DB (all records via pagination) ──
    const { count: totalColabs } = await db.from('colaboradores')
      .select('*', { count:'exact', head:true }).eq('ativo', true);

    if (totalColabs > 0) {
      const allColabs = [];
      const PAGE = 1000;
      for (let from = 0; from < totalColabs; from += PAGE) {
        const { data: page } = await db.from('colaboradores')
          .select('matricula,nome,station,funcao,ch,situacao,admissao')
          .eq('ativo', true)
          .range(from, from + PAGE - 1);
        if (page) allColabs.push(...page);
      }
      adminFiles.colaboradores = {
        count: allColabs.length,
        bases: new Set(allColabs.map(r=>r.station)).size,
        date: 'banco',
        data: new Map(allColabs.map(r=>[r.matricula, r]))
      };
      window.eoColabs = adminFiles.colaboradores.data;
      console.log(`[autoLoad] ${allColabs.length} colaboradores`);
    }

    // ── Check counts for Horarios, Marcacao, Malha ────
    const [
      { count: cHor  },
      { count: cMar  },
      { count: cMal  },
    ] = await Promise.all([
      db.from('horarios').select('*', { count:'exact', head:true }),
      db.from('marcacao').select('*', { count:'exact', head:true }),
      db.from('malha'   ).select('*', { count:'exact', head:true }),
    ]);

    if (cHor > 0) {
      adminFiles.horarios = { count: cHor, date: 'banco', period: '' };
      console.log(`[autoLoad] horarios: ${cHor} registros no banco`);
    }
    if (cMar > 0) {
      adminFiles.marcacao = { count: cMar, date: 'banco', period: '' };
      console.log(`[autoLoad] marcacao: ${cMar} registros no banco`);
    }
    if (cMal > 0) {
      adminFiles.malha = { count: cMal, date: 'banco', period: '' };
      console.log(`[autoLoad] malha: ${cMal} registros no banco`);
    }

    // ── Férias, Desligamentos, PCD — podem passar de 1000 linhas com o
    //    histórico acumulado, então usamos dbFetchAll (pagina sozinho) ──
    const [feriasData, desligData, pcdData] = await Promise.all([
      dbFetchAll('colaboradores_ferias', 'matricula,data_inicio,data_fim,dias'),
      dbFetchAll('colaboradores_desligados', 'matricula,data_demissao,causa_texto'),
      dbFetchAll('colaboradores_pcd', 'matricula,deficiencia,base'),
    ]);

    if (feriasData.length) {
      // Mantém, por matrícula, o período de férias mais relevante (o que
      // termina mais tarde — cobre o caso de estar em férias agora).
      const byMat = new Map();
      for (const r of feriasData) {
        const prev = byMat.get(r.matricula);
        if (!prev || (r.data_fim||'') > (prev.data_fim||'')) byMat.set(r.matricula, r);
      }
      window.eoFerias = byMat;
      adminFiles.ferias = { count: feriasData.length, date: 'banco' };
      console.log(`[autoLoad] ferias: ${feriasData.length} registros no banco`);
    }

    if (desligData.length) {
      const byMat = new Map();
      for (const r of desligData) {
        const prev = byMat.get(r.matricula);
        if (!prev || (r.data_demissao||'') > (prev.data_demissao||'')) byMat.set(r.matricula, r);
      }
      window.eoDesligados = byMat;
      adminFiles.desligados = { count: desligData.length, date: 'banco' };
      console.log(`[autoLoad] desligados: ${desligData.length} registros no banco`);
    }

    if (pcdData.length) {
      window.eoPcd = new Map(pcdData.map(r => [r.matricula, r]));
      adminFiles.pcd = { count: pcdData.length, date: 'banco' };
      console.log(`[autoLoad] pcd: ${pcdRes.data.length} colaboradores no banco`);
    }

  } catch(err) {
    console.warn('[adminAutoLoadFiles]', err.message);
  }
}

// Prevents duplicate concurrent fetches of the same table (e.g. user clicking
// "Recalcular" while the tab's own loader is already fetching in the background)
const _adminLoadInFlight = {};

// Fetch every row of a table using parallel paginated requests, reporting
// progress as it goes. Cuts load time drastically vs one-page-at-a-time.
async function _adminFetchAllPaged(table, total, onProgress) {
  const PAGE = 1000, CONCURRENCY = 6;
  const starts = [];
  for (let from = 0; from < total; from += PAGE) starts.push(from);

  const out = [];
  let loaded = 0;
  for (let i = 0; i < starts.length; i += CONCURRENCY) {
    const chunk = starts.slice(i, i + CONCURRENCY);
    const results = await Promise.all(chunk.map(from =>
      db.from(table).select('*').range(from, from + PAGE - 1)
    ));
    for (const { data, error } of results) {
      if (error) throw new Error(error.message);
      if (data) { out.push(...data); loaded += data.length; }
    }
    if (onProgress) { try { onProgress(Math.min(loaded, total), total); } catch(_){} }
  }
  return out;
}

async function adminLoadFileOnDemand(folder, onProgress) {
  if (_adminLoadInFlight[folder]) return _adminLoadInFlight[folder];
  const p = _adminLoadFileOnDemandRun(folder, onProgress);
  _adminLoadInFlight[folder] = p;
  try {
    return await p;
  } finally {
    delete _adminLoadInFlight[folder];
  }
}

// ══════════════════════════════════════════════════════
// CACHE LOCAL (IndexedDB) — evita rebaixar Horários/Marcação (300k+ linhas)
// toda vez que a página recarrega. O painel só é atualizado ~2x/dia pelo
// Admin, então guardamos os dados brutos no navegador por algumas horas.
// ══════════════════════════════════════════════════════
const PONTO_DB_NAME = 'dnata_ponto_cache';
const PONTO_DB_TTL  = 8 * 60 * 60 * 1000; // 8 horas

function pontoDbOpen() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('IndexedDB indisponível')); return; }
    const req = indexedDB.open(PONTO_DB_NAME, 1);
    req.onupgradeneeded = () => {
      const idb = req.result;
      if (!idb.objectStoreNames.contains('raw')) idb.createObjectStore('raw', { keyPath: 'type' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

async function pontoDbSave(type, data) {
  try {
    const idb = await pontoDbOpen();
    await new Promise((resolve, reject) => {
      const tx = idb.transaction('raw', 'readwrite');
      tx.objectStore('raw').put({ type, data, cachedAt: Date.now() });
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  } catch(e) { console.warn('[pontoDb] save', type, e.message); }
}

async function pontoDbLoad(type) {
  try {
    const idb = await pontoDbOpen();
    return await new Promise((resolve, reject) => {
      const tx = idb.transaction('raw', 'readonly');
      const req = tx.objectStore('raw').get(type);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch(e) { console.warn('[pontoDb] load', type, e.message); return null; }
}

async function pontoDbClear() {
  try {
    const idb = await pontoDbOpen();
    await new Promise((resolve, reject) => {
      const tx = idb.transaction('raw', 'readwrite');
      tx.objectStore('raw').clear();
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  } catch(e) { console.warn('[pontoDb] clear', e.message); }
}

async function _adminLoadFileOnDemandRun(folder, onProgress) {
  // For DB-backed data: build in-memory Maps for aderencia engine
  if (folder === 'horarios') {
    if (typeof pontoHorarios !== 'undefined' && pontoHorarios.size > 0) return true;
    try {
      // Tenta o cache local (IndexedDB) primeiro — evita rebaixar 250k linhas
      // se já carregamos nas últimas horas.
      const cached = await pontoDbLoad('horarios');
      if (cached?.data?.length && (Date.now() - cached.cachedAt) < PONTO_DB_TTL) {
        pontoHorarios = new Map();
        cached.data.forEach(r => {
          const [y,m,d] = r.data.split('-');
          const dstr = `${d}/${m}/${y}`;
          const mat = String(r.matricula).padStart(6,'0');
          const key = `${r.filial}|${mat}|${dstr}`;
          pontoHorarios.set(key, { filial:r.filial, mat, nome:r.nome,
            ent1:r.ent1, sai1:r.sai1, ent2:r.ent2, sai2:r.sai2, date:dstr });
        });
        adminFiles.horarios = { count: cached.data.length, date: 'cache local' };
        adhBaseKPI = null; adhColabKPI = null;
        console.log(`[onDemand] horarios: ${pontoHorarios.size} keys (cache local, sem baixar do banco)`);
        if (pontoMarcacao?.size > 0) adminPrecomputeAderencia().catch(console.warn);
        return true;
      }

      console.log('[onDemand] Loading horarios from DB...');
      const { count: horCount } = await db.from('horarios').select('*', { count:'exact', head:true });
      if (!horCount) return false;
      const data = await _adminFetchAllPaged('horarios', horCount, onProgress);
      if (!data.length) return false;
      pontoHorarios = new Map();
      data.forEach(r => {
        // Convert ISO date (2026-06-01) to dd/mm/yyyy for key consistency
        const [y,m,d] = r.data.split('-');
        const dstr = `${d}/${m}/${y}`;
        const mat = String(r.matricula).padStart(6,'0');
        const key = `${r.filial}|${mat}|${dstr}`;
        pontoHorarios.set(key, { filial:r.filial, mat, nome:r.nome,
          ent1:r.ent1, sai1:r.sai1, ent2:r.ent2, sai2:r.sai2, date:dstr });
      });
      adminFiles.horarios = { count: data.length, date: 'banco' };
      adhBaseKPI = null; adhColabKPI = null;
      console.log(`[onDemand] horarios: ${pontoHorarios.size} keys`);
      pontoDbSave('horarios', data); // guarda pra próxima vez
      // Trigger precompute if marcacao also loaded
      if (pontoMarcacao?.size > 0) adminPrecomputeAderencia().catch(console.warn);
      return true;
    } catch(e) { console.error('[onDemand] horarios:', e.message); return false; }
  }

  if (folder === 'marcacao') {
    if (typeof pontoMarcacao !== 'undefined' && pontoMarcacao.size > 0) return true;
    try {
      const cached = await pontoDbLoad('marcacao');
      if (cached?.data?.length && (Date.now() - cached.cachedAt) < PONTO_DB_TTL) {
        pontoMarcacao = new Map();
        cached.data.forEach(r => {
          const [y,m,d] = r.data.split('-');
          const dstr = `${d}/${m}/${y}`;
          const mat = String(r.matricula).padStart(6,'0');
          const key = `${r.filial}|${mat}|${dstr}`;
          pontoMarcacao.set(key, { filial:r.filial, mat, nome:r.nome,
            bat1:r.bat1, bat2:r.bat2, bat3:r.bat3, bat4:r.bat4,
            bat5:r.bat5, bat6:r.bat6, bat7:r.bat7, bat8:r.bat8 });
        });
        if (typeof adhSplitOvernightMarcacao === 'function') adhSplitOvernightMarcacao(pontoMarcacao);
        adminFiles.marcacao = { count: cached.data.length, date: 'cache local' };
        adhBaseKPI = null; adhColabKPI = null;
        console.log(`[onDemand] marcacao: ${pontoMarcacao.size} keys (cache local, sem baixar do banco)`);
        return true;
      }

      console.log('[onDemand] Loading marcacao from DB...');
      const { count: marCount } = await db.from('marcacao').select('*', { count:'exact', head:true });
      if (!marCount) return false;
      const data = await _adminFetchAllPaged('marcacao', marCount, onProgress);
      if (!data.length) return false;
      pontoMarcacao = new Map();
      data.forEach(r => {
        const [y,m,d] = r.data.split('-');
        const dstr = `${d}/${m}/${y}`;
        const mat = String(r.matricula).padStart(6,'0');
        const key = `${r.filial}|${mat}|${dstr}`;
        pontoMarcacao.set(key, { filial:r.filial, mat, nome:r.nome,
          bat1:r.bat1, bat2:r.bat2, bat3:r.bat3, bat4:r.bat4,
          bat5:r.bat5, bat6:r.bat6, bat7:r.bat7, bat8:r.bat8 });
      });
      if (typeof adhSplitOvernightMarcacao === 'function') adhSplitOvernightMarcacao(pontoMarcacao);
      adminFiles.marcacao = { count: data.length, date: 'banco' };
      adhBaseKPI = null; adhColabKPI = null; // force recompute
      console.log(`[onDemand] marcacao: ${pontoMarcacao.size} keys`);
      pontoDbSave('marcacao', data); // guarda pra próxima vez
      return true;
    } catch(e) { console.error('[onDemand] marcacao:', e.message); return false; }
  }

  if (folder === 'malha') {
    if (window.malhaRows?.length) return true;
    try {
      const { count } = await db.from('malha').select('*', { count:'exact', head:true });
      if (!count) return false;
      const data = await _adminFetchAllPaged('malha', count, onProgress);
      if (!data.length) return false;
      window.malhaRows = data; // histórico completo, granular — usado no dashboard de comparação
      malhaVoos = new Map();
      data.forEach(r => {
        if (!malhaVoos.has(r.base)) malhaVoos.set(r.base, new Map());
        const dm = malhaVoos.get(r.base);
        dm.set(r.data, (dm.get(r.data)||0) + 1);
      });
      adminFiles.malha = { count: data.length, date: 'banco' };
      console.log(`[onDemand] malha: ${data.length} voos em ${malhaVoos.size} bases`);
      return true;
    } catch(e) { console.error('[onDemand] malha:', e.message); return false; }
  }

  return false;
}

// ══════════════════════════════════════════════════════
// PRÉ-CÁLCULO DE ADERÊNCIA — roda após upload de arquivos
// Salva resultado no banco + invalida localStorage cache
// ══════════════════════════════════════════════════════
// mes: 'YYYY-MM' — por padrão, o mês corrente real (hoje). Passe um mês
// anterior explicitamente para recalcular/gravar esse mês específico.
async function adminPrecomputeAderencia(mes) {
  if (!pontoHorarios?.size || !pontoMarcacao?.size) {
    console.warn('[precompute] horarios ou marcacao não carregados');
    return;
  }

  if (!mes) {
    const now = new Date();
    mes = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  }

  // "DD/MM/YYYY" → "YYYY-MM"
  function adminMesDaData(dstr) {
    const p = String(dstr||'').split('/');
    if (p.length !== 3) return null;
    return `${p[2]}-${p[1]}`;
  }

  // D-1: só considera dias até ONTEM (exclui hoje) — igual o cálculo em
  // tempo real (aderencia.js), pra não desalinhar o valor pré-computado.
  function adminDataAteOntem(dstr) {
    const p = String(dstr||'').split('/');
    if (p.length !== 3) return true;
    const d = new Date(parseInt(p[2],10), parseInt(p[1],10)-1, parseInt(p[0],10));
    const hoje = new Date(); hoje.setHours(0,0,0,0);
    return d < hoje;
  }

  // Precisamos do cadastro completo (cargo de cada matrícula) para aplicar a
  // isenção de ponto de Gerentes/Coordenadores — garante que já carregou.
  if (!window.eoColabs?.size && typeof adhEnsureRoster === 'function') {
    await adhEnsureRoster();
  }

  // Garante que os desligados também estejam carregados (usados para
  // excluir essas matrículas do cálculo de aderência).
  if (!window.eoDesligados) {
    try {
      const data = await dbFetchAll('colaboradores_desligados', 'matricula,data_demissao,causa_texto');
      if (data?.length) {
        const byMat = new Map();
        for (const r of data) {
          const prev = byMat.get(r.matricula);
          if (!prev || (r.data_demissao||'') > (prev.data_demissao||'')) byMat.set(r.matricula, r);
        }
        window.eoDesligados = byMat;
      } else {
        window.eoDesligados = new Map();
      }
    } catch(e) { console.warn('[precompute] desligados:', e.message); }
  }

  console.log(`[precompute] Calculando KPI de aderência para ${mes}...`);
  const ADH_EXCL = new Set(['HQ2','SEDE','GSE']);

  const tmc = t => { if(!t)return 0; const p=String(t).split(':'); return parseInt(p[0])*60+parseInt(p[1]||0); };
  const dfc = (a,b) => { if(!a||!b)return 0; const d=tmc(b)-tmc(a); return d<0?d+1440:d; };

  // Index horarios by "FILIAL|mat|data" (uppercase filial) so we can look up
  // "what was planned that specific day" while iterating marcação.
  const horByKey = new Map();
  for (const [key, h] of pontoHorarios) {
    const [filialRaw, mat, data] = key.split('|');
    if (adminMesDaData(data) !== mes || !adminDataAteOntem(data)) continue; // fora do mês alvo ou é hoje/futuro (D-1)
    horByKey.set(`${(filialRaw||'').toUpperCase()}|${mat}|${data}`, h);
  }

  // The aderência ratio is driven PURELY by marcação rows — matching the
  // official Excel calculation (validated against it directly). A day
  // scheduled in Horários with NO row at all in Marcação (a very common
  // case — ~45% of scheduled days system-wide) does not count toward either
  // side of the ratio, exactly like the Excel formula treats it.
  const colabAcc = new Map(); // "FILIAL|mat" → accum
  for (const [key, m] of pontoMarcacao) {
    const [filialRaw, mat, data] = key.split('|');
    if (adminMesDaData(data) !== mes || !adminDataAteOntem(data)) continue; // fora do mês alvo ou é hoje/futuro (D-1)
    const filial = (filialRaw||'').toUpperCase();
    if (ADH_EXCL.has(filial)) continue;

    const nk = `${filial}|${mat}|${data}`;
    const h = horByKey.get(nk);
    const minP = h ? (dfc(h.ent1,h.sai1) + (h.ent2 && h.sai2 ? dfc(h.ent2,h.sai2) : 0)) : 0;
    // Marcação frequentemente perde a primeira batida do dia (comum em entradas
    // de madrugada, ~1.2% das linhas — bug de exportação, não falta real).
    // Se planejado começa às 00:00 e existe qualquer outra batida naquele
    // dia (prova de presença), recupera a entrada usando o planejado.
    const temOutraBatida = m.bat2||m.bat3||m.bat4||m.bat5||m.bat6||m.bat7||m.bat8;
    const bat1 = (!m.bat1 && h?.ent1 && temOutraBatida) ? h.ent1 : m.bat1;
    let minT = 0;
    [[bat1,m.bat2],[m.bat3,m.bat4],[m.bat5,m.bat6],[m.bat7,m.bat8]]
      .forEach(([a,b]) => { minT += dfc(a,b); });

    const ck = `${filial}|${mat}`;
    if (!colabAcc.has(ck)) {
      colabAcc.set(ck, { filial, mat, nome: h?.nome || m.nome || '', mp:0, mt:0, desvio:0, he:0, falta:0 });
    }
    const acc = colabAcc.get(ck);
    acc.mp     += minP;
    acc.mt     += minT;
    acc.desvio += Math.abs(minT - minP);
    acc.he     += Math.max(0, minT - minP);
    acc.falta  += Math.max(0, minP - minT);
  }

  // Desligados (HRCL106) saem do cálculo por completo — continuam aparecendo
  // na lista com o badge "Desligado", mas não entram na aderência nem contam
  // como isenção de gestão (evita "falsas faltas" de gente que já saiu).
  if (window.eoDesligados?.size) {
    for (const ck of [...colabAcc.keys()]) {
      const mat = ck.split('|')[1];
      if (window.eoDesligados.has(mat)) colabAcc.delete(ck);
    }
  }

  // Cargos isentos de bater ponto (Gerentes e Coordenadores) — não entram no
  // cálculo acima porque não têm marcação, mas mostramos explicitamente como
  // 100% na lista (em vez de simplesmente sumir), já que estruturalmente não
  // batem ponto. Não afeta a média da base (só quem tem marcação entra nela).
  function adminCargoIsento(funcao) {
    const f = String(funcao || '').toUpperCase();
    return f.includes('GERENTE') || f.includes('COORDENADOR');
  }
  const totalMpByPerson = new Map(); // "FILIAL|mat" → { mp, nome }
  for (const [key, h] of pontoHorarios) {
    const filial = (h.filial||'').toUpperCase();
    if (ADH_EXCL.has(filial)) continue;
    const [, , data] = key.split('|');
    if (adminMesDaData(data) !== mes || !adminDataAteOntem(data)) continue; // fora do mês alvo ou é hoje/futuro (D-1)
    const ck = `${filial}|${h.mat}`;
    const minP = dfc(h.ent1,h.sai1) + (h.ent2 && h.sai2 ? dfc(h.ent2,h.sai2) : 0);
    if (!totalMpByPerson.has(ck)) totalMpByPerson.set(ck, { mp: 0, nome: h.nome || '' });
    totalMpByPerson.get(ck).mp += minP;
  }
  for (const [ck, t] of totalMpByPerson) {
    if (colabAcc.has(ck) || t.mp <= 0) continue; // já tem marcação real, ou nada programado
    const [filial, mat] = ck.split('|');
    if (window.eoDesligados?.has(mat)) continue; // desligado — fora do cálculo
    if (!adminCargoIsento(window.eoColabs?.get(mat)?.funcao)) continue; // só isenta gestão
    colabAcc.set(ck, { filial, mat, nome: t.nome, mp: t.mp, mt: 0, desvio: 0, he: 0, falta: 0, isento: true });
  }

  // Build per-colaborador rows + aggregate per base (BUGFIX: baseAcc/colabRows
  // were referenced below without ever being built, so this function threw a
  // ReferenceError on every run and no data was ever persisted to the DB).
  const colabRows = [];
  const baseAcc   = new Map(); // filial → { mp, desvio, he, falta, colabs }

  for (const [ck, acc] of colabAcc) {
    // Only skip if there's truly nothing at all (no planned schedule AND no
    // punches). People with marcação but no horarios (or vice-versa) still
    // get a row — we just can't compute a % without a planned baseline.
    if (!acc.mp && !acc.mt) continue;

    const funcao = window.eoColabs?.get(acc.mat)?.funcao;
    if (acc.mp > 0 && acc.mt === 0 && adminCargoIsento(funcao)) {
      acc.desvio = 0; acc.he = 0; acc.falta = 0;
    }

    const pct = acc.mp > 0
      ? Math.max(0, Math.round((100 - acc.desvio / acc.mp * 100) * 10) / 10)
      : null; // no horarios entry → nothing to compare marcação against
    colabRows.push({
      filial:   acc.filial,
      matricula:acc.mat,
      nome:     acc.nome,
      mes,
      min_prog: acc.mp,
      min_trab: acc.mt,
      desvio:   acc.desvio,
      he:       acc.he,
      falta:    acc.falta,
      pct,
      he_h:     Math.round(acc.he    / 60 * 10) / 10,
      falta_h:  Math.round(acc.falta / 60 * 10) / 10,
      updated_at: new Date(),
    });

    // Base-level totals only count colaboradores who actually had a planned
    // schedule AND real marcação data — exempted management (isento, no
    // marcação at all) shows 100% in the list but doesn't skew the base's
    // % aderência, matching the official Excel calculation exactly.
    if (acc.mp > 0 && !acc.isento) {
      if (!baseAcc.has(acc.filial)) {
        baseAcc.set(acc.filial, { mp: 0, desvio: 0, he: 0, falta: 0, colabs: 0 });
      }
      const b = baseAcc.get(acc.filial);
      b.mp     += acc.mp;
      b.desvio += acc.desvio;
      b.he     += acc.he;
      b.falta  += acc.falta;
      b.colabs += 1;
    }
  }

  // Build base rows
  const baseRows = [];
  for (const [filial, b] of baseAcc) {
    if (!b.mp) continue;
    const pct = Math.max(0, Math.round((100-b.desvio/b.mp*100)*10)/10);
    baseRows.push({
      filial, mes, min_prog:b.mp, desvio:b.desvio, he:b.he, falta:b.falta, colabs:b.colabs,
      pct, he_h:Math.round(b.he/60*10)/10, falta_h:Math.round(b.falta/60*10)/10,
      prog_h:Math.round(b.mp/60*10)/10, updated_at: new Date()
    });
  }

  console.log(`[precompute] ${baseRows.length} bases, ${colabRows.length} colaboradores (${mes})`);

  const errors = [];

  // Save base KPI to DB — keep going even if one batch fails, so a single
  // bad batch doesn't silently wipe out every base/colaborador after it.
  const BATCH = 500;
  for (let i=0; i<baseRows.length; i+=BATCH) {
    const { error } = await db.from('aderencia_kpi')
      .upsert(baseRows.slice(i,i+BATCH), { onConflict:'filial,mes' });
    if (error) { console.error('[precompute] base KPI error:', error.message); errors.push('base:'+error.message); }
  }

  // Save colab KPI to DB
  for (let i=0; i<colabRows.length; i+=BATCH) {
    const { error } = await db.from('aderencia_colab')
      .upsert(colabRows.slice(i,i+BATCH), { onConflict:'filial,matricula,mes' });
    if (error) { console.error('[precompute] colab KPI error:', error.message); errors.push('colab:'+error.message); }
  }

  if (errors.length) {
    console.warn(`[precompute] ${errors.length} lote(s) falharam ao salvar:`, errors);
  }

  // Invalidate localStorage cache — remove EVERY adh_kpi_cache/_ts key,
  // regardless of month suffix (adh_kpi_cache_2026-07 etc.), not just the
  // old bare names. Missing this was leaving stale per-month caches behind.
  try {
    const toRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith('adh_kpi_cache') || k.startsWith('adh_kpi_ts'))) toRemove.push(k);
    }
    toRemove.forEach(k => localStorage.removeItem(k));
  } catch(_){}

  console.log('[precompute] ✓ KPI salvo no banco e cache invalidado');
  return { baseCount: baseRows.length, colabCount: colabRows.length, errors, mes };
}
