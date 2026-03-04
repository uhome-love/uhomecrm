import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Building2, ChevronDown, ChevronUp, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import PriorityBadge from "@/components/PriorityBadge";
import type { Lead } from "@/types/lead";

interface EmpreendimentoGroupProps {
  leads: Lead[];
  onFilterByInteresse: (interesse: string | null) => void;
  activeInteresse: string | null;
}

export default function EmpreendimentoGroup({ leads, onFilterByInteresse, activeInteresse }: EmpreendimentoGroupProps) {
  const [expanded, setExpanded] = useState(false);

  const groups = useMemo(() => {
    const map = new Map<string, Lead[]>();
    leads.forEach((l) => {
      const key = l.imovel?.codigo
        ? `${l.imovel.tipo} ${l.imovel.codigo} — ${l.imovel.endereco_bairro}`
        : l.interesse || "Sem interesse definido";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(l);
    });
    return Array.from(map.entries())
      .map(([name, leads]) => ({ name, leads, count: leads.length }))
      .sort((a, b) => b.count - a.count);
  }, [leads]);

  if (leads.length === 0 || groups.length === 0) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-info/10">
            <Building2 className="h-4 w-4 text-info" />
          </div>
          <div className="text-left">
            <h3 className="font-display font-semibold text-foreground text-sm">Por Empreendimento</h3>
            <p className="text-xs text-muted-foreground">{groups.length} empreendimentos/interesses identificados</p>
          </div>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="px-4 pb-4 space-y-2 max-h-80 overflow-y-auto">
              {activeInteresse && (
                <button onClick={() => onFilterByInteresse(null)} className="text-xs text-primary hover:underline mb-1">
                  ← Limpar filtro de empreendimento
                </button>
              )}
              {groups.map((g) => {
                const isActive = activeInteresse === g.name;
                const priorities = g.leads.reduce((acc, l) => {
                  if (l.prioridade) acc[l.prioridade] = (acc[l.prioridade] || 0) + 1;
                  return acc;
                }, {} as Record<string, number>);

                return (
                  <button
                    key={g.name}
                    onClick={() => onFilterByInteresse(isActive ? null : g.name)}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${isActive ? "ring-2 ring-primary border-primary bg-primary/5" : "border-border hover:bg-muted/20"}`}
                  >
                    <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{g.name}</p>
                      <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                        {Object.entries(priorities).map(([p, count]) => (
                          <Badge key={p} variant="outline" className="text-[9px] px-1 py-0">
                            {count}× {p === "muito_quente" ? "🔥" : p === "quente" ? "🟠" : p === "morno" ? "🟡" : p === "frio" ? "🔵" : "⚫"}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Users className="h-3 w-3 text-muted-foreground" />
                      <span className="text-sm font-display font-bold text-foreground">{g.count}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
