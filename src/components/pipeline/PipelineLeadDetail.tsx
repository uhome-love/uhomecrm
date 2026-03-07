import { useState, useMemo } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { PipelineLead, PipelineStage, PipelineSegmento } from "@/hooks/usePipeline";
import { usePipelineLeadData } from "@/hooks/usePipelineLeadData";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import {
  Phone, Mail, MessageSquare, Calendar, MapPin, ArrowRight, Loader2,
  Clock, User, Building2, Target, Thermometer, DollarSign,
  Plus, Pin, PinOff, CheckCircle2, Circle, AlertTriangle,
  FileText, Send, PhoneCall, Video, ChevronRight,
  Flame, Snowflake, Sun, Zap, ClipboardList, StickyNote,
  History, Brain, TrendingUp, AlertCircle, Timer,
  Trash2, Ban, PhoneOff
} from "lucide-react";
import { format, formatDistanceToNow, differenceInHours, differenceInDays, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  lead: PipelineLead;
  stages: PipelineStage[];
  segmentos: PipelineSegmento[];
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

export default function PipelineLeadDetail({ lead, stages, segmentos, open, onOpenChange, onUpdate, onMove, onDelete }: Props) {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const leadData = usePipelineLeadData(open ? lead.id : null);
  const [activeTab, setActiveTab] = useState("resumo");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
  const [moveStageId, setMoveStageId] = useState("");
  const [moveObs, setMoveObs] = useState("");

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

  const handleMoveStage = async () => {
    if (!moveStageId) return;
    await onMove(lead.id, moveStageId, moveObs || undefined);
    setMoveStageId("");
    setMoveObs("");
  };

  const whatsappUrl = lead.telefone ? `https://wa.me/${lead.telefone.replace(/\D/g, "")}` : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl p-0 flex flex-col overflow-hidden border-l border-border/50">
        {/* ========== HEADER ========== */}
        <div className="shrink-0 bg-gradient-to-br from-card via-card to-accent/30 border-b border-border/50">
          <div className="px-5 pt-5 pb-3">
            {/* Name + Stage */}
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-foreground truncate">{lead.nome}</h2>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <Badge className="text-[10px] font-semibold" style={{ backgroundColor: currentStage?.cor + "22", color: currentStage?.cor, borderColor: currentStage?.cor + "44" }}>
                    <div className="h-1.5 w-1.5 rounded-full mr-1" style={{ backgroundColor: currentStage?.cor }} />
                    {currentStage?.nome}
                  </Badge>
                  {segmento && (
                    <Badge variant="outline" className="text-[10px]" style={{ borderColor: segmento.cor, color: segmento.cor }}>
                      {segmento.nome}
                    </Badge>
                  )}
                  <Badge variant="outline" className={`text-[10px] gap-1 ${temperatureInfo.color}`}>
                    <TempIcon className="h-3 w-3" />
                    {temperatureInfo.label}
                  </Badge>
                </div>
              </div>
              <div className="text-right shrink-0">
                <span className="text-[10px] text-muted-foreground">No funil há</span>
                <p className="text-sm font-bold text-foreground">{daysSinceCreation}d</p>
              </div>
            </div>

            {/* Meta row */}
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
              {lead.origem && (
                <span className="flex items-center gap-1">
                  <Target className="h-3 w-3" />
                  {lead.origem}
                </span>
              )}
              {lead.empreendimento && (
                <span className="flex items-center gap-1">
                  <Building2 className="h-3 w-3" />
                  {lead.empreendimento}
                </span>
              )}
              {lead.valor_estimado ? (
                <span className="flex items-center gap-1 text-primary font-semibold">
                  <DollarSign className="h-3 w-3" />
                  R$ {lead.valor_estimado.toLocaleString("pt-BR")}
                </span>
              ) : null}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-1.5 px-5 pb-3 overflow-x-auto scrollbar-none">
            {lead.telefone && (
              <a href={`tel:${lead.telefone}`}>
                <Button variant="outline" size="sm" className="h-7 text-[11px] gap-1.5 rounded-full border-border/60 hover:border-primary hover:text-primary">
                  <Phone className="h-3 w-3" /> Ligar
                </Button>
              </a>
            )}
            {whatsappUrl && (
              <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm" className="h-7 text-[11px] gap-1.5 rounded-full border-green-300 text-green-600 hover:bg-green-50">
                  <MessageSquare className="h-3 w-3" /> WhatsApp
                </Button>
              </a>
            )}
            {lead.email && (
              <a href={`mailto:${lead.email}`}>
                <Button variant="outline" size="sm" className="h-7 text-[11px] gap-1.5 rounded-full border-border/60 hover:border-primary hover:text-primary">
                  <Mail className="h-3 w-3" /> Email
                </Button>
              </a>
            )}
            <Button variant="outline" size="sm" className="h-7 text-[11px] gap-1.5 rounded-full" onClick={() => { setActiveTab("tarefas"); setShowNewTarefa(true); }}>
              <ClipboardList className="h-3 w-3" /> Tarefa
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-[11px] gap-1.5 rounded-full" onClick={() => { setActiveTab("atividades"); setShowNewAtividade(true); }}>
              <Calendar className="h-3 w-3" /> Atividade
            </Button>
          </div>
        </div>

        {/* ========== TABS ========== */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <TabsList className="shrink-0 mx-5 mt-3 bg-muted/50 h-8">
            <TabsTrigger value="resumo" className="text-[11px] h-6 data-[state=active]:shadow-sm">Resumo</TabsTrigger>
            <TabsTrigger value="atividades" className="text-[11px] h-6 data-[state=active]:shadow-sm">
              Atividades
              {leadData.atividades.length > 0 && <Badge variant="secondary" className="ml-1 h-4 text-[9px] px-1">{leadData.atividades.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="tarefas" className="text-[11px] h-6 data-[state=active]:shadow-sm">
              Tarefas
              {pendingTasks > 0 && <Badge variant="secondary" className="ml-1 h-4 text-[9px] px-1">{pendingTasks}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="notas" className="text-[11px] h-6 data-[state=active]:shadow-sm">Notas</TabsTrigger>
            <TabsTrigger value="historico" className="text-[11px] h-6 data-[state=active]:shadow-sm">Timeline</TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 min-h-0">
            {/* ===== TAB: RESUMO ===== */}
            <TabsContent value="resumo" className="px-5 pb-6 space-y-5 mt-0">
              {/* Insights Card */}
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
                <h4 className="text-[11px] font-bold text-primary flex items-center gap-1.5">
                  <Brain className="h-3.5 w-3.5" /> Inteligência do Lead
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  <InsightItem
                    icon={Timer}
                    label="Tempo sem contato"
                    value={lastActivity ? formatDistanceToNow(new Date(lastActivity.created_at), { locale: ptBR }) : "Nenhum contato"}
                    alert={!lastActivity || differenceInHours(new Date(), new Date(lastActivity.created_at)) > 48}
                  />
                  <InsightItem
                    icon={PhoneCall}
                    label="Tentativas"
                    value={`${leadData.atividades.length} atividades`}
                  />
                  <InsightItem
                    icon={Clock}
                    label="Nesta etapa há"
                    value={hoursInStage < 24 ? `${hoursInStage}h` : `${Math.round(hoursInStage / 24)}d`}
                    alert={hoursInStage > 72}
                  />
                  <InsightItem
                    icon={AlertTriangle}
                    label="Tarefas atrasadas"
                    value={overdueTasks > 0 ? `${overdueTasks} atrasada${overdueTasks > 1 ? "s" : ""}` : "Nenhuma"}
                    alert={overdueTasks > 0}
                  />
                </div>
                {hoursInStage > 48 && !lastActivity && (
                  <p className="text-[10px] text-amber-600 bg-amber-50 dark:bg-amber-950/30 px-2 py-1 rounded flex items-center gap-1">
                    <Zap className="h-3 w-3" />
                    Sugestão: Faça contato imediato — lead sem interação há muito tempo.
                  </p>
                )}
              </div>

              {/* Contact */}
              <Section title="Contato" icon={User}>
                <div className="space-y-1.5">
                  {lead.telefone && (
                    <ContactRow icon={Phone} label="Telefone" value={lead.telefone} href={`tel:${lead.telefone}`} />
                  )}
                  {lead.telefone2 && (
                    <ContactRow icon={Phone} label="Telefone 2" value={lead.telefone2} href={`tel:${lead.telefone2}`} />
                  )}
                  {whatsappUrl && (
                    <ContactRow icon={MessageSquare} label="WhatsApp" value={lead.telefone!} href={whatsappUrl} external />
                  )}
                  {lead.email && (
                    <ContactRow icon={Mail} label="Email" value={lead.email} href={`mailto:${lead.email}`} />
                  )}
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground pt-1">
                    <Calendar className="h-3 w-3" />
                    Criado em {format(new Date(lead.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </div>
                  {lead.observacoes && (
                    <p className="text-[11px] text-muted-foreground bg-muted/50 rounded p-2 mt-2">
                      {lead.observacoes}
                    </p>
                  )}
                </div>
              </Section>

              {/* Commercial Data */}
              <Section title="Dados Comerciais" icon={TrendingUp} action={
                <Button variant="ghost" size="sm" className="h-5 text-[10px] text-primary" onClick={() => setEditingCommercial(!editingCommercial)}>
                  {editingCommercial ? "Cancelar" : "Editar"}
                </Button>
              }>
                {editingCommercial ? (
                  <div className="space-y-2.5">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-[10px]">Objetivo</Label>
                        <Select value={commercialData.objetivo_cliente} onValueChange={v => setCommercialData(p => ({ ...p, objetivo_cliente: v }))}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione" /></SelectTrigger>
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
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="quente">🔥 Quente</SelectItem>
                            <SelectItem value="morno">☀️ Morno</SelectItem>
                            <SelectItem value="frio">❄️ Frio</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <Label className="text-[10px]">Bairro / Região</Label>
                      <Input className="h-8 text-xs" value={commercialData.bairro_regiao} onChange={e => setCommercialData(p => ({ ...p, bairro_regiao: e.target.value }))} placeholder="Ex: Moinhos de Vento" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-[10px]">Forma de pagamento</Label>
                        <Select value={commercialData.forma_pagamento} onValueChange={v => setCommercialData(p => ({ ...p, forma_pagamento: v }))}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="financiamento">Financiamento</SelectItem>
                            <SelectItem value="avista">À vista</SelectItem>
                            <SelectItem value="parcelado">Parcelado direto</SelectItem>
                            <SelectItem value="fgts">FGTS</SelectItem>
                            <SelectItem value="consorcio">Consórcio</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-[10px]">Nível de interesse</Label>
                        <Select value={commercialData.nivel_interesse} onValueChange={v => setCommercialData(p => ({ ...p, nivel_interesse: v }))}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="alto">Alto</SelectItem>
                            <SelectItem value="medio">Médio</SelectItem>
                            <SelectItem value="baixo">Baixo</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <Label className="text-[10px]">Valor estimado (R$)</Label>
                      <Input type="number" className="h-8 text-xs" value={commercialData.valor_estimado || ""} onChange={e => setCommercialData(p => ({ ...p, valor_estimado: Number(e.target.value) }))} />
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox checked={commercialData.imovel_troca} onCheckedChange={v => setCommercialData(p => ({ ...p, imovel_troca: !!v }))} />
                      <Label className="text-[11px]">Possui imóvel na troca</Label>
                    </div>
                    <Button size="sm" className="w-full h-8 text-xs" onClick={handleSaveCommercial} disabled={saving}>
                      {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Salvar Dados Comerciais"}
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                    <DataField label="Empreendimento" value={lead.empreendimento} />
                    <DataField label="Objetivo" value={(lead as any).objetivo_cliente ? ((lead as any).objetivo_cliente === "morar" ? "Morar" : (lead as any).objetivo_cliente === "investir" ? "Investir" : "Ambos") : null} />
                    <DataField label="Valor estimado" value={lead.valor_estimado ? `R$ ${lead.valor_estimado.toLocaleString("pt-BR")}` : null} />
                    <DataField label="Bairro/Região" value={(lead as any).bairro_regiao} />
                    <DataField label="Pagamento" value={(lead as any).forma_pagamento} />
                    <DataField label="Nível interesse" value={(lead as any).nivel_interesse} />
                    <DataField label="Imóvel troca" value={(lead as any).imovel_troca ? "Sim" : "Não"} />
                    <DataField label="Origem" value={lead.origem} />
                  </div>
                )}
              </Section>

              {/* Próxima Ação */}
              <Section title="Próxima Ação" icon={Zap}>
                <div className="space-y-2">
                  <Input className="h-8 text-xs" value={proximaAcao} onChange={e => setProximaAcao(e.target.value)} placeholder="Ex: Ligar para confirmar visita" />
                  <div className="flex gap-2">
                    <Input type="date" className="h-8 text-xs flex-1" value={dataProximaAcao} onChange={e => setDataProximaAcao(e.target.value)} />
                    <Button size="sm" className="h-8 text-xs" onClick={handleSaveProximaAcao} disabled={saving}>
                      Salvar
                    </Button>
                  </div>
                  {lead.proxima_acao && lead.data_proxima_acao && (
                    <div className="flex items-center gap-2 bg-accent/50 rounded-lg p-2">
                      <Zap className="h-4 w-4 text-primary shrink-0" />
                      <div>
                        <p className="text-xs font-semibold text-foreground">{lead.proxima_acao}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {format(new Date(lead.data_proxima_acao), "dd/MM/yyyy", { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </Section>

              {/* Mover Etapa */}
              <Section title="Mover Etapa" icon={ArrowRight}>
                <div className="space-y-2">
                  <Select value={moveStageId} onValueChange={setMoveStageId}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione a etapa" /></SelectTrigger>
                    <SelectContent>
                      {stages.filter(s => s.id !== lead.stage_id).map(s => (
                        <SelectItem key={s.id} value={s.id}>
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full" style={{ backgroundColor: s.cor }} />
                            {s.nome}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {moveStageId && (
                    <>
                      <Textarea className="text-xs min-h-[60px]" placeholder="Observação da movimentação..." value={moveObs} onChange={e => setMoveObs(e.target.value)} />
                      <Button size="sm" className="w-full h-8 text-xs" onClick={handleMoveStage}>
                        <ArrowRight className="h-3 w-3 mr-1.5" />
                        Mover para {stages.find(s => s.id === moveStageId)?.nome}
                      </Button>
                    </>
                  )}
                </div>
              </Section>
            </TabsContent>

            {/* ===== TAB: ATIVIDADES ===== */}
            <TabsContent value="atividades" className="px-5 pb-6 space-y-4 mt-0">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-foreground">Atividades</h4>
                <Button variant="outline" size="sm" className="h-7 text-[11px] gap-1" onClick={() => setShowNewAtividade(!showNewAtividade)}>
                  <Plus className="h-3 w-3" /> Nova
                </Button>
              </div>

              {showNewAtividade && (
                <div className="border border-primary/30 rounded-lg p-3 space-y-2 bg-primary/5">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[10px]">Tipo</Label>
                      <Select value={newAtividade.tipo} onValueChange={v => setNewAtividade(p => ({ ...p, tipo: v }))}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {ATIVIDADE_TIPOS.map(t => (
                            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-[10px]">Prioridade</Label>
                      <Select value={newAtividade.prioridade} onValueChange={v => setNewAtividade(p => ({ ...p, prioridade: v }))}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="alta">Alta</SelectItem>
                          <SelectItem value="media">Média</SelectItem>
                          <SelectItem value="baixa">Baixa</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Input className="h-8 text-xs" placeholder="Título da atividade" value={newAtividade.titulo} onChange={e => setNewAtividade(p => ({ ...p, titulo: e.target.value }))} />
                  <div className="grid grid-cols-2 gap-2">
                    <Input type="date" className="h-8 text-xs" value={newAtividade.data} onChange={e => setNewAtividade(p => ({ ...p, data: e.target.value }))} />
                    <Input type="time" className="h-8 text-xs" value={newAtividade.hora} onChange={e => setNewAtividade(p => ({ ...p, hora: e.target.value }))} />
                  </div>
                  <Textarea className="text-xs min-h-[50px]" placeholder="Descrição..." value={newAtividade.descricao} onChange={e => setNewAtividade(p => ({ ...p, descricao: e.target.value }))} />
                  <Button size="sm" className="w-full h-8 text-xs" onClick={handleAddAtividade} disabled={!newAtividade.titulo}>
                    Registrar Atividade
                  </Button>
                </div>
              )}

              {leadData.atividades.length === 0 ? (
                <EmptyState text="Nenhuma atividade registrada" />
              ) : (
                <div className="space-y-2">
                  {leadData.atividades.map(at => {
                    const tipoInfo = ATIVIDADE_TIPOS.find(t => t.value === at.tipo);
                    const Icon = tipoInfo?.icon || PhoneCall;
                    const prioInfo = PRIORIDADE_MAP[at.prioridade] || PRIORIDADE_MAP.media;
                    return (
                      <div key={at.id} className="flex items-start gap-3 p-2.5 rounded-lg border border-border/50 bg-card hover:bg-accent/20 transition-colors">
                        <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${at.status === "concluida" ? "bg-green-100 text-green-600" : "bg-primary/10 text-primary"}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-foreground truncate">{at.titulo}</span>
                            <Badge variant="outline" className={`text-[9px] h-4 ${prioInfo.color}`}>{prioInfo.label}</Badge>
                          </div>
                          {at.descricao && <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{at.descricao}</p>}
                          <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                            <span>{format(new Date(at.data), "dd/MM", { locale: ptBR })}</span>
                            {at.hora && <span>{at.hora.slice(0, 5)}</span>}
                            <span>• {tipoInfo?.label}</span>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 shrink-0"
                          onClick={() => leadData.updateAtividade(at.id, { status: at.status === "concluida" ? "pendente" : "concluida" })}
                        >
                          {at.status === "concluida" ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            {/* ===== TAB: TAREFAS ===== */}
            <TabsContent value="tarefas" className="px-5 pb-6 space-y-4 mt-0">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-foreground">Tarefas</h4>
                <Button variant="outline" size="sm" className="h-7 text-[11px] gap-1" onClick={() => setShowNewTarefa(!showNewTarefa)}>
                  <Plus className="h-3 w-3" /> Nova
                </Button>
              </div>

              {showNewTarefa && (
                <div className="border border-primary/30 rounded-lg p-3 space-y-2 bg-primary/5">
                  <Input className="h-8 text-xs" placeholder="Ex: Enviar tabela de preços" value={newTarefa.titulo} onChange={e => setNewTarefa(p => ({ ...p, titulo: e.target.value }))} />
                  <div className="grid grid-cols-2 gap-2">
                    <Select value={newTarefa.prioridade} onValueChange={v => setNewTarefa(p => ({ ...p, prioridade: v }))}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="alta">Alta</SelectItem>
                        <SelectItem value="media">Média</SelectItem>
                        <SelectItem value="baixa">Baixa</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input type="date" className="h-8 text-xs" value={newTarefa.vence_em} onChange={e => setNewTarefa(p => ({ ...p, vence_em: e.target.value }))} placeholder="Vencimento" />
                  </div>
                  <Textarea className="text-xs min-h-[40px]" placeholder="Descrição..." value={newTarefa.descricao} onChange={e => setNewTarefa(p => ({ ...p, descricao: e.target.value }))} />
                  <Button size="sm" className="w-full h-8 text-xs" onClick={handleAddTarefa} disabled={!newTarefa.titulo}>
                    Criar Tarefa
                  </Button>
                </div>
              )}

              {leadData.tarefas.length === 0 ? (
                <EmptyState text="Nenhuma tarefa criada" />
              ) : (
                <div className="space-y-1.5">
                  {leadData.tarefas.map(tarefa => {
                    const isOverdue = tarefa.status === "pendente" && tarefa.vence_em && new Date(tarefa.vence_em) < new Date();
                    return (
                      <div
                        key={tarefa.id}
                        className={`flex items-center gap-3 p-2.5 rounded-lg border transition-colors cursor-pointer ${
                          tarefa.status === "concluida"
                            ? "bg-green-50/50 dark:bg-green-950/20 border-green-200/50"
                            : isOverdue
                            ? "bg-red-50/50 dark:bg-red-950/20 border-red-200/50"
                            : "border-border/50 bg-card hover:bg-accent/20"
                        }`}
                        onClick={() => leadData.toggleTarefa(tarefa.id, tarefa.status)}
                      >
                        {tarefa.status === "concluida" ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                        ) : (
                          <Circle className={`h-4 w-4 shrink-0 ${isOverdue ? "text-red-400" : "text-muted-foreground"}`} />
                        )}
                        <div className="flex-1 min-w-0">
                          <span className={`text-xs font-medium ${tarefa.status === "concluida" ? "line-through text-muted-foreground" : "text-foreground"}`}>
                            {tarefa.titulo}
                          </span>
                          {tarefa.vence_em && (
                            <span className={`text-[10px] ml-2 ${isOverdue ? "text-red-500 font-semibold" : "text-muted-foreground"}`}>
                              {isOverdue && "⚠️ "}{format(new Date(tarefa.vence_em), "dd/MM", { locale: ptBR })}
                            </span>
                          )}
                        </div>
                        <Badge variant="outline" className={`text-[9px] h-4 ${PRIORIDADE_MAP[tarefa.prioridade]?.color || ""}`}>
                          {PRIORIDADE_MAP[tarefa.prioridade]?.label || tarefa.prioridade}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            {/* ===== TAB: NOTAS ===== */}
            <TabsContent value="notas" className="px-5 pb-6 space-y-4 mt-0">
              <div className="flex gap-2">
                <Textarea className="text-xs min-h-[60px] flex-1" placeholder="Adicionar anotação..." value={newNota} onChange={e => setNewNota(e.target.value)} />
                <Button size="sm" className="h-auto" onClick={handleAddNota} disabled={!newNota.trim()}>
                  <Send className="h-3.5 w-3.5" />
                </Button>
              </div>

              {leadData.anotacoes.length === 0 ? (
                <EmptyState text="Nenhuma anotação" />
              ) : (
                <div className="space-y-2">
                  {leadData.anotacoes.map(nota => (
                    <div key={nota.id} className={`p-3 rounded-lg border ${nota.fixada ? "border-amber-300 bg-amber-50/50 dark:bg-amber-950/20" : "border-border/50 bg-card"}`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-semibold text-foreground">{nota.autor_nome || "Usuário"}</span>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-muted-foreground">
                            {format(new Date(nota.created_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                          </span>
                          <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => leadData.toggleFixarAnotacao(nota.id, nota.fixada)}>
                            {nota.fixada ? <PinOff className="h-3 w-3 text-amber-500" /> : <Pin className="h-3 w-3 text-muted-foreground" />}
                          </Button>
                        </div>
                      </div>
                      <p className="text-xs text-foreground whitespace-pre-wrap">{nota.conteudo}</p>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* ===== TAB: TIMELINE ===== */}
            <TabsContent value="historico" className="px-5 pb-6 mt-0">
              <div className="relative">
                <div className="absolute left-3 top-0 bottom-0 w-px bg-border" />
                <div className="space-y-0">
                  {/* Combine historico + atividades into timeline */}
                  {buildTimeline(leadData.historico, leadData.atividades, leadData.tarefas, stages, lead).map((item, i) => (
                    <div key={i} className="relative flex gap-3 pb-4">
                      <div className={`relative z-10 h-6 w-6 rounded-full flex items-center justify-center shrink-0 ${item.color}`}>
                        <item.icon className="h-3 w-3" />
                      </div>
                      <div className="pt-0.5">
                        <p className="text-xs font-medium text-foreground">{item.title}</p>
                        {item.description && <p className="text-[10px] text-muted-foreground">{item.description}</p>}
                        <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                          {format(new Date(item.date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                  ))}
                  {/* Entry event */}
                  <div className="relative flex gap-3 pb-4">
                    <div className="relative z-10 h-6 w-6 rounded-full flex items-center justify-center shrink-0 bg-green-100 text-green-600">
                      <Plus className="h-3 w-3" />
                    </div>
                    <div className="pt-0.5">
                      <p className="text-xs font-medium text-foreground">Lead entrou no pipeline</p>
                      <p className="text-[10px] text-muted-foreground">Origem: {lead.origem || "Desconhecida"}</p>
                      <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                        {format(new Date(lead.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

// ===== Sub-components =====

function Section({ title, icon: Icon, children, action }: { title: string; icon: any; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Icon className="h-3.5 w-3.5" />
          {title}
        </h4>
        {action}
      </div>
      {children}
    </div>
  );
}

function ContactRow({ icon: Icon, label, value, href, external }: { icon: any; label: string; value: string; href: string; external?: boolean }) {
  return (
    <a href={href} target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined} className="flex items-center gap-2.5 text-xs text-foreground hover:text-primary transition-colors group">
      <div className="h-7 w-7 rounded-lg bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
        <Icon className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary" />
      </div>
      <div>
        <span className="text-[10px] text-muted-foreground">{label}</span>
        <p className="text-xs font-medium">{value}</p>
      </div>
    </a>
  );
}

function DataField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="py-1">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <p className="text-xs font-medium text-foreground">{value || "—"}</p>
    </div>
  );
}

function InsightItem({ icon: Icon, label, value, alert }: { icon: any; label: string; value: string; alert?: boolean }) {
  return (
    <div className={`flex items-center gap-2 p-1.5 rounded ${alert ? "bg-amber-100/50 dark:bg-amber-950/30" : ""}`}>
      <Icon className={`h-3.5 w-3.5 shrink-0 ${alert ? "text-amber-500" : "text-primary/60"}`} />
      <div>
        <span className="text-[10px] text-muted-foreground">{label}</span>
        <p className={`text-[11px] font-semibold ${alert ? "text-amber-600" : "text-foreground"}`}>{value}</p>
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center py-8 text-center">
      <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center mb-2">
        <FileText className="h-4 w-4 text-muted-foreground/40" />
      </div>
      <span className="text-xs text-muted-foreground">{text}</span>
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

function buildTimeline(
  historico: any[],
  atividades: any[],
  tarefas: any[],
  stages: PipelineStage[],
  lead: PipelineLead
): TimelineItem[] {
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

  for (const a of atividades) {
    const tipoInfo = ATIVIDADE_TIPOS.find(t => t.value === a.tipo);
    items.push({
      title: a.titulo,
      description: `${tipoInfo?.label || a.tipo} • ${a.status === "concluida" ? "Concluída" : "Pendente"}`,
      date: a.created_at,
      icon: tipoInfo?.icon || PhoneCall,
      color: a.status === "concluida" ? "bg-green-100 text-green-600" : "bg-blue-100 text-blue-600",
    });
  }

  for (const t of tarefas) {
    if (t.status === "concluida" && t.concluida_em) {
      items.push({
        title: `Tarefa concluída: ${t.titulo}`,
        date: t.concluida_em,
        icon: CheckCircle2,
        color: "bg-green-100 text-green-600",
      });
    }
  }

  items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return items;
}
