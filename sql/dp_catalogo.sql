-- ══════════════════════════════════════════════════════
-- CATÁLOGO DO DP: horários, turnos, cargos e o número de escala
--
-- O sistema do DP recebe um número por pessoa por dia. Traduzir a escala
-- nesse número exige quatro coisas que o painel não tem como inventar:
-- a tabela de ~800 horários com entrada e saída, as 104 siglas de turno,
-- os códigos de cargo e — a mais importante — o número de escala de cada
-- colaborador, que é único por contrato e só existe no cadastro do DP.
--
-- Tudo isso chega de uma vez, lendo o arquivo que o DP já usa. Guardar o
-- catálogo inteiro como um documento só, por base, é de propósito: ele
-- vale como um conjunto. Meia tabela de horários nova com metade velha
-- geraria código errado sem ninguém perceber — e código errado o DP
-- aceita calado, que é exatamente o problema de hoje.
--
-- Fica registrado de que arquivo veio e quem subiu: daqui a seis meses
-- alguém vai perguntar por que um horário mudou de código.
-- ══════════════════════════════════════════════════════

create table if not exists public.dp_catalogo (
  base           text        primary key,
  -- O catálogo inteiro: horários, turnos, cadastro, cargos, feriados e
  -- os códigos de ausência já conferidos.
  dados          jsonb       not null,
  -- Contagens soltas, para a tela mostrar sem abrir o json inteiro.
  resumo         jsonb,
  origem_arquivo text,
  atualizado_por uuid        references auth.users (id) on delete set null,
  atualizado_em  timestamptz not null default now()
);

comment on table  public.dp_catalogo        is 'Catálogo do DP por base: horários, turnos, cargos e número de escala por colaborador';
comment on column public.dp_catalogo.dados  is 'Documento completo — vale como conjunto, nunca pela metade';
comment on column public.dp_catalogo.origem_arquivo is 'Nome do arquivo de onde veio, para rastrear mudança de código';

create or replace function public.dp_catalogo_touch()
returns trigger language plpgsql as $$
begin
  new.atualizado_em := now();
  return new;
end $$;

drop trigger if exists dp_catalogo_touch on public.dp_catalogo;
create trigger dp_catalogo_touch
  before update on public.dp_catalogo
  for each row execute function public.dp_catalogo_touch();

-- ── Acesso ────────────────────────────────────────────
-- O catálogo é compartilhado: quem monta escala em qualquer base lê o
-- mesmo. Escrita fica com quem está autenticado.
alter table public.dp_catalogo enable row level security;

drop policy if exists "dp_catalogo_leitura" on public.dp_catalogo;
create policy "dp_catalogo_leitura"
  on public.dp_catalogo for select
  to authenticated
  using (true);

drop policy if exists "dp_catalogo_escrita" on public.dp_catalogo;
create policy "dp_catalogo_escrita"
  on public.dp_catalogo for insert
  to authenticated
  with check (true);

drop policy if exists "dp_catalogo_atualizacao" on public.dp_catalogo;
create policy "dp_catalogo_atualizacao"
  on public.dp_catalogo for update
  to authenticated
  using (true) with check (true);

drop policy if exists "dp_catalogo_remocao" on public.dp_catalogo;
create policy "dp_catalogo_remocao"
  on public.dp_catalogo for delete
  to authenticated
  using (true);
