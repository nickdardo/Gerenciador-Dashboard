// ══════════════════════════════════════════════════════
// DIMENSIONAMENTO × OPEX — aba do Admin
//
// Sobe o dimensionamento (um arquivo, várias bases nas abas) e um ou mais
// OPEX (um arquivo por base, uma aba por mês). O painel casa base com base
// e mês com mês, e mostra a diferença de efetivo por grupo.
//
// A tela tem um trabalho que vale mais que a soma: resolver os cargos que
// não casam sozinhos. Enquanto sobrar pendente, o delta está mentindo —
// e o painel diz isso em vez de esconder.
// ══════════════════════════════════════════════════════

function adminOpexTab(el) {
  el.innerHTML = opexTabHTML();
  opexMontar();
}

function opexTabHTML() {
  const zona = (n, id, tit, selo, txt, sub) => `
    <label class="fg-passo ${selo === 'obrigatório' ? 'req' : ''}" id="${id}-drop" for="${id}-file">
      <input type="file" id="${id}-file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"${id === 'ox-o' ? ' multiple' : ''}>
      <span class="fg-passo-n">${n}</span>
      <span class="fg-passo-txt">
        <span class="fg-passo-tit">${tit}<em class="fg-selo ${selo === 'obrigatório' ? 'req' : ''}">${selo}</em></span>
        <span class="fg-passo-desc">${txt}</span>
        <span class="fg-passo-drop"><b>Solte o arquivo aqui</b> ou clique para escolher<span class="fg-passo-sub">${sub}</span></span>
      </span>
      <span class="fg-passo-ok" id="${id}-nome"></span>
    </label>`;

  return `
  <div class="fg-scope fg-wrap fg-launcher" id="adm-opex">
    <div class="fg-top">
      <div>
        <div class="fg-eyebrow">Efetivo planejado × orçado</div>
        <h2 class="fg-title">Dimensionamento × OPEX</h2>
      </div>
      <div class="fg-actions">
        <button class="fg-btn" id="ox-recarregar" type="button" hidden>Recalcular</button>
      </div>
    </div>

    <div class="fg-como">
      <h3>Como funciona</h3>
      <p>O dimensionamento distribui o efetivo por <b>cargo</b>; o OPEX orça por <b>grupo</b>. O painel traduz
         um no outro usando o catálogo da aba <b>Funções</b> do próprio OPEX, e mostra a diferença em
         <b>pessoas</b> e em <b>FTE</b>.</p>
      <div class="fg-como-vias">
        <div class="fg-via"><span class="fg-via-n">Casa sozinho</span>
          Base com base pelo nome da aba, e mês com mês pela data. Sobe um dimensionamento e quantos OPEX quiser.</div>
        <div class="fg-via"><span class="fg-via-n">Você decide o que sobra</span>
          Cargo ambíguo — "AUXILIAR DE RAMPA" existe em dois grupos — fica para você resolver. A decisão é
          guardada e vale nos próximos meses.</div>
        <div class="fg-via"><span class="fg-via-n">E a lista para colar</span>
          No fim de cada base sai a lista pronta — Grupo, Função, CH, noturno e inicial — refletindo o
          dimensionamento linha a linha. Copia e cola na grade do OPEX.</div>
      </div>
      <p class="fg-como-fim">FTE = pessoas × carga horária ÷ 6, a mesma conta que os dois arquivos fazem por dentro.</p>
    </div>

    ${zona(1, 'ox-d', 'Dimensionamento do mês', 'obrigatório',
      'O arquivo com uma aba por base. O painel lê a tabela <b>Staff Alocação</b> de cada uma.',
      'Abas ocultas costumam ser versões antigas — entram, mas com aviso.')}

    ${zona(2, 'ox-o', 'OPEX das bases', 'obrigatório',
      'Um arquivo por base, com uma aba por mês. Pode selecionar vários de uma vez.',
      'O painel usa a aba do mês que bate com o dimensionamento.')}

    <div id="ox-nota"></div>
    <div id="ox-saida"></div>
    <div id="ox-toast" class="fg-toast" role="status" hidden></div>
  </div>`;
}

function opexMontar() {
  const X = window.OpexDim;
  const $ = (s) => document.querySelector(s);
  const esc = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

  // Estado fora da função: o Admin recria o DOM a cada troca de aba, e sem
  // isso os arquivos lidos se perderiam a cada ida e volta.
  if (!window._oxState) window._oxState = { dim: null, dimNome: '', opexes: [], opexNomes: [], depara: new Map(), res: null, busy: false };
  const S = window._oxState;

  let toastT = 0;
  const toast = (m, ms = 4500) => { const t = $('#ox-toast'); if (!t) return; t.innerHTML = m; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), ms); };
  const num = (v) => (Math.round(v * 10) / 10).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
  const sinal = (v) => (v > 0 ? '+' : '') + num(v);
  const cls = (v) => (Math.abs(v) < 0.05 ? 'zero' : v > 0 ? 'mais' : 'menos');

  /* ---------- de-para guardado no banco ---------- */
  async function carregarDepara() {
    try {
      const { data, error } = await db.from('opex_depara').select('cargo,grupo');
      if (error) throw error;
      S.depara = new Map((data || []).map((r) => [r.cargo, r.grupo]));
    } catch (err) {
      // Sem a tabela o painel continua servindo — só não lembra as decisões.
      console.warn('opex_depara indisponível:', err && err.message);
      S.deparaOffline = true;
    }
  }

  async function gravarDepara(cargoNorm, cargoOrig, grupo) {
    S.depara.set(cargoNorm, grupo);
    if (S.deparaOffline) { toast('Decisão aplicada só nesta sessão — a tabela <b>opex_depara</b> ainda não existe no banco.'); return; }
    try {
      const { error } = await db.from('opex_depara')
        .upsert({ cargo: cargoNorm, cargo_orig: cargoOrig, grupo }, { onConflict: 'cargo' });
      if (error) throw error;
    } catch (err) {
      toast('Apliquei aqui, mas não consegui guardar no banco: ' + esc(err && err.message));
    }
  }

  /* ---------- leitura ---------- */
  async function lerDim(file) {
    if (!file) return;
    $('#ox-d-nome').textContent = 'lendo…';
    try {
      S.dim = await X.lerDimensionamento(await file.arrayBuffer());
      S.dimNome = file.name;
      $('#ox-d-nome').textContent = file.name;
      $('#ox-nota').innerHTML = '';
      recalcular();
      toast(`${S.dim.bases.length} base(s) lidas: ${S.dim.bases.map((b) => b.base).join(', ')}.`);
    } catch (err) {
      $('#ox-d-nome').textContent = '';
      $('#ox-nota').innerHTML = `<div class="err-note">Não consegui ler o dimensionamento: ${esc(err.message || err)}</div>`;
    }
  }

  async function lerOpex(files) {
    if (!files || !files.length) return;
    $('#ox-o-nome').textContent = 'lendo…';
    const novos = [], nomes = [];
    for (const f of files) {
      try { novos.push(await X.lerOpex(await f.arrayBuffer())); nomes.push(f.name); }
      catch (err) { toast(`"${esc(f.name)}" não parece um OPEX: ${esc(err.message || err)}`, 7000); }
    }
    if (!novos.length) { $('#ox-o-nome').textContent = ''; return; }
    S.opexes = novos; S.opexNomes = nomes;
    $('#ox-o-nome').textContent = novos.map((o) => o.base || '?').join(', ');
    recalcular();
  }

  function recalcular() {
    if (!S.dim || !S.opexes.length) { render(); return; }
    S.res = X.sincronizar(S.dim, S.opexes, S.depara);
    render();
  }

  /* ---------- tela ---------- */
  function render() {
    const box = $('#ox-saida');
    $('#ox-recarregar').hidden = !S.res;
    if (!S.dim || !S.opexes.length) {
      box.innerHTML = S.dim || S.opexes.length
        ? `<p class="fg-cur-esperando">${S.dim ? 'Falta o OPEX das bases.' : 'Falta o dimensionamento.'}</p>` : '';
      return;
    }
    const { comparacoes, avisos } = S.res;
    box.innerHTML = comparacoes.map((c, i) => cartao(c, i)).join('')
      + (avisos.length ? `<details class="fg-cur-bloco aviso"><summary>Avisos da leitura <b>${avisos.length}</b></summary>
          <ul>${avisos.map((a) => `<li>${esc(a.t)}</li>`).join('')}</ul></details>` : '');
  }

  /* ---------- lista para colar no OPEX ---------- */

  const ESTADO = {
    igual: ['igual', 'já estava certo'],
    ajustada: ['ajustada', 'mudou de quantidade'],
    zerada: ['zerada', 'saiu do dimensionamento'],
    nova: ['nova', 'não existe no mês'],
    apoio: ['mantida', 'apoio — não é dimensionada'],
  };

  function blocoLista(c, i) {
    const L = c.lista;
    if (!L) return '';
    const T = L.totais;
    const mostra = 14;
    const jaMostrou = new Set();
    const linha = (l, oculta) => {
      const [rot, tit] = ESTADO[l.estado] || ['', ''];
      const chave = l.grupo + '|' + l.funcao + '|' + l.chDia;
      const repetida = jaMostrou.has(chave);
      jaMostrou.add(chave);
      const cargos = repetida ? '' : (l.cargos || []).map((x) => esc(x.cargo) + ' (' + x.qtd + ')').join(' · ');
      return `<tr class="ox-l-${l.estado}"${oculta ? ' hidden data-extra="' + i + '"' : ''}>
        <td>${esc(l.grupo)}</td>
        <td>${esc(l.funcao)}${cargos ? `<span class="ox-cargos">${cargos}</span>` : ''}</td>
        <td class="n">${l.chMes || ''}</td><td class="n">${l.chDia || ''}</td>
        <td class="n">${l.noturno || 0}</td>
        <td class="n forte">${l.inicial}</td>
        <td class="ox-l-est"><span class="ox-chip ${l.estado}" title="${tit}">${rot}</span>${
          l.estado === 'ajustada' || l.estado === 'zerada' ? `<span class="ox-de">era ${l.antes}</span>` : ''}</td>
      </tr>`;
    };

    return `
    <section class="ox-lista" data-lista="${i}">
      <header class="ox-lista-head">
        <div>
          <h4>Lista para colar no OPEX <span class="ox-badge">${T.linhas} linhas</span></h4>
          <p class="ox-lista-onde">${L.grade
            ? `Cole na aba <b>${esc(L.onde.aba)}</b>, na coluna <b>${esc(L.onde.coluna)}</b>, a partir da linha <b>${L.onde.linha}</b> — as ${L.colunas.length} colunas entram lado a lado.`
            : `Não achei a grade de lançamento neste OPEX, então a lista sai direto do dimensionamento: confira as colunas antes de colar.`}</p>
        </div>
        <div class="ox-lista-btns">
          <button type="button" class="fg-btn fg-primary" data-copiar="${i}">Copiar lista</button>
          <button type="button" class="fg-btn" data-baixar="${i}">Baixar .csv</button>
        </div>
      </header>

      ${T.pendQtd ? `<div class="ox-alerta">Esta lista está incompleta: <b>${T.pendQtd} pessoa(s)</b> ainda sem grupo.
        Classifique os cargos pendentes antes de colar, senão você vai gravar no OPEX um efetivo menor do que o dimensionado.</div>` : ''}

      ${L.faltamNoCatalogo.length ? `<div class="ox-alerta atencao">
        <b>${L.faltamNoCatalogo.length} função(ões) não existem no catálogo do OPEX</b> — crie na aba <b>Funções</b> antes de colar,
        senão a validação da coluna vai recusar:
        <ul class="ox-mini">${L.faltamNoCatalogo.map((l) => `<li><b>${esc(l.funcao)}</b> · ${esc(l.grupo)} · ${l.chDia}H · ${l.inicial} pessoa(s)
          <span class="ox-de">vem de ${l.cargos.map((x) => esc(x.cargo)).join(', ')}</span></li>`).join('')}</ul></div>` : ''}

      <div class="ox-lista-notas">
        <div class="ox-nota"><b>Quem manda em quê</b><span>
          O dimensionamento define o <i>total</i> de cada função. A quebra por <i>horas noturnas</i> ele não tem —
          essa vem da própria grade que já está no OPEX, mantendo a proporção que você usava.</span></div>
        ${L.repartidas.length ? `<div class="ox-nota"><b>${L.repartidas.length} função(ões) repartidas</b><span>
          ${L.repartidas.slice(0, 3).map((r) => `${esc(r.funcao)} ${r.chDia}H: ${r.total} em ${r.partes.map((p) => `${p.para}${p.noturno ? ' com ' + p.noturno + 'h not.' : ''}`).join(' + ')}`).join('<br>')}
          ${L.repartidas.length > 3 ? `<br>e mais ${L.repartidas.length - 3}.` : ''}</span></div>` : ''}
        ${L.semReferencia.length ? `<div class="ox-nota"><b>${L.semReferencia.length} linha(s) novas com noturno zero</b><span>
          Não havia linha equivalente no mês para copiar a quebra. Se alguma dessas turmas tem hora noturna, ajuste depois de colar.</span></div>` : ''}
        ${L.zeradas.length ? `<div class="ox-nota"><b>${L.zeradas.length} função(ões) zeradas</b><span>
          ${L.zeradas.slice(0, 4).map((z) => `${esc(z.funcao)} ${z.chDia}H (era ${z.antes})`).join(' · ')}
          — o dimensionamento deste mês não pede ninguém nelas.</span></div>` : ''}
        ${T.apoio ? `<div class="ox-nota"><b>${num(T.apoio)} pessoas de apoio preservadas</b><span>
          Grupos que o dimensionamento não cobre saem com o número que já estava no OPEX, em vez de zerar.</span></div>` : ''}
      </div>

      <table class="ox-tab ox-lista-tab">
        <thead><tr>${L.colunas.map((h, j) => `<th${j >= 2 ? ' class="n"' : ''}>${esc(h)}</th>`).join('')}<th>situação</th></tr></thead>
        <tbody>
          ${L.linhas.slice(0, mostra).map((l) => linha(l, false)).join('')}
          ${L.linhas.slice(mostra).map((l) => linha(l, true)).join('')}
        </tbody>
        <tfoot><tr><th colspan="${L.colunas.length - 1}">Total da lista</th>
          <th class="n">${T.pessoas}</th>
          <th class="ox-l-est">${T.pessoas !== T.antes ? `<span class="ox-de">era ${T.antes}</span>` : ''}</th></tr></tfoot>
      </table>
      ${L.linhas.length > mostra
        ? `<button type="button" class="ox-mais" data-mais="${i}">${L.linhas.length - mostra === 1
            ? 'Ver a última linha' : `Ver as outras ${L.linhas.length - mostra} linhas`}</button>` : ''}
    </section>`;
  }

  function cartao(c, i) {
    const T = c.totais;
    const mes = c.periodo ? c.periodo.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' }) : '';
    const pend = c.pendentes.length;

    return `
    <section class="ox-card" data-base="${esc(c.base)}">
      <header class="ox-card-head">
        <h3>${esc(c.base)}</h3>
        <span class="ox-sub">dimensionamento ${esc(mes)} × OPEX ${esc(c.mesOpex)}</span>
      </header>

      ${pend ? `<div class="ox-alerta">
        <b>${T.pendQtd} pessoa(s)</b> em ${pend} linha(s) ainda não foram classificadas — o delta abaixo está incompleto
        enquanto isso. Resolva na seção <b>Cargos a classificar</b>.</div>` : ''}

      <div class="ox-nums">
        <div class="ox-num"><span class="k">Dimensionado</span><span class="v">${num(T.dimQtd)}</span><span class="s">pessoas · ${num(T.dimFte)} FTE</span></div>
        <div class="ox-num"><span class="k">No OPEX</span><span class="v">${num(T.opexQtd)}</span><span class="s">pessoas · ${num(T.opexFte)} FTE</span></div>
        <div class="ox-num ${cls(T.deltaQtd)}"><span class="k">Delta pessoas</span><span class="v">${sinal(T.deltaQtd)}</span><span class="s">${T.deltaQtd > 0 ? 'a mais no OPEX' : T.deltaQtd < 0 ? 'faltando no OPEX' : 'bate certo'}</span></div>
        <div class="ox-num ${cls(T.deltaFte)}"><span class="k">Delta FTE</span><span class="v">${sinal(T.deltaFte)}</span><span class="s">${Math.abs(T.deltaFte) < 0.05 ? 'bate certo' : 'diferença de custo'}</span></div>
      </div>

      <table class="ox-tab">
        <thead><tr>
          <th>Grupo</th>
          <th class="n">Dimens.</th><th class="n">OPEX</th><th class="n d">Δ pessoas</th>
          <th class="n">Dimens.</th><th class="n">OPEX</th><th class="n d">Δ FTE</th>
        </tr></thead>
        <tbody>
          ${c.porGrupo.map((g) => `
            <tr class="ox-g" data-g="${esc(g.grupo)}">
              <td><button type="button" class="ox-exp" data-exp="${esc(c.base)}|${esc(g.grupo)}">${esc(g.grupo)}</button></td>
              <td class="n">${num(g.dimQtd)}</td><td class="n">${num(g.opexQtd)}</td>
              <td class="n d ${cls(g.deltaQtd)}">${sinal(g.deltaQtd)}</td>
              <td class="n">${num(g.dimFte)}</td><td class="n">${num(g.opexFte)}</td>
              <td class="n d ${cls(g.deltaFte)}">${sinal(g.deltaFte)}</td>
            </tr>
            ${g.chs.map((l) => `
              <tr class="ox-ch" data-de="${esc(c.base)}|${esc(g.grupo)}" hidden>
                <td class="ox-ch-nome">${l.chRot}${l.itens.length ? ` <span class="ox-cargos">${l.itens.map((i) => esc(i.cargo) + ' (' + i.qtd + ')').join(' · ')}</span>` : ''}</td>
                <td class="n">${num(l.dimQtd)}</td><td class="n">${num(l.opexQtd)}</td>
                <td class="n d ${cls(l.deltaQtd)}">${sinal(l.deltaQtd)}</td>
                <td class="n">${num(l.dimFte)}</td><td class="n">${num(l.opexFte)}</td>
                <td class="n d ${cls(l.deltaFte)}">${sinal(l.deltaFte)}</td>
              </tr>`).join('')}
          `).join('')}
        </tbody>
        <tfoot><tr>
          <th>Total</th>
          <th class="n">${num(T.dimQtd)}</th><th class="n">${num(T.opexQtd)}</th><th class="n d ${cls(T.deltaQtd)}">${sinal(T.deltaQtd)}</th>
          <th class="n">${num(T.dimFte)}</th><th class="n">${num(T.opexFte)}</th><th class="n d ${cls(T.deltaFte)}">${sinal(T.deltaFte)}</th>
        </tr></tfoot>
      </table>

      ${pend ? `<div class="ox-pend">
        <h4>Cargos a classificar <span class="ox-badge">${pend}</span></h4>
        <p class="ox-pend-ajuda">Escolha o grupo do OPEX para cada um. A escolha é guardada e vale nos próximos meses,
           para todas as bases.</p>
        ${c.pendentes.map((p) => `
          <div class="ox-pend-l">
            <span class="ox-pend-cargo"><b>${esc(p.cargo)}</b>
              <span class="ox-pend-meta">${p.chRot} · ${p.qtd} pessoa(s)${p.secao ? ' · ' + esc(p.secao) : ''} · ${esc(p.via)}</span></span>
            <select class="ox-sel" data-cargo="${esc(p.cargo)}">
              <option value="">— escolha o grupo —</option>
              ${(p.opcoes.length ? p.opcoes : gruposConhecidos()).map((g) => `<option value="${esc(g)}">${esc(g)}</option>`).join('')}
              ${p.opcoes.length ? `<option value="__todos">outro grupo…</option>` : ''}
            </select>
          </div>`).join('')}
      </div>` : ''}

      ${blocoLista(c, i)}

      ${c.apoio.length ? `<details class="ox-apoio"><summary>Existe no OPEX e não é dimensionado
          <b>${num(T.apoioQtd)} pessoas · ${num(T.apoioFte)} FTE</b></summary>
        <p class="ox-pend-ajuda">Funções de apoio que o dimensionamento operacional não cobre. Ficam fora do delta
          para não repetir o mesmo ruído todo mês${c.apoioProvisorio ? ' — e esta lista pode mudar quando você classificar os cargos pendentes' : ''}.</p>
        <table class="ox-tab compacta"><tbody>
          ${c.apoio.map((a) => `<tr><td>${esc(a.grupo)}</td><td class="n">${a.chRot}</td><td class="n">${num(a.opexQtd)}</td><td class="n">${num(a.opexFte)} FTE</td></tr>`).join('')}
        </tbody></table></details>` : ''}
    </section>`;
  }

  function gruposConhecidos() {
    const g = new Set();
    for (const o of S.opexes) for (const v of o.catalogo.values()) g.add(v);
    for (const o of S.opexes) for (const m of o.meses) for (const k of m.headcount.keys()) g.add(k.split('|')[0]);
    return [...g].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }

  /* ---------- eventos ---------- */
  const zonas = [['#ox-d-drop', '#ox-d-file', (f) => lerDim(f[0])], ['#ox-o-drop', '#ox-o-file', (f) => lerOpex(f)]];
  for (const [zs, fs, fn] of zonas) {
    const z = $(zs), i = $(fs);
    i.addEventListener('change', (ev) => fn([...ev.target.files]));
    ['dragenter', 'dragover'].forEach((t) => z.addEventListener(t, (ev) => { ev.preventDefault(); z.classList.add('over'); }));
    ['dragleave', 'drop'].forEach((t) => z.addEventListener(t, (ev) => { ev.preventDefault(); z.classList.remove('over'); }));
    z.addEventListener('drop', (ev) => { ev.preventDefault(); fn([...ev.dataTransfer.files]); });
  }
  $('#ox-recarregar').addEventListener('click', recalcular);

  /* A área de transferência é o caminho curto: o formato de colar do Excel é
     TSV, então basta o texto — o Excel espalha nas colunas sozinho. Onde a
     API moderna não existir (ou o navegador negar fora de HTTPS), o textarea
     escondido com execCommand ainda funciona. */
  async function copiar(txt) {
    try {
      if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(txt); return true; }
    } catch (e) { /* cai no plano B */ }
    const ta = document.createElement('textarea');
    ta.value = txt;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    ta.remove();
    return ok;
  }

  function baixar(nome, texto, tipo) {
    const url = URL.createObjectURL(new Blob([texto], { type: tipo }));
    const a = document.createElement('a');
    a.href = url; a.download = nome;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  const listaDe = (i) => (S.res && S.res.comparacoes[i] ? S.res.comparacoes[i] : null);

  $('#ox-saida').addEventListener('click', async (ev) => {
    const bc = ev.target.closest('[data-copiar]');
    if (bc) {
      const c = listaDe(+bc.dataset.copiar);
      if (!c || !c.lista) return;
      const ok = await copiar(c.lista.tsv(!c.lista.grade));
      bc.textContent = ok ? 'Copiado!' : 'Não consegui copiar';
      setTimeout(() => { bc.textContent = 'Copiar lista'; }, 2200);
      if (ok) {
        toast(c.lista.grade
          ? `${c.lista.totais.linhas} linhas na área de transferência. Cole na aba <b>${esc(c.lista.onde.aba)}</b>, coluna <b>${esc(c.lista.onde.coluna)}</b>, linha <b>${c.lista.onde.linha}</b> — <b>sem</b> o cabeçalho, que já fica na planilha.`
          : `${c.lista.totais.linhas} linhas copiadas, com cabeçalho.`, 9000);
      }
      return;
    }
    const bb = ev.target.closest('[data-baixar]');
    if (bb) {
      const c = listaDe(+bb.dataset.baixar);
      if (!c || !c.lista) return;
      baixar(`opex-${c.base}-${c.mesOpex}.csv`.replace(/\s+/g, '-').toLowerCase(),
        c.lista.csv(), 'text/csv;charset=utf-8');
      return;
    }
    const bm = ev.target.closest('[data-mais]');
    if (bm) {
      const i = bm.dataset.mais;
      document.querySelectorAll(`[data-extra="${CSS.escape(i)}"]`).forEach((tr) => { tr.hidden = false; });
      bm.remove();
      return;
    }

    const b = ev.target.closest('[data-exp]');
    if (!b) return;
    const chave = b.dataset.exp;
    const abrindo = !b.classList.contains('aberto');
    b.classList.toggle('aberto', abrindo);
    document.querySelectorAll(`.ox-ch[data-de="${CSS.escape(chave)}"]`).forEach((tr) => { tr.hidden = !abrindo; });
  });

  $('#ox-saida').addEventListener('change', async (ev) => {
    const sel = ev.target.closest('.ox-sel');
    if (!sel) return;
    const cargo = sel.dataset.cargo;
    if (sel.value === '__todos') {
      sel.innerHTML = '<option value="">— escolha o grupo —</option>'
        + gruposConhecidos().map((g) => `<option value="${esc(g)}">${esc(g)}</option>`).join('');
      return;
    }
    if (!sel.value) return;
    await gravarDepara(X.norm(cargo), cargo, sel.value);
    recalcular();
    toast(`<b>${esc(cargo)}</b> agora conta em <b>${esc(sel.value)}</b>.`);
  });

  /* ---------- início ---------- */
  carregarDepara().then(() => { if (S.dim && S.opexes.length) recalcular(); else render(); });
}
