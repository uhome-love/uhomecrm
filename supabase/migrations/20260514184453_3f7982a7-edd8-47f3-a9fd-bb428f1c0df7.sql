
DO $$
DECLARE
  old_host TEXT := 'hunbxqzhvuemgntklyzb.supabase.co';
  new_host TEXT := 'api.uhomesales.com';
BEGIN
  -- profiles
  UPDATE public.profiles SET avatar_url = REPLACE(avatar_url, old_host, new_host) WHERE avatar_url ILIKE '%' || old_host || '%';
  UPDATE public.profiles SET avatar_preview_url = REPLACE(avatar_preview_url, old_host, new_host) WHERE avatar_preview_url ILIKE '%' || old_host || '%';
  UPDATE public.profiles SET avatar_gamificado_url = REPLACE(avatar_gamificado_url, old_host, new_host) WHERE avatar_gamificado_url ILIKE '%' || old_host || '%';

  -- jetimob
  UPDATE public.jetimob_corretores SET avatar_url = REPLACE(avatar_url, old_host, new_host) WHERE avatar_url ILIKE '%' || old_host || '%';

  -- materiais
  UPDATE public.materiais_empreendimentos SET logo_url = REPLACE(logo_url, old_host, new_host) WHERE logo_url ILIKE '%' || old_host || '%';
  UPDATE public.materiais_links SET url = REPLACE(url, old_host, new_host) WHERE url ILIKE '%' || old_host || '%';
  UPDATE public.pipeline_materiais SET url = REPLACE(url, old_host, new_host) WHERE url ILIKE '%' || old_host || '%';
  UPDATE public.anuncio_materiais SET url = REPLACE(url, old_host, new_host) WHERE url ILIKE '%' || old_host || '%';

  -- vitrines / properties / leads
  UPDATE public.vitrines SET hero_url = REPLACE(hero_url, old_host, new_host) WHERE hero_url ILIKE '%' || old_host || '%';
  UPDATE public.properties SET video_url = REPLACE(video_url, old_host, new_host) WHERE video_url ILIKE '%' || old_host || '%';
  UPDATE public.properties SET tour_virtual_url = REPLACE(tour_virtual_url, old_host, new_host) WHERE tour_virtual_url ILIKE '%' || old_host || '%';
  UPDATE public.pipeline_leads SET imovel_url = REPLACE(imovel_url, old_host, new_host) WHERE imovel_url ILIKE '%' || old_host || '%';

  -- whatsapp / tarefas
  UPDATE public.whatsapp_mensagens SET media_url = REPLACE(media_url, old_host, new_host) WHERE media_url ILIKE '%' || old_host || '%';
  UPDATE public.tarefas SET anexo_url = REPLACE(anexo_url, old_host, new_host) WHERE anexo_url ILIKE '%' || old_host || '%';

  -- pagadoria
  UPDATE public.pagadoria_solicitacoes SET cpf_url = REPLACE(cpf_url, old_host, new_host) WHERE cpf_url ILIKE '%' || old_host || '%';
  UPDATE public.pagadoria_solicitacoes SET rg_url = REPLACE(rg_url, old_host, new_host) WHERE rg_url ILIKE '%' || old_host || '%';
  UPDATE public.pagadoria_solicitacoes SET comprovante_residencia_url = REPLACE(comprovante_residencia_url, old_host, new_host) WHERE comprovante_residencia_url ILIKE '%' || old_host || '%';
  UPDATE public.pagadoria_solicitacoes SET contrato_pdf_url = REPLACE(contrato_pdf_url, old_host, new_host) WHERE contrato_pdf_url ILIKE '%' || old_host || '%';
  UPDATE public.pagadoria_solicitacoes SET ficha_construtora_url = REPLACE(ficha_construtora_url, old_host, new_host) WHERE ficha_construtora_url ILIKE '%' || old_host || '%';

  -- empreendimento overrides
  UPDATE public.empreendimento_overrides SET video_url = REPLACE(video_url, old_host, new_host) WHERE video_url ILIKE '%' || old_host || '%';
  UPDATE public.empreendimento_overrides SET mapa_url = REPLACE(mapa_url, old_host, new_host) WHERE mapa_url ILIKE '%' || old_host || '%';

  -- academia
  UPDATE public.academia_aulas SET conteudo_url = REPLACE(conteudo_url, old_host, new_host) WHERE conteudo_url ILIKE '%' || old_host || '%';
  UPDATE public.academia_trilhas SET thumbnail_url = REPLACE(thumbnail_url, old_host, new_host) WHERE thumbnail_url ILIKE '%' || old_host || '%';

  -- reengajamento / homi / nurturing
  UPDATE public.reengajamento_config SET meta_header_image_url = REPLACE(meta_header_image_url, old_host, new_host) WHERE meta_header_image_url ILIKE '%' || old_host || '%';
  UPDATE public.reengajamento_config SET meta_header_image_url_2 = REPLACE(meta_header_image_url_2, old_host, new_host) WHERE meta_header_image_url_2 ILIKE '%' || old_host || '%';
  UPDATE public.homi_documents SET file_url = REPLACE(file_url, old_host, new_host) WHERE file_url ILIKE '%' || old_host || '%';
  UPDATE public.lead_nurturing_sequences SET vitrine_url = REPLACE(vitrine_url, old_host, new_host) WHERE vitrine_url ILIKE '%' || old_host || '%';
END $$;
