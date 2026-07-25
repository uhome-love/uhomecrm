import { useState } from "react";
import { Phone, Settings2, Bookmark, BarChart3, Layers } from "lucide-react";
import ImportListPanel from "@/components/oferta-ativa/ImportListPanel";
import CampaignManager from "@/components/oferta-ativa/CampaignManager";
import TemplateManager from "@/components/oferta-ativa/TemplateManager";
import PerformanceLivePanel from "@/components/oferta-ativa/PerformanceLivePanel";
import RankingOfertaAtiva from "@/components/oferta-ativa/RankingOfertaAtiva";
import OAObservabilityPanel from "@/components/oferta-ativa/OAObservabilityPanel";
import BasesAtivasGrid from "@/components/oferta-ativa/BasesAtivasGrid";
import ReservadosPanel from "@/components/oferta-ativa/ReservadosPanel";
import MeusResultadosPanel from "@/components/oferta-ativa/MeusResultadosPanel";
import { useUserRole } from "@/hooks/useUserRole";
import { Navigate } from "react-router-dom";
import { PageHeader } from "@/components/ui/PageHeader";

const TABS = [
  { label: "Bases ativas",    value: "bases"       },
  { label: "Reservados",      value: "reservados"  },
  { label: "Meus resultados", value: "resultados"  },
  { label: "Configurações",   value: "config"      },
];

const CONFIG_SUB_TABS_ADMIN = [
  { label: "Live",       value: "live",      icon: <Phone size={14} /> },
  { label: "Ranking",    value: "ranking",   icon: <BarChart3 size={14} /> },
  { label: "Radar",      value: "radar",     icon: <Layers size={14} /> },
  { label: "Importar",   value: "importar",  icon: <Settings2 size={14} /> },
  { label: "Campanhas",  value: "campanhas", icon: <Settings2 size={14} /> },
  { label: "Templates",  value: "templates", icon: <Settings2 size={14} /> },
];

const CONFIG_SUB_TABS_GESTOR = [
  { label: "Live",    value: "live",    icon: <Phone size={14} /> },
  { label: "Ranking", value: "ranking", icon: <BarChart3 size={14} /> },
];

export default function OfertaAtiva() {
  const { isAdmin, isGestor, isCorretor } = useUserRole();
  const [activeTab, setActiveTab] = useState("bases");
  const [configSub, setConfigSub] = useState("live");

  if (isCorretor && !isGestor && !isAdmin) {
    return <Navigate to="/corretor" replace />;
  }

  const subTabs = isAdmin ? CONFIG_SUB_TABS_ADMIN : CONFIG_SUB_TABS_GESTOR;

  return (
    <div className="bg-[#f0f0f5] dark:bg-[#0e1525] p-6 -m-6 min-h-full space-y-4">
      <PageHeader
        title="Oferta ativa"
        subtitle="Bases inteligentes, reservados e desempenho da equipe"
        icon={<Phone size={18} strokeWidth={1.5} />}
        tabs={TABS}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {activeTab === "bases" && <BasesAtivasGrid />}

      {activeTab === "reservados" && <ReservadosPanel />}

      {activeTab === "resultados" && <MeusResultadosPanel />}

      {activeTab === "config" && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {subTabs.map((t) => {
              const active = configSub === t.value;
              return (
                <button
                  key={t.value}
                  onClick={() => setConfigSub(t.value)}
                  className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                    active
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card hover:bg-muted border-border text-muted-foreground"
                  }`}
                >
                  {t.icon}
                  {t.label}
                </button>
              );
            })}
          </div>

          {configSub === "live"       && <PerformanceLivePanel teamOnly={!isAdmin} />}
          {configSub === "ranking"    && <RankingOfertaAtiva />}
          {configSub === "radar"      && isAdmin && <OAObservabilityPanel />}
          {configSub === "importar"   && isAdmin && <ImportListPanel />}
          {configSub === "campanhas"  && isAdmin && <CampaignManager />}
          {configSub === "templates"  && isAdmin && <TemplateManager />}
        </div>
      )}
    </div>
  );
}

function ComingSoon({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-10 text-center space-y-2">
      <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
        {icon}
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-md mx-auto">{desc}</p>
    </div>
  );
}
