/* =====================================================================
   teste-folgas-modelos.js — o modelo gerado tem de voltar pelo motor

   Um modelo de planilha só vale alguma coisa se o motor conseguir lê-lo
   de volta. E o motor é exigente de um jeito que não aparece olhando o
   arquivo: a data tem de ser data (não texto), o mês tem de estar
   inteiro na linha, a hora tem de ser hora (não "06:00" digitado), a
   matrícula tem de ser número. Qualquer um desses erros produz uma
   planilha que ABRE bonita no Excel e é rejeitada no upload — o pior
   tipo de defeito, porque o usuário só descobre depois de preencher.

   Então aqui não se testa o que o gerador escreveu: gera-se o arquivo
   de verdade, entrega-se ao FolgaEngine de verdade, e confere-se o que
   ele entendeu. É a mesma viagem que o usuário vai fazer.

   Rodar:  node testes/teste-folgas-modelos.js
   ===================================================================== */

'use strict';

const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const BASE = path.join(__dirname, '..');
const SHEETJS = path.join(BASE, 'node_modules', 'xlsx', 'dist', 'xlsx.full.min.js');

let pass = 0, fail = 0;
const falhas = [];
const ok = (c, m) => { if (c) pass++; else { fail++; falhas.push(m); console.log('   \x1b[31m✗\x1b[0m ' + m); } };
const eq = (a, b, m) => ok(a === b, m + '  (esperado ' + JSON.stringify(b) + ', veio ' + JSON.stringify(a) + ')');
const sec = (t) => console.log('\n\x1b[36m── ' + t + '\x1b[0m');

(async () => {
  if (!fs.existsSync(SHEETJS)) {
    console.log('\x1b[33m⚠ SheetJS não instalado (npm install xlsx) — suíte pulada.\x1b[0m');
    process.exit(0);
  }

  const tmp = path.join(BASE, 'testes', '.modelos.html');
  fs.writeFileSync(tmp, `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"></head><body>
<script src="file://${SHEETJS}"><\/script>
<script src="file://${path.join(BASE, 'js', 'folgas-engine.js')}"><\/script>
<script src="file://${path.join(BASE, 'js', 'folgas-modelos.js')}"><\/script>
</body></html>`);

  const browser = await chromium.launch();
  const page = await browser.newPage();
  const erros = [];
  page.on('pageerror', (e) => erros.push(e.message));
  await page.goto('file://' + tmp, { waitUntil: 'load' });

  /* Gera o modelo, serializa como o download faria e devolve ao motor.
     `XLSX.write` com type 'array' produz exatamente os mesmos bytes que
     `XLSX.writeFile` grava no disco. */
  const viagemDeIda = (id, opts) => page.evaluate(async ([id, opts]) => {
    const wb = FolgaModelos.construir(id, opts);
    const bytes = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const lido = await FolgaEngine.loadWorkbook(bytes);
    const modelo = FolgaEngine.buildModel(lido);
    const st = FolgaEngine.defaultSettings();

    const abas = modelo.sheets.map((s) => ({
      nome: s.name,
      chTable: s.chTable.length,
      blocos: s.blocks.length,
      grupos: s.blocks[0] ? s.blocks[0].groups.map((g) => g.name) : [],
      dias: s.blocks[0] ? s.blocks[0].cur.length : 0,
      rabicho: s.blocks[0] ? s.blocks[0].prevCols.length : 0,
    }));

    const primeira = modelo.sheets[0];
    const pessoas = [];
    for (const g of primeira.blocks[0].groups) for (const e of g.emps) {
      pessoas.push({ mat: e.mat, nome: e.name, ch: e.ch, entrada: e.entrada, saida: e.saida,
        equipe: e.team, vaga: !!e.vaga, grupo: g.name });
    }
    const req = FolgaEngine.requirement(primeira.blocks[0].groups[0].emps[0], primeira,
      modelo.month.days, st, modelo.month.dow);

    return {
      mes: modelo.month.label, dias: modelo.month.days,
      pessoasLidas: modelo.empCount, codigosDesconhecidos: modelo.unknownCodes,
      abas, pessoas, metaDoPrimeiro: req.required, chConhecida: req.known, jornada: req.jorn,
    };
  }, [id, opts]);

  try {
    const OPT = { ano: 2026, mes0: 11, base: 'GRU' };     // dezembro/2026, 31 dias

    sec('1. Modelo enxuto: o motor lê o arquivo gerado');
    {
      const r = await viagemDeIda('enxuto', OPT);
      eq(r.mes, 'dezembro/2026', 'o mês sai do arquivo, não de um palpite');
      eq(r.dias, 31, 'e o mês veio inteiro — falta um dia, a aba é descartada');
      eq(r.abas.length, 1, 'uma aba de escala (a de instruções não é escala e é ignorada)');
      eq(r.abas[0].nome, 'ESCALA', 'com o nome esperado');
      eq(r.abas[0].dias, 31, 'todas as colunas de dia foram encontradas');
      eq(r.abas[0].rabicho, 7, 'e os 7 dias do mês anterior, que são o histórico de sequência');
      eq(r.pessoasLidas, 3, 'as três linhas de exemplo foram lidas como pessoas');
      eq(r.codigosDesconhecidos.length, 0, 'sem códigos estranhos na grade');
    }

    sec('2. Os campos que o Excel engana: hora, matrícula e CH');
    {
      /* Estes três são os que quebram em silêncio. Hora digitada como
         texto some na leitura; matrícula como texto deixa de ser pessoa
         e vira rótulo de grupo; CH como texto zera a meta de folgas. */
      const r = await viagemDeIda('enxuto', OPT);
      const p = r.pessoas[0];
      eq(p.entrada, '06:00', 'a ENTRADA voltou como hora — se fosse texto, viria vazia');
      eq(p.saida, '12:00', 'e a SAÍDA foi calculada pela jornada da CH 180');
      eq(typeof p.mat, 'number', 'a matrícula é número, senão a linha não conta como pessoa');
      eq(p.ch, 180, 'a CH voltou como número');

      const terceiro = r.pessoas[2];
      eq(terceiro.ch, 210, 'a CH 210 também');
      eq(terceiro.saida, '16:00',
        'e nela a saída soma o intervalo de 1 hora: 08:00 + 7h + 1h');
    }

    sec('3. A tabela de CH decide a meta de folgas do mês');
    {
      /* Sem a tabela, o motor cai no palpite "5 folgas, ou 6 se o mês
         tiver 31 dias" — que é diferente da conta por teto de horas e
         fica diferente do que o painel da escala calcula. */
      const r = await viagemDeIda('enxuto', OPT);
      eq(r.abas[0].chTable, 6, 'as seis faixas de CH foram encontradas à direita da grade');
      ok(r.chConhecida, 'a CH da pessoa foi casada com a tabela, em vez de cair no palpite');
      eq(r.jornada, 6, 'jornada de 6h para a CH 180');
      /* Teto 150h ÷ 6h = 25 dias trabalhados; dezembro tem 31. */
      eq(r.metaDoPrimeiro, 6, 'meta de 6 folgas em dezembro, pela conta do teto de horas');
    }

    sec('4. Em mês de 30 dias a tabela muda junto');
    {
      /* A CH 210 tem teto diferente em mês de 30 e de 31 dias. Gerar a
         tabela fixa faria o modelo de novembro pedir a meta de dezembro. */
      const r = await viagemDeIda('enxuto', { ano: 2026, mes0: 10, base: 'GRU' });
      eq(r.mes, 'novembro/2026', 'novembro');
      eq(r.dias, 30, 'com 30 dias');
      eq(r.metaDoPrimeiro, 5, 'e a meta cai para 5 folgas');

      // O teto da CH 210 é o que muda com o tamanho do mês: 171 ou 177.
      const tetos = await page.evaluate(async () => {
        const ler = async (mes0) => {
          const wb = FolgaModelos.construir('enxuto', { ano: 2026, mes0 });
          const bytes = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
          const m = FolgaEngine.buildModel(await FolgaEngine.loadWorkbook(bytes));
          return m.sheets[0].chTable.find((t) => t.ch === 210).maxH;
        };
        return { nov: await ler(10), dez: await ler(11) };
      });
      eq(tetos.nov, 171, 'e o teto da CH 210 num mês de 30 dias');
      eq(tetos.dez, 177, 'é diferente do de um mês de 31 — a tabela é gerada para o mês, não fixa');
    }

    sec('5. Modelo por grupos: os rótulos viram grupos de verdade');
    {
      const r = await viagemDeIda('grupos', OPT);
      eq(r.abas[0].grupos.join(' | '),
        'ASG LIMPEZA — 06:00 ÀS 12:00 | ASG LIMPEZA — 14:00 ÀS 20:00 | ENCARREGADO',
        'os três rótulos foram lidos como grupos, na ordem');
      eq(r.pessoasLidas, 4, 'com as quatro pessoas distribuídas entre eles');
      eq(r.pessoas.filter((p) => p.grupo === 'ASG LIMPEZA — 06:00 ÀS 12:00').length, 2,
        'duas pessoas no primeiro grupo');
    }

    sec('6. Modelo completo: uma aba por setor e vaga em aberto');
    {
      const r = await viagemDeIda('completo', OPT);
      eq(r.abas.map((a) => a.nome).join(', '), 'LIMPEZA, RAMPA, ADMINISTRATIVO',
        'três abas de escala, uma por setor');
      ok(r.abas.every((a) => a.dias === 31), 'todas com o mês completo');
      ok(r.abas.every((a) => a.chTable === 6), 'e todas com a própria tabela de CH');

      const vaga = r.pessoas.find((p) => p.vaga);
      ok(vaga, 'a linha de vaga em aberto foi lida como pessoa, e não como rótulo de grupo');
      eq(vaga && vaga.mat, 'C16', 'guardando o código da vaga');
      eq(vaga && vaga.ch, 180, 'com CH, porque a vaga também entra na conta da cobertura');
    }

    sec('7. O modelo preenchido com o efetivo da base');
    {
      /* É a razão de o modelo existir: ninguém vai digitar 1.200
         matrículas. O que vem do cadastro tem de atravessar a geração e
         voltar igual. */
      const r = await page.evaluate(async () => {
        const pessoas = [];
        for (let i = 0; i < 120; i++) {
          pessoas.push({ mat: 20000 + i, nome: 'COLABORADOR ' + i, ch: i % 2 ? 180 : 210,
            entrada: i % 2 ? '06:00' : '08:00', equipe: i % 3 === 0 ? 'A' : 'B' });
        }
        const wb = FolgaModelos.construir('enxuto', {
          ano: 2026, mes0: 11, base: 'GRU',
          pessoasPorAba: { ESCALA: [{ nome: '', pessoas }] },
        });
        const bytes = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const modelo = FolgaEngine.buildModel(await FolgaEngine.loadWorkbook(bytes));
        const emps = modelo.sheets[0].blocks[0].groups[0].emps;
        return {
          total: modelo.empCount,
          primeiro: { mat: emps[0].mat, nome: emps[0].name, ch: emps[0].ch, entrada: emps[0].entrada },
          segundo: { mat: emps[1].mat, ch: emps[1].ch, entrada: emps[1].entrada },
          ultimo: { mat: emps[emps.length - 1].mat, ch: emps[emps.length - 1].ch },
          temExemplo: emps.some((e) => /APAGUE/.test(e.name)),
        };
      });
      eq(r.total, 120, 'as 120 pessoas do cadastro voltaram inteiras');
      eq(r.primeiro.mat, 20000, 'a primeira matrícula');
      /* Duas CHs diferentes de propósito: um horário por pessoa, não um
         horário por arquivo. */
      eq(r.primeiro.entrada, '08:00', 'com o horário dela (CH 210)');
      eq(r.segundo.entrada, '06:00', 'e a seguinte com o seu, que é outro (CH 180)');
      eq(r.segundo.ch, 180, 'cada uma com a sua carga horária');
      eq(r.ultimo.mat, 20119, 'e a última, para garantir que ninguém se perdeu no meio');
      ok(!r.temExemplo, 'as linhas de exemplo não aparecem quando há efetivo de verdade');
    }

    sec('8. O motor consegue gerar as folgas em cima do modelo');
    {
      /* Ler o arquivo é metade do caminho. Se o modelo não trouxer o que
         o solver precisa, ele lê e devolve um mês sem folga nenhuma. */
      const r = await page.evaluate(async () => {
        const wb = FolgaModelos.construir('grupos', { ano: 2026, mes0: 11, base: 'GRU' });
        const bytes = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const modelo = FolgaEngine.buildModel(await FolgaEngine.loadWorkbook(bytes));
        const st = FolgaEngine.defaultSettings();
        FolgaEngine.generate(modelo, st);
        const emps = modelo.sheets[0].blocks.flatMap((b) => b.groups.flatMap((g) => g.emps));
        const conta = (e) => e.gen.filter((c) => c === 'F' || c === 'FA').length;
        const maiorSequencia = (e) => {
          let max = 0, run = 0;
          for (let d = 0; d < modelo.month.days; d++) {
            const c = FolgaEngine.eff(e, d);
            if (c === 'F' || c === 'FA' || c === 'L') run = 0; else { run++; if (run > max) max = run; }
          }
          return max;
        };
        const domingos = (e) => modelo.month.dow.reduce((n, dw, d) =>
          n + (dw === 0 && ['F', 'FA'].includes(FolgaEngine.eff(e, d)) ? 1 : 0), 0);
        return {
          pessoas: emps.length,
          folgas: emps.map(conta),
          piorSequencia: Math.max(...emps.map(maiorSequencia)),
          semDomingo: emps.filter((e) => domingos(e) === 0).length,
        };
      });
      eq(r.pessoas, 4, 'as quatro pessoas do modelo');
      ok(r.folgas.every((n) => n >= 5), 'todas receberam folga: ' + r.folgas.join(', '));
      ok(r.piorSequencia <= 6, 'ninguém ficou com mais de 6 dias seguidos (veio ' + r.piorSequencia + ')');
      eq(r.semDomingo, 0, 'e todas pegaram pelo menos um domingo');
    }

    sec('9. O menu trocou as escalas online pelo Gerenciador de Folgas');
    {
      /* Ocultar não é apagar: a Capacity continua roteável, porque o
         botão do Gerador abre ela com o dimensionamento alocado. O que
         não pode é continuar no menu, nem voltar sozinha num F5. */
      const menu = await browser.newPage();
      const errosMenu = [];
      menu.on('pageerror', (e) => errosMenu.push(e.message));
      const htmlMenu = path.join(BASE, 'testes', '.menu.html');
      fs.writeFileSync(htmlMenu, `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"></head>
<body><div id="sidebar"></div>
<script src="file://${path.join(BASE, 'js', 'i18n.js')}"><\/script>
<script src="file://${path.join(BASE, 'js', 'app.js')}"><\/script></body></html>`);
      await menu.goto('file://' + htmlMenu, { waitUntil: 'load' });

      const r = await menu.evaluate(() => {
        window.currentUser = { email: 'quem@exemplo.com' };
        window.currentUserProfile = { role: 'admin', bases: ['GRU'] };
        renderSidebar();
        const visiveis = [...document.querySelectorAll('.sb-nav .sb-item')].map((b) => b.id.replace('nav-', ''));
        const roteaveis = NAV_ITEMS.map((n) => n.id);
        const validasNoF5 = NAV_ITEMS.filter((n) => !n.oculto).map((n) => n.id);
        return {
          visiveis, roteaveis, validasNoF5,
          tituloCapacity: NAV_ITEMS.find((n) => n.id === 'capacity')?.i18nKey,
          rotuloFolgas: t('nav.folgas'),
        };
      });

      ok(r.visiveis.includes('folgas'), 'o Gerenciador de Folgas está no menu');
      ok(!r.visiveis.includes('escala'), 'a Escala Base saiu do menu');
      ok(!r.visiveis.includes('capacity'), 'a Escala Capacity também');
      eq(r.visiveis[0], 'folgas', 'e é o primeiro item, porque é por onde o mês começa');

      ok(r.roteaveis.includes('capacity'),
        'mas a Capacity continua roteável — o botão do Gerador ainda precisa dela');
      eq(r.tituloCapacity, 'nav.capacity',
        'com a chave de título preservada, senão ela abriria com o título da página anterior');
      ok(!r.validasNoF5.includes('escala'),
        'e um F5 não devolve ninguém para uma escala que já não está no menu');
      eq(r.rotuloFolgas, 'Gerenciador de Folgas', 'o rótulo traduzido existe');
      ok(errosMenu.length === 0, 'o menu montou sem exceção' + (errosMenu.length ? ': ' + errosMenu.join(' | ') : ''));

      await menu.close();
      fs.unlinkSync(htmlMenu);
    }

    sec('10. Nenhum erro de script');
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
