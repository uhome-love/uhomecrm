import { useMemo, useState, Fragment } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Download, Loader2, ChevronDown, ChevronRight } from "lucide-react";
import { fmtMoney as _fmt } from "@/lib/fmtMoney";
import { getDateRange, type ReportFilters } from "./reportUtils";
import {
  enrich, computeResumo, groupResumo, groupCriativos, groupPersistencia,
  descartePorMotivo, descartePorConjunto, computeAuditoria,
  buildCsv, labelKey,
  type LeadRow, type LeadRowX, type Resumo, type ResumoCriativo, type PersistResumo,
} from "./origemPerformanceAgg";

const fmtMoney = (v: number) => _fmt(v, "short");
const pct = (v: number | null) => (v == null ? "—" : `${(v * 100).toFixed(1)}%`);
const num1 = (v: number | null) => (v == null ? "—" : v.toFixed(1));
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

const ORIGEM_LABEL: Record<string, string> = {
  whatsapp: "WhatsApp",
  atividade: "Atividade",
  mudanca_etapa: "Mudança de etapa",
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

function ResumoTable({ title, rows, keyLabel, extraNote, showOrigem }: {
  title: string; rows: Resumo[]; keyLabel: string; extraNote?: string; showOrigem?: boolean;
}) {
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
              {showOrigem && <>
                <th style={th} title="1º contato via WhatsApp">% WA</th>
                <th style={th} title="1º contato via atividade">% Ativ.</th>
                <th style={th} title="1º contato via mudança de etapa (ex: ligação registrada)">% Etapa</th>
                <th style={th} title="Sem registro de 1º contato">% s/reg</th>
              </>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const totOrig = r.leads || 1;
              return (
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
                  {showOrigem && <>
                    <td style={td}>{pct(r.origWhatsapp / totOrig)}</td>
                    <td style={td}>{pct(r.origAtividade / totOrig)}</td>
                    <td style={{ ...td, color: r.origMudancaEtapa > 0 ? "#4F46E5" : "#111827", fontWeight: r.origMudancaEtapa > 0 ? 600 : 400 }}>{pct(r.origMudancaEtapa / totOrig)}</td>
                    <td style={{ ...td, color: "#9ca3af" }}>{pct(r.origSemRegistro / totOrig)}</td>
                  </>}
                </tr>
              );
            })}
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

function PersistTable({ title, rows, keyLabel, extraNote }: { title: string; rows: PersistResumo[]; keyLabel: string; extraNote?: string }) {
  const visiveis = rows.filter((r) => r.leadsNaCadencia > 0);
  if (visiveis.length === 0) return null;
  const fx = (f: { total: number; visita: number; taxa: number | null }) =>
    f.total === 0 ? "—" : `${pct(f.taxa)} (${f.visita}/${f.total})`;
  return (
    <div style={{ background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 12, padding: 14, marginBottom: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#111827", marginBottom: 2 }}>{title}</div>
      {extraNote && <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 8 }}>{extraNote}</div>}
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
    </div>
  );
}

export default function RelatorioOrigemPerformance({ filters, userRole }: Props) {
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
      persistPorCorretor: groupPersistencia(rows, (r) => r.corretor_nome ?? "(sem corretor)"),
      persistPorConjunto: groupPersistencia(rows, (r) => labelKey(r.conjunto_anuncio)),
      descarteMotivo: descartePorMotivo(rows),
      descarteConjunto: descartePorConjunto(rows),
      auditoria: computeAuditoria(rows),
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
      persistPorCorretor: agg.persistPorCorretor,
      persistPorConjunto: agg.persistPorConjunto,
      descarteMotivo: agg.descarteMotivo,
      descarteConjunto: agg.descarteConjunto,
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
  const a = agg.auditoria;
  const showAudit = userRole === "admin";

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

      {showAudit && (
        <div style={{ background: "#eef2ff", border: "0.5px solid #c7d2fe", borderRadius: 12, padding: 12, marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#3730a3", marginBottom: 6 }}>Auditoria · Regra nova de 1º contato (v2 = WhatsApp + Atividade + Mudança de etapa) vs regra antiga (v1)</div>
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
      )}

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

      <div style={{ background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 12, padding: 14, marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#111827", marginBottom: 6 }}>Como o 1º contato foi registrado</div>
        <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 10 }}>
          "Mudança de etapa" captura o corretor que fala por ligação e move o lead — antes esse contato ficava invisível.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8 }}>
          {(["whatsapp","atividade","mudanca_etapa"] as const).map((k) => {
            const n = k === "whatsapp" ? t.origWhatsapp : k === "atividade" ? t.origAtividade : t.origMudancaEtapa;
            return (
              <div key={k} style={{ background: "#fafafe", borderRadius: 8, padding: "8px 10px" }}>
                <div style={{ fontSize: 11, color: "#6b7280" }}>{ORIGEM_LABEL[k]}</div>
                <div style={{ fontSize: 18, fontWeight: 600 }}>{n}</div>
                <div style={{ fontSize: 11, color: "#9ca3af" }}>{pct(t.leads ? n / t.leads : null)}</div>
              </div>
            );
          })}
          <div style={{ background: "#fafafe", borderRadius: 8, padding: "8px 10px" }}>
            <div style={{ fontSize: 11, color: "#6b7280" }}>Sem registro</div>
            <div style={{ fontSize: 18, fontWeight: 600, color: "#9ca3af" }}>{t.origSemRegistro}</div>
            <div style={{ fontSize: 11, color: "#9ca3af" }}>{pct(t.leads ? t.origSemRegistro / t.leads : null)}</div>
          </div>
        </div>
      </div>

      <ResumoTable title="Resumo por campanha" rows={agg.porCampanha} keyLabel="Campanha" />
      <ResumoTable title="Resumo por conjunto de anúncio" rows={agg.porConjunto} keyLabel="Conjunto" />
      <ResumoTable title="Resumo por plataforma" rows={agg.porPlataforma} keyLabel="Plataforma" extraNote="Compare Instagram vs Facebook (taxa de qualificação e de visita)." />
      <CriativoTable rows={agg.criativos} />
      <ResumoTable
        title="Resumo por corretor"
        rows={agg.porCorretor}
        keyLabel="Corretor"
        extraNote='"% Etapa" alta = corretor trabalha por ligação. "% s/reg" alta = não registra contato.'
        showOrigem
      />

      <PersistTable
        title="Persistência da cadência · por corretor"
        rows={agg.persistPorCorretor}
        keyLabel="Corretor"
        extraNote="Denominadores só contam leads que passaram por Sem Contato. Descarta cedo demais? % <3 tent. alto indica processo pobre."
      />
      <PersistTable
        title="Persistência da cadência · por conjunto de anúncio"
        rows={agg.persistPorConjunto}
        keyLabel="Conjunto"
      />

      <div style={{ background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 12, padding: 14, marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#111827", marginBottom: 2 }}>Descarte × Tentativas — motivo</div>
        <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 8 }}>
          Motivo de perfil (sem renda, fora do perfil) com média alta = mídia ruim → corte o conjunto. Motivo "não responde" com média baixa = processo → treine o time.
        </div>
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
              {agg.descarteMotivo.map((r) => (
                <tr key={r.motivo} style={{ borderBottom: "0.5px solid #f5f5fa" }}>
                  <td style={tdL}>{r.motivo}</td>
                  <td style={td}>{r.total}</td>
                  <td style={td}>{num1(r.mediaTentativas)}</td>
                  <td style={{ ...td, color: (r.pctMenosDe3 ?? 0) > 0.4 ? "#ef4444" : "#111827", fontWeight: 600 }}>{pct(r.pctMenosDe3)}</td>
                </tr>
              ))}
              {agg.descarteMotivo.length === 0 && (
                <tr><td style={{ ...tdL, color: "#9ca3af" }} colSpan={4}>Sem descartes no período.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 12, padding: 14, marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#111827", marginBottom: 2 }}>Descarte × Tentativas — por conjunto de anúncio</div>
        <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 8 }}>Cruzamento para decidir se o conjunto é lixo de mídia ou lead mal trabalhado.</div>
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
              {agg.descarteConjunto.slice(0, 60).map((r, i) => (
                <tr key={i} style={{ borderBottom: "0.5px solid #f5f5fa" }}>
                  <td style={tdL}>{r.conjunto}</td>
                  <td style={tdL}>{r.motivo}</td>
                  <td style={td}>{r.qtd}</td>
                  <td style={{ ...td, color: (r.mediaTentativas ?? 0) < 3 ? "#ef4444" : "#111827" }}>{num1(r.mediaTentativas)}</td>
                </tr>
              ))}
              {agg.descarteConjunto.length === 0 && (
                <tr><td style={{ ...tdL, color: "#9ca3af" }} colSpan={4}>Sem descartes no período.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {agg.descarteConjunto.length > 60 && (
          <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 6 }}>Exibindo top 60. Ver todos no CSV.</div>
        )}
      </div>

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
                <td style={{ ...td, fontSize: 11, color: "#6b7280" }}>{r.origem_primeiro_contato ? ORIGEM_LABEL[r.origem_primeiro_contato] : "—"}</td>
                <td style={td}>{r.entrou_na_cadencia ? r.num_tentativas : (r.contato_estabelecido ? "1ª" : "—")}</td>
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
