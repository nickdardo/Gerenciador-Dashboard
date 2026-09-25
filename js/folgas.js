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
  // Três entradas, na ordem em que o trabalho acontece. Os passos 1 e 3 são
  // caminhos alternativos para a mesma coisa — os cursos do mês —, e por isso
  // os dois são opcionais: um serve para quando as datas ainda estão abertas,
  // o outro para quando já estão fechadas. Só a escala é obrigatória.
  // ids preservados: o resto do módulo já conversa com eles
  const passo = (n, ids, tit, selo, txt, sub, icone) => `
    <label class="fg-passo ${selo === 'obrigatório' ? 'req' : ''}" id="${ids.drop}" for="${ids.file}">
      <input type="file" id="${ids.file}" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet">
      <span class="fg-passo-n">${n}</span>
      <span class="fg-passo-txt">
        <span class="fg-passo-tit">${tit}<em class="fg-selo ${selo === 'obrigatório' ? 'req' : ''}">${selo}</em></span>
        <span class="fg-passo-desc">${txt}</span>
        <span class="fg-passo-drop">${icone}<b>Solte o arquivo aqui</b> ou clique para escolher<span class="fg-passo-sub">${sub}</span></span>
      </span>
      <span class="fg-passo-ok" id="${ids.nome}"></span>
    </label>`;

  const icoCal = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v4M16 2v4M3 10h18"/><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M8 14h3M8 18h6"/></svg>`;
  const icoDoc = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h6M12 11v8"/></svg>`;
  const icoLista = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5a2 2 0 0 1 2-2h11l3 3v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><path d="M8 7h6M8 11h8M8 15h5"/></svg>`;

  return `
  <div class="fg-scope fg-wrap fg-launcher">
    <div class="fg-top">
      <div>
        <div class="fg-eyebrow">Escala 6x1 · distribuição automática</div>
        <h2 class="fg-title">Gerador de Folgas</h2>
      </div>
      <div class="fg-actions">
        <button class="fg-btn fg-primary" id="fgl-open" type="button">Abrir gerador</button>
      </div>
    </div>

    <div class="fg-como">
      <h3>Como funciona</h3>
      <p>A escala é a base de tudo — sem ela o painel não tem o que distribuir. Os cursos entram de duas maneiras,
         e você usa a que combinar com o seu mês:</p>
      <div class="fg-como-vias">
        <div class="fg-via">
          <span class="fg-via-n">Ainda escolhendo as datas</span>
          Suba a <b>programação</b> no passo 1 junto com a escala. O painel propõe as datas que menos
          afetam a operação, você confere e baixa a planilha preenchida.
        </div>
        <div class="fg-via">
          <span class="fg-via-n">Datas já fechadas</span>
          Pule o passo 1 e suba o <b>arquivo de cursos</b> no passo 3, com as datas que você já recebeu.
        </div>
      </div>
      <p class="fg-como-fim">Nos dois caminhos o fim é o mesmo: o gerador lança os cursos como <b>K</b> e
         distribui as folgas em volta deles, respeitando 6x1, domingo único e a meta do mês.</p>
    </div>

    ${passo(1, { drop: 'fgl-pdrop', file: 'fgl-pfile', nome: 'fgl-pfile-name' }, 'Programação de cursos', 'opcional',
      'A planilha com as abas <b>CURSOS</b> e <b>JANELAS</b>, com a coluna DATA em branco no que você quer que o painel resolva. Linha que já tiver data fica travada.',
      'Só isto não gera nada — é preciso a escala do passo 2 para medir o impacto.', icoCal)}

    ${passo(2, { drop: 'fgl-drop', file: 'fgl-file', nome: 'fgl-file-name' }, 'Escala do mês', 'obrigatório',
      'A planilha da escala, como ela já é hoje. O arquivo é lido só neste navegador — nada sobe pro banco.',
      'Ao terminar de ler, a tela cheia abre sozinha.', icoDoc)}

    ${passo(3, { drop: 'fgl-cdrop', file: 'fgl-cfile', nome: 'fgl-cfile-name' }, 'Cursos do mês', 'opcional',
      'O arquivo com as datas já decididas — o que você recebe pronto, ou a programação que baixou no passo 1. Dele só leio <b>matrícula</b> e <b>data</b>.',
      'Pode carregar antes ou depois da escala.', icoLista)}

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

  // Cursos: não abre a tela cheia sozinho. Guarda o arquivo e, se a escala já
  // estiver carregada, aplica na hora; senão espera a escala chegar.
  const cdrop = document.getElementById('fgl-cdrop');
  const cinp = document.getElementById('fgl-cfile');
  const pegar = (f) => { if (f) folgasCarregarCursos(f); };
  cinp.addEventListener('change', (ev) => pegar(ev.target.files[0]));
  ['dragenter', 'dragover'].forEach((t) => cdrop.addEventListener(t, (ev) => { ev.preventDefault(); cdrop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach((t) => cdrop.addEventListener(t, (ev) => { ev.preventDefault(); cdrop.classList.remove('over'); }));
  cdrop.addEventListener('drop', (ev) => { ev.preventDefault(); pegar(ev.dataTransfer.files[0]); });

  const pdrop = document.getElementById('fgl-pdrop');
  const pinp = document.getElementById('fgl-pfile');
  const pegarP = (f) => { if (f) folgasCarregarProgramacao(f); };
  pinp.addEventListener('change', (ev) => pegarP(ev.target.files[0]));
  ['dragenter', 'dragover'].forEach((t) => pdrop.addEventListener(t, (ev) => { ev.preventDefault(); pdrop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach((t) => pdrop.addEventListener(t, (ev) => { ev.preventDefault(); pdrop.classList.remove('over'); }));
  pdrop.addEventListener('drop', (ev) => { ev.preventDefault(); pegarP(ev.dataTransfer.files[0]); });

  folgasLauncherSync();
}

function folgasCarregarProgramacao(file) {
  folgasEnsureOverlay();
  if (window._fgLoadProg) window._fgLoadProg(file);
}

// Ponto de entrada do arquivo de cursos, usado pelo cartão e pela camada.
// A camada precisa existir porque é lá que moram o parser e o estado.
function folgasCarregarCursos(file) {
  folgasEnsureOverlay();
  if (window._fgLoadCursos) window._fgLoadCursos(file);
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
        <button class="fg-btn" id="fg-btn-plan" type="button" title="Planejar as datas dos cursos">Planejar cursos…<input type="file" id="fg-pfile" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden></button>
        <button class="fg-btn" id="fg-btn-cursos" type="button" title="Carregar o arquivo mensal de cursos">Cursos…<input type="file" id="fg-cfile" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden></button>
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
            <li>Todo colaborador folga <b>exatamente 1 domingo</b> no mês — nem nenhum, nem dois. Um segundo domingo é erro, mesmo que já venha lançado na planilha. Domingo dentro das férias (L) não conta: quem estava de férias não gastou o domingo dele.</li>
            <li>Nome dourado: 1 FA no sábado ou na segunda, colada ao domingo de folga.</li>
            <li>O FA <b>entra na conta das folgas do mês</b>, mas <b>não quebra a sequência</b> de dias trabalhados: ele é o dia extra colado no descanso, não o descanso em si. A sequência é medida de folga a folga, e o próprio dia de FA entra nela.</li>
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

        <div class="fg-panels">
          <div class="fg-panel">
            <h4>Como colar no Excel</h4>
            <ol class="fg-how">
              <li>Clique em <b>Copiar bloco</b> no grupo.</li>
              <li>No Excel, clique na célula indicada no botão (ex.: <b>Q12</b>) — é o dia 1 do primeiro nome.</li>
              <li><b>Ctrl+V</b>. Só as células dos dias daquelas linhas mudam.</li>
            </ol>
          </div>
          <div class="fg-panel">
            <h4>Pendências</h4>
            <div id="fg-issues"></div>
          </div>
          <div class="fg-panel fg-panel-larga" id="fg-panel-plano" hidden>
            <h4>Plano de cursos</h4>
            <div id="fg-plano"></div>
          </div>
          <div class="fg-panel" id="fg-panel-cursos" hidden>
            <h4>Cursos do mês</h4>
            <div id="fg-cursos"></div>
          </div>
          <div class="fg-panel">
            <h4>Legenda</h4>
            <div class="fg-legend">
              <span class="fg-sw c-gen">F</span><span>Folga gerada pelo painel</span>
              <span class="fg-sw c-F">F</span><span>Folga que já estava na escala</span>
              <span class="fg-sw c-FA">FA</span><span>Folga agrupada (sáb/seg) — não quebra o 6x1</span>
              <span class="fg-sw c-K">K</span><span>Curso — conta como trabalhado</span>
              <span class="fg-sw c-K c-curso">K</span><span>Curso vindo do arquivo de cursos</span>
              <span class="fg-sw c-AF">AF</span><span>Folga aniversário</span>
              <span class="fg-sw c-L">L</span><span>Férias</span>
              <span class="fg-sw c-gen c-man">F</span><span>Sua edição manual (fica travada)</span>
              <span class="fg-sw c-man"></span><span>Dia travado como trabalho</span>
            </div>
          </div>
        </div>

        <nav class="fg-tabs" id="fg-tabs" role="tablist" aria-label="Abas da escala"></nav>
        <div class="fg-blocks" id="fg-sheet"></div>
      </div>
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
    window._fgState = { wb: null, model: null, st: E.defaultSettings(), tab: 0, file: '', sample: false, open: new Set(), busy: false, cursos: null, cursosFile: '', prog: null, progFile: '', plano: null };
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
    $('#fg-rules-hint').textContent = `· máx. ${S.st.maxRun} dias seguidos · exatamente 1 domingo · FA para dourados (não quebra a sequência)`;
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
    // K vindo do arquivo de cursos ganha marca própria: assim dá para
    // distinguir o que o painel lançou do que já estava na planilha.
    const doCurso = e.curso && e.curso.has(d);
    if (doCurso) cls += ' c-curso';
    const cc = dow[d] === 0 ? 'sun' : dow[d] === 6 ? 'sat' : '';
    const orig = doCurso && e._fixed0 ? e._fixed0[d] : '';
    const tip = doCurso ? (orig && orig !== 'K'
        ? `curso lançado pelo arquivo — este dia tinha ${orig}, a folga foi remanejada`
        : 'curso lançado pelo arquivo de cursos')
      : fx ? `${code} já estava na escala` : man === '·' ? 'Travado como trabalho (clique para liberar)'
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
    // Dom: ✓ = exatamente 1 domingo. Mais de um é erro, então mostra quantos
    // em vez de um visto — senão dois domingos passariam como "certo".
    const sun = s.allL ? '<span class="dash">—</span>'
      : s.sun > 1 ? `<span class="cross">${s.sun}</span>`
      : s.sunOff ? '<span class="tick">✓</span>' : '<span class="cross">✗</span>';
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
        html += `<th class="st" title="Folgas que contam / necessárias">Folgas</th><th class="st sm" title="Domingos de folga — o certo é exatamente 1 por mês">Dom</th><th class="st sm" title="Folga agrupada">FA</th><th class="st sm" title="Maior sequência trabalhada (o FA não quebra a sequência)">Seq</th><th class="st status">Situação</th></tr></thead><tbody>`;
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

  // Relatório dos cursos. A parte que mais importa não é o que entrou, e sim
  // o que ficou de fora: linha sem data, data de outro mês, matrícula que não
  // existe na escala e curso marcado em dia de férias. Cada uma dessas some
  // em silêncio se não for mostrada com nome e dia.
  function renderCursos() {
    const box = $('#fg-cursos'), painel = $('#fg-panel-cursos');
    if (!S.cursos) { painel.hidden = true; box.innerHTML = ''; return; }
    painel.hidden = false;
    const rel = S.model && !S.sample ? S.model.cursos : null;
    const dia = (d) => d + 1;

    const lista = (titulo, itens, linha, cls) => itens.length
      ? `<details class="fg-cur-bloco ${cls || ''}"><summary>${esc(titulo)} <b>${itens.length}</b></summary>
         <ul>${itens.slice(0, 60).map(linha).join('')}${itens.length > 60 ? `<li class="mais">… e mais ${itens.length - 60}</li>` : ''}</ul></details>`
      : '';

    if (!rel) {
      box.innerHTML = `<p class="fg-cur-head"><b>${S.cursos.regs.length}</b> lançamentos lidos de <span class="arq">${esc(S.cursosFile || 'arquivo')}</span>.</p>
        <p class="fg-cur-esperando">Solte a escala do mês para eu cruzar as matrículas e lançar os K.</p>
        ${lista('Linhas sem data utilizável', S.cursos.semData, (r) => `<li><b>${r.mat}</b> · ${esc(r.curso)} · linha ${r.linha} → ${esc(r.texto || 'vazio')}</li>`, 'aviso')}`;
      return;
    }

    box.innerHTML = `
      <p class="fg-cur-head"><b>${rel.aplicados}</b> K lançados para <b>${rel.pessoas}</b> pessoa(s)
        <span class="arq">${esc(S.cursosFile || '')}</span></p>
      <button type="button" class="fg-cur-limpar" id="fg-cur-limpar">Remover os cursos</button>
      ${lista('Folgas remanejadas pelo curso', rel.remanejadas,
        (x) => `<li><b>${x.e.mat}</b> ${esc(x.e.name)} · dia ${dia(x.d)} tinha ${x.atual} → virou K</li>`, 'ok')}
      ${lista('Curso em dia de férias — não mexi', rel.ferias,
        (x) => `<li><b>${x.e.mat}</b> ${esc(x.e.name)} · dia ${dia(x.d)} está de férias (${esc(x.reg.curso)})</li>`, 'erro')}
      ${lista('Dia já ocupado por outro código', rel.ocupados,
        (x) => `<li><b>${x.e.mat}</b> ${esc(x.e.name)} · dia ${dia(x.d)} tem ${esc(x.atual)}</li>`, 'aviso')}
      ${lista('Matrícula não encontrada na escala', rel.naoEncontrados,
        (x) => `<li><b>${x.mat}</b> ${esc(x.nome)} · ${x.dias} data(s)</li>`, 'aviso')}
      ${lista('Data de outro mês — ignorada', rel.foraDoMes,
        (r) => `<li><b>${r.mat}</b> ${esc(r.nome)} · ${r.data.toLocaleDateString('pt-BR', { timeZone: 'UTC' })} (${esc(r.curso)})</li>`, 'aviso')}
      ${lista('Linha sem data utilizável — ignorada', rel.semData,
        (r) => `<li><b>${r.mat}</b> ${esc(r.nome)} · ${esc(r.curso)} · linha ${r.linha} → ${esc(r.texto || 'vazio')}</li>`, 'aviso')}`;
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
    renderTabs(); renderSheet(); renderIssues(); renderUnknown(); renderCursos(); renderPlano();
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
      // Se os cursos já tinham sido carregados, entram agora — a ordem entre
      // os dois arquivos não importa.
      const rel = S.cursos ? E.aplicarCursos(model, S.cursos, S.st) : null;
      if (S.prog) { try { planejar(); } catch (_) { /* relatado na tela */ } }
      renderAll();
      const fn = document.getElementById('fgl-file-name'); if (fn) fn.textContent = file.name;
      folgasLauncherSync();
      toast(`Escala de ${model.month.label} lida: ${model.sheets.length} abas, ${model.empCount} colaboradores. Folgas geradas.`
        + (rel ? ` ${rel.aplicados} curso(s) lançados como K.` : ''));
    } catch (err) { $('#fg-file-name').textContent = ''; showError(err); }
  }

  /* ---------- cursos ---------- */
  async function loadCursosFile(file) {
    if (!file) return;
    const nome = (el) => { const n = document.getElementById(el); if (n) n.textContent = file.name; };
    try {
      const buf = await file.arrayBuffer();
      S.cursos = await E.loadCursos(buf);
      S.cursosFile = file.name;
      nome('fgl-cfile-name');
      if (!S.model || S.sample) {
        renderCursos();
        toast(`Cursos lidos: ${S.cursos.regs.length} lançamentos. Agora solte a escala do mês para eu aplicar os K.`, 6000);
        folgasLauncherSync();
        return;
      }
      const rel = E.aplicarCursos(S.model, S.cursos, S.st);
      renderAll();
      folgasLauncherSync();
      const extras = [];
      if (rel.remanejadas.length) extras.push(`${rel.remanejadas.length} folga(s) remanejada(s)`);
      if (rel.ferias.length) extras.push(`${rel.ferias.length} em férias (não mexi)`);
      toast(`${rel.aplicados} curso(s) lançados como K para ${rel.pessoas} pessoa(s).`
        + (extras.length ? ' ' + extras.join(' · ') + '.' : '') + ' Veja o painel "Cursos do mês".', 7000);
    } catch (err) {
      console.error(err);
      $('#fg-note').innerHTML = `<div class="err-note">Não consegui ler o arquivo de cursos: ${esc(err.message || err)}. Ele precisa ter as colunas <b>MATRÍCULA</b> e <b>DATA</b>.</div>`;
    }
  }

  /* ---------- planejamento de cursos ---------- */
  const PL = () => window.PlanejadorCursos;

  async function loadProgFile(file) {
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      const dias = S.model && !S.sample ? S.model.month.days : 31;
      S.prog = await PL().lerProgramacao(buf, dias);
      S.progFile = file.name;
      const n = document.getElementById('fgl-pfile-name'); if (n) n.textContent = file.name;
      if (!S.model || S.sample) {
        S.plano = null; renderPlano();
        toast(`Programação lida: ${S.prog.linhas.length} inscrições. Agora solte a escala do mês para eu planejar as datas.`, 6000);
        return;
      }
      planejar();
    } catch (err) {
      console.error(err);
      $('#fg-note').innerHTML = `<div class="err-note">Não consegui ler a programação: ${esc(err.message || err)}. Use o modelo com as abas <b>CURSOS</b> e <b>JANELAS</b>.</div>`;
    }
  }

  function planejar() {
    if (!S.prog || !S.model || S.sample) return;
    run(() => {
      const plano = PL().planejar(S.model, S.prog, { tentativas: 6 });
      // "antes": como sairia marcando cada um na primeira data livre do curso.
      // As linhas que já vinham com data ficam onde estão nos dois lados —
      // sem isso a comparação ignora as travadas e o "antes" parece melhor
      // do que é.
      const naMao = PL().medir(S.model, plano.itens
        .map((i) => ({ emp: i.e, dia: i.travado ? i.dia : (i.cands.length ? i.cands[0] : null) }))
        .filter((x) => x.dia !== null));
      const agora = PL().medir(S.model, plano.itens.filter((i) => i.dia !== null).map((i) => ({ emp: i.e, dia: i.dia })));
      S.plano = { plano, naMao, agora };
    });
  }

  function renderPlano() {
    const box = $('#fg-plano'), painel = $('#fg-panel-plano');
    if (!S.prog) { painel.hidden = true; box.innerHTML = ''; return; }
    painel.hidden = false;
    if (!S.plano) {
      box.innerHTML = `<p class="fg-cur-head"><b>${S.prog.linhas.length}</b> inscrições lidas de <span class="arq">${esc(S.progFile)}</span></p>
        <p class="fg-cur-esperando">Solte a escala do mês para eu planejar as datas.</p>`;
      return;
    }
    const { plano, naMao, agora } = S.plano;
    const M = plano.metricas, mm = S.model.month;
    const noLimite = M.pico.pessoas <= M.picoFixo;
    const pct = (v) => (v * 100).toFixed(0) + '%';
    const max = Math.max(1, ...plano.porDia.map((p) => p.pessoas));

    const barras = plano.porDia.map((p, d) => {
      const fds = mm.dow[d] === 0 || mm.dow[d] === 6;
      if (!p.pessoas && fds) return '';
      const q = plano.queda[d] ? plano.queda[d].pct : 0;
      const alerta = q >= 0.5 ? ' alto' : q >= 0.3 ? ' medio' : '';
      return `<div class="fg-pl-dia${alerta}" title="Dia ${d + 1}: ${p.pessoas} pessoa(s) fora${p.externos ? ' · ' + p.externos + ' de curso externo' : ''}${q ? ' · pior queda de cobertura ' + pct(q) : ''}">
        <span class="n">${d + 1}</span>
        <span class="bar"><i style="height:${Math.round(p.pessoas / max * 100)}%"></i>${p.externos ? `<u style="height:${Math.round(p.externos / max * 100)}%"></u>` : ''}</span>
        <span class="v">${p.pessoas || ''}</span></div>`;
    }).join('');

    const sm = plano.semMedicao || [];
    const ced = plano.cederam || [];
    const nada = plano.semSaida || [];
    const erros = plano.avisos.filter((a) => a.lv === 'erro');
    const avs = plano.avisos.filter((a) => a.lv !== 'erro');

    box.innerHTML = `
      <div class="fg-pl-topo">
        <div class="fg-pl-num"><b>${M.total}</b><span>cursos alocados</span></div>
        <div class="fg-pl-num"><b>${M.externos}</b><span>externos (data imposta)</span></div>
        <div class="fg-pl-num"><b>${M.internos}</b><span>internos (distribuídos)</span></div>
        <div class="fg-pl-num ${noLimite ? 'ok' : ''}"><b>${M.pico.pessoas}</b><span>pico no dia ${M.pico.dia + 1}${noLimite ? ' · é o mínimo possível' : ''}</span></div>
        <div class="fg-pl-num ${M.piorQueda.pct >= 0.5 ? 'bad' : ''}"><b>${pct(M.piorQueda.pct)}</b><span>maior queda de cobertura · dia ${M.piorQueda.dia + 1}</span></div>
        ${M.semMedicao ? `<div class="fg-pl-num bad"><b>${M.semMedicao}</b><span>com data, sem medição · ${M.pessoasSemMedicao} pessoa(s)</span></div>` : ''}
        ${M.cederam ? `<div class="fg-pl-num"><b>${M.cederam}</b><span>alocados com regra cedida</span></div>` : ''}
        ${M.semSaida ? `<div class="fg-pl-num bad"><b>${M.semSaida}</b><span>sem data — férias o mês todo</span></div>` : ''}
      </div>

      <p class="fg-pl-frase">${noLimite
        ? `Os cursos externos já ocupam <b>${M.picoFixo}</b> pessoa(s) no dia mais cheio. Com as datas que o fornecedor deu, <b>não dá para melhorar além disto</b> — o ganho do mês que vem depende de negociar essas datas.`
        : `O piso imposto pelos externos é <b>${M.picoFixo}</b>; o plano chegou a <b>${M.pico.pessoas}</b>.`}</p>

      ${M.travados >= M.total ? `<p class="fg-pl-frase">Todas as linhas já vinham com data preenchida, então não houve o que distribuir. Apague a coluna DATA do que quiser que o painel resolva.</p>`
        : `<div class="fg-pl-cmp">
        <span>Marcando na primeira data livre: pico <b>${naMao.pico}</b> · queda <b>${pct(naMao.piorPct)}</b></span>
        <span class="seta">→</span>
        <span>Com o plano: pico <b>${agora.pico}</b> · queda <b>${pct(agora.piorPct)}</b></span>
        ${M.travados ? `<span class="fg-pl-trava">${M.travados} de ${M.total} já vinham com data e ficaram onde estavam nos dois lados</span>` : ''}
      </div>`}

      <div class="fg-pl-graf">${barras}</div>
      <p class="fg-pl-leg"><i></i> pessoas fora &nbsp; <u></u> hachurado: cursos externos, data imposta &nbsp; · &nbsp; a cor da barra mostra a queda de cobertura do dia: azul até 30%, amarelo até 50%, vermelho acima</p>

      <div class="fg-pl-acoes">
        <button type="button" class="fg-btn fg-primary" id="fg-pl-baixar">Baixar programação com as datas</button>
        <button type="button" class="fg-btn" id="fg-pl-aplicar">Aplicar direto na escala</button>
        <button type="button" class="fg-btn" id="fg-pl-refazer">Tentar outra distribuição</button>
      </div>

      ${nada.length ? `<details class="fg-cur-bloco erro" open><summary>Sem data — precisa da sua decisão <b>${nada.length}</b></summary>
        <ul>${nada.map((i) => `<li><b>${i.e.mat}</b> ${esc(i.e.name)} · ${esc(i.curso)} — de férias em todos os dias do mês</li>`).join('')}</ul>
        <p class="fg-pl-nota">Tire a pessoa da lista do curso ou reveja as férias dela. É o único caso em que a linha volta sem data.</p></details>` : ''}
      ${ced.length ? `<details class="fg-cur-bloco aviso"><summary>Alocados com alguma regra cedida <b>${ced.length}</b></summary>
        <ul>${ced.slice(0, 60).map((i) => `<li><b>${i.e.mat}</b> ${esc(i.e.name)} · ${esc(i.curso)} · dia ${i.dia + 1} — ${esc(i.cedeu)}</li>`).join('')}
        ${ced.length > 60 ? `<li class="mais">… e mais ${ced.length - 60}</li>` : ''}</ul>
        <p class="fg-pl-nota">Não havia dia que respeitasse todas as regras para essas pessoas. O painel cedeu a regra menos custosa em vez de deixar a linha em branco — confira se cada caso serve.</p></details>` : ''}
      ${sm.length ? `<details class="fg-cur-bloco aviso" open><summary>Com data, mas sem medição de impacto <b>${sm.length}</b></summary>
        <ul>${sm.slice(0, 60).map((i) => `<li><b>${i.e.mat}</b> ${esc(i.e.name)} · ${esc(i.curso)} · dia ${i.dia + 1} — ${esc(i.motivo)}</li>`).join('')}
        ${sm.length > 60 ? `<li class="mais">… e mais ${sm.length - 60}</li>` : ''}</ul>
        <p class="fg-pl-nota">Essas pessoas receberam data e foram espalhadas pelos dias mais vazios, mas o painel não conseguiu calcular o efeito delas na cobertura. Quem está <b>na escala sem horário</b> se resolve preenchendo entrada e saída na planilha da escala.</p></details>` : ''}
      ${erros.length ? `<details class="fg-cur-bloco erro" open><summary>Precisam de atenção <b>${erros.length}</b></summary>
        <ul>${erros.slice(0, 40).map((a) => `<li>${esc(a.t)}</li>`).join('')}</ul></details>` : ''}
      ${avs.length ? `<details class="fg-cur-bloco aviso"><summary>Avisos <b>${avs.length}</b></summary>
        <ul>${avs.slice(0, 40).map((a) => `<li>${esc(a.t)}</li>`).join('')}</ul></details>` : ''}`;
  }

  async function baixarProgramacao() {
    try {
      const blob = await PL().gravarProgramacao(S.prog, S.plano.plano.itens);
      const nome = S.progFile.replace(/\.xlsx$/i, '') + ' - DATAS.xlsx';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = nome; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      toast('Baixado. Confira no Excel, ajuste o que quiser e suba de novo — data preenchida fica travada.', 7000);
    } catch (err) { toast('Não consegui gravar: ' + esc(err.message || err)); }
  }

  // Atalho: em vez de baixar e subir de novo, lança o plano como K agora.
  function aplicarPlano() {
    const itens = S.plano.plano.itens.filter((i) => i.dia !== null);
    const mm = S.model.month;
    const regs = itens.map((i) => ({
      mat: i.e.mat, nome: i.e.name, func: i.l.func || '', curso: i.curso,
      aba: 'PLANO', linha: i.l.linha,
      data: new Date(Date.UTC(mm.year, mm.month, i.dia + 1)),
    }));
    S.cursos = { regs, semData: [], arquivoVazio: false };
    S.cursosFile = (S.progFile || 'programação') + ' (plano)';
    run(() => { E.aplicarCursos(S.model, S.cursos, S.st); });
    toast(`${regs.length} curso(s) lançados na escala como K. O gerador redistribuiu as folgas em volta.`, 6000);
  }

  function tirarCursos() {
    S.cursos = null; S.cursosFile = '';
    if (S.model) E.limparCursos(S.model, S.st);
    const n = document.getElementById('fgl-cfile-name'); if (n) n.textContent = '';
    renderAll(); folgasLauncherSync();
    toast('Cursos removidos. A escala voltou ao que veio na planilha.');
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
  $('#fg-btn-cursos').addEventListener('click', () => $('#fg-cfile').click());
  $('#fg-cfile').addEventListener('change', (ev) => { const f = ev.target.files[0]; ev.target.value = ''; if (f) loadCursosFile(f); });
  $('#fg-cursos').addEventListener('click', (ev) => { if (ev.target.closest('#fg-cur-limpar')) tirarCursos(); });
  $('#fg-btn-plan').addEventListener('click', () => $('#fg-pfile').click());
  $('#fg-pfile').addEventListener('change', (ev) => { const f = ev.target.files[0]; ev.target.value = ''; if (f) loadProgFile(f); });
  $('#fg-plano').addEventListener('click', (ev) => {
    if (ev.target.closest('#fg-pl-baixar')) baixarProgramacao();
    else if (ev.target.closest('#fg-pl-aplicar')) aplicarPlano();
    else if (ev.target.closest('#fg-pl-refazer')) planejar();
  });
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
  window._fgLoadCursos = loadCursosFile;
  window._fgLoadProg = loadProgFile;

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
