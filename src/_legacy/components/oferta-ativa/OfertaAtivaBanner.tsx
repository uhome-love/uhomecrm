/**
 * OfertaAtivaBanner — aviso no dashboard do corretor de que existe uma lista
 * personalizada de Oferta Ativa liberada para ele, com contagem regressiva e
 * progresso da fila. Some sozinho quando expira ou a fila zera.
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Phone, Clock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useCampanhasDisponiveis } from "@/hooks/useCampanhasDisponiveis";

function restante(expira?: string | null) {
  if (!expira) return null;
  const ms = new Date(expira).getTime() - Date.now();
  if (ms <= 0) return null;
  const dias = Math.floor(ms / 86_400_000);
  const horas = Math.floor((ms % 86_400_000) / 3_600_000);
  const min = Math.floor((ms % 3_600_000) / 60_000);
  return {
    ultimoDia: dias === 0,
    label: dias > 0 ? `${dias}d ${horas}h` : horas > 0 ? `${horas}h ${min}min` : `${min}min`,
  };
}

export function OfertaAtivaBanner() {
  const navigate = useNavigate();
  const { campanhas, statsMap } = useCampanhasDisponiveis();
  const [, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  const principal = useMemo(
    () => campanhas.find((c) => (statsMap[c.id]?.naFila ?? 0) > 0),
    [campanhas, statsMap],
  );

  if (!principal) return null;

  const stats = statsMap[principal.id];
  const total = stats?.total ?? 0;
  const trabalhados = Math.max(total - (stats?.naFila ?? 0), 0);
  const pct = total > 0 ? Math.round((trabalhados / total) * 100) : 0;
  const tempo = restante(principal.expira_em);
  const outras = campanhas.length - 1;

  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-primary">
            <Phone size={12} /> Você tem uma lista de Oferta Ativa
          </p>
          <p className="mt-1 truncate text-sm font-bold">
            {principal.empreendimento ? `${principal.empreendimento} · ` : ""}
            {principal.nome}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>
              <strong className="text-foreground">{(stats?.naFila ?? 0).toLocaleString("pt-BR")}</strong> leads na
              sua fila
            </span>
            {tempo && (
              <span
                className={`flex items-center gap-1 ${tempo.ultimoDia ? "font-semibold text-destructive" : ""}`}
              >
                <Clock size={12} /> expira em {tempo.label}
              </span>
            )}
            {outras > 0 && <span>+{outras} outra{outras > 1 ? "s" : ""} lista{outras > 1 ? "s" : ""}</span>}
          </div>
        </div>

        <Button size="sm" onClick={() => navigate("/corretor/call")} className="shrink-0">
          Começar a ligar <ArrowRight size={14} className="ml-1" />
        </Button>
      </div>

      {total > 0 && (
        <div className="mt-3 space-y-1">
          <Progress value={pct} className="h-1.5" />
          <p className="text-[11px] text-muted-foreground">
            {trabalhados.toLocaleString("pt-BR")} de {total.toLocaleString("pt-BR")} já trabalhados
          </p>
        </div>
      )}
    </div>
  );
}

export default OfertaAtivaBanner;
