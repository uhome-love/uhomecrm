import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const ORIGENS_META = ["ig", "fb", "meta_ads", "meta_backfill", "facebook leads ads"];

export interface CapiSaude {
  coberturaMeta: { total: number; comId: number; pct: number };
  eventos24h: { event_name: string; total: number }[];
  bloqueios24h: { total: number; recentesMeta: number };
  ultimoEvento: string | null;
  venda7d: { ganhosTotal: number; ganhosElegiveis: number; eventos: number; semEvento: number };
  selftest: { resultado: "passou" | "falhou" | "nao_aplicavel" | null; em: string | null };
}

/** Saúde do rastreamento de conversão (Meta CAPI) — janelas fixas: 7d cobertura, 24h eventos. */
export function useCapiSaude(paused = false) {
  return useQuery({
    queryKey: ["capi-saude"],
    refetchInterval: paused ? false : 60_000,
    queryFn: async (): Promise<CapiSaude> => {
      const agora = Date.now();
      const corte7d = new Date(agora - 7 * 24 * 3600_000).toISOString();
      const corte24h = new Date(agora - 24 * 3600_000).toISOString();

      const [leadsRes, eventosRes, bloqueiosRes, coberturaRes, selftestRes] = await Promise.all([
        supabase
          .from("pipeline_leads")
          .select("meta_lead_id,origem")
          .gte("created_at", corte7d)
          .limit(5000),
        supabase
          .from("meta_capi_queue")
          .select("event_name,created_at")
          .gte("created_at", corte24h)
          .order("created_at", { ascending: false })
          .limit(5000),
        supabase
          .from("ops_events")
          .select("ctx")
          .eq("category", "capi_bloqueado_sem_lead_id")
          .gte("created_at", corte24h)
          .limit(2000),
        supabase.rpc("capi_venda_cobertura_7d"),
        supabase
          .from("ops_events")
          .select("ctx,created_at")
          .eq("fn", "capi_guarda_selftest")
          .order("created_at", { ascending: false })
          .limit(1),
      ]);

      const leadsMeta = (leadsRes.data ?? []).filter((l) => {
        const o = String(l.origem ?? "").toLowerCase();
        return ORIGENS_META.some((m) => o === m || o.includes(m));
      });
      const comId = leadsMeta.filter(
        (l) => l.meta_lead_id && String(l.meta_lead_id).trim() !== "",
      ).length;

      const porEvento = new Map<string, number>();
      for (const e of eventosRes.data ?? []) {
        porEvento.set(e.event_name, (porEvento.get(e.event_name) ?? 0) + 1);
      }

      // Linhas sintéticas do autoteste ficam fora de todos os contadores.
      const bloqueios = (bloqueiosRes.data ?? []).filter((b) => {
        const ctx = (b.ctx ?? {}) as Record<string, unknown>;
        return String(ctx.selftest ?? "") !== "true";
      });
      const recentesMeta = bloqueios.filter((b) => {
        const ctx = (b.ctx ?? {}) as Record<string, unknown>;
        const origem = String(ctx.origem ?? "").toLowerCase();
        const criado = ctx.lead_created_at
          ? new Date(String(ctx.lead_created_at)).getTime()
          : 0;
        const ehMeta = ORIGENS_META.some((m) => origem === m || origem.includes(m));
        return ehMeta && criado > agora - 7 * 24 * 3600_000;
      }).length;

      const cob = (coberturaRes.data ?? {}) as Record<string, unknown>;
      const selfRow = selftestRes.data?.[0];
      const selfCtx = (selfRow?.ctx ?? {}) as Record<string, unknown>;

      return {
        coberturaMeta: {
          total: leadsMeta.length,
          comId,
          pct: leadsMeta.length ? Math.round((comId / leadsMeta.length) * 100) : 100,
        },
        eventos24h: [...porEvento.entries()]
          .map(([event_name, total]) => ({ event_name, total }))
          .sort((a, b) => b.total - a.total),
        bloqueios24h: { total: bloqueios.length, recentesMeta },
        ultimoEvento: eventosRes.data?.[0]?.created_at ?? null,
        venda7d: {
          ganhosTotal: Number(cob.ganhos_total ?? 0),
          ganhosElegiveis: Number(cob.ganhos_elegiveis ?? 0),
          eventos: Number(cob.eventos_venda_7d ?? 0),
          semEvento: Array.isArray(cob.sem_evento) ? (cob.sem_evento as unknown[]).length : 0,
        },
        selftest: {
          resultado: (selfCtx.resultado as CapiSaude["selftest"]["resultado"]) ?? null,
          em: selfRow?.created_at ?? null,
        },
      };
    },
  });
}

