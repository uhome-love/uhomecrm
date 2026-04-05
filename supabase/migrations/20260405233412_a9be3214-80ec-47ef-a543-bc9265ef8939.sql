
-- Replace the trigger to use direct RPC call instead of Edge Function
-- This avoids the service_role_key dependency issue

CREATE OR REPLACE FUNCTION public.trg_auto_distribute_lead()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- Only for leads without a corretor (new unassigned leads)
  IF NEW.corretor_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Call the distribution RPC directly (no need for Edge Function)
  BEGIN
    v_result := public.distribuir_lead_atomico(
      p_lead_id := NEW.id,
      p_force := false
    );
    
    -- Log result for debugging
    IF v_result->>'success' = 'false' THEN
      RAISE NOTICE 'Auto-distribute for lead %: %', NEW.id, v_result->>'reason';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Never block lead insertion - just log the error
    RAISE WARNING 'Auto-distribute trigger error for lead %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- Recreate trigger
DROP TRIGGER IF EXISTS trg_auto_distribute_new_lead ON public.pipeline_leads;
CREATE TRIGGER trg_auto_distribute_new_lead
  AFTER INSERT ON public.pipeline_leads
  FOR EACH ROW
  WHEN (NEW.corretor_id IS NULL)
  EXECUTE FUNCTION public.trg_auto_distribute_lead();
