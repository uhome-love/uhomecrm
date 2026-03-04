import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, FileText, MessageCircle, Mail, ChevronDown, ChevronUp } from "lucide-react";
import { useOATemplates, type OALead } from "@/hooks/useOfertaAtiva";
import { toast } from "sonner";

interface Props {
  empreendimento: string;
  lead?: OALead | null;
}

const OBJECTIONS = [
  { q: "Já comprei outro imóvel", a: "Entendo! Mas esse empreendimento tem condições exclusivas. Posso te mostrar em 5 minutos?" },
  { q: "Não tenho interesse agora", a: "Sem problema! Posso enviar informações por WhatsApp para quando for o momento?" },
  { q: "Está caro demais", a: "Temos opções de entrada facilitada e tabela direta. Posso simular sem compromisso?" },
  { q: "Preciso falar com esposa/marido", a: "Claro! Que tal uma visita juntos? Posso agendar no melhor horário para vocês." },
  { q: "Só estava pesquisando", a: "Pesquisar é o primeiro passo! O que mais chamou sua atenção? Posso te ajudar com detalhes." },
];

export default function ScriptPanel({ empreendimento, lead }: Props) {
  const { templates } = useOATemplates(empreendimento);
  const [showObjections, setShowObjections] = useState(false);

  const scriptTemplate = templates.find(t => t.canal === "whatsapp" && t.tipo === "primeiro_contato");
  const emailTemplate = templates.find(t => t.canal === "email" && t.tipo === "primeiro_contato");

  const leadName = lead?.nome || "{nome}";
  const emp = lead?.empreendimento || empreendimento;

  const scriptLigacao = `Olá, ${leadName}! Aqui é da Uhome, tudo bem?\n\nVi que você se interessou pelo ${emp}. Tenho informações atualizadas sobre valores e condições especiais.\n\nPosso te contar em 2 minutos?`;

  const scriptWhatsApp = scriptTemplate
    ? scriptTemplate.conteudo.replace("{nome}", leadName).replace("{empreendimento}", emp)
    : `Olá ${leadName}! 😊\n\nVi que você se interessou pelo *${emp}*. Tenho novidades sobre condições exclusivas!\n\nPodemos conversar rapidinho?`;

  const scriptEmail = emailTemplate
    ? emailTemplate.conteudo.replace("{nome}", leadName).replace("{empreendimento}", emp)
    : `Olá ${leadName},\n\nGostaria de apresentar mais detalhes sobre o ${emp}.\n\nTemos condições especiais que podem te interessar. Podemos agendar uma conversa?\n\nAbraços,\nEquipe Uhome`;

  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
  };

  return (
    <div className="space-y-3 h-full overflow-y-auto">
      {/* Script Ligação */}
      <Card className="border-emerald-500/20">
        <CardContent className="p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-emerald-600" />
              <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">Script Ligação</h4>
            </div>
            <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => copyText(scriptLigacao, "Script")}>
              <Copy className="h-3 w-3" /> Copiar
            </Button>
          </div>
          <p className="text-xs text-muted-foreground whitespace-pre-line leading-relaxed bg-muted/50 p-2.5 rounded-lg border border-border">
            {scriptLigacao}
          </p>
        </CardContent>
      </Card>

      {/* Objeções */}
      <Card>
        <CardContent className="p-3">
          <button
            className="flex items-center justify-between w-full text-left"
            onClick={() => setShowObjections(!showObjections)}
          >
            <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">⚡ Objeções Rápidas</h4>
            {showObjections ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
          {showObjections && (
            <div className="mt-2 space-y-2">
              {OBJECTIONS.map((obj, i) => (
                <div key={i} className="text-xs rounded-lg bg-muted/50 p-2 border border-border">
                  <p className="font-semibold text-foreground">"{obj.q}"</p>
                  <p className="text-muted-foreground mt-0.5">→ {obj.a}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* CTA Final */}
      <Card className="border-primary/20">
        <CardContent className="p-3">
          <h4 className="text-xs font-bold text-primary uppercase tracking-wider mb-1.5">🎯 CTA Final</h4>
          <p className="text-xs text-muted-foreground italic bg-primary/5 p-2 rounded-lg">
            "Que tal agendar uma visita sem compromisso? Posso reservar o melhor horário para você!"
          </p>
        </CardContent>
      </Card>

      {/* Copy buttons */}
      <div className="grid grid-cols-2 gap-2">
        <Button size="sm" variant="outline" className="gap-1.5 text-xs h-9" onClick={() => copyText(scriptWhatsApp, "WhatsApp")}>
          <MessageCircle className="h-3.5 w-3.5 text-green-600" /> Copiar WhatsApp
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5 text-xs h-9" onClick={() => copyText(scriptEmail, "E-mail")}>
          <Mail className="h-3.5 w-3.5 text-blue-500" /> Copiar E-mail
        </Button>
      </div>

      <div className="text-center">
        <Badge variant="outline" className="text-[10px]">{empreendimento}</Badge>
      </div>
    </div>
  );
}
