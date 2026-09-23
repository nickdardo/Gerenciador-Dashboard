// ══════════════════════════════════════════════════════
// GERADOR DE FOLGAS — aba do Admin
//
// Ferramenta separada da Escala Online, de propósito. A Escala Online monta
// a escala do zero no banco; esta aqui pega uma planilha que já existe, no
// formato próprio de quem a mantém, preenche as folgas e devolve o MESMO
// arquivo com a formatação intacta.
//
// Por que não reaproveita o SheetJS que o painel já carrega: o SheetJS livre
// reescreve a planilha e perde formatação, fórmulas e mesclagens. O motor
// (folgas-engine.js) lê e regrava o zip/XML do .xlsx na mão justamente pra
// alterar só as células dos dias e não tocar em mais nada.
//
// O solver também é diferente: programação dinâmica por colaborador, que
// encontra o ótimo dado o custo de cada dia — enquanto a Escala Online usa
// busca local com múltiplas tentativas. Ver MIGRACAO-GERADOR-FOLGAS.md.
// ══════════════════════════════════════════════════════

// A aba do Admin carrega só um cartão. A ferramenta em si abre sobreposta ao
// painel, numa camada com rolagem própria — a grade de 31 dias renderizada
// dentro da página fazia o navegador refluir o Admin inteiro a cada rolagem.
function adminFolgasTab(el) {
  el.innerHTML = folgasLauncherHTML();
  folgasLauncherMontar();
}

/* ---------------------------------------------------------- cartão da aba */
function folgasLauncherHTML() {
  return `
  <div class="fg-scope fg-wrap fg-launcher">
    <div class="fg-top">
      <div>
        <div class="fg-eyebrow">Escala 6x1 · distribuição automática</div>
        <h2 class="fg-title">Gerador de Folgas</h2>
        <p class="fg-sub">Lê a planilha da escala, preenche as folgas respeitando as regras e devolve o mesmo arquivo com a formatação original. A conferência abre em tela cheia, por cima do painel.</p>
      </div>
      <div class="fg-actions">
        <button class="fg-btn fg-primary" id="fgl-open" type="button">Abrir gerador</button>
      </div>
    </div>

    <label class="fg-drop" id="fgl-drop" for="fgl-file">
      <input type="file" id="fgl-file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet">
      <span class="fg-ico">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="26" height="26"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h6M12 11v8"/></svg>
      </span>
      <span><strong>Solte aqui a escala do mês (.xlsx)</strong>
        <span class="fg-dsub">ou clique para escolher. O arquivo é lido só neste navegador — nada sobe pro banco. Ao terminar de ler, a tela cheia abre sozinha.</span></span>
      <span class="fg-fname" id="fgl-file-name"></span>
    </label>

    <div id="fgl-status" class="fg-lstatus"></div>
  </div>`;
}

// Estado do cartão: reflete o que já está carregado, sem montar a grade.
function folgasLauncherSync() {
  const box = document.getElementById('fgl-status');
  if (!box) return;
  const S = window._fgState;
  if (!S || !S.model || S.sample) { box.innerHTML = ''; return; }
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  let gen = 0, err = 0;
  for (const s of S.model.sheets) for (const b of s.blocks) for (const g of b.groups) for (const e of g.emps) {
    gen += e.gen.filter(Boolean).length + e.manual.filter(Boolean).length;
    err += (e.issues || []).filter((i) => i.lv === 'erro').length;
  }
  box.innerHTML = `
    <div class="stat"><span class="k">Arquivo</span><span class="v" style="font-size:14px">${esc(S.file || '—')}</span></div>
    <div class="stat"><span class="k">Mês</span><span class="v">${esc(S.model.month.label)}</span></div>
    <div class="stat"><span class="k">Colaboradores</span><span class="v">${S.model.empCount}<small>em ${S.model.sheets.length} aba${S.model.sheets.length > 1 ? 's' : ''}</small></span></div>
    <div class="stat"><span class="k">Folgas lançadas</span><span class="v">${gen}</span></div>
    <div class="stat ${err ? 'bad' : ''}"><span class="k">Regras quebradas</span><span class="v">${err}</span></div>`;
}

function folgasLauncherMontar() {
  const drop = document.getElementById('fgl-drop');
  const inp = document.getElementById('fgl-file');
  document.getElementById('fgl-open').addEventListener('click', () => folgasAbrir());
  inp.addEventListener('change', (ev) => { const f = ev.target.files[0]; if (f) folgasAbrir(f); });
  ['dragenter', 'dragover'].forEach((t) => drop.addEventListener(t, (ev) => { ev.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach((t) => drop.addEventListener(t, (ev) => { ev.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', (ev) => { const f = ev.dataTransfer.files[0]; if (f) folgasAbrir(f); });
  folgasLauncherSync();
}

/* ------------------------------------------------- abrir / fechar a camada */
// A camada é construída uma única vez e fica em document.body. Trocar de aba
// no Admin não a desmonta, então a planilha lida e as edições manuais
// sobrevivem — e não se paga o custo de remontar a grade.
function folgasEnsureOverlay() {
  let ov = document.getElementById('fg-overlay');
  if (ov) return ov;
  ov = document.createElement('div');
  ov.id = 'fg-overlay';
  ov.className = 'fg-ov';
  ov.hidden = true;
  ov.setAttribute('role', 'dialog');
  ov.setAttribute('aria-modal', 'true');
  ov.setAttribute('aria-label', 'Gerador de Folgas');
  ov.innerHTML = folgasOverlayHTML();
  document.body.appendChild(ov);
  folgasMontar();
  return ov;
}

function folgasAbrir(file) {
  const ov = folgasEnsureOverlay();
  ov.hidden = false;
  document.body.classList.add('fg-locked');
  if (window._fgRender) window._fgRender();
  if (file && window._fgLoadFile) window._fgLoadFile(file);
  const f = ov.querySelector('.fg-close'); if (f) f.focus();
}

function folgasFechar() {
  const ov = document.getElementById('fg-overlay');
  if (!ov || ov.hidden) return;
  ov.hidden = true;
  document.body.classList.remove('fg-locked');
  folgasLauncherSync();
  const b = document.getElementById('fgl-open'); if (b) b.focus();
}

/* --------------------------------------------------------- conteúdo da camada */
function folgasOverlayHTML() {
  return `
  <div class="fg-scope">
    <header class="fg-bar">
      <div>
        <div class="fg-eyebrow">Escala 6x1 · distribuição automática</div>
        <h2>Gerador de Folgas</h2>
      </div>
      <span class="fg-barmeta" id="fg-file-name"></span>
      <div class="fg-actions">
        <button class="fg-btn" id="fg-btn-regen" type="button" disabled>Gerar de novo</button>
        <button class="fg-btn" id="fg-btn-clear" type="button" disabled>Desfazer minhas edições</button>
        <button class="fg-btn fg-primary" id="fg-btn-dl" type="button" hidden>Baixar Excel preenchido</button>
        <button class="fg-close" id="fg-btn-close" type="button" title="Fechar (Esc)" aria-label="Fechar">&times;</button>
      </div>
    </header>

    <div class="fg-body">
      <div class="fg-main" id="fg-scroll">

    <label class="fg-drop" id="fg-drop" for="fg-file">
      <input type="file" id="fg-file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet">
      <span class="fg-ico">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="26" height="26"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h6M12 11v8"/></svg>
      </span>
      <span><strong>Solte aqui a escala do mês (.xlsx)</strong>
        <span class="fg-dsub">ou clique para escolher. O arquivo é lido só neste navegador — nada sobe pro banco.</span></span>
    </label>
    <div id="fg-note"></div>

    <section class="fg-summary" id="fg-summary" aria-live="polite"></section>

    <details class="fg-rules" id="fg-rules">
      <summary><span class="fg-chev">&#9654;</span> Regras aplicadas <span class="fg-hint" id="fg-rules-hint"></span></summary>
      <div class="fg-rules-body">
        <div class="fg-rule">
          <label for="fg-opt-run">Máximo de dias seguidos trabalhando</label>
          <select id="fg-opt-run" class="adh-month-select">
            <option value="6">6 dias (6x1)</option>
            <option value="5">5 dias (5x1)</option>
            <option value="4">4 dias (4x1)</option>
          </select>
          <p>Conta desde a última folga da semana do mês anterior. Curso (K) conta como dia trabalhado.</p>
        </div>
        <div class="fg-rule">
          <label>Folgas do mês</label>
          <p>Pela tabela de carga horária da própria planilha (CH &rarr; horas máximas &divide; jornada). Ex.: 186h &rarr; no máx. 150h &rarr; 25 dias &rarr; <b>6 folgas</b>. F, FA e L entram na conta.</p>
          <label class="fg-check" for="fg-opt-af"><input type="checkbox" id="fg-opt-af"> AF e CH também contam como folga do mês</label>
        </div>
        <div class="fg-rule">
          <label>Domingo e folga agrupada</label>
          <ul>
            <li>Todo colaborador folga pelo menos 1 domingo.</li>
            <li>Nome dourado: 1 FA no sábado ou na segunda, colada ao domingo de folga.</li>
            <li>Clique no nome para marcar/desmarcar dourado.</li>
          </ul>
        </div>
        <div class="fg-rule" id="fg-rule-unknown" hidden>
          <label>Outros códigos encontrados</label>
          <p>Marque os que são folga (zeram a sequência). Os demais contam como dia trabalhado.</p>
          <div id="fg-unknown-list"></div>
        </div>
      </div>
    </details>

        <nav class="fg-tabs" id="fg-tabs" role="tablist" aria-label="Abas da escala"></nav>
        <div class="fg-blocks" id="fg-sheet"></div>

      </div>
      <aside class="fg-side">
        <div class="fg-panel">
          <h4>Como colar no Excel</h4>
          <ol class="fg-how">
            <li>Clique em <b>Copiar bloco</b> no grupo.</li>
            <li>No Excel, clique na célula indicada no botão (ex.: <b>Q12</b>) — é o dia 1 do primeiro nome.</li>
            <li><b>Ctrl+V</b>. Só as células dos dias mudam.</li>
          </ol>
        </div>
        <div class="fg-panel">
          <h4>Pendências</h4>
          <div id="fg-issues"></div>
        </div>
        <div class="fg-panel">
          <h4>Legenda</h4>
          <div class="fg-legend">
            <span class="fg-sw c-gen">F</span><span>Folga gerada pelo painel</span>
            <span class="fg-sw c-F">F</span><span>Folga que já estava na escala</span>
            <span class="fg-sw c-FA">FA</span><span>Folga agrupada (sáb/seg)</span>
            <span class="fg-sw c-K">K</span><span>Curso — conta como trabalhado</span>
            <span class="fg-sw c-AF">AF</span><span>Folga aniversário</span>
            <span class="fg-sw c-L">L</span><span>Férias</span>
            <span class="fg-sw c-gen c-man">F</span><span>Sua edição manual (fica travada)</span>
            <span class="fg-sw c-man"></span><span>Dia travado como trabalho</span>
          </div>
        </div>
      </aside>
    </div>
  </div>
  <div id="fg-toast" class="fg-toast" role="status" hidden></div>`;
}

// Monta os eventos e redesenha. Chamado toda vez que a aba abre — e o Admin
// recria o DOM a cada troca, então precisa ser idempotente.
function folgasMontar() {

  const E = window.FolgaEngine;
  const $ = (s) => document.querySelector(s);
  // Estado guardado fora da função: trocar de aba no Admin desmonta o DOM,
  // e sem isso a planilha lida e as edições manuais se perderiam a cada ida
  // e volta. Só o DOM é recriado; o modelo continua de pé.
  if (!window._fgState) {
    window._fgState = { wb: null, model: null, st: E.defaultSettings(), tab: 0, file: '', sample: false, open: new Set(), busy: false };
  }
  const S = window._fgState;

  /* ---------- exemplo fictício ---------- */
  function sampleModel() {
    const Y = 2026, M = 9, D = 31;
    const dow = Array.from({ length: D }, (_, i) => new Date(Date.UTC(Y, M, i + 1)).getUTCDay());
    const nomes = ['ANA PAULA MOREIRA', 'BRUNO TEIXEIRA LIMA', 'CAIO FERREIRA DUARTE', 'DANIELA SOUZA PRADO', 'EDSON CARVALHO NUNES', 'FERNANDA LOPES CRUZ',
      'GUSTAVO ALMEIDA REIS', 'HELENA MACHADO VAZ', 'IGOR BARROS MATTOS', 'JULIANA COSTA RAMOS', 'KLEBER MONTEIRO SÁ', 'LARISSA PINTO ARAÚJO',
      'MARCOS VIEIRA CAMPOS', 'NATÁLIA ROCHA DIAS', 'OTÁVIO NEVES PAIVA', 'PRISCILA GOMES LEAL', 'RAFAEL SANTANA BRITO', 'SABRINA MELO FARIAS'];
    let n = 0, row = 9;
    const mk = (gold, prev, fixed) => {
      const f = new Array(D).fill(''); Object.entries(fixed || {}).forEach(([d, c]) => { f[d - 1] = c; });
      const name = nomes[n++ % nomes.length];
      return { id: 'ex!' + row, row: row++, mat: 170100 + n * 7, name, fixed: f, prev, ch: 186, gold, team: 'Exemplo', entrada: '07:00', saida: '13:00',
        gen: new Array(D).fill(''), manual: new Array(D).fill('') };
    };
    const cur = Array.from({ length: D }, (_, i) => 17 + i);
    const g1 = { name: '1º TEMPO', emps: [mk(true, ['F', '', '', '', '', '', ''], {}), mk(false, ['', '', 'F', '', '', '', ''], { 7: 'K', 8: 'K' }), mk(true, ['', '', '', '', 'F', 'FA', ''], {}), mk(false, ['', 'F', '', '', '', '', ''], { 12: 'AF' })] };
    row++;
    const g2 = { name: '2º TEMPO', emps: [mk(false, ['', '', '', 'F', '', '', ''], {}), mk(true, ['', '', '', '', '', '', 'F'], {}), mk(false, ['L', 'L', 'L', 'L', 'L', 'L', 'L'], Object.fromEntries(Array.from({ length: 14 }, (_, i) => [i + 1, 'L']))),
      mk(true, ['', 'F', '', '', '', '', ''], { 21: 'K' }), mk(false, ['F', '', '', '', '', '', ''], {}), mk(true, ['', '', 'F', '', '', '', ''], { 24: 'AF' })] };
    row++;
    const g3 = { name: '3º TEMPO', emps: [mk(false, ['', '', '', '', '', 'F', ''], {}), mk(true, ['', '', '', 'F', '', '', ''], {}), mk(false, ['', '', '', '', '', '', 'F'], { 10: 'F' }), mk(true, ['', 'F', '', '', '', '', ''], {})] };
    const block = { title: 'OPERAÇÃO · EXEMPLO', headerRow: 6, dateRow: 7, cur, prevCols: [9, 10, 11, 12, 13, 14, 15], prevDates: [24, 25, 26, 27, 28, 29, 30], groups: [g1, g2, g3] };
    return { sheets: [{ name: 'EXEMPLO', path: null, chTable: [{ ch: 186, maxH: 150, jorn: 6 }], blocks: [block] }],
      month: { year: Y, month: M, days: D, label: 'outubro/2026', dow }, unknownCodes: [], empCount: 14 };
  }

  /* ---------- util ---------- */
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  let toastT = 0;
  function toast(msg, ms = 4200) { const t = $('#fg-toast'); t.innerHTML = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), ms); }
  const WD = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
  const codeClass = (code) => ({ F: 'c-F', FA: 'c-FA', K: 'c-K', AF: 'c-AF', L: 'c-L', CH: 'c-CH' })[code] || (code ? 'c-X' : '');
  const allEmps = (m) => m.sheets.flatMap((s, si) => s.blocks.flatMap((b) => b.groups.flatMap((g) => g.emps.map((e) => ({ e, s, si, b, g })))));

  function sheetErrors(sheet) { let n = 0; for (const b of sheet.blocks) for (const g of b.groups) for (const e of g.emps) n += e.issues.filter((i) => i.lv === 'erro').length; return n; }

  /* ---------- render ---------- */
  function renderSummary() {
    const m = S.model; if (!m) { $('#fg-summary').innerHTML = ''; return; }
    const rows = allEmps(m);
    let gen = 0, fa = 0, err = 0, warn = 0, spreadMax = 0;
    for (const { e, b, g } of rows) {
      gen += e.gen.filter(Boolean).length + e.manual.filter(Boolean).length;
      fa += e.gen.filter((c) => c === 'FA').length;
      err += e.issues.filter((i) => i.lv === 'erro').length; warn += e.issues.filter((i) => i.lv === 'aviso').length;
    }
    for (const s of m.sheets) for (const b of s.blocks) for (const g of b.groups) {
      const act = g.emps.filter((e) => !e.stat.allL).length; if (act < 3) continue;
      spreadMax = Math.max(spreadMax, Math.max(...g.work) - Math.min(...g.work));
    }
    $('#fg-summary').innerHTML = `
      <div class="stat"><span class="k">Mês</span><span class="v">${esc(m.month.label)}</span></div>
      <div class="stat"><span class="k">Abas · colaboradores</span><span class="v">${m.sheets.length}<small>abas</small> ${m.empCount}<small>pessoas</small></span></div>
      <div class="stat"><span class="k">Folgas lançadas</span><span class="v">${gen}<small>sendo ${fa} FA</small></span></div>
      <div class="stat ${err ? 'bad' : 'good'}"><span class="k">Regras quebradas</span><span class="v">${err}<small>${warn} aviso${warn === 1 ? '' : 's'}</small></span></div>
      <div class="stat"><span class="k">Maior variação/dia</span><span class="v">${spreadMax}<small>pessoa${spreadMax === 1 ? '' : 's'} no grupo</small></span></div>`;
    $('#fg-rules-hint').textContent = `· máx. ${S.st.maxRun} dias seguidos · 1 domingo · FA para dourados`;
  }

  function renderTabs() {
    const m = S.model;
    $('#fg-tabs').innerHTML = m.sheets.map((s, i) => {
      const n = sheetErrors(s);
      return `<button class="tab" role="tab" type="button" data-tab="${i}" aria-selected="${i === S.tab}">${esc(s.name)}<span class="badge ${n ? '' : 'ok'}">${n ? n : '✓'}</span></button>`;
    }).join('');
  }

  function statusPill(e, key) {
    if (e.stat.allL) return `<span class="pill vac">férias</span>`;
    const er = e.issues.filter((i) => i.lv === 'erro').length, w = e.issues.filter((i) => i.lv === 'aviso').length;
    if (!er && !w) return `<span class="pill ok">ok</span>`;
    return `<button type="button" class="pill ${er ? 'err' : 'warn'}" data-toggle="${esc(key)}" aria-expanded="${S.open.has(key)}">${er ? er + ' erro' + (er > 1 ? 's' : '') : w + ' aviso' + (w > 1 ? 's' : '')}</button>`;
  }

  // Uma célula de dia. O <td> é o próprio alvo de clique — a versão anterior
  // punha um <button> dentro de cada um, dobrando os nós justamente na parte
  // mais pesada da tela (31 dias × todo mundo), e o `all:unset` desse botão
  // obrigava o navegador a recalcular estilo de cada célula.
  function cellHTML(e, d, key, dow) {
    const fx = e.fixed[d], man = e.manual[d], gn = e.gen[d];
    const code = fx || (man === '·' ? '' : man) || gn;
    let cls = codeClass(code);
    if (!fx && (man || gn) && code === 'F') cls = 'c-gen';
    if (man) cls += ' c-man';
    const cc = dow[d] === 0 ? 'sun' : dow[d] === 6 ? 'sat' : '';
    const tip = fx ? `${code} já estava na escala` : man === '·' ? 'Travado como trabalho (clique para liberar)'
      : man ? `Sua edição: ${code} (clique para trocar)` : gn ? `${code} gerada — clique para trocar` : 'Clique para lançar F';
    return `<td class="dc ${cc} ${cls} ${fx ? 'locked' : ''}" data-cell="${key}|${d}" title="Dia ${d + 1}: ${tip}"${fx ? ' aria-disabled="true"' : ''}>${esc(code)}</td>`;
  }

  // Rodapé do grupo: quantas pessoas trabalham em cada dia, + a média.
  function workCells(g, D) {
    const lo = Math.min(...g.work), hi = Math.max(...g.work);
    const avg = g.work.reduce((a, b) => a + b, 0) / D;
    let h = '';
    for (let d = 0; d < D; d++) h += `<td class="dc ${hi - lo >= 2 && g.work[d] === lo ? 'lo' : ''}">${g.work[d]}</td>`;
    return h + `<td class="st" colspan="5" style="text-align:left;font-family:var(--f-body);font-weight:500">média ${avg.toFixed(1).replace('.', ',')}</td>`;
  }

  // As 5 colunas de conferência da direita, na ordem em que aparecem.
  function statCells(e, key) {
    const s = e.stat;
    const need = s.allL ? '<span class="dash">—</span>' : `${s.counted}/${s.required}`;
    const sun = s.allL ? '<span class="dash">—</span>' : s.sunOff ? '<span class="tick">✓</span>' : '<span class="cross">✗</span>';
    const fa = !e.gold ? '<span class="dash">·</span>' : s.fa ? '<span class="tick">✓</span>' : '<span class="cross">✗</span>';
    const seqCls = s.maxRun > S.st.maxRun ? 'cross' : '';
    return [need, sun, fa, `<span class="${seqCls}">${s.maxRun}</span>`, statusPill(e, key)];
  }

  function renderSheet() {
    const m = S.model, sheet = m.sheets[S.tab]; if (!sheet) return;
    const D = m.month.days, dow = m.month.dow;
    let html = '';
    sheet.blocks.forEach((b, bi) => {
      const empN = b.groups.reduce((a, g) => a + g.emps.length, 0);
      html += `<section class="block"><div class="block-head"><h2>${esc(b.title)}</h2><span class="meta">${empN} colaboradores · ${b.groups.length} grupo${b.groups.length > 1 ? 's' : ''}</span></div>`;
      b.groups.forEach((g, gi) => {
        const act = g.emps.filter((e) => !e.stat.allL);
        const lo = Math.min(...g.work), hi = Math.max(...g.work);
        const first = g.emps[0];
        const target = E.colName(b.cur[0]) + first.row;
        const lastRow = g.emps[g.emps.length - 1].row;
        const contiguous = lastRow - first.row + 1 === g.emps.length;
        html += `<div class="grp" id="g-${bi}-${gi}"><div class="grp-head"><h3>${esc(g.name)}</h3><span class="n">${g.emps.length} pessoa${g.emps.length > 1 ? 's' : ''}${act.length !== g.emps.length ? ` · ${g.emps.length - act.length} de férias` : ''}</span>
          <span class="spread">trabalhando por dia: <b>${lo}${hi !== lo ? '–' + hi : ''}</b></span>
          ${g.prevUnknown ? `<span class="warnline">Semana do mês anterior em branco — virada não conferida</span>` : ''}
          <span class="copy"><button type="button" class="copy-btn" data-copy="${bi}-${gi}" title="Copia os dias 1–${D} de ${g.emps.length} linha(s)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>
            Copiar bloco · colar em <span class="cell">${sheet.path === null ? 'Q' + first.row : target}</span></button></span>
          ${contiguous ? '' : '<span class="warnline">Linhas não são contínuas na planilha — cole linha a linha</span>'}</div>`;
        html += `<div class="scroller"><table class="grid"><thead><tr><th class="mat">Matr.</th><th class="nm" style="text-align:left;padding-left:8px">Nome</th>`;
        b.prevDates.forEach((d, i) => { html += `<th class="pv ${i === 0 ? 'first' : ''}" title="mês anterior">${d}</th>`; });
        html += `<th class="gap"></th>`;
        for (let d = 0; d < D; d++) html += `<th class="dc ${dow[d] === 0 ? 'sun' : dow[d] === 6 ? 'sat' : ''}"><span class="dn">${d + 1}</span><span class="dw">${WD[dow[d]]}</span></th>`;
        html += `<th class="st" title="Folgas que contam / necessárias">Folgas</th><th class="st" title="Domingo de folga">Dom</th><th class="st" title="Folga agrupada">FA</th><th class="st" title="Maior sequência trabalhada">Seq</th><th class="st status">Situação</th></tr></thead><tbody>`;
        g.emps.forEach((e, ei) => {
          const key = `${S.tab}|${bi}|${gi}|${ei}`;
          html += `<tr class="${e.gold ? 'gold' : ''}" id="r-${esc(key.replace(/\|/g, '-'))}"><td class="mat">${e.mat}</td>
            <td class="nm"><button type="button" class="nm-btn" data-gold="${key}" title="${e.gold ? 'Dourado (tem FA) — clique para desmarcar' : 'Clique para marcar como dourado (FA)'}">
            <svg class="star" viewBox="0 0 24 24" fill="currentColor"><path d="m12 2 3 7 7 .6-5.3 4.7 1.6 7.2L12 17.8 5.7 21.5l1.6-7.2L2 9.6 9 9z"/></svg><span>${esc(e.name)}</span></button>
            ${e.entrada ? `<span class="hr">${e.entrada}–${e.saida}${e.ch ? ' · ' + e.ch + 'h' : ''}</span>` : ''}</td>`;
          e.prev.forEach((c, i) => { html += `<td class="pv ${i === 0 ? 'first' : ''}"><span class="${codeClass(c)}">${esc(c)}</span></td>`; });
          html += `<td class="gap"></td>`;
          for (let d = 0; d < D; d++) html += cellHTML(e, d, key, dow);
          const sc = statCells(e, key);
          html += `<td class="st">${sc[0]}</td><td class="st sm">${sc[1]}</td><td class="st sm">${sc[2]}</td><td class="st sm">${sc[3]}</td><td class="st status">${sc[4]}</td></tr>`;
          if (S.open.has(key) && e.issues.length) {
            html += `<tr class="issue-row"><td colspan="${2 + b.prevDates.length + 1 + D + 5}"><ul style="margin:0;padding-left:16px">${e.issues.map((i) => `<li><span class="lv-${i.lv}">${i.lv}</span> · ${esc(i.t)}</li>`).join('')}</ul></td></tr>`;
          }
        });
        html += `<tr class="work" id="w-${bi}-${gi}"><td class="mat"></td><td class="nm">Trabalhando no dia</td>${b.prevDates.map((_, i) => `<td class="pv ${i === 0 ? 'first' : ''}"></td>`).join('')}<td class="gap"></td>${workCells(g, D)}</tr>`;
        html += `</tbody></table></div></div>`;
      });
      html += `</section>`;
    });
    $('#fg-sheet').innerHTML = html;
  }

  function renderIssues() {
    const m = S.model; if (!m) { $('#fg-issues').innerHTML = ''; return; }
    const items = [];
    m.sheets.forEach((s, si) => s.blocks.forEach((b, bi) => b.groups.forEach((g, gi) => g.emps.forEach((e, ei) => {
      for (const i of e.issues) if (i.lv !== 'info') items.push({ si, key: `${si}|${bi}|${gi}|${ei}`, sheet: s.name, e, i });
    }))));
    items.sort((a, b) => (a.i.lv === 'erro' ? 0 : 1) - (b.i.lv === 'erro' ? 0 : 1));
    if (!items.length) { $('#fg-issues').innerHTML = `<p class="empty-ok">Tudo dentro das regras em todas as abas.</p>`; return; }
    $('#fg-issues').innerHTML = `<div class="issues">${items.slice(0, 200).map((x) =>
      `<button type="button" class="${x.i.lv === 'erro' ? 'e' : 'w'}" data-jump="${x.key}"><span class="who">${esc(x.e.name)}</span><span class="what">${esc(x.sheet)} · ${esc(x.i.t)}</span></button>`).join('')}</div>`;
  }

  function renderUnknown() {
    const m = S.model; const box = $('#fg-rule-unknown');
    if (!m || !m.unknownCodes.length) { box.hidden = true; return; }
    box.hidden = false;
    $('#fg-unknown-list').innerHTML = m.unknownCodes.map((c) =>
      `<label class="check" for="unk-${esc(c)}"><input type="checkbox" id="unk-${esc(c)}" data-unk="${esc(c)}" ${S.st.offCodes.includes(c) ? 'checked' : ''}> <b>${esc(c)}</b> é folga</label>`).join('');
  }

  function renderAll() {
    const has = !!S.model;
    $('#fg-btn-regen').disabled = !has; $('#fg-btn-clear').disabled = !has || !allEmps(S.model).some(({ e }) => e.manual.some(Boolean));
    $('#fg-btn-dl').hidden = !S.wb;
    renderSummary(); if (!has) return;
    renderTabs(); renderSheet(); renderIssues(); renderUnknown();
  }

  // Editar um dia mexe em: a célula, as 5 colunas de conferência da linha e o
  // rodapé do grupo. Nada mais. Antes, cada clique reconstruía o innerHTML da
  // planilha inteira — com muitos grupos, meio segundo de tela travada por
  // clique. A validação continua rodando no modelo todo (é barata); só o
  // desenho é que ficou restrito ao que mudou.
  function atualizarCelula(key, d) {
    const [si, bi, gi, ei] = key.split('|').map(Number);
    if (si !== S.tab) { renderAll(); return; }
    const { b, g, e } = findEmp(key);
    const dow = S.model.month.dow, D = S.model.month.days;

    const td = document.querySelector(`[data-cell="${key}|${d}"]`);
    if (!td) { renderAll(); return; }
    td.outerHTML = cellHTML(e, d, key, dow);

    const row = document.getElementById('r-' + key.replace(/\|/g, '-'));
    if (row) {
      const sts = row.querySelectorAll('td.st');
      const sc = statCells(e, key);
      for (let i = 0; i < sts.length && i < sc.length; i++) sts[i].innerHTML = sc[i];
    }

    const wrow = document.getElementById(`w-${bi}-${gi}`);
    if (wrow) {
      const fixas = 2 + b.prevDates.length + 1; // matrícula, nome, mês anterior, respiro
      const antes = Array.from(wrow.children).slice(0, fixas).map((n) => n.outerHTML).join('');
      wrow.innerHTML = antes + workCells(g, D);
    }
    const sp = document.querySelector(`#g-${bi}-${gi} .spread b`);
    if (sp) { const lo = Math.min(...g.work), hi = Math.max(...g.work); sp.textContent = lo + (hi !== lo ? '–' + hi : ''); }

    renderSummary(); renderIssues(); renderTabs();
    $('#fg-btn-clear').disabled = !allEmps(S.model).some(({ e: x }) => x.manual.some(Boolean));
  }

  /* ---------- ações ---------- */
  function run(fn) {
    if (S.busy) return; S.busy = true;
    const b = $('#fg-btn-regen'); const old = b.innerHTML; b.innerHTML = '<span class="spin"></span> Gerando…';
    setTimeout(() => { try { fn(); } catch (err) { showError(err); } finally { S.busy = false; b.innerHTML = old; renderAll(); } }, 30);
  }
  const regenerate = () => run(() => E.generate(S.model, S.st, { passes: 4 }));

  function showError(err) {
    console.error(err);
    $('#fg-note').innerHTML = `<div class="err-note">Não consegui ler esse arquivo: ${esc(err.message || err)}. Confira se é o .xlsx da escala (não .xls nem .xlsb).</div>`;
  }

  async function loadFile(file) {
    if (!file) return;
    $('#fg-file-name').innerHTML = `<span class="busy"><span class="spin"></span> lendo ${esc(file.name)}…</span>`;
    try {
      const buf = await file.arrayBuffer();
      const wb = await E.loadWorkbook(buf);
      const model = E.buildModel(wb);
      S.wb = wb; S.model = model; S.file = file.name; S.sample = false; S.tab = 0; S.open.clear();
      S.st.offCodes = [];
      $('#fg-note').innerHTML = '';
      $('#fg-file-name').textContent = file.name;
      E.generate(model, S.st, { passes: 4 });
      renderAll();
      const fn = document.getElementById('fgl-file-name'); if (fn) fn.textContent = file.name;
      folgasLauncherSync();
      toast(`Escala de ${model.month.label} lida: ${model.sheets.length} abas, ${model.empCount} colaboradores. Folgas geradas.`);
    } catch (err) { $('#fg-file-name').textContent = ''; showError(err); }
  }

  function findEmp(key) {
    const [si, bi, gi, ei] = key.split('|').map(Number);
    const sheet = S.model.sheets[si], b = sheet.blocks[bi], g = b.groups[gi];
    return { sheet, b, g, e: g.emps[ei] };
  }

  async function copyGroup(bi, gi, btn) {
    const sheet = S.model.sheets[S.tab], b = sheet.blocks[bi], g = b.groups[gi];
    const tsv = E.groupTSV(S.model, g);
    const target = E.colName(b.cur[0]) + g.emps[0].row;
    const ok = () => {
      btn.classList.add('done'); setTimeout(() => btn.classList.remove('done'), 1800);
      toast(`Copiado: ${g.emps.length} linha${g.emps.length > 1 ? 's' : ''} × ${S.model.month.days} dias. No Excel, aba <b>${esc(sheet.name)}</b>, clique em <b>${target}</b> e cole (Ctrl+V).`, 6500);
    };
    try { await navigator.clipboard.writeText(tsv); ok(); }
    catch (_) {
      const host = btn.closest('.grp');
      let fb = host.querySelector('.fallback');
      if (!fb) { fb = document.createElement('div'); fb.className = 'fallback'; fb.style.padding = '0 16px 12px'; host.querySelector('.grp-head').after(fb); }
      fb.innerHTML = `<span style="font-size:13px;color:var(--ink-2)">O navegador bloqueou a cópia automática. O texto abaixo já está selecionado — use Ctrl+C e cole em <b>${target}</b>.</span><textarea id="fb-${bi}-${gi}" readonly></textarea>`;
      const ta = fb.querySelector('textarea'); ta.value = tsv; ta.focus(); ta.select();
    }
  }

  // Download nativo. O projeto original usava a API de downloads dos artifacts, que só
  // existe dentro de um artifact — no painel publicado isso não existe, e a
  // tela ficava sem o botão principal. Aqui é Blob + link, igual ao resto do
  // painel faz com Excel.
  async function download() {
    try {
      const blob = await E.buildXlsx(S.wb, S.model);
      const nome = S.file.replace(/\.xlsx$/i, '') + ' - FOLGAS.xlsx';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = nome;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      toast('Arquivo baixado. Ao abrir, o Excel recalcula as contagens sozinho.');
    } catch (err) {
      toast('Não foi possível baixar: ' + esc(err && (err.message || err.code) || err));
    }
  }

  /* ---------- eventos ---------- */
  const drop = $('#fg-drop');
  $('#fg-file').addEventListener('change', (ev) => loadFile(ev.target.files[0]));
  ['dragenter', 'dragover'].forEach((t) => drop.addEventListener(t, (ev) => { ev.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach((t) => drop.addEventListener(t, (ev) => { ev.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', (ev) => { const f = ev.dataTransfer.files[0]; if (f) loadFile(f); });

  $('#fg-tabs').addEventListener('click', (ev) => {
    const t = ev.target.closest('[data-tab]'); if (!t) return;
    S.tab = +t.dataset.tab; renderTabs(); renderSheet();
  });

  $('#fg-sheet').addEventListener('click', (ev) => {
    const c = ev.target.closest('[data-cell]');
    if (c) {
      const parts = c.dataset.cell.split('|'); const d = +parts.pop();
      const { e } = findEmp(parts.join('|'));
      if (e.fixed[d]) { toast(`Dia ${d + 1} já veio preenchido na planilha (${e.fixed[d]}) — edite no Excel se precisar.`); return; }
      const man = e.manual[d], shown = man || e.gen[d];
      let next;
      if (man === '·') next = '';
      else if (shown === '') next = 'F';
      else if (shown === 'F') next = e.gold ? 'FA' : '·';
      else next = '·';
      e.manual[d] = next; e.gen[d] = '';
      E.validate(S.model, S.st);
      atualizarCelula(parts.join('|'), d);
      toast(next === '' ? `Dia ${d + 1} liberado para o gerador.` : next === '·' ? `Dia ${d + 1} travado como trabalho — "Gerar de novo" não põe folga aqui.` : `Dia ${d + 1}: ${next} travado. Use "Gerar de novo" para reequilibrar o resto.`, 3000);
      return;
    }
    const gb = ev.target.closest('[data-gold]');
    if (gb) { const { e } = findEmp(gb.dataset.gold); e.gold = !e.gold; regenerate(); return; }
    const tg = ev.target.closest('[data-toggle]');
    if (tg) { const k = tg.dataset.toggle; S.open.has(k) ? S.open.delete(k) : S.open.add(k); renderSheet(); return; }
    const cp = ev.target.closest('[data-copy]');
    if (cp) { const [bi, gi] = cp.dataset.copy.split('-').map(Number); copyGroup(bi, gi, cp); }
  });

  $('#fg-issues').addEventListener('click', (ev) => {
    const j = ev.target.closest('[data-jump]'); if (!j) return;
    const key = j.dataset.jump; const si = +key.split('|')[0];
    S.tab = si; S.open.add(key); renderTabs(); renderSheet();
    const row = document.getElementById('r-' + key.replace(/\|/g, '-'));
    if (row) { row.scrollIntoView({ behavior: 'smooth', block: 'center' }); row.classList.add('flash'); setTimeout(() => row.classList.remove('flash'), 1700); }
  });

  $('#fg-btn-regen').addEventListener('click', regenerate);
  $('#fg-btn-clear').addEventListener('click', () => {
    for (const { e } of allEmps(S.model)) e.manual.fill('');
    regenerate();
  });
  $('#fg-btn-dl').addEventListener('click', download);
  $('#fg-opt-run').addEventListener('change', (ev) => { S.st.maxRun = +ev.target.value; regenerate(); });
  $('#fg-opt-af').addEventListener('change', (ev) => { S.st.afCounts = ev.target.checked; regenerate(); });
  $('#fg-unknown-list').addEventListener('change', (ev) => {
    const c = ev.target.dataset.unk; if (!c) return;
    S.st.offCodes = ev.target.checked ? [...new Set([...S.st.offCodes, c])] : S.st.offCodes.filter((x) => x !== c);
    regenerate();
  });

  $('#fg-btn-close').addEventListener('click', folgasFechar);
  document.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Escape') return;
    const ov = document.getElementById('fg-overlay');
    if (ov && !ov.hidden) { ev.preventDefault(); folgasFechar(); }
  });

  /* ---------- ganchos usados pelo cartão da aba ---------- */
  // renderAll é caro; o cartão chama isto só quando a camada abre, e o
  // carregamento de arquivo entra por aqui quando o arquivo foi solto lá fora.
  window._fgRender = renderAll;
  window._fgLoadFile = loadFile;

  /* ---------- início ---------- */
  // Só monta o exemplo se ainda não há planilha lida. Antes isso rodava
  // sempre, e voltar na aba do Admin apagava o arquivo do usuário.
  if (!S.model) {
    S.model = sampleModel(); S.sample = true;
    E.generate(S.model, S.st, { passes: 4 });
    $('#fg-note').innerHTML = `<div class="sample-note"><b>Exemplo com nomes fictícios.</b> Solte a sua escala acima para gerar as folgas de todas as abas.</div>`;
  }
  renderAll();
}
