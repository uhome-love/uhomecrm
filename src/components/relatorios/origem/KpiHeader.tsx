import type { Resumo } from "../origemPerformanceAgg";
import { fmtMoney, pct } from "./ui";

function Big({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 12, padding: "14px 16px" }}>
      <div style={{ fontSize: 11, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 600, color: color ?? "#111827", lineHeight: 1.2 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "#9ca3af" }}>{sub}</div>}
    </div>
  );
}

/** 4 KPIs principais + linha secundária de contexto. */
export function KpiHeader({ t }: { t: Resumo }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
        <Big label="Leads" value={String(t.leads)} sub={`${t.pendentes} pendentes`} />
        <Big label="Taxa qualificação" value={pct(t.taxaQualif)} sub={`${t.qualificados} qualif. · ${t.desqualificados} desqualif.`} />
        <Big label="Taxa visita" value={pct(t.taxaVisita)} sub={`${t.visitas} visitas`} />
        <Big label="Vendas" value={String(t.vendas)} sub={t.vgv > 0 ? fmtMoney(t.vgv) : "sem VGV no período"} />
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 8, fontSize: 11, color: "#6b7280" }}>
        <span>Sem registro de 1º contato: <b style={{ color: "#111827" }}>{t.semRegistro}</b></span>
        <span>Tempo médio até 1º contato: <b style={{ color: "#111827" }}>{t.tempoMedioMin != null ? `${t.tempoMedioMin}min` : "—"}</b></span>
        <span>Mediana: <b style={{ color: "#111827" }}>{t.tempoMedianaMin != null ? `${t.tempoMedianaMin}min` : "—"}</b></span>
      </div>
    </div>
  );
}

/** Funil horizontal Leads → Qualificados → Visitas → Vendas. */
export function FunilResumo({ t }: { t: Resumo }) {
  const etapas = [
    { label: "Leads", v: t.leads, cor: "#4F46E5" },
    { label: "Qualificados", v: t.qualificados, cor: "#10b981" },
    { label: "Visitas", v: t.visitas, cor: "#f59e0b" },
    { label: "Vendas", v: t.vendas, cor: "#111827" },
  ];
  const base = t.leads || 1;
  return (
    <div style={{ background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 12, padding: 14, marginBottom: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#111827", marginBottom: 10 }}>Funil do período</div>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${etapas.length}, 1fr)`, gap: 10 }}>
        {etapas.map((e, i) => {
          const anterior = i === 0 ? null : etapas[i - 1].v;
          return (
            <div key={e.label}>
              <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>{e.label}</div>
              <div style={{ height: 8, background: "#f0f0f5", borderRadius: 999, overflow: "hidden", marginBottom: 6 }}>
                <div style={{ width: `${Math.min(100, (e.v / base) * 100)}%`, height: "100%", background: e.cor, borderRadius: 999 }} />
              </div>
              <div style={{ fontSize: 20, fontWeight: 600, color: "#111827" }}>{e.v}</div>
              <div style={{ fontSize: 11, color: "#9ca3af" }}>
                {i === 0 ? "100% da base" : `${pct(anterior ? e.v / anterior : null)} da etapa anterior`}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
