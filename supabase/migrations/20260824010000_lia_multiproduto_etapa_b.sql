-- LIA multiproduto (Etapa B) — parte de banco.
-- 1) Âncora do produto na conversa viva (resolvido pelo anúncio na 1ª mensagem).
ALTER TABLE public.lia_estado ADD COLUMN IF NOT EXISTS produto_slug text;

-- 2) Isenção da cadência de "Sem Contato" para leads da LIA: a LIA JÁ contatou e
--    qualificou o lead, então ele não entra na régua de "faça o primeiro contato".
--    Adiciona a condição COALESCE(NEW.origem,'') <> 'LIA' no gatilho de inscrição.
CREATE OR REPLACE FUNCTION public.fn_cadencia_sc_stage()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  sem_contato uuid := '2fcba9be-1188-4a54-9452-394beefdc330';
  v_first_wait int; v_due timestamptz; v_vence date; v_hora time;
  v_passo public.cadencia_sem_contato_passos%ROWTYPE;
BEGIN
  IF NEW.stage_id = sem_contato
     AND NEW.corretor_id IS NOT NULL
     AND NEW.arquivado IS NOT TRUE
     AND COALESCE(NEW.origem,'') <> 'LIA'   -- LIA já contatou: fora da cadência de 1o contato
     AND (TG_OP = 'INSERT' OR OLD.stage_id IS DISTINCT FROM NEW.stage_id OR OLD.corretor_id IS DISTINCT FROM NEW.corretor_id)
  THEN
    SELECT * INTO v_passo FROM public.cadencia_sem_contato_passos WHERE numero = 1;
    v_first_wait := COALESCE(v_passo.espera_minutos, 0);
    v_due := now() + (v_first_wait || ' minutes')::interval;
    v_vence := (v_due AT TIME ZONE 'America/Sao_Paulo')::date;
    v_hora := (v_due AT TIME ZONE 'America/Sao_Paulo')::time(0);
    INSERT INTO public.lead_cadencia_sem_contato
      (pipeline_lead_id, corretor_id, iniciada_em, tentativa_atual, proxima_em, status, tentativas_log)
    VALUES (NEW.id, NEW.corretor_id, now(), 0, v_due, 'ativa', '[]'::jsonb)
    ON CONFLICT (pipeline_lead_id) DO UPDATE SET
      corretor_id = NEW.corretor_id, iniciada_em = now(), tentativa_atual = 0,
      proxima_em = v_due, status = 'ativa', tentativas_log = '[]'::jsonb, updated_at = now();
    IF NOT EXISTS (SELECT 1 FROM public.pipeline_tarefas t WHERE t.pipeline_lead_id = NEW.id
        AND t.origem = 'cadencia_sem_contato' AND t.status NOT IN ('concluida','cancelada')) THEN
      INSERT INTO public.pipeline_tarefas (pipeline_lead_id, titulo, descricao, tipo, prioridade, status,
        responsavel_id, vence_em, hora_vencimento, created_by, origem)
      VALUES (NEW.id,
        'Tentativa 1: ' || COALESCE(v_passo.acao,'Ligar agora') || ' — ' || COALESCE(NULLIF(trim(NEW.nome), ''), 'Lead'),
        'Cadência Sem Contato — Tentativa 1: ' || COALESCE(v_passo.acao, 'Primeiro contato'),
        'lembrete', 'media', 'pendente', NEW.corretor_id, v_vence, v_hora, NEW.corretor_id, 'cadencia_sem_contato');
    END IF;
  ELSIF (TG_OP = 'UPDATE')
        AND ( (OLD.stage_id = sem_contato AND NEW.stage_id IS DISTINCT FROM sem_contato) OR (NEW.arquivado IS TRUE) )
  THEN
    UPDATE public.lead_cadencia_sem_contato SET status = 'cancelada', proxima_em = NULL, updated_at = now()
     WHERE pipeline_lead_id = NEW.id AND status = 'ativa';
    UPDATE public.pipeline_tarefas SET status = 'cancelada', updated_at = now()
     WHERE pipeline_lead_id = NEW.id AND origem = 'cadencia_sem_contato' AND status NOT IN ('concluida','cancelada');
  END IF;
  RETURN NEW;
END;
$function$;
