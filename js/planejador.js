// ══════════════════════════════════════════════════════
// PLANEJADOR DE CURSOS
//
// Recebe a planilha de programação (abas CURSOS e JANELAS) e a escala
// pré-configurada, e escolhe as datas dos cursos que menos machucam a
// operação.
//
// A conta é de COBERTURA HORÁRIA, não de cabeças por dia. Cada pessoa cobre
// o intervalo entre a entrada e a saída dela; tirar alguém do dia derruba a
// curva exatamente nas horas que ela cobria. Dois cursos com 5 pessoas cada
// podem ser inofensivos ou desastrosos dependendo de quem sai e de que turno
// essa gente é — contar cabeças não enxerga essa diferença.
//
// Curso ocupa o dia inteiro (regra confirmada): mesmo um curso de 4h tira a
// pessoa da escala o dia todo, como já acontece com o K. As colunas de hora
// da planilha ficam como registro.
//
// O planejador NÃO escreve na escala. Ele devolve as datas, e o caminho
// para a escala continua sendo o arquivo de cursos + o Gerador de Folgas.
// ══════════════════════════════════════════════════════

(function (root) {
  'use strict';

  // No navegador o motor já está em window; no Node dos testes, carrega aqui.
  const E = root.FolgaEngine || (typeof require !== 'undefined' ? require('./folgas-engine.js') : null);
  if (!E) throw new Error('planejador.js precisa de folgas-engine.js carregado antes.');
  const SLOTS = 48;                 // meia em meia hora
  const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, '');

  function splitRef(ref) {
    const m = /^([A-Z]+)(\d+)$/.exec(ref);
    if (!m) return { c: 0, r: 0 };
    let c = 0;
    for (const ch of m[1]) c = c * 26 + (ch.charCodeAt(0) - 64);
    return { c, r: +m[2] };
  }

  // "07:00" → 14 (slot de meia hora). Aceita também serial do Excel.
  function paraSlot(v) {
    if (typeof v === 'number') { const m = Math.round((v % 1) * 1440); return Math.floor(m / 30); }
    const m = /^(\d{1,2}):(\d{2})/.exec(String(v ?? '').trim());
    if (!m) return null;
    return Math.floor((+m[1] * 60 + +m[2]) / 30);
  }

  /* ══════════════════════════════════ leitura da planilha ══════════════ */

  /* Excel converte "1-8" digitado sem apóstrofo em 1 de agosto. O valor
     chega aqui como data ou como serial, lerDias não entende, e o curso
     externo virava livre no mês inteiro sem ninguém perceber — o pior tipo
     de erro, o que não aparece. Dá para distinguir: dia do mês vai até 31,
     serial de data passa de 40000. */
  function viroudata(v) {
    if (v instanceof Date) return true;
    return typeof v === 'number' && v > 1000;
  }

  // "10-23" · "11, 28" · "6-9, 13-16, 27" → Set de índices de dia (base 0)
  function lerDias(txt, D) {
    if (viroudata(txt)) return null;
    const s = String(txt ?? '').trim();
    if (!s) return null;                       // null = mês inteiro
    const dias = new Set();
    for (const parte of s.split(/[;,]/)) {
      const p = parte.trim();
      if (!p) continue;
      const faixa = /^(\d{1,2})\s*[-–a]\s*(\d{1,2})$/.exec(p);
      if (faixa) {
        const a = +faixa[1], b = +faixa[2];
        for (let d = Math.min(a, b); d <= Math.max(a, b); d++) if (d >= 1 && d <= D) dias.add(d - 1);
        continue;
      }
      const um = /^(\d{1,2})$/.exec(p);
      if (um && +um[1] >= 1 && +um[1] <= D) dias.add(+um[1] - 1);
    }
    return dias.size ? dias : null;
  }

  // Descobre o papel de cada aba pelos cabeçalhos, não pela ordem.
  // A primeira versão adotava qualquer aba com coluna MATRÍCULA — com a aba
  // DB de colaboradores no arquivo, a base inteira substituía a lista de
  // inscrições em silêncio. O que separa as três é a coluna CURSO: a aba de
  // inscrições tem matrícula E curso; a de janelas tem curso sem matrícula;
  // a base tem matrícula sem curso.
  function lerCabecalho(sh, maxRow, maxCol, get) {
    for (let r = 1; r <= Math.min(maxRow, 20); r++) {
      const achou = {};
      for (let c = 1; c <= maxCol; c++) {
        const h = norm(get(r, c));
        if (h === 'MATRICULA') achou.mat = c;
        else if (h === 'NOME') achou.nome = c;
        else if (h === 'FUNCAO') achou.func = c;
        else if (h === 'CURSO') achou.curso = c;
        else if (h === 'DATA') achou.data = c;
        else if (h === 'TIPO') achou.tipo = c;
        else if (h === 'DIASPERMITIDOS' || h === 'DIAS') achou.dias = c;
        else if (h === 'HORAINICIO') achou.hi = c;
        else if (h === 'HORAFIM') achou.hf = c;
        else if (h === 'SITUACAO') achou.sit = c;
        else if (h === 'DESCRICAO') achou.desc = c;
      }
      if (achou.mat || achou.curso) return { hdr: r, col: achou };
    }
    return { hdr: 0, col: {} };
  }

  function papelDaAba(nome, col) {
    const n = norm(nome);
    if (col.mat && col.curso) return 'CURSOS';
    if (col.curso && !col.mat) return 'JANELAS';
    if (col.mat && !col.curso) return 'DB';
    if (n === 'CURSOS') return 'CURSOS';
    if (n === 'JANELAS') return 'JANELAS';
    return '';
  }

  /* Preenche nome e função a partir da aba DB e confere se a pessoa está em
     condição de fazer curso. O painel casa por matrícula, então nome e função
     são cosméticos — mas um relatório que diz só "160914" é inútil na hora de
     conferir. E a base traz a situação: quem está de férias ou afastado não
     deveria estar inscrito, e isso some se ninguém olhar. */
  function aplicarDB(linhas, db) {
    const avisos = [];
    const foraDeCombate = new Map();
    let semCadastro = 0;
    for (const l of linhas) {
      const p = db.get(l.mat);
      if (!p) { semCadastro++; continue; }
      if (!l.nome) l.nome = p.nome;
      if (!l.func) l.func = p.func;
      l.situacao = p.situacao; l.descricao = p.descricao;
      const d = norm(p.descricao), st = norm(p.situacao);
      if (st && st !== 'ATIVO') foraDeCombate.set(l.mat, `${l.mat} ${p.nome} — situação "${p.situacao}"`);
      else if (d === 'FERIAS' || d.startsWith('ATESTADO') || d.startsWith('AFASTAD') || d.startsWith('LICENCA'))
        foraDeCombate.set(l.mat, `${l.mat} ${p.nome} — consta como "${p.descricao}" na base`);
    }
    if (semCadastro) avisos.push({ lv: 'aviso', t: `${semCadastro} inscrição(ões) com matrícula que não está na aba DB — confira se digitou certo` });
    for (const t of foraDeCombate.values()) avisos.push({ lv: 'aviso', t: 'Inscrito mas ' + t });
    return avisos;
  }

  async function lerProgramacao(buf, D) {
    const wb = await E.loadWorkbook(buf);
    const avisos = [];
    let linhas = null, janelas = null, destino = null, db = null;
    const repetidos = new Set();

    for (const sh of wb.sheets) {
      if (sh.state !== 'visible' || !sh.cells.size) continue;
      let maxRow = 0, maxCol = 0;
      for (const k of sh.cells.keys()) { const p = splitRef(k); if (p.r > maxRow) maxRow = p.r; if (p.c > maxCol) maxCol = p.c; }
      const get = (r, c) => sh.cells.get(E.colName(c) + r);
      const { hdr, col } = lerCabecalho(sh, maxRow, maxCol, get);
      if (!hdr) continue;
      const papel = papelDaAba(sh.name, col);

      if (papel === 'DB') {
        db = new Map();
        for (let r = hdr + 1; r <= maxRow; r++) {
          const mat = E.matNum(get(r, col.mat));
          if (!mat || db.has(mat)) continue;
          db.set(mat, {
            mat,
            nome: String(get(r, col.nome) ?? '').trim(),
            func: col.func ? String(get(r, col.func) ?? '').trim() : '',
            situacao: col.sit ? String(get(r, col.sit) ?? '').trim() : '',
            descricao: col.desc ? String(get(r, col.desc) ?? '').trim() : '',
          });
        }
        continue;
      }

      if (papel === 'CURSOS') {
        linhas = [];
        destino = { path: sh.path, colData: col.data || 0 };
        for (let r = hdr + 1; r <= maxRow; r++) {
          const mat = E.matNum(get(r, col.mat));
          if (!mat) continue;
          const curso = String(get(r, col.curso) ?? '').trim();
          linhas.push({
            mat, curso, linha: r, aba: sh.name,
            nome: String(get(r, col.nome) ?? '').trim(),
            func: col.func ? String(get(r, col.func) ?? '').trim() : '',
            data: col.data ? E.dataCurso(get(r, col.data)) : null,
            horaIni: col.hi ? String(get(r, col.hi) ?? '') : '',
            horaFim: col.hf ? String(get(r, col.hf) ?? '') : '',
          });
        }
      } else if (papel === 'JANELAS') {
        janelas = new Map();
        for (let r = hdr + 1; r <= maxRow; r++) {
          const curso = String(get(r, col.curso) ?? '').trim();
          if (!curso) continue;
          const tipo = norm(get(r, col.tipo));
          // Mesmo curso em duas linhas: a segunda sobrescreveria a primeira e
          // as datas da primeira sumiriam sem aviso. Melhor juntar os dias e
          // avisar — foi o que aconteceu com RAMPA DNATA e LIMPEZA DE
          // AERONAVE numa planilha real.
          if (viroudata(col.dias ? get(r, col.dias) : null)) {
            avisos.push({ lv: 'erro', t: `Curso "${curso}": o Excel entendeu os dias permitidos como uma data. `
              + 'Escreva com apóstrofo na frente — por exemplo \'01 - 08 — e envie de novo.' });
          }
          const anterior = janelas.get(curso);
          if (anterior) {
            repetidos.add(curso);
            const novos = lerDias(col.dias ? get(r, col.dias) : '', D);
            if (anterior.dias && novos) for (const d of novos) anterior.dias.add(d);
            else anterior.dias = null;                 // um deles é "mês inteiro"
            if (!anterior.tipo && tipo) anterior.tipo = tipo === 'EXTERNO' ? 'EXTERNO' : 'INTERNO';
            continue;
          }
          janelas.set(curso, {
            curso,
            tipo: tipo === 'EXTERNO' ? 'EXTERNO' : tipo === 'INTERNO' ? 'INTERNO' : '',
            dias: lerDias(col.dias ? get(r, col.dias) : '', D),
            linha: r,
          });
        }
      }
    }

    if (!linhas || !linhas.length) throw new Error('Não achei a aba CURSOS (preciso das colunas MATRÍCULA, CURSO e DATA).');
    for (const c of repetidos) avisos.push({ lv: 'aviso', t: `Curso "${c}" aparece em mais de uma linha da aba JANELAS — juntei os dias das duas` });

    // A aba DB existe para você não redigitar nome e função. O painel se vira
    // com a matrícula, mas os relatórios ficam ilegíveis sem o nome — então
    // preenche daqui o que estiver em branco, e confere de quebra se a pessoa
    // está em condição de fazer curso.
    if (db) for (const a of aplicarDB(linhas, db)) avisos.push(a);
    if (!janelas) { janelas = new Map(); avisos.push({ lv: 'aviso', t: 'Sem aba JANELAS — tratei todos os cursos como internos, livres no mês inteiro.' }); }

    for (const l of linhas) {
      if (!l.curso) { avisos.push({ lv: 'erro', t: `Linha ${l.linha}: matrícula ${l.mat} sem curso informado` }); continue; }
      const j = janelas.get(l.curso);
      if (!j) { avisos.push({ lv: 'aviso', t: `Curso "${l.curso}" não está na aba JANELAS — tratei como interno, livre no mês` }); continue; }
      if (j.tipo === 'EXTERNO' && !j.dias && !l.data) {
        avisos.push({ lv: 'erro', t: `Curso "${l.curso}" é EXTERNO e está sem datas — confirme com o fornecedor antes de planejar` });
      }
    }
    return { linhas, janelas, avisos, destino, wb, db };
  }

  /* Devolve a mesma planilha que entrou, com a coluna DATA preenchida.
     Regrava só essas células: instruções, janelas, fórmulas e formatação
     ficam exatamente como estavam, e o arquivo pode ser reaberto, ajustado
     à mão e subido de novo. */
  async function gravarProgramacao(prog, itens) {
    if (!prog.destino || !prog.destino.colData) throw new Error('A planilha não tem coluna DATA para preencher.');
    const porLinha = new Map();
    for (const it of itens) {
      if (it.dia === null) continue;
      porLinha.set(it.l.linha, it.dia);
    }
    const upd = new Map();
    const mes = itens.length ? itens[0]._mes : null;
    for (const [linha, dia] of porLinha) {
      const m = new Map();
      m.set(prog.destino.colData, mes ? fmtData(mes, dia) : String(dia + 1));
      upd.set(linha, m);
    }
    const bySheet = new Map([[prog.destino.path, upd]]);
    return E.patchWorkbook(prog.wb, bySheet);
  }

  const fmtData = (mes, dia) =>
    String(dia + 1).padStart(2, '0') + '/' + String(mes.month + 1).padStart(2, '0') + '/' + mes.year;

  /* ══════════════════════════════════ cobertura ═══════════════════════ */

  // Marca os slots cobertos por um turno. Turno que vira a noite (22:00→06:00)
  // devolve as horas da madrugada para o dia seguinte, que é onde elas
  // realmente acontecem na operação.
  function turnoSlots(emp) {
    const ini = paraSlot(emp.entrada), fim = paraSlot(emp.saida);
    if (ini === null || fim === null) return null;
    if (fim > ini) return [{ dia: 0, de: ini, ate: fim }];
    if (fim === ini) return [{ dia: 0, de: ini, ate: Math.min(ini + 12, SLOTS) }];  // sem saída confiável: 6h
    return [{ dia: 0, de: ini, ate: SLOTS }, { dia: 1, de: 0, ate: fim }];
  }

  // Curva de cobertura do mês, sem considerar os cursos a planejar.
  function coberturaBase(model) {
    const D = model.month.days;
    const base = Array.from({ length: D }, () => new Float64Array(SLOTS));
    const semHorario = [];
    for (const s of model.sheets) for (const b of s.blocks) for (const g of b.groups) for (const e of g.emps) {
      const t = turnoSlots(e);
      if (!t) { semHorario.push(e); continue; }
      e._slots = t;
      for (let d = 0; d < D; d++) {
        if (E.eff(e, d)) continue;                       // folga, férias, curso: não está em pista
        for (const seg of t) {
          const dd = d + seg.dia;
          if (dd >= D) continue;
          for (let x = seg.de; x < seg.ate; x++) base[dd][x] += 1;
        }
      }
    }
    return { base, semHorario };
  }

  /* ══════════════════════════════════ planejamento ════════════════════ */

  const PESO_FOLGA = 40;      // preferir não cair em dia de folga já lançada
  const PESO_PROX = 25;       // não tirar a mesma pessoa duas vezes na semana

  function prng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

  function planejar(model, prog, opts = {}) {
    const D = model.month.days, dow = model.month.dow;
    const { base, semHorario } = coberturaBase(model);
    const porMat = new Map();
    for (const s of model.sheets) for (const b of s.blocks) for (const g of b.groups) for (const e of g.emps) porMat.set(e.mat, e);

    const avisos = prog.avisos.slice();
    const itens = [], naoEncontrados = new Map(), semHorarioUsado = new Map();

    /* Pessoa que a escala não conhece ainda precisa de data: o curso existe
       e vai acontecer. Este é um colaborador de mentira, só para o item ter
       onde se apoiar — sem turno, e por isso sem medição de impacto.
       Antes eu pulava essas linhas, e elas voltavam com a data em branco na
       planilha, como se o curso tivesse falhado. */
    const fantasma = (mat, nome) => ({
      mat, name: nome || ('MAT ' + mat), row: 0,
      fixed: new Array(D).fill(''), manual: new Array(D).fill(''), gen: new Array(D).fill(''),
      _slots: null, _foraDaEscala: true,
    });
    const fantasmas = new Map();

    for (const l of prog.linhas) {
      if (!l.curso) continue;
      let e = porMat.get(l.mat);
      let motivo = '';
      if (!e) {
        if (!naoEncontrados.has(l.mat)) naoEncontrados.set(l.mat, { mat: l.mat, nome: l.nome, qtd: 0 });
        naoEncontrados.get(l.mat).qtd++;
        if (!fantasmas.has(l.mat)) fantasmas.set(l.mat, fantasma(l.mat, l.nome));
        e = fantasmas.get(l.mat);
        motivo = 'fora da escala';
      } else if (!e._slots) {
        if (!semHorarioUsado.has(l.mat)) semHorarioUsado.set(l.mat, { mat: l.mat, nome: e.name, qtd: 0 });
        semHorarioUsado.get(l.mat).qtd++;
        motivo = 'sem horário na escala';
      }
      const j = prog.janelas.get(l.curso) || { tipo: '', dias: null };
      const item = { l, e, curso: l.curso, tipo: j.tipo || 'INTERNO', dia: null, travado: false, cands: [],
        medivel: !motivo, motivo };

      if (l.data) {                                       // data já fechada na planilha
        if (l.data.getUTCFullYear() === model.month.year && l.data.getUTCMonth() === model.month.month) {
          item.dia = l.data.getUTCDate() - 1; item.travado = true;
        } else {
          avisos.push({ lv: 'aviso', t: `${l.mat} · ${l.curso}: data ${l.data.toLocaleDateString('pt-BR', { timeZone: 'UTC' })} é de outro mês — ignorada` });
        }
      }
      if (!item.travado) {
        for (let d = 0; d < D; d++) {
          if (dow[d] === 0 || dow[d] === 6) continue;      // fim de semana nunca
          if (j.dias && !j.dias.has(d)) continue;          // fora da janela do curso
          const cod = E.eff(e, d);
          if (cod === 'L' || cod === 'K') continue;        // férias ou curso já marcado
          item.cands.push(d);
        }
        if (!item.cands.length) {
          avisos.push({ lv: 'erro', t: `${l.mat} ${l.nome} · ${l.curso}: não sobrou nenhum dia possível (janela, férias ou fim de semana)` });
          continue;
        }
      }
      item._mes = model.month;
      itens.push(item);
    }
    // Duas causas diferentes, duas ações diferentes: uma se resolve subindo a
    // escala certa, a outra preenchendo a entrada/saída na planilha da escala.
    for (const x of naoEncontrados.values())
      avisos.push({ lv: 'aviso', t: `${x.mat} ${x.nome} não está na escala — ${x.qtd} curso(s) com data, porém sem medição de impacto` });
    for (const x of semHorarioUsado.values())
      avisos.push({ lv: 'erro', t: `${x.mat} ${x.nome} está na escala mas sem horário de entrada/saída — ${x.qtd} curso(s) com data, porém sem medição de impacto. Preencha entrada e saída na escala.` });
    for (const e of semHorario) if (!semHorarioUsado.has(e.mat))
      avisos.push({ lv: 'aviso', t: `${e.mat} ${e.name} está na escala sem horário de entrada/saída (não tem curso este mês)` });

    /* --- déficit: quantas pessoas saem de cada slot de cada dia --- */
    const def = Array.from({ length: D }, () => new Float64Array(SLOTS));
    // Quantas pessoas ficam fora em cada dia, medíveis ou não. É a única
    // régua disponível para quem não tem turno: sem curva de cobertura, o
    // melhor que dá para fazer é mandar essa gente para os dias mais vazios.
    const carga = new Float64Array(D);
    const aplicar = (item, d, sinal) => {
      carga[d] += sinal;
      if (!item.medivel) return;
      // Curso em dia que a pessoa já não trabalhava (folga lançada) não
      // derruba cobertura nenhuma — ela não estava em pista de qualquer
      // jeito. Contar aqui inventaria um buraco que não existe. O custo
      // desse caso é outro: a folga precisa ser remanejada, e isso está
      // em PESO_FOLGA.
      if (E.eff(item.e, d)) return;
      for (const seg of item.e._slots) {
        const dd = d + seg.dia; if (dd >= D) continue;
        const v = def[dd];
        for (let x = seg.de; x < seg.ate; x++) v[x] += sinal;
      }
    };

    // Custo de um slot: o déficit pesa mais onde há menos gente. Quadrático
    // para que um buraco fundo doa mais que dois rasos.
    const custoSlot = (d, x) => { const b = base[d][x]; return def[d][x] * def[d][x] / (b > 1 ? b : 1); };
    const custoDe = (item, d) => {
      let c = 0;
      if (item.medivel) {
        for (const seg of item.e._slots) {
          const dd = d + seg.dia; if (dd >= D) continue;
          for (let x = seg.de; x < seg.ate; x++) c += custoSlot(dd, x);
        }
      } else {
        // Quadrático sobre o total do dia: empurra para os vales, do mesmo
        // jeito que o custo de cobertura faz com quem tem turno.
        c += carga[d] * carga[d] * 0.8;
      }
      const cod = E.eff(item.e, d);
      if (cod === 'F' || cod === 'FA') c += PESO_FOLGA;      // obrigaria a remanejar a folga
      for (const o of item.e._itens || []) {
        if (o === item || o.dia === null) continue;
        const dist = Math.abs(o.dia - d);
        if (dist === 0) c += 1e4;                            // dois cursos no mesmo dia
        else if (dist <= 3) c += PESO_PROX * (4 - dist);     // mesma semana
      }
      return c;
    };

    for (const it of itens) { (it.e._itens = it.e._itens || []).push(it); }
    const travados = itens.filter((i) => i.travado);
    const livres = itens.filter((i) => !i.travado);
    for (const it of travados) aplicar(it, it.dia, 1);

    /* --- busca: várias tentativas, guarda a melhor --- */
    const total = () => {
      let c = 0;
      for (let d = 0; d < D; d++) {
        for (let x = 0; x < SLOTS; x++) c += custoSlot(d, x);
        c += carga[d] * carga[d] * 0.4;      // desequilíbrio de cabeças, secundário
      }
      return c;
    };
    const tentativas = opts.tentativas ?? 6;
    let melhor = null, melhorCusto = Infinity, historico = [];

    for (let t = 0; t < tentativas; t++) {
      const rnd = prng(20261024 + t * 7919);
      for (const it of livres) { if (it.dia !== null) { aplicar(it, it.dia, -1); it.dia = null; } }

      // mais restrito primeiro; empate resolvido pela semente da tentativa
      const ordem = livres.slice().sort((a, b) => (a.cands.length - b.cands.length) || (rnd() - 0.5));
      for (const it of ordem) {
        let bd = -1, bc = Infinity;
        for (const d of it.cands) {
          const c = custoDe(it, d) + rnd() * 0.5;
          if (c < bc) { bc = c; bd = d; }
        }
        it.dia = bd; aplicar(it, bd, 1);
      }
      // descida local: move um por vez enquanto melhorar
      for (let volta = 0; volta < 12; volta++) {
        let mudou = false;
        for (const it of livres) {
          aplicar(it, it.dia, -1);
          const atual = custoDe(it, it.dia);
          let bd = it.dia, bc = atual;
          for (const d of it.cands) { if (d === it.dia) continue; const c = custoDe(it, d); if (c < bc - 1e-9) { bc = c; bd = d; } }
          it.dia = bd; aplicar(it, bd, 1);
          if (bd !== it.dia || bc < atual - 1e-9) mudou = true;
        }
        if (!mudou) break;
      }
      const c = total();
      historico.push(c);
      if (c < melhorCusto) { melhorCusto = c; melhor = livres.map((i) => i.dia); }
    }
    // reinstala a melhor tentativa
    for (const it of livres) { if (it.dia !== null) aplicar(it, it.dia, -1); }
    livres.forEach((it, i) => { it.dia = melhor[i]; aplicar(it, it.dia, 1); });

    return montarRelatorio(model, itens, base, def, avisos, { custo: melhorCusto, historico });
  }

  /* ══════════════════════════════════ relatório ═══════════════════════ */

  function montarRelatorio(model, itens, base, def, avisos, busca) {
    const D = model.month.days, dow = model.month.dow;
    const porDia = Array.from({ length: D }, () => ({ pessoas: 0, externos: 0, internos: 0, travados: 0, itens: [] }));
    for (const it of itens) {
      if (it.dia === null) continue;
      const p = porDia[it.dia];
      p.pessoas++; p.itens.push(it);
      if (it.travado) p.travados++;
      if (it.tipo === 'EXTERNO') p.externos++; else p.internos++;
    }
    // pior queda de cobertura de cada dia, em % do planejado
    const queda = [];
    for (let d = 0; d < D; d++) {
      let pior = 0, slotPior = 0;
      for (let x = 0; x < SLOTS; x++) {
        const b = base[d][x];
        if (b <= 0) continue;
        const q = def[d][x] / b;
        if (q > pior) { pior = q; slotPior = x; }
      }
      queda.push({ dia: d, pct: pior, slot: slotPior, util: dow[d] !== 0 && dow[d] !== 6 });
    }
    const uteis = queda.filter((q) => q.util);
    const pico = porDia.reduce((a, p, d) => (p.pessoas > a.pessoas ? { pessoas: p.pessoas, dia: d } : a), { pessoas: 0, dia: 0 });
    const piorQueda = uteis.reduce((a, q) => (q.pct > a.pct ? q : a), { pct: 0, dia: 0, slot: 0 });

    // piso: com os externos e travados onde estão, dá para melhorar até onde?
    const fixos = Array.from({ length: D }, () => 0);
    for (const it of itens) if (it.dia !== null && (it.travado || it.tipo === 'EXTERNO')) fixos[it.dia]++;

    return {
      itens, base, def, porDia, queda, avisos, busca,
      semMedicao: itens.filter((i) => !i.medivel && i.dia !== null),
      metricas: {
        total: itens.filter((i) => i.dia !== null).length,
        semMedicao: itens.filter((i) => !i.medivel && i.dia !== null).length,
        pessoasSemMedicao: new Set(itens.filter((i) => !i.medivel && i.dia !== null).map((i) => i.e.mat)).size,
        travados: itens.filter((i) => i.travado).length,
        externos: itens.filter((i) => i.tipo === 'EXTERNO').length,
        internos: itens.filter((i) => i.tipo === 'INTERNO').length,
        pico, piorQueda,
        picoFixo: Math.max(...fixos),
        diasUsados: porDia.filter((p) => p.pessoas).length,
        diasUteis: uteis.length,
      },
    };
  }

  /* Mede uma distribuição qualquer com a mesma régua — serve para comparar
     a proposta com o que já estava marcado (o "antes"). */
  function medir(model, pares) {
    const D = model.month.days;
    const { base } = coberturaBase(model);
    const def = Array.from({ length: D }, () => new Float64Array(SLOTS));
    // A mesma pessoa em dois cursos no mesmo dia sai uma vez só — senão a
    // medição desconta duas vezes alguém que só pode faltar uma.
    const vistos = new Set();
    for (const { emp, dia } of pares) {
      const t = emp._slots || turnoSlots(emp);
      if (!t || dia === null || dia < 0 || dia >= D) continue;
      if (E.eff(emp, dia)) continue;          // não estava em pista: nada a descontar
      const chave = emp.mat + '|' + dia;
      if (vistos.has(chave)) continue;
      vistos.add(chave);
      for (const seg of t) {
        const dd = dia + seg.dia; if (dd >= D) continue;
        for (let x = seg.de; x < seg.ate; x++) def[dd][x] += 1;
      }
    }
    let custo = 0, piorPct = 0, piorDia = 0;
    const porDia = new Array(D).fill(0);
    const contados = new Set();
    for (const { emp, dia } of pares) {
      if (!(dia >= 0 && dia < D)) continue;
      const chave = emp.mat + '|' + dia;
      if (contados.has(chave)) continue;     // uma pessoa por dia, não por curso
      contados.add(chave); porDia[dia]++;
    }
    for (let d = 0; d < D; d++) for (let x = 0; x < SLOTS; x++) {
      const b = base[d][x] > 1 ? base[d][x] : 1;
      custo += def[d][x] * def[d][x] / b;
      if (base[d][x] > 0) { const q = def[d][x] / base[d][x]; if (q > piorPct) { piorPct = q; piorDia = d; } }
    }
    return { custo, piorPct, piorDia, pico: Math.max(...porDia), porDia, base, def };
  }

  const api = { lerProgramacao, lerDias, viroudata, aplicarDB, papelDaAba, planejar, medir, coberturaBase, turnoSlots, paraSlot, gravarProgramacao, fmtData, SLOTS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.PlanejadorCursos = api;
})(typeof window !== 'undefined' ? window : globalThis);
