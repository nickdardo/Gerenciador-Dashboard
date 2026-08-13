// ══════════════════════════════════════════════════════
// Salários — painel restrito, só o papel 'admin' enxerga (nav já esconde
// o item pra quem não é admin; a RLS da tabela folha_salarios é a
// proteção de verdade, essa checagem aqui é só pra dar uma mensagem clara
// em vez de tela vazia/confusa caso alguém chegue aqui sem ser admin).
// Dado vem do upload em Admin (Salarios.xls/.xlsx) — matrícula, base,
// salário — cruzado com o cadastro de colaboradores (window.eoColabs) só
// pra mostrar a função de cada um, sem precisar de nenhum dado novo.
// ══════════════════════════════════════════════════════

async function salFetchTodos() {
  const { count } = await db.from('folha_salarios').select('*', { count: 'exact', head: true });
  const linhas = [];
  const PAGE = 1000;
  for (let from = 0; from < (count || 0); from += PAGE) {
    const { data, error } = await db.from('folha_salarios').select('matricula,base,salario').range(from, from + PAGE - 1);
    if (error) { console.warn('[salarios] folha_salarios:', error.message); break; }
    if (data) linhas.push(...data);
  }
  return linhas;
}

function salMediana(valores) {
  if (!valores.length) return 0;
  const ord = [...valores].sort((a,b) => a-b);
  const meio = Math.floor(ord.length/2);
  return ord.length % 2 ? ord[meio] : (ord[meio-1]+ord[meio])/2;
}

function salFmtReal(v) {
  return 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function pageSalarios(el) {
  el.innerHTML = `
    <div class="page-header"><div>
      <h1 class="page-title">Salários</h1>
      <p class="page-sub">Restrito — só Admin</p>
    </div></div>
    <div class="adm-empty-state">
      <i class="ti ti-loader-2" style="font-size:32px;opacity:.4;animation:spin 1s linear infinite" aria-hidden="true"></i>
      <p>Carregando...</p>
    </div>`;

  const role = currentUserProfile?.role;
  if (role !== 'admin') {
    el.innerHTML = `
      <div class="page-header"><div>
        <h1 class="page-title">Salários</h1>
      </div></div>
      <div class="adm-empty-state">
        <i class="ti ti-lock" style="font-size:32px;opacity:.4" aria-hidden="true"></i>
        <p>Essa tela é restrita ao Admin.</p>
      </div>`;
    return;
  }

  const linhas = await salFetchTodos();
  if (!linhas.length) {
    el.innerHTML = `
      <div class="page-header"><div>
        <h1 class="page-title">Salários</h1>
      </div></div>
      <div class="adm-empty-state">
        <i class="ti ti-currency-real" style="font-size:32px;opacity:.4" aria-hidden="true"></i>
        <p>Nenhum dado de salário carregado ainda. Sobe o arquivo em Admin → Salários.</p>
      </div>`;
    return;
  }

  window._salLinhas = linhas;
  salRenderPainel(el);
}

function salRenderPainel(el) {
  const linhas = window._salLinhas || [];
  const salarios = linhas.map(r => r.salario);
  const total = salarios.reduce((s,v) => s+v, 0);
  const media = total / linhas.length;
  const mediana = salMediana(salarios);
  const maior = linhas.reduce((m,r) => r.salario > m.salario ? r : m, linhas[0]);

  const porBase = new Map();
  linhas.forEach(r => {
    if (!porBase.has(r.base)) porBase.set(r.base, []);
    porBase.get(r.base).push(r);
  });
  const ranking = [...porBase.entries()].map(([base, lista]) => {
    const vals = lista.map(r => r.salario);
    return { base, media: vals.reduce((s,v)=>s+v,0)/vals.length, mediana: salMediana(vals), n: lista.length };
  }).sort((a,b) => b.media - a.media);

  el.innerHTML = `
    <div class="page-header"><div>
      <h1 class="page-title">Salários</h1>
      <p class="page-sub">Restrito — só Admin · ${linhas.length.toLocaleString('pt-BR')} colaboradores · ${porBase.size} bases</p>
    </div></div>

    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">
      <div class="hc-panel"><div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px">Folha total</div><div style="font-size:22px;font-weight:700">${salFmtReal(total)}</div><div style="font-size:11px;color:var(--text-muted);margin-top:2px">${linhas.length.toLocaleString('pt-BR')} colaboradores</div></div>
      <div class="hc-panel"><div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px">Média geral</div><div style="font-size:22px;font-weight:700">${salFmtReal(media)}</div><div style="font-size:11px;color:var(--text-muted);margin-top:2px">mediana ${salFmtReal(mediana)}</div></div>
      <div class="hc-panel"><div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px">Maior salário</div><div style="font-size:22px;font-weight:700;color:var(--blue)">${salFmtReal(maior.salario)}</div><div style="font-size:11px;color:var(--text-muted);margin-top:2px">${maior.base}</div></div>
      <div class="hc-panel"><div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px">Bases com dado</div><div style="font-size:22px;font-weight:700">${porBase.size}</div><div style="font-size:11px;color:var(--text-muted);margin-top:2px">${ranking[0]?.base} paga mais em média</div></div>
    </div>

    <div class="hc-panel" style="margin-bottom:16px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <span style="font-size:12px;font-weight:600;color:var(--text-primary)">Ranking por base</span>
        <span style="font-size:10px;color:var(--text-muted)">clique numa base pra ver os colaboradores</span>
      </div>
      <div style="display:grid;grid-template-columns:70px 1fr 1fr 1fr;padding:6px 4px;font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.03em">
        <span>Base</span><span>Média</span><span>Mediana</span><span style="text-align:right">Pessoas</span>
      </div>
      ${ranking.map(r => `
        <div onclick="salAbrirBase('${r.base}')" style="display:grid;grid-template-columns:70px 1fr 1fr 1fr;padding:8px 4px;font-size:13px;border-top:1px solid var(--border);align-items:center;cursor:pointer;border-radius:6px" onmouseover="this.style.background='var(--bg-hover)'" onmouseout="this.style.background='transparent'">
          <span style="color:var(--blue);font-weight:600">${r.base}</span>
          <span>${salFmtReal(r.media)}</span>
          <span style="color:var(--text-muted)">${salFmtReal(r.mediana)}</span>
          <span style="text-align:right">${r.n}</span>
        </div>`).join('')}
    </div>

    <div id="sal-modal-root"></div>
  `;
}

// ── Modal de detalhe por base (igual o card de detalhe da Aderência) ──
function salAbrirBase(base) {
  window._salModalBase = base;
  window._salModalOrdemColuna = 'salario';
  window._salModalOrdemDirecao = 'desc';
  window._salModalFuncaoFiltro = null;
  salRenderModalBase();
}

function salFecharModal() {
  window._salModalBase = null;
  const root = document.getElementById('sal-modal-root');
  if (root) root.innerHTML = '';
}

function salOrdenarModalPorColuna(coluna) {
  if (window._salModalOrdemColuna === coluna) {
    window._salModalOrdemDirecao = window._salModalOrdemDirecao === 'desc' ? 'asc' : 'desc';
  } else {
    window._salModalOrdemColuna = coluna;
    window._salModalOrdemDirecao = coluna === 'salario' ? 'desc' : 'asc';
  }
  salRenderModalBase();
}

function salFiltrarModalPorFuncao(funcao) {
  window._salModalFuncaoFiltro = funcao || null;
  salRenderModalBase();
}

function salValorColuna(r, coluna) {
  if (coluna === 'matricula') return r.matricula;
  if (coluna === 'nome') return r.nome || '';
  if (coluna === 'funcao') return r.funcao || '';
  return r.salario;
}

function salRenderModalBase() {
  const base = window._salModalBase;
  const root = document.getElementById('sal-modal-root');
  if (!base || !root) return;

  const todosDaBase = (window._salLinhas || [])
    .filter(r => r.base === base)
    .map(r => ({ ...r, nome: window.eoColabs?.get(r.matricula)?.nome || '', funcao: window.eoColabs?.get(r.matricula)?.funcao || '—' }));

  const funcoesDaBase = [...new Set(todosDaBase.map(r => r.funcao))].sort((a,b) => a.localeCompare(b));

  const filtro = window._salModalFuncaoFiltro;
  let lista = filtro ? todosDaBase.filter(r => r.funcao === filtro) : todosDaBase;

  const coluna = window._salModalOrdemColuna || 'salario';
  const direcao = window._salModalOrdemDirecao === 'asc' ? 1 : -1;
  lista = [...lista].sort((a,b) => {
    const va = salValorColuna(a, coluna), vb = salValorColuna(b, coluna);
    if (typeof va === 'number') return direcao * (va - vb);
    return direcao * String(va).localeCompare(String(vb), 'pt-BR');
  });

  const setaColuna = (c) => window._salModalOrdemColuna === c ? (window._salModalOrdemDirecao==='desc'?' ↓':' ↑') : '';
  const corColuna = (c) => window._salModalOrdemColuna === c ? 'var(--blue)' : 'var(--text-muted)';
  const th = (c, label, alinhamento) => `<span onclick="salOrdenarModalPorColuna('${c}')" style="cursor:pointer;user-select:none;color:${corColuna(c)}${alinhamento?';text-align:'+alinhamento:''}">${label}${setaColuna(c)}</span>`;

  root.innerHTML = `
    <div class="adm-overlay" onclick="if(event.target===this) salFecharModal()">
      <div class="adm-modal" style="max-width:940px">
        <div class="adm-modal-header">
          <span>${base} — ${todosDaBase.length} colaborador${todosDaBase.length===1?'':'es'}${filtro ? ` · ${lista.length} em "${filtro}"` : ''}</span>
          <button onclick="salFecharModal()" aria-label="Fechar"><i class="ti ti-x" aria-hidden="true"></i></button>
        </div>
        <div class="adm-modal-body">
          <div style="display:flex;align-items:center;gap:10px">
            <label style="font-size:11px;color:var(--text-muted)">Filtrar por função</label>
            <select onchange="salFiltrarModalPorFuncao(this.value)" style="flex:1;max-width:320px;padding:7px 12px;background:var(--bg-hover);border:1px solid var(--border-strong);border-radius:8px;color:var(--text-primary);font-size:12px">
              <option value="">Todas as funções (${funcoesDaBase.length})</option>
              ${funcoesDaBase.map(f => `<option value="${f}" ${filtro===f?'selected':''}>${f}</option>`).join('')}
            </select>
          </div>

          <div>
            <div style="display:grid;grid-template-columns:100px 1.3fr 1.5fr 150px;padding:8px 10px;font-size:10px;text-transform:uppercase;letter-spacing:.03em;border-bottom:1px solid var(--border)">
              ${th('matricula','Matrícula')}${th('nome','Nome')}${th('funcao','Função')}${th('salario','Salário','right')}
            </div>
            <div style="max-height:460px;overflow-y:auto">
              ${lista.map((r,i) => `
                <div style="display:grid;grid-template-columns:100px 1.3fr 1.5fr 150px;padding:12px 10px;font-size:13px;align-items:center;background:${i%2?'var(--bg-hover)':'transparent'}">
                  <span style="font-family:monospace;color:var(--text-secondary)">${r.matricula}</span>
                  <span style="color:var(--text-primary);font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding-right:12px">${r.nome||'—'}</span>
                  <span style="color:var(--text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding-right:12px">${r.funcao}</span>
                  <span style="text-align:right;font-weight:600">${salFmtReal(r.salario)}</span>
                </div>`).join('')}
              ${!lista.length ? `<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:12px">Ninguém encontrado com esse filtro.</div>` : ''}
            </div>
          </div>
        </div>
      </div>
    </div>`;
}

// Fecha o modal apertando Esc, além de clicar fora / no X. Registrado uma
// vez só (não em toda renderização) pra não empilhar listener repetido.
if (!window._salEscRegistrado) {
  window._salEscRegistrado = true;
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && window._salModalBase) salFecharModal();
  });
}
