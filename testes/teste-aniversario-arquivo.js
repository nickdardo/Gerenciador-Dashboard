/* =====================================================================
   teste-aniversario-arquivo.js — o AF saindo de um .xlsx de verdade

   A coluna de aniversário das escalas em uso NÃO TEM CABEÇALHO. Na BEL é
   a BI, com dd/mm, espremida entre a coluna de equipe e as colunas
   "Data" dos cursos — e a linha de cabeçalho ali está em branco. Então o
   painel a acha pelo conteúdo, e achar por conteúdo é perigoso de um
   jeito específico: as colunas de curso ao lado guardam datas de
   verdade, variadas, uma por pessoa. Confundir as duas marcaria AF no
   dia do curso de quem tem curso — plausível e calado, o pior tipo.

   Por isso aqui não se testa a função isolada: monta-se um arquivo com a
   geometria da escala real, passa-se pelo buildModel de verdade e
   confere-se de qual coluna ele leu.

   Rodar:  node testes/teste-aniversario-arquivo.js
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

/* Monta uma aba com a geometria da escala real: dias do mês, rabicho,
   colunas da direita e, entre a equipe e as datas de curso, a coluna de
   aniversário sem cabeçalho nenhum. */
function montarAba(XLSX, { ano, mes0, pessoas, comCabecalho, cursoSemCabecalho }) {
  const D = new Date(Date.UTC(ano, mes0 + 1, 0)).getUTCDate();
  const EPOCA = Date.UTC(1899, 11, 30);
  const serial = (y, m, d) => Math.round((Date.UTC(y, m, d) - EPOCA) / 86400000);
  const PREV = 7, C0 = 3;
  const L = C0 + PREV + D - 1;
  const cel = new Map();
  const set = (r, c, v) => { if (v !== undefined && v !== null && v !== '') cel.set(r + ',' + c, v); };

  const HDR = 3, DATA = 4;
  set(HDR, 2, 'TURNO A');
  set(DATA, 1, 'MATRÍCULA'); set(DATA, 2, 'NOME');
  for (let i = 0; i < PREV; i++) set(DATA, C0 + i, serial(ano, mes0, 1) - PREV + i);
  for (let d = 1; d <= D; d++) set(DATA, C0 + PREV + d - 1, serial(ano, mes0, d));

  set(HDR, L + 1, 'FOLGA AGRUPADA');
  set(HDR, L + 2, 'CARGA HORARIA');
  set(HDR, L + 3, 'EQUIPE');
  if (comCabecalho) set(HDR, L + 4, 'ANIVERSÁRIO');     // coluna do aniversário
  if (!cursoSemCabecalho) {
    set(HDR, L + 5, 'Data');                            // daqui para a direita, cursos
    set(HDR, L + 6, 'Data');
  }
  set(HDR, L + 7, 'ch max');
  set(DATA, L + 8, 'ENTRADA'); set(DATA, L + 9, 'SAÍDA');

  // Tabela de CH, longe da grade.
  set(1, 50, 'CH'); set(1, 51, 'HORAS NO MÊS'); set(1, 52, 'JORNADA');
  [[180, 150, 6], [210, 171, 7]].forEach(([ch, h, j], i) => {
    set(2 + i, 50, ch); set(2 + i, 51, h); set(2 + i, 52, j);
  });

  let r = DATA + 1;
  const horas = [];
  pessoas.forEach((p, i) => {
    set(r, 1, p.mat); set(r, 2, p.nome);
    set(r, L + 2, p.ch || 180);
    set(r, L + 3, p.equipe || 'A');
    if (p.aniv) set(r, L + 4, p.aniv);                  // dd/mm, texto, SEM cabeçalho
    /* Datas de curso: poucas pessoas, datas de verdade e variadas. É a
       armadilha que a busca por conteúdo tem de recusar. */
    if (p.curso) { set(r, L + 5, serial(ano, mes0, p.curso)); }
    set(r, L + 8, 0.25 + (i % 3) * 0.1); horas.push([r, L + 8]);
    r++;
  });

  const linhas = [];
  for (let rr = 1; rr <= r; rr++) {
    const linha = new Array(52).fill(null);
    for (let cc = 1; cc <= 52; cc++) { const v = cel.get(rr + ',' + cc); if (v !== undefined) linha[cc - 1] = v; }
    linhas.push(linha);
  }
  const ws = XLSX.utils.aoa_to_sheet(linhas);
  const ref = (rr, cc) => XLSX.utils.encode_cell({ r: rr - 1, c: cc - 1 });
  for (let c = C0; c <= L; c++) { const k = ws[ref(DATA, c)]; if (k) k.z = 'dd/mm'; }
  for (const [rr, cc] of horas) { const k = ws[ref(rr, cc)]; if (k) k.z = 'hh:mm'; }
  return ws;
}

(async () => {
  if (!fs.existsSync(SHEETJS)) {
    console.log('\x1b[33m⚠ SheetJS não instalado (npm install xlsx) — suíte pulada.\x1b[0m');
    process.exit(0);
  }

  const tmp = path.join(BASE, 'testes', '.aniv.html');
  fs.writeFileSync(tmp, `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"></head><body>
<script src="file://${SHEETJS}"><\/script>
<script src="file://${path.join(BASE, 'js', 'folgas-engine.js')}"><\/script>
</body></html>`);

  const browser = await chromium.launch();
  const page = await browser.newPage();
  const erros = [];
  page.on('pageerror', (e) => erros.push(e.message));
  await page.goto('file://' + tmp, { waitUntil: 'load' });
  await page.exposeFunction('montarAbaSrc', () => montarAba.toString());

  const ler = (opts) => page.evaluate(async (o) => {
    const XLSX = window.XLSX;
    const montar = new Function('return ' + o.src)();
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, montar(XLSX, o), 'RAMPA-A');
    const bytes = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const modelo = FolgaEngine.buildModel(await FolgaEngine.loadWorkbook(bytes));
    const emps = modelo.sheets[0].blocks[0].groups.flatMap((g) => g.emps);
    const st = FolgaEngine.defaultSettings(); st.regime = '5x2';
    FolgaEngine.generate(modelo, st, { passes: 4 });
    const D = modelo.month.days;
    return {
      mes: modelo.month.label, pessoas: emps.length,
      anivs: emps.map((e) => ({ nome: e.name, aniv: e.aniv ? e.aniv.dia + '/' + e.aniv.mes : null,
        af: e.aniversario, codigos: Array.from({ length: D }, (_, d) => FolgaEngine.eff(e, d)) })),
      rel: modelo.aniversarios && { lancados: modelo.aniversarios.lancados.length,
        emFerias: modelo.aniversarios.emFerias.length, emCurso: modelo.aniversarios.emCurso.length,
        total: modelo.aniversarios.total, semData: modelo.aniversarios.semData },
    };
  }, opts);

  const GENTE = [
    { mat: 160101, nome: 'FREDSON GOMES DE SOUSA', aniv: '01/12', curso: 14 },
    { mat: 160102, nome: 'MARIO VICTOR SILVA', aniv: '09/12' },
    { mat: 160103, nome: 'LEANDRO RIBEIRO PEREIRA', aniv: '18/01' },
    { mat: 160104, nome: 'ALLAN JUAN SILVA PINTO', aniv: '01/06' },
    { mat: 160105, nome: 'ROMULO FELIX REBELO', aniv: '27/04', curso: 9 },
    { mat: 160106, nome: 'PEDRO HENRIQUE SOUZA', aniv: '15/07' },
    { mat: 160107, nome: 'ISMAEL COELHO GONCALVES', aniv: '22/05' },
    { mat: 160108, nome: 'JAIR MAGNO DUARTE', aniv: '29/11' },
    { mat: 160109, nome: 'LUIZ NEVES DO CARMO', aniv: '31/12' },
    { mat: 160110, nome: 'MAX DORINEI CORREA', aniv: '16/10' },
  ];

  try {
    const src = montarAba.toString();

    sec('1. Coluna sem cabeçalho, achada pelo conteúdo');
    {
      const r = await ler({ src, ano: 2026, mes0: 11, pessoas: GENTE, comCabecalho: false });
      eq(r.mes, 'dezembro/2026', 'o mês saiu do arquivo');
      eq(r.pessoas, 10, 'as dez pessoas foram lidas');
      eq(r.anivs.filter((a) => a.aniv).length, 10,
        'e todas tiveram a data de nascimento lida, mesmo sem cabeçalho na coluna');
      eq(r.anivs[0].aniv, '1/12', 'a primeira é 01/12');
      eq(r.anivs[2].aniv, '18/1', 'e uma de janeiro continua sendo de janeiro');
    }

    sec('2. Só os de dezembro recebem AF, no dia certo');
    {
      const r = await ler({ src, ano: 2026, mes0: 11, pessoas: GENTE, comCabecalho: false });
      const comAF = r.anivs.filter((a) => a.af != null);
      eq(comAF.length, 3, 'três aniversariantes em dezembro: dias 1, 9 e 31');
      eq(comAF.map((a) => a.af + 1).join(', '), '1, 9, 31', 'cada um no seu dia');
      eq(r.anivs[0].codigos[0], 'AF', 'o AF está na célula do dia 1');
      eq(r.anivs[1].codigos[8], 'AF', 'e no dia 9');

      /* Quem faz aniversário em outro mês não pode ganhar AF nenhum —
         seria uma folga inventada no meio da escala. */
      const foraDoMes = r.anivs.filter((a) => a.af == null);
      ok(foraDoMes.every((a) => !a.codigos.includes('AF')),
        'e ninguém de outro mês ganhou AF');
    }

    sec('3. A coluna de curso ao lado NÃO é confundida com aniversário');
    {
      /* As colunas "Data" guardam datas de verdade, variadas, uma por
         pessoa — o mesmo perfil que a busca procura. O que as separa é a
         densidade: curso é de poucos, aniversário é de todos. Se o
         painel pegasse a coluna errada, marcaria AF no dia do curso. */
      const r = await ler({ src, ano: 2026, mes0: 11, pessoas: GENTE, comCabecalho: false });
      const fredson = r.anivs[0];                 // aniversário 01/12, curso no dia 14
      eq(fredson.af, 0, 'o AF do Fredson é o dia 1, que é o aniversário dele');
      ok(fredson.codigos[13] !== 'AF', 'e não o dia 14, que é o curso');
      const romulo = r.anivs[4];                  // aniversário 27/04, curso no dia 9
      eq(romulo.af, null, 'o Rômulo não faz aniversário em dezembro, então não tem AF');
      ok(!romulo.codigos.includes('AF'), 'nem no dia do curso dele');
    }

    sec('4. Com cabeçalho na coluna, o caminho é o mesmo');
    {
      // É o que os modelos gerados pelo painel passam a trazer.
      const r = await ler({ src, ano: 2026, mes0: 11, pessoas: GENTE, comCabecalho: true });
      eq(r.anivs.filter((a) => a.aniv).length, 10, 'todas as datas lidas');
      eq(r.anivs.filter((a) => a.af != null).length, 3, 'e os mesmos três AF');
    }

    sec('5. Planilha sem a coluna: nada é inventado');
    {
      /* Metade do pessoal com curso no mês. A coluna "Data" fica com
         cinco datas de verdade, variadas, uma por pessoa — exatamente o
         perfil que a busca procura. O que a recusa é a DENSIDADE: curso
         é de alguns, aniversário é de todos. Sem esse crivo o painel
         marcaria AF no dia do curso de quem tem curso. */
      const semData = GENTE.map((p, i) => ({ ...p, aniv: null, curso: i < 5 ? 5 + i * 3 : null }));
      const r = await ler({ src, ano: 2026, mes0: 11, pessoas: semData, comCabecalho: false });
      eq(r.anivs.filter((a) => a.aniv).length, 0, 'nenhuma data é lida da coluna de curso');
      eq(r.rel.lancados, 0, 'nenhum AF é lançado');
      eq(r.rel.semData, 10, 'e as dez entram na conta de quem não tem data');
      ok(r.anivs.every((a) => !a.codigos.includes('AF')), 'nenhum AF apareceu na grade');
    }

    sec('5b. Todo mundo com curso: o limite das colunas "Data" é quem segura');
    {
      /* Mês em que todos fazem curso. Aí a densidade não separa mais — a
         coluna de curso fica cheia como a de aniversário estaria. O que
         segura é o limite: a busca por conteúdo para na primeira coluna
         com cabeçalho "Data", porque dali para a direita são cursos. */
      const todosCurso = GENTE.map((p, i) => ({ ...p, aniv: null, curso: 2 + i * 2 }));
      const r = await ler({ src, ano: 2026, mes0: 11, pessoas: todosCurso, comCabecalho: false });
      eq(r.anivs.filter((a) => a.aniv).length, 0, 'a coluna de curso não vira aniversário nem assim');
      eq(r.rel.lancados, 0, 'e nenhum AF é lançado');
    }

    sec('5c. Colunas de curso sem cabeçalho: a densidade é quem segura');
    {
      /* Nem toda base rotula as colunas de curso. Sem o cabeçalho "Data"
         o limite não tem onde parar, e a única coisa que separa curso de
         aniversário é quantas pessoas têm cada um: metade contra todas. */
      const metadeCurso = GENTE.map((p, i) => ({ ...p, aniv: null, curso: i < 5 ? 5 + i * 3 : null }));
      const r = await ler({ src, ano: 2026, mes0: 11, pessoas: metadeCurso,
        comCabecalho: false, cursoSemCabecalho: true });
      eq(r.anivs.filter((a) => a.aniv).length, 0,
        'coluna preenchida por metade do pessoal não é aniversário');
      eq(r.rel.lancados, 0, 'e nenhum AF sai dela');

      /* E o contrário: a MESMA geometria, com a coluna de aniversário
         preenchida para todos, tem de ser achada. Sem esta metade o
         teste passaria com uma busca que nunca acha nada. */
      const comAniv = GENTE.map((p, i) => ({ ...p, curso: i < 5 ? 5 + i * 3 : null }));
      const r2 = await ler({ src, ano: 2026, mes0: 11, pessoas: comAniv,
        comCabecalho: false, cursoSemCabecalho: true });
      eq(r2.anivs.filter((a) => a.aniv).length, 10, 'mas a coluna que todos têm é achada');
      eq(r2.rel.lancados, 3, 'com os três aniversariantes de dezembro');
    }

    sec('6. O AF é uma das duas folgas da semana, não a terceira');
    {
      const r = await ler({ src, ano: 2026, mes0: 11, pessoas: GENTE, comCabecalho: false });
      /* Dezembro/2026 começa numa terça: a primeira semana do calendário
         vai do dia 1 ao 6. Quem faz aniversário no dia 1 tem o AF ali
         dentro, e a semana precisa fechar com DUAS folgas contando ele. */
      const fredson = r.anivs[0];
      const semana1 = fredson.codigos.slice(0, 6).filter((c) => c === 'F' || c === 'FA' || c === 'AF').length;
      eq(semana1, 2, 'a semana do aniversário fecha com duas, contando o AF');
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
