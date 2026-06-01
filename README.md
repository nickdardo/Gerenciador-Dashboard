# Escalas · Dimensionamento

Ferramenta web para geração e comparação de escalas de trabalho a partir de arquivos de dimensionamento.

## Estrutura do projeto

```
escalas-project/
├── index.html          # Entrada principal (SPA)
├── vercel.json         # Configuração de deploy estático
├── css/
│   └── style.css       # Estilos globais
└── js/
    ├── helpers.js      # Navegação + utilitários compartilhados
    ├── generator.js    # Página 1 — Gerador de escala
    └── comparator.js   # Página 2 — Comparador de escalas
```

## Funcionalidades

### Gerador
- Carrega qualquer arquivo `Dimensionamento_*.xlsx`
- Parseia todas as abas do arquivo
- Gera escala individual com: setor, função, entrada, saída, horário, carga
- Exporta para Excel com nome `Escala_YYYY-MM-DD.xlsx`

### Comparador
- Compara Escala Base vs Escala Dimensionamento
- Gráficos de cobertura por hora e entradas por hora
- Quadro resumo por função
- Gráfico "Momento Calor" com equipes em atendimento por dia (resolução 10 min)
- Cards reordenáveis via drag & drop

## Estrutura esperada dos arquivos

| Arquivo | Descrição |
|---|---|
| `Dimensionamento_*.xlsx` | Arquivo com abas de setores; dados a partir da linha 100; colunas 5–148 com pares [qty, "Funcao,NH"] |
| `ESCALA-BASE-*.xlsx` | Escala real; col 10 = função, col 11 = entrada, col 12 = saída (a partir da linha 4) |
| `ESCALA-CAPACITY-*.xlsx` | Escala gerada pelo Gerador; col 2 = função, col 3 = entrada, col 4 = saída (a partir da linha 4) |

## Deploy no Vercel

### Via GitHub (recomendado)
1. Faça push deste projeto para seu repositório GitHub
2. Acesse [vercel.com](https://vercel.com) e importe o repositório
3. O Vercel detecta automaticamente como site estático
4. Deploy automático a cada push na branch `main`

### Via Vercel CLI
```bash
npm i -g vercel
vercel
```

## Desenvolvimento local

Não há dependências de build. Basta servir os arquivos estáticos:

```bash
# Python
python3 -m http.server 3000

# Node (npx)
npx serve .

# VS Code: Live Server extension
```

Acesse `http://localhost:3000`

## Dependências externas (CDN)

- [SheetJS (xlsx) 0.18.5](https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js) — leitura e geração de Excel
- [Chart.js 4.4.1](https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js) — gráficos
- [Google Fonts — Inter](https://fonts.google.com/specimen/Inter) — tipografia
