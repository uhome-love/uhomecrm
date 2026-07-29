import { useMemo, useState, useEffect } from "react";
import { format, startOfMonth, endOfMonth, addMonths, isSameMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
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

import RankingFilters from "@/components/ranking/v2/RankingFilters";
import PerfVisaoGeral from "@/components/performance/PerfVisaoGeral";
import PerfRanking from "@/components/performance/PerfRanking";
import CorretorProgresso from "@/pages/CorretorProgresso";
import RelatorioCorretor from "@/pages/RelatorioCorretor";

type TabKey = "visao" | "ranking" | "progresso" | "relatorio";

const TABS: { key: TabKey; label: string }[] = [
  { key: "visao", label: "Visão Geral" },
  { key: "ranking", label: "Ranking" },
  { key: "progresso", label: "Meu Progresso" },
  { key: "relatorio", label: "Relatório 1:1" },
];

export default function CentralPerformance() {
  const { user } = useAuthUser();
  const { isAdmin, isGestor } = useUserRole();
  const [tab, setTab] = useState<TabKey>("visao");
  const [offset, setOffset] = useState(0);
  const [meses, setMeses] = useState(6);
  const [gerenteId, setGerenteId] = useState<string | undefined>();

  useEffect(() => {
    if (isGestor && !isAdmin && user?.id) setGerenteId(user.id);
  }, [isGestor, isAdmin, user?.id]);

  const referencia = useMemo(() => addMonths(new Date(), offset), [offset]);
  const filtro = useMemo(
    () => ({
      start: format(startOfMonth(referencia), "yyyy-MM-dd"),
      end: format(endOfMonth(referencia), "yyyy-MM-dd"),
      gerenteId: gerenteId ?? null,
    }),
    [referencia, gerenteId]
  );

  const { linhas, isLoading } = useMetricasSSOT(filtro);
  const { pontos, isLoading: evolucaoLoading } = useEvolucaoSSOT({ referencia, meses, gerenteId });

  const periodoLabel = useMemo(() => {
    const label = format(referencia, "MMMM 'de' yyyy", { locale: ptBR });
    const cap = label.charAt(0).toUpperCase() + label.slice(1);
    return isSameMonth(referencia, new Date()) ? `${cap} · mês atual` : cap;
  }, [referencia]);

  const exportarCsv = () => {
    const header = ["Corretor", "Equipe", "Ativo", "Leads", "Visitas marcadas", "Visitas realizadas", "No-show", "Vendas", "VGV assinado"];
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
    const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `performance-uhome-${filtro.start}-${filtro.end}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exportado");
  };

  const totalVgv = linhas.reduce((s, l) => s + l.vgv_assinado, 0);

  return (
    <div className="-m-6 min-h-full bg-background p-4 md:p-8">
      <div className="mx-auto w-full max-w-7xl bg-card border border-border rounded-xl overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
        {/* Header */}
        <div className="px-6 md:px-8 pt-8 pb-6 border-b border-border">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Central de Performance</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Fonte única de verdade · VGV, visitas e leads em tempo real
              </p>
            </div>

            <nav className="flex bg-muted/60 p-1 rounded-xl border border-border overflow-x-auto scrollbar-hide">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={cn(
                    "px-4 md:px-5 py-2 text-sm rounded-lg whitespace-nowrap transition-colors",
                    tab === t.key
                      ? "bg-card shadow-sm text-primary font-semibold"
                      : "text-muted-foreground hover:text-foreground font-medium"
                  )}
                >
                  {t.label}
                </button>
              ))}
            </nav>
          </div>

          {(tab === "visao" || tab === "ranking") && (
            <div className="flex flex-wrap items-center justify-between gap-3 mt-6">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setOffset((o) => o - 1)}
                  className="p-1.5 rounded-lg bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Mês anterior"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-sm font-semibold text-foreground min-w-[190px] text-center">{periodoLabel}</span>
                <button
                  onClick={() => setOffset((o) => Math.min(o + 1, 0))}
                  disabled={offset === 0}
                  aria-label="Próximo mês"
                  className={cn(
                    "p-1.5 rounded-lg transition-colors",
                    offset === 0
                      ? "text-muted-foreground/30 cursor-not-allowed"
                      : "bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground"
                  )}
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                {!isLoading && (
                  <span className="ml-2 text-xs font-medium text-muted-foreground hidden sm:inline">
                    {fmtMoney(totalVgv, "short")} no período
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <RankingFilters equipeId={gerenteId} onEquipeChange={setGerenteId} showEquipe={isAdmin} />
                <Button size="sm" variant="outline" className="gap-2 text-xs h-8" onClick={exportarCsv} disabled={isLoading}>
                  <Download className="h-3.5 w-3.5" /> Exportar CSV
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        <div className={cn(tab === "visao" || tab === "ranking" ? "p-6 md:p-8 bg-muted/20" : "")}>
          <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
            {tab === "visao" && (
              <PerfVisaoGeral
                linhas={linhas}
                loading={isLoading}
                pontos={pontos}
                evolucaoLoading={evolucaoLoading}
                meses={meses}
                onMesesChange={setMeses}
                onVerRanking={() => setTab("ranking")}
              />
            )}
            {tab === "ranking" && <PerfRanking linhas={linhas} loading={isLoading} />}
            {tab === "progresso" && <CorretorProgresso />}
            {tab === "relatorio" && <RelatorioCorretor />}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
