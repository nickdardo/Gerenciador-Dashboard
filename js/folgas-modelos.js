/* ===== Gerenciador de Folgas — modelos de planilha para download =========

   Um modelo que o motor não consegue ler não é um modelo: é um arquivo que
   o usuário preenche à mão e que volta com "Nenhuma aba de escala
   encontrada". Por isso o que está aqui não é um desenho bonito de
   planilha — é o formato que `folgas-engine.js` sabe ler, montado de
   propósito para passar pelas quatro peneiras dele:

     1. aba visível e não vazia;
     2. uma linha com pelo menos 28 datas de verdade (serial do Excel,
        não texto) entre as colunas C e CL;
     3. o mês COMPLETO nessa linha — falta um dia, a aba é descartada;
     4. abaixo dela, linhas com matrícula numérica (>= 1000) na coluna A
        e nome na coluna B.

   Três detalhes que parecem decoração e não são:

   - ENTRADA e SAÍDA precisam ser HORA de verdade (fração do dia), não o
     texto "06:00". O motor lê `typeof v === 'number'`; com texto, o
     horário some e a escala volta sem horário nenhum.
   - A tabela de CH é quem decide quantas folgas o mês pede no 6x1
     (teto de horas ÷ jornada). Os valores são os mesmos de
     ESCALA_CH_REGRAS, em js/escala.js — se as duas tabelas divergirem,
     o mesmo colaborador recebe metas diferentes em cada ferramenta.
   - Os dias do mês ANTERIOR, à esquerda do dia 1º, não são enfeite: são
     o histórico de sequência. Sem eles o motor não sabe quantos dias a
     pessoa já vinha trabalhando na virada do mês, e pode abrir o mês
     emendando um sétimo dia seguido.

   O teste testes/teste-folgas-modelos.js gera cada modelo e o entrega ao
   motor de verdade. É a única forma de saber que o modelo presta antes
   de o usuário descobrir.
   ========================================================================= */
(function (root) {
  'use strict';

  const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const DOW = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

  /* Mesma tabela de ESCALA_CH_REGRAS (js/escala.js). O teto é menor que a
     CH de propósito: desconta o descanso. */
  const CH_REGRAS = {
    60:  { jornada: 2, teto30: 48,  teto31: 48 },
    90:  { jornada: 3, teto30: 72,  teto31: 72 },
    100: { jornada: 4, teto30: 100, teto31: 100 },
    120: { jornada: 4, teto30: 100, teto31: 100 },
    180: { jornada: 6, teto30: 150, teto31: 150 },
    210: { jornada: 7, teto30: 171, teto31: 177 },
  };

  const EPOCA = Date.UTC(1899, 11, 30);
  const serialDe = (ano, mes0, dia) => Math.round((Date.UTC(ano, mes0, dia) - EPOCA) / 86400000);
  const diasNoMes = (ano, mes0) => new Date(Date.UTC(ano, mes0 + 1, 0)).getUTCDate();

  /* Hora como o Excel guarda: fração do dia. "06:00" vira 0,25. */
  function fracao(hhmm) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || '').trim());
    if (!m) return null;
    return (Number(m[1]) * 60 + Number(m[2])) / 1440;
  }

  /* Saída = entrada + jornada, somando o intervalo só quando ele é de uma
     hora (CH 210) — a mesma regra de escalaSaidaCalculada. */
  function saidaFracao(entrada, ch) {
    const ini = fracao(entrada);
    const regra = CH_REGRAS[Number(ch)];
    if (ini === null || !regra) return null;
    const intervalo = Number(ch) >= 210 ? 60 : 0;
    return ((ini * 1440 + regra.jornada * 60 + intervalo) % 1440) / 1440;
  }

  const COL_CH = 50;        // a tabela de CH mora longe da grade, à direita
  const DIAS_PREV = 7;      // rabicho do mês anterior: histórico de sequência

  /* ---------------------------------------------------------- uma aba ---- */

  /* `grupos` é [{ nome, pessoas: [{ mat, nome, ch, entrada, equipe, vaga }] }].
     Grupo sem nome não gera linha de rótulo — é o caso do modelo enxuto,
     em que o bloco inteiro é um grupo só e o título da aba já o nomeia. */
  function montarAba({ titulo, subtitulo, ano, mes0, grupos, exemplo }) {
    const D = diasNoMes(ano, mes0);
    const prim = serialDe(ano, mes0, 1);

    const celulas = new Map();                    // "r,c" -> valor
    const datas = [];                             // células com formato de data
    const horas = [];                             // células com formato de hora
    const set = (r, c, v) => { if (v !== null && v !== undefined && v !== '') celulas.set(r + ',' + c, v); };

    const HDR = 3, LINHA_DATA = 4;
    const C0 = 3;                                 // primeira coluna de dia
    const L = C0 + DIAS_PREV + D - 1;             // última coluna do mês

    set(1, 1, 'GERENCIADOR DE FOLGAS');
    set(2, 1, subtitulo || `${MESES[mes0]} de ${ano}`);

    // Cabeçalho da grade.
    set(HDR, 2, titulo);
    set(LINHA_DATA, 1, 'MATRÍCULA');
    set(LINHA_DATA, 2, 'NOME');

    // Dias: primeiro o rabicho do mês anterior, depois o mês inteiro.
    for (let i = 0; i < DIAS_PREV; i++) {
      const s = prim - DIAS_PREV + i;
      const c = C0 + i;
      const d = new Date(EPOCA + s * 86400000);
      set(HDR, c, DOW[d.getUTCDay()]);
      set(LINHA_DATA, c, s);
      datas.push([LINHA_DATA, c]);
    }
    for (let dia = 1; dia <= D; dia++) {
      const c = C0 + DIAS_PREV + dia - 1;
      const s = prim + dia - 1;
      const d = new Date(EPOCA + s * 86400000);
      set(HDR, c, DOW[d.getUTCDay()]);
      set(LINHA_DATA, c, s);
      datas.push([LINHA_DATA, c]);
    }

    /* Colunas da direita. Os rótulos ficam onde o motor os procura:
       FOLGA AGRUPADA, CARGA HORARIA e EQUIPE na linha de cima da data;
       ENTRADA e SAÍDA na própria linha da data. */
    set(HDR, L + 1, 'FOLGA AGRUPADA');
    set(HDR, L + 2, 'CARGA HORARIA');
    set(HDR, L + 3, 'EQUIPE');
    set(HDR, L + 4, 'HORÁRIO');
    set(LINHA_DATA, L + 4, 'ENTRADA');
    set(LINHA_DATA, L + 5, 'SAÍDA');

    // Tabela de CH, longe da grade para não disputar colunas com ela.
    set(1, COL_CH, 'CH');
    set(1, COL_CH + 1, 'HORAS NO MÊS');
    set(1, COL_CH + 2, 'JORNADA');
    Object.keys(CH_REGRAS).map(Number).sort((a, b) => a - b).forEach((ch, i) => {
      const regra = CH_REGRAS[ch];
      set(2 + i, COL_CH, ch);
      set(2 + i, COL_CH + 1, D === 31 ? regra.teto31 : regra.teto30);
      set(2 + i, COL_CH + 2, regra.jornada);
    });

    // Pessoas.
    let r = LINHA_DATA + 1;
    for (const g of grupos) {
      if (g.nome) { set(r, 1, g.nome); r++; }
      for (const p of g.pessoas) {
        set(r, 1, p.vaga ? String(p.mat) : Number(p.mat));
        set(r, 2, p.nome);
        if (p.ch) set(r, L + 2, Number(p.ch));
        if (p.equipe) set(r, L + 3, p.equipe);
        const ent = fracao(p.entrada);
        if (ent !== null) {
          set(r, L + 4, ent); horas.push([r, L + 4]);
          const sai = p.saida ? fracao(p.saida) : saidaFracao(p.entrada, p.ch);
          if (sai !== null) { set(r, L + 5, sai); horas.push([r, L + 5]); }
        }
        r++;
      }
      r++;                                        // uma linha de respiro
    }

    /* No modelo vazio sobram linhas em branco para digitar. Elas não são
       lidas por ninguém — é espaço de trabalho. */
    if (exemplo) r += 40;

    return { celulas, datas, horas, ultimaLinha: r, ultimaColuna: COL_CH + 2, L };
  }

  /* --------------------------------------------------- aba de instruções - */

  /* O motor descarta esta aba (não tem linha de datas) e anota o motivo
     num diagnóstico que só aparece quando NENHUMA aba serve. Então ela é
     inofensiva — e é o único lugar em que cabe explicar os códigos. */
  function abaInstrucoes(ano, mes0) {
    const D = diasNoMes(ano, mes0);
    return [
      ['GERENCIADOR DE FOLGAS — COMO PREENCHER'],
      [`Modelo gerado para ${MESES[mes0]} de ${ano} (${D} dias).`],
      [],
      ['1. NÃO MEXA NA LINHA DAS DATAS'],
      ['   O painel acha o mês por ela. Apagar um dia, transformar a data em texto ou'],
      ['   reordenar as colunas faz a aba inteira ser descartada na leitura.'],
      [],
      ['2. OS DIAS CINZAS À ESQUERDA DO DIA 1º'],
      ['   São os últimos dias do mês passado. Preencha com o que a pessoa fez de verdade:'],
      ['   é assim que o painel sabe quantos dias seguidos ela já vinha trabalhando e não'],
      ['   emenda um sétimo dia na virada do mês. Em branco, o mês começa do zero.'],
      [],
      ['3. UMA LINHA POR PESSOA'],
      ['   Coluna A: matrícula (número). Coluna B: nome.'],
      ['   Vaga ainda sem gente: ponha um código curto na matrícula (C16, A3) e o cargo no nome.'],
      ['   A vaga recebe folga como qualquer um — é ela que vai ser ocupada.'],
      [],
      ['4. LINHA DE GRUPO'],
      ['   Para separar turnos ou funções, deixe uma linha só com o texto na coluna A'],
      ['   (ex.: ASG LIMPEZA — 06:00 ÀS 12:00). Tudo abaixo dela pertence a esse grupo,'],
      ['   até a próxima linha de rótulo.'],
      [],
      ['5. CARGA HORÁRIA E HORÁRIO'],
      ['   CARGA HORARIA tem de ser número (180, 210...). É ela que define a meta de folgas'],
      ['   do mês, cruzando com a tabela de CH que está à direita da grade.'],
      ['   ENTRADA e SAÍDA têm de estar formatadas como HORA, não como texto.'],
      [],
      ['6. CÓDIGOS QUE O PAINEL ENTENDE'],
      ['   F    folga'],
      ['   FA   folga adicional (vem grudada no F do domingo)'],
      ['   L    férias'],
      ['   K    curso / treinamento (conta como dia trabalhado)'],
      ['   AF   afastamento'],
      ['   CH   compensação'],
      ['   Qualquer outro código é avisado na tela antes de gerar.'],
      [],
      ['7. O QUE O PAINEL FAZ'],
      ['   Distribui as folgas que faltam respeitando: no máximo 6 dias seguidos de trabalho,'],
      ['   um domingo de folga por pessoa no mês e a meta de folgas da CH. O que você já'],
      ['   escreveu na planilha fica travado — o painel preenche só o que está em branco.'],
      [],
      ['8. DEPOIS DE PREENCHER'],
      ['   Volte ao painel, suba este arquivo no passo 2 e clique em gerar. O download sai'],
      ['   com a sua formatação intacta: o painel só escreve nas células dos dias.'],
    ];
  }

  /* ------------------------------------------------------- os 3 modelos -- */

  const EXEMPLOS = {
    enxuto: () => [{
      nome: '',
      pessoas: [
        { mat: 1001, nome: 'EXEMPLO — APAGUE ESTA LINHA', ch: 180, entrada: '06:00', equipe: 'A' },
        { mat: 1002, nome: 'EXEMPLO — APAGUE ESTA LINHA', ch: 180, entrada: '14:00', equipe: 'B' },
        { mat: 1003, nome: 'EXEMPLO — APAGUE ESTA LINHA', ch: 210, entrada: '08:00', equipe: 'A' },
      ],
    }],
    grupos: () => [
      { nome: 'ASG LIMPEZA — 06:00 ÀS 12:00', pessoas: [
        { mat: 1001, nome: 'EXEMPLO — APAGUE ESTA LINHA', ch: 180, entrada: '06:00', equipe: 'A' },
        { mat: 1002, nome: 'EXEMPLO — APAGUE ESTA LINHA', ch: 180, entrada: '06:00', equipe: 'A' },
      ] },
      { nome: 'ASG LIMPEZA — 14:00 ÀS 20:00', pessoas: [
        { mat: 1003, nome: 'EXEMPLO — APAGUE ESTA LINHA', ch: 180, entrada: '14:00', equipe: 'B' },
      ] },
      { nome: 'ENCARREGADO', pessoas: [
        { mat: 1004, nome: 'EXEMPLO — APAGUE ESTA LINHA', ch: 210, entrada: '08:00', equipe: 'A' },
      ] },
    ],
    completo: () => [
      { nome: 'ASG LIMPEZA — 06:00 ÀS 12:00', pessoas: [
        { mat: 1001, nome: 'EXEMPLO — APAGUE ESTA LINHA', ch: 180, entrada: '06:00', equipe: 'A' },
        { mat: 1002, nome: 'EXEMPLO — APAGUE ESTA LINHA', ch: 180, entrada: '06:00', equipe: 'A' },
      ] },
      { nome: 'ASG LIMPEZA — 22:00 ÀS 04:00', pessoas: [
        { mat: 1003, nome: 'EXEMPLO — APAGUE ESTA LINHA', ch: 180, entrada: '22:00', equipe: 'C' },
        { mat: 'C16', nome: 'VAGA EM ABERTO — ASG LIMPEZA', ch: 180, entrada: '22:00', equipe: 'C', vaga: true },
      ] },
    ],
  };

  const MODELOS = {
    enxuto: {
      id: 'enxuto',
      nome: 'Enxuto',
      resumo: 'Uma equipe só, numa aba só.',
      detalhe: 'Matrícula, nome, os dias do mês, carga horária e horário. É o menor arquivo que o painel consegue ler.',
      indicado: 'Até cerca de 60 pessoas, sem divisão por turno.',
      abas: ['ESCALA'],
    },
    grupos: {
      id: 'grupos',
      nome: 'Por grupos',
      resumo: 'Turnos e funções separados por rótulo.',
      detalhe: 'Mesma estrutura do enxuto, com linhas de título separando cada grupo. O painel distribui as folgas respeitando a cobertura de cada um.',
      indicado: 'Uma base inteira numa aba, dividida por função e horário.',
      abas: ['ESCALA'],
    },
    completo: {
      id: 'completo',
      nome: 'Completo',
      resumo: 'Uma aba por setor, com vagas em aberto.',
      detalhe: 'Grupos, equipe, folga agrupada e linhas de vaga ainda sem gente — a vaga também entra na conta da cobertura.',
      indicado: 'Operação com setores que fecham escala separados.',
      abas: ['LIMPEZA', 'RAMPA', 'ADMINISTRATIVO'],
    },
  };

  /* ------------------------------------------------------- construção ---- */

  function matrizDe(aba) {
    const linhas = [];
    for (let r = 1; r <= aba.ultimaLinha; r++) {
      const linha = new Array(aba.ultimaColuna).fill(null);
      for (let c = 1; c <= aba.ultimaColuna; c++) {
        const v = aba.celulas.get(r + ',' + c);
        if (v !== undefined) linha[c - 1] = v;
      }
      linhas.push(linha);
    }
    return linhas;
  }

  const ref = (r, c) => XLSX.utils.encode_cell({ r: r - 1, c: c - 1 });

  function folhaDe(aba) {
    const ws = XLSX.utils.aoa_to_sheet(matrizDe(aba));
    /* O formato não é cosmético para as datas: sem ele o Excel mostra
       46.328 no lugar de 01/11. Para as horas é pior — o usuário vê
       0,25 e "corrige" digitando texto, que o motor não lê. */
    for (const [r, c] of aba.datas) { const cel = ws[ref(r, c)]; if (cel) cel.z = 'dd/mm'; }
    for (const [r, c] of aba.horas) { const cel = ws[ref(r, c)]; if (cel) cel.z = 'hh:mm'; }
    const cols = new Array(aba.ultimaColuna).fill(null).map(() => ({ wch: 5 }));
    cols[0] = { wch: 12 };
    cols[1] = { wch: 30 };
    for (let c = aba.L + 1; c <= aba.L + 5; c++) cols[c - 1] = { wch: 14 };
    for (let c = COL_CH; c <= COL_CH + 2; c++) cols[c - 1] = { wch: 14 };
    ws['!cols'] = cols;
    ws['!freeze'] = { xSplit: 2, ySplit: 4 };
    return ws;
  }

  /* `pessoasPorAba` opcional: { 'LIMPEZA': [grupos...] } para a versão
     preenchida com o efetivo da base. Sem ela, o modelo sai com as linhas
     de exemplo. */
  function construir(id, { ano, mes0, base, pessoasPorAba } = {}) {
    const modelo = MODELOS[id];
    if (!modelo) throw new Error('Modelo desconhecido: ' + id);
    const hoje = new Date();
    if (ano == null || mes0 == null) {
      const prox = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() + 1, 1));
      ano = prox.getUTCFullYear(); mes0 = prox.getUTCMonth();
    }

    const wb = XLSX.utils.book_new();
    const subtitulo = `${base ? base + ' · ' : ''}${MESES[mes0]} de ${ano}`;

    for (const nomeAba of modelo.abas) {
      const preenchida = pessoasPorAba && pessoasPorAba[nomeAba];
      const grupos = preenchida && preenchida.length ? preenchida : EXEMPLOS[id]();
      const aba = montarAba({
        titulo: modelo.abas.length > 1 ? nomeAba : (base ? `ESCALA — ${base}` : 'ESCALA'),
        subtitulo, ano, mes0, grupos, exemplo: !preenchida,
      });
      XLSX.utils.book_append_sheet(wb, folhaDe(aba), nomeAba);
    }

    const wsInstr = XLSX.utils.aoa_to_sheet(abaInstrucoes(ano, mes0));
    wsInstr['!cols'] = [{ wch: 100 }];
    XLSX.utils.book_append_sheet(wb, wsInstr, 'INSTRUÇÕES');
    return wb;
  }

  function nomeArquivo(id, { ano, mes0, base, preenchido }) {
    const mm = String(mes0 + 1).padStart(2, '0');
    return `Modelo_folgas_${MODELOS[id].nome.replace(/\s/g, '')}`
      + `${base ? '_' + base : ''}_${ano}-${mm}${preenchido ? '_com_efetivo' : ''}.xlsx`;
  }

  function baixar(id, opts = {}) {
    const wb = construir(id, opts);
    XLSX.writeFile(wb, nomeArquivo(id, {
      ano: opts.ano, mes0: opts.mes0, base: opts.base, preenchido: !!opts.pessoasPorAba,
    }));
  }

  const api = { MODELOS, CH_REGRAS, MESES, construir, baixar, montarAba, nomeArquivo,
    diasNoMes, serialDe, fracao, saidaFracao, DIAS_PREV, COL_CH };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.FolgaModelos = api;
})(typeof window !== 'undefined' ? window : globalThis);

/* ═══════════════════════════════════════════════════════════════════════
   A TELA — bloco de modelos na página do Gerenciador de Folgas

   Fica fora do módulo acima de propósito: ali está só a construção da
   planilha, que o teste roda sem DOM nenhum. Aqui embaixo está o que
   depende de tela e de banco.
   ═══════════════════════════════════════════════════════════════════════ */

/* O modelo é gerado para um mês: a linha de datas, a tabela de CH e o
   rabicho do mês anterior mudam com ele. Por isso a escolha vem antes do
   download, e não depois. */
function fgmMesesOpcoes() {
  const hoje = new Date();
  const out = [];
  for (let d = -1; d <= 3; d++) {
    const m = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() + d, 1));
    const ano = m.getUTCFullYear(), mes0 = m.getUTCMonth();
    out.push({ valor: `${ano}-${String(mes0 + 1).padStart(2, '0')}`, ano, mes0,
      rotulo: `${FolgaModelos.MESES[mes0]} de ${ano}`, padrao: d === 1 });
  }
  return out;
}

function fgmBlocoHTML() {
  const bases = (window.currentUserProfile?.bases || []).filter((b) => b !== '*');
  const meses = fgmMesesOpcoes();

  const cartao = (m) => `
    <div class="fgm-card">
      <div class="fgm-card-top">
        <h3>${m.nome}</h3>
        <span class="fgm-tag">${m.abas.length === 1 ? '1 aba' : m.abas.length + ' abas'}</span>
      </div>
      <p class="fgm-resumo">${m.resumo}</p>
      <p class="fgm-detalhe">${m.detalhe}</p>
      <p class="fgm-indicado"><b>Indicado para</b> ${m.indicado}</p>
      <div class="fgm-acoes">
        <button class="fg-btn fg-primary" type="button" onclick="fgmBaixar('${m.id}', true)">Com o efetivo da base</button>
        <button class="fg-btn" type="button" onclick="fgmBaixar('${m.id}', false)">Em branco</button>
      </div>
    </div>`;

  return `
  <div class="fg-scope fgm-wrap">
    <div class="fgm-top">
      <div>
        <div class="fg-eyebrow">Passo zero · modelos</div>
        <h2 class="fg-title">Comece pela planilha</h2>
        <p class="fgm-sub">O arquivo sai pronto para o mês escolhido: linha de datas, tabela de carga horária,
          legenda dos códigos e os últimos dias do mês anterior já no lugar — é deles que o painel tira
          quantos dias seguidos cada um já vinha trabalhando na virada.</p>
      </div>
      <div class="fgm-filtros">
        <label class="fgm-campo"><span>Base</span>
          <select class="adh-month-select" id="fgm-base">
            ${bases.length
              ? bases.map((b) => `<option value="${b}">${b}</option>`).join('')
              : '<option value="">sem base atribuída</option>'}
          </select>
        </label>
        <label class="fgm-campo"><span>Mês</span>
          <select class="adh-month-select" id="fgm-mes">
            ${meses.map((m) => `<option value="${m.valor}"${m.padrao ? ' selected' : ''}>${m.rotulo}</option>`).join('')}
          </select>
        </label>
      </div>
    </div>

    <div class="fgm-cards">${Object.values(FolgaModelos.MODELOS).map(cartao).join('')}</div>

    <p class="fgm-nota" id="fgm-nota">
      <b>Com o efetivo da base</b> traz matrícula, nome e carga horária de todo mundo que está cadastrado
      naquela base, agrupado por função — apague quem não entra nesta escala e preencha os horários.
      <b>Em branco</b> traz só a estrutura, com três linhas de exemplo para apagar.
      Nos dois casos os dias do mês saem vazios: é o painel que os preenche.
    </p>
  </div>`;
}

function fgmMontar() {
  const sel = document.getElementById('fgm-base');
  if (!sel) return;
  // A base da última visita, para não reescolher a cada entrada.
  try {
    const ultima = localStorage.getItem('gde_escala_ultima_base');
    if (ultima && [...sel.options].some((o) => o.value === ultima)) sel.value = ultima;
  } catch (_) {}
}

function fgmAviso(texto, erro) {
  const box = document.getElementById('fgm-nota');
  if (!box) return;
  box.innerHTML = `<span class="${erro ? 'fgm-erro' : 'fgm-ok'}">${texto}</span>`;
}

/* Todo o efetivo da base, sem o teto de mil linhas do PostgREST.

   O cadastro de uma base grande passa de mil, e a consulta simples volta
   calada com exatamente mil — o modelo sairia com 1.000 das 1.200
   pessoas e ninguém notaria até a escala do mês vir faltando gente. */
async function fgmEfetivoDaBase(base) {
  const PAGE = 1000;
  const todas = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db.from('colaboradores')
      .select('matricula,nome,funcao,ch,situacao')
      .eq('station', base)
      .order('funcao', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    if (data && data.length) todas.push(...data);
    if (!data || data.length < PAGE) break;
  }
  return todas;
}

/* Agrupa por função, que é como a escala é lida e conferida. Sem grupo,
   1.200 linhas em ordem de matrícula não dizem nada a quem preenche. */
function fgmAgrupar(pessoas) {
  const porFuncao = new Map();
  for (const p of pessoas) {
    const f = String(p.funcao || 'SEM FUNÇÃO').trim().toUpperCase();
    if (!porFuncao.has(f)) porFuncao.set(f, []);
    porFuncao.get(f).push({
      mat: p.matricula, nome: p.nome,
      ch: Number(String(p.ch || '').replace(/\D/g, '')) || null,
      equipe: '',
    });
  }
  return [...porFuncao.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'))
    .map(([nome, pessoas]) => ({ nome, pessoas }));
}

async function fgmBaixar(id, comEfetivo) {
  const base = document.getElementById('fgm-base')?.value || '';
  const [ano, mes] = String(document.getElementById('fgm-mes')?.value || '').split('-');
  const opts = { ano: Number(ano), mes0: Number(mes) - 1, base: base || null };

  if (!comEfetivo) {
    FolgaModelos.baixar(id, opts);
    fgmAviso(`Modelo ${FolgaModelos.MODELOS[id].nome} baixado em branco. Preencha e volte pelo passo 2.`);
    return;
  }

  if (!base) { fgmAviso('Escolha uma base para trazer o efetivo — ou baixe o modelo em branco.', true); return; }

  fgmAviso('Buscando o efetivo da base...');
  try {
    const pessoas = await fgmEfetivoDaBase(base);
    if (!pessoas.length) {
      fgmAviso(`Não há ninguém cadastrado na base ${base}. Baixe o modelo em branco e monte a lista à mão.`, true);
      return;
    }
    const grupos = fgmAgrupar(pessoas);
    /* No modelo de várias abas o efetivo inteiro vai para a primeira; as
       outras ficam com os exemplos, para o usuário recortar entre elas.
       Dividir por conta própria seria chutar a que setor cada função
       pertence — e um chute errado some com gente da escala. */
    const abas = FolgaModelos.MODELOS[id].abas;
    const pessoasPorAba = { [abas[0]]: grupos };

    FolgaModelos.baixar(id, { ...opts, pessoasPorAba });
    const semCH = pessoas.filter((p) => !p.ch).length;
    fgmAviso(`Modelo ${FolgaModelos.MODELOS[id].nome} baixado com ${pessoas.length.toLocaleString('pt-BR')} pessoa(s) de ${base}, em ${grupos.length} função(ões).`
      + (semCH ? ` ${semCH} sem carga horária no cadastro — preencha na planilha, é ela que define a meta de folgas.` : '')
      + (abas.length > 1 ? ` O efetivo foi para a aba ${abas[0]}; distribua entre as outras conforme o seu setor.` : ''));
  } catch (e) {
    fgmAviso('Não consegui buscar o efetivo: ' + (e.message || e) + '. O modelo em branco continua disponível.', true);
  }
}
