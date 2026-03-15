import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Plus, Pin, PinOff, Send, StickyNote, ArrowRight, CheckCircle2,
  PhoneCall, MessageSquare, Video, MapPin, FileText, Clock, ClipboardList,
  Building2, Share2, Search as SearchIcon
} from "lucide-react";
import { formatDateSafe, parseDateTimeSafe } from "@/lib/utils";
import { ptBR } from "date-fns/locale";
import { todayBRT, dateToBRT } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { PipelineAtividade, PipelineAnotacao, PipelineTarefa, PipelineHistorico } from "@/hooks/usePipelineLeadData";
import type { PipelineStage, PipelineLead } from "@/hooks/usePipeline";
import { useLeadImoveisEvents, type LeadImovelEvent } from "@/hooks/useLeadImoveisEvents";

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
  onAddTarefa: (data: Partial<PipelineTarefa>) => Promise<void>;
  onReload: () => void;
}

const ATIVIDADE_TIPOS: Record<string, { label: string; icon: any }> = {
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
};

interface TimelineItem {
  title: string;
  description?: string;
  date: string;
  icon: any;
  color: string;
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

function buildTimeline(historico: PipelineHistorico[], atividades: PipelineAtividade[], tarefas: PipelineTarefa[], stages: PipelineStage[], lead: PipelineLead, imovelEvents?: LeadImovelEvent[]): TimelineItem[] {
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
    const info = ATIVIDADE_TIPOS[a.tipo];
    items.push({
      title: info?.label || a.titulo,
      description: `${a.titulo} • ${a.status === "concluida" ? "✅" : "⏳"}`,
      date: a.created_at,
      icon: info?.icon || PhoneCall,
      color: a.status === "concluida" ? "bg-green-100 text-green-600" : "bg-blue-100 text-blue-600",
    });
  }

  for (const t of tarefas) {
    if (t.status === "concluida" && t.concluida_em) {
      items.push({ title: `✅ ${t.titulo}`, date: t.concluida_em, icon: CheckCircle2, color: "bg-green-100 text-green-600" });
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

  if (lead.aceito_em) {
    items.push({ title: "✅ Lead aceito", date: lead.aceito_em, icon: CheckCircle2, color: "bg-emerald-100 text-emerald-600" });
  }
  if (lead.distribuido_em) {
    items.push({ title: "🔄 Lead distribuído", date: lead.distribuido_em, icon: ArrowRight, color: "bg-blue-100 text-blue-600" });
  }

  items.sort((a, b) => (parseDateTimeSafe(b.date)?.getTime() ?? 0) - (parseDateTimeSafe(a.date)?.getTime() ?? 0));
  return items;
}

export default function LeadHistoricoTab({ leadId, lead, stages, atividades, anotacoes, tarefas, historico, onAddAtividade, onAddAnotacao, onToggleFixar, onAddTarefa, onReload }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [tipo, setTipo] = useState("ligacao");
  const [resultado, setResultado] = useState("neutro");
  const [descricao, setDescricao] = useState("");
  const [followUp, setFollowUp] = useState<"none" | "amanha" | "custom">("none");
  const [followUpDate, setFollowUpDate] = useState("");
  const [newNota, setNewNota] = useState("");

  const { data: imovelEvents } = useLeadImoveisEvents(leadId);

  const timeline = buildTimeline(historico, atividades, tarefas, stages, lead, imovelEvents);

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
  };

  const handleAddNota = async () => {
    if (!newNota.trim()) return;
    await onAddAnotacao(newNota.trim());
    setNewNota("");
  };

  return (
    <div className="px-6 pb-8 space-y-5 mt-0">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-foreground">📝 Histórico</h4>
        <Button variant="outline" size="sm" className="h-9 text-sm gap-1.5" onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4" /> Registrar Atividade
        </Button>
      </div>

      {/* Register form — inline */}
      {showForm && (
        <div className="border border-primary/30 rounded-xl p-4 space-y-3 bg-primary/5">
          <p className="text-xs font-semibold text-foreground">➕ Registrar Atividade</p>

          {/* Tipo buttons */}
          <div>
            <label className="text-xs text-muted-foreground font-medium">O que foi feito:</label>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {ATIVIDADE_BUTTONS.map(t => (
                <button
                  key={t.value}
                  onClick={() => setTipo(t.value)}
                  className={`text-xs px-2.5 py-1.5 rounded-md border transition-colors ${
                    tipo === t.value
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background border-border hover:border-primary/50"
                  }`}
                >
                  {t.emoji} {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Resultado */}
          <div>
            <label className="text-xs text-muted-foreground font-medium">Resultado:</label>
            <div className="flex gap-1.5 mt-1">
              {RESULTADO_OPTIONS.map(r => (
                <button
                  key={r.value}
                  onClick={() => setResultado(r.value)}
                  className={`text-xs px-3 py-1.5 rounded-md border transition-colors ${
                    resultado === r.value
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background border-border hover:border-primary/50"
                  }`}
                >
                  {r.emoji} {r.label}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-xs text-muted-foreground font-medium">O que aconteceu:</label>
            <Textarea className="mt-1 text-sm" placeholder="Ex: Cliente atendeu, pediu proposta por email" value={descricao} onChange={e => setDescricao(e.target.value)} rows={2} />
          </div>

          {/* Follow-up */}
          <div>
            <label className="text-xs text-muted-foreground font-medium">Agendar follow-up?</label>
            <div className="flex items-center gap-1.5 mt-1">
              <button
                onClick={() => setFollowUp(followUp === "amanha" ? "none" : "amanha")}
                className={`text-xs px-3 py-1.5 rounded-md border transition-colors ${
                  followUp === "amanha" ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:border-primary/50"
                }`}
              >
                Sim → Amanhã
              </button>
              <button
                onClick={() => setFollowUp(followUp === "custom" ? "none" : "custom")}
                className={`text-xs px-3 py-1.5 rounded-md border transition-colors ${
                  followUp === "custom" ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:border-primary/50"
                }`}
              >
                Sim → Escolher data
              </button>
              <button
                onClick={() => setFollowUp("none")}
                className={`text-xs px-3 py-1.5 rounded-md border transition-colors ${
                  followUp === "none" ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:border-primary/50"
                }`}
              >
                Não
              </button>
            </div>
            {followUp === "custom" && (
              <Input type="date" className="h-8 text-xs mt-2 w-40" value={followUpDate} onChange={e => setFollowUpDate(e.target.value)} />
            )}
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button size="sm" className="h-8 text-xs" onClick={handleSave}>💾 Salvar</Button>
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="relative">
        <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />
        <div className="space-y-0">
          {timeline.slice(0, 15).map((item, i) => (
            <div key={i} className="relative flex gap-4 pb-4">
              <div className={`relative z-10 h-7 w-7 rounded-full flex items-center justify-center shrink-0 ${item.color}`}>
                <item.icon className="h-3.5 w-3.5" />
              </div>
              <div className="pt-0.5">
                <p className="text-sm font-medium text-foreground">{item.title}</p>
                {item.description && <p className="text-xs text-muted-foreground">{item.description}</p>}
                <p className="text-xs text-muted-foreground/60">{formatDateSafe(item.date, "dd/MM 'às' HH:mm", { locale: ptBR, fallback: "Data inválida" })}</p>
              </div>
            </div>
          ))}
          {/* Lead origin entry */}
          <div className="relative flex gap-4 pb-4">
            <div className="relative z-10 h-7 w-7 rounded-full flex items-center justify-center shrink-0 bg-green-100 text-green-600">
              <Plus className="h-3.5 w-3.5" />
            </div>
            <div className="pt-0.5">
              <p className="text-sm font-medium text-foreground">Lead entrou no pipeline</p>
              <LeadOrigemInfo lead={lead} />
              <p className="text-xs text-muted-foreground/60">{formatDateSafe(lead.created_at, "dd/MM 'às' HH:mm", { locale: ptBR, fallback: "Data inválida" })}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Notas */}
      <div className="border-t border-border/50 pt-4 space-y-3">
        <h5 className="text-sm font-bold text-muted-foreground flex items-center gap-1.5">
          <StickyNote className="h-4 w-4" /> Notas
        </h5>
        <div className="flex gap-2">
          <Input className="h-9 text-sm flex-1" placeholder="Adicionar nota..." value={newNota} onChange={e => setNewNota(e.target.value)} onKeyDown={e => e.key === "Enter" && handleAddNota()} />
          <Button size="sm" className="h-9 w-9 p-0" onClick={handleAddNota} disabled={!newNota.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
        {anotacoes.map(nota => (
          <div key={nota.id} className={`p-3 rounded-xl border ${nota.fixada ? "border-amber-300 bg-amber-50/50 dark:bg-amber-950/20" : "border-border/50 bg-card"}`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold">{nota.autor_nome || "Usuário"}</span>
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">{formatDateSafe(nota.created_at, "dd/MM HH:mm", { locale: ptBR, fallback: "Data inválida" })}</span>
                <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => onToggleFixar(nota.id, nota.fixada)}>
                  {nota.fixada ? <PinOff className="h-3 w-3 text-amber-500" /> : <Pin className="h-3 w-3 text-muted-foreground" />}
                </Button>
              </div>
            </div>
            <p className="text-sm whitespace-pre-wrap">{nota.conteudo}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
