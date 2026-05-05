import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Rocket, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { getBrtDateInfo } from "@/hooks/useRoleta";

interface CampanhaMap {
  empreendimento: string;
  segmento_nome: string;
  ignorar_segmento: boolean;
}

const SEG_GERAL = "Geral (todos)";
const SEG_AVULSO = "S3 - Avulso";

function resolveSegmentoNome(
  emp: string | null,
  origem: string | null,
  campanhas: CampanhaMap[],
  hasAvulsoSegmento: boolean
): string | null {
  const matchToName = (c: CampanhaMap) => (c.ignorar_segmento ? SEG_GERAL : c.segmento_nome);
  const lower = (emp || "").toLowerCase().trim();

  if (lower) {
    // Exact
    const exact = campanhas.find((c) => c.empreendimento.toLowerCase().trim() === lower);
    if (exact) return matchToName(exact);

    // Substring (longest first)
    const sorted = [...campanhas].sort(
      (a, b) => b.empreendimento.length - a.empreendimento.length
    );
    for (const c of sorted) {
      const k = c.empreendimento.toLowerCase().trim();
      if (!k) continue;
      if (lower.includes(k) || k.includes(lower)) return matchToName(c);
    }
  }

  // Fallback por origem: ImovelWeb e Site → S3 - Avulso
  const orig = (origem || "").toLowerCase().trim();
  if (hasAvulsoSegmento && (orig === "imovelweb" || orig === "site_uhome" || orig === "site")) {
    return SEG_AVULSO;
  }
  return null;
}

interface SegmentoPreview {
  segmento_nome: string;
  empreendimentos: string[];
  count: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDispatched?: () => void;
}

type Destino = "manha" | "tarde" | "noturna" | "qualquer" | "dia_todo" | "oferta_ativa";

const DESTINO_OPTIONS: {
  id: Destino;
  label: string;
  emoji: string;
  group: "roleta" | "oferta";
  allDayOnly?: boolean;
  shiftOnly?: boolean;
}[] = [
  { id: "dia_todo", label: "Dia Todo", emoji: "☀️", group: "roleta", allDayOnly: true },
  { id: "manha", label: "Roleta da Manhã", emoji: "🌅", group: "roleta", shiftOnly: true },
  { id: "tarde", label: "Roleta da Tarde", emoji: "☀️", group: "roleta", shiftOnly: true },
  { id: "noturna", label: "Roleta Noturna", emoji: "🌙", group: "roleta", shiftOnly: true },
  { id: "qualquer", label: "Balancear automaticamente", emoji: "📋", group: "roleta" },
  { id: "oferta_ativa", label: "Enviar para Oferta Ativa", emoji: "📞", group: "oferta" },
];

const FAILURE_REASON_LABELS: Record<string, string> = {
  all_brokers_exhausted: "já passaram por todos os corretores (timeout/rejeição)",
  no_fila_active: "sem corretores na fila/janela selecionada",
  no_broker_available: "sem corretor elegível disponível",
  lead_not_found: "lead não encontrado",
  already_assigned: "lead já atribuído",
  rpc_error: "erro interno na distribuição",
  unknown: "motivo desconhecido",
};

export default function FilaCeoDispatchModal({ open, onOpenChange, onDispatched }: Props) {
  const [loading, setLoading] = useState(false);
  const [dispatching, setDispatching] = useState(false);
  const [leads, setLeads] = useState<any[]>([]);
  const [campanhas, setCampanhas] = useState<CampanhaMap[]>([]);
  const { isSunday, isHoliday } = getBrtDateInfo();
  const isAllDayRoleta = isSunday || isHoliday;
  const [selectedDestino, setSelectedDestino] = useState<Destino>(isAllDayRoleta ? "dia_todo" : "qualquer");
  const [includeUnidentified, setIncludeUnidentified] = useState(true);

  useEffect(() => {
    setSelectedDestino(isAllDayRoleta ? "dia_todo" : "qualquer");
  }, [isAllDayRoleta, open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setLeads([]);
    setCampanhas([]);
    (async () => {
      const [leadsRes, segRes, campRes] = await Promise.all([
        supabase
          .from("pipeline_leads")
          .select("id, nome, empreendimento, telefone, origem, aceite_status", { count: "exact" })
          .is("corretor_id", null)
          .eq("aceite_status", "pendente_distribuicao")
          .order("created_at", { ascending: true })
          .limit(2000),
        supabase
          .from("roleta_segmentos")
          .select("id, nome, ativo")
          .eq("ativo", true),
        supabase
          .from("roleta_campanhas")
          .select("empreendimento, segmento_id, ativo, ignorar_segmento, roleta_segmentos(id, nome, ativo)")
          .eq("ativo", true),
      ]);
      if (cancelled) return;

      if (leadsRes.error) {
        console.error("[FilaCeoDispatchModal] leads fetch error:", leadsRes.error);
        toast.error("Erro ao carregar fila CEO");
      }
      if (segRes.error || campRes.error) {
        console.error("[FilaCeoDispatchModal] segmentos/campanhas fetch error:", segRes.error || campRes.error);
        toast.error("Erro ao carregar segmentos do banco");
      }

      const activeSegIds = new Set(((segRes.data || []) as any[]).map((s) => s.id));
      const activeSegNames = new Set(((segRes.data || []) as any[]).map((s) => String(s.nome).trim()));

      const camps: CampanhaMap[] = ((campRes.data || []) as any[])
        .map((c) => ({
          empreendimento: String(c.empreendimento || "").trim(),
          segmento_id: c.segmento_id as string | null,
          segmento_nome: String(c.roleta_segmentos?.nome || "").trim(),
          segmento_ativo: !!c.roleta_segmentos?.ativo,
          ignorar_segmento: !!c.ignorar_segmento,
        }))
        // Aceita: (a) campanhas com segmento ativo válido OU (b) campanhas marcadas como "ignorar_segmento" (Geral/todos)
        .filter((c) =>
          c.empreendimento &&
          (
            c.ignorar_segmento ||
            (c.segmento_nome && c.segmento_ativo && c.segmento_id && activeSegIds.has(c.segmento_id) && activeSegNames.has(c.segmento_nome))
          )
        )
        .map(({ empreendimento, segmento_nome, ignorar_segmento }) => ({ empreendimento, segmento_nome, ignorar_segmento }));

      if (camps.length === 0) {
        toast.error("Nenhuma campanha ativa vinculada a segmentos S1–S4. Configure em Configurações → Campanhas da Roleta.");
      }

      setCampanhas(camps);
      console.info(`[FilaCeoDispatchModal] Fila CEO: ${leadsRes.data?.length || 0} leads; ${camps.length} campanhas válidas (S1–S4 do banco)`);
      setLeads(leadsRes.data || []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [open]);

  const { preview, unidentifiedCount, identifiedLeadIds, allLeadIds } = useMemo(() => {
    const groups: Record<string, SegmentoPreview> = {};
    let unidentified = 0;
    const identified: string[] = [];
    const all: string[] = [];

    // S3 - Avulso é segmento por origem (sem empreendimento próprio na roleta_campanhas)
    const hasAvulso = true;

    for (const lead of leads) {
      all.push(lead.id);
      const segNome = resolveSegmentoNome(lead.empreendimento, lead.origem, campanhas, hasAvulso);
      if (segNome) {
        identified.push(lead.id);
        if (!groups[segNome]) {
          groups[segNome] = { segmento_nome: segNome, empreendimentos: [], count: 0 };
        }
        groups[segNome].count++;
        const empName = lead.empreendimento || "";
        if (!groups[segNome].empreendimentos.includes(empName)) {
          groups[segNome].empreendimentos.push(empName);
        }
      } else {
        unidentified++;
      }
    }

    // Ordenação canônica: "Geral" primeiro, depois S1, S2, S3, S4.
    const segOrder = (nome: string): number => {
      if (nome === SEG_GERAL) return 0;
      const m = /^s\s*(\d+)/i.exec(nome.trim());
      return m ? parseInt(m[1], 10) : 999;
    };

    return {
      preview: Object.values(groups).sort((a, b) => {
        const oa = segOrder(a.segmento_nome);
        const ob = segOrder(b.segmento_nome);
        if (oa !== ob) return oa - ob;
        return a.segmento_nome.localeCompare(b.segmento_nome, "pt-BR");
      }),
      unidentifiedCount: unidentified,
      identifiedLeadIds: identified,
      allLeadIds: all,
    };
  }, [leads, campanhas]);

  const isOfertaAtiva = selectedDestino === "oferta_ativa";
  const leadsToDispatch = includeUnidentified ? allLeadIds : identifiedLeadIds;

  const SEGMENTO_COLORS: Record<string, string> = {
    [SEG_GERAL]: "bg-indigo-500/10 text-indigo-700 border-indigo-500/30 dark:text-indigo-300",
    "S1 - MCMV / Médio Padrão": "bg-blue-500/10 text-blue-700 border-blue-500/30 dark:text-blue-300",
    "S2 - Alto Padrão": "bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-300",
    "S3 - Avulso": "bg-pink-500/10 text-pink-700 border-pink-500/30 dark:text-pink-300",
    "S4 - Investimento": "bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-300",
  };

  const handleDispatch = async () => {
    if (leadsToDispatch.length === 0) return;
    setDispatching(true);

    try {
      const { data: refreshData, error: refreshError } = await (supabase.auth as any).refreshSession();
      const session = refreshData?.session;
      if (refreshError || !session?.access_token) {
        toast.error("Sessão expirada. Faça login novamente.");
        setDispatching(false);
        return;
      }

      if (isOfertaAtiva) {
        let dispatched = 0;
        for (const leadId of leadsToDispatch) {
          const { error } = await supabase
            .from("pipeline_leads")
            .update({ etapa: "Oferta Ativa", updated_at: new Date().toISOString() })
            .eq("id", leadId);
          if (!error) dispatched++;
        }

        await supabase.from("audit_log").insert({
          user_id: session.user.id,
          modulo: "roleta",
          acao: "dispatch_fila_ceo_oferta_ativa",
          descricao: `Enviou ${dispatched} leads para Oferta Ativa`,
          depois: { dispatched, destino: "oferta_ativa" },
        });

        toast.success(`✅ ${dispatched} leads enviados para Oferta Ativa!`);
      } else {
        const { data: result, error } = await supabase.functions.invoke("distribute-lead", {
          body: {
            action: "dispatch_fila_ceo",
            pipeline_lead_ids: leadsToDispatch,
            janela: selectedDestino,
          },
        });

        if (error) {
          console.error("Batch dispatch error:", error);
          toast.error("Erro ao disparar leads: " + (error.message || ""));
        } else if (result) {
          const { dispatched = 0, failed = 0, failed_by_reason = {} } = result;

          if (dispatched > 0 && failed === 0) {
            toast.success(`✅ ${dispatched} leads distribuídos com sucesso!`);
          } else if (dispatched > 0 && failed > 0) {
            const reasonParts = Object.entries(failed_by_reason as Record<string, number>)
              .map(([reason, count]) => `${count} ${FAILURE_REASON_LABELS[reason] || reason}`)
              .join(", ");
            toast.success(`✅ ${dispatched} distribuídos. ⚠️ ${failed} falharam: ${reasonParts}`);
          } else {
            const reasonParts = Object.entries(failed_by_reason as Record<string, number>)
              .map(([reason, count]) => `${count} ${FAILURE_REASON_LABELS[reason] || reason}`)
              .join(", ");
            toast.error(`❌ Nenhum lead distribuído. ${reasonParts || "Verifique a roleta."}`);
          }
        }
      }

      onOpenChange(false);
      onDispatched?.();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao disparar leads.");
    } finally {
      setDispatching(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Rocket className="h-5 w-5 text-primary" />
            Disparar Fila CEO
          </DialogTitle>
          <DialogDescription>
            {leads.length} leads serão distribuídos com balanceamento global.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-5">
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Prévia por segmento</p>
              {preview.map((p) => (
                <div key={p.segmento_nome} className={`flex items-center justify-between p-2.5 rounded-lg border ${SEGMENTO_COLORS[p.segmento_nome] || "bg-muted/50 border-border"}`}>
                  <div>
                    <span className="text-sm font-medium">● {p.segmento_nome}</span>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{p.empreendimentos.join(", ")}</p>
                  </div>
                  <Badge variant="secondary" className="font-bold">{p.count} leads</Badge>
                </div>
              ))}
              {unidentifiedCount > 0 && (
                <div className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-muted/40">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Sem segmento</span>
                  </div>
                  <Badge variant="secondary" className="font-bold">{unidentifiedCount} leads</Badge>
                </div>
              )}
              <p className="text-[10px] text-muted-foreground">
                💡 Em domingo e feriado a roleta usa Dia Todo. De segunda a sábado, usa turnos normais.
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Disparar para onde?</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mt-1 mb-1">Roleta</p>
              <div className="grid grid-cols-1 gap-1.5">
                {DESTINO_OPTIONS.filter((d) => d.group === "roleta")
                  .filter((d) => {
                    if (d.allDayOnly && !isAllDayRoleta) return false;
                    if (d.shiftOnly && isAllDayRoleta) return false;
                    return true;
                  })
                  .map((j) => (
                    <button
                      key={j.id}
                      onClick={() => setSelectedDestino(j.id)}
                      className={`flex items-center gap-2 p-2.5 rounded-lg border text-sm text-left transition-colors ${
                        selectedDestino === j.id
                          ? "border-primary bg-primary/10 text-primary font-medium"
                          : "border-border hover:border-primary/40 text-foreground"
                      }`}
                    >
                      <span>{j.emoji}</span>
                      <span>{j.label}</span>
                    </button>
                  ))}
              </div>

              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mt-3 mb-1">Oferta Ativa</p>
              <div className="grid grid-cols-1 gap-1.5">
                {DESTINO_OPTIONS.filter((d) => d.group === "oferta").map((j) => (
                  <button
                    key={j.id}
                    onClick={() => setSelectedDestino(j.id)}
                    className={`flex items-center gap-2 p-2.5 rounded-lg border text-sm text-left transition-colors ${
                      selectedDestino === j.id
                        ? "border-primary bg-primary/10 text-primary font-medium"
                        : "border-border hover:border-primary/40 text-foreground"
                    }`}
                  >
                    <span>{j.emoji}</span>
                    <span>{j.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {unidentifiedCount > 0 && (
              <div className="flex items-center gap-2">
                <Checkbox id="include-unidentified" checked={includeUnidentified} onCheckedChange={(v) => setIncludeUnidentified(!!v)} />
                <label htmlFor="include-unidentified" className="text-xs text-muted-foreground cursor-pointer">
                  Incluir leads sem segmento
                </label>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={dispatching}>
                Cancelar
              </Button>
              <Button onClick={handleDispatch} disabled={dispatching || leadsToDispatch.length === 0} className="gap-2">
                {dispatching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
                {isOfertaAtiva ? "Enviar para Oferta Ativa" : `Disparar ${leadsToDispatch.length} leads`}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
