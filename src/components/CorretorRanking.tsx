import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, ChevronDown, ChevronUp, MessageSquare, RotateCcw, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Lead } from "@/types/lead";

interface CorretorRankingProps {
  leads: Lead[];
}

interface CorretorStats {
  nome: string;
  totalLeads: number;
  mensagensGeradas: number;
  leadsRecuperados: number;
  muitoQuentes: number;
  quentes: number;
  score: number;
}

export default function CorretorRanking({ leads }: CorretorRankingProps) {
  const [expanded, setExpanded] = useState(false);

  const ranking = useMemo(() => {
    const map = new Map<string, CorretorStats>();
    leads.forEach((l) => {
      const nome = l.corretor || "Sem corretor";
      if (!map.has(nome)) {
        map.set(nome, { nome, totalLeads: 0, mensagensGeradas: 0, leadsRecuperados: 0, muitoQuentes: 0, quentes: 0, score: 0 });
      }
      const s = map.get(nome)!;
      s.totalLeads++;
      if (l.mensagemGerada) s.mensagensGeradas++;
      if (l.status === "reativado" || l.status === "respondido") s.leadsRecuperados++;
      if (l.prioridade === "muito_quente") s.muitoQuentes++;
      if (l.prioridade === "quente") s.quentes++;
    });

    // Calculate score
    map.forEach((s) => {
      s.score = (s.leadsRecuperados * 10) + (s.mensagensGeradas * 3) + (s.muitoQuentes * 5) + (s.quentes * 2);
    });

    return Array.from(map.values()).sort((a, b) => b.score - a.score);
  }, [leads]);

  const hasCorretores = ranking.some((r) => r.nome !== "Sem corretor");
  if (!hasCorretores || leads.length === 0) return null;

  const medals = ["🥇", "🥈", "🥉"];

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-warning/10">
            <Trophy className="h-4 w-4 text-warning" />
          </div>
          <div className="text-left">
            <h3 className="font-display font-semibold text-foreground text-sm">Ranking de Produtividade</h3>
            <p className="text-xs text-muted-foreground">{ranking.length} corretores • baseado em ações e recuperações</p>
          </div>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="px-4 pb-4 space-y-2">
              {ranking.map((r, i) => (
                <motion.div
                  key={r.nome}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${i === 0 ? "border-warning/30 bg-warning/5" : "border-border"}`}
                >
                  <span className="text-lg w-8 text-center shrink-0">{medals[i] || `${i + 1}º`}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">{r.nome}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-0.5">
                        <TrendingUp className="h-3 w-3" /> {r.totalLeads} leads
                      </span>
                      <span className="flex items-center gap-0.5">
                        <MessageSquare className="h-3 w-3" /> {r.mensagensGeradas} msgs
                      </span>
                      <span className="flex items-center gap-0.5">
                        <RotateCcw className="h-3 w-3" /> {r.leadsRecuperados} recuperados
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-lg font-display font-bold text-foreground">{r.score}</p>
                    <p className="text-[10px] text-muted-foreground">pontos</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
