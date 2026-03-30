// =============================================================================
// Componente: OportunidadesDoDia (v3)
// Home do corretor — saudação, status, credenciamento roleta, oportunidades.
// =============================================================================

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useElegibilidadeRoleta } from "@/hooks/useElegibilidadeRoleta";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Phone,
  MessageSquare,
  Flame,
  Clock,
  Zap,
  Trophy,
  ChevronRight,
  RefreshCw,
  Wifi,
  WifiOff,
  AlertTriangle,
  ListTodo,
  Target,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Frases motivacionais (rotação diária)
// ---------------------------------------------------------------------------
const FRASES_MOTIVACIONAIS = [
  "Cada ligação é uma oportunidade. Não deixe nenhuma escapar.",
  "Seu próximo cliente está esperando por você agora.",
  "Consistência bate talento quando o talento não é consistente.",
  "A visita marcada hoje é a comissão do mês que vem.",
  "Quem atende rápido, vende mais. Seja o primeiro.",
  "Um follow-up a mais pode ser a diferença entre perder e fechar.",
  "O lead que você ignorar hoje, outro corretor vai fechar amanhã.",
  "Grandes vendedores não esperam oportunidades — eles criam.",
  "Cada 'não' te aproxima do próximo 'sim'.",
  "Seu pipeline é o seu salário do futuro. Cuide dele.",
  "A melhor hora para ligar para um lead é agora.",
  "Corretores de sucesso trabalham o lead, não a sorte.",
  "Quem tem mais visitas, tem mais vendas. Simples assim.",
  "A IA está trabalhando para você. Agora é sua vez.",
  "Hoje é um ótimo dia para bater sua meta.",
];

function getFraseMotivacional(): string {
  const diaDoMes = new Date().getDate();
  return FRASES_MOTIVACIONAIS[diaDoMes % FRASES_MOTIVACIONAIS.length];
}

function getSaudacao(): string {
  const hora = new Date().getHours();
  if (hora < 12) return "Bom dia";
  if (hora < 18) return "Boa tarde";
  return "Boa noite";
}

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------
interface Oportunidade {
  tipo: "radar_intencao" | "nurturing_resposta" | "tarefa_atrasada";
  prioridade: number;
  lead_id: string;
  lead_nome: string;
  lead_telefone: string;
  lead_temperatura: "frio" | "morno" | "quente" | "urgente";
  lead_score: number;
  descricao: string;
  acao_sugerida: string;
  created_at: string;
  lead_etapa?: string;
}

// ---------------------------------------------------------------------------
// Helpers visuais
// ---------------------------------------------------------------------------
const TEMPERATURA_CONFIG = {
  urgente: { cor: "bg-red-500", texto: "URGENTE", icone: "🚨" },
  quente: { cor: "bg-orange-500", texto: "QUENTE", icone: "🔥" },
  morno: { cor: "bg-yellow-500", texto: "MORNO", icone: "🌡️" },
  frio: { cor: "bg-blue-400", texto: "FRIO", icone: "❄️" },
};

const TIPO_CONFIG = {
  radar_intencao: { icone: <Flame className="w-5 h-5 text-orange-500" />, label: "Radar de Intenção" },
  nurturing_resposta: { icone: <MessageSquare className="w-5 h-5 text-blue-500" />, label: "Vitrine Enviada" },
  tarefa_atrasada: { icone: <Clock className="w-5 h-5 text-red-500" />, label: "Tarefa Atrasada" },
};

// ---------------------------------------------------------------------------
// Hook: dados da home do corretor
// ---------------------------------------------------------------------------
function useHomeCorretor() {
  const { user } = useAuth();
  const { podeFazerRoleta, leadsDesatualizados, recarregar: recarregarElegibilidade } = useElegibilidadeRoleta();
  const [nomeCorretor, setNomeCorretor] = useState("");
  const [statusOnline, setStatusOnline] = useState(false);
  const [naRoleta, setNaRoleta] = useState(false);
  const [oportunidades, setOportunidades] = useState<Oportunidade[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [roletaUpdating, setRoletaUpdating] = useState(false);

  const carregar = async () => {
    if (!user) return;
    setLoading(true);

    try {
      // Perfil
      const { data: perfil } = await supabase
        .from("profiles")
        .select("nome")
        .eq("user_id", user.id)
        .maybeSingle();

      if (perfil) setNomeCorretor(perfil.nome || "Corretor");

      // Disponibilidade — usar maybeSingle para evitar erro quando não existe registro
      const { data: disponibilidade, error: dispError } = await supabase
        .from("corretor_disponibilidade")
        .select("status, na_roleta")
        .eq("user_id", user.id)
        .maybeSingle();

      if (dispError) {
        console.error("[HomeCorretor] Erro ao buscar disponibilidade:", dispError);
      } else if (disponibilidade) {
        setStatusOnline(disponibilidade.status === "na_empresa");
        setNaRoleta(disponibilidade.na_roleta ?? false);
      }

      // Oportunidades
      const { data: ops, error: opsError } = await supabase.rpc("get_oportunidades_do_dia", {
        p_corretor_id: user.id,
      });
      if (opsError) {
        console.error("[HomeCorretor] Erro ao buscar oportunidades:", opsError);
      } else if (ops) {
        setOportunidades(ops as Oportunidade[]);
      }

      // Recarregar elegibilidade (hook unificado)
      recarregarElegibilidade();
    } catch (err) {
      console.error("Erro ao carregar home do corretor:", err);
    }

    setLoading(false);
  };

  useEffect(() => {
    carregar();
    const interval = setInterval(carregar, 120_000);
    return () => clearInterval(interval);
  }, [user]);

  return {
    nomeCorretor,
    statusOnline, setStatusOnline,
    naRoleta, setNaRoleta,
    oportunidades,
    podeFazerRoleta,
    leadsDesatualizados,
    loading,
    statusUpdating, setStatusUpdating,
    roletaUpdating, setRoletaUpdating,
    recarregar: carregar,
    userId: user?.id,
  };
}

// ---------------------------------------------------------------------------
// Ação: alternar status online/offline
// ---------------------------------------------------------------------------
async function alternarStatusOnline(
  userId: string,
  novoStatus: boolean,
  setStatusOnline: (v: boolean) => void,
  setUpdating: (v: boolean) => void
) {
  setUpdating(true);
  setStatusOnline(novoStatus);
  const agora = new Date().toISOString();

  const payload: Record<string, unknown> = {
    user_id: userId,
    status: novoStatus ? "na_empresa" : "offline",
    updated_at: agora,
  };
  if (novoStatus) {
    payload.entrada_em = agora;
  } else {
    payload.saida_em = agora;
    payload.na_roleta = false;
  }

  const { error } = await supabase
    .from("corretor_disponibilidade")
    .upsert(payload as any, { onConflict: "user_id" });

  setUpdating(false);
  if (error) {
    console.error("[alternarStatusOnline] Erro no upsert:", error);
    setStatusOnline(!novoStatus);
    toast.error("Erro ao atualizar status. Tente novamente.");
  } else {
    toast.success(novoStatus ? "Você está online na empresa" : "Você está offline");
  }
}

// ---------------------------------------------------------------------------
// Ação: entrar/sair da roleta
// ---------------------------------------------------------------------------
async function alternarRoleta(
  userId: string,
  podeFazerRoleta: boolean,
  leadsDesatualizados: number,
  naRoleta: boolean,
  setNaRoleta: (v: boolean) => void,
  setUpdating: (v: boolean) => void
) {
  if (!naRoleta && !podeFazerRoleta) {
    toast.error(
      `Você tem ${leadsDesatualizados} lead(s) sem tarefa pendente (máx: 10). Crie tarefas no pipeline para se desbloquear.`,
      { duration: 5000 }
    );
    return;
  }

  setUpdating(true);
  const novoEstado = !naRoleta;
  setNaRoleta(novoEstado);

  const { error } = await supabase
    .from("corretor_disponibilidade")
    .upsert(
      {
        user_id: userId,
        na_roleta: novoEstado,
        status: "na_empresa",
        updated_at: new Date().toISOString(),
      } as any,
      { onConflict: "user_id" }
    );

  setUpdating(false);
  if (error) {
    console.error("[alternarRoleta] Erro no upsert:", error);
    setNaRoleta(!novoEstado);
    toast.error("Erro ao atualizar roleta. Tente novamente.");
  } else {
    toast.success(
      novoEstado
        ? "Você está na roleta! Aguarde novos leads."
        : "Você saiu da roleta."
    );
  }
}

// ---------------------------------------------------------------------------
// Ações de lead
// ---------------------------------------------------------------------------
function abrirLigacao(telefone: string) {
  const limpo = telefone.replace(/\D/g, "");
  window.open(`tel:+55${limpo}`, "_self");
}

function abrirWhatsApp(telefone: string, nomeLead: string) {
  const limpo = telefone.replace(/\D/g, "");
  const mensagem = encodeURIComponent(
    `Oi ${nomeLead.split(" ")[0]}! Tudo bem? Aqui é da uHome. Passando para ver se você ainda está buscando imóvel em Porto Alegre. Posso te ajudar? 😊`
  );
  window.open(`https://wa.me/55${limpo}?text=${mensagem}`, "_blank");
}

async function followUpMagico(leadId: string, nomeLead: string) {
  toast.loading(`Gerando vitrine para ${nomeLead.split(" ")[0]}...`);
  const { error } = await supabase.functions.invoke("cron-smart-nurturing", {
    body: { lead_id: leadId, modo: "manual" },
  });
  toast.dismiss();
  if (error) {
    toast.error("Erro ao gerar vitrine. Tente novamente.");
  } else {
    toast.success(`Vitrine enviada para ${nomeLead.split(" ")[0]}! Aguarde a resposta.`);
  }
}

// ---------------------------------------------------------------------------
// COMPONENTE PRINCIPAL
// ---------------------------------------------------------------------------
export function OportunidadesDoDia() {
  const {
    nomeCorretor,
    statusOnline, setStatusOnline,
    naRoleta, setNaRoleta,
    oportunidades,
    podeFazerRoleta,
    leadsDesatualizados,
    loading,
    statusUpdating, setStatusUpdating,
    roletaUpdating, setRoletaUpdating,
    recarregar,
    userId,
  } = useHomeCorretor();

  const primeiroNome = nomeCorretor.split(" ")[0];
  const saudacao = getSaudacao();
  const frase = getFraseMotivacional();

  const urgentes = oportunidades.filter((o) => o.lead_temperatura === "urgente");
  const quentes = oportunidades.filter((o) => o.lead_temperatura === "quente");
  const restantes = oportunidades.filter(
    (o) => o.lead_temperatura !== "urgente" && o.lead_temperatura !== "quente"
  );

  return (
    <div className="space-y-5 p-4 max-w-2xl mx-auto pb-10">

      {/* ── Saudação ── */}
      <div className="space-y-1 pt-2">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {saudacao}, {primeiroNome}! 👋
        </h1>
        <p className="text-sm text-muted-foreground italic">"{frase}"</p>
      </div>

      {/* ── Status Online + Roleta ── */}
      <div className="grid grid-cols-2 gap-3">
        {/* Status Online */}
        <Card
          className={`transition-colors ${
            statusOnline
              ? "border-green-500/50 bg-green-500/10 dark:bg-green-500/10"
              : "border-border"
          }`}
        >
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {statusOnline ? (
                  <Wifi className="w-4 h-4 text-green-500" />
                ) : (
                  <WifiOff className="w-4 h-4 text-muted-foreground" />
                )}
                <div>
                  <p className="text-xs font-semibold text-foreground">
                    {statusOnline ? "Online" : "Offline"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {statusOnline ? "Na empresa" : "Fora da empresa"}
                  </p>
                </div>
              </div>
              <Switch
                checked={statusOnline}
                disabled={statusUpdating}
                onCheckedChange={(v) =>
                  userId && alternarStatusOnline(userId, v, setStatusOnline, setStatusUpdating)
                }
              />
            </div>
          </CardContent>
        </Card>

        {/* Roleta */}
        <Card
          className={`transition-colors ${
            naRoleta
              ? "border-primary/50 bg-primary/10 dark:bg-primary/10"
              : !podeFazerRoleta
              ? "border-destructive/50 bg-destructive/10 dark:bg-destructive/10"
              : "border-border"
          }`}
        >
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-foreground flex items-center gap-1">
                  <Target className="w-3.5 h-3.5" />
                  Roleta
                  {!podeFazerRoleta && !naRoleta && (
                    <span className="text-destructive text-xs">🔒</span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {naRoleta
                    ? "Aguardando leads"
                    : !podeFazerRoleta
                    ? `${leadsDesatualizados} lead(s) sem tarefa`
                    : "Fora da fila"}
                </p>
              </div>
              <Switch
                checked={naRoleta}
                disabled={roletaUpdating}
                onCheckedChange={() =>
                  userId &&
                  alternarRoleta(
                    userId,
                    podeFazerRoleta,
                    leadsDesatualizados,
                    naRoleta,
                    setNaRoleta,
                    setRoletaUpdating
                  )
                }
              />
            </div>
            {/* Bloqueio: explicação + botão */}
            {!podeFazerRoleta && !naRoleta && (
              <div className="mt-3 pt-3 border-t border-destructive/20 space-y-2">
                <p className="text-xs text-destructive leading-relaxed">
                  Você tem <strong>{leadsDesatualizados} lead(s)</strong> sem tarefa pendente (máx: 10). Crie tarefas para se desbloquear.
                </p>
                <button
                  onClick={() => (window.location.href = "/pipeline?filtro=sem_tarefa")}
                  className="w-full text-xs font-medium py-2 px-3 rounded-lg bg-destructive hover:bg-destructive/90 text-destructive-foreground transition-colors flex items-center justify-center gap-1.5"
                >
                  <ListTodo className="w-3.5 h-3.5" />
                  Ver leads sem tarefa
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Alerta de leads desatualizados (mesmo quando pode entrar) ── */}
      {podeFazerRoleta && leadsDesatualizados > 5 && (
        <Card className="border-yellow-500/50 bg-yellow-500/10 dark:bg-yellow-500/10">
          <CardContent className="py-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-foreground">
                  Atenção: {leadsDesatualizados} leads sem tarefa
                </p>
                <p className="text-xs text-muted-foreground">
                  Faltam {10 - leadsDesatualizados > 0 ? 10 - leadsDesatualizados : 0} para bloqueio. 
                  <button
                    onClick={() => (window.location.href = "/pipeline?filtro=sem_tarefa")}
                    className="text-primary underline ml-1"
                  >
                    Atualizar pipeline
                  </button>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Oportunidades do Dia ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-base text-foreground flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-yellow-500" />
            Oportunidades do Dia
            {oportunidades.length > 0 && (
              <Badge className="ml-1 bg-primary text-primary-foreground text-xs">
                {oportunidades.length}
              </Badge>
            )}
          </h2>
          <Button variant="ghost" size="sm" onClick={recarregar} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-32">
            <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {urgentes.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-wide">
                  🚨 Urgente — Aja agora
                </p>
                {urgentes.map((op) => (
                  <CardOportunidade key={op.lead_id + op.tipo} op={op} />
                ))}
              </div>
            )}

            {quentes.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wide">
                  🔥 Leads Quentes
                </p>
                {quentes.map((op) => (
                  <CardOportunidade key={op.lead_id + op.tipo} op={op} />
                ))}
              </div>
            )}

            {restantes.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Outras Ações
                </p>
                {restantes.map((op) => (
                  <CardOportunidade key={op.lead_id + op.tipo} op={op} />
                ))}
              </div>
            )}

            {/* Estado vazio — ações úteis */}
            {oportunidades.length === 0 && (
              <Card className="border-green-500/30 bg-green-500/5 dark:bg-green-500/5">
                <CardContent className="pt-6 pb-6 text-center space-y-3">
                  <Trophy className="w-10 h-10 text-yellow-500 mx-auto" />
                  <div>
                    <p className="font-bold text-foreground">Você está em dia!</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Nenhuma ação pendente. Credencia-se na roleta e aguarde novos leads.
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 text-xs"
                      onClick={() => (window.location.href = "/pipeline")}
                    >
                      <ListTodo className="w-3.5 h-3.5 mr-1" />
                      Abrir Pipeline
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 text-xs"
                      onClick={() => (window.location.href = "/oferta-ativa")}
                    >
                      <Phone className="w-3.5 h-3.5 mr-1" />
                      Oferta Ativa
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-componente: Card de oportunidade
// ---------------------------------------------------------------------------
function CardOportunidade({ op }: { op: Oportunidade }) {
  const { user } = useAuth();
  const temp = TEMPERATURA_CONFIG[op.lead_temperatura] ?? TEMPERATURA_CONFIG.frio;
  const tipo = TIPO_CONFIG[op.tipo];
  const [followUpCriado, setFollowUpCriado] = useState(false);
  const [criandoFollowUp, setCriandoFollowUp] = useState(false);

  const handleCriarFollowUp = async () => {
    if (!user) return;
    setCriandoFollowUp(true);
    try {
      const amanha = new Date();
      amanha.setDate(amanha.getDate() + 1);
      const venceEm = amanha.toISOString().split("T")[0];

      const { error } = await supabase.from("pipeline_tarefas").insert({
        pipeline_lead_id: op.lead_id,
        titulo: `Follow-up: ${op.lead_nome}`,
        tipo: "follow_up",
        vence_em: venceEm,
        hora_vencimento: "09:00:00",
        responsavel_id: user.id,
        status: "pendente",
      });
      if (error) throw error;
      toast.success("Follow-up agendado para amanhã");
      setFollowUpCriado(true);
    } catch (err) {
      toast.error("Erro ao criar follow-up");
    } finally {
      setCriandoFollowUp(false);
    }
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="pt-3 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {tipo.icone}
              <span className="font-semibold text-sm text-foreground truncate">
                {op.lead_nome}
              </span>
              {op.lead_etapa && (
                <span className="bg-muted text-muted-foreground text-xs rounded-full px-2 py-0.5">
                  {op.lead_etapa}
                </span>
              )}
              <Badge className={`${temp.cor} text-white text-xs shrink-0`}>
                {temp.icone} {temp.texto}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground leading-snug">{op.descricao}</p>
            <p className="text-xs font-medium text-primary">💡 {op.acao_sugerida}</p>
          </div>

          <div className="flex flex-col gap-1.5 shrink-0">
            {op.tipo === "radar_intencao" && (
              <Button
                size="sm"
                className="bg-orange-500 hover:bg-orange-600 text-white h-8 text-xs"
                onClick={() => abrirLigacao(op.lead_telefone)}
              >
                <Phone className="w-3 h-3 mr-1" />
                Ligar
              </Button>
            )}
            {op.tipo === "nurturing_resposta" && (
              <Button
                size="sm"
                className="bg-green-500 hover:bg-green-600 text-white h-8 text-xs"
                onClick={() => abrirWhatsApp(op.lead_telefone, op.lead_nome)}
              >
                <MessageSquare className="w-3 h-3 mr-1" />
                WhatsApp
              </Button>
            )}
            {op.tipo === "tarefa_atrasada" && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs"
                onClick={() => followUpMagico(op.lead_id, op.lead_nome)}
              >
                <Zap className="w-3 h-3 mr-1" />
                Follow-up IA
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              onClick={handleCriarFollowUp}
              disabled={followUpCriado || criandoFollowUp}
            >
              {followUpCriado ? "✓ Agendado" : criandoFollowUp ? "Criando..." : "+Follow-up"}
            </Button>
            <Button size="sm" variant="ghost" className="h-8 px-2" asChild>
              <a href={`/pipeline-leads?lead=${op.lead_id}`}>
                <ChevronRight className="w-4 h-4" />
              </a>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
