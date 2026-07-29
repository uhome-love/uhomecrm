UPDATE public.reengajamento_config
   SET paused = false,
       paused_until_release = false,
       paused_reason = NULL,
       paused_at_brt = NULL,
       guard_reset_at = now(),
       meta_template_name = 'casasdescoradas_casatua',
       meta_template_language = 'pt_BR',
       meta_header_image_url = 'https://api.uhomesales.com/storage/v1/object/public/campaign-images/reengajamento/casasdescoradas-casatua.jpg',
       updated_at = now()
 WHERE id = 'f0d84290-82d0-4ed0-859f-292fa243d1eb';