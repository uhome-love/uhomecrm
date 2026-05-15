import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Phone, ChevronUp, ChevronDown } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { ReportFilters, getDateRange, getPeriodoAnterior } from "./reportUtils";
import { fetchAllRows } from "@/lib/paginatedFetch";

interface Props {
  filters: ReportFilters;
  userRole: "admin" | "gestor" | "corretor";
}

interface TentRow {
  id: string;
  lead_id: string | null;
  corretor_id: string | null;
  canal: string | null;
  resultado: string | null;
  pontos: number | null;
  empreendimento: string | null;
  created_at: string;
}

interface CorretorRow {
  corretor: string;
  total: number;
  atenderam: number;
  aproveitados: number;
  taxa_aprov: number;
  pontos: number;
}

type SortCol = "corretor" | "total" | "atenderam" | "aproveitados" | "taxa_aprov" | "pontos";
type SortDir = "asc" | "desc";

const RESULTADO_LABELS: Record<string, { label: string; color: string }> = {
  com_interesse: { label: "Aproveitado", color: "#10b981" },
  sem_interesse: { label: "Sem interesse", color: "#ef4444" },
  numero_errado: { label: "Nº errado", color: "#f59e0b" },
  nao_atendeu: { label: "Não atendeu", color: "#9ca3af" },
  retornar: { label: "Retornar", color: "#3b82f6" },
};

const ATENDIDOS = new Set(["com_interesse", "sem_interesse", "retornar"]);

function ChartTip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 8, padding: "6px 10px", fontSize: 12 }}>
      <div style={{ color: "#6b7280" }}>{label}</div>
      <div style={{ fontWeight: 500, color: "#111827" }}>{payload[0].value} tentativas</div>
    </div>
  );
}

export default function RelatorioOfertaAtiva({ filters }: Props) {
  const [loading, setLoading] = useState(true);
  const [tents, setTents] = useState<TentRow[]>([]);
  const [tentsAnt, setTentsAnt] = useState<TentRow[]>([]);
  const [corretorMap, setCorretorMap] = useState<Map<string, string>>(new Map());
  const [sortCol, setSortCol] = useState<SortCol>("aproveitados");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const { startDate, endDate } = useMemo(() => getDateRange(filters), [filters]);
  const prev = useMemo(() => getPeriodoAnterior(startDate, endDate), [startDate, endDate]);

  useEffect(() => {
    let cancelled = false;

    async function fetchTents(s: Date, e: Date): Promise<TentRow[]> {
      let rows = await fetchAllRows<TentRow>((from, to) => {
        let q = supabase
          .from("oferta_ativa_tentativas")
          .select("id, lead_id, corretor_id, canal, resultado, pontos, empreendimento, created_at")
          .gte("created_at", s.toISOString())
          .lte("created_at", e.toISOString());
        if (filters.corretor) q = q.eq("corretor_id", filters.corretor);
        return q.range(from, to);
      });

      if (filters.equipe && !filters.corretor) {
        const { data: members } = await supabase
          .from("team_members")
          .select("user_id")
          .eq("gerente_id", filters.equipe);
        const ids = new Set((members || []).map((m) => m.user_id));
        rows = rows.filter((r) => r.corretor_id && ids.has(r.corretor_id));
      }
      return rows;
    }

    async function load() {
      setLoading(true);
      const [cur, ant] = await Promise.all([
        fetchTents(startDate, endDate),
        fetchTents(prev.startDate, prev.endDate),
      ]);

      const ids = [...new Set(cur.map((r) => r.corretor_id).filter(Boolean))] as string[];
      const nameMap = new Map<string, string>();
      if (ids.length) {
        const { data: tm } = await supabase.from("team_members").select("user_id, nome").in("user_id", ids);
        (tm || []).forEach((p) => nameMap.set(p.user_id, p.nome || "—"));
      }

      if (!cancelled) {
        setTents(cur);
        setTentsAnt(ant);
        setCorretorMap(nameMap);
        setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [startDate, endDate, prev.startDate, prev.endDate, filters.corretor, filters.equipe, filters.segmento]);

  // KPIs
  const total = tents.length;
  const totalAnt = tentsAnt.length;
  const atenderam = tents.filter((t) => t.resultado && ATENDIDOS.has(t.resultado)).length;
  const aproveitados = tents.filter((t) => t.resultado === "com_interesse").length;
  const pontos = tents.reduce((acc, t) => acc + (t.pontos || 0), 0);
  const taxaAtend = total > 0 ? Math.round((atenderam / total) * 100) : 0;
  const taxaAprov = total > 0 ? Math.round((aproveitados / total) * 100) : 0;

  function pctVar(curr: number, prev2: number): string {
    if (prev2 === 0 && curr === 0) return "";
    if (prev2 === 0) return "+100% vs anterior";
    const pct = Math.round(((curr - prev2) / prev2) * 100);
    return `${pct >= 0 ? "+" : ""}${pct}% vs anterior`;
  }

  // Resultado breakdown
  const resultadoData = useMemo(() => {
    const map = new Map<string, number>();
    tents.forEach((t) => {
      const k = t.resultado || "outro";
      map.set(k, (map.get(k) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([k, count]) => ({
        name: RESULTADO_LABELS[k]?.label || k,
        count,
        color: RESULTADO_LABELS[k]?.color || "#9ca3af",
      }))
      .sort((a, b) => b.count - a.count);
  }, [tents]);

  // Top empreendimentos
  const empreData = useMemo(() => {
    const map = new Map<string, number>();
    tents.forEach((t) => {
      if (t.resultado !== "com_interesse") return;
      const k = t.empreendimento || "—";
      map.set(k, (map.get(k) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [tents]);

  // Tabela por corretor
  const corretorData = useMemo<CorretorRow[]>(() => {
    const map = new Map<string, CorretorRow>();
    tents.forEach((t) => {
      const id = t.corretor_id;
      if (!id) return;
      const nome = corretorMap.get(id) || "—";
      const cur = map.get(id) || { corretor: nome, total: 0, atenderam: 0, aproveitados: 0, taxa_aprov: 0, pontos: 0 };
      cur.total += 1;
      if (t.resultado && ATENDIDOS.has(t.resultado)) cur.atenderam += 1;
      if (t.resultado === "com_interesse") cur.aproveitados += 1;
      cur.pontos += t.pontos || 0;
      map.set(id, cur);
    });
    map.forEach((v) => {
      v.taxa_aprov = v.total > 0 ? Math.round((v.aproveitados / v.total) * 100) : 0;
    });
    return Array.from(map.values());
  }, [tents, corretorMap]);

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

  if (tents.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 60, gap: 12 }}>
        <Phone size={40} strokeWidth={1} color="#C7D2FE" />
        <div style={{ color: "#6b7280", fontSize: 14 }}>Nenhuma tentativa de Oferta Ativa no período</div>
      </div>
    );
  }

  const kpis = [
    { label: "Tentativas", value: String(total), sub: pctVar(total, totalAnt) },
    { label: "Atendidas", value: String(atenderam), sub: `${taxaAtend}% de atendimento` },
    { label: "Aproveitados", value: String(aproveitados), sub: `${taxaAprov}% de aproveitamento` },
    { label: "Pontos gerados", value: String(pontos), sub: "" },
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

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={{ background: "#fff", borderRadius: 10, border: "0.5px solid #e5e7eb", padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: "#111827", marginBottom: 12 }}>Resultados das tentativas</div>
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={resultadoData} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 0 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTip />} cursor={{ fill: "#f3f4f6" }} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {resultadoData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div style={{ background: "#fff", borderRadius: 10, border: "0.5px solid #e5e7eb", padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: "#111827", marginBottom: 12 }}>Empreendimentos com mais aproveitados</div>
          {empreData.length === 0 ? (
            <div style={{ color: "#9ca3af", fontSize: 12, padding: "24px 0" }}>Sem aproveitados no período</div>
          ) : (
            <div style={{ height: 240 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={empreData} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTip />} cursor={{ fill: "#f3f4f6" }} />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]} fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      <div style={{ background: "#fff", borderRadius: 10, border: "0.5px solid #e5e7eb", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {([
                ["corretor", "Corretor"],
                ["total", "Tentativas"],
                ["atenderam", "Atendidas"],
                ["aproveitados", "Aproveitados"],
                ["taxa_aprov", "Taxa aprov."],
                ["pontos", "Pontos"],
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
                <td style={{ fontSize: 13, padding: "10px 16px", borderBottom: "0.5px solid #f3f4f6", color: "#6b7280" }}>{r.atenderam}</td>
                <td style={{ fontSize: 13, padding: "10px 16px", borderBottom: "0.5px solid #f3f4f6", color: "#10b981", fontWeight: 500 }}>{r.aproveitados}</td>
                <td style={{ fontSize: 13, padding: "10px 16px", borderBottom: "0.5px solid #f3f4f6", color: "#6b7280" }}>{r.taxa_aprov}%</td>
                <td style={{ fontSize: 13, padding: "10px 16px", borderBottom: "0.5px solid #f3f4f6", color: "#6b7280" }}>{r.pontos}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
