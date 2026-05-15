UPDATE visita_amanha_disparos
SET status = 'sim', resposta_at = '2026-05-15 19:43:02.130564+00'
WHERE id = 'f72a6d9c-e0ab-4272-b090-61ec6efb8b00';

UPDATE pipeline_leads
SET visita_amanha_resposta = 'sim'
WHERE id = '5ec51899-84b4-499b-8c4a-8309206021c3';

INSERT INTO pipeline_atividades (pipeline_lead_id, tipo, titulo, descricao, data, status, prioridade, created_by)
SELECT
  pl.id,
  'sistema',
  '🔥 Cliente quer visitar AMANHÃ',
  'Cliente respondeu SIM ao convite de visita amanhã via WhatsApp em 15/05 19:43 BRT. (Registro reprocessado — resposta inicial havia sido sobrescrita por clique posterior em "Agora não".) Entre em contato para confirmar o horário.',
  '2026-05-15',
  'pendente',
  'alta',
  COALESCE(p.user_id, pl.corretor_id)
FROM pipeline_leads pl
LEFT JOIN profiles p ON p.id = pl.corretor_id
WHERE pl.id = '5ec51899-84b4-499b-8c4a-8309206021c3';

INSERT INTO notifications (user_id, tipo, categoria, titulo, mensagem, dados)
SELECT
  COALESCE(p.user_id, pl.corretor_id),
  'visita_amanha_sim',
  'lead',
  '🔥 Visita amanhã! (resposta recuperada)',
  pl.nome || ' respondeu SIM em 15/05 19:43. Entre em contato para marcar.',
  jsonb_build_object('pipeline_lead_id', pl.id, 'lead_nome', pl.nome)
FROM pipeline_leads pl
LEFT JOIN profiles p ON p.id = pl.corretor_id
WHERE pl.id = '5ec51899-84b4-499b-8c4a-8309206021c3';