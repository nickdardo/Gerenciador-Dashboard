# Correções aplicadas — Escala Online

Tudo abaixo já está no código. Rode `node testes/teste-colunas.js` antes de
publicar: ele renderiza a grade nos quatro modos e falha se o alinhamento
de colunas voltar a quebrar.

---

## 1. Desalinhamento da grade

### `NCOLS_FIXAS` estava sempre uma coluna a menos

`js/escala.js` — antes `secOn ? 11 : 6`, agora `secOn ? 13 : 8`.

A linha "Trabalhando no dia" e os subtotais de bloco usam
`colspan="${NCOLS_FIXAS}"`. Com o valor curto, a faixa fixa terminava uma
célula antes: a contagem do dia 1 caía embaixo da coluna CH, todos os
números apareciam deslocados uma coluna à esquerda e o último dia do mês
ficava sem célula.

### Faltava um `<col>` no `<colgroup>`

O `LARG` não tinha `bloco`, e o `<colgroup>` emitia 11 `<col>` para 12
colunas. Com `table-layout:fixed` as larguras escorregavam:

| Coluna | Largura que recebia | Agora |
|---|---|---|
| Bloco | 190px (era da Função) | 82px |
| Função | 60px (era da Entrada) | 120px |
| Saída | 46px (era do CH) | 50px |
| CH | automática, dividida com os dias | 34px |

### Colunas congeladas transparentes

As células fixas usavam `background:inherit`, herdando `transparent` nas
linhas ímpares e branco a 2% nas pares — o conteúdo dos dias aparecia por
baixo de Matrícula e Nome na rolagem horizontal.

Agora cada linha declara `--escala-row-bg` e as células fixas pintam
sólido com ela (`.escala-fixa` no JS, regra em `css/style.css`). A última
coluna congelada ganhou sombra de borda (`.escala-fixa-borda`).

---

## 2. O mês inteiro cabe na tela

| | Antes | Agora |
|---|---|---|
| Colunas fixas — com extras | 1122px | 892px |
| Colunas fixas — essenciais | 682px | 588px |
| Mínimo por dia | 30px | 24px |
| Largura mínima (31 dias, extras) | 2052px | 1640px |
| Largura mínima (31 dias, essenciais) | 1612px | 1298px |

Útil em Full HD: ~1645px (1920 − sidebar 220 − padding − barra de
rolagem). Antes eram ~400px de rolagem horizontal permanente.

**Limite honesto:** com *todas* as extras ligadas em um mês de 31 dias o
dia fica com ~24px, que é o piso do legível. O modo confortável de verdade
é o de colunas essenciais, com ~35px por dia.

---

## 3. Padding lateral

Os painéis da Escala são filhos diretos de `#page-content`, que não tinha
padding horizontal — o `.page-header` ficava recuado 20px e os painéis
colavam na borda. O Admin já resolvia isso com wrapper próprio.

```css
#page-content.pc-flex { padding: 0 20px 16px; }
#page-content.pc-flex > .page-header { padding-left: 0; padding-right: 0; }
```

---

## 4. Rolagem e teclado

**A grade não volta mais pro topo.** `escalaGradeAtualiza()` guarda e
devolve `scrollTop`/`scrollLeft`. Como essa função roda a cada tecla
digitada, a grade pulava pro canto superior esquerdo toda vez que alguém
marcava uma folga no meio do mês.

**Setas navegam.** `←↑↓→` andam entre células, `Shift`+setas selecionam um
retângulo, `Esc` limpa a seleção. A letra digitada em seguida é aplicada
no intervalo inteiro em uma gravação só (`upsert` em lote), não uma por
célula. Antes só letras funcionavam — montar um mês exigia um clique por
célula.

**Seleção virou classe CSS** (`.escala-cel-sel`, `.escala-cel-faixa`) em
vez de `style.outline` inline, porque agora pode ser um retângulo com
dezenas de células.

---

## 5. Informação que faltava na grade

**Coluna Folgas.** Mostra `5/6` — folgas marcadas (F e FA) contra a meta
calculada por `escalaMetaFolgasDoColab()`. Verde quando bate, laranja
abaixo, vermelho acima.

**Linha "Pico da malha no dia".** O motor de demanda (parâmetros de solo ×
malha de voos) já rodava em `escalaRenderGrade` e o resultado ficava em
`window._escalaDemandaPorDia`, mas nunca chegava na grade.

Nome escolhido de propósito: é **pico simultâneo**, não "quantas pessoas
escalar" — uma pessoa cobre um turno inteiro, então o total necessário no
dia é maior que o pico. Serve pra comparar o formato da curva com a linha
de cima, não como meta absoluta.

---

## 6. Exportar e imprimir

Não existia nenhum dos dois na grade (o `XLSX.writeFile` do módulo era do
Gerador, que exporta o dimensionamento). Também não havia nenhum
`@media print` no projeto.

- `escalaExportarExcel()` — uma linha por colaborador, uma coluna por dia,
  com status ou horário do turno, painéis congelados e linha de resumo.
- `escalaImprimir()` — A3 paisagem, sem sidebar/topo/barra de ações, grade
  aberta por inteiro, `<thead>` repetindo em cada página, inputs virando
  texto.

---

## 7. Barra de ações

De 12 botões numa linha só (que quebrava em duas ou três em qualquer tela
e empurrava a grade pra baixo) para:

```
[busca] │ Gerar folgas · Preencher com staff · Horário do mês anterior │ … │ Agrupar · Colunas essenciais · [Mais ações ▾]
```

O menu recebeu: Excel, imprimir, modelo de cursos, importar cursos,
feriado da base, ordenar automático, limpar folgas, limpar colaboradores.
Os 4 botões desabilitados de placeholder ("Reservado pra uma função
futura") foram removidos.

---

## 8. Ícones

Todos os emojis do módulo viraram SVG de traço, no mesmo padrão de
`sbIcon()`: 🔒 ✈ ⚠ ✓ ● e as setas `↑↓` de ordenação. O `escalaIcone()`
ganhou `chevronUp/Down`, `arrowRight`, `plane`, `printer`, `sheet`,
`alert` e `check`, mais um `escalaIconeSolto()` para uso dentro de texto.

O `escalaMsg()` agora desenha o ícone de estado uma vez só — antes cada
chamada trazia o símbolo colado na string (`"✓ Horário salvo"`), o que
espalhava emoji por dezenas de mensagens e obrigava a limpar com regex
antes de reaproveitar o texto no indicador do cabeçalho.

Os cabeçalhos `Interv. ↓` e `Interv. ↑` viraram **Entra int.** e
**Volta int.**

> Fica um ponto em aberto: o `index.html` carrega o Tabler Icons por CDN e
> usa classes `ti ti-*` em outros módulos, enquanto a Escala usa SVG
> inline. São dois sistemas convivendo, e o Tabler depende de fonte
> externa que pode falhar em rede corporativa. Vale padronizar num só.

---

## 9. Organização dos arquivos

**Seis arquivos mortos** (~2.250 linhas que o `index.html` nunca carregou)
foram para `_legacy/`, com um LEIA-ME explicando onde está o código que
roda: `escala-online.js`, `helpers.js`, `ponto.js`, `generator.js`,
`comparator.js`, `salarios.js`.

O risco concreto era abrir `escala-online.js` pelo nome e editar código
que não roda.

**`pages.js` foi dividido:**

| Arquivo | Antes | Agora |
|---|---|---|
| `js/escala.js` | — | 3.040 linhas |
| `js/pages.js` | 3.520 linhas | 488 (Gerador e Comparador) |

O `index.html` carrega `escala.js` antes de `pages.js`. Conferido: sem
chamada cruzada entre os dois e sem declaração global duplicada entre os
nove scripts carregados.

---

## 10. Ajustes menores

- `escalaAjustarStickyOffset()` passa a rodar também no `resize` (com
  debounce) e na troca de densidade. Antes só no render, então a linha
  "Trabalhando no dia" descolava do cabeçalho depois de qualquer ajuste de
  janela ou zoom.
- Altura da célula de dia virou `var(--escala-row-h)` em vez de 32px fixo,
  então acompanha a densidade de verdade.
- `#app-shell { min-width: 1280px }` — como o painel é só de computador,
  abaixo disso a página rola em vez de espremer o layout.
- O cabeçalho da tabela foi reescrito com um helper `th({...})`. Eram 11
  `<th>` escritos à mão repetindo a mesma parede de estilo inline.

---

## Ainda em aberto

**Repintura pontual.** `escalaGradeAtualiza()` continua refazendo o
`innerHTML` da tabela inteira. Com 200 colaboradores são ~8.600 células
reconstruídas por marcação. A rolagem já é preservada, então o sintoma
visível sumiu, mas em bases grandes ainda vai travar. O caminho é repintar
só a célula, o contador do dia e o subtotal do bloco.

**Tema claro.** A Escala ainda usa cores fixas em vários pontos
(`#fc8181`, `rgba(255,255,255,.045)`, `#0b0f1a` nos botões primários). No
tema claro os subtotais e as faixas de bloco ficam quase invisíveis.
