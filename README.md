# Gerenciador de Escalas · dnata CGO Operations

Sistema de gestão de escalas operacionais com autenticação, multi-base e integração Supabase.

## Stack

- **Frontend:** HTML + CSS + JS vanilla (sem framework)
- **Auth + DB:** Supabase
- **Deploy:** Vercel (static)
- **Repo:** GitHub `nickdardo/Gerenciador-Dashboard`

## Estrutura

```
├── index.html              # SPA principal
├── vercel.json             # Deploy estático
├── MUDANCAS.md             # O que foi corrigido na Escala Online
├── assets/
├── css/
│   └── style.css           # Design system + grade da Escala + impressão
├── testes/
│   └── teste-colunas.js    # Valida o alinhamento de colunas da grade
├── _legacy/                # Arquivos que o index.html NÃO carrega
└── js/
    ├── supabase.js         # Client + auth helpers
    ├── i18n.js             # Textos
    ├── auth.js             # Login / criar acesso
    ├── app.js              # Shell, sidebar, topbar, roteamento
    ├── escala.js           # Escala Online (grade colaborador × dia)
    ├── pages.js            # Gerador e Comparador
    ├── admin.js            # Admin (usuários, malha, parâmetros)
    ├── aderencia.js        # Aderência ao Ponto
    └── headcount.js        # Staff
```

Ordem de carga importa: `escala.js` vem antes de `pages.js`, porque
`app.js` chama `pageEscala()` no roteamento.

## Testes

```bash
node testes/teste-colunas.js
```

Renderiza a grade da Escala nos quatro modos (lista/agrupado × colunas
extras/essenciais) e falha se alguma linha divergir do cabeçalho em número
de colunas, ou se a largura mínima não couber num monitor Full HD. Rodar
antes de publicar qualquer mexida na grade.

## Supabase — Setup inicial

### 1. Configurar Auth

No Supabase Dashboard → Authentication → Settings:
- **Site URL:** `https://seu-dominio.vercel.app`
- **Redirect URLs:** `https://seu-dominio.vercel.app`
- Desabilitar "Confirm email" durante desenvolvimento se necessário

### 2. Criar tabelas (SQL Editor)

```sql
-- Colaboradores (base de 5000+)
CREATE TABLE colaboradores (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  station    text NOT NULL,
  matricula  text NOT NULL UNIQUE,
  nome       text NOT NULL,
  funcao     text,
  ch         integer,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Escalas por base/mês
CREATE TABLE escalas (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  base       text NOT NULL,
  mes        integer NOT NULL,
  ano        integer NOT NULL,
  dados      jsonb NOT NULL DEFAULT '{}',
  status     text DEFAULT 'rascunho',  -- rascunho | publicado
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(base, mes, ano)
);

-- Row Level Security
ALTER TABLE colaboradores ENABLE ROW LEVEL SECURITY;
ALTER TABLE escalas       ENABLE ROW LEVEL SECURITY;

-- Políticas (todos os usuários autenticados podem ler/escrever)
CREATE POLICY "auth read colaboradores"  ON colaboradores FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write colaboradores" ON colaboradores FOR ALL    TO authenticated USING (true);
CREATE POLICY "auth read escalas"        ON escalas       FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write escalas"       ON escalas       FOR ALL    TO authenticated USING (true);
```

## Deploy

```bash
# Push para o GitHub
git add .
git commit -m "feat: initial setup with auth and sidebar"
git push

# Vercel detecta automaticamente como site estático
# Deploy automático a cada push na main
```

## Módulos planejados

| # | Módulo | Status |
|---|--------|--------|
| ✅ | Auth (login + criar acesso) | Pronto |
| ✅ | Shell (sidebar dark + topbar + nav) | Pronto |
| ✅ | Escala Online (grade mensal, folgas, export, impressão) | Pronto |
| 🔄 | Gerador (dimensionamento → escala) | Em integração |
| 🔄 | Comparador (planejado vs real) | Em integração |
| 🔄 | Aderência ao Ponto | Em integração |
| 🔜 | Persistência de colaboradores | Próximo |
| 🔜 | Validação e publicação de escala | Próximo |
| 🔜 | Folgas automáticas pela malha | Próximo |
