-- ═══════════════════════════════════════════════════════════════════
-- Escalas paralelas: campo `cenario`
--
-- Passa a existir mais de uma escala pro mesmo base+mês:
--   planejada     escala de sempre (padrão — todo dado atual vira esta)
--   dimensionada  horários vindos do dimensionamento da malha (Gerador)
--
-- A separação é um CAMPO, não tabelas novas: assim gerador de folgas,
-- validação de regras, auditoria e Excel continuam valendo pros dois.
--
-- Rode ANTES de subir os arquivos js. Sem isso o painel vai tentar
-- filtrar por uma coluna que não existe e nenhuma escala abre.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1) Coluna nova, com default: o que já existe vira "planejada" ──
ALTER TABLE escala_colaborador ADD COLUMN IF NOT EXISTS cenario text NOT NULL DEFAULT 'planejada';
ALTER TABLE escala_dia         ADD COLUMN IF NOT EXISTS cenario text NOT NULL DEFAULT 'planejada';
ALTER TABLE escala_trava       ADD COLUMN IF NOT EXISTS cenario text NOT NULL DEFAULT 'planejada';

-- ── 2) Só os dois valores previstos ────────────────────────────────
ALTER TABLE escala_colaborador DROP CONSTRAINT IF EXISTS escala_colaborador_cenario_check;
ALTER TABLE escala_colaborador ADD  CONSTRAINT escala_colaborador_cenario_check
  CHECK (cenario IN ('planejada', 'dimensionada'));

ALTER TABLE escala_dia DROP CONSTRAINT IF EXISTS escala_dia_cenario_check;
ALTER TABLE escala_dia ADD  CONSTRAINT escala_dia_cenario_check
  CHECK (cenario IN ('planejada', 'dimensionada'));

ALTER TABLE escala_trava DROP CONSTRAINT IF EXISTS escala_trava_cenario_check;
ALTER TABLE escala_trava ADD  CONSTRAINT escala_trava_cenario_check
  CHECK (cenario IN ('planejada', 'dimensionada'));

-- ── 3) Chaves únicas passam a incluir o cenário ────────────────────
-- Sem isso a mesma matrícula não poderia existir nos dois cenários, e o
-- upsert de um sobrescreveria o outro. É a parte que não pode faltar.
--
-- Se o nome da constraint no seu banco for diferente, ajuste abaixo —
-- confira antes com:
--   SELECT conname FROM pg_constraint
--   WHERE conrelid = 'escala_dia'::regclass AND contype IN ('u','p');

ALTER TABLE escala_colaborador DROP CONSTRAINT IF EXISTS escala_colaborador_base_mes_matricula_key;
DROP INDEX IF EXISTS escala_colaborador_base_mes_matricula_idx;
CREATE UNIQUE INDEX IF NOT EXISTS escala_colaborador_escopo_uidx
  ON escala_colaborador (base, mes, cenario, matricula);

ALTER TABLE escala_dia DROP CONSTRAINT IF EXISTS escala_dia_base_mes_matricula_dia_key;
DROP INDEX IF EXISTS escala_dia_base_mes_matricula_dia_idx;
CREATE UNIQUE INDEX IF NOT EXISTS escala_dia_escopo_uidx
  ON escala_dia (base, mes, cenario, matricula, dia);

ALTER TABLE escala_trava DROP CONSTRAINT IF EXISTS escala_trava_base_mes_key;
CREATE UNIQUE INDEX IF NOT EXISTS escala_trava_escopo_uidx
  ON escala_trava (base, mes, cenario);

-- ── 4) Índice de leitura: a grade sempre filtra por esses três ─────
CREATE INDEX IF NOT EXISTS escala_dia_leitura_idx
  ON escala_dia (base, mes, cenario);

COMMIT;

-- ═══════════════════════════════════════════════════════════════════
-- Conferência
-- ═══════════════════════════════════════════════════════════════════
-- Tudo que já existia deve estar como 'planejada':
-- SELECT cenario, count(*) FROM escala_dia GROUP BY cenario;
--
-- E a mesma matrícula deve poder existir nos dois cenários:
-- INSERT INTO escala_dia (base, mes, cenario, matricula, dia, status, origem)
-- VALUES ('BEL','2026-10','dimensionada','000000',1,'F','teste');
-- DELETE FROM escala_dia WHERE origem = 'teste';
