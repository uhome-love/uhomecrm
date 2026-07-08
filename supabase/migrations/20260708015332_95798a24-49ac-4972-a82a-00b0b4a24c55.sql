CREATE OR REPLACE FUNCTION public.notify_lead_distribuido()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- New assignment (corretor_id changed from NULL to a value)
  IF OLD.corretor_id IS NULL AND NEW.corretor_id IS NOT NULL AND NEW.distribuido_em IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM notifications
      WHERE user_id = NEW.corretor_id
        AND categoria = 'novo_lead'
        AND (dados->>'lead_id' = NEW.id::text OR dados->>'pipeline_lead_id' = NEW.id::text)
        AND created_at > now() - interval '5 minutes'
    ) THEN
      PERFORM criar_notificacao(
        NEW.corretor_id,
        'leads',
        'novo_lead',
        'Novo lead recebido!',
        'Lead ' || COALESCE(NEW.nome, 'Novo') || ' foi distribuído para você via roleta.',
        jsonb_build_object('lead_id', NEW.id, 'pipeline_lead_id', NEW.id, 'nome', NEW.nome, 'empreendimento', NEW.empreendimento, 'url', '/aceite?lead=' || NEW.id::text),
        'novo_lead_' || NEW.id::text
      );
    END IF;
  END IF;

  -- Redistribution (corretor changed from one user to another)
  IF OLD.corretor_id IS NOT NULL AND NEW.corretor_id IS NOT NULL
     AND OLD.corretor_id != NEW.corretor_id AND NEW.distribuido_em IS NOT NULL THEN
    PERFORM criar_notificacao(
      OLD.corretor_id,
      'leads',
      'lead_redistribuido',
      'Lead redistribuído',
      'Lead ' || COALESCE(NEW.nome, '') || ' foi redistribuído por falta de atendimento.',
      jsonb_build_object('lead_id', NEW.id, 'nome', NEW.nome, 'url', '/pipeline'),
      NULL
    );

    IF NOT EXISTS (
      SELECT 1 FROM notifications
      WHERE user_id = NEW.corretor_id
        AND categoria = 'novo_lead'
        AND (dados->>'lead_id' = NEW.id::text OR dados->>'pipeline_lead_id' = NEW.id::text)
        AND created_at > now() - interval '5 minutes'
    ) THEN
      PERFORM criar_notificacao(
        NEW.corretor_id,
        'leads',
        'novo_lead',
        'Novo lead recebido!',
        'Lead ' || COALESCE(NEW.nome, 'Novo') || ' redistribuído para você.',
        jsonb_build_object('lead_id', NEW.id, 'pipeline_lead_id', NEW.id, 'nome', NEW.nome, 'empreendimento', NEW.empreendimento, 'url', '/aceite?lead=' || NEW.id::text),
        'novo_lead_' || NEW.id::text
      );
    END IF;
  END IF;

  -- Venda assinada notification (roles corrigidos)
  IF OLD.stage_id != NEW.stage_id THEN
    DECLARE
      v_stage_tipo text;
      v_corretor_nome text;
    BEGIN
      SELECT tipo INTO v_stage_tipo FROM pipeline_stages WHERE id = NEW.stage_id;
      SELECT nome INTO v_corretor_nome FROM profiles WHERE user_id = NEW.corretor_id;

      IF v_stage_tipo = 'venda' THEN
        INSERT INTO notifications (user_id, tipo, categoria, titulo, mensagem, dados, agrupamento_key)
        SELECT ur.user_id, 'vendas', 'venda_assinada',
          '🎉 Venda assinada!',
          COALESCE(v_corretor_nome, 'Corretor') || ' fechou venda: ' || COALESCE(NEW.empreendimento, 'Imóvel') || '. VGV: R$ ' || COALESCE(NEW.valor_estimado::text, '0'),
          jsonb_build_object('lead_id', NEW.id, 'nome', NEW.nome, 'corretor_nome', v_corretor_nome, 'empreendimento', NEW.empreendimento, 'vgv', NEW.valor_estimado, 'url', '/pipeline-leads'),
          'venda_' || NEW.id::text
        FROM user_roles ur
        WHERE ur.role IN ('admin', 'diretor', 'gestor')
        ON CONFLICT DO NOTHING;
      END IF;
    END;
  END IF;

  RETURN NEW;
END;
$function$;