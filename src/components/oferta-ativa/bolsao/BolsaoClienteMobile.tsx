import { useEffect, useRef } from "react";
import { ChevronLeft, Phone, MessageCircle, CheckCircle2, PhoneMissed, XCircle, Loader2 } from "lucide-react";
import { formatBRT } from "@/lib/brtTime";

interface Props {
  porta: "estagnados" | "descartados";
  lead: { nome: string; telefone: string | null; empreendimento: string; origem: string | null; entrou_em: string };
  restantes: number;
  busy: boolean;
  onAproveitar: () => void;
  onNaoAtendeu: () => void;
  onSemInteresse: () => void;
  onSair: () => void;
}

function iniciais(nome: string) {
  const p = nome.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase() || "?";
}

export default function BolsaoClienteMobile({ porta, lead, restantes, busy, onAproveitar, onNaoAtendeu, onSemInteresse, onSair }: Props) {
  const topo = useRef<HTMLDivElement>(null);
  useEffect(() => { topo.current?.scrollIntoView({ block: "start" }); }, [lead.nome]);
  const fone = (lead.telefone ?? "").replace(/\D/g, "");
  const redondo = "flex h-[62px] w-[62px] items-center justify-center rounded-full active:scale-95";
  return (
    <div ref={topo} className="scroll-mt-16 pb-[200px]">
      <div className="flex items-center justify-between gap-2 py-1">
        <button type="button" onClick={onSair} disabled={busy} className="flex h-11 items-center text-[15px] font-semibold text-primary">
          <ChevronLeft className="h-5 w-5" />Sair
        </button>
        <span className="truncate rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
          {porta === "estagnados" ? "Estagnados" : "Descartados"} · {lead.empreendimento}
        </span>
        <span className="shrink-0 text-[13px] text-muted-foreground">{restantes} na fila</span>
      </div>

      <div className="mx-auto mt-5 flex h-[84px] w-[84px] items-center justify-center rounded-full bg-primary/15 text-[32px] font-extrabold text-primary">
        {iniciais(lead.nome)}
      </div>
      <h2 className="mt-3 text-center text-[26px] font-extrabold leading-tight text-foreground">{lead.nome}</h2>
      <p className="mt-1 text-center text-base text-muted-foreground">{lead.telefone ?? "Sem telefone"}</p>
      <div className="mt-3 flex flex-wrap justify-center gap-1.5">
        <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">{lead.empreendimento}</span>
        <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">entrou em {formatBRT(lead.entrou_em, "dd/MM/yyyy")}</span>
        {lead.origem && <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">{lead.origem}</span>}
      </div>

      <div className="mt-6 flex justify-center gap-8">
        <a href={fone ? `tel:+${fone}` : undefined} aria-disabled={!fone} className="text-center text-xs font-semibold text-foreground">
          <span className={`${redondo} bg-primary text-primary-foreground`}><Phone className="h-6 w-6" /></span>
          <span className="mt-1.5 block">Ligar</span>
        </a>
        <a href={fone ? `https://wa.me/${fone}` : undefined} target="_blank" rel="noreferrer" aria-disabled={!fone} className="text-center text-xs font-semibold text-foreground">
          <span className={`${redondo} bg-success text-primary-foreground`}><MessageCircle className="h-6 w-6" /></span>
          <span className="mt-1.5 block">WhatsApp</span>
        </a>
      </div>

      <p className="mx-1 mt-6 rounded-2xl bg-card p-3.5 text-sm leading-snug text-muted-foreground shadow-sm">
        {porta === "estagnados"
          ? "Cliente que não teve sequência. Se você aproveitar, ele é seu."
          : "Cliente descartado há algum tempo. Pode ter mudado de ideia: se aproveitar, ele é seu."}
      </p>

      <div className="fixed inset-x-0 z-30 rounded-t-[22px] border-t border-border/60 bg-card/95 px-4 pb-3 pt-3 shadow-lg backdrop-blur"
        style={{ bottom: "calc(56px + var(--sab))" }}>
        <button type="button" onClick={onAproveitar} disabled={busy}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-success text-[17px] font-extrabold text-primary-foreground active:scale-[0.98] disabled:opacity-60">
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />} Aproveitar
        </button>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button type="button" onClick={onNaoAtendeu} disabled={busy}
            className="flex h-12 items-center justify-center gap-1.5 rounded-2xl bg-muted text-[15px] font-bold text-foreground active:scale-[0.98] disabled:opacity-60">
            <PhoneMissed className="h-4 w-4" />Não atendeu
          </button>
          <button type="button" onClick={onSemInteresse} disabled={busy}
            className="flex h-12 items-center justify-center gap-1.5 rounded-2xl bg-muted text-[15px] font-bold text-destructive active:scale-[0.98] disabled:opacity-60">
            <XCircle className="h-4 w-4" />Sem interesse
          </button>
        </div>
      </div>
    </div>
  );
}
