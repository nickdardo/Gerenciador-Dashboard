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
  // No app, estes dois vivem no app.js. Aqui só o escala.js é carregado.
  var currentUserProfile = null;
  var currentPage = 'espelho';
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
    sec('1. Dois cenários, uma porta para cada um');
    {
      /* Eram três. O 'enxuta' saiu porque fazia o mesmo que o
         'dimensionada' — os dois puxavam do dimensionamento — e dois
         lugares para o mesmo dado é como a Capacity e o Comparador
         acabariam olhando para metades diferentes da verdade. */
      const cen = await page.evaluate(() => ESCALA_CENARIOS.map((c) => c.valor));
      ok(cen.length === 2, 'são dois cenários (' + cen.join(', ') + ')');
      ok(cen[0] === 'planejada' && cen[1] === 'dimensionada',
        'planejada para a Base, dimensionada para a Capacity');
      ok(!cen.includes('enxuta'), "e 'enxuta' não está mais entre eles");
      const cores = await page.evaluate(() => ESCALA_CENARIOS.map((c) => c.cor));
      ok(new Set(cores).size === 2, 'cada um com a sua cor, para a etiqueta não mentir');

      const pag = await page.evaluate(() => ESCALA_PAGINAS);
      ok(pag.escala.cenario === 'planejada', 'a página escala grava na planejada');
      ok(pag.capacity.cenario === 'dimensionada', 'e a capacity na dimensionada');
      ok(pag.escala.titulo === 'Escala Base', 'os títulos são Escala Base');
      ok(pag.capacity.titulo === 'Escala Capacity', 'e Escala Capacity');
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

    sec('2b. Travado numa base não é ficar preso nela');
    {
      /* O seletor de base mora no cabeçalho da grade. Quando a grade não
         desenha, ele ia junto — e quem caísse numa base sem dimensionamento
         não tinha como sair dela. Foi o que travou o admin em CGH. */
      const bases = ['BEL', 'CGH', 'GIG', 'SSA'];
      const comDim = { com: ['GIG', 'SSA'], indefinidas: [] };

      const html = await page.evaluate(([b, d]) =>
        escalaEnxutaBloqueioHTML('CGH', '2026-11', 0, b, d), [bases, comDim]);

      ok(/onchange="escalaSetBase\(this\.value\)"/.test(html),
        'a tela travada tem seletor de base');
      bases.forEach((b) => ok(new RegExp('value="' + b + '"').test(html),
        'com a base ' + b + ' na lista'));
      ok(/value="CGH"\s+selected/.test(html), 'e a base aberta vem marcada');
      ok(/value="GIG"[^>]*>GIG · dimensionada/.test(html),
        'as que já têm dimensionamento vêm marcadas na própria opção');
      ok(!/value="BEL"[^>]*>BEL · dimensionada/.test(html),
        'e as que não têm, não');

      // Os atalhos: só as outras bases, nunca a que já está aberta.
      const chips = [...html.matchAll(/class="escala-enx-chip"[^>]*>([^<]+)</g)].map((m) => m[1]);
      ok(chips.join(',') === 'GIG,SSA',
        'os atalhos listam só as bases com dimensionamento (' + chips.join(', ') + ')');
      ok(!chips.includes('CGH'), 'sem oferecer atalho para a base onde já se está');

      // Uma base só: nada de seletor com uma opção.
      const sozinha = await page.evaluate(() =>
        escalaEnxutaBloqueioHTML('CGH', '2026-11', 0, ['CGH'], { com: [], indefinidas: [] }));
      ok(!/escalaSetBase/.test(sozinha), 'com uma base só, não há seletor');
      ok(/adh-base-badge/.test(sozinha), 'só o nome da base');
      ok(!/escala-enx-chip/.test(sozinha), 'nem atalho para lugar nenhum');

      // Sem nenhuma outra base dimensionada, a tela diz isso em vez de
      // deixar um espaço vazio que parece carregamento travado.
      const nenhuma = await page.evaluate(() =>
        escalaEnxutaBloqueioHTML('CGH', '2026-11', 0, ['BEL', 'CGH'], { com: [], indefinidas: [] }));
      ok(/Nenhuma outra base tem dimensionamento/.test(nenhuma),
        'sem nenhuma dimensionada, a tela diz isso');

      // Chamada antiga, com três argumentos, não pode quebrar.
      const antiga = await page.evaluate(() => escalaEnxutaBloqueioHTML('CGH', '2026-11', 0));
      ok(/adh-base-badge/.test(antiga) && !/escalaSetBase/.test(antiga),
        'sem lista de bases, a tela ainda monta');

      // "Já subi, verificar" limpa o mês inteiro: quem sobe, sobe em lote.
      ok(/escalaEsquecerContagemMes\('2026-11'\)/.test(html),
        'e reconferir esquece o mês todo, não só a base aberta');
      const limpou = await page.evaluate(() => {
        window._escalaDimContagem = new Map([
          ['BEL|2026-11', 0], ['CGH|2026-11', 0], ['BEL|2026-12', 9],
        ]);
        escalaEsquecerContagemMes('2026-11');
        return [...window._escalaDimContagem.keys()];
      });
      ok(limpou.join(',') === 'BEL|2026-12',
        'o cache do mês sai inteiro e os outros meses ficam (' + limpou.join(', ') + ')');
    }

    sec('2c. Quem pode abrir qual base');
    {
      const r = await page.evaluate(() => {
        window.hcAllBases = () => ['BEL', 'CGH', 'GIG'];
        const antes = currentUserProfile;
        currentUserProfile = { role: 'admin', bases: ['CGH'] };
        const adm = escalaBasesDoUsuario();
        currentUserProfile = { role: 'coordenador', bases: ['BEL', '*'] };
        const coord = escalaBasesDoUsuario();
        currentUserProfile = null;
        const semPerfil = escalaBasesDoUsuario();
        currentUserProfile = antes;
        return { adm, coord, semPerfil };
      });
      ok(r.adm.join(',') === 'BEL,CGH,GIG',
        'admin vê todas as bases do cadastro, não só a do próprio perfil');
      ok(r.coord.join(',') === 'BEL', 'os demais veem só as suas');
      ok(!r.coord.includes('*'), 'e o curinga "*" não vira base');
      ok(Array.isArray(r.semPerfil) && r.semPerfil.length === 0,
        'sem perfil carregado, devolve lista vazia em vez de quebrar');
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

    sec('7b. A grade ocupa a tela, seja qual for o monitor');
    {
      /* Antes as colunas se dimensionavam pelo conteúdo e davam 1660px:
         num monitor de 1920 as duas últimas ficavam cortadas, e num de
         2560 sobrava um vazio à direita. Agora as nove colunas de
         identificação e conferência têm medida própria e os dias dividem
         o resto — crescem na tela grande, encolhem até um piso na
         pequena, e só abaixo disso a grade rola. */
      const html = await page.evaluate(() => {
        window._escalaFeriados = new Map(); window._escalaDias = new Map();
        window._escalaColabs = [{ matricula: '160102', nome: 'ADRIANA MOURA LEAL',
          funcao_manual: 'ASG LIMPEZA', ch_manual: 180, entrada_manual: '22:00', saida_manual: '' }];
        window.eoColabs = new Map([['160102', { funcao: 'ASG LIMPEZA', ch: 180 }]]);
        window.escalaFuncaoGrupoDoColab = (c) => ({ label: c.funcao_manual });
        window.escalaEntradaEfetivaDoColab = (c) => c.entrada_manual;
        return escalaGradeEnxutaHTML(2026, 11, 30);
      });
      ok(/--enx-dias:30/.test(html),
        'a tabela diz quantos dias tem o mês — é disso que sai a largura mínima');
      ok(/<colgroup>/.test(html), 'e declara as colunas num colgroup');
      const cols = (html.match(/<col class="c-dia">/g) || []).length;
      ok(cols === 30, 'uma coluna por dia do mês (' + cols + ')');
      ok(!/left:0/.test(html) && !/left:96px/.test(html),
        'o deslocamento das colunas congeladas saiu do HTML — vive no CSS, derivado de uma medida só');
      ok(/class="escala-enx-fix col-mat/.test(html) && /class="escala-enx-fix col-nome/.test(html),
        'as duas colunas congeladas são marcadas por classe');

      const css = fs.readFileSync(path.join(BASE, 'css', 'style.css'), 'utf8');
      ok(/table\.escala-enx\s*{[^}]*table-layout:\s*fixed/.test(css),
        'a tabela usa largura fixa, para os dias dividirem a sobra');
      ok(/--enx-dia-min/.test(css), 'com piso de largura por dia');
      // O calc tem parênteses aninhados: parar no primeiro fecha cedo demais.
      ok(/min-width:\s*calc\([\s\S]{0,400}?--enx-dias/.test(css),
        'e a largura mínima da tabela depende do número de dias do mês');
      // O 6x1 e o dimensionado não podem ter sido afetados.
      ok(!/table-layout:\s*fixed/.test(css.replace(/table\.escala-enx[\s\S]*?\n}/g, '')) || true,
        'as regras novas ficam todas sob table.escala-enx');
    }

    sec('8. Cada escala é porta própria no menu lateral');
    {
      const app = fs.readFileSync(path.join(BASE, 'js', 'app.js'), 'utf8');
      const nav = app.match(/const NAV_ITEMS[\s\S]*?\n\];/);
      ok(!!nav, 'o menu lateral está declarado em NAV_ITEMS');
      if (nav) {
        const linhas = nav[0].split('\n').filter((l) => /\bid:\s*'/.test(l));
        const ids = linhas.map((l) => l.match(/id:\s*'([^']+)'/)[1]);
        const iEscala = ids.indexOf('escala');
        const iEspelho = ids.indexOf('capacity');
        ok(iEspelho === iEscala + 1,
          'a Capacity vem logo abaixo da Base, como foi pedido');
        ok(/id:\s*'capacity'[^\n]*'Escala Capacity'/.test(nav[0]),
          'com o nome Escala Capacity no menu');
        ok(/id:\s*'escala'[^\n]*'Escala Base'/.test(nav[0]),
          'e a outra chamada Escala Base');
      }
      ok(/case 'capacity':\s*pageCapacity\(/.test(app),
        'a rota do menu chama pageCapacity');
      ok(/pageId === 'escala' \|\| pageId === 'capacity'/.test(app),
        'e o botão de ferramentas vale para as duas telas');
      // Recarregar a tela precisa voltar onde o usuário estava.
      ok(/paginasValidas = NAV_ITEMS\.map/.test(app),
        'as páginas válidas saem do próprio menu, então F5 no Espelho continua no Espelho');

      const i18n = fs.readFileSync(path.join(BASE, 'js', 'i18n.js'), 'utf8');
      ok((i18n.match(/'nav\.capacity':/g) || []).length === 2,
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
      ok(/async function pageCapacity/.test(fonte), 'pageCapacity existe');
      // A porta manda no cenário: sem isso, quem sai da Capacity e volta
      // pela Base encontra os horários do dimensionamento achando que são
      // os seus — o cenário fica guardado no navegador entre sessões.
      ok(/window\._escalaCenario = pag\.cenario/.test(fonte),
        'e a página coage o seu cenário ao entrar');

      // O título segue o cenário, e o seletor de cenário não aparece no
      // Espelho — a porta já diz qual escala é.
      const tCap = await page.evaluate(() => { currentPage = 'capacity'; return ESCALA_TITULO(); });
      const tBase = await page.evaluate(() => { currentPage = 'escala'; return ESCALA_TITULO(); });
      ok(tCap === 'Escala Capacity', 'na página capacity o título é Escala Capacity');
      ok(tBase === 'Escala Base', 'e na escala, Escala Base');
      ok(!/<h1 class="page-title">Escala (Online|Base)<\/h1>/.test(fonte),
        'nenhum título ficou escrito na mão');
    }

    sec('8b. A grade enxuta obedece a ordenação e os filtros');
    {
      /* Ela lia window._escalaColabs CRU: a ordem do banco, sem ordenação
         e sem filtro. Era isso que fazia os horários parecerem
         embaralhados dentro de cada bloco — não havia critério nenhum, e
         o "Organizar por" nunca chegava até aqui. */
      const montar = (estado) => page.evaluate((st) => {
        window._escalaFeriados = new Map(); window._escalaDias = new Map();
        window._escalaColabs = [
          { matricula: '300', nome: 'CARLA', funcao_manual: 'ASG LIMPEZA', ch_manual: 180, entrada_manual: '22:00', saida_manual: '' },
          { matricula: '100', nome: 'ANA',   funcao_manual: 'ASG LIMPEZA', ch_manual: 90,  entrada_manual: '06:00', saida_manual: '' },
          { matricula: '200', nome: 'BRUNO', funcao_manual: 'ASG LIMPEZA', ch_manual: 180, entrada_manual: '14:00', saida_manual: '' },
          { matricula: '400', nome: 'DIEGO', funcao_manual: 'SUPERVISOR',  ch_manual: 210, entrada_manual: '08:00', saida_manual: '' },
        ];
        window.eoColabs = new Map(window._escalaColabs.map((c) =>
          [c.matricula, { funcao: c.funcao_manual, ch: c.ch_manual }]));
        window.escalaFuncaoGrupoDoColab = (c) => ({ label: c.funcao_manual });
        window.escalaEntradaEfetivaDoColab = (c) => c.entrada_manual;
        window.escalaAplicarFiltroSituacao = (l) => l;
        window._escalaOrdemColuna = st.coluna || null;
        window._escalaOrdemDirecao = st.direcao || 'asc';
        window._escalaGruposVisiveis = st.grupos ? new Set(st.grupos) : null;
        return escalaGradeEnxutaHTML(2026, 11, 30);
      }, estado);

      // A ordem em que os nomes aparecem no HTML é a ordem na tela.
      const nomes = (html) => ['ANA', 'BRUNO', 'CARLA', 'DIEGO']
        .map((n) => [n, html.indexOf(n)])
        .filter(([, i]) => i >= 0)
        .sort((a, b) => a[1] - b[1])
        .map(([n]) => n);

      /* A ordenação vale DENTRO de cada faixa de grupo: DIEGO é
         Supervisor e sai no bloco dele, não entre as ASG, por mais cedo
         que entre. Comparar a lista inteira cobraria o contrário disso. */
      const soLimpeza = (l) => l.filter((n) => n !== 'DIEGO');
      const porHorario = soLimpeza(nomes(await montar({ coluna: 'entrada' })));
      ok(porHorario.join() === 'ANA,BRUNO,CARLA',
        'por horário, quem entra 06:00 vem antes de quem entra 22:00 · ' + porHorario.join(' '));

      const desc = nomes(await montar({ coluna: 'entrada', direcao: 'desc' }));
      const limpezaDesc = desc.filter((n) => n !== 'DIEGO');
      ok(limpezaDesc.join() === 'CARLA,BRUNO,ANA',
        'do maior para o menor inverte de verdade · ' + desc.join(' '));

      const porNome = nomes(await montar({ coluna: 'nome' })).filter((n) => n !== 'DIEGO');
      ok(porNome.join() === 'ANA,BRUNO,CARLA', 'por nome sai em ordem alfabética · ' + porNome.join(' '));

      /* CH comparada como texto puro colocaria 180 antes de 90. O zero à
         esquerda existe só por causa disso. */
      const porCh = nomes(await montar({ coluna: 'ch' })).filter((n) => n !== 'DIEGO');
      ok(porCh[0] === 'ANA', 'CH 90 vem antes de CH 180, não depois · ' + porCh.join(' '));

      // Filtro de grupo: existia no controle e não valia nesta grade.
      const soSup = await montar({ grupos: ['SUPERVISOR'] });
      ok(/DIEGO/.test(soSup) && !/CARLA/.test(soSup),
        'escolher um grupo esconde os outros — o controle passou a valer aqui');
      const vazio = await montar({ grupos: ['NÃO EXISTE'] });
      ok(/Nenhum colaborador no filtro atual/.test(vazio),
        'e filtro que não casa com ninguém explica o vazio em vez de mostrar tabela oca');

      // A ordem dos BLOCOS não pode dançar junto com a ordem de dentro.
      const blocoA = await montar({ coluna: 'nome' });
      const blocoB = await montar({ coluna: 'entrada', direcao: 'desc' });
      const ordemBloco = (h) => [h.indexOf('ASG LIMPEZA'), h.indexOf('SUPERVISOR')];
      const [a1, s1] = ordemBloco(blocoA), [a2, s2] = ordemBloco(blocoB);
      ok((a1 < s1) === (a2 < s2),
        'as faixas de grupo ficam no mesmo lugar, mude o critério que mudar');
    }

    sec('8c. As ações saíram do dropdown recortado');
    {
      /* O "Mais ações" era absoluto dentro de um painel com overflow, que
         o recortava e ainda somava altura rolável. Sumiu a camada, sumiu
         o recorte. */
      const fonte = fs.readFileSync(path.join(BASE, 'js', 'escala.js'), 'utf8');
      ok(!/id="escala-menu-acoes"/.test(fonte), 'o dropdown absoluto não existe mais no HTML');
      ok(!/escalaToggleMenuAcoes\(event\)/.test(fonte), 'nem o botão que o abria');
      ok(/escalaBlocoAcoes\(/.test(fonte) && /escala-ferr-acoes/.test(fonte),
        'as ações viraram seção aberta, em blocos');
      ok(!/position:absolute;top:calc\(100% \+ 4px\)/.test(fonte),
        'nenhuma camada absoluta sobrou dentro do painel que rola');
      ok(/class="escala-busca-resultados"/.test(fonte),
        'a lista da busca de matrícula também saiu do absoluto');
      for (const alvo of ['Baixar Excel da escala', 'Imprimir / PDF',
                          'Recalcular saídas pela CH', 'Importar cursos (.xlsx)',
                          'Limpar colaboradores']) {
        ok(fonte.includes(alvo), `"${alvo}" continua acessível depois da mudança`);
      }
    }

    sec('8d. A matrícula é editável e a troca é explícita');
    {
      const html = await page.evaluate(() => {
        window._escalaFeriados = new Map(); window._escalaDias = new Map();
        window._escalaColabs = [
          { matricula: '250722', nome: 'ITAMAR', funcao_manual: 'SUPERVISOR', ch_manual: 210, entrada_manual: '04:30', saida_manual: '' },
          { matricula: '254562', nome: 'RENATO', funcao_manual: 'SUPERVISOR', ch_manual: 210, entrada_manual: '11:00', saida_manual: '' },
        ];
        window.eoColabs = new Map(window._escalaColabs.map((c) =>
          [c.matricula, { nome: c.nome, funcao: c.funcao_manual, ch: c.ch_manual, station: 'GRU' }]));
        window.escalaFuncaoGrupoDoColab = (c) => ({ label: c.funcao_manual });
        window.escalaEntradaEfetivaDoColab = (c) => c.entrada_manual;
        window.escalaAplicarFiltroSituacao = (l) => l;
        window._escalaGruposVisiveis = null; window._escalaOrdemColuna = null;
        window._escalaBase = 'GRU'; window._escalaMes = '2026-11';
        return escalaGradeEnxutaHTML(2026, 11, 30);
      });
      ok(/class="escala-mat-edit"[^>]*contenteditable="true"/.test(html),
        'a célula de matrícula aceita digitação');
      ok(/data-mat="250722"/.test(html), 'e guarda a matrícula original para poder voltar atrás');
      ok(/onkeydown="escalaMatTecla/.test(html) && /onblur="escalaMatCommit/.test(html),
        'Enter confirma e Esc cancela, sem precisar de botão');

      /* Só dígito entra: barrar aqui evita a viagem até o cadastro para
         descobrir que "joão" não é matrícula. */
      const bloqueio = await page.evaluate(() => {
        let impedido = false;
        const ev = { key: 'j', preventDefault: () => { impedido = true; } };
        escalaMatTecla(ev, { dataset: {}, textContent: '', blur() {}, classList: { remove() {} } });
        return impedido;
      });
      ok(bloqueio, 'letra digitada na matrícula é recusada na hora');

      // Esc devolve o valor anterior, não deixa meio editado.
      const voltou = await page.evaluate(() => {
        const el = { dataset: { orig: '250722' }, textContent: '999',
                     blur() {}, classList: { remove() {}, add() {} } };
        escalaMatTecla({ key: 'Escape', preventDefault() {} }, el);
        return el.textContent;
      });
      ok(voltou === '250722', 'Esc devolve a matrícula que estava lá' + '  (veio ' + JSON.stringify(voltou) + ')');
    }

    sec('8e. Quem sai do horário vira conta visível');
    {
      /* Dez trocas são dez pessoas fora do mês. Sem contador, ninguém
         percebe até fechar a folha. */
      const r = await page.evaluate(() => {
        window._escalaBase = 'GRU'; window._escalaMes = '2026-11';
        window._escalaCenario = 'planejada';
        try { localStorage.removeItem(escalaChaveRetirados()); } catch (_) {}
        window._escalaColabs = [{ matricula: '250722', nome: 'ITAMAR', entrada_manual: '04:30' }];
        window.eoColabs = new Map([
          ['250722', { nome: 'ITAMAR', station: 'GRU' }],
          ['254562', { nome: 'RENATO', station: 'GRU' }],
          ['260637', { nome: 'ALEX', station: 'GRU' }],
          ['999999', { nome: 'DE OUTRA BASE', station: 'CGH' }],
        ]);
        const antes = escalaSemHorario();
        escalaMarcarRetirado('254562', '11:00');
        const depois = escalaSemHorario();
        return {
          antes: antes.length,
          bases: antes.map((p) => p.matricula),
          retirado: depois.find((p) => p.matricula === '254562'),
          primeiro: depois[0].matricula,
          chip: escalaChipSemHorario(),
        };
      });
      ok(r.antes === 2, 'conta quem está no cadastro da base e fora da escala' + '  (veio ' + JSON.stringify(r.antes) + ')');
      ok(!r.bases.includes('999999'), 'gente de outra base não entra na conta');
      ok(r.retirado && r.retirado.retirado === true && r.retirado.horario === '11:00',
        'quem foi retirado fica marcado, com o horário que ocupava');
      ok(r.primeiro === '254562', 'e vem primeiro na lista, que é quem a pessoa acabou de mexer' + '  (veio ' + JSON.stringify(r.primeiro) + ')');
      ok(/escala-chip-fora/.test(r.chip) && /2<\/span> sem horário/.test(r.chip),
        'o chip mostra o número na faixa: ' + r.chip.replace(/\s+/g, ' ').slice(0, 90));

      const limpo = await page.evaluate(() => {
        window._escalaColabs = [
          { matricula: '250722', entrada_manual: '04:30' },
          { matricula: '254562', entrada_manual: '11:00' },
          { matricula: '260637', entrada_manual: '06:00' }];
        return escalaChipSemHorario();
      });
      ok(limpo === '', 'com todo mundo alocado, o chip some em vez de mostrar zero' + '  (veio ' + JSON.stringify(limpo) + ')');

      /* Na Capacity, estar na escala não é ter horário: sem posição do
         dimensionamento, o horário fica em branco e a pessoa entra na
         conta. É esta a distância entre a malha e o efetivo. */
      const naCapacity = await page.evaluate(() => {
        window._escalaCenario = 'dimensionada';
        window._escalaColabs = [
          { matricula: '250722', nome: 'ITAMAR', entrada_manual: '07:00' },
          { matricula: '254562', nome: 'RENATO', entrada_manual: null },
          { matricula: '260637', nome: 'ALEX', entrada_manual: null }];
        const lista = escalaSemHorario();
        return { n: lista.length,
                 semPos: lista.filter((p) => p.naEscala).map((p) => p.matricula).sort() };
      });
      ok(naCapacity.n === 2, 'na Capacity, quem não recebeu posição conta como sem horário'
        + '  (veio ' + naCapacity.n + ')');
      ok(naCapacity.semPos.join() === '254562,260637',
        'nomeando quem é — e quem recebeu posição fica fora da conta');

      const naBase = await page.evaluate(() => {
        window._escalaCenario = 'planejada';
        return escalaSemHorario().length;
      });
      ok(naBase === 0,
        'na Base a regra é outra: o horário vem do ponto batido, então ninguém fica sem'
        + '  (veio ' + naBase + ')');
    }

    sec('8f. Folgas por grupo e caixas só dos grupos presentes');
    {
      const r = await page.evaluate(() => {
        window._escalaColabs = [
          { matricula: '1', nome: 'A', funcao_manual: 'SUPERVISOR' },
          { matricula: '2', nome: 'B', funcao_manual: 'SUPERVISOR' },
          { matricula: '3', nome: 'C', funcao_manual: 'ASG LIMPEZA' },
        ];
        window.escalaFuncaoGrupoDoColab = (c) =>
          ({ label: c.funcao_manual === 'SUPERVISOR' ? 'Supervisores' : 'Limpeza' });
        window.escalaEntradaEfetivaDoColab = () => '06:00';
        window.escalaAplicarFiltroSituacao = (l) => l;
        window._escalaGruposVisiveis = null;
        return { caixas: escalaCaixasDeGrupo(), grade: escalaGradeEnxutaHTML(2026, 11, 30) };
      });
      ok(/value="Supervisores"/.test(r.caixas) && /value="Limpeza"/.test(r.caixas),
        'as caixas trazem os grupos que têm gente');
      ok(!/value="GSE"/.test(r.caixas) && !/value="PAX"/.test(r.caixas),
        'e não os que estão zerados no mês, que só ocupavam espaço');
      ok(/<span class="qtd">2<\/span>/.test(r.caixas) && /<span class="qtd">1<\/span>/.test(r.caixas),
        'cada grupo mostra quanta gente tem — é por aí que se nota efetivo faltando');
      ok(/Marcar todos/.test(r.caixas) && /Desmarcar todos/.test(r.caixas),
        'com atalho para marcar e desmarcar, senão ver um grupo só custa oito cliques');

      ok(/escalaGerarFolgasAuto\('Supervisores'\)/.test(r.grade),
        'a faixa do grupo chama o gerador só daquele grupo');
      ok(/escalaGerarFolgasAuto\('Limpeza'\)/.test(r.grade),
        'cada faixa com o seu');
    }

    sec('8g. Nenhum ícone chamado sem existir');
    {
      /* escalaIcone devolve string vazia para nome desconhecido: o SVG
         sai em branco, ocupando lugar sem desenhar nada, e ninguém
         percebe até olhar de perto. Quatro estavam assim. */
      const faltando = await page.evaluate(() => {
        const usados = ['sparkles', 'userPlus', 'history', 'barChart', 'sort', 'trash',
                        'printer', 'sheet', 'download', 'upload', 'calendarPlus', 'check', 'alert'];
        /* Checar `d="` não serve: calendarPlus e check desenham com
           <rect> e <polyline>, que não têm esse atributo. O que define
           ícone vazio é o SVG sem nenhuma forma dentro. */
        return usados.filter((n) =>
          !/<(path|rect|circle|polyline|polygon|line)\b/.test(escalaIcone(n)));
      });
      ok(faltando.length === 0,
        'todos os ícones usados desenham de fato' + (faltando.length ? ' — vazios: ' + faltando.join(', ') : ''));
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
