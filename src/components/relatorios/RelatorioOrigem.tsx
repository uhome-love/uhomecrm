import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp, ChevronUp, ChevronDown } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { ReportFilters, getDateRange, getPeriodoAnterior, fmtMoney } from "./reportUtils";

interface Props {
  filters: ReportFilters;
  userRole: "admin" | "gestor" | "corretor";
}

interface LeadRow {
  id: string;
  origem: string | null;
  stage_id: string | null;
  corretor_id: string | null;
  segmento_id: string | null;
  created_at: string;
}

interface NegocioRow {
  id: string;
  fase: string;
  vgv_final: number | null;
  vgv_estimado: number | null;
  pipeline_lead_id: string | null;
}

interface OrigemRow {
  origem: string;
  nLeads: number;
  pctLeads: number;
  nVendas: number;
  vgvTotal: number;
  taxaConversao: number;
}

type SortCol = "origem" | "nLeads" | "pctLeads" | "nVendas" | "vgvTotal" | "taxaConversao";
type SortDir = "asc" | "desc";

const COLORS = ["#4F46E5", "#6366f1", "#818cf8", "#a5b4fc", "#10b981", "#f59e0b", "#9ca3af"];

function convColor(pct: number): string {
  if (pct >= 5) return "#10b981";
  if (pct >= 2) return "#f59e0b";
  return "#ef4444";
}

function PieTip({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number; payload: { pct: number } }> }) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div style={{ background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 8, padding: "6px 10px", fontSize: 12 }}>
      <div style={{ fontWeight: 500, color: "#111827" }}>{p.name}</div>
      <div style={{ color: "#6b7280" }}>{p.value} leads ({p.payload.pct.toFixed(1)}%)</div>
    </div>
  );
}

export default function RelatorioOrigem({ filters }: Props) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<OrigemRow[]>([]);
  const [totalLeadsAnt, setTotalLeadsAnt] = useState(0);
  const [sortCol, setSortCol] = useState<SortCol>("nLeads");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const { startDate, endDate } = useMemo(() => getDateRange(filters), [filters]);
  const prev = useMemo(() => getPeriodoAnterior(startDate, endDate), [startDate, endDate]);

  useEffect(() => {
    let cancelled = false;

    async function fetchLeads(s: Date, e: Date): Promise<LeadRow[]> {
      let query = supabase
        .from("pipeline_leads")
        .select("id, origem, stage_id, corretor_id, segmento_id, created_at")
        .gte("created_at", s.toISOString())
        .lte("created_at", e.toISOString());

      if (filters.corretor) query = query.eq("corretor_id", filters.corretor);
      if (filters.segmento) query = query.eq("segmento_id", filters.segmento);

      const { data } = await query;
      let leads = (data || []) as LeadRow[];

      if (filters.equipe && !filters.corretor) {
        const { data: members } = await supabase
          .from("team_members")
          .select("user_id")
          .eq("gerente_id", filters.equipe);
        if (members?.length) {
          const { data: profs } = await supabase
            .from("profiles")
            .select("id")
            .in("user_id", members.map((m) => m.user_id));
          const ids = new Set((profs || []).map((p) => p.id));
          leads = leads.filter((l) => l.corretor_id && ids.has(l.corretor_id));
        } else {
          leads = [];
        }
      }
      return leads;
    }

    async function load() {
      setLoading(true);
      const [leads, leadsAnt] = await Promise.all([
        fetchLeads(startDate, endDate),
        fetchLeads(prev.startDate, prev.endDate),
      ]);

      const leadIds = leads.map((l) => l.id);
      const leadOrigemMap = new Map<string, string>();
      leads.forEach((l) => {
        const o = (l.origem && l.origem.trim()) ? l.origem.trim() : "Não informado";
        leadOrigemMap.set(l.id, o);
      });

      let negocios: NegocioRow[] = [];
      if (leadIds.length) {
        const { data } = await supabase
          .from("negocios")
          .select("id, fase, vgv_final, vgv_estimado, pipeline_lead_id")
          .in("pipeline_lead_id", leadIds)
          .in("fase", ["vendido", "assinado"]);
        negocios = (data || []) as NegocioRow[];
      }

      const parcMap = new Map<string, number>();
      if (leadIds.length) {
        const { data: parcs } = await supabase
          .from("pipeline_parcerias")
          .select("pipeline_lead_id, divisao_principal")
          .in("pipeline_lead_id", leadIds)
          .eq("status", "aceita");
        (parcs || []).forEach((p) => {
          if (p.pipeline_lead_id && p.divisao_principal != null) {
            parcMap.set(p.pipeline_lead_id, p.divisao_principal);
          }
        });
      }

      type Acc = { nLeads: number; nVendas: number; vgvTotal: number };
      const map = new Map<string, Acc>();
      leads.forEach((l) => {
        const o = leadOrigemMap.get(l.id) || "Não informado";
        const cur = map.get(o) || { nLeads: 0, nVendas: 0, vgvTotal: 0 };
        cur.nLeads += 1;
        map.set(o, cur);
      });
      negocios.forEach((n) => {
        if (!n.pipeline_lead_id) return;
        const o = leadOrigemMap.get(n.pipeline_lead_id);
        if (!o) return;
        const vgv = n.vgv_final ?? n.vgv_estimado ?? 0;
        const div = parcMap.get(n.pipeline_lead_id);
        const vgvEf = div != null ? Math.round(vgv * div / 100) : vgv;
        const cur = map.get(o) || { nLeads: 0, nVendas: 0, vgvTotal: 0 };
        cur.nVendas += 1;
        cur.vgvTotal += vgvEf;
        map.set(o, cur);
      });

      const totalLeads = leads.length;
      const result: OrigemRow[] = Array.from(map.entries()).map(([origem, a]) => ({
        origem,
        nLeads: a.nLeads,
        pctLeads: totalLeads > 0 ? (a.nLeads / totalLeads) * 100 : 0,
        nVendas: a.nVendas,
        vgvTotal: Math.round(a.vgvTotal),
        taxaConversao: a.nLeads > 0 ? (a.nVendas / a.nLeads) * 100 : 0,
      }));

      if (!cancelled) {
        setRows(result);
        setTotalLeadsAnt(leadsAnt.length);
        setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [startDate, endDate, prev.startDate, prev.endDate, filters.corretor, filters.equipe, filters.segmento]);

  const sorted = useMemo(() => {
    const arr = [...rows];
    arr.sort((a, b) => {
      const va = a[sortCol];
      const vb = b[sortCol];
      if (typeof va === "string" && typeof vb === "string") {
        return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
      }
      const an = va as number;
      const bn = vb as number;
      return sortDir === "asc" ? an - bn : bn - an;
    });
    return arr;
  }, [rows, sortCol, sortDir]);

  function toggleSort(col: SortCol) {
    if (sortCol === col) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("desc"); }
  }

  const totalLeads = rows.reduce((a, r) => a + r.nLeads, 0);
  const origensAtivas = rows.length;
  const melhor = rows.reduce<OrigemRow | null>((best, r) => (!best || r.nLeads > best.nLeads) ? r : best, null);
  const elegiveis = rows.filter((r) => r.nLeads >= 3);
  const maiorConv = elegiveis.reduce<OrigemRow | null>((best, r) => (!best || r.taxaConversao > best.taxaConversao) ? r : best, null);

  function pctVar(curr: number, prev2: number): string {
    if (prev2 === 0 && curr === 0) return "";
    if (prev2 === 0) return "+100% vs anterior";
    const pct = Math.round(((curr - prev2) / prev2) * 100);
    return `${pct >= 0 ? "+" : ""}${pct}% vs anterior`;
  }

  const pieData = useMemo(() => {
    const sortedByLeads = [...rows].sort((a, b) => b.nLeads - a.nLeads);
    const top = sortedByLeads.slice(0, 6);
    const rest = sortedByLeads.slice(6);
    const data = top.map((r) => ({ name: r.origem, value: r.nLeads, pct: r.pctLeads }));
    if (rest.length > 0) {
      const restLeads = rest.reduce((a, r) => a + r.nLeads, 0);
      const restPct = rest.reduce((a, r) => a + r.pctLeads, 0);
      data.push({ name: "Outros", value: restLeads, pct: restPct });
    }
    return data;
  }, [rows]);

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} style={{ background: "#fff", borderRadius: 10, border: "0.5px solid #e5e7eb", padding: "14px 16px", height: 88 }}>
              <div style={{ background: "#f3f4f6", borderRadius: 4, height: 10, width: "50%", marginBottom: 12 }} className="animate-pulse" />
              <div style={{ background: "#f3f4f6", borderRadius: 4, height: 22, width: "70%" }} className="animate-pulse" />
            </div>
          ))}
        </div>
        <div style={{ background: "#fff", borderRadius: 10, border: "0.5px solid #e5e7eb", padding: 16, height: 280 }} className="animate-pulse" />
        <div style={{ background: "#fff", borderRadius: 10, border: "0.5px solid #e5e7eb", padding: 16 }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} style={{ display: "flex", gap: 16, padding: "10px 0", borderBottom: "0.5px solid #f3f4f6" }}>
              {[1, 2, 3, 4, 5, 6].map((j) => (
                <div key={j} style={{ background: "#f3f4f6", borderRadius: 4, height: 14, flex: 1 }} className="animate-pulse" />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 60, gap: 12 }}>
        <TrendingUp size={40} strokeWidth={1} color="#C7D2FE" />
        <div style={{ color: "#6b7280", fontSize: 14 }}>Nenhum lead no período selecionado</div>
      </div>
    );
  }

  const kpis = [
    { label: "Total de leads", value: String(totalLeads), sub: pctVar(totalLeads, totalLeadsAnt) },
    { label: "Origens ativas", value: String(origensAtivas), sub: "" },
    { label: "Melhor origem", value: melhor?.origem || "—", sub: melhor ? `${melhor.nLeads} leads` : "" },
    { label: "Maior conversão", value: maiorConv?.origem || "—", sub: maiorConv ? `${maiorConv.taxaConversao.toFixed(1)}% de conversão` : "" },
  ];

  // origem -> color index by sorted-by-leads order
  const colorIndex = new Map<string, number>();
  [...rows].sort((a, b) => b.nLeads - a.nLeads).forEach((r, i) => colorIndex.set(r.origem, i));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
        {kpis.map((k, i) => (
          <div key={i} style={{ background: "#fff", borderRadius: 10, border: "0.5px solid #e5e7eb", padding: "14px 16px" }}>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", color: "#9ca3af" }}>{k.label}</div>
            <div style={{ fontSize: 22, fontWeight: 500, color: "#111827", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{k.value}</div>
            {k.sub && <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{k.sub}</div>}
          </div>
        ))}
      </div>

      <div style={{ background: "#fff", borderRadius: 10, border: "0.5px solid #e5e7eb", padding: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: "#111827", marginBottom: 12 }}>Distribuição de leads por origem</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "center" }}>
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={40}>
                  {pieData.map((_, idx) => (
                    <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<PieTip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {pieData.map((d, idx) => (
              <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: COLORS[idx % COLORS.length], flexShrink: 0 }} />
                <span style={{ color: "#111827", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</span>
                <span style={{ color: "#6b7280" }}>{d.value} ({d.pct.toFixed(1)}%)</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ background: "#fff", borderRadius: 10, border: "0.5px solid #e5e7eb", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {([
                ["origem", "Origem"],
                ["nLeads", "Leads"],
                ["pctLeads", "% do total"],
                ["nVendas", "Vendas"],
                ["vgvTotal", "VGV"],
                ["taxaConversao", "Conversão"],
              ] as Array<[SortCol, string]>).map(([col, label]) => (
                <th
                  key={col}
                  onClick={() => toggleSort(col)}
                  style={{ fontSize: 11, color: "#9ca3af", fontWeight: 500, padding: "8px 16px", borderBottom: "0.5px solid #e5e7eb", background: "#fafafa", textAlign: "left", cursor: "pointer", userSelect: "none" }}
                >
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                    {label}
                    {sortCol === col && (sortDir === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => {
              const cIdx = colorIndex.get(r.origem) ?? 6;
              const color = COLORS[cIdx % COLORS.length];
              return (
                <tr key={r.origem} style={{ background: "#fff" }} onMouseEnter={(e) => (e.currentTarget.style.background = "#f9fafb")} onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}>
                  <td style={{ fontSize: 13, padding: "10px 16px", borderBottom: "0.5px solid #f3f4f6" }}>
                    <span style={{ display: "inline-block", fontSize: 11, padding: "2px 8px", borderRadius: 10, background: `${color}20`, color, whiteSpace: "nowrap" }}>{r.origem}</span>
                  </td>
                  <td style={{ fontSize: 13, padding: "10px 16px", borderBottom: "0.5px solid #f3f4f6", color: "#111827" }}>{r.nLeads}</td>
                  <td style={{ fontSize: 13, padding: "10px 16px", borderBottom: "0.5px solid #f3f4f6", color: "#6b7280" }}>{r.pctLeads.toFixed(1)}%</td>
                  <td style={{ fontSize: 13, padding: "10px 16px", borderBottom: "0.5px solid #f3f4f6", color: "#6b7280" }}>{r.nVendas}</td>
                  <td style={{ fontSize: 13, padding: "10px 16px", borderBottom: "0.5px solid #f3f4f6", color: "#111827", fontWeight: 500 }}>{r.vgvTotal > 0 ? fmtMoney(r.vgvTotal) : "—"}</td>
                  <td style={{ fontSize: 13, padding: "10px 16px", borderBottom: "0.5px solid #f3f4f6", color: r.nLeads > 0 ? convColor(r.taxaConversao) : "#9ca3af", fontWeight: 500 }}>
                    {r.nLeads > 0 ? `${r.taxaConversao.toFixed(1)}%` : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
