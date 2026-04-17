import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CheckSquare, ChevronUp, ChevronDown } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { ReportFilters, getDateRange, getPeriodoAnterior } from "./reportUtils";

interface Props {
  filters: ReportFilters;
  userRole: "admin" | "gestor" | "corretor";
}

interface TarefaRow {
  id: string;
  pipeline_lead_id: string | null;
  tipo: string | null;
  status: string;
  responsavel_id: string | null;
  vence_em: string | null;
  concluida_em: string | null;
  created_at: string;
}

interface CorretorRow {
  corretor: string;
  total: number;
  concluidas: number;
  pendentes: number;
  atrasadas: number;
  taxa: number;
}

type SortCol = "corretor" | "total" | "concluidas" | "pendentes" | "atrasadas" | "taxa";
type SortDir = "asc" | "desc";

const TIPO_LABELS: Record<string, string> = {
  follow_up: "Follow-up",
  whatsapp: "WhatsApp",
  ligar: "Ligar",
  ligacao: "Ligação",
  retornar_cliente: "Retornar cliente",
  marcar_visita: "Marcar visita",
  enviar_material: "Enviar material",
  enviar_proposta: "Enviar proposta",
  visita: "Visita",
  confirmar_visita: "Confirmar visita",
  email: "E-mail",
  outro: "Outro",
};

function ChartTip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 8, padding: "6px 10px", fontSize: 12 }}>
      <div style={{ color: "#6b7280" }}>{label}</div>
      <div style={{ fontWeight: 500, color: "#111827" }}>{payload[0].value} tarefas</div>
    </div>
  );
}

export default function RelatorioTarefas({ filters }: Props) {
  const [loading, setLoading] = useState(true);
  const [tarefas, setTarefas] = useState<TarefaRow[]>([]);
  const [tarefasAnt, setTarefasAnt] = useState<TarefaRow[]>([]);
  const [corretorMap, setCorretorMap] = useState<Map<string, string>>(new Map());
  const [sortCol, setSortCol] = useState<SortCol>("total");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const { startDate, endDate } = useMemo(() => getDateRange(filters), [filters]);
  const prev = useMemo(() => getPeriodoAnterior(startDate, endDate), [startDate, endDate]);

  useEffect(() => {
    let cancelled = false;

    async function fetchTarefas(s: Date, e: Date): Promise<TarefaRow[]> {
      let query = supabase
        .from("pipeline_tarefas")
        .select("id, pipeline_lead_id, tipo, status, responsavel_id, vence_em, concluida_em, created_at")
        .gte("created_at", s.toISOString())
        .lte("created_at", e.toISOString());

      if (filters.corretor) query = query.eq("responsavel_id", filters.corretor);

      const { data } = await query;
      let rows = (data || []) as TarefaRow[];

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
        fetchTarefas(startDate, endDate),
        fetchTarefas(prev.startDate, prev.endDate),
      ]);

      const ids = [...new Set(cur.map((r) => r.responsavel_id).filter(Boolean))] as string[];
      const nameMap = new Map<string, string>();
      if (ids.length) {
        const { data: profs } = await supabase.from("profiles").select("id, nome").in("id", ids);
        (profs || []).forEach((p) => nameMap.set(p.id, p.nome || "—"));
      }

      if (!cancelled) {
        setTarefas(cur);
        setTarefasAnt(ant);
        setCorretorMap(nameMap);
        setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [startDate, endDate, prev.startDate, prev.endDate, filters.corretor, filters.equipe, filters.segmento]);

  const hojeISO = new Date().toISOString().slice(0, 10);
  const total = tarefas.length;
  const totalAnt = tarefasAnt.length;
  const concluidas = tarefas.filter((t) => t.status === "concluida").length;
  const pendentes = tarefas.filter((t) => t.status === "pendente").length;
  const atrasadas = tarefas.filter((t) => t.status === "pendente" && t.vence_em && t.vence_em < hojeISO).length;
  const taxaConclusao = total > 0 ? (concluidas / total) * 100 : 0;

  function pctVar(curr: number, prev2: number): string {
    if (prev2 === 0 && curr === 0) return "";
    if (prev2 === 0) return "+100% vs anterior";
    const pct = Math.round(((curr - prev2) / prev2) * 100);
    return `${pct >= 0 ? "+" : ""}${pct}% vs anterior`;
  }

  const tipoData = useMemo(() => {
    const map = new Map<string, number>();
    tarefas.forEach((t) => {
      const tipo = t.tipo || "outro";
      map.set(tipo, (map.get(tipo) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([tipo, count]) => ({ name: TIPO_LABELS[tipo] || tipo, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [tarefas]);

  const corretorData = useMemo<CorretorRow[]>(() => {
    const map = new Map<string, CorretorRow>();
    tarefas.forEach((t) => {
      const id = t.responsavel_id;
      if (!id) return;
      const nome = corretorMap.get(id) || "—";
      const cur = map.get(id) || { corretor: nome, total: 0, concluidas: 0, pendentes: 0, atrasadas: 0, taxa: 0 };
      cur.total += 1;
      if (t.status === "concluida") cur.concluidas += 1;
      else if (t.status === "pendente") {
        cur.pendentes += 1;
        if (t.vence_em && t.vence_em < hojeISO) cur.atrasadas += 1;
      }
      map.set(id, cur);
    });
    return Array.from(map.values()).map((r) => ({ ...r, taxa: r.total > 0 ? (r.concluidas / r.total) * 100 : 0 }));
  }, [tarefas, corretorMap, hojeISO]);

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

  if (tarefas.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 60, gap: 12 }}>
        <CheckSquare size={40} strokeWidth={1} color="#C7D2FE" />
        <div style={{ color: "#6b7280", fontSize: 14 }}>Nenhuma tarefa no período selecionado</div>
      </div>
    );
  }

  const kpis = [
    { label: "Total de tarefas", value: String(total), sub: pctVar(total, totalAnt) },
    { label: "Concluídas", value: String(concluidas), sub: `${taxaConclusao.toFixed(1)}% do total` },
    { label: "Pendentes", value: String(pendentes), sub: "" },
    { label: "Atrasadas", value: String(atrasadas), sub: pendentes > 0 ? `${Math.round((atrasadas / pendentes) * 100)}% das pendentes` : "" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
        {kpis.map((k, i) => (
          <div key={i} style={{ background: "#fff", borderRadius: 10, border: "0.5px solid #e5e7eb", padding: "14px 16px" }}>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", color: "#9ca3af" }}>{k.label}</div>
            <div style={{ fontSize: 22, fontWeight: 500, color: i === 3 && atrasadas > 0 ? "#ef4444" : "#111827", marginTop: 4 }}>{k.value}</div>
            {k.sub && <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{k.sub}</div>}
          </div>
        ))}
      </div>

      <div style={{ background: "#fff", borderRadius: 10, border: "0.5px solid #e5e7eb", padding: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: "#111827", marginBottom: 12 }}>Tarefas por tipo</div>
        <div style={{ height: 240 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={tipoData} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 0 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTip />} cursor={{ fill: "#f3f4f6" }} />
              <Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]} />
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
                ["concluidas", "Concluídas"],
                ["pendentes", "Pendentes"],
                ["atrasadas", "Atrasadas"],
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
                <td style={{ fontSize: 13, padding: "10px 16px", borderBottom: "0.5px solid #f3f4f6", color: "#065f46" }}>{r.concluidas}</td>
                <td style={{ fontSize: 13, padding: "10px 16px", borderBottom: "0.5px solid #f3f4f6", color: "#92400e" }}>{r.pendentes}</td>
                <td style={{ fontSize: 13, padding: "10px 16px", borderBottom: "0.5px solid #f3f4f6", color: r.atrasadas > 0 ? "#ef4444" : "#6b7280", fontWeight: r.atrasadas > 0 ? 500 : 400 }}>{r.atrasadas}</td>
                <td style={{ fontSize: 13, padding: "10px 16px", borderBottom: "0.5px solid #f3f4f6", color: r.taxa >= 80 ? "#10b981" : r.taxa >= 60 ? "#f59e0b" : "#ef4444", fontWeight: 500 }}>{r.taxa.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
