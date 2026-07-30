import type { PersistResumo } from "../origemPerformanceAgg";
import { Card, EmptyState, num1, pct, taxaColor, td, tdL, th, thL } from "./ui";

export function PersistTable({
  title, rows, keyLabel, note, defaultOpen = false, forceOpen,
}: {
  title: string; rows: PersistResumo[]; keyLabel: string; note?: string; defaultOpen?: boolean; forceOpen?: boolean;
}) {
  const visiveis = rows.filter((r) => r.leadsNaCadencia > 0).sort((a, b) => b.leadsNaCadencia - a.leadsNaCadencia);
  const fx = (f: { total: number; visita: number; taxa: number | null }) =>
    f.total === 0 ? "—" : `${pct(f.taxa)} (${f.visita}/${f.total})`;

  return (
    <Card title={title} note={note} collapsible defaultOpen={defaultOpen} forceOpen={forceOpen}>
      {visiveis.length === 0 ? (
        <EmptyState />
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1100 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #f0f0f5" }}>
                <th style={thL}>{keyLabel}</th>
                <th style={th} title="Leads que passaram por Sem Contato">Na cadência</th>
                <th style={th}>Média tent.</th>
                <th style={th} title="Descartaram com menos de 3 tentativas">% &lt;3 tent.</th>
                <th style={th}>% cadência 7</th>
                <th style={th} title="Saíram da cadência com avanço no pipeline">% sucesso</th>
                <th style={th} title="Descartados/inativados ainda em Sem Contato">% abandonado</th>
                <th style={th} title="Falou de primeira, nunca precisou entrar na cadência">Visita: contato de 1ª</th>
                <th style={th}>Visita 1-2</th>
                <th style={th}>Visita 3-4</th>
                <th style={th}>Visita 5-7</th>
                <th style={th}>Visita nunca trab.</th>
              </tr>
            </thead>
            <tbody>
              {visiveis.map((r) => (
                <tr key={r.chave} style={{ borderBottom: "0.5px solid #f5f5fa" }}>
                  <td style={tdL}>{r.chave}</td>
                  <td style={td}>{r.leadsNaCadencia}</td>
                  <td style={td}>{num1(r.mediaTentativas)}</td>
                  <td style={{ ...td, color: (r.pctMenosDe3 ?? 0) > 0.4 ? "#ef4444" : "#111827" }}>{pct(r.pctMenosDe3)}</td>
                  <td style={{ ...td, color: taxaColor(r.pctCadenciaCompleta) }}>{pct(r.pctCadenciaCompleta)}</td>
                  <td style={{ ...td, color: taxaColor(r.pctSucessoPos) }}>{pct(r.pctSucessoPos)}</td>
                  <td style={{ ...td, color: (r.pctAbandonado ?? 0) > 0.3 ? "#ef4444" : "#111827" }}>{pct(r.pctAbandonado)}</td>
                  <td style={td}>{fx(r.visitaContatoPrimeira)}</td>
                  <td style={td}>{fx(r.visitaFaixa12)}</td>
                  <td style={td}>{fx(r.visitaFaixa34)}</td>
                  <td style={td}>{fx(r.visitaFaixa57)}</td>
                  <td style={{ ...td, color: "#9ca3af" }}>{fx(r.visitaNuncaTrabalhado)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
