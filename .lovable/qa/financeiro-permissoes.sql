-- Teste transacional: nenhuma alteração de cliente real; identidades oficiais
-- apenas para checar permissões no servidor, sem emitir sessões de acesso.
DO $$
DECLARE v_uid uuid; v_bloqueou boolean; v_dados jsonb;
BEGIN
 FOREACH v_uid IN ARRAY ARRAY['00a26f80-a466-43bd-977f-227d1440efb5'::uuid,'fb61ecda-5c4b-49d7-bda7-ccf9b589da07'::uuid] LOOP
  PERFORM set_config('request.jwt.claim.sub',v_uid::text,true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',v_uid,'role','authenticated')::text,true);
  v_bloqueou:=false;
  BEGIN PERFORM public.financeiro_dados('2026-10-01','2026-10-23');
  EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'Financeiro é exclusivo%' THEN v_bloqueou:=true; ELSE RAISE; END IF; END;
  IF NOT v_bloqueou THEN RAISE EXCEPTION 'Leitura financeira permitida ao corretor/gerente'; END IF;
  v_bloqueou:=false;
  BEGIN PERFORM public.registrar_distrato('96b98110-9075-45ec-9b88-8251761a396f','2026-10-23','Teste recusado sem alterar venda');
  EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'Financeiro é exclusivo%' THEN v_bloqueou:=true; ELSE RAISE; END IF; END;
  IF NOT v_bloqueou THEN RAISE EXCEPTION 'Distrato permitido ao corretor/gerente'; END IF;
  v_bloqueou:=false;
  BEGIN PERFORM public.financeiro_receber_parcela('0d3921e9-4bef-4d01-9851-547da8c81cde','2026-10-23','recusado');
  EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'Financeiro é exclusivo%' THEN v_bloqueou:=true; ELSE RAISE; END IF; END;
  IF NOT v_bloqueou THEN RAISE EXCEPTION 'Recebimento permitido ao corretor/gerente'; END IF;
 END LOOP;
 IF has_table_privilege('authenticated','public.financeiro_historico','INSERT')
 OR has_table_privilege('authenticated','public.financeiro_repasses','INSERT')
 OR has_table_privilege('authenticated','public.negocios_recebimentos','UPDATE')
 OR has_table_privilege('authenticated','public.intermediacao_beneficiarios','INSERT') THEN
  RAISE EXCEPTION 'Escrita financeira direta permitida';
 END IF;
 SELECT user_id INTO v_uid FROM public.user_roles WHERE role='diretor' LIMIT 1;
 IF v_uid IS NULL THEN RAISE EXCEPTION 'Diretora inexistente para teste'; END IF;
 PERFORM set_config('request.jwt.claim.sub',v_uid::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',v_uid,'role','authenticated')::text,true);
 v_dados:=public.financeiro_dados('2026-10-01','2026-10-23');
 IF jsonb_typeof(v_dados->'recebimentos') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Diretora sem leitura financeira'; END IF;
END $$;