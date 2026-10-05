// ══════════════════════════════════════════════════════
// ESCALA → DP — aba do Admin e exportação da Escala Online
//
// Duas pontas do mesmo caminho:
//
//   Aqui no Admin, sobe-se o arquivo que o DP já usa e o painel extrai os
//   catálogos — horários, turnos, cargos, feriados e o número de escala
//   de cada pessoa. É o que o painel não tem como inventar.
//
//   Na Escala Online, "Mais ações → Exportar para o DP" gera a matriz no
//   mesmo layout, da escala que está na tela.
//
// A diferença para a planilha de hoje está no relatório: quando uma
// célula não dá para resolver, ela sai em branco e aparece na lista. A
// planilha grava #N/D e segue — e o DP aceita calado.
// ══════════════════════════════════════════════════════

function adminDpTab(el) {
  el.innerHTML = dpTabHTML();
  dpMontar();
}

function dpTabHTML() {
  return `
  <div class="fg-scope fg-wrap fg-launcher" id="adm-dp">
    <div class="fg-top">
      <div>
        <div class="fg-eyebrow">Integração com a folha</div>
        <h2 class="fg-title">Escala → sistema do DP</h2>
      </div>
      <div class="fg-actions">
        <button class="fg-btn" id="dp-esquecer" type="button" hidden>Descartar catálogo</button>
        <button class="fg-btn fg-primary" id="dp-salvar" type="button" hidden>Guardar catálogo</button>
      </div>
    </div>

    <div class="fg-como">
      <h3>Como funciona</h3>
      <p>O sistema do DP não lê "folga" nem "08:00 às 14:00". Lê <b>um número por pessoa por dia</b>. Para traduzir,
         o painel precisa do catálogo que só existe no cadastro do DP — e ele vem inteiro, lendo o arquivo que o DP
         já usa hoje.</p>
      <div class="fg-como-vias">
        <div class="fg-via"><span class="fg-via-n">Uma vez por base</span>
          Suba aqui a planilha da escala do DP. O painel extrai os horários, os turnos, os cargos, os feriados e o
          número de escala de cada colaborador, e guarda.</div>
        <div class="fg-via"><span class="fg-via-n">Todo mês</span>
          Na Escala Online, <b>Mais ações → Exportar para o DP</b>. A matriz sai pronta, no mesmo layout de hoje.</div>
      </div>
      <p class="fg-como-fim">O que não der para resolver sai em branco e aparece no relatório — nunca vira um código inventado.</p>
    </div>

    <label class="fg-passo req" id="dp-drop" for="dp-file">
      <input type="file" id="dp-file" accept=".xlsb,.xlsx,.xlsm">
      <span class="fg-passo-n">1</span>
      <span class="fg-passo-txt">
        <span class="fg-passo-tit">Planilha da escala do DP<em class="fg-selo req">obrigatório</em></span>
        <span class="fg-passo-desc">O arquivo que o DP usa hoje, com as abas <b>HORARIOS</b>, <b>ESCALA GERAL</b> e <b>BANCO DE DADOS</b>.</span>
        <span class="fg-passo-drop"><b>Solte o arquivo aqui</b> ou clique para escolher<span class="fg-passo-sub">Aceita .xlsb, o formato binário que o DP usa</span></span>
      </span>
      <span class="fg-passo-ok" id="dp-nome"></span>
    </label>

    <div id="dp-nota"></div>
    <div id="dp-saida"></div>
    <div id="dp-toast" class="fg-toast" role="status" hidden></div>
  </div>`;
}

function dpMontar() {
  const X = window.EscalaDP;
  const $ = (s) => document.querySelector(s);
  const esc = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const num = (v) => Number(v || 0).toLocaleString('pt-BR');

  if (!window._dpState) window._dpState = { cat: null, nome: '', base: '', salvo: null };
  const S = window._dpState;

  let toastT = 0;
  const toast = (m, ms = 5000) => { const t = $('#dp-toast'); if (!t) return; t.innerHTML = m; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), ms); };

  /* ---------- leitura ---------- */
  async function ler(file) {
    if (!file) return;
    $('#dp-nome').textContent = 'lendo…';
    $('#dp-nota').innerHTML = '';
    try {
      const cat = X.lerCatalogoDP(await file.arrayBuffer());
      S.cat = cat; S.nome = file.name;
      // A base costuma estar no nome do arquivo (BEL_ESCALA_OUTUBRO).
      const m = /\b([A-Z]{3})\b/.exec(file.name.toUpperCase());
      S.base = (m && m[1]) || window._escalaBase || '';
      $('#dp-nome').textContent = file.name;
      render();
      toast(`Catálogo lido: <b>${num(cat.resumo.horarios)}</b> horários, <b>${cat.resumo.turnos}</b> turnos e <b>${num(cat.resumo.pessoas)}</b> colaboradores.`);
    } catch (err) {
      $('#dp-nome').textContent = '';
      $('#dp-nota').innerHTML = `<div class="err-note">Não consegui ler o arquivo: ${esc(err.message || err)}</div>`;
    }
  }

  /* ---------- banco ---------- */
  async function salvar() {
    if (!S.cat) return;
    const base = ($('#dp-base') && $('#dp-base').value.trim().toUpperCase()) || S.base;
    if (!base) { toast('Informe a base antes de guardar.'); return; }
    const c = S.cat;
    // Map não sobrevive ao JSON: vira lista de pares na ida e Map na volta.
    const dados = {
      horarios: [...c.horarios.porCodigo.values()],
      turnos: [...c.turnos.porSigla.values()],
      cadastro: [...c.cadastro.values()],
      cargos: [...c.cargos.entries()],
      feriados: c.feriados,
      codigos: codigosDaTela(),
    };
    try {
      const { error } = await db.from('dp_catalogo').upsert(
        { base, dados, resumo: c.resumo, origem_arquivo: S.nome }, { onConflict: 'base' });
      if (error) throw error;
      S.salvo = base;
      toast(`Catálogo da base <b>${esc(base)}</b> guardado. A Escala Online já pode exportar para o DP.`);
      render();
    } catch (err) {
      toast('Não consegui guardar: ' + esc(err.message || err) + ' — rode <b>sql/dp_catalogo.sql</b> no banco.', 9000);
    }
  }

  function codigosDaTela() {
    const out = X.codigosPadrao();
    document.querySelectorAll('[data-dp-cod]').forEach((i) => {
      const k = i.dataset.dpCod;
      const v = String(i.value || '').trim();
      if (out[k]) { out[k].codigo = v || null; if (v) out[k].origem = 'informado por você'; }
    });
    return out;
  }

  /* ---------- tela ---------- */
  function render() {
    const box = $('#dp-saida');
    const c = S.cat;
    $('#dp-salvar').hidden = !c;
    $('#dp-esquecer').hidden = !c;
    if (!c) { box.innerHTML = ''; return; }

    const R = c.resumo;
    const imp = X.oQueImportar(c);
    const cods = Object.entries(c.codigos);
    const faltam = cods.filter(([, v]) => !v.codigo);

    box.innerHTML = `
    <section class="ox-card">
      <header class="ox-card-head">
        <h3>${esc(S.base || '—')}</h3>
        <span class="ox-sub">${esc(S.nome)} · ${c.abas.length} abas${c.abaMatriz ? ' · matriz de referência: ' + esc(c.abaMatriz) : ''}</span>
      </header>

      <div class="ox-nums">
        <div class="ox-num"><span class="k">Horários</span><span class="v">${num(R.horarios)}</span><span class="s">${num(R.faixas)} faixas distintas</span></div>
        <div class="ox-num"><span class="k">Turnos</span><span class="v">${R.turnos}</span><span class="s">siglas de A a D</span></div>
        <div class="ox-num"><span class="k">Colaboradores</span><span class="v">${num(R.pessoas)}</span><span class="s">${num(R.comEscala)} com nº de escala</span></div>
        <div class="ox-num"><span class="k">Cargos e feriados</span><span class="v">${R.cargos}</span><span class="s">${R.feriados} feriados no ano</span></div>
      </div>

      <div class="dp-bloco">
        <h4>O que o painel ganha com este arquivo</h4>
        <p class="ox-pend-ajuda">A leitura é de mão dupla: o painel entrega a matriz para o DP, e recebe de volta os
          catálogos que hoje só existem na planilha.</p>
        <table class="ox-tab"><tbody>
          ${imp.map((i) => `<tr>
            <td><b>${esc(i.titulo)}</b><span class="ox-cargos">${esc(i.txt)}</span></td>
            <td class="n forte">${num(i.n)}</td></tr>`).join('')}
        </tbody></table>
      </div>

      <div class="dp-bloco">
        <h4>Códigos de ausência ${faltam.length ? `<span class="ox-badge">${faltam.length} a confirmar</span>` : ''}</h4>
        <p class="ox-pend-ajuda">Os quatro primeiros foram deduzidos do próprio arquivo, cruzando todas as células.
          Os demais a legenda do DP prevê, mas o mês analisado não teve nenhum caso — então não há o que deduzir.
          Enquanto estiverem em branco, esses dias saem vazios e aparecem no relatório da exportação.</p>
        <table class="ox-tab">
          <thead><tr><th>Status</th><th>Significa</th><th>Código no DP</th><th>De onde veio</th></tr></thead>
          <tbody>
            ${cods.map(([k, v]) => `<tr>
              <td><span class="escala-cod st-${esc(k)}" style="width:42px;height:24px;display:inline-flex">${esc(k)}</span></td>
              <td>${esc(v.rotulo)}</td>
              <td><input class="dp-inp" data-dp-cod="${esc(k)}" value="${esc(v.codigo || '')}" placeholder="—" inputmode="numeric"></td>
              <td class="${v.codigo ? '' : 'dp-falta'}">${esc(v.origem)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>

      <div class="dp-bloco">
        <h4>Guardar para qual base</h4>
        <p class="ox-pend-ajuda">O catálogo vale por base. A Escala Online usa o da base que estiver na tela.</p>
        <input class="dp-inp larga" id="dp-base" value="${esc(S.base)}" placeholder="BEL" maxlength="4">
        ${S.salvo ? `<p class="dp-ok">Guardado para a base <b>${esc(S.salvo)}</b> — a exportação já funciona.</p>` : ''}
      </div>

      ${c.avisos.length ? `<details class="fg-cur-bloco aviso"><summary>Avisos da leitura <b>${c.avisos.length}</b></summary>
        <ul>${c.avisos.map((a) => `<li>${esc(a.t)}</li>`).join('')}</ul></details>` : ''}
    </section>`;
  }

  /* ---------- eventos ---------- */
  const z = $('#dp-drop'), i = $('#dp-file');
  i.addEventListener('change', (ev) => ler(ev.target.files[0]));
  ['dragenter', 'dragover'].forEach((t) => z.addEventListener(t, (ev) => { ev.preventDefault(); z.classList.add('over'); }));
  ['dragleave', 'drop'].forEach((t) => z.addEventListener(t, (ev) => { ev.preventDefault(); z.classList.remove('over'); }));
  z.addEventListener('drop', (ev) => { ev.preventDefault(); ler(ev.dataTransfer.files[0]); });
  $('#dp-salvar').addEventListener('click', salvar);
  $('#dp-esquecer').addEventListener('click', () => { S.cat = null; S.nome = ''; S.salvo = null; $('#dp-nome').textContent = ''; render(); });

  render();
}

/* ══════════════ exportação, chamada da Escala Online ══════════════════ */

// Map não sobrevive ao JSON do banco — remonta na volta.
function dpCatalogoDeDados(d) {
  const porCodigo = new Map(), porFaixa = new Map();
  for (const h of d.horarios || []) {
    porCodigo.set(h.codigo, h);
    const k = h.entrada + '-' + h.saida;
    if (!porFaixa.has(k)) porFaixa.set(k, h);
  }
  const porSigla = new Map(), porCodTurno = new Map();
  for (const t of d.turnos || []) {
    porSigla.set(t.sigla, t);
    if (t.codigo && !porCodTurno.has(t.codigo)) porCodTurno.set(t.codigo, t.sigla);
  }
  return {
    horarios: { porCodigo, porFaixa },
    turnos: { porSigla, porCodigo: porCodTurno },
    cadastro: new Map((d.cadastro || []).map((p) => [p.matricula, p])),
    cargos: new Map(d.cargos || []),
    feriados: d.feriados || [],
    codigos: d.codigos || window.EscalaDP.codigosPadrao(),
  };
}

async function dpCarregarCatalogo(base) {
  const { data, error } = await db.from('dp_catalogo').select('dados,resumo,origem_arquivo,atualizado_em').eq('base', base).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const cat = dpCatalogoDeDados(data.dados || {});
  cat.origem = data.origem_arquivo;
  cat.atualizadoEm = data.atualizado_em;
  cat.resumo = data.resumo || {};
  return cat;
}

async function escalaExportarDP() {
  const X = window.EscalaDP;
  if (!X) { escalaMsg('O módulo do DP não carregou — recarregue a página.', true); return; }
  if (typeof XLSX === 'undefined') { escalaMsg('A biblioteca de Excel não carregou — recarregue a página.', true); return; }

  const base = window._escalaBase, mes = window._escalaMes;
  const [ano, mesNum] = mes.split('-').map(Number);
  const diasNoMes = new Date(ano, mesNum, 0).getDate();
  const colabs = window._escalaColabs || [];
  if (!colabs.length) { escalaMsg('Nada pra exportar — nenhum colaborador nessa escala ainda.', true); return; }

  let cat;
  try { cat = await dpCarregarCatalogo(base); }
  catch (err) { escalaMsg('Não consegui ler o catálogo do DP: ' + err.message, true); return; }
  if (!cat) {
    escalaMsg(`Ainda não há catálogo do DP para a base ${base}. Suba a planilha do DP em Admin → Escala → sistema do DP.`, true);
    return;
  }

  // Monta a entrada do motor a partir do que a tela já sabe.
  const pessoas = colabs.map((c) => {
    const info = window.eoColabs?.get(c.matricula);
    const ch = info?.ch || c.ch_manual || 0;
    const entrada = escalaEntradaEfetivaDoColab(c, ano, mesNum, diasNoMes) || '';
    return {
      matricula: c.matricula,
      nome: c.nome || info?.nome || '',
      entrada,
      saida: escalaSaidaCalculada(entrada, ch) || '',
      ch,
      dias: escalaConteudoDoMes(c, ano, mesNum, diasNoMes).map((i) => i.status || ''),
    };
  });

  const r = X.montarMatrizDP(pessoas, cat, { ano, mes: mesNum, base, codigos: cat.codigos });

  const ws = XLSX.utils.aoa_to_sheet([r.cabecalho, ...r.linhas]);
  ws['!cols'] = [{ wch: 11 }, { wch: 34 }, { wch: 9 }, { wch: 8 },
    ...Array.from({ length: r.diasNoMes * 2 }, (_, i) => ({ wch: i % 2 ? 8 : 11 })),
    { wch: 8 }, { wch: 7 }, { wch: 8 }, { wch: 7 }, { wch: 11 }, { wch: 7 }, { wch: 24 }, { wch: 5 }, { wch: 22 }];
  ws['!freeze'] = { xSplit: 2, ySplit: 1 };
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `${base}_ESCALA MATRIZ`.slice(0, 31));
  XLSX.writeFile(wb, `${base}_ESCALA_${X.MESES[mesNum - 1]}_${ano}.xlsx`);

  dpMostrarRelatorio(r, base, mesNum, ano);
}

/* O relatório é o ponto da coisa toda: a planilha de hoje grava #N/D e
   segue em frente. Aqui, o que não resolveu aparece com nome e matrícula. */
function dpMostrarRelatorio(r, base, mesNum, ano) {
  const esc = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const R = r.resumo, P = r.pendencias;
  const lista = (arr, f) => arr.slice(0, 12).map(f).join('') + (arr.length > 12 ? `<li>… e mais ${arr.length - 12}</li>` : '');

  const blocos = [];
  if (P.semEscala.length) blocos.push(`<div class="dp-rel-b"><h4>${P.semEscala.length} sem número de escala</h4>
    <p>Não estão no cadastro do DP que foi carregado. O DP costuma recusar a linha.</p>
    <ul>${lista(P.semEscala, (p) => `<li><b>${esc(p.matricula)}</b> ${esc(p.nome)}</li>`)}</ul></div>`);
  if (P.semCodigo.length) blocos.push(`<div class="dp-rel-b"><h4>${P.semCodigo.length} com horário fora do catálogo</h4>
    <p>O horário da escala não existe na tabela do DP. Os dias trabalhados saíram em branco.</p>
    <ul>${lista(P.semCodigo, (p) => `<li><b>${esc(p.matricula)}</b> ${esc(p.nome)} — ${esc(p.entrada)} às ${esc(p.saida)}</li>`)}</ul></div>`);
  if (P.ambiguos.length) blocos.push(`<div class="dp-rel-b"><h4>${P.ambiguos.length} com horário ambíguo</h4>
    <p>A mesma entrada existe em mais de um código. Escolher por conta própria seria chute.</p>
    <ul>${lista(P.ambiguos, (p) => `<li><b>${esc(p.matricula)}</b> ${esc(p.nome)} — ${esc(p.entrada)}: ${p.opcoes.map((o) => esc(o.codigo)).join(', ')}</li>`)}</ul></div>`);
  if (P.semStatus.length) blocos.push(`<div class="dp-rel-b"><h4>${P.semStatus.length} tipo(s) de ausência sem código</h4>
    <p>Informe o código em Admin → Escala → sistema do DP e exporte de novo.</p>
    <ul>${P.semStatus.map((s) => `<li><b>${esc(s.status)}</b> — ${esc(s.rotulo)}</li>`).join('')}</ul></div>`);
  if (P.semTurno.length) blocos.push(`<div class="dp-rel-b leve"><h4>${P.semTurno.length} sem sigla de turno</h4>
    <p>A coluna TURNO saiu vazia nessas linhas. Não impede o envio, mas o DP perde a referência do bloco.</p></div>`);

  const limpo = !blocos.length;
  const html = `
  <div class="dp-rel-fundo" id="dp-rel-fundo">
    <div class="dp-rel">
      <header>
        <h3>Exportação para o DP — ${esc(base)} · ${esc(window.EscalaDP.MESES[mesNum - 1])}/${ano}</h3>
        <button type="button" class="dp-rel-x" onclick="document.getElementById('dp-rel-fundo').remove()">✕</button>
      </header>
      <div class="dp-rel-nums">
        <div><span class="k">Pessoas</span><span class="v">${R.pessoas}</span></div>
        <div><span class="k">Células</span><span class="v">${R.celulas.toLocaleString('pt-BR')}</span></div>
        <div class="${limpo ? 'bom' : 'alerta'}"><span class="k">Preenchidas</span><span class="v">${R.completo}%</span></div>
        <div class="${R.vazias ? 'alerta' : 'bom'}"><span class="k">Em branco</span><span class="v">${R.vazias}</span></div>
      </div>
      ${limpo
        ? `<div class="dp-rel-ok"><b>Nada ficou pendente.</b> Todas as células foram resolvidas — o arquivo pode ir para o DP como está.</div>`
        : `<div class="dp-rel-aviso"><b>O arquivo foi baixado</b>, mas ${R.vazias} célula(s) saíram em branco. Resolva os pontos abaixo e exporte de novo — em branco é melhor que um código errado, que o DP aceitaria calado.</div>
           ${blocos.join('')}`}
    </div>
  </div>`;
  const d = document.createElement('div');
  d.innerHTML = html;
  document.body.appendChild(d.firstElementChild);
}
