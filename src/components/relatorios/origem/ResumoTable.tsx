import { useState } from "react";
import type { Resumo } from "../origemPerformanceAgg";
import { Card, EmptyState, SortTh, TopNSelect, ToggleBtn, fmtMoney, pct, taxaColor, sortRows, td, tdL, th, thL } from "./ui";

interface Props {
  title: string;
  rows: Resumo[];
  keyLabel: string;
  note?: string;
  showOrigem?: boolean;
  collapsible?: boolean;
  defaultOpen?: boolean;
  forceOpen?: boolean;
  defaultTopN?: number;
}

const getVal = (r: Resumo, c: string): number | string | null => {
  switch (c) {
    case "chave": return r.chave;
    case "leads": return r.leads;
    case "qualificados": return r.qualificados;
    case "desqualificados": return r.desqualificados;
    case "pendentes": return r.pendentes;
    case "semRegistro": return r.semRegistro;
    case "taxaQualif": return r.taxaQualif;
    case "visitas": return r.visitas;
    case "taxaVisita": return r.taxaVisita;
    case "vendas": return r.vendas;
    case "vgv": return r.vgv;
    case "tempoMedioMin": return r.tempoMedioMin;
    case "tempoMedianaMin": return r.tempoMedianaMin;
    default: return r.leads;
  }
};

/** Tabela de resumo: enxuta por padrão, com ordenação, Top N e colunas extras sob demanda. */
export function ResumoTable({
  title, rows, keyLabel, note, showOrigem, collapsible = true, defaultOpen = true, forceOpen, defaultTopN = 10,
}: Props) {
  const [sort, setSort] = useState<{ col: string; dir: "asc" | "desc" }>({ col: "leads", dir: "desc" });
  const [topN, setTopN] = useState(defaultTopN);
  const [full, setFull] = useState(false);
  const expand = full || !!forceOpen;

  const onSort = (c: string) =>
    setSort((s) => (s.col === c ? { col: c, dir: s.dir === "desc" ? "asc" : "desc" } : { col: c, dir: c === "chave" ? "asc" : "desc" }));

  const ordered = sortRows(rows, sort.col, sort.dir, getVal);
  const visiveis = forceOpen ? ordered : ordered.slice(0, topN);

  const total = rows.reduce(
    (acc, r) => {
      acc.leads += r.leads; acc.qualificados += r.qualificados; acc.desqualificados += r.desqualificados;
      acc.pendentes += r.pendentes; acc.semRegistro += r.semRegistro; acc.visitas += r.visitas;
      acc.vendas += r.vendas; acc.vgv += r.vgv;
      return acc;
    },
    { leads: 0, qualificados: 0, desqualificados: 0, pendentes: 0, semRegistro: 0, visitas: 0, vendas: 0, vgv: 0 },
  );
  const totQualif = total.qualificados + total.desqualificados;

  return (
    <Card
      title={title}
      note={note}
      collapsible={collapsible}
      defaultOpen={defaultOpen}
      forceOpen={forceOpen}
      right={
        !forceOpen && rows.length > 0 ? (
          <>
            <ToggleBtn active={full} onClick={() => setFull((f) => !f)}>{full ? "Menos colunas" : "Mais colunas"}</ToggleBtn>
            {rows.length > 5 && <TopNSelect value={topN} onChange={setTopN} />}
          </>
        ) : null
      }
    >
      {rows.length === 0 ? (
        <EmptyState />
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: expand ? 900 : 620 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #f0f0f5" }}>
                <SortTh label={keyLabel} col="chave" sort={sort} onSort={onSort} align="left" />
                <SortTh label="Leads" col="leads" sort={sort} onSort={onSort} />
                <SortTh label="Taxa qualif." col="taxaQualif" sort={sort} onSort={onSort} title="Qualificados ÷ (qualificados + desqualificados)" />
                <SortTh label="Visitas" col="visitas" sort={sort} onSort={onSort} />
                <SortTh label="Taxa visita" col="taxaVisita" sort={sort} onSort={onSort} />
                <SortTh label="Vendas" col="vendas" sort={sort} onSort={onSort} />
                <SortTh label="VGV" col="vgv" sort={sort} onSort={onSort} />
                {expand && (
                  <>
                    <SortTh label="Qualif." col="qualificados" sort={sort} onSort={onSort} />
                    <SortTh label="Desqualif." col="desqualificados" sort={sort} onSort={onSort} />
                    <SortTh label="Pend." col="pendentes" sort={sort} onSort={onSort} />
                    <SortTh label="Sem reg." col="semRegistro" sort={sort} onSort={onSort} />
                    <SortTh label="T. médio" col="tempoMedioMin" sort={sort} onSort={onSort} />
                    <SortTh label="T. mediana" col="tempoMedianaMin" sort={sort} onSort={onSort} />
                    {showOrigem && (
                      <>
                        <th style={th} title="1º contato via WhatsApp">% WA</th>
                        <th style={th} title="1º contato via atividade">% Ativ.</th>
                        <th style={th} title="1º contato via mudança de etapa (ex: ligação registrada)">% Etapa</th>
                        <th style={th} title="Sem registro de 1º contato">% s/reg</th>
                      </>
                    )}
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {visiveis.map((r) => {
                const totOrig = r.leads || 1;
                return (
                  <tr key={r.chave} style={{ borderBottom: "0.5px solid #f5f5fa" }}>
                    <td style={tdL}>{r.chave}</td>
                    <td style={td}>{r.leads}</td>
                    <td style={{ ...td, color: taxaColor(r.taxaQualif), fontWeight: 600 }}>{pct(r.taxaQualif)}</td>
                    <td style={td}>{r.visitas}</td>
                    <td style={{ ...td, color: taxaColor(r.taxaVisita) }}>{pct(r.taxaVisita)}</td>
                    <td style={td}>{r.vendas}</td>
                    <td style={td}>{r.vgv > 0 ? fmtMoney(r.vgv) : "—"}</td>
                    {expand && (
                      <>
                        <td style={{ ...td, color: "#10b981" }}>{r.qualificados}</td>
                        <td style={{ ...td, color: "#ef4444" }}>{r.desqualificados}</td>
                        <td style={{ ...td, color: "#f59e0b" }}>{r.pendentes}</td>
                        <td style={{ ...td, color: "#9ca3af" }}>{r.semRegistro}</td>
                        <td style={td}>{r.tempoMedioMin != null ? `${r.tempoMedioMin}min` : "—"}</td>
                        <td style={td}>{r.tempoMedianaMin != null ? `${r.tempoMedianaMin}min` : "—"}</td>
                        {showOrigem && (
                          <>
                            <td style={td}>{pct(r.origWhatsapp / totOrig)}</td>
                            <td style={td}>{pct(r.origAtividade / totOrig)}</td>
                            <td style={{ ...td, color: r.origMudancaEtapa > 0 ? "#4F46E5" : "#111827", fontWeight: r.origMudancaEtapa > 0 ? 600 : 400 }}>{pct(r.origMudancaEtapa / totOrig)}</td>
                            <td style={{ ...td, color: "#9ca3af" }}>{pct(r.origSemRegistro / totOrig)}</td>
                          </>
                        )}
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: "1px solid #e5e7eb", background: "#fafafe" }}>
                <td style={{ ...tdL, fontWeight: 600 }}>Total ({rows.length})</td>
                <td style={{ ...td, fontWeight: 600 }}>{total.leads}</td>
                <td style={{ ...td, fontWeight: 600 }}>{pct(totQualif ? total.qualificados / totQualif : null)}</td>
                <td style={{ ...td, fontWeight: 600 }}>{total.visitas}</td>
                <td style={{ ...td, fontWeight: 600 }}>{pct(total.leads ? total.visitas / total.leads : null)}</td>
                <td style={{ ...td, fontWeight: 600 }}>{total.vendas}</td>
                <td style={{ ...td, fontWeight: 600 }}>{total.vgv > 0 ? fmtMoney(total.vgv) : "—"}</td>
                {expand && (
                  <>
                    <td style={td}>{total.qualificados}</td>
                    <td style={td}>{total.desqualificados}</td>
                    <td style={td}>{total.pendentes}</td>
                    <td style={td}>{total.semRegistro}</td>
                    <td style={td} colSpan={showOrigem ? 6 : 2} />
                  </>
                )}
              </tr>
            </tfoot>
          </table>
          {!forceOpen && rows.length > visiveis.length && (
            <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 6 }}>
              Exibindo {visiveis.length} de {rows.length} linhas.
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

export { thL };
