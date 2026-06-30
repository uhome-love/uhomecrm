import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Plus, Send, StickyNote, ArrowRight, CheckCircle2,
  PhoneCall, MessageSquare, Video, MapPin, FileText, Clock, ClipboardList,
  Building2, Share2, Search as SearchIcon, Trash2, Megaphone
} from "lucide-react";
import { parseDateTimeSafe } from "@/lib/utils";
import { todayBRT, dateToBRT } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { PipelineAtividade, PipelineAnotacao, PipelineTarefa, PipelineHistorico } from "@/hooks/usePipelineLeadData";
import type { PipelineStage, PipelineLead } from "@/hooks/usePipeline";
import { useLeadImoveisEvents, type LeadImovelEvent } from "@/hooks/useLeadImoveisEvents";
import DrawerTimelineGroup from "./drawer/DrawerTimelineGroup";

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

interface Props {
  leadId: string;
  lead: PipelineLead;
  stages: PipelineStage[];
  atividades: PipelineAtividade[];
  anotacoes: PipelineAnotacao[];
  tarefas: PipelineTarefa[];
  historico: PipelineHistorico[];
  onAddAtividade: (data: Partial<PipelineAtividade>) => Promise<void>;
  onAddAnotacao: (conteudo: string) => Promise<void>;
  onToggleFixar: (id: string, fixada: boolean) => Promise<void>;
  onAddTarefa: (data: Partial<PipelineTarefa>) => Promise<void | boolean>;
  onReload: () => void;
  onNextAction?: () => void;
}

const ATIVIDADE_TIPOS: Record<string, { label: string; icon: any; color?: string }> = {
  ligacao: { label: "📞 Ligação", icon: PhoneCall },
  whatsapp: { label: "💬 WhatsApp", icon: MessageSquare },
  followup: { label: "📨 Follow-up", icon: Send },
  reuniao: { label: "🤝 Reunião", icon: Video },
  visita: { label: "🏠 Visita", icon: MapPin },
  proposta: { label: "📄 Proposta", icon: FileText },
  retorno: { label: "🔁 Retorno", icon: Clock },
  pendencia_doc: { label: "📋 Pendência doc", icon: ClipboardList },
  email: { label: "✉️ Email", icon: Send },
  nao_atendeu: { label: "❌ Não atendeu", icon: PhoneCall },
  entrada: { label: "🟢 Lead entrou", icon: Plus },
  campanha_atrio: { label: "📣 Reengajamento Átrio", icon: Megaphone, color: "bg-violet-100 text-violet-700" },
  contato: { label: "☎️ Contato", icon: PhoneCall },
  mensagem: { label: "💬 Mensagem", icon: MessageSquare },
};

interface TimelineItem {
  title: string;
  description?: string;
  date: string;
  icon: any;
  color: string;
  autor?: string;
  sourceType?: "atividade" | "historico" | "tarefa" | "imovel_event" | "anotacao" | "system";
  sourceId?: string;
}

function firstName(nome?: string | null): string | undefined {
  if (!nome) return undefined;
  return nome.trim().split(/\s+/)[0] || undefined;
}


const IMOVEL_EVENT_META: Record<string, { label: string; icon: any; color: string }> = {
  search_performed: { label: "🔍 Busca de imóveis", icon: SearchIcon, color: "bg-violet-100 text-violet-600" },
  vitrine_created: { label: "🏠 Vitrine criada", icon: Building2, color: "bg-primary/10 text-primary" },
  vitrine_sent: { label: "📤 Vitrine enviada", icon: Share2, color: "bg-green-100 text-green-600" },
  property_previewed: { label: "👁️ Imóvel visualizado", icon: Building2, color: "bg-blue-100 text-blue-600" },
  property_favorited: { label: "❤️ Imóvel favoritado", icon: Building2, color: "bg-rose-100 text-rose-600" },
  whatsapp_clicked: { label: "💬 WhatsApp clicado", icon: MessageSquare, color: "bg-green-100 text-green-600" },
};

function getOrigemLabel(origem: string | null | undefined): { emoji: string; label: string } | null {
  if (!origem) return null;
  const o = origem.toLowerCase();
  if (o.includes("meta") || o.includes("facebook")) return { emoji: "📱", label: "Meta Ads" };
  if (o.includes("tiktok")) return { emoji: "🎵", label: "TikTok Ads" };
  if (o.includes("google")) return { emoji: "🔍", label: "Google Ads" };
  if (o.includes("sms") || o.includes("brevo")) return { emoji: "📲", label: "SMS Brevo" };
  if (o.includes("email")) return { emoji: "✉️", label: "Email Marketing" };
  if (o.includes("site") || o.includes("uhome")) return { emoji: "🌐", label: "Site" };
  if (o.includes("indicacao") || o.includes("indicação")) return { emoji: "🤝", label: "Indicação" };
  if (o.includes("jetimob")) return { emoji: "🏢", label: "Jetimob" };
  if (o.includes("imovelweb")) return { emoji: "🏠", label: "ImovelWeb" };
  return { emoji: "📍", label: origem };
}

function LeadOrigemInfo({ lead }: { lead: PipelineLead }) {
  const origemInfo = getOrigemLabel(lead.origem);
  const campanha = lead.campanha || lead.formulario;
  
  if (!origemInfo && !campanha) return null;
  
  const parts: string[] = [];
  if (origemInfo) parts.push(`${origemInfo.emoji} ${origemInfo.label}`);
  if (campanha) parts.push(`📋 ${campanha}`);
  if (lead.plataforma && !parts[0]?.includes(lead.plataforma)) parts.push(`via ${lead.plataforma}`);
  
  return (
    <p className="text-xs text-muted-foreground mt-0.5">
      {parts.join(" • ")}
    </p>
  );
}

function buildTimeline(historico: PipelineHistorico[], atividades: PipelineAtividade[], tarefas: PipelineTarefa[], stages: PipelineStage[], lead: PipelineLead, imovelEvents?: LeadImovelEvent[], anotacoes?: PipelineAnotacao[], nomesPorId?: Record<string, string>): TimelineItem[] {
  const items: TimelineItem[] = [];
  const nome = (id?: string | null) => (id && nomesPorId?.[id]) ? firstName(nomesPorId[id]) : undefined;

  for (const h of historico) {
    const from = stages.find(s => s.id === h.stage_anterior_id);
    const to = stages.find(s => s.id === h.stage_novo_id);
    items.push({
      title: `Movido para ${to?.nome || "?"}`,
      description: from ? `De: ${from.nome}${h.observacao ? ` • ${h.observacao}` : ""}` : h.observacao || undefined,
      date: h.created_at,
      icon: ArrowRight,
      color: "bg-primary/10 text-primary",
      autor: nome(h.movido_por),
      sourceType: "historico",
      sourceId: h.id,
    });
  }

  for (const a of atividades) {
    const info = ATIVIDADE_TIPOS[a.tipo];
    const isEntrada = a.tipo === "entrada";
    const desc = isEntrada && a.descricao
      ? a.descricao
      : (a.descricao || `${a.titulo} • ${a.status === "concluida" ? "✅" : "⏳"}`);
    items.push({
      title: isEntrada ? (a.titulo || info?.label || "Lead entrou") : (info?.label ? `${info.label} — ${a.titulo}` : a.titulo),
      description: desc,
      date: a.created_at,
      icon: info?.icon || PhoneCall,
      color: info?.color || (isEntrada ? "bg-emerald-100 text-emerald-600" : (a.status === "concluida" ? "bg-green-100 text-green-600" : "bg-blue-100 text-blue-600")),
      autor: isEntrada ? undefined : nome(a.created_by),
      sourceType: "atividade",
      sourceId: a.id,
    });
  }

  for (const t of tarefas) {
    if (t.status === "concluida" && t.concluida_em) {
      items.push({ title: `✅ ${t.titulo}`, date: t.concluida_em, icon: CheckCircle2, color: "bg-green-100 text-green-600", autor: nome(t.created_by), sourceType: "tarefa", sourceId: t.id });
    }
  }


  // Lead-imóvel events
  if (imovelEvents) {
    for (const ev of imovelEvents) {
      const meta = IMOVEL_EVENT_META[ev.event_type] || { label: ev.event_type, icon: Building2, color: "bg-muted text-muted-foreground" };
      const desc = ev.search_query
        ? `Busca: "${ev.search_query}"`
        : ev.imovel_codigo
          ? `Imóvel: ${ev.imovel_codigo}`
          : undefined;
      items.push({
        title: meta.label,
        description: desc,
        date: ev.created_at,
        icon: meta.icon,
        color: meta.color,
      });
    }
  }

  // Anotações na timeline
  if (anotacoes) {
    for (const nota of anotacoes) {
      items.push({
        title: `📝 Nota de ${nota.autor_nome || "Usuário"}`,
        description: nota.conteudo,
        date: nota.created_at,
        icon: StickyNote,
        color: nota.fixada ? "bg-amber-100 text-amber-600" : "bg-muted text-muted-foreground",
        sourceType: "anotacao",
        sourceId: nota.id,
      });
    }
  }

  if (lead.aceito_em) {
    const aceitoPor = nome((lead as any).corretor_id);
    items.push({ title: "✅ Lead aceito", description: aceitoPor ? `Responsável: ${aceitoPor}` : undefined, date: lead.aceito_em, icon: CheckCircle2, color: "bg-emerald-100 text-emerald-600", sourceType: "system" });
  }
  if (lead.distribuido_em) {
    const paraNome = nome((lead as any).corretor_id);
    const deNome = nome((lead as any).corretor_anterior_id);
    const partes: string[] = [];
    if (deNome) partes.push(`De: ${deNome}`);
    if (paraNome) partes.push(`Para: ${paraNome}`);
    items.push({
      title: paraNome ? `🔄 Lead distribuído → ${paraNome}` : "🔄 Lead distribuído",
      description: partes.length ? partes.join(" • ") : undefined,
      date: lead.distribuido_em,
      icon: ArrowRight,
      color: "bg-blue-100 text-blue-600",
      sourceType: "system",
    });
  }


  items.sort((a, b) => (parseDateTimeSafe(b.date)?.getTime() ?? 0) - (parseDateTimeSafe(a.date)?.getTime() ?? 0));
  return items;
}

export default function LeadHistoricoTab({ leadId, lead, stages, atividades, anotacoes, tarefas, historico, onAddAtividade, onAddAnotacao, onToggleFixar, onAddTarefa, onReload, onNextAction }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [tipo, setTipo] = useState("ligacao");
  const [resultado, setResultado] = useState("neutro");
  const [descricao, setDescricao] = useState("");
  const [followUp, setFollowUp] = useState<"none" | "amanha" | "custom">("none");
  const [followUpDate, setFollowUpDate] = useState("");
  const [novoHistoricoOpen, setNovoHistoricoOpen] = useState(false);
  const [novaNota, setNovaNota] = useState("");
  const [savingNota, setSavingNota] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TimelineItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { data: imovelEvents } = useLeadImoveisEvents(leadId);
  const [nomesPorId, setNomesPorId] = useState<Record<string, string>>({});

  useEffect(() => {
    const ids = new Set<string>();
    atividades.forEach(a => { if (a.created_by) ids.add(a.created_by); });
    tarefas.forEach(t => { if (t.created_by) ids.add(t.created_by); });
    historico.forEach(h => { if (h.movido_por) ids.add(h.movido_por); });
    const lc: any = lead;
    if (lc.corretor_id) ids.add(lc.corretor_id);
    if (lc.corretor_anterior_id) ids.add(lc.corretor_anterior_id);
    const lista = Array.from(ids);
    if (lista.length === 0) { setNomesPorId({}); return; }
    let cancel = false;
    (async () => {
      const { data } = await supabase.from("profiles").select("user_id, nome").in("user_id", lista);
      if (cancel || !data) return;
      const map: Record<string, string> = {};
      for (const p of data as any[]) { if (p.user_id && p.nome) map[p.user_id] = p.nome; }
      setNomesPorId(map);
    })();
    return () => { cancel = true; };
  }, [atividades, tarefas, historico, lead]);

  const timeline = buildTimeline(historico, atividades, tarefas, stages, lead, imovelEvents, anotacoes, nomesPorId);

  const totalEventos = timeline.length;
  const totalNotas = anotacoes?.length ?? 0;

  const handleSave = async () => {
    const titulo = descricao.trim() || (ATIVIDADE_TIPOS[tipo]?.label || tipo);
    await onAddAtividade({
      tipo,
      titulo,
      descricao: resultado ? `Resultado: ${resultado}` : null,
      data: todayBRT(),
      hora: new Date().toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }),
      prioridade: "media",
    } as any);

    // BUG 3 FIX: Ensure ultima_acao_at is updated (addAtividade already does this, but reinforce)
    await supabase.from("pipeline_leads").update({
      ultima_acao_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as any).eq("id", leadId);

    // Create follow-up task if requested
    if (followUp !== "none") {
      const fDate = followUp === "amanha"
        ? (() => { const d = new Date(); d.setDate(d.getDate() + 1); return dateToBRT(d); })()
        : followUpDate;
      if (fDate) {
        await onAddTarefa({
          titulo: `Follow-up: ${lead.nome}`,
          descricao: `Após: ${titulo}`,
          tipo: "follow_up",
          vence_em: fDate,
          prioridade: "media",
        } as any);
      }
    }

    setShowForm(false);
    setTipo("ligacao");
    setResultado("neutro");
    setDescricao("");
    setFollowUp("none");
    setFollowUpDate("");
    if (followUp === "none") {
      onNextAction?.();
    }
  };

  const handleSaveNota = async () => {
    const conteudo = novaNota.trim();
    if (!conteudo) return;
    setSavingNota(true);
    try {
      await onAddAnotacao(conteudo);
      setNovaNota("");
      setNovoHistoricoOpen(false);
      toast.success("Histórico adicionado");
    } catch (err) {
      console.error("Erro ao adicionar histórico:", err);
      toast.error("Erro ao adicionar histórico");
    } finally {
      setSavingNota(false);
    }
  };

  const handleDeleteItem = async () => {
    if (!deleteTarget?.sourceId || !deleteTarget.sourceType) return;
    setDeleting(true);
    try {
      const table = deleteTarget.sourceType === "atividade"
        ? "pipeline_atividades"
        : deleteTarget.sourceType === "historico"
          ? "pipeline_historico"
          : deleteTarget.sourceType === "tarefa"
            ? "pipeline_tarefas"
            : deleteTarget.sourceType === "anotacao"
              ? "pipeline_anotacoes"
              : null;
      if (!table) { toast.error("Este item não pode ser removido"); return; }
      const { error } = await supabase.from(table).delete().eq("id", deleteTarget.sourceId);
      if (error) throw error;
      toast.success("Registro removido do histórico");
      onReload();
    } catch (err) {
      console.error("Erro ao deletar:", err);
      toast.error("Erro ao remover registro");
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  return (
    <div className="pb-8">
      {/* Header padronizado (igual Tarefas/Visitas) */}
      <div className="px-7 pt-6 pb-4 flex justify-between items-end border-b border-zinc-100">
        <div>
          <div className="text-lg font-bold text-zinc-900 tracking-tight">Histórico</div>
          <div className="text-xs text-zinc-500 mt-0.5">
            {totalEventos} evento{totalEventos !== 1 ? "s" : ""}
            {totalNotas > 0 && <> · {totalNotas} nota{totalNotas !== 1 ? "s" : ""}</>}
          </div>
        </div>
        <button
          onClick={() => setNovoHistoricoOpen(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-4 py-2 text-xs font-medium flex items-center gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" /> Novo histórico
        </button>
      </div>

      {/* Timeline agrupada por dia (Drawer Wide v4) */}
      <div className="px-7 pt-4">
        <DrawerTimelineGroup
          items={timeline.slice(0, 30).map((item, i) => {
            const tipoGuess = (() => {
              const t = item.title.toLowerCase();
              if (item.sourceType === "anotacao") return "anotacao";
              if (item.sourceType === "historico") return "historico";
              if (item.sourceType === "tarefa") return "tarefa";
              if (item.sourceType === "imovel_event") return "imovel_event";
              if (/ligaç|liga[rç]|telefon/.test(t)) return "ligacao";
              if (/whats|mensagem/.test(t)) return "whatsapp";
              if (/email|e-mail/.test(t)) return "email";
              if (/visita|tour/.test(t)) return "visita";
              if (/reuni/.test(t)) return "reuniao";
              if (/follow/.test(t)) return "followup";
              if (/nota|anotaç/.test(t)) return "nota";
              if (/aceito|entrou|distribu/.test(t)) return "aceito";
              return undefined;
            })();
            return {
              id: `${item.sourceType ?? "x"}-${item.sourceId ?? i}-${item.date}`,
              title: item.title,
              description: item.autor
                ? `${item.description ? `${item.description} • ` : ""}por ${item.autor}`
                : item.description,

              date: item.date,
              tipo: tipoGuess,
              kind: item.sourceType as any,
              trailing: item.sourceId && item.sourceType !== "system" ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-destructive"
                  onClick={() => setDeleteTarget(item)}
                  title="Remover registro"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              ) : null,
            };
          })}
        />
      </div>

      {/* Modal Novo Histórico */}
      <Dialog
        open={novoHistoricoOpen}
        onOpenChange={(open) => {
          if (!open) {
            setNovoHistoricoOpen(false);
            setNovaNota("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <StickyNote className="h-4 w-4" /> Novo histórico
            </DialogTitle>
          </DialogHeader>
          <Textarea
            autoFocus
            rows={5}
            placeholder="Descreva o que aconteceu..."
            value={novaNota}
            onChange={(e) => setNovaNota(e.target.value)}
            className="text-sm"
          />
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setNovoHistoricoOpen(false);
                setNovaNota("");
              }}
              disabled={savingNota}
            >
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSaveNota} disabled={savingNota || !novaNota.trim()}>
              {savingNota ? "Adicionando..." : "Adicionar ao histórico"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* Confirmação de exclusão */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover registro do histórico?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-medium">{deleteTarget?.title}</span>
              <br />
              Esta ação não pode ser desfeita. O registro será permanentemente removido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteItem}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Removendo..." : "Remover"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
