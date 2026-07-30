import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Download, Loader2 } from "lucide-react";
import { getDateRange, type ReportFilters } from "./reportUtils";
import {
  enrich, computeResumo, groupResumo, groupCriativos, groupPersistencia,
  descartePorMotivo, descartePorConjunto, computeAuditoria,
  buildCsv, labelKey, type LeadRow,
} from "./origemPerformanceAgg";
import { KpiHeader, FunilResumo } from "./origem/KpiHeader";
import { ResumoTable } from "./origem/ResumoTable";
import { CriativoTable } from "./origem/CriativoTable";
import { PersistTable } from "./origem/PersistTable";
import { DescarteMotivoTable, DescarteConjuntoTable } from "./origem/DescarteTables";
import { AuditoriaBlock, OrigemContatoBlock } from "./origem/AuditoriaBlock";
import { DetalhadoTable } from "./origem/DetalhadoTable";

const ymd = (d: Date) => d.toISOString().slice(0, 10);

interface Props {
  filters: ReportFilters;
  userRole: "admin" | "gestor" | "corretor";
}

const SUBABAS = [
  { id: "visao", label: "Visão geral" },
  { id: "midia", label: "Mídia" },
  { id: "time", label: "Time" },
  { id: "qualidade", label: "Qualidade dos dados" },
  { id: "leads", label: "Leads" },
] as const;
type SubAba = (typeof SUBABAS)[number]["id"];

/**
 * Rastreamento & Funil — organizado em KPIs + 5 sub-abas.
 * Durante a exportação em PDF (evento `origem-perf:print`) tudo é renderizado
 * ao mesmo tempo e expandido, para o documento sair completo.
 */
export default function RelatorioOrigemPerformance({ filters, userRole }: Props) {
  const { startDate, endDate } = useMemo(() => getDateRange(filters), [filters]);
  const startS = ymd(startDate);
  const endS = ymd(endDate);
  const [aba, setAba] = useState<SubAba>("visao");
  const [printAll, setPrintAll] = useState(false);

  useEffect(() => {
    const on = () => setPrintAll(true);
    const off = () => setPrintAll(false);
    window.addEventListener("origem-perf:print-start", on);
    window.addEventListener("origem-perf:print-end", off);
    return () => {
      window.removeEventListener("origem-perf:print-start", on);
      window.removeEventListener("origem-perf:print-end", off);
    };
  }, []);

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
  const showAudit = userRole === "admin";
  const show = (id: SubAba) => printAll || aba === id;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: "#111827" }}>Rastreamento &amp; funil</div>
          <div style={{ fontSize: 12, color: "#6b7280" }}>Qualidade por exclusão · taxa qualif. = qualificados ÷ (qualificados + desqualificados)</div>
        </div>
        <button onClick={exportCsv} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#4F46E5", color: "#fff", border: "none", borderRadius: 8, padding: "8px 12px", fontSize: 13, cursor: "pointer" }}>
          <Download size={14} /> Exportar CSV
        </button>
      </div>

      <KpiHeader t={t} />

      {!printAll && (
        <div style={{ display: "flex", gap: 4, background: "#fff", border: "0.5px solid #e5e7eb", padding: 4, borderRadius: 10, marginBottom: 14, flexWrap: "wrap" }}>
          {SUBABAS.map((s) => (
            <button
              key={s.id}
              onClick={() => setAba(s.id)}
              style={{
                padding: "6px 12px", fontSize: 12, borderRadius: 8, cursor: "pointer", border: "none",
                background: aba === s.id ? "#eef2ff" : "transparent",
                color: aba === s.id ? "#4338ca" : "#6b7280",
                fontWeight: aba === s.id ? 600 : 400,
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      {show("visao") && (
        <>
          <FunilResumo t={t} />
          <ResumoTable title="Top campanhas" rows={agg.porCampanha} keyLabel="Campanha" defaultTopN={5} forceOpen={printAll} />
          <ResumoTable title="Top conjuntos de anúncio" rows={agg.porConjunto} keyLabel="Conjunto" defaultTopN={5} forceOpen={printAll} />
        </>
      )}

      {show("midia") && (
        <>
          <ResumoTable title="Por campanha" rows={agg.porCampanha} keyLabel="Campanha" defaultTopN={25} forceOpen={printAll} />
          <ResumoTable title="Por conjunto de anúncio" rows={agg.porConjunto} keyLabel="Conjunto" defaultTopN={25} forceOpen={printAll} />
          <ResumoTable title="Por plataforma" rows={agg.porPlataforma} keyLabel="Plataforma" note="Compare Instagram vs Facebook (taxa de qualificação e de visita)." defaultTopN={25} forceOpen={printAll} />
          <CriativoTable rows={agg.criativos} forceOpen={printAll} />
          <PersistTable title="Persistência da cadência · por conjunto de anúncio" rows={agg.persistPorConjunto} keyLabel="Conjunto" forceOpen={printAll} />
          <DescarteConjuntoTable rows={agg.descarteConjunto} forceOpen={printAll} />
        </>
      )}

      {show("time") && (
        <>
          <ResumoTable
            title="Por corretor"
            rows={agg.porCorretor}
            keyLabel="Corretor"
            note='Em "Mais colunas": "% Etapa" alta = corretor trabalha por ligação. "% s/reg" alta = não registra contato.'
            showOrigem
            defaultTopN={25}
            forceOpen={printAll}
          />
          <PersistTable
            title="Persistência da cadência · por corretor"
            rows={agg.persistPorCorretor}
            keyLabel="Corretor"
            note="Denominadores só contam leads que passaram por Sem Contato. % <3 tent. alto indica descarte precoce."
            defaultOpen
            forceOpen={printAll}
          />
          <DescarteMotivoTable rows={agg.descarteMotivo} forceOpen={printAll} />
        </>
      )}

      {show("qualidade") && (
        <>
          {showAudit && <AuditoriaBlock a={agg.auditoria} />}
          <OrigemContatoBlock t={t} forceOpen={printAll} />
          <div style={{ background: "#fff7ed", border: "0.5px solid #fed7aa", borderRadius: 12, padding: 12, marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#9a3412", marginBottom: 8 }}>
              Leads sem origem ({agg.semOrigem.length}) — quebra para diagnóstico
            </div>
            <ResumoTable title="Por plataforma" rows={agg.semOrigemPlataforma} keyLabel="Plataforma" defaultTopN={25} forceOpen={printAll} />
            <ResumoTable title="Por empreendimento" rows={agg.semOrigemEmpreendimento} keyLabel="Empreendimento" defaultTopN={25} forceOpen={printAll} />
          </div>
        </>
      )}

      {show("leads") && <DetalhadoTable rows={rows} forceOpen={printAll} />}
    </div>
  );
}
