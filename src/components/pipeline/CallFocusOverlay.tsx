import { useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { X, Check, Phone, PhoneOff, MessageSquare, CalendarClock, ChevronRight } from "lucide-react";

interface CallFocusOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  lead: {
    id: string;
    nome: string;
    telefone: string | null | undefined;
    empreendimento: string | null | undefined;
    stage_id: string;
  };
  stageTipo: string | undefined;
  leadOrigem: string | null | undefined;
  tarefas: any[];
  availableStages: { id: string; tipo: string; nome: string }[];
  onRefresh: () => void;
}

type ScriptLine = { role: "corretor" | "cliente" | "dica"; texto: string };

const SCRIPTS: Record<string, ScriptLine[]> = {
  sem_contato_meta: [
    { role: "corretor", texto: "Oi {nome}, tudo bem? Aqui é o [seu nome], da UHome. Vi que você se interessou pelo {emp} e te liguei rapidinho. Como você está?" },
    { role: "dica", texto: 'Espere a resposta. Se demonstrar pressa: "Leva 1 minutinho, prometo!"' },
    { role: "corretor", texto: "Legal! Te liguei porque o {emp} é exclusivo aqui em Porto Alegre — o que mais te chamou atenção: foi a ideia do condomínio, o bairro, ou as condições?" },
    { role: "dica", texto: "Escute sem interromper. O que ela disser é ouro para qualificação." },
    { role: "cliente", texto: '"Sim, me interessa... mas preciso ver condições."' },
    { role: "corretor", texto: "Perfeito! Vale a gente se encontrar 30min para eu te mostrar pessoalmente o {emp}. Você tem disponibilidade esta semana?" },
    { role: "dica", texto: "Objetivo: sair com data de visita ou compromisso de WhatsApp." },
  ],
  sem_contato_portal: [
    { role: "corretor", texto: "Oi {nome}! Aqui é o [seu nome] da UHome. Vi que você consultou o {emp} no portal — queria entender melhor o que você está buscando. Tem 2 minutinhos?" },
    { role: "dica", texto: "Tom diferente do Meta: cliente de portal pesquisou ativamente — é mais qualificado." },
    { role: "corretor", texto: "Ótimo! Me conta: você está buscando para morar ou investir? E qual seria o tamanho ideal para você?" },
    { role: "dica", texto: "Qualifique agora. Já começar a entender o perfil." },
  ],
  contato_iniciado: [
    { role: "corretor", texto: "Oi {nome}, tudo bem? Aqui é o [seu nome] da UHome de novo. Lembrei de você porque surgiu uma novidade no {emp} que achei que ia fazer sentido pro seu momento." },
    { role: "dica", texto: "Não mencione que está fazendo follow-up — trate como novidade." },
    { role: "cliente", texto: '"Ah sim, pode falar."' },
    { role: "corretor", texto: "A gente tem uma condição especial disponível por pouco tempo. O melhor seria você conhecer pessoalmente — quanto tempo você teria disponível esta semana?" },
  ],
  qualificacao: [
    { role: "corretor", texto: "Oi {nome}! [seu nome] da UHome. Estava pensando em você e queria entender melhor: quando você imagina o imóvel ideal, qual seria o maior diferencial — localização, tamanho, ou condições de pagamento?" },
    { role: "dica", texto: "Objetivo: completar o perfil e conduzir para visita." },
    { role: "cliente", texto: '"Localização é importante, mas condições também..."' },
    { role: "corretor", texto: "Faz sentido! O {emp} tem justamente essa combinação. Que tal a gente marcar uma visita rápida para você ver pessoalmente? Não precisa ser uma decisão — é só para você ter a referência." },
  ],
  possivel_visita: [
    { role: "corretor", texto: "Oi {nome}! [seu nome] da UHome. Estava organizando a agenda de visitas ao {emp} esta semana. Você tem disponibilidade terça ou quinta à tarde?" },
    { role: "dica", texto: "Ofereça duas opções — facilita a decisão." },
    { role: "cliente", texto: '"Quinta pode ser..."' },
    { role: "corretor", texto: "Ótimo! Fico de confirmar na quinta. A visita dura uns 40 minutinhos e você vai sair com uma visão muito mais clara. Combinado?" },
  ],
  visita_marcada: [
    { role: "corretor", texto: "Oi {nome}! [seu nome] da UHome. Passando para confirmar nossa visita ao {emp} amanhã. Continua confirmado?" },
    { role: "dica", texto: "Anti no-show: confirme sempre D-1. Se não confirmar, risco de 40% de não aparecer." },
    { role: "cliente", texto: '"Sim, confirmado."' },
    { role: "corretor", texto: "Perfeito! Te mando o endereço exato no WhatsApp agora. Nos vemos amanhã!" },
  ],
  visita_realizada: [
    { role: "corretor", texto: "Oi {nome}! [seu nome] da UHome. O que você achou da visita ao {emp}? Qual parte chamou mais sua atenção?" },
    { role: "dica", texto: "Abra com pergunta aberta. Não pressione — ouça primeiro." },
    { role: "cliente", texto: '"Gostei bastante, mas preciso pensar..."' },
    { role: "corretor", texto: "Faz sentido! O que faria você se sentir mais seguro para avançar? Seria as condições, o prazo de entrega, ou algo específico do apartamento?" },
    { role: "dica", texto: "Identifique a objeção real. Cada resposta aponta o próximo passo." },
  ],
  default: [
    { role: "corretor", texto: "Oi {nome}! Aqui é o [seu nome] da UHome. Tudo bem? Estava pensando em você e queria dar um alô rápido sobre o {emp}." },
    { role: "dica", texto: "Adapte a conversa conforme a resposta do cliente." },
  ],
};

const PROXIMAS_ETAPAS: Record<string, string[]> = {
  sem_contato: ["contato_iniciado", "qualificacao", "possivel_visita"],
  contato_iniciado: ["qualificacao", "possivel_visita", "visita_marcada"],
  qualificacao: ["possivel_visita", "visita_marcada"],
  possivel_visita: ["visita_marcada"],
  visita_marcada: ["visita_realizada"],
  visita_realizada: ["negociacao", "proposta"],
  negociacao: ["proposta", "contrato"],
};

const STAGE_LABELS: Record<string, string> = {
  sem_contato: "Sem contato",
  contato_iniciado: "Contato iniciado",
  qualificacao: "Qualificação",
  possivel_visita: "Possível visita",
  visita_marcada: "Visita marcada",
  visita_realizada: "Visita realizada",
  negociacao: "Negociação",
  proposta: "Proposta",
  contrato: "Contrato",
};

function getInitials(name: string) {
  return name.split(" ").slice(0, 2).map(w => w[0]?.toUpperCase() || "").join("");
}

function getTomorrow() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
}

export function CallFocusOverlay({ isOpen, onClose, lead, stageTipo, leadOrigem, tarefas, availableStages, onRefresh }: CallFocusOverlayProps) {
  const { user } = useAuth();
  const [fase, setFase] = useState<1 | 2 | 3>(1);
  const [resultado, setResultado] = useState<"atendeu" | "nao_atendeu" | null>(null);
  const [observacao, setObservacao] = useState("");
  const [tarefaTipo, setTarefaTipo] = useState("Ligar");
  const [tarefaData, setTarefaData] = useState(getTomorrow());
  const [tarefaHora, setTarefaHora] = useState("11:00");
  const [novaEtapaSelecionada, setNovaEtapaSelecionada] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const primeiroNome = lead.nome.split(" ")[0];
  const emp = lead.empreendimento || "empreendimento";

  const scriptKey = useMemo(() => {
    const st = stageTipo || "default";
    let origemSuffix = "";
    if (leadOrigem) {
      const lo = leadOrigem.toLowerCase();
      if (lo.includes("meta")) origemSuffix = "_meta";
      else if (lo.includes("imovel") || lo.includes("portal")) origemSuffix = "_portal";
    }
    const key = `${st}${origemSuffix}`;
    if (SCRIPTS[key]) return key;
    if (SCRIPTS[st]) return st;
    return "default";
  }, [stageTipo, leadOrigem]);

  const scriptLines = useMemo(() => {
    return (SCRIPTS[scriptKey] || SCRIPTS.default).map(line => ({
      ...line,
      texto: line.texto.replace(/\{nome\}/g, primeiroNome).replace(/\{emp\}/g, emp),
    }));
  }, [scriptKey, primeiroNome, emp]);

  const proximasEtapas = useMemo(() => {
    const tipos = PROXIMAS_ETAPAS[stageTipo || ""] || [];
    return tipos.map(tipo => {
      const stage = availableStages.find(s => s.tipo === tipo);
      return stage ? { tipo, id: stage.id, nome: stage.nome } : { tipo, id: "", nome: STAGE_LABELS[tipo] || tipo };
    }).filter(s => s.id);
  }, [stageTipo, availableStages]);

  const handleSalvar = async () => {
    if (!user?.id) return;
    setSalvando(true);
    try {
      await supabase.from("pipeline_atividades").insert({
        lead_id: lead.id,
        tipo: "ligacao",
        titulo: resultado === "atendeu" ? "Liguei — atendeu" : "Liguei — não atendeu",
        descricao: observacao || null,
        created_by: user.id,
      });

      await supabase.from("pipeline_leads")
        .update({ ultima_acao_at: new Date().toISOString() })
        .eq("id", lead.id);

      if (tarefaTipo && tarefaData) {
        const venceEm = new Date(`${tarefaData}T${tarefaHora}:00`);
        await supabase.from("pipeline_tarefas").insert({
          lead_id: lead.id,
          tipo: tarefaTipo.toLowerCase(),
          titulo: `${tarefaTipo} — ${lead.nome}`,
          status: "pendente",
          vence_em: venceEm.toISOString(),
          responsavel_id: user.id,
        });
      }

      if (novaEtapaSelecionada) {
        const targetStage = availableStages.find(s => s.tipo === novaEtapaSelecionada);
        if (targetStage) {
          await supabase.from("pipeline_leads")
            .update({ stage_id: targetStage.id })
            .eq("id", lead.id);
        }
      }

      toast.success("Ligação registrada com sucesso!");
      onRefresh();
      onClose();
    } catch (e) {
      toast.error("Erro ao salvar. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  };

  if (!isOpen) return null;

  const steps = [
    { num: 1, label: "Script" },
    { num: 2, label: "Registrar" },
    { num: 3, label: "Próximo passo" },
  ];

  return createPortal(
    <div onClick={onClose} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div onClick={e => e.stopPropagation()} style={{ backgroundColor: 'white', borderRadius: '16px', width: '100%', maxWidth: '560px', maxHeight: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 8px 40px rgba(0,0,0,0.25)' }}>
      {/* HEADER */}
      <div className="flex items-center gap-3 px-5 pt-4 pb-3 border-b border-border/50">
        <div className="w-[38px] h-[38px] rounded-full flex items-center justify-center text-sm font-bold shrink-0" style={{ background: "#EEEDFE", color: "#534AB7" }}>
          {getInitials(lead.nome)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">{lead.nome}</p>
          <p className="text-xs text-muted-foreground">{lead.telefone || "Sem telefone"}</p>
        </div>
        <span className="text-[10px] font-medium px-2.5 py-1 rounded-full shrink-0" style={{ background: "#FCEBEB", color: "#A32D2D" }}>
          {STAGE_LABELS[stageTipo || ""] || stageTipo || "—"}
        </span>
        <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted transition-colors shrink-0">
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      {/* PROGRESS STEPS */}
      <div className="flex items-center justify-center gap-0 px-5 py-3 border-b border-border/30">
        {steps.map((step, i) => {
          const isDone = fase > step.num;
          const isCurrent = fase === step.num;
          return (
            <div key={step.num} className="flex items-center">
              <div className="flex items-center gap-1.5">
                <span
                  className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                  style={{
                    background: isDone ? "#EAF3DE" : isCurrent ? "#4F46E5" : "hsl(var(--muted))",
                    color: isDone ? "#3B6D11" : isCurrent ? "#fff" : "hsl(var(--muted-foreground))",
                  }}
                >
                  {isDone ? "✓" : step.num}
                </span>
                <span className="text-[11px] font-medium" style={{ color: isDone ? "#3B6D11" : isCurrent ? "#4F46E5" : "hsl(var(--muted-foreground))" }}>
                  {step.label}
                </span>
              </div>
              {i < steps.length - 1 && (
                <div className="w-6 h-px mx-1.5" style={{ background: isDone ? "#3B6D11" : "hsl(var(--border))" }} />
              )}
            </div>
          );
        })}
      </div>

      {/* BODY */}
      <div className="flex-1 overflow-y-auto">
        {/* FASE 1 — SCRIPT */}
        {fase === 1 && (
          <div className="px-5 py-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">Script de ligação</span>
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: "#EEEDFE", color: "#534AB7" }}>
                {STAGE_LABELS[stageTipo || ""] || "—"} · {leadOrigem || "direto"}
              </span>
            </div>

            <div className="space-y-2">
              {scriptLines.map((line, i) => {
                if (line.role === "dica") {
                  return (
                    <p key={i} className="text-[11px] text-muted-foreground italic pl-3 py-1">
                      💡 {line.texto}
                    </p>
                  );
                }
                const isCorretor = line.role === "corretor";
                return (
                  <div key={i} className="rounded-lg px-3.5 py-2.5" style={{ background: isCorretor ? "hsl(var(--muted))" : "#FAEEDA" }}>
                    <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: isCorretor ? "#185FA5" : "#854F0B" }}>
                      {isCorretor ? "Corretor" : "Cliente"}
                    </span>
                    <p className="text-[13px] mt-0.5 leading-relaxed">{line.texto}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* FASE 2 — REGISTRAR */}
        {fase === 2 && (
          <div className="px-5 py-4 space-y-4">
            {/* Chip resultado */}
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium"
              style={{
                background: resultado === "atendeu" ? "#EAF3DE" : "#FCEBEB",
                color: resultado === "atendeu" ? "#27500A" : "#A32D2D",
              }}
            >
              {resultado === "atendeu" ? <Check className="h-4 w-4" /> : <PhoneOff className="h-4 w-4" />}
              {resultado === "atendeu" ? "Atendeu" : "Não atendeu — próxima tarefa obrigatória"}
            </div>

            {/* Observação */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Observação</label>
              <Textarea
                value={observacao}
                onChange={e => setObservacao(e.target.value)}
                rows={3}
                placeholder="O que aconteceu? Ex: demonstrou interesse no Fase 3, pede para ligar à tarde..."
                className="resize-none text-sm"
              />
            </div>

            {/* Próxima tarefa */}
            <div className="space-y-2">
              <div>
                <label className="text-xs font-medium text-foreground">Próxima tarefa</label>
                <p className="text-[10px] text-muted-foreground">(obrigatório para atualizar o lead)</p>
              </div>
              <div className="flex gap-1.5">
                {["Ligar", "WhatsApp", "Follow-up"].map(tipo => (
                  <button
                    key={tipo}
                    onClick={() => setTarefaTipo(tipo)}
                    className="px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
                    style={{
                      background: tarefaTipo === tipo ? "#4F46E5" : "hsl(var(--muted))",
                      color: tarefaTipo === tipo ? "#fff" : "hsl(var(--foreground))",
                    }}
                  >
                    {tipo === "Ligar" && <Phone className="h-3 w-3 inline mr-1" />}
                    {tipo === "WhatsApp" && <MessageSquare className="h-3 w-3 inline mr-1" />}
                    {tipo === "Follow-up" && <CalendarClock className="h-3 w-3 inline mr-1" />}
                    {tipo}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <Input type="date" value={tarefaData} onChange={e => setTarefaData(e.target.value)} className="flex-1 text-sm h-9" />
                <Input type="time" value={tarefaHora} onChange={e => setTarefaHora(e.target.value)} className="w-24 text-sm h-9" />
              </div>
            </div>
          </div>
        )}

        {/* FASE 3 — MOVER ETAPA */}
        {fase === 3 && (
          <div className="px-5 py-4 space-y-3">
            <div>
              <p className="text-sm font-semibold">A conversa avançou?</p>
              <p className="text-xs text-muted-foreground">Mova o lead se a etapa mudou. Se não avançou, mantenha.</p>
            </div>

            <div className="space-y-1.5">
              {proximasEtapas.map(etapa => (
                <button
                  key={etapa.tipo}
                  onClick={() => setNovaEtapaSelecionada(etapa.tipo)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors"
                  style={{
                    background: novaEtapaSelecionada === etapa.tipo ? "#EEF2FF" : "transparent",
                    border: novaEtapaSelecionada === etapa.tipo ? "1px solid #4F46E5" : "1px solid hsl(var(--border))",
                  }}
                >
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ background: novaEtapaSelecionada === etapa.tipo ? "#4F46E5" : "#ccc" }} />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{etapa.nome}</p>
                    <p className="text-[10px] text-muted-foreground">{STAGE_LABELS[etapa.tipo] || ""}</p>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              ))}

              {/* Manter na etapa atual */}
              <button
                onClick={() => setNovaEtapaSelecionada(null)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors"
                style={{
                  background: novaEtapaSelecionada === null ? "#F5F5F5" : "transparent",
                  border: novaEtapaSelecionada === null ? "1px solid hsl(var(--border))" : "1px solid hsl(var(--border))",
                }}
              >
                <div className="w-3 h-3 rounded-full shrink-0" style={{ background: novaEtapaSelecionada === null ? "#666" : "#ccc" }} />
                <p className="text-sm font-medium text-muted-foreground">Manter na etapa atual</p>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* FOOTER */}
      <div className="border-t border-border/50 px-5 py-3 space-y-2 shrink-0">
        {fase === 1 && (
          <>
            <p className="text-[11px] text-muted-foreground text-center">Como foi a ligação?</p>
            <div className="flex gap-2">
              <button
                onClick={() => { setResultado("atendeu"); setFase(2); }}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-colors"
                style={{ background: "#EAF3DE", color: "#27500A" }}
              >
                <Phone className="h-4 w-4" /> Atendeu
              </button>
              <button
                onClick={() => { setResultado("nao_atendeu"); setFase(2); }}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-colors"
                style={{ background: "#FCEBEB", color: "#A32D2D" }}
              >
                <PhoneOff className="h-4 w-4" /> Não atendeu
              </button>
            </div>
          </>
        )}

        {fase === 2 && (
          <div className="flex gap-2">
            <button onClick={onClose} className="px-3 py-2 rounded-lg text-xs text-muted-foreground hover:bg-muted transition-colors">
              Fechar sem salvar
            </button>
            <div className="flex-1" />
            {resultado === "atendeu" ? (
              <Button onClick={() => setFase(3)} className="rounded-lg text-sm gap-1">
                Continuar <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <Button onClick={handleSalvar} disabled={salvando} className="rounded-lg text-sm">
                {salvando ? "Salvando..." : "Salvar e fechar"}
              </Button>
            )}
          </div>
        )}

        {fase === 3 && (
          <div className="flex gap-2">
            <button onClick={() => setFase(2)} className="px-3 py-2 rounded-lg text-xs text-muted-foreground hover:bg-muted transition-colors">
              ← Voltar
            </button>
            <div className="flex-1" />
            <Button onClick={handleSalvar} disabled={salvando} className="rounded-lg text-sm">
              {salvando ? "Salvando..." : "Salvar tudo e fechar"}
            </Button>
          </div>
        )}
      </div>
      </div>
    </div>
    , document.body
  );
}
