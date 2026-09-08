const TABS = [
  { key: "vendas", label: "Vendas" },
  { key: "leads", label: "Leads" },
  { key: "negocios", label: "Negócios" },
  { key: "oferta-ativa", label: "Oferta Ativa" },
  { key: "conversao", label: "Conversão" },
  { key: "empreendimentos", label: "Empreend." },
  { key: "origem", label: "Origem" },
  { key: "interacao", label: "Interação" },
  { key: "visitas", label: "Visitas" },
  { key: "tarefas", label: "Tarefas" },
  { key: "mega", label: "✦ Mega" },
];

interface ReportTabsProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export default function ReportTabs({ activeTab, onTabChange }: ReportTabsProps) {
  return (
    <div
      style={{
        backgroundColor: "#fff",
        borderBottom: "0.5px solid #e5e7eb",
        padding: "0 20px",
        display: "flex",
        overflowX: "auto",
        height: 48,
        alignItems: "center",
        scrollbarWidth: "none",
      }}
      className="hide-scrollbar"
    >
      <style>{`.hide-scrollbar::-webkit-scrollbar { display: none; }`}</style>
      {TABS.map((tab) => {
        const isActive = activeTab === tab.key;
        const isMega = tab.key === "mega";

        return (
          <button
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            style={{
              padding: "0 16px",
              height: 48,
              display: "inline-flex",
              alignItems: "center",
              fontSize: 13,
              cursor: "pointer",
              borderBottom: isActive ? "2px solid #4F46E5" : "2px solid transparent",
              whiteSpace: "nowrap",
              color: isActive || isMega ? "#4F46E5" : "#6b7280",
              fontWeight: isActive ? 500 : 400,
              background: "none",
              border: "none",
              borderBottomStyle: "solid",
              borderBottomWidth: 2,
              borderBottomColor: isActive ? "#4F46E5" : "transparent",
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
