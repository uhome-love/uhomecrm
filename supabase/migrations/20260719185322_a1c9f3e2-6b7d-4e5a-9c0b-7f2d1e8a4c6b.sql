-- Desagenda o cron 'visita-amanha-auto-2min', que chama a cada 2 minutos a
-- edge function 'visita-amanha-enqueue' — função removida do código em
-- 13/07/2026 (ver commit 5d4de2d7), mas o agendamento nunca foi cancelado.
-- Desde a remoção, esse job vem batendo num endpoint inexistente (404) a
-- cada 2 minutos, sem qualquer efeito útil. Auditoria de custo/limpeza
-- de 19/07/2026.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'visita-amanha-auto-2min') THEN
    PERFORM cron.unschedule('visita-amanha-auto-2min');
  END IF;
END $$;
