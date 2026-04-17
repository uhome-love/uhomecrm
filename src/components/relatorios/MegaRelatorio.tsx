import { useEffect, useState, ReactNode } from "react";
import {
  TrendingUp,
  Users,
  GitMerge,
  Building2,
  MapPin,
  Activity,
  Calendar,
  CheckSquare,
  Briefcase,
  ChevronDown,
} from "lucide-react";
import RelatorioVendas from "./RelatorioVendas";
import RelatorioLeads from "./RelatorioLeads";
import RelatorioConversao from "./RelatorioConversao";
import RelatorioEmpreendimentos from "./RelatorioEmpreendimentos";
import RelatorioOrigem from "./RelatorioOrigem";
import RelatorioInteracao from "./RelatorioInteracao";
import RelatorioVisitas from "./RelatorioVisitas";
import RelatorioTarefas from "./RelatorioTarefas";
import RelatorioNegocios from "./RelatorioNegocios";

interface Filters {
  periodo: string;
  dataInicio?: string;
  dataFim?: string;
  equipe: string;
  corretor: string;
  segmento: string;
}

interface MegaRelatorioProps {
  filters: Filters;
  userRole: "admin" | "gestor" | "corretor";
}

interface SectionDef {
  title: string;
  icon: ReactNode;
  render: () => ReactNode;
}

interface MegaSectionProps {
  title: string;
  icon: ReactNode;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}

function MegaSection({ title, icon, open, onToggle, children }: MegaSectionProps) {
  return (
    <div
      style={{
        backgroundColor: "#fff",
        borderRadius: 10,
        border: "0.5px solid #e5e7eb",
        overflow: "hidden",
      }}
    >
      <div
        onClick={onToggle}
        style={{
          padding: "16px 20px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          cursor: "pointer",
          userSelect: "none",
          background: open ? "#fafafa" : "#fff",
          borderBottom: open ? "0.5px solid #e5e7eb" : "none",
        }}
      >
        <span style={{ display: "inline-flex", color: "#4F46E5" }}>{icon}</span>
        <span style={{ fontSize: 14, fontWeight: 500, color: "#111827" }}>{title}</span>
        <div style={{ marginLeft: "auto" }}>
          <ChevronDown
            size={16}
            strokeWidth={1.5}
            color="#6b7280"
            style={{
              transform: open ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.2s ease",
            }}
          />
        </div>
      </div>
      {open && <div style={{ padding: 20 }}>{children}</div>}
    </div>
  );
}

function formatPeriodo(filters: Filters): string {
  if (filters.periodo === "hoje") return "Hoje";
  if (filters.periodo === "semana") return "Esta semana";
  if (filters.periodo === "mes") return "Este mês";
  if (filters.periodo === "custom" && filters.dataInicio && filters.dataFim) {
    return `${filters.dataInicio} a ${filters.dataFim}`;
  }
  return "Período personalizado";
}

export default function MegaRelatorio({ filters, userRole }: MegaRelatorioProps) {
  const sections: SectionDef[] = [
    {
      title: "Vendas Realizadas",
      icon: <TrendingUp size={16} strokeWidth={1.5} />,
      render: () => <RelatorioVendas filters={filters} userRole={userRole} />,
    },
    {
      title: "Leads",
      icon: <Users size={16} strokeWidth={1.5} />,
      render: () => <RelatorioLeads filters={filters} userRole={userRole} />,
    },
    {
      title: "Conversão",
      icon: <GitMerge size={16} strokeWidth={1.5} />,
      render: () => <RelatorioConversao filters={filters} userRole={userRole} />,
    },
    {
      title: "Empreendimentos",
      icon: <Building2 size={16} strokeWidth={1.5} />,
      render: () => <RelatorioEmpreendimentos filters={filters} userRole={userRole} />,
    },
    {
      title: "Origem dos Leads",
      icon: <MapPin size={16} strokeWidth={1.5} />,
      render: () => <RelatorioOrigem filters={filters} userRole={userRole} />,
    },
    {
      title: "Interação com Sistema",
      icon: <Activity size={16} strokeWidth={1.5} />,
      render: () => <RelatorioInteracao filters={filters} userRole={userRole} />,
    },
    {
      title: "Visitas",
      icon: <Calendar size={16} strokeWidth={1.5} />,
      render: () => <RelatorioVisitas filters={filters} userRole={userRole} />,
    },
    {
      title: "Tarefas",
      icon: <CheckSquare size={16} strokeWidth={1.5} />,
      render: () => <RelatorioTarefas filters={filters} userRole={userRole} />,
    },
    {
      title: "Negócios",
      icon: <Briefcase size={16} strokeWidth={1.5} />,
      render: () => <RelatorioNegocios filters={filters} userRole={userRole} />,
    },
  ];

  const [openSections, setOpenSections] = useState<boolean[]>(
    sections.map((_, i) => i === 0)
  );

  useEffect(() => {
    const expandHandler = () => setOpenSections(sections.map(() => true));
    document.addEventListener("mega-expand-all", expandHandler);
    return () => document.removeEventListener("mega-expand-all", expandHandler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const allOpen = openSections.every(Boolean);

  const toggleAll = () => {
    setOpenSections(sections.map(() => !allOpen));
  };

  const toggleOne = (idx: number) => {
    setOpenSections((prev) => prev.map((v, i) => (i === idx ? !v : v)));
  };

  const equipeLabel = filters.equipe ? `Equipe ${filters.equipe}` : "Todas as equipes";

  return (
    <div id="mega-report-content" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div
        style={{
          backgroundColor: "#fff",
          padding: 20,
          borderRadius: 10,
          border: "0.5px solid #e5e7eb",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 500, color: "#111827" }}>
            ✦ Mega Relatório
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ fontSize: 12, color: "#6b7280" }}>
              {formatPeriodo(filters)} · {equipeLabel}
            </div>
            <button
              onClick={toggleAll}
              style={{
                border: "0.5px solid #e5e7eb",
                borderRadius: 8,
                padding: "5px 12px",
                fontSize: 12,
                color: "#6b7280",
                background: "#fff",
                cursor: "pointer",
              }}
            >
              {allOpen ? "Recolher tudo" : "Expandir tudo"}
            </button>
          </div>
        </div>
        <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 6 }}>
          Visão completa de todas as frentes do CRM
        </div>
      </div>

      {sections.map((s, idx) => (
        <MegaSection
          key={s.title}
          title={s.title}
          icon={s.icon}
          open={openSections[idx]}
          onToggle={() => toggleOne(idx)}
        >
          {openSections[idx] && s.render()}
        </MegaSection>
      ))}
    </div>
  );
}
