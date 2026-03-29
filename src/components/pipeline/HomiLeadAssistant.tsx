import { useState, useCallback, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Loader2, Bot, MessageSquare, ShieldQuestion, Send, FileText, Sparkles, Phone, CalendarCheck, RefreshCw, Clock, Target, Flame, Snowflake, Sun, ThermometerSun, Lightbulb, ClipboardList, ChevronDown, Copy, ExternalLink } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { formatDistanceToNowSafe, differenceInDaysSafe, differenceInHoursSafe } from "@/lib/utils";
import { ptBR } from "date-fns/locale";

interface Props {
  leadId: string;
  leadNome: string;
  leadTelefone?: string | null;
  leadEmail?: string | null;
  empreendimento?: string | null;
  etapa: string;
  temperatura?: string;
  observacoes?: string | null;
  origem?: string | null;
  origemDetalhe?: string | null;
  createdAt?: string;
  updatedAt?: string;
  proximaAcao?: string | null;
  valorEstimado?: number | null;
  oportunidadeScore?: number;
  initialPrompt?: string;
  onClearInitialPrompt?: () => void;
  isDirectMode?: boolean;
}

interface LeadHistory {
  atividades: { tipo: string; titulo: string; status: string; created_at: string }[];
  anotacoes: { conteudo: string; created_at: string }[];
  historico: { stage_anterior_id: string | null; stage_novo_id: string; observacao: string | null; created_at: string }[];
  tentativasLigacao: number;
  tentativasWhatsapp: number;
  ultimaAtividade: string | null;
  visitaMarcada: boolean;
  propostaEnviada: boolean;
}

type SmartAction = {
  id: string;
  label: string;
  icon: React.ElementType;
  prompt: string;
  highlight?: boolean;
};

// ═══════════════════════════════════════════════════
// RESULT SECTION CARD — individual copyable section
// ═══════════════════════════════════════════════════
function ResultSectionCard({ title, body, leadTelefone, isActionable, defaultOpen }: {
  title: string;
  body: string;
  leadTelefone?: string | null;
  isActionable: boolean;
  defaultOpen: boolean;
}) {
  const isWhatsApp = /💬|🔄|whatsapp|mensagem/i.test(title);
  const isScript = /📞|script|ligação/i.test(title);
  const [open, setOpen] = useState(defaultOpen);

  const handleCopySection = () => {
    navigator.clipboard.writeText(body);
    toast.success("Copiado!");
  };

  const handleWhatsApp = () => {
    const phone = (leadTelefone || "").replace(/\D/g, "");
    const fullPhone = phone.startsWith("55") ? phone : `55${phone}`;
    navigator.clipboard.writeText(body);
    window.open(`https://wa.me/${fullPhone}?text=${encodeURIComponent(body)}`, "_blank");
  };

  if (!isActionable) {
    // Informational sections — collapsible, subtle
    return (
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-border/40 bg-muted/30 hover:bg-muted/50 transition-colors">
          <span className="text-[11px] font-medium text-muted-foreground">{title}</span>
          <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
        </CollapsibleTrigger>
        <CollapsibleContent className="px-3 py-2 text-[11px] text-muted-foreground prose prose-sm max-w-none dark:prose-invert leading-relaxed">
          <ReactMarkdown>{body}</ReactMarkdown>
        </CollapsibleContent>
      </Collapsible>
    );
  }

  // Actionable sections — WhatsApp / Script — prominent
  return (
    <div className={`rounded-xl border-2 p-3 space-y-2.5 ${
      isWhatsApp ? "border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20" :
      isScript ? "border-primary/30 bg-primary/5" :
      "border-border bg-background"
    }`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold">{title}</span>
        {isWhatsApp && <Badge variant="outline" className="text-[9px] h-4 border-emerald-500/30 text-emerald-600">WhatsApp</Badge>}
        {isScript && <Badge variant="outline" className="text-[9px] h-4 border-primary/30 text-primary">Ligação</Badge>}
      </div>
      <div className="text-xs prose prose-sm max-w-none dark:prose-invert leading-relaxed [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
        <ReactMarkdown>{body}</ReactMarkdown>
      </div>
      <div className="flex gap-2 pt-1">
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs gap-1.5 flex-1"
          onClick={handleCopySection}
        >
          <Copy className="h-3.5 w-3.5" />
          Copiar
        </Button>
        {isWhatsApp && leadTelefone && (
          <Button
            size="sm"
            className="h-8 text-xs gap-1.5 flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={handleWhatsApp}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Enviar WhatsApp
          </Button>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════
export default function HomiLeadAssistant({
  leadId, leadNome, leadTelefone, leadEmail, empreendimento, etapa, temperatura,
  observacoes, origem, origemDetalhe, createdAt, updatedAt, proximaAcao, valorEstimado, oportunidadeScore,
  initialPrompt, onClearInitialPrompt, isDirectMode
}: Props) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [result, setResult] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [objecao, setObjecao] = useState("");
  const [clientSaid, setClientSaid] = useState("");
  const [history, setHistory] = useState<LeadHistory | null>(null);
  const [showExploreMode, setShowExploreMode] = useState(false);

  // Fetch lead history on mount
  useEffect(() => {
    if (!leadId) return;
    const fetchHistory = async () => {
      setLoadingHistory(true);
      const [atRes, anRes, hRes] = await Promise.all([
        supabase.from("pipeline_atividades").select("tipo, titulo, status, created_at").eq("pipeline_lead_id", leadId).order("created_at", { ascending: false }).limit(20),
        supabase.from("pipeline_anotacoes").select("conteudo, created_at").eq("pipeline_lead_id", leadId).order("created_at", { ascending: false }).limit(10),
        supabase.from("pipeline_historico").select("stage_anterior_id, stage_novo_id, observacao, created_at").eq("pipeline_lead_id", leadId).order("created_at", { ascending: false }).limit(10),
      ]);

      const atividades = atRes.data || [];
      const tentativasLigacao = atividades.filter(a => a.tipo === "ligacao").length;
      const tentativasWhatsapp = atividades.filter(a => a.tipo === "whatsapp").length;
      const ultimaAtividade = atividades.length > 0 ? atividades[0].created_at : null;
      const visitaMarcada = atividades.some(a => a.tipo === "visita" && a.status !== "cancelado");
      const propostaEnviada = atividades.some(a => a.tipo === "proposta");

      setHistory({
        atividades,
        anotacoes: anRes.data || [],
        historico: hRes.data || [],
        tentativasLigacao,
        tentativasWhatsapp,
        ultimaAtividade,
        visitaMarcada,
        propostaEnviada,
      });
      setLoadingHistory(false);
    };
    fetchHistory();
  }, [leadId]);

  // Auto-execute when initialPrompt is provided from StageCoachBar
  useEffect(() => {
    if (initialPrompt && !loading && !loadingHistory && history) {
      handleAction("custom", initialPrompt);
      onClearInitialPrompt?.();
    }
  }, [initialPrompt, loadingHistory]);

  // Briefing
  const briefing = useMemo(() => {
    if (!history) return null;
    const diasComo = differenceInDaysSafe(createdAt) ?? 0;
    const horasUltima = differenceInHoursSafe(history.ultimaAtividade);
    const tempoUltima = history.ultimaAtividade
      ? formatDistanceToNowSafe(history.ultimaAtividade, { locale: ptBR, addSuffix: true, fallback: "nunca" })
      : "nunca";

    return { diasComo, horasUltima, tempoUltima, tentativasLigacao: history.tentativasLigacao, tentativasWhatsapp: history.tentativasWhatsapp, visitaMarcada: history.visitaMarcada, propostaEnviada: history.propostaEnviada };
  }, [history, createdAt]);

  // Smart recommendation
  const recommendation = useMemo(() => {
    if (!history || !briefing) return null;
    const h = history;
    const b = briefing;
    if (h.atividades.length === 0) return { text: "Lead novo sem contato. Priorize o primeiro contato agora.", action: "primeiro_contato" };
    if (b.tentativasLigacao >= 2 && b.tentativasWhatsapp === 0) return { text: `${b.tentativasLigacao} ligações sem sucesso. Tente WhatsApp.`, action: "whatsapp" };
    if (b.visitaMarcada && !b.propostaEnviada) return { text: "Lead visitou. Hora da proposta.", action: "proposta" };
    if (b.propostaEnviada && b.horasUltima && b.horasUltima > 72) return { text: "Proposta enviada há 3+ dias. Faça follow-up.", action: "followup_proposta" };
    if (b.horasUltima && b.horasUltima > 168) return { text: `Sem contato há ${Math.floor(b.horasUltima / 24)} dias. Reengaje.`, action: "reengajamento" };
    if (b.horasUltima && b.horasUltima > 72) return { text: `Sem contato há ${Math.floor(b.horasUltima / 24)} dias. Retome.`, action: "followup" };
    return { text: "Continue o acompanhamento.", action: "mensagem" };
  }, [history, briefing]);

  // Contextual actions
  const smartActions = useMemo((): SmartAction[] => {
    if (!recommendation) return [];
    const actions: SmartAction[] = [];
    switch (recommendation.action) {
      case "primeiro_contato":
        actions.push({ id: "primeiro_contato", label: "Script Primeiro Contato", icon: Phone, prompt: "Gere um script de primeiro contato para este lead.", highlight: true });
        actions.push({ id: "whatsapp_intro", label: "WhatsApp Apresentação", icon: MessageSquare, prompt: "Gere uma mensagem de WhatsApp de primeiro contato." });
        break;
      case "whatsapp":
        actions.push({ id: "whatsapp_reengajamento", label: "WhatsApp Reengajamento", icon: MessageSquare, prompt: "Lead não atende ligações. Gere mensagem de WhatsApp para reengajar.", highlight: true });
        actions.push({ id: "script_ligacao", label: "Tentar Ligação", icon: Phone, prompt: "Script para mais uma tentativa de ligação." });
        break;
      case "proposta":
        actions.push({ id: "preparar_proposta", label: "Preparar Proposta", icon: FileText, prompt: "Lead visitou. Gere proposta personalizada.", highlight: true });
        actions.push({ id: "whatsapp_pos_visita", label: "WhatsApp Pós-Visita", icon: MessageSquare, prompt: "Mensagem pós-visita pedindo feedback." });
        break;
      case "followup_proposta":
        actions.push({ id: "followup_proposta", label: "Follow-up Proposta", icon: Send, prompt: "Follow-up com urgência leve sobre proposta.", highlight: true });
        actions.push({ id: "ligacao_proposta", label: "Ligar sobre Proposta", icon: Phone, prompt: "Script para ligar sobre proposta." });
        break;
      case "reengajamento":
        actions.push({ id: "reengajamento", label: "Reengajamento", icon: RefreshCw, prompt: "Mensagem de reengajamento com novidade.", highlight: true });
        actions.push({ id: "script_reativacao", label: "Ligação Reativação", icon: Phone, prompt: "Script para reativar lead frio." });
        break;
      default:
        actions.push({ id: "mensagem", label: "Gerar Mensagem", icon: MessageSquare, prompt: "Gere mensagem de WhatsApp personalizada.", highlight: true });
        actions.push({ id: "followup", label: "Follow-up", icon: Send, prompt: "Gere follow-up para retomar contato." });
    }
    actions.push({ id: "objecao", label: "Quebrar Objeção", icon: ShieldQuestion, prompt: "" });
    actions.push({ id: "custom", label: "Perguntar à IA", icon: Sparkles, prompt: "" });
    return actions;
  }, [recommendation]);

  const buildHistoryContext = useCallback(() => {
    if (!history) return "";
    const lines: string[] = [];
    lines.push("HISTÓRICO DE ATIVIDADES (mais recentes primeiro):");
    for (const a of history.atividades.slice(0, 10)) {
      lines.push(`- [${a.created_at.slice(0, 16)}] ${a.tipo}: ${a.titulo} (${a.status})`);
    }
    if (history.anotacoes.length > 0) {
      lines.push("\nANOTAÇÕES DO CORRETOR:");
      for (const n of history.anotacoes.slice(0, 5)) {
        lines.push(`- [${n.created_at.slice(0, 16)}] ${n.conteudo.slice(0, 200)}`);
      }
    }
    if (history.historico.length > 0) {
      lines.push("\nMOVIMENTAÇÕES NO FUNIL:");
      for (const h of history.historico.slice(0, 5)) {
        lines.push(`- [${h.created_at.slice(0, 16)}] Movido${h.observacao ? ` — ${h.observacao}` : ""}`);
      }
    }
    return lines.join("\n");
  }, [history]);

  const handleAction = useCallback(async (actionId: string, extraContext?: string) => {
    if (!user) return;
    setLoading(true);
    setActiveAction(actionId);
    setResult("");

    const action = smartActions.find(a => a.id === actionId);
    const histCtx = buildHistoryContext();

    const context = `
DADOS DO LEAD:
Nome: ${leadNome}
Telefone: ${leadTelefone || "N/A"}
Email: ${leadEmail || "N/A"}
Empreendimento: ${empreendimento || "N/A"}
Etapa do funil: ${etapa}
Temperatura: ${temperatura || "morno"}
Origem: ${origem || "N/A"} ${origemDetalhe ? `(${origemDetalhe})` : ""}
Score de oportunidade: ${oportunidadeScore || "N/A"}
Valor estimado: ${valorEstimado ? `R$ ${valorEstimado.toLocaleString("pt-BR")}` : "N/A"}
Próxima ação definida: ${proximaAcao || "Nenhuma"}
Observações: ${observacoes || "Nenhuma"}
Lead há: ${briefing?.diasComo || 0} dias
Última ação: ${briefing?.tempoUltima || "nunca"}
Tentativas de ligação: ${briefing?.tentativasLigacao || 0}
Tentativas de WhatsApp: ${briefing?.tentativasWhatsapp || 0}
Visita marcada: ${briefing?.visitaMarcada ? "Sim" : "Não"}
Proposta enviada: ${briefing?.propostaEnviada ? "Sim" : "Não"}
${extraContext ? `\nContexto adicional: ${extraContext}` : ""}

${histCtx}
    `.trim();

    try {
      const session = await (supabase.auth as any).getSession();
      const token = session.data?.session?.access_token;
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/homi-assistant`;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          acao: actionId,
          empreendimento: empreendimento || "Geral",
          situacao: `${etapa} | Temp: ${temperatura || "morno"} | ${briefing?.tentativasLigacao || 0} ligações, ${briefing?.tentativasWhatsapp || 0} WhatsApps`,
          objetivo: action?.prompt || customPrompt,
          role: "corretor",
          lead_context: context,
        }),
      });

      if (!resp.ok) {
        if (resp.status === 429) { toast.error("Limite de requisições. Tente novamente."); return; }
        if (resp.status === 402) { toast.error("Créditos insuficientes."); return; }
        throw new Error("Erro na IA");
      }

      const data = await resp.json();
      setResult(data.content || "Sem resposta.");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao gerar resposta");
    } finally {
      setLoading(false);
    }
  }, [user, leadNome, leadTelefone, leadEmail, empreendimento, etapa, temperatura, observacoes, origem, origemDetalhe, oportunidadeScore, valorEstimado, proximaAcao, customPrompt, briefing, smartActions, buildHistoryContext]);

  const handleCopy = () => {
    navigator.clipboard.writeText(result);
    toast.success("Texto copiado!");
  };

  // Parse result into sections
  const parsedSections = useMemo(() => {
    if (!result) return [];
    const sections = result.split(/^## /m).filter(Boolean).map(s => {
      const nl = s.indexOf("\n");
      return { title: s.slice(0, nl).trim(), body: s.slice(nl + 1).trim() };
    });
    return sections;
  }, [result]);

  // In direct mode, filter out non-actionable sections (analysis, briefing, alerts, etc.)
  const EXCLUDED_DIRECT_MODE_PATTERNS = /análise|briefing|alerta|próxima ação|recomendação|próximos passos|observação/i;
  const INCLUDED_DIRECT_MODE_PATTERNS = /whatsapp|script|mensagem|ligação|versão|proposta|follow|objeção|anti.?no.?show|💬|📞|🔄/i;

  const displaySections = useMemo(() => {
    if (!isDirectMode) return parsedSections;
    // In direct mode, only show actionable sections
    return parsedSections.filter(sec => {
      if (EXCLUDED_DIRECT_MODE_PATTERNS.test(sec.title)) return false;
      if (INCLUDED_DIRECT_MODE_PATTERNS.test(sec.title)) return true;
      // If no match, include by default (could be a custom format)
      return true;
    });
  }, [parsedSections, isDirectMode]);

  const isActionableSection = (title: string) => /💬|🔄|📞|whatsapp|mensagem|script|ligação/i.test(title);

  // ═══════════════════════════════════════════════
  // DIRECT MODE — Clean, focused on results only
  // ═══════════════════════════════════════════════
  if (isDirectMode) {
    return (
      <div className="space-y-3">
        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="text-xs text-muted-foreground">Gerando para {leadNome.split(" ")[0]}...</span>
          </div>
        )}

        {/* Results */}
        {result && !loading && (
           <div className="space-y-2.5">
            {displaySections.length > 1 ? (
              displaySections.map((sec, i) => (
                <ResultSectionCard
                  key={i}
                  title={sec.title}
                  body={sec.body}
                  leadTelefone={leadTelefone}
                  isActionable={isActionableSection(sec.title)}
                  defaultOpen={true}
                />
              ))
            ) : result ? (
              <div className="rounded-xl border border-border p-4 text-xs prose prose-sm max-w-none dark:prose-invert leading-relaxed [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                <ReactMarkdown>{result}</ReactMarkdown>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <Button variant="outline" size="sm" className="h-8 text-xs flex-1 gap-1.5" onClick={handleCopy}>
                <Copy className="h-3.5 w-3.5" />
                Copiar tudo
              </Button>
              <Button variant="outline" size="sm" className="h-8 text-xs flex-1 gap-1.5" onClick={() => { setResult(""); setShowExploreMode(true); }}>
                <Sparkles className="h-3.5 w-3.5" />
                Nova consulta
              </Button>
            </div>
          </div>
        )}

        {/* After clicking "Nova consulta" in direct mode, show explore */}
        {showExploreMode && !loading && !result && <ExploreView />}
      </div>
    );
  }

  // ═══════════════════════════════════════════════
  // EXPLORE MODE — Full panel with briefing + actions
  // ═══════════════════════════════════════════════
  function ExploreView() {
    return (
      <>
        {/* Briefing — collapsible */}
        {loadingHistory ? (
          <div className="flex items-center gap-2 py-3 justify-center">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
            <span className="text-[10px] text-muted-foreground">Analisando...</span>
          </div>
        ) : briefing && (
          <Collapsible defaultOpen={false}>
            <CollapsibleTrigger className="w-full flex items-center justify-between rounded-lg border border-primary/15 bg-primary/5 p-2.5 hover:bg-primary/10 transition-colors">
              <span className="text-[10px] font-bold text-primary flex items-center gap-1.5">
                <ClipboardList className="h-3 w-3" /> Briefing de {leadNome.split(" ")[0]}
              </span>
              <ChevronDown className="h-3 w-3 text-primary" />
            </CollapsibleTrigger>
            <CollapsibleContent className="p-2.5 space-y-1.5">
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
                <div className="flex items-center gap-1"><Clock className="h-2.5 w-2.5" /> Lead há {briefing.diasComo}d</div>
                <div className="flex items-center gap-1"><Target className="h-2.5 w-2.5" /> {origem || "N/A"}</div>
                <div className="flex items-center gap-1"><Phone className="h-2.5 w-2.5" /> {briefing.tentativasLigacao} lig.</div>
                <div className="flex items-center gap-1"><MessageSquare className="h-2.5 w-2.5" /> {briefing.tentativasWhatsapp} WA</div>
                <div className="col-span-2 flex items-center gap-1"><Clock className="h-2.5 w-2.5" /> Última: {briefing.tempoUltima}</div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Recommendation */}
        {recommendation && !result && (
          <div className="rounded-lg border border-accent/30 bg-accent/10 p-2.5">
            <div className="flex items-start gap-1.5">
              <Lightbulb className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
              <p className="text-[10px] text-accent-foreground leading-relaxed">
                <span className="font-bold">Recomendação:</span> {recommendation.text}
              </p>
            </div>
          </div>
        )}

        {/* Actions grid */}
        {!result && !loading && (
          <div className="grid grid-cols-2 gap-1.5">
            {smartActions.map(action => {
              const Icon = action.icon;
              if (action.id === "objecao") {
                return (
                  <Button key={action.id} variant="outline" size="sm" className="h-8 text-[10px] gap-1 justify-start" onClick={() => setActiveAction("objecao_input")} disabled={loading}>
                    <Icon className="h-3 w-3 shrink-0" /><span className="truncate">{action.label}</span>
                  </Button>
                );
              }
              if (action.id === "custom") {
                return (
                  <Button key={action.id} variant="outline" size="sm" className="h-8 text-[10px] gap-1 justify-start" onClick={() => setActiveAction("custom_input")} disabled={loading}>
                    <Icon className="h-3 w-3 shrink-0" /><span className="truncate">{action.label}</span>
                  </Button>
                );
              }
              return (
                <Button key={action.id} variant={action.highlight ? "default" : "outline"} size="sm" className={`h-8 text-[10px] gap-1 justify-start ${action.highlight ? "ring-1 ring-primary/30" : ""}`} onClick={() => handleAction(action.id)} disabled={loading}>
                  <Icon className="h-3 w-3 shrink-0" /><span className="truncate">{action.label}</span>
                </Button>
              );
            })}
          </div>
        )}

        {/* Objection input */}
        {activeAction === "objecao_input" && (
          <div className="space-y-1.5">
            <Textarea className="text-xs min-h-[40px]" placeholder="Qual objeção? Ex: Acho caro..." value={objecao} onChange={e => setObjecao(e.target.value)} />
            <Button size="sm" className="w-full h-7 text-[10px]" onClick={() => handleAction("quebrar_objecao", objecao)} disabled={!objecao || loading}>
              {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />} Gerar Resposta
            </Button>
          </div>
        )}

        {/* Custom prompt */}
        {activeAction === "custom_input" && (
          <div className="flex gap-1.5">
            <Textarea className="text-xs min-h-[36px] flex-1" placeholder="Pergunte algo à IA..." value={customPrompt} onChange={e => setCustomPrompt(e.target.value)} rows={1} />
            <Button size="sm" className="h-auto px-2" onClick={() => handleAction("custom", customPrompt)} disabled={!customPrompt || loading}>
              <Send className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}

        {/* Client said */}
        {!result && !loading && (
          <div className="space-y-1">
            <label className="text-[10px] font-medium text-muted-foreground">💬 O que o cliente disse?</label>
            <Textarea className="text-xs min-h-[36px]" placeholder="Cole a mensagem do cliente..." value={clientSaid} onChange={e => setClientSaid(e.target.value)} rows={2} />
            {clientSaid && (
              <Button size="sm" className="w-full h-7 text-[10px] gap-1" onClick={() => handleAction("responder_cliente", `O CLIENTE DISSE: "${clientSaid}". Gere uma resposta personalizada.`)} disabled={loading}>
                <Sparkles className="h-3 w-3" /> Gerar resposta
              </Button>
            )}
          </div>
        )}

        {/* Loading */}
        {loading && !result && (
          <div className="flex items-center justify-center py-4 gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span className="text-xs text-muted-foreground">Analisando...</span>
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-2.5">
            {parsedSections.length > 1 ? (
              parsedSections.map((sec, i) => (
                <ResultSectionCard
                  key={i}
                  title={sec.title}
                  body={sec.body}
                  leadTelefone={leadTelefone}
                  isActionable={isActionableSection(sec.title)}
                  defaultOpen={isActionableSection(sec.title)}
                />
              ))
            ) : (
              <div className="rounded-xl border border-border p-4 text-xs prose prose-sm max-w-none dark:prose-invert leading-relaxed [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                <ReactMarkdown>{result}</ReactMarkdown>
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <Button variant="outline" size="sm" className="h-8 text-xs flex-1 gap-1.5" onClick={handleCopy}>
                <Copy className="h-3.5 w-3.5" /> Copiar tudo
              </Button>
              <Button variant="outline" size="sm" className="h-8 text-xs flex-1 gap-1.5" onClick={() => { setResult(""); setActiveAction(null); setCustomPrompt(""); setObjecao(""); setClientSaid(""); }}>
                <Sparkles className="h-3.5 w-3.5" /> Nova consulta
              </Button>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="space-y-3">
      <ExploreView />
    </div>
  );
}
