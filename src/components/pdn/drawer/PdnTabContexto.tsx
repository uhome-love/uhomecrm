import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRT } from "@/lib/brtTime";
import type { PdnRow } from "@/hooks/usePdn";
import { fmtMoney } from "@/lib/fmtMoney";
import { Loader2, ExternalLink, Info } from "lucide-react";

interface TimelineEvent {
  event_id: string | null;
  tipo: string | null;
  categoria: string | null;
  descricao: string | null;
  created_at: string | null;
}

/**
 * Aba Contexto — cabeçalho de leitura do lead + últimos eventos da timeline
 * canônica (`v_lead_timeline`). Para negócios manuais (sem lead no pipeline),
 * exibe apenas um aviso.
 */
export function PdnTabContexto({ row }: { row: PdnRow }) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!row.pipelineLeadId) { setEvents([]); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from("v_lead_timeline")
        .select("event_id, tipo, categoria, descricao, created_at")
        .eq("lead_id", row.pipelineLeadId)
        .order("created_at", { ascending: false })
        .limit(15);
      if (cancelled) return;
      if (error) { setEvents([]); }
      else setEvents((data || []) as TimelineEvent[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [row.pipelineLeadId]);

  if (row.isManual) {
    return (
      <div className="flex items-start gap-2 rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <div className="font-medium text-foreground">Negócio manual</div>
          <div className="text-xs">Este negócio foi adicionado direto no PDN e não tem lead vinculado no pipeline — sem histórico para exibir.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Cabeçalho leitura */}
      <div className="space-y-2 rounded-lg border bg-muted/30 p-3 text-sm">
        <div className="flex justify-between"><span className="text-muted-foreground">Corretor</span><span className="font-medium">{row.corretor}</span></div>
        {row.equipe !== "—" && <div className="flex justify-between"><span className="text-muted-foreground">Equipe</span><span className="font-medium">Equipe {row.equipe}</span></div>}
        <div className="flex justify-between"><span className="text-muted-foreground">Empreendimento</span><span className="font-medium">{row.empreendimento}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">VGV</span><span className="font-medium">{fmtMoney(row.vgv, "exact")}</span></div>
        {row.data && <div className="flex justify-between"><span className="text-muted-foreground">Data referência</span><span className="font-medium">{formatBRT(row.data, "dd/MM/yy")}</span></div>}
        {row.pipelineLeadId && (
          <a
            href={`/pipeline-leads?lead=${row.pipelineLeadId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
          >
            <ExternalLink className="h-3 w-3" /> Abrir lead no pipeline
          </a>
        )}
      </div>

      {/* Timeline */}
      <div className="space-y-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Últimos eventos</div>
        {loading ? (
          <div className="flex items-center gap-2 py-4 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando…
          </div>
        ) : events.length === 0 ? (
          <div className="rounded-lg border border-dashed py-6 text-center text-xs text-muted-foreground">Sem eventos registrados.</div>
        ) : (
          <ol className="space-y-2">
            {events.map((e, i) => (
              <li key={e.event_id || i} className="rounded-lg border bg-card p-2.5">
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span className="font-medium uppercase tracking-wide">{e.categoria || e.tipo || "evento"}</span>
                  {e.created_at && <span>{formatBRT(e.created_at, "dd/MM HH:mm")}</span>}
                </div>
                {e.descricao && <div className="mt-1 text-sm text-foreground">{e.descricao}</div>}
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
