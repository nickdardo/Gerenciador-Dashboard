# Arquivos fora de uso

Nenhum destes arquivos é carregado pelo `index.html`. Estavam soltos em
`js/` e não rodavam — foram movidos pra cá pra não confundir quem for
mexer no projeto.

| Arquivo | Onde o código que roda de verdade está |
|---|---|
| `escala-online.js` | `js/escala.js` — versão antiga da Escala Online, com outra estrutura de dados. Abrir este por causa do nome e editar é o erro mais fácil de cometer neste repositório. |
| `helpers.js` | `showPage`, `toMinutes`, `readXlsx`, `detectBase` etc. Nada nos scripts carregados usa. |
| `ponto.js` | Define um `pontoHorarios` que conflitaria com o de `aderencia.js` (que é o que vale). |
| `generator.js` | `js/pages.js` (`pageGerador`) |
| `comparator.js` | `js/pages.js` (`pageComparador`). Chama `readXlsx()`, que só existe em `helpers.js` — se for religado sem o helper, quebra. |
| `salarios.js` | Sem tela correspondente no menu. |

Antes de religar qualquer um: conferir se a função já não existe com o
mesmo nome num arquivo carregado, pra não sobrescrever sem querer.
