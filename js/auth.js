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
      <div class="auth-input-wrap">
        <input id="auth-pass" class="auth-input auth-input-pw" type="password"
          placeholder="••••••••" autocomplete="current-password">
        <button type="button" class="auth-eye" onclick="togglePw('auth-pass',this)" tabindex="-1">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        </button>
      </div>
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
      <div class="auth-input-wrap">
        <input id="auth-pass" class="auth-input auth-input-pw" type="password"
          placeholder="Mínimo 8 caracteres">
        <button type="button" class="auth-eye" onclick="togglePw('auth-pass',this)" tabindex="-1">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        </button>
      </div>
    </div>

    <div class="auth-field-group">
      <label class="auth-label">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        Confirmar senha
      </label>
      <div class="auth-input-wrap">
        <input id="auth-pass2" class="auth-input auth-input-pw" type="password"
          placeholder="Repita a senha">
        <button type="button" class="auth-eye" onclick="togglePw('auth-pass2',this)" tabindex="-1">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        </button>
      </div>
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

  const pass2 = document.getElementById('auth-pass2')?.value;
  if (!nome || !email || !pass || !pass2) { showAuthErr('Preencha todos os campos.'); return; }
  if (!email.endsWith('@dnata.com.br')) { showAuthErr('Use um email @dnata.com.br.'); return; }
  if (pass.length < 8) { showAuthErr('Senha deve ter no mínimo 8 caracteres.'); return; }
  if (pass !== pass2) { showAuthErr('As senhas não coincidem.'); return; }

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

// ── Toggle password visibility ───────────────────────
function togglePw(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const isHidden = input.type === 'password';
  input.type = isHidden ? 'text' : 'password';
  btn.innerHTML = isHidden
    ? `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`
    : `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
}

// ══════════════════════════════════════════════════════
// INIT — called after all scripts are loaded
// ══════════════════════════════════════════════════════
async function initAuth() {
  // Check existing session on page load
  const { data: { session } } = await db.auth.getSession();
  if (session?.user) {
    showApp(session.user);
  } else {
    showAuth();
  }
}
