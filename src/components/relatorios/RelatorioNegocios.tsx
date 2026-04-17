import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Briefcase, ChevronUp, ChevronDown } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { ReportFilters, getDateRange, getPeriodoAnterior, fmtMoney, fmtDate } from "./reportUtils";

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
  nome_cliente: string | null;
  created_at: string;
  fase_changed_at: string | null;
}

interface NegocioRender {
  id: string;
  cliente: string;
  empreendimento: string;
  corretor: string;
  fase: string;
  faseLabel: string;
  vgv: number;
  data: string;
}

type SortCol = "cliente" | "empreendimento" | "corretor" | "faseLabel" | "vgv" | "data";
type SortDir = "asc" | "desc";

const FASES: Array<{ fase: string; label: string; color: string; bg: string }> = [
  { fase: "novo_negocio", label: "Novo negócio", color: "#1e40af", bg: "#dbeafe" },
  { fase: "proposta", label: "Proposta", color: "#92400e", bg: "#fef3c7" },
  { fase: "negociacao", label: "Negociação", color: "#9a3412", bg: "#fed7aa" },
  { fase: "documentacao", label: "Documentação", color: "#5b21b6", bg: "#ede9fe" },
  { fase: "vendido", label: "Vendido", color: "#065f46", bg: "#d1fae5" },
  { fase: "perdido", label: "Perdido", color: "#991b1b", bg: "#fee2e2" },
  { fase: "distrato", label: "Distrato", color: "#6b7280", bg: "#f3f4f6" },
];

const FASE_MAP = new Map(FASES.map((f) => [f.fase, f]));

function ChartTip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 8, padding: "6px 10px", fontSize: 12 }}>
      <div style={{ color: "#6b7280" }}>{label}</div>
      <div style={{ fontWeight: 500, color: "#111827" }}>{payload[0].value} negócios</div>
    </div>
  );
}

export default function RelatorioNegocios({ filters }: Props) {
  const [loading, setLoading] = useState(true);
  const [negocios, setNegocios] = useState<NegocioRender[]>([]);
  const [negociosAntCount, setNegociosAntCount] = useState(0);
  const [sortCol, setSortCol] = useState<SortCol>("data");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const { startDate, endDate } = useMemo(() => getDateRange(filters), [filters]);
  const prev = useMemo(() => getPeriodoAnterior(startDate, endDate), [startDate, endDate]);

  useEffect(() => {
    let cancelled = false;

    async function fetchNegocios(s: Date, e: Date): Promise<NegocioRow[]> {
      let query = supabase
        .from("negocios")
        .select("id, empreendimento, fase, vgv_final, vgv_estimado, data_assinatura, corretor_id, pipeline_lead_id, nome_cliente, created_at, fase_changed_at")
        .gte("created_at", s.toISOString())
        .lte("created_at", e.toISOString());

      if (filters.corretor) query = query.eq("corretor_id", filters.corretor);

      const { data } = await query;
      let rows = (data || []) as NegocioRow[];

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
        fetchNegocios(startDate, endDate),
        fetchNegocios(prev.startDate, prev.endDate),
      ]);

      const ids = [...new Set(cur.map((r) => r.corretor_id).filter(Boolean))] as string[];
      const nameMap = new Map<string, string>();
      if (ids.length) {
        const { data: profs } = await supabase.from("profiles").select("id, nome").in("id", ids);
        (profs || []).forEach((p) => nameMap.set(p.id, p.nome || "—"));
      }

      const render: NegocioRender[] = cur.map((r) => {
        const f = FASE_MAP.get(r.fase);
        return {
          id: r.id,
          cliente: r.nome_cliente || "—",
          empreendimento: r.empreendimento || "—",
          corretor: r.corretor_id ? nameMap.get(r.corretor_id) || "—" : "—",
          fase: r.fase,
          faseLabel: f?.label || r.fase,
          vgv: Math.round(r.vgv_final ?? r.vgv_estimado ?? 0),
          data: r.data_assinatura || r.created_at.slice(0, 10),
        };
      });

      if (!cancelled) {
        setNegocios(render);
        setNegociosAntCount(ant.length);
        setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [startDate, endDate, prev.startDate, prev.endDate, filters.corretor, filters.equipe, filters.segmento]);

  const total = negocios.length;
  const ativos = negocios.filter((n) => !["vendido", "perdido", "distrato"].includes(n.fase)).length;
  const vendidos = negocios.filter((n) => n.fase === "vendido").length;
  const vgvPipeline = negocios.filter((n) => !["vendido", "perdido", "distrato"].includes(n.fase)).reduce((a, n) => a + n.vgv, 0);

  function pctVar(curr: number, prev2: number): string {
    if (prev2 === 0 && curr === 0) return "";
    if (prev2 === 0) return "+100% vs anterior";
    const pct = Math.round(((curr - prev2) / prev2) * 100);
    return `${pct >= 0 ? "+" : ""}${pct}% vs anterior`;
  }

  // Funil por fase
  const funilData = useMemo(() => {
    return FASES.map((f) => ({
      name: f.label,
      count: negocios.filter((n) => n.fase === f.fase).length,
      color: f.color,
    })).filter((d) => d.count > 0);
  }, [negocios]);

  const sorted = useMemo(() => {
    const arr = [...negocios];
    arr.sort((a, b) => {
      const va = a[sortCol];
      const vb = b[sortCol];
      if (typeof va === "string" && typeof vb === "string") {
        return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
      }
      return sortDir === "asc" ? (va as number) - (vb as number) : (vb as number) - (va as number);
    });
    return arr;
  }, [negocios, sortCol, sortDir]);

  const [page, setPage] = useState(0);
  useEffect(() => { setPage(0); }, [filters, sortCol, sortDir]);
  const pageSize = 20;
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const paged = sorted.slice(page * pageSize, (page + 1) * pageSize);

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

  if (negocios.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 60, gap: 12 }}>
        <Briefcase size={40} strokeWidth={1} color="#C7D2FE" />
        <div style={{ color: "#6b7280", fontSize: 14 }}>Nenhum negócio no período selecionado</div>
      </div>
    );
  }

  const kpis = [
    { label: "Total de negócios", value: String(total), sub: pctVar(total, negociosAntCount) },
    { label: "Em andamento", value: String(ativos), sub: total > 0 ? `${Math.round((ativos / total) * 100)}% do total` : "" },
    { label: "Vendidos", value: String(vendidos), sub: total > 0 ? `${Math.round((vendidos / total) * 100)}% do total` : "" },
    { label: "VGV no pipeline", value: fmtMoney(vgvPipeline), sub: "Em andamento" },
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

      <div style={{ background: "#fff", borderRadius: 10, border: "0.5px solid #e5e7eb", padding: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: "#111827", marginBottom: 12 }}>Funil de negócios</div>
        <div style={{ height: Math.max(220, funilData.length * 36) }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={funilData} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 0 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTip />} cursor={{ fill: "#f3f4f6" }} />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {funilData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ background: "#fff", borderRadius: 10, border: "0.5px solid #e5e7eb", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {([
                ["cliente", "Cliente"],
                ["empreendimento", "Empreendimento"],
                ["corretor", "Corretor"],
                ["faseLabel", "Fase"],
                ["vgv", "VGV"],
                ["data", "Data"],
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
            {paged.map((r) => {
              const f = FASE_MAP.get(r.fase);
              return (
                <tr key={r.id} style={{ background: "#fff" }} onMouseEnter={(e) => (e.currentTarget.style.background = "#f9fafb")} onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}>
                  <td style={{ fontSize: 13, padding: "10px 16px", borderBottom: "0.5px solid #f3f4f6", color: "#111827" }}>{r.cliente}</td>
                  <td style={{ fontSize: 13, padding: "10px 16px", borderBottom: "0.5px solid #f3f4f6", color: "#6b7280" }}>{r.empreendimento}</td>
                  <td style={{ fontSize: 13, padding: "10px 16px", borderBottom: "0.5px solid #f3f4f6", color: "#6b7280" }}>{r.corretor}</td>
                  <td style={{ fontSize: 13, padding: "10px 16px", borderBottom: "0.5px solid #f3f4f6" }}>
                    <span style={{ display: "inline-block", fontSize: 11, padding: "2px 8px", borderRadius: 10, background: f?.bg || "#f3f4f6", color: f?.color || "#6b7280", whiteSpace: "nowrap" }}>{r.faseLabel}</span>
                  </td>
                  <td style={{ fontSize: 13, padding: "10px 16px", borderBottom: "0.5px solid #f3f4f6", color: "#111827", fontWeight: 500 }}>{r.vgv > 0 ? fmtMoney(r.vgv) : "—"}</td>
                  <td style={{ fontSize: 13, padding: "10px 16px", borderBottom: "0.5px solid #f3f4f6", color: "#6b7280" }}>{fmtDate(r.data)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {totalPages > 1 && (
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: 12, borderTop: "0.5px solid #f3f4f6" }}>
            <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} style={{ fontSize: 12, padding: "4px 10px", border: "0.5px solid #e5e7eb", borderRadius: 6, background: "#fff", color: page === 0 ? "#d1d5db" : "#374151", cursor: page === 0 ? "default" : "pointer" }}>← Anterior</button>
            <span style={{ fontSize: 12, color: "#6b7280", padding: "4px 8px" }}>{page + 1} de {totalPages}</span>
            <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1} style={{ fontSize: 12, padding: "4px 10px", border: "0.5px solid #e5e7eb", borderRadius: 6, background: "#fff", color: page === totalPages - 1 ? "#d1d5db" : "#374151", cursor: page === totalPages - 1 ? "default" : "pointer" }}>Próxima →</button>
          </div>
        )}
      </div>
    </div>
  );
}
