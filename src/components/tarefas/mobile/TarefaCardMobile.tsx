import { useRef, useState } from "react";
import { MessageCircle, Clock, StickyNote } from "lucide-react";
import { cn } from "@/lib/utils";
import { waLink } from "@/lib/phone";
import { hojeBRT, type TarefaItem } from "@/hooks/useMinhasTarefas";

interface Props {
  t: TarefaItem;
  tom: "atrasada" | "hoje" | "normal";
  corretorNome?: string;
  somenteLeitura?: boolean;
  onAbrir: (leadId: string) => void;
  onConcluir: (t: TarefaItem) => void;
  onAdiar: (t: TarefaItem) => void;
}

const ACOES = 132;

function quando(t: TarefaItem): string {
  const hora = t.hora_vencimento ? t.hora_vencimento.slice(0, 5) : "";
  if (!t.vence_em) return hora || "—";
  const hoje = hojeBRT();
  if (t.vence_em === hoje) return hora || "Hoje";
  const dias = Math.round((new Date(`${hoje}T12:00:00`).getTime() - new Date(`${t.vence_em}T12:00:00`).getTime()) / 86400_000);
  if (dias === 1) return hora ? `ontem ${hora}` : "ontem";
  if (dias > 1) return `${dias} dias`;
  const [, m, d] = t.vence_em.split("-");
  return `${d}/${m}${hora ? ` ${hora}` : ""}`;
}

function acaoDe(t: TarefaItem): string {
  const base = (t.titulo || "Tarefa").split(" — ")[0];
  const nome = t.lead?.nome;
  if (!nome) return base;
  return base.replace(new RegExp(`\\s*[:\\-–]\\s*${nome.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "i"), "").trim() || base;
}

export default function TarefaCardMobile({ t, tom, corretorNome, somenteLeitura, onAbrir, onConcluir, onAdiar }: Props) {
  const [dx, setDx] = useState(0);
  const start = useRef<{ x: number; y: number; base: number; lock?: "h" | "v" } | null>(null);
  const arrastou = useRef(false);
  const concluida = t.status === "concluida";
  const podeDeslizar = !somenteLeitura && !concluida;
  const acao = acaoDe(t);
  const cor = tom === "atrasada" ? "text-destructive" : tom === "hoje" ? "text-primary" : "text-muted-foreground";

  const onDown = (e: React.PointerEvent) => { arrastou.current = false; if (podeDeslizar) start.current = { x: e.clientX, y: e.clientY, base: dx }; };
  const onMove = (e: React.PointerEvent) => {
    const s = start.current; if (!s) return;
    const mx = e.clientX - s.x, my = e.clientY - s.y;
    if (!s.lock) { if (Math.abs(mx) < 8 && Math.abs(my) < 8) return; s.lock = Math.abs(mx) > Math.abs(my) ? "h" : "v"; if (s.lock === "h") arrastou.current = true; }
    if (s.lock === "h") setDx(Math.max(-ACOES, Math.min(0, s.base + mx)));
  };
  const onUp = () => {
    const s = start.current; start.current = null;
    if (!s?.lock || s.lock === "v") return;
    setDx((v) => (v < -ACOES / 2 ? -ACOES : 0));
  };
  const abrir = () => {
    if (arrastou.current) { arrastou.current = false; return; }
    if (dx !== 0) { setDx(0); return; }
    if (t.lead) onAbrir(t.lead.id);
  };

  return (
    <div className="relative overflow-hidden rounded-2xl">
      {podeDeslizar && dx !== 0 && (
        <div className="absolute inset-y-0 right-0 flex" style={{ width: ACOES }}>
          {t.lead?.telefone ? (
            <a href={waLink(t.lead.telefone) ?? undefined} target="_blank" rel="noreferrer" onClick={() => setDx(0)}
              className="flex flex-1 flex-col items-center justify-center gap-1 bg-success text-[12px] font-semibold text-primary-foreground">
              <MessageCircle className="h-5 w-5" />Whats
            </a>
          ) : <div className="flex-1 bg-muted" />}
          <button type="button" onClick={() => { setDx(0); onAdiar(t); }}
            className="flex flex-1 flex-col items-center justify-center gap-1 bg-warning text-[12px] font-semibold text-primary-foreground">
            <Clock className="h-5 w-5" />Adiar
          </button>
        </div>
      )}
      <div
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
        style={{ transform: `translateX(${dx}px)`, transition: start.current ? "none" : "transform 200ms ease", touchAction: "pan-y" }}
        className={cn("relative flex items-center gap-3 bg-card px-3.5 py-3 shadow-sm", concluida && "opacity-70")}
      >
        {!somenteLeitura && !concluida ? (
          <button type="button" aria-label="Concluir tarefa" onClick={() => onConcluir(t)}
            className="-m-2 flex h-11 w-11 shrink-0 items-center justify-center">
            <span className={cn("h-[26px] w-[26px] rounded-full border-2", tom === "atrasada" ? "border-destructive" : "border-muted-foreground/40")} />
          </button>
        ) : <span className="w-1" />}
        <button type="button" onClick={abrir} className="flex min-w-0 flex-1 items-center gap-2 text-left">
          <div className="min-w-0 flex-1">
            <div className={cn("flex items-center gap-1 truncate text-base font-semibold text-foreground", concluida && "line-through")}>
              {!t.lead && <StickyNote className="h-4 w-4 shrink-0 text-muted-foreground" />}
              <span className="truncate">{t.lead?.nome ?? acao}</span>
            </div>
            <div className="truncate text-[13px] text-muted-foreground">
              {t.lead ? acao : "Anotação pessoal"}{corretorNome ? ` · ${corretorNome}` : ""}
            </div>
            {t.lead?.empreendimento && (
              <span className="mt-1 inline-block max-w-full truncate rounded-md bg-primary/10 px-1.5 py-0.5 text-[11px] font-semibold text-primary">
                {t.lead.empreendimento}
              </span>
            )}
          </div>
          <span className={cn("shrink-0 text-right text-[12px] font-semibold tabular-nums", cor)}>{quando(t)}</span>
        </button>
      </div>
    </div>
  );
}
