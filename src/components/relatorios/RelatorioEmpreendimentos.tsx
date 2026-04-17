import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Building2, ChevronUp, ChevronDown } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { ReportFilters, getDateRange, fmtMoney } from "./reportUtils";

interface Props {
  filters: ReportFilters;
  userRole: "admin" | "gestor" | "corretor";
}

interface NegocioRow {
  id: string;
  empreendimento: string | null;
  fase: string;
  vgv_final: number | null;
  vgv_estimado: number | null;
  data_assinatura: string | null;
  corretor_id: string | null;
  pipeline_lead_id: string | null;
  created_at: string;
}

interface EmpRow {
  empreendimento: string;
  totalVendas: number;
  vgvTotal: number;
  ticketMedio: number;
  nLeads: number;
  taxaConversao: number | null;
}

type SortCol = "empreendimento" | "totalVendas" | "vgvTotal" | "ticketMedio" | "nLeads" | "taxaConversao";
type SortDir = "asc" | "desc";

function ChartTip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 8, padding: "6px 10px", fontSize: 12 }}>
      <div style={{ color: "#6b7280" }}>{label}</div>
      <div style={{ fontWeight: 500, color: "#111827" }}>{fmtMoney(payload[0].value)}</div>
    </div>
  );
}

function convColor(pct: number | null): string {
  if (pct === null) return "#9ca3af";
  if (pct >= 5) return "#10b981";
  if (pct >= 2) return "#f59e0b";
  return "#ef4444";
}

export default function RelatorioEmpreendimentos({ filters }: Props) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<EmpRow[]>([]);
  const [sortCol, setSortCol] = useState<SortCol>("vgvTotal");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const { startDate, endDate } = useMemo(() => getDateRange(filters), [filters]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const sISO = startDate.toISOString().slice(0, 10);
      const eISO = endDate.toISOString().slice(0, 10);

      let query = supabase
        .from("negocios")
        .select("id, empreendimento, fase, vgv_final, vgv_estimado, data_assinatura, corretor_id, pipeline_lead_id, created_at")
        .in("fase", ["vendido", "assinado"])
        .gte("data_assinatura", sISO)
        .lte("data_assinatura", eISO);

      if (filters.corretor) query = query.eq("corretor_id", filters.corretor);

      const { data: negocios } = await query;
      let negs = (negocios || []) as NegocioRow[];

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
          negs = negs.filter((n) => n.corretor_id && ids.has(n.corretor_id));
        } else {
          negs = [];
        }
      }

      const leadIds = [...new Set(negs.map((n) => n.pipeline_lead_id).filter(Boolean))] as string[];

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

      // Count leads per empreendimento (pipeline_leads.empreendimento text in same period)
      const leadsByEmp = new Map<string, number>();
      const { data: leadsAll } = await supabase
        .from("pipeline_leads")
        .select("empreendimento")
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString())
        .not("empreendimento", "is", null);
      (leadsAll || []).forEach((l) => {
        const e = (l.empreendimento as string | null) || "";
        if (!e) return;
        leadsByEmp.set(e, (leadsByEmp.get(e) || 0) + 1);
      });

      // Group negocios by empreendimento
      type Acc = { totalVendas: number; vgvTotal: number };
      const empMap = new Map<string, Acc>();
      negs.forEach((n) => {
        const empName = n.empreendimento || "—";
        const vgv = n.vgv_final ?? n.vgv_estimado ?? 0;
        const div = n.pipeline_lead_id ? parcMap.get(n.pipeline_lead_id) : undefined;
        const vgvEf = div != null ? Math.round(vgv * div / 100) : vgv;
        const cur = empMap.get(empName) || { totalVendas: 0, vgvTotal: 0 };
        cur.totalVendas += 1;
        cur.vgvTotal += vgvEf;
        empMap.set(empName, cur);
      });

      const result: EmpRow[] = Array.from(empMap.entries()).map(([empreendimento, a]) => {
        const nLeads = leadsByEmp.get(empreendimento) || 0;
        return {
          empreendimento,
          totalVendas: a.totalVendas,
          vgvTotal: Math.round(a.vgvTotal),
          ticketMedio: a.totalVendas > 0 ? Math.round(a.vgvTotal / a.totalVendas) : 0,
          nLeads,
          taxaConversao: nLeads > 0 ? (a.totalVendas / nLeads) * 100 : null,
        };
      });

      if (!cancelled) {
        setRows(result);
        setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [startDate, endDate, filters.corretor, filters.equipe, filters.segmento]);

  const sorted = useMemo(() => {
    const arr = [...rows];
    arr.sort((a, b) => {
      const va = a[sortCol];
      const vb = b[sortCol];
      const av = va === null ? -Infinity : va;
      const bv = vb === null ? -Infinity : vb;
      if (typeof av === "string" && typeof bv === "string") {
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      const an = av as number;
      const bn = bv as number;
      return sortDir === "asc" ? an - bn : bn - an;
    });
    return arr;
  }, [rows, sortCol, sortDir]);

  function toggleSort(col: SortCol) {
    if (sortCol === col) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("desc"); }
  }

  const totalVgv = rows.reduce((a, r) => a + r.vgvTotal, 0);
  const totalVendas = rows.reduce((a, r) => a + r.totalVendas, 0);
  const ticketGeral = totalVendas > 0 ? Math.round(totalVgv / totalVendas) : 0;
  const empAtivos = rows.length;
  const melhor = rows.reduce<EmpRow | null>((best, r) => (!best || r.vgvTotal > best.vgvTotal) ? r : best, null);

  const chartData = useMemo(() => {
    return [...rows]
      .sort((a, b) => b.vgvTotal - a.vgvTotal)
      .slice(0, 8)
      .map((r) => ({ name: r.empreendimento, vgv: r.vgvTotal }));
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
        <Building2 size={40} strokeWidth={1} color="#C7D2FE" />
        <div style={{ color: "#6b7280", fontSize: 14 }}>Nenhuma venda no período selecionado</div>
      </div>
    );
  }

  const kpis = [
    { label: "Empreendimentos ativos", value: String(empAtivos), sub: "" },
    { label: "VGV total", value: fmtMoney(totalVgv), sub: `${totalVendas} vendas` },
    { label: "Melhor empreendimento", value: melhor?.empreendimento || "—", sub: melhor ? fmtMoney(melhor.vgvTotal) : "" },
    { label: "Ticket médio geral", value: fmtMoney(ticketGeral), sub: "" },
  ];

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

      {chartData.length > 0 && (
        <div style={{ background: "#fff", borderRadius: 10, border: "0.5px solid #e5e7eb", padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: "#111827", marginBottom: 12 }}>Ranking por VGV — top 8</div>
          <div style={{ height: Math.max(220, chartData.length * 32) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 0 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTip />} cursor={{ fill: "#f3f4f6" }} />
                <Bar dataKey="vgv" fill="#4F46E5" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div style={{ background: "#fff", borderRadius: 10, border: "0.5px solid #e5e7eb", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {([
                ["empreendimento", "Empreendimento"],
                ["totalVendas", "Vendas"],
                ["vgvTotal", "VGV total"],
                ["ticketMedio", "Ticket médio"],
                ["nLeads", "Leads"],
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
            {sorted.map((r) => (
              <tr key={r.empreendimento} style={{ background: "#fff" }} onMouseEnter={(e) => (e.currentTarget.style.background = "#f9fafb")} onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}>
                <td style={{ fontSize: 13, padding: "10px 16px", borderBottom: "0.5px solid #f3f4f6", color: "#111827" }}>{r.empreendimento}</td>
                <td style={{ fontSize: 13, padding: "10px 16px", borderBottom: "0.5px solid #f3f4f6", color: "#6b7280" }}>{r.totalVendas}</td>
                <td style={{ fontSize: 13, padding: "10px 16px", borderBottom: "0.5px solid #f3f4f6", color: "#111827", fontWeight: 500 }}>{fmtMoney(r.vgvTotal)}</td>
                <td style={{ fontSize: 13, padding: "10px 16px", borderBottom: "0.5px solid #f3f4f6", color: "#6b7280" }}>{fmtMoney(r.ticketMedio)}</td>
                <td style={{ fontSize: 13, padding: "10px 16px", borderBottom: "0.5px solid #f3f4f6", color: "#6b7280" }}>{r.nLeads}</td>
                <td style={{ fontSize: 13, padding: "10px 16px", borderBottom: "0.5px solid #f3f4f6", color: convColor(r.taxaConversao), fontWeight: 500 }}>
                  {r.taxaConversao === null ? "—" : `${r.taxaConversao.toFixed(1)}%`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
