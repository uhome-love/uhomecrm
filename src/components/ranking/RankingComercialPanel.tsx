import { useState, useMemo } from "react";
import { useCeoData, pct, type CeoPeriod } from "@/hooks/useCeoData";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/hooks/useAuth";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, Medal, TrendingUp, Users, Target, BarChart3, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import IaCoreAction from "@/components/IaCoreAction";

type RankMetric = "score" | "vgv_assinado" | "vgv_gerado" | "visitas_realizadas" | "propostas";
type PeriodOption = "dia" | "semana" | "mes";

const metricLabels: Record<RankMetric, string> = {
  score: "Score Geral",
  vgv_assinado: "VGV Assinado",
  vgv_gerado: "VGV Gerado",
  visitas_realizadas: "Visitas Realizadas",
  propostas: "Propostas",
};

const periodLabels: Record<PeriodOption, string> = {
  dia: "Hoje",
  semana: "Esta Semana",
  mes: "Este Mês",
};

const medals = ["🥇", "🥈", "🥉"];
const medalBg = [
  "border-warning/40 bg-gradient-to-r from-warning/10 to-warning/5",
  "border-muted-foreground/20 bg-gradient-to-r from-muted/20 to-muted/10",
  "border-orange-400/30 bg-gradient-to-r from-orange-50 to-orange-50/50 dark:from-orange-900/10 dark:to-orange-900/5",
];

export default function RankingComercialPanel() {
  const { isAdmin, isGestor } = useUserRole();
  const { user } = useAuth();
  const [period, setPeriod] = useState<PeriodOption>("semana");
  const [metric, setMetric] = useState<RankMetric>("vgv_assinado");

  const filterGerenteId = isAdmin ? undefined : user?.id;
  const { gerentes, allCorretores, loading } = useCeoData(period as CeoPeriod, undefined, undefined, filterGerenteId);

  // Sort corretores by selected metric
  const sortedCorretores = useMemo(() => {
    const arr = [...allCorretores];
    arr.sort((a, b) => {
      if (metric === "score") return b.score - a.score;
      if (metric === "vgv_assinado") return b.real_vgv_assinado - a.real_vgv_assinado;
      if (metric === "vgv_gerado") return b.real_vgv_gerado - a.real_vgv_gerado;
      if (metric === "visitas_realizadas") return b.real_visitas_realizadas - a.real_visitas_realizadas;
      if (metric === "propostas") return b.real_propostas - a.real_propostas;
      return 0;
    });
    return arr;
  }, [allCorretores, metric]);

  // Sort teams (gerentes) by selected metric
  const sortedTimes = useMemo(() => {
    const arr = [...gerentes];
    arr.sort((a, b) => {
      if (metric === "score") return b.totals.score - a.totals.score;
      if (metric === "vgv_assinado") return b.totals.real_vgv_assinado - a.totals.real_vgv_assinado;
      if (metric === "vgv_gerado") return b.totals.real_vgv_gerado - a.totals.real_vgv_gerado;
      if (metric === "visitas_realizadas") return b.totals.real_visitas_realizadas - a.totals.real_visitas_realizadas;
      if (metric === "propostas") return b.totals.real_propostas - a.totals.real_propostas;
      return 0;
    });
    return arr;
  }, [gerentes, metric]);

  const getCorretorValue = (c: typeof allCorretores[0]) => {
    if (metric === "score") return `${c.score} pts`;
    if (metric === "vgv_assinado") return `R$ ${c.real_vgv_assinado.toLocaleString("pt-BR")}`;
    if (metric === "vgv_gerado") return `R$ ${c.real_vgv_gerado.toLocaleString("pt-BR")}`;
    if (metric === "visitas_realizadas") return `${c.real_visitas_realizadas}`;
    if (metric === "propostas") return `${c.real_propostas}`;
    return "";
  };

  const getTimeValue = (t: typeof gerentes[0]) => {
    if (metric === "score") return `${t.totals.score} pts`;
    if (metric === "vgv_assinado") return `R$ ${t.totals.real_vgv_assinado.toLocaleString("pt-BR")}`;
    if (metric === "vgv_gerado") return `R$ ${t.totals.real_vgv_gerado.toLocaleString("pt-BR")}`;
    if (metric === "visitas_realizadas") return `${t.totals.real_visitas_realizadas}`;
    if (metric === "propostas") return `${t.totals.real_propostas}`;
    return "";
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return "text-success";
    if (score >= 40) return "text-warning";
    return "text-destructive";
  };

  const iaContext = useMemo(() => {
    if (sortedCorretores.length === 0) return "";
    const top5 = sortedCorretores.slice(0, 5).map((c, i) =>
      `${i + 1}. ${c.corretor_nome} (Equipe ${c.gerente_nome}) — Score: ${c.score}, VGV Assinado: R$ ${c.real_vgv_assinado.toLocaleString("pt-BR")}, Visitas: ${c.real_visitas_realizadas}, Propostas: ${c.real_propostas}, Ligações: ${c.real_ligacoes}`
    ).join("\n");
    const teams = sortedTimes.map((t, i) =>
      `${i + 1}. Equipe ${t.gerente_nome} — Score: ${t.totals.score}, VGV Assinado: R$ ${t.totals.real_vgv_assinado.toLocaleString("pt-BR")}, Visitas: ${t.totals.real_visitas_realizadas}, Propostas: ${t.totals.real_propostas}`
    ).join("\n");
    return `Período: ${periodLabels[period]}\n\nRanking de Times:\n${teams}\n\nTop 5 Corretores:\n${top5}`;
  }, [sortedCorretores, sortedTimes, period]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
            <Trophy className="h-6 w-6 text-warning" />
            Ranking Comercial (VGV)
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isAdmin ? "Visão completa da empresa" : "Ranking da sua equipe"}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Select value={period} onValueChange={(v) => setPeriod(v as PeriodOption)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(periodLabels).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={metric} onValueChange={(v) => setMetric(v as RankMetric)}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(metricLabels).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-muted-foreground">Carregando rankings...</div>
      ) : (
        <>
          {isAdmin ? (
            <Tabs defaultValue="times" className="space-y-4">
              <TabsList>
                <TabsTrigger value="times" className="gap-1.5">
                  <Users className="h-3.5 w-3.5" /> Ranking de Times
                </TabsTrigger>
                <TabsTrigger value="corretores" className="gap-1.5">
                  <Trophy className="h-3.5 w-3.5" /> Ranking Corretores
                </TabsTrigger>
              </TabsList>

              <TabsContent value="times">
                <RankingTimesView times={sortedTimes} getValue={getTimeValue} metric={metric} />
              </TabsContent>

              <TabsContent value="corretores">
                <RankingCorretoresView corretores={sortedCorretores} getValue={getCorretorValue} metric={metric} getScoreColor={getScoreColor} showEquipe />
              </TabsContent>
            </Tabs>
          ) : (
            <RankingCorretoresView corretores={sortedCorretores} getValue={getCorretorValue} metric={metric} getScoreColor={getScoreColor} showEquipe={false} />
          )}

          {/* IA Analysis */}
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-4 w-4 text-primary" />
              <h3 className="font-display font-semibold text-sm">Análise da IA</h3>
            </div>
            <IaCoreAction
              label="Gerar Diagnóstico de Performance"
              module="ranking_comercial"
              prompt={`Analise o ranking comercial e gere um diagnóstico completo:\n\n${iaContext}\n\nInclua: corretores em destaque, corretores que precisam melhorar, sugestões de ação para os gerentes.`}
            />
          </div>
        </>
      )}
    </div>
  );
}

/* ==================== Sub-components ==================== */

function RankingTimesView({ times, getValue, metric }: {
  times: ReturnType<typeof useCeoData>["gerentes"];
  getValue: (t: any) => string;
  metric: RankMetric;
}) {
  if (times.length === 0) return <EmptyState label="Sem dados de times para o período" />;

  return (
    <div className="space-y-3">
      {times.map((t, i) => (
        <motion.div
          key={t.gerente_id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
          className={`rounded-xl border p-4 transition-all ${i < 3 ? medalBg[i] : "border-border bg-card"}`}
        >
          <div className="flex items-center gap-4">
            <span className="text-2xl w-10 text-center shrink-0">
              {i < 3 ? medals[i] : <span className="text-lg text-muted-foreground font-display font-bold">{i + 1}º</span>}
            </span>
            <div className="flex-1 min-w-0">
              <p className="font-display font-bold text-foreground">Equipe {t.gerente_nome}</p>
              <p className="text-xs text-muted-foreground">{t.corretores.length} corretores</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xl font-display font-bold text-foreground">{getValue(t)}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{metricLabels[metric]}</p>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 pt-3 border-t border-border/50">
            <StatMini icon={Target} label="VGV Assinado" value={`R$ ${t.totals.real_vgv_assinado.toLocaleString("pt-BR")}`} />
            <StatMini icon={BarChart3} label="Propostas" value={`${t.totals.real_propostas}`} />
            <StatMini icon={TrendingUp} label="Visitas" value={`${t.totals.real_visitas_realizadas}`} />
            <StatMini icon={Trophy} label="Score" value={`${t.totals.score} pts`} />
          </div>
        </motion.div>
      ))}
    </div>
  );
}

function RankingCorretoresView({ corretores, getValue, metric, getScoreColor, showEquipe }: {
  corretores: ReturnType<typeof useCeoData>["allCorretores"];
  getValue: (c: any) => string;
  metric: RankMetric;
  getScoreColor: (score: number) => string;
  showEquipe: boolean;
}) {
  if (corretores.length === 0) return <EmptyState label="Sem dados de corretores para o período" />;

  return (
    <div className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <Trophy className="h-4 w-4 text-warning" />
        <h3 className="font-display font-semibold text-sm">Ranking de Corretores</h3>
        <span className="text-xs text-muted-foreground">({corretores.length})</span>
      </div>
      <div className="divide-y divide-border">
        <AnimatePresence>
          {corretores.map((c, i) => (
            <motion.div
              key={c.corretor_id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
              className={`flex items-center gap-3 px-4 py-3 transition-colors ${i < 3 ? "bg-muted/30" : ""}`}
            >
              <span className="text-lg w-8 text-center shrink-0">
                {i < 3 ? medals[i] : <span className="text-sm text-muted-foreground font-display font-bold">{i + 1}º</span>}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{c.corretor_nome}</p>
                {showEquipe && (
                  <p className="text-[10px] text-muted-foreground">Equipe {c.gerente_nome}</p>
                )}
                <div className="flex items-center gap-3 mt-0.5 text-[11px] text-muted-foreground flex-wrap">
                  <span>Lig: {c.real_ligacoes}</span>
                  <span>Vis: {c.real_visitas_realizadas}</span>
                  <span>Prop: {c.real_propostas}</span>
                  <span>VGV: R$ {c.real_vgv_assinado.toLocaleString("pt-BR")}</span>
                </div>
              </div>
              <div className="text-right shrink-0 space-y-0.5">
                <p className="text-lg font-display font-bold text-foreground">{getValue(c)}</p>
                <p className={`text-xs font-bold ${getScoreColor(c.score)}`}>
                  Score {c.score}
                </p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

function StatMini({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold text-foreground">{value}</p>
      </div>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="text-center py-12 text-muted-foreground rounded-xl border border-dashed border-border">
      <Trophy className="h-8 w-8 mx-auto mb-2 opacity-30" />
      <p className="text-sm">{label}</p>
    </div>
  );
}
