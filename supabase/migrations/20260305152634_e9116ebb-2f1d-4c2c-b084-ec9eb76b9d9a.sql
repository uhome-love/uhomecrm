
-- Function: Admin/Gestor can hygiene a lead (mark as aproveitado, transfer, etc.)
CREATE OR REPLACE FUNCTION public.higienizar_lead(
  p_lead_id uuid,
  p_acao text,           -- 'aproveitado', 'descartado', 'transferir', 'bloquear', 'desbloquear'
  p_corretor_id uuid DEFAULT NULL,
  p_motivo text DEFAULT NULL,
  p_admin_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_lead oferta_ativa_leads%ROWTYPE;
  v_before jsonb;
BEGIN
  -- Get lead with lock
  SELECT * INTO v_lead FROM oferta_ativa_leads WHERE id = p_lead_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'lead_not_found');
  END IF;

  v_before := jsonb_build_object(
    'status', v_lead.status,
    'corretor_id', v_lead.corretor_id,
    'em_atendimento_por', v_lead.em_atendimento_por
  );

  IF p_acao = 'aproveitado' THEN
    -- Mark as aproveitado and assign to corretor
    UPDATE oferta_ativa_leads SET
      status = 'aproveitado',
      corretor_id = COALESCE(p_corretor_id, v_lead.corretor_id),
      motivo_descarte = NULL,
      em_atendimento_por = NULL,
      em_atendimento_ate = NULL,
      updated_at = now()
    WHERE id = p_lead_id;

    -- Insert attempt record for tracking
    INSERT INTO oferta_ativa_tentativas (lead_id, corretor_id, lista_id, empreendimento, canal, resultado, feedback, pontos)
    VALUES (
      p_lead_id,
      COALESCE(p_corretor_id, COALESCE(p_admin_id, v_lead.corretor_id)),
      v_lead.lista_id,
      v_lead.empreendimento,
      'whatsapp',
      'com_interesse',
      COALESCE(p_motivo, 'Higienização admin'),
      3
    );

  ELSIF p_acao = 'descartado' THEN
    UPDATE oferta_ativa_leads SET
      status = 'descartado',
      motivo_descarte = COALESCE(p_motivo, 'higienizacao'),
      em_atendimento_por = NULL,
      em_atendimento_ate = NULL,
      updated_at = now()
    WHERE id = p_lead_id;

  ELSIF p_acao = 'transferir' THEN
    UPDATE oferta_ativa_leads SET
      corretor_id = p_corretor_id,
      em_atendimento_por = NULL,
      em_atendimento_ate = NULL,
      updated_at = now()
    WHERE id = p_lead_id;

  ELSIF p_acao = 'bloquear' THEN
    UPDATE oferta_ativa_leads SET
      status = 'bloqueado',
      motivo_descarte = COALESCE(p_motivo, 'whatsapp_em_andamento'),
      em_atendimento_por = NULL,
      em_atendimento_ate = NULL,
      updated_at = now()
    WHERE id = p_lead_id;

  ELSIF p_acao = 'desbloquear' THEN
    UPDATE oferta_ativa_leads SET
      status = 'na_fila',
      motivo_descarte = NULL,
      updated_at = now()
    WHERE id = p_lead_id;

  ELSIF p_acao = 'quebrar_reserva' THEN
    UPDATE oferta_ativa_leads SET
      em_atendimento_por = NULL,
      em_atendimento_ate = NULL,
      updated_at = now()
    WHERE id = p_lead_id;

  ELSE
    RETURN jsonb_build_object('success', false, 'reason', 'acao_invalida');
  END IF;

  -- Audit log
  IF p_admin_id IS NOT NULL THEN
    INSERT INTO audit_log (user_id, modulo, acao, descricao, antes, depois, chave_unica, origem)
    VALUES (
      p_admin_id,
      'higienizacao',
      p_acao,
      p_motivo,
      v_before,
      jsonb_build_object('status', p_acao, 'corretor_id', p_corretor_id),
      v_lead.telefone_normalizado,
      'busca_leads'
    );
  END IF;

  RETURN jsonb_build_object('success', true, 'lead_id', p_lead_id, 'acao', p_acao);
END;
$$;

-- Add DELETE policy for tentativas so admin can manage
CREATE POLICY "Admins can delete tentativas"
ON public.oferta_ativa_tentativas
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add UPDATE policy for tentativas so admin can manage  
CREATE POLICY "Admins can update tentativas"
ON public.oferta_ativa_tentativas
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add admin INSERT policy for tentativas (the function uses SECURITY DEFINER but just in case)
CREATE POLICY "Admins can insert tentativas"
ON public.oferta_ativa_tentativas
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));
