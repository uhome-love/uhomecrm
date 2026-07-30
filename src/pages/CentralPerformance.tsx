import { useMemo, useState, useEffect } from "react";
import { Download } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
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

type TabKey = "visao" | "ranking" | "origem" | "progresso" | "relatorio";

const TAB_LABELS: Record<TabKey, string> = {
  visao: "Visão Geral",
  ranking: "Ranking",
  origem: "Origem",
  progresso: "Meu Progresso",
  relatorio: "Relatório 1:1",
};

const COM_FILTROS: TabKey[] = ["visao", "ranking", "origem"];

export default function CentralPerformance() {
  const { user } = useAuthUser();
  const { isAdmin, isGestor, isDiretor, isCorretor, loading: rolesLoading } = useUserRole();

  /** corretor puro: sem visão de gestão — só a própria performance */
  const soCorretor = isCorretor && !isGestor && !isAdmin;

  const tabs = useMemo<TabKey[]>(
    () =>
      soCorretor
        ? ["progresso", "visao", "relatorio"]
        : ["visao", "ranking", "origem", "progresso", "relatorio"],
    [soCorretor]
  );

  const [tab, setTab] = useState<TabKey>("visao");
  useEffect(() => {
    if (rolesLoading) return;
    setTab(soCorretor ? "progresso" : "visao");
  }, [soCorretor, rolesLoading]);

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
        l.visitas_marcadas,
        l.visitas_realizadas,
        l.visitas_no_show,
        l.vendas,
        l.vgv_assinado.toFixed(2).replace(".", ","),
      ]);
    baixarCsv(
      "performance-uhome",
      ["Corretor", "Equipe", "Ativo", "Leads", "Visitas marcadas", "Visitas realizadas", "No-show", "Vendas", "VGV assinado"],
      rows
    );
  };

  const totalVgv = linhas.reduce((s, l) => s + l.vgv_assinado, 0);
  const mostraFiltros = COM_FILTROS.includes(tab);

  return (
    <div className="-m-6 min-h-full bg-background p-4 md:p-8">
      <div className="mx-auto w-full max-w-7xl bg-card border border-border rounded-xl overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
        {/* Header */}
        <div className="px-4 md:px-8 pt-6 md:pt-8 pb-5 border-b border-border">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Central de Performance</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {soCorretor
                  ? "Seus números, missões do dia e relatório 1:1"
                  : "Fonte única de verdade · VGV, visitas e leads em tempo real"}
              </p>
            </div>

            <nav className="flex bg-muted/60 p-1 rounded-xl border border-border overflow-x-auto scrollbar-hide">
              {tabs.map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={cn(
                    "px-3.5 md:px-5 py-2 text-sm rounded-lg whitespace-nowrap transition-colors",
                    tab === t
                      ? "bg-card shadow-sm text-primary font-semibold"
                      : "text-muted-foreground hover:text-foreground font-medium"
                  )}
                >
                  {t === "visao" && soCorretor ? "Minha Performance" : TAB_LABELS[t]}
                </button>
              ))}
            </nav>
          </div>

          {mostraFiltros && (
            <div className="flex flex-wrap items-center justify-between gap-3 mt-5">
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
        </div>

        {/* Content */}
        <div className="p-4 md:p-8 bg-muted/20">
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
                onVerRanking={() => setTab("ranking")}
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
            {tab === "origem" && <PerfOrigem dados={dadosOrigem} loading={origemLoading} />}
            {tab === "progresso" && <CorretorProgresso embedded />}
            {tab === "relatorio" && <RelatorioCorretor hideHeader />}
          </motion.div>
        </div>
      </div>

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
