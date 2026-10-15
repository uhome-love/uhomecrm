/** Mini quadro "Próxima visita" da Minha rotina. Só lê. */
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { CalendarCheck } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export default function ProximaVisitaCard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const hoje = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const { data, isLoading } = useQuery({
    queryKey: ["proxima-visita", user?.id, hoje],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("visitas")
        .select("id, nome_cliente, empreendimento, hora_visita, pipeline_lead_id")
        .eq("corretor_id", user!.id).eq("data_visita", hoje)
        .in("status", ["marcada", "confirmada"])
        .order("hora_visita", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
  const v = data?.[0];

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <CalendarCheck className="h-4 w-4" />
        </span>
        <span className="flex-1 text-[13.5px] font-bold text-foreground">Próxima visita</span>
        {(data?.length ?? 0) > 1 && <span className="text-[11px] text-muted-foreground">+{data!.length - 1} hoje</span>}
      </div>
      {isLoading ? (
        <p className="mt-3 text-xs text-muted-foreground">Carregando…</p>
      ) : v ? (
        <button type="button" onClick={() => navigate(v.pipeline_lead_id ? `/pipeline-leads?lead=${v.pipeline_lead_id}` : "/agenda-visitas")}
          className="mt-3 w-full rounded-lg border border-border px-3 py-2 text-left hover:bg-muted/40">
          <span className="block text-sm font-bold text-primary">{(v.hora_visita || "").slice(0, 5) || "--:--"}</span>
          <span className="block truncate text-[13px] font-semibold text-foreground">{v.nome_cliente}</span>
          {v.empreendimento && <span className="block truncate text-[11px] text-muted-foreground">{v.empreendimento}</span>}
        </button>
      ) : (
        <button type="button" onClick={() => navigate("/pipeline-leads")} className="mt-3 text-left text-[12.5px] text-muted-foreground hover:text-primary">
          Sem visita hoje · <span className="font-semibold text-primary">Marcar visita →</span>
        </button>
      )}
    </div>
  );
}
