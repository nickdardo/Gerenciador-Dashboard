// ══════════════════════════════════════════════════════
// ADMIN PANEL
// ══════════════════════════════════════════════════════

const BASES_DISPONIVEIS = ['BEL','GRU','GIG','CGH','REC','FOR','SSA','CWB','POA','BSB','MAO','NAT'];

const ROLES = {
  admin:    { label: 'Admin Master', color: '#ef4444' },
  gerente:  { label: 'Gerente',      color: '#f59e0b' },
  operador: { label: 'Operador',     color: '#00a0d2' },
};

// ── Entry point ───────────────────────────────────────
async function pageAdmin(el) {
  el.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Admin Master</h1>
        <p class="page-sub">Controle de usuários, bases e status das escalas</p>
      </div>
    </div>
    <div id="admin-body" style="padding:16px 24px">
      <div class="admin-loading">Carregando...</div>
    </div>`;

  // Check if current user is admin
  const { data: profile } = await db.from('profiles').select('*').eq('id', (await db.auth.getUser()).data.user?.id).single();

  if (!profile || profile.role !== 'admin') {
    document.getElementById('admin-body').innerHTML = `
      <div class="admin-denied">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
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

  // Fetch all data in parallel
  const [
    { data: users },
    { data: escalas },
    { data: logs },
  ] = await Promise.all([
    db.from('profiles').select('*').order('created_at', { ascending: false }),
    db.from('escalas').select('base,status,updated_at'),
    db.from('access_log').select('*').order('created_at', { ascending: false }).limit(200),
  ]);

  const totalUsers   = users?.length || 0;
  const ativos       = users?.filter(u => u.ativo).length || 0;
  const basesCom     = [...new Set(escalas?.map(e => e.base) || [])].length;
  const publicadas   = escalas?.filter(e => e.status === 'publicado').length || 0;
  const loginsHoje   = logs?.filter(l => {
    const d = new Date(l.created_at);
    const t = new Date();
    return d.toDateString() === t.toDateString() && l.action === 'login';
  }).length || 0;

  body.innerHTML = `
    <!-- KPIs -->
    <div class="admin-kpis">
      ${adminKpi('Usuários cadastrados', totalUsers,  '#00a0d2', userIcon())}
      ${adminKpi('Usuários ativos',      ativos,      '#72c02c', checkIcon())}
      ${adminKpi('Bases com escala',     basesCom,    '#f59e0b', mapIcon())}
      ${adminKpi('Escalas publicadas',   publicadas,  '#72c02c', calIcon())}
      ${adminKpi('Logins hoje',          loginsHoje,  '#a78bfa', clockIcon())}
    </div>

    <!-- Tabs -->
    <div class="admin-tabs">
      <button class="admin-tab active" onclick="adminTabSwitch('users', this)">Usuários</button>
      <button class="admin-tab" onclick="adminTabSwitch('bases', this)">Status por base</button>
      <button class="admin-tab" onclick="adminTabSwitch('logs',  this)">Log de acessos</button>
    </div>

    <!-- Tab content -->
    <div id="admin-tab-content">
      ${adminUsersTab(users || [])}
    </div>

    <!-- Store data for tab switching -->
    <script>
      window._adminData = ${JSON.stringify({ users: users||[], escalas: escalas||[], logs: logs||[] })};
    </script>
  `;
}

// ── Tab switcher ──────────────────────────────────────
function adminTabSwitch(tab, btn) {
  document.querySelectorAll('.admin-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const { users, escalas, logs } = window._adminData || {};
  const el = document.getElementById('admin-tab-content');
  if (tab === 'users')  el.innerHTML = adminUsersTab(users || []);
  if (tab === 'bases')  el.innerHTML = adminBasesTab(escalas || []);
  if (tab === 'logs')   el.innerHTML = adminLogsTab(logs || []);
}

// ── Users tab ─────────────────────────────────────────
function adminUsersTab(users) {
  return `
    <div class="admin-section-header">
      <span>${users.length} usuários</span>
      <button class="admin-btn-primary" onclick="adminNewUser()">+ Novo usuário</button>
    </div>
    <div class="admin-table-wrap">
      <table class="admin-table">
        <thead>
          <tr>
            <th>Nome</th>
            <th>Email</th>
            <th>Perfil</th>
            <th>Bases</th>
            <th>Status</th>
            <th>Cadastro</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${users.map(u => `
            <tr>
              <td style="font-weight:500">${u.nome || '—'}</td>
              <td style="color:var(--text-secondary)">${u.email}</td>
              <td>
                <span class="admin-role-badge" style="background:${ROLES[u.role]?.color}22;color:${ROLES[u.role]?.color}">
                  ${ROLES[u.role]?.label || u.role}
                </span>
              </td>
              <td>
                ${u.bases?.includes('*')
                  ? '<span class="admin-bases-all">Todas</span>'
                  : (u.bases?.length ? u.bases.map(b => `<span class="admin-base-tag">${b}</span>`).join('') : '<span style="color:var(--text-muted);font-size:11px">Nenhuma</span>')}
              </td>
              <td>
                <span class="admin-status-dot ${u.ativo ? 'on' : 'off'}"></span>
                ${u.ativo ? 'Ativo' : 'Inativo'}
              </td>
              <td style="color:var(--text-muted);font-size:11px">
                ${new Date(u.created_at).toLocaleDateString('pt-BR')}
              </td>
              <td>
                <button class="admin-btn-edit" onclick="adminEditUser('${u.id}')">Editar</button>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

// ── Bases tab ─────────────────────────────────────────
function adminBasesTab(escalas) {
  const byBase = {};
  BASES_DISPONIVEIS.forEach(b => byBase[b] = { status: '—', updated: null });
  escalas.forEach(e => {
    if (!byBase[e.base]) byBase[e.base] = {};
    byBase[e.base].status  = e.status;
    byBase[e.base].updated = e.updated_at;
  });

  const STATUS_COLOR = { publicado: '#72c02c', rascunho: '#f59e0b', arquivado: '#5a6a82', '—': '#3a4a5c' };

  return `
    <div class="admin-section-header"><span>Status das escalas por base</span></div>
    <div class="admin-bases-grid">
      ${BASES_DISPONIVEIS.map(base => {
        const info = byBase[base] || {};
        const clr  = STATUS_COLOR[info.status] || STATUS_COLOR['—'];
        return `
          <div class="admin-base-card">
            <div class="admin-base-card-top">
              <span class="admin-base-sigla">${base}</span>
              <span class="admin-base-status" style="color:${clr}">● ${info.status || '—'}</span>
            </div>
            ${info.updated
              ? `<div class="admin-base-updated">Atualizado ${new Date(info.updated).toLocaleDateString('pt-BR')}</div>`
              : `<div class="admin-base-updated" style="color:var(--text-muted)">Sem escala</div>`}
          </div>`;
      }).join('')}
    </div>`;
}

// ── Logs tab ──────────────────────────────────────────
function adminLogsTab(logs) {
  const ACTION_LABEL = {
    login:           '🔑 Login',
    logout:          '🚪 Logout',
    view_escala:     '👁 Ver escala',
    edit_escala:     '✏️ Editar escala',
    publish_escala:  '✅ Publicar escala',
  };

  return `
    <div class="admin-section-header"><span>${logs.length} registros recentes</span></div>
    <div class="admin-table-wrap">
      <table class="admin-table">
        <thead>
          <tr><th>Data/Hora</th><th>Email</th><th>Base</th><th>Ação</th></tr>
        </thead>
        <tbody>
          ${logs.slice(0,100).map(l => `
            <tr>
              <td style="font-size:11px;color:var(--text-muted)">${new Date(l.created_at).toLocaleString('pt-BR')}</td>
              <td>${l.email || '—'}</td>
              <td>${l.base ? `<span class="admin-base-tag">${l.base}</span>` : '—'}</td>
              <td style="font-size:11px">${ACTION_LABEL[l.action] || l.action}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

// ── Edit user modal ───────────────────────────────────
async function adminEditUser(userId) {
  const { data: u } = await db.from('profiles').select('*').eq('id', userId).single();
  if (!u) return;

  const overlay = document.createElement('div');
  overlay.className = 'admin-modal-overlay';
  overlay.innerHTML = `
    <div class="admin-modal">
      <div class="admin-modal-header">
        <span>Editar usuário</span>
        <button onclick="this.closest('.admin-modal-overlay').remove()">✕</button>
      </div>

      <div class="admin-modal-body">
        <div class="admin-field">
          <label>Nome</label>
          <input id="edit-nome" class="admin-input" value="${u.nome || ''}">
        </div>

        <div class="admin-field">
          <label>Email</label>
          <input class="admin-input" value="${u.email}" disabled style="opacity:.5">
        </div>

        <div class="admin-field">
          <label>Perfil de acesso</label>
          <select id="edit-role" class="admin-input">
            <option value="admin"   ${u.role==='admin'   ?'selected':''}>Admin Master</option>
            <option value="gerente" ${u.role==='gerente' ?'selected':''}>Gerente</option>
            <option value="operador"${u.role==='operador'?'selected':''}>Operador</option>
          </select>
        </div>

        <div class="admin-field">
          <label>Bases autorizadas</label>
          <div class="admin-bases-picker">
            <label class="admin-base-check" style="color:#ef4444">
              <input type="checkbox" id="edit-base-all" ${u.bases?.includes('*')?'checked':''}
                onchange="adminToggleAllBases(this)"> Todas as bases
            </label>
            <div class="admin-bases-picker-grid" id="edit-bases-grid">
              ${BASES_DISPONIVEIS.map(b => `
                <label class="admin-base-check">
                  <input type="checkbox" name="edit-base" value="${b}"
                    ${u.bases?.includes('*')||u.bases?.includes(b)?'checked':''}
                    ${u.bases?.includes('*')?'disabled':''}>
                  ${b}
                </label>`).join('')}
            </div>
          </div>
        </div>

        <div class="admin-field" style="flex-direction:row;align-items:center;gap:10px">
          <label style="margin:0">Usuário ativo</label>
          <input type="checkbox" id="edit-ativo" ${u.ativo?'checked':''} style="width:16px;height:16px;accent-color:var(--dnata-blue)">
        </div>
      </div>

      <div class="admin-modal-footer">
        <button class="admin-btn-sec" onclick="this.closest('.admin-modal-overlay').remove()">Cancelar</button>
        <button class="admin-btn-primary" onclick="adminSaveUser('${userId}')">Salvar</button>
      </div>
    </div>`;

  document.body.appendChild(overlay);
}

function adminToggleAllBases(chk) {
  const grid   = document.getElementById('edit-bases-grid');
  const checks = grid.querySelectorAll('input[type=checkbox]');
  checks.forEach(c => { c.checked = chk.checked; c.disabled = chk.checked; });
}

async function adminSaveUser(userId) {
  const nome  = document.getElementById('edit-nome').value.trim();
  const role  = document.getElementById('edit-role').value;
  const ativo = document.getElementById('edit-ativo').checked;
  const allBases = document.getElementById('edit-base-all').checked;

  let bases;
  if (allBases) {
    bases = ['*'];
  } else {
    bases = [...document.querySelectorAll('input[name="edit-base"]:checked')].map(c => c.value);
  }

  const { error } = await db.from('profiles').update({ nome, role, bases, ativo, updated_at: new Date() }).eq('id', userId);

  if (error) {
    alert('Erro ao salvar: ' + error.message);
    return;
  }

  document.querySelector('.admin-modal-overlay')?.remove();
  adminRender();
}

async function adminNewUser() {
  alert('Para criar um novo usuário, peça que ele faça o cadastro na tela de login com um email @dnata.com.br. Após o cadastro, configure o perfil e as bases aqui no Admin.');
}

// ── KPI helper ────────────────────────────────────────
function adminKpi(label, value, color, icon) {
  return `
    <div class="admin-kpi">
      <div class="admin-kpi-icon" style="color:${color}">${icon}</div>
      <div class="admin-kpi-value" style="color:${color}">${value}</div>
      <div class="admin-kpi-label">${label}</div>
    </div>`;
}

// ── Icons ─────────────────────────────────────────────
function userIcon()  { return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`; }
function checkIcon() { return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`; }
function mapIcon()   { return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`; }
function calIcon()   { return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`; }
function clockIcon() { return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`; }
