import { CheckCircle2 } from "lucide-react";
import type { LeadFila } from "@/hooks/useFilaDoDia";
import { Button } from "@/components/ui/button";
import { limparRegistro } from "@/lib/registroLimpo";

export default function AgendaFeitoCard({ lead, onOpen, onVoltar }: { lead: LeadFila; onOpen: () => void; onVoltar: () => void }) {
  const hora = lead.ultimo_toque_at ? new Date(lead.ultimo_toque_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }) : null;
  const registro = limparRegistro(lead.ultimo_registro);
  return (
    <article onClick={onOpen} className="group relative cursor-pointer overflow-hidden rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted/20 md:p-3 md:pl-4 before:absolute before:bottom-0 before:left-0 before:top-0 before:w-1 before:bg-success">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 flex-1">
          <div className="min-w-0 md:flex md:items-center md:gap-2">
            <Button variant="link" onClick={(e) => { e.stopPropagation(); onOpen(); }} className="block h-auto max-w-full whitespace-normal break-words p-0 text-left text-lg font-bold text-foreground hover:no-underline md:truncate md:whitespace-nowrap md:text-[14.5px] md:font-semibold">{lead.nome}</Button>
            <p className="mt-1 text-xs text-muted-foreground md:mt-0 md:shrink-0 md:text-[11.5px]">{lead.stage_nome}<span className="md:hidden">{lead.empreendimento ? ` · ${lead.empreendimento}` : ""}</span></p>
          </div>
          <p className="mt-2 flex items-center gap-1.5 text-xs text-success-700 dark:text-success md:mt-0.5 md:text-[11.5px]"><CheckCircle2 className="h-3.5 w-3.5 shrink-0" />registrado{hora ? ` às ${hora}` : " hoje"}</p>
          {registro && <div className="mt-2 break-words rounded-lg bg-muted/60 px-3 py-2 text-[13px] leading-relaxed text-foreground/80 md:mt-1.5 md:px-2.5 md:py-1.5 md:text-[12px] md:italic md:leading-snug">{registro}</div>}
        </div>
        <Button variant="outline" onClick={(e) => { e.stopPropagation(); onVoltar(); }} title="Voltar este lead pra fila de hoje" className="h-11 self-start rounded-lg px-3 text-xs font-medium text-muted-foreground md:h-auto md:shrink-0 md:px-2.5 md:py-1.5 md:text-[11.5px]">Voltar pra fila</Button>
      </div>
    </article>
  );
}