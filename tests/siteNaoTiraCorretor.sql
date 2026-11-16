-- Contato do site não pode tirar o corretor de lead aceito
BEGIN;
DO $$
DECLARE v uuid; c uuid;
BEGIN
  SELECT id, corretor_id INTO v, c FROM pipeline_leads WHERE aceite_status='aceito' AND corretor_id IS NOT NULL LIMIT 1;
  UPDATE pipeline_leads SET corretor_id=NULL, aceite_status='pendente_distribuicao', motivo_pendencia='fila_ceo_site' WHERE id=v;
  IF (SELECT corretor_id FROM pipeline_leads WHERE id=v) IS DISTINCT FROM c THEN
    RAISE EXCEPTION 'corretor foi removido pelo site';
  END IF;
END $$;
ROLLBACK;
