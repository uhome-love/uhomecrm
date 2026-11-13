-- Regra: SIM de reengajamento nunca tira lead ativo do corretor.
-- Rodar inteiro; termina com RAISE (rollback) mostrando o resultado. Esperado:
-- ativo: true, dono_mantido=t, etapa_mantida=t | descarte: null, foi_novo_lead=t
DO $t$
DECLARE a uuid; d uuid; r1 jsonb; r2 jsonb; c1 uuid; s1 uuid; s2 uuid;
 dono uuid := (select corretor_id from pipeline_leads where corretor_id is not null limit 1);
 etapa uuid := (select id from pipeline_stages where nome='Qualificação' limit 1);
BEGIN
 insert into pipeline_leads(nome,telefone,corretor_id,stage_id) values('TESTE ATIVO','5551900000001',dono,etapa) returning id into a;
 insert into pipeline_leads(nome,telefone,corretor_id,stage_id,motivo_descarte) values('TESTE DESC','5551900000002',dono,'1dd66c25-3848-4053-9f66-82e902989b4d','teste') returning id into d;
 r1 := reativar_lead_para_fila_ceo(a,'openarvoredo_convite');
 r2 := reativar_lead_para_fila_ceo(d,'openarvoredo_convite');
 select corretor_id,stage_id into c1,s1 from pipeline_leads where id=a;
 select stage_id into s2 from pipeline_leads where id=d;
 RAISE EXCEPTION 'RESULT ativo: %, dono_mantido=%, etapa_mantida=% | descarte: %, foi_novo_lead=%', r1->>'already_active', c1=dono, s1=etapa, coalesce(r2->>'already_active','null'), s2='d3843b2f-2fa1-4c31-9129-4eb0ed21f019';
END $t$;
