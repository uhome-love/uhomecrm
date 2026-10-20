import { HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { MOTIVO_META, MOTIVO_ORDEM, MOTIVO_PORQUE } from "./agendaMeta";

export default function AgendaAjuda() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" aria-label="Como funciona" className="h-11 w-11 shrink-0 rounded-full bg-muted p-0 text-muted-foreground md:h-auto md:w-auto md:gap-1.5 md:rounded-lg md:border md:border-border md:bg-transparent md:px-2.5 md:py-1.5 md:text-[12px]">
          <HelpCircle /><span className="hidden md:inline">Como funciona</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="max-h-[70dvh] w-80 max-w-[calc(100vw-2rem)] overflow-y-auto p-0">
        <div className="border-b border-border p-3">
          <p className="text-[13px] font-semibold text-foreground">Como a fila é ordenada</p>
          <p className="mt-0.5 text-[11.5px] text-muted-foreground">A Agenda mostra só quem precisa de <b>ação agora</b>, na ordem de valor:</p>
        </div>
        <ol className="divide-y divide-border">
          {MOTIVO_ORDEM.map((k, i) => {
            const m = MOTIVO_META[k];
            const Icon = m.icon;
            return (
              <li key={k} className="flex items-start gap-2.5 p-2.5">
                <span className="mt-0.5 text-[11px] font-bold tabular-nums text-muted-foreground">{i + 1}</span>
                <span className={cn("mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md", m.chip)}><Icon className="h-3 w-3" /></span>
                <div className="min-w-0"><p className="text-[12.5px] font-semibold text-foreground">{m.label}</p><p className="text-[11.5px] leading-snug text-muted-foreground">{MOTIVO_PORQUE[k]}</p></div>
              </li>
            );
          })}
        </ol>
        <div className="space-y-2 border-t border-border bg-muted/40 p-3 text-[11.5px] leading-snug text-muted-foreground">
          <p><b className="text-foreground">Empate:</b> quente antes de morno; e quem está há mais tempo sem falar sobe.</p>
          <p><b className="text-foreground">Sem Contato</b> vira um bloco só, para não entupir a fila.</p>
          <p><b className="text-foreground">Fica de fora</b> (segue no Pipeline): descartados, vendidos, estagnados e quem não tem nenhum gatilho de ação hoje.</p>
        </div>
      </PopoverContent>
    </Popover>
  );
}