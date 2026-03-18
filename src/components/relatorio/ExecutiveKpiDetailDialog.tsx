import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { formatBRLCompact } from "@/lib/utils";
import type { ExecutiveKpis } from "@/hooks/useRelatorioExecutivo";

export type ExecKpiType = keyof ExecutiveKpis;

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  type: ExecKpiType;
  label: string;
  /** null = all (admin), otherwise scoped user IDs */
  scopeUserIds: string[] | null;
  /** profile IDs for roleta/negocios corretor_id */
  scopeProfileIds: string[] | null;
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

export default function ExecutiveKpiDetailDialog({ open, onOpenChange, type, label, scopeUserIds, scopeProfileIds, dateRange }: Props) {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<DetailRow[]>([]);
  const [nameMap, setNameMap] = useState<Record<string, string>>({});
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetchData().finally(() => setLoading(false));
  }, [open, type, dateRange.start, dateRange.end]);

  async function fetchData() {
    const { start, end } = dateRange;
    const tsStart = `${start}T00:00:00`;
    const tsEnd = `${end}T23:59:59`;

    // Build name map from team_members
    const { data: members } = await supabase.from("team_members").select("user_id, nome").eq("status", "ativo");
    const nm: Record<string, string> = {};
    (members || []).forEach(m => { if (m.user_id) nm[m.user_id] = m.nome || "Corretor"; });
    // Also map profile IDs
    const allUids = Object.keys(nm);
    if (allUids.length > 0) {
      const { data: profs } = await supabase.from("profiles").select("id, user_id").in("user_id", allUids);
      (profs || []).forEach(p => { if (p.user_id && nm[p.user_id]) nm[p.id] = nm[p.user_id]; });
    }
    setNameMap(nm);

    const applyScope = (q: any, col: string) => {
      if (scopeUserIds) return q.in(col, scopeUserIds.length > 0 ? scopeUserIds : ["__none__"]);
      return q;
    };

    if (type === "presencas") {
      let q = supabase.from("roleta_credenciamentos").select("id, corretor_id, data, status")
        .in("status", ["aprovado", "saiu"])
        .gte("data", start).lte("data", end)
        .order("data", { ascending: false }).limit(5000);
      if (scopeProfileIds) q = q.in("corretor_id", scopeProfileIds.length > 0 ? scopeProfileIds : ["__none__"]);
      const { data } = await q;
      setRows((data || []).map(r => ({
        id: r.id,
        corretor: nm[r.corretor_id] || "Corretor",
        nome: "Presença",
        date: r.data + "T12:00:00",
        extra: r.status === "aprovado" ? "✅ Aprovado" : "🚪 Saiu",
      })));

    } else if (type === "ligacoes") {
      let q = supabase.from("oferta_ativa_tentativas").select("id, corretor_id, created_at, resultado, empreendimento")
        .gte("created_at", tsStart).lte("created_at", tsEnd)
        .order("created_at", { ascending: false }).limit(5000);
      q = applyScope(q, "corretor_id");
      const { data } = await q;
      setRows((data || []).map(t => ({
        id: t.id,
        corretor: nm[t.corretor_id] || "Corretor",
        nome: t.resultado || "Ligação",
        sub: t.empreendimento || "",
        date: t.created_at,
      })));

    } else if (type === "leadsRecebidos") {
      let q = supabase.from("pipeline_leads").select("id, corretor_id, nome, created_at, empreendimento")
        .gte("created_at", tsStart).lte("created_at", tsEnd)
        .order("created_at", { ascending: false }).limit(5000);
      q = applyScope(q, "corretor_id");
      const { data } = await q;
      setRows((data || []).map(l => ({
        id: l.id,
        corretor: nm[l.corretor_id || ""] || "Corretor",
        nome: l.nome || "Lead",
        sub: l.empreendimento || "",
        date: l.created_at,
        leadId: l.id,
      })));

    } else if (type === "visitasMarcadas" || type === "visitasRealizadas") {
      let q = supabase.from("visitas").select("id, corretor_id, nome_cliente, empreendimento, data_visita, status, pipeline_lead_id")
        .gte("data_visita", start).lte("data_visita", end)
        .order("data_visita", { ascending: false }).limit(5000);
      if (type === "visitasRealizadas") q = q.eq("status", "realizada");
      q = applyScope(q, "corretor_id");
      const { data } = await q;
      setRows((data || []).map(v => ({
        id: v.id,
        corretor: nm[v.corretor_id || ""] || "Corretor",
        nome: v.nome_cliente || "Sem nome",
        sub: v.empreendimento || "",
        date: v.data_visita + "T12:00:00",
        leadId: v.pipeline_lead_id || undefined,
        extra: v.status === "realizada" ? "✅ Realizada" : "📋 Marcada",
      })));

    } else if (type === "negociosCriados" || type === "negociosGerados") {
      let q = supabase.from("negocios").select("id, corretor_id, auth_user_id, nome_cliente, fase, empreendimento, pipeline_lead_id, created_at")
        .gte("created_at", tsStart).lte("created_at", tsEnd)
        .order("created_at", { ascending: false }).limit(5000);
      if (type === "negociosGerados") q = q.in("fase", ["proposta", "negociacao", "documentacao", "assinado", "vendido"]);
      if (scopeProfileIds) {
        const orParts = [
          ...scopeProfileIds.map(id => `corretor_id.eq.${id}`),
          ...(scopeUserIds || []).map(id => `auth_user_id.eq.${id}`),
        ];
        if (orParts.length > 0) q = q.or(orParts.join(","));
      }
      const { data } = await q;
      setRows((data || []).map(n => ({
        id: n.id,
        corretor: nm[n.corretor_id || ""] || nm[n.auth_user_id || ""] || "Corretor",
        nome: n.nome_cliente || "Negócio",
        sub: n.empreendimento || "",
        date: n.created_at,
        leadId: n.pipeline_lead_id || undefined,
        extra: n.fase || "",
      })));

    } else if (type === "negociosAssinados" || type === "vgvTotal") {
      let q = supabase.from("negocios").select("id, corretor_id, auth_user_id, nome_cliente, fase, vgv_estimado, vgv_final, empreendimento, pipeline_lead_id, data_assinatura")
        .in("fase", ["assinado", "vendido"])
        .gte("data_assinatura", start).lte("data_assinatura", end)
        .order("data_assinatura", { ascending: false }).limit(5000);
      if (scopeProfileIds) {
        const orParts = [
          ...scopeProfileIds.map(id => `corretor_id.eq.${id}`),
          ...(scopeUserIds || []).map(id => `auth_user_id.eq.${id}`),
        ];
        if (orParts.length > 0) q = q.or(orParts.join(","));
      }
      const { data } = await q;
      setRows((data || []).map(n => ({
        id: n.id,
        corretor: nm[n.corretor_id || ""] || nm[n.auth_user_id || ""] || "Corretor",
        nome: n.nome_cliente || "Negócio",
        sub: n.empreendimento || "",
        date: n.data_assinatura ? n.data_assinatura + "T12:00:00" : undefined,
        leadId: n.pipeline_lead_id || undefined,
        extra: formatBRLCompact(n.vgv_final || n.vgv_estimado || 0),
      })));

    } else {
      // leadsAtivos or unknown - no detail
      setRows([]);
    }
  }

  const goToLead = (leadId: string) => {
    onOpenChange(false);
    navigate(`/pipeline?lead=${leadId}`);
  };

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
