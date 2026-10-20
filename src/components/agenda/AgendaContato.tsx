import { Copy, MessageCircle, PhoneCall } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { waLink, telLink, formatPhoneBR } from "@/lib/phone";

export default function AgendaContato({ telefone }: { telefone: string | null }) {
  if (!telefone) return null;
  const wa = waLink(telefone);
  const tel = telLink(telefone);
  const numero = formatPhoneBR(telefone);
  const copiar = async () => {
    try { await navigator.clipboard.writeText(numero || telefone); toast.success("Número copiado"); }
    catch { toast.error("Não deu pra copiar"); }
  };
  return (
    <div className="flex shrink-0 items-center gap-1.5 md:gap-2" onClick={(e) => e.stopPropagation()}>
      {tel ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button asChild variant="ghost" className="h-11 w-11 rounded-full bg-muted p-0 text-primary md:h-auto md:w-auto md:gap-1.5 md:rounded-none md:bg-transparent md:p-0 md:text-[12.5px] md:text-foreground">
              <a href={tel} aria-label={`Ligar para ${numero}`}>
                <PhoneCall className="md:!h-3.5 md:!w-3.5" />
                <span className="hidden md:inline">{numero}</span>
              </a>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Ligar</TooltipContent>
        </Tooltip>
      ) : <span className="hidden text-[12.5px] tabular-nums text-muted-foreground md:inline">{numero}</span>}
      {wa && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button asChild variant="ghost" className="h-11 w-11 rounded-full bg-success/10 p-0 text-success-700 hover:bg-success/20 dark:text-success md:h-7 md:w-7 md:rounded-lg md:bg-success-600 md:text-success-foreground">
              <a href={wa} target="_blank" rel="noreferrer" aria-label="Abrir no WhatsApp"><MessageCircle /></a>
            </Button>
          </TooltipTrigger>
          <TooltipContent>WhatsApp</TooltipContent>
        </Tooltip>
      )}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button type="button" variant="ghost" onClick={copiar} aria-label="Copiar número" className="h-11 w-11 rounded-full p-0 text-muted-foreground md:h-7 md:w-7 md:rounded-lg md:border md:border-border"><Copy /></Button>
        </TooltipTrigger>
        <TooltipContent>Copiar número</TooltipContent>
      </Tooltip>
    </div>
  );
}