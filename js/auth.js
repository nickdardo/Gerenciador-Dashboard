// ══════════════════════════════════════════════════════
// AUTH — Login / Criar acesso
// ══════════════════════════════════════════════════════

function showAuth() {
  document.getElementById('app-shell').style.display  = 'none';
  document.getElementById('auth-shell').style.display = 'flex';
  renderLogin();
}

function showApp(user) {
  document.getElementById('auth-shell').style.display = 'none';
  document.getElementById('app-shell').style.display  = 'flex';
  appInit(user);
}

// ── Render login form ─────────────────────────────────
function renderLogin() {
  const container = document.getElementById('auth-card');
  container.innerHTML = `
    <div class="auth-tabs">
      <button class="auth-tab active" onclick="renderLogin()">Entrar</button>
      <button class="auth-tab" onclick="renderSignup()">Criar acesso</button>
    </div>

    <div class="auth-idioma">
      <div class="auth-idioma-label">Idioma</div>
      <div class="auth-idioma-btns">
        <button class="auth-idioma-btn active">PT-BR</button>
        <button class="auth-idioma-btn">English</button>
      </div>
    </div>

    <div class="auth-field-group">
      <label class="auth-label">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
        Email corporativo
      </label>
      <input id="auth-email" class="auth-input" type="email"
        placeholder="nome@dnata.com.br" autocomplete="email">
    </div>

    <div class="auth-field-group">
      <label class="auth-label">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        Senha
      </label>
      <input id="auth-pass" class="auth-input" type="password"
        placeholder="••••••••" autocomplete="current-password">
    </div>

    <div class="auth-error" id="auth-err" style="display:none"></div>

    <button class="auth-submit" onclick="doLogin()">Entrar</button>

    <p class="auth-hint">Use seu email @dnata.com.br para acesso autorizado.</p>
  `;

  document.getElementById('auth-pass').addEventListener('keydown', e => {
    if (e.key === 'Enter') doLogin();
  });
}

// ── Render signup form ────────────────────────────────
function renderSignup() {
  const container = document.getElementById('auth-card');
  container.innerHTML = `
    <div class="auth-tabs">
      <button class="auth-tab" onclick="renderLogin()">Entrar</button>
      <button class="auth-tab active" onclick="renderSignup()">Criar acesso</button>
    </div>

    <div class="auth-field-group">
      <label class="auth-label">Nome completo</label>
      <input id="auth-nome" class="auth-input" type="text" placeholder="Seu nome">
    </div>

    <div class="auth-field-group">
      <label class="auth-label">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
        Email corporativo
      </label>
      <input id="auth-email" class="auth-input" type="email"
        placeholder="nome@dnata.com.br">
    </div>

    <div class="auth-field-group">
      <label class="auth-label">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        Senha
      </label>
      <input id="auth-pass" class="auth-input" type="password"
        placeholder="Mínimo 8 caracteres">
    </div>

    <div class="auth-error" id="auth-err" style="display:none"></div>

    <button class="auth-submit" onclick="doSignup()">Criar conta</button>

    <p class="auth-hint">Apenas emails @dnata.com.br são autorizados.</p>
  `;
}

// ── Actions ───────────────────────────────────────────
async function doLogin() {
  const email = document.getElementById('auth-email')?.value.trim();
  const pass  = document.getElementById('auth-pass')?.value;
  const errEl = document.getElementById('auth-err');
  const btn   = document.querySelector('.auth-submit');

  if (!email || !pass) { showAuthErr('Preencha todos os campos.'); return; }

  btn.textContent = 'Entrando...';
  btn.disabled    = true;

  const { error } = await authSignIn(email, pass);

  if (error) {
    btn.textContent = 'Entrar';
    btn.disabled    = false;
    showAuthErr(friendlyError(error.message));
  }
  // success handled by onAuthStateChange → showApp()
}

async function doSignup() {
  const nome  = document.getElementById('auth-nome')?.value.trim();
  const email = document.getElementById('auth-email')?.value.trim();
  const pass  = document.getElementById('auth-pass')?.value;
  const btn   = document.querySelector('.auth-submit');

  if (!nome || !email || !pass) { showAuthErr('Preencha todos os campos.'); return; }
  if (!email.endsWith('@dnata.com.br')) { showAuthErr('Use um email @dnata.com.br.'); return; }
  if (pass.length < 8) { showAuthErr('Senha deve ter no mínimo 8 caracteres.'); return; }

  btn.textContent = 'Criando...';
  btn.disabled    = true;

  const { error } = await authSignUp(email, pass, nome);

  if (error) {
    btn.textContent = 'Criar conta';
    btn.disabled    = false;
    showAuthErr(friendlyError(error.message));
  } else {
    showAuthErr('Conta criada! Verifique seu email para confirmar.', 'ok');
    btn.textContent = 'Criar conta';
    btn.disabled    = false;
  }
}

function showAuthErr(msg, type = 'err') {
  const el = document.getElementById('auth-err');
  if (!el) return;
  el.textContent    = msg;
  el.style.display  = 'block';
  el.className      = type === 'ok' ? 'auth-ok' : 'auth-error';
}

function friendlyError(msg) {
  if (msg.includes('Invalid login'))      return 'Email ou senha incorretos.';
  if (msg.includes('Email not confirmed')) return 'Confirme seu email antes de entrar.';
  if (msg.includes('already registered')) return 'Este email já está cadastrado.';
  return msg;
}

// ══════════════════════════════════════════════════════
// INIT — called after all scripts are loaded
// ══════════════════════════════════════════════════════
async function initAuth() {
  // 1. Set up auth state listener
  db.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT' || !session) {
      showAuth();
    } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
      showApp(session.user);
    }
  });

  // 2. Check if already logged in
  const { data: { session } } = await db.auth.getSession();
  if (session?.user) {
    showApp(session.user);
  } else {
    showAuth();
  }
}
