import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Assina mudanças em `pipeline_leads` e `visita_eventos` e chama `onChange`
 * com debounce de 3s + throttle mínimo de 5s entre refreshes, evitando
 * flicker/reload constante da UI quando o backend recebe rajadas de updates
 * em background (crons, integrações, outros usuários).
 */
export function usePdnLive(onChange: () => void) {
  const cbRef = useRef(onChange);
  cbRef.current = onChange;

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let lastRun = 0;
    const DEBOUNCE_MS = 3000;
    const MIN_INTERVAL_MS = 5000;

    const schedule = () => {
      if (timer) clearTimeout(timer);
      const now = Date.now();
      const sinceLast = now - lastRun;
      const wait = Math.max(DEBOUNCE_MS, MIN_INTERVAL_MS - sinceLast);
      timer = setTimeout(() => {
        lastRun = Date.now();
        cbRef.current();
      }, wait);
    };

    const channel = supabase
      .channel("pdn-live")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "pipeline_leads" }, schedule)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "visita_eventos" }, schedule)
      .subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, []);
}
