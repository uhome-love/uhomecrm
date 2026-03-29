import { useState, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { X, Copy, ExternalLink, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { dateToBRT } from "@/lib/utils";

interface WhatsAppFocusFlowProps {
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
  onRefresh: () => void;
}

interface StageMessage {
  title: string;
  body: string;
}

const STAGE_MESSAGES: Record<string, StageMessage[]> = {
  novo: [
    { title: "🎯 Versão direta", body: "Fala {{nome}}, tudo bem? Vi que tu pediu info do {{empreendimento}} e resolvi te mandar uma msg rápido — posso te explicar melhor?" },
    { title: "📱 Apresentação consultiva", body: "Oi {{nome}}! 😊 Me chamo [seu nome], da UHome. Vi teu interesse em {{empreendimento}} e queria te mostrar algo que faz sentido pro teu momento. Posso te contar mais?" },
    { title: "🔄 Reativação criativa", body: "{{nome}}, sei que a rotina é corrida! Mas não queria que tu perdesse as condições especiais de {{empreendimento}}. Qual o melhor horário pra gente trocar uma ideia rápida? 📞" },
  ],
  sem_contato: [
    { title: "🎯 Versão direta", body: "Fala {{nome}}, tudo bem? Vi que tu pediu info do {{empreendimento}} e resolvi te mandar uma msg rápido — posso te explicar melhor?" },
    { title: "📱 Apresentação consultiva", body: "Oi {{nome}}! 😊 Me chamo [seu nome], da UHome. Vi teu interesse em {{empreendimento}} e queria te mostrar algo que faz sentido pro teu momento. Posso te contar mais?" },
    { title: "🔄 Reativação criativa", body: "{{nome}}, sei que a rotina é corrida! Mas não queria que tu perdesse as condições especiais de {{empreendimento}}. Qual o melhor horário pra gente trocar uma ideia rápida? 📞" },
  ],
  contato_iniciado: [
    { title: "🎯 Diagnóstico UHOME", body: "{{nome}}, queria entender melhor teu momento pra te mostrar algo que realmente faça sentido. Tu tá buscando pra morar ou investir?" },
    { title: "🔥 Oferta direcionada", body: "{{nome}}, baseado no que conversamos, separei 2 opções que fazem mais sentido pra ti. Posso te mandar? Uma delas é bem diferente do que tu tá vendo no mercado 😊" },
    { title: "📋 Follow-up conexão", body: "Oi {{nome}}! Separei umas opções que combinam com o que conversamos. Tem uma em especial que acho que tu vai gostar — posso te mandar? 😊" },
  ],
  qualificacao: [
    { title: "🎯 Versão direta", body: "{{nome}}, hoje tu tá mais olhando ou já pensando em fechar algo? Pergunto pra saber como te ajudar melhor 😊" },
    { title: "💰 Qualificação Investidor", body: "{{nome}}, tu tá pensando mais em renda ou valorização? Pergunto porque tenho opções diferentes pra cada objetivo 📊" },
    { title: "🏠 Qualificação Moradia", body: "{{nome}}, o que mais pesa pra ti hoje: espaço, localização ou valor? Assim consigo filtrar o que faz mais sentido 😊" },
  ],
  possivel_visita: [
    { title: "🎯 Convite direto", body: "{{nome}}, faz muito mais sentido ver isso pessoalmente — tenho dois horários livres, qual encaixa melhor pra ti?" },
    { title: "📅 Convite com urgência", body: "{{nome}}, as unidades de {{empreendimento}} que combinam contigo estão disponíveis pra visita! Fica melhor pra ti durante a semana ou no sábado? 📅" },
    { title: "🏠 Prova Social", body: "{{nome}}, vários clientes que visitaram {{empreendimento}} ficaram surpresos com o espaço ao vivo. Vale muito ver pessoalmente — quando fica bom pra ti? 🏠" },
  ],
  visita_marcada: [
    { title: "📹 D-2: Vídeo + Expectativa", body: "{{nome}}, olha esse vídeo rápido de {{empreendimento}} — amanhã tu vai ver isso ao vivo, é outro nível! 🎥" },
    { title: "🏆 D-1: Autoridade", body: "{{nome}}, separei as melhores unidades pra te mostrar amanhã. Algumas delas têm poucas disponíveis — vai ser ótimo ver ao vivo! Confirma pra mim? 😊" },
    { title: "📍 Dia: Lembrete + Mapa", body: "Bom dia, {{nome}}! Tudo pronto pra nossa visita hoje em {{empreendimento}}! 📍 Te espero lá. Se precisar reagendar, me avise! 😊" },
  ],
  visita_realizada: [
    { title: "🎯 Follow-up MESMO DIA", body: "{{nome}}, o que pesou mais pra ti na visita? Quero te mandar uma simulação certeira 😊" },
    { title: "🏠 Agradecimento + proposta", body: "{{nome}}, foi um prazer te receber em {{empreendimento}}! 🏠 Preparei uma simulação personalizada — posso te enviar pra analisar com calma?" },
    { title: "💭 Follow-up emocional", body: "{{nome}}, imagina tu morando ali, com toda aquela estrutura no dia a dia... Preparei as condições especiais — posso te mostrar? 😊" },
  ],
  negociacao: [
    { title: "📋 Follow-up proposta", body: "{{nome}}, conseguiu analisar a proposta de {{empreendimento}}? Tô aqui pra tirar qualquer dúvida ou ajustar as condições 🤝" },
    { title: "⚡ Urgência", body: "{{nome}}, as condições especiais de {{empreendimento}} estão chegando ao fim! As unidades mais procuradas tão sendo reservadas. Vamos fechar? 🏠🔑" },
    { title: "💰 Condições especiais", body: "{{nome}}, consegui uma condição diferenciada pra ti em {{empreendimento}}. Posso te explicar? Acho que vai fazer sentido 😊" },
  ],
  proposta: [
    { title: "📋 Follow-up proposta", body: "{{nome}}, conseguiu analisar a proposta de {{empreendimento}}? Tô aqui pra tirar qualquer dúvida ou ajustar as condições 🤝" },
    { title: "⚡ Urgência", body: "{{nome}}, as condições especiais de {{empreendimento}} estão chegando ao fim! As unidades mais procuradas tão sendo reservadas. Vamos fechar? 🏠🔑" },
    { title: "💰 Condições especiais", body: "{{nome}}, consegui uma condição diferenciada pra ti em {{empreendimento}}. Posso te explicar? Acho que vai fazer sentido 😊" },
  ],
};

const TASK_TYPES = [
  { value: "whatsapp", label: "WhatsApp", emoji: "💬" },
  { value: "ligar", label: "Ligar", emoji: "📞" },
  { value: "follow_up", label: "Follow-up", emoji: "📋" },
];

export default function WhatsAppFocusFlow({ isOpen, onClose, lead, stageTipo, onRefresh }: WhatsAppFocusFlowProps) {
  const { user } = useAuth();
  const [phase, setPhase] = useState<1 | 2>(1);
  const [saving, setSaving] = useState(false);
  const [obs, setObs] = useState("");
  const [taskType, setTaskType] = useState("whatsapp");
  const [taskDate, setTaskDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split("T")[0];
  });
  const [taskTime, setTaskTime] = useState("10:00");

  const nome = lead.nome?.split(" ")[0] || "cliente";
  const emp = lead.empreendimento || "nosso empreendimento";

  const messages = useMemo(() => {
    const key = stageTipo || "sem_contato";
    return (STAGE_MESSAGES[key] || STAGE_MESSAGES.sem_contato).map(m => ({
      ...m,
      body: m.body.replace(/\{\{nome\}\}/g, nome).replace(/\{\{empreendimento\}\}/g, emp),
    }));
  }, [stageTipo, nome, emp]);

  const phone = useMemo(() => {
    if (!lead.telefone) return "";
    const digits = lead.telefone.replace(/\D/g, "");
    return digits.startsWith("55") ? digits : `55${digits}`;
  }, [lead.telefone]);

  const registerActivity = useCallback(async () => {
    if (!user) return;
    await Promise.all([
      supabase.from("pipeline_atividades").insert({
        pipeline_lead_id: lead.id,
        tipo: "whatsapp",
        titulo: "WhatsApp enviado",
        data: new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }),
        prioridade: "media",
        status: "pendente",
        created_by: user.id,
      }),
      supabase.from("pipeline_leads").update({
        ultima_acao_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as any).eq("id", lead.id),
    ]);
  }, [user, lead.id]);

  const handleCopy = async (msg: string) => {
    navigator.clipboard.writeText(msg);
    toast.success("Mensagem copiada!");
    await registerActivity();
    setPhase(2);
  };

  const handleOpenWa = async (msg: string) => {
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, "_blank");
    await registerActivity();
    setPhase(2);
  };

  const handleSaveTask = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const titulo = `${TASK_TYPES.find(t => t.value === taskType)?.label || taskType} — ${lead.nome}`;
      await supabase.from("pipeline_tarefas").insert({
        pipeline_lead_id: lead.id,
        titulo,
        descricao: obs || null,
        tipo: taskType,
        vence_em: taskDate,
        hora_vencimento: taskTime || null,
        prioridade: "media",
        status: "pendente",
        created_by: user.id,
        responsavel_id: user.id,
      } as any);
      // Also register activity for the task
      await supabase.from("pipeline_atividades").insert({
        pipeline_lead_id: lead.id,
        tipo: "tarefa",
        titulo: `Tarefa criada: ${TASK_TYPES.find(t => t.value === taskType)?.label || taskType} — ${obs || lead.nome}`,
        data: new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }),
        prioridade: "media",
        status: "pendente",
        created_by: user.id,
      });
      // Update lead proxima_acao
      await supabase.from("pipeline_leads").update({
        proxima_acao: titulo,
        data_proxima_acao: taskDate,
        updated_at: new Date().toISOString(),
      } as any).eq("id", lead.id);
      toast.success("Tarefa criada ✅");
      onRefresh();
      handleClose();
    } catch (err: any) {
      toast.error("Erro: " + (err.message || ""));
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setPhase(1);
    setObs("");
    setTaskType("whatsapp");
    setTaskTime("10:00");
    const d = new Date();
    d.setDate(d.getDate() + 1);
    setTaskDate(d.toISOString().split("T")[0]);
    onClose();
  };

  if (!isOpen) return null;

  const initials = lead.nome?.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() || "??";

  const STAGE_LABELS: Record<string, string> = {
    novo: "Novo", sem_contato: "Sem Contato", contato_iniciado: "Atendimento",
    qualificacao: "Qualificação", possivel_visita: "Possível Visita",
    visita_marcada: "Visita Marcada", visita_realizada: "Visita Realizada",
    negociacao: "Negociação", proposta: "Proposta",
  };

  return createPortal(
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div
        style={{
          background: "#fff", borderRadius: 16, width: "100%", maxWidth: 480,
          maxHeight: "85vh", overflow: "hidden", display: "flex", flexDirection: "column",
          boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", gap: 12, padding: "16px 20px",
          borderBottom: "1px solid #e8e8f0",
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: "50%",
            background: "linear-gradient(135deg, #16a34a, #22c55e)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14, fontWeight: 700, color: "#fff",
          }}>
            {initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#0a0a0a" }}>{lead.nome}</div>
            <div style={{ fontSize: 12, color: "#64748b" }}>
              {lead.telefone || "Sem telefone"}
              {stageTipo && (
                <span style={{
                  marginLeft: 8, fontSize: 10, fontWeight: 600,
                  background: "#f0fdf4", color: "#16a34a",
                  padding: "2px 6px", borderRadius: 4,
                }}>
                  {STAGE_LABELS[stageTipo] || stageTipo}
                </span>
              )}
            </div>
          </div>
          <button onClick={handleClose} style={{
            width: 32, height: 32, borderRadius: 8, border: "none",
            background: "transparent", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#94a3b8",
          }}>
            <X style={{ width: 18, height: 18 }} />
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: "auto", padding: "16px 20px" }}>
          {phase === 1 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: "#64748b", marginBottom: 4 }}>
                💬 Escolha a mensagem para enviar:
              </p>
              {messages.map((msg, i) => (
                <div key={i} style={{
                  border: "1px solid #e8e8f0", borderRadius: 10, padding: "12px 14px",
                  background: "#fafafa",
                }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#0a0a0a", marginBottom: 6 }}>
                    {msg.title}
                  </div>
                  <p style={{
                    fontSize: 12, color: "#52525b", lineHeight: 1.5,
                    display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}>
                    {msg.body}
                  </p>
                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                    <button
                      onClick={() => handleCopy(msg.body)}
                      style={{
                        flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                        padding: "8px 12px", borderRadius: 8, border: "1px solid #e8e8f0",
                        background: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600, color: "#52525b",
                        transition: "all 0.15s",
                      }}
                    >
                      <Copy style={{ width: 13, height: 13 }} /> Copiar
                    </button>
                    <button
                      onClick={() => handleOpenWa(msg.body)}
                      disabled={!lead.telefone}
                      style={{
                        flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                        padding: "8px 12px", borderRadius: 8, border: "none",
                        background: "#16a34a", cursor: lead.telefone ? "pointer" : "not-allowed",
                        fontSize: 12, fontWeight: 600, color: "#fff",
                        opacity: lead.telefone ? 1 : 0.5,
                        transition: "all 0.15s",
                      }}
                    >
                      <ExternalLink style={{ width: 13, height: 13 }} /> Abrir WhatsApp
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Success chip */}
              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                background: "#f0fdf4", border: "1px solid #bbf7d0",
                borderRadius: 8, padding: "10px 14px",
              }}>
                <Check style={{ width: 16, height: 16, color: "#16a34a" }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: "#16a34a" }}>
                  WhatsApp enviado ✓
                </span>
              </div>

              {/* Observação */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#52525b", display: "block", marginBottom: 6 }}>
                  Observação (opcional)
                </label>
                <Textarea
                  className="text-[12px] min-h-[60px]"
                  placeholder="Ex: enviou interesse no Fase 3, aguardando resposta..."
                  value={obs}
                  onChange={(e) => setObs(e.target.value)}
                />
              </div>

              {/* Próxima tarefa */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#52525b", display: "block", marginBottom: 8 }}>
                  📋 Próxima tarefa
                </label>
                <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                  {TASK_TYPES.map(t => (
                    <button
                      key={t.value}
                      onClick={() => setTaskType(t.value)}
                      className={cn(
                        "text-[11px] px-3 py-1.5 rounded-md border transition-colors font-semibold",
                        taskType === t.value
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background border-border hover:border-primary/50"
                      )}
                    >
                      {t.emoji} {t.label}
                    </button>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <Input type="date" className="h-8 text-[12px] flex-1" value={taskDate} onChange={(e) => setTaskDate(e.target.value)} />
                  <Input type="time" className="h-8 text-[12px] w-28" value={taskTime} onChange={(e) => setTaskTime(e.target.value)} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          borderTop: "1px solid #e8e8f0", padding: "12px 20px",
          display: "flex", gap: 8, justifyContent: "flex-end",
        }}>
          {phase === 1 ? (
            <button
              onClick={handleClose}
              style={{
                padding: "8px 20px", borderRadius: 8, border: "1px solid #e8e8f0",
                background: "#fff", fontSize: 12, fontWeight: 600, color: "#64748b", cursor: "pointer",
              }}
            >
              Cancelar
            </button>
          ) : (
            <>
              <button
                onClick={handleClose}
                style={{
                  padding: "8px 16px", borderRadius: 8, border: "1px solid #e8e8f0",
                  background: "#fff", fontSize: 12, fontWeight: 600, color: "#64748b", cursor: "pointer",
                }}
              >
                Fechar sem tarefa
              </button>
              <button
                onClick={handleSaveTask}
                disabled={saving}
                style={{
                  padding: "8px 20px", borderRadius: 8, border: "none",
                  background: "#4F46E5", fontSize: 12, fontWeight: 600, color: "#fff",
                  cursor: saving ? "wait" : "pointer", opacity: saving ? 0.7 : 1,
                }}
              >
                {saving ? "Salvando..." : "✅ Salvar e fechar"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
