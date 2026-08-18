import { useState } from "react";
import { Phone, Settings2, BarChart3, Layers, Rocket, Database, Archive } from "lucide-react";
import { Link, Navigate } from "react-router-dom";
import TemplateManager from "@/components/oferta-ativa/TemplateManager";
import PerformanceLivePanel from "@/components/oferta-ativa/PerformanceLivePanel";
import RankingOfertaAtiva from "@/components/oferta-ativa/RankingOfertaAtiva";
import OAObservabilityPanel from "@/components/oferta-ativa/OAObservabilityPanel";
import ReservadosPanel from "@/components/oferta-ativa/ReservadosPanel";
import MeusResultadosPanel from "@/components/oferta-ativa/MeusResultadosPanel";
import { CampanhasPanel } from "@/components/leads-base/CampanhasPanel";
import { CriarCampanhaDialog } from "@/components/leads-base/CriarCampanhaDialog";
import { Button } from "@/components/ui/button";
import { useUserRole } from "@/hooks/useUserRole";
import { PageHeader } from "@/components/ui/PageHeader";
import type { BaseLeadsFiltro } from "@/hooks/useBaseLeads";

const TABS = [
  { label: "Campanhas ativas", value: "campanhas"  },
  { label: "Ao vivo",          value: "live"       },
  { label: "Ranking",          value: "ranking"    },
  { label: "Encerradas",       value: "encerradas" },
  { label: "Reservados",       value: "reservados" },
  { label: "Meus resultados",  value: "resultados" },
  { label: "Configurações",    value: "config"     },
];

const CONFIG_SUB_TABS = [
  { label: "Radar",     value: "radar",     icon: <Layers size={14} /> },
  { label: "Templates", value: "templates", icon: <Settings2 size={14} /> },
];

const FILTRO_VAZIO: BaseLeadsFiltro = {
  empreendimento_canonico_id: null,
  ano_min: null,
  ano_max: null,
  situacao: null,
  com_telefone: true,
  nunca_trabalhado: true,
  busca: null,
};


export default function OfertaAtiva() {
  const { isAdmin, isGestor, isCorretor, isDiretor } = useUserRole();
  const [activeTab, setActiveTab] = useState("campanhas");
  const [configSub, setConfigSub] = useState("radar");
  const [criarOpen, setCriarOpen] = useState(false);

  if (isCorretor && !isGestor && !isAdmin) {
    return <Navigate to="/corretor" replace />;
  }

  const tabs = isAdmin || isGestor ? TABS : TABS.filter((t) => t.value !== "config");

  return (
    <div className="bg-[#f0f0f5] dark:bg-background p-6 -m-6 min-h-full space-y-4">
      <PageHeader
        title="Oferta ativa"
        subtitle="Campanhas temporárias criadas a partir da Base Única — operação, ao vivo e resultado"
        icon={<Phone size={18} strokeWidth={1.5} />}
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {activeTab === "campanhas" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            {(isAdmin || isDiretor) ? (
              <Button asChild variant="outline" size="sm" className="gap-1.5">
                <Link to="/base-leads">
                  <Database size={14} /> Ver Base Única
                </Link>
              </Button>
            ) : <span />}
            {(isAdmin || isGestor) && (
              <Button size="sm" className="gap-1.5" onClick={() => setCriarOpen(true)}>
                <Rocket size={14} /> Nova campanha
              </Button>
            )}
          </div>
          <CampanhasPanel escopo="ativas" />
        </div>
      )}

      {activeTab === "live"       && <PerformanceLivePanel teamOnly={!isAdmin} />}
      {activeTab === "ranking"    && <RankingOfertaAtiva />}

      {activeTab === "encerradas" && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Archive size={14} /> Histórico de campanhas encerradas
          </div>
          <CampanhasPanel escopo="encerradas" />
        </div>
      )}

      {activeTab === "reservados" && <ReservadosPanel />}
      {activeTab === "resultados" && <MeusResultadosPanel />}

      {activeTab === "config" && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {CONFIG_SUB_TABS.map((t) => {
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

          {configSub === "radar"     && isAdmin && <OAObservabilityPanel />}
          {configSub === "templates" && isAdmin && <TemplateManager />}
          {!isAdmin && (
            <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
              <BarChart3 className="mx-auto mb-2 h-5 w-5" />
              Configurações disponíveis apenas para administradores.
            </div>
          )}
        </div>
      )}

      <CriarCampanhaDialog open={criarOpen} onOpenChange={setCriarOpen} filtroInicial={FILTRO_VAZIO} />
    </div>
  );
}
