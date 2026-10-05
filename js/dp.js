// ══════════════════════════════════════════════════════
// ESCALA → SISTEMA DO DP
//
// O DP não lê "folga" nem "08:00 às 14:00". Lê um número, um por pessoa
// por dia. A planilha que faz essa tradução hoje tem 10 abas e 7,4 MB de
// fórmula encadeada, e está entregando dado errado sem ninguém ver: na
// base BEL de outubro, 15 pessoas saem com #N/D nos 31 dias, a coluna de
// horas está com #VALOR! em todas as 262 linhas, e a folga agrupada
// diverge em 43 pessoas entre a aba de controle e a matriz enviada.
//
// Este módulo faz as duas pontas:
//
//   1. LÊ o arquivo do DP e extrai os catálogos — 825 horários, 104
//      turnos, os cargos, os feriados e o número de escala de cada
//      colaborador. É isso que o painel não tem como inventar.
//
//   2. GERA a matriz no mesmo layout que o DP já recebe, a partir da
//      escala do painel. Sem fórmula: cada célula é calculada e, quando
//      não dá para resolver, isso é REPORTADO em vez de virar #N/D.
//
// Os códigos especiais foram decifrados cruzando as 8.122 células da
// matriz de outubro, não por documentação:
//
//   9996  folga regulamentar  1.454 marcas, 231 pessoas, 5 a 7 por pessoa
//   9998  folga agrupada      exatamente 1 por pessoa, só segunda e sábado
//   8886  férias              16 pessoas com o mês inteiro
//   8883  afastamento longo   1 pessoa, 30 dias
//   8884  afastamento curto   1 pessoa, 7 dias
//
// Curso (K), licença (M) e compensação (CH) estão na legenda do arquivo,
// mas outubro não teve nenhum caso — então não há como deduzir o número.
// Ficam em branco e aparecem no relatório até o DP confirmar.
// ══════════════════════════════════════════════════════

(function (root) {
  'use strict';

  /* ══════════════════════════════ texto ═══════════════════════════════ */

  const semAcento = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '');
  const norm = (s) => semAcento(s).toUpperCase().replace(/\s+/g, ' ').trim();

  /* Hora em muitos formatos: "08:30", "8:30", 0.3541666 (fração do dia do
     Excel), "08:30:00". Devolve sempre "HH:MM" ou null. A fração é o caso
     que mais morde: o Excel guarda hora como número e, lido cru, "08:30"
     chega como 0,354166666666667. */
  function hhmm(v) {
    if (v === null || v === undefined || v === '') return null;
    if (typeof v === 'number') {
      if (v < 0) return null;
      const frac = v % 1;
      const min = Math.round(frac * 1440);
      const h = Math.floor(min / 60) % 24, m = min % 60;
      return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
    }
    const t = String(v).trim();
    const m = /^(\d{1,2})[:h.](\d{2})/.exec(t);
    if (!m) return null;
    const h = +m[1], mi = +m[2];
    if (h > 23 || mi > 59) return null;
    return String(h).padStart(2, '0') + ':' + String(mi).padStart(2, '0');
  }

  const faixaChave = (ent, sai) => (ent && sai ? ent + '-' + sai : null);

  // Código do DP: no arquivo ele aparece ora como número (57), ora como
  // texto ("9996"). Normalizar evita que o mesmo código conte duas vezes.
  function codigoTxt(v) {
    if (v === null || v === undefined || v === '') return '';
    if (typeof v === 'number') return String(Math.round(v));
    const t = String(v).trim();
    return /^\d+(\.0+)?$/.test(t) ? String(Math.round(parseFloat(t))) : t;
  }

  const SERIAL_EPOCH = Date.UTC(1899, 11, 30);
  const paraSerial = (d) => Math.round((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - SERIAL_EPOCH) / 86400000);

  const MESES = ['JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO',
    'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'];

  /* ═════════════════════ códigos de ausência ══════════════════════════ */

  /* Os quatro primeiros saíram da análise do arquivo real. Os três últimos
     a legenda prevê e o mês analisado não exercitou — ficam nulos de
     propósito: melhor a linha sair em branco e aparecer no relatório do
     que sair com um número inventado, que o DP aceitaria calado. */
  const CODIGOS_PADRAO = {
    F:  { codigo: '9996', rotulo: 'Folga regulamentar', origem: 'deduzido do arquivo' },
    FA: { codigo: '9998', rotulo: 'Folga agrupada',     origem: 'deduzido do arquivo' },
    L:  { codigo: '8886', rotulo: 'Férias',             origem: 'deduzido do arquivo' },
    J:  { codigo: '8883', rotulo: 'Afastamento',        origem: 'deduzido do arquivo' },
    K:  { codigo: null,   rotulo: 'Curso',              origem: 'falta confirmar com o DP' },
    M:  { codigo: null,   rotulo: 'Licença',            origem: 'falta confirmar com o DP' },
    CH: { codigo: null,   rotulo: 'Compensação de horas', origem: 'falta confirmar com o DP' },
  };

  const codigosPadrao = () => JSON.parse(JSON.stringify(CODIGOS_PADRAO));

  /* ═══════════════════ leitura do arquivo do DP ═══════════════════════ */

  /* O arquivo é .xlsb — binário, não o .xlsx que o resto do painel lê na
     mão. Aqui vale usar o SheetJS, que lê os dois: não há formatação a
     preservar, só conteúdo a extrair. */
  function lerPlanilha(buf) {
    const X = root.XLSX;
    if (!X) throw new Error('A biblioteca de Excel não carregou — recarregue a página.');
    return X.read(buf, { type: 'array', cellDates: false, cellNF: false, cellText: false });
  }

  const aoa = (wb, nome) => {
    const sh = wb.Sheets[nome];
    if (!sh) return [];
    return root.XLSX.utils.sheet_to_json(sh, { header: 1, raw: true, defval: null, blankrows: true });
  };

  // Aba por nome aproximado: o arquivo tem "FOLGA AGRUPADA DADOS " com
  // espaço no fim, e nomes mudam de base para base.
  function acharAba(wb, ...pistas) {
    const nomes = wb.SheetNames || [];
    for (const p of pistas) {
      const alvo = norm(p);
      const exato = nomes.find((n) => norm(n) === alvo);
      if (exato) return exato;
    }
    for (const p of pistas) {
      const alvo = norm(p);
      const perto = nomes.find((n) => norm(n).includes(alvo));
      if (perto) return perto;
    }
    return null;
  }

  /* ── 1. os 825 horários ─────────────────────────────────────────────
     cod | faixa | horas | … | entrada | saída. A entrada e a saída são o
     que importa: é por elas que a escala do painel encontra o código. */
  function lerHorarios(wb, avisos) {
    const nome = acharAba(wb, 'HORARIOS', 'HORÁRIOS');
    const porCodigo = new Map(), porFaixa = new Map();
    if (!nome) { avisos.push({ lv: 'erro', t: 'Não achei a aba HORARIOS — sem ela não há como traduzir horário em código.' }); return { porCodigo, porFaixa }; }

    let duplicadas = 0;
    for (const l of aoa(wb, nome)) {
      if (!l) continue;
      const cod = codigoTxt(l[0]);
      if (!cod || !/^\d+$/.test(cod)) continue;
      const ent = hhmm(l[5]), sai = hhmm(l[6]);
      if (!ent || !sai) continue;
      const horas = typeof l[2] === 'number' ? l[2] : parseFloat(String(l[2] || '').replace(',', '.')) || 0;
      const reg = { codigo: cod, entrada: ent, saida: sai, horas, faixa: String(l[1] ?? '').trim() };
      if (!porCodigo.has(cod)) porCodigo.set(cod, reg);
      const k = faixaChave(ent, sai);
      // Faixa repetida em vários códigos acontece (turnos partidos escritos
      // de formas diferentes). Fica o primeiro e o painel avisa quantos.
      if (porFaixa.has(k)) duplicadas++;
      else porFaixa.set(k, reg);
    }
    if (duplicadas) avisos.push({ lv: 'aviso', t: `${duplicadas} horário(s) do catálogo repetem uma faixa que já existe — na exportação vale o primeiro código de cada faixa.` });
    if (!porCodigo.size) avisos.push({ lv: 'erro', t: 'A aba HORARIOS foi encontrada mas nenhuma linha tinha entrada e saída legíveis.' });
    return { porCodigo, porFaixa };
  }

  /* ── 2. os turnos A/B/C/D ───────────────────────────────────────────
     A aba traz quatro blocos lado a lado: sigla | faixa | … | código.
     Em vez de fixar as colunas, procura a trinca em qualquer lugar da
     linha — assim sobrevive a uma coluna inserida no meio. */
  function lerTurnos(wb, avisos) {
    const nome = acharAba(wb, 'ESCALA GERAL', '6x1');
    const porSigla = new Map(), porCodigo = new Map();
    if (!nome) { avisos.push({ lv: 'aviso', t: 'Não achei a aba com o catálogo de turnos — a coluna TURNO vai sair do que o painel já sabe.' }); return { porSigla, porCodigo }; }

    for (const l of aoa(wb, nome)) {
      if (!l) continue;
      for (let c = 0; c < l.length; c++) {
        const sig = String(l[c] ?? '').trim();
        if (!/^[A-D]\d{0,2}$/.test(sig)) continue;
        // a faixa vem logo à frente; o código, mais à frente ainda
        let faixa = null, cod = null;
        for (let j = c + 1; j < Math.min(c + 12, l.length); j++) {
          const v = l[j];
          if (faixa === null && typeof v === 'string' && /\d{1,2}[:h]\d{2}/.test(v)) { faixa = v.trim(); continue; }
          if (faixa !== null && v !== null && v !== '' && /^\d+(\.0+)?$/.test(String(v).trim())) { cod = codigoTxt(v); break; }
        }
        if (!faixa) continue;
        if (!porSigla.has(sig)) porSigla.set(sig, { sigla: sig, faixa, codigo: cod });
        if (cod && !porCodigo.has(cod)) porCodigo.set(cod, sig);
      }
    }
    return { porSigla, porCodigo };
  }

  /* ── 3. o cadastro: número de escala, cargo e CH por colaborador ────
     O número de ESCALA é o dado que só o DP tem — 262 valores distintos
     para 262 pessoas, um por contrato. Sem ele a linha não fecha. */
  function lerCadastro(wb, avisos) {
    const nome = acharAba(wb, 'BANCO DE DADOS', 'BANCO DADOS');
    const pessoas = new Map();
    if (!nome) { avisos.push({ lv: 'aviso', t: 'Não achei a aba BANCO DE DADOS — o número de escala de cada colaborador vai faltar.' }); return pessoas; }

    const linhas = aoa(wb, nome);
    let cab = -1, col = {};
    for (let i = 0; i < Math.min(linhas.length, 12); i++) {
      const l = linhas[i] || [];
      const achado = {};
      l.forEach((v, c) => {
        const t = norm(v);
        if (t === 'NOMES' || t === 'NOME' || t === 'COLABORADOR') achado.nome = c;
        else if (t === 'ESCALA') achado.escala = c;
        else if (t.startsWith('COD') && t.includes('CARGO')) achado.codCargo = c;
        else if (t === 'CARGO' && achado.cargo === undefined) achado.cargo = c;
        else if (t.startsWith('CARGA HOR')) achado.ch = c;
        else if (t === 'DSR') achado.dsr = c;
      });
      if (achado.nome !== undefined && achado.escala !== undefined) { cab = i; col = achado; break; }
    }
    if (cab < 0) { avisos.push({ lv: 'aviso', t: 'A aba BANCO DE DADOS existe mas não achei o cabeçalho com NOMES e ESCALA.' }); return pessoas; }

    for (let i = cab + 1; i < linhas.length; i++) {
      const l = linhas[i];
      if (!l) continue;
      const mat = codigoTxt(l[0]);
      if (!mat || !/^\d+$/.test(mat)) continue;
      const ch = col.ch !== undefined ? (typeof l[col.ch] === 'number' ? l[col.ch] : parseFloat(String(l[col.ch] || '').replace(',', '.')) || null) : null;
      pessoas.set(mat, {
        matricula: mat,
        nome: String(l[col.nome] ?? '').trim(),
        escala: codigoTxt(l[col.escala]),
        codCargo: col.codCargo !== undefined ? codigoTxt(l[col.codCargo]) : '',
        cargo: col.cargo !== undefined ? String(l[col.cargo] ?? '').trim() : '',
        ch,
      });
    }
    if (!pessoas.size) avisos.push({ lv: 'aviso', t: 'Nenhum colaborador foi lido do BANCO DE DADOS.' });
    return pessoas;
  }

  /* ── 4. o turno e a escala que a matriz de referência já usa ────────
     Quando o arquivo traz a matriz montada, ela é a fonte mais confiável
     de TURNO e ESCALA por pessoa: é o que o DP recebeu de verdade. */
  function lerMatrizReferencia(wb) {
    const nome = (wb.SheetNames || []).find((n) => /MATRIZ/i.test(n));
    const ref = new Map();
    if (!nome) return { ref, aba: null };
    const linhas = aoa(wb, nome);
    const cab = (linhas[0] || []).map(norm);
    const iMat = cab.indexOf('MATRICULA'), iEsc = cab.indexOf('ESCALA'), iTur = cab.indexOf('TURNO');
    const iD1 = cab.indexOf('D1'), iC1 = cab.indexOf('C1');
    if (iMat < 0) return { ref, aba: nome };
    const ausencia = new Set(Object.values(CODIGOS_PADRAO).map((c) => c.codigo).filter(Boolean));
    for (let i = 1; i < linhas.length; i++) {
      const l = linhas[i];
      if (!l) continue;
      const mat = codigoTxt(l[iMat]);
      if (!mat || !/^\d+$/.test(mat)) continue;
      const turno = iTur >= 0 ? String(l[iTur] ?? '').trim() : '';

      /* O código de trabalho que a pessoa mais usou no mês anterior. Vale
         ouro: ~200 horários do catálogo repetem a mesma faixa de entrada e
         saída, e sem isso a busca por faixa devolveria o primeiro da lista
         — tecnicamente o mesmo horário, mas outro código, e o DP veria a
         pessoa mudando de horário sem ter mudado. */
      let anterior = '';
      if (iD1 >= 0 && iC1 === iD1 + 1) {
        const uso = new Map();
        for (let d = 0; d < 31; d++) {
          const c = codigoTxt(l[iC1 + 2 * d]);
          if (!c || !/^\d+$/.test(c) || ausencia.has(c)) continue;
          uso.set(c, (uso.get(c) || 0) + 1);
        }
        let melhor = 0;
        for (const [c, n] of uso) if (n > melhor) { melhor = n; anterior = c; }
      }

      ref.set(mat, {
        escala: iEsc >= 0 ? codigoTxt(l[iEsc]) : '',
        // "#N/D" e companhia não são turno: viram vazio para não contaminar
        turno: /^[A-D]\d{0,2}$/.test(turno) ? turno : '',
        codigoAnterior: anterior,
      });
    }
    return { ref, aba: nome };
  }

  /* ── 5. feriados e cargos, de brinde ────────────────────────────────── */
  function lerCargos(wb) {
    const nome = acharAba(wb, 'DADOS_CARGO', 'DADOS CARGO');
    const m = new Map();
    if (!nome) return m;
    for (const l of aoa(wb, nome)) {
      if (!l) continue;
      const cod = codigoTxt(l[1]), nm = String(l[2] ?? '').trim();
      if (cod && /^\d+$/.test(cod) && nm && norm(nm) !== 'CARGO') m.set(cod, nm);
    }
    return m;
  }

  function lerFeriados(wb) {
    const nome = acharAba(wb, 'BANCO DE DADOS');
    const out = [];
    if (!nome) return out;
    const linhas = aoa(wb, nome);
    let cDate = -1;
    for (let i = 0; i < Math.min(linhas.length, 12); i++) {
      const l = linhas[i] || [];
      const j = l.findIndex((v) => norm(v) === 'FERIADOS');
      if (j >= 0) { cDate = j; break; }
    }
    if (cDate < 0) return out;
    for (const l of linhas) {
      if (!l) continue;
      const v = l[cDate];
      if (typeof v !== 'number' || v < 20000 || v > 80000) continue;
      const d = new Date(SERIAL_EPOCH + v * 86400000);
      out.push({ data: d.toISOString().slice(0, 10), nome: String(l[cDate + 1] ?? '').trim() });
    }
    return out;
  }

  /* Lê tudo de uma vez. O que falhar vira aviso, não exceção: um arquivo
     sem a aba de cargos ainda serve para exportar. */
  function lerCatalogoDP(buf) {
    const avisos = [];
    const wb = lerPlanilha(buf);
    const horarios = lerHorarios(wb, avisos);
    const turnos = lerTurnos(wb, avisos);
    const cadastro = lerCadastro(wb, avisos);
    const { ref, aba } = lerMatrizReferencia(wb);
    const cargos = lerCargos(wb);
    const feriados = lerFeriados(wb);

    // A matriz de referência tem a última palavra sobre escala e turno.
    for (const [mat, r] of ref) {
      const p = cadastro.get(mat) || { matricula: mat, nome: '', codCargo: '', cargo: '', ch: null };
      if (r.escala) p.escala = r.escala;
      if (r.turno) p.turno = r.turno;
      if (r.codigoAnterior) p.codigoAnterior = r.codigoAnterior;
      cadastro.set(mat, p);
    }
    const semEscala = [...cadastro.values()].filter((p) => !p.escala).length;
    if (semEscala) avisos.push({ lv: 'aviso', t: `${semEscala} colaborador(es) do arquivo estão sem número de escala.` });

    return {
      abas: wb.SheetNames || [],
      abaMatriz: aba,
      horarios, turnos, cadastro, cargos, feriados,
      codigos: codigosPadrao(),
      avisos,
      resumo: {
        horarios: horarios.porCodigo.size,
        faixas: horarios.porFaixa.size,
        turnos: turnos.porSigla.size,
        pessoas: cadastro.size,
        comEscala: [...cadastro.values()].filter((p) => p.escala).length,
        comTurno: [...cadastro.values()].filter((p) => p.turno).length,
        cargos: cargos.size,
        feriados: feriados.length,
      },
    };
  }

  /* ═════════════════ horário do painel → código do DP ═════════════════ */

  /* Exata primeiro. Se a saída não bate mas a entrada sim, aceita com
     ressalva: o painel calcula a saída pela CH e o DP pode ter arredondado
     o intervalo de outro jeito. Nunca chuta sem dizer como chutou. */
  function acharCodigo(entrada, saida, cat, anterior) {
    const ent = hhmm(entrada), sai = hhmm(saida);
    if (!ent) return { codigo: null, via: 'sem horário no painel' };
    const F = cat.horarios.porFaixa;

    /* O código que a pessoa já usava vence a busca por faixa, desde que o
       horário não tenha mudado. Cerca de 200 códigos do catálogo descrevem
       a mesma faixa, e trocar o código de uma pessoa que não mudou de
       horário faria o DP registrar uma mudança que não houve. */
    if (anterior) {
      const reg = cat.horarios.porCodigo.get(codigoTxt(anterior));
      if (reg && reg.entrada === ent && (!sai || reg.saida === sai)) {
        return { codigo: reg.codigo, via: 'o código que a pessoa já usava', reg, confianca: 'alta' };
      }
    }

    const exato = F.get(faixaChave(ent, sai));
    if (exato) return { codigo: exato.codigo, via: 'horário idêntico ao catálogo', reg: exato, confianca: 'alta' };

    const mesmaEntrada = [];
    for (const reg of F.values()) if (reg.entrada === ent) mesmaEntrada.push(reg);
    if (mesmaEntrada.length === 1) return { codigo: mesmaEntrada[0].codigo, via: 'mesma entrada, saída diferente', reg: mesmaEntrada[0], confianca: 'média' };
    if (mesmaEntrada.length > 1) {
      return { codigo: null, via: 'ambíguo', confianca: null,
        opcoes: mesmaEntrada.slice(0, 8).map((r) => ({ codigo: r.codigo, faixa: r.faixa || faixaChave(r.entrada, r.saida) })) };
    }
    return { codigo: null, via: 'fora do catálogo', opcoes: [] };
  }

  /* ════════════════════ a matriz que vai para o DP ════════════════════ */

  /* `pessoas` vem do painel: { matricula, nome, entrada, saida, ch, dias }
     onde `dias` é um array de 31 posições com o status de cada dia
     ('' = trabalha, 'F', 'FA', 'L', 'J', 'K', 'CH', 'M'). */
  function montarMatrizDP(pessoas, cat, opts) {
    const o = opts || {};
    const ano = o.ano, mes = o.mes, base = o.base || '';
    const diasNoMes = new Date(ano, mes, 0).getDate();
    const codigos = Object.assign(codigosPadrao(), cat.codigos || {}, o.codigos || {});

    const cab = ['MATRICULA', 'COLABORADOR', 'ESCALA', 'TURNO'];
    for (let d = 1; d <= diasNoMes; d++) cab.push('D' + d, 'C' + d);
    cab.push('FOLGAS', 'DIAS', 'HORAS', 'BASE', 'MÊS', 'ANO', 'HORARIO', 'FA', 'MATPER');

    const linhas = [];
    const pend = { semEscala: [], semCodigo: [], ambiguos: [], semStatus: [], semTurno: [] };
    const vistos = new Set();

    for (const p of pessoas) {
      const mat = codigoTxt(p.matricula);
      const cad = cat.cadastro.get(mat) || {};
      const escala = cad.escala || '';
      if (!escala) pend.semEscala.push({ matricula: mat, nome: p.nome || cad.nome || '' });

      // Horário: o do painel manda; o código vem do catálogo do DP.
      const m = acharCodigo(p.entrada, p.saida, cat, cad.codigoAnterior);
      if (m.via === 'ambíguo') pend.ambiguos.push({ matricula: mat, nome: p.nome, entrada: hhmm(p.entrada), opcoes: m.opcoes });
      else if (!m.codigo && p.entrada) pend.semCodigo.push({ matricula: mat, nome: p.nome, entrada: hhmm(p.entrada), saida: hhmm(p.saida), via: m.via });

      let turno = cad.turno || '';
      if (!turno && m.codigo) turno = cat.turnos.porCodigo.get(m.codigo) || '';
      if (!turno) pend.semTurno.push({ matricula: mat, nome: p.nome });

      const linha = [mat, p.nome || cad.nome || '', escala, turno];
      let folgas = 0, trabalhados = 0;

      /* Quem troca de horário no meio do mês resolve dia a dia. O cache
         evita refazer a busca 31 vezes para quem não troca — que é a
         maioria: no arquivo real, 221 das 262 pessoas usam um horário só. */
      const cacheDia = new Map();
      const codigoDoDia = (d) => {
        const h = p.diasHorario && p.diasHorario[d - 1];
        if (!h || !h.entrada) return m;
        const k = hhmm(h.entrada) + '-' + hhmm(h.saida);
        if (cacheDia.has(k)) return cacheDia.get(k);
        const achado = acharCodigo(h.entrada, h.saida, cat, cad.codigoAnterior);
        cacheDia.set(k, achado);
        if (achado.via === 'ambíguo') pend.ambiguos.push({ matricula: mat, nome: p.nome, entrada: hhmm(h.entrada), opcoes: achado.opcoes });
        else if (!achado.codigo) pend.semCodigo.push({ matricula: mat, nome: p.nome, entrada: hhmm(h.entrada), saida: hhmm(h.saida), via: achado.via });
        return achado;
      };

      for (let d = 1; d <= diasNoMes; d++) {
        const st = String((p.dias && p.dias[d - 1]) || '').trim().toUpperCase();
        linha.push(paraSerial(new Date(ano, mes - 1, d)));
        if (!st) {                                  // dia trabalhado
          const md = codigoDoDia(d);
          linha.push(md.codigo || '');
          if (md.codigo) trabalhados++;
          continue;
        }
        const esp = codigos[st];
        if (esp && esp.codigo) {
          linha.push(esp.codigo);
          if (st === 'F' || st === 'FA') folgas++;
        } else {
          linha.push('');
          if (!vistos.has(st)) { vistos.add(st); pend.semStatus.push({ status: st, rotulo: (esp && esp.rotulo) || st }); }
        }
      }

      const ch = Number(p.ch || cad.ch || 0) || 0;
      linha.push(folgas, trabalhados, Math.round(trabalhados * ch * 100) / 100,
        base, MESES[mes - 1], ano,
        (m.reg && m.reg.faixa) || (hhmm(p.entrada) && hhmm(p.saida) ? hhmm(p.entrada) + ' - ' + hhmm(p.saida) : ''),
        (p.dias || []).some((x) => String(x).toUpperCase() === 'FA') ? 'FA' : '',
        mat + MESES[mes - 1] + ano);
      linhas.push(linha);
    }

    const celulas = linhas.length * diasNoMes;
    const vazias = linhas.reduce((s, l) => {
      let n = 0;
      for (let d = 0; d < diasNoMes; d++) if (l[5 + 2 * d] === '') n++;
      return s + n;
    }, 0);

    return {
      cabecalho: cab, linhas, pendencias: pend, diasNoMes,
      resumo: {
        pessoas: linhas.length, celulas, vazias,
        completo: celulas ? Math.round(1000 * (celulas - vazias) / celulas) / 10 : 0,
        semEscala: pend.semEscala.length,
        semCodigo: pend.semCodigo.length,
        ambiguos: pend.ambiguos.length,
        semTurno: pend.semTurno.length,
        statusSemCodigo: pend.semStatus.length,
      },
    };
  }

  /* O que o painel GANHA do arquivo do DP — a volta do caminho. */
  function oQueImportar(cat) {
    return [
      { chave: 'horarios', titulo: 'Tabela de horários', n: cat.resumo.horarios,
        txt: 'Entrada, saída e carga de cada código. É o de-para que traduz a escala em código do DP.' },
      { chave: 'turnos', titulo: 'Catálogo de turnos', n: cat.resumo.turnos,
        txt: 'As siglas A a D com a faixa de cada uma — mais preciso que deduzir o turno pela hora de entrada.' },
      { chave: 'escala', titulo: 'Número de escala', n: cat.resumo.comEscala,
        txt: 'Um por colaborador. Só o DP tem, e sem ele a linha não fecha.' },
      { chave: 'cargos', titulo: 'Códigos de cargo', n: cat.resumo.cargos,
        txt: 'Código oficial de cada cargo, para casar com o cadastro do painel.' },
      { chave: 'feriados', titulo: 'Feriados do ano', n: cat.resumo.feriados,
        txt: 'Alimenta o destaque de feriado na grade e a conta de cobertura.' },
    ];
  }

  const api = { lerCatalogoDP, montarMatrizDP, acharCodigo, oQueImportar,
    codigosPadrao, hhmm, codigoTxt, norm, paraSerial, faixaChave, MESES, CODIGOS_PADRAO };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.EscalaDP = api;
})(typeof window !== 'undefined' ? window : globalThis);
