import { useState } from "react";
import { Phone } from "lucide-react";
import ImportListPanel from "@/components/oferta-ativa/ImportListPanel";
import CampaignManager from "@/components/oferta-ativa/CampaignManager";
import TemplateManager from "@/components/oferta-ativa/TemplateManager";
import PerformanceLivePanel from "@/components/oferta-ativa/PerformanceLivePanel";
import RankingOfertaAtiva from "@/components/oferta-ativa/RankingOfertaAtiva";
import OAObservabilityPanel from "@/components/oferta-ativa/OAObservabilityPanel";
import { useUserRole } from "@/hooks/useUserRole";
import { Navigate } from "react-router-dom";
import { PageHeader } from "@/components/ui/PageHeader";

const ADMIN_TABS = [
  { label: "Live",       value: "live"      },
  { label: "Ranking",    value: "ranking"   },
  { label: "Radar",      value: "radar"     },
  { label: "Importar",   value: "importar"  },
  { label: "Campanhas",  value: "campanhas" },
  { label: "Templates",  value: "templates" },
];

const GESTOR_TABS = [
  { label: "Live",    value: "live"    },
  { label: "Ranking", value: "ranking" },
];

export default function OfertaAtiva() {
  const { isAdmin, isGestor, isCorretor } = useUserRole();
  const [activeTab, setActiveTab] = useState("live");

  if (isCorretor && !isGestor && !isAdmin) {
    return <Navigate to="/corretor" replace />;
  }

  // Gestor only sees Live + Ranking
  if (!isAdmin) {
    return (
      <div className="bg-[#f7f7f8] dark:bg-[#0f0f12] p-6 -m-6 min-h-full space-y-4">
        <PageHeader
          title="Oferta ativa"
          subtitle="Acompanhe a performance dos seus corretores em tempo real"
          icon={<Phone size={18} strokeWidth={1.5} />}
          tabs={GESTOR_TABS}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
        {activeTab === "live" && <PerformanceLivePanel teamOnly />}
        {activeTab === "ranking" && <RankingOfertaAtiva />}
      </div>
    );
  }

  return (
    <div className="bg-[#f7f7f8] dark:bg-[#0f0f12] p-6 -m-6 min-h-full space-y-4">
      <PageHeader
        title="Oferta ativa"
        subtitle="Importação de listas, campanhas e templates de scripts"
        icon={<Phone size={18} strokeWidth={1.5} />}
        tabs={ADMIN_TABS}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {activeTab === "live" && <PerformanceLivePanel />}
      {activeTab === "ranking" && <RankingOfertaAtiva />}
      {activeTab === "radar" && <OAObservabilityPanel />}
      {activeTab === "importar" && <ImportListPanel />}
      {activeTab === "campanhas" && <CampaignManager />}
      {activeTab === "templates" && <TemplateManager />}
    </div>
  );
}