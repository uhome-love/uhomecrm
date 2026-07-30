import type { DescarteMotivoRow, DescarteConjuntoRow } from "../origemPerformanceAgg";
import { Card, EmptyState, num1, pct, td, tdL, th, thL } from "./ui";

export function DescarteMotivoTable({ rows, forceOpen }: { rows: DescarteMotivoRow[]; forceOpen?: boolean }) {
  return (
    <Card
      title="Descarte × tentativas — por motivo"
      note='Motivo de perfil (sem renda, fora do perfil) com média alta = mídia ruim → corte o conjunto. Motivo "não responde" com média baixa = processo → treine o time.'
      collapsible
      defaultOpen={false}
      forceOpen={forceOpen}
    >
      {rows.length === 0 ? (
        <EmptyState label="Sem descartes no período." />
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 620 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #f0f0f5" }}>
                <th style={thL}>Motivo</th>
                <th style={th}>Total</th>
                <th style={th}>Média tent.</th>
                <th style={th}>% descartados &lt;3 tent.</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.motivo} style={{ borderBottom: "0.5px solid #f5f5fa" }}>
                  <td style={tdL}>{r.motivo}</td>
                  <td style={td}>{r.total}</td>
                  <td style={td}>{num1(r.mediaTentativas)}</td>
                  <td style={{ ...td, color: (r.pctMenosDe3 ?? 0) > 0.4 ? "#ef4444" : "#111827", fontWeight: 600 }}>{pct(r.pctMenosDe3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

export function DescarteConjuntoTable({ rows, forceOpen }: { rows: DescarteConjuntoRow[]; forceOpen?: boolean }) {
  const limite = forceOpen ? rows.length : 20;
  return (
    <Card
      title="Descarte × tentativas — por conjunto de anúncio"
      note="Cruzamento para decidir se o conjunto é lixo de mídia ou lead mal trabalhado."
      collapsible
      defaultOpen={false}
      forceOpen={forceOpen}
    >
      {rows.length === 0 ? (
        <EmptyState label="Sem descartes no período." />
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #f0f0f5" }}>
                <th style={thL}>Conjunto</th>
                <th style={thL}>Motivo</th>
                <th style={th}>Qtd</th>
                <th style={th}>Média tent.</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, limite).map((r, i) => (
                <tr key={i} style={{ borderBottom: "0.5px solid #f5f5fa" }}>
                  <td style={tdL}>{r.conjunto}</td>
                  <td style={tdL}>{r.motivo}</td>
                  <td style={td}>{r.qtd}</td>
                  <td style={{ ...td, color: (r.mediaTentativas ?? 0) < 3 ? "#ef4444" : "#111827" }}>{num1(r.mediaTentativas)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > limite && (
            <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 6 }}>Exibindo top {limite} de {rows.length}. Ver todos no CSV.</div>
          )}
        </div>
      )}
    </Card>
  );
}
