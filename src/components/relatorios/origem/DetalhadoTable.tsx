import { useMemo, useState } from "react";
import type { LeadRowX } from "../origemPerformanceAgg";
import { EmptyState, GRUPO_COR, ORIGEM_LABEL, td, tdL, th, thL } from "./ui";

export function DetalhadoTable({ rows, forceOpen }: { rows: LeadRowX[]; forceOpen?: boolean }) {
  const [busca, setBusca] = useState("");
  const [limit, setLimit] = useState(50);
  const filtered = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.nome, r.campanha, r.anuncio, r.corretor_nome, r.empreendimento, r.plataforma]
        .some((v) => (v ?? "").toLowerCase().includes(q)),
    );
  }, [rows, busca]);
  const limite = forceOpen ? filtered.length : limit;

  return (
    <div style={{ background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 12, padding: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 8, flexWrap: "wrap" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>Detalhado por lead ({filtered.length})</div>
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar lead, campanha, criativo…"
          style={{ border: "0.5px solid #e5e7eb", borderRadius: 8, padding: "6px 10px", fontSize: 12, width: 260 }} />
      </div>
      {filtered.length === 0 ? (
        <EmptyState label="Nenhum lead encontrado." />
      ) : (
        <>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1080 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #f0f0f5" }}>
                  <th style={thL}>Lead</th>
                  <th style={thL}>Plataforma</th>
                  <th style={thL}>Campanha</th>
                  <th style={thL}>Criativo</th>
                  <th style={thL}>Empreend.</th>
                  <th style={thL}>Corretor</th>
                  <th style={thL}>Qualidade</th>
                  <th style={th}>Visita</th>
                  <th style={th}>Venda</th>
                  <th style={th}>1º contato</th>
                  <th style={th}>Origem 1º</th>
                  <th style={th}>Tent.</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, limite).map((r) => (
                  <tr key={r.lead_id} style={{ borderBottom: "0.5px solid #f5f5fa" }}>
                    <td style={tdL}>{r.nome ?? "—"}</td>
                    <td style={tdL}>{r.plataforma ?? "—"}</td>
                    <td style={tdL}>{r.campanha ?? "—"}</td>
                    <td style={tdL}>{r.anuncio ?? "—"}</td>
                    <td style={tdL}>{r.empreendimento ?? "—"}</td>
                    <td style={tdL}>{r.corretor_nome ?? "—"}</td>
                    <td style={tdL}>
                      <span style={{ color: GRUPO_COR[r.grupo], fontWeight: 600, fontSize: 11 }}>{r.grupo}</span>
                    </td>
                    <td style={td}>{r.tem_visita_realizada ? "✓" : "—"}</td>
                    <td style={td}>{r.tem_venda ? "✓" : "—"}</td>
                    <td style={td}>{r.semRegistro ? "sem reg." : `${r.tempo_ate_primeiro_contato_min}min`}</td>
                    <td style={{ ...td, fontSize: 11, color: "#6b7280" }}>{r.origem_primeiro_contato ? ORIGEM_LABEL[r.origem_primeiro_contato] : "—"}</td>
                    <td style={td}>{r.entrou_na_cadencia ? r.num_tentativas : (r.contato_estabelecido ? "1ª" : "—")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length > limite && (
            <button onClick={() => setLimit((l) => l + 100)} style={{ marginTop: 10, background: "none", border: "0.5px solid #e5e7eb", borderRadius: 8, padding: "6px 12px", fontSize: 12, cursor: "pointer", color: "#4F46E5" }}>
              Mostrar mais ({filtered.length - limite} restantes)
            </button>
          )}
        </>
      )}
    </div>
  );
}
