
-- Trigger: notify when lead is distributed via roleta
CREATE OR REPLACE FUNCTION public.notify_lead_distribuido()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only fire when corretor_id changes from NULL to a value (distribution)
  IF OLD.corretor_id IS NULL AND NEW.corretor_id IS NOT NULL AND NEW.distribuido_em IS NOT NULL THEN
    -- Notify the corretor
    PERFORM criar_notificacao(
      NEW.corretor_id,
      'leads',
      'novo_lead',
      'Novo lead recebido!',
      'Lead ' || COALESCE(NEW.nome, 'Novo') || ' foi distribuído para você via roleta.',
      jsonb_build_object('lead_id', NEW.id, 'nome', NEW.nome, 'empreendimento', NEW.empreendimento),
      'novo_lead'
    );
  END IF;

  -- Notify when lead is redistributed (corretor changes)
  IF OLD.corretor_id IS NOT NULL AND NEW.corretor_id IS NOT NULL 
     AND OLD.corretor_id != NEW.corretor_id AND NEW.distribuido_em IS NOT NULL THEN
    -- Notify old corretor
    PERFORM criar_notificacao(
      OLD.corretor_id,
      'leads',
      'lead_redistribuido',
      'Lead redistribuído',
      'Lead ' || COALESCE(NEW.nome, '') || ' foi redistribuído por falta de atendimento.',
      jsonb_build_object('lead_id', NEW.id, 'nome', NEW.nome),
      NULL
    );
    -- Notify new corretor
    PERFORM criar_notificacao(
      NEW.corretor_id,
      'leads',
      'novo_lead',
      'Novo lead recebido!',
      'Lead ' || COALESCE(NEW.nome, 'Novo') || ' redistribuído para você.',
      jsonb_build_object('lead_id', NEW.id, 'nome', NEW.nome, 'empreendimento', NEW.empreendimento),
      'novo_lead'
    );
  END IF;

  -- Notify when lead moves to venda stage
  IF OLD.stage_id != NEW.stage_id THEN
    DECLARE
      v_stage_tipo text;
      v_corretor_nome text;
    BEGIN
      SELECT tipo INTO v_stage_tipo FROM pipeline_stages WHERE id = NEW.stage_id;
      SELECT nome INTO v_corretor_nome FROM profiles WHERE user_id = NEW.corretor_id;
      
      IF v_stage_tipo = 'venda' THEN
        -- Notify all admins (CEO)
        INSERT INTO notifications (user_id, tipo, categoria, titulo, mensagem, dados, agrupamento_key)
        SELECT ur.user_id, 'vendas', 'venda_assinada',
          '🎉 Venda assinada!',
          COALESCE(v_corretor_nome, 'Corretor') || ' fechou venda: ' || COALESCE(NEW.empreendimento, 'Imóvel') || '. VGV: R$ ' || COALESCE(NEW.valor_estimado::text, '0'),
          jsonb_build_object('lead_id', NEW.id, 'nome', NEW.nome, 'corretor_nome', v_corretor_nome, 'empreendimento', NEW.empreendimento, 'vgv', NEW.valor_estimado),
          NULL
        FROM user_roles ur WHERE ur.role = 'admin';

        -- Notify gestores
        INSERT INTO notifications (user_id, tipo, categoria, titulo, mensagem, dados, agrupamento_key)
        SELECT ur.user_id, 'vendas', 'venda_assinada',
          '🎉 Venda assinada!',
          COALESCE(v_corretor_nome, 'Corretor') || ' fechou venda: ' || COALESCE(NEW.empreendimento, 'Imóvel'),
          jsonb_build_object('lead_id', NEW.id, 'nome', NEW.nome, 'corretor_nome', v_corretor_nome),
          NULL
        FROM user_roles ur WHERE ur.role = 'gestor';
      END IF;

      IF v_stage_tipo = 'proposta' THEN
        -- Notify gestores about new proposal
        INSERT INTO notifications (user_id, tipo, categoria, titulo, mensagem, dados, agrupamento_key)
        SELECT ur.user_id, 'propostas', 'proposta_criada',
          'Nova proposta criada',
          COALESCE(v_corretor_nome, 'Corretor') || ' criou proposta para ' || COALESCE(NEW.nome, 'cliente'),
          jsonb_build_object('lead_id', NEW.id, 'nome', NEW.nome, 'corretor_nome', v_corretor_nome),
          'proposta_criada'
        FROM user_roles ur WHERE ur.role = 'gestor';
      END IF;
    END;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_pipeline_lead_changes
  AFTER UPDATE ON pipeline_leads
  FOR EACH ROW
  EXECUTE FUNCTION notify_lead_distribuido();

-- Trigger: notify gestor when visita is created
CREATE OR REPLACE FUNCTION public.notify_visita_criada()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_corretor_nome text;
BEGIN
  SELECT nome INTO v_corretor_nome FROM profiles WHERE user_id = NEW.corretor_id;

  -- Notify the gerente
  PERFORM criar_notificacao(
    NEW.gerente_id,
    'visitas',
    'visita_marcada',
    'Nova visita marcada',
    COALESCE(v_corretor_nome, 'Corretor') || ' marcou visita com ' || COALESCE(NEW.nome_cliente, 'cliente') || ' em ' || COALESCE(NEW.empreendimento, 'N/A'),
    jsonb_build_object('visita_id', NEW.id, 'nome_cliente', NEW.nome_cliente, 'corretor_nome', v_corretor_nome, 'data', NEW.data_visita, 'empreendimento', NEW.empreendimento),
    'visita_marcada'
  );

  -- If status is confirmada, notify the corretor
  IF NEW.status = 'confirmada' THEN
    PERFORM criar_notificacao(
      NEW.corretor_id,
      'visitas',
      'visita_confirmada',
      'Visita confirmada!',
      'Visita com ' || COALESCE(NEW.nome_cliente, 'cliente') || ' confirmada para ' || NEW.data_visita,
      jsonb_build_object('visita_id', NEW.id, 'nome_cliente', NEW.nome_cliente, 'data', NEW.data_visita),
      NULL
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_visita_criada
  AFTER INSERT ON visitas
  FOR EACH ROW
  EXECUTE FUNCTION notify_visita_criada();

-- Trigger: notify when visita status changes to confirmada
CREATE OR REPLACE FUNCTION public.notify_visita_confirmada()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.status != 'confirmada' AND NEW.status = 'confirmada' THEN
    PERFORM criar_notificacao(
      NEW.corretor_id,
      'visitas',
      'visita_confirmada',
      'Visita confirmada!',
      'Visita com ' || COALESCE(NEW.nome_cliente, 'cliente') || ' confirmada para ' || NEW.data_visita,
      jsonb_build_object('visita_id', NEW.id, 'nome_cliente', NEW.nome_cliente, 'data', NEW.data_visita),
      NULL
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_visita_confirmada
  AFTER UPDATE ON visitas
  FOR EACH ROW
  EXECUTE FUNCTION notify_visita_confirmada();

-- Trigger: notify gestor when escala is requested
CREATE OR REPLACE FUNCTION public.notify_escala_solicitada()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_corretor_nome text;
  v_segmento_nome text;
  v_gestor_user_id uuid;
BEGIN
  IF NEW.aprovacao_status = 'pendente' THEN
    SELECT nome INTO v_corretor_nome FROM profiles WHERE user_id = NEW.corretor_id;
    SELECT nome INTO v_segmento_nome FROM pipeline_segmentos WHERE id = NEW.segmento_id;

    -- Notify all gestores
    FOR v_gestor_user_id IN SELECT user_id FROM user_roles WHERE role IN ('gestor', 'admin')
    LOOP
      PERFORM criar_notificacao(
        v_gestor_user_id,
        'alertas',
        'escala_solicitada',
        'Solicitação de escala',
        COALESCE(v_corretor_nome, 'Corretor') || ' solicitou escala no segmento ' || COALESCE(v_segmento_nome, 'N/A'),
        jsonb_build_object('escala_id', NEW.id, 'corretor_nome', v_corretor_nome, 'segmento', v_segmento_nome),
        'escala_solicitada'
      );
    END LOOP;
  END IF;

  -- Notify corretor when approved/rejected
  IF TG_OP = 'UPDATE' AND OLD.aprovacao_status = 'pendente' AND NEW.aprovacao_status IN ('aprovado', 'rejeitado') THEN
    SELECT nome INTO v_segmento_nome FROM pipeline_segmentos WHERE id = NEW.segmento_id;
    PERFORM criar_notificacao(
      NEW.corretor_id,
      'alertas',
      CASE WHEN NEW.aprovacao_status = 'aprovado' THEN 'escala_aprovada' ELSE 'escala_rejeitada' END,
      CASE WHEN NEW.aprovacao_status = 'aprovado' THEN '✅ Escala aprovada!' ELSE '❌ Escala rejeitada' END,
      'Sua escala no segmento ' || COALESCE(v_segmento_nome, 'N/A') || ' foi ' || NEW.aprovacao_status,
      jsonb_build_object('escala_id', NEW.id, 'segmento', v_segmento_nome, 'status', NEW.aprovacao_status),
      NULL
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_escala_insert
  AFTER INSERT ON distribuicao_escala
  FOR EACH ROW
  EXECUTE FUNCTION notify_escala_solicitada();

CREATE TRIGGER trg_notify_escala_update
  AFTER UPDATE ON distribuicao_escala
  FOR EACH ROW
  EXECUTE FUNCTION notify_escala_solicitada();
