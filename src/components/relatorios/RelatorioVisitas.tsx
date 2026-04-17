import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MapPin, ChevronUp, ChevronDown } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { ReportFilters, getDateRange, getPeriodoAnterior, fmtDate } from "./reportUtils";

interface Props {
  filters: ReportFilters;
  userRole: "admin" | "gestor" | "corretor";
}

interface VisitaRow {
  id: string;
  corretor_id: string | null;
  lead_id: string | null;
  empreendimento: string | null;
  data_visita: string | null;
  status: string;
  nome_cliente: string | null;
}

interface CorretorRow {
  corretor: string;
  total: number;
  realizada: number;
  marcada: number;
  no_show: number;
  cancelada: number;
  taxa: number;
}

type SortCol = "corretor" | "total" | "realizada" | "marcada" | "no_show" | "cancelada" | "taxa";
type SortDir = "asc" | "desc";

const STATUS_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  realizada: { bg: "#d1fae5", color: "#065f46", label: "Realizada" },
  marcada: { bg: "#dbeafe", color: "#1e40af", label: "Marcada" },
  no_show: { bg: "#fee2e2", color: "#991b1b", label: "No-show" },
  reagendada: { bg: "#fef3c7", color: "#92400e", label: "Reagendada" },
  cancelada: { bg: "#f3f4f6", color: "#6b7280", label: "Cancelada" },
};

function ChartTip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 8, padding: "6px 10px", fontSize: 12 }}>
      <div style={{ color: "#6b7280" }}>{label}</div>
      <div style={{ fontWeight: 500, color: "#111827" }}>{payload[0].value} visitas</div>
    </div>
  );
}

export default function RelatorioVisitas({ filters }: Props) {
  const [loading, setLoading] = useState(true);
  const [visitas, setVisitas] = useState<VisitaRow[]>([]);
  const [visitasAnt, setVisitasAnt] = useState<VisitaRow[]>([]);
  const [corretorMap, setCorretorMap] = useState<Map<string, string>>(new Map());
  const [sortCol, setSortCol] = useState<SortCol>("total");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const { startDate, endDate } = useMemo(() => getDateRange(filters), [filters]);
  const prev = useMemo(() => getPeriodoAnterior(startDate, endDate), [startDate, endDate]);

  useEffect(() => {
    let cancelled = false;

    async function fetchVisitas(s: Date, e: Date): Promise<VisitaRow[]> {
      const sISO = s.toISOString().slice(0, 10);
      const eISO = e.toISOString().slice(0, 10);
      let query = supabase
        .from("visitas")
        .select("id, corretor_id, lead_id, empreendimento, data_visita, status, nome_cliente")
        .gte("data_visita", sISO)
        .lte("data_visita", eISO);

      if (filters.corretor) query = query.eq("corretor_id", filters.corretor);

      const { data } = await query;
      let rows = (data || []) as VisitaRow[];

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
          rows = rows.filter((r) => r.corretor_id && ids.has(r.corretor_id));
        } else {
          rows = [];
        }
      }
      return rows;
    }

    async function load() {
      setLoading(true);
      const [cur, ant] = await Promise.all([
        fetchVisitas(startDate, endDate),
        fetchVisitas(prev.startDate, prev.endDate),
      ]);

      const ids = [...new Set(cur.map((r) => r.corretor_id).filter(Boolean))] as string[];
      const nameMap = new Map<string, string>();
      if (ids.length) {
        const { data: profs } = await supabase.from("profiles").select("id, nome").in("id", ids);
        (profs || []).forEach((p) => nameMap.set(p.id, p.nome || "—"));
      }

      if (!cancelled) {
        setVisitas(cur);
        setVisitasAnt(ant);
        setCorretorMap(nameMap);
        setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [startDate, endDate, prev.startDate, prev.endDate, filters.corretor, filters.equipe, filters.segmento]);

  const total = visitas.length;
  const totalAnt = visitasAnt.length;
  const realizadas = visitas.filter((v) => v.status === "realizada").length;
  const noShows = visitas.filter((v) => v.status === "no_show").length;
  const taxaRealiz = total > 0 ? (realizadas / total) * 100 : 0;

  function pctVar(curr: number, prev2: number): string {
    if (prev2 === 0 && curr === 0) return "";
    if (prev2 === 0) return "+100% vs anterior";
    const pct = Math.round(((curr - prev2) / prev2) * 100);
    return `${pct >= 0 ? "+" : ""}${pct}% vs anterior`;
  }

  // Chart por empreendimento
  const empData = useMemo(() => {
    const map = new Map<string, number>();
    visitas.forEach((v) => {
      const e = v.empreendimento || "—";
      map.set(e, (map.get(e) || 0) + 1);
    });
    return Array.from(map.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 8);
  }, [visitas]);

  // Tabela por corretor
  const corretorData = useMemo<CorretorRow[]>(() => {
    const map = new Map<string, CorretorRow>();
    visitas.forEach((v) => {
      const id = v.corretor_id;
      if (!id) return;
      const nome = corretorMap.get(id) || "—";
      const cur = map.get(id) || { corretor: nome, total: 0, realizada: 0, marcada: 0, no_show: 0, cancelada: 0, taxa: 0 };
      cur.total += 1;
      if (v.status === "realizada") cur.realizada += 1;
      else if (v.status === "marcada") cur.marcada += 1;
      else if (v.status === "no_show") cur.no_show += 1;
      else if (v.status === "cancelada") cur.cancelada += 1;
      map.set(id, cur);
    });
    return Array.from(map.values()).map((r) => ({ ...r, taxa: r.total > 0 ? (r.realizada / r.total) * 100 : 0 }));
  }, [visitas, corretorMap]);

  const sorted = useMemo(() => {
    const arr = [...corretorData];
    arr.sort((a, b) => {
      const va = a[sortCol];
      const vb = b[sortCol];
      if (typeof va === "string" && typeof vb === "string") {
        return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
      }
      return sortDir === "asc" ? (va as number) - (vb as number) : (vb as number) - (va as number);
    });
    return arr;
  }, [corretorData, sortCol, sortDir]);

  function toggleSort(col: SortCol) {
    if (sortCol === col) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("desc"); }
  }

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
      </div>
    );
  }

  if (visitas.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 60, gap: 12 }}>
        <MapPin size={40} strokeWidth={1} color="#C7D2FE" />
        <div style={{ color: "#6b7280", fontSize: 14 }}>Nenhuma visita no período selecionado</div>
      </div>
    );
  }

  const kpis = [
    { label: "Total de visitas", value: String(total), sub: pctVar(total, totalAnt) },
    { label: "Realizadas", value: String(realizadas), sub: `${taxaRealiz.toFixed(1)}% do total` },
    { label: "No-shows", value: String(noShows), sub: total > 0 ? `${Math.round((noShows / total) * 100)}% do total` : "" },
    { label: "Taxa de comparecimento", value: `${taxaRealiz.toFixed(1)}%`, sub: "" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
        {kpis.map((k, i) => (
          <div key={i} style={{ background: "#fff", borderRadius: 10, border: "0.5px solid #e5e7eb", padding: "14px 16px" }}>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", color: "#9ca3af" }}>{k.label}</div>
            <div style={{ fontSize: 22, fontWeight: 500, color: "#111827", marginTop: 4 }}>{k.value}</div>
            {k.sub && <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{k.sub}</div>}
          </div>
        ))}
      </div>

      {empData.length > 0 && (
        <div style={{ background: "#fff", borderRadius: 10, border: "0.5px solid #e5e7eb", padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: "#111827", marginBottom: 12 }}>Visitas por empreendimento — top 8</div>
          <div style={{ height: Math.max(200, empData.length * 30) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={empData} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 0 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTip />} cursor={{ fill: "#f3f4f6" }} />
                <Bar dataKey="count" fill="#4F46E5" radius={[0, 4, 4, 0]} />
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
                ["corretor", "Corretor"],
                ["total", "Total"],
                ["realizada", "Realizadas"],
                ["marcada", "Marcadas"],
                ["no_show", "No-show"],
                ["cancelada", "Canceladas"],
                ["taxa", "Taxa"],
              ] as Array<[SortCol, string]>).map(([col, label]) => (
                <th key={col} onClick={() => toggleSort(col)} style={{ fontSize: 11, color: "#9ca3af", fontWeight: 500, padding: "8px 16px", borderBottom: "0.5px solid #e5e7eb", background: "#fafafa", textAlign: "left", cursor: "pointer", userSelect: "none" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                    {label}
                    {sortCol === col && (sortDir === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => (
              <tr key={i} style={{ background: "#fff" }} onMouseEnter={(e) => (e.currentTarget.style.background = "#f9fafb")} onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}>
                <td style={{ fontSize: 13, padding: "10px 16px", borderBottom: "0.5px solid #f3f4f6", color: "#111827" }}>{r.corretor}</td>
                <td style={{ fontSize: 13, padding: "10px 16px", borderBottom: "0.5px solid #f3f4f6", color: "#111827", fontWeight: 500 }}>{r.total}</td>
                <td style={{ fontSize: 13, padding: "10px 16px", borderBottom: "0.5px solid #f3f4f6", color: "#065f46" }}>{r.realizada}</td>
                <td style={{ fontSize: 13, padding: "10px 16px", borderBottom: "0.5px solid #f3f4f6", color: "#1e40af" }}>{r.marcada}</td>
                <td style={{ fontSize: 13, padding: "10px 16px", borderBottom: "0.5px solid #f3f4f6", color: "#991b1b" }}>{r.no_show}</td>
                <td style={{ fontSize: 13, padding: "10px 16px", borderBottom: "0.5px solid #f3f4f6", color: "#6b7280" }}>{r.cancelada}</td>
                <td style={{ fontSize: 13, padding: "10px 16px", borderBottom: "0.5px solid #f3f4f6", color: r.taxa >= 70 ? "#10b981" : r.taxa >= 50 ? "#f59e0b" : "#ef4444", fontWeight: 500 }}>{r.taxa.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
