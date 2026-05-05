UPDATE public.pipeline_leads pl
   SET corretor_id = p.user_id,
       distribuido_em = COALESCE(pl.distribuido_em, pl.updated_at, now())
  FROM public.profiles p
 WHERE pl.aceite_status = 'aguardando_aceite'
   AND pl.corretor_id = p.id
   AND p.user_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM public.profiles p2 WHERE p2.user_id = pl.corretor_id);