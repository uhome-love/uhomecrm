import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp } from "lucide-react";
import { ReportFilters, getDateRange } from "./reportUtils";
import { fetchAllRows } from "@/lib/paginatedFetch";

interface RelatorioConversaoProps {
  filters: ReportFilters;
  userRole: "admin" | "gestor" | "corretor";
}

interface LeadRow {
  id: string;
  stage_id: string | null;
  corretor_id: string | null;
  segmento_id: string | null;
  created_at: string;
}

interface NegocioRow {
  id: string;
  fase: string;
  corretor_id: string | null;
  created_at: string;
  data_assinatura: string | null;
}

interface FunilEtapaLead {
  nome: string;
  count: number;
  pct: number;
  tempoMedio: number;
  cor: string;
  textoBranco: boolean;
}

interface FunilFaseNegocio {
  fase: string;
  label: string;
  count: number;
  pct: number;
  cor: string;
  textoBranco: boolean;
}

const ETAPAS_LEAD = [
  "Novo Lead",
  "Sem Contato",
  "Contato Iniciado",
  "Busca",
  "Aquecimento",
  "Visita",
  "Pós-Visita",
  "Negócio Criado",
  "Descarte",
];

const COR_ETAPA: Record<string, string> = {
  "Novo Lead": "#e0e7ff",
  "Sem Contato": "#c7d2fe",
  "Contato Iniciado": "#a5b4fc",
  "Busca": "#818cf8",
  "Aquecimento": "#6366f1",
  "Visita": "#4F46E5",
  "Pós-Visita": "#4338ca",
  "Negócio Criado": "#10b981",
  "Descarte": "#fca5a5",
};

const ETAPAS_ESCURAS = new Set(["Aquecimento", "Visita", "Pós-Visita", "Negócio Criado"]);

const ETAPAS_NEGOCIO: Array<{ fase: string; label: string; cor: string }> = [
  { fase: "novo_negocio", label: "Novo Negócio", cor: "#fef3c7" },
  { fase: "proposta", label: "Proposta", cor: "#fde68a" },
  { fase: "negociacao", label: "Em Negociação", cor: "#fbbf24" },
  { fase: "documentacao", label: "Documentação", cor: "#f59e0b" },
  { fase: "vendido", label: "Venda Realizada", cor: "#10b981" },
  { fase: "perdido", label: "Perdido", cor: "#fca5a5" },
];

const FASES_ESCURAS = new Set(["negociacao", "documentacao", "vendido"]);

export default function RelatorioConversao({ filters }: RelatorioConversaoProps) {
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [stageNames, setStageNames] = useState<Map<string, string>>(new Map());
  const [negocios, setNegocios] = useState<NegocioRow[]>([]);

  const { startDate, endDate } = useMemo(() => getDateRange(filters), [filters]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);

      let corretorIds: string[] | null = null;
      if (filters.corretor) {
        corretorIds = [filters.corretor];
      } else if (filters.equipe) {
        const { data: membros } = await supabase
          .from("team_members").select("user_id").eq("gerente_id", filters.equipe);
        if (membros?.length) {
          const { data: profiles } = await supabase
            .from("profiles").select("id").in("user_id", membros.map((m) => m.user_id));
          corretorIds = (profiles || []).map((p) => p.id);
          if (!corretorIds.length) {
            if (!cancelled) { setLeads([]); setNegocios([]); setLoading(false); }
            return;
          }
        } else {
          if (!cancelled) { setLeads([]); setNegocios([]); setLoading(false); }
          return;
        }
      }

      const { data: stages } = await supabase
        .from("pipeline_stages").select("id, nome")
        .eq("pipeline_tipo", "leads").eq("ativo", true);
      const sMap = new Map<string, string>();
      (stages || []).forEach((st) => sMap.set(st.id, st.nome as string));

      let leadRows = await fetchAllRows<LeadRow>((from, to) => {
        let lq = supabase
          .from("pipeline_leads")
          .select("id, stage_id, corretor_id, segmento_id, created_at")
          .gte("created_at", startDate.toISOString())
          .lte("created_at", endDate.toISOString());
        if (corretorIds) lq = lq.in("corretor_id", corretorIds);
        return lq.range(from, to);
      });

      if (filters.segmento && leadRows.length) {
        const segIds = [...new Set(leadRows.map((r) => r.segmento_id).filter(Boolean))] as string[];
        const segNameMap = new Map<string, string>();
        if (segIds.length) {
          const { data: segs } = await supabase.from("roleta_segmentos").select("id, nome").in("id", segIds);
          (segs || []).forEach((sg) => segNameMap.set(sg.id, sg.nome as string));
        }
        const q = filters.segmento.toLowerCase();
        leadRows = leadRows.filter((r) => {
          if (!r.segmento_id) return false;
          const nm = segNameMap.get(r.segmento_id) || "";
          return nm.toLowerCase().includes(q);
        });
      }

      const negRows = await fetchAllRows<NegocioRow>((from, to) => {
        let nq = supabase
          .from("negocios")
          .select("id, fase, corretor_id, created_at, data_assinatura")
          .gte("created_at", startDate.toISOString())
          .lte("created_at", endDate.toISOString());
        if (corretorIds) nq = nq.in("corretor_id", corretorIds);
        return nq.range(from, to);
      });

      if (!cancelled) {
        setStageNames(sMap);
        setLeads(leadRows);
        setNegocios(negRows);
        setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [filters.corretor, filters.equipe, filters.segmento, startDate, endDate]);

  const funilLeads: FunilEtapaLead[] = useMemo(() => {
    const total = leads.length;
    const now = Date.now();
    return ETAPAS_LEAD.map((etapa) => {
      const inEtapa = leads.filter((l) => l.stage_id && stageNames.get(l.stage_id) === etapa);
      const count = inEtapa.length;
      const pct = total > 0 ? (count / total) * 100 : 0;
      const tempoMedio = count > 0
        ? inEtapa.reduce((a, l) => a + (now - new Date(l.created_at).getTime()) / 86400000, 0) / count
        : 0;
      return {
        nome: etapa, count, pct, tempoMedio,
        cor: COR_ETAPA[etapa],
        textoBranco: ETAPAS_ESCURAS.has(etapa),
      };
    });
  }, [leads, stageNames]);

  const maxCountLead = useMemo(() => Math.max(1, ...funilLeads.map((e) => e.count)), [funilLeads]);

  const funilNegocios: FunilFaseNegocio[] = useMemo(() => {
    const total = negocios.length;
    return ETAPAS_NEGOCIO.map((e) => {
      const count = negocios.filter((n) => n.fase === e.fase).length;
      const pct = total > 0 ? (count / total) * 100 : 0;
      return {
        fase: e.fase, label: e.label, count, pct, cor: e.cor,
        textoBranco: FASES_ESCURAS.has(e.fase),
      };
    });
  }, [negocios]);

  const maxCountNeg = useMemo(() => Math.max(1, ...funilNegocios.map((e) => e.count)), [funilNegocios]);

  const totalLeads = leads.length;
  const visitaPlus = leads.filter((l) => {
    const nm = l.stage_id ? stageNames.get(l.stage_id) : null;
    return nm === "Visita" || nm === "Pós-Visita" || nm === "Negócio Criado";
  }).length;
  const negocioCriado = leads.filter((l) => l.stage_id && stageNames.get(l.stage_id) === "Negócio Criado").length;
  const taxaLeadVisita = totalLeads > 0 ? (visitaPlus / totalLeads) * 100 : 0;
  const taxaLeadVenda = totalLeads > 0 ? (negocioCriado / totalLeads) * 100 : 0;

  const negociosAtivos = negocios.filter((n) => n.fase !== "novo_negocio").length;
  const vendaRealizada = negocios.filter((n) => n.fase === "vendido").length;
  const taxaNegocioVenda = negociosAtivos > 0 ? (vendaRealizada / negociosAtivos) * 100 : 0;

  const gargalos = useMemo(() => {
    return [...funilLeads]
      .filter((e) => e.nome !== "Descarte")
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
  }, [funilLeads]);

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {[1, 2].map((i) => (
          <div key={i} style={{ background: "#fff", borderRadius: 10, border: "0.5px solid #e5e7eb", padding: 20 }}>
            <div style={{ background: "#f3f4f6", borderRadius: 4, height: 14, width: 180, marginBottom: 16 }} className="animate-pulse" />
            {[1, 2, 3, 4, 5, 6].map((j) => (
              <div key={j} style={{ background: "#f3f4f6", borderRadius: 6, height: 28, marginBottom: 8, width: `${100 - j * 10}%` }} className="animate-pulse" />
            ))}
          </div>
        ))}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          {[1, 2, 3].map((i) => (
            <div key={i} style={{ background: "#fff", borderRadius: 10, border: "0.5px solid #e5e7eb", padding: "14px 16px", height: 88 }}>
              <div style={{ background: "#f3f4f6", borderRadius: 4, height: 10, width: "50%", marginBottom: 12 }} className="animate-pulse" />
              <div style={{ background: "#f3f4f6", borderRadius: 4, height: 22, width: "40%" }} className="animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (totalLeads === 0 && negocios.length === 0) {
    return (
      <div style={{ background: "#fff", borderRadius: 10, border: "0.5px solid #e5e7eb", padding: 60, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
        <TrendingUp size={40} strokeWidth={1} color="#C7D2FE" />
        <div style={{ fontSize: 13, color: "#6b7280" }}>Nenhum dado disponível</div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ background: "#fff", borderRadius: 10, border: "0.5px solid #e5e7eb", padding: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: "#111827", marginBottom: 16 }}>
          Funil de Leads ({totalLeads})
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {funilLeads.map((e) => (
            <FunilBarLead key={e.nome} etapa={e} maxCount={maxCountLead} />
          ))}
        </div>
      </div>

      <div style={{ background: "#fff", borderRadius: 10, border: "0.5px solid #e5e7eb", padding: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: "#111827", marginBottom: 16 }}>
          Funil de Negócios ({negocios.length})
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {funilNegocios.map((e) => (
            <FunilBarNeg key={e.fase} fase={e} maxCount={maxCountNeg} />
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        <KpiCard label="TAXA LEAD → VISITA" value={`${taxaLeadVisita.toFixed(1).replace(".", ",")}%`} />
        <KpiCard label="TAXA NEGÓCIO → VENDA" value={`${taxaNegocioVenda.toFixed(1).replace(".", ",")}%`} />
        <KpiCard label="TAXA GERAL LEAD → VENDA" value={`${taxaLeadVenda.toFixed(1).replace(".", ",")}%`} />
      </div>

      <div style={{ background: "#fff", borderRadius: 10, border: "0.5px solid #e5e7eb", padding: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: "#111827", marginBottom: 16 }}>Onde os leads acumulam</div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={thStyle}>Etapa</th>
              <th style={thStyle}>Leads acumulados</th>
              <th style={thStyle}>% do total</th>
              <th style={thStyle}>Tempo médio na etapa</th>
            </tr>
          </thead>
          <tbody>
            {gargalos.map((g) => (
              <tr key={g.nome} style={{ borderBottom: "0.5px solid #f3f4f6" }}>
                <td style={tdStyle}>
                  <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: g.cor, marginRight: 8 }} />
                  {g.nome}
                </td>
                <td style={tdStyle}>{g.count}</td>
                <td style={tdStyle}>{g.pct.toFixed(1).replace(".", ",")}%</td>
                <td style={tdStyle}>{Math.round(g.tempoMedio)} dias</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = { fontSize: 11, color: "#9ca3af", fontWeight: 500, padding: "8px 16px", borderBottom: "0.5px solid #e5e7eb", background: "#fafafa", textAlign: "left" };
const tdStyle: React.CSSProperties = { fontSize: 13, color: "#374151", padding: "10px 16px" };

function FunilBarLead({ etapa, maxCount }: { etapa: FunilEtapaLead; maxCount: number }) {
  const widthPct = (etapa.count / maxCount) * 100;
  const insideBar = etapa.pct >= 15;
  const textColor = etapa.textoBranco ? "#fff" : "#4338ca";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ width: 140, fontSize: 12, color: "#374151", textAlign: "right" }}>{etapa.nome}</div>
      <div style={{ flex: 1, position: "relative", height: 28, background: "#f9fafb", borderRadius: 6, overflow: "hidden" }}>
        <div
          style={{
            width: `${Math.max(widthPct, 0.5)}%`,
            height: "100%",
            background: etapa.cor,
            borderRadius: 6,
            display: "flex",
            alignItems: "center",
            justifyContent: insideBar ? "space-between" : "flex-start",
            paddingLeft: insideBar ? 10 : 0,
            paddingRight: insideBar ? 10 : 0,
            transition: "width 0.3s",
          }}
        >
          {insideBar && (
            <>
              <span style={{ fontSize: 11, fontWeight: 500, color: textColor }}>{etapa.count}</span>
              <span style={{ fontSize: 11, color: textColor }}>{etapa.pct.toFixed(1).replace(".", ",")}%</span>
            </>
          )}
        </div>
        {!insideBar && (
          <div style={{ position: "absolute", left: `calc(${Math.max(widthPct, 0.5)}% + 8px)`, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: "#6b7280", whiteSpace: "nowrap" }}>
            {etapa.count} · {etapa.pct.toFixed(1).replace(".", ",")}%
          </div>
        )}
      </div>
      <div style={{ width: 80, fontSize: 11, color: "#9ca3af", textAlign: "right" }}>
        {etapa.count > 0 ? `${Math.round(etapa.tempoMedio)} dias` : "—"}
      </div>
    </div>
  );
}

function FunilBarNeg({ fase, maxCount }: { fase: FunilFaseNegocio; maxCount: number }) {
  const widthPct = (fase.count / maxCount) * 100;
  const insideBar = fase.pct >= 15;
  const textColor = fase.textoBranco ? "#fff" : "#92400e";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ width: 140, fontSize: 12, color: "#374151", textAlign: "right" }}>{fase.label}</div>
      <div style={{ flex: 1, position: "relative", height: 28, background: "#f9fafb", borderRadius: 6, overflow: "hidden" }}>
        <div
          style={{
            width: `${Math.max(widthPct, 0.5)}%`,
            height: "100%",
            background: fase.cor,
            borderRadius: 6,
            display: "flex",
            alignItems: "center",
            justifyContent: insideBar ? "space-between" : "flex-start",
            paddingLeft: insideBar ? 10 : 0,
            paddingRight: insideBar ? 10 : 0,
          }}
        >
          {insideBar && (
            <>
              <span style={{ fontSize: 11, fontWeight: 500, color: textColor }}>{fase.count}</span>
              <span style={{ fontSize: 11, color: textColor }}>{fase.pct.toFixed(1).replace(".", ",")}%</span>
            </>
          )}
        </div>
        {!insideBar && (
          <div style={{ position: "absolute", left: `calc(${Math.max(widthPct, 0.5)}% + 8px)`, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: "#6b7280", whiteSpace: "nowrap" }}>
            {fase.count} · {fase.pct.toFixed(1).replace(".", ",")}%
          </div>
        )}
      </div>
      <div style={{ width: 80 }} />
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: "#fff", borderRadius: 10, border: "0.5px solid #e5e7eb", padding: "14px 16px" }}>
      <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", color: "#9ca3af", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 500, color: "#111827" }}>{value}</div>
    </div>
  );
}
