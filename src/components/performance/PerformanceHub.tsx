import { useMemo, useState, useEffect } from "react";
import { Download } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { fmtMoney } from "@/lib/fmtMoney";

import { useAuthUser } from "@/hooks/useAuthUser";
import { useUserRole } from "@/hooks/useUserRole";
import { useMetricasSSOT } from "@/hooks/useMetricasSSOT";
import { useEvolucaoSSOT } from "@/hooks/useEvolucaoSSOT";
import { useMetasSSOT, usePaceMes } from "@/hooks/useMetasSSOT";
import { resolverPeriodo, type PeriodoState } from "@/lib/perfPeriodo";

import RankingFilters from "@/components/ranking/v2/RankingFilters";
import PerfPeriodoSelector from "@/components/performance/PerfPeriodoSelector";
import PerfVisaoGeral from "@/components/performance/PerfVisaoGeral";
import PerfRanking from "@/components/performance/PerfRanking";
import PerfOrigem from "@/components/performance/PerfOrigem";
import { useMetricasOrigem } from "@/hooks/useMetricasOrigem";
import PerfDrilldownSheet from "@/components/performance/PerfDrilldownSheet";
import PerfCorretorSheet from "@/components/performance/PerfCorretorSheet";
import type { DetalheTipo } from "@/hooks/useMetricasDetalhe";
import type { MetricaCorretor } from "@/lib/metricasSSOT";
import CorretorProgresso from "@/pages/CorretorProgresso";
import RelatorioCorretor from "@/pages/RelatorioCorretor";

export type PerfTab = "visao" | "ranking" | "origem" | "progresso" | "relatorio-1a1";

const COM_FILTROS: PerfTab[] = ["visao", "ranking", "origem"];

interface Props {
  /** Seção ativa — controlada pela Central de Relatórios (URL `?secao=`). */
  tab: PerfTab;
  /** Navegação entre seções (ex.: "ver ranking" na Visão Geral). */
  onNavigate?: (tab: PerfTab) => void;
}

/**
 * PerformanceHub — corpo da antiga Central de Performance.
 *
 * Fonte única: `rpc_metricas` (SSOT). Não renderiza título nem navegação:
 * o shell (`src/pages/CentralRelatorios.tsx`) é dono da navegação por URL.
 */
export default function PerformanceHub({ tab, onNavigate }: Props) {
  const { user } = useAuthUser();
  const { isAdmin, isGestor, isDiretor, isCorretor } = useUserRole();

  /** corretor puro: sem visão de gestão — só a própria performance */
  const soCorretor = isCorretor && !isGestor && !isAdmin && !isDiretor;

  const [periodo, setPeriodo] = useState<PeriodoState>({ tipo: "mes", offset: 0 });
  const [meses, setMeses] = useState(6);
  const [gerenteId, setGerenteId] = useState<string | undefined>();
  const [drilldown, setDrilldown] = useState<DetalheTipo | null>(null);
  const [corretorSel, setCorretorSel] = useState<MetricaCorretor | null>(null);

  useEffect(() => {
    if (isGestor && !isAdmin && !isDiretor && user?.id) setGerenteId(user.id);
  }, [isGestor, isAdmin, isDiretor, user?.id]);

  const p = useMemo(() => resolverPeriodo(periodo), [periodo]);

  /** corretor vê apenas os próprios números */
  const userId = soCorretor ? user?.id ?? null : null;

  const filtro = useMemo(
    () => ({ start: p.start, end: p.end, gerenteId: gerenteId ?? null, userId }),
    [p.start, p.end, gerenteId, userId]
  );
  const filtroAnterior = useMemo(
    () => ({ start: p.prevStart, end: p.prevEnd, gerenteId: gerenteId ?? null, userId }),
    [p.prevStart, p.prevEnd, gerenteId, userId]
  );

  const { linhas, isLoading } = useMetricasSSOT(filtro);
  const { linhas: linhasAnterior } = useMetricasSSOT(filtroAnterior, tab === "visao");
  const { pontos, isLoading: evolucaoLoading } = useEvolucaoSSOT({
    referencia: p.referencia,
    meses,
    gerenteId,
    userId,
  });
  const { data: metas, isLoading: metasLoading } = useMetasSSOT(p.referencia, gerenteId);
  const { data: pace } = usePaceMes(p.referencia);
  const { data: dadosOrigem = [], isLoading: origemLoading } = useMetricasOrigem(
    filtro.start,
    filtro.end,
    gerenteId,
    tab === "origem"
  );

  const baixarCsv = (nome: string, header: string[], rows: (string | number)[][]) => {
    const csv = [header, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))
      .join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${nome}-${filtro.start}-${filtro.end}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exportado");
  };

  const exportar = () => {
    if (tab === "origem") {
      const rows = dadosOrigem.map((o) => [
        o.origem ?? "",
        o.campanha ?? "",
        o.leads,
        o.visitas_realizadas,
        o.vendas,
        o.vgv_assinado.toFixed(2).replace(".", ","),
      ]);
      baixarCsv("performance-origem", ["Origem", "Campanha", "Leads", "Visitas realizadas", "Vendas", "VGV assinado"], rows);
      return;
    }
    const rows = [...linhas]
      .sort((a, b) => b.vgv_assinado - a.vgv_assinado)
      .map((l) => [
        l.corretor_nome ?? "",
        l.equipe ?? "",
        l.corretor_ativo ? "sim" : "não",
        l.leads_recebidos,
        l.visitas_agendadas,
        l.visitas_a_realizar,
        l.visitas_realizadas,
        l.visitas_no_show,
        l.vendas,
        l.vgv_assinado.toFixed(2).replace(".", ","),
      ]);
    baixarCsv(
      "performance-uhome",
      ["Corretor", "Equipe", "Ativo", "Leads", "Visitas agendadas", "Visitas a realizar", "Visitas realizadas", "No-show", "Vendas", "VGV assinado"],
      rows
    );
  };

  const totalVgv = linhas.reduce((s, l) => s + l.vgv_assinado, 0);
  const mostraFiltros = COM_FILTROS.includes(tab);

  return (
    <div className="flex flex-col gap-5">
      {mostraFiltros && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <PerfPeriodoSelector estado={periodo} resolvido={p} onChange={setPeriodo} />
            {!isLoading && (
              <span className="text-xs font-medium text-muted-foreground hidden sm:inline">
                {fmtMoney(totalVgv, "short")} no período
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <RankingFilters equipeId={gerenteId} onEquipeChange={setGerenteId} showEquipe={isAdmin || isDiretor} />
            <Button size="sm" variant="outline" className="gap-2 text-xs h-8" onClick={exportar} disabled={isLoading}>
              <Download className="h-3.5 w-3.5" /> Exportar CSV
            </Button>
          </div>
        </div>
      )}

      <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
        {tab === "visao" && (
          <PerfVisaoGeral
            linhas={linhas}
            linhasAnterior={linhasAnterior}
            prevLabel={p.prevLabel}
            loading={isLoading}
            pontos={pontos}
            evolucaoLoading={evolucaoLoading}
            meses={meses}
            onMesesChange={setMeses}
            onVerRanking={() => onNavigate?.("ranking")}
            metas={metas}
            pace={pace}
            metasLoading={metasLoading}
            onDrilldown={setDrilldown}
            mostrarRanking={!soCorretor}
          />
        )}

        {tab === "ranking" && (
          <PerfRanking linhas={linhas} loading={isLoading} onSelectCorretor={setCorretorSel} />
        )}
        {tab === "origem" && (
          <PerfOrigem dados={dadosOrigem} loading={origemLoading} start={filtro.start} end={filtro.end} />
        )}
        {tab === "progresso" && <CorretorProgresso embedded />}
        {tab === "relatorio-1a1" && <RelatorioCorretor hideHeader />}
      </motion.div>

      <PerfDrilldownSheet
        open={!!drilldown}
        onOpenChange={(v) => !v && setDrilldown(null)}
        tipo={drilldown}
        start={filtro.start}
        end={filtro.end}
        gerenteId={gerenteId ?? null}
      />

      <PerfCorretorSheet
        corretor={corretorSel}
        onOpenChange={(v) => !v && setCorretorSel(null)}
        start={filtro.start}
        end={filtro.end}
        periodoLabel={p.label}
      />
    </div>
  );
}
