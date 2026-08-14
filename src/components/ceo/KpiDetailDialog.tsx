import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { formatBRLCompact, brtRangeToUTC } from "@/lib/utils";
import VisitasPorEquipeList from "@/components/ceo/VisitasPorEquipeList";

export type KpiDetailType =
  | "total_leads"
  | "reaproveitados_oa"
  | "enviados_roleta"
  | "novos_agendamentos"
  | "visitas_criadas"
  | "visitas_marcadas"
  | "visitas_realizadas"
  | "visitas_no_show"
  | "negocios"
  | "propostas"
  | "negociacao"
  | "contratos"
  | "assinados"
  | "vgv_assinado"
  | "tentativas"
  | "aproveitados"
  | "presentes_hoje";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  type: KpiDetailType;
  label: string;
  dateRange: { start: string; end: string };
}

interface RowData {
  id: string;
  nome: string;
  sub?: string;
  extra?: string;
  date?: string;
  leadId?: string;
}

// Mapa KPI → fases canônicas. Após a consolidação (07/2026), propostas /
// negociação / documentação viraram uma única fase "em_negociacao" e
// assinados/vgv_assinado viraram "ganho".
const NEGOCIO_FASES: Record<string, string[]> = {
  negocios: [],
  propostas: ["em_negociacao"],
  negociacao: ["em_negociacao"],
  contratos: ["contrato"],
  assinados: ["ganho"],
  vgv_assinado: ["ganho"],
};

/** KPIs de negócio ancorados em data_assinatura (regra VGV fonte única). */
const ASSINATURA_TYPES = new Set(["assinados", "vgv_assinado"]);


export default function KpiDetailDialog({ open, onOpenChange, type, label, dateRange }: Props) {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<RowData[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    if (type === "novos_agendamentos") { setRows([]); return; }
    setLoading(true);
    fetchData().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, type, dateRange.start, dateRange.end]);

  async function fetchData() {
    const start = dateRange.start;
    const end = dateRange.end;
    // Janela BRT convertida para UTC — evita o deslocamento de 3h nas colunas timestamptz
    const { startUtc, endUtc } = brtRangeToUTC(dateRange);

    if (type === "total_leads" || type === "enviados_roleta") {
      let q = supabase
        .from("pipeline_leads")
        .select("id, nome, origem, empreendimento, created_at")
        .gte("created_at", startUtc)
        .lt("created_at", endUtc)
        .order("created_at", { ascending: false })
        .limit(200);
      q = type === "enviados_roleta"
        ? q.not("corretor_id", "is", null)
        : q.not("origem", "ilike", "%oferta%ativa%");
      const { data } = await q;
      setRows((data || []).map(l => ({
        id: l.id, nome: l.nome || "Sem nome",
        sub: l.empreendimento || "",
        date: l.created_at,
        leadId: l.id,
        extra: l.origem || "",
      })));

    } else if (type === "visitas_criadas") {
      const { data } = await supabase
        .from("visitas_unicas" as any)
        .select("id, nome_cliente, empreendimento, data_visita, status, pipeline_lead_id, created_at")
        .gte("created_at", startUtc)
        .lt("created_at", endUtc)
        .order("created_at", { ascending: false })
        .limit(200);
      setRows((data || []).map(v => ({
        id: v.id, nome: v.nome_cliente || "Sem nome",
        sub: v.empreendimento || "",
        date: v.created_at,
        leadId: v.pipeline_lead_id || undefined,
        extra: v.status,
      })));

    } else if (type === "visitas_marcadas" || type === "visitas_realizadas" || type === "visitas_no_show") {
      const statusFilter = type === "visitas_marcadas"
        ? ["marcada", "confirmada", "realizada", "reagendada"]
        : type === "visitas_realizadas"
          ? ["realizada"]
          : ["no_show"];
      const { data } = await supabase
        .from("visitas_unicas" as any)
        .select("id, nome_cliente, empreendimento, data_visita, status, pipeline_lead_id")
        .in("status", statusFilter)
        .gte("data_visita", start)
        .lte("data_visita", end)
        .order("data_visita", { ascending: false })
        .limit(200);
      setRows((data || []).map(v => ({
        id: v.id, nome: v.nome_cliente || "Sem nome",
        sub: v.empreendimento || "",
        date: v.data_visita + "T12:00:00",
        leadId: v.pipeline_lead_id || undefined,
        extra: v.status,
      })));

    } else if (["negocios", "propostas", "negociacao", "contratos", "assinados", "vgv_assinado"].includes(type)) {
      const fases = NEGOCIO_FASES[type];
      const porAssinatura = ASSINATURA_TYPES.has(type);
      let q = supabase
        .from("negocios")
        .select("id, nome_cliente, fase, status, vgv_estimado, vgv_final, empreendimento, pipeline_lead_id, created_at, data_assinatura")
        .limit(200);
      if (porAssinatura) {
        // Vendas: ancoradas em data_assinatura + status ativo (regra VGV fonte única)
        q = q.eq("status", "ativo")
          .gte("data_assinatura", start)
          .lte("data_assinatura", end)
          .order("data_assinatura", { ascending: false });
      } else {
        // Pipeline vivo: snapshot dos negócios ativos, coerente com o funil
        q = q.eq("status", "ativo").order("created_at", { ascending: false });
      }
      if (fases && fases.length > 0) {
        q = q.in("fase", fases);
      }
      const { data } = await q;
      setRows((data || []).map(n => ({
        id: n.id, nome: n.nome_cliente || "Negócio",
        sub: n.empreendimento || "",
        date: porAssinatura ? (n.data_assinatura ? n.data_assinatura + "T12:00:00" : undefined) : (n.created_at || undefined),
        leadId: n.pipeline_lead_id || undefined,
        extra: porAssinatura ? formatBRLCompact(n.vgv_final || n.vgv_estimado || 0) : (n.fase || ""),
      })));

    } else if (type === "tentativas" || type === "aproveitados" || type === "reaproveitados_oa") {
      let q = supabase
        .from("oferta_ativa_tentativas")
        .select("id, created_at, resultado, feedback, empreendimento")
        .gte("created_at", startUtc)
        .lt("created_at", endUtc)
        .order("created_at", { ascending: false })
        .limit(200);
      if (type !== "tentativas") {
        // Aproveitamento = lead com interesse (valor canônico gravado na tentativa)
        q = q.eq("resultado", "com_interesse");
      }
      const { data } = await q;
      setRows((data || []).map(l => ({
        id: l.id, nome: type === "tentativas" ? (l.resultado || "Ligação") : "Aproveitado",
        sub: l.empreendimento || l.feedback?.slice(0, 60) || "",
        date: l.created_at,
        extra: l.resultado || "",
      })));

    } else if (type === "presentes_hoje") {
      const { data } = await supabase
        .from("corretor_disponibilidade")
        .select("id, user_id, status, entrada_em")
        .eq("na_roleta", true);
      const userIds = (data || []).map(d => d.user_id);
      let profileMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, nome")
          .in("user_id", userIds);
        (profiles || []).forEach(p => { profileMap[p.user_id] = p.nome || ""; });
      }
      setRows((data || []).map(d => ({
        id: d.id, nome: profileMap[d.user_id] || "Corretor",
        sub: d.status,
        date: d.entrada_em || undefined,
      })));
    }
  }


  const goToLead = (leadId: string) => {
    onOpenChange(false);
    navigate(`/pipeline-leads?lead=${leadId}`);
  };

  if (type === "novos_agendamentos") {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-base">{label} — por equipe e corretor</DialogTitle>
          </DialogHeader>
          <VisitasPorEquipeList dateRange={dateRange} onOpenLead={goToLead} />
        </DialogContent>
      </Dialog>
    );
  }

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
          <div className="overflow-y-auto flex-1 -mx-2 px-2 space-y-1">
            {rows.map(row => (
              <div key={row.id} className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-muted/50 group">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{row.nome}</p>
                  {row.sub && <p className="text-xs text-muted-foreground truncate">{row.sub}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {row.extra && (
                    <Badge variant="outline" className="text-[10px]">{row.extra}</Badge>
                  )}
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
        )}
      </DialogContent>
    </Dialog>
  );
}
