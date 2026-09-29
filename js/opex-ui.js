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
    box.innerHTML = comparacoes.map(cartao).join('')
      + (avisos.length ? `<details class="fg-cur-bloco aviso"><summary>Avisos da leitura <b>${avisos.length}</b></summary>
          <ul>${avisos.map((a) => `<li>${esc(a.t)}</li>`).join('')}</ul></details>` : '');
  }

  function cartao(c) {
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

  $('#ox-saida').addEventListener('click', (ev) => {
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
