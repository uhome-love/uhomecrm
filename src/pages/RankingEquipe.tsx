import { useState } from "react";
import { Trophy, Phone, DollarSign, ClipboardList, Star, Zap } from "lucide-react";
import RankingOfertaAtivaTab from "@/components/ranking/RankingOfertaAtivaTab";
import RankingVGVTab from "@/components/ranking/RankingVGVTab";
import RankingGestaoLeadsTab from "@/components/ranking/RankingGestaoLeadsTab";
import RankingGeralTab from "@/components/ranking/RankingGeralTab";
import RankingEficienciaTab from "@/components/ranking/RankingEficienciaTab";
import RankingExplanation from "@/components/ranking/RankingExplanation";
import RankingStreaksBadges from "@/components/ranking/RankingStreaksBadges";

type Period = "hoje" | "semana" | "mes" | "trimestre";

const periodLabels: Record<Period, string> = {
  hoje: "Hoje",
  semana: "Semana",
  mes: "Mês",
  trimestre: "Trimestre",
};

const explanations = {
  "oferta-ativa": {
    titulo: "Como funciona o Ranking de Prospecção?",
    descricao: "Avalia o nível de atividade na geração de oportunidades (Peso: 20% no Ranking Geral)",
    corDestaque: "text-blue-600",
    criterios: [
      { label: "Ligações Realizadas", desc: "Cada tentativa de contato telefônico na Arena de Ligação conta como atividade de prospecção." },
      { label: "Leads Aproveitados", desc: "Leads que demonstraram interesse durante a ligação (agendou visita, pediu proposta, etc)." },
      { label: "Taxa de Conversão", desc: "Percentual de aproveitamentos sobre total de ligações — mede a qualidade da abordagem." },
      { label: "Pontuação", desc: "Score baseado em volume de ligações + aproveitamentos + taxa de conversão. Estimula movimento no topo do funil." },
    ],
  },
  gestao: {
    titulo: "Como funciona o Ranking de Gestão de Leads?",
    descricao: "Avalia a qualidade do atendimento e evolução do lead no funil (Peso: 30% no Ranking Geral)",
    corDestaque: "text-purple-600",
    criterios: [
      { label: "Contato Iniciado", peso: "5 pts", desc: "Lead avançou para a fase 'Contato Iniciado' no pipeline. Mostra proatividade no primeiro contato." },
      { label: "Qualificação", peso: "10 pts", desc: "Lead foi qualificado — corretor validou interesse e perfil do lead." },
      { label: "Visita Marcada", peso: "30 pts", desc: "Lead evoluiu para uma visita agendada — indicador forte de avanço no funil." },
      { label: "Visita Realizada", peso: "50 pts", desc: "Visita efetivamente realizada — confirmação de engajamento do lead." },
      { label: "Proposta / Negociação", peso: "80 pts", desc: "Lead chegou à fase de proposta ou negociação — estágio avançado de conversão." },
      { label: "Cálculo", desc: "Total = (Contatos × 5) + (Qualificados × 10) + (V. Marcadas × 30) + (V. Realizadas × 50) + (Propostas × 80). Quem mais evolui leads no funil, mais pontua." },
    ],
  },
  vgv: {
    titulo: "Como funciona o Ranking de Vendas (VGV)?",
    descricao: "O ranking mais importante — mede resultado final em vendas (Peso: 40% no Ranking Geral)",
    corDestaque: "text-emerald-600",
    criterios: [
      { label: "VGV Assinado", desc: "Volume Geral de Vendas efetivamente assinado — o fator mais determinante do ranking." },
      { label: "Propostas", desc: "Número de propostas geradas no período — mostra capacidade de gerar negócios." },
      { label: "VGV em Proposta", desc: "Volume total de negócios em fase de proposta/negociação — potencial de fechamento." },
      { label: "Ordenação", desc: "O ranking é ordenado pelo VGV Assinado. Quem vendeu mais, lidera." },
    ],
  },
  eficiencia: {
    titulo: "Como funciona o Ranking de Eficiência?",
    descricao: "Avalia a eficiência de conversão ao longo do funil — premia qualidade, não volume (Peso: 10% no Ranking Geral)",
    corDestaque: "text-amber-600",
    criterios: [
      { label: "Taxa Ligação → Visita", peso: "40%", desc: "Percentual de visitas realizadas sobre total de ligações. Mede capacidade de transformar contatos em visitas." },
      { label: "Taxa Visita → Negócio", peso: "60%", desc: "Percentual de propostas e vendas sobre total de visitas realizadas. Mede poder de conversão presencial." },
      { label: "Cálculo", desc: "Score = (Taxa Lig→Visita × 40%) + (Taxa Visita→Negócio × 60%), normalizado em relação ao melhor do time." },
    ],
  },
};

type TabKey = "geral" | "oferta-ativa" | "gestao" | "vgv" | "eficiencia";

export default function RankingEquipe() {
  const [period, setPeriod] = useState<Period>("hoje");
  const [activeTab, setActiveTab] = useState<TabKey>("geral");

  const tabs = [
    { key: "geral" as const, label: "Geral", icon: Star, color: "text-amber-500" },
    { key: "oferta-ativa" as const, label: "Prospecção", icon: Phone, color: "text-blue-600" },
    { key: "gestao" as const, label: "Gestão de Leads", icon: ClipboardList, color: "text-purple-600" },
    { key: "vgv" as const, label: "Vendas (VGV)", icon: DollarSign, color: "text-emerald-600" },
    { key: "eficiencia" as const, label: "Eficiência", icon: Zap, color: "text-amber-600" },
  ];

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black text-foreground flex items-center gap-2">
            <Trophy className="h-7 w-7 text-amber-500" /> 🏆 Rankings
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Compare sua performance com o time em 4 pilares
          </p>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {(Object.entries(periodLabels) as [Period, string][]).map(([key, label]) => (
            <button
              key={key}
              className={`text-sm px-3 py-1.5 rounded-lg font-medium transition-colors border ${
                period === key
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-transparent text-muted-foreground border-border hover:bg-accent"
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

      {/* Category Tabs */}
      <div className="flex gap-0 overflow-x-auto" style={{ borderBottom: "2px solid hsl(var(--border))" }}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm transition-colors relative whitespace-nowrap ${
              activeTab === tab.key
                ? `${tab.color} font-semibold`
                : "text-muted-foreground hover:text-foreground"
            }`}
            style={{
              borderBottom: activeTab === tab.key ? "3px solid currentColor" : "3px solid transparent",
              marginBottom: -2,
            }}
            onClick={() => setActiveTab(tab.key)}
          >
            <tab.icon className="h-4 w-4" /> {tab.label}
          </button>
        ))}
      </div>

      {/* Explanation for specific tabs */}
      {activeTab === "oferta-ativa" && <RankingExplanation {...explanations["oferta-ativa"]} />}
      {activeTab === "gestao" && <RankingExplanation {...explanations.gestao} />}
      {activeTab === "vgv" && <RankingExplanation {...explanations.vgv} />}
      {activeTab === "eficiencia" && <RankingExplanation {...explanations.eficiencia} />}

      {/* Tab Content */}
      {activeTab === "geral" && <RankingGeralTab period={period} />}
      {activeTab === "oferta-ativa" && <RankingOfertaAtivaTab period={period === "trimestre" ? "mes" : period} />}
      {activeTab === "vgv" && <RankingVGVTab period={period === "trimestre" ? "mes" : period} />}
      {activeTab === "gestao" && <RankingGestaoLeadsTab period={period === "trimestre" ? "mes" : period} />}
      {activeTab === "eficiencia" && <RankingEficienciaTab period={period} />}
    </div>
  );
}
