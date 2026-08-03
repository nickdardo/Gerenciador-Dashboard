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
  const idioma = idiomaAtual();
  container.innerHTML = `
    <div class="auth-tabs">
      <button class="auth-tab active" data-tab="login" onclick="renderLogin()">${t('auth.entrar')}</button>
      <button class="auth-tab" data-tab="signup" onclick="renderSignup()">${t('auth.criarAcesso')}</button>
    </div>

    <div class="auth-idioma">
      <div class="auth-idioma-label">${t('auth.idioma')}</div>
      <div class="auth-idioma-btns">
        <button class="auth-idioma-btn${idioma==='pt'?' active':''}" onclick="setIdioma('pt')">PT-BR</button>
        <button class="auth-idioma-btn${idioma==='en'?' active':''}" onclick="setIdioma('en')">English</button>
      </div>
    </div>

    <div class="auth-field-group">
      <label class="auth-label">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
        ${t('auth.emailCorporativo')}
      </label>
      <input id="auth-email" class="auth-input" type="email"
        placeholder="nome@dnata.com.br" autocomplete="email">
    </div>

    <div class="auth-field-group">
      <label class="auth-label">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        ${t('auth.senha')}
      </label>
      <div class="auth-input-wrap">
        <input id="auth-pass" class="auth-input auth-input-pw" type="password"
          placeholder="${t('auth.senhaPlaceholder')}" autocomplete="current-password">
        <button type="button" class="auth-eye" onclick="togglePw('auth-pass',this)" tabindex="-1">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        </button>
      </div>
    </div>

    <div class="auth-error" id="auth-err" style="display:none"></div>

    <button class="auth-submit" onclick="doLogin()">${t('auth.entrar')}</button>

    <p class="auth-hint">${t('auth.hintLogin')}</p>
  `;

  document.getElementById('auth-pass').addEventListener('keydown', e => {
    if (e.key === 'Enter') doLogin();
  });
}

// ── Render signup form ────────────────────────────────
function renderSignup() {
  const container = document.getElementById('auth-card');
  const idioma = idiomaAtual();
  container.innerHTML = `
    <div class="auth-tabs">
      <button class="auth-tab" data-tab="login" onclick="renderLogin()">${t('auth.entrar')}</button>
      <button class="auth-tab active" data-tab="signup" onclick="renderSignup()">${t('auth.criarAcesso')}</button>
    </div>

    <div class="auth-idioma">
      <div class="auth-idioma-label">${t('auth.idioma')}</div>
      <div class="auth-idioma-btns">
        <button class="auth-idioma-btn${idioma==='pt'?' active':''}" onclick="setIdioma('pt')">PT-BR</button>
        <button class="auth-idioma-btn${idioma==='en'?' active':''}" onclick="setIdioma('en')">English</button>
      </div>
    </div>

    <div class="auth-field-group">
      <label class="auth-label">${t('auth.nomeCompleto')}</label>
      <input id="auth-nome" class="auth-input" type="text" placeholder="${t('auth.seuNome')}">
    </div>

    <div class="auth-field-group">
      <label class="auth-label">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
        ${t('auth.emailCorporativo')}
      </label>
      <input id="auth-email" class="auth-input" type="email"
        placeholder="nome@dnata.com.br">
    </div>

    <div class="auth-field-group">
      <label class="auth-label">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        ${t('auth.senha')}
      </label>
      <div class="auth-input-wrap">
        <input id="auth-pass" class="auth-input auth-input-pw" type="password"
          placeholder="${t('auth.minimo8')}">
        <button type="button" class="auth-eye" onclick="togglePw('auth-pass',this)" tabindex="-1">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        </button>
      </div>
    </div>

    <div class="auth-field-group">
      <label class="auth-label">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        ${t('auth.confirmarSenha')}
      </label>
      <div class="auth-input-wrap">
        <input id="auth-pass2" class="auth-input auth-input-pw" type="password"
          placeholder="${t('auth.repitaSenha')}">
        <button type="button" class="auth-eye" onclick="togglePw('auth-pass2',this)" tabindex="-1">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        </button>
      </div>
    </div>

    <div class="auth-error" id="auth-err" style="display:none"></div>

    <button class="auth-submit" onclick="doSignup()">${t('auth.criarConta')}</button>

    <p class="auth-hint">${t('auth.hintSignup')}</p>
  `;
}

// ── Actions ───────────────────────────────────────────
async function doLogin() {
  const email = document.getElementById('auth-email')?.value.trim();
  const pass  = document.getElementById('auth-pass')?.value;
  const errEl = document.getElementById('auth-err');
  const btn   = document.querySelector('.auth-submit');

  if (!email || !pass) { showAuthErr(t('auth.erroCampos')); return; }

  btn.textContent = t('auth.entrando');
  btn.disabled    = true;

  const { error } = await authSignIn(email, pass);

  if (error) {
    btn.textContent = t('auth.entrar');
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
  if (!nome || !email || !pass || !pass2) { showAuthErr(t('auth.erroCampos')); return; }
  if (!email.endsWith('@dnata.com.br')) { showAuthErr(t('auth.erroDominio')); return; }
  if (pass.length < 8) { showAuthErr(t('auth.erroSenhaCurta')); return; }
  if (pass !== pass2) { showAuthErr(t('auth.erroSenhaDiferente')); return; }

  btn.textContent = t('auth.criando');
  btn.disabled    = true;

  const { error } = await authSignUp(email, pass, nome);

  if (error) {
    btn.textContent = t('auth.criarConta');
    btn.disabled    = false;
    showAuthErr(friendlyError(error.message));
  } else {
    showAuthErr(t('auth.contaCriada'), 'ok');
    btn.textContent = t('auth.criarConta');
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
  if (msg.includes('Invalid login'))      return t('auth.erroLoginInvalido');
  if (msg.includes('Email not confirmed')) return t('auth.erroEmailNaoConfirmado');
  if (msg.includes('already registered')) return t('auth.erroJaCadastrado');
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
