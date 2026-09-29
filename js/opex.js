// ══════════════════════════════════════════════════════
// DIMENSIONAMENTO × OPEX
//
// Compara o efetivo que o dimensionamento distribui com o que o OPEX
// orça, e mostra a diferença por grupo e por carga horária.
//
// O problema não é somar: é que os dois arquivos falam línguas diferentes.
// O dimensionamento fala em CARGO ("AUXILIAR DE RAMPA I", "ASG LIMPEZA I");
// o OPEX conta por GRUPO (Rampa, Limpeza, SPAX). O que salva é que o
// próprio OPEX traz o de-para na aba "Funções" — 124 cargos em 14 grupos.
//
// Ainda assim sobra nomenclatura divergente: o dimensionamento escreve
// "AGENTE SERV A PAX" onde o catálogo diz "AGENTE SERV A PASSAGEIRO I", e
// "AUXILIAR DE RAMPA" sem numeral, que é ambíguo entre dois grupos. Num
// teste com a base BEL, 6 de 26 linhas (39 pessoas) não casavam sozinhas —
// e o pior: 32 delas inflavam o delta de Rampa em +32, um buraco que não
// existe. Por isso o casamento é gradual e o que sobra é decidido por
// gente, uma vez, e guardado.
//
// FTE = Qtd × CH ÷ 6. Conferido contra os totais que os dois arquivos
// calculam por conta própria: 244,83 no dimensionamento e 263,00 no OPEX.
// ══════════════════════════════════════════════════════

(function (root) {
  'use strict';

  const E = root.FolgaEngine || (typeof require !== 'undefined' ? require('./folgas-engine.js') : null);
  if (!E) throw new Error('opex.js precisa de folgas-engine.js carregado antes.');

  /* ══════════════════════════════════ texto ═══════════════════════════ */

  const semAcento = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '');
  const norm = (s) => semAcento(s).toUpperCase().replace(/\./g, ' ').replace(/\s+/g, ' ').trim();

  // Abreviações que o dimensionamento usa e o catálogo do OPEX não.
  const ABREV = {
    COOR: 'COORDENADOR', COORD: 'COORDENADOR', PAX: 'PASSAGEIRO', SERV: 'SERVICO',
    AUX: 'AUXILIAR', ENC: 'ENCARREGADO', SUP: 'SUPERVISOR', ADM: 'ADMINISTRATIVO',
    ATEND: 'ATENDIMENTO', OP: 'OPERACOES', EQUIP: 'EQUIPAMENTOS', LOG: 'LOGISTICA',
  };
  const ROMANOS = new Set(['I', 'II', 'III', 'IV', 'V', 'VI']);
  const VAZIAS = new Set(['DE', 'DA', 'DO', 'DOS', 'DAS', 'A', 'E', 'AD', 'PER']);

  // Reduz o nome ao seu esqueleto: sem acento, sem parênteses, sem numeral
  // no fim, sem preposição, com as abreviações abertas. "COOR. DE SERVIÇO A
  // PAX" e "COORD SERVIÇO A PASSAGEIRO I" chegam ao mesmo esqueleto.
  function esqueleto(s) {
    let t = norm(s).replace(/\(.*?\)/g, ' ');
    const toks = t.split(' ').filter(Boolean).map((w) => ABREV[w] || w).filter((w) => !VAZIAS.has(w));
    while (toks.length && ROMANOS.has(toks[toks.length - 1])) toks.pop();
    return toks.join(' ');
  }

  const chNum = (v) => {
    if (typeof v === 'number') return Math.round(v);
    const m = /(\d+(?:[.,]\d+)?)/.exec(String(v ?? ''));
    return m ? Math.round(parseFloat(m[1].replace(',', '.'))) : 0;
  };
  const chRot = (n) => (n ? n + 'H' : '—');
  // A conta é a mesma dos dois lados, e bate com o total que cada arquivo calcula.
  const fteDe = (qtd, ch) => (ch ? qtd * ch / 6 : 0);

  function splitRef(ref) {
    const m = /^([A-Z]+)(\d+)$/.exec(ref);
    if (!m) return { c: 0, r: 0 };
    let c = 0;
    for (const ch of m[1]) c = c * 26 + (ch.charCodeAt(0) - 64);
    return { c, r: +m[2] };
  }
  const dims = (sh) => {
    let r = 0, c = 0;
    for (const k of sh.cells.keys()) { const p = splitRef(k); if (p.r > r) r = p.r; if (p.c > c) c = p.c; }
    return { maxRow: r, maxCol: c };
  };
  const serial = (v) => (typeof v === 'number' && v > 20000 && v < 80000
    ? new Date(Math.round((v - 25569) * 86400000)) : null);

  /* ══════════════════════════ dimensionamento ═════════════════════════ */

  /* Cada aba de base traz uma tabela "Staff Alocação" com Qtd | Cargo | CH.
     A linha dela mudou entre versões do arquivo — 86 nas abas antigas, 101
     nas atuais —, então o rótulo é procurado, nunca fixado. */
  async function lerDimensionamento(buf) {
    const wb = await E.loadWorkbook(buf);
    const bases = [], avisos = [];

    for (const sh of wb.sheets) {
      if (!sh.cells.size) continue;
      const { maxRow, maxCol } = dims(sh);
      if (maxRow < 100 || maxCol < 10) continue;            // abas de apoio
      const get = (r, c) => sh.cells.get(E.colName(c) + r);

      let lin = 0;
      for (let r = 1; r <= Math.min(maxRow, 200) && !lin; r++) {
        for (let c = 1; c <= 6; c++) {
          if (/^STAFF\s*ALOCACAO/.test(norm(get(r, c)))) { lin = r; break; }
        }
      }
      if (!lin) continue;

      const base = String(get(2, 3) ?? sh.name).trim();
      const periodo = serial(get(3, 3));
      const staff = [];
      let secao = '';
      for (let r = lin + 1; r <= maxRow; r++) {
        const qtd = get(r, 1), cargo = get(r, 2), ch = get(r, 3);
        const nc = norm(cargo);
        if (nc === 'CARGO' || nc === 'QTD') continue;         // cabeçalho
        // Linha de seção: texto na coluna do cargo, sem quantidade nem CH.
        if (qtd === undefined && typeof cargo === 'string' && cargo.trim() && !ch) { secao = cargo.trim(); continue; }
        if (typeof qtd !== 'number') continue;
        // Total da tabela: quantidade sem cargo. É onde ela acaba.
        if (!nc) break;
        const n = chNum(ch);
        staff.push({ qtd: Math.round(qtd), cargo: String(cargo).trim(), ch: n, chRot: chRot(n), secao, linha: r });
      }
      if (!staff.length) continue;

      const total = staff.reduce((s, x) => s + x.qtd, 0);
      const fte = staff.reduce((s, x) => s + fteDe(x.qtd, x.ch), 0);
      bases.push({ aba: sh.name, base, periodo, oculta: sh.state !== 'visible', staff, total, fte, linhaStaff: lin });
    }

    if (!bases.length) throw new Error('Não achei nenhuma tabela "Staff Alocação" neste arquivo.');

    // Aba escondida costuma ser versão velha — entra, mas avisando.
    for (const b of bases) if (b.oculta) avisos.push({ lv: 'aviso', t: `Aba "${b.aba}" está oculta na planilha — normalmente é uma versão antiga. Confira antes de usar.` });
    return { bases, avisos, wb };
  }

  /* ══════════════════════════════ OPEX ════════════════════════════════ */

  const MESES_PT = ['JANEIRO', 'FEVEREIRO', 'MARCO', 'ABRIL', 'MAIO', 'JUNHO',
    'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'];

  /* A matriz de Headcount é um resumo; quem alimenta o OPEX é a GRADE de
     lançamento, uma linha por Grupo + Função + carga horária + noturno, com
     a quantidade na coluna "inicial". É nela que a lista vai ser colada, e é
     dela que se aprende duas coisas que o dimensionamento não sabe: quantas
     horas noturnas cada linha tem, e qual CH mensal corresponde a cada CH
     diária. A linha do cabeçalho muda de arquivo para arquivo, então é
     procurada: só vale a linha que tenha Grupo, Função, noturno e inicial
     ao mesmo tempo — quatro rótulos juntos não acontecem por acaso. */
  function lerGrade(get, maxRow, maxCol) {
    let hdr = 0, col = null;
    for (let r = 1; r <= Math.min(maxRow, 60) && !hdr; r++) {
      const a = {}, chs = [];
      for (let c = 1; c <= maxCol; c++) {
        const t = norm(get(r, c));
        if (!t) continue;
        if (t === 'GRUPO' && !a.grupo) a.grupo = c;
        else if ((t === 'FUNCAO' || t === 'FUNCOES') && !a.funcao) a.funcao = c;
        else if (t === 'NOTURNO' && !a.noturno) a.noturno = c;
        else if (t === 'INICIAL' && !a.inicial) a.inicial = c;
        else if (t === 'CH' || /^CH[ /]/.test(t)) chs.push(c);
      }
      if (a.grupo && a.funcao && a.noturno && a.inicial) {
        hdr = r; col = a;
        col.chs = chs.filter((c) => c > a.funcao && c < a.noturno);
      }
    }
    if (!hdr) return null;

    const n = (r, c) => { const v = c ? get(r, c) : null; return typeof v === 'number' ? v : chNum(v); };
    const brutas = [];
    let vazias = 0;
    for (let r = hdr + 1; r <= maxRow && vazias < 8; r++) {
      const g = String(get(r, col.grupo) ?? '').trim();
      const f = String(get(r, col.funcao) ?? '').trim();
      if (!g && !f) { vazias++; continue; }
      vazias = 0;
      if (norm(g) === 'TOTAL' || norm(f) === 'TOTAL') break;
      brutas.push({ linha: r, grupo: g, funcao: f, chs: col.chs.map((c) => n(r, c)),
        noturno: n(r, col.noturno), inicial: n(r, col.inicial) });
    }
    if (!brutas.length) return null;

    /* Duas colunas de CH: uma é a mensal (180, 120…) e a outra a diária
       (6, 4…). Quem diz qual é qual é a grandeza dos números, não a posição —
       assim funciona mesmo se o arquivo trocar a ordem ou tiver só uma. */
    let iDia = -1, iMes = -1;
    col.chs.forEach((c, i) => {
      const vals = brutas.map((b) => b.chs[i]).filter((v) => v > 0);
      if (!vals.length) return;
      const med = vals.slice().sort((a, b) => a - b)[Math.floor(vals.length / 2)];
      if (med <= 12) { if (iDia < 0) iDia = i; } else if (iMes < 0) iMes = i;
    });

    const linhas = brutas.map((b) => ({
      linha: b.linha, grupo: b.grupo, funcao: b.funcao,
      chMes: iMes >= 0 ? b.chs[iMes] : 0,
      chDia: iDia >= 0 ? b.chs[iDia] : 0,
      noturno: b.noturno, inicial: b.inicial,
    }));

    return {
      cabecalho: hdr, primeira: linhas[0].linha, ultima: linhas[linhas.length - 1].linha,
      colGrupo: E.colName(col.grupo), colInicial: E.colName(col.inicial),
      temChMes: iMes >= 0, temChDia: iDia >= 0, linhas,
    };
  }

  /* O OPEX é um arquivo por base, com uma aba por mês. Cada aba do mês tem
     duas matrizes — Headcount e FTE — cruzando Grupo com carga horária. */
  async function lerOpex(buf) {
    const wb = await E.loadWorkbook(buf);
    const meses = [];
    let catalogo = null, catalogoOrig = null, base = '';

    for (const sh of wb.sheets) {
      if (!sh.cells.size) continue;
      const { maxRow, maxCol } = dims(sh);
      const get = (r, c) => sh.cells.get(E.colName(c) + r);

      // aba "Funções": o de-para cargo → grupo, uma coluna por grupo
      if (norm(sh.name) === 'FUNCOES') {
        catalogo = new Map();
        catalogoOrig = new Map();
        let hdr = 0;
        for (let r = 1; r <= Math.min(maxRow, 12) && !hdr; r++) {
          let n = 0;
          for (let c = 1; c <= maxCol; c++) if (typeof get(r, c) === 'string' && String(get(r, c)).trim()) n++;
          if (n >= 6) hdr = r;
        }
        if (hdr) {
          for (let c = 1; c <= maxCol; c++) {
            const g = get(hdr, c);
            if (!g || !String(g).trim()) continue;
            const grupo = String(g).trim();
            for (let r = hdr + 1; r <= maxRow; r++) {
              const v = get(r, c);
              if (!v || !String(v).trim()) continue;
              catalogo.set(norm(v), grupo);
              // guarda a grafia original: é ela que vai para a lista de colar,
              // porque o OPEX valida a coluna Função contra este catálogo.
              if (!catalogoOrig.has(norm(v))) catalogoOrig.set(norm(v), String(v).trim());
            }
          }
        }
        continue;
      }

      // aba de mês: procura a linha "Headcount"
      let linHC = 0, colTipo = 0;
      for (let r = 1; r <= maxRow && !linHC; r++) {
        for (let c = 1; c <= maxCol; c++) {
          if (norm(get(r, c)) === 'HEADCOUNT') { linHC = r; colTipo = c; break; }
        }
      }
      if (!linHC) continue;

      // o cabeçalho com as cargas horárias fica na linha de cima
      const chCols = [];
      for (let c = colTipo + 2; c <= maxCol; c++) {
        const v = get(linHC - 1, c);
        if (typeof v === 'number' && v > 0 && v <= 12) chCols.push({ col: c, ch: Math.round(v) });
        else if (norm(v) === 'TOTAL') break;
      }
      if (!chCols.length) continue;

      const ler = (rotulo) => {
        const m = new Map();
        for (let r = linHC - 1; r <= maxRow; r++) {
          if (norm(get(r, colTipo)) !== rotulo) continue;
          const grupo = String(get(r, colTipo + 1) ?? '').trim();
          if (!grupo || norm(grupo) === 'TOTAL') continue;
          for (const { col, ch } of chCols) {
            const v = get(r, col);
            if (typeof v === 'number' && v) m.set(grupo + '|' + ch, (m.get(grupo + '|' + ch) || 0) + v);
          }
        }
        return m;
      };
      const headcount = ler('HEADCOUNT');
      if (!headcount.size) continue;

      // base e mês ficam num cabeçalho solto no topo da aba
      let data = null, baseAba = '';
      for (let r = 1; r <= Math.min(maxRow, 12); r++) for (let c = 1; c <= Math.min(maxCol, 10); c++) {
        const rot = norm(get(r, c));
        if (rot === 'MES' || rot === 'MES:') data = data || serial(get(r, c + 1));
        if (rot === 'BASE' || rot === 'BASE:') baseAba = baseAba || String(get(r, c + 1) ?? '').trim();
      }
      if (!data) { const i = MESES_PT.indexOf(norm(sh.name)); if (i >= 0) data = { mesSemAno: i }; }
      if (baseAba) base = baseAba;

      meses.push({
        aba: sh.name, data, base: baseAba,
        headcount, fte: ler('FTE'), chs: chCols.map((x) => x.ch),
        grade: lerGrade(get, maxRow, maxCol),
        total: [...headcount.values()].reduce((a, b) => a + b, 0),
      });
    }

    if (!meses.length) throw new Error('Não achei a matriz de Headcount por grupo neste OPEX.');
    return { base, meses, catalogo: catalogo || new Map(), catalogoOrig: catalogoOrig || new Map(), wb };
  }

  /* ══════════════════════ de-para cargo → grupo ═══════════════════════ */

  /* Casamento em degraus, do mais seguro para o mais frouxo. Cada resposta
     carrega COMO casou, porque "exato" e "por semelhança de nome" merecem
     confiança diferente na hora de você conferir. */
  function montarIndice(catalogo, catalogoOrig) {
    const porEsqueleto = new Map();   // esqueleto → Map(grupo → função como o OPEX escreve)
    const porGrupo = new Map();       // grupo     → Map(esqueleto → função)
    for (const [cargoNorm, grupo] of catalogo) {
      const orig = (catalogoOrig && catalogoOrig.get(cargoNorm)) || cargoNorm;
      const k = esqueleto(cargoNorm);
      if (!porEsqueleto.has(k)) porEsqueleto.set(k, new Map());
      if (!porEsqueleto.get(k).has(grupo)) porEsqueleto.get(k).set(grupo, orig);
      if (!porGrupo.has(grupo)) porGrupo.set(grupo, new Map());
      if (!porGrupo.get(grupo).has(k)) porGrupo.get(grupo).set(k, orig);
    }
    return { catalogo, catalogoOrig: catalogoOrig || new Map(), porEsqueleto, porGrupo };
  }

  /* Achado o grupo, ainda falta a FUNÇÃO — o nome exato que o OPEX usa na
     grade. Sem ela dá para comparar totais, mas não para montar a lista de
     colar. A busca é dentro do grupo já decidido, o que a torna bem mais
     segura: "AUXILIAR DE RAMPA" é ambíguo no catálogo inteiro, mas dentro de
     Rampa só existe um cargo com esse esqueleto. */
  function funcaoNoGrupo(cargo, idx, grupo) {
    const n = norm(cargo);
    if (idx.catalogo.get(n) === grupo) return idx.catalogoOrig.get(n) || n;
    const m = idx.porGrupo.get(grupo);
    if (!m) return null;
    const k = esqueleto(cargo);
    if (m.has(k)) return m.get(k);
    const cands = [];
    for (const [kk, f] of m) {
      if (kk.length < 6 || k.length < 6) continue;
      if (kk.startsWith(k) || k.startsWith(kk)) cands.push(f);
    }
    return cands.length === 1 ? cands[0] : null;
  }

  function casar(cargo, idx, manual) {
    const n = norm(cargo);
    const com = (grupo, via, confianca) => ({ grupo, via, confianca, funcao: funcaoNoGrupo(cargo, idx, grupo) });
    const nao = (via, opcoes) => ({ grupo: null, via, confianca: null, funcao: null, opcoes: opcoes || [] });

    if (manual && manual.has(n)) {
      const g = manual.get(n);
      // grupo nulo no de-para quer dizer "não entra na comparação"
      return g ? com(g, 'decidido por você', 'alta') : { grupo: null, via: 'ignorado por você', confianca: null, funcao: null, opcoes: [], ignorar: true };
    }
    if (idx.catalogo.has(n)) return com(idx.catalogo.get(n), 'nome idêntico ao catálogo', 'alta');

    const k = esqueleto(cargo);
    const exatoEsq = idx.porEsqueleto.get(k);
    if (exatoEsq && exatoEsq.size === 1) return com([...exatoEsq.keys()][0], 'mesmo nome, escrito diferente', 'média');
    if (exatoEsq && exatoEsq.size > 1) return nao('ambíguo', [...exatoEsq.keys()].sort());

    // prefixo: "OPERADOR" encontra "OPERADOR DE EQUIPAMENTOS I"
    const cands = new Set();
    for (const [kk, gs] of idx.porEsqueleto) {
      if (kk.length < 6 || k.length < 6) continue;
      if (kk.startsWith(k) || k.startsWith(kk)) for (const g of gs.keys()) cands.add(g);
    }
    if (cands.size === 1) return com([...cands][0], 'nome abreviado do catálogo', 'média');
    if (cands.size > 1) return nao('ambíguo', [...cands].sort());
    return nao('fora do catálogo');
  }

  /* ══════════════════════════ comparação ══════════════════════════════ */

  function comparar(baseDim, mesOpex, catalogo, manual, catalogoOrig) {
    const idx = montarIndice(catalogo, catalogoOrig);
    const dim = new Map();          // grupo|ch → { qtd, fte, linhas: [] }
    const pendentes = [];           // cargos que ninguém conseguiu classificar

    for (const s of baseDim.staff) {
      const m = casar(s.cargo, idx, manual);
      if (m.ignorar) continue;
      if (!m.grupo) {
        pendentes.push({ cargo: s.cargo, ch: s.ch, chRot: s.chRot, qtd: s.qtd, secao: s.secao,
          via: m.via, opcoes: m.opcoes || [], linha: s.linha });
        continue;
      }
      const k = m.grupo + '|' + s.ch;
      if (!dim.has(k)) dim.set(k, { grupo: m.grupo, ch: s.ch, qtd: 0, fte: 0, itens: [] });
      const e = dim.get(k);
      e.qtd += s.qtd; e.fte += fteDe(s.qtd, s.ch);
      e.itens.push({ cargo: s.cargo, qtd: s.qtd, secao: s.secao, via: m.via, confianca: m.confianca });
    }

    const opex = new Map();
    for (const [k, v] of mesOpex.headcount) {
      const [grupo, ch] = k.split('|');
      opex.set(k, { grupo, ch: +ch, qtd: v, fte: fteDe(v, +ch) });
    }

    /* Grupo sem nada do lado do dimensionamento é apoio, não buraco: entra
       num bloco próprio e fica fora do delta, senão repete o mesmo ruído
       todo mês.
       Com uma ressalva que custou um teste: grupo zerado PORQUE as pessoas
       dele estão pendentes não é apoio, é justamente o que precisa aparecer.
       Mandá-lo para o bloco de apoio esconderia o buraco. */
    const gruposDim = new Set([...dim.values()].map((x) => x.grupo));
    const podemAindaVir = new Set();
    for (const p of pendentes) for (const g of (p.opcoes || [])) podemAindaVir.add(g);
    const linhas = [], apoio = [];
    for (const k of new Set([...dim.keys(), ...opex.keys()])) {
      const d = dim.get(k), o = opex.get(k);
      const grupo = (d || o).grupo, ch = (d || o).ch;
      const reg = {
        grupo, ch, chRot: chRot(ch),
        dimQtd: d ? d.qtd : 0, dimFte: d ? d.fte : 0,
        opexQtd: o ? o.qtd : 0, opexFte: o ? o.fte : 0,
        itens: d ? d.itens : [],
      };
      reg.deltaQtd = reg.opexQtd - reg.dimQtd;
      reg.deltaFte = reg.opexFte - reg.dimFte;
      (gruposDim.has(grupo) || podemAindaVir.has(grupo) ? linhas : apoio).push(reg);
    }
    const ordem = (a, b) => a.grupo.localeCompare(b.grupo, 'pt-BR') || a.ch - b.ch;
    linhas.sort(ordem); apoio.sort(ordem);

    const porGrupo = new Map();
    for (const l of linhas) {
      if (!porGrupo.has(l.grupo)) porGrupo.set(l.grupo, { grupo: l.grupo, dimQtd: 0, dimFte: 0, opexQtd: 0, opexFte: 0, chs: [] });
      const g = porGrupo.get(l.grupo);
      g.dimQtd += l.dimQtd; g.dimFte += l.dimFte; g.opexQtd += l.opexQtd; g.opexFte += l.opexFte;
      g.chs.push(l);
    }
    for (const g of porGrupo.values()) { g.deltaQtd = g.opexQtd - g.dimQtd; g.deltaFte = g.opexFte - g.dimFte; }

    const soma = (arr, campo) => arr.reduce((s, x) => s + x[campo], 0);
    const pendQtd = pendentes.reduce((s, p) => s + p.qtd, 0);
    const pendFte = pendentes.reduce((s, p) => s + fteDe(p.qtd, p.ch), 0);

    return {
      base: baseDim.base, aba: baseDim.aba, periodo: baseDim.periodo,
      mesOpex: mesOpex.aba, dataOpex: mesOpex.data,
      linhas, apoio, porGrupo: [...porGrupo.values()].sort((a, b) => a.grupo.localeCompare(b.grupo, 'pt-BR')),
      pendentes,
      // Enquanto houver pendente, o bloco de apoio é provisório: resolver um
      // de-para pode tirar um grupo de lá.
      apoioProvisorio: pendentes.length > 0,
      totais: {
        dimQtd: soma(linhas, 'dimQtd'), dimFte: soma(linhas, 'dimFte'),
        opexQtd: soma(linhas, 'opexQtd'), opexFte: soma(linhas, 'opexFte'),
        deltaQtd: soma(linhas, 'deltaQtd'), deltaFte: soma(linhas, 'deltaFte'),
        apoioQtd: soma(apoio, 'opexQtd'), apoioFte: soma(apoio, 'opexFte'),
        pendQtd, pendFte,
        dimArquivo: baseDim.total, dimArquivoFte: baseDim.fte,
        opexArquivo: mesOpex.total,
      },
    };
  }

  /* ═══════════════════ lista para colar no OPEX ═══════════════════════ */

  /* O dimensionamento diz quantas pessoas de cada cargo, em cada carga
     horária. O OPEX quer isso quebrado também por HORAS NOTURNAS — e essa
     informação o dimensionamento não tem: a tabela Staff Alocação só traz
     Qtd | Cargo | CH.
     Inventar a quebra seria o pior caminho. O que existe de verdade é a
     grade do mês anterior, que já carrega a divisão que você fez. Então a
     regra é: o dimensionamento manda no TOTAL de cada função, e a grade que
     já está lá manda em COMO esse total se reparte entre as linhas de
     noturno. Função nova, sem linha anterior, sai com noturno zero e é
     apontada — não chutada. */

  // Reparte `total` entre as linhas existentes mantendo a proporção atual.
  // Sobra vai para quem tem a maior fração, e empate vai para a maior linha.
  function distribuir(linhas, total) {
    const n = linhas.length;
    if (!n) return [];
    if (n === 1) return [total];
    const base = linhas.map((l) => Math.max(0, l.inicial || 0));
    const soma = base.reduce((a, b) => a + b, 0);
    if (!soma) {
      // Sem referência anterior: tudo na linha sem noturno, que é a neutra.
      let i = linhas.findIndex((l) => !l.noturno);
      if (i < 0) i = 0;
      return linhas.map((_, j) => (j === i ? total : 0));
    }
    const bruto = base.map((b) => total * b / soma);
    const cota = bruto.map(Math.floor);
    let resto = total - cota.reduce((a, b) => a + b, 0);
    const ordem = bruto.map((v, i) => ({ i, f: v - Math.floor(v) }))
      .sort((a, b) => b.f - a.f || base[b.i] - base[a.i] || a.i - b.i);
    for (let j = 0; resto > 0; j++) { cota[ordem[j % n].i]++; resto--; }
    return cota;
  }

  function montarLista(baseDim, mesOpex, catalogo, manual, catalogoOrig) {
    const idx = montarIndice(catalogo, catalogoOrig);
    const grade = mesOpex.grade || null;

    /* 1. o que o dimensionamento pede, por grupo + função + carga horária */
    const alvo = new Map();
    const pendentes = [];
    for (const s of baseDim.staff) {
      const m = casar(s.cargo, idx, manual);
      if (m.ignorar) continue;
      if (!m.grupo) { pendentes.push({ cargo: s.cargo, qtd: s.qtd, chRot: s.chRot, via: m.via }); continue; }
      const funcao = m.funcao || s.cargo;
      const k = m.grupo + '|' + norm(funcao) + '|' + s.ch;
      if (!alvo.has(k)) alvo.set(k, { grupo: m.grupo, funcao, ch: s.ch, qtd: 0, cargos: [],
        semFuncao: !m.funcao, foraDoCatalogo: !idx.catalogo.has(norm(funcao)) });
      const a = alvo.get(k);
      a.qtd += s.qtd;
      a.cargos.push({ cargo: s.cargo, qtd: s.qtd, via: m.via });
    }
    const gruposDim = new Set([...alvo.values()].map((x) => x.grupo));

    /* 2. CH mensal correspondente a cada CH diária, aprendida do arquivo */
    const chMesDe = new Map();
    if (grade) for (const g of grade.linhas) if (g.chDia && g.chMes && !chMesDe.has(g.chDia)) chMesDe.set(g.chDia, g.chMes);
    const chMes = (dia) => chMesDe.get(dia) || (dia ? dia * 30 : 0);

    /* 3. a grade existente, linha a linha, na ordem em que já está */
    const linhas = [], atendidos = new Set();
    if (grade) {
      const porChave = new Map();
      grade.linhas.forEach((g, i) => {
        const k = g.grupo + '|' + norm(g.funcao) + '|' + g.chDia;
        if (!porChave.has(k)) porChave.set(k, []);
        porChave.get(k).push(i);
      });
      const valor = new Array(grade.linhas.length).fill(0);
      const estado = new Array(grade.linhas.length).fill('');
      for (const [k, ids] of porChave) {
        const rows = ids.map((i) => grade.linhas[i]);
        if (!gruposDim.has(rows[0].grupo)) {
          // grupo de apoio: o dimensionamento não fala dele, então não mexe
          ids.forEach((i, j) => { valor[i] = rows[j].inicial; estado[i] = 'apoio'; });
          continue;
        }
        atendidos.add(k);
        const a = alvo.get(k);
        const cota = distribuir(rows, a ? a.qtd : 0);
        ids.forEach((i, j) => {
          valor[i] = cota[j];
          estado[i] = !a ? 'zerada' : cota[j] === rows[j].inicial ? 'igual' : 'ajustada';
        });
      }
      grade.linhas.forEach((g, i) => {
        const a = alvo.get(g.grupo + '|' + norm(g.funcao) + '|' + g.chDia);
        linhas.push({ grupo: g.grupo, funcao: g.funcao, chMes: g.chMes || chMes(g.chDia), chDia: g.chDia,
          noturno: g.noturno, inicial: valor[i], antes: g.inicial, estado: estado[i],
          linhaOrigem: g.linha, cargos: a ? a.cargos : [] });
      });
    }

    /* 4. o que o dimensionamento pede e não tem linha na grade */
    const novas = [];
    for (const [k, a] of alvo) {
      if (atendidos.has(k)) continue;
      const reg = { grupo: a.grupo, funcao: a.funcao, chMes: chMes(a.ch), chDia: a.ch,
        noturno: 0, inicial: a.qtd, antes: 0, estado: 'nova', cargos: a.cargos,
        foraDoCatalogo: a.foraDoCatalogo, semFuncao: a.semFuncao };
      novas.push(reg); linhas.push(reg);
    }
    novas.sort((a, b) => a.grupo.localeCompare(b.grupo, 'pt-BR') || a.funcao.localeCompare(b.funcao, 'pt-BR') || a.chDia - b.chDia);

    /* 5. o que precisa de olho humano */
    const faltamNoCatalogo = novas.filter((l) => l.foraDoCatalogo);
    const semReferencia = novas.filter((l) => !l.foraDoCatalogo);
    const zeradas = linhas.filter((l) => l.estado === 'zerada' && l.antes > 0);
    const repartidas = [];
    if (grade) {
      const vistos = new Set();
      for (const l of linhas) {
        if (l.estado !== 'ajustada' && l.estado !== 'igual') continue;
        const k = l.grupo + '|' + norm(l.funcao) + '|' + l.chDia;
        if (vistos.has(k)) continue; vistos.add(k);
        const irmas = linhas.filter((x) => x.grupo === l.grupo && norm(x.funcao) === norm(l.funcao) && x.chDia === l.chDia);
        if (irmas.length > 1 && irmas.some((x) => x.estado === 'ajustada')) {
          repartidas.push({ grupo: l.grupo, funcao: l.funcao, chDia: l.chDia,
            total: irmas.reduce((s, x) => s + x.inicial, 0),
            partes: irmas.map((x) => ({ noturno: x.noturno, de: x.antes, para: x.inicial })) });
        }
      }
    }

    const colunas = ['Grupo', 'Função'];
    if (!grade || grade.temChMes) colunas.push('CH mês');
    if (!grade || grade.temChDia) colunas.push('CH dia');
    colunas.push('noturno', 'inicial');
    const celulas = (l) => {
      const v = [l.grupo, l.funcao];
      if (!grade || grade.temChMes) v.push(l.chMes || '');
      if (!grade || grade.temChDia) v.push(l.chDia || '');
      v.push(l.noturno || 0, l.inicial);
      return v;
    };

    return {
      grade: !!grade,
      onde: grade ? { aba: mesOpex.aba, coluna: grade.colGrupo, linha: grade.primeira } : null,
      colunas, linhas, novas, pendentes, faltamNoCatalogo, semReferencia, zeradas, repartidas,
      celulas,
      // Para colar na grade o cabeçalho atrapalha — ele já está na planilha.
      tsv: (comCabecalho = true) => (comCabecalho ? [colunas.join('\t')] : [])
        .concat(linhas.map((l) => celulas(l).join('\t'))).join('\n'),
      csv: () => '﻿' + [colunas.join(';')].concat(linhas.map((l) => celulas(l).join(';'))).join('\r\n'),
      totais: {
        linhas: linhas.length, novas: novas.length,
        pessoas: linhas.reduce((s, l) => s + l.inicial, 0),
        antes: linhas.reduce((s, l) => s + (l.antes || 0), 0),
        apoio: linhas.filter((l) => l.estado === 'apoio').reduce((s, l) => s + l.inicial, 0),
        pendQtd: pendentes.reduce((s, p) => s + p.qtd, 0),
      },
    };
  }

  /* Casa as bases do dimensionamento com os arquivos de OPEX pelo nome da
     base, e escolhe no OPEX o mês que bate com o período do dimensionamento. */
  function sincronizar(dim, opexes, manual) {
    const res = [], avisos = dim.avisos.slice();
    const usados = new Set();

    for (const b of dim.bases) {
      const alvo = norm(b.base) || norm(b.aba);
      const op = opexes.find((o) => norm(o.base) === alvo || o.meses.some((m) => norm(m.base) === alvo));
      if (!op) { avisos.push({ lv: 'aviso', t: `Base ${b.base}: não subiu OPEX para ela — ficou de fora da comparação` }); continue; }
      usados.add(op);

      let mes = null;
      if (b.periodo) {
        mes = op.meses.find((m) => m.data instanceof Date
          && m.data.getUTCFullYear() === b.periodo.getUTCFullYear() && m.data.getUTCMonth() === b.periodo.getUTCMonth());
        if (!mes) mes = op.meses.find((m) => m.data && m.data.mesSemAno === b.periodo.getUTCMonth());
      }
      if (!mes) {
        mes = op.meses[op.meses.length - 1];
        avisos.push({ lv: 'aviso', t: `Base ${b.base}: não achei no OPEX o mês do dimensionamento`
          + (b.periodo ? ` (${b.periodo.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' })})` : '')
          + ` — usei a aba "${mes.aba}"` });
      }
      const c = comparar(b, mes, op.catalogo, manual, op.catalogoOrig);
      c.lista = montarLista(b, mes, op.catalogo, manual, op.catalogoOrig);
      res.push(c);
    }
    for (const o of opexes) if (!usados.has(o)) avisos.push({ lv: 'aviso', t: `OPEX da base ${o.base || '(sem nome)'}: não há aba correspondente no dimensionamento` });
    return { comparacoes: res, avisos };
  }

  const api = { lerDimensionamento, lerOpex, comparar, sincronizar, casar, montarIndice,
    montarLista, distribuir, funcaoNoGrupo, esqueleto, norm, fteDe, chNum, chRot };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.OpexDim = api;
})(typeof window !== 'undefined' ? window : globalThis);
