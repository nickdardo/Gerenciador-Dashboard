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

  /* ------------------------------------- feriados e datas bloqueadas ----- */

  /* Páscoa pelo algoritmo gregoriano anônimo. Serve para carnaval, sexta-feira
     santa e Corpus Christi, que mudam de data todo ano — justamente os que
     alguém esquece de bloquear à mão. */
  function pascoa(ano) {
    const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100;
    const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4), k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const mes = Math.floor((h + l - 7 * m + 114) / 31);
    const dia = ((h + l - 7 * m + 114) % 31) + 1;
    return Date.UTC(ano, mes - 1, dia);
  }

  const DIA = 86400000;

  /* Só os NACIONAIS. Feriado municipal e ponto facultativo variam de base
     para base e ninguém aqui tem essa lista; o modelo diz isso na própria
     planilha, para o usuário acrescentar os dele em vez de supor que está
     tudo coberto. */
  function feriadosNacionais(ano) {
    const p = pascoa(ano);
    const fixos = [
      [0, 1, 'Confraternização Universal'], [3, 21, 'Tiradentes'],
      [4, 1, 'Dia do Trabalho'], [8, 7, 'Independência'],
      [9, 12, 'Nossa Senhora Aparecida'], [10, 2, 'Finados'],
      [10, 15, 'Proclamação da República'], [10, 20, 'Consciência Negra'],
      [11, 25, 'Natal'],
    ].map(([m, d, nome]) => ({ ts: Date.UTC(ano, m, d), nome }));
    const moveis = [
      { ts: p - 48 * DIA, nome: 'Carnaval' },
      { ts: p - 47 * DIA, nome: 'Carnaval' },
      { ts: p - 2 * DIA, nome: 'Sexta-feira Santa' },
      { ts: p + 60 * DIA, nome: 'Corpus Christi' },
    ];
    return [...fixos, ...moveis].sort((a, b) => a.ts - b.ts);
  }

  function feriadosDoMes(ano, mes0) {
    return feriadosNacionais(ano).filter((f) => {
      const d = new Date(f.ts);
      return d.getUTCFullYear() === ano && d.getUTCMonth() === mes0;
    }).map((f) => ({ dia: new Date(f.ts).getUTCDate(), nome: f.nome, ts: f.ts }));
  }

  /* ---------------------------------------- Programação de Cursos -------- */

  /* O arquivo oficial, com as abas que o planejador lê: CURSOS (quem faz o
     quê), JANELAS (em que dias cada curso pode cair), BLOQUEIOS (dias em que
     curso nenhum pode cair) e DB (o efetivo da base, para não redigitar nome
     e função e para o painel conferir quem está de férias).

     Sábado e domingo NÃO entram em BLOQUEIOS: o planejador já nunca marca
     curso em fim de semana. Encher a aba com oito sábados esconderia os
     feriados, que são a informação que ele não tem como adivinhar. */
  function construirCursos({ ano, mes0, base, pessoas } = {}) {
    const hoje = new Date();
    if (ano == null || mes0 == null) {
      const prox = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() + 1, 1));
      ano = prox.getUTCFullYear(); mes0 = prox.getUTCMonth();
    }
    const lista = pessoas || [];
    const wb = XLSX.utils.book_new();
    const datas = [];                    // [aba, r, c] a formatar como data

    // ── CURSOS ────────────────────────────────────────────────────────────
    const cursos = [['MATRÍCULA', 'NOME', 'FUNÇÃO', 'CURSO', 'DATA', 'HORA INÍCIO',
      'HORA FIM', 'SITUAÇÃO', 'OBSERVAÇÃO', 'NA BASE']];
    /* O efetivo NÃO vem aqui — vem na aba DB. Pré-lançar todo mundo com o
       curso em branco pareceria adiantar trabalho, mas uma linha sem curso
       é um erro de leitura: uma base de 300 pessoas abriria o painel com
       300 erros "matrícula sem curso informado", e o aviso que importa se
       perderia no meio. Aqui ficam só duas linhas de exemplo; quem preenche
       copia da aba DB as pessoas que realmente vão fazer curso. */
    const quemExemplo = lista.slice(0, 2);
    if (quemExemplo.length) {
      quemExemplo.forEach((p, i) => cursos.push([p.mat, p.nome, p.funcao || '',
        i ? 'AIRSIDE SAFETY' : 'RAMPA DNATA', '', '', '', 'painel distribui',
        'EXEMPLO — apague ou troque', p.descricao || '']));
    } else {
      cursos.push([1001, 'EXEMPLO — APAGUE ESTA LINHA', 'AUX RAMPA I', 'RAMPA DNATA', '', '', '', 'painel distribui', '', 'Trabalhando']);
    }
    const wsCursos = XLSX.utils.aoa_to_sheet(cursos);
    wsCursos['!cols'] = [{ wch: 11 }, { wch: 32 }, { wch: 26 }, { wch: 26 }, { wch: 11 },
      { wch: 12 }, { wch: 11 }, { wch: 16 }, { wch: 22 }, { wch: 14 }];
    wsCursos['!freeze'] = { xSplit: 0, ySplit: 1 };
    XLSX.utils.book_append_sheet(wb, wsCursos, 'CURSOS');

    // ── JANELAS ───────────────────────────────────────────────────────────
    const janelas = [['CURSO', 'TIPO', 'DIAS PERMITIDOS', 'HORA INÍCIO', 'HORA FIM']];
    const exemplos = [
      ['RAMPA DNATA', 'INTERNO', '', '08:00', '17:00'],
      ['AIRSIDE SAFETY', 'INTERNO', '', '08:00', '12:00'],
      ['SAÚDE E SEGURANÇA/ SMS', 'INTERNO', '', '08:00', '12:00'],
      ['AVSEC OPERAÇÃO DE SOLO', 'EXTERNO', '06 - 11', '08:00', '17:00'],
      ['DG F5', 'EXTERNO', '03, 05, 17, 19, 26', '08:00', '17:00'],
    ];
    janelas.push(...exemplos);
    const wsJan = XLSX.utils.aoa_to_sheet(janelas);
    wsJan['!cols'] = [{ wch: 30 }, { wch: 11 }, { wch: 24 }, { wch: 12 }, { wch: 11 }];
    wsJan['!freeze'] = { xSplit: 0, ySplit: 1 };
    XLSX.utils.book_append_sheet(wb, wsJan, 'JANELAS');

    // ── BLOQUEIOS ─────────────────────────────────────────────────────────
    const blo = [['DATA', 'MOTIVO']];
    for (const f of feriadosDoMes(ano, mes0)) {
      blo.push([serialDe(ano, mes0, f.dia), f.nome + ' (feriado nacional)']);
      datas.push(['BLOQUEIOS', blo.length, 1]);
    }
    const wsBlo = XLSX.utils.aoa_to_sheet(blo);
    wsBlo['!cols'] = [{ wch: 13 }, { wch: 46 }];
    wsBlo['!freeze'] = { xSplit: 0, ySplit: 1 };
    XLSX.utils.book_append_sheet(wb, wsBlo, 'BLOQUEIOS');

    // ── DB ────────────────────────────────────────────────────────────────
    const bd = [['Base', 'Matrícula', 'Nome', 'Função', 'C.H.', 'Admissão', 'Situação', 'Descrição']];
    for (const p of lista) {
      bd.push([p.base || base || '', p.mat, p.nome, p.funcao || '', p.ch || '',
        p.admissao || '', p.situacao || 'Ativo', p.descricao || '']);
    }
    const wsBd = XLSX.utils.aoa_to_sheet(bd);
    wsBd['!cols'] = [{ wch: 8 }, { wch: 11 }, { wch: 32 }, { wch: 28 }, { wch: 7 },
      { wch: 12 }, { wch: 11 }, { wch: 16 }];
    wsBd['!freeze'] = { xSplit: 0, ySplit: 1 };
    XLSX.utils.book_append_sheet(wb, wsBd, 'DB');

    // ── INSTRUÇÕES ────────────────────────────────────────────────────────
    const instr = [
      ['PROGRAMAÇÃO DE CURSOS — COMO PREENCHER'],
      [`Modelo gerado para ${MESES[mes0]} de ${ano}${base ? ' · base ' + base : ''}.`],
      [],
      ['ABA CURSOS — quem faz o quê'],
      ['   Uma linha por pessoa e por curso. Deixe a DATA em branco para o painel escolher;'],
      ['   preencha a DATA só quando ela já estiver fechada com o fornecedor — o painel respeita.'],
      ['   Apague as linhas de quem não vai fazer curso neste mês.'],
      [],
      ['ABA JANELAS — quando cada curso pode acontecer'],
      ['   TIPO: INTERNO (a dnata marca quando quiser) ou EXTERNO (data imposta pelo fornecedor).'],
      ['   DIAS PERMITIDOS: deixe vazio para o mês inteiro, ou escreva os dias — 06 - 11, ou 03, 05, 17.'],
      ['   ATENÇÃO: digite um apóstrofo antes (\'06 - 11), senão o Excel transforma em data e o painel reclama.'],
      [],
      ['ABA BLOQUEIOS — dias em que não se marca curso'],
      ['   Os feriados NACIONAIS do mês já vêm preenchidos. Acrescente os municipais, os pontos'],
      ['   facultativos e qualquer data de parada programada: uma linha por data, com o motivo.'],
      ['   Sábados e domingos NÃO precisam ser listados — o painel já não marca curso em fim de semana.'],
      ['   Dia bloqueado sai da escolha do painel, e não volta nem quando falta data: feriado não cede.'],
      [],
      ['ABA DB — o efetivo da base'],
      ['   Vem preenchida com quem está ativo na base escolhida. O painel usa para completar nome e'],
      ['   função e para avisar quando alguém inscrito está de férias ou afastado. Não precisa mexer.'],
      [],
      ['DEPOIS DE PREENCHER'],
      ['   Suba este arquivo no Gerenciador de Folgas, junto com a escala do mês. O painel escolhe as'],
      ['   datas que menos derrubam a cobertura e devolve a planilha com a coluna DATA preenchida.'],
    ];
    const wsIns = XLSX.utils.aoa_to_sheet(instr);
    wsIns['!cols'] = [{ wch: 104 }];
    XLSX.utils.book_append_sheet(wb, wsIns, 'INSTRUÇÕES');

    for (const [aba, r, c] of datas) {
      const cel = wb.Sheets[aba][ref(r, c)];
      if (cel) cel.z = 'dd/mm/yyyy';
    }
    return wb;
  }

  function baixarCursos(opts = {}) {
    const wb = construirCursos(opts);
    const mm = String((opts.mes0 ?? 0) + 1).padStart(2, '0');
    XLSX.writeFile(wb, `Programacao-de-Cursos${opts.base ? '_' + opts.base : ''}_${opts.ano}-${mm}.xlsx`);
  }

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
    diasNoMes, serialDe, fracao, saidaFracao, DIAS_PREV, COL_CH,
    construirCursos, baixarCursos, feriadosNacionais, feriadosDoMes, pascoa };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.FolgaModelos = api;
})(typeof window !== 'undefined' ? window : globalThis);

/* ═══════════════════════════════════════════════════════════════════════
   A TELA — bloco de modelos na página do Gerenciador de Folgas

   Fica fora do módulo acima de propósito: ali está só a construção da
   planilha, que o teste roda sem DOM nenhum. Aqui embaixo está o que
   depende de tela, de perfil de usuário e de banco.
   ═══════════════════════════════════════════════════════════════════════ */

/* Quais bases este usuário pode ver.

   O filtro antigo era `(bases || []).filter(b => b !== '*')`, o que para um
   admin — cujo perfil é exatamente ['*'] — devolvia lista vazia e escrevia
   "sem base atribuída" na tela de quem pode ver tudo. O curinga precisa ser
   TROCADO pela lista real, não removido.

   A lista real sai do cadastro já carregado em memória (window.eoColabs),
   que é o mesmo lugar de onde o Admin tira a dele. Base sem ninguém
   cadastrado não aparece: não haveria efetivo para pôr no Excel. */
function fgmBasesDisponiveis() {
  const perfil = window.currentUserProfile?.bases || [];
  const todas = new Set();
  if (window.eoColabs?.size) {
    for (const [, r] of window.eoColabs) {
      const st = String(r.station || '').trim().toUpperCase();
      if (st) todas.add(st);
    }
  }
  const doCadastro = [...todas].sort();
  if (perfil.includes('*')) return doCadastro;
  const autorizadas = perfil.map((b) => String(b).trim().toUpperCase());
  /* Base autorizada que ainda não tem cadastro continua na lista: o usuário
     pode baixar o modelo em branco para ela. Some só a que ninguém
     autorizou. */
  return [...new Set([...autorizadas])].filter(Boolean).sort();
}

/* Efetivo ativo de uma base, com a data do cadastro.

   Prefere a memória: o painel já carrega o cadastro inteiro na abertura,
   então filtrar por base ali é instantâneo e não gasta uma ida ao banco a
   cada download. A consulta fica como reserva para quando a página for
   aberta antes de o cadastro terminar de carregar. */
function fgmEfetivoEmMemoria(base) {
  if (!window.eoColabs?.size) return null;
  const alvo = String(base || '').trim().toUpperCase();
  const out = [];
  let maisRecente = null;
  for (const [, r] of window.eoColabs) {
    if (String(r.station || '').trim().toUpperCase() !== alvo) continue;
    out.push({
      mat: r.matricula, nome: r.nome, funcao: r.funcao,
      ch: Number(String(r.ch || '').replace(/\D/g, '')) || null,
      situacao: r.situacao, descricao: r.situacao, admissao: r.admissao, base: alvo,
    });
    if (r.updated_at && (!maisRecente || r.updated_at > maisRecente)) maisRecente = r.updated_at;
  }
  return { pessoas: out, atualizadoEm: maisRecente };
}

async function fgmEfetivoDaBase(base) {
  const memoria = fgmEfetivoEmMemoria(base);
  if (memoria && memoria.pessoas.length) return memoria;

  /* Sem o teto de mil linhas do PostgREST: o cadastro de uma base grande
     passa de mil, e a consulta simples volta calada com exatamente mil — o
     modelo sairia com 1.000 das 1.200 pessoas e ninguém notaria até a
     escala do mês vir faltando gente. */
  const PAGE = 1000;
  const todas = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db.from('colaboradores')
      .select('matricula,nome,funcao,ch,situacao,admissao,updated_at')
      .eq('station', base).eq('ativo', true)
      .order('funcao', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    if (data && data.length) todas.push(...data);
    if (!data || data.length < PAGE) break;
  }
  let maisRecente = null;
  for (const r of todas) if (r.updated_at && (!maisRecente || r.updated_at > maisRecente)) maisRecente = r.updated_at;
  return {
    pessoas: todas.map((r) => ({
      mat: r.matricula, nome: r.nome, funcao: r.funcao,
      ch: Number(String(r.ch || '').replace(/\D/g, '')) || null,
      situacao: r.situacao, descricao: r.situacao, admissao: r.admissao,
      base: String(base).toUpperCase(),
    })),
    atualizadoEm: maisRecente,
  };
}

/* O modelo é gerado para um mês: a linha de datas, a tabela de CH, o
   rabicho do mês anterior e os feriados mudam com ele. Por isso a escolha
   vem antes do download, e não depois. */
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
  const bases = fgmBasesDisponiveis();
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
        <p class="fgm-sub">O arquivo sai pronto para a base e o mês escolhidos: linha de datas, tabela de carga horária,
          legenda dos códigos e os últimos dias do mês anterior já no lugar — é deles que o painel tira
          quantos dias seguidos cada um já vinha trabalhando na virada.</p>
      </div>
      <div class="fgm-filtros">
        <label class="fgm-campo"><span>Base</span>
          <select class="adh-month-select" id="fgm-base" onchange="fgmTrocarBase()">
            ${bases.length
              ? bases.map((b) => `<option value="${b}">${b}</option>`).join('')
              : '<option value="">cadastro ainda carregando</option>'}
          </select>
        </label>
        <label class="fgm-campo"><span>Mês</span>
          <select class="adh-month-select" id="fgm-mes">
            ${meses.map((m) => `<option value="${m.valor}"${m.padrao ? ' selected' : ''}>${m.rotulo}</option>`).join('')}
          </select>
        </label>
      </div>
    </div>

    <div class="fgm-efetivo" id="fgm-efetivo"></div>

    <div class="fgm-cards">
      ${Object.values(FolgaModelos.MODELOS).map(cartao).join('')}

      <div class="fgm-card fgm-card-cursos">
        <div class="fgm-card-top">
          <h3>Programação de Cursos</h3>
          <span class="fgm-tag">padrão</span>
        </div>
        <p class="fgm-resumo">O arquivo oficial de cursos do mês.</p>
        <p class="fgm-detalhe">Abas CURSOS, JANELAS, BLOQUEIOS e DB. A aba DB já vem com o efetivo ativo da base,
          e a BLOQUEIOS com os feriados nacionais do mês — acrescente os municipais.</p>
        <p class="fgm-indicado"><b>Indicado para</b> Planejar as datas dos cursos junto com a escala.</p>
        <div class="fgm-acoes">
          <button class="fg-btn fg-primary" type="button" onclick="fgmBaixarCursos(true)">Com o efetivo da base</button>
          <button class="fg-btn" type="button" onclick="fgmBaixarCursos(false)">Em branco</button>
        </div>
      </div>
    </div>

    <p class="fgm-nota" id="fgm-nota">
      <b>Com o efetivo da base</b> traz só quem está cadastrado na base escolhida — nenhuma outra —,
      o que mantém o arquivo leve. <b>Em branco</b> traz só a estrutura, com linhas de exemplo para apagar.
      Nos dois casos os dias do mês saem vazios: é o painel que os preenche.
    </p>
  </div>`;
}

/* Quem o usuário vai baixar, e de quando é esse dado. Sem isso o download é
   uma caixa preta: o arquivo vem com 280 pessoas e não há como saber se o
   cadastro é de ontem ou de abril. */
function fgmTrocarBase() {
  const alvo = document.getElementById('fgm-efetivo');
  const base = document.getElementById('fgm-base')?.value || '';
  if (!alvo) return;
  try { localStorage.setItem('gde_escala_ultima_base', base); } catch (_) {}

  if (!base) {
    alvo.innerHTML = '<span class="fgm-efetivo-vazio">Nenhuma base disponível — '
      + 'o cadastro ainda pode estar carregando, ou o seu acesso não tem base atribuída.</span>';
    return;
  }

  const m = fgmEfetivoEmMemoria(base);
  if (!m) {
    alvo.innerHTML = `<span class="fgm-efetivo-vazio">Base <b>${base}</b> · o cadastro ainda está carregando; `
      + 'o efetivo será buscado no banco na hora do download.</span>';
    return;
  }
  if (!m.pessoas.length) {
    alvo.innerHTML = `<span class="fgm-efetivo-vazio">Base <b>${base}</b> · ninguém cadastrado. `
      + 'Baixe o modelo em branco e monte a lista à mão.</span>';
    return;
  }

  const porFuncao = new Set(m.pessoas.map((p) => p.funcao || 'SEM FUNÇÃO'));
  const semCH = m.pessoas.filter((p) => !p.ch).length;
  const quando = m.atualizadoEm
    ? new Date(m.atualizadoEm).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : null;

  alvo.innerHTML = `
    <span class="fgm-efetivo-chip"><b>${m.pessoas.length.toLocaleString('pt-BR')}</b> pessoa(s) em ${base}</span>
    <span class="fgm-efetivo-chip">${porFuncao.size} função(ões)</span>
    ${quando
      ? `<span class="fgm-efetivo-chip">cadastro atualizado em <b>${quando}</b></span>`
      : '<span class="fgm-efetivo-chip fgm-efetivo-alerta">sem data de atualização no cadastro</span>'}
    ${semCH ? `<span class="fgm-efetivo-chip fgm-efetivo-alerta">${semCH} sem carga horária</span>` : ''}`;
}

function fgmMontar() {
  const sel = document.getElementById('fgm-base');
  if (!sel) return;
  // A base da última visita, para não reescolher a cada entrada.
  try {
    const ultima = localStorage.getItem('gde_escala_ultima_base');
    if (ultima && [...sel.options].some((o) => o.value === ultima)) sel.value = ultima;
  } catch (_) {}
  fgmTrocarBase();

  /* O cadastro carrega em paralelo com a página. Se ele chegar depois, a
     lista de bases fica vazia para sempre — e o admin vê "sem base" numa
     tela em que pode ver todas. */
  if (!window.eoColabs?.size) {
    let tentativas = 0;
    const espera = setInterval(() => {
      if (window.eoColabs?.size) {
        clearInterval(espera);
        const bloco = document.getElementById('fgm-base')?.closest('.fgm-wrap');
        if (bloco) { bloco.outerHTML = fgmBlocoHTML(); fgmMontar(); }
      } else if (++tentativas > 40) clearInterval(espera);   // ~20s e desiste
    }, 500);
  }
}

function fgmAviso(texto, erro) {
  const box = document.getElementById('fgm-nota');
  if (!box) return;
  box.innerHTML = `<span class="${erro ? 'fgm-erro' : 'fgm-ok'}">${texto}</span>`;
}

function fgmEscolha() {
  const base = document.getElementById('fgm-base')?.value || '';
  const [ano, mes] = String(document.getElementById('fgm-mes')?.value || '').split('-');
  return { base, ano: Number(ano), mes0: Number(mes) - 1 };
}

/* Agrupa por função, que é como a escala é lida e conferida. Sem grupo,
   1.200 linhas em ordem de matrícula não dizem nada a quem preenche. */
function fgmAgrupar(pessoas) {
  const porFuncao = new Map();
  for (const p of pessoas) {
    const f = String(p.funcao || 'SEM FUNÇÃO').trim().toUpperCase();
    if (!porFuncao.has(f)) porFuncao.set(f, []);
    porFuncao.get(f).push({ mat: p.mat, nome: p.nome, ch: p.ch, equipe: '' });
  }
  return [...porFuncao.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'))
    .map(([nome, pessoas]) => ({ nome, pessoas }));
}

async function fgmBaixar(id, comEfetivo) {
  const { base, ano, mes0 } = fgmEscolha();
  const opts = { ano, mes0, base: base || null };

  if (!comEfetivo) {
    FolgaModelos.baixar(id, opts);
    fgmAviso(`Modelo ${FolgaModelos.MODELOS[id].nome} baixado em branco. Preencha e volte pelo passo 2.`);
    return;
  }
  if (!base) { fgmAviso('Escolha uma base para trazer o efetivo — ou baixe o modelo em branco.', true); return; }

  fgmAviso('Montando o arquivo com o efetivo da base...');
  try {
    const { pessoas } = await fgmEfetivoDaBase(base);
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
    FolgaModelos.baixar(id, { ...opts, pessoasPorAba: { [abas[0]]: grupos } });

    const semCH = pessoas.filter((p) => !p.ch).length;
    fgmAviso(`Modelo ${FolgaModelos.MODELOS[id].nome} baixado com ${pessoas.length.toLocaleString('pt-BR')} pessoa(s) de ${base}, em ${grupos.length} função(ões).`
      + (semCH ? ` ${semCH} sem carga horária no cadastro — preencha na planilha, é ela que define a meta de folgas.` : '')
      + (abas.length > 1 ? ` O efetivo foi para a aba ${abas[0]}; distribua entre as outras conforme o seu setor.` : ''));
  } catch (e) {
    fgmAviso('Não consegui buscar o efetivo: ' + (e.message || e) + '. O modelo em branco continua disponível.', true);
  }
}

async function fgmBaixarCursos(comEfetivo) {
  const { base, ano, mes0 } = fgmEscolha();
  const feriados = FolgaModelos.feriadosDoMes(ano, mes0);
  const sobreFeriados = feriados.length
    ? ` A aba BLOQUEIOS já veio com ${feriados.length} feriado(s) nacional(is): ${feriados.map((f) => `dia ${f.dia}`).join(', ')}. Acrescente os municipais.`
    : ' Este mês não tem feriado nacional — acrescente os municipais na aba BLOQUEIOS, se houver.';

  if (!comEfetivo) {
    FolgaModelos.baixarCursos({ ano, mes0, base: base || null });
    fgmAviso('Programação de Cursos baixada em branco.' + sobreFeriados);
    return;
  }
  if (!base) { fgmAviso('Escolha uma base para trazer o efetivo — ou baixe o arquivo em branco.', true); return; }

  fgmAviso('Montando a Programação de Cursos com o efetivo da base...');
  try {
    const { pessoas } = await fgmEfetivoDaBase(base);
    if (!pessoas.length) {
      fgmAviso(`Não há ninguém cadastrado na base ${base}. Baixe o arquivo em branco.`, true);
      return;
    }
    FolgaModelos.baixarCursos({ ano, mes0, base, pessoas });
    fgmAviso(`Programação de Cursos baixada com ${pessoas.length.toLocaleString('pt-BR')} pessoa(s) de ${base} na aba DB.`
      + ' Copie de lá para a aba CURSOS quem vai fazer curso.' + sobreFeriados);
  } catch (e) {
    fgmAviso('Não consegui buscar o efetivo: ' + (e.message || e) + '. O arquivo em branco continua disponível.', true);
  }
}
