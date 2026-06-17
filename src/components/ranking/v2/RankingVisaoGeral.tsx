import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Users, Eye, Briefcase, TrendingUp, Loader2, Trophy, Medal, Award } from "lucide-react";
import { fmtMoney } from "@/lib/fmtMoney";
import { fetchAllRankings, type RankingFilters } from "@/hooks/useRankingsData";

/** Animated count-up number */
function CountUp({ value, format }: { value: number; format?: (n: number) => string }) {
  const [display, setDisplay] = useState(0);
  const raf = useRef<number>();
  useEffect(() => {
    const start = performance.now();
    const from = 0;
    const dur = 700;
    const tick = (t: number) => {
      const p = Math.min((t - start) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(from + (value - from) * eased);
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [value]);
  return <>{format ? format(display) : Math.round(display).toLocaleString("pt-BR")}</>;
}

const MEDAL = [
  { icon: Trophy, color: "text-amber-500", bg: "bg-amber-500/10 border-amber-500/30" },
  { icon: Medal, color: "text-slate-400", bg: "bg-slate-400/10 border-slate-400/30" },
  { icon: Award, color: "text-orange-600", bg: "bg-orange-600/10 border-orange-600/30" },
];

export default function RankingVisaoGeral({
  filters,
  currentUserId,
}: {
  filters: RankingFilters;
  currentUserId?: string;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["ranking-visao-geral", filters],
    queryFn: () => fetchAllRankings(filters),
    staleTime: 60_000,
    refetchInterval: 60_000, // atualização sutil ao vivo
  });

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const totalLeads = data.presencas.reduce((s, r) => s + (r.leads_recebidos || 0), 0);
  const totalVisitas = data.visitas.reduce((s, r) => s + (r.realizadas || 0), 0);
  const totalAssinados = data.negocios.reduce((s, r) => s + (r.assinados || 0), 0);
  const totalVgv = data.negocios.reduce((s, r) => s + (r.vgv_assinado || 0), 0);

  const cards = [
    { label: "Leads recebidos", value: totalLeads, icon: Users, color: "text-blue-600", bg: "from-blue-500/10" },
    { label: "Visitas realizadas", value: totalVisitas, icon: Eye, color: "text-amber-600", bg: "from-amber-500/10" },
    { label: "Negócios assinados", value: totalAssinados, icon: Briefcase, color: "text-emerald-600", bg: "from-emerald-500/10" },
    { label: "VGV assinado", value: totalVgv, icon: TrendingUp, color: "text-primary", bg: "from-primary/10", money: true },
  ];

  const podium = [...data.negocios]
    .filter((r) => r.vgv_assinado > 0)
    .sort((a, b) => b.vgv_assinado - a.vgv_assinado)
    .slice(0, 5);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map((c, i) => (
          <motion.div
            key={c.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: i * 0.05 }}
            className={`relative overflow-hidden rounded-xl border border-border bg-gradient-to-br ${c.bg} to-transparent p-4`}
          >
            <c.icon className={`h-5 w-5 ${c.color} mb-2`} strokeWidth={1.75} />
            <div className="text-2xl font-bold text-foreground tabular-nums">
              <CountUp value={c.value} format={c.money ? (n) => fmtMoney(n, "short") : undefined} />
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">{c.label}</div>
          </motion.div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <Trophy className="h-4 w-4 text-amber-500" /> Top performers · VGV assinado
        </h3>
        {podium.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Nenhum negócio assinado no período.</p>
        ) : (
          <ul className="space-y-2">
            {podium.map((r, i) => {
              const m = MEDAL[i];
              const isMe = currentUserId && r.user_id === currentUserId;
              return (
                <motion.li
                  key={r.user_id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2, delay: i * 0.06 }}
                  className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${
                    m ? m.bg : "border-border bg-muted/30"
                  } ${isMe ? "ring-2 ring-primary/40" : ""}`}
                >
                  <span className={`flex h-7 w-7 items-center justify-center rounded-full font-bold text-xs ${m ? m.color : "text-muted-foreground"}`}>
                    {m ? <m.icon className="h-4 w-4" /> : i + 1}
                  </span>
                  <span className="flex-1 truncate text-sm font-medium text-foreground">
                    {r.nome}{isMe && <span className="text-primary text-xs ml-1">(você)</span>}
                  </span>
                  <span className="text-sm font-semibold text-foreground tabular-nums">{fmtMoney(r.vgv_assinado, "short")}</span>
                </motion.li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
