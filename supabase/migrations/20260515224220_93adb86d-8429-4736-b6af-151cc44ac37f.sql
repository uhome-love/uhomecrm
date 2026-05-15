-- Backfill respostas perdidas do disparo Visita Amanhã (15/05/2026)
-- O webhook só matcheava por wamid (context.id) e perdeu botões sem context ou com telefone sem o "9".
-- Já corrigido o webhook (fallback por telefone). Aqui recuperamos os históricos.

WITH respostas_botao AS (
  SELECT 
    REGEXP_REPLACE(phone, '\D','','g') AS phone_norm,
    mensagem, created_at,
    CASE 
      WHEN mensagem ILIKE 'sim%' OR mensagem ILIKE '%quero visitar%' THEN 'sim'
      WHEN mensagem ILIKE '%agora não%' OR mensagem ILIKE '%nao%' OR mensagem ILIKE '%não%' THEN 'nao'
      ELSE NULL
    END AS resp
  FROM whatsapp_respostas
  WHERE tipo='botao' AND created_at > NOW() - INTERVAL '24 hours'
),
matched AS (
  SELECT DISTINCT ON (d.id)
    d.id AS dispatch_id, d.pipeline_lead_id, r.resp, r.created_at AS resp_at
  FROM respostas_botao r
  JOIN visita_amanha_disparos d
    ON d.phone ILIKE '%' || RIGHT(r.phone_norm, 8)
   AND d.status = 'sent'
   AND d.sent_at > NOW() - INTERVAL '48 hours'
  WHERE r.resp IS NOT NULL
  ORDER BY d.id, r.created_at DESC  -- pega a última resposta do cliente
)
UPDATE visita_amanha_disparos d
SET status = m.resp,
    resposta_at = m.resp_at
FROM matched m
WHERE d.id = m.dispatch_id;

-- Atualiza pipeline_leads com a resposta
WITH respostas_botao AS (
  SELECT 
    REGEXP_REPLACE(phone, '\D','','g') AS phone_norm,
    mensagem, created_at,
    CASE 
      WHEN mensagem ILIKE 'sim%' OR mensagem ILIKE '%quero visitar%' THEN 'sim'
      WHEN mensagem ILIKE '%agora não%' OR mensagem ILIKE '%nao%' OR mensagem ILIKE '%não%' THEN 'nao'
      ELSE NULL
    END AS resp
  FROM whatsapp_respostas
  WHERE tipo='botao' AND created_at > NOW() - INTERVAL '24 hours'
),
matched AS (
  SELECT DISTINCT ON (d.pipeline_lead_id)
    d.pipeline_lead_id, r.resp
  FROM respostas_botao r
  JOIN visita_amanha_disparos d
    ON d.phone ILIKE '%' || RIGHT(r.phone_norm, 8)
   AND d.sent_at > NOW() - INTERVAL '48 hours'
  WHERE r.resp IS NOT NULL
  ORDER BY d.pipeline_lead_id, r.created_at DESC
)
UPDATE pipeline_leads p
SET visita_amanha_resposta = m.resp
FROM matched m
WHERE p.id = m.pipeline_lead_id;