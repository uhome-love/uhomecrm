import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Sheet, SheetContent } from "@/components/ui/sheet";
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
import type { PipelineLead, PipelineStage, PipelineSegmento } from "@/hooks/usePipeline";
import { usePipelineLeadData } from "@/hooks/usePipelineLeadData";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import {
  Phone, Mail, MessageSquare, Calendar, MapPin, Loader2,
  Clock, Building2, Target, DollarSign,
  Plus, CheckCircle2, AlertTriangle,
  FileText, ChevronDown, ClipboardList,
  Flame, Snowflake, Sun, Zap, Brain, TrendingUp,
  Trash2, Ban, PhoneOff, Handshake, MoreHorizontal, Bot, History, Tag
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

const EMPREENDIMENTOS_UHOME = [
  'Alfa', 'Alto Lindóia', 'Boa Vista Country Club', 'Casa Tua',
  'Duetto - Morana', 'Lake Eyre', 'Las Casas', 'Me Day',
  'Melnick Day', 'Melnick Day Compactos', 'Open Bosque',
  'Orygem', 'Seen', 'Shift - Vanguard', 'Terrace', 'Vértice - Las Casas',
];

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

  // Move stage
  const [moveObs, setMoveObs] = useState("");

  // Partnership & Comunicacao
  const [partnerOpen, setPartnerOpen] = useState(false);
  const [comunicacaoOpen, setComunicacaoOpen] = useState(false);
  const [whatsappTemplatesOpen, setWhatsappTemplatesOpen] = useState(false);
  const [showNovaTarefa, setShowNovaTarefa] = useState(false);

  const currentStage = stages.find(s => s.id === lead.stage_id);
  const segmento = segmentos.find(s => s.id === lead.segmento_id);

  // Insights
  const hoursInStage = differenceInHours(new Date(), new Date(lead.stage_changed_at));
  const daysSinceCreation = differenceInDays(new Date(), new Date(lead.created_at));
  const lastActivity = leadData.atividades[0];
  const pendingTasks = leadData.tarefas.filter(t => t.status === "pendente").length;
  const overdueTasks = leadData.tarefas.filter(t => t.status === "pendente" && t.vence_em && new Date(t.vence_em + "T12:00:00") < new Date()).length;

  // Attempt counter (Melhoria 9)
  const callAttempts = useMemo(() => {
    return leadData.atividades.filter(a => a.tipo === "ligacao").length;
  }, [leadData.atividades]);

  const temperatureInfo = TEMPERATURA_MAP[(lead as any).temperatura || "morno"] || TEMPERATURA_MAP.morno;
  const TempIcon = temperatureInfo.icon;

  const whatsappUrl = lead.telefone ? `https://wa.me/${lead.telefone.replace(/\D/g, "")}` : null;

  // Extract jetimob code from jetimob_lead_id
  const jetimobCode = useMemo(() => {
    const jid = (lead as any).jetimob_lead_id;
    if (!jid) return null;
    const match = jid.match(/(\d{4,6})/);
    return match ? `${match[1]}-UH` : jid;
  }, [(lead as any).jetimob_lead_id]);

  // Next task for indicator
  const nextTask = useMemo(() => {
    const pending = leadData.tarefas.filter(t => t.status === "pendente");
    pending.sort((a, b) => {
      if (!a.vence_em) return 1;
      if (!b.vence_em) return -1;
      return new Date(a.vence_em).getTime() - new Date(b.vence_em).getTime();
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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl p-0 flex flex-col overflow-hidden border-l border-border/50 max-h-[100dvh]">

        {/* ════════════ ZONA 1 — HEADER FIXO ════════════ */}
        <div className="shrink-0 border-b border-border/50 bg-card">
          <div className="px-6 pt-5 pb-3 space-y-3">
            {/* Row 1: Name + Stage badge + Temp + Days */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0 flex-wrap">
                <h2 className="text-xl font-bold text-foreground truncate">{lead.nome}</h2>

                {/* Stage badge — click to change */}
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold border cursor-pointer hover:opacity-80 transition-opacity shrink-0" style={{ backgroundColor: currentStage?.cor + "18", color: currentStage?.cor, borderColor: currentStage?.cor + "44" }}>
                      <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: currentStage?.cor }} />
                      {currentStage?.nome}
                      <ChevronDown className="h-2.5 w-2.5" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-56 p-2" align="start">
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

                {/* Temperatura */}
                <span className={`flex items-center gap-0.5 text-xs font-medium ${temperatureInfo.color}`}>
                  <TempIcon className="h-3.5 w-3.5" />
                  {temperatureInfo.label}
                </span>

                {lead.oportunidade_score != null && (() => {
                  const s = lead.oportunidade_score!;
                  const scoreStyle = s >= 81
                    ? { emoji: "💎", label: `${s}`, cls: "text-red-500 font-black" }
                    : s >= 61
                    ? { emoji: "⚡", label: `${s}`, cls: "text-orange-500 font-bold" }
                    : s >= 31
                    ? { emoji: "🔥", label: `${s}`, cls: "text-amber-500 font-semibold" }
                    : { emoji: "🧊", label: `${s}`, cls: "text-blue-500 font-semibold" };
                  return (
                    <span className={`text-xs ${scoreStyle.cls}`}>{scoreStyle.emoji} {scoreStyle.label}</span>
                  );
                })()}
              </div>

              <span className="text-xs text-muted-foreground shrink-0 font-medium">{daysSinceCreation}d</span>
            </div>

            {/* Row 2: Contact info */}
            <div className="flex items-center gap-4 flex-wrap">
              {lead.telefone && (
                <a href={`tel:${lead.telefone}`} className="text-base text-foreground hover:text-primary transition-colors flex items-center gap-1.5">
                  <Phone className="h-4 w-4" /> {lead.telefone}
                </a>
              )}
              {lead.email && (
                <a href={`mailto:${lead.email}`} className="text-base text-foreground hover:text-primary transition-colors flex items-center gap-1.5 truncate">
                  <Mail className="h-4 w-4" /> {lead.email}
                </a>
              )}
            </div>

            {/* Row 3: Action buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              {lead.telefone && (
                <a href={`tel:${lead.telefone}`}>
                  <Button variant="outline" size="sm" className="py-2 px-4 text-xs gap-1.5 rounded-full border-border/60 hover:border-primary hover:text-primary">
                    <Phone className="h-3.5 w-3.5" /> Ligar
                  </Button>
                </a>
              )}
              {lead.telefone && (
                <Button variant="outline" size="sm" className="py-2 px-4 text-xs gap-1.5 rounded-full border-green-300 text-green-600 hover:bg-green-50" onClick={() => setWhatsappTemplatesOpen(true)}>
                  <MessageSquare className="h-3.5 w-3.5" /> WhatsApp
                </Button>
              )}
              {lead.email && (
                <a href={`mailto:${lead.email}`}>
                  <Button variant="outline" size="sm" className="py-2 px-4 text-xs gap-1.5 rounded-full border-border/60 hover:border-primary hover:text-primary">
                    <Mail className="h-3.5 w-3.5" /> Email
                  </Button>
                </a>
              )}
              <Button variant="outline" size="sm" className="py-2 px-4 text-xs gap-1.5 rounded-full border-blue-300 text-blue-500 hover:bg-blue-50" onClick={() => setComunicacaoOpen(true)}>
                <MessageSquare className="h-3.5 w-3.5" /> 📚 Scripts
              </Button>
              <QuickActionMenu leadId={lead.id} leadNome={lead.nome} onOpenDetail={() => setActiveTab("historico")}>
                <Button variant="outline" size="sm" className="py-2 px-4 text-xs gap-1.5 rounded-full">
                  <Plus className="h-3.5 w-3.5" /> Ação
                </Button>
              </QuickActionMenu>

              {/* ⋯ More menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 w-8 p-0 rounded-full">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => setActiveTab("tarefas")}>
                    <ClipboardList className="h-3.5 w-3.5 mr-2" /> Nova Tarefa
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setActiveTab("historico")}>
                    <Calendar className="h-3.5 w-3.5 mr-2" /> Nova Atividade
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setPartnerOpen(true)}>
                    <Handshake className="h-3.5 w-3.5 mr-2" /> Parceria
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {(() => {
                    const descarteStage = stages.find(s => s.tipo === "descarte");
                    if (!descarteStage || lead.stage_id === descarteStage.id) return null;
                    return (
                      <DropdownMenuItem className="text-amber-600" onClick={() => { onMove(lead.id, descarteStage.id, "Descartado pelo usuário"); onOpenChange(false); }}>
                        <Ban className="h-3.5 w-3.5 mr-2" /> Descartar
                      </DropdownMenuItem>
                    );
                  })()}
                  {isAdmin && onDelete && (
                    <DropdownMenuItem className="text-destructive" onClick={async () => { setDeleting(true); await onDelete(lead.id); setDeleting(false); onOpenChange(false); }}>
                      <PhoneOff className="h-3.5 w-3.5 mr-2" /> Contato errado (CEO)
                    </DropdownMenuItem>
                  )}
                  {isAdmin && onDelete && (
                    <DropdownMenuItem className="text-destructive" onClick={async () => { setDeleting(true); await onDelete(lead.id); setDeleting(false); onOpenChange(false); }}>
                      <Trash2 className="h-3.5 w-3.5 mr-2" /> Apagar (CEO)
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Row 4: Corretor (for managers) */}
            {lead.corretor_id && corretorNomes[lead.corretor_id] && (
              <div className="flex items-center gap-2 text-sm">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/20">
                  <span className="text-xs">👤</span>
                  <span className="text-xs font-semibold text-primary">
                    {corretorNomes[lead.corretor_id]}
                  </span>
                </span>
              </div>
            )}

            {/* Row 5: Empreendimento + Canal + Campanha + Jetimob */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5" />
                <span className="font-medium text-foreground/80">{lead.empreendimento || 'Sem empreendimento'}</span>
              </span>
              {(lead as any).origem && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 font-medium">
                  {(lead as any).origem}
                </Badge>
              )}
              {(lead as any).origem_detalhe && (
                <span className="flex items-center gap-1 text-xs">
                  📢 {(lead as any).origem_detalhe}
                </span>
              )}
              {jetimobCode && (
                <span className="flex items-center gap-1 text-xs">
                  <Tag className="h-3 w-3" /> {jetimobCode}
                </span>
              )}
              {callAttempts > 0 && (
                <Badge variant={callAttempts >= 4 ? "destructive" : "secondary"} className="text-[10px] h-5 px-1.5">
                  📞 {callAttempts}/4 tentativas
                </Badge>
              )}
            </div>

            {/* Row 5: Full message from Jetimob (if present) */}
            {(lead as any).observacoes && (
              <div className="rounded-md bg-muted/40 border border-border/30 px-3 py-2">
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  💬 {(lead as any).observacoes}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ════════════ ZONA 2 — ALERTAS + PRÓXIMA TAREFA ════════════ */}
        <div className="shrink-0 border-b border-border/50 bg-accent/20 px-6 py-2.5 space-y-2">
          {/* Alert: Overdue tasks */}
          {overdueTasks > 0 && (() => {
            const overdueList = leadData.tarefas.filter(t => t.status === "pendente" && t.vence_em && new Date(t.vence_em + "T12:00:00") < new Date());
            const firstOverdue = overdueList[0];
            const overdueDate = firstOverdue?.vence_em ? format(new Date(firstOverdue.vence_em + "T12:00:00"), "dd/MM", { locale: ptBR }) : "";
            return (
              <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 border border-red-300/50 dark:border-red-600/30 rounded-lg px-3 py-2">
                <span className="text-base shrink-0">🔴</span>
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-semibold text-red-700 dark:text-red-400">
                    {overdueTasks} tarefa{overdueTasks > 1 ? "s" : ""} atrasada{overdueTasks > 1 ? "s" : ""}
                  </span>
                  <p className="text-[10px] text-red-600 dark:text-red-400/80 truncate">
                    {firstOverdue?.descricao || firstOverdue?.titulo} · venceu {overdueDate}
                  </p>
                </div>
                <Button variant="default" size="sm" className="h-7 text-xs px-3 gap-1 bg-red-500 hover:bg-red-600 text-white shrink-0" onClick={() => setActiveTab("tarefas")}>
                  <AlertTriangle className="h-3 w-3" /> Resolver
                </Button>
              </div>
            );
          })()}

          {/* Alert: No contact for 24h+ and no tasks */}
          {!nextTask && (() => {
            const lastContact = (lead as any).ultima_acao_at;
            const hoursSince = lastContact ? differenceInHours(new Date(), new Date(lastContact)) : 999;
            if (leadData.atividades.length === 0 || hoursSince > 24) {
              const severity = hoursSince > 48 ? "red" : "amber";
              const bgCls = severity === "red" ? "bg-red-50 dark:bg-red-900/20 border-red-300/50 dark:border-red-600/30" : "bg-amber-50 dark:bg-amber-900/20 border-amber-300/50 dark:border-amber-600/30";
              const textCls = severity === "red" ? "text-red-700 dark:text-red-400" : "text-amber-700 dark:text-amber-400";
              const btnCls = severity === "red" ? "bg-red-500 hover:bg-red-600" : "bg-amber-500 hover:bg-amber-600";
              return (
                <div className={`flex items-center gap-2 border rounded-lg px-3 py-2 ${bgCls}`}>
                  <span className="text-base shrink-0">{severity === "red" ? "🔴" : "🟡"}</span>
                  <div className="flex-1 min-w-0">
                    <span className={`text-xs font-semibold ${textCls}`}>Sem contato registrado</span>
                    <p className={`text-[10px] ${textCls} opacity-80`}>Registre uma atividade ou ligue para o lead.</p>
                  </div>
                  <Button variant="default" size="sm" className={`h-7 text-xs px-3 gap-1 ${btnCls} text-white shrink-0`} onClick={() => setActiveTab("historico")}>
                    <Plus className="h-3 w-3" /> Registrar contato
                  </Button>
                </div>
              );
            }
            return null;
          })()}

          {/* Next task indicator OR missing task alert */}
          {nextTask ? (
            <div className="flex items-center gap-2 flex-wrap">
              <ClipboardList className="h-4 w-4 text-primary shrink-0" />
              <span className="text-xs font-semibold text-foreground">Próxima tarefa:</span>
              <span className="text-xs text-muted-foreground">
                {nextTask.descricao || nextTask.titulo}
                {nextTask.vence_em && ` · ${format(new Date(nextTask.vence_em + "T00:00:00"), "dd/MM", { locale: ptBR })}`}
                {(nextTask as any).hora_vencimento && ` ${(nextTask as any).hora_vencimento.slice(0, 5)}`}
              </span>
              <div className="ml-auto flex items-center gap-1">
                <Button variant="outline" size="sm" className="h-6 text-[10px] px-2 gap-1" onClick={() => leadData.toggleTarefa(nextTask.id, nextTask.status)}>
                  <CheckCircle2 className="h-3 w-3" /> Feito
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-300/50 dark:border-amber-600/30 rounded-lg px-3 py-2">
              <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
              <div className="flex-1">
                <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">Lead desatualizado</span>
                <p className="text-[10px] text-amber-600 dark:text-amber-400/80 mt-0.5">
                  Para manter o lead atualizado, crie uma tarefa com a próxima ação a ser realizada.
                </p>
              </div>
              <Button variant="default" size="sm" className="h-7 text-xs px-3 gap-1 bg-amber-500 hover:bg-amber-600 text-white shrink-0" onClick={() => { setActiveTab("tarefas"); setShowNovaTarefa(true); }}>
                <Plus className="h-3 w-3" /> Criar próxima ação
              </Button>
            </div>
          )}
        </div>

        {/* ════════════ ZONA 3 — CONTEÚDO (4 Abas reordenadas) ════════════ */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <div className="shrink-0 mx-6 mt-3 mb-4 flex items-center gap-2">
            <TabsList className="bg-muted/50 h-9 flex-1">
              <TabsTrigger value="historico" className="text-sm h-7 data-[state=active]:shadow-sm">
                <History className="h-3.5 w-3.5 mr-1" /> 📝 Histórico
                {leadData.atividades.length > 0 && <Badge variant="secondary" className="ml-1 h-4 text-[9px] px-1">{leadData.atividades.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="tarefas" className="text-sm h-7 data-[state=active]:shadow-sm">
                <ClipboardList className="h-3.5 w-3.5 mr-1" /> 📋 Tarefas
                {pendingTasks > 0 && <Badge variant="secondary" className="ml-1 h-4 text-[9px] px-1">{pendingTasks}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="visitas-propostas" className="text-sm h-7 data-[state=active]:shadow-sm">
                <MapPin className="h-3.5 w-3.5 mr-1" /> 📊 Visitas
              </TabsTrigger>
              <TabsTrigger value="inteligencia" className="text-sm h-7 data-[state=active]:shadow-sm">
                <Brain className="h-3.5 w-3.5 mr-1" /> 🧠
              </TabsTrigger>
              <TabsTrigger value="radar" className="text-sm h-7 data-[state=active]:shadow-sm">
                <Building2 className="h-3.5 w-3.5 mr-1" /> 📡 Radar
              </TabsTrigger>
            </TabsList>
            <Button
              size="sm"
              className="h-9 text-xs px-4 gap-1 bg-blue-600 hover:bg-blue-700 text-white rounded-md shrink-0"
              onClick={() => setComunicacaoOpen(true)}
            >
              ✨ HOMI
            </Button>
          </div>

          <ScrollArea className="flex-1 min-h-0" style={{ maxHeight: "calc(85vh - 260px)" }}>
            {/* ===== TAB: TAREFAS (DEFAULT) ===== */}
            <TabsContent value="tarefas" className="mt-0">
              {/* Sequence suggestions at top of tasks tab */}
              {currentStage && leadData.tarefas.filter(t => t.status === "pendente").length < 3 && (
                <div className="px-6 pt-4 pb-2">
                  <LeadSequenceSuggestion
                    leadId={lead.id}
                    leadNome={lead.nome}
                    stageType={currentStage.tipo}
                    empreendimento={lead.empreendimento}
                    onTasksCreated={leadData.reload}
                  />
                </div>
              )}
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
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1"
                    onClick={() => {
                      onOpenChange(false);
                      setTimeout(() => {
                        navigate(`/agenda-visitas?lead=${lead.id}&nome=${encodeURIComponent(lead.nome)}&telefone=${encodeURIComponent(lead.telefone || "")}&empreendimento=${encodeURIComponent(lead.empreendimento || "")}`);
                      }, 200);
                    }}
                  >
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
              {/* Lead intelligence card */}
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
                <h4 className="text-xs font-bold text-primary flex items-center gap-1.5">
                  <Brain className="h-4 w-4" /> Inteligência do Lead
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <InsightItem icon={Clock} label="Sem contato" value={lastActivity ? formatDistanceToNow(new Date(lastActivity.created_at), { locale: ptBR }) : "Nenhum"} alert={!lastActivity || differenceInHours(new Date(), new Date(lastActivity.created_at)) > 48} />
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

              {/* Sequence Suggestion */}
              {currentStage && (
                <LeadSequenceSuggestion leadId={lead.id} leadNome={lead.nome} stageType={currentStage.tipo} empreendimento={lead.empreendimento} onTasksCreated={leadData.reload} />
              )}

              {/* Commercial Data */}
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
                      {/* BUG 6 FIX: Use EmpreendimentoCombobox for free-text input */}
                      <EmpreendimentoCombobox
                        value={commercialData.empreendimento}
                        onChange={v => setCommercialData(p => ({ ...p, empreendimento: v }))}
                        placeholder="Selecione ou digite o empreendimento..."
                      />
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
                      <Popover open={empreendimentoOpen} onOpenChange={(o) => {
                        setEmpreendimentoOpen(o);
                        if (o) setEmpreendimentoSearch(lead.empreendimento || "");
                      }}>
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
                          <EmpreendimentoCombobox
                            value={empreendimentoSearch}
                            onChange={(v) => setEmpreendimentoSearch(v)}
                            onSelect={async (v) => {
                              setSavingEmpreendimento(true);
                              await onUpdate(lead.id, { empreendimento: v } as any);
                              setEmpreendimentoOpen(false);
                              setEmpreendimentoSearch("");
                              setSavingEmpreendimento(false);
                              toast.success("Empreendimento atualizado ✅");
                            }}
                            placeholder="Buscar ou digitar empreendimento..."
                          />
                          <Button
                            size="sm"
                            className="w-full h-8 text-xs font-semibold"
                            disabled={!empreendimentoSearch.trim() || savingEmpreendimento}
                            onClick={async () => {
                              setSavingEmpreendimento(true);
                              await onUpdate(lead.id, { empreendimento: empreendimentoSearch.trim() } as any);
                              setEmpreendimentoOpen(false);
                              setEmpreendimentoSearch("");
                              setSavingEmpreendimento(false);
                              toast.success("Empreendimento atualizado ✅");
                            }}
                          >
                            {savingEmpreendimento ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Salvar Empreendimento"}
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

              {/* Observações */}
              {lead.observacoes && (
                <p className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
                  {lead.observacoes}
                </p>
              )}
            </TabsContent>

            {/* ===== TAB: RADAR IMÓVEIS ===== */}
            <TabsContent value="radar" className="mt-0">
              <RadarImoveisTab
                leadId={lead.id}
                leadNome={lead.nome}
                leadTelefone={lead.telefone}
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

        {/* ════════════ HOMI — BOTÃO FLUTUANTE ════════════ */}
        <button
          onClick={() => setHomiOpen(!homiOpen)}
          className="absolute bottom-4 right-4 z-50 h-10 w-10 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:scale-105 transition-transform"
          title="HOMI Assistente"
        >
          <Bot className="h-5 w-5" />
        </button>

        {/* HOMI Side Panel */}
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
      </SheetContent>

      <PartnershipDialog open={partnerOpen} onOpenChange={setPartnerOpen} leadId={lead.id} leadNome={lead.nome} corretorPrincipalId={lead.corretor_id} />
      <CentralComunicacao open={comunicacaoOpen} onOpenChange={setComunicacaoOpen} leadId={lead.id} leadNome={lead.nome} leadTelefone={lead.telefone} leadEmpreendimento={lead.empreendimento} />
    </Sheet>
  );
}

// ===== Sub-components =====

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
