import { useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronDown, ChevronUp, Brain, AlertTriangle, Rocket, Eye, MessageSquare, Users, Archive, ArrowRightLeft, Send, HelpCircle } from "lucide-react";
import { toast } from "sonner";
import type { PipelineLead, PipelineStage } from "@/hooks/usePipeline";
import { differenceInDays, differenceInHours } from "date-fns";
import { SCORE_TEMPERATURE_LEVELS } from "@/lib/scoreTemperatureLabels";

interface Props {
  leads: PipelineLead[];
  stages: PipelineStage[];
  corretorNomes: Record<string, string>;
  onFilterLeads: (filter: (l: PipelineLead) => boolean, label: string) => void;
  onDispatch: () => void;
  onReload: () => void;
}

function AlertRow({ icon, color, count, label, actionLabel, actionIcon: ActionIcon, onAction }: {
  icon: string; color: string; count: number; label: string;
  actionLabel: string; actionIcon: any; onAction: () => void;
}) {
  if (count === 0) return null;
  const colorMap: Record<string, string> = {
    red: "bg-destructive/5 border-destructive/20 text-destructive",
    yellow: "bg-warning/5 border-warning/20 text-warning",
    green: "bg-success/5 border-success/20 text-success",
  };
  return (
    <div className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-xs ${colorMap[color]}`}>
      <span className="flex items-center gap-1.5 min-w-0">
        <span>{icon}</span>
        <strong>{count}</strong> {label}
      </span>
      <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1 shrink-0" onClick={onAction}>
        <ActionIcon className="h-3 w-3" /> {actionLabel}
      </Button>
    </div>
  );
}

export default function PipelineCeoIntelligence({ leads, stages, corretorNomes, onFilterLeads, onDispatch, onReload }: Props) {
  const { user } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkAction, setBulkAction] = useState("");
  const [bulkCorretor, setBulkCorretor] = useState("");
  const [bulkStage, setBulkStage] = useState("");
  const [sending, setSending] = useState(false);

  const stageMap = useMemo(() => new Map(stages.map(s => [s.id, s])), [stages]);

  const alerts = useMemo(() => {
    const now = new Date();
    const semContato7d = leads.filter(l => {
      const last = (l as any).ultimo_contato || l.updated_at || l.created_at;
      return last && differenceInDays(now, new Date(last)) > 7 && l.corretor_id;
    });
    const filaCeo24h = leads.filter(l => !l.corretor_id && differenceInHours(now, new Date(l.created_at)) > 24);
    const qualificacao5d = leads.filter(l => {
      const s = stageMap.get(l.stage_id);
      return s?.tipo === "qualificacao" && differenceInDays(now, new Date(l.updated_at || l.created_at)) > 5;
    });
    const visitaNaoAtualizada = leads.filter(l => {
      const s = stageMap.get(l.stage_id);
      return s?.tipo === "visita_marcada" && differenceInDays(now, new Date(l.updated_at || l.created_at)) > 2;
    });
    const propostas = leads.filter(l => {
      const s = stageMap.get(l.stage_id);
      return s?.tipo === "proposta" || s?.tipo === "negociacao";
    });
    return { semContato7d, filaCeo24h, qualificacao5d, visitaNaoAtualizada, propostas };
  }, [leads, stageMap]);

  const cobrarCorretores = useCallback(async (leadsAfetados: PipelineLead[], tipo: string) => {
    if (!user) return;
    setSending(true);
    try {
      const { data: { session } } = await (supabase.auth as any).getSession();
      if (!session?.access_token) { toast.error("Sessão expirada"); return; }

      // Group by corretor
      const byCorretor = new Map<string, PipelineLead[]>();
      for (const l of leadsAfetados) {
        if (!l.corretor_id) continue;
        const arr = byCorretor.get(l.corretor_id) || [];
        arr.push(l);
        byCorretor.set(l.corretor_id, arr);
      }

      // Get phone numbers
      const corretorIds = [...byCorretor.keys()];
      const { data: profiles } = await supabase.from("profiles").select("user_id, nome, telefone").in("user_id", corretorIds);
      const profileMap = new Map((profiles as any[] || []).map((p: any) => [p.user_id, p]));

      let enviados = 0;
      const destinatarios: any[] = [];

      for (const [cid, cLeads] of byCorretor) {
        const prof = profileMap.get(cid);
        if (!prof?.telefone) continue;

        const nomes = cLeads.slice(0, 5).map(l => l.nome).join(", ");
        const mensagem = `⚠️ *Atenção, ${prof.nome?.split(" ")[0]}!*\n\nVocê tem *${cLeads.length}* lead(s) sem atualização há mais de 7 dias:\n${nomes}${cLeads.length > 5 ? `\n... e mais ${cLeads.length - 5}` : ""}\n\nPor favor, atualize no sistema. 🙏`;

        await supabase.functions.invoke("whatsapp-notificacao", {
          body: { telefone: prof.telefone, tipo: "cobranca", dados: { mensagem_personalizada: mensagem } },
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        destinatarios.push({ corretor_id: cid, nome: prof.nome, telefone: prof.telefone });
        enviados++;
        if (enviados < byCorretor.size) await new Promise(r => setTimeout(r, 1000));
      }

      // Log
      await supabase.from("cobrancas_enviadas").insert({
        enviado_por: user.id,
        tipo,
        destinatarios,
        mensagem: `Cobrança ${tipo} para ${enviados} corretores`,
        leads_afetados: leadsAfetados.map(l => ({ id: l.id, nome: l.nome })),
      });

      toast.success(`✅ Mensagem enviada para ${enviados} corretores`);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao enviar cobranças");
    } finally {
      setSending(false);
    }
  }, [user]);

  const handleBulkAction = useCallback(async () => {
    // Bulk actions placeholder - would need selected leads
    toast.info("Selecione leads no Kanban para aplicar ação em massa");
    setBulkOpen(false);
  }, []);

  const allCorretores = useMemo(() =>
    Object.entries(corretorNomes).map(([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome)),
    [corretorNomes]
  );

  return (
    <>
      {/* Action buttons row */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          size="sm"
          onClick={onDispatch}
          className="gap-1.5 h-7 text-[11px] bg-purple-600 hover:bg-purple-700 text-white"
        >
          <Rocket className="h-3 w-3" /> Disparar Fila CEO
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setBulkOpen(true)}
          className="gap-1.5 h-7 text-[11px]"
        >
          <Send className="h-3 w-3" /> Ação em Massa
        </Button>

        {/* Collapsible intelligence toggle */}
        <button
          onClick={() => setExpanded(e => !e)}
          className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors ml-auto"
        >
          <Brain className="h-3.5 w-3.5 text-primary" />
          <span className="font-medium">🧠 Inteligência de Leads</span>
          {(alerts.semContato7d.length + alerts.filaCeo24h.length + alerts.qualificacao5d.length) > 0 && (
            <Badge variant="destructive" className="text-[9px] h-4 px-1">{alerts.semContato7d.length + alerts.filaCeo24h.length + alerts.qualificacao5d.length}</Badge>
          )}
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); setHelpOpen(true); }}
          className="text-muted-foreground hover:text-foreground transition-colors"
          title="Como funciona o sistema de pontuação"
        >
          <HelpCircle className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Intelligence panel */}
      {expanded && (
        <div className="rounded-xl border border-border bg-card p-3 space-y-1.5 animate-in slide-in-from-top-2 duration-200">
          <AlertRow
            icon="🔴" color="red" count={alerts.semContato7d.length}
            label="leads há mais de 7 dias sem contato"
            actionLabel={sending ? "Enviando..." : "Cobrar corretores"}
            actionIcon={MessageSquare}
            onAction={() => cobrarCorretores(alerts.semContato7d, "sem_contato_7d")}
          />
          <AlertRow
            icon="🔴" color="red" count={alerts.filaCeo24h.length}
            label="leads na Fila CEO há mais de 24h"
            actionLabel="Distribuir agora"
            actionIcon={Rocket}
            onAction={onDispatch}
          />
          <AlertRow
            icon="🟡" color="yellow" count={alerts.qualificacao5d.length}
            label="leads em Qualificação há mais de 5 dias"
            actionLabel="Ver leads"
            actionIcon={Eye}
            onAction={() => {
              onFilterLeads(l => {
                const s = stageMap.get(l.stage_id);
                return s?.tipo === "qualificacao" && differenceInDays(new Date(), new Date(l.updated_at || l.created_at)) > 5;
              }, "Qualificação >5d");
            }}
          />
          <AlertRow
            icon="🟡" color="yellow" count={alerts.visitaNaoAtualizada.length}
            label="leads com visita marcada mas não atualizada"
            actionLabel={sending ? "Enviando..." : "Cobrar atualização"}
            actionIcon={MessageSquare}
            onAction={() => cobrarCorretores(alerts.visitaNaoAtualizada, "visita_nao_atualizada")}
          />
          <AlertRow
            icon="🟢" color="green" count={alerts.propostas.length}
            label="leads em Proposta — possível fechamento"
            actionLabel="Ver oportunidades"
            actionIcon={Eye}
            onAction={() => {
              onFilterLeads(l => {
                const s = stageMap.get(l.stage_id);
                return s?.tipo === "proposta" || s?.tipo === "negociacao";
              }, "Propostas");
            }}
          />
        </div>
      )}

      {/* Bulk actions sheet */}
      <Sheet open={bulkOpen} onOpenChange={setBulkOpen}>
        <SheetContent className="w-[340px] sm:w-[400px]">
          <SheetHeader>
            <SheetTitle className="text-sm">📤 Ação em Massa</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 mt-4">
            <p className="text-xs text-muted-foreground">Selecione a ação para aplicar aos leads filtrados.</p>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium mb-1 block">Ação</label>
                <Select value={bulkAction} onValueChange={setBulkAction}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="atribuir">Atribuir corretor</SelectItem>
                    <SelectItem value="mover">Mover para etapa</SelectItem>
                    <SelectItem value="whatsapp">Enviar WhatsApp em massa</SelectItem>
                    <SelectItem value="roleta">Adicionar à roleta</SelectItem>
                    <SelectItem value="arquivar">Arquivar inativos (&gt;30d)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {bulkAction === "atribuir" && (
                <div>
                  <label className="text-xs font-medium mb-1 block">Corretor</label>
                  <Select value={bulkCorretor} onValueChange={setBulkCorretor}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {allCorretores.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {bulkAction === "mover" && (
                <div>
                  <label className="text-xs font-medium mb-1 block">Etapa</label>
                  <Select value={bulkStage} onValueChange={setBulkStage}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {stages.filter(s => !["venda", "descarte", "caiu"].includes(s.tipo)).map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <Button onClick={handleBulkAction} className="w-full h-8 text-xs" disabled={!bulkAction}>
              Aplicar ação
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Score Legend Modal */}
      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" /> Sistema de Pontuação de Leads
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Cada lead recebe um score de oportunidade (0–100) calculado automaticamente com base em múltiplos fatores.
            </p>

            <div className="space-y-2">
              <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Faixas de temperatura</p>
              {SCORE_TEMPERATURE_LEVELS.map(level => (
                <div key={level.key} className="flex items-start gap-3 p-2.5 rounded-lg border border-border bg-muted/30">
                  <span className="text-lg shrink-0">{level.emoji}</span>
                  <div className="min-w-0">
                    <p className={`text-sm font-semibold ${level.color}`}>
                      {level.label} <span className="text-muted-foreground font-normal">({level.range})</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">{level.description}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Fatores que aumentam o score</p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li className="flex items-center gap-1.5">• Avanço de etapa no funil (+5 a +40)</li>
                <li className="flex items-center gap-1.5">• Valor estimado (VGV) alto (+3 a +15)</li>
                <li className="flex items-center gap-1.5">• Temperatura quente / morno (+5 a +10)</li>
                <li className="flex items-center gap-1.5">• Movimentação recente (+5 a +10)</li>
                <li className="flex items-center gap-1.5">• Próxima ação definida (+5)</li>
                <li className="flex items-center gap-1.5">• Gerente envolvido (+5)</li>
              </ul>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
