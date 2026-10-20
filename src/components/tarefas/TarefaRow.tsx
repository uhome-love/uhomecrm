import { MessageCircle, Phone, Check, ExternalLink, StickyNote } from "lucide-react";
import { cn } from "@/lib/utils";
import { waLink, telLink } from "@/lib/phone";
import type { TarefaItem } from "@/hooks/useMinhasTarefas";
import { hojeBRT } from "@/hooks/useMinhasTarefas";
import type { LeadContexto } from "@/hooks/useLeadContextoTarefas";
import MiniHistorico, { EtapaChip, UltimaAcaoTexto } from "./MiniHistorico";

interface Props {
  t: TarefaItem;
  ctx?: LeadContexto;
  corretorNome?: string;
  somenteLeitura?: boolean;
  onAbrir: (leadId: string) => void;
  onConcluir: (t: TarefaItem) => void;
}

function quando(t: TarefaItem): string {
  const hora = t.hora_vencimento ? t.hora_vencimento.slice(0, 5) : "";
  if (!t.vence_em) return hora || "—";
  if (t.vence_em === hojeBRT()) return hora || "Hoje";
  const [, m, d] = t.vence_em.split("-");
  return `${d}/${m}${hora ? ` ${hora}` : ""}`;
}

/** "Próximo contato: Nilton Goulart" → "Próximo contato" (o nome já aparece em destaque). */
function tituloSemNome(titulo: string, nome?: string | null): string {
  const base = (titulo || "Tarefa").split(" — ")[0];
  if (!nome) return base;
  const limpo = base.replace(new RegExp(`\\s*[:\\-–]\\s*${nome.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "i"), "");
  return limpo.trim() || base;
}

const iconBtn = "inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground";

export default function TarefaRow({ t, ctx, corretorNome, somenteLeitura, onAbrir, onConcluir }: Props) {
  const vencida = t.status === "pendente" && !!t.vence_em && t.vence_em < hojeBRT();
  const atrasadaHoje =
    t.status === "pendente" && t.vence_em === hojeBRT() && !!t.hora_vencimento &&
    new Date(`${t.vence_em}T${t.hora_vencimento.slice(0, 5)}:00-03:00`).getTime() < Date.now();
  const atrasada = vencida || atrasadaHoje;
  const concluida = t.status === "concluida";
  const acao = tituloSemNome(t.titulo, t.lead?.nome);

  return (
    <div className={cn(
      "flex flex-wrap items-start gap-x-3 gap-y-2 rounded-xl border sm:flex-nowrap border-border border-l-4 bg-card px-3 py-2.5",
      atrasada ? "border-l-destructive" : "border-l-transparent",
      concluida && "opacity-70",
    )}>
      <div className={cn("w-[64px] shrink-0 pt-0.5 text-[13px] font-bold tabular-nums", atrasada ? "text-destructive" : "text-foreground")}>
        {quando(t)}
        {atrasadaHoje && <div className="text-[10px] font-semibold uppercase tracking-wide">atrasada</div>}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          {t.lead ? (
            <span className={cn("truncate text-[15px] font-bold text-foreground", concluida && "line-through")}>{t.lead.nome}</span>
          ) : (
            <span className={cn("inline-flex items-center gap-1 truncate text-[15px] font-bold text-foreground", concluida && "line-through")}>
              <StickyNote className="h-3.5 w-3.5 text-muted-foreground" /> {acao}
            </span>
          )}
          <EtapaChip ctx={ctx} />
        </div>
        <div className="mt-0.5 truncate text-[12px] text-muted-foreground">
          {t.lead ? <span className="font-medium text-foreground/80">{acao}</span> : "Anotação pessoal"}
          {t.lead?.empreendimento ? ` · ${t.lead.empreendimento}` : ""}
          {corretorNome ? ` · ${corretorNome}` : ""}
          <UltimaAcaoTexto ctx={ctx} />
        </div>
        {t.descricao && <div className="mt-0.5 line-clamp-1 text-[12px] text-muted-foreground/80">{t.descricao}</div>}
        {t.lead && <MiniHistorico ctx={ctx} />}
      </div>

      <div className="flex w-full shrink-0 items-center justify-end gap-1 border-t border-border/60 pt-2 sm:w-auto sm:gap-0.5 sm:border-0 sm:pt-0">
        {t.lead?.telefone && (
          <>
            <a href={waLink(t.lead.telefone) ?? undefined} target="_blank" rel="noreferrer" aria-label="WhatsApp" title="WhatsApp" className={iconBtn}>
              <MessageCircle className="h-4 w-4" />
            </a>
            <a href={telLink(t.lead.telefone) ?? undefined} aria-label="Ligar" title="Ligar" className={iconBtn}>
              <Phone className="h-4 w-4" />
            </a>
          </>
        )}
        {t.lead && (
          <button type="button" onClick={() => onAbrir(t.lead!.id)} aria-label="Abrir lead" title="Abrir lead" className={iconBtn}>
            <ExternalLink className="h-4 w-4" />
          </button>
        )}
        {!somenteLeitura && !concluida && (
          <button type="button" onClick={() => onConcluir(t)} className="ml-1 inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-[13px] sm:px-2.5 sm:py-1.5 sm:text-[12px] font-semibold text-primary-foreground hover:bg-primary/90">
            <Check className="h-3.5 w-3.5" /> Concluir
          </button>
        )}
      </div>
    </div>
  );
}
