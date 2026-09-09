-- ═══════════════════════════════════════════════════════════════════
-- escala_dia: liberar os status novos (FA e T)
--
-- Sintoma sem esta migração:
--   new row for relation "escala_dia" violates check constraint
--   "escala_dia_status_check"
--
-- A restrição foi criada quando o painel só gravava F, J, K e CH. Depois
-- entraram dois valores:
--
--   FA  Folga agrupada — a folga colada no domingo (sábado+domingo ou
--       domingo+segunda). Marcada com a tecla A na grade.
--
--   T   Exceção de férias — "trabalha mesmo constando férias no cadastro".
--       Não aparece na grade como status; existe só pra anular o L
--       daquele dia nesta escala, sem alterar colaboradores_ferias.
--
-- L (férias) é DERIVADO do cadastro de férias e normalmente não é gravado
-- aqui, mas fica permitido porque bases antigas podem ter linhas assim.
--
-- Rode no SQL Editor do Supabase.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

-- 1) Conferir o que existe hoje na coluna, antes de mexer.
--    Se aparecer algum valor fora da lista nova, PARE e me avise: apertar
--    a restrição com dado divergente na tabela faz o ALTER falhar.
SELECT status, count(*) AS linhas
FROM escala_dia
GROUP BY status
ORDER BY linhas DESC;

-- 2) Derrubar a restrição antiga.
ALTER TABLE escala_dia
  DROP CONSTRAINT IF EXISTS escala_dia_status_check;

-- 3) Recriar com a lista completa.
ALTER TABLE escala_dia
  ADD CONSTRAINT escala_dia_status_check
  CHECK (status IN ('F', 'FA', 'L', 'J', 'K', 'CH', 'T'));

COMMIT;

-- ═══════════════════════════════════════════════════════════════════
-- Conferência: as duas devem gravar sem erro e depois sumir.
-- Troque BEL e 2026-10 pela base e mês que você usa.
-- ═══════════════════════════════════════════════════════════════════
-- INSERT INTO escala_dia (base, mes, matricula, dia, status, origem)
-- VALUES ('BEL', '2026-10', '000000', 1, 'FA', 'teste'),
--        ('BEL', '2026-10', '000000', 2, 'T',  'teste');
--
-- DELETE FROM escala_dia WHERE origem = 'teste';
