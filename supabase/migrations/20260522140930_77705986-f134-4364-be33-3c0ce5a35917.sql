UPDATE public.pipeline_leads
SET
  corretor_id = NULL,
  arquivado = true,
  tipo_descarte = 'definitivo',
  motivo_descarte = COALESCE(motivo_descarte, '') || ' | Auto-limpeza 22/05: resposta neutra classificada erroneamente como interesse na Campanha Átrio',
  reengajamento_status = 'respondido_nao',
  reativado_por_nutricao = false,
  aceite_status = 'pendente'
WHERE id IN (
  'd46331f4-5cfd-420d-8392-57fef99f94f5',
  'b8cf564f-2ca8-4afe-b91e-ae8321306bde'
);

UPDATE public.campanha_atrio_respostas
SET
  tipo_resposta = 'nao',
  enviado_para_roleta = false,
  motivo_falha_roleta = 'reclassificado_neutro_pos_fix_22mai'
WHERE id IN (
  'af589237-d52b-4ce3-b01d-2c0edb225bd7',
  'adddc65f-b0b5-4d21-bf74-2da56ab1a034'
);

INSERT INTO public.pipeline_historico (pipeline_lead_id, stage_anterior_id, stage_novo_id, movido_por, observacao)
SELECT id, stage_id, stage_id,
  '00000000-0000-0000-0000-000000000000'::uuid,
  'Reclassificado: resposta neutra ("Obrigado"/"Boa noite") não é interesse. Lead arquivado e desvinculado do corretor designado.'
FROM public.pipeline_leads
WHERE id IN (
  'd46331f4-5cfd-420d-8392-57fef99f94f5',
  'b8cf564f-2ca8-4afe-b91e-ae8321306bde'
);