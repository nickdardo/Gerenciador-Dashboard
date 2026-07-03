# Escalas · dnata CGO Operations

Plataforma web de gestão de escalas operacionais — multi-base, sem instalação.

## Estrutura

```
├── index.html              # SPA principal
├── vercel.json             # Deploy estático
├── favicon.ico / .png      # Ícone dnata
├── assets/
│   ├── dnata-logo.png      # Logo transparente
│   └── dnata-logo-nav.png  # Logo compacto (nav)
├── css/
│   └── style.css           # Estilos globais
└── js/
    ├── helpers.js          # Navegação + utilitários compartilhados
    ├── generator.js        # Módulo 1 — Gerador de Escala
    ├── comparator.js       # Módulo 2 — Comparador (planejado vs real)
    ├── escala-online.js    # Módulo 3 — Escala Online (calendário mensal)
    ├── ponto.js            # Motor de ponto (Horarios + Marcacao)
    └── aderencia.js        # Módulo 4 — Aderência ao Ponto
```

## Módulos

| # | Módulo | Entrada | Saída |
|---|--------|---------|-------|
| 1 | **Gerador** | `Dimensionamento_*.xlsx` | Escala estruturada por função/horário |
| 2 | **Comparador** | Escala Dimensionamento + Escala Real (`.xlsb`) | Cobertura %, gap de quadro, gráficos |
| 3 | **Escala Online** | Gerador → grade mensal | Calendário preenchível com nomes/matrículas e folgas |
| 4 | **Aderência** | `Horarios.xlsx` + `Marcacao.xlsx` | Planejado vs realizado, atrasos, faltas, % aderência |

## Deploy

### GitHub + Vercel (recomendado)
1. Push para o repositório GitHub
2. Importe no [vercel.com](https://vercel.com) — detecta automaticamente como site estático
3. Deploy automático a cada push na `main`

### Local
```bash
npx serve .
# ou
python3 -m http.server 3000
```
