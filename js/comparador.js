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

/* As cores vivem no CSS (tokens --cmp-*), não aqui: o SVG é montado em
   JavaScript e o painel tem tema claro e escuro. Guardar o hex no JS
   obrigaria este arquivo a saber qual tema está ativo — e a descobrir de
   novo toda vez que o usuário trocasse. */
const CMP_CORES = {
  base:     { traco: 'var(--cmp-base)', area: 'transparent',       nome: 'Escala Base' },
  capacity: { traco: 'var(--cmp-cap)',  area: 'var(--cmp-cap-area)', nome: 'Escala Capacity' },
  voos:     { traco: 'var(--cmp-voo)',  area: 'var(--cmp-voo-fill)', nome: 'Voos' },
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

  /* A malha entra como terceira série. É ela que dá sentido às outras
     duas: sem o movimento de voos ao fundo, "a Base tem 183 pessoas a
     mais às 09h" é um número solto — não dá para saber se a sobra está
     na hora em que o aeroporto está parado ou no meio do pico.

     Vem do mesmo lugar que o gráfico de aderência usa, e é o PICO de
     cada hora no mês (o pior dia), não a média: dimensionamento se faz
     pelo pior dia, senão a escala quebra justamente quando pesa. */
  const lerVoos = async () => {
    if (typeof adhVoosPorHora !== 'function') return { pico: new Array(24).fill(0), numDiasComVoo: 0 };
    try { return await adhVoosPorHora(base, mes); }
    catch (_) { return { pico: new Array(24).fill(0), numDiasComVoo: 0 }; }
  };

  const [pBase, pCap, malha] = await Promise.all([ler('planejada'), ler('dimensionada'), lerVoos()]);
  return {
    base: pBase, capacity: pCap, ano, mesNum, diasNoMes, nomeBase: base, mes,
    voos: malha.pico || new Array(24).fill(0),
    diasComVoo: malha.numDiasComVoo || 0,
  };
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

/* Um teto "redondo" para a régua.

   Usar o próprio máximo da série como topo faz a régua mudar de valor a
   cada filtro de grupo (387, depois 112, depois 1.204), e aí duas telas
   lado a lado não são comparáveis. Arredondar para 1, 2, 2,5 ou 5 vezes
   uma potência de dez dá um eixo estável e legível. */
function cmpTeto(valor, divisoes) {
  if (!(valor > 0)) return divisoes;
  const bruto = valor / divisoes;
  const mag = Math.pow(10, Math.floor(Math.log10(bruto)));
  const mult = [1, 2, 2.5, 3, 4, 5, 10].find((m) => m * mag >= bruto - 1e-9) || 10;
  return mult * mag * divisoes;
}

const cmpHh = (h) => `${String(h).padStart(2, '0')}h`;

/* COBERTURA POR HORA — o painel principal.

   Três séries no mesmo quadro, e isso é uma decisão com custo: pessoas
   (centenas) e voos (dezenas) não cabem na mesma régua, então os voos
   têm eixo próprio à direita e ocupam só a faixa de baixo. Desenhá-los
   em escala cheia os faria cruzar as curvas e competir com elas; na
   faixa de baixo eles funcionam como o que são — o pano de fundo contra
   o qual as duas escalas são julgadas. */
function cmpGraficoCobertura(base, cap, voos) {
  const W = 1320, H = 430;
  const ML = 56, MR = 56, MT = 34, MB = 32;
  const iw = W - ML - MR, ih = H - MT - MB;
  const largura = iw / 24;

  const serieVoos = Array.isArray(voos) && voos.length === 24 ? voos : new Array(24).fill(0);
  const temVoo = serieVoos.some((v) => v > 0);

  const maxP = cmpTeto(Math.max(1, ...base, ...cap), 4);
  const maxV = cmpTeto(Math.max(1, ...serieVoos), 4);
  const zonaVoo = ih * 0.38;        // os voos vivem nos 38% de baixo

  const x = (h) => ML + h * largura + largura / 2;
  const yP = (v) => MT + ih - (v / maxP) * ih;
  const yV = (v) => MT + ih - (v / maxV) * zonaVoo;

  const linha = (s) => s.map((v, h) => `${h ? 'L' : 'M'}${x(h).toFixed(1)},${yP(v).toFixed(1)}`).join(' ');
  const area = (s) => `M${x(0).toFixed(1)},${MT + ih} ${s.map((v, h) => `L${x(h).toFixed(1)},${yP(v).toFixed(1)}`).join(' ')} L${x(23).toFixed(1)},${MT + ih} Z`;

  // Régua de pessoas, à esquerda: cinco níveis. Mais que isso vira grade.
  let eixoY = '';
  for (let i = 0; i <= 4; i++) {
    const v = (maxP / 4) * i, yy = yP(v);
    eixoY += `<line x1="${ML}" y1="${yy.toFixed(1)}" x2="${ML + iw}" y2="${yy.toFixed(1)}"
      stroke="${i ? 'var(--border)' : 'var(--border-strong)'}" stroke-width="1"/>`
      + `<text x="${ML - 10}" y="${(yy + 4).toFixed(1)}" text-anchor="end" font-size="11" fill="var(--text-secondary)">${Math.round(v)}</text>`;
  }
  eixoY += `<text x="${ML - 10}" y="${MT - 14}" text-anchor="end" font-size="10.5" fill="var(--text-secondary)">pessoas</text>`;

  // Régua de voos, à direita. Só aparece se houver malha carregada —
  // um eixo marcando 0, 0 e 0 só ocupa espaço e sugere que faltou dado.
  let eixoVoo = '';
  if (temVoo) {
    for (let i = 0; i <= 2; i++) {
      const v = (maxV / 2) * i, yy = yV(v);
      eixoVoo += `<text x="${ML + iw + 10}" y="${(yy + 4).toFixed(1)}" font-size="11" fill="${CMP_CORES.voos.traco}">${Math.round(v)}</text>`;
    }
    // A legenda do eixo fica junto dos números dele, e não lá em cima:
    // os voos ocupam só a faixa de baixo, e um rótulo no topo do quadro
    // sugeriria que a régua da direita vale o gráfico inteiro.
    eixoVoo += `<text x="${ML + iw + 10}" y="${(yV(maxV) - 9).toFixed(1)}" font-size="10.5" fill="${CMP_CORES.voos.traco}">voos</text>`;
  }

  let eixoX = '';
  for (let h = 0; h < 24; h += 2) {
    eixoX += `<text x="${x(h).toFixed(1)}" y="${MT + ih + 20}" text-anchor="middle" font-size="11" fill="var(--text-secondary)">${cmpHh(h)}</text>`;
  }

  // Barras de voo, atrás de tudo.
  let barras = '';
  if (temVoo) {
    for (let h = 0; h < 24; h++) {
      if (!serieVoos[h]) continue;
      const topo = yV(serieVoos[h]);
      barras += `<rect x="${(x(h) - largura * 0.34).toFixed(1)}" y="${topo.toFixed(1)}"
        width="${(largura * 0.68).toFixed(1)}" height="${(MT + ih - topo).toFixed(1)}" rx="2"
        fill="${CMP_CORES.voos.area}" stroke="var(--cmp-voo-stroke)" stroke-width="1"/>`;
    }
  }

  // Picos das duas escalas, marcados.
  const iB = base.indexOf(Math.max(...base));
  const iC = cap.indexOf(Math.max(...cap));
  const pontos =
    `<circle cx="${x(iB).toFixed(1)}" cy="${yP(base[iB]).toFixed(1)}" r="4.5" fill="var(--bg-surface)" stroke="${CMP_CORES.base.traco}" stroke-width="2.5"/>`
    + `<circle cx="${x(iC).toFixed(1)}" cy="${yP(cap[iC]).toFixed(1)}" r="4.5" fill="var(--bg-surface)" stroke="${CMP_CORES.capacity.traco}" stroke-width="2.5"/>`;

  /* A hora de maior diferença ganha uma chamada escrita. É o número que
     a operação leva para a reunião, e procurá-lo passando o mouse hora a
     hora é trabalho que o gráfico pode poupar. */
  let chamada = '';
  const difs = base.map((v, h) => v - cap[h]);
  const iD = difs.reduce((m, d, h) => (Math.abs(d) > Math.abs(difs[m]) ? h : m), 0);
  if (difs[iD]) {
    const yAlto = Math.min(yP(base[iD]), yP(cap[iD]));
    const yBaixo = Math.max(yP(base[iD]), yP(cap[iD]));
    const yMeio = (yAlto + yBaixo) / 2;
    const cx = x(iD);
    const cabeLadoDireito = cx + 26 + 182 <= ML + iw;
    const bx = cabeLadoDireito ? cx + 26 : cx - 26 - 182;
    const guia = cabeLadoDireito ? cx + 16 : cx - 16;
    chamada =
      `<line x1="${guia.toFixed(1)}" y1="${yAlto.toFixed(1)}" x2="${guia.toFixed(1)}" y2="${yBaixo.toFixed(1)}" stroke="var(--cmp-dif)" stroke-width="1.5"/>`
      + `<line x1="${(guia - 4).toFixed(1)}" y1="${yAlto.toFixed(1)}" x2="${(guia + 4).toFixed(1)}" y2="${yAlto.toFixed(1)}" stroke="var(--cmp-dif)" stroke-width="1.5"/>`
      + `<line x1="${(guia - 4).toFixed(1)}" y1="${yBaixo.toFixed(1)}" x2="${(guia + 4).toFixed(1)}" y2="${yBaixo.toFixed(1)}" stroke="var(--cmp-dif)" stroke-width="1.5"/>`
      + `<rect x="${bx.toFixed(1)}" y="${(yMeio - 21).toFixed(1)}" width="182" height="42" rx="7" fill="var(--bg-card)" stroke="var(--cmp-dif)" stroke-opacity=".45"/>`
      + `<rect x="${bx.toFixed(1)}" y="${(yMeio - 21).toFixed(1)}" width="182" height="42" rx="7" fill="var(--cmp-dif-caixa)"/>`
      + `<text x="${(bx + 13).toFixed(1)}" y="${(yMeio - 3).toFixed(1)}" font-size="12" font-weight="700" fill="var(--cmp-dif)">${Math.abs(difs[iD])} pessoa(s) ${difs[iD] > 0 ? 'a menos' : 'a mais'}</text>`
      + `<text x="${(bx + 13).toFixed(1)}" y="${(yMeio + 13).toFixed(1)}" font-size="11" fill="var(--text-secondary)">às ${cmpHh(iD)} na Capacity</text>`;
  }

  /* Uma faixa invisível por hora, cobrindo o gráfico inteiro de cima a
     baixo: assim o número aparece ao passar o mouse em qualquer altura
     da coluna, e não só se acertar em cima da curva. */
  const alvos = base.map((v, h) =>
    `<rect x="${(ML + h * largura).toFixed(1)}" y="${MT}" width="${largura.toFixed(1)}" height="${ih}" fill="transparent">`
    + `<title>${cmpHh(h)} — Base ${v} · Capacity ${cap[h]} · diferença ${difs[h] > 0 ? '+' : ''}${difs[h]}`
    + `${temVoo ? ` · ${serieVoos[h]} voo(s)` : ''}</title></rect>`).join('');

  return `<svg viewBox="0 0 ${W} ${H}" role="img"
    aria-label="Cobertura por hora do dia nas escalas Base e Capacity, com o volume de voos da malha ao fundo">
    ${eixoY}${eixoVoo}${eixoX}${barras}
    <path d="${area(cap)}" fill="${CMP_CORES.capacity.area}"/>
    <path d="${linha(cap)}" fill="none" stroke="${CMP_CORES.capacity.traco}" stroke-width="2.6" stroke-linejoin="round"/>
    <path d="${linha(base)}" fill="none" stroke="${CMP_CORES.base.traco}" stroke-width="2.6" stroke-dasharray="7 5" stroke-linejoin="round"/>
    ${pontos}${chamada}${alvos}
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

  const voos = d.voos || new Array(24).fill(0);
  const temVoo = voos.some((v) => v > 0);

  const iB = cobBase.indexOf(Math.max(...cobBase));
  const iC = cobCap.indexOf(Math.max(...cobCap));
  const iV = voos.indexOf(Math.max(...voos));
  const difs = cobBase.map((v, h) => v - cobCap[h]);
  const iD = difs.reduce((m, dd, h) => (Math.abs(dd) > Math.abs(difs[m]) ? h : m), 0);

  // Horas-pessoa no dia: a conta que vira custo. A variação percentual
  // diz, numa linha, se a Capacity é mais cara ou mais barata que o que
  // se faz hoje — antes de qualquer discussão hora a hora.
  const somaB = cobBase.reduce((s, v) => s + v, 0);
  const somaC = cobCap.reduce((s, v) => s + v, 0);
  const varHP = somaB ? ((somaC - somaB) / somaB) * 100 : 0;

  const piorB = cobBase.indexOf(Math.min(...cobBase));
  const piorC = cobCap.indexOf(Math.min(...cobCap));
  const horasCapMaior = difs.filter((dd) => dd < 0).length;
  const mudam = res.total - res.faixas.get('Sem mudança') - res.semHorario;
  const hh = (h) => `${String(h).padStart(2, '0')}h`;

  corpo.innerHTML = `
    <div class="cmp-cartoes">
      <div class="cmp-cartao c-base">
        <span class="rot">Pico · Escala Base</span><span class="n">${cobBase[iB]}</span>
        <span class="r">às ${hh(iB)}</span></div>
      <div class="cmp-cartao c-cap">
        <span class="rot">Pico · Escala Capacity</span><span class="n">${cobCap[iC]}</span>
        <span class="r">às ${hh(iC)}</span></div>
      <div class="cmp-cartao c-dif">
        <span class="rot">Maior diferença</span><span class="n">${Math.abs(difs[iD])}</span>
        <span class="r">às ${hh(iD)} · ${difs[iD] > 0 ? 'a Base tem mais gente' : difs[iD] < 0 ? 'a Capacity tem mais gente' : 'as duas iguais'}</span></div>
      <div class="cmp-cartao c-voo">
        <span class="rot">Pico de voos</span><span class="n">${temVoo ? voos[iV] : '—'}</span>
        <span class="r">${temVoo ? `às ${hh(iV)} · pior dia do mês` : 'malha não carregada'}</span></div>
      <div class="cmp-cartao ${mudam ? 'alerta' : ''}">
        <span class="rot">Horas-pessoa no dia</span>
        <span class="n">${varHP > 0 ? '+' : ''}${varHP.toFixed(1).replace('.', ',')}%</span>
        <span class="r">${somaB.toLocaleString('pt-BR')} na Base → ${somaC.toLocaleString('pt-BR')} na Capacity</span></div>
    </div>

    <div class="hc-panel cmp-painel">
      <div class="cmp-tit">Cobertura por hora do dia
        <span class="leg">
          <span class="chave"><i style="background:${CMP_CORES.capacity.traco}"></i>Capacity (o que a malha pede)</span>
          <span class="chave"><i class="tracejado" style="background:${CMP_CORES.base.traco}"></i>Base (o que se faz hoje)</span>
          ${temVoo ? `<span class="chave"><i class="caixa" style="background:${CMP_CORES.voos.area};border:1px solid var(--cmp-voo-stroke)"></i>Voos/hora</span>` : ''}
        </span>
      </div>
      <div class="cmp-grafico">${cmpGraficoCobertura(cobBase, cobCap, voos)}</div>
      <div class="cmp-rodape">
        <span><b>Pior hora da Base:</b> ${hh(piorB)}, com ${cobBase[piorB]} pessoa(s)</span>
        <span><b>Pior hora da Capacity:</b> ${hh(piorC)}, com ${cobCap[piorC]} pessoa(s)</span>
        <span><b>Horas em que a Capacity tem mais gente:</b> ${horasCapMaior} de 24</span>
      </div>
      <p class="cmp-nota">
        Pessoas no eixo da esquerda, voos no da direita — as duas unidades não cabem na mesma régua.
        ${temVoo
          ? `As barras são o <b>pico</b> de cada hora no mês (${d.diasComVoo} dia(s) de malha lidos), não a média: dimensionamento se faz pelo pior dia.`
          : 'A malha deste mês não foi carregada, então as barras de voo não aparecem.'}
        ${cmpGrupo ? '<br>O filtro de grupo vale para as duas curvas; os voos são sempre os da base inteira, porque a malha não se divide por função.' : ''}
      </p>
    </div>

    <div class="hc-panel cmp-painel">
      <div class="cmp-tit">Disrupção — quanto cada pessoa muda de horário
        <span class="leg">${mudam} de ${res.total} pessoa(s) mudam</span>
      </div>
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

  /* A coluna de voos vai junto: sem ela a planilha perde justamente o
     que o gráfico ganhou — a referência contra a qual as duas escalas
     são julgadas. */
  const voos = d.voos || new Array(24).fill(0);
  const aba1 = [['HORA', 'ESCALA BASE', 'ESCALA CAPACITY', 'DIFERENÇA', 'VOOS (PICO DO MÊS)']];
  for (let h = 0; h < 24; h++) {
    aba1.push([`${String(h).padStart(2, '0')}:00`, cobBase[h], cobCap[h], cobBase[h] - cobCap[h], voos[h] || 0]);
  }
  const ws1 = XLSX.utils.aoa_to_sheet(aba1);
  ws1['!cols'] = [{ wch: 8 }, { wch: 14 }, { wch: 16 }, { wch: 11 }, { wch: 19 }];
  ws1['!autofilter'] = { ref: 'A1:E25' };
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
