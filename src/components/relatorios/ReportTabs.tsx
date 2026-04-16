import { cn } from "@/lib/utils";

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
  { key: "mega", label: "✦ Mega", special: true },
] as const;

export type ReportTabKey = (typeof TABS)[number]["key"];

interface ReportTabsProps {
  activeTab: ReportTabKey;
  onTabChange: (tab: ReportTabKey) => void;
}

export default function ReportTabs({ activeTab, onTabChange }: ReportTabsProps) {
  return (
    <div className="bg-white border-b" style={{ borderBottomWidth: "0.5px", borderColor: "#e5e7eb" }}>
      <nav className="flex overflow-x-auto scrollbar-hide px-4 gap-1" aria-label="Report tabs">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          const isSpecial = "special" in tab && tab.special;

          return (
            <button
              key={tab.key}
              onClick={() => onTabChange(tab.key)}
              className={cn(
                "whitespace-nowrap px-3 py-2.5 text-sm font-medium transition-colors relative",
                "hover:text-[#4F46E5]/70",
                isActive
                  ? "text-[#4F46E5] border-b-2 border-[#4F46E5]"
                  : isSpecial
                    ? "text-[#4F46E5]"
                    : "text-muted-foreground"
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
