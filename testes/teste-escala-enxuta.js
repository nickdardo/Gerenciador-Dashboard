/* =====================================================================
   teste-escala-enxuta.js — o terceiro cenário da Escala Online

   A Escala Enxuta é a grade reduzida ao que se usa para distribuir folga.
   Duas coisas a distinguem das outras e são o que está sob teste aqui:

   1. Ela NÃO abre sem o dimensionamento da base no mês. Montar folga sobre
      horário chutado é trabalho que se joga fora inteiro quando o arquivo
      certo chega, então a tela nem desenha a grade.

   2. As colunas "6 dias" e "Dom." do modelo em papel deixaram de ser
      campos digitados: conferem a cada clique, pelo mesmo validador que as
      outras telas usam.

   Rodar:  node testes/teste-escala-enxuta.js
   ===================================================================== */

'use strict';

const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const BASE = path.join(__dirname, '..');
let pass = 0, fail = 0;
const falhas = [];
const ok = (c, m) => { if (c) pass++; else { fail++; falhas.push(m); console.log('   \x1b[31m✗\x1b[0m ' + m); } };
const sec = (t) => console.log('\n\x1b[36m── ' + t + '\x1b[0m');

/* Página mínima: o CSS e o escala.js, com um `db` de mentira no lugar do
   Supabase. Cada teste decide o que a consulta ao dimensionamento devolve. */
function paginaDeTeste() {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<link rel="stylesheet" href="../css/style.css"></head><body>
<div id="topbar"></div>
<div id="page-content" class="pc-flex"></div>
<script>
  window.__dim = { count: 0, error: null };
  window.db = { from(tabela) {
    const resp = { data: [], error: null, count: 0 };
    const q = {
      select(){ if (tabela === 'escala_dimensionamento') { resp.count = window.__dim.count; resp.error = window.__dim.error; } return q; },
      eq(){ return q; }, order(){ return Promise.resolve(resp); },
      maybeSingle(){ return Promise.resolve(resp); },
      then(f){ return Promise.resolve(resp).then(f); },
    };
    return q;
  } };
<\/script>
<script src="../js/escala.js"><\/script>
</body></html>`;
}

(async () => {
  const tmp = path.join(BASE, 'testes', '.ui-escala-enxuta.html');
  fs.writeFileSync(tmp, paginaDeTeste());
  const url = 'file://' + tmp;
  const browser = await chromium.launch();
  const erros = [];
  const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
  page.on('pageerror', (e) => erros.push(e.message));
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.escalaCenario === 'function');

  try {
    sec('1. O cenário existe e não atropela os outros dois');
    {
      const cen = await page.evaluate(() => ESCALA_CENARIOS.map((c) => c.valor));
      ok(cen.length === 3, 'são três cenários (' + cen.join(', ') + ')');
      ok(cen[0] === 'planejada' && cen[1] === 'dimensionada',
        'Planejada e Dimensionada continuam onde estavam — a Enxuta entrou no fim');
      ok(cen[2] === 'enxuta', 'e a Enxuta é a terceira');
      const cores = await page.evaluate(() => ESCALA_CENARIOS.map((c) => c.cor));
      ok(new Set(cores).size === 3, 'cada cenário tem cor própria, para o seletor não mentir');
      ok(await page.evaluate(() => escalaCenario()) === 'planejada',
        'sem escolha salva, continua abrindo na Planejada');
    }

    sec('2. Sem dimensionamento, a grade não abre');
    {
      await page.evaluate(() => {
        window.__dim = { count: 0, error: null };
        window._escalaDimContagem = new Map();
        window._escalaBase = 'BEL'; window._escalaMes = '2026-11';
        window._escalaCenario = 'enxuta';
      });
      const n = await page.evaluate(() => escalaDimensionamentoContagem('BEL', '2026-11'));
      ok(n === 0, 'a contagem volta zero quando não há posição salva');

      const html = await page.evaluate(() => escalaEnxutaBloqueioHTML('BEL', '2026-11', 0));
      ok(/Falta o dimensionamento/.test(html), 'a tela diz o que falta');
      ok(/Gerador/.test(html), 'e manda para o Gerador, que é onde se sobe');
      ok(/Já subi, verificar/.test(html), 'com um caminho de volta para quem acabou de subir');
      ok(/Escala Online/.test(html), 'e a saída leva para a página da Escala Online');
      ok(/navigateTo\('escala'\)/.test(html),
        'navegando de verdade, porque o Espelho é página própria no menu lateral');
      ok(!/<table/.test(html), 'nenhuma grade é desenhada — é esse o ponto');
    }

    sec('3. Falha de consulta não vira "não existe"');
    {
      await page.evaluate(() => {
        window.__dim = { count: 0, error: { message: 'timeout' } };
        window._escalaDimContagem = new Map();
      });
      const n = await page.evaluate(() => escalaDimensionamentoContagem('BEL', '2026-12'));
      ok(n === -1, 'erro de banco devolve -1, não zero');
      const html = await page.evaluate(() => escalaEnxutaBloqueioHTML('BEL', '2026-12', -1));
      ok(/Não consegui ler/.test(html), 'e a tela diz que não conseguiu ler');
      ok(!/Falta o dimensionamento/.test(html),
        'sem acusar ausência de arquivo que pode muito bem existir');
      ok(/Tentar de novo/.test(html), 'oferecendo nova tentativa');
    }

    sec('4. A contagem fica em memória, mas não para sempre');
    {
      await page.evaluate(() => { window.__dim = { count: 7, error: null }; window._escalaDimContagem = new Map(); });
      ok(await page.evaluate(() => escalaDimensionamentoContagem('BEL', '2027-01')) === 7, 'lê do banco na primeira vez');
      await page.evaluate(() => { window.__dim = { count: 0, error: null }; });
      ok(await page.evaluate(() => escalaDimensionamentoContagem('BEL', '2027-01')) === 7,
        'e devolve de memória na segunda — a grade remonta a cada tecla digitada');
      await page.evaluate(() => escalaEsquecerContagemDim('BEL', '2027-01'));
      ok(await page.evaluate(() => escalaDimensionamentoContagem('BEL', '2027-01')) === 0,
        'depois de esquecer, consulta de novo — é como "Já subi, verificar" funciona');
    }

    sec('5. As conferências do modelo em papel');
    {
      // 6 dias: o validador é o mesmo das outras telas, então o que se
      // testa aqui é o limite que a coluna usa.
      /* Novembro de 2026 começa num DOMINGO: os domingos do mês são 1, 8,
         15, 22 e 29. Folgar de sete em sete a partir do dia 1 cairia em
         cinco domingos, não em um — foi onde eu mesmo tropecei ao escrever
         este teste. A escala 6x1 que fecha o mês com um domingo só é
         1, 7, 14, 21 e 28. */
      const r = await page.evaluate(() => {
        const semFolga = escalaValidarRegrasFolga([], 2026, 11, 30);
        const seisPorUm = escalaValidarRegrasFolga([1, 7, 14, 21, 28], 2026, 11, 30);
        const todoDomingo = escalaValidarRegrasFolga([1, 8, 15, 22, 29], 2026, 11, 30);
        const doisDomingos = escalaValidarRegrasFolga([1, 8], 2026, 11, 30);
        const semDomingo = escalaValidarRegrasFolga([3, 10, 17, 24], 2026, 11, 30);
        return {
          semFolga: semFolga.maxSequencia,
          seisPorUm: { seq: seisPorUm.maxSequencia, dom: seisPorUm.domingos },
          todoDomingo: todoDomingo.domingos,
          doisDomingos: doisDomingos.domingos,
          semDomingo: semDomingo.domingos,
        };
      });
      ok(r.semFolga === 30, 'mês inteiro sem folga acusa 30 dias seguidos');
      ok(r.seisPorUm.seq === 6, 'o 6x1 do mês fecha com no máximo 6 dias seguidos');
      ok(r.seisPorUm.dom === 1, 'e com exatamente um domingo de folga');
      ok(r.todoDomingo === 5, 'folgar todo domingo dá cinco, e a coluna reprova');
      ok(r.doisDomingos === 2, 'dois domingos são contados como dois — a coluna reprova');
      ok(r.semDomingo === 0, 'e nenhum domingo também reprova');
    }

    sec('6. A marca é desenhada, não digitada');
    {
      const sim = await page.evaluate(() => escalaMarcaRegra(true));
      const nao = await page.evaluate(() => escalaMarcaRegra(false));
      ok(/^<svg/.test(sim.trim()) && /^<svg/.test(nao.trim()),
        'as duas marcas são SVG');
      // ✓ e ✕ em caractere viram emoji colorido em algumas fontes, e a
      // grade é documento de trabalho.
      ok(!/[✓✔✕✖✗✘❌✅]/.test(sim + nao),
        'sem nenhum caractere de visto ou cruz no HTML');
      ok(/aria-label/.test(sim) && /aria-label/.test(nao), 'e cada uma se identifica para o leitor de tela');
      ok(sim !== nao, 'aprovado e reprovado desenham coisas diferentes');
    }

    sec('7. O dimensionamento passou a valer para dois cenários');
    {
      const fonte = fs.readFileSync(path.join(BASE, 'js', 'escala.js'), 'utf8');
      ok(!/escalaCenario\(\) !== 'dimensionada'/.test(fonte),
        'a trava que só deixava a Dimensionada aplicar o dimensionamento saiu');
      ok(/escalaCenario\(\) === 'planejada'/.test(fonte),
        'no lugar dela, só a Planejada é recusada');
      ok(/escalaEhEnxuta/.test(fonte), 'e existe o atalho que identifica a Enxuta');
    }

    sec('8. O Espelho é porta própria no menu lateral');
    {
      const app = fs.readFileSync(path.join(BASE, 'js', 'app.js'), 'utf8');
      const nav = app.match(/const NAV_ITEMS[\s\S]*?\n\];/);
      ok(!!nav, 'o menu lateral está declarado em NAV_ITEMS');
      if (nav) {
        const linhas = nav[0].split('\n').filter((l) => /\bid:\s*'/.test(l));
        const ids = linhas.map((l) => l.match(/id:\s*'([^']+)'/)[1]);
        const iEscala = ids.indexOf('escala');
        const iEspelho = ids.indexOf('espelho');
        ok(iEspelho === iEscala + 1,
          'e o Espelho vem logo abaixo da Escala Online, como foi pedido');
        ok(/id:\s*'espelho'[^\n]*'Espelho Escala'/.test(nav[0]),
          'com o nome Espelho Escala no menu');
      }
      ok(/case 'espelho':\s*pageEspelho\(/.test(app),
        'a rota do menu chama pageEspelho');
      ok(/pageId === 'escala' \|\| pageId === 'espelho'/.test(app),
        'e o botão de foco total vale para as duas telas');
      // Recarregar a tela precisa voltar onde o usuário estava.
      ok(/paginasValidas = NAV_ITEMS\.map/.test(app),
        'as páginas válidas saem do próprio menu, então F5 no Espelho continua no Espelho');

      const i18n = fs.readFileSync(path.join(BASE, 'js', 'i18n.js'), 'utf8');
      ok((i18n.match(/'nav\.espelho':/g) || []).length === 2,
        'o rótulo está traduzido nos dois idiomas');

      /* Chave sem tradução não quebra nada — o t() devolve a própria chave,
         e o menu passa a exibir "sb.atualizarDados". Foi assim que o rótulo
         de atualizar dados ficou cru em português. */
      const dic = i18n.match(/const I18N = (\{[\s\S]*?\n\});/)[1];
      const I18N = eval('(' + dic + ')');
      const usadas = new Set();
      for (const f of fs.readdirSync(path.join(BASE, 'js'))) {
        const s = fs.readFileSync(path.join(BASE, 'js', f), 'utf8');
        for (const x of s.matchAll(/\bt\(\s*'([^']+)'\s*\)/g)) usadas.add(x[1]);
      }
      const semPt = [...usadas].filter((k) => !I18N.pt[k]);
      const semEn = [...usadas].filter((k) => !I18N.en[k]);
      ok(semPt.length === 0, 'toda chave usada tem texto em português' + (semPt.length ? ': ' + semPt.join(', ') : ''));
      ok(semEn.length === 0, 'e em inglês' + (semEn.length ? ': ' + semEn.join(', ') : ''));

      // A porta entra no cenário enxuto; entrar pela Escala Online sai dele.
      const fonte = fs.readFileSync(path.join(BASE, 'js', 'escala.js'), 'utf8');
      ok(/async function pageEspelho/.test(fonte), 'pageEspelho existe');
      ok(/currentPage !== 'espelho'[\s\S]{0,200}'planejada'/.test(fonte),
        'e quem abre a Escala Online não cai no cenário do Espelho');

      // O título segue o cenário, e o seletor de cenário não aparece no
      // Espelho — a porta já diz qual escala é.
      const tituloEnxuta = await page.evaluate(() => {
        window._escalaCenario = 'enxuta'; return ESCALA_TITULO();
      });
      const tituloNormal = await page.evaluate(() => {
        window._escalaCenario = 'planejada'; return ESCALA_TITULO();
      });
      ok(tituloEnxuta === 'Espelho Escala', 'no cenário enxuto o título é Espelho Escala');
      ok(tituloNormal === 'Escala Online', 'nos outros, continua Escala Online');
      ok(!/<h1 class="page-title">Escala Online<\/h1>/.test(fonte),
        'nenhum título ficou escrito na mão');
    }

    sec('9. Nenhum erro de script');
    ok(erros.length === 0, 'a página carregou sem exceção' + (erros.length ? ': ' + erros.join(' | ') : ''));
  } finally {
    await browser.close();
    fs.unlinkSync(tmp);
  }

  console.log('\n' + '─'.repeat(58));
  if (!fail) console.log('\x1b[32m✓ ' + pass + ' verificações passaram\x1b[0m');
  else { console.log('\x1b[31m✗ ' + fail + ' falha(s) de ' + (pass + fail) + '\x1b[0m'); falhas.forEach((f, i) => console.log('  ' + (i + 1) + '. ' + f)); }
  console.log('─'.repeat(58));
  process.exit(fail ? 1 : 0);
})();
