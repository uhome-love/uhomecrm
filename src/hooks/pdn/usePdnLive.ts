import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Assina mudanças em `pipeline_leads` e `visita_eventos` e chama `onChange`
 * (debounced 800ms) para invalidar/recarregar o PDN. RLS já protege a visão.
 */
export function usePdnLive(onChange: () => void) {
  const cbRef = useRef(onChange);
  cbRef.current = onChange;

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const bump = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { cbRef.current(); }, 800);
    };

    const channel = supabase
      .channel("pdn-live")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "pipeline_leads" }, bump)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "visita_eventos" }, bump)
      .subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, []);
}
