import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Info, Phone, ThumbsUp, ThumbsDown, PhoneMissed, PhoneOff, Trophy, Star } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useState } from "react";

const SCORING_RULES = [
  { resultado: "Agendamento de visita", descricao: "Visita marcada com o lead", pontos: 30, icon: Trophy, color: "text-emerald-500" },
  { resultado: "Com interesse (Aproveitado)", descricao: "Lead convertido — transferido para cadastro", pontos: 5, icon: ThumbsUp, color: "text-emerald-500" },
  { resultado: "Ligação / WhatsApp / E-mail", descricao: "Tentativa de contato — não pontua", pontos: 0, icon: Phone, color: "text-primary" },
  { resultado: "Não atendeu", descricao: "Lead não atendeu, volta à fila com cooldown", pontos: 0, icon: PhoneMissed, color: "text-blue-500" },
  { resultado: "Sem interesse", descricao: "Lead descartado — removido da fila", pontos: 0, icon: ThumbsDown, color: "text-amber-500" },
  { resultado: "Número errado", descricao: "Telefone bloqueado — lead removido", pontos: 0, icon: PhoneOff, color: "text-destructive" },
];

const BADGES_INFO = [
  { label: "🔥 Missão Cumprida", descricao: "Atingiu a meta diária de ligações" },
  { label: "🏆 Discador do Dia", descricao: "Mais tentativas no período" },
  { label: "⭐ Matador de Oportunidades", descricao: "Mais aproveitados no período" },
  { label: "📈 Alta Conversão", descricao: "Melhor taxa de conversão (mín. 5 tentativas)" },
];

export default function ScoringLegend() {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <Info className="h-3.5 w-3.5" />
          <span className="underline underline-offset-2">Como funciona a pontuação?</span>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <Card className="mt-2 border-primary/15 bg-primary/5">
          <CardContent className="p-4 space-y-4">
            {/* Title */}
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-primary" />
              <h4 className="text-sm font-bold text-foreground">Sistema de Pontuação Gamificado</h4>
            </div>

            {/* Points Table */}
            <div>
              <p className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider mb-2">Pontos por ação</p>
              <div className="space-y-1.5">
                {SCORING_RULES.map(rule => {
                  const Icon = rule.icon;
                  return (
                    <div key={rule.resultado} className="flex items-center gap-2 text-xs">
                      <Icon className={`h-3.5 w-3.5 shrink-0 ${rule.color}`} />
                      <span className="text-foreground font-medium flex-1">{rule.resultado}</span>
                      <Badge
                        variant={rule.pontos >= 5 ? "default" : "secondary"}
                        className="text-[10px] h-5 min-w-[40px] justify-center"
                      >
                        {rule.pontos === 0 ? "0 pts" : `+${rule.pontos} pt${rule.pontos > 1 ? "s" : ""}`}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Badges */}
            <div>
              <p className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider mb-2">Conquistas e Badges</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {BADGES_INFO.map(b => (
                  <div key={b.label} className="flex items-start gap-1.5 text-xs">
                    <Star className="h-3 w-3 text-warning shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-foreground">{b.label}</span>
                      <p className="text-muted-foreground text-[10px]">{b.descricao}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tips */}
            <div className="p-2 rounded-lg bg-muted/50 border border-border text-[10px] text-muted-foreground">
              <strong className="text-foreground">💡 Dica:</strong> Tentativa não pontua — o que vale é resultado: aproveitar o lead (+5) e, principalmente, agendar visita (+30).
              Configure suas metas diárias na <strong>"Minha Área"</strong> para acompanhar seu progresso.
            </div>
          </CardContent>
        </Card>
      </CollapsibleContent>
    </Collapsible>
  );
}
