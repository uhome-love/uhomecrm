import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { formatBRLCompact } from "@/lib/utils";

export type ManagerKpiType = "ligacoes" | "aproveitados" | "visitas" | "vgv";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  type: ManagerKpiType;
  label: string;
  teamUserIds: string[];
  teamNameMap: Record<string, string>;
  dateRange: { start: string; end: string };
}

interface DetailRow {
  id: string;
  corretor: string;
  nome: string;
  sub?: string;
  extra?: string;
  date?: string;
  leadId?: string;
}

export default function ManagerKpiDetailDialog({ open, onOpenChange, type, label, teamUserIds, teamNameMap, dateRange }: Props) {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<DetailRow[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open || teamUserIds.length === 0) return;
    setLoading(true);
    fetchData().finally(() => setLoading(false));
  }, [open, type, dateRange.start, dateRange.end]);

  async function fetchData() {
    const { start, end } = dateRange;

    if (type === "ligacoes" || type === "aproveitados") {
      let q = supabase
        .from("oferta_ativa_tentativas")
        .select("id, corretor_id, created_at, resultado, empreendimento, feedback")
        .in("corretor_id", teamUserIds)
        .gte("created_at", `${start}T00:00:00`)
        .lte("created_at", `${end}T23:59:59`)
        .order("created_at", { ascending: false })
        .limit(300);
      if (type === "aproveitados") {
        q = q.eq("resultado", "com_interesse");
      }
      const { data } = await q;
      setRows((data || []).map(t => ({
        id: t.id,
        corretor: teamNameMap[t.corretor_id] || "Corretor",
        nome: type === "aproveitados" ? "Com interesse" : (t.resultado || "Ligação"),
        sub: t.empreendimento || (typeof t.feedback === 'string' ? t.feedback.slice(0, 60) : "") || "",
        date: t.created_at,
        extra: t.resultado || "",
      })));

    } else if (type === "visitas") {
      const { data } = await supabase
        .from("visitas")
        .select("id, corretor_id, nome_cliente, empreendimento, data_visita, status, pipeline_lead_id")
        .in("corretor_id", teamUserIds)
        .gte("data_visita", start)
        .lte("data_visita", end)
        .order("data_visita", { ascending: false })
        .limit(300);
      setRows((data || []).map(v => ({
        id: v.id,
        corretor: teamNameMap[v.corretor_id || ""] || "Corretor",
        nome: v.nome_cliente || "Sem nome",
        sub: v.empreendimento || "",
        date: v.data_visita + "T12:00:00",
        leadId: v.pipeline_lead_id || undefined,
        extra: v.status === "realizada" ? "✅ Realizada" : v.status === "marcada" ? "📋 Marcada" : v.status || "",
      })));

    } else if (type === "vgv") {
      const { data } = await supabase
        .from("negocios")
        .select("id, corretor_id, auth_user_id, nome_cliente, fase, vgv_estimado, vgv_final, empreendimento, pipeline_lead_id, created_at")
        .or(teamUserIds.map(id => `corretor_id.eq.${id},auth_user_id.eq.${id}`).join(","))
        .in("fase", ["assinado", "vendido"])
        .gte("created_at", `${start}T00:00:00`)
        .lte("created_at", `${end}T23:59:59`)
        .order("created_at", { ascending: false })
        .limit(300);
      setRows((data || []).map(n => {
        const cId = n.corretor_id || n.auth_user_id || "";
        return {
          id: n.id,
          corretor: teamNameMap[cId] || "Corretor",
          nome: n.nome_cliente || "Negócio",
          sub: n.empreendimento || "",
          date: n.created_at || undefined,
          leadId: n.pipeline_lead_id || undefined,
          extra: formatBRLCompact(n.vgv_final || n.vgv_estimado || 0),
        };
      }));
    }
  }

  const goToLead = (leadId: string) => {
    onOpenChange(false);
    navigate(`/pipeline?lead=${leadId}`);
  };

  // Group by corretor
  const grouped = rows.reduce<Record<string, DetailRow[]>>((acc, row) => {
    if (!acc[row.corretor]) acc[row.corretor] = [];
    acc[row.corretor].push(row);
    return acc;
  }, {});

  const sortedCorretores = Object.keys(grouped).sort((a, b) => grouped[b].length - grouped[a].length);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-base">{label} — Detalhes</DialogTitle>
          <p className="text-xs text-muted-foreground">{rows.length} registro(s)</p>
        </DialogHeader>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhum registro encontrado.</p>
        ) : (
          <div className="overflow-y-auto flex-1 -mx-2 px-2 space-y-4">
            {sortedCorretores.map(corretor => (
              <div key={corretor}>
                <div className="flex items-center gap-2 mb-1.5 sticky top-0 bg-background/95 backdrop-blur-sm py-1 z-10">
                  <span className="text-xs font-semibold text-foreground">{corretor}</span>
                  <Badge variant="secondary" className="text-[10px]">{grouped[corretor].length}</Badge>
                </div>
                <div className="space-y-0.5">
                  {grouped[corretor].map(row => (
                    <div key={row.id} className="flex items-center gap-3 py-1.5 px-3 rounded-lg hover:bg-muted/50 group">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{row.nome}</p>
                        {row.sub && <p className="text-xs text-muted-foreground truncate">{row.sub}</p>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {row.extra && <Badge variant="outline" className="text-[10px]">{row.extra}</Badge>}
                        {row.date && (
                          <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                            {format(new Date(row.date), "dd/MM", { locale: ptBR })}
                          </span>
                        )}
                        {row.leadId && (
                          <button
                            onClick={() => goToLead(row.leadId!)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-primary hover:text-primary/80"
                            title="Abrir no pipeline"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
