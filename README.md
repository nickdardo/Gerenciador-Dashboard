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
├── favicon.ico / .png
├── assets/
│   ├── dnata-logo.png
│   └── dnata-logo-nav.png
├── css/
│   └── style.css           # Design system dark theme
└── js/
    ├── supabase.js         # Client + auth helpers
    ├── auth.js             # Login / criar acesso
    ├── app.js              # Shell, sidebar, topbar, roteamento
    └── pages.js            # Módulos de página
```

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
| 🔄 | Escala Online (calendário mensal) | Em integração |
| 🔄 | Gerador (dimensionamento → escala) | Em integração |
| 🔄 | Comparador (planejado vs real) | Em integração |
| 🔄 | Aderência ao Ponto | Em integração |
| 🔜 | Persistência de colaboradores | Próximo |
| 🔜 | Validação e publicação de escala | Próximo |
| 🔜 | Folgas automáticas pela malha | Próximo |
