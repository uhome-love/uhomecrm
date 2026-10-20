import { CheckCircle2, History, MoreHorizontal, Zap } from "lucide-react";
import type { LeadFila } from "@/hooks/useFilaDoDia";
import type { PipelineLead, PipelineStage } from "@/hooks/usePipeline";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import CardOverflowMenu from "@/components/pipeline/CardOverflowMenu";
import HomiSugestaoMensagem from "@/components/pipeline/HomiSugestaoMensagem";
import { cn } from "@/lib/utils";
import { limparRegistro } from "@/lib/registroLimpo";
import AgendaContato from "./AgendaContato";
import { diasLabel, MOTIVO_META, SAUDE_BORDER, TEMP_LABEL } from "./agendaMeta";

interface Props {
  lead: LeadFila;
  stages: PipelineStage[];
  onRegistrar: () => void;
  onOpen: () => void;
  onMove: (leadId: string, stageId: string) => void;
  onDispensar: () => void;
  destacado?: boolean;
  feito?: boolean;
}

export default function AgendaPrioridadeCard({ lead, stages, onRegistrar, onOpen, onMove, onDispensar, destacado, feito }: Props) {
  const meta = MOTIVO_META[lead.motivo];
  const Icon = meta.icon;
  const temp = TEMP_LABEL[(lead.temperatura ?? "").toLowerCase()];
  const registro = limparRegistro(lead.ultimo_registro);
  const leadObj = {
    id: lead.id, nome: lead.nome, stage_id: lead.stage_id, corretor_id: lead.corretor_id,
    telefone: lead.telefone, empreendimento: lead.empreendimento,
  } as unknown as PipelineLead;
  const registrar = (mobile: boolean) => feito ? (
    <span role="status" className={cn("items-center gap-1.5 rounded-lg bg-success/10 px-3 py-2 text-[12.5px] font-semibold text-success-700 dark:text-success", mobile ? "ml-auto inline-flex h-11 md:hidden" : "hidden md:inline-flex")}><CheckCircle2 className="h-4 w-4" />Feito</span>
  ) : (
    <Button onClick={(e) => { e.stopPropagation(); onRegistrar(); }} className={cn("gap-1.5 rounded-lg text-[13px]", mobile ? "ml-auto h-11 px-3.5 md:hidden" : "hidden h-auto px-3 py-2 text-[12.5px] md:inline-flex")}><Zap />Registrar</Button>
  );
  return (
    <article data-lead-id={lead.id} onClick={onOpen} className={cn(
      "group relative cursor-pointer overflow-hidden rounded-xl border border-border bg-card transition-all duration-500 motion-reduce:transition-none hover:bg-muted/20 md:p-3 md:pl-4",
      "before:absolute before:bottom-0 before:left-0 before:top-0 before:w-1 before:hidden md:before:block",
      SAUDE_BORDER[lead.saude] ?? "before:bg-warning",
      destacado && "ring-2 ring-primary ring-offset-2 ring-offset-background",
      feito && "translate-x-2 border-success/60 bg-success/5 opacity-70 before:bg-success",
    )}>
      <div className="flex items-start justify-between gap-2 p-4 pb-3 md:gap-3 md:p-0">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={cn("inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold md:rounded-full md:py-0.5", meta.chip)}><Icon className="h-3 w-3" />{meta.label}</span>
            {lead.resultado && <span className="text-[11.5px] font-medium text-foreground/80">{lead.resultado}</span>}
            {temp && <span className={cn("text-[11.5px] font-semibold", temp.c)}>· {temp.t}</span>}
          </div>
          <div className="mt-2 min-w-0 md:mt-1.5 md:flex md:items-center md:gap-2">
            <Button variant="link" onClick={(e) => { e.stopPropagation(); onOpen(); }} className="block h-auto max-w-full whitespace-normal break-words p-0 text-left text-lg font-bold leading-snug text-foreground hover:no-underline md:truncate md:whitespace-nowrap md:text-[15px] md:font-semibold">{lead.nome}</Button>
            <p className="mt-1 break-words text-xs text-muted-foreground md:mt-0 md:shrink-0 md:text-[11.5px]">{lead.stage_nome}<span className="md:hidden">{lead.empreendimento ? ` · ${lead.empreendimento}` : ""}</span></p>
          </div>
          <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground md:mt-0.5 md:text-[11.5px]"><History className="h-3.5 w-3.5 shrink-0 md:h-3 md:w-3" />{lead.tem_atividade ? `Última atividade · ${diasLabel(lead.dias_sem_atividade, true)}` : "Sem atividade ainda"}</p>
          {registro && <div className="mt-2 break-words rounded-lg bg-muted/60 px-3 py-2.5 text-[13px] leading-relaxed text-foreground/80 md:mt-1.5 md:px-2.5 md:py-1.5 md:text-[12px] md:italic md:leading-snug">{registro}</div>}
          <HomiSugestaoMensagem nome={lead.nome} empreendimento={lead.empreendimento} telefone={lead.telefone} motivo={lead.motivo} stageNome={lead.stage_nome} ultimoRegistro={registro || null} />
        </div>
        <div className="-mr-2 -mt-2 flex shrink-0 items-start gap-1 md:mr-0 md:mt-0">
          {registrar(false)}
          <CardOverflowMenu lead={leadObj} stages={stages} onMoveLead={onMove} onOpenDetail={onOpen} onRegistrarAtividade={onRegistrar} trigger={
            <Button variant="ghost" size="icon" aria-label={`Ações de ${lead.nome}`} onClick={(e) => e.stopPropagation()} className="h-11 w-11 rounded-full text-muted-foreground md:h-6 md:w-6 md:rounded-md"><MoreHorizontal /></Button>
          } />
        </div>
      </div>
      <div className="flex items-center gap-1.5 border-t border-border/50 px-4 py-3 md:mt-2 md:justify-between md:gap-2 md:px-0 md:pb-0 md:pt-2">
        <div className="hidden md:block"><Button variant="ghost" onClick={(e) => { e.stopPropagation(); onDispensar(); }} title="Dispensar — tira este card da sugestão por 24h" className="h-auto p-0 text-[11.5px] font-medium text-muted-foreground">Dispensar</Button></div>
        <AgendaContato telefone={lead.telefone} />
        {registrar(true)}
      </div>
      <div className="px-4 pb-2 md:hidden"><Button variant="ghost" onClick={(e) => { e.stopPropagation(); onDispensar(); }} title="Dispensar — tira este card da sugestão por 24h" className="h-11 p-0 text-xs font-medium text-muted-foreground">Dispensar por hoje</Button></div>
    </article>
  );
}