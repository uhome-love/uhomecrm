import { useState } from "react";
import { Trophy, Phone, DollarSign, ClipboardList, Star, Zap, Gamepad2 } from "lucide-react";
import RankingOfertaAtivaTab from "@/components/ranking/RankingOfertaAtivaTab";
import RankingVGVTab from "@/components/ranking/RankingVGVTab";
import RankingGestaoLeadsTab from "@/components/ranking/RankingGestaoLeadsTab";
import RankingGeralTab from "@/components/ranking/RankingGeralTab";
import RankingEficienciaTab from "@/components/ranking/RankingEficienciaTab";
import RankingExplanation from "@/components/ranking/RankingExplanation";
import RankingStreaksBadges from "@/components/ranking/RankingStreaksBadges";
import { motion } from "framer-motion";

type Period = "hoje" | "semana" | "mes" | "trimestre";

const periodLabels: Record<Period, string> = {
  hoje: "Hoje",
  semana: "Semana",
  mes: "Mês",
  trimestre: "Trimestre",
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

  const tabs = [
    { key: "geral" as const, label: "Geral", icon: Star, color: "text-amber-500", activeBg: "bg-amber-500" },
    { key: "oferta-ativa" as const, label: "Prospecção", icon: Phone, color: "text-blue-600", activeBg: "bg-blue-600" },
    { key: "gestao" as const, label: "Gestão", icon: ClipboardList, color: "text-purple-600", activeBg: "bg-purple-600" },
    { key: "vgv" as const, label: "Vendas", icon: DollarSign, color: "text-emerald-600", activeBg: "bg-emerald-600" },
    { key: "eficiencia" as const, label: "Eficiência", icon: Zap, color: "text-amber-600", activeBg: "bg-amber-600" },
  ];

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg">
            <Gamepad2 className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-foreground">
              Arena de Performance
            </h1>
            <p className="text-xs text-muted-foreground">
              Seu desempenho em 4 pilares · Entenda, evolua, conquiste
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
          {(Object.entries(periodLabels) as [Period, string][]).map(([key, label]) => (
            <button
              key={key}
              className={`text-xs px-3 py-1.5 rounded-md font-medium transition-all ${
                period === key
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setPeriod(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

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
        key={activeTab + period}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        {activeTab === "geral" && <RankingGeralTab period={period} />}
        {activeTab === "oferta-ativa" && <RankingOfertaAtivaTab period={period === "trimestre" ? "mes" : period} />}
        {activeTab === "vgv" && <RankingVGVTab period={period === "trimestre" ? "mes" : period} />}
        {activeTab === "gestao" && <RankingGestaoLeadsTab period={period === "trimestre" ? "mes" : period} />}
        {activeTab === "eficiencia" && <RankingEficienciaTab period={period} />}
      </motion.div>
    </div>
  );
}
