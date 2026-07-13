// ══════════════════════════════════════════════════════
// ADMIN PANEL — Modelo 1
// Abas: Usuários | Arquivos | Aderência | Malha | Log
// ══════════════════════════════════════════════════════

const BASES_DISPONIVEIS = ['BEL','GRU','GIG','CGH','REC','FOR','SSA','CWB','POA','BSB','MAO','NAT','AJU','FLN','MCZ','SLZ','BVB','STM','JPA','CPV'];

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
  ] = await Promise.all([
    db.from('profiles').select('*').order('created_at', { ascending: false }),
    db.from('escalas').select('base,status,updated_at'),
    db.from('access_log').select('*').order('created_at', { ascending: false }).limit(100),
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
    <div class="adm-kpi-row">
      ${adminKpi('Usuários',         totalUsers,        '#00a0d2', 'ti-users')}
      ${adminKpi('Ativos',           ativos,            '#72c02c', 'ti-user-check')}
      ${adminKpi('Colaboradores',    adminFiles.colaboradores?.count || '—', '#a78bfa', 'ti-id-badge')}
      ${adminKpi('Arquivos carregados', filesOk+'/4',   filesOk===4?'#72c02c':'#f59e0b', 'ti-files')}
      ${adminKpi('Logins hoje',      loginsHoje,        '#f472b6', 'ti-login')}
    </div>

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
      <button class="adm-tab-btn" onclick="adminTabSwitch('logs',this)">
        <i class="ti ti-list" aria-hidden="true"></i> Log de acessos
      </button>
    </div>

    <div id="adm-tab-content"></div>
  `;

  window._adminData = { users: users||[], escalas: escalas||[], logs: logs||[] };
  adminTabSwitch('users', document.querySelector('.adm-tab-btn'));
}

// ── Tab switcher ──────────────────────────────────────
function adminTabSwitch(tab, btn) {
  document.querySelectorAll('.adm-tab-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  const { users, escalas, logs } = window._adminData || {};
  const el = document.getElementById('adm-tab-content');
  if (!el) return;
  switch(tab) {
    case 'users':    el.innerHTML = adminUsersTab(users||[]);   break;
    case 'files':    el.innerHTML = adminFilesTab();            break;
    case 'aderencia':adminAderenciaTab(el);                    break;
    case 'malha':    el.innerHTML = adminMalhaTab();            break;
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
function adminUsersTab(users) {
  return `
    <div class="adm-section-header">
      <span>${users.length} usuários cadastrados</span>
      <button class="adm-btn-primary" onclick="adminNewUser()">+ Novo usuário</button>
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
              <td><button class="adm-btn-edit" onclick="adminEditUser('${u.id}')">Editar</button></td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
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
      desc: 'RVPE127_*.CSV · voos por base',
      accept: '.csv,.CSV',
      fn: 'adminLoadMalha',
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
                <input type="file" accept="${f.accept}" style="display:none"
                  onchange="${f.fn}(this)">
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
        const hmês    = String(row[4]||'').trim();
        const situacao= String(row[10]||'').trim();
        const funcao  = String(row[12]||'').trim();
        const ch      = parseInt(hmês) || 0;
        if (station) basesSet.add(station);
        records.push({ matricula: mat, nome, station, funcao, ch, situacao, ativo: true, updated_at: new Date() });
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
        const filial        = String(row[3]||'').trim().toUpperCase();
        const data_admissao = adminXlsToISODate(row[4]);
        const data_demissao = adminXlsToISODate(row[5]);
        const cargo         = String(row[6]||'').trim();
        const causa_codigo  = String(row[7]||'').trim();
        const causa_texto   = String(row[8]||'').trim();
        if (!data_demissao) return;
        records.push({ matricula: mat, nome, filial, cargo, data_admissao, data_demissao, causa_codigo, causa_texto, updated_at: new Date() });
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
          cia:parts[9]?.trim()||null,aeronave:parts[10]?.trim()||null,updated_at:new Date()});
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

    ${stats ? `
    <div class="adm-kpi-row" style="margin-bottom:0">
      ${adminKpi('Aderência geral', stats.adherencePct+'%', pctColor(stats.adherencePct), 'ti-chart-bar')}
      ${adminKpi('No horário',      stats.ok,               '#72c02c',  'ti-check')}
      ${adminKpi('Atrasos',         stats.atraso+stats.desvio, '#f59e0b','ti-clock-exclamation')}
      ${adminKpi('Saída antecipada',stats.saida_antecipada, '#f59e0b',  'ti-clock-minus')}
      ${adminKpi('Faltas',          stats.falta,            '#ef4444',  'ti-x')}
    </div>` : ''}

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
function adminMalhaTab() {
  if (!adminFiles.malha) {
    return `
      <div class="adm-section-header"><span>Malha aérea</span></div>
      <div class="adm-empty-state">
        <i class="ti ti-plane-off" style="font-size:32px;opacity:.2" aria-hidden="true"></i>
        <p>Carregue o arquivo <strong>Malha aérea</strong> (RVPE127_*.CSV) na aba Arquivos.</p>
        <button class="adm-btn-primary" onclick="adminTabSwitch('files', document.querySelectorAll('.adm-tab-btn')[1])">
          Ir para Arquivos
        </button>
      </div>`;
  }

  // Build ranking from malhaVoos if available
  const rows = [];
  if (typeof malhaVoos !== 'undefined' && malhaVoos.size) {
    for (const [base, dayMap] of malhaVoos) {
      const total = [...dayMap.values()].reduce((a,b)=>a+b,0);
      const avg   = Math.round(total / dayMap.size);
      const max   = Math.max(...dayMap.values());
      const min   = Math.min(...dayMap.values());
      rows.push({ base, total, avg, max, min });
    }
    rows.sort((a,b)=>b.total-a.total);
  }

  return `
    <div class="adm-section-header">
      <span>Malha aérea · ${adminFiles.malha.count.toLocaleString()} voos · ${adminFiles.malha.bases} bases</span>
      <span style="font-size:11px;color:var(--text-muted)">${adminFiles.malha.period}</span>
    </div>
    ${rows.length ? `
    <div class="adm-table-wrap">
      <table class="adm-table">
        <thead>
          <tr><th>Base</th><th class="r">Total voos</th><th class="r">Média/dia</th><th class="r">Dia mais tranquilo</th><th class="r">Dia mais intenso</th></tr>
        </thead>
        <tbody>
          ${rows.map(r => `
            <tr>
              <td style="font-weight:600"><span class="adm-base-tag">${r.base}</span></td>
              <td class="r">${r.total.toLocaleString()}</td>
              <td class="r">${r.avg}</td>
              <td class="r" style="color:#72c02c">${r.min} voos</td>
              <td class="r" style="color:#ef4444">${r.max} voos</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>` : `<div class="adm-empty-state"><p>Dados da malha carregados. Processe para ver o ranking.</p></div>`}`;
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
          <select id="edit-role" class="adm-input">
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
            <label class="adm-base-chk" style="color:#ef4444;font-weight:600">
              <input type="checkbox" id="edit-base-all" ${u.bases?.includes('*')?'checked':''}
                onchange="adminToggleAllBases(this)"> Todas as bases
            </label>
            <div class="adm-bases-grid" id="edit-bases-grid">
              ${BASES_DISPONIVEIS.map(b=>`
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

async function adminSaveUser(userId) {
  const nome  = document.getElementById('edit-nome').value.trim();
  const role  = document.getElementById('edit-role').value;
  const ativo = document.getElementById('edit-ativo').checked;
  const allBases = document.getElementById('edit-base-all').checked;
  const bases = allBases
    ? ['*']
    : [...document.querySelectorAll('input[name="edit-base"]:checked')].map(c=>c.value);

  const { error } = await db.from('profiles').update({ nome, role, bases, ativo, updated_at: new Date() }).eq('id', userId);
  if (error) { alert('Erro: '+error.message); return; }
  document.querySelector('.adm-overlay')?.remove();
  adminRender();
}

function adminNewUser() {
  alert('Para adicionar um usuário, peça que ele crie a conta na tela de login com um email @dnata.com.br. Após o cadastro, configure o perfil aqui.');
}

// ══════════════════════════════════════════════════════
// AUTO-LOAD — Lightweight startup, heavy files on demand
// ══════════════════════════════════════════════════════

async function adminAutoLoadFiles() {
  try {
    // ── Colaboradores from DB (all records via pagination) ──
    const { count: totalColabs } = await db.from('colaboradores')
      .select('*', { count:'exact', head:true }).eq('ativo', true);

    if (totalColabs > 0) {
      const allColabs = [];
      const PAGE = 1000;
      for (let from = 0; from < totalColabs; from += PAGE) {
        const { data: page } = await db.from('colaboradores')
          .select('matricula,nome,station,funcao,ch,situacao')
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

    // ── Férias, Desligamentos, PCD (pequenos — carrega tudo de uma vez) ──
    const [feriasRes, desligRes, pcdRes] = await Promise.all([
      db.from('colaboradores_ferias').select('matricula,data_inicio,data_fim,dias'),
      db.from('colaboradores_desligados').select('matricula,data_demissao,causa_texto'),
      db.from('colaboradores_pcd').select('matricula,deficiencia,base'),
    ]);

    if (feriasRes.data?.length) {
      // Mantém, por matrícula, o período de férias mais relevante (o que
      // termina mais tarde — cobre o caso de estar em férias agora).
      const byMat = new Map();
      for (const r of feriasRes.data) {
        const prev = byMat.get(r.matricula);
        if (!prev || (r.data_fim||'') > (prev.data_fim||'')) byMat.set(r.matricula, r);
      }
      window.eoFerias = byMat;
      adminFiles.ferias = { count: feriasRes.data.length, date: 'banco' };
      console.log(`[autoLoad] ferias: ${feriasRes.data.length} registros no banco`);
    }

    if (desligRes.data?.length) {
      const byMat = new Map();
      for (const r of desligRes.data) {
        const prev = byMat.get(r.matricula);
        if (!prev || (r.data_demissao||'') > (prev.data_demissao||'')) byMat.set(r.matricula, r);
      }
      window.eoDesligados = byMat;
      adminFiles.desligados = { count: desligRes.data.length, date: 'banco' };
      console.log(`[autoLoad] desligados: ${desligRes.data.length} registros no banco`);
    }

    if (pcdRes.data?.length) {
      window.eoPcd = new Map(pcdRes.data.map(r => [r.matricula, r]));
      adminFiles.pcd = { count: pcdRes.data.length, date: 'banco' };
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

async function _adminLoadFileOnDemandRun(folder, onProgress) {
  // For DB-backed data: build in-memory Maps for aderencia engine
  if (folder === 'horarios') {
    if (typeof pontoHorarios !== 'undefined' && pontoHorarios.size > 0) return true;
    try {
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
      // Trigger precompute if marcacao also loaded
      if (pontoMarcacao?.size > 0) adminPrecomputeAderencia().catch(console.warn);
      return true;
    } catch(e) { console.error('[onDemand] horarios:', e.message); return false; }
  }

  if (folder === 'marcacao') {
    if (typeof pontoMarcacao !== 'undefined' && pontoMarcacao.size > 0) return true;
    try {
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
      adminFiles.marcacao = { count: data.length, date: 'banco' };
      adhBaseKPI = null; adhColabKPI = null; // force recompute
      console.log(`[onDemand] marcacao: ${pontoMarcacao.size} keys`);
      return true;
    } catch(e) { console.error('[onDemand] marcacao:', e.message); return false; }
  }

  if (folder === 'malha') {
    if (typeof malhaVoos !== 'undefined' && malhaVoos?.size > 0) return true;
    try {
      console.log('[onDemand] Loading malha from DB...');
      const { data, error } = await db.from('malha').select('base,data,hora_chegada,hora_saida');
      if (error || !data?.length) return false;
      // Build malhaVoos Map<base, Map<date, count>>
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

  // Precisamos do cadastro completo (cargo de cada matrícula) para aplicar a
  // isenção de ponto de Gerentes/Coordenadores — garante que já carregou.
  if (!window.eoColabs?.size && typeof adhEnsureRoster === 'function') {
    await adhEnsureRoster();
  }

  // Garante que os desligados também estejam carregados (usados para
  // excluir essas matrículas do cálculo de aderência).
  if (!window.eoDesligados) {
    try {
      const { data } = await db.from('colaboradores_desligados').select('matricula,data_demissao,causa_texto');
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
    if (adminMesDaData(data) !== mes) continue; // fora do mês alvo
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
    if (adminMesDaData(data) !== mes) continue; // fora do mês alvo
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
    if (adminMesDaData(data) !== mes) continue; // fora do mês alvo
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
