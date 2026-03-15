/**
 * useLeadContext — provides lead-context tracking for the /imoveis page.
 *
 * When a lead_id is present in URL params (?lead_id=xxx), this hook:
 *  - Exposes the lead_id for downstream components
 *  - Provides a trackEvent() function to record lead_imovel_events
 *  - Only records events when a valid lead context exists
 *
 * Supported event_types (phase 1):
 *  - search_performed
 *  - vitrine_created
 *  - vitrine_sent
 *
 * Future extensions:
 *  - property_previewed
 *  - property_favorited
 *  - whatsapp_clicked
 */

import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type LeadEventType =
  | "search_performed"
  | "vitrine_created"
  | "vitrine_sent"
  | "property_previewed"
  | "property_favorited"
  | "whatsapp_clicked";

interface TrackEventParams {
  event_type: LeadEventType;
  imovel_codigo?: string;
  vitrine_id?: string;
  search_query?: string;
  payload?: Record<string, any>;
}

export function useLeadContext() {
  const [searchParams] = useSearchParams();
  const { user } = useAuth();

  const leadId = useMemo(() => {
    const raw = searchParams.get("lead_id");
    return raw && UUID_RE.test(raw) ? raw : null;
  }, [searchParams]);

  const leadNome = useMemo(() => searchParams.get("lead_nome") || null, [searchParams]);

  const trackEvent = useCallback(
    async ({ event_type, imovel_codigo, vitrine_id, search_query, payload }: TrackEventParams) => {
      if (!leadId || !user?.id) return;

      try {
        await supabase.from("lead_imovel_events" as any).insert({
          lead_id: leadId,
          corretor_id: user.id,
          event_type,
          imovel_codigo: imovel_codigo || null,
          vitrine_id: vitrine_id || null,
          search_query: search_query || null,
          payload: payload || {},
        });
      } catch (err) {
        console.error("[LeadContext] Failed to track event:", err);
      }
    },
    [leadId, user?.id]
  );

  return {
    leadId,
    leadNome,
    hasLeadContext: !!leadId,
    trackEvent,
  };
}
