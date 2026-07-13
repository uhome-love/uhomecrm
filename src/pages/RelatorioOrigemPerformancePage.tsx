import { useState } from "react";
import RelatorioOrigemPerformance from "@/components/relatorios/RelatorioOrigemPerformance";
import type { ReportFilters } from "@/components/relatorios/reportUtils";

const PILLS: Array<{ id: string; label: string }> = [
  { id: "hoje", label: "Hoje" },
  { id: "semana", label: "Semana" },
  { id: "mes", label: "Mês" },
  { id: "custom", label: "Personalizado" },
];

/**
 * Relatório de Performance por Origem — página dedicada, somente leitura.
 * Cruza origem/campanha/conjunto/criativo/plataforma com qualidade (por exclusão),
 * visita, venda e tempo até 1º contato. Não altera nenhum dado do CRM.
 */
export default function RelatorioOrigemPerformancePage() {
  const [periodo, setPeriodo] = useState<string>("mes");
  const [de, setDe] = useState<string>("");
  const [ate, setAte] = useState<string>("");

  const filters: ReportFilters = {
    periodo,
    dataInicio: de || undefined,
    dataFim: ate || undefined,
    equipe: "",
    corretor: "",
    segmento: "",
  };

  return (
    <div style={{ height: "100vh", overflowY: "auto", background: "#f0f0f5" }}>
      <div style={{ background: "#fff", borderBottom: "0.5px solid #e5e7eb", padding: "12px 20px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ marginRight: "auto" }}>
          <h1 style={{ fontSize: 16, fontWeight: 600, color: "#111827" }}>Performance por Origem</h1>
          <p style={{ fontSize: 12, color: "#6b7280" }}>Qualidade de lead por campanha, conjunto, criativo, plataforma e corretor</p>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {PILLS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriodo(p.id)}
              style={{
                padding: "6px 12px", fontSize: 12, borderRadius: 8, cursor: "pointer",
                border: periodo === p.id ? "none" : "0.5px solid #e5e7eb",
                background: periodo === p.id ? "#4F46E5" : "#fff",
                color: periodo === p.id ? "#fff" : "#6b7280",
                fontWeight: periodo === p.id ? 600 : 400,
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
        {periodo === "custom" && (
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input type="date" value={de} onChange={(e) => setDe(e.target.value)} style={{ border: "0.5px solid #e5e7eb", borderRadius: 8, padding: "5px 8px", fontSize: 12 }} />
            <span style={{ color: "#9ca3af", fontSize: 12 }}>até</span>
            <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} style={{ border: "0.5px solid #e5e7eb", borderRadius: 8, padding: "5px 8px", fontSize: 12 }} />
          </div>
        )}
      </div>
      <div style={{ padding: 16 }}>
        <RelatorioOrigemPerformance filters={filters} userRole="admin" />
      </div>
    </div>
  );
}
