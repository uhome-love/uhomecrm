import { useState, useEffect, useMemo, useCallback } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  Briefcase, Save, Loader2, Phone, MessageSquare, Mail, Plus,
  CheckCircle2, Building2, Home, ClipboardList, TrendingUp, Handshake, CalendarDays,
  MoreHorizontal, Pencil, Trash2, FileText,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { type Negocio, NEGOCIOS_FASES } from "@/hooks/useNegocios";
import EmpreendimentoCombobox from "@/components/ui/empreendimento-combobox";
import CentralComunicacao from "@/components/comunicacao/CentralComunicacao";
import WhatsAppTemplatesDialog from "./WhatsAppTemplatesDialog";
import { cn } from "@/lib/utils";
import SolicitarPagadoriaDialog from "./SolicitarPagadoriaDialog";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  negocio: Negocio;
  onUpdate: (id: string, updates: Partial<Negocio>) => Promise<void>;
  onMoveFase: (id: string, fase: string) => void;
}

interface NegocioExtended extends Negocio {
  unidade?: string | null;
  imovel_interesse?: string | null;
  proposta_imovel?: string | null;
  proposta_valor?: number | null;
  proposta_situacao?: string | null;
  negociacao_situacao?: string | null;
  negociacao_contra_proposta?: string | null;
  negociacao_pendencia?: string | null;
  documentacao_situacao?: string | null;
}

interface NegocioAtividade {
  id: string;
  negocio_id: string;
  tipo: string;
  resultado: string | null;
  descricao: string | null;
  titulo: string | null;
  created_by: string | null;
  created_at: string;
}

interface NegocioTarefa {
  id: string;
  negocio_id: string;
  titulo: string;
  descricao: string | null;
  tipo: string;
  status: string;
  prioridade: string;
  vence_em: string | null;
  hora_vencimento: string | null;
  concluida_em: string | null;
  created_at: string;
}

// ── Activity types ──
const ATIVIDADE_BUTTONS = [
  { value: "ligacao", label: "Ligou", emoji: "📞" },
  { value: "whatsapp", label: "WhatsApp", emoji: "💬" },
  { value: "email", label: "Email", emoji: "✉️" },
  { value: "visita", label: "Visita", emoji: "🏠" },
  { value: "proposta", label: "Proposta", emoji: "📄" },
  { value: "reuniao", label: "Reunião", emoji: "📋" },
  { value: "nao_atendeu", label: "Não atendeu", emoji: "❌" },
];

const RESULTADO_OPTIONS = [
  { value: "positivo", label: "Positivo", emoji: "✅" },
  { value: "neutro", label: "Neutro", emoji: "⏳" },
  { value: "negativo", label: "Negativo", emoji: "❌" },
];

// ── Quick Actions for Negócios ──
const NEGOCIO_QUICK_ACTIONS = [
  { id: "simulacao", emoji: "📊", label: "Mandei simulação", tipo: "simulacao", titulo: "Simulação enviada" },
  { id: "vpl", emoji: "📈", label: "Mandei VPL", tipo: "vpl", titulo: "VPL enviado" },
  { id: "documentos", emoji: "📁", label: "Subi documentos para aprovação", tipo: "documentos_aprovacao", titulo: "Documentos submetidos para aprovação" },
  { id: "proposta", emoji: "📄", label: "Enviei proposta", tipo: "proposta", titulo: "Proposta enviada", openPopup: "proposta" },
  { id: "contrato", emoji: "📝", label: "Enviei contrato para assinatura", tipo: "contrato", titulo: "Contrato enviado para assinatura", openPopup: "contrato" },
];

const TAREFA_TIPOS: Record<string, string> = {
  follow_up: "🔄 Follow-up", ligar: "📞 Ligar", whatsapp: "💬 WhatsApp",
  enviar_proposta: "📄 Proposta", enviar_material: "📎 Material",
  marcar_visita: "📅 Visita", outro: "📋 Outro",
};

export default function NegocioDetailModal({ open, onOpenChange, negocio, onUpdate, onMoveFase }: Props) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fullNeg, setFullNeg] = useState<NegocioExtended>(negocio as NegocioExtended);
  const [activeTab, setActiveTab] = useState("historico");

  // Data
  const [atividades, setAtividades] = useState<NegocioAtividade[]>([]);
  const [tarefas, setTarefas] = useState<NegocioTarefa[]>([]);

  // Activity form
  const [showRegistro, setShowRegistro] = useState(false);
  const [regTipo, setRegTipo] = useState("");
  const [regResultado, setRegResultado] = useState("");
  const [regDescricao, setRegDescricao] = useState("");

  // Task form
  const [showNovaTarefa, setShowNovaTarefa] = useState(false);
  const [novaTarefaTitulo, setNovaTarefaTitulo] = useState("");
  const [novaTarefaTipo, setNovaTarefaTipo] = useState("follow_up");
  const [novaTarefaData, setNovaTarefaData] = useState("");
  const [novaTarefaHora, setNovaTarefaHora] = useState("");
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTitulo, setEditTitulo] = useState("");
  const [editTipo, setEditTipo] = useState("");
  const [editData, setEditData] = useState("");
  const [editHora, setEditHora] = useState("");

  // Popups
  const [propostaPopup, setPropostaPopup] = useState(false);
  const [contratoPopup, setContratoPopup] = useState(false);
  const [comunicacaoOpen, setComunicacaoOpen] = useState(false);
  const [whatsappOpen, setWhatsappOpen] = useState(false);
  const [reuniaoOpen, setReuniaoOpen] = useState(false);
  const [regressOpen, setRegressOpen] = useState(false);
  const [regressStageId, setRegressStageId] = useState("");
  const [pipelineStages, setPipelineStages] = useState<{ id: string; nome: string }[]>([]);

  // Reunião form fields
  const [reuniaoTipo, setReuniaoTipo] = useState("fechamento");
  const [reuniaoData, setReuniaoData] = useState("");
  const [reuniaoHora, setReuniaoHora] = useState("");
  const [reuniaoLocal, setReuniaoLocal] = useState("empresa");
  const [reuniaoObs, setReuniaoObs] = useState("");
  const [salvandoReuniao, setSalvandoReuniao] = useState(false);

  // Proposta popup fields
  const [propEmpreendimento, setPropEmpreendimento] = useState("");
  const [propUnidade, setPropUnidade] = useState("");
  const [propVgv, setPropVgv] = useState("");

  // Contrato popup fields
  const [contEmpreendimento, setContEmpreendimento] = useState("");
  const [contUnidade, setContUnidade] = useState("");
  const [contVgv, setContVgv] = useState("");
  const [contTipoAssinatura, setContTipoAssinatura] = useState("digital");

  // Imóvel tab
  const [imovelEmpreendimento, setImovelEmpreendimento] = useState("");
  const [imovelUnidade, setImovelUnidade] = useState("");
  const [imovelVgv, setImovelVgv] = useState("");
  const [imovelObs, setImovelObs] = useState("");

  // Pagadoria
  const [pagadoriaOpen, setPagadoriaOpen] = useState(false);
  const [pagadoriaStatus, setPagadoriaStatus] = useState<string | null>(null);

  // Lead history (from pipeline)
  const [leadHistory, setLeadHistory] = useState<{ tipo: string; observacao: string | null; created_at: string; stage_nome?: string }[]>([]);

  const faseInfo = NEGOCIOS_FASES.find(f => f.key === fullNeg.fase);

  // ── Load data ──
  useEffect(() => {
    if (!open || !negocio.id) return;
    const load = async () => {
      setLoading(true);
      const [negRes, atvsRes, tasksRes] = await Promise.all([
        supabase.from("negocios").select("*").eq("id", negocio.id).single(),
        supabase.from("negocios_atividades").select("*").eq("negocio_id", negocio.id).order("created_at", { ascending: false }).limit(50),
        supabase.from("negocios_tarefas").select("*").eq("negocio_id", negocio.id).order("created_at", { ascending: false }).limit(50),
      ]);
      if (negRes.data) {
        const n = negRes.data as NegocioExtended;
        setFullNeg(n);
        setImovelEmpreendimento(n.empreendimento || "");
        setImovelUnidade(n.unidade || "");
        setImovelVgv(n.vgv_estimado ? String(n.vgv_estimado) : "");
        setImovelObs(n.observacoes || "");
      }
      setAtividades((atvsRes.data || []) as NegocioAtividade[]);
      setTarefas((tasksRes.data || []) as NegocioTarefa[]);

      // Load pagadoria status
      const { data: pagData } = await supabase
        .from("pagadoria_solicitacoes")
        .select("status")
        .eq("negocio_id", negocio.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setPagadoriaStatus(pagData?.status || null);

      // Load lead history from pipeline
      const pipelineLeadId = negRes.data?.pipeline_lead_id;
      if (pipelineLeadId) {
        const [histRes, stagesRes] = await Promise.all([
          supabase.from("pipeline_historico").select("*").eq("pipeline_lead_id", pipelineLeadId).order("created_at", { ascending: true }).limit(30),
          supabase.from("pipeline_stages").select("id, nome").eq("pipeline_tipo", "leads"),
        ]);
        const stageMap = new Map((stagesRes.data || []).map((s: any) => [s.id, s.nome]));
        setLeadHistory((histRes.data || []).map((h: any) => ({
          tipo: "transicao",
          observacao: h.observacao,
          created_at: h.created_at,
          stage_nome: stageMap.get(h.stage_novo_id) || "—",
        })));
      } else {
        setLeadHistory([]);
      }

      setLoading(false);
    };
    load();
  }, [open, negocio.id]);

  // Load pipeline stages for regress option
  useEffect(() => {
    if (!open) return;
    supabase.from("pipeline_stages")
      .select("id, nome")
      .eq("pipeline_tipo", "leads")
      .eq("ativo", true)
      .order("ordem")
      .then(({ data }) => {
        const stages = (data || []).filter((s: any) => !["descarte"].includes(s.nome?.toLowerCase()));
        setPipelineStages(stages);
        if (stages.length > 0) setRegressStageId(stages.find((s: any) => s.nome?.toLowerCase().includes("qualifica"))?.id || stages[0].id);
      });
  }, [open]);

  // ── Regress to pipeline ──
  const handleRegressToPipeline = async () => {
    if (!regressStageId || !fullNeg.pipeline_lead_id || !user) return;
    // Clear negocio_id on lead and move to selected stage
    await supabase.from("pipeline_leads").update({
      stage_id: regressStageId,
      negocio_id: null,
      stage_changed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as any).eq("id", fullNeg.pipeline_lead_id);
    // Move negócio to distrato
    onMoveFase(negocio.id, "distrato");
    // Log activity
    await supabase.from("negocios_atividades").insert({
      negocio_id: negocio.id,
      tipo: "regressao_pipeline",
      titulo: "Regredido para Pipeline de Leads",
      descricao: `Lead retornado para o Pipeline`,
      created_by: user.id,
    } as any);
    setRegressOpen(false);
    onOpenChange(false);
    toast.success("🔄 Lead retornado ao Pipeline de Leads");
  };

  // ── Register activity ──
  const handleRegistrarAtividade = async () => {
    if (!regTipo || !user) return;
    const { data, error } = await supabase.from("negocios_atividades").insert({
      negocio_id: negocio.id,
      tipo: regTipo,
      resultado: regResultado || null,
      descricao: regDescricao || null,
      titulo: ATIVIDADE_BUTTONS.find(a => a.value === regTipo)?.label || regTipo,
      created_by: user.id,
    } as any).select().single();
    if (!error && data) {
      setAtividades(prev => [data as NegocioAtividade, ...prev]);
      setRegTipo(""); setRegResultado(""); setRegDescricao("");
      setShowRegistro(false);
      toast.success("📝 Atividade registrada!");
      // Update ultima ação
      await supabase.from("negocios").update({ updated_at: new Date().toISOString() } as any).eq("id", negocio.id);
    }
  };

  // ── Quick action ──
  const handleQuickAction = async (action: typeof NEGOCIO_QUICK_ACTIONS[0]) => {
    if (!user) return;
    if (action.openPopup === "proposta") {
      setPropEmpreendimento(fullNeg.empreendimento || "");
      setPropUnidade(fullNeg.unidade || "");
      setPropVgv(fullNeg.vgv_estimado ? String(fullNeg.vgv_estimado) : "");
      setPropostaPopup(true);
      return;
    }
    if (action.openPopup === "contrato") {
      setContEmpreendimento(fullNeg.empreendimento || "");
      setContUnidade(fullNeg.unidade || "");
      setContVgv(fullNeg.vgv_estimado ? String(fullNeg.vgv_estimado) : "");
      setContratoPopup(true);
      return;
    }
    // Direct action
    await supabase.from("negocios_atividades").insert({
      negocio_id: negocio.id, tipo: action.tipo, titulo: action.titulo, created_by: user.id,
    } as any);
    toast.success(`${action.emoji} ${action.titulo}`);
    // Reload atividades
    const { data } = await supabase.from("negocios_atividades").select("*").eq("negocio_id", negocio.id).order("created_at", { ascending: false }).limit(50);
    setAtividades((data || []) as NegocioAtividade[]);
  };

  // ── Submit proposta popup ──
  const handleSubmitProposta = async () => {
    if (!user) return;
    await supabase.from("negocios_atividades").insert({
      negocio_id: negocio.id, tipo: "proposta",
      titulo: "Proposta enviada",
      descricao: `Empreendimento: ${propEmpreendimento}, Unidade: ${propUnidade}, VGV: R$ ${propVgv}`,
      created_by: user.id,
    } as any);
    // Update negocio + move to proposta
    await onUpdate(negocio.id, {
      empreendimento: propEmpreendimento || fullNeg.empreendimento,
      vgv_estimado: propVgv ? parseFloat(propVgv) : fullNeg.vgv_estimado,
    } as any);
    onMoveFase(negocio.id, "proposta");
    setPropostaPopup(false);
    toast.success("📄 Proposta enviada → Coluna Proposta");
    const { data } = await supabase.from("negocios_atividades").select("*").eq("negocio_id", negocio.id).order("created_at", { ascending: false }).limit(50);
    setAtividades((data || []) as NegocioAtividade[]);
  };

  // ── Submit contrato popup ──
  const handleSubmitContrato = async () => {
    if (!user) return;
    await supabase.from("negocios_atividades").insert({
      negocio_id: negocio.id, tipo: "contrato",
      titulo: "Contrato enviado para assinatura",
      descricao: `Empreendimento: ${contEmpreendimento}, Unidade: ${contUnidade}, VGV: R$ ${contVgv}, Assinatura: ${contTipoAssinatura === "digital" ? "Digital" : "Presencial"}`,
      created_by: user.id,
    } as any);
    await onUpdate(negocio.id, {
      empreendimento: contEmpreendimento || fullNeg.empreendimento,
      vgv_final: contVgv ? parseFloat(contVgv) : fullNeg.vgv_final,
    } as any);
    onMoveFase(negocio.id, "documentacao");
    setContratoPopup(false);
    toast.success("📝 Contrato enviado → Coluna Contrato Gerado");
    const { data } = await supabase.from("negocios_atividades").select("*").eq("negocio_id", negocio.id).order("created_at", { ascending: false }).limit(50);
    setAtividades((data || []) as NegocioAtividade[]);
  };

  // ── Create task ──
  const handleCreateTask = async () => {
    if (!novaTarefaTitulo.trim() || !user) return;
    const { data, error } = await supabase.from("negocios_tarefas").insert({
      negocio_id: negocio.id,
      titulo: novaTarefaTitulo.trim(),
      tipo: novaTarefaTipo,
      vence_em: novaTarefaData || null,
      hora_vencimento: novaTarefaHora || null,
      responsavel_id: user.id,
      created_by: user.id,
    } as any).select().single();
    if (!error && data) {
      setTarefas(prev => [data as NegocioTarefa, ...prev]);
      setNovaTarefaTitulo(""); setNovaTarefaData(""); setNovaTarefaHora("");
      setShowNovaTarefa(false);
      toast.success("📋 Tarefa criada!");
    }
  };

  const toggleTask = async (taskId: string, currentStatus: string) => {
    const newStatus = currentStatus === "concluida" ? "pendente" : "concluida";
    await supabase.from("negocios_tarefas").update({
      status: newStatus,
      concluida_em: newStatus === "concluida" ? new Date().toISOString() : null,
    } as any).eq("id", taskId);
    setTarefas(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
  };

  const deleteTask = async (taskId: string) => {
    const { error } = await supabase.from("negocios_tarefas").delete().eq("id", taskId);
    if (!error) {
      setTarefas(prev => prev.filter(t => t.id !== taskId));
      toast.success("Tarefa excluída");
    } else {
      toast.error("Erro ao excluir tarefa");
    }
  };

  const startEditTask = (t: NegocioTarefa) => {
    setEditingTaskId(t.id);
    setEditTitulo(t.titulo);
    setEditTipo(t.tipo);
    setEditData(t.vence_em || "");
    setEditHora(t.hora_vencimento || "");
  };

  const saveEditTask = async () => {
    if (!editingTaskId || !editTitulo.trim()) return;
    const { error } = await supabase.from("negocios_tarefas").update({
      titulo: editTitulo.trim(),
      tipo: editTipo,
      vence_em: editData || null,
      hora_vencimento: editHora || null,
    } as any).eq("id", editingTaskId);
    if (!error) {
      setTarefas(prev => prev.map(t => t.id === editingTaskId ? { ...t, titulo: editTitulo.trim(), tipo: editTipo, vence_em: editData || null, hora_vencimento: editHora || null } : t));
      setEditingTaskId(null);
      toast.success("Tarefa atualizada");
    } else {
      toast.error("Erro ao atualizar tarefa");
    }
  };

  // ── Agendar Reunião (Visita de Negócio) ──
  const handleAgendarReuniao = async () => {
    if (!reuniaoData || !reuniaoHora || !user) return;
    setSalvandoReuniao(true);
    try {
      const TIPO_LABELS: Record<string, string> = {
        fechamento: "Reunião de Fechamento",
        negociacao: "Reunião de Negociação",
        assinatura: "Assinatura de Contrato",
        outro: "Reunião",
      };
      await supabase.from("visitas").insert({
        nome_cliente: fullNeg.nome_cliente,
        telefone: fullNeg.telefone || null,
        empreendimento: fullNeg.empreendimento || null,
        data_visita: reuniaoData,
        hora_visita: reuniaoHora,
        local_visita: reuniaoLocal,
        corretor_id: fullNeg.corretor_id,
        gerente_id: fullNeg.gerente_id,
        created_by: user.id,
        status: "confirmada",
        origem: "negocio",
        origem_detalhe: TIPO_LABELS[reuniaoTipo] || reuniaoTipo,
        observacoes: reuniaoObs || null,
        tipo: "negocio",
        negocio_id: negocio.id,
        tipo_reuniao: reuniaoTipo,
      } as any);

      // Register activity
      await supabase.from("negocios_atividades").insert({
        negocio_id: negocio.id,
        tipo: "reuniao",
        titulo: `${TIPO_LABELS[reuniaoTipo]} agendada — ${reuniaoData} ${reuniaoHora}`,
        created_by: user.id,
      } as any);

      toast.success(`📅 ${TIPO_LABELS[reuniaoTipo]} agendada!`, {
        description: `${reuniaoData} às ${reuniaoHora}`,
      });
      setReuniaoOpen(false);
      setReuniaoData(""); setReuniaoHora(""); setReuniaoObs("");
      // Reload activities
      const { data } = await supabase.from("negocios_atividades").select("*").eq("negocio_id", negocio.id).order("created_at", { ascending: false }).limit(50);
      setAtividades((data || []) as NegocioAtividade[]);
    } finally {
      setSalvandoReuniao(false);
    }
  };

  // ── Save imóvel tab ──
  const handleSaveImovel = async () => {
    setSaving(true);
    try {
      await onUpdate(negocio.id, {
        empreendimento: imovelEmpreendimento || null,
        vgv_estimado: imovelVgv ? parseFloat(imovelVgv) : null,
        observacoes: imovelObs || null,
      } as any);
      // Update unidade via direct call
      await supabase.from("negocios").update({ unidade: imovelUnidade || null } as any).eq("id", negocio.id);
      toast.success("💾 Dados do imóvel salvos!");
    } finally { setSaving(false); }
  };

  const set = (field: string, value: any) => setFullNeg(prev => ({ ...prev, [field]: value }));

  const whatsappUrl = fullNeg.telefone ? `https://wa.me/${fullNeg.telefone.replace(/\D/g, "")}` : null;

  const pendingTasks = tarefas.filter(t => t.status === "pendente");
  const nextTask = pendingTasks[0];

  if (loading) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-2xl p-0 overflow-hidden">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-2xl max-h-screen overflow-hidden flex flex-col p-0">

          {/* ════════ HEADER ════════ */}
          <div className="shrink-0 border-b border-border/50 bg-card px-6 pt-5 pb-3 space-y-3">
            {/* Row 1: Name + Fase badge + VGV */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0 flex-wrap">
                <h2 className="text-xl font-bold text-foreground truncate">{fullNeg.nome_cliente}</h2>
                <Badge
                  className="text-xs px-2 py-0.5 font-bold border shrink-0"
                  style={{ backgroundColor: faseInfo?.cor + "20", color: faseInfo?.cor, borderColor: faseInfo?.cor + "40" }}
                >
                  {faseInfo?.icon} {faseInfo?.label}
                </Badge>
                {fullNeg.vgv_estimado && (
                  <span className="text-xs font-semibold text-amber-600 flex items-center gap-0.5">
                    <TrendingUp className="h-3 w-3" />
                    R$ {fullNeg.vgv_estimado.toLocaleString("pt-BR")}
                  </span>
                )}
              </div>
            </div>

            {/* Row 2: Contact */}
            <div className="flex items-center gap-4 flex-wrap">
              {fullNeg.telefone && (
                <a href={`tel:${fullNeg.telefone}`} className="text-base text-foreground hover:text-primary transition-colors flex items-center gap-1.5">
                  <Phone className="h-4 w-4" /> {fullNeg.telefone}
                </a>
              )}
              {fullNeg.empreendimento && (
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <Building2 className="h-3.5 w-3.5" /> {fullNeg.empreendimento}
                </span>
              )}
            </div>

            {/* Row 3: Action buttons (like PipelineLeadDetail) */}
            <div className="flex items-center gap-2 flex-wrap">
              {fullNeg.telefone && (
                <a href={`tel:${fullNeg.telefone}`}>
                  <Button variant="outline" size="sm" className="py-2 px-4 text-xs gap-1.5 rounded-full border-border/60 hover:border-primary hover:text-primary">
                    <Phone className="h-3.5 w-3.5" /> Ligar
                  </Button>
                </a>
              )}
              {fullNeg.telefone && (
                <Button variant="outline" size="sm" className="py-2 px-4 text-xs gap-1.5 rounded-full border-green-300 text-green-600 hover:bg-green-50" onClick={() => setWhatsappOpen(true)}>
                  <MessageSquare className="h-3.5 w-3.5" /> WhatsApp
                </Button>
              )}
              <Button variant="outline" size="sm" className="py-2 px-4 text-xs gap-1.5 rounded-full border-border/60 hover:border-primary hover:text-primary" onClick={() => setComunicacaoOpen(true)}>
                <MessageSquare className="h-3.5 w-3.5" /> 💬 Mensagem
              </Button>
              <Button variant="outline" size="sm" className="py-2 px-4 text-xs gap-1.5 rounded-full border-amber-300 text-amber-600 hover:bg-amber-50" onClick={() => setReuniaoOpen(true)}>
                <CalendarDays className="h-3.5 w-3.5" /> 📅 Reunião
              </Button>

              {/* Solicitar Pagadoria — only shows on "documentacao" phase */}
              {(fullNeg.fase === "documentacao" || fullNeg.fase === "assinado") && (
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    "py-2 px-4 text-xs gap-1.5 rounded-full",
                    pagadoriaStatus === "pronto"
                      ? "border-emerald-300 text-emerald-600"
                      : pagadoriaStatus
                      ? "border-blue-300 text-blue-600"
                      : "border-purple-300 text-purple-600 hover:bg-purple-50"
                  )}
                  onClick={() => setPagadoriaOpen(true)}
                  disabled={!!pagadoriaStatus}
                >
                  <FileText className="h-3.5 w-3.5" />
                  {pagadoriaStatus === "pronto" ? "✅ Pagadoria pronta" : pagadoriaStatus === "producao" ? "⚙️ Em produção" : pagadoriaStatus === "enviado" ? "📩 Solicitada" : "📋 Solicitar Pagadoria"}
                </Button>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="py-2 px-4 text-xs gap-1.5 rounded-full">
                    <Plus className="h-3.5 w-3.5" /> Ação
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <p className="px-2 py-1.5 text-xs font-bold text-muted-foreground">⚡ Ação do Negócio</p>
                  <DropdownMenuSeparator />
                  {NEGOCIO_QUICK_ACTIONS.map(action => (
                    <DropdownMenuItem key={action.id} onClick={() => handleQuickAction(action)} className="gap-2 cursor-pointer">
                      <span>{action.emoji}</span>
                      <span className="text-sm">{action.label}</span>
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => { setActiveTab("historico"); setShowRegistro(true); }} className="gap-2 cursor-pointer">
                    <span>📝</span>
                    <span className="text-sm">Registrar com detalhes</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Next task indicator */}
            {nextTask && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-1.5">
                <ClipboardList className="h-3.5 w-3.5" />
                <span>{nextTask.titulo}</span>
                {nextTask.vence_em && <span className="text-[10px]">• {nextTask.vence_em}</span>}
              </div>
            )}
          </div>

          {/* ════════ TABS ════════ */}
          <div className="flex-1 overflow-y-auto px-6 pb-4">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-3">
              <TabsList className="grid w-full grid-cols-4 h-9">
                <TabsTrigger value="historico" className="text-xs gap-1">🕐 Histórico</TabsTrigger>
                <TabsTrigger value="tarefas" className="text-xs gap-1">📋 Tarefas</TabsTrigger>
                <TabsTrigger value="jornada" className="text-xs gap-1">🗺️ Jornada</TabsTrigger>
                <TabsTrigger value="imovel" className="text-xs gap-1">🏠 Imóvel</TabsTrigger>
              </TabsList>

              {/* ── TAB TAREFAS ── */}
              <TabsContent value="tarefas" className="space-y-3 mt-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold">📋 Tarefas ({pendingTasks.length} pendentes)</h3>
                  <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => setShowNovaTarefa(!showNovaTarefa)}>
                    <Plus className="h-3.5 w-3.5" /> Nova Tarefa
                  </Button>
                </div>

                {showNovaTarefa && (
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-3">
                    <Input
                      value={novaTarefaTitulo}
                      onChange={e => setNovaTarefaTitulo(e.target.value)}
                      placeholder="Título da tarefa..."
                      className="h-9 text-sm"
                    />
                    <div className="flex gap-2">
                      <Select value={novaTarefaTipo} onValueChange={setNovaTarefaTipo}>
                        <SelectTrigger className="h-8 text-xs w-40"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(TAREFA_TIPOS).map(([k, v]) => (
                            <SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input type="date" value={novaTarefaData} onChange={e => setNovaTarefaData(e.target.value)} className="h-8 text-xs w-36" />
                      <Input type="time" value={novaTarefaHora} onChange={e => setNovaTarefaHora(e.target.value)} className="h-8 text-xs w-24" />
                    </div>
                    <div className="flex justify-end">
                      <Button size="sm" className="h-8 text-xs gap-1" onClick={handleCreateTask} disabled={!novaTarefaTitulo.trim()}>
                        <Plus className="h-3 w-3" /> Criar
                      </Button>
                    </div>
                  </div>
                )}

                {tarefas.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    📋 Sem tarefas pendentes
                    <button className="block mx-auto mt-2 text-primary text-xs font-semibold hover:underline" onClick={() => setShowNovaTarefa(true)}>
                      + Criar primeira tarefa
                    </button>
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-[40vh] overflow-y-auto">
                    {tarefas.map(t => (
                      editingTaskId === t.id ? (
                        <div key={t.id} className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
                          <Input value={editTitulo} onChange={e => setEditTitulo(e.target.value)} className="h-8 text-xs" placeholder="Título da tarefa..." />
                          <div className="flex gap-2 flex-wrap">
                            <Select value={editTipo} onValueChange={setEditTipo}>
                              <SelectTrigger className="h-8 text-xs w-36"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {Object.entries(TAREFA_TIPOS).map(([k, v]) => (
                                  <SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Input type="date" value={editData} onChange={e => setEditData(e.target.value)} className="h-8 text-xs w-36" />
                            <Input type="time" value={editHora} onChange={e => setEditHora(e.target.value)} className="h-8 text-xs w-24" />
                          </div>
                          <div className="flex gap-2 justify-end">
                            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setEditingTaskId(null)}>Cancelar</Button>
                            <Button size="sm" className="text-xs h-7 gap-1" onClick={saveEditTask}><Save className="h-3 w-3" /> Salvar</Button>
                          </div>
                        </div>
                      ) : (
                        <div
                          key={t.id}
                          className={cn(
                            "flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors group",
                            t.status === "concluida" ? "bg-muted/30 border-border/30" : "bg-card hover:bg-accent/30"
                          )}
                        >
                          <CheckCircle2
                            className={cn("h-4 w-4 shrink-0 cursor-pointer", t.status === "concluida" ? "text-green-500" : "text-muted-foreground/40")}
                            onClick={() => toggleTask(t.id, t.status)}
                          />
                          <div className="flex-1 min-w-0 cursor-pointer" onClick={() => toggleTask(t.id, t.status)}>
                            <span className={cn("text-xs", t.status === "concluida" && "line-through text-muted-foreground")}>
                              {t.titulo}
                            </span>
                            {t.vence_em && (
                              <span className="text-[10px] text-muted-foreground ml-2">{t.vence_em}</span>
                            )}
                          </div>
                          <Badge variant="outline" className="text-[9px] px-1.5">{TAREFA_TIPOS[t.tipo] || t.tipo}</Badge>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                <MoreHorizontal className="h-3.5 w-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-36">
                              <DropdownMenuItem className="text-xs gap-2" onClick={() => startEditTask(t)}>
                                <Pencil className="h-3 w-3" /> Editar
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-xs gap-2 text-destructive focus:text-destructive" onClick={() => deleteTask(t.id)}>
                                <Trash2 className="h-3 w-3" /> Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      )
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* ── TAB HISTÓRICO ── */}
              <TabsContent value="historico" className="space-y-3 mt-4">
                {/* Register activity form */}
                {!showRegistro ? (
                  <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs" onClick={() => setShowRegistro(true)}>
                    <Plus className="h-3.5 w-3.5" /> Registrar Atividade
                  </Button>
                ) : (
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
                    <h4 className="text-sm font-bold">+ Registrar Atividade</h4>

                    <div>
                      <p className="text-xs text-muted-foreground mb-2">O que foi feito:</p>
                      <div className="flex flex-wrap gap-2">
                        {ATIVIDADE_BUTTONS.map(a => (
                          <button
                            key={a.value}
                            type="button"
                            onClick={() => setRegTipo(a.value)}
                            className={cn(
                              "px-3 py-1.5 rounded-full text-xs font-semibold border transition-all",
                              regTipo === a.value
                                ? "bg-primary text-primary-foreground border-primary ring-2 ring-offset-1 ring-primary/30"
                                : "bg-card text-foreground border-border hover:bg-accent"
                            )}
                          >
                            {a.emoji} {a.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="text-xs text-muted-foreground mb-2">Resultado:</p>
                      <div className="flex gap-2">
                        {RESULTADO_OPTIONS.map(r => (
                          <button
                            key={r.value}
                            type="button"
                            onClick={() => setRegResultado(r.value)}
                            className={cn(
                              "px-3 py-1.5 rounded-full text-xs font-semibold border transition-all",
                              regResultado === r.value
                                ? "bg-primary text-primary-foreground border-primary ring-2 ring-offset-1 ring-primary/30"
                                : "bg-card text-foreground border-border hover:bg-accent"
                            )}
                          >
                            {r.emoji} {r.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="text-xs text-muted-foreground mb-1">O que aconteceu:</p>
                      <Textarea
                        value={regDescricao}
                        onChange={e => setRegDescricao(e.target.value)}
                        placeholder="Ex: Cliente atendeu, pediu proposta por email"
                        rows={3}
                        className="text-sm"
                      />
                    </div>

                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" className="text-xs" onClick={() => setShowRegistro(false)}>Cancelar</Button>
                      <Button size="sm" className="text-xs gap-1" onClick={handleRegistrarAtividade} disabled={!regTipo}>
                        Registrar
                      </Button>
                    </div>
                  </div>
                )}

                {/* Timeline */}
                {atividades.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-6">Nenhuma atividade registrada.</p>
                ) : (
                  <div className="space-y-2 max-h-[40vh] overflow-y-auto">
                    {atividades.map(a => {
                      const tipoInfo = ATIVIDADE_BUTTONS.find(b => b.value === a.tipo);
                      const emoji = tipoInfo?.emoji || "📌";
                      return (
                        <div key={a.id} className="flex gap-3 px-3 py-2.5 rounded-lg border border-border/40 bg-card">
                          <span className="text-lg shrink-0">{emoji}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold">{a.titulo || tipoInfo?.label || a.tipo}</p>
                            {a.resultado && (
                              <Badge variant="outline" className="text-[9px] mt-0.5">
                                {RESULTADO_OPTIONS.find(r => r.value === a.resultado)?.emoji} {a.resultado}
                              </Badge>
                            )}
                            {a.descricao && <p className="text-xs text-muted-foreground mt-1">{a.descricao}</p>}
                          </div>
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            {formatDistanceToNow(new Date(a.created_at), { addSuffix: true, locale: ptBR })}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </TabsContent>

              {/* ── TAB JORNADA (Lead History) ── */}
              <TabsContent value="jornada" className="space-y-3 mt-4">
                <h3 className="text-sm font-bold">🗺️ Jornada do Lead no Pipeline</h3>
                {leadHistory.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-8">Sem histórico de pipeline vinculado a este negócio.</p>
                ) : (
                  <div className="space-y-1.5 max-h-[40vh] overflow-y-auto">
                    {leadHistory.map((h, i) => (
                      <div key={i} className="flex items-start gap-3 px-3 py-2 rounded-lg border border-border/50 bg-muted/20">
                        <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                          <span className="text-[10px]">📍</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-foreground">→ {h.stage_nome}</p>
                          {h.observacao && <p className="text-[11px] text-muted-foreground mt-0.5">{h.observacao}</p>}
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {format(new Date(h.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* ── TAB IMÓVEL DE INTERESSE ── */}
              <TabsContent value="imovel" className="space-y-4 mt-4">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <Home className="h-4 w-4 text-primary" /> Dados do Imóvel de Interesse
                </h3>

                <div>
                  <Label className="text-xs font-semibold mb-1 block">Empreendimento</Label>
                  <EmpreendimentoCombobox
                    value={imovelEmpreendimento}
                    onChange={setImovelEmpreendimento}
                    placeholder="Selecione o empreendimento"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold mb-1 block">Unidade</Label>
                  <Input
                    value={imovelUnidade}
                    onChange={e => setImovelUnidade(e.target.value)}
                    placeholder="Ex: Torre A - Apto 1204"
                    className="h-9 text-sm"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold mb-1 block">VGV (R$)</Label>
                  <Input
                    type="number"
                    value={imovelVgv}
                    onChange={e => setImovelVgv(e.target.value)}
                    placeholder="500000"
                    className="h-9 text-sm"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold mb-1 block">Observações</Label>
                  <Textarea
                    value={imovelObs}
                    onChange={e => setImovelObs(e.target.value)}
                    placeholder="Notas sobre o negócio..."
                    rows={4}
                    className="text-sm"
                  />
                </div>

                <Button onClick={handleSaveImovel} disabled={saving} className="w-full gap-1.5 text-xs">
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  Salvar Dados do Imóvel
                </Button>
              </TabsContent>
            </Tabs>
          </div>

          {/* ════════ FOOTER ════════ */}
          <div className="shrink-0 border-t border-border/50 px-6 py-3 flex items-center gap-2">
            {fullNeg.fase === "documentacao" && (
              <Button className="gap-2 text-xs bg-green-600 hover:bg-green-700" onClick={() => { onMoveFase(negocio.id, "assinado"); onOpenChange(false); }}>
                🏆 Marcar como ASSINADO
              </Button>
            )}
            {fullNeg.fase === "proposta" && (
              <Button variant="outline" className="gap-1 text-xs border-amber-300 text-amber-700" onClick={() => { onMoveFase(negocio.id, "negociacao"); set("fase", "negociacao"); }}>
                🤝 → Negociação
              </Button>
            )}
            {fullNeg.fase === "negociacao" && (
              <Button variant="outline" className="gap-1 text-xs border-purple-300 text-purple-700" onClick={() => { onMoveFase(negocio.id, "documentacao"); set("fase", "documentacao"); }}>
                📄 → Contrato Gerado
              </Button>
            )}
            {fullNeg.pipeline_lead_id && fullNeg.fase !== "assinado" && fullNeg.fase !== "distrato" && (
              <Button variant="outline" className="gap-1 text-xs border-destructive/30 text-destructive" onClick={() => setRegressOpen(true)}>
                🔄 Regredir para Pipeline
              </Button>
            )}
            <div className="flex-1" />
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Regress to Pipeline Dialog ── */}
      <Dialog open={regressOpen} onOpenChange={setRegressOpen}>
        <DialogContent className="sm:max-w-sm space-y-3">
          <DialogHeader>
            <DialogTitle className="text-base">🔄 Regredir para Pipeline de Leads</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">O negócio será movido para "Caiu" e o lead voltará ao Pipeline.</p>
          <div>
            <Label className="text-xs mb-1 block">Retornar para qual etapa?</Label>
            <Select value={regressStageId} onValueChange={setRegressStageId}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione a etapa" /></SelectTrigger>
              <SelectContent>
                {pipelineStages.map(s => (
                  <SelectItem key={s.id} value={s.id} className="text-xs">{s.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" className="text-xs" onClick={() => setRegressOpen(false)}>Cancelar</Button>
            <Button size="sm" className="text-xs gap-1" onClick={handleRegressToPipeline} disabled={!regressStageId}>
              🔄 Confirmar regressão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Proposta Popup ── */}
      <Dialog open={propostaPopup} onOpenChange={setPropostaPopup}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">📄 Enviar Proposta</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs font-semibold mb-1 block">Empreendimento</Label>
              <EmpreendimentoCombobox value={propEmpreendimento} onChange={setPropEmpreendimento} placeholder="Selecione" />
            </div>
            <div>
              <Label className="text-xs font-semibold mb-1 block">Unidade</Label>
              <Input value={propUnidade} onChange={e => setPropUnidade(e.target.value)} placeholder="Ex: Apto 1204" className="h-9 text-sm" />
            </div>
            <div>
              <Label className="text-xs font-semibold mb-1 block">VGV (R$)</Label>
              <Input type="number" value={propVgv} onChange={e => setPropVgv(e.target.value)} placeholder="500000" className="h-9 text-sm" />
            </div>
            <Button className="w-full gap-1.5 text-xs" onClick={handleSubmitProposta}>
              📄 Enviar e mover para Proposta
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Contrato Popup ── */}
      <Dialog open={contratoPopup} onOpenChange={setContratoPopup}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">📝 Enviar Contrato para Assinatura</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs font-semibold mb-1 block">Empreendimento</Label>
              <EmpreendimentoCombobox value={contEmpreendimento} onChange={setContEmpreendimento} placeholder="Selecione" />
            </div>
            <div>
              <Label className="text-xs font-semibold mb-1 block">Unidade</Label>
              <Input value={contUnidade} onChange={e => setContUnidade(e.target.value)} placeholder="Ex: Apto 1204" className="h-9 text-sm" />
            </div>
            <div>
              <Label className="text-xs font-semibold mb-1 block">VGV (R$)</Label>
              <Input type="number" value={contVgv} onChange={e => setContVgv(e.target.value)} placeholder="500000" className="h-9 text-sm" />
            </div>
            <div>
              <Label className="text-xs font-semibold mb-1 block">Tipo de Assinatura</Label>
              <div className="flex gap-2">
                {[
                  { value: "digital", label: "💻 Digital" },
                  { value: "presencial", label: "🏢 Presencial" },
                ].map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setContTipoAssinatura(opt.value)}
                    className={cn(
                      "px-4 py-2 rounded-lg text-xs font-semibold border transition-all flex-1",
                      contTipoAssinatura === opt.value
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card text-foreground border-border hover:bg-accent"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <Button className="w-full gap-1.5 text-xs" onClick={handleSubmitContrato}>
              📝 Enviar e mover para Contrato Gerado
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Comunicação ── */}
      {comunicacaoOpen && (
        <CentralComunicacao
          leadId={negocio.pipeline_lead_id || negocio.id}
          leadNome={fullNeg.nome_cliente}
          leadTelefone={fullNeg.telefone || ""}
          open={comunicacaoOpen}
          onOpenChange={setComunicacaoOpen}
        />
      )}

      {/* ── WhatsApp Templates ── */}
      {whatsappOpen && fullNeg.telefone && (
        <WhatsAppTemplatesDialog
          open={whatsappOpen}
          onOpenChange={setWhatsappOpen}
          leadNome={fullNeg.nome_cliente}
          leadTelefone={fullNeg.telefone}
          leadEmpreendimento={fullNeg.empreendimento || null}
          leadId={negocio.pipeline_lead_id || negocio.id}
        />
      )}
      {/* ── Reunião Dialog ── */}
      <Dialog open={reuniaoOpen} onOpenChange={setReuniaoOpen}>
        <DialogContent className="sm:max-w-md space-y-3">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">📅 Agendar Reunião de Negócio</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">Cliente: <strong>{fullNeg.nome_cliente}</strong> {fullNeg.empreendimento && <Badge variant="outline" className="ml-1 text-[10px]">{fullNeg.empreendimento}</Badge>}</p>

          <div className="space-y-3">
            <div>
              <Label className="text-xs mb-2 block">Tipo de reunião *</Label>
              <Select value={reuniaoTipo} onValueChange={setReuniaoTipo}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fechamento">🤝 Reunião de Fechamento</SelectItem>
                  <SelectItem value="negociacao">💼 Reunião de Negociação</SelectItem>
                  <SelectItem value="assinatura">📝 Assinatura de Contrato</SelectItem>
                  <SelectItem value="apresentacao">📊 Apresentação de Proposta</SelectItem>
                  <SelectItem value="outro">📋 Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Data *</Label>
                <Input type="date" value={reuniaoData} onChange={e => setReuniaoData(e.target.value)} className="h-8 text-xs" />
              </div>
              <div>
                <Label className="text-xs">Horário *</Label>
                <Input type="time" value={reuniaoHora} onChange={e => setReuniaoHora(e.target.value)} className="h-8 text-xs" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Local</Label>
              <Select value={reuniaoLocal} onValueChange={setReuniaoLocal}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="empresa">🏢 Escritório</SelectItem>
                  <SelectItem value="stand">🏗️ Stand</SelectItem>
                  <SelectItem value="videochamada">📹 Videochamada</SelectItem>
                  <SelectItem value="cartorio">📜 Cartório</SelectItem>
                  <SelectItem value="outro">📍 Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Observação</Label>
              <Textarea value={reuniaoObs} onChange={e => setReuniaoObs(e.target.value)} className="text-xs h-16" placeholder="Detalhes da reunião..." />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" className="text-xs" onClick={() => setReuniaoOpen(false)}>Cancelar</Button>
            <Button
              size="sm"
              className="text-xs gap-1"
              disabled={!reuniaoData || !reuniaoHora || salvandoReuniao}
              onClick={handleAgendarReuniao}
            >
              {salvandoReuniao ? <Loader2 className="h-3 w-3 animate-spin" /> : "📅"} Agendar reunião
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SolicitarPagadoriaDialog open={pagadoriaOpen} onOpenChange={setPagadoriaOpen} negocio={fullNeg} />
    </>
  );
}
