import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, X, CalendarPlus, ArrowRight } from "lucide-react";
import { toast } from "sonner";

interface HomiCopilotCardProps {
  leadName: string;
  lastMessage: string;
  onUseSuggestion: (text: string) => void;
}

const MOCK_SUGGESTIONS = [
  "Olá! Vi que você demonstrou interesse. Posso te ajudar com mais informações sobre o empreendimento?",
  "Que bom ter seu contato! Gostaria de agendar uma visita para conhecer o imóvel pessoalmente?",
  "Obrigado pela mensagem! Tenho algumas opções que combinam com o que você procura. Posso enviar?",
];

export default function HomiCopilotCard({ leadName, lastMessage, onUseSuggestion }: HomiCopilotCardProps) {
  const [visible, setVisible] = useState(true);
  const suggestion = MOCK_SUGGESTIONS[Math.floor(Math.random() * MOCK_SUGGESTIONS.length)];

  if (!visible) return null;

  return (
    <Card className="border-green-200 bg-green-50 dark:bg-green-950/30 dark:border-green-800 mx-4 mb-3">
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-green-700 dark:text-green-400">
            <Sparkles size={14} />
            <span className="text-xs font-semibold">HOMI Copilot</span>
          </div>
          <button onClick={() => setVisible(false)} className="text-muted-foreground hover:text-foreground">
            <X size={14} />
          </button>
        </div>
        <p className="text-xs text-muted-foreground">Sugestão de resposta para {leadName}:</p>
        <p className="text-sm bg-white dark:bg-background rounded-md p-2 border border-border">{suggestion}</p>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant="default" className="h-7 text-xs" onClick={() => onUseSuggestion(suggestion)}>
            Usar resposta
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setVisible(false)}>
            Ignorar
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => toast.info("Tarefa de follow-up criada (mockado)")}>
            <CalendarPlus size={12} /> Follow-up
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
