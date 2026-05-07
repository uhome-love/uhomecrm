import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type Logger = {
  info?: (msg: string, ctx?: Record<string, unknown>) => void;
  warn?: (msg: string, ctx?: Record<string, unknown>, err?: unknown) => void;
  error?: (msg: string, ctx?: Record<string, unknown>, err?: unknown) => void;
};

type Result = {
  success: boolean;
  reason?: string;
  error?: string;
  corretor_id?: string | null;
  profile_id?: string | null;
  segmento_id?: string | null;
  janela?: string | null;
  expira_em?: string | null;
};

export async function distributeLeadDirect(
  supabaseUrl: string,
  serviceKey: string,
  leadId: string,
  traceId: string,
  logger: Logger,
  maxRetries = 2,
): Promise<Result> {
  const supabase = createClient(supabaseUrl, serviceKey);
  let lastFailure: Result = { success: false, reason: "unknown" };

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const { data: result, error } = await supabase.rpc("distribuir_lead_atomico", {
        p_lead_id: leadId,
        p_janela: null,
        p_exclude_auth_user_id: null,
        p_force: false,
      });

      if (error) {
        lastFailure = { success: false, reason: "rpc_error", error: error.message };
        logger.warn?.(`Direct distribution attempt ${attempt + 1} failed`, { leadId, traceId, error: error.message });
      } else if (result?.success) {
        return result as Result;
      } else {
        lastFailure = (result as Result) || { success: false, reason: "unknown" };
        logger.warn?.(`Direct distribution attempt ${attempt + 1} returned no broker`, { leadId, traceId, result: lastFailure });
      }
    } catch (err) {
      lastFailure = { success: false, reason: "exception", error: err instanceof Error ? err.message : String(err) };
      logger.warn?.(`Direct distribution attempt ${attempt + 1} exception`, { leadId, traceId }, err);
    }

    if (attempt < maxRetries) {
      await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }

  return lastFailure;
}