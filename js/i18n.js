// ══════════════════════════════════════════════════════
// I18N + TEMA — fase 1
//
// Cobre só a "moldura" do app: tela de login, menu lateral e
// barra de topo. O conteúdo de cada módulo (Escala Online, Staff,
// Aderência, Admin) ainda é só em português e só no tema escuro —
// são milhares de strings e centenas de cores fixas espalhadas
// nesses arquivos, é uma frente à parte (ver conversa sobre escopo).
// ══════════════════════════════════════════════════════

const I18N = {
  pt: {
    'auth.entrar': 'Entrar',
    'auth.criarAcesso': 'Criar acesso',
    'auth.idioma': 'Idioma',
    'auth.emailCorporativo': 'Email corporativo',
    'auth.senha': 'Senha',
    'auth.confirmarSenha': 'Confirmar senha',
    'auth.nomeCompleto': 'Nome completo',
    'auth.seuNome': 'Seu nome',
    'auth.senhaPlaceholder': '••••••••',
    'auth.minimo8': 'Mínimo 8 caracteres',
    'auth.repitaSenha': 'Repita a senha',
    'auth.criarConta': 'Criar conta',
    'auth.entrando': 'Entrando...',
    'auth.criando': 'Criando...',
    'auth.hintLogin': 'Use seu email @dnata.com.br para acesso autorizado.',
    'auth.hintSignup': 'Apenas emails @dnata.com.br são autorizados.',
    'auth.erroCampos': 'Preencha todos os campos.',
    'auth.erroDominio': 'Use um email @dnata.com.br.',
    'auth.erroSenhaCurta': 'Senha deve ter no mínimo 8 caracteres.',
    'auth.erroSenhaDiferente': 'As senhas não coincidem.',
    'auth.contaCriada': 'Conta criada! Verifique seu email para confirmar.',
    'auth.erroLoginInvalido': 'Email ou senha incorretos.',
    'auth.erroEmailNaoConfirmado': 'Confirme seu email antes de entrar.',
    'auth.erroJaCadastrado': 'Este email já está cadastrado.',

    'nav.escala': 'Escala Online',
    'nav.aderencia': 'Aderência',
    'nav.staff': 'Staff',
    'nav.gerador': 'Gerador',
    'nav.comparador': 'Comparador',
    'nav.admin': 'Admin',
    'sb.modoClaro': 'Modo claro',
    'sb.modoEscuro': 'Modo escuro',
    'sb.sair': 'Sair',
  },
  en: {
    'auth.entrar': 'Sign in',
    'auth.criarAcesso': 'Create account',
    'auth.idioma': 'Language',
    'auth.emailCorporativo': 'Corporate email',
    'auth.senha': 'Password',
    'auth.confirmarSenha': 'Confirm password',
    'auth.nomeCompleto': 'Full name',
    'auth.seuNome': 'Your name',
    'auth.senhaPlaceholder': '••••••••',
    'auth.minimo8': 'Minimum 8 characters',
    'auth.repitaSenha': 'Repeat password',
    'auth.criarConta': 'Create account',
    'auth.entrando': 'Signing in...',
    'auth.criando': 'Creating...',
    'auth.hintLogin': 'Use your @dnata.com.br email for authorized access.',
    'auth.hintSignup': 'Only @dnata.com.br emails are authorized.',
    'auth.erroCampos': 'Fill in all fields.',
    'auth.erroDominio': 'Use a @dnata.com.br email.',
    'auth.erroSenhaCurta': 'Password must be at least 8 characters.',
    'auth.erroSenhaDiferente': 'Passwords do not match.',
    'auth.contaCriada': 'Account created! Check your email to confirm.',
    'auth.erroLoginInvalido': 'Incorrect email or password.',
    'auth.erroEmailNaoConfirmado': 'Confirm your email before signing in.',
    'auth.erroJaCadastrado': 'This email is already registered.',

    'nav.escala': 'Schedule Online',
    'nav.aderencia': 'Adherence',
    'nav.staff': 'Staff',
    'nav.gerador': 'Generator',
    'nav.comparador': 'Comparator',
    'nav.admin': 'Admin',

    'sb.atualizarDados': 'Refresh data',
    'sb.modoClaro': 'Light mode',
    'sb.modoEscuro': 'Dark mode',
    'sb.sair': 'Sign out',
  },
};

function idiomaAtual() {
  try { return localStorage.getItem('gde_idioma') || 'pt'; } catch (_) { return 'pt'; }
}

function t(chave) {
  const dic = I18N[idiomaAtual()] || I18N.pt;
  return dic[chave] || I18N.pt[chave] || chave;
}

// Troca o idioma e redesenha só o que já está na tela (login OU o shell do
// app — nunca os dois), sem precisar recarregar a página.
function setIdioma(idioma) {
  if (idioma !== 'pt' && idioma !== 'en') return;
  try { localStorage.setItem('gde_idioma', idioma); } catch (_) {}

  const authVisivel = document.getElementById('auth-shell')?.style.display !== 'none';
  if (authVisivel && typeof renderLogin === 'function') {
    const abaCriarAtiva = document.querySelector('.auth-tab.active')?.dataset.tab === 'signup';
    abaCriarAtiva ? renderSignup() : renderLogin();
    return;
  }
  if (typeof renderSidebar === 'function') {
    renderSidebar();
    renderTopbar();
    const item = (typeof NAV_ITEMS !== 'undefined') && NAV_ITEMS.find(n => n.id === currentPage);
    const titleEl = document.getElementById('tb-title');
    if (titleEl && item) titleEl.textContent = t(item.i18nKey);
  }
}

// ── Tema (claro/escuro) ────────────────────────────────
function temaAtual() {
  try { return localStorage.getItem('gde_tema') || 'dark'; } catch (_) { return 'dark'; }
}

function aplicarTema(tema) {
  document.documentElement.setAttribute('data-theme', tema === 'light' ? 'light' : 'dark');
}

function alternarTema() {
  const novo = temaAtual() === 'light' ? 'dark' : 'light';
  try { localStorage.setItem('gde_tema', novo); } catch (_) {}
  aplicarTema(novo);
  if (typeof renderSidebar === 'function' && document.getElementById('app-shell')?.style.display !== 'none') renderSidebar();
}

// Chamada bem cedo (antes do primeiro render), pra já abrir no tema salvo
// sem piscar do escuro pro claro.
function initTemaEIdioma() {
  aplicarTema(temaAtual());
}
initTemaEIdioma();
