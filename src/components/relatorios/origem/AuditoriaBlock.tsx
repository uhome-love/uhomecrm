import type { AuditoriaDiff, Resumo } from "../origemPerformanceAgg";
import { Card, ORIGEM_LABEL, pct } from "./ui";

export function AuditoriaBlock({ a }: { a: AuditoriaDiff }) {
  return (
    <div style={{ background: "#eef2ff", border: "0.5px solid #c7d2fe", borderRadius: 12, padding: 12, marginBottom: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: "#3730a3", marginBottom: 6 }}>
        Auditoria · 1º contato v2 (WhatsApp + Atividade + Mudança de etapa) vs v1
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 8, fontSize: 12, color: "#3730a3" }}>
        <div><b>{a.total}</b> leads no período</div>
        <div><b>{a.soV2TemDado}</b> ganharam 1º contato (v1 vazio → v2 preenchido)</div>
        <div><b>{a.v2AntesDeV1}</b> ficaram mais rápidos com v2</div>
        <div><b>{a.iguais}</b> iguais</div>
        <div><b>{a.ambosNulos}</b> ainda sem registro</div>
        <div>Mediana v1: <b>{a.medianaV1Min ?? "—"}min</b></div>
        <div>Mediana v2: <b>{a.medianaV2Min ?? "—"}min</b></div>
      </div>
    </div>
  );
}

export function OrigemContatoBlock({ t, forceOpen }: { t: Resumo; forceOpen?: boolean }) {
  const itens: Array<{ label: string; n: number; cinza?: boolean }> = [
    { label: ORIGEM_LABEL.whatsapp, n: t.origWhatsapp },
    { label: ORIGEM_LABEL.atividade, n: t.origAtividade },
    { label: ORIGEM_LABEL.mudanca_etapa, n: t.origMudancaEtapa },
    { label: "Sem registro", n: t.origSemRegistro, cinza: true },
  ];
  return (
    <Card
      title="Como o 1º contato foi registrado"
      note='"Mudança de etapa" captura o corretor que fala por ligação e move o lead — antes esse contato ficava invisível.'
      collapsible
      defaultOpen
      forceOpen={forceOpen}
    >
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8 }}>
        {itens.map((i) => (
          <div key={i.label} style={{ background: "#fafafe", borderRadius: 8, padding: "8px 10px" }}>
            <div style={{ fontSize: 11, color: "#6b7280" }}>{i.label}</div>
            <div style={{ fontSize: 18, fontWeight: 600, color: i.cinza ? "#9ca3af" : "#111827" }}>{i.n}</div>
            <div style={{ fontSize: 11, color: "#9ca3af" }}>{pct(t.leads ? i.n / t.leads : null)}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}
