import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MessageCircle, ChevronUp, ChevronDown } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { ReportFilters, getDateRange, getPeriodoAnterior, fmtDate } from "./reportUtils";

interface Props {
  filters: ReportFilters;
  userRole: "admin" | "gestor" | "corretor";
}

interface AtivRow {
  id: string;
  pipeline_lead_id: string | null;
  tipo: string;
  responsavel_id: string | null;
  created_at: string;
}

interface CorretorRow {
  corretor: string;
  total: number;
  ligacao: number;
  whatsapp: number;
  followup: number;
  outros: number;
}

type SortCol = "corretor" | "total" | "ligacao" | "whatsapp" | "followup" | "outros";
type SortDir = "asc" | "desc";

const TIPO_LABELS: Record<string, { label: string; color: string }> = {
  ligacao: { label: "Ligação", color: "#4F46E5" },
  whatsapp: { label: "WhatsApp", color: "#10b981" },
  followup: { label: "Follow-up", color: "#f59e0b" },
  contato: { label: "Contato", color: "#6366f1" },
  mensagem: { label: "Mensagem", color: "#06b6d4" },
  email: { label: "E-mail", color: "#8b5cf6" },
  visita: { label: "Visita", color: "#ec4899" },
  proposta: { label: "Proposta", color: "#f97316" },
  nao_atendeu: { label: "Não atendeu", color: "#9ca3af" },
};

function ChartTip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 8, padding: "6px 10px", fontSize: 12 }}>
      <div style={{ color: "#6b7280" }}>{label}</div>
      <div style={{ fontWeight: 500, color: "#111827" }}>{payload[0].value} interações</div>
    </div>
  );
}

export default function RelatorioInteracao({ filters }: Props) {
  const [loading, setLoading] = useState(true);
  const [ativs, setAtivs] = useState<AtivRow[]>([]);
  const [ativsAnt, setAtivsAnt] = useState<AtivRow[]>([]);
  const [corretorMap, setCorretorMap] = useState<Map<string, string>>(new Map());
  const [sortCol, setSortCol] = useState<SortCol>("total");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const { startDate, endDate } = useMemo(() => getDateRange(filters), [filters]);
  const prev = useMemo(() => getPeriodoAnterior(startDate, endDate), [startDate, endDate]);

  useEffect(() => {
    let cancelled = false;

    async function fetchAtivs(s: Date, e: Date): Promise<AtivRow[]> {
      let query = supabase
        .from("pipeline_atividades")
        .select("id, pipeline_lead_id, tipo, responsavel_id, created_at")
        .gte("created_at", s.toISOString())
        .lte("created_at", e.toISOString());

      if (filters.corretor) query = query.eq("responsavel_id", filters.corretor);

      const { data } = await query;
      let rows = (data || []) as AtivRow[];

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
          rows = rows.filter((r) => r.responsavel_id && ids.has(r.responsavel_id));
        } else {
          rows = [];
        }
      }
      return rows;
    }

    async function load() {
      setLoading(true);
      const [cur, ant] = await Promise.all([
        fetchAtivs(startDate, endDate),
        fetchAtivs(prev.startDate, prev.endDate),
      ]);

      const ids = [...new Set(cur.map((r) => r.responsavel_id).filter(Boolean))] as string[];
      const nameMap = new Map<string, string>();
      if (ids.length) {
        const { data: profs } = await supabase.from("profiles").select("id, nome").in("id", ids);
        (profs || []).forEach((p) => nameMap.set(p.id, p.nome || "—"));
      }

      if (!cancelled) {
        setAtivs(cur);
        setAtivsAnt(ant);
        setCorretorMap(nameMap);
        setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [startDate, endDate, prev.startDate, prev.endDate, filters.corretor, filters.equipe, filters.segmento]);

  // KPIs
  const total = ativs.length;
  const totalAnt = ativsAnt.length;
  const ligacoes = ativs.filter((a) => a.tipo === "ligacao").length;
  const whats = ativs.filter((a) => a.tipo === "whatsapp").length;
  const leadsAtingidos = new Set(ativs.map((a) => a.pipeline_lead_id).filter(Boolean)).size;

  function pctVar(curr: number, prev2: number): string {
    if (prev2 === 0 && curr === 0) return "";
    if (prev2 === 0) return "+100% vs anterior";
    const pct = Math.round(((curr - prev2) / prev2) * 100);
    return `${pct >= 0 ? "+" : ""}${pct}% vs anterior`;
  }

  // Chart: por tipo
  const tipoData = useMemo(() => {
    const map = new Map<string, number>();
    ativs.forEach((a) => map.set(a.tipo, (map.get(a.tipo) || 0) + 1));
    return Array.from(map.entries())
      .map(([tipo, count]) => ({ name: TIPO_LABELS[tipo]?.label || tipo, count, color: TIPO_LABELS[tipo]?.color || "#9ca3af" }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [ativs]);

  // Tabela por corretor
  const corretorData = useMemo<CorretorRow[]>(() => {
    const map = new Map<string, CorretorRow>();
    ativs.forEach((a) => {
      const id = a.responsavel_id;
      if (!id) return;
      const nome = corretorMap.get(id) || "—";
      const cur = map.get(id) || { corretor: nome, total: 0, ligacao: 0, whatsapp: 0, followup: 0, outros: 0 };
      cur.total += 1;
      if (a.tipo === "ligacao") cur.ligacao += 1;
      else if (a.tipo === "whatsapp") cur.whatsapp += 1;
      else if (a.tipo === "followup") cur.followup += 1;
      else cur.outros += 1;
      map.set(id, cur);
    });
    return Array.from(map.values());
  }, [ativs, corretorMap]);

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

  if (ativs.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 60, gap: 12 }}>
        <MessageCircle size={40} strokeWidth={1} color="#C7D2FE" />
        <div style={{ color: "#6b7280", fontSize: 14 }}>Nenhuma interação no período selecionado</div>
      </div>
    );
  }

  const kpis = [
    { label: "Total de interações", value: String(total), sub: pctVar(total, totalAnt) },
    { label: "Ligações", value: String(ligacoes), sub: total > 0 ? `${Math.round((ligacoes / total) * 100)}% do total` : "" },
    { label: "WhatsApp", value: String(whats), sub: total > 0 ? `${Math.round((whats / total) * 100)}% do total` : "" },
    { label: "Leads atingidos", value: String(leadsAtingidos), sub: "" },
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

      <div style={{ background: "#fff", borderRadius: 10, border: "0.5px solid #e5e7eb", padding: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: "#111827", marginBottom: 12 }}>Interações por tipo</div>
        <div style={{ height: 240 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={tipoData} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 0 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTip />} cursor={{ fill: "#f3f4f6" }} />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {tipoData.map((d, i) => <Cell key={i} fill={d.color} />)}
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
                ["corretor", "Corretor"],
                ["total", "Total"],
                ["ligacao", "Ligações"],
                ["whatsapp", "WhatsApp"],
                ["followup", "Follow-up"],
                ["outros", "Outros"],
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
                <td style={{ fontSize: 13, padding: "10px 16px", borderBottom: "0.5px solid #f3f4f6", color: "#6b7280" }}>{r.ligacao}</td>
                <td style={{ fontSize: 13, padding: "10px 16px", borderBottom: "0.5px solid #f3f4f6", color: "#6b7280" }}>{r.whatsapp}</td>
                <td style={{ fontSize: 13, padding: "10px 16px", borderBottom: "0.5px solid #f3f4f6", color: "#6b7280" }}>{r.followup}</td>
                <td style={{ fontSize: 13, padding: "10px 16px", borderBottom: "0.5px solid #f3f4f6", color: "#6b7280" }}>{r.outros}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
