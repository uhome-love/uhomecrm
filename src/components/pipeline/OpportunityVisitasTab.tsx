import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { MapPin, Calendar, Clock, User, CheckCircle2, XCircle, AlertCircle, Eye } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Visita {
  id: string;
  nome_cliente: string;
  data_visita: string;
  hora_visita: string | null;
  empreendimento: string | null;
  local_visita: string | null;
  status: string;
  resultado_visita: string | null;
  observacoes: string | null;
  origem: string;
  corretor_id: string;
  telefone: string | null;
}

const STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
  agendada: { label: "Agendada", color: "bg-blue-500/10 text-blue-600 border-blue-200", icon: Calendar },
  confirmada: { label: "Confirmada", color: "bg-emerald-500/10 text-emerald-600 border-emerald-200", icon: CheckCircle2 },
  realizada: { label: "Realizada", color: "bg-green-500/10 text-green-600 border-green-200", icon: CheckCircle2 },
  cancelada: { label: "Cancelada", color: "bg-red-500/10 text-red-600 border-red-200", icon: XCircle },
  nao_compareceu: { label: "Não compareceu", color: "bg-amber-500/10 text-amber-600 border-amber-200", icon: AlertCircle },
  reagendada: { label: "Reagendada", color: "bg-purple-500/10 text-purple-600 border-purple-200", icon: Clock },
};

const RESULTADO_MAP: Record<string, string> = {
  quer_proposta: "🎯 Quer proposta",
  vai_pensar: "🤔 Vai pensar",
  nao_gostou: "👎 Não gostou",
  nao_compareceu: "❌ Não compareceu",
  reagendar: "🔄 Reagendar",
  quer_ver_outro: "🔍 Quer ver outro",
};

export default function OpportunityVisitasTab({ pipelineLeadId }: { pipelineLeadId: string }) {
  const [visitas, setVisitas] = useState<Visita[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("visitas")
        .select("id, nome_cliente, data_visita, hora_visita, empreendimento, local_visita, status, resultado_visita, observacoes, origem, corretor_id, telefone")
        .eq("pipeline_lead_id", pipelineLeadId)
        .order("data_visita", { ascending: false });
      setVisitas((data || []) as Visita[]);
      setLoading(false);
    })();
  }, [pipelineLeadId]);

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Clock className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  if (visitas.length === 0) {
    return (
      <div className="flex flex-col items-center py-8 text-center">
        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center mb-2">
          <MapPin className="h-4 w-4 text-muted-foreground/40" />
        </div>
        <span className="text-xs text-muted-foreground">Nenhuma visita vinculada</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-1">
        <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
          <Eye className="h-3.5 w-3.5 text-primary" />
          {visitas.length} visita{visitas.length !== 1 ? "s" : ""}
        </h4>
      </div>
      {visitas.map(v => {
        const statusInfo = STATUS_MAP[v.status] || STATUS_MAP.agendada;
        const StatusIcon = statusInfo.icon;
        return (
          <div key={v.id} className="p-3 rounded-lg border border-border/50 bg-card hover:bg-accent/20 transition-colors space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <MapPin className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground">
                    {format(new Date(v.data_visita + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR })}
                    {v.hora_visita && <span className="text-muted-foreground font-normal"> às {v.hora_visita.slice(0, 5)}</span>}
                  </p>
                  {v.empreendimento && (
                    <p className="text-[10px] text-muted-foreground">{v.empreendimento}</p>
                  )}
                </div>
              </div>
              <Badge variant="outline" className={`text-[9px] h-5 gap-1 ${statusInfo.color}`}>
                <StatusIcon className="h-3 w-3" />
                {statusInfo.label}
              </Badge>
            </div>

            {v.resultado_visita && (
              <div className="bg-accent/50 rounded px-2 py-1">
                <span className="text-[10px] text-muted-foreground">Resultado: </span>
                <span className="text-[11px] font-semibold text-foreground">
                  {RESULTADO_MAP[v.resultado_visita] || v.resultado_visita}
                </span>
              </div>
            )}

            {v.local_visita && (
              <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                <MapPin className="h-3 w-3" /> {v.local_visita}
              </p>
            )}

            {v.observacoes && (
              <p className="text-[10px] text-muted-foreground bg-muted/50 rounded p-1.5">{v.observacoes}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
