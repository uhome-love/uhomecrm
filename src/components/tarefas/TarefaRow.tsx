import { MessageCircle, Phone, Check, ExternalLink, StickyNote } from "lucide-react";
import { cn } from "@/lib/utils";
import { waLink, telLink } from "@/lib/phone";
import type { TarefaItem } from "@/hooks/useMinhasTarefas";
import { hojeBRT } from "@/hooks/useMinhasTarefas";

interface Props {
  t: TarefaItem;
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

export default function TarefaRow({ t, corretorNome, somenteLeitura, onAbrir, onConcluir }: Props) {
  const vencida = t.status === "pendente" && !!t.vence_em && t.vence_em < hojeBRT();
  const concluida = t.status === "concluida";
  const titulo = (t.titulo || "Tarefa").split(" — ")[0];
  return (
    <div className={cn("flex items-center gap-3 rounded-xl border border-border bg-card p-3", concluida && "opacity-70")}>
      <div className={cn("w-[68px] shrink-0 text-[13px] font-bold tabular-nums", vencida ? "text-destructive" : "text-foreground")}>
        {quando(t)}
      </div>
      <div className="min-w-0 flex-1">
        <div className={cn("truncate text-[14px] font-semibold text-foreground", concluida && "line-through")}>{titulo}</div>
        <div className="truncate text-[12px] text-muted-foreground">
          {t.lead ? t.lead.nome : <span className="inline-flex items-center gap-1"><StickyNote className="h-3 w-3" /> Anotação pessoal</span>}
          {t.lead?.empreendimento ? ` · ${t.lead.empreendimento}` : ""}
          {corretorNome ? ` · ${corretorNome}` : ""}
        </div>
        {t.descricao && <div className="mt-0.5 line-clamp-1 text-[12px] text-muted-foreground/80">{t.descricao}</div>}
      </div>
      {t.lead?.telefone && (
        <>
          <a href={waLink(t.lead.telefone) ?? undefined} target="_blank" rel="noreferrer" aria-label="WhatsApp" className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
            <MessageCircle className="h-4 w-4" />
          </a>
          <a href={telLink(t.lead.telefone) ?? undefined} aria-label="Ligar" className="hidden rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground sm:block">
            <Phone className="h-4 w-4" />
          </a>
        </>
      )}
      {t.lead && (
        <button type="button" onClick={() => onAbrir(t.lead!.id)} className="hidden items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-[12px] font-medium hover:bg-muted sm:inline-flex">
          <ExternalLink className="h-3.5 w-3.5" /> Abrir lead
        </button>
      )}
      {!somenteLeitura && !concluida && (
        <button type="button" onClick={() => onConcluir(t)} className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-[12px] font-semibold text-primary-foreground hover:bg-primary/90">
          <Check className="h-3.5 w-3.5" /> Concluir
        </button>
      )}
    </div>
  );
}
