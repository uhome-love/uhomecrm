import { useState } from "react";
import { Trophy, Phone, DollarSign, ClipboardList } from "lucide-react";
import RankingOfertaAtivaTab from "@/components/ranking/RankingOfertaAtivaTab";
import RankingVGVTab from "@/components/ranking/RankingVGVTab";
import RankingGestaoLeadsTab from "@/components/ranking/RankingGestaoLeadsTab";

type Period = "hoje" | "semana" | "mes";

const periodLabels: Record<Period, string> = {
  hoje: "Hoje",
  semana: "Esta Semana",
  mes: "Este Mês",
};

export default function RankingEquipe() {
  const [period, setPeriod] = useState<Period>("hoje");
  const [activeTab, setActiveTab] = useState<"oferta-ativa" | "vgv" | "gestao">("oferta-ativa");

  const tabs = [
    { key: "oferta-ativa" as const, label: "Oferta Ativa", icon: Phone },
    { key: "vgv" as const, label: "VGV", icon: DollarSign },
    { key: "gestao" as const, label: "Gestão de Leads", icon: ClipboardList },
  ];

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black text-gray-900 flex items-center gap-2">
            <Trophy className="h-7 w-7 text-amber-500" /> 🏆 Rankings
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Compare sua performance com o time em 3 categorias
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(Object.entries(periodLabels) as [Period, string][]).map(([key, label]) => (
            <button
              key={key}
              className="text-sm px-4 py-1.5 rounded-lg font-medium transition-colors"
              style={{
                background: period === key ? "#2563EB" : "transparent",
                color: period === key ? "#fff" : "#4B5563",
                border: period === key ? "1px solid #2563EB" : "1px solid #E5E7EB",
              }}
              onMouseEnter={e => { if (period !== key) e.currentTarget.style.background = "#F9FAFB"; }}
              onMouseLeave={e => { if (period !== key) e.currentTarget.style.background = "transparent"; }}
              onClick={() => setPeriod(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex gap-0" style={{ borderBottom: "2px solid #F3F4F6" }}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            className="flex items-center gap-1.5 px-5 py-2.5 text-sm transition-colors relative"
            style={{
              color: activeTab === tab.key ? "#2563EB" : "#9CA3AF",
              fontWeight: activeTab === tab.key ? 600 : 400,
              borderBottom: activeTab === tab.key ? "3px solid #3B82F6" : "3px solid transparent",
              marginBottom: -2,
            }}
            onMouseEnter={e => { if (activeTab !== tab.key) e.currentTarget.style.color = "#4B5563"; }}
            onMouseLeave={e => { if (activeTab !== tab.key) e.currentTarget.style.color = "#9CA3AF"; }}
            onClick={() => setActiveTab(tab.key)}
          >
            <tab.icon className="h-4 w-4" /> {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "oferta-ativa" && <RankingOfertaAtivaTab period={period} />}
      {activeTab === "vgv" && <RankingVGVTab period={period} />}
      {activeTab === "gestao" && <RankingGestaoLeadsTab period={period} />}
    </div>
  );
}
