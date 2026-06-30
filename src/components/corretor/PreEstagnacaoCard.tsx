import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ChevronRight, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface RiscoLead {
  lead_id: string;
  nome: string;
  empreendimento: string | null;
  etapa: string;
  dias_sem_acao: number;
  dias_para_estagnar: number;
  categoria: string;
}

function prazoLabel(l: RiscoLead) {
  if (l.categoria === "em_aviso") return "aviso final";
  if (l.dias_para_estagnar <= 0) return "estagna hoje";
  if (l.dias_para_estagnar === 1) return "estagna amanhã";
  return `estagna em ${l.dias_para_estagnar}d`;
}

export default function PreEstagnacaoCard() {
  const navigate = useNavigate();

  const { data: leads = [] } = useQuery({
    queryKey: ["corretor-pre-estagnacao"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_corretor_pre_estagnacao");
      if (error) throw error;
      return (data || []) as RiscoLead[];
    },
    staleTime: 60_000,
  });

  if (leads.length === 0) return null;

  const emAviso = leads.filter((l) => l.categoria === "em_aviso").length;
  const critico = emAviso > 0;

  const openLead = (id: string) => navigate(`/pipeline?lead=${id}`);

  return (
    <div
      className={`rounded-xl border p-4 ${
        critico ? "border-destructive/30 bg-destructive/5" : "border-warning/30 bg-warning/5"
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span
            className={`flex h-7 w-7 items-center justify-center rounded-full ${
              critico ? "bg-destructive/15 text-destructive" : "bg-warning/15 text-warning"
            }`}
          >
            {critico ? <AlertTriangle className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
          </span>
          <div>
            <p className="text-[13px] font-bold text-foreground leading-tight">
              Leads prestes a estagnar
            </p>
            <p className="text-[11px] text-muted-foreground">
              {leads.length} lead{leads.length > 1 ? "s" : ""} nos próximos 5 dias
              {emAviso > 0 ? ` · ${emAviso} em aviso final` : ""}
            </p>
          </div>
        </div>
        <button
          onClick={() => navigate("/pipeline?risco=estagnacao")}
          className="flex items-center gap-0.5 text-[11px] font-semibold text-primary hover:underline shrink-0"
        >
          Ver todos <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

      <ul className="space-y-1.5">
        {leads.slice(0, 5).map((l) => (
          <li key={l.lead_id}>
            <button
              onClick={() => openLead(l.lead_id)}
              className="w-full flex items-center justify-between gap-2 rounded-lg bg-card/60 hover:bg-card px-2.5 py-2 text-left transition-colors"
            >
              <div className="min-w-0">
                <p className="text-[12.5px] font-medium text-foreground truncate">{l.nome}</p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {l.etapa}
                  {l.empreendimento ? ` · ${l.empreendimento}` : ""}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  l.categoria === "em_aviso"
                    ? "bg-destructive/15 text-destructive"
                    : "bg-warning/15 text-warning"
                }`}
              >
                {prazoLabel(l)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
