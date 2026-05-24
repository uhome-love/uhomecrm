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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import type { PipelineLead, PipelineStage, PipelineSegmento } from "@/hooks/usePipeline";
import { usePipelineLeadData } from "@/hooks/usePipelineLeadData";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useIsMobile } from "@/hooks/use-mobile";

import {
  Phone, Mail, Calendar, MapPin, Loader2,
  Clock, Building2, Target, DollarSign,
  Plus, CheckCircle2, AlertTriangle, ChevronRight,
  FileText, ChevronDown, ClipboardList,
  Flame, Snowflake, Sun, Brain, TrendingUp,
  Trash2, Ban, Handshake, MoreHorizontal, Bot, History, Tag, Search, Pencil
} from "lucide-react";
import DrawerLeadInfo from "./drawer/DrawerLeadInfo";
import DrawerLeadHeader from "./drawer/DrawerLeadHeader";
import DrawerTimeline from "./drawer/DrawerTimeline";
import DrawerActionGrid from "./drawer/DrawerActionGrid";
import DrawerEmpreendimento from "./drawer/DrawerEmpreendimento";
import DrawerAnotarDialog from "./drawer/DrawerAnotarDialog";
import DrawerProximaAcao, { parseNextActionType } from "./drawer/DrawerProximaAcao";
import PartnershipDialog from "./PartnershipDialog";
import LeadSequenceSuggestion from "./LeadSequenceSuggestion";
import HomiLeadAssistant from "./HomiLeadAssistant";
import CentralComunicacao from "@/components/comunicacao/CentralComunicacao";
import OpportunityVisitasTab from "./OpportunityVisitasTab";
import OpportunityPropostasTab from "./OpportunityPropostasTab";
import LeadTarefasTab from "./LeadTarefasTab";
import LeadHistoricoTab from "./LeadHistoricoTab";
import DrawerTasksTab from "./drawer/DrawerTasksTab";
import DrawerVisitsTab from "./drawer/DrawerVisitsTab";
import WhatsAppTemplatesDialog from "./WhatsAppTemplatesDialog";

import NextActionModal from "./NextActionModal";
import CardScheduleVisitDialog from "./CardScheduleVisitDialog";
import CardOverflowMenu from "./CardOverflowMenu";
import EmpreendimentoCombobox from "@/components/ui/empreendimento-combobox";
import LeadImoveisIndicadosTab from "./LeadImoveisIndicadosTab";
import StageCoachBar from "./StageCoachBar";
import LeadFlagControls from "./LeadFlagControls";
import { CallFocusOverlay } from "./CallFocusOverlay";
import WhatsAppFocusFlow from "./WhatsAppFocusFlow";
// RadarImoveisTab e LeadWhatsAppTab removidos (Pipeline v2 Fase 4)
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { differenceInDaysSafe, differenceInHoursSafe, formatDateSafe, formatDistanceToNowSafe, parseDateBRTSafe } from "@/lib/utils";
import { getScoreTemperature } from "@/lib/scoreTemperatureLabels";
import { trackPipelineEvent } from "@/lib/pipelineTelemetry";

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

// TEMPERATURA_MAP removido — substituído por chip de status Atualizado/Desatualizado

export default function PipelineLeadDetail({ lead, stages, segmentos, corretorNomes = {}, open, onOpenChange, onUpdate, onMove, onDelete }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { isAdmin } = useUserRole();
  const leadData = usePipelineLeadData(open ? lead.id : null);
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState<string>(() => (isMobile ? "info" : "historico"));
  useEffect(() => {
    setActiveTab(isMobile ? "info" : "historico");
  }, [lead.id, isMobile]);

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [homiOpen, setHomiOpen] = useState(false);
  const [homiInitialPrompt, setHomiInitialPrompt] = useState<string | undefined>();
  const [empreendimentoSearch, setEmpreendimentoSearch] = useState("");
  const [empreendimentoOpen, setEmpreendimentoOpen] = useState(false);
  const [savingEmpreendimento, setSavingEmpreendimento] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [editName, setEditName] = useState(lead.nome);
  const [editingPhone, setEditingPhone] = useState(false);
  const [editPhone, setEditPhone] = useState(lead.telefone || "");

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

  const handleSavePhone = async () => {
    const trimmed = editPhone.trim();
    if (trimmed === (lead.telefone || "")) { setEditingPhone(false); return; }
    setSaving(true);
    try {
      await onUpdate(lead.id, { telefone: trimmed || null } as any);
      toast.success("Telefone atualizado!");
      setEditingPhone(false);
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
  const [isWhatsAppFlowOpen, setIsWhatsAppFlowOpen] = useState(false);
  const [showNovaTarefa, setShowNovaTarefa] = useState(false);
  const [inativarOpen, setInativarOpen] = useState(false);
  const [inativarMotivo, setInativarMotivo] = useState("");
  const [inativarObs, setInativarObs] = useState("");
  const [tipoDescarte, setTipoDescarte] = useState<string>("reengajavel");
  const [inativando, setInativando] = useState(false);
  const [nextActionOpen, setNextActionOpen] = useState(false);
  const [scheduleVisitOpen, setScheduleVisitOpen] = useState(false);
  const [isCallOpen, setIsCallOpen] = useState(false);
  const [anotarOpen, setAnotarOpen] = useState(false);

  const currentStage = stages.find(s => s.id === lead.stage_id);
  const segmento = segmentos.find(s => s.id === lead.segmento_id);
  const hoursInStage = differenceInHoursSafe(lead.stage_changed_at) ?? 0;
  const lastActivity = leadData.atividades[0];
  const pendingTasks = leadData.tarefas.filter(t => t.status === "pendente").length;
  const overdueTasks = leadData.tarefas.filter(t => {
    const dueDate = parseDateBRTSafe(t.vence_em);
    return t.status === "pendente" && !!dueDate && dueDate < new Date();
  }).length;

  const contactTypes = ["ligacao", "whatsapp", "email", "contato"];
  const contactActivities = useMemo(() => {
    return leadData.atividades.filter(a => contactTypes.some(t => a.tipo?.includes(t)));
  }, [leadData.atividades]);

  const callAttempts = contactActivities.length;

  const daysSinceLastAction = useMemo(() => {
    // Use ultima_acao_at first (most accurate), then latest activity, then created_at
    const ultimaAcao = (lead as any).ultima_acao_at;
    if (ultimaAcao) return differenceInDaysSafe(ultimaAcao) ?? 0;
    if (contactActivities.length > 0) {
      return differenceInDaysSafe(contactActivities[0].created_at) ?? 0;
    }
    return differenceInDaysSafe(lead.created_at) ?? 0;
  }, [contactActivities, lead.created_at, (lead as any).ultima_acao_at]);

  // daysSinceCreation kept for display — but SLA uses daysSinceLastAction
  const daysSinceCreation = daysSinceLastAction;

  // temperatureInfo removido — chip de status usado no lugar

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
    if (!tipoDescarte) { toast.error("Selecione o tipo de descarte"); return; }
    setInativando(true);
    try {
      const { buildMotivoDescarte } = await import("@/lib/leadOutcome");
      const labelRaw = inativarMotivo === "outro"
        ? (inativarObs.trim() || "Outro motivo")
        : inativarMotivo;
      const motivoTexto = buildMotivoDescarte(
        tipoDescarte === "definitivo" ? "definitivo" : "reengajavel",
        labelRaw,
      );

      if (tipoDescarte === "definitivo") {
        // Definitivo: arquiva o lead (some da carteira). Update direto, sem depender de onUpdate.
        const nowIso = new Date().toISOString();
        const { error } = await supabase
          .from("pipeline_leads")
          .update({
            motivo_descarte: motivoTexto,
            tipo_descarte: "definitivo",
            arquivado: true,
            ultima_acao_at: nowIso,
          })
          .eq("id", lead.id);
        if (error) throw error;
        toast.success("Lead inativado definitivamente (arquivado)");
      } else {
        // Reengajável: move para etapa Descarte de forma ATÔMICA (um único UPDATE).
        // Não depende de onMove/onUpdate em sequência — evita estados inconsistentes
        // (lead com motivo gravado mas ainda na etapa antiga).
        const descarteStage = stages.find(s => s.tipo === "descarte")
          || stages.find(s => s.nome.toLowerCase().includes("descart"));
        if (!descarteStage) {
          toast.error("Etapa de Descarte não encontrada. Contate o suporte.");
          return;
        }
        const nowIso = new Date().toISOString();
        const { error } = await supabase
          .from("pipeline_leads")
          .update({
            stage_id: descarteStage.id,
            stage_changed_at: nowIso,
            ultima_acao_at: nowIso,
            motivo_descarte: motivoTexto,
            tipo_descarte: "reengajavel",
          })
          .eq("id", lead.id);
        if (error) throw error;

        // Histórico (best-effort, não bloqueia)
        try {
          await supabase.from("pipeline_historico").insert({
            pipeline_lead_id: lead.id,
            stage_anterior_id: lead.stage_id,
            stage_novo_id: descarteStage.id,
            movido_por: user?.id ?? null,
            observacao: motivoTexto,
          } as any);
        } catch {}
        toast.success("Lead movido para descarte (reengajável)");
      }

      setInativarOpen(false);
      onOpenChange(false);
      // Refresh para o board recarregar e o card sumir/reposicionar
      try { await onUpdate(lead.id, {} as any); } catch {}
    } catch (err: any) {
      toast.error("Erro ao inativar: " + (err.message || ""));
    } finally { setInativando(false); }
  }, [inativarMotivo, inativarObs, tipoDescarte, stages, lead.id, lead.stage_id, onUpdate, onOpenChange, user?.id]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (e.target as HTMLElement)?.isContentEditable) return;
      switch (e.key.toLowerCase()) {
        case "l": if (lead.telefone) window.open(`tel:${lead.telefone}`, "_self"); break;
        case "w": if (lead.telefone) setIsWhatsAppFlowOpen(true); break;
        case "t": setActiveTab("tarefas"); setShowNovaTarefa(true); break;
        case "s": setComunicacaoOpen(true); break;
        case "i": setActiveTab("historico"); break;
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
    // Check most recent activity date too
    const lastActivityDate = leadData.atividades.length > 0 ? leadData.atividades[0]?.created_at : null;
    const lastContact = (lead as any).ultima_acao_at || lastActivityDate;
    const hoursSince = differenceInHoursSafe(lastContact) ?? 999;
    if (leadData.atividades.length === 0 || hoursSince > 48) {
      return hoursSince > 96 ? "critical" : "warning";
    }
    return null;
  }, [nextTask, leadData.atividades, lead]);

  // ─────────────────────────────────────────────────────────────────
  // Conteúdo da coluna esquerda — single source (DRY).
  // Reusado em desktop (DrawerLeadInfo aside) e mobile (tab "Info").
  // ─────────────────────────────────────────────────────────────────
  const headerNode = (
    <DrawerLeadHeader
      nome={lead.nome}
      telefone={lead.telefone}
      email={lead.email}
      canEdit={isAdmin}
      editingName={editingName}
      editName={editName}
      setEditName={setEditName}
      startEditName={() => { setEditName(lead.nome); setEditingName(true); }}
      cancelEditName={() => { setEditingName(false); setEditName(lead.nome); }}
      saveName={handleSaveName}
      editingPhone={editingPhone}
      editPhone={editPhone}
      setEditPhone={setEditPhone}
      startEditPhone={() => { setEditPhone(lead.telefone || ""); setEditingPhone(true); }}
      cancelEditPhone={() => { setEditingPhone(false); setEditPhone(lead.telefone || ""); }}
      savePhone={handleSavePhone}
      saving={saving}
      pills={
        <>
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

          {(() => {
            const diasSemContato = noContactAlert
              ? Math.floor((differenceInHoursSafe((lead as any).ultima_acao_at || lead.created_at) ?? 0) / 24)
              : 0;
            const chipColor = nextTask
              ? { bg: '#EAF3DE', color: '#27500A', dot: '#639922', text: 'Em dia' }
              : noContactAlert === 'critical'
                ? { bg: '#FCEBEB', color: '#A32D2D', dot: '#E24B4A', text: 'Desatualizado' }
                : { bg: '#FAEEDA', color: '#854F0B', dot: '#EF9F27', text: 'Atenção' };
            const motivosDesat: string[] = [];
            if (!nextTask) motivosDesat.push('sem tarefa futura');
            if (noContactAlert) motivosDesat.push(`${diasSemContato}d sem contato`);
            return (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 cursor-default" style={{ background: chipColor.bg, color: chipColor.color }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: chipColor.dot, flexShrink: 0 }} />
                    {chipColor.text}
                  </span>
                </TooltipTrigger>
                {!nextTask && motivosDesat.length > 0 && (
                  <TooltipContent side="bottom" className="text-xs">
                    {motivosDesat.join(' · ')}
                  </TooltipContent>
                )}
              </Tooltip>
            );
          })()}

          <span className="text-[10px] text-muted-foreground tabular-nums">{daysSinceCreation}d</span>
        </>
      }
    />
  );

  const bodyNode = (
    <>
      {/* Editor de empreendimento (renderizado só quando ativo — disparado pelo card abaixo) */}
      {empreendimentoOpen && (
        <div className="flex items-center gap-2">
          <EmpreendimentoCombobox
            value={empreendimentoSearch || lead.empreendimento || ""}
            onChange={setEmpreendimentoSearch}
            className="h-8 text-xs flex-1"
          />
          <Button
            size="sm"
            className="h-8 text-xs px-3"
            disabled={savingEmpreendimento || !empreendimentoSearch.trim()}
            onClick={async () => {
              setSavingEmpreendimento(true);
              try {
                await onUpdate(lead.id, { empreendimento: empreendimentoSearch.trim() } as any);
                toast.success("Empreendimento atualizado");
                setEmpreendimentoOpen(false);
              } catch { toast.error("Erro ao salvar"); }
              finally { setSavingEmpreendimento(false); }
            }}
          >
            {savingEmpreendimento ? <Loader2 className="h-3 w-3 animate-spin" /> : "Salvar"}
          </Button>
          <Button size="sm" variant="ghost" className="h-8 text-xs px-2" onClick={() => { setEmpreendimentoOpen(false); setEmpreendimentoSearch(""); }}>
            Cancelar
          </Button>
        </div>
      )}

      {/* Caixa PRÓXIMA AÇÃO (gradient indigo→roxo) */}
      <DrawerProximaAcao nextTask={nextTask} proximaAcaoTexto={lead.proxima_acao} />

      {/* Label + Grid 2x2 de ações */}
      <div className="space-y-1.5">
        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-0.5">
          Ações
        </div>
        <DrawerActionGrid
          hasPhone={!!lead.telefone}
          primary={(() => {
            const tipo = parseNextActionType(nextTask, lead.proxima_acao);
            if (tipo === "ligar" || tipo === "whatsapp") return tipo;
            return undefined;
          })()}
          onLigar={() => { trackPipelineEvent("drawer_action_clicked", { lead_id: lead.id, corretor_id: lead.corretor_id, action: "ligar" }); setIsCallOpen(true); }}
          onWhatsapp={() => { trackPipelineEvent("drawer_action_clicked", { lead_id: lead.id, corretor_id: lead.corretor_id, action: "whatsapp" }); setIsWhatsAppFlowOpen(true); }}
          onScripts={() => { trackPipelineEvent("drawer_action_clicked", { lead_id: lead.id, corretor_id: lead.corretor_id, action: "scripts" }); setComunicacaoOpen(true); }}
          onAnotar={() => { trackPipelineEvent("drawer_action_clicked", { lead_id: lead.id, corretor_id: lead.corretor_id, action: "anotar" }); setAnotarOpen(true); }}
        />

        {/* Botão "Mais ações" full-width — reusa CardOverflowMenu (mesmas 7 ações do menu ··· do card) */}
        <CardOverflowMenu
          lead={lead}
          stages={stages}
          onMoveLead={(leadId, newStageId, observacao) => { onMove(leadId, newStageId, observacao); }}
          onOpenDetail={() => { /* já está aberto */ }}
          onCreateTask={() => { setActiveTab("tarefas"); setNextActionOpen(true); }}
          trigger={
            <button className="w-full flex items-center justify-center gap-1.5 h-9 rounded-lg border border-border bg-card hover:bg-muted/40 text-[11px] text-muted-foreground transition-colors">
              <MoreHorizontal className="h-3.5 w-3.5" />
              Mais ações
            </button>
          }
        />

        {/* Apagar (CEO) — admin only, isolado fora do menu padrão */}
        {isAdmin && onDelete && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-full flex items-center justify-center gap-1.5 h-7 rounded-md text-[10px] text-destructive/70 hover:text-destructive hover:bg-destructive/5 transition-colors">
                <Trash2 className="h-3 w-3" />
                Ações admin
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem className="text-destructive" onClick={async () => { setDeleting(true); await onDelete(lead.id); setDeleting(false); onOpenChange(false); }}>
                <Trash2 className="h-3.5 w-3.5 mr-2" /> Apagar lead (CEO)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Caixa Empreendimento polida (header + 3 métricas) */}
      <DrawerEmpreendimento
        empreendimento={lead.empreendimento}
        meta={(() => {
          const parts: string[] = [];
          if (lead.origem) parts.push(lead.origem);
          if (lead.campanha) parts.push(lead.campanha);
          else if (lead.formulario) parts.push(lead.formulario);
          return parts.join(" · ") || null;
        })()}
        tentativasContato={callAttempts}
        diasNaEtapa={Math.floor(hoursInStage / 24)}
        diasDesdeUltimoContato={daysSinceLastAction}
        onEdit={() => { setEmpreendimentoSearch(lead.empreendimento || ""); setEmpreendimentoOpen(true); }}
      />

      {/* Observações / Dados do anúncio (ImovelWeb, etc.) */}
      {lead.observacoes && (
        <Collapsible>
          <CollapsibleTrigger className="flex items-center gap-1.5 text-[11px] font-semibold text-primary hover:text-primary/80 transition-colors group">
            <ChevronRight className="h-3 w-3 transition-transform group-data-[state=open]:rotate-90" />
            <FileText className="h-3 w-3" />
            {lead.origem === "imovelweb" ? "Dados do anúncio ImovelWeb" : "Observações do lead"}
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-1.5">
            <div className="text-[11px] text-muted-foreground bg-muted/50 rounded-md px-3 py-2 whitespace-pre-wrap leading-relaxed border border-border/50">
              {lead.observacoes}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {lead.origem_detalhe && !lead.observacoes && (
        <p className="text-[11px] text-muted-foreground flex items-center gap-1">
          <FileText className="h-3 w-3" /> {lead.origem_detalhe}
        </p>
      )}

      {/* ════════════ FLAG CONTROLS ════════════ */}
      <LeadFlagControls
        leadId={lead.id}
        stageTipo={(currentStage as any)?.tipo || ""}
        flagStatus={lead.flag_status as Record<string, string> | null}
        onUpdate={(_updated) => {
          // Trigger refresh via existing reload mechanism
        }}
      />
    </>
  );

  return (

    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:w-[70vw] sm:max-w-[2000px] p-0 flex flex-col overflow-hidden border-l border-border/50 max-h-[100dvh]">
        <ErrorBoundary fallback={
          <div className="flex flex-col items-center justify-center py-12 gap-3 px-6">
            <span className="text-destructive font-semibold">Erro ao carregar detalhes do lead</span>
            <span className="text-sm text-muted-foreground text-center">Ocorreu um erro inesperado. Feche e tente abrir novamente.</span>
            <button onClick={() => onOpenChange(false)} className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm">Fechar</button>
          </div>
        }>

        {/* ════════════ LAYOUT 2 COLUNAS (Drawer wide v3) ════════════ */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
        <DrawerLeadInfo resetKey={lead.id} header={headerNode}>
          {bodyNode}
        </DrawerLeadInfo>


        <DrawerTimeline>
        {/* ════════════ ABAS (col direita) ════════════ */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <div className="shrink-0 px-5 pt-4 pb-1 flex items-center gap-2 border-b border-border/50">
            <TabsList className="bg-muted/50 h-8 flex-1">
              <TabsTrigger value="historico" className="text-xs h-6 data-[state=active]:shadow-sm gap-1">
                📝 Histórico
                {leadData.atividades.length > 0 && <Badge variant="secondary" className="h-3.5 text-[8px] px-1 ml-0.5">{leadData.atividades.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="tarefas" className="text-xs h-6 data-[state=active]:shadow-sm gap-1">
                📋 Tarefas
                {pendingTasks > 0 && <Badge variant="secondary" className="h-3.5 text-[8px] px-1 ml-0.5">{pendingTasks}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="visitas" className="text-xs h-6 data-[state=active]:shadow-sm gap-1">
                📊 Visitas
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Tabs Radar (Match) e WhatsApp removidas em Pipeline v2 — Fase 4:
              - "Match" não era usado pelos corretores (enquete 23/05/2026).
              - WhatsApp passa a abrir SEMPRE em /whatsapp via WhatsAppFocusFlow, não como tab embarcada. */}

          <ScrollArea className="flex-1 min-h-0">
            {/* ===== TAB: TAREFAS (v4 editorial) ===== */}
            <TabsContent value="tarefas" className="mt-0">
              <DrawerTasksTab
                tarefas={leadData.tarefas}
                leadId={lead.id}
                leadNome={lead.nome}
                leadStageId={lead.stage_id ?? null}
                onAddTarefa={leadData.addTarefa}
                onToggleTarefa={leadData.toggleTarefa}
                onDeleteTarefa={leadData.deleteTarefa}
                onReload={leadData.reload}
                onNovaTarefa={() => setNextActionOpen(true)}
              />
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
                onAddAnotacao={async (conteudo: string) => {
                  const result = await leadData.addAnotacao(conteudo);
                  trackPipelineEvent("drawer_anotar_saved", {
                    lead_id: lead.id,
                    corretor_id: lead.corretor_id,
                    char_count: (conteudo ?? "").length,
                  });
                  return result;
                }}
                onToggleFixar={leadData.toggleFixarAnotacao}
                onAddTarefa={leadData.addTarefa}
                onReload={leadData.reload}
                onNextAction={() => setNextActionOpen(true)}
              />
            </TabsContent>

            {/* ===== TAB: VISITAS (v4 editorial) ===== */}
            <TabsContent value="visitas" className="mt-0">
              <DrawerVisitsTab
                pipelineLeadId={lead.id}
                onAgendarVisita={() => setScheduleVisitOpen(true)}
              />
            </TabsContent>


            {/* Tabs radar/whatsapp removidas (Pipeline v2 Fase 4) */}
          </ScrollArea>
        </Tabs>
        </DrawerTimeline>
        </div>


        {/* ════════════ HOMI SIDE PANEL ════════════ */}
        {homiOpen && (
          <div className={`absolute inset-y-0 right-0 z-40 bg-card border-l border-border shadow-xl flex flex-col ${homiInitialPrompt ? "w-full sm:w-[42%] sm:min-w-[380px] sm:max-w-[520px]" : "w-full sm:w-[45%] sm:min-w-[420px] sm:max-w-[520px]"} transition-all duration-200`}>
            <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-primary/5">
              <span className="text-xs font-bold text-primary flex items-center gap-1.5">
                <Bot className="h-3.5 w-3.5" /> HOMI
              </span>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => { setHomiOpen(false); setHomiInitialPrompt(undefined); }}>✕</Button>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-3 [&_p]:break-words [&_p]:text-[13px] [&_p]:leading-[1.65] [&_pre]:whitespace-pre-wrap">
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
                  initialPrompt={homiInitialPrompt}
                  onClearInitialPrompt={() => setHomiInitialPrompt(undefined)}
                  isDirectMode={!!homiInitialPrompt}
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
              Selecione o motivo e o tipo de inativação para <strong>{lead.nome}</strong>.
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
            <div className="space-y-2">
              <Label className="text-sm font-medium">O que fazer com o lead? *</Label>
              <Select value={tipoDescarte} onValueChange={setTipoDescarte}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="reengajavel">🔄 Descartar (nutrição/oferta ativa)</SelectItem>
                  <SelectItem value="definitivo">⛔ Inativar definitivo (arquivar)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {tipoDescarte === "definitivo" 
                  ? "O lead será arquivado na etapa atual. Não receberá comunicação nem entrará em listas." 
                  : "O lead será movido para Descarte e poderá ser reengajado por nutrição automática ou oferta ativa."}
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setInativarOpen(false)} disabled={inativando}>Cancelar</Button>
            <Button variant="destructive" onClick={handleInativar} disabled={inativando || !inativarMotivo || !tipoDescarte || (inativarMotivo === "outro" && !inativarObs.trim())} className="gap-2">
              {inativando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <WhatsAppTemplatesDialog
        open={whatsappTemplatesOpen}
        onOpenChange={setWhatsappTemplatesOpen}
        leadNome={lead.nome}
        leadTelefone={lead.telefone}
        leadEmpreendimento={lead.empreendimento}
        leadId={lead.id}
        corretorNome={user?.user_metadata?.nome || ""}
        stageTipo={currentStage?.tipo}
      />

      <NextActionModal
        open={nextActionOpen}
        onOpenChange={setNextActionOpen}
        leadId={lead.id}
        leadNome={lead.nome}
        stages={stages}
        currentStageId={lead.stage_id}
        onMove={onMove}
        onReload={leadData.reload}
      />

      <CallFocusOverlay
        isOpen={isCallOpen}
        onClose={() => setIsCallOpen(false)}
        lead={{
          id: lead.id,
          nome: lead.nome,
          telefone: lead.telefone,
          empreendimento: lead.empreendimento,
          stage_id: lead.stage_id,
        }}
        stageTipo={currentStage?.tipo}
        leadOrigem={(lead as any).origem}
        tarefas={leadData.tarefas}
        availableStages={stages.map(s => ({ id: s.id, tipo: s.tipo, nome: s.nome }))}
        onRefresh={leadData.reload}
      />
      <WhatsAppFocusFlow
        isOpen={isWhatsAppFlowOpen}
        onClose={() => setIsWhatsAppFlowOpen(false)}
        lead={{ id: lead.id, nome: lead.nome, telefone: lead.telefone, empreendimento: lead.empreendimento, stage_id: lead.stage_id }}
        stageTipo={currentStage?.tipo}
        onRefresh={leadData.reload}
      />
      <CardScheduleVisitDialog
        open={scheduleVisitOpen}
        onOpenChange={(v) => { setScheduleVisitOpen(v); if (!v) leadData.reload(); }}
        lead={lead as any}
        stages={stages}
        onMoveLead={onMove}
      />
      <DrawerAnotarDialog
        open={anotarOpen}
        onOpenChange={setAnotarOpen}
        leadNome={lead.nome}
        onSave={async (conteudo) => {
          const result = await leadData.addAnotacao(conteudo);
          trackPipelineEvent("drawer_anotar_saved", {
            lead_id: lead.id,
            corretor_id: lead.corretor_id,
            char_count: conteudo.length,
          });
          return result;
        }}
      />
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
