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
      // A contagem ganhou um title explicando o número; a asserção olha o
      // conteúdo, não o formato exato da tag.
      ok(/class="qtd"[^>]*>2</.test(r.caixas) && /class="qtd"[^>]*>1</.test(r.caixas),
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

    sec('8h. A Capacity espelha a malha, não só quem tem gente');
    {
      /* A queixa: o dimensionamento de Limpeza pedia 274 horários, a
         tela mostrava 140 linhas, e os 134 que faltavam não existiam em
         lugar nenhum — nem como vaga, nem como número. Posição sem gente
         é o dado mais importante da Capacity: é o que falta contratar. */
      const montar = (cenario) => page.evaluate((cen) => {
        window._escalaBase = 'GRU'; window._escalaMes = '2026-11';
        window._escalaCenario = cen;
        window._escalaDias = new Map(); window._escalaFeriados = new Map();
        window._escalaGruposVisiveis = null; window._escalaOrdemColuna = null;
        // A malha pede 5 ASG (3 às 07:00, 2 às 16:00) e 2 ENC às 05:00.
        window._escalaPosicoesDim = [
          { funcao: 'ASG LIMPEZA I', entrada: '07:00', saida: '13:00', carga: 180, qtd: 3 },
          { funcao: 'ASG LIMPEZA I', entrada: '16:00', saida: '22:00', carga: 180, qtd: 2 },
          { funcao: 'ENC. DE LIMPEZA II', entrada: '05:00', saida: '11:00', carga: 180, qtd: 2 },
        ];
        window.escalaCarregarMapaDim = () =>
          ({ 'ASG LIMPEZA I': 'Limpeza', 'ENC. DE LIMPEZA II': 'Limpeza' });
        // Só duas pessoas, ambas às 07:00.
        window._escalaColabs = [
          { matricula: '1', nome: 'ANA', funcao_manual: 'ASG LIMPEZA I', ch_manual: 180, entrada_manual: '07:00' },
          { matricula: '2', nome: 'BIA', funcao_manual: 'ASG LIMPEZA I', ch_manual: 180, entrada_manual: '07:00' },
        ];
        window.eoColabs = new Map(window._escalaColabs.map((c) =>
          [c.matricula, { nome: c.nome, funcao: c.funcao_manual, ch: c.ch_manual, station: 'GRU' }]));
        window.escalaFuncaoGrupoDoColab = () => ({ label: 'Limpeza' });
        window.escalaAplicarFiltroSituacao = (l) => l;
        /* Declarado aqui de propósito: os stubs vivem na mesma página e
           atravessam seções. A 8f deixa este fixado em '06:00', e herdar
           isso fazia as duas pessoas das 07:00 não cobrirem posição
           nenhuma — falha do andaime, não do produto. */
        window.escalaEntradaEfetivaDoColab = (c) => c.entrada_manual || '';
        return escalaGradeEnxutaHTML(2026, 11, 30);
      }, cenario);

      const html = await montar('dimensionada');
      const vagas = (html.match(/escala-enx-vaga/g) || []).length;
      ok(vagas === 5, 'as 5 posições sem gente viram linha (veio ' + vagas + ')');
      ok(/7 horários dimensionados/.test(html),
        'a faixa diz quantos horários a malha pede');
      ok(/2 pessoas/.test(html), 'e quantas pessoas existem, para bater um com o outro');
      ok(/class="qtd difere"/.test(html),
        'quando os dois não batem, o número de pessoas fica em destaque');
      ok(/5 sem gente/.test(html), 'e a diferença sai explícita');

      /* Os horários das vagas são os da malha — 16:00 e 05:00 não têm
         ninguém, e é exatamente isso que tem de aparecer. */
      ok(html.includes('data-vaga-entrada="16:00"'), 'a vaga das 16:00 aparece com o horário dela');
      ok(html.includes('data-vaga-entrada="05:00"'), 'e a das 05:00 também');
      const seteZero = (html.match(/data-vaga-entrada="07:00"/g) || []).length;
      ok(seteZero === 1,
        'das 3 posições de 07:00, duas estão cobertas e sobra uma vaga (veio ' + seteZero + ')');

      /* A Base não tem malha: inventar vagas nela seria mostrar posição
         que a regra dela não conhece. */
      const base = await montar('planejada');
      ok(!/escala-enx-vaga/.test(base), 'a Base continua sem linhas de vaga');
      ok(!/horários dimensionados/.test(base), 'e sem o contador de malha, que não é regra dela');
    }

    sec('8i. Grupo que a malha pede e ninguém cobre não some da tela');
    {
      /* O caso mais grave some justamente por ser o mais grave: a grade
         era montada a partir dos colaboradores, então um grupo sem
         ninguém contratado não tinha faixa nenhuma. */
      const html = await page.evaluate(() => {
        window._escalaCenario = 'dimensionada';
        window._escalaPosicoesDim = [
          { funcao: 'OPERADOR DE EQUIPAMENTO', entrada: '06:00', saida: '12:00', carga: 180, qtd: 4 },
        ];
        window.escalaCarregarMapaDim = () => ({ 'OPERADOR DE EQUIPAMENTO': 'Operadores' });
        window.escalaEntradaEfetivaDoColab = (c) => c.entrada_manual || '';
        window._escalaColabs = [];
        window.eoColabs = new Map();
        window._escalaGruposVisiveis = null;
        return escalaGradeEnxutaHTML(2026, 11, 30);
      });
      ok(/Operadores/.test(html), 'o grupo sem ninguém aparece com faixa própria');
      ok((html.match(/escala-enx-vaga/g) || []).length === 4,
        'com as 4 posições que a malha pede, todas vazias');
      ok(/4 horários dimensionados/.test(html) && /0 pessoas/.test(html),
        'e os dois números dizendo exatamente isso');
    }

    sec('8j. Limpar colaboradores precisa durar a recarga');
    {
      /* O bug: a escala vazia era repovoada a partir do ponto batido, e
         GRAVADA no banco. Limpar, trocar de mês ou dar F5, e todos
         voltavam. A ação explícita da pessoa era desfeita sozinha, sem
         nada dizendo por quê.

         Para um mês novo o auto-preenchimento é conveniência; depois de
         um "Limpar colaboradores", é o contrário disso. */
      const r = await page.evaluate(() => {
        window._escalaBase = 'GRU'; window._escalaMes = '2026-11';
        const limpa = () => { try { localStorage.removeItem(escalaChaveEsvaziada('GRU', '2026-11')); } catch (_) {} };

        window._escalaCenario = 'planejada'; limpa();
        const mesNovo = escalaDeveAutoPopular('GRU', '2026-11', 0);
        const jaTemGente = escalaDeveAutoPopular('GRU', '2026-11', 12);

        escalaMarcarEsvaziada('GRU', '2026-11', true);
        const depoisDeLimpar = escalaDeveAutoPopular('GRU', '2026-11', 0);

        escalaMarcarEsvaziada('GRU', '2026-11', false);
        const voltouAoNormal = escalaDeveAutoPopular('GRU', '2026-11', 0);

        window._escalaCenario = 'dimensionada'; limpa();
        const naCapacity = escalaDeveAutoPopular('GRU', '2026-11', 0);
        window._escalaCenario = 'planejada';
        return { mesNovo, jaTemGente, depoisDeLimpar, voltouAoNormal, naCapacity };
      });

      ok(r.mesNovo === true, 'mês novo e vazio continua sendo preenchido sozinho');
      ok(r.jaTemGente === false, 'escala com gente nunca é repovoada por cima');
      ok(r.depoisDeLimpar === false,
        'depois de limpar, recarregar NÃO traz todo mundo de volta');
      ok(r.voltouAoNormal === true,
        'e adicionar alguém devolve o comportamento de mês novo');
      ok(r.naCapacity === false,
        'na Capacity nunca repovoa: ali o horário vem da malha, não do ponto batido');

      /* A marca é por cenário: esvaziar a Base não pode decidir pela
         Capacity, que tem regra própria. */
      const porCenario = await page.evaluate(() => {
        window._escalaCenario = 'planejada';
        const a = escalaChaveEsvaziada('GRU', '2026-11');
        window._escalaCenario = 'dimensionada';
        const b = escalaChaveEsvaziada('GRU', '2026-11');
        window._escalaCenario = 'planejada';
        return a !== b;
      });
      ok(porCenario, 'a marca de esvaziada é separada por cenário');
    }

    sec('8k. A tela vazia diz por que está vazia');
    {
      const r = await page.evaluate(() => {
        window._escalaCenario = 'planejada';
        window._escalaColabs = []; window._escalaPosicoesDim = [];
        window.eoColabs = new Map();
        window.escalaAplicarFiltroSituacao = (l) => l;
        try { localStorage.removeItem(escalaChaveEsvaziada('GRU', '2026-11')); } catch (_) {}
        const normal = escalaGradeEnxutaHTML(2026, 11, 30);
        escalaMarcarEsvaziada('GRU', '2026-11', true);
        const esvaziada = escalaGradeEnxutaHTML(2026, 11, 30);
        escalaMarcarEsvaziada('GRU', '2026-11', false);
        return { normal, esvaziada };
      });
      ok(/Nenhum colaborador nesta escala ainda/.test(r.normal),
        'mês novo diz que ainda não tem ninguém');
      ok(/Escala esvaziada por você/.test(r.esvaziada),
        'e escala limpa diz que foi você — não deixa a dúvida de se quebrou');
      ok(/não se preenche sozinha/.test(r.esvaziada),
        'explicando que ela não vai voltar sozinha');
    }

    sec('8l. Capacity abre cheia logo depois de subir o dimensionamento');
    {
      /* O caminho do Gerador: sobe o arquivo, clica em "Escala Capacity"
         e a tela abria EM BRANCO, pedindo "Preencher com Staff".

         A causa não era falta de gente — era o mapa de funções. O
         mapeamento "função do dimensionamento → grupo da escala" só é
         gravado quando a pessoa passa pela tela de mapeamento, e essa
         tela só aparece ao APLICAR. Até lá, mapa[funcao] era undefined e
         TODA posição era descartada em silêncio. A Capacity abria vazia
         exatamente no momento em que deveria estar mais cheia. */
      const r = await page.evaluate(() => {
        window._escalaBase = 'GRU'; window._escalaMes = '2026-11';
        window._escalaCenario = 'dimensionada';
        window._escalaDias = new Map(); window._escalaFeriados = new Map();
        window._escalaGruposVisiveis = null; window._escalaOrdemColuna = null;
        window._escalaColabs = []; window.eoColabs = new Map();
        window.escalaAplicarFiltroSituacao = (l) => l;
        window.escalaEntradaEfetivaDoColab = (c) => c.entrada_manual || '';
        window._escalaPosicoesDim = [
          { funcao: 'ASG LIMPEZA I', entrada: '07:00', saida: '13:00', carga: 180, qtd: 3 },
          { funcao: 'ASA', entrada: '05:00', saida: '11:00', carga: 180, qtd: 2 },
        ];
        // Nenhum mapeamento salvo — é o estado logo após subir o arquivo.
        window.escalaCarregarMapaDim = () => ({});
        try { localStorage.removeItem(escalaChaveEsvaziada('GRU', '2026-11')); } catch (_) {}
        const semMapa = escalaGradeEnxutaHTML(2026, 11, 30);

        // Com o mapeamento confirmado, a escolha da pessoa prevalece.
        window.escalaCarregarMapaDim = () => ({ 'ASG LIMPEZA I': 'Administração' });
        const comMapa = escalaGradeEnxutaHTML(2026, 11, 30);
        return { semMapa, comMapa };
      });

      ok(!/Nenhum colaborador nesta escala ainda/.test(r.semMapa),
        'a tela não abre mais em branco pedindo "Preencher com Staff"');
      ok((r.semMapa.match(/escala-enx-vaga/g) || []).length === 5,
        'as 5 posições do dimensionamento aparecem sem precisar de gente nenhuma');
      ok(/Limpeza/.test(r.semMapa),
        'a dedução automática acerta ASG como Limpeza');
      ok(/Auxiliar de Rampa/.test(r.semMapa),
        'e ASA como Auxiliar de Rampa, que é o nome que só o dimensionamento usa');
      ok(/3 horários dimensionados/.test(r.semMapa) && /2 horários dimensionados/.test(r.semMapa),
        'cada grupo com a contagem da malha dele');

      ok(/Administração/.test(r.comMapa),
        'quando existe mapeamento confirmado, ele vence a dedução');
      ok((r.comMapa.match(/escala-enx-vaga/g) || []).length === 5,
        'e as posições continuam todas lá, só em outro grupo');
    }

    sec('8m. Alocar staff é um ato só, e os dois excessos aparecem');
    {
      /* Eram dois passos e duas confirmações: trazer a base, depois casar
         os horários. Entre um e outro a Capacity ficava num estado que
         não serve para nada — gente dentro, horário nenhum — e quem
         parava ali achava que o painel tinha feito metade do serviço.

         E os dois excessos são a mesma resposta vista de lados opostos:
         posição sem gente é contratação; gente sem posição é alguém que
         a malha não pediu. Os dois precisam aparecer. */
      const r = await page.evaluate(() => {
        window._escalaBase = 'GRU'; window._escalaMes = '2026-11';
        window._escalaCenario = 'dimensionada';
        window._escalaDias = new Map(); window._escalaFeriados = new Map();
        window._escalaGruposVisiveis = null; window._escalaOrdemColuna = null;
        window.escalaAplicarFiltroSituacao = (l) => l;
        window.escalaEntradaEfetivaDoColab = (c) => c.entrada_manual || '';
        window.escalaFuncaoGrupoDoColab = () => ({ label: 'Limpeza' });
        window.escalaCarregarMapaDim = () => ({ 'ASG LIMPEZA I': 'Limpeza' });
        // A malha pede 2 posições às 07:00.
        window._escalaPosicoesDim = [
          { funcao: 'ASG LIMPEZA I', entrada: '07:00', saida: '13:00', carga: 180, qtd: 2 },
        ];
        // Três pessoas: duas casadas, uma que a malha não pediu.
        window._escalaColabs = [
          { matricula: '1', nome: 'ANA', ch_manual: 180, entrada_manual: '07:00' },
          { matricula: '2', nome: 'BIA', ch_manual: 180, entrada_manual: '07:00' },
          { matricula: '3', nome: 'CAIO', ch_manual: 180, entrada_manual: null },
        ];
        window.eoColabs = new Map(window._escalaColabs.map((c) =>
          [c.matricula, { nome: c.nome, funcao: 'ASG LIMPEZA I', ch: 180, station: 'GRU' }]));
        return escalaGradeEnxutaHTML(2026, 11, 30);
      });

      ok(/escala-enx-sem-posicao/.test(r),
        'quem ficou sem posição é marcado na linha, não some nem vira "--:--" sem explicação');
      ok(/não recebeu posição no dimensionamento/.test(r),
        'com o motivo dito por extenso ao passar o cursor');
      ok(!/escala-enx-vaga/.test(r),
        'e, com as 2 posições cobertas, não sobra vaga em branco');
      ok(/2 horários dimensionados/.test(r) && /3 pessoas/.test(r),
        'a faixa mostra os dois números, e é por eles que se vê o excesso');
      ok(/class="qtd difere"/.test(r),
        'marcando que eles não batem');
    }

    sec('8n. O convite para alocar aparece onde a pessoa está olhando');
    {
      const r = await page.evaluate(() => {
        window._escalaCenario = 'dimensionada';
        window._escalaColabs = []; window.eoColabs = new Map();
        window._escalaPosicoesDim = [
          { funcao: 'ASG LIMPEZA I', entrada: '07:00', saida: '13:00', carga: 180, qtd: 2 },
        ];
        window.escalaCarregarMapaDim = () => ({ 'ASG LIMPEZA I': 'Limpeza' });
        const comMalha = escalaGradeEnxutaHTML(2026, 11, 30);
        window._escalaColabs = [{ matricula: '1', nome: 'ANA', entrada_manual: '07:00' }];
        window.eoColabs = new Map([['1', { nome: 'ANA', funcao: 'ASG LIMPEZA I', ch: 180, station: 'GRU' }]]);
        const comGente = escalaGradeEnxutaHTML(2026, 11, 30);
        return { comMalha, comGente };
      });
      ok(/escala-enx-convite/.test(r.comMalha),
        'malha desenhada e ninguém dentro: o convite para alocar aparece');
      ok(/escalaAlocarStaffNosHorarios\(\)/.test(r.comMalha),
        'levando ao ato inteiro, não ao meio dele');
      ok(!/escala-enx-convite/.test(r.comGente),
        'com gente alocada, o convite sai da frente');
    }

    sec('8o. Preenchimento grupo a grupo, com os números que guiam');
    {
      /* Alocar a escala inteira de uma vez é tudo ou nada: se o resultado
         de um grupo não agrada, desfazer é refazer todos. Grupo a grupo,
         quem preenche trabalha na ordem que conhece e cada passo é
         pequeno o bastante para ser revisto.

         E o número que guia o trabalho é o de DISPONÍVEIS: quanta gente
         do grupo ainda há no cadastro para cobrir as posições abertas. É
         ele que precisa cair a cada alocação. */
      const r = await page.evaluate(() => {
        window._escalaBase = 'GRU'; window._escalaMes = '2026-11';
        window._escalaCenario = 'dimensionada';
        window._escalaDias = new Map(); window._escalaFeriados = new Map();
        window._escalaGruposVisiveis = null; window._escalaOrdemColuna = null;
        window.escalaAplicarFiltroSituacao = (l) => l;
        window.escalaEntradaEfetivaDoColab = (c) => c.entrada_manual || '';
        window.escalaFuncaoGrupoDoColab = (c) =>
          ({ label: /LIMPEZA/.test(c.funcao_manual || '') ? 'Limpeza' : 'Operadores' });
        window.escalaCarregarMapaDim = () => ({ 'ASG LIMPEZA I': 'Limpeza' });
        window.hcIsDesligado = () => false;
        window._escalaPosicoesDim = [
          { funcao: 'ASG LIMPEZA I', entrada: '07:00', saida: '13:00', carga: 180, qtd: 4 },
        ];
        window._escalaColabs = [
          { matricula: '1', nome: 'ANA', funcao_manual: 'ASG LIMPEZA I', ch_manual: 180, entrada_manual: '07:00' },
        ];
        // No cadastro: mais dois de Limpeza e um de outro grupo.
        window.eoColabs = new Map([
          ['1', { nome: 'ANA', funcao: 'ASG LIMPEZA I', ch: 180, station: 'GRU' }],
          ['2', { nome: 'BIA', funcao: 'ASG LIMPEZA I', ch: 180, station: 'GRU' }],
          ['3', { nome: 'CAIO', funcao: 'ASG LIMPEZA I', ch: 180, station: 'GRU' }],
          ['4', { nome: 'DANI', funcao: 'OPERADOR I', ch: 180, station: 'GRU' }],
          ['5', { nome: 'ELO', funcao: 'ASG LIMPEZA I', ch: 180, station: 'CGH' }],
        ]);
        return {
          html: escalaGradeEnxutaHTML(2026, 11, 30),
          disp: escalaDisponiveisDoGrupo('Limpeza').map((p) => p.matricula).sort(),
          ped: escalaPedidosDoGrupo('Limpeza'),
        };
      });

      ok(r.disp.join() === '2,3',
        'disponíveis são os do grupo, da base, fora da escala — e só eles · ' + r.disp.join());
      ok(/2 disponíveis no cadastro/.test(r.html),
        'o número aparece na faixa, que é onde se decide o próximo passo');
      ok(/Alocar este grupo/.test(r.html) && /escalaAlocarGrupo\('Limpeza'\)/.test(r.html),
        'com o botão que aloca só este grupo');
      ok(/escala-grupo-acao destaque/.test(r.html),
        'e ele fica sempre visível, não escondido atrás do cursor');
      ok(r.ped.dim === 4 && r.ped.extra === 0 && r.ped.total === 4,
        'a contagem separa o que veio do arquivo do que foi aberto à mão');
    }

    sec('8p. Posição extra é contada à parte da malha');
    {
      /* "O dimensionamento pede 274" e "abrimos mais 6 porque sobrava
         gente" são afirmações diferentes. Somar as duas num número só
         apaga a segunda, e com ela a pergunta de por que ela existe. */
      const r = await page.evaluate(() => {
        window._escalaPosicoesDim = [
          { funcao: 'ASG LIMPEZA I', entrada: '07:00', saida: '13:00', carga: 180, qtd: 4 },
          { funcao: 'ASG LIMPEZA I', entrada: '07:00', saida: '13:00', carga: 180, qtd: 2,
            setor: '__extra__' },
        ];
        window._escalaColabs = [];
        return { html: escalaGradeEnxutaHTML(2026, 11, 30), ped: escalaPedidosDoGrupo('Limpeza') };
      });
      ok(r.ped.dim === 4 && r.ped.extra === 2 && r.ped.total === 6,
        'quatro do arquivo mais duas abertas à mão · ' + JSON.stringify(r.ped));
      ok(/4 horários dimensionados/.test(r.html) && /\+2 extras/.test(r.html),
        'a faixa mostra os dois separados, não um total que esconde a diferença');
      ok((r.html.match(/escala-enx-vaga/g) || []).length === 6,
        'e as seis posições viram linha, extras inclusive');
      ok(/Posição extra/.test(r.html) && /escalaAbrirPosicaoExtra/.test(r.html),
        'com o caminho para abrir mais, quando sobrar gente');
    }

    sec('8q. "Preencher com Staff" sai da Capacity');
    {
      /* Era ele que trazia o efetivo SEM horário nenhum e produzia a
         escala com horários fora do dimensionamento. Na Base continua
         fazendo sentido: lá o horário vem do ponto. */
      const r = await page.evaluate(() => {
        const fonte = document.querySelector('script[src*="escala.js"]');
        window._escalaCenario = 'dimensionada';
        const cap = escalaEhCapacity();
        window._escalaCenario = 'planejada';
        const base = escalaEhCapacity();
        return { cap, base, temFonte: !!fonte };
      });
      ok(r.cap === true && r.base === false, 'o cenário distingue as duas escalas');
      const fonte = fs.readFileSync(path.join(BASE, 'js', 'escala.js'), 'utf8');
      ok(/escalaEhCapacity\(\) \? '' : `<button[^`]*escalaPreencherTodoStaff/.test(fonte),
        'o botão só é desenhado fora da Capacity');
      ok(/Alocar staff nos horários/.test(fonte),
        'e na Capacity o caminho é alocar na malha');
    }

    sec('8r. Quem desenha a grade carrega o dimensionamento');
    {
      /* O bug mais escorregadio desta série: a leitura das posições
         estava em escalaRenderDash — o DASHBOARD —, e a grade é desenhada
         por escalaRenderGrade. São funções e caminhos diferentes.

         _escalaPosicoesDim chegava vazio e a Capacity escrevia "nenhum
         colaborador" em cima de um dimensionamento que existia no banco.
         Quem abrisse o dashboard antes via a malha; quem fosse direto do
         Gerador, não. O sintoma dependia do caminho percorrido, que é o
         tipo de defeito que não se reproduz contando o que se fez — por
         isso a guarda é sobre QUEM carrega, não sobre o resultado. */
      const fonte = fs.readFileSync(path.join(BASE, 'js', 'escala.js'), 'utf8');
      const corpo = (nome) => {
        const i = fonte.indexOf(`async function ${nome}(`);
        if (i < 0) return '';
        // Até a próxima função de topo de arquivo.
        const j = fonte.indexOf('\nasync function ', i + 10);
        const k = fonte.indexOf('\nfunction ', i + 10);
        const fim = Math.min(j < 0 ? fonte.length : j, k < 0 ? fonte.length : k);
        return fonte.slice(i, fim);
      };

      const grade = corpo('escalaRenderGrade');
      ok(grade.length > 0, 'escalaRenderGrade existe e foi localizada');
      ok(/_escalaPosicoesDim\s*=/.test(grade),
        'ela carrega as posições do dimensionamento, em vez de contar com outra tela');
      ok(/escala_dimensionamento/.test(grade),
        'lendo a tabela diretamente');
      ok(grade.indexOf('_escalaPosicoesDim') < grade.indexOf('escalaGradeHTML')
         || grade.indexOf('escalaGradeHTML') < 0,
        'e carrega antes de montar o HTML, não depois');

      /* E a leitura é paginada: 1.000 posições num mês grande não é
         hipótese remota, e o corte do PostgREST é silencioso. */
      ok(/escalaPaginar\([\s\S]{0,300}escala_dimensionamento/.test(grade),
        'a leitura é paginada, como toda tabela que pode passar de mil linhas');
    }

    sec('8s. O filtro de grupos sempre tem saída');
    {
      /* O bug: a lista de caixas vinha só dos COLABORADORES. Numa
         Capacity recém-montada não há ninguém — só posições vazias — e a
         lista saía vazia. Quem tivesse marcado "Limpeza" não tinha caixa
         nenhuma para desmarcar: o filtro ficava preso, sem saída pela
         própria tela que o criou. */
      const r = await page.evaluate(() => {
        window._escalaCenario = 'dimensionada';
        window._escalaBase = 'GRU'; window._escalaMes = '2026-11';
        window._escalaColabs = [];            // ninguém na escala
        window.eoColabs = new Map();
        window.escalaCarregarMapaDim = () => ({ 'ASG LIMPEZA I': 'Limpeza' });
        window._escalaPosicoesDim = [
          { funcao: 'ASG LIMPEZA I', entrada: '07:00', saida: '13:00', carga: 180, qtd: 3 },
        ];
        window._escalaGruposVisiveis = new Set(['Limpeza']);
        const presa = escalaCaixasDeGrupo();

        // Um grupo escolhido que nem existe mais no mês: ainda assim
        // precisa aparecer, senão não há como desescolhê-lo.
        window._escalaGruposVisiveis = new Set(['GSE']);
        const sumido = escalaCaixasDeGrupo();
        return { presa, sumido };
      });

      ok(/value="Limpeza"/.test(r.presa),
        'com ninguém na escala, o grupo da malha ainda aparece para ser desmarcado');
      ok(!/Nenhum colaborador carregado/.test(r.presa),
        'e a lista não vem vazia, que era o que prendia o filtro');
      ok(/Marcar todos/.test(r.presa) && /Desmarcar todos/.test(r.presa),
        'com os atalhos de saída sempre à mão');
      ok(/value="GSE"/.test(r.sumido),
        'grupo escolhido que sumiu do mês continua listado — senão não há como largá-lo');
      ok(/0\/3/.test(r.presa),
        'a contagem mostra gente e posições: "0" sozinho pareceria grupo inexistente');
    }

    sec('8t. Marcar todos é o mesmo que não filtrar');
    {
      /* Guardar um conjunto com todos os grupos parece igual a não ter
         filtro, e não é: um grupo que aparecer no mês seguinte nasce
         escondido, e ninguém liga uma coisa à outra. */
      const r = await page.evaluate(() => {
        document.body.insertAdjacentHTML('beforeend',
          `<div id="escala-grupos-painel-teste"></div>`);
        const painel = document.createElement('div');
        painel.id = 'escala-grupos-painel';
        painel.innerHTML = ['Limpeza', 'Operadores', 'PAX']
          .map((g) => `<label><input type="checkbox" value="${g}" checked></label>`).join('');
        document.body.appendChild(painel);
        window._escalaPendentes = {};
        window._escalaFerrMenu = true;          // menu aberto: acumula em vez de aplicar

        escalaAtualizarGruposEscolhidos();
        const todosMarcados = window._escalaPendentes.grupos;

        painel.querySelectorAll('input')[0].checked = false;
        escalaAtualizarGruposEscolhidos();
        const umFora = window._escalaPendentes.grupos;

        painel.remove();
        window._escalaFerrMenu = false;
        return {
          todos: todosMarcados === null,
          parcial: umFora ? [...umFora].sort().join() : null,
        };
      });
      ok(r.todos === true, 'todas as caixas marcadas guarda "sem filtro", não um conjunto cheio');
      ok(r.parcial === 'Operadores,PAX', 'e desmarcar uma guarda exatamente as outras · ' + r.parcial);
    }

    sec('8u. A vaga vem no topo e com o mesmo desenho da linha de gente');
    {
      /* Duas coisas que pareciam estéticas e não eram.

         As vagas ficavam no fim do grupo, depois de todo mundo — e o fim
         é onde não se olha. O que falta contratar é a pergunta aberta do
         mês; a escala montada é a parte resolvida.

         E as células de dia da vaga eram de outra classe, lisas, sem o
         tingimento de domingo, sábado e feriado. A linha quebrava o
         alinhamento visual das colunas bem no lugar onde se compara uma
         linha com a outra. */
      const r = await page.evaluate(() => {
        window._escalaCenario = 'dimensionada';
        window._escalaBase = 'GRU'; window._escalaMes = '2026-11';
        window._escalaDias = new Map();
        window._escalaFeriados = new Map([['2026-11-15', { nome: 'Proclamação da República' }]]);
        window._escalaGruposVisiveis = null; window._escalaOrdemColuna = null;
        window.escalaAplicarFiltroSituacao = (l) => l;
        window.escalaEntradaEfetivaDoColab = (c) => c.entrada_manual || '';
        window.escalaFuncaoGrupoDoColab = () => ({ label: 'Limpeza' });
        window.escalaCarregarMapaDim = () => ({ 'ASG LIMPEZA': 'Limpeza' });
        window._escalaPosicoesDim = [
          { funcao: 'ASG LIMPEZA', entrada: '07:00', saida: '13:00', carga: 6, qtd: 2 },
        ];
        window._escalaColabs = [
          { matricula: '1', nome: 'COM HORARIO', ch_manual: 180, entrada_manual: '07:00' },
          { matricula: '2', nome: 'SEM HORARIO', ch_manual: 180, entrada_manual: null },
        ];
        window.eoColabs = new Map(window._escalaColabs.map((c) =>
          [c.matricula, { nome: c.nome, funcao: 'ASG LIMPEZA I', ch: 180, station: 'GRU' }]));
        return escalaGradeEnxutaHTML(2026, 11, 30);
      });

      const posVaga = r.indexOf('escala-enx-vaga');
      const posSem = r.indexOf('SEM HORARIO');
      const posCom = r.indexOf('COM HORARIO');
      ok(posVaga > 0 && posVaga < posSem,
        'a vaga vem antes de quem está sem horário');
      ok(posSem < posCom,
        'e quem está sem horário, antes de quem já está alocado');

      /* O tingimento do feriado e do domingo precisa existir também na
         linha de vaga, senão as colunas deixam de se corresponder. */
      const linhaVaga = r.slice(posVaga, r.indexOf('</tr>', posVaga));
      ok(/class="cel fer"/.test(linhaVaga),
        'a célula do feriado na linha de vaga tem a mesma classe da linha de gente');
      ok(/class="cel dom"/.test(linhaVaga) && /class="cel sab"/.test(linhaVaga),
        'domingo e sábado também');
      ok((linhaVaga.match(/class="cel/g) || []).length === 30,
        'uma célula por dia do mês, como qualquer outra linha');
      ok(!/class="dia vazia"/.test(linhaVaga),
        'sem a classe própria antiga, que não se alinhava com nada');
    }

    sec('8v. Limpar o dimensionamento apaga a malha, não a gente');
    {
      /* A terceira limpeza. As outras duas mexem em quem está na escala;
         esta mexe na MALHA — apaga as posições do Gerador para esta base
         e este mês, extras inclusive, e os horários que delas vieram.

         Serve para recomeçar quando o arquivo subiu errado. Enquanto a
         malha velha estiver no banco, a Capacity continua desenhando as
         posições dela, e subir um arquivo novo por cima não deixa claro
         o que ficou de qual. */
      const r = await page.evaluate(async () => {
        window._escalaBase = 'GRU'; window._escalaMes = '2026-11';
        window._escalaCenario = 'dimensionada';
        window._escalaDias = new Map([['1|5', { status: 'F' }]]);
        window._escalaFeriados = new Map();
        window.escalaFuncaoGrupoDoColab = () => ({ label: 'Limpeza' });
        window.escalaCarregarMapaDim = () => ({ 'ASG LIMPEZA': 'Limpeza' });
        window.escalaAplicarFiltroSituacao = (l) => l;
        window.escalaEntradaEfetivaDoColab = (c) => c.entrada_manual || '';
        window.escalaVerificarTravada = () => false;
        window.escalaMostrarLoading = () => {}; window.escalaLoadingAtualiza = () => {};
        window.escalaGradeAtualiza = () => {}; window.escalaMsg = (m) => { window.__msg = m; };
        window.confirm = () => true;

        window._escalaPosicoesDim = [
          { funcao: 'ASG LIMPEZA', entrada: '07:00', saida: '13:00', carga: 6, qtd: 4 },
          { funcao: 'ASG LIMPEZA', entrada: '16:00', saida: '22:00', carga: 6, qtd: 2, setor: '__extra__' },
        ];
        window._escalaColabs = [
          { matricula: '1', nome: 'ANA', entrada_manual: '07:00', saida_manual: '13:00' },
          { matricula: '2', nome: 'BIA', entrada_manual: null, saida_manual: null },
        ];
        window.eoColabs = new Map(window._escalaColabs.map((c) =>
          [c.matricula, { nome: c.nome, funcao: 'ASG LIMPEZA I', ch: 180, station: 'GRU' }]));

        const feito = { apagou: [], gravou: [] };
        window.db = { from(t) { return {
          delete() { const f = { filtros: {}, eq(c, v) { f.filtros[c] = v; return f; },
            then(r) { feito.apagou.push({ tabela: t, ...f.filtros }); return Promise.resolve({ error: null }).then(r); } };
            return f; },
          upsert(linhas) { feito.gravou.push({ tabela: t, linhas }); return Promise.resolve({ error: null }); },
        }; } };

        await escalaLimparDimensionamento();
        return {
          feito,
          posicoes: window._escalaPosicoesDim.length,
          colabs: window._escalaColabs.length,
          horarios: window._escalaColabs.map((c) => c.entrada_manual),
          folgas: window._escalaDias.size,
          msg: window.__msg,
        };
      });

      ok(r.feito.apagou.some((a) => a.tabela === 'escala_dimensionamento'
          && a.base === 'GRU' && a.mes === '2026-11'),
        'apaga as posições da base e do mês abertos');
      ok(!r.feito.apagou.some((a) => a.tabela === 'escala_colaborador'),
        'e NÃO apaga colaborador nenhum — para isso existe a outra limpeza');
      ok(r.colabs === 2, 'as duas pessoas continuam na escala  (veio ' + r.colabs + ')');
      ok(r.horarios.every((h) => h === null), 'mas sem horário, porque o horário vinha da malha');
      ok(r.folgas === 1, 'as folgas marcadas não são tocadas  (veio ' + r.folgas + ')');
      ok(r.posicoes === 0, 'a malha fica vazia na memória também, sem precisar recarregar');

      const grav = r.feito.gravou.find((g) => g.tabela === 'escala_colaborador');
      ok(grav && grav.linhas.length === 1,
        'só quem tinha horário é regravado — quem já estava sem não vira escrita à toa');
      ok(grav && grav.linhas[0].entrada_manual === null && grav.linhas[0].saida_manual === null,
        'com entrada e saída zeradas');
      ok(grav && grav.linhas[0].cenario === 'dimensionada',
        'e no cenário certo, sem alcançar a Escala Base');
      ok(/Gerador/.test(r.msg || ''),
        'a mensagem diz como montar a malha de novo: ' + r.msg);
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
