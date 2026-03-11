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
    descricao: "Avalia o nível de atividade na geração de oportunidades (Peso: 20%)",
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
    descricao: "Avalia a qualidade do atendimento e evolução do funil (Peso: 30%)",
    corDestaque: "text-purple-600",
    criterios: [
      { label: "Tentativas de Contato", desc: "Número total de tentativas registradas no pipeline — demonstra proatividade." },
      { label: "Leads que Responderam", desc: "Quantos leads efetivamente interagiram após o contato do corretor." },
      { label: "Visitas Marcadas", desc: "Leads que evoluíram para uma visita agendada — indicador de avanço no funil." },
      { label: "Visitas Realizadas", desc: "Visitas efetivamente realizadas — confirmação de engajamento do lead." },
      { label: "Propostas Enviadas", desc: "Quantas propostas foram geradas — estágio avançado de negociação." },
      { label: "Pontuação", desc: "Soma ponderada: tentativas(1pt) + responderam(3pts) + visitas(5pts) + propostas(8pts). Premia quem trabalha bem o funil." },
    ],
  },
  vgv: {
    titulo: "Como funciona o Ranking de Vendas (VGV)?",
    descricao: "O ranking mais importante — mede resultado final em vendas (Peso: 40%)",
    corDestaque: "text-emerald-600",
    criterios: [
      { label: "VGV Assinado", desc: "Volume Geral de Vendas efetivamente assinado — o fator mais determinante." },
      { label: "Negócios Fechados", desc: "Número de negócios levados até a assinatura no período." },
      { label: "Pontuação", desc: "Proporcional ao volume vendido. Quem vende mais, pontua mais. Garante que vendas são o fator mais relevante." },
    ],
  },
  eficiencia: {
    titulo: "Como funciona o Ranking de Eficiência?",
    descricao: "Avalia a eficiência ao longo do funil — premia qualidade, não volume (Peso: 10%)",
    corDestaque: "text-amber-600",
    criterios: [
      { label: "Taxa Lead → Visita", desc: "Percentual de leads que evoluem para visita agendada. Mede capacidade de engajar." },
      { label: "Taxa Visita → Negócio", desc: "Percentual de visitas que geram propostas ou vendas. Mede poder de conversão." },
      { label: "Pontuação", desc: "Corretores com maior eficiência recebem bônus. Premia qualidade de conversão, não apenas volume." },
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
