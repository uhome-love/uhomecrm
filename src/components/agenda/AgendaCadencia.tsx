import { useState } from "react";
import { ChevronDown, PhoneCall, Zap } from "lucide-react";
import type { LeadFila } from "@/hooks/useFilaDoDia";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import AgendaContato from "./AgendaContato";
import { diasLabel } from "./agendaMeta";

export default function AgendaCadencia({ total, leads, onRegistrar, onOpen }: { total: number; leads: LeadFila[]; onRegistrar: (lead: LeadFila) => void; onOpen: (id: string) => void }) {
  const [aberto, setAberto] = useState(false);
  if (total === 0) return null;
  return (
    <section className="overflow-hidden border-y border-border md:rounded-xl md:border md:bg-card">
      <Button variant="ghost" aria-expanded={aberto} onClick={() => setAberto((v) => !v)} className="h-auto w-full justify-start gap-3 whitespace-normal rounded-none px-1 py-4 text-left md:gap-2.5 md:px-3.5 md:py-3">
        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary md:h-8 md:w-8 md:rounded-lg"><PhoneCall /></span>
        <span className="min-w-0 flex-1"><span className="block text-[14px] font-semibold text-foreground md:text-[13.5px]">{total} {total === 1 ? "lead" : "leads"} da cadência Sem Contato</span><span className="mt-1 block text-xs font-normal text-muted-foreground md:text-[11.5px]">{total === 1 ? "Tentativa" : "Tentativas"} de hoje</span></span>
        <ChevronDown className={cn("text-muted-foreground transition-transform motion-reduce:transition-none", aberto && "rotate-180")} />
      </Button>
      {aberto && <div className="divide-y divide-border/60 border-t border-border">{leads.map((lead) => (
        <div key={lead.id} className="flex flex-col gap-3 py-4 md:flex-row md:items-center md:gap-2 md:px-3.5 md:py-2.5">
          <Button variant="link" onClick={() => onOpen(lead.id)} className="block h-auto min-w-0 flex-1 whitespace-normal p-0 text-left text-foreground hover:no-underline"><span className="block break-words text-[16px] font-semibold md:truncate md:text-[13px] md:font-medium">{lead.nome}</span><span className="mt-1 block text-xs font-normal text-muted-foreground md:truncate md:text-[11px]">última atividade · {diasLabel(lead.dias_sem_atividade, lead.tem_atividade)}</span></Button>
          <div className="flex items-center justify-between gap-2"><AgendaContato telefone={lead.telefone} /><Button onClick={() => onRegistrar(lead)} className="h-11 rounded-lg px-3 text-[13px] md:h-auto md:px-2.5 md:py-1.5 md:text-[12px]"><Zap />Registrar</Button></div>
        </div>
      ))}</div>}
    </section>
  );
}