// =============================================================================
// Componente: OportunidadesDoDia (v2)
// Propósito: Nova home do corretor — mantém os elementos de identidade
// (saudação personalizada, frase motivacional, credenciamento da roleta,
// botão de status online/offline) e adiciona o painel de Oportunidades do Dia.
// =============================================================================

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
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
} from "lucide-react";

// ---------------------------------------------------------------------------
// Frases motivacionais (rotação diária baseada no dia do mês)
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
}

// ---------------------------------------------------------------------------
// Helpers visuais de temperatura
// ---------------------------------------------------------------------------
const TEMPERATURA_CONFIG = {
  urgente: { cor: "bg-red-500",    texto: "URGENTE", icone: "🚨" },
  quente:  { cor: "bg-orange-500", texto: "QUENTE",  icone: "🔥" },
  morno:   { cor: "bg-yellow-500", texto: "MORNO",   icone: "🌡️" },
  frio:    { cor: "bg-blue-400",   texto: "FRIO",    icone: "❄️" },
};

const TIPO_CONFIG = {
  radar_intencao:    { icone: <Flame className="w-5 h-5 text-orange-500" />,      label: "Radar de Intenção" },
  nurturing_resposta:{ icone: <MessageSquare className="w-5 h-5 text-blue-500" />, label: "Vitrine Enviada" },
  tarefa_atrasada:   { icone: <Clock className="w-5 h-5 text-red-500" />,          label: "Tarefa Atrasada" },
};

// ---------------------------------------------------------------------------
// Hook: dados da home do corretor
// ---------------------------------------------------------------------------
function useHomeCorretor() {
  const { user } = useAuth();
  const [nomeCorretor, setNomeCorretor] = useState("");
  const [statusOnline, setStatusOnline] = useState(false);
  const [naRoleta, setNaRoleta] = useState(false);
  const [oportunidades, setOportunidades] = useState<Oportunidade[]>([]);
  const [podeFazerRoleta, setPodeFazerRoleta] = useState(true);
  const [tarefasAtrasadas, setTarefasAtrasadas] = useState(0);
  const [loading, setLoading] = useState(true);

  const carregar = async () => {
    if (!user) return;
    setLoading(true);

    try {
      // Perfil do corretor
      const { data: perfil } = await supabase
        .from("profiles")
        .select("nome")
        .eq("user_id", user.id)
        .single();

      if (perfil) {
        setNomeCorretor(perfil.nome || "Corretor");
      }

      // Status online/offline e roleta (tabela corretor_disponibilidade)
      const { data: disponibilidade } = await supabase
        .from("corretor_disponibilidade")
        .select("status, na_roleta")
        .eq("user_id", user.id)
        .single();

      if (disponibilidade) {
        setStatusOnline(disponibilidade.status === "online");
        setNaRoleta(disponibilidade.na_roleta ?? false);
      }

      // Oportunidades do dia (função criada na migration)
      const { data: ops, error: opsError } = await supabase.rpc("get_oportunidades_do_dia", {
        p_corretor_id: user.id,
      });
      if (!opsError) {
        setOportunidades((ops as Oportunidade[]) || []);
      }

      // Status da roleta (bloqueada ou liberada) via view
      const { data: statusRoleta } = await supabase
        .from("v_corretor_roleta_status" as any)
        .select("pode_entrar_roleta, tarefas_atrasadas")
        .eq("corretor_id", user.id)
        .single();

      if (statusRoleta) {
        setPodeFazerRoleta((statusRoleta as any).pode_entrar_roleta ?? true);
        setTarefasAtrasadas((statusRoleta as any).tarefas_atrasadas ?? 0);
      }
    } catch (err) {
      console.error("Erro ao carregar oportunidades:", err);
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
    statusOnline,
    setStatusOnline,
    naRoleta,
    setNaRoleta,
    oportunidades,
    podeFazerRoleta,
    tarefasAtrasadas,
    loading,
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
  setStatusOnline: (v: boolean) => void
) {
  setStatusOnline(novoStatus);
  const novoStatusStr = novoStatus ? "online" : "offline";

  const { error } = await supabase
    .from("corretor_disponibilidade")
    .upsert(
      {
        user_id: userId,
        status: novoStatusStr,
        entrada_em: novoStatus ? new Date().toISOString() : undefined,
        saida_em: novoStatus ? undefined : new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

  if (error) {
    setStatusOnline(!novoStatus);
    toast.error("Erro ao atualizar status. Tente novamente.");
  } else {
    toast.success(novoStatus ? "✅ Você está online na empresa" : "⏸️ Você está offline");
  }
}

// ---------------------------------------------------------------------------
// Ação: entrar/sair da roleta
// ---------------------------------------------------------------------------
async function alternarRoleta(
  userId: string,
  podeFazerRoleta: boolean,
  tarefasAtrasadas: number,
  naRoleta: boolean,
  setNaRoleta: (v: boolean) => void
) {
  // Bloqueia se há tarefas atrasadas e está tentando se credenciar
  if (!naRoleta && !podeFazerRoleta) {
    toast.error(
      `🔒 Você tem ${tarefasAtrasadas} tarefa(s) atrasada(s). Resolva-as para entrar na roleta.`,
      { duration: 5000 }
    );
    return;
  }

  const novoStatus = !naRoleta;
  setNaRoleta(novoStatus);

  const { error } = await supabase
    .from("corretor_disponibilidade")
    .upsert(
      { user_id: userId, na_roleta: novoStatus },
      { onConflict: "user_id" }
    );

  if (error) {
    setNaRoleta(!novoStatus);
    toast.error("Erro ao atualizar roleta. Tente novamente.");
  } else {
    toast.success(
      novoStatus
        ? "🎯 Você está na roleta! Aguarde novos leads."
        : "⏹️ Você saiu da roleta."
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
    toast.success(`✅ Vitrine enviada para ${nomeLead.split(" ")[0]}! Aguarde a resposta.`);
  }
}

// ---------------------------------------------------------------------------
// COMPONENTE PRINCIPAL
// ---------------------------------------------------------------------------
export function OportunidadesDoDia() {
  const {
    nomeCorretor,
    statusOnline,
    setStatusOnline,
    naRoleta,
    setNaRoleta,
    oportunidades,
    podeFazerRoleta,
    tarefasAtrasadas,
    loading,
    recarregar,
    userId,
  } = useHomeCorretor();

  const primeiroNome = nomeCorretor.split(" ")[0];
  const saudacao = getSaudacao();
  const frase = getFraseMotivacional();

  const urgentes  = oportunidades.filter((o) => o.lead_temperatura === "urgente");
  const quentes   = oportunidades.filter((o) => o.lead_temperatura === "quente");
  const restantes = oportunidades.filter(
    (o) => o.lead_temperatura !== "urgente" && o.lead_temperatura !== "quente"
  );

  return (
    <div className="space-y-5 p-4 max-w-2xl mx-auto pb-10">

      {/* ── BLOCO 1: Saudação e Frase Motivacional ── */}
      <div className="space-y-1 pt-2">
        <h1 className="text-2xl font-bold tracking-tight">
          {saudacao}, {primeiroNome}! 👋
        </h1>
        <p className="text-sm text-muted-foreground italic">"{frase}"</p>
      </div>

      {/* ── BLOCO 2: Status Online + Credenciamento Roleta ── */}
      <div className="grid grid-cols-2 gap-3">
        {/* Status Online */}
        <Card className={statusOnline ? "border-green-400 bg-green-50" : "border-gray-200"}>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {statusOnline
                  ? <Wifi className="w-4 h-4 text-green-600" />
                  : <WifiOff className="w-4 h-4 text-gray-400" />
                }
                <div>
                  <p className="text-xs font-semibold">
                    {statusOnline ? "Online" : "Offline"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {statusOnline ? "Na empresa" : "Fora da empresa"}
                  </p>
                </div>
              </div>
              <Switch
                checked={statusOnline}
                onCheckedChange={(v) =>
                  userId && alternarStatusOnline(userId, v, setStatusOnline)
                }
              />
            </div>
          </CardContent>
        </Card>

        {/* Credenciamento Roleta */}
        <Card
          className={
            naRoleta
              ? "border-purple-400 bg-purple-50"
              : !podeFazerRoleta
              ? "border-red-300 bg-red-50"
              : "border-gray-200"
          }
        >
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold flex items-center gap-1">
                  🎯 Roleta
                  {!podeFazerRoleta && !naRoleta && (
                    <span className="text-red-500 text-xs">🔒</span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {naRoleta
                    ? "Aguardando leads"
                    : !podeFazerRoleta
                    ? `${tarefasAtrasadas} tarefa(s) atrasada(s)`
                    : "Fora da fila"}
                </p>
              </div>
              <Switch
                checked={naRoleta}
                onCheckedChange={() =>
                  userId &&
                  alternarRoleta(
                    userId,
                    podeFazerRoleta,
                    tarefasAtrasadas,
                    naRoleta,
                    setNaRoleta
                  )
                }
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── BLOCO 3: Oportunidades do Dia ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-base">
            ⚡ Oportunidades do Dia
            {oportunidades.length > 0 && (
              <Badge className="ml-2 bg-primary text-white text-xs">
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
            {/* Urgentes */}
            {urgentes.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-bold text-red-600 uppercase tracking-wide">
                  🚨 Urgente — Aja agora
                </p>
                {urgentes.map((op) => (
                  <CardOportunidade key={op.lead_id + op.tipo} op={op} />
                ))}
              </div>
            )}

            {/* Quentes */}
            {quentes.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-bold text-orange-600 uppercase tracking-wide">
                  🔥 Leads Quentes
                </p>
                {quentes.map((op) => (
                  <CardOportunidade key={op.lead_id + op.tipo} op={op} />
                ))}
              </div>
            )}

            {/* Outros */}
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

            {/* Vazio */}
            {oportunidades.length === 0 && (
              <Card className="border-green-300 bg-green-50">
                <CardContent className="pt-6 pb-6 text-center space-y-2">
                  <Trophy className="w-10 h-10 text-yellow-500 mx-auto" />
                  <p className="font-bold">Você está em dia! 🏆</p>
                  <p className="text-sm text-muted-foreground">
                    Nenhuma ação pendente. Credencia-se na roleta e aguarde novos leads.
                  </p>
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
// Sub-componente: Card de cada oportunidade
// ---------------------------------------------------------------------------
function CardOportunidade({ op }: { op: Oportunidade }) {
  const temp = TEMPERATURA_CONFIG[op.lead_temperatura] ?? TEMPERATURA_CONFIG.frio;
  const tipo = TIPO_CONFIG[op.tipo];

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="pt-3 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {tipo.icone}
              <span className="font-semibold text-sm truncate">{op.lead_nome}</span>
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
