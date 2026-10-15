/* =====================================================================
   teste-contraste-escala.js — legibilidade dos códigos F, FA, L, J, K, CH

   Os códigos usavam a MESMA paleta nos dois temas: tintas claras sobre
   fundo a 18% de opacidade. No escuro funciona; no tema claro é tinta
   clara sobre papel branco — o K media 1,74 contra o fundo da própria
   célula no fim de semana, quando o mínimo legível é 4,5. Na prática
   sumia.

   Este teste lê os valores direto do style.css e refaz a conta contra o
   fundo REAL de cada célula — incluindo zebra, sábado/domingo e feriado,
   que são os piores casos e os que ninguém lembra de conferir no olho.

   Rodar:  node testes/teste-contraste-escala.js
   ===================================================================== */

'use strict';

const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;
const falhas = [];
const ok = (c, m) => { if (c) pass++; else { fail++; falhas.push(m); console.log('   \x1b[31m✗\x1b[0m ' + m); } };
const sec = (t) => console.log('\n\x1b[36m── ' + t + '\x1b[0m');

const ALVO = 4.5;   // WCAG AA para texto normal

/* ------------------------------------------------------------- cor */
const hex = (h) => {
  h = String(h).trim().replace('#', '');
  if (h.length === 3) h = [...h].map((c) => c + c).join('');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
};
// Composição alfa: a cor de cima com opacidade `a` sobre a de baixo.
const sobre = (fg, a, bg) => fg.map((v, i) => v * a + bg[i] * (1 - a));
const lum = (c) => {
  const s = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * s[0] + 0.7152 * s[1] + 0.0722 * s[2];
};
const contraste = (a, b) => {
  const l1 = lum(a), l2 = lum(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
};

/* ------------------------------------------- lê os tokens do CSS */
// Sem os comentários: eles ficam colados no seletor seguinte quando se
// fatia o arquivo por chaves, e um bloco de comentário antes do :root
// faria o seletor virar "…comentário… :root".
const css = fs.readFileSync(path.join(__dirname, '..', 'css', 'style.css'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, ' ');

// Pega o bloco do tema (o :root com --st-F, e o [data-theme="light"] com --st-F)
function blocoCom(token) {
  const blocos = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(css))) if (m[2].includes(token)) blocos.push({ sel: m[1].trim(), corpo: m[2] });
  return blocos;
}
function tokens(corpo) {
  const t = {};
  for (const m of corpo.matchAll(/--st-([A-Za-z]+)\s*:\s*(#[0-9a-fA-F]{3,6}|\d+%)/g)) t[m[1]] = m[2];
  return t;
}

const blocos = blocoCom('--st-F:');
const bRaiz  = blocos.find((b) => /(^|,)\s*:root\s*$/.test(b.sel) || b.sel === ':root');
const bClaro = blocos.find((b) => b.sel.includes('data-theme="light"'));

sec('1. Os tokens existem nos dois temas');
ok(!!bRaiz,  'o tema escuro define os códigos em :root');
ok(!!bClaro, 'o tema claro redefine os códigos em [data-theme="light"]');
if (!bRaiz || !bClaro) { resumo(); }

const TEMAS = {
  escuro: tokens(bRaiz.corpo),
  claro:  tokens(bClaro.corpo),
};

const CODIGOS = ['F', 'FA', 'L', 'K', 'CH', 'J'];

sec('2. Os seis códigos estão definidos — nenhum herdando cor de outro');
for (const tema of Object.keys(TEMAS)) {
  for (const c of CODIGOS) ok(!!TEMAS[tema][c], `${tema}: --st-${c} definido`);
  ok(!!TEMAS[tema].fill, `${tema}: --st-fill definido`);
  const vistos = CODIGOS.map((c) => TEMAS[tema][c]);
  ok(new Set(vistos).size === CODIGOS.length, `${tema}: as seis cores são distintas entre si`);
}

/* --------------------------------------- fundos reais da célula
   A pastilha é desenhada dentro de um <td> que pode ter cor própria
   (fim de semana, feriado) sobre uma linha que pode ser zebrada. O
   fundo da pastilha é a própria cor do código com --st-fill de
   opacidade. É a pilha inteira que decide se o texto aparece. */
const FUNDOS = {
  claro: [
    ['linha normal',  hex('#ffffff')],
    ['zebra',         hex('#f7f8fa')],
    ['fim de semana', sobre([0, 0, 0], 0.035, hex('#ffffff'))],
    ['fds + zebra',   sobre([0, 0, 0], 0.035, hex('#f7f8fa'))],
    ['feriado',       sobre(hex('#fc8181'), 0.08, hex('#ffffff'))],
  ],
  escuro: [
    ['linha normal',  hex('#1a2235')],
    ['zebra',         sobre(hex('#ffffff'), 0.08, hex('#1a2235'))],
    ['fim de semana', sobre(hex('#ffffff'), 0.03, hex('#1a2235'))],
    ['feriado',       sobre(hex('#fc8181'), 0.08, hex('#1a2235'))],
  ],
};

sec(`3. Contraste do código contra o fundo da própria pastilha (mínimo ${ALVO})`);
let pior = { v: Infinity, onde: '' };
for (const tema of ['claro', 'escuro']) {
  const alpha = parseFloat(TEMAS[tema].fill) / 100;
  console.log(`   ${tema} · fundo a ${TEMAS[tema].fill}`);
  console.log('     ' + 'fundo'.padEnd(16) + CODIGOS.map((k) => k.padStart(6)).join(''));
  for (const [nome, bg] of FUNDOS[tema]) {
    const vals = CODIGOS.map((c) => {
      const tinta = hex(TEMAS[tema][c]);
      const pastilha = sobre(tinta, alpha, bg);
      const v = contraste(tinta, pastilha);
      if (v < pior.v) pior = { v, onde: `${c} no ${tema}, ${nome}` };
      ok(v >= ALVO, `${tema} · ${nome} · ${c}: ${v.toFixed(2)} — abaixo de ${ALVO}, o código fica ilegível`);
      return v.toFixed(2).padStart(6);
    }).join('');
    console.log('     ' + nome.padEnd(16) + vals);
  }
}
console.log(`\n   pior caso: ${pior.v.toFixed(2)} (${pior.onde})`);

sec('4. O tema claro é escuro e o escuro é claro — não trocaram de lugar');
{
  // Erro fácil de cometer editando: copiar o bloco de um tema no outro.
  // A luminância média separa os dois sem depender de valores exatos.
  const media = (t) => CODIGOS.reduce((s, c) => s + lum(hex(TEMAS[t][c])), 0) / CODIGOS.length;
  ok(media('claro') < 0.25, `as tintas do tema claro são escuras (luminância média ${media('claro').toFixed(3)})`);
  ok(media('escuro') > 0.5, `as do tema escuro são claras (luminância média ${media('escuro').toFixed(3)})`);
}

sec('5. O chip de base do Espelho');
{
  /* O chip carrega o nome da base e é alvo de clique — é a saída de quem
     caiu numa base sem dimensionamento. O --blue da marca (#00a0d2) dava
     2,41 sobre o fundo claro do próprio chip, então o texto tem tom por
     tema, como os códigos. O fundo é o --blue a 10% (20% no hover) sobre
     o painel. */
  const bChip = blocoCom('--chip-base-txt:');
  const raiz  = bChip.find((b) => b.sel === ':root');
  const esc   = bChip.find((b) => b.sel.includes('data-theme="dark"'));
  ok(!!raiz, 'o tema claro define --chip-base-txt em :root');
  ok(!!esc,  'e o escuro redefine em [data-theme="dark"]');
  ok(/@media \(prefers-color-scheme: dark\)[\s\S]{0,200}--chip-base-txt:/.test(css),
    'com a preferência do sistema coberta também');

  if (raiz && esc) {
    const AZUL = hex('#00a0d2');
    const corDe = (corpo, nome) => {
      const m = corpo.match(new RegExp('--' + nome + '\\s*:\\s*(#[0-9a-fA-F]{3,6}|var\\(--blue\\))'));
      if (!m) return null;
      return m[1] === 'var(--blue)' ? AZUL : hex(m[1]);
    };
    const PAINEL = { claro: hex('#ffffff'), escuro: hex('#1a2235') };
    const casos = [
      ['claro',  raiz.corpo, PAINEL.claro],
      ['escuro', esc.corpo,  PAINEL.escuro],
    ];
    for (const [tema, corpo, painel] of casos) {
      for (const [estado, nome, op] of [['normal', 'chip-base-txt', 0.10],
                                        ['hover', 'chip-base-txt-hover', 0.20]]) {
        const txt = corDe(corpo, nome);
        ok(!!txt, `${tema}: o tom de texto do chip em ${estado} está definido`);
        if (!txt) continue;
        const r = contraste(txt, sobre(AZUL, op, painel));
        ok(r >= ALVO, `${tema}/${estado}: ${r.toFixed(2)} contra o fundo do chip (mínimo ${ALVO})`);
      }
    }
  }
}

sec('6. A legenda lê os mesmos tokens que a grade');
{
  ok(/\.escala-cod\.st-FA\s*,\s*\.escala-leg-cor\.st-FA/.test(css.replace(/\s+/g, ' ')),
    'pastilha e bolinha da legenda compartilham a regra de cor — não têm como divergir');
  const js = fs.readFileSync(path.join(__dirname, '..', 'js', 'escala.js'), 'utf8');
  ok(!/background:\$\{cor\}2e/.test(js), 'a célula não monta mais a cor no JS com hex fixo');
  ok(/class="escala-cod st-\$\{cod\}"/.test(js), 'a célula sai com classe, e a cor vem do tema');
}

function resumo() {
  console.log('\n' + '─'.repeat(58));
  if (!fail) console.log('\x1b[32m✓ ' + pass + ' verificações passaram\x1b[0m');
  else { console.log('\x1b[31m✗ ' + fail + ' falha(s) de ' + (pass + fail) + '\x1b[0m'); falhas.forEach((f, i) => console.log('  ' + (i + 1) + '. ' + f)); }
  console.log('─'.repeat(58));
  process.exit(fail ? 1 : 0);
}
resumo();
