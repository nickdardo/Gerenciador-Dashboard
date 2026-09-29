-- ══════════════════════════════════════════════════════
-- DE-PARA DE CARGOS: dimensionamento → grupo do OPEX
--
-- O dimensionamento escreve o cargo do jeito da operação
-- ("AGENTE SERV A PAX", "AUXILIAR DE RAMPA") e o OPEX conta por grupo
-- (SPAX, Rampa). O painel resolve a maior parte sozinho, comparando os
-- nomes com o catálogo da aba "Funções" do próprio OPEX.
--
-- O que sobra é ambíguo de verdade. "AUXILIAR DE RAMPA" sem numeral existe
-- em dois grupos do catálogo — Rampa e SPAX (como balanceiro) — e só quem
-- conhece a operação sabe qual é. Esta tabela guarda essa decisão para não
-- ter que retomá-la todo mês.
--
-- Vale a pena: num teste com a base BEL, 32 pessoas mal classificadas
-- mostravam um buraco de +32 em Rampa que não existia. Com o de-para, o
-- delta caiu para -2.
-- ══════════════════════════════════════════════════════

create table if not exists public.opex_depara (
  id          bigserial primary key,
  -- Cargo como aparece no dimensionamento, já normalizado pelo painel:
  -- sem acento, maiúsculo, ponto virando espaço. É a chave de busca.
  cargo       text        not null,
  -- Como veio escrito no arquivo, para você reconhecer na tela.
  cargo_orig  text,
  -- Grupo do OPEX escolhido. Nulo significa "ignorar este cargo": serve
  -- para linhas que não devem entrar na comparação.
  grupo       text,
  -- Quem decidiu e quando — o de-para é uma decisão de gente, e daqui a
  -- seis meses alguém vai perguntar de onde saiu.
  criado_por  uuid        references auth.users (id) on delete set null,
  criado_em   timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint opex_depara_cargo_unico unique (cargo)
);

comment on table  public.opex_depara      is 'Cargo do dimensionamento → grupo do OPEX, para os casos que o painel não resolve sozinho';
comment on column public.opex_depara.cargo is 'Cargo normalizado (sem acento, maiúsculo) — chave de busca';
comment on column public.opex_depara.grupo is 'Grupo do OPEX; nulo = ignorar este cargo na comparação';

create index if not exists opex_depara_cargo_idx on public.opex_depara (cargo);

-- mantém atualizado_em sem depender de quem escreve
create or replace function public.opex_depara_touch()
returns trigger language plpgsql as $$
begin
  new.atualizado_em := now();
  return new;
end $$;

drop trigger if exists opex_depara_touch on public.opex_depara;
create trigger opex_depara_touch
  before update on public.opex_depara
  for each row execute function public.opex_depara_touch();

-- ── Acesso ────────────────────────────────────────────
-- O de-para é compartilhado: todo mundo que usa o painel lê o mesmo, e é
-- justamente esse o ponto — a decisão vale para a equipe, não para quem
-- decidiu. Escrita fica com quem está autenticado.
alter table public.opex_depara enable row level security;

drop policy if exists "opex_depara_leitura" on public.opex_depara;
create policy "opex_depara_leitura"
  on public.opex_depara for select
  to authenticated
  using (true);

drop policy if exists "opex_depara_escrita" on public.opex_depara;
create policy "opex_depara_escrita"
  on public.opex_depara for insert
  to authenticated
  with check (true);

drop policy if exists "opex_depara_atualizacao" on public.opex_depara;
create policy "opex_depara_atualizacao"
  on public.opex_depara for update
  to authenticated
  using (true) with check (true);

drop policy if exists "opex_depara_remocao" on public.opex_depara;
create policy "opex_depara_remocao"
  on public.opex_depara for delete
  to authenticated
  using (true);
