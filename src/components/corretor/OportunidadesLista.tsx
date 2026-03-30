
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import {
  Phone,
  MessageSquare,
  Flame,
  Clock,
  Zap,
  Trophy,
  ChevronRight,
  RefreshCw,
  Plus,
  Check,
  CalendarPlus,
  ExternalLink,
} from "lucide-react";

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
  lead_etapa: string | null;
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

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------
export default function OportunidadesLista() {
  const { user } = useAuth();
  const [oportunidades, setOportunidades] = useState<Oportunidade[]>([]);
  const [loading, setLoading] = useState(true);

  const carregar = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("get_oportunidades_do_dia", {
        p_corretor_id: user.id,
      });
      if (error) {
        console.error("[OportunidadesLista] Erro ao buscar oportunidades:", error);
      } else {
        setOportunidades((data as Oportunidade[]) || []);
      }
    } catch (err) {
      console.error("[OportunidadesLista] Erro:", err);
    }
    setLoading(false);
  };

  useEffect(() => {
    carregar();
    const interval = setInterval(carregar, 120_000);
    return () => clearInterval(interval);
  }, [user]);

  const urgentes = oportunidades.filter((o) => o.lead_temperatura === "urgente");
  const quentes = oportunidades.filter((o) => o.lead_temperatura === "quente");
  const restantes = oportunidades.filter(
    (o) => o.lead_temperatura !== "urgente" && o.lead_temperatura !== "quente"
  );

  const criarFollowUp = async (op: Oportunidade) => {
    if (!user) return;
    const amanha = new Date();
    amanha.setDate(amanha.getDate() + 1);
    const venceEm = amanha.toISOString().split("T")[0];

    const { error } = await supabase.from("pipeline_tarefas").insert({
      pipeline_lead_id: op.lead_id,
      titulo: `Follow-up: ${op.lead_nome}`,
      tipo: "follow_up",
      vence_em: venceEm,
      responsavel_id: user.id,
      created_by: user.id,
      status: "pendente",
      prioridade: "media",
    });

    if (error) {
      console.error("[OportunidadesLista] Erro ao criar tarefa:", error);
      toast.error("Erro ao criar tarefa. Tente novamente.");
    } else {
      toast.success(`Tarefa criada para ${op.lead_nome.split(" ")[0]}!`);
      carregar();
    }
  };

  const concluirTarefaDoLead = async (leadId: string, leadNome: string) => {
    const { data: tarefas, error: fetchErr } = await supabase
      .from("pipeline_tarefas")
      .select("id")
      .eq("pipeline_lead_id", leadId)
      .eq("status", "pendente")
      .is("concluida_em", null)
      .lt("vence_em", new Date().toISOString())
      .order("vence_em", { ascending: true })
      .limit(1);

    if (fetchErr || !tarefas?.length) {
      toast.error("Tarefa não encontrada ou já concluída.");
      return;
    }

    const { error } = await supabase
      .from("pipeline_tarefas")
      .update({ status: "concluida", concluida_em: new Date().toISOString() })
      .eq("id", tarefas[0].id);

    if (error) {
      toast.error("Erro ao concluir tarefa.");
    } else {
      await supabase.from("pipeline_leads").update({ ultima_acao_at: new Date().toISOString() }).eq("id", leadId);
      toast.success(`Tarefa de ${leadNome.split(" ")[0]} concluída!`);
      carregar();
    }
  };

  const reagendarTarefaDoLead = async (leadId: string, leadNome: string) => {
    const amanha = new Date();
    amanha.setDate(amanha.getDate() + 1);

    const { data: tarefas, error: fetchErr } = await supabase
      .from("pipeline_tarefas")
      .select("id")
      .eq("pipeline_lead_id", leadId)
      .eq("status", "pendente")
      .is("concluida_em", null)
      .lt("vence_em", new Date().toISOString())
      .order("vence_em", { ascending: true })
      .limit(1);

    if (fetchErr || !tarefas?.length) {
      toast.error("Tarefa não encontrada.");
      return;
    }

    const { error } = await supabase
      .from("pipeline_tarefas")
      .update({ vence_em: amanha.toISOString().split("T")[0] })
      .eq("id", tarefas[0].id);

    if (error) {
      toast.error("Erro ao reagendar tarefa.");
    } else {
      toast.success(`Tarefa de ${leadNome.split(" ")[0]} reagendada para amanhã!`);
      carregar();
    }
  };

  return (
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
        <Button variant="ghost" size="sm" onClick={carregar} disabled={loading}>
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
                <CardOportunidade
                  key={op.lead_id + op.tipo}
                  op={op}
                  onCriarFollowUp={criarFollowUp}
                  onConcluir={concluirTarefaDoLead}
                  onReagendar={reagendarTarefaDoLead}
                />
              ))}
            </div>
          )}

          {quentes.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wide">
                🔥 Leads Quentes
              </p>
              {quentes.map((op) => (
                <CardOportunidade
                  key={op.lead_id + op.tipo}
                  op={op}
                  onCriarFollowUp={criarFollowUp}
                  onConcluir={concluirTarefaDoLead}
                  onReagendar={reagendarTarefaDoLead}
                />
              ))}
            </div>
          )}

          {restantes.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Outras Ações
              </p>
              {restantes.map((op) => (
                <CardOportunidade
                  key={op.lead_id + op.tipo}
                  op={op}
                  onCriarFollowUp={criarFollowUp}
                  onConcluir={concluirTarefaDoLead}
                  onReagendar={reagendarTarefaDoLead}
                />
              ))}
            </div>
          )}

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
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-componente: Card de oportunidade
// ---------------------------------------------------------------------------
function CardOportunidade({
  op,
  onCriarFollowUp,
  onConcluir,
  onReagendar,
}: {
  op: Oportunidade;
  onCriarFollowUp: (op: Oportunidade) => Promise<void>;
  onConcluir: (leadId: string, leadNome: string) => Promise<void>;
  onReagendar: (leadId: string, leadNome: string) => Promise<void>;
}) {
  const navigate = useNavigate();
  const [criando, setCriando] = useState(false);
  const [resolvendo, setResolvendo] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const temp = TEMPERATURA_CONFIG[op.lead_temperatura] ?? TEMPERATURA_CONFIG.frio;
  const tipo = TIPO_CONFIG[op.tipo];
  const isSemTarefa = op.prioridade === 4 && op.acao_sugerida === "Criar tarefa de follow-up";

  const handleCriarFollowUp = async () => {
    setCriando(true);
    await onCriarFollowUp(op);
    setCriando(false);
  };

  const handleConcluir = async () => {
    setResolvendo(true);
    await onConcluir(op.lead_id, op.lead_nome);
    setResolvendo(false);
    setPopoverOpen(false);
  };

  const handleReagendar = async () => {
    setResolvendo(true);
    await onReagendar(op.lead_id, op.lead_nome);
    setResolvendo(false);
    setPopoverOpen(false);
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
              <Badge className={`${temp.cor} text-white text-xs shrink-0`}>
                {temp.icone} {temp.texto}
              </Badge>
            </div>
            {op.lead_etapa && (
              <div className="flex items-center gap-1">
                <Badge variant="outline" className="text-xs font-normal text-muted-foreground border-muted">
                  📍 {op.lead_etapa}
                </Badge>
              </div>
            )}
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
            {op.tipo === "tarefa_atrasada" && isSemTarefa && (
              <Button
                size="sm"
                className="bg-primary hover:bg-primary/90 text-primary-foreground h-8 text-xs"
                onClick={handleCriarFollowUp}
                disabled={criando}
              >
                <Plus className="w-3 h-3 mr-1" />
                {criando ? "Criando..." : "Follow-up"}
              </Button>
            )}
            {op.tipo === "tarefa_atrasada" && !isSemTarefa && (
              <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
                  >
                    <Clock className="w-3 h-3 mr-1" />
                    Resolver
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-52 p-1.5" sideOffset={4}>
                  <div className="space-y-0.5">
                    <button
                      disabled={resolvendo}
                      onClick={handleConcluir}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors disabled:opacity-50"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Concluir tarefa
                    </button>
                    <button
                      disabled={resolvendo}
                      onClick={handleReagendar}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors disabled:opacity-50"
                    >
                      <CalendarPlus className="w-3.5 h-3.5" />
                      Reagendar p/ amanhã
                    </button>
                    <div className="border-t border-border my-1" />
                    <button
                      onClick={() => {
                        setPopoverOpen(false);
                        navigate(`/pipeline-leads?lead=${op.lead_id}`);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Ver lead no pipeline
                    </button>
                  </div>
                </PopoverContent>
              </Popover>
            )}
            <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => navigate(`/pipeline-leads?lead=${op.lead_id}`)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
