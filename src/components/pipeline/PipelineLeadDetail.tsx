import { useState, useMemo } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { PipelineLead, PipelineStage, PipelineSegmento } from "@/hooks/usePipeline";
import { usePipelineLeadData } from "@/hooks/usePipelineLeadData";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import {
  Phone, Mail, MessageSquare, Calendar, MapPin, ArrowRight, Loader2,
  Clock, User, Building2, Target, DollarSign,
  Plus, Pin, PinOff, CheckCircle2, Circle, AlertTriangle,
  FileText, Send, PhoneCall, Video, ChevronRight, ChevronDown,
  Flame, Snowflake, Sun, Zap, ClipboardList, StickyNote,
  History, Brain, TrendingUp, AlertCircle, Timer,
  Trash2, Ban, PhoneOff, Handshake, MoreHorizontal, Bot
} from "lucide-react";
import PartnershipDialog from "./PartnershipDialog";
import GerenteManagementSection from "./GerenteManagementSection";
import LeadSequenceSuggestion from "./LeadSequenceSuggestion";
import HomiLeadAssistant from "./HomiLeadAssistant";
import CentralComunicacao from "@/components/comunicacao/CentralComunicacao";
import OpportunityVisitasTab from "./OpportunityVisitasTab";
import OpportunityPropostasTab from "./OpportunityPropostasTab";
import { format, formatDistanceToNow, differenceInHours, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";

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

const ATIVIDADE_TIPOS = [
  { value: "ligacao", label: "Ligação", icon: PhoneCall },
  { value: "whatsapp", label: "WhatsApp", icon: MessageSquare },
  { value: "followup", label: "Follow-up", icon: Send },
  { value: "reuniao", label: "Reunião", icon: Video },
  { value: "visita", label: "Visita", icon: MapPin },
  { value: "proposta", label: "Proposta", icon: FileText },
  { value: "retorno", label: "Retorno combinado", icon: Clock },
  { value: "pendencia_doc", label: "Pendência documental", icon: ClipboardList },
];

const TEMPERATURA_MAP: Record<string, { label: string; color: string; icon: any }> = {
  quente: { label: "Quente", color: "text-red-500", icon: Flame },
  morno: { label: "Morno", color: "text-amber-500", icon: Sun },
  frio: { label: "Frio", color: "text-blue-500", icon: Snowflake },
};

const PRIORIDADE_MAP: Record<string, { label: string; color: string }> = {
  alta: { label: "Alta", color: "bg-red-500/10 text-red-600 border-red-200" },
  media: { label: "Média", color: "bg-amber-500/10 text-amber-600 border-amber-200" },
  baixa: { label: "Baixa", color: "bg-green-500/10 text-green-600 border-green-200" },
};

export default function PipelineLeadDetail({ lead, stages, segmentos, corretorNomes = {}, open, onOpenChange, onUpdate, onMove, onDelete }: Props) {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const leadData = usePipelineLeadData(open ? lead.id : null);
  const [activeTab, setActiveTab] = useState("inteligencia");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [homiOpen, setHomiOpen] = useState(false);

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
  });

  // Próxima ação
  const [proximaAcao, setProximaAcao] = useState(lead.proxima_acao || "");
  const [dataProximaAcao, setDataProximaAcao] = useState(lead.data_proxima_acao || "");

  // New atividade
  const [showNewAtividade, setShowNewAtividade] = useState(false);
  const [newAtividade, setNewAtividade] = useState({ tipo: "ligacao", titulo: "", descricao: "", data: new Date().toISOString().split("T")[0], hora: "", prioridade: "media" });

  // New tarefa
  const [showNewTarefa, setShowNewTarefa] = useState(false);
  const [newTarefa, setNewTarefa] = useState({ titulo: "", descricao: "", prioridade: "media", vence_em: "" });

  // New anotacao
  const [newNota, setNewNota] = useState("");

  // Move stage
  const [moveObs, setMoveObs] = useState("");

  // Partnership
  const [partnerOpen, setPartnerOpen] = useState(false);
  const [comunicacaoOpen, setComunicacaoOpen] = useState(false);

  const currentStage = stages.find(s => s.id === lead.stage_id);
  const segmento = segmentos.find(s => s.id === lead.segmento_id);

  // Insights
  const hoursInStage = differenceInHours(new Date(), new Date(lead.stage_changed_at));
  const daysSinceCreation = differenceInDays(new Date(), new Date(lead.created_at));
  const lastActivity = leadData.atividades[0];
  const pendingTasks = leadData.tarefas.filter(t => t.status === "pendente").length;
  const overdueTasks = leadData.tarefas.filter(t => t.status === "pendente" && t.vence_em && new Date(t.vence_em) < new Date()).length;

  const temperatureInfo = TEMPERATURA_MAP[(lead as any).temperatura || "morno"] || TEMPERATURA_MAP.morno;
  const TempIcon = temperatureInfo.icon;

  const whatsappUrl = lead.telefone ? `https://wa.me/${lead.telefone.replace(/\D/g, "")}` : null;

  const handleSaveCommercial = async () => {
    setSaving(true);
    try {
      await onUpdate(lead.id, commercialData as any);
      setEditingCommercial(false);
    } finally { setSaving(false); }
  };

  const handleSaveProximaAcao = async () => {
    setSaving(true);
    try {
      await onUpdate(lead.id, { proxima_acao: proximaAcao || null, data_proxima_acao: dataProximaAcao || null } as any);
    } finally { setSaving(false); }
  };

  const handleAddAtividade = async () => {
    await leadData.addAtividade(newAtividade);
    setNewAtividade({ tipo: "ligacao", titulo: "", descricao: "", data: new Date().toISOString().split("T")[0], hora: "", prioridade: "media" });
    setShowNewAtividade(false);
  };

  const handleAddTarefa = async () => {
    await leadData.addTarefa(newTarefa);
    setNewTarefa({ titulo: "", descricao: "", prioridade: "media", vence_em: "" });
    setShowNewTarefa(false);
  };

  const handleAddNota = async () => {
    if (!newNota.trim()) return;
    await leadData.addAnotacao(newNota.trim());
    setNewNota("");
  };

  const handleMoveStage = async (stageId: string) => {
    await onMove(lead.id, stageId, moveObs || undefined);
    setMoveObs("");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl p-0 flex flex-col overflow-hidden border-l border-border/50">

        {/* ════════════ ZONA 1 — HEADER FIXO ════════════ */}
        <div className="shrink-0 border-b border-border/50 bg-card">
          <div className="px-4 pt-4 pb-2 space-y-2">
            {/* Row 1: Name + Stage badge (clickable) + Days */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <TempIcon className={`h-4 w-4 shrink-0 ${temperatureInfo.color}`} />
                <h2 className="text-base font-bold text-foreground truncate">{lead.nome}</h2>

                {/* Stage badge — click to change */}
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold border cursor-pointer hover:opacity-80 transition-opacity shrink-0" style={{ backgroundColor: currentStage?.cor + "18", color: currentStage?.cor, borderColor: currentStage?.cor + "44" }}>
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
              </div>

              <span className="text-[11px] text-muted-foreground shrink-0 font-medium">{daysSinceCreation}d</span>
            </div>

            {/* Row 2: Empreendimento + Temp + Score */}
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
              {lead.empreendimento && (
                <span className="flex items-center gap-1">
                  <Building2 className="h-3 w-3" />
                  {lead.empreendimento}
                </span>
              )}
              <span className={`font-medium ${temperatureInfo.color}`}>{temperatureInfo.label}</span>
              {lead.oportunidade_score != null && (
                <span className="flex items-center gap-0.5 font-semibold text-primary">
                  <Target className="h-3 w-3" /> Score {lead.oportunidade_score}
                </span>
              )}
              {lead.valor_estimado ? (
                <span className="flex items-center gap-0.5 font-semibold text-primary">
                  <DollarSign className="h-3 w-3" />
                  R$ {lead.valor_estimado.toLocaleString("pt-BR")}
                </span>
              ) : null}
            </div>

            {/* Row 3: Contact info */}
            <div className="flex items-center gap-3 text-[11px] flex-wrap">
              {lead.telefone && (
                <a href={`tel:${lead.telefone}`} className="text-foreground hover:text-primary transition-colors flex items-center gap-1">
                  <Phone className="h-3 w-3" /> {lead.telefone}
                </a>
              )}
              {lead.email && (
                <a href={`mailto:${lead.email}`} className="text-foreground hover:text-primary transition-colors flex items-center gap-1 truncate">
                  <Mail className="h-3 w-3" /> {lead.email}
                </a>
              )}
            </div>

            {/* Row 4: Action buttons */}
            <div className="flex items-center gap-1.5">
              {lead.telefone && (
                <a href={`tel:${lead.telefone}`}>
                  <Button variant="outline" size="sm" className="h-7 text-[11px] gap-1 rounded-full border-border/60 hover:border-primary hover:text-primary">
                    <Phone className="h-3 w-3" /> Ligar
                  </Button>
                </a>
              )}
              {whatsappUrl && (
                <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm" className="h-7 text-[11px] gap-1 rounded-full border-green-300 text-green-600 hover:bg-green-50">
                    <MessageSquare className="h-3 w-3" /> WhatsApp
                  </Button>
                </a>
              )}
              {lead.email && (
                <a href={`mailto:${lead.email}`}>
                  <Button variant="outline" size="sm" className="h-7 text-[11px] gap-1 rounded-full border-border/60 hover:border-primary hover:text-primary">
                    <Mail className="h-3 w-3" /> Email
                  </Button>
                </a>
              )}
              <Button variant="outline" size="sm" className="h-7 text-[11px] gap-1 rounded-full border-blue-300 text-blue-500 hover:bg-blue-50" onClick={() => setComunicacaoOpen(true)}>
                <MessageSquare className="h-3 w-3" /> 💬 Comunicar
              </Button>
              <Button variant="outline" size="sm" className="h-7 text-[11px] gap-1 rounded-full" onClick={() => { setActiveTab("historico"); setShowNewAtividade(true); }}>
                <Plus className="h-3 w-3" /> Ação
              </Button>

              {/* ⋯ More menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-7 w-7 p-0 rounded-full">
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => { setActiveTab("tarefas"); setShowNewTarefa(true); }}>
                    <ClipboardList className="h-3.5 w-3.5 mr-2" /> Nova Tarefa
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => { setActiveTab("historico"); setShowNewAtividade(true); }}>
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
                  {onDelete && (
                    <DropdownMenuItem className="text-destructive" onClick={() => { /* handled by alert dialog below */ }}>
                      <PhoneOff className="h-3.5 w-3.5 mr-2" /> Contato errado
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
          </div>
        </div>

        {/* ════════════ ZONA 2 — PRÓXIMA AÇÃO (fixo) ════════════ */}
        <div className="shrink-0 border-b border-border/50 bg-accent/20 px-4 py-3 space-y-2">
          <div className="flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5 text-primary" />
            <span className="text-[11px] font-bold text-foreground uppercase tracking-wide">Próxima Ação</span>
            {lead.proxima_acao && lead.data_proxima_acao && (
              <span className="text-[10px] text-muted-foreground ml-auto">
                {format(new Date(lead.data_proxima_acao + "T00:00:00"), "dd/MM", { locale: ptBR })}
              </span>
            )}
          </div>

          {/* Quick action chips */}
          <div className="flex flex-wrap gap-1">
            {[
              { label: "Ligar", icon: "📞" },
              { label: "Enviar material", icon: "📄" },
              { label: "Marcar visita", icon: "🏠" },
              { label: "Enviar proposta", icon: "💰" },
              { label: "Follow-up WhatsApp", icon: "💬" },
              { label: "Confirmar visita", icon: "✅" },
              { label: "Retornar cliente", icon: "🔄" },
              { label: "Enviar localização", icon: "📍" },
            ].map(action => (
              <button
                key={action.label}
                onClick={() => setProximaAcao(action.label)}
                className={`text-[10px] px-2 py-0.5 rounded-md border transition-colors ${
                  proximaAcao === action.label
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-foreground border-border hover:bg-accent"
                }`}
              >
                {action.icon} {action.label}
              </button>
            ))}
          </div>

          {/* Input + date + save */}
          <div className="flex gap-1.5 items-center">
            <Input className="h-7 text-xs flex-1" value={proximaAcao} onChange={e => setProximaAcao(e.target.value)} placeholder="Ou digite ação personalizada..." />
            <Input type="date" className="h-7 text-xs w-28" value={dataProximaAcao} onChange={e => setDataProximaAcao(e.target.value)} />
            <Button size="sm" className="h-7 text-[11px] px-3" onClick={handleSaveProximaAcao} disabled={saving || !proximaAcao}>
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Salvar"}
            </Button>
          </div>
        </div>

        {/* ════════════ ZONA 3 — CONTEÚDO (4 Abas) ════════════ */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <TabsList className="shrink-0 mx-4 mt-2 bg-muted/50 h-8">
            <TabsTrigger value="inteligencia" className="text-[11px] h-6 data-[state=active]:shadow-sm">
              <Brain className="h-3 w-3 mr-1" /> Inteligência
            </TabsTrigger>
            <TabsTrigger value="historico" className="text-[11px] h-6 data-[state=active]:shadow-sm">
              <History className="h-3 w-3 mr-1" /> Histórico
              {leadData.atividades.length > 0 && <Badge variant="secondary" className="ml-1 h-4 text-[9px] px-1">{leadData.atividades.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="visitas-propostas" className="text-[11px] h-6 data-[state=active]:shadow-sm">
              <MapPin className="h-3 w-3 mr-1" /> Visitas
            </TabsTrigger>
            <TabsTrigger value="tarefas" className="text-[11px] h-6 data-[state=active]:shadow-sm">
              <ClipboardList className="h-3 w-3 mr-1" /> Tarefas
              {pendingTasks > 0 && <Badge variant="secondary" className="ml-1 h-4 text-[9px] px-1">{pendingTasks}</Badge>}
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 min-h-0">
            {/* ===== TAB: INTELIGÊNCIA ===== */}
            <TabsContent value="inteligencia" className="px-4 pb-6 space-y-4 mt-0">
              {/* Lead intelligence card */}
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
                <h4 className="text-[11px] font-bold text-primary flex items-center gap-1.5">
                  <Brain className="h-3.5 w-3.5" /> Inteligência do Lead
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  <InsightItem icon={Timer} label="Sem contato" value={lastActivity ? formatDistanceToNow(new Date(lastActivity.created_at), { locale: ptBR }) : "Nenhum"} alert={!lastActivity || differenceInHours(new Date(), new Date(lastActivity.created_at)) > 48} />
                  <InsightItem icon={PhoneCall} label="Tentativas" value={`${leadData.atividades.length}`} />
                  <InsightItem icon={Clock} label="Nesta etapa" value={hoursInStage < 24 ? `${hoursInStage}h` : `${Math.round(hoursInStage / 24)}d`} alert={hoursInStage > 72} />
                  <InsightItem icon={AlertTriangle} label="Atrasadas" value={overdueTasks > 0 ? `${overdueTasks}` : "0"} alert={overdueTasks > 0} />
                </div>
                {hoursInStage > 48 && !lastActivity && (
                  <p className="text-[10px] text-amber-600 bg-amber-50 dark:bg-amber-950/30 px-2 py-1 rounded flex items-center gap-1">
                    <Zap className="h-3 w-3" /> Faça contato imediato — lead sem interação.
                  </p>
                )}
              </div>

              {/* Sequence Suggestion (compact) */}
              {currentStage && (
                <LeadSequenceSuggestion leadId={lead.id} leadNome={lead.nome} stageType={currentStage.tipo} empreendimento={lead.empreendimento} />
              )}

              {/* Commercial Data (compact grid) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <TrendingUp className="h-3.5 w-3.5" /> Dados Comerciais
                  </h4>
                  <Button variant="ghost" size="sm" className="h-5 text-[10px] text-primary" onClick={() => setEditingCommercial(!editingCommercial)}>
                    {editingCommercial ? "Cancelar" : "Editar"}
                  </Button>
                </div>
                {editingCommercial ? (
                  <div className="space-y-2 border rounded-lg p-3 bg-card">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-[10px]">Objetivo</Label>
                        <Select value={commercialData.objetivo_cliente} onValueChange={v => setCommercialData(p => ({ ...p, objetivo_cliente: v }))}>
                          <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Selecione" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="morar">Morar</SelectItem>
                            <SelectItem value="investir">Investir</SelectItem>
                            <SelectItem value="ambos">Ambos</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-[10px]">Temperatura</Label>
                        <Select value={commercialData.temperatura} onValueChange={v => setCommercialData(p => ({ ...p, temperatura: v }))}>
                          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="quente">🔥 Quente</SelectItem>
                            <SelectItem value="morno">☀️ Morno</SelectItem>
                            <SelectItem value="frio">❄️ Frio</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-[10px]">Pagamento</Label>
                        <Select value={commercialData.forma_pagamento} onValueChange={v => setCommercialData(p => ({ ...p, forma_pagamento: v }))}>
                          <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Selecione" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="financiamento">Financiamento</SelectItem>
                            <SelectItem value="avista">À vista</SelectItem>
                            <SelectItem value="parcelado">Parcelado</SelectItem>
                            <SelectItem value="fgts">FGTS</SelectItem>
                            <SelectItem value="consorcio">Consórcio</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-[10px]">Valor (R$)</Label>
                        <Input type="number" className="h-7 text-xs" value={commercialData.valor_estimado || ""} onChange={e => setCommercialData(p => ({ ...p, valor_estimado: Number(e.target.value) }))} />
                      </div>
                    </div>
                    <div>
                      <Label className="text-[10px]">Bairro / Região</Label>
                      <Input className="h-7 text-xs" value={commercialData.bairro_regiao} onChange={e => setCommercialData(p => ({ ...p, bairro_regiao: e.target.value }))} />
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox checked={commercialData.imovel_troca} onCheckedChange={v => setCommercialData(p => ({ ...p, imovel_troca: !!v }))} />
                      <Label className="text-[10px]">Imóvel na troca</Label>
                    </div>
                    <Button size="sm" className="w-full h-7 text-xs" onClick={handleSaveCommercial} disabled={saving}>
                      {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Salvar"}
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-x-3 gap-y-1 text-[11px]">
                    <DataField label="Empreendimento" value={lead.empreendimento} />
                    <DataField label="Objetivo" value={(lead as any).objetivo_cliente ? ((lead as any).objetivo_cliente === "morar" ? "Morar" : (lead as any).objetivo_cliente === "investir" ? "Investir" : "Ambos") : null} />
                    <DataField label="Valor" value={lead.valor_estimado ? `R$ ${lead.valor_estimado.toLocaleString("pt-BR")}` : null} />
                    <DataField label="Bairro" value={(lead as any).bairro_regiao} />
                    <DataField label="Pagamento" value={(lead as any).forma_pagamento} />
                    <DataField label="Origem" value={lead.origem} />
                  </div>
                )}
              </div>

              {/* Responsabilidade (compact) */}
              <GerenteManagementSection lead={lead} onUpdate={onUpdate} />

              {/* Observações */}
              {lead.observacoes && (
                <p className="text-[11px] text-muted-foreground bg-muted/50 rounded p-2">
                  {lead.observacoes}
                </p>
              )}
            </TabsContent>

            {/* ===== TAB: HISTÓRICO (Atividades + Notas + Timeline) ===== */}
            <TabsContent value="historico" className="px-4 pb-6 space-y-4 mt-0">
              {/* Timeline visual */}
              <div className="relative">
                <div className="absolute left-3 top-0 bottom-0 w-px bg-border" />
                <div className="space-y-0">
                  {buildTimeline(leadData.historico, leadData.atividades, leadData.tarefas, stages, lead).slice(0, 10).map((item, i) => (
                    <div key={i} className="relative flex gap-3 pb-3">
                      <div className={`relative z-10 h-5 w-5 rounded-full flex items-center justify-center shrink-0 ${item.color}`}>
                        <item.icon className="h-2.5 w-2.5" />
                      </div>
                      <div className="pt-0">
                        <p className="text-[11px] font-medium text-foreground">{item.title}</p>
                        {item.description && <p className="text-[10px] text-muted-foreground">{item.description}</p>}
                        <p className="text-[9px] text-muted-foreground/60">{format(new Date(item.date), "dd/MM 'às' HH:mm", { locale: ptBR })}</p>
                      </div>
                    </div>
                  ))}
                  <div className="relative flex gap-3 pb-3">
                    <div className="relative z-10 h-5 w-5 rounded-full flex items-center justify-center shrink-0 bg-green-100 text-green-600">
                      <Plus className="h-2.5 w-2.5" />
                    </div>
                    <div>
                      <p className="text-[11px] font-medium text-foreground">Lead entrou no pipeline</p>
                      <p className="text-[9px] text-muted-foreground/60">{format(new Date(lead.created_at), "dd/MM 'às' HH:mm", { locale: ptBR })}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* + Registrar inline */}
              <div className="border-t border-border/50 pt-3">
                <Button variant="outline" size="sm" className="h-7 text-[11px] gap-1 w-full" onClick={() => setShowNewAtividade(!showNewAtividade)}>
                  <Plus className="h-3 w-3" /> Registrar atividade
                </Button>

                {showNewAtividade && (
                  <div className="border border-primary/30 rounded-lg p-3 space-y-2 bg-primary/5 mt-2">
                    <div className="grid grid-cols-2 gap-2">
                      <Select value={newAtividade.tipo} onValueChange={v => setNewAtividade(p => ({ ...p, tipo: v }))}>
                        <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {ATIVIDADE_TIPOS.map(t => (
                            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input className="h-7 text-xs" value={newAtividade.titulo} onChange={e => setNewAtividade(p => ({ ...p, titulo: e.target.value }))} placeholder="Título" />
                    </div>
                    <div className="flex gap-2">
                      <Input type="date" className="h-7 text-xs flex-1" value={newAtividade.data} onChange={e => setNewAtividade(p => ({ ...p, data: e.target.value }))} />
                      <Input type="time" className="h-7 text-xs w-24" value={newAtividade.hora} onChange={e => setNewAtividade(p => ({ ...p, hora: e.target.value }))} />
                    </div>
                    <Button size="sm" className="w-full h-7 text-xs" onClick={handleAddAtividade} disabled={!newAtividade.titulo}>Salvar</Button>
                  </div>
                )}
              </div>

              {/* Notas (sticky notes) */}
              <div className="border-t border-border/50 pt-3 space-y-2">
                <h5 className="text-[11px] font-bold text-muted-foreground flex items-center gap-1">
                  <StickyNote className="h-3 w-3" /> Notas
                </h5>
                <div className="flex gap-1.5">
                  <Input className="h-7 text-xs flex-1" placeholder="Adicionar nota..." value={newNota} onChange={e => setNewNota(e.target.value)} onKeyDown={e => e.key === "Enter" && handleAddNota()} />
                  <Button size="sm" className="h-7 w-7 p-0" onClick={handleAddNota} disabled={!newNota.trim()}>
                    <Send className="h-3 w-3" />
                  </Button>
                </div>
                {leadData.anotacoes.map(nota => (
                  <div key={nota.id} className={`p-2 rounded-lg border text-xs ${nota.fixada ? "border-amber-300 bg-amber-50/50 dark:bg-amber-950/20" : "border-border/50 bg-card"}`}>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[10px] font-semibold">{nota.autor_nome || "Usuário"}</span>
                      <div className="flex items-center gap-0.5">
                        <span className="text-[9px] text-muted-foreground">{format(new Date(nota.created_at), "dd/MM HH:mm", { locale: ptBR })}</span>
                        <Button variant="ghost" size="sm" className="h-4 w-4 p-0" onClick={() => leadData.toggleFixarAnotacao(nota.id, nota.fixada)}>
                          {nota.fixada ? <PinOff className="h-2.5 w-2.5 text-amber-500" /> : <Pin className="h-2.5 w-2.5 text-muted-foreground" />}
                        </Button>
                      </div>
                    </div>
                    <p className="text-[11px] whitespace-pre-wrap">{nota.conteudo}</p>
                  </div>
                ))}
              </div>
            </TabsContent>

            {/* ===== TAB: VISITAS & PROPOSTAS ===== */}
            <TabsContent value="visitas-propostas" className="px-4 pb-6 space-y-5 mt-0">
              <div>
                <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" /> Visitas
                </h4>
                <OpportunityVisitasTab pipelineLeadId={lead.id} />
              </div>
              <div className="border-t border-border/50 pt-4">
                <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <DollarSign className="h-3.5 w-3.5" /> Propostas
                </h4>
                <OpportunityPropostasTab pipelineLeadId={lead.id} valorEstimado={lead.valor_estimado} corretorNomes={corretorNomes} />
              </div>
            </TabsContent>

            {/* ===== TAB: TAREFAS ===== */}
            <TabsContent value="tarefas" className="px-4 pb-6 space-y-3 mt-0">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-foreground">Tarefas</h4>
                <Button variant="outline" size="sm" className="h-7 text-[11px] gap-1" onClick={() => setShowNewTarefa(!showNewTarefa)}>
                  <Plus className="h-3 w-3" /> Nova
                </Button>
              </div>

              {showNewTarefa && (
                <div className="border border-primary/30 rounded-lg p-3 space-y-2 bg-primary/5">
                  <Input className="h-7 text-xs" placeholder="Ex: Enviar tabela de preços" value={newTarefa.titulo} onChange={e => setNewTarefa(p => ({ ...p, titulo: e.target.value }))} />
                  <div className="grid grid-cols-2 gap-2">
                    <Select value={newTarefa.prioridade} onValueChange={v => setNewTarefa(p => ({ ...p, prioridade: v }))}>
                      <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="alta">Alta</SelectItem>
                        <SelectItem value="media">Média</SelectItem>
                        <SelectItem value="baixa">Baixa</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input type="date" className="h-7 text-xs" value={newTarefa.vence_em} onChange={e => setNewTarefa(p => ({ ...p, vence_em: e.target.value }))} />
                  </div>
                  <Textarea className="text-xs min-h-[40px]" placeholder="Descrição..." value={newTarefa.descricao} onChange={e => setNewTarefa(p => ({ ...p, descricao: e.target.value }))} />
                  <Button size="sm" className="w-full h-7 text-xs" onClick={handleAddTarefa} disabled={!newTarefa.titulo}>Criar Tarefa</Button>
                </div>
              )}

              {/* Overdue tasks first */}
              {leadData.tarefas.length === 0 ? (
                <EmptyState text="Nenhuma tarefa criada" />
              ) : (
                <div className="space-y-1">
                  {[...leadData.tarefas]
                    .sort((a, b) => {
                      // Overdue first, then pending, then done
                      const aOverdue = a.status === "pendente" && a.vence_em && new Date(a.vence_em) < new Date();
                      const bOverdue = b.status === "pendente" && b.vence_em && new Date(b.vence_em) < new Date();
                      if (aOverdue && !bOverdue) return -1;
                      if (!aOverdue && bOverdue) return 1;
                      if (a.status === "pendente" && b.status !== "pendente") return -1;
                      if (a.status !== "pendente" && b.status === "pendente") return 1;
                      return 0;
                    })
                    .map(tarefa => {
                      const isOverdue = tarefa.status === "pendente" && tarefa.vence_em && new Date(tarefa.vence_em) < new Date();
                      return (
                        <div
                          key={tarefa.id}
                          className={`flex items-center gap-2.5 p-2 rounded-lg border transition-colors cursor-pointer ${
                            tarefa.status === "concluida"
                              ? "bg-green-50/50 dark:bg-green-950/20 border-green-200/50"
                              : isOverdue
                              ? "bg-red-50/50 dark:bg-red-950/20 border-red-200/50"
                              : "border-border/50 bg-card hover:bg-accent/20"
                          }`}
                          onClick={() => leadData.toggleTarefa(tarefa.id, tarefa.status)}
                        >
                          {tarefa.status === "concluida" ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                          ) : (
                            <Circle className={`h-3.5 w-3.5 shrink-0 ${isOverdue ? "text-red-400" : "text-muted-foreground"}`} />
                          )}
                          <div className="flex-1 min-w-0">
                            <span className={`text-[11px] font-medium ${tarefa.status === "concluida" ? "line-through text-muted-foreground" : "text-foreground"}`}>
                              {tarefa.titulo}
                            </span>
                            {tarefa.vence_em && (
                              <span className={`text-[9px] ml-1.5 ${isOverdue ? "text-red-500 font-semibold" : "text-muted-foreground"}`}>
                                {isOverdue && "⚠️ "}{format(new Date(tarefa.vence_em), "dd/MM", { locale: ptBR })}
                              </span>
                            )}
                          </div>
                          <Badge variant="outline" className={`text-[8px] h-3.5 ${PRIORIDADE_MAP[tarefa.prioridade]?.color || ""}`}>
                            {PRIORIDADE_MAP[tarefa.prioridade]?.label || tarefa.prioridade}
                          </Badge>
                        </div>
                      );
                    })}
                </div>
              )}
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
      <CentralComunicacao open={comunicacaoOpen} onOpenChange={setComunicacaoOpen} leadId={lead.id} leadNome={lead.nome} leadEmpreendimento={lead.empreendimento} />
    </Sheet>
  );
}

// ===== Sub-components =====

function DataField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="py-0.5">
      <span className="text-[9px] text-muted-foreground">{label}</span>
      <p className="text-[11px] font-medium text-foreground">{value || "—"}</p>
    </div>
  );
}

function InsightItem({ icon: Icon, label, value, alert }: { icon: any; label: string; value: string; alert?: boolean }) {
  return (
    <div className={`flex items-center gap-2 p-1.5 rounded ${alert ? "bg-amber-100/50 dark:bg-amber-950/30" : ""}`}>
      <Icon className={`h-3.5 w-3.5 shrink-0 ${alert ? "text-amber-500" : "text-primary/60"}`} />
      <div>
        <span className="text-[9px] text-muted-foreground">{label}</span>
        <p className={`text-[11px] font-semibold ${alert ? "text-amber-600" : "text-foreground"}`}>{value}</p>
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center py-6 text-center">
      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center mb-1.5">
        <FileText className="h-3.5 w-3.5 text-muted-foreground/40" />
      </div>
      <span className="text-[11px] text-muted-foreground">{text}</span>
    </div>
  );
}

interface TimelineItem {
  title: string;
  description?: string;
  date: string;
  icon: any;
  color: string;
}

function buildTimeline(historico: any[], atividades: any[], tarefas: any[], stages: PipelineStage[], lead: PipelineLead): TimelineItem[] {
  const items: TimelineItem[] = [];

  for (const h of historico) {
    const from = stages.find(s => s.id === h.stage_anterior_id);
    const to = stages.find(s => s.id === h.stage_novo_id);
    items.push({
      title: `Movido para ${to?.nome || "?"}`,
      description: from ? `De: ${from.nome}${h.observacao ? ` • ${h.observacao}` : ""}` : h.observacao || undefined,
      date: h.created_at,
      icon: ArrowRight,
      color: "bg-primary/10 text-primary",
    });
  }

  const tipoLabels: Record<string, string> = {
    ligacao: "📞 Ligação", whatsapp: "💬 WhatsApp", followup: "📨 Follow-up",
    reuniao: "🤝 Reunião", visita: "🏠 Visita", proposta: "📄 Proposta",
    retorno: "🔁 Retorno", pendencia_doc: "📋 Pendência doc",
  };

  for (const a of atividades) {
    const tipoInfo = ATIVIDADE_TIPOS.find(t => t.value === a.tipo);
    items.push({
      title: tipoLabels[a.tipo] || a.titulo,
      description: `${a.titulo} • ${a.status === "concluida" ? "✅" : "⏳"}`,
      date: a.created_at,
      icon: tipoInfo?.icon || PhoneCall,
      color: a.status === "concluida" ? "bg-green-100 text-green-600" : "bg-blue-100 text-blue-600",
    });
  }

  for (const t of tarefas) {
    if (t.status === "concluida" && t.concluida_em) {
      items.push({ title: `✅ ${t.titulo}`, date: t.concluida_em, icon: CheckCircle2, color: "bg-green-100 text-green-600" });
    }
  }

  if (lead.aceito_em) {
    items.push({ title: "✅ Lead aceito", date: lead.aceito_em, icon: CheckCircle2, color: "bg-emerald-100 text-emerald-600" });
  }
  if (lead.distribuido_em) {
    items.push({ title: "🔄 Lead distribuído", date: lead.distribuido_em, icon: ArrowRight, color: "bg-blue-100 text-blue-600" });
  }

  items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return items;
}
