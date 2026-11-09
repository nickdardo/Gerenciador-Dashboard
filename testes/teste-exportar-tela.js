/* =====================================================================
   teste-exportar-tela.js — o Excel que é a foto da tela

   Já existia "Mais ações → Baixar Excel da escala": ela sai na ordem crua
   do banco, com as colunas da grade completa, e carrega o marcador que
   permite reimportar o arquivo depois.

   Esta é outra coisa: é a escala que está na tela — mesma ordem, mesmo
   filtro — entregue como TABELA, para ser filtrada e ordenada no Excel.

   Ela já tentou ser a foto da grade, com as faixas de grupo mescladas
   atravessando as 39 colunas. Ficava parecida com a tela e imprestável
   na planilha: célula mesclada quebra filtro e ordenação, e a faixa é
   uma linha que não é pessoa nenhuma — ao filtrar por função ela some ou
   fica boiando no meio dos dados. O grupo virou coluna, que é como uma
   planilha representa atributo repetido.

   Por isso ela NÃO carrega o marcador de reimportação. Um arquivo que
   parecesse reimportável mas perdeu a coluna Turno voltaria apagando
   turno de todo mundo.

   Rodar:  node testes/teste-exportar-tela.js
   (precisa do xlsx: npm install xlsx)
   ===================================================================== */

'use strict';

const path = require('path');
const fs = require('fs');

let XLSX;
try {
  XLSX = require('xlsx');
} catch (_) {
  console.log('PULADO  teste de exportação — rode "npm install xlsx" nesta pasta para executá-lo.');
  process.exit(0);
}
const { chromium } = require('playwright');

const BASE = path.join(__dirname, '..');
let pass = 0, fail = 0;
const falhas = [];
const ok = (c, m) => { if (c) pass++; else { fail++; falhas.push(m); console.log('   \x1b[31m✗\x1b[0m ' + m); } };
const eq = (a, b, m) => ok(a === b, m + '  (esperado ' + JSON.stringify(b) + ', veio ' + JSON.stringify(a) + ')');
const sec = (t) => console.log('\n\x1b[36m── ' + t + '\x1b[0m');

const GENTE = [
  ['251595', 'ELIENE VIEIRA SANTOS FERNANDES', 'ASG LIMPEZA I', 180, '17:00'],
  ['250120', 'ROSANA MARTA DA ANUNCIACAO BRITO', 'ASG LIMPEZA I', 180, '06:00'],
  ['250125', 'JACKSON RAFAEL DE ANDRADE', 'ENC. DE LIMPEZA II', 180, '08:00'],
];

(async () => {
  const tmp = path.join(BASE, 'testes', '.exportar.html');
  fs.writeFileSync(tmp, `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"></head><body>
<script src="file://${path.join(BASE, 'node_modules', 'xlsx', 'dist', 'xlsx.full.min.js')}"><\/script>
<script src="file://${path.join(BASE, 'js', 'escala.js')}"><\/script></body></html>`);

  const browser = await chromium.launch();
  const page = await browser.newPage();
  const erros = [];
  page.on('pageerror', (e) => erros.push(e.message));
  await page.goto('file://' + tmp, { waitUntil: 'load' });

  const exportar = (pagina) => page.evaluate(([gente, pag]) => {
    const D = 30;
    window._escalaBase = 'GRU'; window._escalaMes = '2026-11';
    currentPage = pag;
    window._escalaDias = new Map(); window._escalaFeriados = new Map();
    window._escalaColabs = gente.map(([mat, nome, funcao, ch, entrada]) =>
      ({ matricula: mat, nome, funcao_manual: funcao, ch_manual: ch, entrada_manual: entrada, saida_manual: '' }));
    window.eoColabs = new Map(window._escalaColabs.map((c) => [c.matricula, { funcao: c.funcao_manual, ch: c.ch_manual }]));
    window.escalaFuncaoGrupoDoColab = (c) => ({ label: c.funcao_manual });
    window.escalaEntradaEfetivaDoColab = (c) => c.entrada_manual;
    window.escalaAplicarFiltroSituacao = (l) => l;
    // Folgas de seis em seis para a primeira pessoa; as outras ficam sem.
    for (let d = 1; d <= D; d += 6) window._escalaDias.set('251595|' + d, { status: 'F' });
    window.escalaMsg = (m) => { window.__ultimaMsg = m; };

    let capturado = null;
    const orig = XLSX.writeFile;
    XLSX.writeFile = (wb, nome) => { capturado = { nome, ws: wb.Sheets.Escala, abas: wb.SheetNames }; };
    try { escalaExportarTelaExcel(); } finally { XLSX.writeFile = orig; }
    if (!capturado) return null;
    return {
      nome: capturado.nome,
      abas: capturado.abas,
      aoa: XLSX.utils.sheet_to_json(capturado.ws, { header: 1, defval: '' }),
      merges: (capturado.ws['!merges'] || []).map((m) => [m.s.r, m.s.c, m.e.c]),
      views: capturado.ws['!views'] || null,
      cols: (capturado.ws['!cols'] || []).length,
      autofiltro: capturado.ws['!autofilter'] ? capturado.ws['!autofilter'].ref : null,
      msg: window.__ultimaMsg,
      tipos: Object.keys(capturado.ws)
        .filter((k) => /^[A-Z]+[0-9]+$/.test(k))
        .reduce((m, k) => { m[k] = capturado.ws[k].t; return m; }, {}),
    };
  }, [GENTE, pagina]);

  try {
    sec('1. O arquivo sai com a cara da tela');
    {
      const r = await exportar('capacity');
      ok(!!r, 'a exportação gerou um arquivo');
      if (r) {
        eq(r.nome, 'Escala_Capacity_GRU_2026-11.xlsx',
          'o nome diz qual escala, qual base e qual mês');
        eq(r.abas.join(','), 'Escala', 'uma aba só');
        ok(/Escala Capacity/.test(r.aoa[0][0]) && /GRU/.test(r.aoa[0][0]),
          'a primeira linha é o título com escala, base e mês: "' + r.aoa[0][0] + '"');
        ok(/Gerado em/.test(r.aoa[1][0]), 'a segunda diz quando foi gerado');

        const cab = r.aoa[3];
        eq(cab.slice(0, 11).join('|'),
          'MATRÍCULA|NOME|GRUPO|FUNÇÃO|CH|ENTRADA|SAÍDA|6 DIAS|DOM.|FOLGAS FEITAS|META FOLGAS',
          'as colunas de identificação e conferência vêm todas antes dos dias');
        eq(cab.length, 11 + 30, 'e os 30 dias do mês depois (' + cab.length + ' colunas)');
        ok(/^1 /.test(cab[11]) && /DOM/.test(cab[11]),
          'o cabeçalho do dia traz número e dia da semana numa linha só: ' + JSON.stringify(cab[11]));
        ok(!cab.some((c) => /\n/.test(String(c))),
          'sem quebra de linha no cabeçalho, que exigiria "quebrar texto" ligado para aparecer');
      }
    }

    sec('2. O grupo é coluna, não faixa mesclada');
    {
      /* O ponto de toda a mudança: mesclagem quebra filtro e ordenação.
         Com o grupo em coluna, filtrar por grupo é igual a filtrar por
         qualquer outra coisa. */
      const r = await exportar('capacity');
      eq(r.merges.length, 0, 'nenhuma célula mesclada no arquivo');
      const tudo = r.aoa.flat().join(' ');
      ok(!/· 2 pessoas|· 1 pessoa/.test(tudo),
        'e nenhuma linha de faixa sobrou boiando entre os dados');

      const linhas = r.aoa.slice(4).filter((l) => l[0]);
      eq(linhas.length, 3, 'uma linha por pessoa, sem linhas intrusas');
      eq(linhas.map((l) => l[2]).join('|'),
        'ASG LIMPEZA I|ASG LIMPEZA I|ENC. DE LIMPEZA II',
        'cada linha carrega o grupo dela na coluna GRUPO');
      /* A ordem é a da TELA, não a do banco: a exportação passou a pedir
         a lista no mesmo lugar que a grade. No padrão automático isso é
         função, depois horário — ROSANA entra 06:00 e ELIENE 17:00, então
         ROSANA vem primeiro, como aparece na tela. */
      eq(linhas.map((l) => l[1]).join(' / '),
        'ROSANA MARTA DA ANUNCIACAO BRITO / ELIENE VIEIRA SANTOS FERNANDES / JACKSON RAFAEL DE ANDRADE',
        'a ordem é a mesma que está sendo vista, por horário dentro do grupo');

      const porNome = await page.evaluate(() => {
        window._escalaOrdemColuna = 'nome'; window._escalaOrdemDirecao = 'asc';
        let cap = null; const orig = XLSX.writeFile;
        XLSX.writeFile = (wb) => { cap = wb.Sheets.Escala; };
        try { escalaExportarTelaExcel(); } finally { XLSX.writeFile = orig; window._escalaOrdemColuna = null; }
        return XLSX.utils.sheet_to_json(cap, { header: 1, defval: '' })
          .slice(4).filter((l) => l[0]).map((l) => l[1]);
      });
      /* Tabela plana: ordenar por nome é alfabético puro, sem respeitar
         bloco de grupo — que é exatamente o que se espera de uma
         planilha, e o motivo de o grupo ter virado coluna. */
      eq(porNome.join(' / '),
        'ELIENE VIEIRA SANTOS FERNANDES / JACKSON RAFAEL DE ANDRADE / ROSANA MARTA DA ANUNCIACAO BRITO',
        'e muda junto quando se muda o "Organizar por" no painel');
    }

    sec('2b. O filtro vem pronto e os números são números');
    {
      const r = await exportar('capacity');
      ok(r.autofiltro, 'o autofiltro está ligado: ' + r.autofiltro);
      ok(/^A4:/.test(r.autofiltro || ''),
        'ancorado no cabeçalho, não na linha do título: ' + r.autofiltro);

      /* Matrícula como número perderia o zero à esquerda e deixaria de
         bater com a do DP. CH como texto ("180H") não soma nem filtra por
         faixa. Cada um no tipo que o uso pede. */
      eq(r.tipos.A5, 's', 'matrícula sai como texto, para não comer zero à esquerda');
      eq(r.tipos.E5, 'n', 'CH sai como número, para somar e filtrar por faixa');
      eq(r.tipos.J5, 'n', 'folgas feitas, idem');
      eq(r.tipos.K5, 'n', 'e a meta também');

      const linha = r.aoa[4];
      ok(typeof linha[9] === 'number' && typeof linha[10] === 'number',
        'folgas vêm em duas colunas somáveis, não em "5/5" que não soma');
    }

    sec('3. As conferências vão por extenso, não por símbolo');
    {
      /* ✓ e ✗ viram emoji colorido em algumas fontes, e a planilha é
         documento de trabalho — às vezes impresso em preto e branco. */
      const r = await exportar('capacity');
      const linha = r.aoa[4];
      ok(!/[✓✔✕✖✗✘❌✅]/.test(r.aoa.flat().join('')), 'nenhum visto ou cruz no arquivo inteiro');
      ok(linha[7] === 'OK' || /dias$/.test(linha[7]), '6 dias sai como OK ou o número: ' + JSON.stringify(linha[7]));
      ok(linha[8] === 'OK' || /dom\.$/.test(linha[8]), 'domingo idem: ' + JSON.stringify(linha[8]));
    }

    sec('4. O cabeçalho e a identificação ficam congelados');
    {
      const r = await exportar('capacity');
      ok(r.views && r.views[0] && r.views[0].state === 'frozen', 'o painel sai congelado');
      eq(r.views[0].xSplit, 11, 'tudo que diz QUEM é a pessoa fica à vista ao rolar pelos dias');
      eq(r.views[0].ySplit, 4, 'e o cabeçalho também');
      eq(r.cols, 41, 'cada coluna com largura própria — dia estreito, nome largo');
    }

    sec('5. Este arquivo não se finge de reimportável');
    {
      /* A outra exportação carrega um marcador na primeira linha, que a
         importação reconhece. Esta não pode ter: ela perdeu a coluna
         Turno, e voltar por aqui apagaria o turno de todo mundo. */
      const r = await exportar('capacity');
      const tudo = r.aoa.flat().join(' ');
      ok(!/#ESCALA-ONLINE-V1/.test(tudo), 'sem o marcador de reimportação');
      ok(!/NÃO ALTERE ESTA LINHA/.test(tudo), 'e sem a linha de aviso que acompanha o marcador');
    }

    sec('6. O nome do arquivo acompanha a escala aberta');
    {
      const base = await exportar('escala');
      eq(base.nome, 'Escala_Base_GRU_2026-11.xlsx', 'pela Escala Base, o arquivo diz Base');
      ok(/Escala Base/.test(base.aoa[0][0]), 'e o título dentro também');
    }

    sec('6b. Na Capacity, só o horário do dimensionamento sai');
    {
      /* A queixa, reproduzida: o dimensionamento começa 01:00, 02:30,
         07:00, 11:00, 12:30, 16:00; a exportação trazia 00:00, 06:00 e
         17:00, que não existem nele. Eram os horários do PONTO BATIDO —
         a regra da Escala Base — aparecendo para quem não recebeu
         posição, misturados na mesma coluna com os que receberam, sem
         nada distinguindo um do outro. */
      /* Página nova: as seções anteriores substituem
         escalaEntradaEfetivaDoColab por um stub, e esta seção precisa
         justamente da implementação de verdade — é a regra em teste. */
      const p2 = await browser.newPage();
      await p2.goto('file://' + tmp, { waitUntil: 'load' });
      const r = await p2.evaluate(() => {
        window._escalaBase = 'GRU'; window._escalaMes = '2026-11';
        window._escalaDias = new Map(); window._escalaFeriados = new Map();
        window._escalaOrdemColuna = null;
        window._escalaColabs = [
          // Recebeu posição do dimensionamento.
          { matricula: '1', nome: 'COM POSICAO', funcao_manual: 'ASG LIMPEZA I',
            ch_manual: 180, entrada_manual: '07:00', saida_manual: '13:00' },
          // Não recebeu: na Base herdaria o ponto; na Capacity, não.
          { matricula: '2', nome: 'SEM POSICAO', funcao_manual: 'ASG LIMPEZA I',
            ch_manual: 180, entrada_manual: null, saida_manual: null },
        ];
        window.eoColabs = new Map(window._escalaColabs.map((c) =>
          [c.matricula, { nome: c.nome, funcao: c.funcao_manual, ch: c.ch_manual, station: 'GRU' }]));
        window.escalaFuncaoGrupoDoColab = (c) => ({ label: 'Limpeza' });
        window.escalaAplicarFiltroSituacao = (l) => l;
        // O ponto batido diz 00:00–06:00 para quem não tem posição.
        window.escalaHorarioFixoDoColab = () => '00:00-06:00';

        const colher = () => {
          let cap = null; const orig = XLSX.writeFile;
          XLSX.writeFile = (wb) => { cap = wb.Sheets.Escala; };
          try { escalaExportarTelaExcel(); } finally { XLSX.writeFile = orig; }
          return XLSX.utils.sheet_to_json(cap, { header: 1, defval: '' })
            .slice(4).filter((l) => l[0]).map((l) => [l[0], l[5], l[6]]);
        };
        currentPage = 'capacity'; window._escalaCenario = 'dimensionada';
        const capacity = colher();
        currentPage = 'escala'; window._escalaCenario = 'planejada';
        const planejada = colher();
        return { capacity, planejada };
      });

      const cap = new Map(r.capacity.map((l) => [l[0], l[1]]));
      eq(cap.get('1'), '07:00', 'quem recebeu posição sai com o horário do dimensionamento');
      eq(cap.get('2'), '',
        'e quem não recebeu sai EM BRANCO, não com o horário do ponto batido');
      ok(!r.capacity.some((l) => l[1] === '00:00'),
        'nenhum horário do ponto se mistura aos do dimensionamento na Capacity');

      /* A Base mantém a regra dela, que é o motivo de as duas escalas
         existirem separadas. Mudar a Capacity não pode mudar a Base. */
      const base = new Map(r.planejada.map((l) => [l[0], l[1]]));
      eq(base.get('2'), '00:00',
        'na Base o ponto batido continua valendo — a regra dela não mudou');
      await p2.close();
    }

    sec('6c. A planilha leva as posições vazias da malha');
    {
      /* Exportar só quem tem gente devolveria o mesmo retrato
         incompleto que a tela dava: a malha pede 5 horários, saem 2
         linhas, e a diferença só aparece contando no Excel. Com as vagas
         na planilha, filtrar NOME = "(vaga)" dá a lista do que falta. */
      const p3 = await browser.newPage();
      await p3.goto('file://' + tmp, { waitUntil: 'load' });
      const r = await p3.evaluate(() => {
        window._escalaBase = 'GRU'; window._escalaMes = '2026-11';
        window._escalaCenario = 'dimensionada'; currentPage = 'capacity';
        window._escalaDias = new Map(); window._escalaFeriados = new Map();
        window._escalaOrdemColuna = null;
        window._escalaPosicoesDim = [
          { funcao: 'ASG LIMPEZA I', entrada: '07:00', saida: '13:00', carga: 180, qtd: 3 },
          { funcao: 'ASG LIMPEZA I', entrada: '16:00', saida: '22:00', carga: 180, qtd: 2 },
        ];
        window.escalaCarregarMapaDim = () => ({ 'ASG LIMPEZA I': 'Limpeza' });
        window._escalaColabs = [
          { matricula: '1', nome: 'ANA', funcao_manual: 'ASG LIMPEZA I', ch_manual: 180,
            entrada_manual: '07:00', saida_manual: '13:00' },
        ];
        window.eoColabs = new Map([['1', { nome: 'ANA', funcao: 'ASG LIMPEZA I', ch: 180, station: 'GRU' }]]);
        window.escalaFuncaoGrupoDoColab = () => ({ label: 'Limpeza' });
        window.escalaAplicarFiltroSituacao = (l) => l;

        let cap = null; const orig = XLSX.writeFile;
        XLSX.writeFile = (wb) => { cap = wb.Sheets.Escala; };
        try { escalaExportarTelaExcel(); } finally { XLSX.writeFile = orig; }
        return XLSX.utils.sheet_to_json(cap, { header: 1, defval: '' })
          .slice(4).filter((l) => l[1]).map((l) => [l[1], l[5], l[6]]);
      });

      eq(r.length, 5, 'a planilha traz as 5 posições da malha, não só a pessoa que existe');
      const vagas = r.filter((l) => l[0] === '(vaga)');
      eq(vagas.length, 4, 'quatro delas sem ninguém');
      eq(vagas.filter((v) => v[1] === '16:00').length, 2,
        'as duas das 16:00, que não têm ninguém, aparecem');
      eq(vagas.filter((v) => v[1] === '07:00').length, 2,
        'e sobram duas das 07:00, porque uma está coberta');
      ok(vagas.every((v) => v[2]), 'cada vaga leva também o horário de saída da malha');
      await p3.close();
    }

    sec('6d. Horário que o dimensionamento não pede não chega à planilha');
    {
      /* A queixa, reproduzida: o dimensionamento começa 00:00, 07:00 e
         11:00; a exportação trazia 21 pessoas às 06:00–12:00. Às 06:00
         não começa ninguém — o que existe ali é o FIM da barra das
         00:00. Aqueles valores estavam gravados em escala_colaborador de
         aplicações antigas, e a tela os exibia como se fossem da malha,
         porque bastava estarem na coluna.

         A regra agora é outra: na Capacity, horário só existe se a malha
         do GRUPO da pessoa o pedir. Resíduo não vira linha, não vira
         célula de planilha e não entra na conta de cobertura. */
      const p4 = await browser.newPage();
      await p4.goto('file://' + tmp, { waitUntil: 'load' });
      const r = await p4.evaluate(() => {
        window._escalaBase = 'GRU'; window._escalaMes = '2026-11';
        window._escalaCenario = 'dimensionada'; currentPage = 'capacity';
        window._escalaDias = new Map(); window._escalaFeriados = new Map();
        window._escalaOrdemColuna = null;
        window._escalaPosicoesDim = [
          { funcao: 'ASG LIMPEZA I', entrada: '00:00', saida: '06:00', carga: 180, qtd: 2 },
          { funcao: 'ASG LIMPEZA I', entrada: '07:00', saida: '13:00', carga: 180, qtd: 1 },
        ];
        window.escalaCarregarMapaDim = () => ({ 'ASG LIMPEZA I': 'Limpeza' });
        window._escalaColabs = [
          // Horário que a malha pede.
          { matricula: '1', nome: 'ANA', funcao_manual: 'ASG LIMPEZA I', ch_manual: 180,
            entrada_manual: '00:00', saida_manual: '06:00' },
          // 06:00 é o FIM da barra das 00:00, não um início. Resíduo.
          { matricula: '2', nome: 'BIA', funcao_manual: 'ASG LIMPEZA I', ch_manual: 180,
            entrada_manual: '06:00', saida_manual: '12:00' },
          // Saída gravada sem entrada: não pode virar "saída solta".
          { matricula: '3', nome: 'CAIO', funcao_manual: 'ASG LIMPEZA I', ch_manual: 180,
            entrada_manual: null, saida_manual: '18:00' },
        ];
        window.eoColabs = new Map(window._escalaColabs.map((c) =>
          [c.matricula, { nome: c.nome, funcao: c.funcao_manual, ch: c.ch_manual, station: 'GRU' }]));
        window.escalaFuncaoGrupoDoColab = () => ({ label: 'Limpeza' });
        window.escalaAplicarFiltroSituacao = (l) => l;

        let cap = null; const orig = XLSX.writeFile;
        XLSX.writeFile = (wb) => { cap = wb.Sheets.Escala; };
        try { escalaExportarTelaExcel(); } finally { XLSX.writeFile = orig; }
        return {
          linhas: XLSX.utils.sheet_to_json(cap, { header: 1, defval: '' })
            .slice(4).filter((l) => l[1]).map((l) => [l[1], l[5], l[6]]),
          residuo: escalaHorariosForaDaMalha().map((p) => p.matricula),
        };
      });

      const porNome = new Map(r.linhas.map((l) => [l[0], [l[1], l[2]]]));
      eq((porNome.get('ANA') || [])[0], '00:00',
        'quem está num horário da malha sai com ele');
      eq((porNome.get('BIA') || [])[0], '',
        'as 06:00, que a malha não pede, NÃO aparecem — era esta a queixa');
      eq((porNome.get('CAIO') || [])[1], '',
        'e saída gravada sem entrada não vira "saída solta", que parece dado e não é');

      eq(r.residuo.join(), '2', 'o resíduo é identificado por matrícula, para poder ser apagado');

      /* Malha vazia é "dimensionamento não carregou", não "nenhum horário
         vale". Apagar a escala da tela por uma leitura que falhou troca
         um dado errado por um susto — e o susto parece perda de dado. */
      const semMalha = await p4.evaluate(() => {
        window._escalaPosicoesDim = [];
        return {
          entrada: escalaEntradaEfetivaDoColab(window._escalaColabs[1], 2026, 11, 30),
          residuo: escalaHorariosForaDaMalha().length,
        };
      });
      eq(semMalha.entrada, '06:00',
        'sem dimensionamento carregado, o horário gravado continua à vista');
      eq(semMalha.residuo, 0, 'e nada é acusado de resíduo sem haver com o que comparar');

      /* Com as 06:00 fora, a posição das 00:00 que BIA ocupava
         indevidamente volta a contar como vaga a preencher. */
      const vagas = r.linhas.filter((l) => l[0] === '(vaga)');
      eq(vagas.length, 2,
        'e as posições que ninguém cobre de verdade reaparecem como vaga');
      await p4.close();
    }

    sec('6e. A saída exportada é a do dimensionamento, não a da CH');
    {
      /* Era este o "horário doido". Eu havia decidido que, quando a
         jornada da pessoa não batia com a da posição, a saída seria
         calculada pela CH dela — para não estourar a carga mensal de
         quem fosse encaixado. A intenção era boa e o efeito, péssimo:
         uma posição de 06:00 às 09:00 virava 06:00 às 12:00 na escala, e
         a planilha deixava de bater com o arquivo que a originou.

         A posição manda. A diferença de carga continua existindo, mas é
         relatada em vez de silenciosamente compensada. */
      const p5 = await browser.newPage();
      await p5.goto('file://' + tmp, { waitUntil: 'load' });
      const r = await p5.evaluate(() => {
        window._escalaBase = 'GRU'; window._escalaMes = '2026-11';
        window._escalaCenario = 'dimensionada'; currentPage = 'capacity';
        window.escalaFuncaoGrupoDoColab = () => ({ label: 'Limpeza' });
        window.escalaEntradaEfetivaDoColab = (c) => c.entrada_manual || '';

        // Posição de 3h; pessoa de CH 180, que é 6h/dia.
        const vagas = [{ grupo: 'Limpeza', jornada: 3, entrada: '06:00', saida: '09:00' }];
        const gente = [{ matricula: '1', nome: 'ANA', entrada_manual: '06:00', ch_manual: 180 }];
        window.eoColabs = new Map([['1', { nome: 'ANA', funcao: 'ASG', ch: 180, station: 'GRU' }]]);
        const casado = escalaCasarVagasComPessoas(vagas, gente, 2026, 11, 30);
        return {
          entrada: casado.atribuicoes[0].entrada,
          saida: casado.atribuicoes[0].saida,
          enxertos: casado.enxertos.map((e) => [e.matricula, e.jornadaVaga, e.jornadaPessoa]),
        };
      });

      eq(r.entrada, '06:00', 'a entrada é a da posição');
      eq(r.saida, '09:00',
        'e a SAÍDA também — não 12:00, que é o que a CH de 6h daria');
      eq(JSON.stringify(r.enxertos), JSON.stringify([['1', 3, 6]]),
        'a diferença de jornada é relatada, com a da posição e a da pessoa');
      await p5.close();
    }

    sec('7. Nenhum erro de script');
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
