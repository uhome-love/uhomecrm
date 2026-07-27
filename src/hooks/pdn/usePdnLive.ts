import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Assina mudanças relevantes em `pipeline_leads` e `visita_eventos` e chama
 * `onChange` de forma controlada, evitando o "refresh infinito" da UI do PDN
 * quando o backend recebe rajadas de updates cosméticos em background
 * (crons, integrações, escrita de score/última ação, etc).
 *
 * Regras:
 *  - Debounce de 10s + intervalo mínimo de 30s entre refreshes.
 *  - Só agenda refresh quando o UPDATE em `pipeline_leads` mudou pelo menos
 *    um destes campos: stage_id, arquivado, negocio_id, corretor_id,
 *    motivo_descarte. UPDATEs em `ultima_acao_at`, `updated_at`,
 *    `flag_status`, `lead_score` (e afins) são ignorados.
 *  - Pausa enquanto a aba está em background (document.hidden).
 */
const RELEVANT_FIELDS = [
  "stage_id",
  "arquivado",
  "negocio_id",
  "corretor_id",
  "motivo_descarte",
] as const;

function hasRelevantChange(payload: any): boolean {
  const oldRow = payload?.old || {};
  const newRow = payload?.new || {};
  // Se o realtime não trouxer `old` (replica identity default), assume relevante
  // — segurança em cima de performance para não perder movimentação real.
  if (!payload?.old) return true;
  for (const f of RELEVANT_FIELDS) {
    if (oldRow[f] !== newRow[f]) return true;
  }
  return false;
}

export function usePdnLive(onChange: () => void) {
  const cbRef = useRef(onChange);
  cbRef.current = onChange;

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let lastRun = 0;
    const DEBOUNCE_MS = 10_000;
    const MIN_INTERVAL_MS = 30_000;

    const schedule = () => {
      if (typeof document !== "undefined" && document.hidden) return;
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
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "pipeline_leads" }, (payload) => {
        if (!hasRelevantChange(payload)) return;
        schedule();
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "visita_eventos" }, () => schedule())
      .subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, []);
}
