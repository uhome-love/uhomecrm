import { useMemo, useState, Fragment } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Download, Loader2, ChevronDown, ChevronRight } from "lucide-react";
import { fmtMoney as _fmt } from "@/lib/fmtMoney";
import { getDateRange, type ReportFilters } from "./reportUtils";
import {
  enrich, computeResumo, groupResumo, groupCriativos, buildCsv, labelKey,
  type LeadRow, type LeadRowX, type Resumo, type ResumoCriativo,
} from "./origemPerformanceAgg";

const fmtMoney = (v: number) => _fmt(v, "short");
const pct = (v: number | null) => (v == null ? "—" : `${(v * 100).toFixed(1)}%`);
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const fmtData = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "—";

interface Props {
  filters: ReportFilters;
  userRole: "admin" | "gestor" | "corretor";
}

const GRUPO_COR: Record<string, string> = {
  qualificado: "#10b981",
  desqualificado: "#ef4444",
  pendente: "#f59e0b",
  neutro: "#9ca3af",
};

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{ background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 12, padding: "12px 14px" }}>
      <div style={{ fontSize: 11, color: "#6b7280" }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 600, color: "#111827" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "#9ca3af" }}>{sub}</div>}
    </div>
  );
}

const th: React.CSSProperties = { textAlign: "right", padding: "6px 8px", fontSize: 11, color: "#6b7280", fontWeight: 500, whiteSpace: "nowrap" };
const thL: React.CSSProperties = { ...th, textAlign: "left" };
const td: React.CSSProperties = { textAlign: "right", padding: "6px 8px", fontSize: 12, color: "#111827", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" };
const tdL: React.CSSProperties = { ...td, textAlign: "left" };

function taxaColor(v: number | null): string {
  if (v == null) return "#9ca3af";
  if (v >= 0.6) return "#10b981";
  if (v >= 0.35) return "#f59e0b";
  return "#ef4444";
}

function ResumoTable({ title, rows, keyLabel, extraNote }: { title: string; rows: Resumo[]; keyLabel: string; extraNote?: string }) {
  if (rows.length === 0) return null;
  return (
    <div style={{ background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 12, padding: 14, marginBottom: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#111827", marginBottom: 2 }}>{title}</div>
      {extraNote && <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 8 }}>{extraNote}</div>}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #f0f0f5" }}>
              <th style={thL}>{keyLabel}</th>
              <th style={th}>Leads</th>
              <th style={th}>Qualif.</th>
              <th style={th}>Desqualif.</th>
              <th style={th}>Pend.</th>
              <th style={th}>Sem reg.</th>
              <th style={th}>Taxa qualif.</th>
              <th style={th}>Visitas</th>
              <th style={th}>Taxa visita</th>
              <th style={th}>Vendas</th>
              <th style={th}>VGV</th>
              <th style={th}>T. médio</th>
              <th style={th}>T. mediana</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.chave} style={{ borderBottom: "0.5px solid #f5f5fa" }}>
                <td style={tdL}>{r.chave}</td>
                <td style={td}>{r.leads}</td>
                <td style={{ ...td, color: "#10b981" }}>{r.qualificados}</td>
                <td style={{ ...td, color: "#ef4444" }}>{r.desqualificados}</td>
                <td style={{ ...td, color: "#f59e0b" }}>{r.pendentes}</td>
                <td style={{ ...td, color: "#9ca3af" }}>{r.semRegistro}</td>
                <td style={{ ...td, color: taxaColor(r.taxaQualif), fontWeight: 600 }}>{pct(r.taxaQualif)}</td>
                <td style={td}>{r.visitas}</td>
                <td style={{ ...td, color: taxaColor(r.taxaVisita) }}>{pct(r.taxaVisita)}</td>
                <td style={td}>{r.vendas}</td>
                <td style={td}>{r.vgv > 0 ? fmtMoney(r.vgv) : "—"}</td>
                <td style={td}>{r.tempoMedioMin != null ? `${r.tempoMedioMin}min` : "—"}</td>
                <td style={td}>{r.tempoMedianaMin != null ? `${r.tempoMedianaMin}min` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CriativoTable({ rows }: { rows: ResumoCriativo[] }) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  if (rows.length === 0) return null;
  return (
    <div style={{ background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 12, padding: 14, marginBottom: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#111827", marginBottom: 2 }}>Resumo por criativo (anúncio)</div>
      <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 8 }}>Clique para ver a curva semanal (fadiga de criativo).</div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 860 }}>
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
            {rows.map((c) => {
              const isOpen = !!open[c.chave];
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
      </div>
    </div>
  );
}

export default function RelatorioOrigemPerformance({ filters }: Props) {
  const { startDate, endDate } = useMemo(() => getDateRange(filters), [filters]);
  const startS = ymd(startDate);
  const endS = ymd(endDate);

  const { data, isLoading, error } = useQuery({
    queryKey: ["origem-performance", startS, endS],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_relatorio_origem_performance", {
        p_start: startS,
        p_end: endS,
        p_corretor_ids: null,
      } as never);
      if (error) throw error;
      return (data ?? []) as LeadRow[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const rows = useMemo(() => enrich(data ?? []), [data]);

  const agg = useMemo(() => {
    const total = computeResumo("Total", rows);
    const semOrigem = rows.filter((r) => !(r.campanha ?? "").trim() && !(r.conjunto_anuncio ?? "").trim() && !(r.anuncio ?? "").trim());
    return {
      total,
      porCampanha: groupResumo(rows, (r) => labelKey(r.campanha)),
      porConjunto: groupResumo(rows, (r) => labelKey(r.conjunto_anuncio)),
      porPlataforma: groupResumo(rows, (r) => labelKey(r.plataforma)),
      porCorretor: groupResumo(rows, (r) => r.corretor_nome ?? "(sem corretor)"),
      criativos: groupCriativos(rows),
      semOrigem,
      semOrigemPlataforma: groupResumo(semOrigem, (r) => labelKey(r.plataforma)),
      semOrigemEmpreendimento: groupResumo(semOrigem, (r) => labelKey(r.empreendimento)),
    };
  }, [rows]);

  const exportCsv = () => {
    const csv = buildCsv({
      detalhado: rows,
      porCampanha: agg.porCampanha,
      porConjunto: agg.porConjunto,
      porPlataforma: agg.porPlataforma,
      porCorretor: agg.porCorretor,
      criativos: agg.criativos,
      semOrigemPlataforma: agg.semOrigemPlataforma,
      semOrigemEmpreendimento: agg.semOrigemEmpreendimento,
    });
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `performance-origem-${startS}_${endS}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return <div style={{ display: "flex", justifyContent: "center", padding: 48 }}><Loader2 className="h-6 w-6 animate-spin" style={{ color: "#4F46E5" }} /></div>;
  }
  if (error) {
    return <div style={{ padding: 24, color: "#ef4444", fontSize: 13 }}>Erro ao carregar o relatório.</div>;
  }

  const t = agg.total;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: "#111827" }}>Performance por origem</div>
          <div style={{ fontSize: 12, color: "#6b7280" }}>Qualidade por exclusão · taxa qualif. = qualificados ÷ (qualificados + desqualificados)</div>
        </div>
        <button onClick={exportCsv} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#4F46E5", color: "#fff", border: "none", borderRadius: 8, padding: "8px 12px", fontSize: 13, cursor: "pointer" }}>
          <Download size={14} /> Exportar CSV
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10, marginBottom: 18 }}>
        <KpiCard label="Leads" value={String(t.leads)} />
        <KpiCard label="Qualificados" value={String(t.qualificados)} sub={`${t.desqualificados} desqualif.`} />
        <KpiCard label="Pendentes" value={String(t.pendentes)} sub="ainda não julgados" />
        <KpiCard label="Sem registro" value={String(t.semRegistro)} sub="sem 1º contato no CRM" />
        <KpiCard label="Taxa qualificação" value={pct(t.taxaQualif)} />
        <KpiCard label="Taxa visita" value={pct(t.taxaVisita)} sub={`${t.visitas} visitas`} />
        <KpiCard label="Vendas" value={String(t.vendas)} sub={t.vgv > 0 ? fmtMoney(t.vgv) : undefined} />
        <KpiCard label="Tempo 1º contato" value={t.tempoMedioMin != null ? `${t.tempoMedioMin}min` : "—"} sub={t.tempoMedianaMin != null ? `mediana ${t.tempoMedianaMin}min` : undefined} />
      </div>

      <ResumoTable title="Resumo por campanha" rows={agg.porCampanha} keyLabel="Campanha" />
      <ResumoTable title="Resumo por conjunto de anúncio" rows={agg.porConjunto} keyLabel="Conjunto" />
      <ResumoTable title="Resumo por plataforma" rows={agg.porPlataforma} keyLabel="Plataforma" extraNote="Compare Instagram vs Facebook (taxa de qualificação e de visita)." />
      <CriativoTable rows={agg.criativos} />
      <ResumoTable title="Resumo por corretor" rows={agg.porCorretor} keyLabel="Corretor" extraNote='Coluna "Sem reg." alta = corretor não registra contato no CRM.' />

      <div style={{ background: "#fff7ed", border: "0.5px solid #fed7aa", borderRadius: 12, padding: 12, marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#9a3412", marginBottom: 8 }}>
          Leads "Sem origem" ({agg.semOrigem.length}) — quebra para diagnóstico
        </div>
        <ResumoTable title="Por plataforma" rows={agg.semOrigemPlataforma} keyLabel="Plataforma" />
        <ResumoTable title="Por empreendimento" rows={agg.semOrigemEmpreendimento} keyLabel="Empreendimento" />
      </div>

      <DetalhadoTable rows={rows} />
    </div>
  );
}

function DetalhadoTable({ rows }: { rows: LeadRowX[] }) {
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

  return (
    <div style={{ background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 12, padding: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 8, flexWrap: "wrap" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>Detalhado por lead ({filtered.length})</div>
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar lead, campanha, criativo…"
          style={{ border: "0.5px solid #e5e7eb", borderRadius: 8, padding: "6px 10px", fontSize: 12, width: 260 }} />
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 980 }}>
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
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, limit).map((r) => (
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filtered.length > limit && (
        <button onClick={() => setLimit((l) => l + 100)} style={{ marginTop: 10, background: "none", border: "0.5px solid #e5e7eb", borderRadius: 8, padding: "6px 12px", fontSize: 12, cursor: "pointer", color: "#4F46E5" }}>
          Mostrar mais ({filtered.length - limit} restantes)
        </button>
      )}
    </div>
  );
}
