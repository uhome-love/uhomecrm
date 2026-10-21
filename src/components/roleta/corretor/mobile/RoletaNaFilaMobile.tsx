import { useState, type ReactNode } from "react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export interface MinhaPosicao {
  id: string;
  nome: string;
  posicao: number;
  leads: number;
}

interface Props {
  subtitulo: string;
  posicoes: MinhaPosicao[];
  leadsHoje: number;
  naFila: number;
  onSair: () => void;
  saindo: boolean;
}

export function RoletaNaFilaMobile({ subtitulo, posicoes, leadsHoje, naFila, onSair, saindo }: Props) {
  const [confirmar, setConfirmar] = useState(false);
  const melhor = posicoes.length ? Math.min(...posicoes.map((p) => p.posicao)) : null;

  return (
    <div className="pb-24">
      <h1 className="text-[30px] font-bold tracking-tight">Roleta</h1>
      <p className="text-sm text-muted-foreground">{subtitulo}</p>

      <div className="mt-6 flex flex-col items-center">
        <div className="flex h-40 w-40 flex-col items-center justify-center rounded-full border-[10px] border-emerald-500">
          <span className="text-5xl font-extrabold tabular-nums">{melhor ?? "—"}</span>
          <span className="text-xs text-muted-foreground">sua posição</span>
        </div>
        <span className="mt-3 rounded-full bg-emerald-500/10 px-3 py-1 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
          ● Você está na Roleta
        </span>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2">
        <Num v={leadsHoje} l="leads hoje" />
        <Num v={posicoes.length} l={posicoes.length === 1 ? "fila sua" : "filas suas"} />
        <Num v={naFila} l="na fila agora" />
      </div>

      {posicoes.length > 0 && (
        <>
          <p className="mt-5 mb-1.5 px-1 text-xs uppercase tracking-wide text-muted-foreground">Por segmento</p>
          <div className="rounded-2xl bg-card px-4 shadow-sm">
            {posicoes.map((p) => (
              <div key={p.id} className="flex items-center justify-between py-3 border-b border-border/60 last:border-0 text-[15px]">
                <span className="truncate">{p.nome}</span>
                <span className="ml-2 shrink-0 text-xs text-muted-foreground">posição {p.posicao} · {p.leads} {p.leads === 1 ? "lead" : "leads"}</span>
              </div>
            ))}
          </div>
        </>
      )}

      <button type="button" disabled={saindo} onClick={() => setConfirmar(true)} className="mt-6 w-full py-3 text-center font-semibold text-destructive disabled:opacity-50">
        Sair da Roleta
      </button>

      <AlertDialog open={confirmar} onOpenChange={setConfirmar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sair da Roleta?</AlertDialogTitle>
            <AlertDialogDescription>Você para de receber leads neste turno.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={onSair} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Sair</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Num({ v, l }: { v: number; l: string }) {
  return (
    <div className="rounded-2xl bg-card px-3 py-2.5 shadow-sm">
      <b className="block text-2xl tabular-nums">{v}</b>
      <span className="text-[11px] text-muted-foreground">{l}</span>
    </div>
  );
}

/** Tela simples (aguardando aprovação / entrada fechada) no mesmo visual. */
export function RoletaAvisoMobile({ subtitulo, icone, titulo, children }: { subtitulo: string; icone: string; titulo: string; children?: ReactNode }) {
  return (
    <div className="pb-24">
      <h1 className="text-[30px] font-bold tracking-tight">Roleta</h1>
      <p className="text-sm text-muted-foreground">{subtitulo}</p>
      <div className="mt-6 rounded-2xl bg-card p-6 text-center shadow-sm">
        <div className="text-5xl">{icone}</div>
        <h2 className="mt-3 text-lg font-bold">{titulo}</h2>
        <div className="mt-2 space-y-2 text-sm text-muted-foreground">{children}</div>
      </div>
    </div>
  );
}
