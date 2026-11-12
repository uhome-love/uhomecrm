import { valorCurto } from "@/lib/timelineNarrativa";
import { DISCARD_REASONS_REENGAJAVEL, DISCARD_REASONS_DEFINITIVO, getReasonByCode, reasonDisplay, classifyMotivoText } from "@/lib/discardReasons";
import { assinaturaPrevistaRotulo } from "@/lib/assinaturaPrevista";
import { useState, useMemo, useCallback, useEffect, useLayoutEffect, useRef } from "react";
import "./drawer/refinamentoFicha.css";
import { LeadFormRespostas } from "@/components/pipeline/drawer/LeadFormRespostas";
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
import { useIsMobile } from "@/hooks/use-mobile";
import { useHomi } from "@/contexts/HomiContext";

import {
  Phone, Mail, Calendar, MapPin, Loader2,
  Clock, Building2, Target, DollarSign,
  Plus, CheckCircle2, AlertTriangle, ChevronRight,
  FileText, ChevronDown, ClipboardList, CalendarPlus,
  Flame, Snowflake, Sun, Brain, TrendingUp,
  Trash2, Ban, Handshake, MoreHorizontal, Bot, History, Tag, Search, Pencil, MessageCircle, ExternalLink, Home, Copy
} from "lucide-react";
import DrawerLeadInfo from "./drawer/DrawerLeadInfo";
import CadenciaSemContatoCard from "./CadenciaSemContatoCard";
import { QualificacaoEtapaCard, PerfilLeadCard } from "./QualificacaoChecklistCard";
import { getOrigemLabel } from "./LeadHistoricoTab";
import DrawerTopo from "./drawer/DrawerTopo";
import DrawerAgora from "./drawer/DrawerAgora";
import HomiSugestaoRecolhida from "./drawer/HomiSugestaoRecolhida";
import { UltimoMovimento } from "./drawer/CaminhoDoLead";
import ResumoLeadLateral from "./drawer/ResumoLeadLateral";
import { telefoneForaDoRS } from "@/lib/dddUf";
import { grupoOrigem, rotuloOrigem } from "@/lib/leadOrigemUtils";
import { VISITA_SUBSTATUS, AQUECIMENTO_SUBSTATUS } from "@/lib/leadHelpers";
import DrawerTimeline from "./drawer/DrawerTimeline";
import DrawerEmpreendimento from "./drawer/DrawerEmpreendimento";
import DrawerOrigemLead from "./drawer/DrawerOrigemLead";
import DrawerAnotarDialog from "./drawer/DrawerAnotarDialog";
import RegistrarAtividadeModal from "./RegistrarAtividadeModal";
import { Zap } from "lucide-react";
import PartnershipDialog from "./PartnershipDialog";
import LeadSequenceSuggestion from "./LeadSequenceSuggestion";
import HomiLeadAssistant from "./HomiLeadAssistant";
import CentralComunicacao from "@/components/comunicacao/CentralComunicacao";
import OpportunityVisitasTab from "./OpportunityVisitasTab";
import OpportunityPropostasTab from "./OpportunityPropostasTab";
import LeadTarefasTab from "./LeadTarefasTab";
import LeadHistoricoTab from "./LeadHistoricoTab";
import { leadSaude, diasSemToque, diasCalendarioSemToque, prazoDaEtapa } from "@/lib/leadSaude";
import DrawerTasksTab from "./drawer/DrawerTasksTab";
import DrawerVisitsTab from "./drawer/DrawerVisitsTab";
import DrawerNegocioTab from "./drawer/DrawerNegocioTab";
import { ConfirmarVendaForm } from "@/components/vendas/ConfirmarVendaForm";
import WhatsAppTemplatesDialog from "./WhatsAppTemplatesDialog";

import NextActionModal from "./NextActionModal";
import VisitaForm from "@/components/visitas/VisitaForm";
import { useVisitas } from "@/hooks/useVisitas";
import CardOverflowMenu from "./CardOverflowMenu";
import EmpreendimentoCombobox from "@/components/ui/empreendimento-combobox";
import LeadImoveisIndicadosTab from "./LeadImoveisIndicadosTab";
import StageCoachBar from "./StageCoachBar";
import LeadFlagControls from "./LeadFlagControls";
import { CallFocusOverlay } from "./CallFocusOverlay";
import WhatsAppFocusFlow from "./WhatsAppFocusFlow";
import PipelineStageTransitionPopup, { needsTransitionPopup } from "./PipelineStageTransitionPopup";
// RadarImoveisTab e LeadWhatsAppTab removidos (Pipeline v2 Fase 4)
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { differenceInDaysSafe, differenceInHoursSafe, formatDateSafe, formatDistanceToNowSafe, parseDateBRTSafe } from "@/lib/utils";
import { getScoreTemperature } from "@/lib/scoreTemperatureLabels";
import { trackPipelineEvent } from "@/lib/pipelineTelemetry";
import { useJornadaNegocio } from "@/hooks/useJornadaNegocio";
import { useProfileNames } from "@/hooks/useProfileNames";
import { valorSugerido } from "@/lib/jornadaNegocio";
import { substatusValueLabel } from "@/lib/pipelineAudit";
import { diasCalendarioBRT } from "@/lib/diasCalendarioBRT";
import { Skeleton } from "@/components/ui/skeleton";

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
  etapaSugerida?: string;
}

// TEMPERATURA_MAP removido — substituído por chip de status Atualizado/Desatualizado

// Mapa grupo do PDN → nome do stage ativo no board do pipeline
const PDN_GRUPO_STAGE_NOME: Record<string, string> = {
  pos_visita: "Pós-Visita",
  em_negociacao: "Proposta",
  contrato: "Contrato",
  ganho: "Ganho",
};
const PDN_GRUPO_LABEL: Record<string, string> = {
  pos_visita: "Pós-Visita",
  em_negociacao: "Proposta",
  contrato: "Contrato",
  ganho: "Ganho",
};

function tempoDesde(iso?: string | null): string {
  const ms = iso ? Date.now() - new Date(iso).getTime() : NaN;
  if (!Number.isFinite(ms) || ms < 0) return "pouco tempo";
  const min = Math.floor(ms / 60000);
  if (min < 60) return `${Math.max(min, 1)} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h`;
  const d = Math.floor(h / 24);
  return `${d} ${d === 1 ? "dia" : "dias"}`;
}

export default function PipelineLeadDetail({ lead: leadProp, stages, segmentos, corretorNomes = {}, open, onOpenChange, onUpdate, onMove, onDelete, etapaSugerida }: Props) {
  const [confirmedLead, setConfirmedLead] = useState<PipelineLead | null>(null);
  const lead = confirmedLead?.id === leadProp.id ? confirmedLead : leadProp;
  useEffect(() => {
    setConfirmedLead(current => {
      if (!current || current.id !== leadProp.id) return null;
      const fresh = Date.parse(leadProp.updated_at ?? "");
      const confirmed = Date.parse(current.updated_at ?? "");
      return Number.isFinite(fresh) && Number.isFinite(confirmed) && fresh >= confirmed ? null : current;
    });
  }, [leadProp.id, leadProp.stage_id, leadProp.updated_at]);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { isAdmin } = useUserRole();
  const leadData = usePipelineLeadData(open ? lead.id : null);
  const jornadaFicha = useJornadaNegocio(open && lead.negocio_id ? lead.id : "");
  const nomesFicha = useProfileNames();
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState<string>(() => (isMobile ? "info" : "historico"));
  const abasRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const abas = abasRef.current;
    if (!abas) return;
    const medir = () => {
      const ativa = abas.querySelector<HTMLElement>('[role="tab"][data-state="active"]');
      if (!ativa) return;
      abas.style.setProperty("--tab-left", `${ativa.offsetLeft}px`);
      abas.style.setProperty("--tab-width", `${ativa.offsetWidth}px`);
    };
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(abas);
    abas.querySelectorAll('[role="tab"]').forEach(aba => observador.observe(aba));
    return () => observador.disconnect();
  }, [activeTab, lead.id, isMobile, open]);
  useEffect(() => {
    setActiveTab(isMobile ? "info" : "historico");
  }, [lead.id, isMobile]);

  const { setLauncherHidden } = useHomi();
  // Hide the global floating HOMI launcher while the fullscreen lead drawer is open on mobile,
  // so it doesn't overlap the fixed bottom action bar.
  useEffect(() => {
    if (isMobile && open) {
      setLauncherHidden(true);
      return () => setLauncherHidden(false);
    }
  }, [isMobile, open, setLauncherHidden]);

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
  const [transitionTarget, setTransitionTarget] = useState<PipelineStage | null>(null);
  const [confirmarVendaOpen, setConfirmarVendaOpen] = useState(false);
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
  const [autoCompleteTaskId, setAutoCompleteTaskId] = useState<string | null>(null);
  const [scheduleVisitOpen, setScheduleVisitOpen] = useState(false);
  const { createVisita } = useVisitas();
  const [isCallOpen, setIsCallOpen] = useState(false);
  const [callScriptRecolhido, setCallScriptRecolhido] = useState(false);
  const [perguntarTarefa, setPerguntarTarefa] = useState(false);
  // Celular: abre o discador do telefone; ao voltar ao app, abre "Como foi a ligação?".
  const discarRef = useRef<{ saiu: boolean; timer?: number } | null>(null);
  useEffect(() => {
    const abrirResultado = () => {
      const d = discarRef.current;
      if (!d) return;
      if (d.timer) window.clearTimeout(d.timer);
      discarRef.current = null;
      setCallScriptRecolhido(true);
      setIsCallOpen(true);
    };
    const onVis = () => {
      const d = discarRef.current;
      if (!d) return;
      if (document.visibilityState === "hidden") d.saiu = true;
      else if (d.saiu) abrirResultado();
    };
    const onBlur = () => { if (discarRef.current) discarRef.current.saiu = true; };
    const onFocus = () => { if (discarRef.current?.saiu) abrirResultado(); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      if (discarRef.current?.timer) window.clearTimeout(discarRef.current.timer);
    };
  }, []);
  const iniciarLigacao = () => {
    if (!lead.telefone) return;
    if (!isMobile) { setCallScriptRecolhido(false); setIsCallOpen(true); return; }
    const timer = window.setTimeout(() => {
      // Se o discador não abriu (app não saiu de foco), mostra o registro mesmo assim.
      if (discarRef.current && !discarRef.current.saiu) { discarRef.current = null; setCallScriptRecolhido(true); setIsCallOpen(true); }
    }, 4000);
    discarRef.current = { saiu: false, timer };
    window.location.href = `tel:${lead.telefone.replace(/[^\d+]/g, "")}`;
  };
  const [anotarOpen, setAnotarOpen] = useState(false);
  const [registroInicial, setRegistroInicial] = useState<{ tipo?: string; texto: string } | null>(null);
  const [registrarOpen, setRegistrarOpen] = useState(false);

  // Etapa desligada (ex.: Caiu) não vem na lista do quadro: busca só nome/tipo para exibir.
  const [etapaForaDaLista, setEtapaForaDaLista] = useState<{ id: string; nome: string; tipo: string } | null>(null);
  const etapaNaLista = stages.find(s => s.id === lead.stage_id);
  useEffect(() => {
    if (etapaNaLista || !lead.stage_id) { setEtapaForaDaLista(null); return; }
    let cancel = false;
    void supabase.from("pipeline_stages").select("id, nome, tipo").eq("id", lead.stage_id).maybeSingle()
      .then(({ data }) => { if (!cancel) setEtapaForaDaLista((data as { id: string; nome: string; tipo: string } | null) ?? null); });
    return () => { cancel = true; };
  }, [etapaNaLista, lead.stage_id]);
  const currentStage = etapaNaLista ?? (etapaForaDaLista as unknown as typeof etapaNaLista);
  const segmento = segmentos.find(s => s.id === lead.segmento_id);

  // Sugestão de etapa vinda do aviso do gestor (PDN)
  const stageSugerido = useMemo(() => {
    if (!etapaSugerida) return null;
    const nome = PDN_GRUPO_STAGE_NOME[etapaSugerida];
    if (!nome) return null;
    const s = stages.find(st => st.nome === nome);
    if (!s || s.id === lead.stage_id) return null;
    return s;
  }, [etapaSugerida, stages, lead.stage_id]);
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

  const pendingTasksList = useMemo(
    () => leadData.tarefas.filter(t => t.status === "pendente"),
    [leadData.tarefas],
  );
  const nextTask = useMemo(() => {
    const pending = [...pendingTasksList];
    pending.sort((a, b) => {
      const aTime = parseDateBRTSafe(a.vence_em)?.getTime() ?? Number.POSITIVE_INFINITY;
      const bTime = parseDateBRTSafe(b.vence_em)?.getTime() ?? Number.POSITIVE_INFINITY;
      return aTime - bTime;
    });
    return pending[0] || null;
  }, [pendingTasksList]);

  const handleSaveCommercial = async () => {
    setSaving(true);
    try {
      await onUpdate(lead.id, commercialData as any);
      setEditingCommercial(false);
    } finally { setSaving(false); }
  };

  // Troca de etapa pelo modal (dropdown, atalho, sugestão). Nova Gestão v2:
  // se a etapa pede observação, abre o MESMO popup do quadro (obrigatório),
  // pra a história nunca nascer vazia. Senão, move direto.
  // Troca de etapa pelo modal (dropdown, atalho, sugestão): abre o MESMO popup
  // obrigatório do quadro (rico p/ etapa crítica, nota rápida p/ processo).
  const handleMoveStage = async (stageId: string) => {
    if (stageId === lead.stage_id) return;
    const alvo = stages.find((s) => s.id === stageId);
    if (alvo && needsTransitionPopup(alvo.nome, alvo.tipo, lead)) {
      setTransitionTarget(alvo);
      return;
    }
    await onMove(lead.id, stageId, moveObs || undefined);
    setMoveObs("");
  };

  const handleInativar = useCallback(async () => {
    if (!inativarMotivo) { toast.error("Selecione um motivo"); return; }
    if (!tipoDescarte) { toast.error("Selecione o tipo de descarte"); return; }
    setInativando(true);
    try {
      const { buildMotivoDescarte } = await import("@/lib/leadOutcome");
      const reason = getReasonByCode(inativarMotivo);
      const labelRaw = inativarMotivo === "outro"
        ? (inativarObs.trim() || "Outro motivo")
        : (reason?.label || inativarMotivo);
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
            motivo_descarte_code: inativarMotivo,
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
            motivo_descarte_code: inativarMotivo,
            tipo_descarte: "reengajavel",

          })
          .eq("id", lead.id);
        if (error) throw error;

        // Histórico (best-effort, não bloqueia o descarte — mas registra a falha
        // no console em vez de sumir silenciosamente, p/ o rastro de auditoria
        // não se perder sem ninguém saber).
        try {
          await supabase.from("pipeline_historico").insert({
            pipeline_lead_id: lead.id,
            stage_anterior_id: lead.stage_id,
            stage_novo_id: descarteStage.id,
            movido_por: user?.id ?? null,
            observacao: motivoTexto,
          } as any);
        } catch (histErr) {
          console.error("[descarte] falha ao gravar pipeline_historico:", histErr);
        }
        toast.success("Lead movido para descarte (reengajável)");
      }

      setInativarOpen(false);
      onOpenChange(false);
      // Refresh para o board recarregar e o card sumir/reposicionar
      try { await onUpdate(lead.id, {} as any); } catch (refreshErr) { console.error("[descarte] falha ao atualizar o board:", refreshErr); }
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

  // Lead "vermelho" (crítico): sem contato há muito OU com tarefa vencida.
  // Só nesse estado o aviso de saúde (cadência/estagnação) aparece na coluna.
  const leadCritico = useMemo(() => {
    if (noContactAlert === "critical") return true;
    if (nextTask) {
      const due = parseDateBRTSafe((nextTask as any).vence_em);
      if (due) {
        const hora = (nextTask as any).hora_vencimento as string | null | undefined;
        if (hora && /^\d{2}:\d{2}/.test(hora)) { const [hh, mm] = hora.split(":").map(Number); due.setHours(hh || 0, mm || 0, 0, 0); }
        else { due.setHours(23, 59, 59, 999); }
        if (due.getTime() < Date.now()) return true;
      }
    }
    return false;
  }, [noContactAlert, nextTask]);

  // ─────────────────────────────────────────────────────────────────
  // Conteúdo da coluna esquerda — single source (DRY).
  // Reusado em desktop (DrawerLeadInfo aside) e mobile (tab "Info").
  // ─────────────────────────────────────────────────────────────────
  const situacaoTipos = ["contato_inicial", "busca", "aquecimento", "visita", "pos_visita"];
  const stageTipoAtual = (currentStage as any)?.tipo || "";
  const flagsAtuais = (lead.flag_status as Record<string, string> | null) || {};
  const situacaoLabel = (() => {
    if (stageTipoAtual === "visita" && flagsAtuais.status_visita) return (VISITA_SUBSTATUS.find(o => o.value === flagsAtuais.status_visita)?.label ?? flagsAtuais.status_visita).replace(/^\S+\s/, "");
    if (stageTipoAtual === "aquecimento" && flagsAtuais.prazo) return (AQUECIMENTO_SUBSTATUS.find(o => o.value === flagsAtuais.prazo)?.label ?? "").replace(/^\S+\s/, "");
    return "Situação";
  })();
  const temperaturaAtual = String((lead as any).temperatura || "").toLowerCase();
  const tempMeta: Record<string, { label: string; cls: string }> = {
    quente: { label: "Quente", cls: "bg-muted text-foreground" },
    morno: { label: "Morno", cls: "bg-muted text-foreground" },
    frio: { label: "Frio", cls: "bg-muted text-foreground" },
  };
  const origemTopo = (() => { const g = grupoOrigem(lead.origem); return g === "Outros" && lead.origem ? rotuloOrigem(lead.origem) : g; })();
  const entrouTopo = (() => { const d = lead.created_at ? new Date(lead.created_at) : null; return d && !Number.isNaN(d.getTime()) ? `entrou ${d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" })}` : null; })();
  const metaTopo = [lead.empreendimento || "Sem empreendimento", lead.origem ? origemTopo : null, entrouTopo, lead.corretor_id ? corretorNomes[lead.corretor_id] : null].filter(Boolean) as string[];
  const saudeAgora = (() => {
    const inp = { ultimo_toque_at: lead.ultimo_toque_at, distribuido_em: lead.distribuido_em, aceito_em: (lead as any).aceito_em, created_at: lead.created_at, stage_tipo: currentStage?.tipo, estagnacao_carencia_ate: (lead as any).estagnacao_carencia_ate, tem_acao_futura: lead.tem_acao_futura };
    const cor = leadSaude(inp);
    if (cor === "terminal" || cor === "verde") return null;
    return { dias: diasCalendarioSemToque(inp), prazo: prazoDaEtapa(currentStage?.tipo), critico: cor === "vermelho" || cor === "estagnado" };
  })();
  const tarefaDeEtapaAnterior = (() => {
    const criada = (nextTask as any)?.created_at as string | undefined;
    if (!criada || !lead.stage_changed_at || !currentStage?.nome) return null;
    return new Date(criada).getTime() < new Date(lead.stage_changed_at).getTime()
      ? { etapaAtual: currentStage.nome, trocadaEm: lead.stage_changed_at, etapaAnterior: (() => {
          const ult = [...((leadData.historico ?? []) as { stage_anterior_id: string | null; stage_novo_id: string | null; created_at: string }[])]
            .filter((h) => h.stage_novo_id === lead.stage_id && h.stage_anterior_id && h.stage_anterior_id !== h.stage_novo_id)
            .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
          return ult ? stages.find((s) => s.id === ult.stage_anterior_id)?.nome ?? null : null;
        })() } : null;
  })();
  const tarefaAtrasadaTitulo = (() => {
    const t = nextTask as any;
    if (!t?.vence_em) return null;
    const due = new Date(`${String(t.vence_em).slice(0, 10)}T${t.hora_vencimento ? String(t.hora_vencimento).slice(0, 5) : "23:59"}:00-03:00`);
    return due.getTime() < Date.now() ? (t.titulo || t.descricao || null) : null;
  })();
  const etapaSemVisita = stageTipoAtual === "descarte" || stageTipoAtual === "caiu" || stageTipoAtual === "venda";
  const etapaFinalInfo = (() => {
    if (!["descarte", "caiu", "venda"].includes(stageTipoAtual)) return null;
    const quando = (lead as any).stage_changed_at as string | null | undefined;
    const d = quando ? new Date(quando) : null;
    const MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
    let data = "";
    if (d && !Number.isNaN(d.getTime())) {
      const pt = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "numeric" }).formatToParts(d);
      data = `${pt.find(x => x.type === "day")?.value ?? ""} ${MES[Number(pt.find(x => x.type === "month")?.value ?? "1") - 1]}`;
    }
    const em = data ? ` em ${data}` : "";
    if (stageTipoAtual === "descarte") {
      const r = getReasonByCode((lead as any).motivo_descarte_code) ?? getReasonByCode(classifyMotivoText(lead.motivo_descarte));
      const motivo = r ? reasonDisplay(r) : (lead.motivo_descarte || "").replace(/^Descartado:\s*/i, "").trim();
      return { texto: `Descartado${em}${motivo ? ` · Motivo: ${motivo}` : ""}` };
    }
    if (stageTipoAtual === "caiu") return { texto: `Negócio caiu${em}` };
    const negocio = jornadaFicha.data?.negocio;
    const assinatura = negocio?.data_assinatura;
    const dataAssinatura = assinatura ? parseDateBRTSafe(assinatura) : null;
    const dataVenda = dataAssinatura?.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "short" }).replace(/ de /g, " ").replace(/\./g, "") ?? "";
    const registroAssinatura = negocio?.fase === "ganho" && assinatura ? leadData.historico.find(h => h.stage_novo_id === lead.stage_id && h.stage_anterior_id !== h.stage_novo_id && Math.abs(Date.parse(h.created_at) - Date.parse(lead.stage_changed_at ?? "")) < 60000 && new Date(h.created_at).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }) === dataAssinatura?.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" })) : undefined;
    const autor = registroAssinatura ? nomesFicha[registroAssinatura.movido_por]?.trim().split(/\s+/)[0] : undefined;
    const valorVenda = negocio?.fase === "ganho" ? valorCurto(valorSugerido(negocio)).replace(/ /g, "\u00a0") : "";
    return {
      texto: jornadaFicha.error ? "Não foi possível consultar a venda." : "Venda assinada",
      venda: negocio?.fase === "ganho" ? { valor: valorVenda, data: dataVenda, autor } : undefined,
      link: lead.negocio_id ? { rotulo: "Abrir negócio", onClick: () => setActiveTab("negocio") } : undefined,
      acao: (
        <Button size="sm" variant="ghost" className="self-start h-8 mt-2 px-0 gap-1.5 text-[12.5px] text-muted-foreground hover:bg-transparent hover:text-foreground" onClick={() => {
          const destino = stages.find(s => s.tipo === "qualificacao") || stages.find(s => s.tipo === "novo_lead");
          if (destino) handleMoveStage(destino.id);
        }}>🔄 Reativar lead</Button>
      ),
    };
  })();
  const etapaNegocio = ["documentacao", "proposta", "contrato_gerado"].includes(stageTipoAtual);
  const negocioFicha = jornadaFicha.data?.negocio;
  const contratoRaw = negocioFicha?.jornada && typeof negocioFicha.jornada === "object" && !Array.isArray(negocioFicha.jornada) ? negocioFicha.jornada.contrato : null;
  const contratoRef = contratoRaw && typeof contratoRaw === "object" && !Array.isArray(contratoRaw) ? contratoRaw : null;
  const situacaoFicha = stageTipoAtual === "contrato_gerado" ? negocioFicha?.contrato_situacao : negocioFicha?.proposta_situacao;
  const diasSituacao = contratoRef?.status === situacaoFicha && contratoRef?.etapa_id === lead.stage_id && typeof contratoRef?.desde === "string" ? diasCalendarioBRT(contratoRef.desde) : null;
  const negocioNode = stageTipoAtual !== "venda" && (lead.negocio_id || etapaNegocio) ? (
    <section className="rounded-xl border border-border border-t-2 border-t-primary bg-card p-5 shadow-sm space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-[11px] font-semibold uppercase text-primary">Negócio</p>
        {lead.negocio_id && <Button variant="link" onClick={() => setActiveTab("negocio")} className="h-auto p-0 text-[12px]">Abrir</Button>}
      </div>
      {lead.negocio_id && jornadaFicha.isPending ? <div aria-busy="true" className="space-y-3"><Skeleton className="h-4 w-3/4 motion-reduce:animate-none" /><Skeleton className="h-6 w-1/2 motion-reduce:animate-none" /><Skeleton className="h-9 w-full motion-reduce:animate-none" /></div> : jornadaFicha.error ? <p className="text-[13px] text-muted-foreground">Não foi possível consultar o negócio.</p> : <>
        <p className="text-[13px] leading-relaxed">{currentStage?.nome}{situacaoFicha ? ` · ${substatusValueLabel(stageTipoAtual === "contrato_gerado" ? "status_contrato" : "status_negociacao", situacaoFicha).replace(/^[^\p{L}\p{N}]+/u, "")}` : ""}{diasSituacao != null && diasSituacao >= 0 ? ` há ${diasSituacao} ${diasSituacao === 1 ? "dia" : "dias"}` : ""}</p>
        {negocioFicha && <p className="font-display text-[19px] font-bold whitespace-nowrap tabular-nums">{valorCurto(valorSugerido(negocioFicha)).replace(/ /g, "\u00a0")}</p>}
        {(() => { const j = negocioFicha?.jornada; const prev = j && typeof j === "object" && !Array.isArray(j) && typeof (j as Record<string, unknown>).previsao_assinatura === "string" ? assinaturaPrevistaRotulo((j as Record<string, string>).previsao_assinatura) : null; return prev ? <p className="text-[12.5px] text-muted-foreground">Assinatura prevista: <span className="font-semibold text-foreground">{prev}</span></p> : null; })()}
        {!lead.negocio_id && <p className="text-[13px] text-muted-foreground">Ainda não há proposta</p>}
        {etapaNegocio && <LeadFlagControls bare leadId={lead.id} stageTipo={stageTipoAtual} flagStatus={lead.flag_status as Record<string, string> | null} />}
      </>}
    </section>
  ) : null;
  const acaoTrack = (action: string) => trackPipelineEvent("drawer_action_clicked", { lead_id: lead.id, corretor_id: lead.corretor_id, action });
  const actionsNode = (
    <>
      <Button size="sm" variant="outline" className="h-9 px-3.5 gap-1.5 text-[13px] font-medium" disabled={!lead.telefone} onClick={() => { acaoTrack("ligar"); iniciarLigacao(); }}>
        <Phone className="h-3.5 w-3.5" /> Ligar
      </Button>
      <Button size="sm" variant="outline" className="h-9 px-3.5 gap-1.5 text-[13px] font-medium" disabled={!lead.telefone} onClick={() => { acaoTrack("whatsapp"); setIsWhatsAppFlowOpen(true); }}>
        <MessageCircle className="h-3.5 w-3.5 text-success-700" /> WhatsApp
      </Button>
      {!etapaSemVisita && (
        <Button size="sm" variant={etapaNegocio ? "outline" : "default"} className="h-9 px-3.5 gap-1.5 text-[13px] font-medium" onClick={() => { acaoTrack("agendar_visita"); setScheduleVisitOpen(true); }}>
          <CalendarPlus className="h-3.5 w-3.5" /> Agendar visita
        </Button>
      )}
      <CardOverflowMenu
        lead={lead}
        stages={stages}
        onMoveLead={(leadId, newStageId, observacao) => {
          if (stages.find(s => s.id === newStageId)?.tipo === "venda") { setConfirmarVendaOpen(true); return; }
          onMove(leadId, newStageId, observacao);
        }}
        onOpenDetail={() => { /* já está aberto */ }}
        onRegistrarAtividade={() => setRegistrarOpen(true)}
        onCreateTask={() => { setActiveTab("tarefas"); setNextActionOpen(true); }}
        trigger={
          <button aria-label="Mais ações" className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-input bg-background text-muted-foreground hover:text-foreground hover:bg-muted/50">
            <MoreHorizontal className="h-4 w-4" />
          </button>
        }
      />
    </>
  );
  const headerNode = (
    <DrawerTopo
      nome={lead.nome}
      telefone={lead.telefone}
      email={lead.email}
      meta={[]}
      responsavel={lead.corretor_id ? corretorNomes[lead.corretor_id] : null}
      actions={actionsNode}
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
      localTelefone={telefoneForaDoRS(lead.telefone)}
      metaExtra={<UltimoMovimento historico={leadData.historico as any} stages={etapaForaDaLista ? [...stages, etapaForaDaLista] : stages} currentStageId={lead.stage_id} createdAt={lead.created_at} stageChangedAt={(lead as any).stage_changed_at} />}
      pills={
        <>
          <Popover>
            <PopoverTrigger asChild>
              <button className={`inline-flex items-center gap-1 h-6 rounded-full px-2.5 text-[11.5px] font-semibold shrink-0 cursor-pointer hover:opacity-80 transition-opacity${currentStage?.cor ? "" : " bg-muted text-foreground"}`} style={currentStage?.cor ? { backgroundColor: currentStage.cor + "1f", color: currentStage.cor } : undefined}>
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

          {situacaoTipos.includes(stageTipoAtual) && (
            <Popover>
              <PopoverTrigger asChild>
                <button className={stageTipoAtual === "aquecimento" && !flagsAtuais.prazo
                  ? "inline-flex items-center gap-1 h-6 rounded-full px-2.5 text-[11.5px] font-semibold shrink-0 border border-dashed border-warning-500 bg-warning-500/10 text-warning-700 dark:text-warning-500 hover:bg-warning-500/15"
                  : situacaoLabel === "Situação"
                    ? "inline-flex items-center gap-1 h-6 rounded-full px-2.5 text-[11.5px] font-medium shrink-0 border border-dashed border-border text-muted-foreground hover:bg-muted/60"
                    : "inline-flex items-center gap-1 h-6 rounded-full px-2.5 text-[11.5px] font-semibold shrink-0 bg-muted text-foreground/80 hover:bg-muted/70"}>
                  {stageTipoAtual === "aquecimento" ? (flagsAtuais.prazo ? `Retomar em: ${situacaoLabel}` : "Definir prazo") : situacaoLabel === "Situação" ? "+ situação" : situacaoLabel}
                  <ChevronDown className="h-2.5 w-2.5" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto max-w-sm p-3" align="start">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Situação da etapa</p>
                <LeadFlagControls bare leadId={lead.id} stageTipo={stageTipoAtual} flagStatus={lead.flag_status as Record<string, string> | null} onUpdate={() => leadData.reload()} />
              </PopoverContent>
            </Popover>
          )}

          {tempMeta[temperaturaAtual] && (
            <span className={`inline-flex items-center gap-1 h-6 rounded-full px-2.5 text-[11.5px] font-semibold shrink-0 ${tempMeta[temperaturaAtual].cls}`}><Flame className="h-3 w-3 text-muted-foreground" />{tempMeta[temperaturaAtual].label}</span>
          )}




        </>
      }
    />
  );

  const bodyNode = (
    <>
      {/* Sugestão de etapa do gestor (via aviso do PDN) */}
      {stageSugerido && (
        <div className="mb-3 rounded-lg border border-[#4969FF]/40 bg-[#4969FF]/8 p-3">
          <div className="flex items-start gap-2">
            <span className="text-lg leading-none">📋</span>
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">
                Seu gestor sugeriu atualizar a etapa para{" "}
                <span className="font-semibold" style={{ color: stageSugerido.cor }}>
                  {PDN_GRUPO_LABEL[etapaSugerida!] ?? stageSugerido.nome}
                </span>
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Nada muda no seu pipeline até você aplicar.
              </p>
              <Button
                size="sm"
                className="mt-2"
                onClick={() => handleMoveStage(stageSugerido.id)}
              >
                Aplicar etapa
              </Button>
            </div>
          </div>
        </div>
      )}

      {etapaNegocio && negocioNode}
      <DrawerAgora
        leadId={lead.id}
        nextTask={nextTask as any}
        leadNome={lead.nome}
        proximaAcaoTexto={lead.proxima_acao}
        pendingCount={pendingTasksList.length}
        onComplete={(taskId) => { setActiveTab("tarefas"); setAutoCompleteTaskId(taskId); }}
        onSeeAll={() => setActiveTab("tarefas")}
        onCreateTask={() => setNextActionOpen(true)}
        onRegistrar={() => { acaoTrack("registrar_atividade"); setRegistrarOpen(true); }}
        saude={saudeAgora}
        tarefaDeEtapaAnterior={tarefaDeEtapaAnterior}
        esconderRegistrar={!isMobile}
        etapaFinal={etapaFinalInfo}
        primeiroContato={stageTipoAtual === "novo_lead" && !nextTask ? {
          entrouHa: tempoDesde(lead.created_at),
          atrasado: !!saudeAgora && saudeAgora.dias != null && saudeAgora.dias > 0,
          onLigar: lead.telefone ? () => { acaoTrack("ligar"); iniciarLigacao(); } : undefined,
          onWhatsApp: lead.telefone ? () => { acaoTrack("whatsapp"); setIsWhatsAppFlowOpen(true); } : undefined,
        } : null}
        loading={leadData.loading || (stageTipoAtual === "venda" && !!lead.negocio_id && jornadaFicha.isPending)}
        homi={
          <HomiSugestaoRecolhida
            leadId={lead.id}
            leadNome={lead.nome}
            leadTelefone={lead.telefone}
            empreendimento={lead.empreendimento}
            etapa={currentStage?.nome ?? ""}
            temperatura={(lead as any).temperatura}
            diasSemContato={saudeAgora?.dias ?? null}
            tarefaAtrasada={tarefaAtrasadaTitulo}
            onAbrirHomi={() => setHomiOpen(true)}
          />
        }
      />

      <ResumoLeadLateral lead={lead} esconderOrcamento={stageTipoAtual === "venda"} />

      {!etapaNegocio && negocioNode}

      {/* Celular: "Mais ações" (as ações principais ficam na barra fixa embaixo) */}
      <div className="md:hidden">
        <CardOverflowMenu
          lead={lead}
          stages={stages}
          onMoveLead={(leadId, newStageId, observacao) => {
            if (stages.find(s => s.id === newStageId)?.tipo === "venda") { setConfirmarVendaOpen(true); return; }
            onMove(leadId, newStageId, observacao);
          }}
          onOpenDetail={() => { /* já está aberto */ }}
          onRegistrarAtividade={() => setRegistrarOpen(true)}
          onCreateTask={() => { setActiveTab("tarefas"); setNextActionOpen(true); }}
          trigger={
            <button className="w-full flex items-center justify-center gap-1.5 h-10 rounded-xl border border-border bg-card text-[12px] text-muted-foreground">
              <MoreHorizontal className="h-3.5 w-3.5" /> Mais ações
            </button>
          }
        />
      </div>

      {/* ── AVISO DE SAÚDE — só quando o lead está vermelho/crítico ── */}
      {leadCritico && (
        <>
          <CadenciaSemContatoCard leadId={lead.id} stageTipo={currentStage?.tipo} leadNome={lead.nome} leadEmpreendimento={(lead as any).empreendimento} />
        </>
      )}

      {/* Checklist de Qualificação — só visível quando o lead está na etapa Qualificação */}
      {currentStage?.tipo === "qualificacao" && (
        <>
          <QualificacaoEtapaCard lead={lead} onSaved={() => { onUpdate(lead.id, {} as any); leadData.reload(); }} />
          <PerfilLeadCard lead={lead} onSaved={() => { onUpdate(lead.id, {} as any); leadData.reload(); }} />
        </>
      )}

    </>
  );

  // Dados de consulta (origem, anúncio, formulário) — aba "Dados do lead".
  const dadosNode = (
    <div className="px-4 md:px-6 py-4 space-y-3 max-w-3xl">

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



      {/* Caixa Empreendimento polida (header + 3 métricas) */}
      <DrawerEmpreendimento
        empreendimento={lead.empreendimento}
        meta={(() => {
          const parts: string[] = [];
          const origemInfo = getOrigemLabel(lead.origem);
          if (origemInfo) parts.push(`${origemInfo.emoji} ${origemInfo.label}`);
          else if (lead.origem) parts.push(lead.origem);
          if (lead.campanha) parts.push(lead.campanha);
          else if (lead.formulario) parts.push(lead.formulario);
          return parts.join(" · ") || null;
        })()}
        onEdit={() => { setEmpreendimentoSearch(lead.empreendimento || ""); setEmpreendimentoOpen(true); }}
      />

      {/* Origem do lead — de onde veio, anúncio e formulário */}
      <DrawerOrigemLead
        origem={getOrigemLabel(lead.origem)?.label ?? lead.origem}
        plataforma={lead.plataforma}
        campanha={lead.campanha}
        conjunto={lead.conjunto_anuncio}
        anuncio={lead.anuncio}
        formulario={lead.formulario}
        entrouEm={lead.created_at}
      />




      {/* Imóvel de interesse (leads do site) */}
      {(lead.imovel_codigo || lead.imovel_url) && (
        <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 space-y-1.5">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-primary">
            <Home className="h-3 w-3" />
            Imóvel de interesse
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {lead.imovel_codigo && (
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(lead.imovel_codigo || "");
                  toast.success(`Código ${lead.imovel_codigo} copiado`);
                }}
                className="inline-flex items-center gap-1 text-[11px] font-semibold bg-background border border-border rounded px-2 py-1 hover:bg-muted transition-colors"
                title="Copiar código"
              >
                Cód. {lead.imovel_codigo}
                <Copy className="h-3 w-3 text-muted-foreground" />
              </button>
            )}
            {lead.imovel_url && (
              <a
                href={lead.imovel_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
              >
                Abrir imóvel no site
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>
      )}

      {/* Respostas do formulário do anúncio */}
      <LeadFormRespostas respostas={(lead as any).form_respostas} formulario={lead.formulario} />

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

      {lead.origem_detalhe && !lead.observacoes && lead.origem_detalhe.trim().toLowerCase() !== (lead.empreendimento || "").trim().toLowerCase() && (
        <p className="text-[11px] text-muted-foreground flex items-start gap-1 min-w-0" title={lead.origem_detalhe}>
          <FileText className="h-3 w-3 shrink-0 mt-0.5" />
          <span className="line-clamp-2 min-w-0 break-words">{lead.origem_detalhe}</span>
        </p>
      )}

      {/* Apagar (CEO) — admin only, discreto no fim dos dados */}
      {isAdmin && onDelete && (
        <div className="pt-2 flex justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-[11px] text-destructive/70 hover:text-destructive hover:bg-destructive/5 transition-colors">
                <Trash2 className="h-3 w-3" /> Ações admin
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem className="text-destructive" onClick={async () => { setDeleting(true); await onDelete(lead.id); setDeleting(false); onOpenChange(false); }}>
                <Trash2 className="h-3.5 w-3.5 mr-2" /> Apagar lead (CEO)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );

  return (

    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent onOpenAutoFocus={(e) => { e.preventDefault(); document.querySelector<HTMLElement>("[data-lead-titulo]")?.focus({ preventScroll: true }); }} className="lead-detail-sheet inset-y-0 right-0 h-full w-full max-w-none md:w-full min-[1100px]:w-[70vw] md:max-w-[2000px] p-0 gap-0 pt-[env(safe-area-inset-top)] md:pt-0 flex flex-col overflow-hidden border-l border-border/50 max-h-[100dvh]">
        <ErrorBoundary fallback={
          <div className="flex flex-col items-center justify-center py-12 gap-3 px-6">
            <span className="text-destructive font-semibold">Erro ao carregar detalhes do lead</span>
            <span className="text-sm text-muted-foreground text-center">Ocorreu um erro inesperado. Feche e tente abrir novamente.</span>
            <button onClick={() => onOpenChange(false)} className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm">Fechar</button>
          </div>
        }>

        {/* ════════════ LAYOUT 2 COLUNAS (Drawer wide v3) ════════════ */}
        <div className="shrink-0 border-b border-border/60 bg-card px-4 md:px-6 pt-4 md:pt-4 pb-3 md:pb-3 pr-12 md:pr-16">
          {headerNode}
        </div>
        <div className="flex-1 flex min-h-0 overflow-hidden">
        <DrawerLeadInfo resetKey={lead.id}>
          {bodyNode}
        </DrawerLeadInfo>


        <DrawerTimeline>
        {/* ════════════ ABAS (col direita) ════════════ */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <div className="shrink-0 px-4 md:px-7 pt-2 md:pt-3 flex items-center gap-2 border-b border-border/60">
            <TabsList ref={abasRef} onScroll={(e) => { const el = e.currentTarget; el.dataset.fim = String(el.scrollLeft + el.clientWidth >= el.scrollWidth - 4); }} data-fim="false" className="lead-tabs bg-transparent rounded-none p-0 h-11 flex-1 flex justify-start gap-1 md:gap-4 overflow-x-auto scrollbar-none max-md:pr-6 max-md:[mask-image:linear-gradient(to_right,black_85%,transparent)] max-md:data-[fim=true]:[mask-image:none]">
              {isMobile && (
                <TabsTrigger value="info" className="text-[13.5px] font-medium h-11 px-1.5 flex-none min-w-0 rounded-none shrink-0 gap-1 border-b-2 border-transparent text-muted-foreground data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">
                  Agora
                </TabsTrigger>
              )}
              <TabsTrigger value="historico" className="text-[13.5px] font-medium h-11 px-1.5 flex-none min-w-0 rounded-none shrink-0 gap-1 border-b-2 border-transparent text-muted-foreground data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">
                <span className="md:hidden">Histórico</span><span className="hidden md:inline">Linha do tempo</span>
              </TabsTrigger>
              <TabsTrigger value="tarefas" className="text-[13.5px] font-medium h-11 px-1.5 flex-none min-w-0 rounded-none shrink-0 gap-1 border-b-2 border-transparent text-muted-foreground data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">
                Tarefas
                {pendingTasks > 0 && <Badge variant="secondary" className="h-5 rounded-full text-[10.5px] px-1.5 ml-0.5">{pendingTasks}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="visitas" className="text-[13.5px] font-medium h-11 px-1.5 flex-none min-w-0 rounded-none shrink-0 gap-1 border-b-2 border-transparent text-muted-foreground data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">
                Visitas
              </TabsTrigger>
              <TabsTrigger value="dados" className="text-[13.5px] font-medium h-11 px-1.5 flex-none min-w-0 rounded-none shrink-0 gap-1 border-b-2 border-transparent text-muted-foreground data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">
                <span className="md:hidden">Dados</span><span className="hidden md:inline">Dados do lead</span>
              </TabsTrigger>
              {lead.negocio_id && (
                <TabsTrigger value="negocio" className="text-[13.5px] font-medium h-11 px-1.5 flex-none min-w-0 rounded-none shrink-0 gap-1 border-b-2 border-transparent text-muted-foreground data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">
                  Negócio
                </TabsTrigger>
              )}
            </TabsList>


          </div>

          {/* Tabs Radar (Match) e WhatsApp removidas em Pipeline v2 — Fase 4:
              - "Match" não era usado pelos corretores (enquete 23/05/2026).
              - WhatsApp passa a abrir SEMPRE em /whatsapp via WhatsAppFocusFlow, não como tab embarcada. */}

          <ScrollArea className="flex-1 min-h-0">
            {/* ===== TAB: INFO (mobile only) — espelha conteúdo da coluna esquerda ===== */}
            {isMobile && (
              <TabsContent value="info" className="mt-0">
                <div className="px-4 py-4 space-y-4">{bodyNode}</div>
              </TabsContent>
            )}
            {/* ===== TAB: TAREFAS (v4 editorial) ===== */}
            <TabsContent value="tarefas" className="mt-0">

              <DrawerTasksTab
                tarefas={leadData.tarefas}
                loading={leadData.loading}
                leadId={lead.id}
                leadNome={lead.nome}
                leadStageId={lead.stage_id ?? null}
                stageTipo={currentStage?.tipo ?? null}
                onAddTarefa={leadData.addTarefa}
                onToggleTarefa={leadData.toggleTarefa}
                onDeleteTarefa={leadData.deleteTarefa}
                onReload={leadData.reload}
                onNovaTarefa={() => setNextActionOpen(true)}
                autoCompleteTaskId={autoCompleteTaskId}
                onAutoCompleteConsumed={() => setAutoCompleteTaskId(null)}
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
                visitaEventos={leadData.visitaEventos}
                temLiaConversa={leadData.temLiaConversa}
                loading={leadData.loading}
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
                onRegistrar={(d) => { acaoTrack("registro_rapido"); setRegistroInicial({ tipo: d.tipo ?? undefined, texto: d.texto }); setRegistrarOpen(true); }}
              />
            </TabsContent>

            {/* ===== TAB: DADOS DO LEAD ===== */}
            <TabsContent value="dados" className="mt-0">{dadosNode}</TabsContent>

            {/* ===== TAB: VISITAS (v4 editorial) ===== */}
            <TabsContent value="visitas" className="mt-0">
              <DrawerVisitsTab
                pipelineLeadId={lead.id}
                onAgendarVisita={() => setScheduleVisitOpen(true)}
              />
            </TabsContent>



            {/* ===== TAB: NEGÓCIO (Pipeline unificado — Fase 1) ===== */}
            {lead.negocio_id && (
              <TabsContent value="negocio" className="mt-0">
                <DrawerNegocioTab
                  negocioId={lead.negocio_id}
                  pipelineLeadId={lead.id}
                  corretorNome={lead.corretor_id ? corretorNomes[lead.corretor_id] : undefined}
                />
              </TabsContent>
            )}




            {/* Tabs radar/whatsapp removidas (Pipeline v2 Fase 4) */}
          </ScrollArea>
        </Tabs>
        </DrawerTimeline>
        </div>

        {/* ════════════ BARRA DE AÇÃO FIXA (mobile) — Histórico/Tarefas/Visitas (aba Info já tem a grade de ações) ════════════ */}
        {isMobile && !homiOpen && (
          <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-t border-border/50 bg-card/95 backdrop-blur-sm pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-[0_-4px_16px_-8px_hsl(var(--foreground)/0.18)] animate-fade-in motion-reduce:animate-none">
            <button
              onClick={() => { trackPipelineEvent("drawer_action_clicked", { lead_id: lead.id, corretor_id: lead.corretor_id, action: "ligar" }); iniciarLigacao(); }}
              disabled={!lead.telefone}
              aria-label="Ligar"
              className="shrink-0 flex items-center justify-center h-11 w-12 rounded-xl border border-border bg-card text-foreground disabled:opacity-40 active:scale-[0.98] transition-transform"
            >
              <Phone className="h-4 w-4" />
            </button>
            <button
              onClick={() => { trackPipelineEvent("drawer_action_clicked", { lead_id: lead.id, corretor_id: lead.corretor_id, action: "whatsapp" }); setIsWhatsAppFlowOpen(true); }}
              disabled={!lead.telefone}
              aria-label="WhatsApp"
              className="shrink-0 flex items-center justify-center h-11 w-12 rounded-xl border border-border bg-card text-success-700 disabled:opacity-40 active:scale-[0.98] transition-transform"
            >
              <MessageCircle className="h-4 w-4" />
            </button>
            {!etapaSemVisita && (
            <button
              onClick={() => { trackPipelineEvent("drawer_action_clicked", { lead_id: lead.id, corretor_id: lead.corretor_id, action: "agendar_visita" }); setScheduleVisitOpen(true); }}
              className={`flex-1 flex items-center justify-center gap-1.5 h-11 rounded-xl font-semibold text-sm active:scale-[0.98] transition-transform ${etapaNegocio ? "border border-input bg-card text-foreground" : "bg-primary text-primary-foreground"}`}
            >
              <CalendarPlus className="h-4 w-4" /> Agendar visita
            </button>
            )}
          </div>
        )}




        {/* ════════════ HOMI SIDE PANEL ════════════ */}
        {homiOpen && (
          <div className={`absolute inset-y-0 right-0 bg-card border-l border-border shadow-xl flex flex-col ${homiInitialPrompt ? "w-full sm:w-[42%] sm:min-w-[380px] sm:max-w-[520px]" : "w-full sm:w-[45%] sm:min-w-[420px] sm:max-w-[520px]"} transition-all duration-200`} style={{ zIndex: 55 /* Z.drawerHomiPanel */ }}>
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
      <Dialog open={confirmarVendaOpen} onOpenChange={setConfirmarVendaOpen}>
        <DialogContent className="sm:max-w-xl max-h-[90dvh] overflow-y-auto">
          {confirmarVendaOpen && <ConfirmarVendaForm leadId={lead.id} nome={lead.nome} empreendimento={lead.empreendimento} valorEstimado={lead.valor_estimado}
            onCancel={() => setConfirmarVendaOpen(false)} onConfirmed={() => { setConfirmarVendaOpen(false); onOpenChange(false); }} />}
        </DialogContent>
      </Dialog>
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
                  {(tipoDescarte === "reengajavel"
                    ? DISCARD_REASONS_REENGAJAVEL
                    : DISCARD_REASONS_DEFINITIVO
                  ).map((r) => (
                    <SelectItem key={r.code} value={r.code}>{reasonDisplay(r)}</SelectItem>
                  ))}
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

      {registrarOpen && (
        <RegistrarAtividadeModal
          lead={{ id: lead.id, nome: lead.nome }}
          tipoInicial={registroInicial?.tipo}
          obsInicial={registroInicial?.texto}
          onClose={() => { setRegistrarOpen(false); setRegistroInicial(null); }}
          onSaved={async () => {
            onUpdate(lead.id, {} as any); leadData.reload();
            // Pergunta se quer criar tarefa — só se o cliente não tiver tarefa pendente.
            const { count } = await supabase.from("pipeline_tarefas")
              .select("id", { count: "exact", head: true })
              .eq("pipeline_lead_id", lead.id).eq("status", "pendente");
            if (!count) setPerguntarTarefa(true);
          }}
        />
      )}

      <Dialog open={perguntarTarefa} onOpenChange={setPerguntarTarefa}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Quer criar uma tarefa?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {lead.nome.split(" ")[0]} está sem tarefa pendente. Crie a próxima para não esquecer o retorno.
          </p>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setPerguntarTarefa(false)}>Agora não</Button>
            <Button onClick={() => { setPerguntarTarefa(false); setActiveTab("tarefas"); setNextActionOpen(true); }}>Criar tarefa</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
        scriptRecolhido={callScriptRecolhido}
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
      {transitionTarget && (
        <PipelineStageTransitionPopup
          open={!!transitionTarget}
          onOpenChange={(v) => { if (!v) setTransitionTarget(null); }}
          lead={lead}
          targetStage={transitionTarget}
          onCancel={() => setTransitionTarget(null)}
          onConfirm={async (r) => {
            if (r.extraData?.vendaConfirmada === true || r.extraData?.jornadaSalva === true) {
              setTransitionTarget(null);
              const result = await supabase.from("pipeline_leads").select("*").eq("id", lead.id).single();
              if (result.data) setConfirmedLead(result.data as unknown as PipelineLead);
              leadData.reload();
              window.dispatchEvent(new CustomEvent("pipeline-reload"));
              return;
            }
            await onMove(lead.id, r.targetStageId, r.observacao || undefined);
            setMoveObs("");
            setTransitionTarget(null);
          }}
        />
      )}
      <VisitaForm
        open={scheduleVisitOpen}
        onClose={() => { setScheduleVisitOpen(false); leadData.reload(); }}
        onSubmit={async (data) => {
          const result = await createVisita(data);
          if (result) {
            const visitaStage = stages.find(s => s.tipo === "visita" || s.nome.toLowerCase().includes("visita marcada"));
            if (visitaStage && lead.stage_id !== visitaStage.id) {
              try { await onMove(lead.id, visitaStage.id); } catch (e) { console.warn("[VisitaForm] move stage falhou", e); }
            }
          }
          return result;
        }}
        initialData={{
          nome_cliente: lead.nome,
          telefone: lead.telefone || "",
          empreendimento: lead.empreendimento || "",
          corretor_id: lead.corretor_id || undefined,
          pipeline_lead_id: lead.id,
        } as any}
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
