CREATE TABLE public.homi_ia_uso (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid,
  papel text,
  funcao text NOT NULL,
  modelo text NOT NULL,
  tokens_entrada int NOT NULL DEFAULT 0,
  tokens_cache int NOT NULL DEFAULT 0,
  tokens_saida int NOT NULL DEFAULT 0,
  custo_estimado_usd numeric(12,6) NOT NULL DEFAULT 0,
  lead_id uuid,
  missao text,
  latencia_ms int,
  versao_prompt text,
  tokens_raciocinio int NOT NULL DEFAULT 0,
  sucesso boolean NOT NULL DEFAULT true,
  erro text
);
CREATE INDEX homi_ia_uso_user_idx ON public.homi_ia_uso (user_id, created_at DESC);
CREATE INDEX homi_ia_uso_created_idx ON public.homi_ia_uso (created_at DESC);
GRANT SELECT ON public.homi_ia_uso TO authenticated;
GRANT ALL ON public.homi_ia_uso TO service_role;
ALTER TABLE public.homi_ia_uso ENABLE ROW LEVEL SECURITY;
CREATE POLICY "uso: admin/diretor leem" ON public.homi_ia_uso FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor'));

CREATE TABLE public.homi_missao_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  missao text NOT NULL,
  evento text NOT NULL,
  lead_id uuid,
  acao text,
  idempotency_key text UNIQUE,
  detalhes jsonb NOT NULL DEFAULT '{}'
);
CREATE INDEX homi_missao_eventos_user_idx ON public.homi_missao_eventos (user_id, created_at DESC);
GRANT SELECT, INSERT ON public.homi_missao_eventos TO authenticated;
GRANT ALL ON public.homi_missao_eventos TO service_role;
ALTER TABLE public.homi_missao_eventos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "eventos: grava o próprio" ON public.homi_missao_eventos FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "eventos: lê o próprio ou gestão" ON public.homi_missao_eventos FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor')
         OR (public.has_role(auth.uid(),'gestor') AND public.is_corretor_in_my_team(user_id)));
COMMENT ON COLUMN public.homi_missao_eventos.detalhes IS 'Proibido: telefone, e-mail ou texto de mensagem.';

CREATE OR REPLACE VIEW public.homi_saude_leads AS
 SELECT l.corretor_id AS auth_user_id,
    s.nome AS etapa,
    s.tipo AS etapa_tipo,
    lead_saude_status(l.ultimo_toque_at, COALESCE(l.distribuido_em, l.created_at), s.tipo, l.estagnacao_carencia_ate) AS saude,
    COALESCE(l.estagnado, false) AS estagnado,
    l.ultimo_toque_at,
    GREATEST(0, (CURRENT_DATE - (COALESCE(l.ultimo_toque_at, l.distribuido_em, l.created_at))::date)) AS dias_sem_toque,
    l.id AS pipeline_lead_id,
    l.nome AS lead_nome,
    l.temperatura
   FROM pipeline_leads l
     JOIN pipeline_stages s ON s.id = l.stage_id
  WHERE l.corretor_id IS NOT NULL
    AND s.tipo <> ALL (ARRAY['venda'::text, 'caiu'::text, 'descarte'::text, 'convertido'::text])
    AND COALESCE(l.arquivado, false) = false;

REVOKE ALL ON public.homi_saude_leads FROM anon, authenticated;