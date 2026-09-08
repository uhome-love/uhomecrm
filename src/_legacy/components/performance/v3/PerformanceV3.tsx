import { useMemo, useState, useEffect } from "react";
import { Download, FileText } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

import { useAuthUser } from "@/hooks/useAuthUser";
import { useUserRole } from "@/hooks/useUserRole";
import { resolverPeriodo, type PeriodoState } from "@/lib/perfPeriodo";
import { useFunilPerformance, consolidarFunil } from "@/hooks/useFunilPerformance";
import { baixarRelatorioHtml, baixarRelatorioPdf } from "@/lib/performanceReport";

import RankingFilters from "@/components/ranking/v2/RankingFilters";
import PerfPeriodBar from "./PerfPeriodBar";
import PerfHome from "./PerfHome";
import FunilTable from "./FunilTable";
import ConversaoTable from "./ConversaoTable";
import RankingsTabs from "./RankingsTabs";

type Aba = "kpis" | "funil" | "conversao" | "rankings";

const ABAS: { id: Aba; label: string }[] = [
  { id: "kpis", label: "Visão de KPIs" },
  { id: "funil", label: "Planilha do funil" },
  { id: "conversao", label: "Conversão" },
  { id: "rankings", label: "Rankings" },
];

/**
 * PerformanceV3 — nova Performance (funil completo por corretor/equipe).
 *
 * Fonte única: RPC `rpc_perf_funil`. Visões por papel:
 *  - admin/diretor: tudo, filtro de equipe e corretor
 *  - gestor: escopo travado na própria equipe
 *  - corretor: apenas os próprios números
 */
export default function PerformanceV3() {
  const { user } = useAuthUser();
  const { isAdmin, isGestor, isDiretor, isCorretor } = useUserRole();
  const soCorretor = isCorretor && !isGestor && !isAdmin && !isDiretor;

  const [aba, setAba] = useState<Aba>("kpis");
  const [periodo, setPeriodo] = useState<PeriodoState>({ tipo: "mes", offset: 0 });
  const [gerenteId, setGerenteId] = useState<string | undefined>();
  const [corretorId, setCorretorId] = useState<string | undefined>();

  useEffect(() => {
    if (isGestor && !isAdmin && !isDiretor && user?.id) setGerenteId(user.id);
  }, [isGestor, isAdmin, isDiretor, user?.id]);

  const p = useMemo(() => resolverPeriodo(periodo), [periodo]);

  const escopoUser = soCorretor ? user?.id ?? null : corretorId ?? null;

  const atual = useFunilPerformance(
    { start: p.start, end: p.end, gerenteId, userId: escopoUser },
    !!user
  );
  const anterior = useFunilPerformance(
    { start: p.prevStart, end: p.prevEnd, gerenteId, userId: escopoUser },
    !!user
  );

  const linhas = useMemo(() => consolidarFunil(atual.linhas), [atual.linhas]);

  const meta = {
    periodoLabel: p.label,
    escopo: soCorretor ? "Meus números" : gerenteId ? "Minha equipe" : "Todas as equipes",
    geradoEm: format(new Date(), "dd/MM/yyyy HH:mm"),
  };

  const exportar = (tipo: "pdf" | "html") => {
    if (linhas.length === 0) {
      toast.error("Sem dados para exportar neste período.");
      return;
    }
    try {
      if (tipo === "pdf") baixarRelatorioPdf(linhas, meta);
      else baixarRelatorioHtml(linhas, meta);
      toast.success(`Relatório ${tipo.toUpperCase()} gerado.`);
    } catch {
      toast.error("Não foi possível gerar o relatório.");
    }
  };

  if (atual.error) {
    return (
      <div className="rounded-xl border border-danger-500/40 bg-danger-500/5 p-6 text-sm">
        Não foi possível carregar a performance: {atual.error.message}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PerfPeriodBar estado={periodo} resolvido={p} onChange={setPeriodo} />
        <div className="flex flex-wrap items-center gap-2">
          {!soCorretor && (
            <RankingFilters
              equipeId={gerenteId}
              onEquipeChange={setGerenteId}
              showEquipe={isAdmin || isDiretor}
            />
          )}
          <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={() => exportar("html")}>
            <FileText className="h-3.5 w-3.5" /> HTML
          </Button>
          <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={() => exportar("pdf")}>
            <Download className="h-3.5 w-3.5" /> PDF
          </Button>
        </div>
      </div>

      <div className="flex gap-5 border-b border-border">
        {ABAS.map((a) => (
          <button
            key={a.id}
            onClick={() => setAba(a.id)}
            className={cn(
              "py-2 text-[13px] font-semibold border-b-2 -mb-px transition-colors whitespace-nowrap",
              aba === a.id ? "text-primary border-primary" : "text-muted-foreground border-transparent hover:text-foreground"
            )}
          >
            {a.label}
          </button>
        ))}
      </div>

      {aba === "kpis" && (
        <PerfHome
          linhas={atual.linhas}
          linhasAnterior={anterior.linhas}
          loading={atual.isLoading}
          prevLabel={p.prevLabel}
        />
      )}
      {aba === "funil" && <FunilTable linhas={linhas} loading={atual.isLoading} simples={soCorretor} />}
      {aba === "conversao" && <ConversaoTable linhas={linhas} loading={atual.isLoading} simples={soCorretor} />}
      {aba === "rankings" && <RankingsTabs linhas={atual.linhas} loading={atual.isLoading} meuId={user?.id} />}

    </div>
  );
}
