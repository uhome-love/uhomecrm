-- 1) Tabela de passos (configuração)
CREATE TABLE IF NOT EXISTS public.cadencia_sem_contato_passos (
  numero          int PRIMARY KEY,
  espera_minutos  int  NOT NULL,
  acao            text NOT NULL,
  canal           text NOT NULL,
  texto_app       text NOT NULL,
  texto_whatsapp  text NOT NULL,
  descartar       boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.cadencia_sem_contato_passos TO authenticated, anon;
GRANT ALL    ON public.cadencia_sem_contato_passos TO service_role;

ALTER TABLE public.cadencia_sem_contato_passos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "passos legiveis" ON public.cadencia_sem_contato_passos;
CREATE POLICY "passos legiveis" ON public.cadencia_sem_contato_passos
  FOR SELECT USING (true);

INSERT INTO public.cadencia_sem_contato_passos
  (numero, espera_minutos, acao, canal, texto_app, texto_whatsapp, descartar)
VALUES
  (1, 0,    'Ligação imediata', 'ligacao',
   'Tentativa 1 — Ligue agora para o lead.',
   E'📞 *Tentativa 1 — Ligue agora*\n\n👤 {nome}\n🏢 {empreendimento}\n\nFaça a primeira ligação imediatamente.', false),
  (2, 10,   'WhatsApp', 'whatsapp',
   'Tentativa 2 — Envie um WhatsApp agora.',
   E'💬 *Tentativa 2 — WhatsApp*\n\n👤 {nome}\n🏢 {empreendimento}\n\nMande uma mensagem agora pelo WhatsApp.', false),
  (3, 720,  'Trocar de canal', 'ambos',
   'Tentativa 3 — Troque o canal: ligue OU WhatsApp.',
   E'🔁 *Tentativa 3 — Troque o canal*\n\n👤 {nome}\n🏢 {empreendimento}\n\nTente outro canal: ligação ou WhatsApp.', false),
  (4, 720,  'Fato novo', 'ambos',
   'Tentativa 4 — Traga um fato novo (novidade do empreendimento).',
   E'🆕 *Tentativa 4 — Fato novo*\n\n👤 {nome}\n🏢 {empreendimento}\n\nApresente uma novidade para reabrir a conversa.', false),
  (5, 1440, 'Convite / evento / decorado', 'whatsapp',
   'Tentativa 5 — Convide para evento ou visita ao decorado.',
   E'🎟️ *Tentativa 5 — Convite*\n\n👤 {nome}\n🏢 {empreendimento}\n\nConvide para um evento ou visita ao decorado.', false),
  (6, 1440, 'Ligar de outro número', 'ligacao',
   'Tentativa 6 — Ligue de outro número com um fato novo.',
   E'📞 *Tentativa 6 — Outro número*\n\n👤 {nome}\n🏢 {empreendimento}\n\nTente ligar de outro número com um fato novo.', false),
  (7, 1440, 'Mensagem de despedida', 'whatsapp',
   'Tentativa 7 — Mensagem de despedida. Sem retorno o lead será descartado (reengajável).',
   E'👋 *Tentativa 7 — Despedida*\n\n👤 {nome}\n🏢 {empreendimento}\n\nEnvie a mensagem de despedida. Sem retorno, o lead sai do pipeline.', true)
ON CONFLICT (numero) DO UPDATE SET
  espera_minutos = EXCLUDED.espera_minutos, acao = EXCLUDED.acao, canal = EXCLUDED.canal,
  texto_app = EXCLUDED.texto_app, texto_whatsapp = EXCLUDED.texto_whatsapp,
  descartar = EXCLUDED.descartar, updated_at = now();

-- 2) Estado por lead
CREATE TABLE IF NOT EXISTS public.lead_cadencia_sem_contato (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_lead_id  uuid NOT NULL UNIQUE REFERENCES public.pipeline_leads(id) ON DELETE CASCADE,
  corretor_id       uuid,
  iniciada_em       timestamptz NOT NULL DEFAULT now(),
  tentativa_atual   int NOT NULL DEFAULT 0,
  proxima_em        timestamptz,
  ultima_acao_em    timestamptz,
  status            text NOT NULL DEFAULT 'ativa',
  tentativas_log    jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cadencia_sc_due ON public.lead_cadencia_sem_contato (status, proxima_em);
CREATE INDEX IF NOT EXISTS idx_cadencia_sc_corretor ON public.lead_cadencia_sem_contato (corretor_id);

GRANT SELECT ON public.lead_cadencia_sem_contato TO authenticated;
GRANT ALL    ON public.lead_cadencia_sem_contato TO service_role;

ALTER TABLE public.lead_cadencia_sem_contato ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cadencia_sc_select_own" ON public.lead_cadencia_sem_contato;
CREATE POLICY "cadencia_sc_select_own" ON public.lead_cadencia_sem_contato
  FOR SELECT USING (
    corretor_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'gestor')
    OR public.has_role(auth.uid(), 'diretor')
  );

-- 3) Trigger: iniciar/cancelar ao entrar/sair de "Sem Contato"
CREATE OR REPLACE FUNCTION public.fn_cadencia_sc_stage()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  sem_contato uuid := '2fcba9be-1188-4a54-9452-394beefdc330';
  v_first_wait int;
BEGIN
  IF NEW.stage_id = sem_contato
     AND NEW.corretor_id IS NOT NULL
     AND NEW.arquivado IS NOT TRUE
     AND (TG_OP = 'INSERT' OR OLD.stage_id IS DISTINCT FROM NEW.stage_id OR OLD.corretor_id IS DISTINCT FROM NEW.corretor_id)
  THEN
    SELECT espera_minutos INTO v_first_wait FROM cadencia_sem_contato_passos WHERE numero = 1;
    INSERT INTO lead_cadencia_sem_contato
      (pipeline_lead_id, corretor_id, iniciada_em, tentativa_atual, proxima_em, status, tentativas_log)
    VALUES
      (NEW.id, NEW.corretor_id, now(), 0, now() + (COALESCE(v_first_wait,0) || ' minutes')::interval, 'ativa', '[]'::jsonb)
    ON CONFLICT (pipeline_lead_id) DO UPDATE SET
      corretor_id = NEW.corretor_id, iniciada_em = now(), tentativa_atual = 0,
      proxima_em = now() + (COALESCE(v_first_wait,0) || ' minutes')::interval,
      status = 'ativa', tentativas_log = '[]'::jsonb, updated_at = now();
  ELSIF (TG_OP = 'UPDATE')
        AND ( (OLD.stage_id = sem_contato AND NEW.stage_id IS DISTINCT FROM sem_contato) OR (NEW.arquivado IS TRUE) )
  THEN
    UPDATE lead_cadencia_sem_contato
       SET status = 'cancelada', proxima_em = NULL, updated_at = now()
     WHERE pipeline_lead_id = NEW.id AND status = 'ativa';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_cadencia_sc_stage ON public.pipeline_leads;
CREATE TRIGGER trg_cadencia_sc_stage
  AFTER INSERT OR UPDATE OF stage_id, corretor_id, arquivado ON public.pipeline_leads
  FOR EACH ROW EXECUTE FUNCTION public.fn_cadencia_sc_stage();

-- 4) Trigger: avançar imediatamente ao registrar ação real do corretor
CREATE OR REPLACE FUNCTION public.fn_cadencia_sc_avancar_acao()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  c lead_cadencia_sem_contato%ROWTYPE;
  v_next int; v_wait_next int; v_new_status text;
BEGIN
  IF NEW.tipo IS NULL OR NEW.tipo NOT IN (
      'ligacao','whatsapp','contato','nota','mensagem','email',
      'retorno','nao_atendeu','followup','reuniao','visita','envio_material'
  ) THEN
    RETURN NEW;
  END IF;

  SELECT * INTO c FROM lead_cadencia_sem_contato
   WHERE pipeline_lead_id = NEW.pipeline_lead_id AND status = 'ativa' FOR UPDATE;
  IF NOT FOUND OR c.tentativa_atual >= 7 THEN RETURN NEW; END IF;

  v_next := c.tentativa_atual + 1;
  IF v_next < 7 THEN
    SELECT espera_minutos INTO v_wait_next FROM cadencia_sem_contato_passos WHERE numero = v_next + 1;
    v_new_status := 'ativa';
  ELSE
    v_wait_next := NULL; v_new_status := 'concluida';
  END IF;

  UPDATE lead_cadencia_sem_contato
     SET tentativa_atual = v_next, ultima_acao_em = now(),
         proxima_em = CASE WHEN v_wait_next IS NULL THEN NULL ELSE now() + (v_wait_next || ' minutes')::interval END,
         status = v_new_status,
         tentativas_log = tentativas_log || jsonb_build_object('n', v_next, 'pulada_por_acao', true, 'tipo', NEW.tipo, 'em', now()),
         updated_at = now()
   WHERE id = c.id;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_cadencia_sc_avancar_acao ON public.pipeline_atividades;
CREATE TRIGGER trg_cadencia_sc_avancar_acao
  AFTER INSERT ON public.pipeline_atividades
  FOR EACH ROW EXECUTE FUNCTION public.fn_cadencia_sc_avancar_acao();

-- 5) Descartar reengajável ao esgotar
CREATE OR REPLACE FUNCTION public.cadencia_sc_descartar_reengajavel(p_lead_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  sem_contato uuid := '2fcba9be-1188-4a54-9452-394beefdc330';
  descarte    uuid := '1dd66c25-3848-4053-9f66-82e902989b4d';
  v_corretor  uuid;
BEGIN
  SELECT corretor_id INTO v_corretor FROM pipeline_leads WHERE id = p_lead_id;

  UPDATE pipeline_leads
     SET stage_id = descarte, stage_changed_at = now(),
         tipo_descarte = 'reengajavel',
         motivo_descarte = 'Cadência Sem Contato esgotada (96h / T7 sem retorno)',
         updated_at = now()
   WHERE id = p_lead_id AND stage_id = sem_contato;

  IF NOT FOUND THEN RETURN; END IF;

  INSERT INTO pipeline_historico (pipeline_lead_id, stage_anterior_id, stage_novo_id, movido_por, observacao)
  VALUES (p_lead_id, sem_contato, descarte, v_corretor,
          'Descartado reengajável — cadência Sem Contato esgotada (T7 / 96h sem retorno).');

  INSERT INTO pipeline_atividades (pipeline_lead_id, tipo, titulo, descricao, data, prioridade, status, created_by)
  VALUES (p_lead_id, 'sistema', 'Cadência esgotada — descartado reengajável',
          'As 7 tentativas da cadência Sem Contato foram esgotadas sem retorno do lead.',
          CURRENT_DATE, 'media', 'concluida', v_corretor);

  UPDATE lead_cadencia_sem_contato
     SET status = 'concluida', proxima_em = NULL, updated_at = now()
   WHERE pipeline_lead_id = p_lead_id;
END;
$function$;

-- 6) Processar tentativas vencidas (consumido pelo cron lead-escalation)
CREATE OR REPLACE FUNCTION public.processar_cadencia_sem_contato()
RETURNS TABLE(
  lead_id uuid, corretor_id uuid, numero int, acao text, canal text,
  texto_app text, texto_whatsapp text, lead_nome text, empreendimento text,
  telefone text, do_descarte boolean
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  sem_contato uuid := '2fcba9be-1188-4a54-9452-394beefdc330';
  r RECORD; passo cadencia_sem_contato_passos%ROWTYPE;
  v_next int; v_wait_next int; v_new_prox timestamptz; v_new_stat text; v_app text; v_wpp text;
BEGIN
  FOR r IN
    SELECT c.id AS cid, c.pipeline_lead_id, c.corretor_id, c.tentativa_atual,
           pl.nome AS lnome, pl.empreendimento AS lemp, pl.telefone AS ltel
      FROM lead_cadencia_sem_contato c
      JOIN pipeline_leads pl ON pl.id = c.pipeline_lead_id
     WHERE c.status = 'ativa' AND c.proxima_em IS NOT NULL AND c.proxima_em <= now()
       AND c.tentativa_atual < 7 AND c.corretor_id IS NOT NULL
       AND pl.stage_id = sem_contato AND pl.arquivado IS NOT TRUE
     ORDER BY c.proxima_em LIMIT 200
  LOOP
    v_next := r.tentativa_atual + 1;
    SELECT * INTO passo FROM cadencia_sem_contato_passos WHERE numero = v_next;

    IF v_next < 7 THEN
      SELECT espera_minutos INTO v_wait_next FROM cadencia_sem_contato_passos WHERE numero = v_next + 1;
      v_new_prox := now() + (v_wait_next || ' minutes')::interval; v_new_stat := 'ativa';
    ELSE
      v_new_prox := NULL; v_new_stat := 'concluida';
    END IF;

    UPDATE lead_cadencia_sem_contato
       SET tentativa_atual = v_next, proxima_em = v_new_prox, status = v_new_stat,
           tentativas_log = tentativas_log || jsonb_build_object('n', v_next, 'enviada_em', now()),
           updated_at = now()
     WHERE id = r.cid;

    INSERT INTO pipeline_historico (pipeline_lead_id, stage_anterior_id, stage_novo_id, movido_por, observacao)
    VALUES (r.pipeline_lead_id, sem_contato, sem_contato, r.corretor_id,
            'Cadência Sem Contato — Tentativa ' || v_next || ': ' || passo.acao);

    INSERT INTO pipeline_atividades (pipeline_lead_id, tipo, titulo, descricao, data, prioridade, status, created_by)
    VALUES (r.pipeline_lead_id, 'sistema', 'Cadência: Tentativa ' || v_next, passo.acao,
            CURRENT_DATE, 'media', 'concluida', r.corretor_id);

    v_app := replace(replace(passo.texto_app, '{nome}', COALESCE(r.lnome,'Lead')), '{empreendimento}', COALESCE(r.lemp,'N/A'));
    v_wpp := replace(replace(passo.texto_whatsapp, '{nome}', COALESCE(r.lnome,'Lead')), '{empreendimento}', COALESCE(r.lemp,'N/A'));

    lead_id := r.pipeline_lead_id; corretor_id := r.corretor_id; numero := v_next;
    acao := passo.acao; canal := passo.canal; texto_app := v_app; texto_whatsapp := v_wpp;
    lead_nome := r.lnome; empreendimento := r.lemp; telefone := r.ltel; do_descarte := passo.descartar;
    RETURN NEXT;
  END LOOP;
END;
$function$;

-- 7) Painel gerencial: Sem Contato por corretor
CREATE OR REPLACE FUNCTION public.get_dashboard_sem_contato()
RETURNS TABLE(
  corretor_id uuid, corretor_nome text, avatar_url text,
  total int, no_prazo int, atrasado int, risco int
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_uid uuid := auth.uid();
  is_priv boolean := public.has_role(v_uid, 'admin') OR public.has_role(v_uid, 'diretor');
  is_gest boolean := public.has_role(v_uid, 'gestor');
BEGIN
  RETURN QUERY
  SELECT c.corretor_id, p.nome, p.avatar_url,
         COUNT(*)::int,
         COUNT(*) FILTER (WHERE c.proxima_em IS NOT NULL AND c.proxima_em >= now() AND c.tentativa_atual < 6)::int,
         COUNT(*) FILTER (WHERE c.proxima_em IS NOT NULL AND c.proxima_em < now())::int,
         COUNT(*) FILTER (WHERE c.tentativa_atual >= 6)::int
    FROM lead_cadencia_sem_contato c
    JOIN pipeline_leads pl ON pl.id = c.pipeline_lead_id AND pl.arquivado IS NOT TRUE
    LEFT JOIN profiles p ON p.user_id = c.corretor_id
   WHERE c.status = 'ativa' AND c.corretor_id IS NOT NULL
     AND (
       is_priv OR (c.corretor_id = v_uid)
       OR (is_gest AND c.corretor_id IN (
            SELECT tm.user_id FROM team_members tm JOIN profiles g ON g.id = tm.gerente_id WHERE g.user_id = v_uid))
     )
   GROUP BY c.corretor_id, p.nome, p.avatar_url
   ORDER BY COUNT(*) FILTER (WHERE c.proxima_em IS NOT NULL AND c.proxima_em < now()) DESC, COUNT(*) DESC;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_dashboard_sem_contato() TO authenticated;

-- 8) Guard nas funções 72h para não colidir com a cadência ativa
CREATE OR REPLACE FUNCTION public.reciclar_leads_sem_contato()
 RETURNS TABLE(lead_id uuid, corretor_anterior uuid, lead_nome text, lead_empreendimento text)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  r RECORD;
  sem_contato_stage_id uuid := '2fcba9be-1188-4a54-9452-394beefdc330';
  v_nome_anterior text;
  v_cutoff timestamptz := NOW() - INTERVAL '72 hours';
BEGIN
  FOR r IN
    SELECT pl.id, pl.corretor_id, pl.nome, pl.empreendimento
    FROM pipeline_leads pl
    WHERE pl.stage_id = sem_contato_stage_id
      AND pl.corretor_id IS NOT NULL
      AND pl.arquivado IS NOT TRUE
      AND NOT EXISTS (SELECT 1 FROM lead_cadencia_sem_contato c WHERE c.pipeline_lead_id = pl.id AND c.status = 'ativa')
      AND GREATEST(COALESCE(pl.ultima_acao_at, pl.created_at), COALESCE(pl.stage_changed_at, pl.created_at), COALESCE(pl.updated_at, pl.created_at)) < v_cutoff
      AND NOT EXISTS (SELECT 1 FROM pipeline_tarefas t WHERE t.pipeline_lead_id = pl.id AND (t.status = 'pendente' OR GREATEST(COALESCE(t.created_at,'epoch'::timestamptz), COALESCE(t.concluida_em,'epoch'::timestamptz)) >= v_cutoff))
      AND NOT EXISTS (SELECT 1 FROM pipeline_atividades a WHERE a.pipeline_lead_id = pl.id AND COALESCE(a.created_at,'epoch'::timestamptz) >= v_cutoff)
      AND NOT EXISTS (SELECT 1 FROM pipeline_anotacoes an WHERE an.pipeline_lead_id = pl.id AND COALESCE(an.created_at,'epoch'::timestamptz) >= v_cutoff)
      AND NOT EXISTS (SELECT 1 FROM pipeline_historico h WHERE h.pipeline_lead_id = pl.id AND COALESCE(h.created_at,'epoch'::timestamptz) >= v_cutoff)
      AND NOT EXISTS (SELECT 1 FROM whatsapp_mensagens wm WHERE wm.lead_id = pl.id AND wm.direction = 'out' AND COALESCE(wm.timestamp, wm.created_at) >= v_cutoff)
  LOOP
    SELECT nome INTO v_nome_anterior FROM profiles WHERE user_id = r.corretor_id;
    UPDATE pipeline_leads
    SET corretor_id = NULL, corretor_anterior_id = r.corretor_id, is_redistribuicao = true,
        motivo_redistribuicao = '72h sem contato na etapa Sem Contato. Corretor anterior: ' || COALESCE(v_nome_anterior, 'desconhecido'),
        aceite_status = 'pendente_distribuicao', aceito_em = NULL, ultima_acao_at = NOW(), updated_at = NOW()
    WHERE id = r.id;
    INSERT INTO pipeline_historico (pipeline_lead_id, stage_anterior_id, stage_novo_id, movido_por, observacao, created_at)
    VALUES (r.id, sem_contato_stage_id, sem_contato_stage_id, r.corretor_id,
      'Liberado para fila CEO (redistribuição): 72h sem qualquer atividade operacional válida (tarefa/anotação/histórico/WhatsApp) na etapa Sem Contato. Corretor anterior: ' || COALESCE(v_nome_anterior, 'desconhecido') || '. Aguarda confirmação do CEO.', NOW());
    lead_id := r.id; corretor_anterior := r.corretor_id; lead_nome := r.nome; lead_empreendimento := r.empreendimento;
    RETURN NEXT;
  END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.avisar_leads_sem_contato_iminente()
 RETURNS TABLE(lead_id uuid, corretor_id uuid, lead_nome text, lead_empreendimento text, horas_restantes integer)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  r RECORD;
  sem_contato_stage_id uuid := '2fcba9be-1188-4a54-9452-394beefdc330';
  v_now timestamptz := NOW();
  v_warn_after timestamptz := v_now - INTERVAL '60 hours';
  v_recycle_after timestamptz := v_now - INTERVAL '72 hours';
  v_last_activity timestamptz;
BEGIN
  FOR r IN
    SELECT pl.id, pl.corretor_id AS cid, pl.nome, pl.empreendimento,
      GREATEST(COALESCE(pl.ultima_acao_at, pl.created_at), COALESCE(pl.stage_changed_at, pl.created_at), COALESCE(pl.updated_at, pl.created_at)) AS base_activity
    FROM pipeline_leads pl
    WHERE pl.stage_id = sem_contato_stage_id
      AND pl.corretor_id IS NOT NULL
      AND pl.arquivado IS NOT TRUE
      AND NOT EXISTS (SELECT 1 FROM lead_cadencia_sem_contato c WHERE c.pipeline_lead_id = pl.id AND c.status = 'ativa')
      AND GREATEST(COALESCE(pl.ultima_acao_at, pl.created_at), COALESCE(pl.stage_changed_at, pl.created_at), COALESCE(pl.updated_at, pl.created_at)) <= v_warn_after
      AND GREATEST(COALESCE(pl.ultima_acao_at, pl.created_at), COALESCE(pl.stage_changed_at, pl.created_at), COALESCE(pl.updated_at, pl.created_at)) > v_recycle_after
      AND (pl.reciclagem_aviso_at IS NULL OR pl.reciclagem_aviso_at < pl.stage_changed_at)
  LOOP
    SELECT GREATEST(
      r.base_activity,
      COALESCE((SELECT MAX(COALESCE(wm.timestamp, wm.created_at)) FROM whatsapp_mensagens wm WHERE wm.lead_id = r.id AND wm.direction='out'), 'epoch'::timestamptz),
      COALESCE((SELECT MAX(pa.created_at) FROM pipeline_atividades pa WHERE pa.pipeline_lead_id = r.id), 'epoch'::timestamptz),
      COALESCE((SELECT MAX(pn.created_at) FROM pipeline_anotacoes pn WHERE pn.pipeline_lead_id = r.id), 'epoch'::timestamptz),
      COALESCE((SELECT MAX(ph.created_at) FROM pipeline_historico ph WHERE ph.pipeline_lead_id = r.id), 'epoch'::timestamptz),
      COALESCE((SELECT MAX(GREATEST(COALESCE(pt.created_at,'epoch'::timestamptz), COALESCE(pt.concluida_em,'epoch'::timestamptz))) FROM pipeline_tarefas pt WHERE pt.pipeline_lead_id = r.id), 'epoch'::timestamptz)
    ) INTO v_last_activity;
    IF v_last_activity <= v_warn_after AND v_last_activity > v_recycle_after THEN
      UPDATE pipeline_leads SET reciclagem_aviso_at = v_now WHERE id = r.id;
      lead_id := r.id; corretor_id := r.cid; lead_nome := r.nome; lead_empreendimento := r.empreendimento;
      horas_restantes := GREATEST(0, EXTRACT(EPOCH FROM (v_last_activity + INTERVAL '72 hours' - v_now))/3600)::int;
      RETURN NEXT;
    END IF;
  END LOOP;
END;
$function$;

-- 9) Backfill leads já em "Sem Contato" (ancorado no tempo de permanência)
INSERT INTO public.lead_cadencia_sem_contato
  (pipeline_lead_id, corretor_id, iniciada_em, tentativa_atual, proxima_em, status, tentativas_log)
SELECT
  pl.id, pl.corretor_id, base.anchor, calc.tentativa,
  CASE WHEN calc.tentativa >= 7 THEN NULL ELSE base.anchor + (cum.next_cum || ' minutes')::interval END,
  CASE WHEN calc.tentativa >= 7 THEN 'concluida' ELSE 'ativa' END,
  '[]'::jsonb
FROM pipeline_leads pl
CROSS JOIN LATERAL (
  SELECT GREATEST(COALESCE(pl.ultima_acao_at, pl.created_at), COALESCE(pl.stage_changed_at, pl.created_at)) AS anchor
) base
CROSS JOIN LATERAL (
  SELECT LEAST(7, (
    SELECT COUNT(*) FROM (VALUES (0),(10),(730),(1450),(2890),(4330),(5770)) v(cum)
    WHERE v.cum <= EXTRACT(EPOCH FROM (now() - base.anchor)) / 60
  ))::int AS tentativa
) calc
CROSS JOIN LATERAL (
  SELECT (ARRAY[0,10,730,1450,2890,4330,5770])[LEAST(7, calc.tentativa + 1)] AS next_cum
) cum
WHERE pl.stage_id = '2fcba9be-1188-4a54-9452-394beefdc330'
  AND pl.corretor_id IS NOT NULL
  AND pl.arquivado IS NOT TRUE
ON CONFLICT (pipeline_lead_id) DO NOTHING;