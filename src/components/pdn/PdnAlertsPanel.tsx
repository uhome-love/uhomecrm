import { useMemo, useState } from "react";
import { type PdnEntry } from "@/hooks/usePdn";
import { calcProbabilidade, calcRisco, calcAlerts } from "@/lib/pdnScoring";
import { differenceInDays } from "date-fns";
import { AlertTriangle, Target, FileX, Phone, Flame, ChevronDown, ChevronUp, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Props {
  entries: PdnEntry[];
  onFilterChange?: (filter: string | null) => void;
  activeFilter?: string | null;
}

interface AlertEntry {
  entry: PdnEntry;
  type: "parado" | "sem_acao" | "sem_docs" | "risco" | "proximo_fechar";
  detail: string;
  diasParado?: number;
}

function buildAlertEntries(entries: PdnEntry[]): AlertEntry[] {
  const ativos = entries.filter(e => e.situacao !== "caiu" && e.situacao !== "assinado");
  const alerts: AlertEntry[] = [];

  for (const e of ativos) {
    const dias = differenceInDays(new Date(), new Date(e.updated_at));
    const prob = calcProbabilidade(e);
    const risco = calcRisco(e);

    if (dias >= 3) {
      alerts.push({
        entry: e,
        type: "parado",
        detail: dias >= 7
          ? `⛔ CRÍTICO — ${dias} dias sem atualização`
          : dias >= 5
          ? `🔴 ${dias} dias sem atualização`
          : `🟡 ${dias} dias sem atualização`,
        diasParado: dias,
      });
    }

    if (!e.proxima_acao || !e.proxima_acao.trim()) {
      alerts.push({
        entry: e,
        type: "sem_acao",
        detail: "Sem próxima ação definida",
      });
    }

    if (e.docs_status === "sem_docs" && e.situacao === "gerado") {
      alerts.push({
        entry: e,
        type: "sem_docs",
        detail: "Gerado sem documentação",
      });
    }

    if (risco.nivel === "risco") {
      alerts.push({
        entry: e,
        type: "risco",
        detail: risco.motivos.join(" · "),
      });
    }

    if (prob >= 70) {
      alerts.push({
        entry: e,
        type: "proximo_fechar",
        detail: `Probabilidade: ${prob}%`,
      });
    }
  }

  return alerts;
}

const FILTER_CONFIG: Record<string, { icon: React.ReactNode; label: string; color: string; bgColor: string }> = {
  proximo_fechar: {
    icon: <Flame className="h-3.5 w-3.5" />,
    label: "Próximos de fechar",
    color: "text-emerald-600",
    bgColor: "bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/20",
  },
  risco: {
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
    label: "Em risco",
    color: "text-red-600",
    bgColor: "bg-red-500/10 border-red-500/30 hover:bg-red-500/20",
  },
  parado: {
    icon: <Clock className="h-3.5 w-3.5" />,
    label: "Negócios parados",
    color: "text-orange-600",
    bgColor: "bg-orange-500/10 border-orange-500/30 hover:bg-orange-500/20",
  },
  sem_acao: {
    icon: <Target className="h-3.5 w-3.5" />,
    label: "Sem próxima ação",
    color: "text-amber-600",
    bgColor: "bg-amber-500/10 border-amber-500/30 hover:bg-amber-500/20",
  },
  sem_docs: {
    icon: <FileX className="h-3.5 w-3.5" />,
    label: "Sem documentação",
    color: "text-muted-foreground",
    bgColor: "bg-muted border-border hover:bg-muted/80",
  },
};

export default function PdnAlertsPanel({ entries, onFilterChange, activeFilter }: Props) {
  const [expanded, setExpanded] = useState(false);
  const alertEntries = useMemo(() => buildAlertEntries(entries), [entries]);
  const alerts = useMemo(() => calcAlerts(entries), [entries]);

  const counts: Record<string, number> = {
    proximo_fechar: alerts.proximosDeFecahr,
    risco: alerts.emRisco,
    parado: alerts.negociosParados,
    sem_acao: alerts.semProximaAcao,
    sem_docs: alerts.semDocs,
  };

  const hasAlerts = Object.values(counts).some(c => c > 0);
  if (!hasAlerts && entries.length === 0) return null;

  const activeAlerts = activeFilter
    ? alertEntries.filter(a => a.type === activeFilter)
    : [];

  const handleFilterClick = (type: string) => {
    if (activeFilter === type) {
      onFilterChange?.(null);
    } else {
      onFilterChange?.(type);
      setExpanded(true);
    }
  };

  return (
    <div className="space-y-2">
      {/* Filter chips */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(FILTER_CONFIG).map(([type, config]) => {
          const count = counts[type] || 0;
          if (count === 0) return null;
          const isActive = activeFilter === type;
          return (
            <button
              key={type}
              onClick={() => handleFilterClick(type)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer ${config.color} ${config.bgColor} ${
                isActive ? "ring-2 ring-offset-1 ring-primary/50 shadow-sm" : ""
              }`}
            >
              {config.icon}
              <span>{count}</span>
              <span className="hidden sm:inline">{config.label}</span>
            </button>
          );
        })}
      </div>

      {/* Expanded detail list */}
      {activeFilter && activeAlerts.length > 0 && (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border-b border-border">
            <div className="flex items-center gap-2">
              {FILTER_CONFIG[activeFilter]?.icon}
              <span className="text-xs font-semibold">{FILTER_CONFIG[activeFilter]?.label}</span>
              <Badge variant="secondary" className="text-[10px] h-4">{activeAlerts.length}</Badge>
            </div>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => onFilterChange?.(null)}>
              ✕
            </Button>
          </div>
          <div className="max-h-[200px] overflow-y-auto divide-y divide-border">
            {activeAlerts.slice(0, expanded ? 20 : 5).map((alert, i) => (
              <AlertRow key={`${alert.entry.id}-${alert.type}-${i}`} alert={alert} />
            ))}
          </div>
          {activeAlerts.length > 5 && !expanded && (
            <button
              onClick={() => setExpanded(true)}
              className="w-full text-center py-1.5 text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors border-t border-border"
            >
              Ver mais {activeAlerts.length - 5} alertas <ChevronDown className="inline h-3 w-3" />
            </button>
          )}
          {expanded && activeAlerts.length > 5 && (
            <button
              onClick={() => setExpanded(false)}
              className="w-full text-center py-1.5 text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors border-t border-border"
            >
              Recolher <ChevronUp className="inline h-3 w-3" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function AlertRow({ alert }: { alert: AlertEntry }) {
  const { entry, detail, diasParado } = alert;
  const risco = calcRisco(entry);

  return (
    <div className="flex items-center gap-3 px-3 py-2 text-xs hover:bg-muted/20 transition-colors">
      {/* Risk indicator */}
      <span className="text-sm shrink-0">
        {risco.nivel === "risco" ? "🔴" : risco.nivel === "atencao" ? "🟡" : "🟢"}
      </span>

      {/* Name + empreendimento */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-foreground truncate">{entry.nome || "Sem nome"}</span>
          {entry.empreendimento && (
            <span className="text-muted-foreground truncate text-[10px]">· {entry.empreendimento}</span>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground mt-0.5">{detail}</p>
      </div>

      {/* Corretor */}
      {entry.corretor && (
        <span className="text-[10px] text-muted-foreground shrink-0 hidden sm:block">{entry.corretor}</span>
      )}

      {/* Days stale badge */}
      {diasParado !== undefined && diasParado >= 5 && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge
                variant="outline"
                className={`text-[9px] h-4 shrink-0 ${
                  diasParado >= 7 ? "bg-red-500/10 text-red-600 border-red-500/30" :
                  "bg-orange-500/10 text-orange-600 border-orange-500/30"
                }`}
              >
                {diasParado}d parado
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="left" className="text-xs">
              <p>Última atualização: {diasParado} dias atrás</p>
              {risco.motivos.length > 0 && (
                <ul className="mt-1 space-y-0.5">
                  {risco.motivos.map((m, i) => <li key={i}>• {m}</li>)}
                </ul>
              )}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}
