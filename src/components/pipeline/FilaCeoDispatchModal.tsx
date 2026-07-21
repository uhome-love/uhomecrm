import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, Rocket, AlertTriangle, Sparkles, HeartHandshake, UserPlus, PauseCircle, Building2 } from "lucide-react";
import { toast } from "sonner";
import { getBrtDateInfo } from "@/hooks/useRoleta";
import { empreendimentoFromTemplate } from "@/lib/reengajamentoEmpreendimento";
import FilaCeoRepassarDialog from "./FilaCeoRepassarDialog";

interface CampanhaMap {
  empreendimento: string;
  segmento_nome: string;
  ignorar_segmento: boolean;
}

const SEG_GERAL = "Geral (todos)";
const SEG_MORADIA = "S1 - Moradia";

function resolveSegmentoNome(
  emp: string | null,
  origem: string | null,
  campanhas: CampanhaMap[],
  hasAvulsoSegmento: boolean
): string | null {
  const matchToName = (c: CampanhaMap) => (c.ignorar_segmento ? SEG_GERAL : c.segmento_nome);
  const lower = (emp || "").toLowerCase().trim();
  const origemLower = (origem || "").toLowerCase().trim();

  // Roteamento explícito por origem (alinhado ao backend distribuir_lead_atomico)
  if (origemLower.includes("imovelweb") || origemLower.includes("site")) {
    return SEG_MORADIA;
  }

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

  // Fallback universal: qualquer lead sem match de campanha → S1 - Moradia
  // (mantém alinhado com distribuir_lead_atomico no banco)
  if (hasAvulsoSegmento) {
    return SEG_MORADIA;
  }
  return null;
}

interface SegmentoPreview {
  segmento_nome: string;
  empreendimentos: string[];
  count: number;
}

/** Rótulo legível da origem/imóvel de um lead para a prévia. */
function leadOrigemLabel(emp: string | null, origem: string | null): string {
  const empName = (emp || "").trim();
  if (empName) return empName;
  const o = (origem || "").toLowerCase();
  if (o.includes("imovelweb")) return "ImóvelWeb";
  if (o.includes("site")) return "Site";
  return "Avulso";
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDispatched?: () => void;
  initialTab?: "novos" | "reengajamento";
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

export default function FilaCeoDispatchModal({ open, onOpenChange, onDispatched, initialTab }: Props) {
  const [loading, setLoading] = useState(false);
  const [dispatching, setDispatching] = useState(false);
  const [allLeads, setAllLeads] = useState<any[]>([]);
  const [campanhas, setCampanhas] = useState<CampanhaMap[]>([]);
  const [empreendimentosMap, setEmpreendimentosMap] = useState<Record<string, string>>({});
  // leadId → empreendimento resolvido pelo template do disparo de reengajamento
  const [reengEmpreendimento, setReengEmpreendimento] = useState<Record<string, string>>({});
  const { isSunday, isHoliday } = getBrtDateInfo();
  const isAllDayRoleta = isSunday || isHoliday;
  const [selectedDestino, setSelectedDestino] = useState<Destino>(isAllDayRoleta ? "dia_todo" : "qualquer");
  const [includeUnidentified, setIncludeUnidentified] = useState(true);
  const [activeTab, setActiveTab] = useState<"novos" | "reengajamento">(initialTab ?? "novos");
  const [repasseLead, setRepasseLead] = useState<{ id: string; nome: string } | null>(null);

  // Separa leads por categoria
  const leadsReengajamento = useMemo(() => allLeads.filter((l) => !!l.reativado_por_nutricao), [allLeads]);
  // Não existe mais categoria "redistribuição": lead retornado à Fila do CEO
  // é tratado como lead novo. Só "reengajamento" (reativado por nutrição) é separado.
  const leadsNovos = useMemo(() => allLeads.filter((l) => !l.reativado_por_nutricao), [allLeads]);
  const leads = activeTab === "novos" ? leadsNovos : leadsReengajamento;

  useEffect(() => {
    if (open && initialTab) setActiveTab(initialTab);
  }, [open, initialTab]);

  useEffect(() => {
    setSelectedDestino(isAllDayRoleta ? "dia_todo" : "qualquer");
  }, [isAllDayRoleta, open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setAllLeads([]);
    setCampanhas([]);
    setReengEmpreendimento({});
    (async () => {
      const [leadsRes, segRes, campRes, empRes] = await Promise.all([
        supabase
          .from("pipeline_leads")
          .select("id, nome, empreendimento, empreendimento_canonico_id, telefone, origem, aceite_status, is_redistribuicao, motivo_redistribuicao, motivo_pendencia, corretor_anterior_id, reativado_por_nutricao, reativado_em, updated_at")
          .is("corretor_id", null)
          .eq("aceite_status", "pendente_distribuicao")
          .eq("arquivado", false)
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
        supabase
          .from("empreendimentos_canonicos")
          .select("id, nome"),
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
        .filter((c) =>
          c.empreendimento &&
          (
            c.ignorar_segmento ||
            (c.segmento_nome && c.segmento_ativo && c.segmento_id && activeSegIds.has(c.segmento_id) && activeSegNames.has(c.segmento_nome))
          )
        )
        .map(({ empreendimento, segmento_nome, ignorar_segmento }) => ({ empreendimento, segmento_nome, ignorar_segmento }));

      if (camps.length === 0) {
        toast.error("Nenhuma campanha ativa vinculada a segmentos S1–S6. Configure em Configurações → Campanhas da Roleta.");
      }

      setCampanhas(camps);
      const empMap: Record<string, string> = {};
      for (const e of ((empRes.data || []) as any[])) empMap[e.id] = e.nome;
      setEmpreendimentosMap(empMap);
      const leadsList = (leadsRes.data || []) as any[];
      setAllLeads(leadsList);

      // Auto-seleciona aba com leads
      const reengCount = leadsList.filter((l) => !!l.reativado_por_nutricao).length;
      const novosCount = leadsList.filter((l) => !l.reativado_por_nutricao).length;
      setActiveTab(novosCount > 0 ? "novos" : reengCount > 0 ? "reengajamento" : "novos");

      console.info(`[FilaCeoDispatchModal] Fila CEO: ${leadsList.length} leads (${novosCount} novos, ${reengCount} reengajamento)`);
      setLoading(false);

      // Para leads de reengajamento SEM empreendimento, descobre o empreendimento
      // pelo template do disparo que originou a reativação (Lake Baikal, Casa Tua, etc.)
      const reengSemEmp = leadsList.filter(
        (l) => !!l.reativado_por_nutricao && !String(l.empreendimento || "").trim()
      );
      if (reengSemEmp.length > 0) {
        const leadIds = reengSemEmp.map((l) => l.id);
        const { data: disparos } = await supabase
          .from("reengajamento_meta_disparos")
          .select("lead_id, template_name, phone, created_at")
          .in("lead_id", leadIds)
          .order("created_at", { ascending: false });

        const byLead: Record<string, string> = {};
        // 1ª passada: casa por lead_id (disparo mais recente já vem primeiro)
        for (const d of (disparos || []) as any[]) {
          const emp = empreendimentoFromTemplate(d.template_name);
          if (emp && d.lead_id && !byLead[d.lead_id]) byLead[d.lead_id] = emp;
        }

        // Fallback por telefone (últimos 10 dígitos) p/ leads criados como "remetente novo"
        const semMatch = reengSemEmp.filter((l) => !byLead[l.id] && l.telefone);
        if (semMatch.length > 0) {
          const results = await Promise.all(
            semMatch.map(async (l) => {
              const tail = String(l.telefone).replace(/\D/g, "").slice(-10);
              if (!tail) return null;
              const { data } = await supabase
                .from("reengajamento_meta_disparos")
                .select("template_name")
                .ilike("phone", `%${tail}%`)
                .order("created_at", { ascending: false })
                .limit(5);
              for (const d of (data || []) as any[]) {
                const emp = empreendimentoFromTemplate(d.template_name);
                if (emp) return { id: l.id, emp };
              }
              return null;
            })
          );
          for (const r of results) {
            if (r && !byLead[r.id]) byLead[r.id] = r.emp;
          }
        }

        if (!cancelled && Object.keys(byLead).length > 0) {
          setReengEmpreendimento(byLead);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [open]);

  const UNIDENT_KEY = "__sem_empreendimento__";

  const { grupos, unidentifiedCount, identifiedLeadIds, allLeadIds } = useMemo(() => {
    const groups: Record<string, { nome: string; leads: any[] }> = {};
    let unidentified = 0;
    const identified: string[] = [];
    const all: string[] = [];

    for (const lead of leads) {
      all.push(lead.id);
      let empNome: string | null = null;
      if (lead.empreendimento_canonico_id && empreendimentosMap[lead.empreendimento_canonico_id]) {
        empNome = empreendimentosMap[lead.empreendimento_canonico_id];
      } else if (String(lead.empreendimento || "").trim()) {
        empNome = String(lead.empreendimento).trim();
      }

      if (empNome) {
        identified.push(lead.id);
        if (!groups[empNome]) groups[empNome] = { nome: empNome, leads: [] };
        groups[empNome].leads.push(lead);
      } else {
        unidentified++;
        if (!groups[UNIDENT_KEY]) groups[UNIDENT_KEY] = { nome: "Sem empreendimento identificado", leads: [] };
        groups[UNIDENT_KEY].leads.push(lead);
      }
    }

    const ordered = Object.entries(groups).sort(([ka, a], [kb, b]) => {
      if (ka === UNIDENT_KEY) return 1;
      if (kb === UNIDENT_KEY) return -1;
      return a.nome.localeCompare(b.nome, "pt-BR");
    });

    return {
      grupos: ordered.map(([key, g]) => ({ key, ...g })),
      unidentifiedCount: unidentified,
      identifiedLeadIds: identified,
      allLeadIds: all,
    };
  }, [leads, empreendimentosMap]);

  const isOfertaAtiva = selectedDestino === "oferta_ativa";
  const leadsToDispatch = includeUnidentified ? allLeadIds : identifiedLeadIds;

  const refetchLeads = async () => {
    const { data } = await supabase
      .from("pipeline_leads")
      .select("id, nome, empreendimento, empreendimento_canonico_id, telefone, origem, aceite_status, is_redistribuicao, motivo_redistribuicao, motivo_pendencia, corretor_anterior_id, reativado_por_nutricao, reativado_em, updated_at")
      .is("corretor_id", null)
      .eq("aceite_status", "pendente_distribuicao")
      .eq("arquivado", false)
      .order("created_at", { ascending: true })
      .limit(2000);
    setAllLeads((data || []) as any[]);
    onDispatched?.();
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Rocket className="h-5 w-5 text-primary" />
            Fila CEO
          </DialogTitle>
          <DialogDescription>
            Distribua leads novos ou de reengajamento para a roleta ou Oferta Ativa.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="novos" className="gap-2">
                <Sparkles className="h-3.5 w-3.5" />
                Novos
                <Badge variant="secondary" className="ml-1 h-5">{leadsNovos.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="reengajamento" className="gap-2">
                <HeartHandshake className="h-3.5 w-3.5" />
                Reengajamento
                <Badge variant="secondary" className="ml-1 h-5">{leadsReengajamento.length}</Badge>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="reengajamento" className="mt-4 space-y-3">
              {leadsReengajamento.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  Nenhum lead reativado pela nutrição aguardando despacho. 🎉
                </div>
              ) : (
                <>
                  <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
                    <p className="text-xs text-emerald-700 dark:text-emerald-300">
                      💚 <strong>Leads reativados pela Nutrição:</strong> responderam positivamente ao disparo de reengajamento. Distribua para um corretor receber como Novo Lead.
                    </p>
                  </div>
                  <div className="max-h-64 overflow-y-auto space-y-1.5">
                    {leadsReengajamento.map((l) => (
                      <div key={l.id} className="flex items-start gap-2 p-2.5 rounded-lg border border-border bg-muted/30">
                        <HeartHandshake className="h-3.5 w-3.5 text-emerald-600 mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium truncate">{l.nome || "Sem nome"}</span>
                            {(() => {
                              const emp = String(l.empreendimento || "").trim() || reengEmpreendimento[l.id];
                              return emp ? (
                                <Badge variant="outline" className="text-[10px] h-4 px-1.5">{emp}</Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px] h-4 px-1.5">—</Badge>
                              );
                            })()}
                            {l.origem && <Badge variant="outline" className="text-[10px] h-4 px-1.5">{l.origem}</Badge>}
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {l.reativado_em ? `Reativado em ${new Date(l.reativado_em).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}` : "Reativado pela Nutrição"}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </TabsContent>



            <TabsContent value="novos" className="mt-4">
              <div className="space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Prévia por empreendimento</p>
                {grupos.length === 0 && (
                  <div className="text-center py-6 text-sm text-muted-foreground">
                    Nenhum lead novo aguardando distribuição. 🎉
                  </div>
                )}
                {grupos.map((g) => {
                  const isUnident = g.key === UNIDENT_KEY;
                  return (
                    <div
                      key={g.key}
                      className={`rounded-lg border ${isUnident ? "border-amber-500/30 bg-amber-500/5" : "border-border bg-card"} border-l-[3px] ${isUnident ? "border-l-amber-500" : "border-l-primary"}`}
                    >
                      <div className="flex items-center justify-between px-3 py-2 border-b border-border/60">
                        <div className="flex items-center gap-2 min-w-0">
                          {isUnident ? (
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                          ) : (
                            <Building2 className="h-3.5 w-3.5 text-primary shrink-0" />
                          )}
                          <span className="text-sm font-semibold truncate">{g.nome}</span>
                        </div>
                        <Badge variant="secondary" className="font-bold shrink-0">
                          {g.leads.length} {g.leads.length === 1 ? "lead" : "leads"}
                        </Badge>
                      </div>
                      <div className="divide-y divide-border/40">
                        {g.leads.map((l) => (
                          <div key={l.id} className="flex items-center justify-between gap-2 px-3 py-2">
                            <div className="flex items-center gap-2 min-w-0 flex-wrap">
                              <span className="text-sm font-medium truncate">{l.nome || "Sem nome"}</span>
                              {l.origem && (
                                <Badge variant="outline" className="text-[10px] h-4 px-1.5 font-normal">
                                  {l.origem}
                                </Badge>
                              )}
                              {l.motivo_pendencia && (
                                <Badge variant="outline" className="text-[10px] h-4 px-1.5 gap-0.5 border-amber-500/40 text-amber-700 dark:text-amber-300">
                                  <PauseCircle className="h-2.5 w-2.5" /> Pausado
                                </Badge>
                              )}
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 gap-1.5 shrink-0"
                              onClick={() => setRepasseLead({ id: l.id, nome: l.nome || "Sem nome" })}
                            >
                              <UserPlus className="h-3 w-3" />
                              Repassar
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
                <p className="text-[10px] text-muted-foreground">
                  💡 Em domingo e feriado a roleta usa Dia Todo. De segunda a sábado, usa turnos normais.
                </p>
              </div>
            </TabsContent>

          </Tabs>

          <div className="space-y-5 mt-5 pt-5 border-t border-border">
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Disparar {activeTab === "reengajamento" ? "leads de Reengajamento" : "Novos leads"} para onde?
              </p>
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

            {activeTab === "novos" && unidentifiedCount > 0 && (
              <div className="flex items-center gap-2">
                <Checkbox id="include-unidentified" checked={includeUnidentified} onCheckedChange={(v) => setIncludeUnidentified(!!v)} />
                <label htmlFor="include-unidentified" className="text-xs text-muted-foreground cursor-pointer">
                  Incluir leads sem empreendimento identificado
                </label>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={dispatching}>
                Cancelar
              </Button>
              <Button onClick={handleDispatch} disabled={dispatching || leadsToDispatch.length === 0} className="gap-2">
                {dispatching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
                {isOfertaAtiva ? `Enviar ${leadsToDispatch.length} para Oferta Ativa` : `Disparar ${leadsToDispatch.length} leads`}
              </Button>
            </div>
          </div>
          </>
        )}
      </DialogContent>
      <FilaCeoRepassarDialog
        open={!!repasseLead}
        onOpenChange={(v) => { if (!v) setRepasseLead(null); }}
        leadId={repasseLead?.id ?? null}
        leadNome={repasseLead?.nome ?? ""}
        onDone={refetchLeads}
      />
    </Dialog>
  );

}
