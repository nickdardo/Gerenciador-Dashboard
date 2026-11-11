/* ══════════════════════════════════════════════════════
   COMPARADOR — Escala Base × Escala Capacity

   As duas escalas respondem à mesma pergunta por caminhos opostos. A
   Base parte de quem já está lá: puxa o horário do ponto batido e do mês
   anterior. A Capacity parte do que a operação precisa: puxa os horários
   do dimensionamento. Comparar as duas é medir a distância entre o que
   se faz hoje e o que a malha aérea pede.

   Esta página existia como placeholder ("módulo em integração"). Havia
   também um js/comparator.js, de uma versão anterior, que comparava dois
   ARQUIVOS enviados à mão — e que nem é carregado pelo index.html. O
   cálculo de cobertura por hora dele era bom e foi aproveitado; o resto
   não serve mais, porque as duas escalas agora vivem no banco e não há
   por que pedir upload do que já se tem.

   Três perguntas, três respostas:

   1. COBERTURA POR HORA — onde a Base cobre a mais e a menos que a
      malha. É a pergunta da operação.
   2. DISRUPÇÃO — quantas pessoas mudam de horário, e quanto. É a
      pergunta de RH, e a que decide se a migração é viável.
   3. QUEM MUDA — a lista nominal, exportável. É o que vira conversa
      individual.
   ══════════════════════════════════════════════════════ */

const CMP_CORES = {
  base:     { traco: '#8a5f12', area: 'rgba(192,138,42,.18)', nome: 'Escala Base' },
  capacity: { traco: '#0b7093', area: 'rgba(11,112,147,.18)', nome: 'Escala Capacity' },
};

/* Faixas de deslocamento. A primeira não é "quase nada": uma pessoa que
   entra 30 minutos mais cedo não precisa renegociar nada, e misturá-la
   com quem vira o turno esconde o tamanho real do problema. */
const CMP_FAIXAS = [
  { ate: 0,    rotulo: 'Sem mudança',        cor: '#1a6b41' },
  { ate: 60,   rotulo: 'Até 1h',             cor: '#4a8a2a' },
  { ate: 180,  rotulo: 'De 1h a 3h',         cor: '#c08a2a' },
  { ate: 360,  rotulo: 'De 3h a 6h',         cor: '#c0592a' },
  { ate: 1440, rotulo: 'Mais de 6h',         cor: '#a01f1f' },
];

let cmpDados = null;   // { base, capacity, ano, mesNum, diasNoMes }
let cmpGrupo = null;   // filtro de grupo; null = todos

// ── Leitura ───────────────────────────────────────────

function cmpMin(hhmm) {
  const m = String(hhmm || '').match(/^(\d{1,2}):(\d{2})/);
  return m ? (+m[1]) * 60 + (+m[2]) : null;
}

function cmpHora(min) {
  const m = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/* O horário efetivo de uma pessoa, NO CENÁRIO pedido.

   As regras dos dois diferem, e é justamente a diferença que se quer
   medir — então não dá para usar a função da escala aberta, que resolve
   pelo cenário corrente. Aqui cada regra é aplicada explicitamente. */
function cmpHorarioDe(c, cenario, ano, mesNum, diasNoMes) {
  let entrada = c.entrada_manual || '';
  let saida = c.saida_manual || '';

  if (!entrada && cenario === 'planejada' && typeof escalaHorarioFixoDoColab === 'function') {
    // Só a Base herda o ponto batido. A Capacity, por definição, não.
    const fixo = escalaHorarioFixoDoColab(c.matricula, ano, mesNum, diasNoMes);
    if (fixo) { const [e, s] = fixo.split('-'); entrada = entrada || e; saida = saida || s; }
  }
  if (!entrada) return null;

  if (!saida && typeof escalaSaidaCalculada === 'function') {
    const ch = window.eoColabs?.get(c.matricula)?.ch || c.ch_manual || '';
    saida = escalaSaidaCalculada(entrada, ch) || '';
  }
  const e = cmpMin(entrada);
  if (e === null) return null;
  const s = cmpMin(saida);
  return { entrada: e, saida: s === null ? (e + 360) % 1440 : s };
}

async function cmpCarregar(base, mes) {
  const [ano, mesNum] = mes.split('-').map(Number);
  const diasNoMes = new Date(ano, mesNum, 0).getDate();

  const ler = async (cenario) => {
    const colabs = await escalaFetchColaboradores(base, mes, 'created_at', cenario);
    const pessoas = new Map();
    for (const c of colabs) {
      const h = cmpHorarioDe(c, cenario, ano, mesNum, diasNoMes);
      pessoas.set(c.matricula, {
        matricula: c.matricula,
        nome: c.nome || window.eoColabs?.get(c.matricula)?.nome || c.matricula,
        grupo: typeof escalaFuncaoGrupoDoColab === 'function'
          ? escalaFuncaoGrupoDoColab(c).label : 'Sem função',
        horario: h,
      });
    }
    return pessoas;
  };

  const [pBase, pCap] = await Promise.all([ler('planejada'), ler('dimensionada')]);
  return { base: pBase, capacity: pCap, ano, mesNum, diasNoMes, nomeBase: base, mes };
}

// ── Cálculos ──────────────────────────────────────────

/* Quantas pessoas estão em posto a cada hora do dia.

   A volta da meia-noite é o detalhe que engana: um turno 22:00–04:00
   cobre as horas 22, 23, 0, 1, 2 e 3, e tratar entrada < saída como
   regra geral perderia exatamente os turnos de madrugada, que são os
   mais críticos de dimensionar. */
function cmpCoberturaPorHora(pessoas, grupo) {
  const horas = new Array(24).fill(0);
  for (const p of pessoas.values()) {
    if (!p.horario) continue;
    if (grupo && p.grupo !== grupo) continue;
    const { entrada: E, saida: S } = p.horario;
    const viraDia = E > S;
    for (let h = 0; h < 24; h++) {
      const T = h * 60;
      if (viraDia ? (T >= E || T < S) : (T >= E && T < S)) horas[h]++;
    }
  }
  return horas;
}

/* O deslocamento de cada pessoa entre as duas escalas.

   A diferença é medida pelo caminho mais curto no relógio: de 23:00 para
   01:00 são duas horas, não vinte e duas. Medir a diferença crua faria
   a virada da meia-noite parecer a maior ruptura da base, quando é uma
   das menores. */
function cmpDisrupcao(dados, grupo) {
  const linhas = [];
  const matriculas = new Set([...dados.base.keys(), ...dados.capacity.keys()]);

  for (const mat of matriculas) {
    const b = dados.base.get(mat);
    const c = dados.capacity.get(mat);
    const quem = c || b;
    if (grupo && quem.grupo !== grupo) continue;

    const hb = b && b.horario ? b.horario.entrada : null;
    const hc = c && c.horario ? c.horario.entrada : null;

    let tipo, delta = null;
    if (hb === null && hc === null) tipo = 'semHorario';
    else if (hb === null) tipo = 'soCapacity';
    else if (hc === null) tipo = 'soBase';
    else {
      const bruto = Math.abs(hc - hb);
      delta = Math.min(bruto, 1440 - bruto);
      tipo = 'mudou';
    }
    linhas.push({
      matricula: mat, nome: quem.nome, grupo: quem.grupo,
      base: hb, capacity: hc, delta, tipo,
    });
  }
  linhas.sort((a, b) => (b.delta ?? -1) - (a.delta ?? -1)
    || String(a.nome).localeCompare(String(b.nome), 'pt-BR'));
  return linhas;
}

function cmpFaixaDe(delta) {
  for (const f of CMP_FAIXAS) if (delta <= f.ate) return f;
  return CMP_FAIXAS[CMP_FAIXAS.length - 1];
}

function cmpResumo(linhas) {
  const faixas = new Map(CMP_FAIXAS.map((f) => [f.rotulo, 0]));
  let soBase = 0, soCapacity = 0, semHorario = 0;
  for (const l of linhas) {
    if (l.tipo === 'mudou') {
      const f = cmpFaixaDe(l.delta);
      faixas.set(f.rotulo, faixas.get(f.rotulo) + 1);
    } else if (l.tipo === 'soBase') soBase++;
    else if (l.tipo === 'soCapacity') soCapacity++;
    else semHorario++;
  }
  return { faixas, soBase, soCapacity, semHorario, total: linhas.length };
}

// ── Desenho ───────────────────────────────────────────

function cmpGraficoCobertura(base, cap) {
  const W = 1000, H = 300, ML = 44, MR = 16, MT = 16, MB = 34;
  const iw = W - ML - MR, ih = H - MT - MB;
  const maxV = Math.max(1, ...base, ...cap);
  const passo = iw / 24;
  const x = (h) => ML + h * passo + passo / 2;
  const y = (v) => MT + ih - (v / maxV) * ih;

  const linha = (serie) => serie.map((v, h) => `${h ? 'L' : 'M'}${x(h).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const area = (serie) => `${linha(serie)} L${x(23).toFixed(1)},${MT + ih} L${x(0).toFixed(1)},${MT + ih} Z`;

  // Régua horizontal em cinco níveis — mais que isso vira grade e menos
  // que isso não dá para estimar valor nenhum.
  let eixoY = '';
  for (let i = 0; i <= 4; i++) {
    const v = Math.round((maxV / 4) * i);
    const yy = y(v);
    eixoY += `<line x1="${ML}" y1="${yy}" x2="${W - MR}" y2="${yy}" stroke="var(--border)" stroke-width="1" opacity=".5"/>`
      + `<text x="${ML - 8}" y="${yy + 4}" text-anchor="end" font-size="10" fill="var(--text-secondary)">${v}</text>`;
  }
  let eixoX = '';
  for (let h = 0; h < 24; h += 2) {
    eixoX += `<text x="${x(h)}" y="${H - 12}" text-anchor="middle" font-size="10" fill="var(--text-secondary)">${String(h).padStart(2, '0')}h</text>`;
  }

  /* As barras da diferença ficam ATRÁS das linhas: elas são o assunto,
     mas quem lê precisa ver as duas curvas por cima para saber de que
     lado está a sobra. */
  let dif = '';
  for (let h = 0; h < 24; h++) {
    const d = base[h] - cap[h];
    if (!d) continue;
    const topo = Math.min(y(base[h]), y(cap[h]));
    const alt = Math.abs(y(base[h]) - y(cap[h]));
    dif += `<rect x="${x(h) - passo * 0.32}" y="${topo}" width="${passo * 0.64}" height="${alt}"
      fill="${d > 0 ? 'rgba(192,138,42,.22)' : 'rgba(192,42,42,.20)'}"><title>${String(h).padStart(2, '0')}h — Base ${base[h]}, Capacity ${cap[h]} (${d > 0 ? '+' : ''}${d})</title></rect>`;
  }

  return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="display:block;height:${H}px" role="img"
    aria-label="Cobertura por hora do dia nas duas escalas">
    ${eixoY}${eixoX}${dif}
    <path d="${area(cap)}" fill="${CMP_CORES.capacity.area}"/>
    <path d="${linha(cap)}" fill="none" stroke="${CMP_CORES.capacity.traco}" stroke-width="2.5"/>
    <path d="${linha(base)}" fill="none" stroke="${CMP_CORES.base.traco}" stroke-width="2.5" stroke-dasharray="5 3"/>
    ${base.map((v, h) => `<circle cx="${x(h)}" cy="${y(v)}" r="9" fill="transparent"><title>${String(h).padStart(2, '0')}h — Base ${v}, Capacity ${cap[h]}</title></circle>`).join('')}
  </svg>`;
}

function cmpGraficoDisrupcao(resumo) {
  const barras = [
    ...CMP_FAIXAS.map((f) => ({ rotulo: f.rotulo, n: resumo.faixas.get(f.rotulo), cor: f.cor })),
    { rotulo: 'Só na Base', n: resumo.soBase, cor: '#6b7a8f' },
    { rotulo: 'Só na Capacity', n: resumo.soCapacity, cor: '#4a5a8a' },
  ].filter((b) => b.n > 0);
  if (!barras.length) return '<p class="cmp-vazio">Nada a comparar neste recorte.</p>';

  const maxV = Math.max(...barras.map((b) => b.n));
  return `<div class="cmp-barras">${barras.map((b) => `
    <div class="cmp-barra">
      <div class="rot">${b.rotulo}</div>
      <div class="trilho"><div class="preenchida" style="width:${(b.n / maxV) * 100}%;background:${b.cor}"></div></div>
      <div class="val">${b.n}</div>
    </div>`).join('')}</div>`;
}

// ── Página ────────────────────────────────────────────

async function pageComparador(el) {
  const base = window._escalaBase || (typeof escalaBasesPermitidas === 'function' ? escalaBasesPermitidas()[0] : null);
  const mes = window._escalaMes;

  el.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Comparador de Escalas</h1>
        <p class="page-sub">Escala Base × Escala Capacity · diferença de cobertura e disrupção de horários</p>
      </div>
      <div id="cmp-controles"></div>
    </div>
    <div id="cmp-corpo"><p class="cmp-carregando">Lendo as duas escalas...</p></div>`;

  if (!base || !mes) {
    document.getElementById('cmp-corpo').innerHTML =
      `<div class="page-placeholder"><p class="placeholder-title">Escolha a base e o mês</p>
       <p class="placeholder-sub">Abra a Escala Base ou a Escala Capacity primeiro — o comparador usa a mesma seleção.</p></div>`;
    return;
  }

  try {
    cmpDados = await cmpCarregar(base, mes);
  } catch (e) {
    document.getElementById('cmp-corpo').innerHTML =
      `<div class="page-placeholder"><p class="placeholder-title">Não consegui ler as escalas</p>
       <p class="placeholder-sub">${String(e.message || e)}</p></div>`;
    return;
  }
  cmpRender();
}

function cmpRender() {
  const d = cmpDados;
  if (!d) return;
  const corpo = document.getElementById('cmp-corpo');
  const ctrl = document.getElementById('cmp-controles');

  const nBase = [...d.base.values()].filter((p) => p.horario).length;
  const nCap = [...d.capacity.values()].filter((p) => p.horario).length;

  /* Uma escala vazia não produz comparação — produz um gráfico que
     parece dizer algo. Melhor dizer o que falta. */
  if (!nBase || !nCap) {
    ctrl.innerHTML = '';
    corpo.innerHTML = `<div class="page-placeholder">
      <p class="placeholder-title">Falta uma das escalas</p>
      <p class="placeholder-sub">
        ${d.nomeBase} · ${d.mes}<br>
        Escala Base: ${nBase} pessoa(s) com horário.<br>
        Escala Capacity: ${nCap} pessoa(s) com horário.<br><br>
        Monte a que está faltando e volte aqui.
      </p></div>`;
    return;
  }

  const grupos = [...new Set([...d.base.values(), ...d.capacity.values()].map((p) => p.grupo))]
    .filter(Boolean).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  ctrl.innerHTML = `
    <select class="adh-month-select" onchange="cmpSetGrupo(this.value)">
      <option value="">Todos os grupos</option>
      ${grupos.map((g) => `<option value="${g}" ${cmpGrupo === g ? 'selected' : ''}>${g}</option>`).join('')}
    </select>
    <button class="adh-refresh-btn" onclick="cmpExportar()">Baixar comparação</button>`;

  const cobBase = cmpCoberturaPorHora(d.base, cmpGrupo);
  const cobCap = cmpCoberturaPorHora(d.capacity, cmpGrupo);
  const linhas = cmpDisrupcao(d, cmpGrupo);
  const res = cmpResumo(linhas);

  // A hora de maior sobra e a de maior falta: é por onde a conversa começa.
  let maiorSobra = 0, maiorFalta = 0;
  for (let h = 0; h < 24; h++) {
    if (cobBase[h] - cobCap[h] > cobBase[maiorSobra] - cobCap[maiorSobra]) maiorSobra = h;
    if (cobCap[h] - cobBase[h] > cobCap[maiorFalta] - cobBase[maiorFalta]) maiorFalta = h;
  }
  const sobra = cobBase[maiorSobra] - cobCap[maiorSobra];
  const falta = cobCap[maiorFalta] - cobBase[maiorFalta];
  const mudam = res.total - res.faixas.get('Sem mudança') - res.semHorario;

  corpo.innerHTML = `
    <div class="cmp-cartoes">
      <div class="cmp-cartao"><span class="n">${nBase}</span><span class="r">na Escala Base</span></div>
      <div class="cmp-cartao"><span class="n">${nCap}</span><span class="r">na Escala Capacity</span></div>
      <div class="cmp-cartao ${mudam ? 'alerta' : ''}"><span class="n">${mudam}</span><span class="r">mudam de horário</span></div>
      <div class="cmp-cartao"><span class="n">${falta > 0 ? falta : 0}</span>
        <span class="r">a menos às ${String(maiorFalta).padStart(2, '0')}h</span></div>
      <div class="cmp-cartao"><span class="n">${sobra > 0 ? sobra : 0}</span>
        <span class="r">a mais às ${String(maiorSobra).padStart(2, '0')}h</span></div>
    </div>

    <div class="hc-panel cmp-painel">
      <div class="cmp-tit">Cobertura por hora do dia
        <span class="leg">
          <span class="chave"><i style="background:${CMP_CORES.capacity.traco}"></i>Capacity (o que a malha pede)</span>
          <span class="chave"><i class="tracejado" style="background:${CMP_CORES.base.traco}"></i>Base (o que se faz hoje)</span>
        </span>
      </div>
      ${cmpGraficoCobertura(cobBase, cobCap)}
      <p class="cmp-nota">As faixas sombreadas marcam a diferença hora a hora. Âmbar: a Base tem mais gente que o dimensionamento pede. Vermelho: tem menos.</p>
    </div>

    <div class="hc-panel cmp-painel">
      <div class="cmp-tit">Disrupção — quanto cada pessoa muda de horário</div>
      ${cmpGraficoDisrupcao(res)}
      <p class="cmp-nota">A diferença é medida pelo caminho mais curto no relógio: de 23:00 para 01:00 são duas horas, não vinte e duas.</p>
    </div>

    <div class="hc-panel cmp-painel">
      <div class="cmp-tit">Quem muda <span class="leg">${linhas.filter((l) => l.tipo === 'mudou' && l.delta > 0).length} pessoa(s)</span></div>
      <div class="cmp-tabela-wrap">
        <table class="cmp-tabela">
          <thead><tr><th>Matrícula</th><th>Nome</th><th>Grupo</th><th>Base</th><th>Capacity</th><th>Diferença</th></tr></thead>
          <tbody>${linhas.filter((l) => l.tipo !== 'semHorario' && l.delta !== 0).slice(0, 300).map((l) => `
            <tr>
              <td class="mono">${l.matricula}</td>
              <td>${l.nome}</td>
              <td class="sec">${l.grupo}</td>
              <td class="mono">${l.base === null ? '—' : cmpHora(l.base)}</td>
              <td class="mono">${l.capacity === null ? '—' : cmpHora(l.capacity)}</td>
              <td class="mono ${l.tipo === 'mudou' ? 'delta' : 'sec'}">${
                l.tipo === 'mudou' ? `${Math.floor(l.delta / 60)}h${String(l.delta % 60).padStart(2, '0')}`
                : l.tipo === 'soBase' ? 'sai da escala' : 'entra na escala'}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
      ${linhas.filter((l) => l.tipo !== 'semHorario' && l.delta !== 0).length > 300
        ? '<p class="cmp-nota">Mostrando as 300 maiores diferenças. Baixe a comparação para a lista inteira.</p>' : ''}
    </div>`;
}

function cmpSetGrupo(v) { cmpGrupo = v || null; cmpRender(); }

function cmpExportar() {
  if (typeof XLSX === 'undefined' || !cmpDados) return;
  const d = cmpDados;
  const linhas = cmpDisrupcao(d, cmpGrupo);
  const cobBase = cmpCoberturaPorHora(d.base, cmpGrupo);
  const cobCap = cmpCoberturaPorHora(d.capacity, cmpGrupo);

  const wb = XLSX.utils.book_new();

  const aba1 = [['HORA', 'ESCALA BASE', 'ESCALA CAPACITY', 'DIFERENÇA']];
  for (let h = 0; h < 24; h++) aba1.push([`${String(h).padStart(2, '0')}:00`, cobBase[h], cobCap[h], cobBase[h] - cobCap[h]]);
  const ws1 = XLSX.utils.aoa_to_sheet(aba1);
  ws1['!cols'] = [{ wch: 8 }, { wch: 14 }, { wch: 16 }, { wch: 11 }];
  ws1['!autofilter'] = { ref: 'A1:D25' };
  XLSX.utils.book_append_sheet(wb, ws1, 'Cobertura por hora');

  const aba2 = [['MATRÍCULA', 'NOME', 'GRUPO', 'BASE', 'CAPACITY', 'DIFERENÇA (MIN)', 'SITUAÇÃO']];
  for (const l of linhas) {
    aba2.push([String(l.matricula), l.nome, l.grupo,
      l.base === null ? '' : cmpHora(l.base),
      l.capacity === null ? '' : cmpHora(l.capacity),
      l.tipo === 'mudou' ? l.delta : '',
      l.tipo === 'mudou' ? (l.delta ? 'muda de horário' : 'sem mudança')
        : l.tipo === 'soBase' ? 'sai da escala'
        : l.tipo === 'soCapacity' ? 'entra na escala' : 'sem horário nas duas']);
  }
  const ws2 = XLSX.utils.aoa_to_sheet(aba2);
  ws2['!cols'] = [{ wch: 11 }, { wch: 32 }, { wch: 18 }, { wch: 9 }, { wch: 9 }, { wch: 15 }, { wch: 18 }];
  ws2['!autofilter'] = { ref: `A1:G${aba2.length}` };
  ws2['!freeze'] = { xSplit: 0, ySplit: 1 };
  ws2['!views'] = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];
  XLSX.utils.book_append_sheet(wb, ws2, 'Quem muda');

  XLSX.writeFile(wb, `Comparacao_${d.nomeBase}_${d.mes}${cmpGrupo ? '_' + cmpGrupo.replace(/\s+/g, '_') : ''}.xlsx`);
}
