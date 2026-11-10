/* =====================================================================
   teste-auditoria-malha.js — a cadeia inteira, do arquivo à linha na tela

   O dimensionamento percorre cinco formas até virar linha na escala:

     1. células da planilha        (uma por posição, repetidas)
     2. gRows                      (uma entrada por posição individual)
     3. escala_dimensionamento     (agregado por função+horário+carga, com qtd)
     4. malha                      (agrupado por grupo, expandido por qtd)
     5. linhas da grade            (uma por posição, com ou sem gente)

   Cada passo é uma oportunidade de somar ou perder. E o modo como esses
   erros aparecem é traiçoeiro: o TOTAL pode continuar certo enquanto a
   divisão por função está errada — foi exatamente o que aconteceu, com a
   faixa dizendo 136 (correto) e 13 linhas de ASG LIMPEZA onde o arquivo
   pedia 12 ASG e 1 ENC.

   Este arquivo confere as cinco formas contra a mesma origem, e cobra
   tanto o total quanto a divisão por função, por horário e por jornada.

   Rodar:  node testes/teste-auditoria-malha.js
   ===================================================================== */

'use strict';

const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const BASE = path.join(__dirname, '..');
let pass = 0, fail = 0;
const falhas = [];
const ok = (c, m) => { if (c) pass++; else { fail++; falhas.push(m); console.log('   \x1b[31m✗\x1b[0m ' + m); } };
const eq = (a, b, m) => ok(a === b, m + '  (esperado ' + JSON.stringify(b) + ', veio ' + JSON.stringify(a) + ')');
const sec = (t) => console.log('\n\x1b[36m── ' + t + '\x1b[0m');

/* O dimensionamento real de Limpeza em GRU, novembro/2026, como o
   Gerador o mostra. 125 ASG + 10 ENC + 1 SUPERVISOR = 136.

   O 00:00–06:00 aparece em DUAS funções de propósito: é o caso que
   quebrava, e é o único jeito de a asserção ter valor. */
/* A carga é DIÁRIA, como o Gerador a grava: o rótulo da planilha é
   "ASG LIMPEZA,6H" e o 6 vai para a tabela. Escrevi 180 na primeira
   versão deste arquivo, confundindo com a CH mensal do colaborador — e a
   auditoria acusou jornada nula em tudo, que é o que teria acontecido em
   produção se o valor errado viesse do código. */
const DIMENSIONAMENTO = [
  ['ASG LIMPEZA', '00:00', '06:00', 6, 12],
  ['ENC. LIMPEZA II', '00:00', '06:00', 6, 1],   // mesmo horário, outra função
  ['ASG LIMPEZA', '05:00', '08:00', 3, 3],
  ['ASG LIMPEZA', '06:00', '09:00', 3, 20],
  ['ASG LIMPEZA', '07:00', '13:00', 6, 10],
  ['ASG LIMPEZA', '07:00', '10:00', 3, 1],
  ['ASG LIMPEZA', '11:00', '14:00', 3, 8],
  ['ASG LIMPEZA', '12:00', '18:00', 6, 10],
  ['ASG LIMPEZA', '12:00', '15:00', 3, 3],
  ['ASG LIMPEZA', '13:00', '19:00', 6, 6],
  ['ASG LIMPEZA', '16:00', '22:00', 6, 3],
  ['ASG LIMPEZA', '16:00', '19:00', 3, 1],
  ['ASG LIMPEZA', '17:00', '21:00', 4, 17],
  ['ASG LIMPEZA', '20:00', '23:00', 3, 15],
  ['ASG LIMPEZA', '21:00', '01:00', 4, 1],
  ['ASG LIMPEZA', '21:00', '00:00', 3, 8],
  ['ASG LIMPEZA', '22:00', '04:00', 6, 4],
  ['ASG LIMPEZA', '22:00', '01:00', 3, 3],
  ['ENC. LIMPEZA II', '06:00', '12:00', 6, 9],
  ['SUPERVISOR LIMPEZA IV', '12:00', '19:00', 7, 1],
];

const linhasDB = () => DIMENSIONAMENTO.map(([funcao, entrada, saida, carga, qtd]) =>
  ({ funcao, entrada, saida, carga, qtd }));

const TOTAL = DIMENSIONAMENTO.reduce((n, l) => n + l[4], 0);

(async () => {
  const tmp = path.join(BASE, 'testes', '.auditoria.html');
  fs.writeFileSync(tmp, `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"></head><body>
<script src="file://${path.join(BASE, 'js', 'escala.js')}"><\/script></body></html>`);

  const browser = await chromium.launch();
  const page = await browser.newPage();
  const erros = [];
  page.on('pageerror', (e) => erros.push(e.message));
  await page.goto('file://' + tmp, { waitUntil: 'load' });

  const preparar = (linhas) => page.evaluate((ls) => {
    window._escalaBase = 'GRU'; window._escalaMes = '2026-11';
    window._escalaCenario = 'dimensionada';
    window._escalaDias = new Map(); window._escalaFeriados = new Map();
    window._escalaGruposVisiveis = null; window._escalaOrdemColuna = null;
    window._escalaPosicoesDim = ls;
    window.escalaCarregarMapaDim = () => ({});   // sem mapeamento: usa a dedução
    window.escalaAplicarFiltroSituacao = (l) => l;
    window.escalaEntradaEfetivaDoColab = (c) => c.entrada_manual || '';
    window.escalaFuncaoGrupoDoColab = () => ({ label: 'Limpeza' });
    window._escalaColabs = []; window.eoColabs = new Map();
  }, linhas);

  try {
    sec('1. O total do grupo bate com o arquivo');
    {
      await preparar(linhasDB());
      const r = await page.evaluate(() => escalaPedidosDoGrupo('Limpeza'));
      eq(r.total, 136, 'a malha pede o mesmo que o Gerador soma');
      eq(r.extra, 0, 'sem posições extras nesta conferência');
      eq(r.dim, 136, 'e todas vieram do arquivo');
    }

    sec('2. A divisão POR FUNÇÃO bate — era aqui que quebrava');
    {
      /* O total certo escondia a divisão errada. 12 ASG e 1 ENC às
         00:00 viravam 13 ASG, porque a chave da malha era só o horário.
         Conferir só o total nunca pegaria isso. */
      const r = await page.evaluate(() =>
        escalaVagasVaziasDoGrupo('Limpeza', [], 2026, 11, 30)
          .reduce((m, v) => { m[v.funcao] = (m[v.funcao] || 0) + 1; return m; }, {}));

      eq(r['ASG LIMPEZA'], 125, 'ASG LIMPEZA sai com as 125 do Gerador');
      eq(r['ENC. LIMPEZA II'], 10, 'ENC. LIMPEZA II com as 10 dele');
      eq(r['SUPERVISOR LIMPEZA IV'], 1, 'e o supervisor com a dele');
      eq(Object.values(r).reduce((a, b) => a + b, 0), 136, 'somando 136, sem sobra nem falta');
    }

    sec('3. Duas funções no mesmo horário não se misturam');
    {
      const r = await page.evaluate(() =>
        escalaVagasVaziasDoGrupo('Limpeza', [], 2026, 11, 30)
          .filter((v) => v.entrada === '00:00')
          .reduce((m, v) => { m[v.funcao] = (m[v.funcao] || 0) + 1; return m; }, {}));
      eq(r['ASG LIMPEZA'], 12, 'às 00:00 saem 12 ASG — não 13');
      eq(r['ENC. LIMPEZA II'], 1, 'e 1 ENC, que é de quem era a décima terceira');
    }

    sec('4. A jornada é a de cada função, não a da primeira linha');
    {
      /* O balde guardava a jornada da linha que o criou. Com 6H e 3H
         partilhando horário, as duas apareciam como uma só. */
      const r = await page.evaluate(() =>
        escalaVagasVaziasDoGrupo('Limpeza', [], 2026, 11, 30)
          .filter((v) => v.entrada === '07:00')
          .map((v) => `${v.funcao} ${v.jornada}h ${v.saida}`)
          .reduce((m, k) => { m[k] = (m[k] || 0) + 1; return m; }, {}));
      eq(r['ASG LIMPEZA 6h 13:00'], 10, 'as 10 de 6h saem como 6h');
      eq(r['ASG LIMPEZA 3h 10:00'], 1, 'e a de 3h como 3h, no mesmo horário de entrada');
    }

    sec('5. Cada posição vira exatamente uma linha na grade');
    {
      const html = await page.evaluate(() => escalaGradeEnxutaHTML(2026, 11, 30));
      const linhas = (html.match(/escala-enx-vaga/g) || []).length;
      eq(linhas, 136, 'a grade desenha uma linha por posição, nem mais nem menos');

      const asg = (html.match(/>ASG LIMPEZA</g) || []).length;
      eq(asg, 125, 'e o rótulo ASG LIMPEZA aparece 125 vezes, como no Gerador');
    }

    sec('6. Gente alocada abate posição da função certa');
    {
      /* Uma pessoa cobrindo as 00:00 tem de abater UMA posição — e a
         contagem por função precisa continuar fechando em 136. */
      const r = await page.evaluate(() => {
        const gente = [{ matricula: '1', nome: 'ANA', entrada_manual: '00:00', ch_manual: 180 }];
        const v = escalaVagasVaziasDoGrupo('Limpeza', gente, 2026, 11, 30);
        return { total: v.length,
                 porFuncao: v.reduce((m, x) => { m[x.funcao] = (m[x.funcao] || 0) + 1; return m; }, {}) };
      });
      eq(r.total, 135, 'uma pessoa cobre uma posição');
      eq(r.porFuncao['ASG LIMPEZA'] + r.porFuncao['ENC. LIMPEZA II'], 134,
        'e o abatimento sai das funções daquele horário, sem vazar para outras');
      eq(r.porFuncao['SUPERVISOR LIMPEZA IV'], 1, 'o supervisor, que entra 12:00, não é tocado');
    }

    sec('7. Nada se perde entre a tabela e a malha');
    {
      /* Guarda contra o erro mais silencioso: uma posição cujo grupo não
         é deduzido some sem aviso. A conferência é de soma: o que entra
         na malha tem de ser o que estava na tabela. */
      const r = await page.evaluate(() => {
        let naMalha = 0;
        for (const [, g] of escalaMalhaDoDimensionamento()) {
          for (const [, h] of g) naMalha += h.pedido;
        }
        const naTabela = (window._escalaPosicoesDim || [])
          .reduce((n, p) => n + (p.qtd || 1), 0);
        return { naMalha, naTabela };
      });
      eq(r.naMalha, r.naTabela, 'toda posição da tabela chega à malha');
      eq(r.naMalha, TOTAL, `e o total continua ${TOTAL}`);
    }

    sec('8. Função sem regra NÃO some — e é avisada');
    {
      /* O achado mais grave da auditoria, e o mais silencioso.

         O cadastro nunca devolve null: função que nenhuma regra pega vai
         para Administração. O dimensionamento devolvia null e a posição
         era DESCARTADA. Resultado real na base GRU: as 84 posições de
         "AUX. DE ESTEIRA" desapareciam da Capacity, enquanto as pessoas
         dessa função iam para Administração — posições num grupo, gente
         em outro, que é exatamente o que o comentário de
         escalaGrupoDaFuncao avisa que não pode acontecer.

         Agora o que as regras do dimensionamento não pegam cai nas
         regras do cadastro, então os dois lados concordam sempre. */
      await preparar([...linhasDB(),
        { funcao: 'AUX. DE ESTEIRA', entrada: '09:00', saida: '15:00', carga: 6, qtd: 84 }]);

      const r = await page.evaluate(() => {
        let naMalha = 0;
        for (const [, g] of escalaMalhaDoDimensionamento()) for (const [, h] of g) naMalha += h.pedido;
        const naTabela = (window._escalaPosicoesDim || []).reduce((n, p) => n + (p.qtd || 1), 0);
        return {
          naMalha, naTabela,
          grupoDim: escalaGrupoDaFuncaoDim('AUX. DE ESTEIRA'),
          grupoCadastro: escalaGrupoDaFuncao('AUX. DE ESTEIRA'),
          semRegra: escalaFuncoesSemRegra(),
          chip: escalaChipSemRegra(),
        };
      });

      eq(r.naMalha, r.naTabela, 'nenhuma posição se perde entre a tabela e a malha');
      eq(r.naMalha, 220, 'as 136 do arquivo mais as 84 da função sem regra');
      eq(r.grupoDim, r.grupoCadastro,
        'os dois lados classificam a mesma função no mesmo grupo — senão gente e posição se separam');

      ok(r.semRegra.some((f) => f.funcao === 'AUX. DE ESTEIRA' && f.qtd === 84),
        'e a classificação por palpite é CONTADA, não escondida');
      ok(/por classificar/.test(r.chip) && />84</.test(r.chip),
        'com aviso na faixa dizendo quantas são: ' + r.chip.replace(/\s+/g, ' ').slice(0, 80));
      ok(/ASG LIMPEZA/.test(r.chip) === false,
        'funções que têm regra própria não entram no aviso');
    }

    sec('9b. Encarregado não ocupa posição de ASG');
    {
      /* O caso real: às 05:00 o arquivo pede 3 ASG LIMPEZA de 3H
         (05:00–08:00) e 3 ENC. LIMPEZA II de 6H (05:00–11:00). O
         emparelhamento era por GRUPO, e em Limpeza convivem ASG, ENC e
         SUPERVISOR — todos na mesma fila. Um encarregado de CH 180 caía
         numa vaga de ASG de 3H: o horário batia, a função não, e a
         escala passava a afirmar que havia encarregado num horário que o
         dimensionamento não pede para encarregado nenhum.

         Os dois lados escrevem diferente — "ENC. LIMPEZA II" no arquivo,
         "ENC. DE LIMPEZA II" no cadastro — e é por isso que a comparação
         é por família, não por igualdade de texto. */
      const r = await page.evaluate(() => {
        window.escalaFuncaoGrupoDoColab = () => ({ label: 'Limpeza' });
        window.escalaEntradaEfetivaDoColab = (c) => c.entrada_manual || '';
        const vagas = [
          { grupo: 'Limpeza', funcaoDim: 'ASG LIMPEZA', jornada: 3, entrada: '05:00', saida: '08:00' },
          { grupo: 'Limpeza', funcaoDim: 'ENC. LIMPEZA II', jornada: 6, entrada: '05:00', saida: '11:00' },
        ];
        /* A encarregada vem PRIMEIRO na lista. Com o emparelhamento por
           grupo, as duas filas são ordenadas só pelo horário — e, com
           empate, a ordem de entrada decide. Assim a encarregada caía na
           primeira vaga, que é a de ASG. Era esta a coincidência que
           fazia a versão anterior deste teste passar nos dois casos e
           não provar nada. */
        const gente = [
          { matricula: '2', nome: 'ENCARREGADA', entrada_manual: '05:00' },
          { matricula: '1', nome: 'ASG UM', entrada_manual: '05:00' },
        ];
        window.eoColabs = new Map([
          ['1', { nome: 'ASG UM', funcao: 'ASG LIMPEZA I', ch: 90, station: 'GRU' }],
          ['2', { nome: 'ENCARREGADA', funcao: 'ENC. DE LIMPEZA II', ch: 180, station: 'GRU' }],
        ]);
        const c = escalaCasarVagasComPessoas(vagas, gente, 2026, 11, 30);
        return {
          porMatricula: Object.fromEntries(c.atribuicoes.map((a) => [a.matricula, `${a.entrada}–${a.saida}`])),
          trocas: c.trocasDeFuncao.length,
          familias: [escalaFamiliaDaFuncao('ENC. LIMPEZA II'),
                     escalaFamiliaDaFuncao('ENC. DE LIMPEZA II'),
                     escalaFamiliaDaFuncao('ASG LIMPEZA I')],
        };
      });

      eq(r.familias[0], r.familias[1],
        'as duas grafias de encarregado reduzem à mesma família: ' + r.familias[0]);
      ok(r.familias[0] !== r.familias[2],
        'e ASG é outra família, para não se confundirem: ' + r.familias[2]);

      eq(r.porMatricula['2'], '05:00–11:00',
        'a encarregada vai para a posição de ENC, de 6h — não para a de ASG');
      eq(r.porMatricula['1'], '05:00–08:00',
        'e a ASG fica com a de ASG, de 3h');
      eq(r.trocas, 0, 'sem ninguém cobrindo posição de outra função');
    }

    sec('9c. Sem gente certa, a vaga fica em branco');
    {
      /* Esta asserção já pediu o contrário: que o grupo cobrisse a
         posição quando não houvesse gente da família, para não deixar
         vaga vazia com gente parada ao lado.

         A regra mudou por decisão de quem usa, e com razão. Encaixar
         alguém de CH 180 numa posição de 3H não resolve nada: escreve na
         escala que aquela pessoa cumpre 3H, o que é falso, e some com a
         informação de que falta gente com aquela carga.

         O que tornou a vaga em branco aceitável não foi a regra — foi a
         tela. A posição vazia agora é uma LINHA, com horário, função e
         jornada, contada na faixa. Deixar em branco passou de esconder o
         problema a enunciá-lo. */
      const r = await page.evaluate(() => {
        const vagas = [{ grupo: 'Limpeza', funcaoDim: 'ENC. LIMPEZA II', jornada: 6, entrada: '05:00', saida: '11:00' }];
        const gente = [{ matricula: '1', nome: 'ASG UM', entrada_manual: '05:00' }];
        window.eoColabs = new Map([['1', { nome: 'ASG UM', funcao: 'ASG LIMPEZA I', ch: 90, station: 'GRU' }]]);
        const c = escalaCasarVagasComPessoas(vagas, gente, 2026, 11, 30);
        return { n: c.atribuicoes.length, trocas: c.trocasDeFuncao.length,
                 falta: c.porHorario.filter((h) => h.falta > 0).length,
                 sobrando: [...c.pessoasSobrando.values()].reduce((a, b) => a + b, 0) };
      });
      eq(r.n, 0, 'ninguém é encaixado numa posição de outra função');
      eq(r.trocas, 0, 'e não há troca de função a relatar, porque não houve troca');
      eq(r.falta, 1, 'a posição é reportada como descoberta');
      eq(r.sobrando, 1, 'e a pessoa, como sem posição — os dois lados ficam visíveis');
    }

    sec('9d. Jornada errada também deixa a vaga em branco');
    {
      /* O caso do print: posição de 3H às 05:00, e uma ASG de CH 180
         (6h/dia). A função casa, a jornada não. Antes ela entrava e a
         escala afirmava que cumpria 3H. */
      const r = await page.evaluate(() => {
        const vagas = [
          { grupo: 'Limpeza', funcaoDim: 'ASG LIMPEZA', jornada: 3, entrada: '05:00', saida: '08:00' },
          { grupo: 'Limpeza', funcaoDim: 'ASG LIMPEZA', jornada: 3, entrada: '05:00', saida: '08:00' },
        ];
        const gente = [
          { matricula: '1', nome: 'DE 3H', entrada_manual: '05:00' },
          { matricula: '2', nome: 'DE 6H', entrada_manual: '05:00' },
        ];
        window.eoColabs = new Map([
          ['1', { nome: 'DE 3H', funcao: 'ASG LIMPEZA I', ch: 90, station: 'GRU' }],
          ['2', { nome: 'DE 6H', funcao: 'ASG LIMPEZA I', ch: 180, station: 'GRU' }],
        ]);
        const c = escalaCasarVagasComPessoas(vagas, gente, 2026, 11, 30);
        return { alocados: c.atribuicoes.map((a) => a.matricula),
                 enxertos: c.enxertos.length,
                 falta: c.porHorario.reduce((n, h) => n + h.falta, 0) };
      });
      eq(r.alocados.join(), '1', 'só quem tem a CH da posição entra');
      eq(r.enxertos, 0, 'nenhum encaixe de jornada diferente acontece');
      eq(r.falta, 1, 'a segunda posição continua pedindo alguém de 3h');
    }

    sec('9. Nenhum erro de script');
    ok(erros.length === 0, 'a página rodou sem exceção' + (erros.length ? ': ' + erros.join(' | ') : ''));
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
