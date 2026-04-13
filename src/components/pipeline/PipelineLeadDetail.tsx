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
import {
  Phone, Mail, MessageSquare, Calendar, MapPin, Loader2,
  Clock, Building2, Target, DollarSign,
  Plus, CheckCircle2, AlertTriangle, ChevronRight,
  FileText, ChevronDown, ClipboardList,
  Flame, Snowflake, Sun, Zap, Brain, TrendingUp,
  Trash2, Ban, Handshake, MoreHorizontal, Bot, History, Tag, Search
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
import NextActionModal from "./NextActionModal";
import EmpreendimentoCombobox from "@/components/ui/empreendimento-combobox";
import RadarImoveisTab from "./RadarImoveisTab";
import LeadImoveisIndicadosTab from "./LeadImoveisIndicadosTab";
import StageCoachBar from "./StageCoachBar";
import { CallFocusOverlay } from "./CallFocusOverlay";
import WhatsAppFocusFlow from "./WhatsAppFocusFlow";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { differenceInDaysSafe, differenceInHoursSafe, formatDateSafe, formatDistanceToNowSafe, parseDateBRTSafe } from "@/lib/utils";
import { getScoreTemperature } from "@/lib/scoreTemperatureLabels";

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
  const [activeTab, setActiveTab] = useState("historico");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [homiOpen, setHomiOpen] = useState(false);
  const [homiInitialPrompt, setHomiInitialPrompt] = useState<string | undefined>();
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
  const [isWhatsAppFlowOpen, setIsWhatsAppFlowOpen] = useState(false);
  const [showNovaTarefa, setShowNovaTarefa] = useState(false);
  const [inativarOpen, setInativarOpen] = useState(false);
  const [inativarMotivo, setInativarMotivo] = useState("");
  const [inativarObs, setInativarObs] = useState("");
  const [tipoDescarte, setTipoDescarte] = useState<string>("reengajavel");
  const [inativando, setInativando] = useState(false);
  const [nextActionOpen, setNextActionOpen] = useState(false);
  const [isCallOpen, setIsCallOpen] = useState(false);

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
      const descarteStage = stages.find(s => s.tipo === "descarte");
      const motivoTexto = inativarMotivo === "outro"
        ? `Inativado: ${inativarObs.trim() || "Outro motivo"}`
        : `Inativado: ${inativarMotivo}`;
      await onUpdate(lead.id, { motivo_descarte: motivoTexto, tipo_descarte: tipoDescarte } as any);
      if (descarteStage) await onMove(lead.id, descarteStage.id, motivoTexto);
      toast.success("Lead inativado com sucesso");
      setInativarOpen(false);
      onOpenChange(false);
    } catch (err: any) {
      toast.error("Erro ao inativar: " + (err.message || ""));
    } finally { setInativando(false); }
  }, [inativarMotivo, inativarObs, tipoDescarte, stages, lead.id, onUpdate, onMove, onOpenChange]);

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
    // Check most recent activity date too
    const lastActivityDate = leadData.atividades.length > 0 ? leadData.atividades[0]?.created_at : null;
    const lastContact = (lead as any).ultima_acao_at || lastActivityDate;
    const hoursSince = differenceInHoursSafe(lastContact) ?? 999;
    if (leadData.atividades.length === 0 || hoursSince > 48) {
      return hoursSince > 96 ? "critical" : "warning";
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
          <div className="flex items-center gap-2 min-w-0 pr-8">
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
                    <span className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full shrink-0 cursor-default" style={{ background: chipColor.bg, color: chipColor.color }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: chipColor.dot, flexShrink: 0 }} />
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

          {/* Row 2.5: Empreendimento edit */}
          <div className="flex items-center gap-2">
            {empreendimentoOpen ? (
              <div className="flex items-center gap-2 flex-1">
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
            ) : (
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1.5 rounded-lg"
                  onClick={() => { setEmpreendimentoSearch(lead.empreendimento || ""); setEmpreendimentoOpen(true); }}
                >
                  <Building2 className="h-3 w-3" />
                  {lead.empreendimento ? `📍 ${lead.empreendimento}` : "+ Empreendimento"}
                </Button>
                {(lead as any).imovel_codigo && (
                  <Badge variant="outline" className="text-[10px] h-5 px-1.5 bg-blue-50 text-blue-700 border-blue-200">
                    Cód: {(lead as any).imovel_codigo}
                  </Badge>
                )}
                {(lead as any).imovel_url && (
                  <a
                    href={(lead as any).imovel_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-blue-600 hover:underline flex items-center gap-1"
                  >
                    <Search className="h-3 w-3" />
                    Ver imóvel
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Row 3: Actions bar — horizontal scroll on mobile */}
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-none -mx-1 px-1 pb-1">
            {lead.telefone && (
              <Button variant="outline" size="sm" className="shrink-0 h-9 text-xs gap-1 rounded-lg px-2.5 whitespace-nowrap" onClick={() => setIsCallOpen(true)}>
                <Phone className="h-3.5 w-3.5" /> Ligar
              </Button>
            )}
            {lead.telefone && (
              <Button variant="outline" size="sm" className="shrink-0 h-9 text-xs gap-1 rounded-lg px-2.5 whitespace-nowrap border-green-200 text-green-600 hover:bg-green-50 dark:border-green-800 dark:hover:bg-green-950" onClick={() => setIsWhatsAppFlowOpen(true)}>
                <MessageSquare className="h-3.5 w-3.5" /> WhatsApp
              </Button>
            )}
            <Button variant="outline" size="sm" className="shrink-0 h-9 text-xs gap-1 rounded-lg px-2.5 whitespace-nowrap" onClick={() => setComunicacaoOpen(true)}>
              <FileText className="h-3.5 w-3.5" /> Scripts
            </Button>
            
            
            <QuickActionMenu leadId={lead.id} leadNome={lead.nome} corretorId={lead.corretor_id} onOpenDetail={() => setActiveTab("historico")} onRefresh={leadData.reload}>
              <Button variant="outline" size="sm" className="shrink-0 h-9 text-xs gap-1 rounded-lg px-2.5 whitespace-nowrap">
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
                <DropdownMenuItem onClick={() => navigate(`/imoveis?lead_id=${lead.id}&lead_nome=${encodeURIComponent(lead.nome)}`)}>
                  <Search className="h-3.5 w-3.5 mr-2" /> Buscar imóveis
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setPartnerOpen(true)}>
                  <Handshake className="h-3.5 w-3.5 mr-2" /> Parceria
                </DropdownMenuItem>
                <DropdownMenuItem onClick={async () => {
                  const currentTags: string[] = (lead as any).tags || [];
                  const hasMelnick = currentTags.includes("MELNICK_DAY");
                  const newTags = hasMelnick
                    ? currentTags.filter((t: string) => t !== "MELNICK_DAY")
                    : [...currentTags, "MELNICK_DAY"];
                  await onUpdate(lead.id, { tags: newTags } as any);
                  toast.success(hasMelnick ? "Tag Melnick Day removida" : "Tag Melnick Day adicionada");
                }}>
                  <Tag className="h-3.5 w-3.5 mr-2" />
                  {((lead as any).tags || []).includes("MELNICK_DAY") ? "🔥 Remover Melnick Day" : "🔥 Marcar Melnick Day"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive" onClick={() => { setInativarMotivo(""); setInativarObs(""); setTipoDescarte("reengajavel"); setInativarOpen(true); }}>
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

          {/* Row 4: Context line — empreendimento + formulário + status + tags */}
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
            {((lead as any).tags || []).includes("MELNICK_DAY") && (
              <Badge className="text-[9px] h-4 px-1.5 bg-orange-500 text-white border-none">🔥 Melnick Day</Badge>
            )}
            {(lead.empreendimento || lead.plataforma) && (
              <span className="flex items-center gap-1">
                <Building2 className="h-3 w-3" />
                <span className="font-semibold text-foreground/80">{originLine}</span>
              </span>
            )}
            {lead.formulario && (
              <>
                <span className="text-muted-foreground/40">|</span>
                <span className="truncate max-w-[220px]">{lead.formulario}</span>
              </>
            )}
            {callAttempts > 0 && (
              <>
                <span className="text-muted-foreground/40">|</span>
                <Badge variant={callAttempts >= 4 ? "destructive" : "secondary"} className="text-[9px] h-4 px-1">
                  📞 {callAttempts}/4
                </Badge>
              </>
            )}
            {jetimobCode && (
              <>
                <span className="text-muted-foreground/40">|</span>
                <span className="text-muted-foreground/60">
                  <Tag className="h-2.5 w-2.5 inline" /> {jetimobCode}
                </span>
              </>
            )}
            <span className="text-muted-foreground/40">|</span>
            {noContactAlert ? (
              <span className="inline-flex items-center gap-1.5">
                <span className={`font-semibold ${noContactAlert === "critical" ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"}`}>
                  {noContactAlert === "critical" ? "🔴" : "🟡"} Sem contato
                </span>
                <button
                  onClick={() => setActiveTab("historico")}
                  className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                >
                  Resolver →
                </button>
              </span>
            ) : overdueTasks > 0 ? (
              <span className="font-semibold text-red-600 dark:text-red-400">
                🔴 {overdueTasks} tarefa{overdueTasks > 1 ? "s" : ""} atrasada{overdueTasks > 1 ? "s" : ""}
              </span>
            ) : nextTask ? (
              <span className="font-semibold text-primary">
                ✅ Próx: {nextTask.titulo || nextTask.descricao}
                {nextTask.vence_em && <span className="font-normal ml-1">· {formatDateSafe(nextTask.vence_em, "dd/MM", { locale: ptBR, dateOnly: true, fallback: "" })}</span>}
              </span>
            ) : (
              <span className="font-semibold text-amber-600 dark:text-amber-400">⚠️ Sem próxima ação</span>
            )}
          </div>

          {/* Row 5: Observações / Dados do anúncio (ImovelWeb, etc.) */}
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

          {/* origem_detalhe inline */}
          {lead.origem_detalhe && !lead.observacoes && (
            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
              <FileText className="h-3 w-3" /> {lead.origem_detalhe}
            </p>
          )}
        </div>

        {/* ════════════ STAGE COACH ════════════ */}
        <StageCoachBar
          stageTipo={(currentStage as any)?.tipo}
          leadNome={lead.nome}
          empreendimento={lead.empreendimento}
          diasSemContato={daysSinceCreation}
          tentativasLigacao={callAttempts}
          telefone={lead.telefone}
          onAddTarefa={leadData.addTarefa}
          onOpenHomi={(prompt?: string) => {
            setHomiOpen(true);
            setHomiInitialPrompt(prompt);
          }}
          origem={lead.origem}
          nextTask={nextTask}
          noContactAlert={noContactAlert}
        />

        {/* ════════════ ABAS ════════════ */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <div className="shrink-0 px-5 pt-2 pb-1 flex items-center gap-2 border-b border-border/50">
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
              <TabsTrigger value="radar" className="text-xs h-6 data-[state=active]:shadow-sm gap-1">
                🎯 Match
              </TabsTrigger>
              <TabsTrigger value="homi" className="text-xs h-6 data-[state=active]:shadow-sm gap-1">
                ⚡ HOMI
              </TabsTrigger>
            </TabsList>
          </div>

          <ScrollArea className="flex-1 min-h-0">
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
                onNextAction={() => setNextActionOpen(true)}
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
                onNextAction={() => setNextActionOpen(true)}
              />
            </TabsContent>

            {/* ===== TAB: VISITAS ===== */}
            <TabsContent value="visitas" className="px-6 pb-8 space-y-4 mt-0">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <MapPin className="h-4 w-4" /> Visitas do Lead
                </h4>
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => { onOpenChange(false); setTimeout(() => { navigate(`/agenda-visitas?lead=${lead.id}&nome=${encodeURIComponent(lead.nome)}&telefone=${encodeURIComponent(lead.telefone || "")}&empreendimento=${encodeURIComponent(lead.empreendimento || "")}`); }, 200); }}>
                  <Calendar className="h-3 w-3" /> + Agendar Visita
                </Button>
              </div>
              <OpportunityVisitasTab pipelineLeadId={lead.id} />
            </TabsContent>


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

            <TabsContent value="homi" className="p-0">
              {/* v2 - homi tab styling */}
              <div className="p-4 flex flex-col gap-4">
                {/* Briefing compacto */}
                <div style={{ background: 'var(--muted)', borderRadius: 8, padding: '10px 14px', borderLeft: '3px solid #4F46E5', marginBottom: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)', marginBottom: 3 }}>
                    {lead.nome} · {currentStage?.nome || 'N/A'} · {daysSinceCreation}d sem contato
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
                    {(lead as any).origem} · {(lead as any).empreendimento}
                  </div>
                </div>

                {/* Botões de ação */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                  <button
                    onClick={() => { setHomiOpen(true); setHomiInitialPrompt('Gere uma mensagem de WhatsApp de apresentação para ' + lead.nome + ' sobre ' + ((lead as any).empreendimento || 'o empreendimento') + '. IMPORTANTE: Retorne SOMENTE as mensagens prontas para copiar, nada mais.'); }}
                    style={{ padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: '#4F46E5', color: '#fff', border: 'none', cursor: 'pointer' }}
                  >
                    Gerar mensagem
                  </button>
                  <button
                    onClick={() => { setHomiOpen(true); setHomiInitialPrompt('Gere um follow-up para ' + lead.nome + ' que está em ' + (currentStage?.nome || '') + ' há ' + daysSinceCreation + ' dias. IMPORTANTE: Retorne SOMENTE a mensagem pronta para copiar.'); }}
                    style={{ padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 500, background: 'var(--background)', color: 'var(--foreground)', border: '1px solid var(--border)', cursor: 'pointer' }}
                  >
                    Follow-up
                  </button>
                  <button
                    onClick={() => { setHomiOpen(true); setHomiInitialPrompt('Quebre a objeção mais comum para um lead em ' + (currentStage?.nome || '') + ' interessado em ' + ((lead as any).empreendimento || 'o empreendimento') + '. IMPORTANTE: Retorne SOMENTE os argumentos prontos para usar.'); }}
                    style={{ padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 500, background: 'var(--background)', color: 'var(--foreground)', border: '1px solid var(--border)', cursor: 'pointer' }}
                  >
                    Quebrar objeção
                  </button>
                </div>

                {/* Campo o que o cliente disse */}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--foreground)', marginBottom: 6 }}>
                    O que o cliente disse?
                  </div>
                  <textarea
                    placeholder="Cole aqui a mensagem do cliente para a IA gerar uma resposta personalizada..."
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '0.5px solid var(--border)', fontSize: 13, fontFamily: 'inherit', resize: 'none', background: 'var(--background)', color: 'var(--foreground)', lineHeight: 1.5, marginBottom: 10 }}
                    rows={3}
                    id="homi-client-message"
                  />
                  <button
                    onClick={() => {
                      const msg = (document.getElementById('homi-client-message') as HTMLTextAreaElement)?.value || '';
                      setHomiOpen(true);
                      setHomiInitialPrompt('O cliente disse: "' + msg + '". Gere uma resposta personalizada para ' + lead.nome + ' sobre ' + ((lead as any).empreendimento || 'o empreendimento') + '. IMPORTANTE: Retorne SOMENTE a resposta pronta para copiar.');
                    }}
                    style={{ padding: 10, borderRadius: 8, fontSize: 13, fontWeight: 600, background: '#4F46E5', color: '#fff', border: 'none', cursor: 'pointer', width: '100%' }}
                  >
                    Gerar resposta com IA
                  </button>
                </div>
              </div>
            </TabsContent>
          </ScrollArea>
        </Tabs>

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
            <div className="space-y-2">
              <Label className="text-sm font-medium">Tipo de descarte *</Label>
              <Select value={tipoDescarte} onValueChange={setTipoDescarte}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="reengajavel">🔄 Temporário (pode reengajar)</SelectItem>
                  <SelectItem value="definitivo">⛔ Definitivo (não contactar)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {tipoDescarte === "definitivo" 
                  ? "O lead não receberá mais nenhuma comunicação." 
                  : "O lead poderá ser reengajado por nutrição automática."}
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
