-- Trigger: quando um lead com origem 'site_uhome' é inserido na tabela leads,
-- automaticamente cria um pipeline_lead correspondente e atualiza pipeline_lead_id

CREATE OR REPLACE FUNCTION public.sync_site_lead_to_pipeline()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stage_id uuid;
  v_pipeline_lead_id uuid;
  v_telefone_norm text;
  v_existing_id uuid;
BEGIN
  -- Só processar leads vindos do site
  IF NEW.origem != 'site_uhome' THEN
    RETURN NEW;
  END IF;

  -- Normalizar telefone
  v_telefone_norm := regexp_replace(NEW.telefone, '\D', '', 'g');
  IF length(v_telefone_norm) > 11 THEN
    v_telefone_norm := right(v_telefone_norm, 11);
  END IF;

  -- Verificar dedup por telefone normalizado
  SELECT id INTO v_existing_id
  FROM pipeline_leads
  WHERE telefone_normalizado = v_telefone_norm
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    -- Atualizar pipeline_lead existente com dados novos
    UPDATE pipeline_leads SET
      dados_site = jsonb_build_object(
        'site_lead_id', NEW.site_lead_id,
        'imovel_interesse', NEW.imovel_interesse,
        'imovel_codigo', NEW.imovel_codigo,
        'bairro_interesse', NEW.bairro_interesse,
        'origem_detalhe', NEW.origem_detalhe,
        'utm_source', NEW.utm_source,
        'utm_campaign', NEW.utm_campaign
      ),
      observacoes = COALESCE(observacoes, '') || E'\n---\n' ||
        '[Site uhome.com.br] Novo interesse - ' || COALESCE(NEW.imovel_interesse, 'geral') ||
        ' (' || to_char(now(), 'DD/MM/YYYY') || ')',
      updated_at = now()
    WHERE id = v_existing_id;

    NEW.pipeline_lead_id := v_existing_id;
    RETURN NEW;
  END IF;

  -- Buscar primeiro stage do pipeline
  SELECT id INTO v_stage_id
  FROM pipeline_stages
  ORDER BY ordem ASC
  LIMIT 1;

  -- Criar pipeline_lead
  INSERT INTO pipeline_leads (
    nome, telefone, telefone_normalizado, email,
    origem, origem_detalhe, origem_ref,
    tipo_acao, dados_site,
    stage_id, stage_changed_at,
    empreendimento, observacoes,
    corretor_id, distribuido_em, aceite_status, aceito_em
  ) VALUES (
    NEW.nome,
    NEW.telefone,
    v_telefone_norm,
    NEW.email,
    'site_uhome',
    COALESCE(NEW.origem_detalhe, 'site_lead'),
    CASE WHEN NEW.atribuido_para IS NOT NULL THEN 'link_corretor' ELSE 'organico' END,
    'lead',
    jsonb_build_object(
      'site_lead_id', NEW.site_lead_id,
      'imovel_interesse', NEW.imovel_interesse,
      'imovel_codigo', NEW.imovel_codigo,
      'bairro_interesse', NEW.bairro_interesse,
      'utm_source', NEW.utm_source,
      'utm_campaign', NEW.utm_campaign
    ),
    v_stage_id,
    now(),
    NEW.imovel_interesse,
    '[Site uhome.com.br] ' || COALESCE(NEW.origem_detalhe, 'lead') ||
      CASE WHEN NEW.imovel_interesse IS NOT NULL THEN ' - ' || NEW.imovel_interesse ELSE '' END,
    NEW.atribuido_para,
    CASE WHEN NEW.atribuido_para IS NOT NULL THEN now() ELSE NULL END,
    CASE WHEN NEW.atribuido_para IS NOT NULL THEN 'aceito' ELSE 'pendente' END,
    CASE WHEN NEW.atribuido_para IS NOT NULL THEN now() ELSE NULL END
  )
  RETURNING id INTO v_pipeline_lead_id;

  NEW.pipeline_lead_id := v_pipeline_lead_id;

  -- Criar notificação para o corretor se atribuído
  IF NEW.atribuido_para IS NOT NULL THEN
    INSERT INTO notifications (user_id, tipo, categoria, titulo, mensagem, dados, lida)
    VALUES (
      NEW.atribuido_para,
      'novo_lead',
      'leads',
      '⚡ Novo lead via site uhome.com.br',
      NEW.nome || CASE WHEN NEW.imovel_interesse IS NOT NULL THEN ' - ' || NEW.imovel_interesse ELSE '' END || ' entrou pelo site',
      jsonb_build_object(
        'pipeline_lead_id', v_pipeline_lead_id,
        'lead_nome', NEW.nome,
        'lead_telefone', NEW.telefone,
        'imovel_titulo', NEW.imovel_interesse,
        'origem_ref', 'site_uhome'
      ),
      false
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger BEFORE INSERT para poder modificar NEW.pipeline_lead_id
CREATE TRIGGER trg_sync_site_lead_to_pipeline
  BEFORE INSERT ON leads
  FOR EACH ROW
  EXECUTE FUNCTION sync_site_lead_to_pipeline();