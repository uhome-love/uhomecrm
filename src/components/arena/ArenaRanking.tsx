/** Ranking de ligações (dia/semana) — pódio + lista, destaca o próprio corretor. Sem prêmio: só visibilidade. */
import { useState } from "react";
import { motion } from "framer-motion";
import { Trophy, Phone } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useRankingLigacoes, type LinhaRanking } from "@/hooks/useArenaLigacoes";
import { cn } from "@/lib/utils";

const MEDALHA = ["🥇", "🥈", "🥉"];

function Avatar({ l, size = "h-9 w-9" }: { l: LinhaRanking; size?: string }) {
  return l.avatar_url ? (
    <img src={l.avatar_url} alt={l.nome} className={cn(size, "shrink-0 rounded-full object-cover")} />
  ) : (
    <div className={cn(size, "flex shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary")}>
      {l.nome.slice(0, 2).toUpperCase()}
    </div>
  );
}

export default function ArenaRanking({ compacto = false }: { compacto?: boolean }) {
  const { user } = useAuth();
  const [periodo, setPeriodo] = useState<"dia" | "semana">("semana");
  const { data = [], isLoading } = useRankingLigacoes(periodo);
  const eu = data.find((l) => l.user_id === user?.id);
  const top = data.slice(0, 3);
  const resto = data.slice(3, compacto ? 5 : 10);
  const euForaDaLista = eu && eu.posicao > (compacto ? 5 : 10);

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <header className="mb-3 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-bold"><Trophy className="h-4 w-4 text-warning-500" /> Ranking de ligações</h3>
        <div className="flex rounded-full bg-muted p-0.5 text-xs font-semibold">
          {(["dia", "semana"] as const).map((p) => (
            <button key={p} type="button" onClick={() => setPeriodo(p)}
              className={cn("rounded-full px-3 py-1 transition-colors duration-fast", periodo === p ? "bg-card text-foreground shadow-sm" : "text-muted-foreground")}>
              {p === "dia" ? "Hoje" : "Semana"}
            </button>
          ))}
        </div>
      </header>

      {isLoading ? (
        <div className="h-40 animate-pulse rounded-xl bg-muted" />
      ) : data.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Ninguém ligou ainda {periodo === "dia" ? "hoje" : "nesta semana"}. Seja o primeiro do pódio! 📞</p>
      ) : (
        <>
          <div className="mb-3 grid grid-cols-3 items-end gap-2">
            {[1, 0, 2].map((i) => top[i] && (
              <motion.div key={top[i].user_id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * i }}
                className={cn("flex flex-col items-center rounded-xl px-1 pb-2 pt-3 text-center", `arena-podio-${i + 1}`, i === 0 ? "min-h-[132px]" : "min-h-[112px]",
                  top[i].user_id === user?.id && "ring-2 ring-primary")}>
                <span className="text-xl leading-none">{MEDALHA[i]}</span>
                <Avatar l={top[i]} size={i === 0 ? "h-11 w-11 mt-1" : "h-9 w-9 mt-1"} />
                <span className="mt-1 w-full truncate text-xs font-semibold">{top[i].nome}</span>
                <span className="text-lg font-black leading-tight">{top[i].ligacoes}</span>
                <span className="text-[10px] text-muted-foreground">ligações</span>
              </motion.div>
            ))}
          </div>
          <ol className="space-y-1">
            {resto.map((l) => <Linha key={l.user_id} l={l} eu={l.user_id === user?.id} />)}
            {euForaDaLista && eu && <><li className="text-center text-xs text-muted-foreground">⋯</li><Linha l={eu} eu /></>}
          </ol>
          {!eu && <p className="mt-2 text-center text-xs text-muted-foreground">Você ainda não aparece aqui. Uma ligação já te coloca no ranking!</p>}
        </>
      )}
    </section>
  );
}

function Linha({ l, eu }: { l: LinhaRanking; eu: boolean }) {
  return (
    <li className={cn("flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm", eu ? "bg-primary/10 font-semibold" : "hover:bg-muted")}>
      <span className="w-6 text-center text-xs font-bold text-muted-foreground">{l.posicao}</span>
      <Avatar l={l} size="h-7 w-7" />
      <span className="min-w-0 flex-1 truncate">{eu ? `${l.nome} (você)` : l.nome}</span>
      <span className="hidden text-[11px] text-muted-foreground sm:inline">{l.aproveitados} aprov · {l.visitas} vis</span>
      <span className="flex items-center gap-1 font-bold"><Phone className="h-3 w-3 text-primary" />{l.ligacoes}</span>
    </li>
  );
}
