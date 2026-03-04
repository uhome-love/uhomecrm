import { useMemo } from "react";
import { motion } from "framer-motion";
import { Users, CheckCircle, MessageSquare, PhoneOff, RotateCcw, Send, TrendingUp, AlertTriangle } from "lucide-react";
import type { Lead, StatusRecuperacao } from "@/types/lead";

interface RecoveryDashboardProps {
  leads: Lead[];
}

const STATUS_LABELS: Record<StatusRecuperacao, string> = {
  pendente: "Pendente",
  contato_realizado: "Contato Realizado",
  respondeu: "Respondeu",
  reativado: "Reativado",
  sem_interesse: "Sem Interesse",
  numero_invalido: "Número Inválido",
  recuperado: "Recuperado",
};

export default function RecoveryDashboard({ leads }: RecoveryDashboardProps) {
  const metrics = useMemo(() => {
    const total = leads.length;
    const contatados = leads.filter((l) => l.statusRecuperacao && l.statusRecuperacao !== "pendente").length;
    const responderam = leads.filter((l) => l.statusRecuperacao === "respondeu" || l.statusRecuperacao === "reativado" || l.statusRecuperacao === "recuperado").length;
    const recuperados = leads.filter((l) => l.statusRecuperacao === "recuperado").length;
    const invalidos = leads.filter((l) => l.statusRecuperacao === "numero_invalido").length;
    const semInteresse = leads.filter((l) => l.statusRecuperacao === "sem_interesse").length;
    const taxaRecuperacao = total > 0 ? ((recuperados / total) * 100).toFixed(1) : "0";
    const mensagensGeradas = leads.filter((l) => l.mensagemGerada).length;

    return [
      { label: "Total Importados", value: total, icon: Users, color: "bg-primary/10 text-primary border-primary/20" },
      { label: "Contatados", value: contatados, icon: Send, color: "bg-accent/10 text-accent border-accent/20" },
      { label: "Responderam", value: responderam, icon: MessageSquare, color: "bg-info/10 text-info border-info/20" },
      { label: "Recuperados", value: recuperados, icon: CheckCircle, color: "bg-success/10 text-success border-success/20" },
      { label: "Sem Interesse", value: semInteresse, icon: AlertTriangle, color: "bg-warning/10 text-warning border-warning/20" },
      { label: "Nº Inválido", value: invalidos, icon: PhoneOff, color: "bg-destructive/10 text-destructive border-destructive/20" },
      { label: "Msgs Geradas", value: mensagensGeradas, icon: TrendingUp, color: "bg-accent/10 text-accent border-accent/20" },
      { label: "Taxa Recuperação", value: `${taxaRecuperacao}%`, icon: RotateCcw, color: "bg-success/10 text-success border-success/20" },
    ];
  }, [leads]);

  // By empreendimento
  const byEmpreendimento = useMemo(() => {
    const map = new Map<string, { total: number; recuperados: number }>();
    leads.forEach((l) => {
      const key = l.interesse?.trim() || "Sem interesse";
      if (!map.has(key)) map.set(key, { total: 0, recuperados: 0 });
      const entry = map.get(key)!;
      entry.total++;
      if (l.statusRecuperacao === "recuperado") entry.recuperados++;
    });
    return Array.from(map.entries())
      .map(([name, data]) => ({ name, ...data, taxa: data.total > 0 ? ((data.recuperados / data.total) * 100).toFixed(0) : "0" }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }, [leads]);

  return (
    <div className="space-y-4">
      {/* Main metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
        {metrics.map((m, i) => (
          <motion.div
            key={m.label}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.03 }}
            className={`rounded-xl border p-3 ${m.color}`}
          >
            <m.icon className="h-4 w-4 mb-1" />
            <p className="text-xl font-display font-bold">{m.value}</p>
            <p className="text-[10px] opacity-80 leading-tight">{m.label}</p>
          </motion.div>
        ))}
      </div>

      {/* By empreendimento */}
      {byEmpreendimento.length > 1 && (
        <div className="rounded-xl border border-border bg-card p-4 shadow-card">
          <h4 className="font-display font-semibold text-foreground text-sm mb-3">Recuperação por Empreendimento</h4>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            {byEmpreendimento.map((e) => (
              <div key={e.name} className="rounded-lg border border-border p-3">
                <p className="text-xs font-medium text-foreground truncate">{e.name}</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-lg font-display font-bold text-foreground">{e.recuperados}</span>
                  <span className="text-[10px] text-muted-foreground">/ {e.total} ({e.taxa}%)</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export { STATUS_LABELS };
