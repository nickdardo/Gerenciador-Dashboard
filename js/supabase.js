// ══════════════════════════════════════════════════════
// SUPABASE CLIENT
// ══════════════════════════════════════════════════════
const SUPABASE_URL  = 'https://uxngpstmqqsdhlwjqcls.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV4bmdwc3RtcXFzZGhsd2pxY2xzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM1Mzk1NjEsImV4cCI6MjA5OTExNTU2MX0.0BVZX7wOGMhF5jIFv-lVvEZx1tF31-X-sQ8FGRmPJq4';

const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

// ── Busca TODAS as linhas de uma tabela, ignorando o limite padrão de 1000
// linhas por consulta do Supabase. Usar sempre que a tabela puder crescer
// além disso (histórico acumulado de férias/desligamentos/pcd, por ex.) —
// um select() simples trunca silenciosamente, sem erro, então é fácil passar
// despercebido até os dados crescerem o suficiente pra estourar o limite.
async function dbFetchAll(table, columns) {
  const { count } = await db.from(table).select('*', { count: 'exact', head: true });
  if (!count) return [];
  const PAGE = 1000;
  const all = [];
  for (let from = 0; from < count; from += PAGE) {
    const { data, error } = await db.from(table).select(columns).range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    if (data) all.push(...data);
  }
  return all;
}

// ── Selo "Atualizado em ..." — window._lastDataUpdateAt é preenchido em
// adminAutoLoadFiles() com o updated_at mais recente do cadastro. Usado no
// cabeçalho do Staff e da Aderência pra dar transparência de quão fresco é
// o dado exibido (mesma fonte pras duas telas).
function lastUpdateBadgeHTML() {
  const v = window._lastDataUpdateAt;
  if (!v) return '';
  const d = new Date(v);
  const label = d.toLocaleDateString('pt-BR') + ' às ' + d.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });
  return `<span class="hc-last-update" title="Última vez que o cadastro de colaboradores foi atualizado"><i class="ti ti-clock" aria-hidden="true"></i> Atualizado em ${label}</span>`;
}

// ── Auth helpers ──────────────────────────────────────

async function authSignIn(email, password) {
  const { data, error } = await db.auth.signInWithPassword({ email, password });
  return { data, error };
}

async function authSignUp(email, password, nome) {
  const { data, error } = await db.auth.signUp({
    email, password,
    options: { data: { nome } }
  });
  return { data, error };
}

async function authSignOut() {
  await db.auth.signOut();
  window.location.reload();
}

async function authGetUser() {
  const { data: { user } } = await db.auth.getUser();
  return user;
}

// ── Session listener — initialized by initAuth() in auth.js ──
// Do not call showAuth/showApp here — scripts may not be loaded yet.

// ── Deferred session listener ─────────────────────────
// Supabase fires onAuthStateChange before other scripts load.
// We poll until showAuth/showApp are defined, then register.
function _waitForAuth() {
  if (typeof showAuth === 'function' && typeof showApp === 'function') {
    db.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        showAuth();
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        showApp(session.user);
      }
    });
  } else {
    setTimeout(_waitForAuth, 50);
  }
}
_waitForAuth();
