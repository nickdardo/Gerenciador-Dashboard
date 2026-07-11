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
  adminFileHistory[key] = [entry, ...(adminFileHistory[key]||[]).slice(0,4)];
  try { localStorage.setItem('adm_hist_'+key, JSON.stringify(adminFileHistory[key])); } catch(_){}
}

const adminFiles = {
  colaboradores: null,  // { count, bases, date, data: Map<mat, {nome,filial,funcao,ch,situacao}> }
  horarios:      null,  // { count, period, date }
  marcacao:      null,  // { count, period, date }
  malha:         null,  // { count, bases, period, date }
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
    db.from('access_log').select('*').order('created_at', { ascending: false }).limit(200),
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

  return `
    <div class="adm-section-header">
      <span>Hub de dados operacionais</span>
      <span style="font-size:11px;color:var(--text-muted)">Dados salvos no banco de dados</span>
    </div>
    <div class="adm-files-grid">
      ${files.map(f => {
        const hist = adminFileHistory[f.key] || [];
        return `
          <div class="adm-file-card">
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

            ${hist.length ? `
              <div class="adm-file-history">
                <div class="adm-file-history-title">Histórico de uploads</div>
                ${hist.slice(0,3).map(h => `
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
        const mat = String(row[0]).trim();
        if (!mat || isNaN(parseInt(mat))) return;
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
  if (btn) { btn.disabled = true; btn.textContent = 'Calculando...'; }
  try {
    // Load from DB if not in memory
    if (!pontoHorarios?.size) await adminLoadFileOnDemand('horarios');
    if (!pontoMarcacao?.size) await adminLoadFileOnDemand('marcacao');
    if (!pontoHorarios?.size || !pontoMarcacao?.size) {
      alert('Carregue os arquivos Horários e Marcação primeiro.');
      return;
    }
    await adminPrecomputeAderencia();
    // Invalidate localStorage cache
    try { localStorage.removeItem('adh_kpi_cache'); localStorage.removeItem('adh_kpi_ts'); } catch(_){}
    if (btn) { btn.textContent = '✓ Recalculado!'; setTimeout(()=>{ btn.disabled=false; btn.textContent='↺ Recalcular Aderência'; },3000); }
  } catch(e) {
    alert('Erro: '+e.message);
    if (btn) { btn.disabled=false; btn.textContent='↺ Recalcular Aderência'; }
  }
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
  el.querySelector('p').textContent = 'Carregando Horários...';
  await adminLoadFileOnDemand('horarios');
  el.querySelector('p').textContent = 'Carregando Marcação...';
  await adminLoadFileOnDemand('marcacao');

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
      <div style="display:flex;gap:8px">
        <span class="adm-legend-item"><span class="adm-dot" style="background:#72c02c"></span>≥90% ótimo</span>
        <span class="adm-legend-item"><span class="adm-dot" style="background:#f59e0b"></span>70–89% atenção</span>
        <span class="adm-legend-item"><span class="adm-dot" style="background:#ef4444"></span>&lt;70% crítico</span>
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
function adminLogsTab(logs) {
  const ACTION = {
    login: 'Login', logout: 'Logout',
    view_escala:'Ver escala', edit_escala:'Editar escala', publish_escala:'Publicar escala',
  };
  return `
    <div class="adm-section-header"><span>${logs.length} registros recentes</span></div>
    <div class="adm-table-wrap">
      <table class="adm-table">
        <thead><tr><th>Data / Hora</th><th>Email</th><th>Base</th><th>Ação</th></tr></thead>
        <tbody>
          ${logs.slice(0,100).map(l=>`
            <tr>
              <td style="font-size:11px;color:var(--text-muted)">${new Date(l.created_at).toLocaleString('pt-BR')}</td>
              <td>${l.email||'—'}</td>
              <td>${l.base?`<span class="adm-base-tag">${l.base}</span>`:'—'}</td>
              <td style="font-size:11px">${ACTION[l.action]||l.action}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
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

  } catch(err) {
    console.warn('[adminAutoLoadFiles]', err.message);
  }
}

async function adminLoadFileOnDemand(folder) {
  // For DB-backed data: build in-memory Maps for aderencia engine
  if (folder === 'horarios') {
    if (typeof pontoHorarios !== 'undefined' && pontoHorarios.size > 0) return true;
    try {
      console.log('[onDemand] Loading horarios from DB...');
      // Paginate to get all rows (Supabase default limit is 1000)
      const allHor = [];
      const { count: horCount } = await db.from('horarios').select('*', { count:'exact', head:true });
      for (let from = 0; from < horCount; from += 1000) {
        const { data: page, error } = await db.from('horarios').select('*').range(from, from+999);
        if (error) throw new Error(error.message);
        if (page) allHor.push(...page);
      }
      const data = allHor;
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
      const allMar = [];
      const { count: marCount } = await db.from('marcacao').select('*', { count:'exact', head:true });
      for (let from = 0; from < marCount; from += 1000) {
        const { data: page, error } = await db.from('marcacao').select('*').range(from, from+999);
        if (error) throw new Error(error.message);
        if (page) allMar.push(...page);
      }
      const data = allMar;
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
async function adminPrecomputeAderencia() {
  if (!pontoHorarios?.size || !pontoMarcacao?.size) {
    console.warn('[precompute] horarios ou marcacao não carregados');
    return;
  }

  console.log('[precompute] Calculando KPI de aderência...');
  const ADH_EXCL = new Set(['HQ2','SEDE','GSE']);

  // Build horario minutes per key
  const horMin = new Map();
  for (const [key, h] of pontoHorarios) {
    if (ADH_EXCL.has((h.filial||'').toUpperCase())) continue;
    let mp = 0;
    const tm = (t) => { if(!t)return 0; const p=String(t).split(':'); return parseInt(p[0])*60+parseInt(p[1]||0); };
    const diff = (a,b) => { if(!a||!b)return 0; const d=tm(b)-tm(a); return d<0?d+1440:d; };
    mp += diff(h.ent1, h.sai1);
    if (h.ent2&&h.sai2) mp += diff(h.ent2, h.sai2);
    horMin.set(key, { min_prog: mp, filial: h.filial, mat: h.mat, nome: h.nome });
  }

  // Compute per collaborator
  const colabAcc = new Map();
  for (const [key, m] of pontoMarcacao) {
    const filial = (m.filial||'').toUpperCase();
    if (ADH_EXCL.has(filial)) continue;
    const tm = (t) => { if(!t)return 0; const p=String(t).split(':'); return parseInt(p[0])*60+parseInt(p[1]||0); };
    const diff = (a,b) => { if(!a||!b)return 0; const d=tm(b)-tm(a); return d<0?d+1440:d; };
    let mt = 0;
    [[m.bat1,m.bat2],[m.bat3,m.bat4],[m.bat5,m.bat6],[m.bat7,m.bat8]]
      .forEach(([a,b]) => { mt += diff(a,b); });
    const hor = horMin.get(key);
    const mp  = hor ? hor.min_prog : 0;
    const dev = Math.abs(mt - mp);
    const he  = Math.max(0, mt - mp);
    const fat = Math.max(0, mp - mt);
    const ck  = `${filial}|${m.mat}`;
    if (!colabAcc.has(ck)) {
      const nome = hor?.nome || m.nome || '';
      colabAcc.set(ck, { filial, mat: m.mat, nome, mp:0, mt:0, desvio:0, he:0, falta:0 });
    }
    const acc = colabAcc.get(ck);
    acc.mp+=mp; acc.mt+=mt; acc.desvio+=dev; acc.he+=he; acc.falta+=fat;
  }

  // Aggregate per base
  const baseAcc = new Map();
  const colabRows = [];
  for (const [ck, c] of colabAcc) {
    const base = c.filial;
    if (!baseAcc.has(base)) baseAcc.set(base, {mp:0,desvio:0,he:0,falta:0,colabs:0});
    const b = baseAcc.get(base);
    b.mp+=c.mp; b.desvio+=c.desvio; b.he+=c.he; b.falta+=c.falta; b.colabs++;
    const pct = c.mp>0 ? Math.max(0,Math.round((100-c.desvio/c.mp*100)*10)/10) : 0;
    colabRows.push({
      filial:c.filial, matricula:c.mat, nome:c.nome,
      min_prog:c.mp, min_trab:c.mt, desvio:c.desvio, he:c.he, falta:c.falta,
      pct, he_h:Math.round(c.he/60*10)/10, falta_h:Math.round(c.falta/60*10)/10,
      updated_at: new Date()
    });
  }

  // Build base rows
  const baseRows = [];
  for (const [filial, b] of baseAcc) {
    if (!b.mp) continue;
    const pct = Math.max(0, Math.round((100-b.desvio/b.mp*100)*10)/10);
    baseRows.push({
      filial, min_prog:b.mp, desvio:b.desvio, he:b.he, falta:b.falta, colabs:b.colabs,
      pct, he_h:Math.round(b.he/60*10)/10, falta_h:Math.round(b.falta/60*10)/10,
      prog_h:Math.round(b.mp/60*10)/10, updated_at: new Date()
    });
  }

  console.log(`[precompute] ${baseRows.length} bases, ${colabRows.length} colaboradores`);

  // Save base KPI to DB
  const BATCH = 500;
  for (let i=0; i<baseRows.length; i+=BATCH) {
    const { error } = await db.from('aderencia_kpi')
      .upsert(baseRows.slice(i,i+BATCH), { onConflict:'filial' });
    if (error) { console.error('[precompute] base KPI error:', error.message); return; }
  }

  // Save colab KPI to DB
  for (let i=0; i<colabRows.length; i+=BATCH) {
    const { error } = await db.from('aderencia_colab')
      .upsert(colabRows.slice(i,i+BATCH), { onConflict:'filial,matricula' });
    if (error) { console.error('[precompute] colab KPI error:', error.message); return; }
  }

  // Invalidate localStorage cache
  try {
    localStorage.removeItem('adh_kpi_cache');
    localStorage.removeItem('adh_kpi_ts');
  } catch(_){}

  console.log('[precompute] ✓ KPI salvo no banco e cache invalidado');
}
