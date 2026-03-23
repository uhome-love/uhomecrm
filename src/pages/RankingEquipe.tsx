import { useState, useMemo } from "react";
import { Trophy, Phone, DollarSign, ClipboardList, Star, Zap, Gamepad2, ChevronLeft, ChevronRight, History, CalendarDays } from "lucide-react";
import RankingOfertaAtivaTab from "@/components/ranking/RankingOfertaAtivaTab";
import RankingVGVTab from "@/components/ranking/RankingVGVTab";
import RankingGestaoLeadsTab from "@/components/ranking/RankingGestaoLeadsTab";
import RankingGeralTab from "@/components/ranking/RankingGeralTab";
import RankingEficienciaTab from "@/components/ranking/RankingEficienciaTab";
import RankingExplanation from "@/components/ranking/RankingExplanation";
import RankingStreaksBadges from "@/components/ranking/RankingStreaksBadges";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { PageHeader } from "@/components/ui/PageHeader";
import { format, startOfWeek, endOfWeek, addWeeks, startOfMonth, endOfMonth, addMonths, isSameWeek, isSameMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

type Period = "hoje" | "semana" | "mes" | "personalizado";

const periodLabels: Record<Period, string> = {
  hoje: "Hoje",
  semana: "Semana",
  mes: "Mês",
  personalizado: "Personalizado",
};

const explanations = {
  "oferta-ativa": {
    titulo: "Ranking de Prospecção",
    descricao: "Quem mais prospecta, mais oportunidades gera (Peso: 20%)",
    corDestaque: "text-blue-600",
    criterios: [
      { label: "Ligações", desc: "Cada tentativa de contato telefônico conta como atividade de prospecção." },
      { label: "Aproveitados", desc: "Leads que demonstraram interesse durante a ligação." },
      { label: "Taxa", desc: "% de aproveitamentos sobre total de ligações — qualidade da abordagem." },
    ],
  },
  gestao: {
    titulo: "Ranking de Gestão de Leads",
    descricao: "Quem mais evolui leads no funil, mais pontua (Peso: 30%)",
    corDestaque: "text-purple-600",
    criterios: [
      { label: "Contato (×5pts)", desc: "Lead avançou para 'Contato Iniciado'." },
      { label: "Qualificação (×10pts)", desc: "Lead qualificado — interesse e perfil validados." },
      { label: "Visita Marcada (×30pts)", desc: "Visita agendada com o lead." },
      { label: "Visita Realizada (×50pts)", desc: "Visita efetivamente realizada." },
    ],
  },
  vgv: {
    titulo: "Ranking de Vendas (VGV)",
    descricao: "O ranking mais importante — quem vende mais, lidera (Peso: 40%)",
    corDestaque: "text-emerald-600",
    criterios: [
      { label: "VGV Assinado", desc: "Volume efetivamente assinado — o fator decisivo." },
      { label: "Propostas", desc: "Número de propostas geradas no período." },
    ],
  },
  eficiencia: {
    titulo: "Ranking de Eficiência",
    descricao: "Premia qualidade de conversão, não volume (Peso: 10%)",
    corDestaque: "text-amber-600",
    criterios: [
      { label: "Lead → Visita (40%)", desc: "% de visitas sobre ligações." },
      { label: "Visita → Negócio (60%)", desc: "% de propostas/vendas sobre visitas." },
    ],
  },
};

type TabKey = "geral" | "oferta-ativa" | "gestao" | "vgv" | "eficiencia";

export default function RankingEquipe() {
  const [period, setPeriod] = useState<Period>("hoje");
  const [activeTab, setActiveTab] = useState<TabKey>("geral");
  const [offset, setOffset] = useState(0);
  const [customRange, setCustomRange] = useState<{ from: Date | undefined; to: Date | undefined }>({ from: undefined, to: undefined });
  const [calendarOpen, setCalendarOpen] = useState(false);

  const now = new Date();

  const dateRange = useMemo<{ start: string; end: string } | undefined>(() => {
    if (period === "personalizado") {
      if (customRange.from && customRange.to) {
        return { start: format(customRange.from, "yyyy-MM-dd"), end: format(customRange.to, "yyyy-MM-dd") };
      }
      return undefined;
    }
    if (period === "hoje") return undefined;
    if (offset === 0) return undefined;

    if (period === "semana") {
      const target = addWeeks(now, offset);
      const s = startOfWeek(target, { weekStartsOn: 1 });
      const e = endOfWeek(target, { weekStartsOn: 1 });
      return { start: format(s, "yyyy-MM-dd"), end: format(e, "yyyy-MM-dd") };
    }
    if (period === "mes") {
      const target = addMonths(now, offset);
      const s = startOfMonth(target);
      const e = endOfMonth(target);
      return { start: format(s, "yyyy-MM-dd"), end: format(e, "yyyy-MM-dd") };
    }
    return undefined;
  }, [period, offset, customRange]);

  const periodLabel = useMemo(() => {
    if (period === "personalizado" && customRange.from && customRange.to) {
      return `${format(customRange.from, "dd/MM/yyyy")} - ${format(customRange.to, "dd/MM/yyyy")}`;
    }
    if (period === "semana") {
      const target = addWeeks(now, offset);
      const s = startOfWeek(target, { weekStartsOn: 1 });
      const e = endOfWeek(target, { weekStartsOn: 1 });
      const isCurrent = isSameWeek(target, now, { weekStartsOn: 1 });
      const label = `${format(s, "dd/MM")} - ${format(e, "dd/MM")}`;
      return isCurrent ? `Semana Atual · ${label}` : label;
    }
    if (period === "mes") {
      const target = addMonths(now, offset);
      const isCurrent = isSameMonth(target, now);
      const label = format(target, "MMMM yyyy", { locale: ptBR });
      const capitalized = label.charAt(0).toUpperCase() + label.slice(1);
      return isCurrent ? `Mês Atual · ${capitalized}` : capitalized;
    }
    return null;
  }, [period, offset, customRange]);

  const canNavigate = period === "semana" || period === "mes";
  const isCurrentPeriod = offset === 0;

  const handlePeriodChange = (key: Period) => {
    setPeriod(key);
    setOffset(0);
    if (key === "personalizado") {
      setCalendarOpen(true);
    }
  };

  const effectivePeriod = period === "personalizado" ? "mes" : period;

  const tabs = [
    { key: "geral" as const, label: "Geral", icon: Star, color: "text-amber-500", activeBg: "bg-amber-500" },
    { key: "oferta-ativa" as const, label: "Prospecção", icon: Phone, color: "text-blue-600", activeBg: "bg-blue-600" },
    { key: "gestao" as const, label: "Gestão", icon: ClipboardList, color: "text-purple-600", activeBg: "bg-purple-600" },
    { key: "vgv" as const, label: "Vendas", icon: DollarSign, color: "text-emerald-600", activeBg: "bg-emerald-600" },
    { key: "eficiencia" as const, label: "Eficiência", icon: Zap, color: "text-amber-600", activeBg: "bg-amber-600" },
  ];

  return (
    <div className="bg-[#f7f7f8] dark:bg-[#0f0f12] p-6 max-w-5xl mx-auto space-y-4 -m-6 min-h-full">
      <PageHeader
        title="Rankings"
        subtitle="Arena de performance · Entenda, evolua, conquiste"
        icon={<Star size={18} strokeWidth={1.5} />}
        tabs={[
          { label: "Hoje",    value: "hoje"   },
          { label: "Semana",  value: "semana" },
          { label: "Mês",     value: "mes"    },
          { label: "Personalizado", value: "personalizado" },
        ]}
        activeTab={period}
        onTabChange={(v) => handlePeriodChange(v as Period)}
      />

      {/* Week/Month Navigation */}
      {canNavigate && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setOffset(o => o - 1)}
            className="p-1.5 rounded-lg bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-medium text-foreground min-w-[200px] text-center">
            {periodLabel}
          </span>
          <button
            onClick={() => setOffset(o => Math.min(o + 1, 0))}
            disabled={isCurrentPeriod}
            className={`p-1.5 rounded-lg transition-colors ${
              isCurrentPeriod
                ? "text-muted-foreground/30 cursor-not-allowed"
                : "bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Custom range label */}
      {period === "personalizado" && periodLabel && (
        <div className="flex items-center justify-center">
          <span className="text-sm font-medium text-foreground bg-muted/50 px-4 py-1.5 rounded-lg">
            {periodLabel}
          </span>
        </div>
      )}

      {/* Streaks & Badges */}
      <RankingStreaksBadges />

      {/* Category Tabs - Pill style */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        {tabs.map(tab => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl transition-all whitespace-nowrap border ${
                isActive
                  ? `${tab.activeBg} text-white border-transparent shadow-md`
                  : "bg-card text-muted-foreground border-border hover:bg-accent hover:text-foreground"
              }`}
              onClick={() => setActiveTab(tab.key)}
            >
              <tab.icon className="h-3.5 w-3.5" /> {tab.label}
            </button>
          );
        })}
      </div>

      {/* Explanation for specific tabs */}
      {activeTab === "oferta-ativa" && <RankingExplanation {...explanations["oferta-ativa"]} />}
      {activeTab === "gestao" && <RankingExplanation {...explanations.gestao} />}
      {activeTab === "vgv" && <RankingExplanation {...explanations.vgv} />}
      {activeTab === "eficiencia" && <RankingExplanation {...explanations.eficiencia} />}

      {/* Tab Content */}
      <motion.div
        key={activeTab + period + offset + (customRange.from?.toISOString() || "") + (customRange.to?.toISOString() || "")}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        {activeTab === "geral" && <RankingGeralTab period={period} dateRange={dateRange} />}
        {activeTab === "oferta-ativa" && <RankingOfertaAtivaTab period={effectivePeriod} dateRange={dateRange} />}
        {activeTab === "vgv" && <RankingVGVTab period={effectivePeriod} dateRange={dateRange} />}
        {activeTab === "gestao" && <RankingGestaoLeadsTab period={effectivePeriod} dateRange={dateRange} />}
        {activeTab === "eficiencia" && <RankingEficienciaTab period={period} dateRange={dateRange} />}
      </motion.div>
    </div>
  );
}