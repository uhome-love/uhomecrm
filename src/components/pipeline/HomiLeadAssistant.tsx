import { useState, useCallback, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Bot, MessageSquare, ShieldQuestion, Send, FileText, Sparkles, Phone, CalendarCheck, RefreshCw, Clock, Target, Flame, Snowflake, Sun, ThermometerSun, Lightbulb, ClipboardList } from "lucide-react";
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

export default function HomiLeadAssistant({
  leadId, leadNome, leadTelefone, leadEmail, empreendimento, etapa, temperatura,
  observacoes, origem, origemDetalhe, createdAt, updatedAt, proximaAcao, valorEstimado, oportunidadeScore
}: Props) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [result, setResult] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [objecao, setObjecao] = useState("");
  const [history, setHistory] = useState<LeadHistory | null>(null);

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

  // Briefing
  const briefing = useMemo(() => {
    if (!history) return null;
    const diasComo = createdAt ? differenceInDays(new Date(), new Date(createdAt)) : 0;
    const horasUltima = history.ultimaAtividade ? differenceInHours(new Date(), new Date(history.ultimaAtividade)) : null;
    const tempoUltima = history.ultimaAtividade
      ? formatDistanceToNow(new Date(history.ultimaAtividade), { locale: ptBR, addSuffix: true })
      : "nunca";

    return {
      diasComo,
      horasUltima,
      tempoUltima,
      tentativasLigacao: history.tentativasLigacao,
      tentativasWhatsapp: history.tentativasWhatsapp,
      visitaMarcada: history.visitaMarcada,
      propostaEnviada: history.propostaEnviada,
    };
  }, [history, createdAt]);

  // Smart recommendation
  const recommendation = useMemo(() => {
    if (!history || !briefing) return null;
    const h = history;
    const b = briefing;

    // Never contacted
    if (h.atividades.length === 0) {
      return { text: "Lead novo sem contato. Priorize o primeiro contato agora — ligação é o canal mais efetivo para leads frescos.", action: "primeiro_contato" };
    }
    // Doesn't answer calls, try WhatsApp
    if (b.tentativasLigacao >= 2 && b.tentativasWhatsapp === 0) {
      return { text: `${b.tentativasLigacao} tentativas de ligação sem sucesso. Tente WhatsApp — melhor horário para este perfil: 14h-17h. Use template de reengajamento.`, action: "whatsapp" };
    }
    // Has visit but no proposal
    if (b.visitaMarcada && !b.propostaEnviada) {
      return { text: "Lead visitou o empreendimento mas ainda não recebeu proposta. Momento ideal para preparar e enviar uma proposta personalizada.", action: "proposta" };
    }
    // Has proposal 3+ days ago
    if (b.propostaEnviada && b.horasUltima && b.horasUltima > 72) {
      return { text: `Proposta enviada há mais de 3 dias sem retorno. Faça follow-up mencionando condições ou prazo para criar urgência.`, action: "followup_proposta" };
    }
    // Cold 7+ days
    if (b.horasUltima && b.horasUltima > 168) {
      return { text: `Lead sem interação há ${Math.floor(b.horasUltima / 24)} dias. Reengajamento urgente — traga uma novidade ou condição especial.`, action: "reengajamento" };
    }
    // Cold 3+ days
    if (b.horasUltima && b.horasUltima > 72) {
      return { text: `Sem contato há ${Math.floor(b.horasUltima / 24)} dias. Hora de retomar com uma abordagem leve e relevante.`, action: "followup" };
    }
    // Default
    return { text: "Lead em andamento. Continue o acompanhamento mantendo o ritmo de contato.", action: "mensagem" };
  }, [history, briefing]);

  // Contextual actions based on history
  const smartActions = useMemo((): SmartAction[] => {
    if (!recommendation) return [];
    const actions: SmartAction[] = [];

    switch (recommendation.action) {
      case "primeiro_contato":
        actions.push({ id: "primeiro_contato", label: "Script Primeiro Contato", icon: Phone, prompt: "Gere um script de primeiro contato para este lead. É o primeiro contato, nunca foi abordado.", highlight: true });
        actions.push({ id: "whatsapp_intro", label: "WhatsApp Apresentação", icon: MessageSquare, prompt: "Gere uma mensagem de WhatsApp de primeiro contato, apresentando-se como corretor." });
        break;
      case "whatsapp":
        actions.push({ id: "whatsapp_reengajamento", label: "WhatsApp Reengajamento", icon: MessageSquare, prompt: "Lead não atende ligações. Gere mensagem de WhatsApp para reengajar.", highlight: true });
        actions.push({ id: "script_ligacao", label: "Tentar Ligação", icon: Phone, prompt: "Script para mais uma tentativa de ligação." });
        break;
      case "proposta":
        actions.push({ id: "preparar_proposta", label: "Preparar Proposta", icon: FileText, prompt: "Lead visitou o empreendimento. Gere texto de proposta comercial personalizada.", highlight: true });
        actions.push({ id: "whatsapp_pos_visita", label: "WhatsApp Pós-Visita", icon: MessageSquare, prompt: "Mensagem pós-visita pedindo feedback e preparando terreno para proposta." });
        break;
      case "followup_proposta":
        actions.push({ id: "followup_proposta", label: "Follow-up Proposta", icon: Send, prompt: "Proposta enviada há dias sem retorno. Follow-up com urgência leve.", highlight: true });
        actions.push({ id: "ligacao_proposta", label: "Ligar sobre Proposta", icon: Phone, prompt: "Script para ligar perguntando sobre a proposta enviada." });
        break;
      case "reengajamento":
        actions.push({ id: "reengajamento", label: "Reengajamento", icon: RefreshCw, prompt: "Lead frio há muitos dias. Mensagem de reengajamento com novidade.", highlight: true });
        actions.push({ id: "script_reativacao", label: "Ligação Reativação", icon: Phone, prompt: "Script de ligação para reativar lead frio." });
        break;
      default:
        actions.push({ id: "mensagem", label: "Gerar Mensagem", icon: MessageSquare, prompt: "Gere mensagem de WhatsApp personalizada para este lead.", highlight: true });
        actions.push({ id: "followup", label: "Follow-up", icon: Send, prompt: "Gere follow-up para retomar contato." });
    }

    // Always add these
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
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
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

  const tempColor = temperatura === "quente" ? "text-destructive" : temperatura === "frio" ? "text-primary" : "text-warning";

  return (
    <Card className="p-3 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <div className="flex items-center gap-2 mb-3">
        <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
          <Bot className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h4 className="text-[11px] font-bold text-primary">Homi AI v2</h4>
          <p className="text-[9px] text-muted-foreground">Assistente contextual inteligente</p>
        </div>
      </div>

      {/* ═══ BRIEFING CARD ═══ */}
      {loadingHistory ? (
        <div className="flex items-center gap-2 py-3 justify-center">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
          <span className="text-[10px] text-muted-foreground">Analisando histórico...</span>
        </div>
      ) : briefing && (
        <div className="rounded-lg border border-primary/15 bg-primary/5 p-2.5 mb-3 space-y-1.5">
          <div className="flex items-center gap-1.5 mb-1">
            <ClipboardList className="h-3 w-3 text-primary" />
            <span className="text-[10px] font-bold text-primary">Briefing de {leadNome.split(" ")[0]}</span>
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
            <div className="flex items-center gap-1">
              <Clock className="h-2.5 w-2.5" />
              Lead há {briefing.diasComo} dia{briefing.diasComo !== 1 ? "s" : ""}
            </div>
            <div className="flex items-center gap-1">
              <Target className="h-2.5 w-2.5" />
              Origem: {origem || "N/A"}
            </div>
            <div className="flex items-center gap-1">
              <Phone className="h-2.5 w-2.5" />
              {briefing.tentativasLigacao} ligaç{briefing.tentativasLigacao !== 1 ? "ões" : "ão"}
            </div>
            <div className="flex items-center gap-1">
              <MessageSquare className="h-2.5 w-2.5" />
              {briefing.tentativasWhatsapp} WhatsApp{briefing.tentativasWhatsapp !== 1 ? "s" : ""}
            </div>
            {empreendimento && (
              <div className="col-span-2 flex items-center gap-1">
                🏠 {empreendimento}
              </div>
            )}
            <div className="col-span-2 flex items-center gap-1">
              <Clock className="h-2.5 w-2.5" />
              Última ação: {briefing.tempoUltima}
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Badge variant="outline" className={`text-[9px] h-4 ${tempColor}`}>
              {temperatura || "morno"}
            </Badge>
            {oportunidadeScore !== undefined && (
              <Badge variant="outline" className="text-[9px] h-4">
                Score: {oportunidadeScore}
              </Badge>
            )}
            {briefing.visitaMarcada && (
              <Badge variant="outline" className="text-[9px] h-4 text-success border-success/30">
                <CalendarCheck className="h-2.5 w-2.5 mr-0.5" /> Visita
              </Badge>
            )}
            {briefing.propostaEnviada && (
              <Badge variant="outline" className="text-[9px] h-4 text-primary border-primary/30">
                <FileText className="h-2.5 w-2.5 mr-0.5" /> Proposta
              </Badge>
            )}
          </div>
        </div>
      )}

      {/* ═══ SMART RECOMMENDATION ═══ */}
      {recommendation && !result && (
        <div className="rounded-lg border border-accent/30 bg-accent/10 p-2.5 mb-3">
          <div className="flex items-start gap-1.5">
            <Lightbulb className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
            <p className="text-[10px] text-accent-foreground leading-relaxed">
              <span className="font-bold">Recomendação:</span> {recommendation.text}
            </p>
          </div>
        </div>
      )}

      {/* ═══ CONTEXTUAL ACTIONS ═══ */}
      {!result && !loading && (
        <div className="grid grid-cols-2 gap-1.5 mb-3">
          {smartActions.map(action => {
            const Icon = action.icon;
            if (action.id === "objecao") {
              return (
                <Button
                  key={action.id}
                  variant="outline"
                  size="sm"
                  className="h-7 text-[10px] gap-1 justify-start"
                  onClick={() => setActiveAction("objecao_input")}
                  disabled={loading}
                >
                  <Icon className="h-3 w-3 shrink-0" />
                  {action.label}
                </Button>
              );
            }
            if (action.id === "custom") {
              return (
                <Button
                  key={action.id}
                  variant="outline"
                  size="sm"
                  className="h-7 text-[10px] gap-1 justify-start"
                  onClick={() => setActiveAction("custom_input")}
                  disabled={loading}
                >
                  <Icon className="h-3 w-3 shrink-0" />
                  {action.label}
                </Button>
              );
            }
            return (
              <Button
                key={action.id}
                variant={action.highlight ? "default" : "outline"}
                size="sm"
                className={`h-7 text-[10px] gap-1 justify-start ${action.highlight ? "ring-1 ring-primary/30" : ""}`}
                onClick={() => handleAction(action.id)}
                disabled={loading}
              >
                <Icon className="h-3 w-3 shrink-0" />
                {action.label}
              </Button>
            );
          })}
        </div>
      )}

      {/* Objection input */}
      {activeAction === "objecao_input" && (
        <div className="space-y-1.5 mb-3">
          <Textarea
            className="text-xs min-h-[40px]"
            placeholder="Qual objeção o cliente apresentou? Ex: Acho caro, preciso pensar..."
            value={objecao}
            onChange={e => setObjecao(e.target.value)}
          />
          <Button size="sm" className="w-full h-7 text-[10px]" onClick={() => handleAction("quebrar_objecao", objecao)} disabled={!objecao || loading}>
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            Gerar Resposta
          </Button>
        </div>
      )}

      {/* Custom prompt input */}
      {activeAction === "custom_input" && (
        <div className="flex gap-1.5 mb-3">
          <Textarea
            className="text-xs min-h-[36px] flex-1"
            placeholder="Pergunte algo à IA sobre este lead..."
            value={customPrompt}
            onChange={e => setCustomPrompt(e.target.value)}
            rows={1}
          />
          <Button size="sm" className="h-auto px-2" onClick={() => handleAction("custom", customPrompt)} disabled={!customPrompt || loading}>
            <Send className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* Loading */}
      {loading && !result && (
        <div className="flex items-center justify-center py-4 gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span className="text-xs text-muted-foreground">Analisando e gerando...</span>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="space-y-2">
          <div className="bg-background rounded-lg border border-border p-3 text-xs prose prose-sm max-w-none dark:prose-invert">
            <ReactMarkdown>{result}</ReactMarkdown>
          </div>
          <div className="flex gap-1.5">
            <Button variant="outline" size="sm" className="h-6 text-[10px] flex-1" onClick={handleCopy}>
              📋 Copiar
            </Button>
            <Button variant="outline" size="sm" className="h-6 text-[10px] flex-1" onClick={() => { setResult(""); setActiveAction(null); setCustomPrompt(""); setObjecao(""); }}>
              Nova consulta
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
