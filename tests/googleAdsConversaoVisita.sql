-- Regra: conversão "Visita realizada (CRM)" no Google Ads só para lead com gclid e uma vez por lead.
-- Rodar manualmente; tudo é desfeito ao final (RAISE).
do $$
declare v record; n1 int; n2 int;
begin
  select id, pipeline_lead_id into v from visitas where status='marcada' and pipeline_lead_id is not null and data_visita < current_date limit 1;
  update pipeline_leads set gclid=null where id=v.pipeline_lead_id;
  update visitas set status='realizada' where id=v.id;
  select count(*) into n1 from google_ads_conversoes where pipeline_lead_id=v.pipeline_lead_id;
  if n1 <> 0 then raise exception 'FALHOU: lead sem gclid entrou na fila'; end if;
  update pipeline_leads set dados_site = coalesce(dados_site,'{}'::jsonb) || '{"gclid":"ABC123"}' where id=v.pipeline_lead_id;
  update visitas set status='marcada' where id=v.id; update visitas set status='realizada' where id=v.id;
  update visitas set status='marcada' where id=v.id; update visitas set status='realizada' where id=v.id;
  select count(*) into n2 from google_ads_conversoes where pipeline_lead_id=v.pipeline_lead_id;
  if n2 <> 1 then raise exception 'FALHOU: esperado 1 envio por lead, veio %', n2; end if;
  raise exception 'OK (desfeito)';
end $$;
