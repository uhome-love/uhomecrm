import { useEffect, useRef, useState } from "react";
import { Phone, MessageCircle, FileText, Square, CheckCircle2, PhoneMissed, XCircle, Home, Ban } from "lucide-react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";

interface Props {
  lead: { nome: string; telefone: string | null; empreendimento: string | null; tentativas_count: number };
  callActive: boolean;
  callTimerLabel: string;
  disabled: boolean;
  roteiro: React.ReactNode;
  onLigar: () => void;
  onWhatsApp: () => void;
  onEncerrar: () => void;
  onResultado: (key: "agendar" | "com_interesse" | "nao_atendeu" | "sem_interesse" | "descarte_definitivo") => void;
}

function iniciais(nome: string) {
  const p = nome.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase() || "?";
}
function fmtFone(t: string | null) {
  const d = (t ?? "").replace(/\D/g, "").replace(/^55/, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return t ?? "Sem telefone";
}

const redondo = "flex h-[62px] w-[62px] items-center justify-center rounded-full active:scale-95 disabled:opacity-50";
const sec = "flex h-12 items-center justify-center gap-1.5 rounded-2xl bg-muted text-[15px] font-bold active:scale-[0.98] disabled:opacity-60";

export default function DialingMobileView(p: Props) {
  const [roteiroAberto, setRoteiroAberto] = useState(false);
  const topo = useRef<HTMLDivElement>(null);
  useEffect(() => { topo.current?.scrollIntoView({ block: "start" }); }, [p.lead.nome]);
  return (
    <div ref={topo} className="scroll-mt-24 pb-[250px]">
      <div className="mx-auto mt-2 flex h-[76px] w-[76px] items-center justify-center rounded-full bg-primary/15 text-[32px] font-extrabold text-primary">
        {iniciais(p.lead.nome)}
      </div>
      <h2 className="mt-3 text-center text-[26px] font-extrabold leading-tight text-foreground">{p.lead.nome}</h2>
      <p className="mt-1 text-center text-base text-muted-foreground">{fmtFone(p.lead.telefone)}</p>
      <div className="mt-2 flex flex-wrap justify-center gap-1.5">
        {p.lead.empreendimento && <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">{p.lead.empreendimento}</span>}
        <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">Tentativa {p.lead.tentativas_count + 1}</span>
      </div>
      {p.callActive && <p className="mt-2 text-center text-[13px] font-bold text-success">● em ligação {p.callTimerLabel}</p>}

      <div className="mt-5 flex justify-center gap-7">
        {p.callActive ? (
          <button type="button" onClick={p.onEncerrar} className="text-center text-xs font-semibold text-foreground">
            <span className={`${redondo} bg-destructive text-destructive-foreground`}><Square className="h-6 w-6" /></span>
            <span className="mt-1.5 block">Encerrar</span>
          </button>
        ) : (
          <button type="button" onClick={p.onLigar} disabled={p.disabled || !p.lead.telefone} className="text-center text-xs font-semibold text-foreground">
            <span className={`${redondo} bg-primary text-primary-foreground`}><Phone className="h-6 w-6" /></span>
            <span className="mt-1.5 block">Ligar</span>
          </button>
        )}
        <button type="button" onClick={p.onWhatsApp} disabled={!p.lead.telefone} className="text-center text-xs font-semibold text-foreground">
          <span className={`${redondo} bg-success text-primary-foreground`}><MessageCircle className="h-6 w-6" /></span>
          <span className="mt-1.5 block">WhatsApp</span>
        </button>
        <button type="button" onClick={() => setRoteiroAberto(true)} className="text-center text-xs font-semibold text-foreground">
          <span className={`${redondo} bg-primary/10 text-primary`}><FileText className="h-6 w-6" /></span>
          <span className="mt-1.5 block">Roteiro</span>
        </button>
      </div>

      <Drawer open={roteiroAberto} onOpenChange={setRoteiroAberto}>
        <DrawerContent className="max-h-[85dvh]">
          <DrawerHeader><DrawerTitle>Roteiro</DrawerTitle></DrawerHeader>
          <div className="overflow-y-auto px-4 pb-[calc(1rem+var(--sab))]">{p.roteiro}</div>
        </DrawerContent>
      </Drawer>

      <div className="fixed inset-x-0 z-30 rounded-t-[22px] border-t border-border/60 bg-card/95 px-4 pb-3 pt-3 shadow-lg backdrop-blur"
        style={{ bottom: "calc(56px + var(--sab))" }}>
        <button type="button" onClick={() => p.onResultado("agendar")} disabled={p.disabled}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-[17px] font-extrabold text-primary-foreground active:scale-[0.98] disabled:opacity-60">
          <Home className="h-5 w-5" /> Marcou visita
        </button>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button type="button" onClick={() => p.onResultado("com_interesse")} disabled={p.disabled} className={`${sec} text-foreground`}><CheckCircle2 className="h-4 w-4 text-success" />Aproveitado</button>
          <button type="button" onClick={() => p.onResultado("nao_atendeu")} disabled={p.disabled} className={`${sec} text-foreground`}><PhoneMissed className="h-4 w-4" />Não atendeu</button>
          <button type="button" onClick={() => p.onResultado("sem_interesse")} disabled={p.disabled} className={`${sec} text-foreground`}><XCircle className="h-4 w-4" />Sem interesse</button>
          <button type="button" onClick={() => p.onResultado("descarte_definitivo")} disabled={p.disabled} className={`${sec} text-destructive`}><Ban className="h-4 w-4" />Descartar</button>
        </div>
      </div>
    </div>
  );
}
