import { useState, Fragment } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { ResumoCriativo } from "../origemPerformanceAgg";
import { Card, EmptyState, TopNSelect, fmtData, pct, taxaColor, td, tdL, th, thL } from "./ui";

export function CriativoTable({ rows, forceOpen }: { rows: ResumoCriativo[]; forceOpen?: boolean }) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [topN, setTopN] = useState(10);
  const ordered = [...rows].sort((a, b) => b.leads - a.leads);
  const visiveis = forceOpen ? ordered : ordered.slice(0, topN);

  return (
    <Card
      title="Criativos (anúncios)"
      note="Clique numa linha para ver a curva semanal (fadiga de criativo)."
      collapsible
      defaultOpen
      forceOpen={forceOpen}
      right={!forceOpen && rows.length > 10 ? <TopNSelect value={topN} onChange={setTopN} /> : null}
    >
      {rows.length === 0 ? (
        <EmptyState />
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #f0f0f5" }}>
                <th style={thL}>Criativo</th>
                <th style={th}>Leads</th>
                <th style={th}>Taxa qualif.</th>
                <th style={th}>Taxa visita</th>
                <th style={th}>Vendas</th>
                <th style={th}>1º lead</th>
                <th style={th}>Último lead</th>
              </tr>
            </thead>
            <tbody>
              {visiveis.map((c) => {
                const isOpen = !!open[c.chave] || !!forceOpen;
                return (
                  <Fragment key={c.chave}>
                    <tr style={{ borderBottom: "0.5px solid #f5f5fa", cursor: "pointer" }} onClick={() => setOpen((o) => ({ ...o, [c.chave]: !o[c.chave] }))}>
                      <td style={tdL}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                          {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                          {c.chave}
                        </span>
                      </td>
                      <td style={td}>{c.leads}</td>
                      <td style={{ ...td, color: taxaColor(c.taxaQualif), fontWeight: 600 }}>{pct(c.taxaQualif)}</td>
                      <td style={{ ...td, color: taxaColor(c.taxaVisita) }}>{pct(c.taxaVisita)}</td>
                      <td style={td}>{c.vendas}</td>
                      <td style={td}>{fmtData(c.dataPrimeiroLead)}</td>
                      <td style={td}>{fmtData(c.dataUltimoLead)}</td>
                    </tr>
                    {isOpen && c.semanas.map((w) => (
                      <tr key={c.chave + w.semana} style={{ background: "#fafafe", borderBottom: "0.5px solid #f5f5fa" }}>
                        <td style={{ ...tdL, paddingLeft: 24, color: "#6b7280" }}>Semana {fmtData(w.semana)}</td>
                        <td style={{ ...td, color: "#6b7280" }}>{w.leads}</td>
                        <td style={{ ...td, color: taxaColor(w.taxaQualif) }}>{pct(w.taxaQualif)}</td>
                        <td style={{ ...td, color: taxaColor(w.taxaVisita) }}>{pct(w.taxaVisita)}</td>
                        <td style={td} colSpan={3}></td>
                      </tr>
                    ))}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
          {!forceOpen && rows.length > visiveis.length && (
            <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 6 }}>Exibindo {visiveis.length} de {rows.length} criativos.</div>
          )}
        </div>
      )}
    </Card>
  );
}
