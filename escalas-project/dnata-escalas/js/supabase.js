// ══════════════════════════════════════════════════════
// SUPABASE CLIENT
// ══════════════════════════════════════════════════════
const SUPABASE_URL  = 'https://uxngpstmqqsdhlwjqcls.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV4bmdwc3RtcXFzZGhsd2pxY2xzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM1Mzk1NjEsImV4cCI6MjA5OTExNTU2MX0.0BVZX7wOGMhF5jIFv-lVvEZx1tF31-X-sQ8FGRmPJq4';

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON);

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

// ── Session listener ──────────────────────────────────
db.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_OUT' || !session) {
    showAuth();
  } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
    showApp(session.user);
  }
});
