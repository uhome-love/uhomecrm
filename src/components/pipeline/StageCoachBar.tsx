import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Lightbulb, Copy, Phone, MessageSquare, Calendar, ChevronDown, Sparkles, Clock, CheckCircle2, AlertTriangle, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface StageCoachBarProps {
  stageTipo: string | undefined;
  leadNome: string;
  empreendimento: string | null | undefined;
  diasSemContato: number;
  tentativasLigacao: number;
  telefone: string | null | undefined;
  onAddTarefa: (data: any) => void;
  onOpenHomi?: (prompt?: string) => void;
  sequenceInfo?: { total: number; enviados: number } | null;
  origem?: string | null;
}

interface StageMessage {
  title: string;
  body: string;
  origens?: string[]; // if set, only show for these origins
}

interface StageConfig {
  diagnostic: string;
  color: string;
  alert?: { text: string; severity: "warning" | "danger" };
  actions: { label: string; icon: any; onClick?: () => void; homiPrompt?: string }[];
  messages: StageMessage[];
}

export default function StageCoachBar({
  stageTipo,
  leadNome,
  empreendimento,
  diasSemContato,
  tentativasLigacao,
  telefone,
  onAddTarefa,
  onOpenHomi,
  sequenceInfo,
  origem,
}: StageCoachBarProps) {
  const [expanded, setExpanded] = useState(false);
  const nome = leadNome?.split(" ")[0] || "cliente";
  const emp = empreendimento || "nosso empreendimento";

  const copyMessage = (msg: string) => {
    const final = msg
      .replace(/\{\{nome\}\}/g, nome)
      .replace(/\{\{empreendimento\}\}/g, emp);
    navigator.clipboard.writeText(final);
    toast.success("Mensagem copiada!");
  };

  const openWhatsApp = (msg: string) => {
    if (!telefone) { toast.error("Telefone não disponível"); return; }
    const phone = telefone.replace(/\D/g, "");
    const fullPhone = phone.startsWith("55") ? phone : `55${phone}`;
    const final = msg.replace(/\{\{nome\}\}/g, nome).replace(/\{\{empreendimento\}\}/g, emp);
    window.open(`https://wa.me/${fullPhone}?text=${encodeURIComponent(final)}`, "_blank");
  };

  const createQuickTask = (titulo: string, tipo: string) => {
    onAddTarefa({ titulo, tipo, prioridade: "alta" });
  };

  const triggerHomi = (prompt: string) => {
    if (onOpenHomi) onOpenHomi(prompt);
    else toast.info("Abra o painel do HOMI para usar esta ação");
  };

  // Follow-up day badge
  const followUpDay = sequenceInfo ? sequenceInfo.enviados + 1 : null;

  // Check if origin matches filter
  const matchesOrigem = (origens?: string[]) => {
    if (!origens) return true; // no filter = show always
    if (!origem) return origens.includes("default");
    const o = origem.toLowerCase();
    return origens.some(f => o.includes(f));
  };

  const config = useMemo((): StageConfig | null => {
    switch (stageTipo) {
      case "novo":
      case "sem_contato":
        return {
          diagnostic: diasSemContato > 0
            ? `Lead há ${diasSemContato} dia${diasSemContato > 1 ? "s" : ""} sem contato · ${tentativasLigacao} tentativa${tentativasLigacao !== 1 ? "s" : ""} de ligação`
            : `Novo lead aguardando primeiro contato · ${tentativasLigacao} tentativa${tentativasLigacao !== 1 ? "s" : ""}`,
          color: "border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20",
          actions: [
            { label: "Script de ligação", icon: Phone, homiPrompt: "Gere um script de ligação para primeiro contato com este lead na etapa sem_contato. Formato: apenas script Corretor/Cliente com no máximo 5 trocas. IMPORTANTE: Retorne SOMENTE o script de ligação no formato Corretor/Cliente. Nada mais. Sem análise, sem WhatsApp, sem recomendações." },
            { label: "WhatsApp apresentação", icon: MessageSquare, homiPrompt: "Gere uma mensagem de WhatsApp de primeiro contato para este lead. Formato: apenas 2 mensagens curtas (3 linhas cada) com tons diferentes. IMPORTANTE: Retorne SOMENTE as mensagens de WhatsApp prontas para copiar. Nada mais. Sem análise, sem script de ligação, sem recomendações." },
          ],
          messages: [
            {
              title: "🎯 Versão direta",
              body: `Fala {{nome}}, tudo bem? Vi que tu pediu info do {{empreendimento}} e resolvi te mandar uma msg rápido — posso te explicar melhor?`,
            },
            {
              title: "📱 Lead Portal (ImovelWeb)",
              body: `Fala {{nome}}! Vi teu interesse nesse imóvel — ele ainda tá disponível sim 👀 Mas me diz, tu tá procurando algo nesse estilo ou foi mais pelo valor?`,
              origens: ["portal", "imovelweb", "zap", "olx", "vivareal"],
            },
            {
              title: "Apresentação consultiva",
              body: `Oi {{nome}}! 😊 Me chamo [seu nome], da UHome. Vi teu interesse em {{empreendimento}} e queria te mostrar algo que faz sentido pro teu momento. Posso te contar mais?`,
            },
            {
              title: "Reativação criativa [Curiosidade]",
              body: `{{nome}}, sei que a rotina é corrida! Mas não queria que tu perdesse as condições especiais de {{empreendimento}}. Qual o melhor horário pra gente trocar uma ideia rápida? 📞`,
            },
          ],
        };

      case "contato_iniciado":
        return {
          diagnostic: diasSemContato >= 3
            ? `⚠️ Lead parado há ${diasSemContato} dias em Atendimento — etapa mais crítica do funil!`
            : "Conexão iniciada — framework UHOME: Relacionamento → Diagnóstico → Oferta (máx 3)",
          color: diasSemContato >= 3
            ? "border-destructive/40 bg-destructive/5 dark:bg-destructive/10"
            : "border-blue-500/30 bg-blue-50/50 dark:bg-blue-950/20",
          alert: diasSemContato >= 6
            ? { text: `URGENTE: ${diasSemContato} dias parado — lead esfriando! Ação imediata necessária.`, severity: "danger" }
            : diasSemContato >= 3
              ? { text: `Lead parado há ${diasSemContato} dias em Atendimento — empurre a etapa!`, severity: "warning" }
              : undefined,
          actions: [
            { label: "Perguntas de qualificação", icon: MessageSquare, homiPrompt: "Gere perguntas de qualificação UHOME para este lead em atendimento. Formato: apenas 2 mensagens WhatsApp curtas com perguntas estratégicas. IMPORTANTE: Retorne SOMENTE as mensagens de WhatsApp prontas para copiar. Nada mais. Sem análise, sem script, sem recomendações." },
            { label: "Agendar follow-up", icon: Calendar, onClick: () => createQuickTask(`Follow-up com ${nome}`, "follow_up") },
            { label: "Script de ligação", icon: Phone, homiPrompt: "Gere um script de ligação consultiva para este lead em atendimento. Formato: apenas script Corretor/Cliente. IMPORTANTE: Retorne SOMENTE o script de ligação no formato Corretor/Cliente. Nada mais. Sem análise, sem WhatsApp, sem recomendações." },
          ],
          messages: [
            {
              title: "🎯 Diagnóstico UHOME",
              body: `{{nome}}, queria entender melhor teu momento pra te mostrar algo que realmente faça sentido. Tu tá buscando pra morar ou investir?`,
            },
            {
              title: "🔥 Oferta direcionada (máx 3 opções)",
              body: `{{nome}}, baseado no que conversamos, separei 2 opções que fazem mais sentido pra ti. Posso te mandar? Uma delas é bem diferente do que tu tá vendo no mercado 😊`,
            },
            {
              title: "🏠 Lead Avulso (Usado)",
              body: `{{nome}}, esse imóvel é interessante dentro da proposta dele… mas depende muito do que tu busca. Dependendo do teu objetivo, consigo te mostrar opções melhores 😊`,
              origens: ["portal", "imovelweb", "zap", "olx", "vivareal", "usado"],
            },
            {
              title: "Follow-up conexão [Curiosidade]",
              body: `Oi {{nome}}! Separei umas opções que combinam com o que conversamos. Tem uma em especial que acho que tu vai gostar — posso te mandar? 😊`,
            },
          ],
        };

      case "qualificacao":
        return {
          diagnostic: "Lead em qualificação — entenda o perfil e apresente opções",
          color: "border-purple-500/30 bg-purple-50/50 dark:bg-purple-950/20",
          actions: [
            { label: "Enviar vitrine IA", icon: Sparkles, homiPrompt: "Gere uma vitrine personalizada com até 3 imóveis que fazem sentido para o perfil deste lead. Formato: apenas 2 mensagens WhatsApp curtas. IMPORTANTE: Retorne SOMENTE as mensagens de WhatsApp prontas para copiar. Nada mais. Sem análise, sem script, sem recomendações." },
            { label: "Completar perfil", icon: CheckCircle2, homiPrompt: "Quais informações faltam para qualificar este lead? Gere perguntas curtas para completar o perfil via WhatsApp. Formato: apenas mensagens WhatsApp. IMPORTANTE: Retorne SOMENTE as mensagens prontas para copiar. Nada mais." },
          ],
          messages: [
            {
              title: "🎯 Versão direta",
              body: `{{nome}}, hoje tu tá mais olhando ou já pensando em fechar algo? Pergunto pra saber como te ajudar melhor 😊`,
            },
            {
              title: "💰 Qualificação Investidor",
              body: `{{nome}}, tu tá pensando mais em renda ou valorização? Pergunto porque tenho opções diferentes pra cada objetivo 📊`,
            },
            {
              title: "🏠 Qualificação Moradia",
              body: `{{nome}}, o que mais pesa pra ti hoje: espaço, localização ou valor? Assim consigo filtrar o que faz mais sentido 😊`,
            },
            {
              title: "Perfil detalhado [Consultivo]",
              body: `{{nome}}, pra acertar em cheio: prefere apto ou casa? Quantos quartos? Precisa de vaga? Assim encontro o match perfeito pro teu perfil 🎯`,
            },
          ],
        };

      case "possivel_visita":
        return {
          diagnostic: "Lead aquecido — momento de agendar a visita!",
          color: "border-orange-500/30 bg-orange-50/50 dark:bg-orange-950/20",
          actions: [
            { label: "Agendar visita", icon: Calendar, onClick: () => createQuickTask(`Agendar visita com ${nome}`, "visita") },
            { label: "Destaques do imóvel", icon: MessageSquare, homiPrompt: "Gere os destaques e diferenciais do empreendimento para convencer este lead a visitar. Formato: apenas 2 mensagens WhatsApp curtas. IMPORTANTE: Retorne SOMENTE as mensagens de WhatsApp prontas para copiar. Nada mais. Sem análise, sem script, sem recomendações." },
          ],
          messages: [
            {
              title: "🎯 Versão direta",
              body: `{{nome}}, faz muito mais sentido ver isso pessoalmente — tenho dois horários livres, qual encaixa melhor pra ti?`,
            },
            {
              title: "Convite com urgência [Oportunidade]",
              body: `{{nome}}, as unidades de {{empreendimento}} que combinam contigo estão disponíveis pra visita! Fica melhor pra ti durante a semana ou no sábado? 📅`,
            },
            {
              title: "Destaques [Prova Social]",
              body: `{{nome}}, vários clientes que visitaram {{empreendimento}} ficaram surpresos com o espaço ao vivo. Vale muito ver pessoalmente — quando fica bom pra ti? 🏠`,
            },
          ],
        };

      case "visita_marcada":
        return {
          diagnostic: "🛡️ Anti No-show: Confirme D-2 (vídeo), D-1 (autoridade), Dia (lembrete+mapa)",
          color: "border-green-500/30 bg-green-50/50 dark:bg-green-950/20",
          actions: [
            { label: "Sequência anti no-show", icon: CheckCircle2, homiPrompt: "Gere a sequência completa anti no-show: D-2 (vídeo), D-1 (autoridade), Dia (lembrete+mapa). Formato: apenas 3 mensagens WhatsApp prontas para copiar. IMPORTANTE: Retorne SOMENTE as 3 mensagens de WhatsApp. Nada mais. Sem análise, sem script, sem recomendações." },
            { label: "Confirmar visita", icon: Phone, onClick: () => createQuickTask(`Confirmar visita ${nome}`, "ligacao") },
          ],
          messages: [
            {
              title: "📹 D-2: Vídeo + Expectativa",
              body: `{{nome}}, olha esse vídeo rápido de {{empreendimento}} — amanhã tu vai ver isso ao vivo, é outro nível! 🎥`,
            },
            {
              title: "🏆 D-1: Autoridade",
              body: `{{nome}}, separei as melhores unidades pra te mostrar amanhã. Algumas delas têm poucas disponíveis — vai ser ótimo ver ao vivo! Confirma pra mim? 😊`,
            },
            {
              title: "📍 Dia: Lembrete + Mapa",
              body: `Bom dia, {{nome}}! Tudo pronto pra nossa visita hoje em {{empreendimento}}! 📍 Te espero lá. Se precisar reagendar, me avise! 😊`,
            },
          ],
        };

      case "visita_realizada":
        return {
          diagnostic: "⚡ Regra UHOME: Follow-up no MESMO DIA da visita! Não deixe esfriar.",
          color: "border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20",
          alert: diasSemContato >= 1
            ? { text: `${diasSemContato} dia${diasSemContato > 1 ? "s" : ""} sem follow-up pós-visita — envie AGORA!`, severity: diasSemContato >= 3 ? "danger" : "warning" }
            : undefined,
          actions: [
            { label: "Follow-up pós-visita", icon: MessageSquare, homiPrompt: "Gere follow-up pós-visita para este lead. Formato: apenas 2 mensagens WhatsApp curtas. Pergunte o que mais impressionou e prepare terreno para proposta. IMPORTANTE: Retorne SOMENTE as mensagens de WhatsApp prontas para copiar. Nada mais. Sem análise, sem script, sem recomendações." },
            { label: "Criar proposta", icon: Calendar, onClick: () => createQuickTask(`Preparar proposta para ${nome}`, "follow_up") },
          ],
          messages: [
            {
              title: "🎯 Follow-up MESMO DIA",
              body: `{{nome}}, o que pesou mais pra ti na visita? Quero te mandar uma simulação certeira 😊`,
            },
            {
              title: "Agradecimento + proposta",
              body: `{{nome}}, foi um prazer te receber em {{empreendimento}}! 🏠 Preparei uma simulação personalizada — posso te enviar pra analisar com calma?`,
            },
            {
              title: "Follow-up emocional [Oportunidade]",
              body: `{{nome}}, imagina tu morando ali, com toda aquela estrutura no dia a dia... Preparei as condições especiais — posso te mostrar? 😊`,
            },
          ],
        };

      case "negociacao":
      case "proposta":
        return {
          diagnostic: "Lead em negociação — foco em fechar o negócio!",
          color: "border-red-500/30 bg-red-50/50 dark:bg-red-950/20",
          actions: [
            { label: "Follow-up proposta", icon: Phone, homiPrompt: "Gere script de follow-up da proposta para este lead em negociação. Formato: apenas script Corretor/Cliente curto. IMPORTANTE: Retorne SOMENTE o script de ligação no formato Corretor/Cliente. Nada mais. Sem análise, sem WhatsApp, sem recomendações." },
            { label: "Quebrar objeção", icon: MessageSquare, homiPrompt: "O lead recebeu proposta mas não fechou. Formato: apenas 2 mensagens WhatsApp curtas para quebrar objeções e fechar o negócio. IMPORTANTE: Retorne SOMENTE as mensagens de WhatsApp prontas para copiar. Nada mais. Sem análise, sem script, sem recomendações." },
          ],
          messages: [
            {
              title: "Follow-up proposta",
              body: `{{nome}}, conseguiu analisar a proposta de {{empreendimento}}? Tô aqui pra tirar qualquer dúvida ou ajustar as condições 🤝`,
            },
            {
              title: "Urgência [Escassez]",
              body: `{{nome}}, as condições especiais de {{empreendimento}} estão chegando ao fim! As unidades mais procuradas tão sendo reservadas. Vamos fechar? 🏠🔑`,
            },
            {
              title: "Condições especiais [Oportunidade]",
              body: `{{nome}}, consegui uma condição diferenciada pra ti em {{empreendimento}}. Posso te explicar? Acho que vai fazer sentido 😊`,
            },
          ],
        };

      default:
        return null;
    }
  }, [stageTipo, diasSemContato, tentativasLigacao, nome, emp]);

  if (!config) return null;

  // Filter messages by origin
  const filteredMessages = config.messages.filter(msg => matchesOrigem(msg.origens));

  // Determine dot color based on alert severity
  const dotColor = config.alert?.severity === "danger"
    ? "bg-[#E24B4A]"
    : config.alert?.severity === "warning"
      ? "bg-[#EF9F27]"
      : "bg-[#B4B2A9]";

  return (
    <div className="bg-muted border-b py-2 px-6 flex flex-col">
      {/* Alert banner for stalled leads */}
      {config.alert && (
        <div className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 mb-2 text-[11px] font-medium ${
          config.alert.severity === "danger"
            ? "bg-destructive/10 text-destructive border border-destructive/20"
            : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20"
        }`}>
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          {config.alert.text}
        </div>
      )}

      {/* Line 1 */}
      <div className="flex items-center gap-2 w-full flex-nowrap overflow-hidden">
        <span className={`inline-block w-[6px] h-[6px] rounded-full shrink-0 ${dotColor}`} />
        <p className="flex-1 min-w-0 truncate">
          <span className="font-medium text-foreground text-xs">{config.diagnostic}</span>
          {sequenceInfo && (
            <span className="text-muted-foreground text-xs ml-2">
              · Dia {Math.min(sequenceInfo.enviados + 1, sequenceInfo.total)}/{sequenceInfo.total}
            </span>
          )}
          {followUpDay && followUpDay <= 5 && (
            <span className="text-muted-foreground text-xs ml-1.5">
              {followUpDay === 1 && "· 📩 Msg simples"}
              {followUpDay === 2 && "· 🖼️ Imagem/Áudio"}
              {followUpDay === 3 && "· 🎥 Vídeo"}
              {followUpDay === 4 && "· ⚡ Urgência"}
              {followUpDay === 5 && "· 👋 Encerramento"}
            </span>
          )}
        </p>

        {/* Action buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          {config.actions.map((action, i) => (
            <button
              key={i}
              className="text-[11px] font-medium px-2.5 py-1 rounded-md border border-border bg-background text-muted-foreground hover:bg-muted transition-colors inline-flex items-center gap-1"
              onClick={action.onClick || (action.homiPrompt ? () => triggerHomi(action.homiPrompt!) : undefined)}
            >
              <action.icon className="h-3 w-3" />
              {action.label}
            </button>
          ))}
          {onOpenHomi && (
            <button
              className="text-[11px] font-medium px-2.5 py-1 rounded-md border border-border bg-background text-muted-foreground hover:bg-muted transition-colors inline-flex items-center gap-1"
              onClick={() => onOpenHomi()}
            >
              <Sparkles className="h-3 w-3" />
              HOMI
            </button>
          )}
        </div>

        {/* Expand trigger */}
        <Collapsible open={expanded} onOpenChange={setExpanded}>
          <CollapsibleTrigger asChild>
            <button className="text-[11px] text-muted-foreground hover:text-foreground transition-colors shrink-0 ml-1">
              {expanded ? "▴ Ocultar" : `▾ ${filteredMessages.length} mensagens`}
            </button>
          </CollapsibleTrigger>
        </Collapsible>
      </div>

      {/* Line 2 — expanded messages */}
      <Collapsible open={expanded} onOpenChange={setExpanded}>
        <CollapsibleContent className="border-t border-border pt-2 mt-2 flex flex-col gap-2">
          {filteredMessages.map((msg, i) => (
            <div key={i} className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-foreground">{msg.title}</span>
                {i === 0 && (
                  <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full" style={{ background: '#EEEDFE', color: '#534AB7' }}>
                    Recomendada
                  </span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                {msg.body
                  .replace(/\{\{nome\}\}/g, nome)
                  .replace(/\{\{empreendimento\}\}/g, emp)}
              </p>
              <div className="flex items-center gap-1">
                <button
                  className="text-[10px] px-2 py-1 rounded border border-border bg-muted inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => copyMessage(msg.body)}
                >
                  <Copy className="h-3 w-3" />
                  Copiar
                </button>
                {telefone && (
                  <button
                    className="text-[10px] px-2 py-1 rounded border border-border bg-muted inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => openWhatsApp(msg.body)}
                  >
                    <ExternalLink className="h-3 w-3" />
                    WhatsApp
                  </button>
                )}
              </div>
            </div>
          ))}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
