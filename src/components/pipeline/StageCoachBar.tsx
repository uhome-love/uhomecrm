import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Lightbulb, Copy, Phone, MessageSquare, Calendar, ChevronDown, Sparkles, Clock, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface StageCoachBarProps {
  stageTipo: string | undefined;
  leadNome: string;
  empreendimento: string | null | undefined;
  diasSemContato: number;
  tentativasLigacao: number;
  telefone: string | null | undefined;
  onAddTarefa: (data: any) => void;
  onOpenHomi?: () => void;
  sequenceInfo?: { total: number; enviados: number } | null;
}

interface StageConfig {
  diagnostic: string;
  color: string;
  actions: { label: string; icon: any; onClick?: () => void }[];
  messages: { title: string; body: string }[];
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

  const createQuickTask = (titulo: string, tipo: string) => {
    onAddTarefa({ titulo, tipo, prioridade: "alta" });
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
            { label: "Script de ligação", icon: Phone, onClick: () => createQuickTask(`Ligar para ${nome}`, "ligacao") },
            { label: "WhatsApp apresentação", icon: MessageSquare },
          ],
          messages: [
            {
              title: "🎯 Versão direta",
              body: `Fala {{nome}}, tudo bem? Vi que tu pediu info do {{empreendimento}} e resolvi te mandar uma msg rápido — posso te explicar melhor?`,
            },
            {
              title: "📱 Lead Portal (ImovelWeb)",
              body: `Fala {{nome}}! Vi teu interesse nesse imóvel — ele ainda tá disponível sim 👀 Mas me diz, tu tá procurando algo nesse estilo ou foi mais pelo valor?`,
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
          diagnostic: "Conexão iniciada — hora de qualificar o interesse",
          color: "border-blue-500/30 bg-blue-50/50 dark:bg-blue-950/20",
          actions: [
            { label: "Perguntas de qualificação", icon: MessageSquare },
            { label: "Agendar follow-up", icon: Calendar, onClick: () => createQuickTask(`Follow-up com ${nome}`, "follow_up") },
          ],
          messages: [
            {
              title: "🎯 Versão direta",
              body: `{{nome}}, queria entender melhor teu momento pra te mostrar algo que realmente faça sentido. Tu tá buscando pra morar ou investir?`,
            },
            {
              title: "🏠 Lead Avulso (Usado)",
              body: `{{nome}}, esse imóvel é interessante dentro da proposta dele… mas depende muito do que tu busca. Dependendo do teu objetivo, consigo te mostrar opções melhores 😊`,
            },
            {
              title: "Perguntas estratégicas",
              body: `{{nome}}, que bom que conseguimos conversar! 😊 Me conta: o imóvel seria pra moradia ou investimento? E qual região tu prefere? Com essas infos consigo filtrar as melhores opções!`,
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
            { label: "Enviar vitrine IA", icon: Sparkles },
            { label: "Completar perfil", icon: CheckCircle2 },
          ],
          messages: [
            {
              title: "🎯 Versão direta",
              body: `{{nome}}, hoje tu tá mais olhando ou já pensando em fechar algo? Pergunto pra saber como te ajudar melhor 😊`,
            },
            {
              title: "Apresentação personalizada",
              body: `{{nome}}, separei opções que combinam com o que tu busca em {{empreendimento}}! 🏠 Vou te enviar uma vitrine personalizada. Qualquer dúvida, tô aqui!`,
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
            { label: "Destaques do imóvel", icon: MessageSquare },
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
          diagnostic: "Visita agendada — confirme e reforce a importância!",
          color: "border-green-500/30 bg-green-50/50 dark:bg-green-950/20",
          actions: [
            { label: "Lembrete ao cliente", icon: MessageSquare },
            { label: "Confirmar visita", icon: CheckCircle2 },
          ],
          messages: [
            {
              title: "Lembrete D-1",
              body: `{{nome}}, lembrando da nossa visita amanhã em {{empreendimento}}! 📍 Te espero lá. Se precisar reagendar, me avise! 😊`,
            },
            {
              title: "Confirmação no dia",
              body: `Bom dia, {{nome}}! Tudo pronto pra nossa visita hoje em {{empreendimento}}! Nos vemos em breve 🏡`,
            },
            {
              title: "Reforço de importância [Escassez]",
              body: `{{nome}}, separei as melhores unidades pra te mostrar amanhã. Algumas delas têm poucas disponíveis — vai ser ótimo ver ao vivo! 😊`,
            },
          ],
        };

      case "visita_realizada":
        return {
          diagnostic: "Visita feita — momento crucial para avançar para proposta!",
          color: "border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20",
          actions: [
            { label: "Enviar simulação", icon: MessageSquare },
            { label: "Criar proposta", icon: Calendar, onClick: () => createQuickTask(`Preparar proposta para ${nome}`, "follow_up") },
          ],
          messages: [
            {
              title: "🎯 Versão direta",
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
            { label: "Follow-up proposta", icon: Phone, onClick: () => createQuickTask(`Follow-up proposta ${nome}`, "follow_up") },
            { label: "Condições especiais", icon: MessageSquare },
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

  return (
    <div className={`mx-5 mb-2 rounded-lg border ${config.color} p-3`}>
      <div className="flex items-start gap-2">
        <Lightbulb className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-xs font-medium text-foreground">{config.diagnostic}</p>
            {sequenceInfo && (
              <Badge variant="outline" className="text-[10px] h-4 gap-1">
                <Clock className="h-2.5 w-2.5" />
                Sequência: {sequenceInfo.enviados}/{sequenceInfo.total}
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            {config.actions.map((action, i) => (
              <Button
                key={i}
                variant="outline"
                size="sm"
                className="h-7 text-[11px] gap-1 px-2.5"
                onClick={action.onClick}
              >
                <action.icon className="h-3 w-3" />
                {action.label}
              </Button>
            ))}
            {onOpenHomi && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-[11px] gap-1 px-2.5 text-primary"
                onClick={onOpenHomi}
              >
                <Sparkles className="h-3 w-3" />
                HOMI
              </Button>
            )}
          </div>

          <Collapsible open={expanded} onOpenChange={setExpanded}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1 px-1.5 mt-1.5 text-muted-foreground hover:text-foreground">
                <ChevronDown className={`h-3 w-3 transition-transform ${expanded ? "rotate-180" : ""}`} />
                {expanded ? "Ocultar mensagens" : `${config.messages.length} mensagens prontas`}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 space-y-2">
              {config.messages.map((msg, i) => (
                <div key={i} className="bg-background/80 rounded-md border border-border/50 p-2.5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-medium">{msg.title}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 text-[10px] gap-1 px-1.5"
                      onClick={() => copyMessage(msg.body)}
                    >
                      <Copy className="h-3 w-3" />
                      Copiar
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground whitespace-pre-wrap leading-relaxed">
                    {msg.body
                      .replace(/\{\{nome\}\}/g, nome)
                      .replace(/\{\{empreendimento\}\}/g, emp)}
                  </p>
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>
        </div>
      </div>
    </div>
  );
}
