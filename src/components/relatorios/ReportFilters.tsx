import { useState } from "react";
import { Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const PERIOD_CHIPS = [
  { key: "hoje", label: "Hoje" },
  { key: "semana", label: "Esta semana" },
  { key: "mes", label: "Este mês" },
  { key: "custom", label: "Personalizado" },
];

const SEGMENTOS = [
  { value: "", label: "Todos os segmentos" },
  { value: "mcmv", label: "MCMV" },
  { value: "medio-alto", label: "Médio-Alto" },
  { value: "altissimo", label: "Altíssimo" },
  { value: "investimento", label: "Investimento" },
];

interface Filters {
  periodo: string;
  dataInicio?: string;
  dataFim?: string;
  equipe: string;
  corretor: string;
  segmento: string;
}

interface ReportFiltersProps {
  filters: Filters;
  onFiltersChange: (f: Filters) => void;
  userRole: "admin" | "gestor" | "corretor";
  onExport?: () => void;
}

const chipBase: React.CSSProperties = {
  border: "0.5px solid #d1d5db",
  color: "#6b7280",
  backgroundColor: "#fff",
  borderRadius: 20,
  padding: "5px 14px",
  fontSize: 12,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const chipActive: React.CSSProperties = {
  ...chipBase,
  backgroundColor: "#EEF2FF",
  color: "#4F46E5",
  borderColor: "#C7D2FE",
  fontWeight: 500,
};

const selectStyle: React.CSSProperties = {
  ...chipBase,
  appearance: "none" as const,
  paddingRight: 24,
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 8px center",
};

export default function ReportFilters({ filters, onFiltersChange, userRole, onExport }: ReportFiltersProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const set = (patch: Partial<Filters>) => onFiltersChange({ ...filters, ...patch });

  return (
    <div
      style={{
        backgroundColor: "#fff",
        borderBottom: "0.5px solid #e5e7eb",
        padding: "10px 20px",
        display: "flex",
        alignItems: "center",
        gap: 8,
        flexWrap: "wrap",
      }}
    >
      {PERIOD_CHIPS.map((chip) => (
        <button
          key={chip.key}
          onClick={() => set({ periodo: chip.key })}
          style={filters.periodo === chip.key ? chipActive : chipBase}
        >
          {chip.label}
        </button>
      ))}

      {filters.periodo === "custom" && (
        <>
          <input
            type="date"
            value={filters.dataInicio || ""}
            onChange={(e) => set({ dataInicio: e.target.value })}
            style={{ ...chipBase, padding: "4px 10px" }}
          />
          <input
            type="date"
            value={filters.dataFim || ""}
            onChange={(e) => set({ dataFim: e.target.value })}
            style={{ ...chipBase, padding: "4px 10px" }}
          />
        </>
      )}

      <div style={{ width: 1, height: 20, backgroundColor: "#e5e7eb", margin: "0 4px" }} />

      {userRole === "admin" && (
        <select
          value={filters.equipe}
          onChange={(e) => set({ equipe: e.target.value })}
          style={selectStyle}
        >
          <option value="">Todas as equipes</option>
        </select>
      )}

      <select
        value={filters.corretor}
        onChange={(e) => set({ corretor: e.target.value })}
        style={selectStyle}
      >
        <option value="">Todos os corretores</option>
      </select>

      <select
        value={filters.segmento}
        onChange={(e) => set({ segmento: e.target.value })}
        style={selectStyle}
      >
        {SEGMENTOS.map((s) => (
          <option key={s.value} value={s.value}>{s.label}</option>
        ))}
      </select>

      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
        <button
          onClick={() => onExport?.()}
          style={{
            backgroundColor: "#4F46E5",
            color: "#fff",
            borderRadius: 20,
            padding: "5px 16px",
            fontSize: 12,
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <Download size={13} strokeWidth={1.5} />
          Exportar PDF
        </button>
        <button
          onClick={() => {
            navigator.clipboard.writeText(window.location.href);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
            toast({ title: "Link copiado!" });
          }}
          style={{
            ...chipBase,
            border: copied ? "0.5px solid #C7D2FE" : "0.5px solid #d1d5db",
            color: copied ? "#4F46E5" : "#6b7280",
          }}
        >
          {copied ? "✓ Copiado!" : "🔗 Link"}
        </button>
      </div>
    </div>
  );
}
