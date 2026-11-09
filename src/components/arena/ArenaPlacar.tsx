/** Placar do dia da Arena: ligações, aproveitados, visitas, metas mínimas e comemoração ao cruzar marcos. */
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Phone, Handshake, Home, PhoneCall } from "lucide-react";
import { toast } from "sonner";
import { useCorretorDailyStats } from "@/hooks/useCorretorDailyStats";
import { ARENA_MINIMO, fraseIncentivo, marcosCruzados, pct, progressoDia, type PlacarDia } from "@/lib/arenaLigacoes";
import { playSoundFanfare, getCelebrationEnabled } from "@/lib/celebrations";

function Meta({ icon: Icon, label, valor, meta }: { icon: typeof Phone; label: string; valor: number; meta: number }) {
  const ok = valor >= meta;
  return (
    <div className="arena-vidro rounded-xl p-3">
      <div className="flex items-center justify-between text-xs opacity-80">
        <span className="flex items-center gap-1.5"><Icon className="h-3.5 w-3.5" />{label}</span>
        <span>{ok ? "✅" : `mín. ${meta}`}</span>
      </div>
      <motion.div key={valor} initial={{ scale: 1.25 }} animate={{ scale: 1 }} className="mt-1 text-3xl font-black tabular-nums leading-none">
        {valor}
      </motion.div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-primary-foreground/15">
        <motion.div className="arena-barra h-full rounded-full" initial={false} animate={{ width: `${pct(valor, meta)}%` }} />
      </div>
    </div>
  );
}

export default function ArenaPlacar() {
  const { stats } = useCorretorDailyStats();
  const atual: PlacarDia = { ligacoes: stats.ligacoes, aproveitados: stats.aproveitados, visitas: stats.visitas_marcadas };
  const anterior = useRef<PlacarDia | null>(null);
  const [festa, setFesta] = useState(0);
  const { geral, completo } = progressoDia(atual);

  useEffect(() => {
    if (anterior.current) {
      const marcos = marcosCruzados(anterior.current, atual);
      if (marcos.length) {
        marcos.forEach((m) => toast.success(m));
        setFesta((f) => f + 1);
        if (getCelebrationEnabled()) playSoundFanfare();
      }
    }
    anterior.current = atual;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atual.ligacoes, atual.aproveitados, atual.visitas]);

  return (
    <div className="relative">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest opacity-70">Seu placar de hoje</p>
          <p className="text-sm opacity-90">{fraseIncentivo(atual.ligacoes)}</p>
        </div>
        <div className="flex items-center gap-2 text-sm font-bold">
          <PhoneCall className="h-4 w-4" /> {completo ? "Mínimo do dia completo! 🎉" : `${geral}% do mínimo`}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Meta icon={Phone} label="Ligações" valor={atual.ligacoes} meta={ARENA_MINIMO.ligacoes} />
        <Meta icon={Handshake} label="Aproveitados" valor={atual.aproveitados} meta={ARENA_MINIMO.aproveitados} />
        <Meta icon={Home} label="Visitas" valor={atual.visitas} meta={ARENA_MINIMO.visitas} />
      </div>
      <AnimatePresence>
        {festa > 0 && (
          <motion.div key={festa} className="pointer-events-none absolute inset-0 overflow-hidden" initial={{ opacity: 1 }} animate={{ opacity: 0 }} transition={{ delay: 2.4, duration: 0.4 }}>
            {Array.from({ length: 24 }).map((_, i) => (
              <span key={i} className="natal-confete" style={{ left: `${(i * 41) % 100}%`, animationDelay: `${(i % 6) * 0.12}s` }} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
