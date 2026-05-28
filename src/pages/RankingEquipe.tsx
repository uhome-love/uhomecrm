import { useState, useMemo, useEffect } from "react";
import { Star, ChevronLeft, ChevronRight, CalendarDays, Users, ClipboardList, Eye, Briefcase, Download, PhoneCall } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { PageHeader } from "@/components/ui/PageHeader";
import { format, startOfWeek, endOfWeek, addWeeks, startOfMonth, endOfMonth, addMonths, isSameWeek, isSameMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

import { useAuthUser } from "@/hooks/useAuthUser";
import { useUserRole } from "@/hooks/useUserRole";
import RankingFilters from "@/components/ranking/v2/RankingFilters";
import RankingPresencasLeads from "@/components/ranking/v2/RankingPresencasLeads";
import RankingPipelineLeads from "@/components/ranking/v2/RankingPipelineLeads";
import RankingVisitas from "@/components/ranking/v2/RankingVisitas";
import RankingNegocios from "@/components/ranking/v2/RankingNegocios";
import RankingOfertaAtiva from "@/components/ranking/v2/RankingOfertaAtiva";
import { exportRankingsPdf } from "@/lib/exportRankingsPdf";
import { supabase } from "@/integrations/supabase/client";

type Period = "hoje" | "semana" | "mes" | "personalizado";
type TabKey = "presencas" | "pipeline" | "visitas" | "negocios" | "oferta_ativa";

export default function RankingEquipe() {
  const { user } = useAuthUser();
  const { isAdmin, isGestor } = useUserRole();
  const [period, setPeriod] = useState<Period>("mes");
  const [activeTab, setActiveTab] = useState<TabKey>("presencas");
  const [offset, setOffset] = useState(0);
  const [customRange, setCustomRange] = useState<{ from: Date | undefined; to: Date | undefined }>({ from: undefined, to: undefined });
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [equipeId, setEquipeId] = useState<string | undefined>();

  // Gestor (não admin): força equipe = self
  useEffect(() => {
    if (isGestor && !isAdmin && user?.id) setEquipeId(user.id);
  }, [isGestor, isAdmin, user?.id]);

  const now = new Date();

  const dateRange = useMemo<{ start?: string; end?: string }>(() => {
    if (period === "personalizado") {
      if (customRange.from && customRange.to) {
        return { start: format(customRange.from, "yyyy-MM-dd"), end: format(customRange.to, "yyyy-MM-dd") };
      }
      return {};
    }
    if (period === "hoje") {
      const d = format(now, "yyyy-MM-dd");
      return { start: d, end: d };
    }
    if (period === "semana") {
      const target = addWeeks(now, offset);
      return {
        start: format(startOfWeek(target, { weekStartsOn: 1 }), "yyyy-MM-dd"),
        end: format(endOfWeek(target, { weekStartsOn: 1 }), "yyyy-MM-dd"),
      };
    }
    const target = addMonths(now, offset);
    return {
      start: format(startOfMonth(target), "yyyy-MM-dd"),
      end: format(endOfMonth(target), "yyyy-MM-dd"),
    };
  }, [period, offset, customRange]);

  const periodLabel = useMemo(() => {
    if (period === "personalizado" && customRange.from && customRange.to) {
      return `${format(customRange.from, "dd/MM/yyyy")} - ${format(customRange.to, "dd/MM/yyyy")}`;
    }
    if (period === "hoje") return format(now, "dd 'de' MMMM", { locale: ptBR });
    if (period === "semana") {
      const target = addWeeks(now, offset);
      const s = startOfWeek(target, { weekStartsOn: 1 });
      const e = endOfWeek(target, { weekStartsOn: 1 });
      const isCurrent = isSameWeek(target, now, { weekStartsOn: 1 });
      const label = `${format(s, "dd/MM")} - ${format(e, "dd/MM")}`;
      return isCurrent ? `Semana atual · ${label}` : label;
    }
    const target = addMonths(now, offset);
    const isCurrent = isSameMonth(target, now);
    const label = format(target, "MMMM yyyy", { locale: ptBR });
    const cap = label.charAt(0).toUpperCase() + label.slice(1);
    return isCurrent ? `Mês atual · ${cap}` : cap;
  }, [period, offset, customRange]);

  const canNavigate = period === "semana" || period === "mes";

  const handlePeriodChange = (key: Period) => {
    setPeriod(key);
    setOffset(0);
    if (key === "personalizado") setCalendarOpen(true);
  };

  const filters = { ...dateRange, equipeId };

  const tabs = [
    { key: "presencas" as const, label: "Presenças & Leads", icon: Users, color: "bg-blue-600" },
    { key: "pipeline" as const, label: "Pipeline de Leads", icon: ClipboardList, color: "bg-purple-600" },
    { key: "visitas" as const, label: "Visitas", icon: Eye, color: "bg-amber-600" },
    { key: "negocios" as const, label: "Pipeline de Negócios", icon: Briefcase, color: "bg-emerald-600" },
    { key: "oferta_ativa" as const, label: "Oferta Ativa", icon: PhoneCall, color: "bg-rose-600" },
  ];

  const [exporting, setExporting] = useState(false);
  const fmtBRL = (n: number) => fmtMoney(n, "short");

  const handleExportPdf = async () => {
    try {
      setExporting(true);
      const { fetchAllRankings } = await import("@/hooks/useRankingsData");
      const all = await fetchAllRankings(filters);
      let equipeLabel: string | undefined;
      if (equipeId) {
        const { data } = await supabase.from("profiles").select("nome").eq("user_id", equipeId).maybeSingle();
        equipeLabel = data?.nome ? `Equipe: ${data.nome}` : undefined;
      } else if (isAdmin) {
        equipeLabel = "Todas as equipes";
      }
      await exportRankingsPdf({
        fileName: `rankings-uhome-${dateRange.start || "tudo"}-${dateRange.end || ""}.pdf`,
        periodLabel,
        equipeLabel,
        rankings: [
          {
            title: "1. Presenças & Leads (ordenado por leads recebidos)",
            caption: "Diurna = manhã/tarde/dia_todo · Noturna · Domingo",
            headers: ["Corretor", "Diurna", "Noturna", "Domingo", "Σ Presenças", "Leads recebidos"],
            rows: all.presencas.map(r => [r.nome, r.presencas_diurna, r.presencas_noturna, r.presencas_domingo, r.presencas_total, r.leads_recebidos]),
          },
          {
            title: "2. Pipeline de Leads (ordenado por conversão real no período)",
            caption: "Conversão = Virou visita / Recebidos no período · SLA atrasado = sem ação há +48h",
            headers: ["Corretor", "Ativos", "Recebidos", "Virou visita", "Virou negócio", "SLA atrasado", "Conversão"],
            rows: all.pipeline.map(r => [r.nome, r.ativos, r.recebidos_periodo, r.virou_visita, r.virou_negocio, r.sla_atrasado, `${r.conversao_pct.toFixed(1)}%`]),
          },
          {
            title: "3. Visitas (ordenado por realizadas)",
            headers: ["Corretor", "Criadas", "No-show", "Realizadas", "Conversão"],
            rows: all.visitas.map(r => {
              const denom = r.realizadas + r.no_show;
              const conv = denom > 0 ? ((r.realizadas / denom) * 100).toFixed(1) + "%" : "—";
              return [r.nome, r.criadas, r.no_show, r.realizadas, conv];
            }),
          },
          {
            title: "4. Pipeline de Negócios (ordenado por VGV assinado)",
            caption: "VGV usa vgv_final, com fallback para vgv_estimado",
            headers: ["Corretor", "Criados", "Caídos", "Assinados", "VGV Assinado"],
            rows: all.negocios.map(r => [r.nome, r.criados, r.caidos, r.assinados, fmtBRL(r.vgv_assinado)]),
          },
          {
            title: "5. Oferta Ativa (ordenado por score = média entre volume e conversão)",
            caption: "Score normaliza tentativas e conversão (0-100) e tira a média",
            headers: ["Corretor", "Tentativas", "Aproveitados", "Conversão", "Score"],
            rows: all.oferta_ativa.map(r => [r.nome, r.tentativas, r.aproveitados, `${r.conversao_pct.toFixed(1)}%`, r.score.toFixed(1)]),
          },
        ],
      });
      toast.success("PDF gerado com sucesso");
    } catch (e: any) {
      toast.error("Falha ao exportar PDF: " + (e?.message || "erro desconhecido"));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="bg-background dark:bg-[#0e1525] p-6 max-w-6xl mx-auto space-y-4 -m-6 min-h-full">
      <PageHeader
        title="Rankings"
        subtitle="Performance da equipe · Presenças, Pipeline, Visitas e Negócios"
        icon={<Star size={18} strokeWidth={1.5} />}
        tabs={[
          { label: "Hoje", value: "hoje" },
          { label: "Semana", value: "semana" },
          { label: "Mês", value: "mes" },
          { label: "Personalizado", value: "personalizado" },
        ]}
        activeTab={period}
        onTabChange={(v) => handlePeriodChange(v as Period)}
      />

      {/* Period nav + filtros */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          {canNavigate && (
            <>
              <button
                onClick={() => setOffset(o => o - 1)}
                className="p-1.5 rounded-lg bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm font-medium text-foreground min-w-[200px] text-center">{periodLabel}</span>
              <button
                onClick={() => setOffset(o => Math.min(o + 1, 0))}
                disabled={offset === 0}
                className={`p-1.5 rounded-lg transition-colors ${
                  offset === 0 ? "text-muted-foreground/30 cursor-not-allowed" : "bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </>
          )}
          {period === "hoje" && <span className="text-sm font-medium text-foreground">{periodLabel}</span>}
          {period === "personalizado" && (
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 text-xs">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {periodLabel || "Selecionar período"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="range"
                  selected={customRange as any}
                  onSelect={(r: any) => setCustomRange(r || { from: undefined, to: undefined })}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <RankingFilters
            equipeId={equipeId}
            onEquipeChange={setEquipeId}
            showEquipe={isAdmin}
          />
          <Button
            size="sm"
            variant="outline"
            className="gap-2 text-xs h-8"
            onClick={handleExportPdf}
            disabled={exporting}
          >
            <Download className="h-3.5 w-3.5" />
            {exporting ? "Gerando..." : "Baixar PDF"}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        {tabs.map(tab => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl transition-all whitespace-nowrap border ${
                isActive
                  ? `${tab.color} text-white border-transparent shadow-md`
                  : "bg-card text-muted-foreground border-border hover:bg-accent hover:text-foreground"
              }`}
              onClick={() => setActiveTab(tab.key)}
            >
              <tab.icon className="h-3.5 w-3.5" /> {tab.label}
            </button>
          );
        })}
      </div>

      <motion.div
        key={activeTab + JSON.stringify(filters)}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        {activeTab === "presencas" && <RankingPresencasLeads filters={filters} currentUserId={user?.id} />}
        {activeTab === "pipeline" && <RankingPipelineLeads filters={filters} currentUserId={user?.id} />}
        {activeTab === "visitas" && <RankingVisitas filters={filters} currentUserId={user?.id} />}
        {activeTab === "negocios" && <RankingNegocios filters={filters} currentUserId={user?.id} />}
        {activeTab === "oferta_ativa" && <RankingOfertaAtiva filters={filters} currentUserId={user?.id} />}
      </motion.div>
    </div>
  );
}
