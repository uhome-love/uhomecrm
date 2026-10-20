import { RefreshCw } from "lucide-react";
import type { CeoDashboardController } from "@/hooks/useCeoDashboardController";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { BRT_TIMEZONE } from "@/lib/brtTime";

export default function MobileHeader({ model }: { model: CeoDashboardController }) {
  const date = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: BRT_TIMEZONE }).format(new Date());
  return <header className="ceo-mobile flex items-center justify-between gap-3 px-[18px] pt-6 pb-5">
    <div className="min-w-0"><p className="mb-1 text-xs capitalize text-muted-foreground">{date}</p><h1 className="text-[32px] font-bold leading-tight text-foreground">Painel</h1><p className="mt-1.5 break-words text-[13px] text-muted-foreground">{model.profile?.nome || "CEO"} · CEO</p></div>
    <Tooltip><TooltipTrigger asChild><Button variant="secondary" size="icon" onClick={model.reload} aria-label="Atualizar painel" className="h-11 w-11 shrink-0 rounded-full"><RefreshCw className="text-muted-foreground" /></Button></TooltipTrigger><TooltipContent>Atualizar painel</TooltipContent></Tooltip>
  </header>;
}