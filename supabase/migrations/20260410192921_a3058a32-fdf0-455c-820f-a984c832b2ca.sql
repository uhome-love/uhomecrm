CREATE OR REPLACE FUNCTION public.sync_site_lead_to_pipeline()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_stage_id uuid := 'd3843b2f-2fa1-4c31-9129-4eb0ed21f019';
  v_pipeline_lead_id uuid;
  v_telefone_norm text;
  v_existing_id uuid;
  v_imovel_url text;
  v_empreendimento text;
  v_prop_title text;
BEGIN
  IF NEW.origem != 'site_uhome' THEN
    RETURN NEW;
  END IF;

  v_telefone_norm := regexp_replace(NEW.telefone, '\D', '', 'g');
  IF length(v_telefone_norm) > 11 THEN
    v_telefone_norm := right(v_telefone_norm, 11);
  END IF;

  -- Resolve imovel_url from slug
  IF NEW.imovel_slug IS NOT NULL AND NEW.imovel_slug != '' THEN
    v_imovel_url := 'https://uhomesales.com/imovel/' || NEW.imovel_slug;
  END IF;

  -- Resolve empreendimento: try real property title first
  v_empreendimento := NEW.imovel_interesse;
  IF NEW.imovel_codigo IS NOT NULL AND NEW.imovel_codigo != '' THEN
    SELECT titulo INTO v_prop_title
    FROM properties
    WHERE codigo = NEW.imovel_codigo
    LIMIT 1;
    IF v_prop_title IS NOT NULL THEN
      v_empreendimento := v_prop_title;
    END IF;
  END IF;

  SELECT id INTO v_existing_id
  FROM pipeline_leads
  WHERE telefone_normalizado = v_telefone_norm
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    UPDATE pipeline_leads SET
      arquivado = false,
      stage_id = v_stage_id,
      stage_changed_at = now(),
      imovel_codigo = COALESCE(NEW.imovel_codigo, imovel_codigo),
      imovel_url = COALESCE(v_imovel_url, imovel_url),
      empreendimento = COALESCE(v_empreendimento, empreendimento),
      dados_site = jsonb_build_object(
        'site_lead_id', NEW.site_lead_id,
        'imovel_interesse', NEW.imovel_interesse,
        'imovel_codigo', NEW.imovel_codigo,
        'imovel_slug', NEW.imovel_slug,
        'bairro_interesse', NEW.bairro_interesse,
        'origem_detalhe', NEW.origem_detalhe,
        'utm_source', NEW.utm_source,
        'utm_campaign', NEW.utm_campaign
      ),
      observacoes = COALESCE(observacoes, '') || E'\n---\n' ||
        '[Site uhome.com.br] Reativado - ' || COALESCE(v_empreendimento, 'geral') ||
        ' (' || to_char(now(), 'DD/MM/YYYY') || ')',
      updated_at = now()
    WHERE id = v_existing_id;

    NEW.pipeline_lead_id := v_existing_id;
    RETURN NEW;
  END IF;

  INSERT INTO pipeline_leads (
    nome, telefone, telefone_normalizado, email,
    origem, origem_detalhe, origem_ref,
    tipo_acao, dados_site,
    stage_id, stage_changed_at,
    empreendimento, imovel_codigo, imovel_url, observacoes,
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
      'imovel_slug', NEW.imovel_slug,
      'bairro_interesse', NEW.bairro_interesse,
      'origem_detalhe', NEW.origem_detalhe,
      'utm_source', NEW.utm_source,
      'utm_campaign', NEW.utm_campaign
    ),
    v_stage_id,
    now(),
    v_empreendimento,
    NEW.imovel_codigo,
    v_imovel_url,
    '[Site uhome.com.br] ' || COALESCE(v_empreendimento, 'Lead geral'),
    NULL,
    NULL,
    'pendente_distribuicao',
    NULL
  )
  RETURNING id INTO v_pipeline_lead_id;

  NEW.pipeline_lead_id := v_pipeline_lead_id;
  RETURN NEW;
END;
$function$;