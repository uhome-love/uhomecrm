import { Megaphone, ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useRelatoriosCentral } from "@/hooks/useRelatoriosCentral";
import type { CentralUrlState } from "@/components/central-v2/useCentralUrlState";
import { SectionPipelineLeads } from "@/components/central-v2/sections/SectionPipelineLeads";

interface Props {
  state: CentralUrlState;
}

/**
 * Complemento da Visão Geral: KPIs de funil de leads (motor `central`,
 * antiga aba "Pipeline") + atalho para a Central de Marketing, que hoje
 * concentra a análise de origem/campanha/criativo (antiga aba "Origem & ROI").
 */
export function VisaoPipelineExtra({ state }: Props) {
  const rel = useRelatoriosCentral({
    periodo: state.periodo,
    de: state.de,
    ate: state.ate,
    equipe: state.equipe,
  });

  return (
    <div className="flex flex-col gap-5">
      <SectionPipelineLeads query={rel.pipelineLeads} />

      <Link
        to="/dados-anuncios"
        className="group flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:bg-muted/60"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Megaphone className="h-[18px] w-[18px]" strokeWidth={1.9} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">Origem, campanha e ROI de mídia</p>
          <p className="truncate text-xs text-muted-foreground">
            Campanha, conjunto, criativo, formulário e investimento na Central de Marketing
          </p>
        </div>
        <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
      </Link>
    </div>
  );
}
