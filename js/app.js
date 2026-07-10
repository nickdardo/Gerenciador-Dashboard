// ══════════════════════════════════════════════════════
// APP SHELL — Sidebar + Page Routing
// ══════════════════════════════════════════════════════

let currentUser = null;
let currentPage = 'escala';

const ALL_ROLES = ['admin','gerente','coordenador','supervisor','lideranca','operador'];

const NAV_ITEMS = [
  { id: 'escala',     icon: 'calendar',   label: 'Escala Online',  roles: ALL_ROLES },
  { id: 'gerador',    icon: 'settings',   label: 'Gerador',        roles: ['admin','gerente','coordenador','supervisor','lideranca'] },
  { id: 'comparador', icon: 'bar-chart',  label: 'Comparador',     roles: ['admin','gerente','coordenador','supervisor'] },
  { id: 'aderencia',  icon: 'clock',      label: 'Aderência',      roles: ['admin','gerente','coordenador','supervisor'] },
  { id: 'admin',      icon: 'shield',     label: 'Admin',          roles: ['admin'] },
];

let currentUserProfile = null;

// ── Init app after login ──────────────────────────────
let _appInitialized = false;

async function appInit(user) {
  currentUser = user;

  // Load user profile (role + bases)
  const { data: profile } = await db.from('profiles').select('*').eq('id', user.id).single();
  currentUserProfile = profile;

  // Log login only on first load
  if (!_appInitialized) {
    try {
      await db.from('access_log').insert({
        user_id: user.id,
        email:   user.email,
        base:    profile?.bases?.[0] || null,
        action:  'login'
      });
    } catch (_) {}
  }

  // Rebuild sidebar/topbar (keeps nav active state)
  renderSidebar();
  renderTopbar();

  // Navigate to default page only on FIRST load
  // On tab re-focus, Supabase fires onAuthStateChange again —
  // we skip navigation so the user stays on their current page
  // Auto-load files from Storage/DB for all users (non-blocking)
  if (typeof adminAutoLoadFiles === 'function') {
    adminAutoLoadFiles().catch(e => console.warn('[autoLoad]', e.message));
  }

  if (!_appInitialized) {
    _appInitialized = true;
    navigateTo('escala');
  }
}

// ── Sidebar ───────────────────────────────────────────
function renderSidebar() {
  const nome  = currentUser?.user_metadata?.nome || currentUser?.email?.split('@')[0] || 'Usuário';
  const email = currentUser?.email || '';

  document.getElementById('sidebar').innerHTML = `
    <!-- Brand -->
    <div class="sb-brand">
      <div class="sb-brand-inner">
        <img src="assets/dnata-logo-nav.png" alt="dnata" class="sb-logo">
        <div class="sb-brand-text">
          <div class="sb-product">Gerenciador</div>
          <div class="sb-dept">de Escalas</div>
          <div class="sb-sub">COO OPERATIONS</div>
        </div>
      </div>
      <button class="sb-collapse" onclick="toggleSidebar()" title="Recolher">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
      </button>
    </div>

    <!-- Nav items — filtered by role -->
    <nav class="sb-nav">
      ${NAV_ITEMS
        .filter(item => !item.roles || item.roles.includes(currentUserProfile?.role || 'operador'))
        .map(item => `
          <button
            class="sb-item${currentPage === item.id ? ' active' : ''}"
            id="nav-${item.id}"
            onclick="navigateTo('${item.id}')"
          >
            ${sbIcon(item.icon)}
            <span class="sb-label">${item.label}</span>
          </button>
        `).join('')}
    </nav>

    <!-- Footer -->
    <div class="sb-footer">
      <div class="sb-user">
        <div class="sb-avatar">${nome.charAt(0).toUpperCase()}</div>
        <div class="sb-user-info">
          <div class="sb-user-name">${nome}</div>
          <div class="sb-user-email">${email}</div>
        </div>
      </div>
      <button class="sb-signout" onclick="authSignOut()" title="Sair">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
        <span class="sb-label">Sair</span>
      </button>
    </div>
  `;
}

// ── Topbar ────────────────────────────────────────────
function renderTopbar() {
  document.getElementById('topbar').innerHTML = `
    <div class="tb-left">
      <button class="tb-menu-btn" onclick="toggleSidebar()">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
      </button>
      <span class="tb-page-title" id="tb-title">Escala Online</span>
    </div>
    <div class="tb-right">
      <span class="tb-base-badge" id="tb-base" style="display:none"></span>
      <span class="tb-time" id="tb-time"></span>
    </div>
  `;

  // Live clock
  function tick() {
    const el = document.getElementById('tb-time');
    if (el) el.textContent = new Date().toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
  }
  tick();
  setInterval(tick, 1000);
}

// ── Navigation ────────────────────────────────────────
function navigateTo(pageId) {
  currentPage = pageId;

  // Update nav active state
  document.querySelectorAll('.sb-item').forEach(el => el.classList.remove('active'));
  const navEl = document.getElementById(`nav-${pageId}`);
  if (navEl) navEl.classList.add('active');

  // Update topbar title
  const item = NAV_ITEMS.find(n => n.id === pageId);
  const titleEl = document.getElementById('tb-title');
  if (titleEl && item) titleEl.textContent = item.label;

  // Render page
  const content = document.getElementById('page-content');
  content.innerHTML = '';

  switch (pageId) {
    case 'escala':     pageEscala(content);     break;
    case 'gerador':    pageGerador(content);    break;
    case 'comparador': pageComparador(content); break;
    case 'aderencia':  pageAderencia(content);  break;
    case 'admin':      pageAdmin(content);      break;
    default: content.innerHTML = '<div class="page-empty">Em breve</div>';
  }
}

// ── Sidebar toggle ────────────────────────────────────
let sidebarOpen = true;
function toggleSidebar() {
  sidebarOpen = !sidebarOpen;
  document.getElementById('app-shell').classList.toggle('sb-closed', !sidebarOpen);
}

// ── SVG Icons ─────────────────────────────────────────
function sbIcon(name) {
  const icons = {
    calendar:  `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
    settings:  `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
    'bar-chart':`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>`,
    clock:     `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
    shield:    `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
  };
  return `<span class="sb-icon">${icons[name] || ''}</span>`;
}
