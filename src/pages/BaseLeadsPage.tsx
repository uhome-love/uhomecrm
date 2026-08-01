import { useState } from "react";
import { Database, Users, Rocket, ListChecks } from "lucide-react";
import { Navigate } from "react-router-dom";
import { PageHeader } from "@/components/ui/PageHeader";
import { useUserRole } from "@/hooks/useUserRole";
import { useBaseLeadsResumo } from "@/hooks/useBaseLeads";
import { BaseLeadsExplorer } from "@/components/leads-base/BaseLeadsExplorer";
import { CampanhasPanel } from "@/components/leads-base/CampanhasPanel";
import { FormMapReview } from "@/components/leads-base/FormMapReview";

const TABS = [
  { label: "Base de leads", value: "base" },
  { label: "Campanhas", value: "campanhas" },
  { label: "Revisão de produtos", value: "revisao" },
];

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-[22px] font-bold leading-tight">{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

export default function BaseLeadsPage() {
  const { isAdmin, isDiretor, isGestor } = useUserRole();
  const [tab, setTab] = useState("base");
  const { data: resumo } = useBaseLeadsResumo();

  if (!isAdmin && !isDiretor && !isGestor) return <Navigate to="/" replace />;

  const fmt = (n?: number) => (n ?? 0).toLocaleString("pt-BR");

  return (
    <div className="bg-[#f0f0f5] dark:bg-[#0e1525] p-6 -m-6 min-h-full space-y-4">
      <PageHeader
        title="Base Única de Leads"
        subtitle="Todo o histórico de leads da U.Home em um só lugar — e campanhas temporárias de Oferta Ativa"
        icon={<Database size={18} strokeWidth={1.5} />}
        tabs={TABS}
        activeTab={tab}
        onTabChange={setTab}
      />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Kpi label="Total na base" value={fmt(resumo?.total)} />
        <Kpi label="Inéditos" value={fmt(resumo?.inedito)} hint="Nunca tocados pelo CRM" />
        <Kpi label="Já na Oferta Ativa" value={fmt(resumo?.na_oferta_ativa)} />
        <Kpi label="Já no Pipeline" value={fmt(resumo?.no_pipeline)} />
        <Kpi label="Sem produto" value={fmt(resumo?.semProduto)} hint="Precisam de revisão" />
      </div>

      {tab === "base" && <BaseLeadsExplorer />}
      {tab === "campanhas" && <CampanhasPanel />}
      {tab === "revisao" && <FormMapReview />}
    </div>
  );
}
