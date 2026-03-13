import { useState, useMemo, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import type { PipelineLead, PipelineStage, PipelineSegmento } from "@/hooks/usePipeline";
import { usePipelineLeadData } from "@/hooks/usePipelineLeadData";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import {
  Phone, Mail, MessageSquare, Calendar, MapPin, Loader2,
  Clock, Building2, Target, DollarSign,
  Plus, CheckCircle2, AlertTriangle, ChevronRight,
  FileText, ChevronDown, ClipboardList,
  Flame, Snowflake, Sun, Zap, Brain, TrendingUp,
  Trash2, Ban, Handshake, MoreHorizontal, Bot, History, Tag
} from "lucide-react";
import PartnershipDialog from "./PartnershipDialog";
import LeadSequenceSuggestion from "./LeadSequenceSuggestion";
import HomiLeadAssistant from "./HomiLeadAssistant";
import CentralComunicacao from "@/components/comunicacao/CentralComunicacao";
import OpportunityVisitasTab from "./OpportunityVisitasTab";
import OpportunityPropostasTab from "./OpportunityPropostasTab";
import LeadTarefasTab from "./LeadTarefasTab";
import LeadHistoricoTab from "./LeadHistoricoTab";
import WhatsAppTemplatesDialog from "./WhatsAppTemplatesDialog";
import QuickActionMenu from "./QuickActionMenu";
import EmpreendimentoCombobox from "@/components/ui/empreendimento-combobox";
import RadarImoveisTab from "./RadarImoveisTab";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { differenceInDaysSafe, differenceInHoursSafe, formatDateSafe, formatDistanceToNowSafe, parseDateBRTSafe } from "@/lib/utils";

interface Props {
  lead: PipelineLead;
  stages: PipelineStage[];
  segmentos: PipelineSegmento[];
  corretorNomes?: Record<string, string>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: (leadId: string, updates: Partial<PipelineLead>) => Promise<void>;
  onMove: (leadId: string, newStageId: string, observacao?: string) => Promise<void>;
  onDelete?: (leadId: string) => Promise<void>;
}

const TEMPERATURA_MAP: Record<string, { label: string; color: string; icon: any }> = {
  quente: { label: "Quente", color: "text-red-500", icon: Flame },
  morno: { label: "Morno", color: "text-amber-500", icon: Sun },
  frio: { label: "Frio", color: "text-blue-500", icon: Snowflake },
};

export default function PipelineLeadDetail({ lead, stages, segmentos, corretorNomes = {}, open, onOpenChange, onUpdate, onMove, onDelete }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { isAdmin } = useUserRole();
  const leadData = usePipelineLeadData(open ? lead.id : null);
  const [activeTab, setActiveTab] = useState("historico");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [homiOpen, setHomiOpen] = useState(false);
  const [empreendimentoSearch, setEmpreendimentoSearch] = useState("");
  const [empreendimentoOpen, setEmpreendimentoOpen] = useState(false);
  const [savingEmpreendimento, setSavingEmpreendimento] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [editName, setEditName] = useState(lead.nome);

  const handleSaveName = async () => {
    const trimmed = editName.trim();
    if (!trimmed || trimmed === lead.nome) { setEditingName(false); return; }
    setSaving(true);
    try {
      await onUpdate(lead.id, { nome: trimmed } as any);
      toast.success("Nome atualizado!");
      setEditingName(false);
    } finally { setSaving(false); }
  };

  // Edit states
  const [editingCommercial, setEditingCommercial] = useState(false);
  const [commercialData, setCommercialData] = useState({
    objetivo_cliente: (lead as any).objetivo_cliente || "",
    bairro_regiao: (lead as any).bairro_regiao || "",
    forma_pagamento: (lead as any).forma_pagamento || "",
    imovel_troca: (lead as any).imovel_troca || false,
    nivel_interesse: (lead as any).nivel_interesse || "medio",
    temperatura: (lead as any).temperatura || "morno",
    valor_estimado: lead.valor_estimado || 0,
    empreendimento: lead.empreendimento || "",
  });

  const [moveObs, setMoveObs] = useState("");
  const [partnerOpen, setPartnerOpen] = useState(false);
  const [comunicacaoOpen, setComunicacaoOpen] = useState(false);
  const [whatsappTemplatesOpen, setWhatsappTemplatesOpen] = useState(false);
  const [showNovaTarefa, setShowNovaTarefa] = useState(false);
  const [inativarOpen, setInativarOpen] = useState(false);
  const [inativarMotivo, setInativarMotivo] = useState("");
  const [inativarObs, setInativarObs] = useState("");
  const [inativando, setInativando] = useState(false);

  const currentStage = stages.find(s => s.id === lead.stage_id);
  const segmento = segmentos.find(s => s.id === lead.segmento_id);
  const hoursInStage = differenceInHoursSafe(lead.stage_changed_at) ?? 0;
  const daysSinceCreation = differenceInDaysSafe(lead.created_at) ?? 0;
  const lastActivity = leadData.atividades[0];
  const pendingTasks = leadData.tarefas.filter(t => t.status === "pendente").length;
  const overdueTasks = leadData.tarefas.filter(t => {
    const dueDate = parseDateBRTSafe(t.vence_em);
    return t.status === "pendente" && !!dueDate && dueDate < new Date();
  }).length;

  const callAttempts = useMemo(() => {
    return leadData.atividades.filter(a => a.tipo === "ligacao").length;
  }, [leadData.atividades]);

  const temperatureInfo = TEMPERATURA_MAP[(lead as any).temperatura || "morno"] || TEMPERATURA_MAP.morno;
  const TempIcon = temperatureInfo.icon;

  const jetimobCode = useMemo(() => {
    const jid = (lead as any).jetimob_lead_id;
    if (!jid) return null;
    const match = jid.match(/(\d{4,6})/);
    return match ? `${match[1]}-UH` : jid;
  }, [(lead as any).jetimob_lead_id]);

  const nextTask = useMemo(() => {
    const pending = leadData.tarefas.filter(t => t.status === "pendente");
    pending.sort((a, b) => {
      const aTime = parseDateBRTSafe(a.vence_em)?.getTime() ?? Number.POSITIVE_INFINITY;
      const bTime = parseDateBRTSafe(b.vence_em)?.getTime() ?? Number.POSITIVE_INFINITY;
      return aTime - bTime;
    });
    return pending[0] || null;
  }, [leadData.tarefas]);

  const handleSaveCommercial = async () => {
    setSaving(true);
    try {
      await onUpdate(lead.id, commercialData as any);
      setEditingCommercial(false);
    } finally { setSaving(false); }
  };

  const handleMoveStage = async (stageId: string) => {
    await onMove(lead.id, stageId, moveObs || undefined);
    setMoveObs("");
  };

  const handleInativar = useCallback(async () => {
    if (!inativarMotivo) { toast.error("Selecione um motivo"); return; }
    setInativando(true);
    try {
      const descarteStage = stages.find(s => s.tipo === "descarte");
      const motivoTexto = inativarMotivo === "outro"
        ? `Inativado: ${inativarObs.trim() || "Outro motivo"}`
        : `Inativado: ${inativarMotivo}`;
      await onUpdate(lead.id, { motivo_descarte: motivoTexto } as any);
      if (descarteStage) await onMove(lead.id, descarteStage.id, motivoTexto);
      toast.success("Lead inativado com sucesso");
      setInativarOpen(false);
      onOpenChange(false);
    } catch (err: any) {
      toast.error("Erro ao inativar: " + (err.message || ""));
    } finally { setInativando(false); }
  }, [inativarMotivo, inativarObs, stages, lead.id, onUpdate, onMove, onOpenChange]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (e.target as HTMLElement)?.isContentEditable) return;
      switch (e.key.toLowerCase()) {
        case "l": if (lead.telefone) window.open(`tel:${lead.telefone}`, "_self"); break;
        case "w": if (lead.telefone) setWhatsappTemplatesOpen(true); break;
        case "t": setActiveTab("tarefas"); setShowNovaTarefa(true); break;
        case "s": setComunicacaoOpen(true); break;
        case "i": setActiveTab("radar"); break;
        default: return;
      }
      e.preventDefault();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, lead.telefone]);

  // Build simplified origin line
  const originLine = useMemo(() => {
    const parts: string[] = [];
    if (lead.empreendimento) parts.push(lead.empreendimento);
    if (lead.plataforma) parts.push(`(${lead.plataforma})`);
    return parts.join(" ");
  }, [lead.empreendimento, lead.plataforma]);

  // Has no contact alert
  const noContactAlert = useMemo(() => {
    if (nextTask) return null;
    const lastContact = (lead as any).ultima_acao_at;
    const hoursSince = differenceInHoursSafe(lastContact) ?? 999;
    if (leadData.atividades.length === 0 || hoursSince > 24) {
      return hoursSince > 48 ? "critical" : "warning";
    }
    return null;
  }, [nextTask, leadData.atividades, lead]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl p-0 flex flex-col overflow-hidden border-l border-border/50 max-h-[100dvh]">
        <ErrorBoundary fallback={
          <div className="flex flex-col items-center justify-center py-12 gap-3 px-6">
            <span className="text-destructive font-semibold">Erro ao carregar detalhes do lead</span>
            <span className="text-sm text-muted-foreground text-center">Ocorreu um erro inesperado. Feche e tente abrir novamente.</span>
            <button onClick={() => onOpenChange(false)} className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm">Fechar</button>
          </div>
        }>

        {/* ════════════ HEADER COMPACTO ════════════ */}
        <div className="shrink-0 border-b border-border/50 bg-card px-5 pt-4 pb-3 space-y-2.5">
          {/* Row 1: Name + Stage + Temp + Score + Days */}
          <div className="flex items-center gap-2 min-w-0">
            {editingName ? (
              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") handleSaveName(); if (e.key === "Escape") { setEditingName(false); setEditName(lead.nome); } }} className="h-8 text-lg font-bold flex-1" autoFocus disabled={saving} />
                <Button size="sm" variant="ghost" onClick={handleSaveName} disabled={saving} className="h-7 px-2 text-xs">{saving ? <Loader2 className="h-3 w-3 animate-spin" /> : "✓"}</Button>
                <Button size="sm" variant="ghost" onClick={() => { setEditingName(false); setEditName(lead.nome); }} className="h-7 px-2 text-xs">✕</Button>
              </div>
            ) : (
              <h2 className="text-lg font-bold text-foreground truncate cursor-pointer hover:text-primary transition-colors flex-1 min-w-0" onClick={() => { setEditName(lead.nome); setEditingName(true); }} title="Clique para editar">
                {lead.nome}
              </h2>
            )}

            <Popover>
              <PopoverTrigger asChild>
                <button className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold border cursor-pointer hover:opacity-80 transition-opacity shrink-0" style={{ backgroundColor: currentStage?.cor + "18", color: currentStage?.cor, borderColor: currentStage?.cor + "44" }}>
                  <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: currentStage?.cor }} />
                  {currentStage?.nome}
                  <ChevronDown className="h-2.5 w-2.5" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-2" align="end">
                <p className="text-[10px] font-semibold text-muted-foreground mb-1.5 px-1">Mover para:</p>
                <div className="space-y-0.5">
                  {stages.filter(s => s.id !== lead.stage_id).map(s => (
                    <button key={s.id} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs hover:bg-accent transition-colors text-left" onClick={() => handleMoveStage(s.id)}>
                      <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: s.cor }} />
                      {s.nome}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            <span className={`flex items-center gap-0.5 text-xs font-medium shrink-0 ${temperatureInfo.color}`}>
              <TempIcon className="h-3 w-3" />
              {temperatureInfo.label}
            </span>

            {lead.oportunidade_score != null && (() => {
              const s = lead.oportunidade_score!;
              const cls = s >= 81 ? "text-red-500 font-black" : s >= 61 ? "text-orange-500 font-bold" : s >= 31 ? "text-amber-500 font-semibold" : "text-blue-500 font-semibold";
              const emoji = s >= 81 ? "💎" : s >= 61 ? "⚡" : s >= 31 ? "🔥" : "🧊";
              return <span className={`text-xs shrink-0 ${cls}`}>{emoji} {s}</span>;
            })()}

            <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums">{daysSinceCreation}d</span>
          </div>

          {/* Row 2: Contact + Corretor + Origin — single line */}
          <div className="flex items-center gap-3 text-sm flex-wrap">
            {lead.telefone && (
              <a href={`tel:${lead.telefone}`} className="text-foreground hover:text-primary transition-colors flex items-center gap-1">
                <Phone className="h-3.5 w-3.5" /> <span className="text-sm">{lead.telefone}</span>
              </a>
            )}
            {lead.email && (
              <a href={`mailto:${lead.email}`} className="text-foreground hover:text-primary transition-colors flex items-center gap-1 truncate max-w-[180px]">
                <Mail className="h-3.5 w-3.5" /> <span className="text-sm truncate">{lead.email}</span>
              </a>
            )}
            {lead.corretor_id && corretorNomes[lead.corretor_id] && (
              <span className="flex items-center gap-1 text-xs text-primary font-medium">
                👤 {corretorNomes[lead.corretor_id]}
              </span>
            )}
          </div>

          {/* Row 3: Actions bar — all same size */}
          <div className="flex items-center gap-1 flex-wrap">
            {lead.telefone && (
              <a href={`tel:${lead.telefone}`} className="flex-1 min-w-0">
                <Button variant="outline" size="sm" className="w-full h-8 text-xs gap-1 rounded-lg">
                  <Phone className="h-3.5 w-3.5" /> Ligar
                </Button>
              </a>
            )}
            {lead.telefone && (
              <Button variant="outline" size="sm" className="flex-1 min-w-0 h-8 text-xs gap-1 rounded-lg border-green-200 text-green-600 hover:bg-green-50 dark:border-green-800 dark:hover:bg-green-950" onClick={() => setWhatsappTemplatesOpen(true)}>
                <MessageSquare className="h-3.5 w-3.5" /> WhatsApp
              </Button>
            )}
            {lead.email && (
              <a href={`mailto:${lead.email}`} className="flex-1 min-w-0">
                <Button variant="outline" size="sm" className="w-full h-8 text-xs gap-1 rounded-lg">
                  <Mail className="h-3.5 w-3.5" /> Email
                </Button>
              </a>
            )}
            <Button variant="outline" size="sm" className="flex-1 min-w-0 h-8 text-xs gap-1 rounded-lg" onClick={() => setComunicacaoOpen(true)}>
              <FileText className="h-3.5 w-3.5" /> Scripts
            </Button>
            <Button variant="outline" size="sm" className="flex-1 min-w-0 h-8 text-xs gap-1 rounded-lg" onClick={() => setActiveTab("radar")}>
              <Building2 className="h-3.5 w-3.5" /> Imóveis
            </Button>
            <Button variant="outline" size="sm" className="flex-1 min-w-0 h-8 text-xs gap-1 rounded-lg" onClick={() => { setActiveTab("tarefas"); setShowNovaTarefa(true); }}>
              <Plus className="h-3.5 w-3.5" /> Ação
            </Button>
            <QuickActionMenu leadId={lead.id} leadNome={lead.nome} onOpenDetail={() => setActiveTab("historico")} onRefresh={leadData.reload}>
              <Button variant="outline" size="sm" className="flex-1 min-w-0 h-8 text-xs gap-1 rounded-lg">
                <Zap className="h-3.5 w-3.5" /> Registrar
              </Button>
            </QuickActionMenu>

            {/* More menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-lg shrink-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => setPartnerOpen(true)}>
                  <Handshake className="h-3.5 w-3.5 mr-2" /> Parceria
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive" onClick={() => { setInativarMotivo(""); setInativarObs(""); setInativarOpen(true); }}>
                  <Ban className="h-3.5 w-3.5 mr-2" /> Inativar Lead
                </DropdownMenuItem>
                {isAdmin && onDelete && (
                  <DropdownMenuItem className="text-destructive" onClick={async () => { setDeleting(true); await onDelete(lead.id); setDeleting(false); onOpenChange(false); }}>
                    <Trash2 className="h-3.5 w-3.5 mr-2" /> Apagar (CEO)
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Row 4: Simplified origin — single line */}
          {(lead.empreendimento || lead.campanha || lead.formulario) && (
            <div className="text-[11px] text-muted-foreground space-y-0.5">
              {(lead.empreendimento || lead.plataforma) && (
                <p>
                  <span className="font-semibold text-foreground/80">Empreendimento:</span>{" "}
                  {originLine}
                  {callAttempts > 0 && (
                    <Badge variant={callAttempts >= 4 ? "destructive" : "secondary"} className="ml-2 text-[9px] h-4 px-1">
                      📞 {callAttempts}/4
                    </Badge>
                  )}
                  {jetimobCode && (
                    <span className="ml-2 text-muted-foreground/60">
                      <Tag className="h-2.5 w-2.5 inline" /> {jetimobCode}
                    </span>
                  )}
                </p>
              )}
              {lead.formulario && (
                <p>
                  <span className="font-semibold text-foreground/80">Formulário:</span>{" "}
                  {lead.formulario}
                </p>
              )}
            </div>
          )}
        </div>

        {/* ════════════ ALERTAS COMPACTOS + PRÓXIMA AÇÃO ════════════ */}
        <div className="shrink-0 border-b border-border/50 px-5 py-2 space-y-2">
          {/* Compact alert cards — side by side */}
          {(noContactAlert || overdueTasks > 0) && (
            <div className="grid grid-cols-2 gap-2">
              {/* Alert: No contact */}
              {noContactAlert && (
                <button
                  onClick={() => setActiveTab("historico")}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors ${
                    noContactAlert === "critical"
                      ? "bg-red-50 dark:bg-red-950/20 border border-red-200/60 dark:border-red-800/40 hover:bg-red-100 dark:hover:bg-red-950/30"
                      : "bg-amber-50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/40 hover:bg-amber-100 dark:hover:bg-amber-950/30"
                  }`}
                >
                  <span className="text-sm shrink-0">{noContactAlert === "critical" ? "🔴" : "🟡"}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-[10px] font-semibold ${noContactAlert === "critical" ? "text-red-700 dark:text-red-400" : "text-amber-700 dark:text-amber-400"}`}>
                      Sem contato
                    </p>
                    <p className={`text-[9px] ${noContactAlert === "critical" ? "text-red-600/70 dark:text-red-400/60" : "text-amber-600/70 dark:text-amber-400/60"}`}>
                      Registrar contato →
                    </p>
                  </div>
                </button>
              )}

              {/* Alert: Overdue tasks */}
              {overdueTasks > 0 && (
                <button
                  onClick={() => setActiveTab("tarefas")}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-left bg-red-50 dark:bg-red-950/20 border border-red-200/60 dark:border-red-800/40 hover:bg-red-100 dark:hover:bg-red-950/30 transition-colors"
                >
                  <span className="text-sm shrink-0">🔴</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-semibold text-red-700 dark:text-red-400">
                      {overdueTasks} tarefa{overdueTasks > 1 ? "s" : ""} atrasada{overdueTasks > 1 ? "s" : ""}
                    </p>
                    <p className="text-[9px] text-red-600/70 dark:text-red-400/60">
                      Resolver →
                    </p>
                  </div>
                </button>
              )}

              {/* If only one alert, fill second slot with next action mini */}
              {!noContactAlert && overdueTasks > 0 && !nextTask && (
                <button
                  onClick={() => { setActiveTab("tarefas"); setShowNovaTarefa(true); }}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-left bg-amber-50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/40 hover:bg-amber-100 dark:hover:bg-amber-950/30 transition-colors"
                >
                  <span className="text-sm shrink-0">⚠️</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-semibold text-amber-700 dark:text-amber-400">Sem próxima ação</p>
                    <p className="text-[9px] text-amber-600/70 dark:text-amber-400/60">Criar ação →</p>
                  </div>
                </button>
              )}
            </div>
          )}

          {/* Próxima Ação — compact */}
          {nextTask ? (
            <div className="flex items-center gap-2.5 rounded-lg bg-primary/5 border border-primary/15 px-3 py-2">
              <Target className="h-4 w-4 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold text-primary uppercase tracking-wider">Próxima Ação</p>
                <p className="text-xs font-semibold text-foreground truncate">
                  {nextTask.titulo || nextTask.descricao}
                  {nextTask.tipo && <span className="font-normal text-muted-foreground ml-1">· {nextTask.tipo.replace(/_/g, " ")}</span>}
                  {nextTask.vence_em && <span className="font-normal text-muted-foreground ml-1">· {formatDateSafe(nextTask.vence_em, "dd/MM", { locale: ptBR, dateOnly: true, fallback: "" })}</span>}
                  {(nextTask as any).hora_vencimento && <span className="font-normal text-muted-foreground"> {(nextTask as any).hora_vencimento.slice(0, 5)}</span>}
                </p>
              </div>
              <Button variant="default" size="sm" className="h-7 text-[10px] px-2.5 gap-1 shrink-0" onClick={() => leadData.toggleTarefa(nextTask.id, nextTask.status)}>
                <CheckCircle2 className="h-3 w-3" /> Concluir
              </Button>
            </div>
          ) : !noContactAlert && overdueTasks === 0 && (
            <button
              onClick={() => { setActiveTab("tarefas"); setShowNovaTarefa(true); }}
              className="flex items-center gap-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-700/30 px-3 py-2 w-full text-left hover:bg-amber-100 dark:hover:bg-amber-950/30 transition-colors"
            >
              <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Sem próxima ação</p>
                <p className="text-[10px] text-amber-600/70 dark:text-amber-400/60">Crie uma tarefa para manter o follow-up →</p>
              </div>
              <Plus className="h-3.5 w-3.5 text-amber-500 shrink-0" />
            </button>
          )}
        </div>

        {/* ════════════ ABAS ════════════ */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <div className="shrink-0 px-5 pt-2 pb-1 flex items-center gap-2">
            <TabsList className="bg-muted/50 h-8 flex-1">
              <TabsTrigger value="historico" className="text-xs h-6 data-[state=active]:shadow-sm gap-1">
                📝 Histórico
                {leadData.atividades.length > 0 && <Badge variant="secondary" className="h-3.5 text-[8px] px-1 ml-0.5">{leadData.atividades.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="tarefas" className="text-xs h-6 data-[state=active]:shadow-sm gap-1">
                📋 Tarefas
                {pendingTasks > 0 && <Badge variant="secondary" className="h-3.5 text-[8px] px-1 ml-0.5">{pendingTasks}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="radar" className="text-xs h-6 data-[state=active]:shadow-sm gap-1">
                📡 Radar
              </TabsTrigger>
            </TabsList>
            <Button
              size="sm"
              className="h-8 text-xs px-3 gap-1 bg-blue-600 hover:bg-blue-700 text-white rounded-md shrink-0"
              onClick={() => setHomiOpen(!homiOpen)}
            >
              <Bot className="h-3.5 w-3.5" /> HOMI
            </Button>
          </div>

          <ScrollArea className="flex-1 min-h-0" style={{ maxHeight: "calc(85vh - 240px)" }}>
            {/* ===== TAB: TAREFAS ===== */}
            <TabsContent value="tarefas" className="mt-0">
              <LeadTarefasTab
                leadId={lead.id}
                leadNome={lead.nome}
                leadTelefone={lead.telefone}
                leadEmail={lead.email}
                tarefas={leadData.tarefas}
                onAddTarefa={leadData.addTarefa}
                onToggleTarefa={leadData.toggleTarefa}
                onDeleteTarefa={leadData.deleteTarefa}
                onReload={leadData.reload}
              />
              {currentStage && (
                <Collapsible className="px-6 pb-6">
                  <CollapsibleTrigger className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors w-full group">
                    <ChevronRight className="h-3.5 w-3.5 transition-transform group-data-[state=open]:rotate-90" />
                    🤖 Sequências sugeridas
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-3">
                    <LeadSequenceSuggestion leadId={lead.id} leadNome={lead.nome} stageType={currentStage.tipo} empreendimento={lead.empreendimento} onTasksCreated={leadData.reload} />
                  </CollapsibleContent>
                </Collapsible>
              )}
            </TabsContent>

            {/* ===== TAB: HISTÓRICO ===== */}
            <TabsContent value="historico" className="mt-0">
              <LeadHistoricoTab
                leadId={lead.id}
                lead={lead}
                stages={stages}
                atividades={leadData.atividades}
                anotacoes={leadData.anotacoes}
                tarefas={leadData.tarefas}
                historico={leadData.historico}
                onAddAtividade={leadData.addAtividade}
                onAddAnotacao={leadData.addAnotacao}
                onToggleFixar={leadData.toggleFixarAnotacao}
                onAddTarefa={leadData.addTarefa}
                onReload={leadData.reload}
              />
            </TabsContent>

            {/* ===== TAB: VISITAS & PROPOSTAS ===== */}
            <TabsContent value="visitas-propostas" className="px-6 pb-8 space-y-6 mt-0">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <MapPin className="h-4 w-4" /> Visitas
                  </h4>
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => { onOpenChange(false); setTimeout(() => { navigate(`/agenda-visitas?lead=${lead.id}&nome=${encodeURIComponent(lead.nome)}&telefone=${encodeURIComponent(lead.telefone || "")}&empreendimento=${encodeURIComponent(lead.empreendimento || "")}`); }, 200); }}>
                    <Calendar className="h-3 w-3" /> + Agendar Visita
                  </Button>
                </div>
                <OpportunityVisitasTab pipelineLeadId={lead.id} />
              </div>
              <div className="border-t border-border/50 pt-5">
                <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <DollarSign className="h-4 w-4" /> Propostas
                </h4>
                <OpportunityPropostasTab pipelineLeadId={lead.id} valorEstimado={lead.valor_estimado} corretorNomes={corretorNomes} />
              </div>
            </TabsContent>

            {/* ===== TAB: INTELIGÊNCIA ===== */}
            <TabsContent value="inteligencia" className="px-6 pb-8 space-y-5 mt-0">
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
                <h4 className="text-xs font-bold text-primary flex items-center gap-1.5">
                  <Brain className="h-4 w-4" /> Inteligência do Lead
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <InsightItem icon={Clock} label="Sem contato" value={lastActivity ? formatDistanceToNowSafe(lastActivity.created_at, { locale: ptBR, fallback: "Nenhum" }) : "Nenhum"} alert={!lastActivity || (differenceInHoursSafe(lastActivity.created_at) ?? 999) > 48} />
                  <InsightItem icon={Phone} label="Tentativas" value={`${leadData.atividades.length}`} />
                  <InsightItem icon={Clock} label="Nesta etapa" value={hoursInStage < 24 ? `${hoursInStage}h` : `${Math.round(hoursInStage / 24)}d`} alert={hoursInStage > 72} />
                  <InsightItem icon={AlertTriangle} label="Atrasadas" value={overdueTasks > 0 ? `${overdueTasks}` : "0"} alert={overdueTasks > 0} />
                </div>
                {hoursInStage > 48 && !lastActivity && (
                  <p className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 rounded-lg flex items-center gap-1.5">
                    <Zap className="h-4 w-4" /> Faça contato imediato — lead sem interação.
                  </p>
                )}
              </div>
              {currentStage && (
                <LeadSequenceSuggestion leadId={lead.id} leadNome={lead.nome} stageType={currentStage.tipo} empreendimento={lead.empreendimento} onTasksCreated={leadData.reload} />
              )}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <TrendingUp className="h-4 w-4" /> Dados Comerciais
                  </h4>
                  <Button variant="ghost" size="sm" className="h-6 text-xs text-primary" onClick={() => setEditingCommercial(!editingCommercial)}>
                    {editingCommercial ? "Cancelar" : "Editar"}
                  </Button>
                </div>
                {editingCommercial ? (
                  <div className="space-y-3 border rounded-xl p-4 bg-card">
                    <div>
                      <Label className="text-xs text-muted-foreground">Empreendimento</Label>
                      <EmpreendimentoCombobox value={commercialData.empreendimento} onChange={v => setCommercialData(p => ({ ...p, empreendimento: v }))} placeholder="Selecione ou digite..." />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs text-muted-foreground">Temperatura</Label>
                        <Select value={commercialData.temperatura} onValueChange={v => setCommercialData(p => ({ ...p, temperatura: v }))}>
                          <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="quente">🔥 Quente</SelectItem>
                            <SelectItem value="morno">☀️ Morno</SelectItem>
                            <SelectItem value="frio">❄️ Frio</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Valor (R$)</Label>
                        <Input type="number" className="h-9 text-sm" value={commercialData.valor_estimado || ""} onChange={e => setCommercialData(p => ({ ...p, valor_estimado: Number(e.target.value) }))} />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox checked={commercialData.imovel_troca} onCheckedChange={v => setCommercialData(p => ({ ...p, imovel_troca: !!v }))} />
                      <Label className="text-xs">Imóvel na troca</Label>
                    </div>
                    <Button size="sm" className="w-full h-9 text-sm" onClick={handleSaveCommercial} disabled={saving}>
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-6 flex-wrap text-sm py-2">
                    <div className="relative">
                      <span className="text-xs text-muted-foreground">Empreendimento</span>
                      <Popover open={empreendimentoOpen} onOpenChange={(o) => { setEmpreendimentoOpen(o); if (o) setEmpreendimentoSearch(lead.empreendimento || ""); }}>
                        <PopoverTrigger asChild>
                          {lead.empreendimento ? (
                            <button className="flex items-center gap-1.5 font-medium text-foreground hover:text-primary transition-colors group">
                              {lead.empreendimento}
                              <span className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity text-xs">✏️</span>
                            </button>
                          ) : (
                            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-semibold hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors border border-amber-300 dark:border-amber-700">
                              🏠 Selecionar Empreendimento ▼
                            </button>
                          )}
                        </PopoverTrigger>
                        <PopoverContent className="w-72 p-3 space-y-2" align="start">
                          <EmpreendimentoCombobox value={empreendimentoSearch} onChange={(v) => setEmpreendimentoSearch(v)} onSelect={async (v) => { setSavingEmpreendimento(true); await onUpdate(lead.id, { empreendimento: v } as any); setEmpreendimentoOpen(false); setEmpreendimentoSearch(""); setSavingEmpreendimento(false); toast.success("Empreendimento atualizado ✅"); }} placeholder="Buscar ou digitar..." />
                          <Button size="sm" className="w-full h-8 text-xs font-semibold" disabled={!empreendimentoSearch.trim() || savingEmpreendimento} onClick={async () => { setSavingEmpreendimento(true); await onUpdate(lead.id, { empreendimento: empreendimentoSearch.trim() } as any); setEmpreendimentoOpen(false); setEmpreendimentoSearch(""); setSavingEmpreendimento(false); toast.success("Empreendimento atualizado ✅"); }}>
                            {savingEmpreendimento ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Salvar"}
                          </Button>
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="h-8 w-px bg-border" />
                    <div>
                      <span className="text-xs text-muted-foreground">Valor</span>
                      <p className="font-medium text-foreground">{lead.valor_estimado ? `R$ ${lead.valor_estimado.toLocaleString("pt-BR")}` : <span className="text-muted-foreground/60">—</span>}</p>
                    </div>
                    <div className="h-8 w-px bg-border" />
                    <div>
                      <span className="text-xs text-muted-foreground">Origem</span>
                      <p className="font-medium text-foreground">{lead.origem || <span className="text-muted-foreground/60">—</span>}</p>
                    </div>
                  </div>
                )}
              </div>
              {lead.observacoes && (
                <p className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">{lead.observacoes}</p>
              )}
            </TabsContent>

            {/* ===== TAB: RADAR IMÓVEIS ===== */}
            <TabsContent value="radar" className="mt-0">
              <RadarImoveisTab
                leadId={lead.id}
                leadNome={lead.nome}
                leadTelefone={lead.telefone}
                leadData={{
                  empreendimento: lead.empreendimento,
                  campanha: lead.campanha,
                  campanha_id: lead.campanha_id,
                  valor_estimado: lead.valor_estimado,
                  origem: lead.origem,
                  observacoes: lead.observacoes,
                  segmento_id: lead.segmento_id,
                  temperatura: lead.temperatura,
                }}
                currentProfile={{
                  radar_quartos: (lead as any).radar_quartos,
                  radar_valor_max: (lead as any).radar_valor_max,
                  radar_tipologia: (lead as any).radar_tipologia,
                  radar_bairros: (lead as any).radar_bairros,
                  radar_status_imovel: (lead as any).radar_status_imovel,
                }}
                onUpdate={onUpdate}
              />
            </TabsContent>
          </ScrollArea>
        </Tabs>

        {/* ════════════ HOMI SIDE PANEL ════════════ */}
        {homiOpen && (
          <div className="absolute inset-y-0 right-0 w-full sm:w-[45%] z-40 bg-card border-l border-border shadow-xl flex flex-col">
            <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-primary/5">
              <span className="text-xs font-bold text-primary flex items-center gap-1.5">
                <Bot className="h-3.5 w-3.5" /> HOMI Assistente
              </span>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setHomiOpen(false)}>✕</Button>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-3">
                <HomiLeadAssistant
                  leadId={lead.id}
                  leadNome={lead.nome}
                  leadTelefone={lead.telefone}
                  leadEmail={lead.email}
                  empreendimento={lead.empreendimento}
                  etapa={currentStage?.nome || ""}
                  temperatura={(lead as any).temperatura}
                  observacoes={lead.observacoes}
                  origem={lead.origem}
                  origemDetalhe={lead.origem_detalhe}
                  createdAt={lead.created_at}
                  updatedAt={lead.updated_at}
                  proximaAcao={lead.proxima_acao}
                  valorEstimado={lead.valor_estimado}
                  oportunidadeScore={lead.oportunidade_score}
                />
              </div>
            </ScrollArea>
          </div>
        )}
        </ErrorBoundary>
      </SheetContent>

      <PartnershipDialog open={partnerOpen} onOpenChange={setPartnerOpen} leadId={lead.id} leadNome={lead.nome} corretorPrincipalId={lead.corretor_id} />
      <CentralComunicacao open={comunicacaoOpen} onOpenChange={setComunicacaoOpen} leadId={lead.id} leadNome={lead.nome} leadTelefone={lead.telefone} leadEmpreendimento={lead.empreendimento} />

      {/* Dialog Inativar Lead */}
      <Dialog open={inativarOpen} onOpenChange={setInativarOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ban className="h-5 w-5 text-destructive" /> Inativar Lead
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Selecione o motivo para inativar <strong>{lead.nome}</strong>. O lead será movido para descarte.
            </p>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Motivo *</Label>
              <Select value={inativarMotivo} onValueChange={setInativarMotivo}>
                <SelectTrigger><SelectValue placeholder="Selecione o motivo..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Contato errado">📵 Contato errado</SelectItem>
                  <SelectItem value="Não quer mais contato">🚫 Não quer mais contato</SelectItem>
                  <SelectItem value="Solicitou retirada do nome">🗑️ Solicitou retirada do nome</SelectItem>
                  <SelectItem value="outro">✏️ Outro motivo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {inativarMotivo === "outro" && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Descreva o motivo</Label>
                <Textarea value={inativarObs} onChange={e => setInativarObs(e.target.value)} placeholder="Descreva..." className="resize-none" rows={3} />
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setInativarOpen(false)} disabled={inativando}>Cancelar</Button>
            <Button variant="destructive" onClick={handleInativar} disabled={inativando || !inativarMotivo || (inativarMotivo === "outro" && !inativarObs.trim())} className="gap-2">
              {inativando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sheet>
  );
}

function InsightItem({ icon: Icon, label, value, alert }: { icon: any; label: string; value: string; alert?: boolean }) {
  return (
    <div className={`flex items-center gap-3 p-2.5 rounded-lg ${alert ? "bg-amber-100/50 dark:bg-amber-950/30" : "bg-muted/30"}`}>
      <Icon className={`h-5 w-5 shrink-0 ${alert ? "text-amber-500" : "text-primary/60"}`} />
      <div>
        <span className="text-xs text-muted-foreground">{label}</span>
        <p className={`text-lg font-bold ${alert ? "text-amber-600" : "text-foreground"}`}>{value}</p>
      </div>
    </div>
  );
}
