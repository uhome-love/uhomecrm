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
              title: "Apresentação inicial",
              body: `Olá {{nome}}, tudo bem? 😊\n\nMe chamo [seu nome] e faço parte da equipe da UHome. Vi que você demonstrou interesse em {{empreendimento}}!\n\nPosso te ajudar com mais informações sobre o empreendimento, valores e condições especiais? 🏠`,
            },
            {
              title: "Follow-up sem resposta",
              body: `Oi {{nome}}! Tentei contato anteriormente sobre {{empreendimento}}. Sei que a rotina é corrida, mas não queria que você perdesse as condições especiais que temos!\n\nQual o melhor horário para conversarmos? 📞`,
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
              title: "Perguntas iniciais",
              body: `{{nome}}, que bom que conseguimos conversar! 😊\n\nPra te ajudar melhor, me conta:\n\n1️⃣ O imóvel seria para moradia ou investimento?\n2️⃣ Qual região você prefere?\n3️⃣ Tem ideia de orçamento?\n4️⃣ Precisa de financiamento?\n\nCom essas infos consigo filtrar as melhores opções pra você!`,
            },
            {
              title: "Follow-up conexão",
              body: `Oi {{nome}}! Tudo certo? 😊\n\nEstou separando algumas opções que combinam com o que conversamos. Tem alguma preferência adicional que gostaria de me passar?\n\nFico à disposição! 🏡`,
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
              title: "Apresentação de imóveis",
              body: `{{nome}}, separei algumas opções que combinam com o que você busca em {{empreendimento}}! 🏠✨\n\nVou te enviar uma vitrine personalizada com os imóveis que mais fazem sentido pro seu perfil.\n\nQualquer dúvida, estou aqui! 😊`,
            },
            {
              title: "Perguntas de perfil detalhado",
              body: `{{nome}}, pra acertar em cheio na recomendação:\n\n🏠 Prefere apartamento ou casa?\n📐 Metragem ideal?\n🛏️ Quantos quartos precisa?\n🚗 Precisa de vaga de garagem?\n🐕 Tem pets?\n\nAssim consigo encontrar o match perfeito! 🎯`,
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
              title: "Convite para visita",
              body: `{{nome}}, tenho uma ótima notícia! 🎉\n\nAs unidades que combinam com o que você busca em {{empreendimento}} estão disponíveis para visita!\n\nQue tal conhecer pessoalmente? Posso agendar para esta semana:\n📅 Qual dia e horário ficaria melhor pra você?\n\nVai ser incrível te mostrar tudo ao vivo! 🏠✨`,
            },
            {
              title: "Destaques do empreendimento",
              body: `{{nome}}, olha só os diferenciais de {{empreendimento}}:\n\n✅ Localização privilegiada\n✅ Acabamento premium\n✅ Área de lazer completa\n✅ Condições especiais de lançamento\n\nVale muito a pena conhecer pessoalmente! Vamos agendar? 📍`,
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
              body: `{{nome}}, lembrando da nossa visita amanhã em {{empreendimento}}! 🏠\n\n📍 Endereço: [endereço]\n⏰ Horário: [horário]\n\nEstou te esperando! Se precisar reagendar, me avise com antecedência. 😊`,
            },
            {
              title: "Confirmação no dia",
              body: `Bom dia, {{nome}}! 😊\n\nTudo pronto para nossa visita hoje em {{empreendimento}}!\n\nNos vemos em breve! Se tiver alguma dúvida no caminho, me chama. 📍🏡`,
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
              title: "Agradecimento pós-visita",
              body: `{{nome}}, foi um prazer te receber na visita de {{empreendimento}}! 🏠😊\n\nO que achou do empreendimento? Alguma unidade chamou mais a sua atenção?\n\nPosso preparar uma simulação personalizada pra você analisar com calma. Me diz! 📊`,
            },
            {
              title: "Envio de simulação",
              body: `{{nome}}, preparei a simulação que conversamos! 📊\n\nSegue as condições para {{empreendimento}}:\n\n💰 Entrada: [valor]\n📅 Parcelas: [valor]\n🏦 Financiamento: [condições]\n\nO que acha? Posso detalhar melhor qualquer ponto! 😊`,
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
              body: `{{nome}}, tudo bem? 😊\n\nConseguiu analisar a proposta que enviei de {{empreendimento}}?\n\nEstou à disposição para tirar qualquer dúvida ou ajustar as condições. Vamos encontrar o melhor caminho juntos! 🤝`,
            },
            {
              title: "Senso de urgência",
              body: `{{nome}}, passando pra te avisar que as condições especiais de {{empreendimento}} estão chegando ao fim! ⏳\n\nAs unidades mais procuradas estão sendo reservadas rapidamente. Não quero que você perca essa oportunidade!\n\nVamos fechar? 🏠🔑`,
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
