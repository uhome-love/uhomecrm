
CREATE TABLE IF NOT EXISTS public.system_flags (
  flag_name text PRIMARY KEY,
  flag_value boolean NOT NULL DEFAULT false,
  reason text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
ALTER TABLE public.system_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "system_flags read auth" ON public.system_flags FOR SELECT TO authenticated USING (true);
CREATE POLICY "system_flags admin write" ON public.system_flags FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
REVOKE ALL ON public.system_flags FROM anon;

INSERT INTO public.system_flags (flag_name, flag_value, reason)
VALUES ('campaign_dispatch_enabled', false,
        'WABA quality recovery — bombardeio (107 msg/lead 7d), LGPD violada (340+ pós opt-out), 6199 disparos fora do CRM.')
ON CONFLICT (flag_name) DO UPDATE
SET flag_value = false, reason = EXCLUDED.reason, updated_at = now();

CREATE TABLE IF NOT EXISTS public.waba_send_guards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guard_type text NOT NULL CHECK (guard_type IN ('descarte_definitivo','opt_out_90d','duplicate_30d','bombardeio','manual')),
  lead_id uuid REFERENCES public.pipeline_leads(id) ON DELETE CASCADE,
  phone_e164 text,
  template_name text,
  reason text NOT NULL,
  blocked_at timestamptz NOT NULL DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo'),
  blocked_until timestamptz,
  source_event_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_waba_send_guards_lead ON public.waba_send_guards(lead_id);
CREATE INDEX IF NOT EXISTS idx_waba_send_guards_phone ON public.waba_send_guards(phone_e164);
CREATE INDEX IF NOT EXISTS idx_waba_send_guards_template ON public.waba_send_guards(template_name);
CREATE INDEX IF NOT EXISTS idx_waba_send_guards_blocked_until ON public.waba_send_guards(blocked_until);

ALTER TABLE public.waba_send_guards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "waba_send_guards read auth" ON public.waba_send_guards FOR SELECT TO authenticated USING (true);
CREATE POLICY "waba_send_guards admin write" ON public.waba_send_guards FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
REVOKE ALL ON public.waba_send_guards FROM anon;

CREATE OR REPLACE FUNCTION public.check_send_allowed(p_lead_id uuid, p_phone text, p_template text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_block public.waba_send_guards;
BEGIN
  SELECT * INTO v_block FROM public.waba_send_guards
   WHERE (lead_id = p_lead_id OR (phone_e164 IS NOT NULL AND phone_e164 = p_phone))
     AND (blocked_until IS NULL OR blocked_until > now())
     AND (template_name IS NULL OR template_name = p_template)
   ORDER BY (template_name IS NOT NULL) DESC, blocked_at DESC
   LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object('allowed', false, 'reason', v_block.reason,
      'guard_type', v_block.guard_type, 'guard_id', v_block.id, 'blocked_until', v_block.blocked_until);
  END IF;
  RETURN jsonb_build_object('allowed', true);
END $$;
REVOKE ALL ON FUNCTION public.check_send_allowed(uuid, text, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.check_send_allowed(uuid, text, text) TO authenticated, service_role;

INSERT INTO public.waba_send_guards (guard_type, lead_id, phone_e164, reason, blocked_until)
SELECT 'descarte_definitivo'::text, pl.id, pl.telefone_normalizado,
       'Lead em Descarte Definitivo — bloqueio permanente WABA recovery'::text, NULL::timestamptz
FROM public.pipeline_leads pl
WHERE pl.stage_id = '1dd66c25-3848-4053-9f66-82e902989b4d' AND pl.tipo_descarte = 'definitivo';

INSERT INTO public.waba_send_guards (guard_type, lead_id, phone_e164, reason, blocked_until)
SELECT DISTINCT ON (rmd.lead_id, rmd.phone)
       'opt_out_90d'::text, rmd.lead_id, rmd.phone,
       'Lead clicou "Não" em template de reengajamento — opt-out LGPD permanente'::text, NULL::timestamptz
FROM public.reengajamento_meta_disparos rmd
WHERE LOWER(COALESCE(rmd.button_response, '')) IN ('nao','não','no')
  AND rmd.lead_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM public.pipeline_leads pl WHERE pl.id = rmd.lead_id);

INSERT INTO public.waba_send_guards (guard_type, lead_id, phone_e164, reason, blocked_until)
SELECT DISTINCT 'opt_out_90d'::text, NULL::uuid, rmd.phone,
       'Opt-out histórico (lead não está mais no pipeline) — bloqueio por telefone'::text, NULL::timestamptz
FROM public.reengajamento_meta_disparos rmd
WHERE LOWER(COALESCE(rmd.button_response, '')) IN ('nao','não','no')
  AND rmd.phone IS NOT NULL
  AND (rmd.lead_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.pipeline_leads pl WHERE pl.id = rmd.lead_id));

INSERT INTO public.waba_send_guards (guard_type, lead_id, phone_e164, template_name, reason, blocked_until)
SELECT 'bombardeio'::text, rmd.lead_id, MAX(rmd.phone), rmd.template_name,
       ('Bombardeio: ' || COUNT(*) || ' disparos do template "' || rmd.template_name || '" em 30d')::text,
       ((now() AT TIME ZONE 'America/Sao_Paulo') + interval '90 days')::timestamptz
FROM public.reengajamento_meta_disparos rmd
WHERE rmd.sent_at >= now() - interval '30 days'
  AND rmd.lead_id IS NOT NULL
  AND rmd.template_name IS NOT NULL
  AND EXISTS (SELECT 1 FROM public.pipeline_leads pl WHERE pl.id = rmd.lead_id)
GROUP BY rmd.lead_id, rmd.template_name HAVING COUNT(*) > 10;

INSERT INTO public.ops_events (fn, level, category, message, ctx)
VALUES ('waba_recovery_sprint_0b','critical','waba_recovery',
  'WABA recovery: campaign_dispatch_enabled=false + waba_send_guards populados.',
  jsonb_build_object(
    'brt_at', to_char((now() AT TIME ZONE 'America/Sao_Paulo'), 'YYYY-MM-DD HH24:MI:SS'),
    'paused_functions', jsonb_build_array('whatsapp-campaign-dispatch','reengajamento-descartados-enqueue','test-reengajamento-wave2','visita-amanha-enqueue'),
    'critical_kept', jsonb_build_array('whatsapp-notificacao','whatsapp-ai-reply')
  ));

-- ROLLBACK (manual):
-- UPDATE public.system_flags SET flag_value = true WHERE flag_name = 'campaign_dispatch_enabled';
-- DROP FUNCTION IF EXISTS public.check_send_allowed(uuid, text, text);
-- DROP TABLE IF EXISTS public.waba_send_guards;
-- DROP TABLE IF EXISTS public.system_flags;
