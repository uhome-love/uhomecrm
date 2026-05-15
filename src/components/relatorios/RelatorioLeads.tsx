import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Users, ChevronUp, ChevronDown, Search } from "lucide-react";
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from "recharts";
import { ReportFilters, getDateRange, getPeriodoAnterior, fmtDate } from "./reportUtils";
import { fetchAllRows } from "@/lib/paginatedFetch";

interface RelatorioLeadsProps {
  filters: ReportFilters;
  userRole: "admin" | "gestor" | "corretor";
}

interface LeadRow {
  id: string;
  nome: string | null;
  telefone: string | null;
  origem: string | null;
  stage_id: string | null;
  corretor_id: string | null;
  segmento_id: string | null;
  created_at: string;
  updated_at: string | null;
}

interface LeadProcessado {
  id: string;
  nome: string;
  telefone: string;
  origem: string;
  etapa: string;
  corretor: string;
  equipe: string;
  diasNoFunil: number;
  ultimaAtividade: string;
  createdAt: string;
}

type SortCol = "nome" | "origem" | "etapa" | "corretor" | "equipe" | "diasNoFunil" | "ultimaAtividade";
type SortDir = "asc" | "desc";

const ETAPA_BADGE: Record<string, { bg: string; color: string }> = {
  "Novo Lead": { bg: "#f3f4f6", color: "#6b7280" },
  "Sem Contato": { bg: "#f3f4f6", color: "#6b7280" },
  "Contato Iniciado": { bg: "#EEF2FF", color: "#4F46E5" },
  "Contato Inicial": { bg: "#EEF2FF", color: "#4F46E5" },
  "Busca": { bg: "#EEF2FF", color: "#4F46E5" },
  "Aquecimento": { bg: "#fef3c7", color: "#92400e" },
  "Visita": { bg: "#ede9fe", color: "#5b21b6" },
  "Pós-Visita": { bg: "#ede9fe", color: "#5b21b6" },
  "Negócio Criado": { bg: "#d1fae5", color: "#065f46" },
  "Descarte": { bg: "#fee2e2", color: "#991b1b" },
};

function EtapaBadge({ label }: { label: string }) {
  const s = ETAPA_BADGE[label] || { bg: "#f3f4f6", color: "#6b7280" };
  return (
    <span style={{ display: "inline-block", fontSize: 10, padding: "2px 8px", borderRadius: 10, background: s.bg, color: s.color, whiteSpace: "nowrap" }}>
      {label}
    </span>
  );
}

function groupLeads(leads: LeadProcessado[], periodo: string, startDate: Date, endDate: Date) {
  const diffDays = Math.ceil((endDate.getTime() - startDate.getTime()) / 86400000);
  if (periodo === "hoje") {
    const buckets = Array.from({ length: 24 }, (_, i) => ({ label: `${i}h`, count: 0 }));
    leads.forEach((l) => { const h = new Date(l.createdAt).getHours(); buckets[h].count += 1; });
    return buckets.filter((b) => b.count > 0);
  }
  if (periodo === "semana") {
    const days = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
    const buckets = days.map((d) => ({ label: d, count: 0 }));
    leads.forEach((l) => {
      const dt = new Date(l.createdAt);
      const day = dt.getDay();
      const idx = day === 0 ? 6 : day - 1;
      buckets[idx].count += 1;
    });
    return buckets;
  }
  if (periodo === "mes") {
    const buckets = [{ label: "S1", count: 0 }, { label: "S2", count: 0 }, { label: "S3", count: 0 }, { label: "S4", count: 0 }, { label: "S5", count: 0 }];
    leads.forEach((l) => {
      const day = new Date(l.createdAt).getDate();
      const idx = Math.min(Math.floor((day - 1) / 7), 4);
      buckets[idx].count += 1;
    });
    return buckets.filter((b, i) => b.count > 0 || i < 4);
  }
  if (diffDays <= 14) {
    const map = new Map<string, number>();
    leads.forEach((l) => {
      const d = l.createdAt.slice(0, 10);
      map.set(d, (map.get(d) || 0) + 1);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([d, count]) => ({ label: fmtDate(d), count }));
  }
  if (diffDays <= 90) {
    const map = new Map<string, number>();
    leads.forEach((l) => {
      const dt = new Date(l.createdAt);
      const weekStart = new Date(dt); weekStart.setDate(dt.getDate() - ((dt.getDay() + 6) % 7));
      const key = fmtDate(weekStart.toISOString().slice(0, 10));
      map.set(key, (map.get(key) || 0) + 1);
    });
    return Array.from(map.entries()).map(([label, count]) => ({ label, count }));
  }
  const map = new Map<string, number>();
  const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  leads.forEach((l) => {
    const dt = new Date(l.createdAt);
    const key = `${months[dt.getMonth()]}/${dt.getFullYear() % 100}`;
    map.set(key, (map.get(key) || 0) + 1);
  });
  return Array.from(map.entries()).map(([label, count]) => ({ label, count }));
}

function chartTitle(periodo: string): string {
  const map: Record<string, string> = { hoje: "hora", semana: "dia", mes: "semana" };
  return `Leads recebidos por ${map[periodo] || "período"}`;
}

function ChartTooltipCustom({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 8, padding: "6px 10px", fontSize: 12 }}>
      <div style={{ color: "#6b7280" }}>{label}</div>
      <div style={{ fontWeight: 500, color: "#111827" }}>{Math.round(payload[0].value)} leads</div>
    </div>
  );
}

export default function RelatorioLeads({ filters }: RelatorioLeadsProps) {
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState<LeadProcessado[]>([]);
  const [leadsAnterior, setLeadsAnterior] = useState<LeadProcessado[]>([]);
  const [tempoMedio1, setTempoMedio1] = useState<number | null>(null);
  const [tempoMedio1Ant, setTempoMedio1Ant] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState<SortCol>("diasNoFunil");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [page, setPage] = useState(0);

  const { startDate, endDate } = useMemo(() => getDateRange(filters), [filters]);
  const prev = useMemo(() => getPeriodoAnterior(startDate, endDate), [startDate, endDate]);

  useEffect(() => { setPage(0); }, [filters, search, sortCol, sortDir]);

  useEffect(() => {
    let cancelled = false;

    async function fetchLeads(s: Date, e: Date): Promise<{ leads: LeadProcessado[]; tempoMedio: number | null }> {
      const rows = await fetchAllRows<LeadRow>((from, to) => {
        let q = supabase
          .from("pipeline_leads")
          .select("id, nome, telefone, origem, stage_id, corretor_id, segmento_id, created_at, updated_at")
          .gte("created_at", s.toISOString())
          .lte("created_at", e.toISOString());
        if (filters.corretor) q = q.eq("corretor_id", filters.corretor);
        return q.range(from, to);
      });

      if (!rows.length) return { leads: [], tempoMedio: null };

      let filtered = rows;

      if (filters.equipe && !filters.corretor) {
        const { data: membros } = await supabase
          .from("team_members").select("user_id").eq("gerente_id", filters.equipe);
        if (membros?.length) {
          const { data: profiles } = await supabase
            .from("profiles").select("id").in("user_id", membros.map((m) => m.user_id));
          const ids = new Set((profiles || []).map((p) => p.id));
          filtered = rows.filter((r) => r.corretor_id && ids.has(r.corretor_id));
        } else filtered = [];
      }

      const segIdsAll = [...new Set(filtered.map((r) => r.segmento_id).filter(Boolean))] as string[];
      const segNameMap = new Map<string, string>();
      if (segIdsAll.length) {
        const { data: segs } = await supabase.from("roleta_segmentos").select("id, nome").in("id", segIdsAll);
        (segs || []).forEach((sg) => segNameMap.set(sg.id, sg.nome as string));
      }
      if (filters.segmento) {
        filtered = filtered.filter((r) => {
          if (!r.segmento_id) return false;
          const seg = segNameMap.get(r.segmento_id) || "";
          return seg.toLowerCase().includes(filters.segmento.toLowerCase());
        });
      }

      if (!filtered.length) return { leads: [], tempoMedio: null };

      const stageIds = [...new Set(filtered.map((r) => r.stage_id).filter(Boolean))] as string[];
      const stageMap = new Map<string, string>();
      if (stageIds.length) {
        const { data: stages } = await supabase.from("pipeline_stages").select("id, nome").in("id", stageIds);
        (stages || []).forEach((st) => stageMap.set(st.id, st.nome as string));
      }

      const corretorIds = [...new Set(filtered.map((r) => r.corretor_id).filter(Boolean))] as string[];
      const corretorNameMap = new Map<string, string>();
      const corretorUserMap = new Map<string, string>();
      if (corretorIds.length) {
        const { data: profs } = await supabase.from("profiles").select("id, nome, user_id").in("id", corretorIds);
        (profs || []).forEach((p) => {
          corretorNameMap.set(p.id, p.nome || "—");
          if (p.user_id) corretorUserMap.set(p.id, p.user_id);
        });
      }

      const userIds = [...corretorUserMap.values()];
      const equipeMap = new Map<string, string>();
      if (userIds.length) {
        const { data: members } = await supabase.from("team_members").select("user_id, gerente_id").in("user_id", userIds);
        const gerenteIds = [...new Set((members || []).map((m) => m.gerente_id).filter(Boolean))] as string[];
        const gerenteNameMap = new Map<string, string>();
        if (gerenteIds.length) {
          const { data: gerentes } = await supabase.from("profiles").select("user_id, nome").in("user_id", gerenteIds);
          (gerentes || []).forEach((g) => gerenteNameMap.set(g.user_id as string, g.nome || "—"));
        }
        (members || []).forEach((m) => {
          equipeMap.set(m.user_id, gerenteNameMap.get(m.gerente_id as string) || "—");
        });
      }

      const leadIds = filtered.map((r) => r.id);
      const ultimaAtMap = new Map<string, string>();
      if (leadIds.length) {
        const ats = await fetchAllRows<{ pipeline_lead_id: string; created_at: string }>((from, to) =>
          supabase
            .from("pipeline_atividades")
            .select("pipeline_lead_id, created_at")
            .in("pipeline_lead_id", leadIds)
            .order("created_at", { ascending: false })
            .range(from, to)
        );
        ats.forEach((a) => {
          const lid = a.pipeline_lead_id as string;
          if (!ultimaAtMap.has(lid)) ultimaAtMap.set(lid, a.created_at as string);
        });
      }

      let tempoMedio: number | null = null;
      if (leadIds.length) {
        const contatos = await fetchAllRows<{ pipeline_lead_id: string; created_at: string; tipo: string }>((from, to) =>
          supabase
            .from("pipeline_atividades")
            .select("pipeline_lead_id, created_at, tipo")
            .in("pipeline_lead_id", leadIds)
            .in("tipo", ["ligacao", "whatsapp"])
            .order("created_at", { ascending: true })
            .range(from, to)
        );
        const primeiroContato = new Map<string, string>();
        contatos.forEach((c) => {
          const lid = c.pipeline_lead_id as string;
          if (!primeiroContato.has(lid)) primeiroContato.set(lid, c.created_at as string);
        });
        const dias: number[] = [];
        filtered.forEach((r) => {
          const pc = primeiroContato.get(r.id);
          if (pc) {
            const d = (new Date(pc).getTime() - new Date(r.created_at).getTime()) / 86400000;
            if (d >= 0) dias.push(d);
          }
        });
        if (dias.length) tempoMedio = dias.reduce((a, b) => a + b, 0) / dias.length;
      }

      const now = Date.now();
      const processed: LeadProcessado[] = filtered.map((r) => {
        const ultima = ultimaAtMap.get(r.id);
        const userId = r.corretor_id ? corretorUserMap.get(r.corretor_id) : undefined;
        return {
          id: r.id,
          nome: r.nome || "—",
          telefone: r.telefone || "—",
          origem: r.origem || "—",
          etapa: r.stage_id ? stageMap.get(r.stage_id) || "—" : "—",
          corretor: r.corretor_id ? corretorNameMap.get(r.corretor_id) || "—" : "—",
          equipe: userId ? equipeMap.get(userId) || "—" : "—",
          diasNoFunil: Math.floor((now - new Date(r.created_at).getTime()) / 86400000),
          ultimaAtividade: ultima ? fmtDate(ultima.slice(0, 10)) : "—",
          createdAt: r.created_at,
        };
      });

      return { leads: processed, tempoMedio };
    }

    async function load() {
      setLoading(true);
      const [curr, ant] = await Promise.all([
        fetchLeads(startDate, endDate),
        fetchLeads(prev.startDate, prev.endDate),
      ]);
      if (!cancelled) {
        setLeads(curr.leads);
        setLeadsAnterior(ant.leads);
        setTempoMedio1(curr.tempoMedio);
        setTempoMedio1Ant(ant.tempoMedio);
        setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [startDate, endDate, prev.startDate, prev.endDate, filters.corretor, filters.equipe, filters.segmento]);

  const total = leads.length;
  const totalAnt = leadsAnterior.length;
  const ETAPAS_INATIVAS = ["Negócio Criado", "Descarte"];
  const ativos = leads.filter((l) => !ETAPAS_INATIVAS.includes(l.etapa)).length;
  const ativosAnt = leadsAnterior.filter((l) => !ETAPAS_INATIVAS.includes(l.etapa)).length;
  const ETAPAS_SEM_CONTATO = ["Novo Lead", "Sem Contato"];
  const semContato = leads.filter((l) => ETAPAS_SEM_CONTATO.includes(l.etapa)).length;
  const semContatoAnt = leadsAnterior.filter((l) => ETAPAS_SEM_CONTATO.includes(l.etapa)).length;

  function pctVar(curr: number, prev2: number): { label: string; positive: boolean } | null {
    if (prev2 === 0 && curr === 0) return null;
    if (prev2 === 0) return { label: "+100%", positive: true };
    const pct = Math.round(((curr - prev2) / prev2) * 100);
    return { label: `${pct >= 0 ? "+" : ""}${pct}%`, positive: pct >= 0 };
  }
  function absVar(curr: number, prev2: number): { label: string; positive: boolean } | null {
    const diff = curr - prev2;
    if (diff === 0) return null;
    return { label: `${diff > 0 ? "+" : ""}${diff}`, positive: diff <= 0 };
  }

  const chartData = useMemo(() => groupLeads(leads, filters.periodo, startDate, endDate), [leads, filters.periodo, startDate, endDate]);

  const filteredLeads = useMemo(() => {
    if (!search) return leads;
    const q = search.toLowerCase();
    return leads.filter((l) => l.nome.toLowerCase().includes(q) || l.telefone.toLowerCase().includes(q));
  }, [leads, search]);

  const sorted = useMemo(() => {
    const arr = [...filteredLeads];
    arr.sort((a, b) => {
      let va: string | number = a[sortCol];
      let vb: string | number = b[sortCol];
      if (typeof va === "string") va = va.toLowerCase();
      if (typeof vb === "string") vb = vb.toLowerCase();
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [filteredLeads, sortCol, sortDir]);

  const pageSize = 20;
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const paged = sorted.slice(page * pageSize, (page + 1) * pageSize);

  function toggleSort(col: SortCol) {
    if (sortCol === col) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
  }

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
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
              {[1, 2, 3, 4, 5, 6, 7].map((j) => (
                <div key={j} style={{ background: "#f3f4f6", borderRadius: 4, height: 14, flex: 1 }} className="animate-pulse" />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!leads.length) {
    return (
      <div style={{ background: "#fff", borderRadius: 10, border: "0.5px solid #e5e7eb", padding: 60, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
        <Users size={40} strokeWidth={1} color="#C7D2FE" />
        <div style={{ fontSize: 13, color: "#6b7280" }}>Nenhum lead no período selecionado</div>
      </div>
    );
  }

  const kpiTotalVar = pctVar(total, totalAnt);
  const kpiAtivosVar = pctVar(ativos, ativosAnt);
  const kpiSemContatoVar = absVar(semContato, semContatoAnt);

  let tempoMedioVar: { label: string; positive: boolean } | null = null;
  if (tempoMedio1 != null && tempoMedio1Ant != null && tempoMedio1Ant > 0) {
    const pct = Math.round(((tempoMedio1 - tempoMedio1Ant) / tempoMedio1Ant) * 100);
    if (pct !== 0) tempoMedioVar = { label: `${pct >= 0 ? "+" : ""}${pct}%`, positive: pct <= 0 };
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        <KpiCard label="TOTAL DE LEADS" value={String(total)} variation={kpiTotalVar} />
        <KpiCard label="LEADS ATIVOS" value={String(ativos)} subtitle="Excl. negócio criado e descarte" variation={kpiAtivosVar} />
        <KpiCard label="LEADS SEM CONTATO" value={String(semContato)} variation={kpiSemContatoVar} />
        <KpiCard
          label="TEMPO MÉDIO 1º CONTATO"
          value={tempoMedio1 != null ? `${tempoMedio1.toFixed(1).replace(".", ",")} dias` : "—"}
          variation={tempoMedioVar}
        />
      </div>

      <div style={{ background: "#fff", borderRadius: 10, border: "0.5px solid #e5e7eb", padding: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: "#111827", marginBottom: 16 }}>{chartTitle(filters.periodo)}</div>
        <div style={{ width: "100%", height: 240 }}>
          <ResponsiveContainer>
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
              <Tooltip cursor={{ fill: "#f3f4f6" }} content={<ChartTooltipCustom />} />
              <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ background: "#fff", borderRadius: 10, border: "0.5px solid #e5e7eb" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "0.5px solid #e5e7eb" }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: "#111827" }}>Leads ({filteredLeads.length})</div>
          <div style={{ position: "relative" }}>
            <Search size={14} color="#9ca3af" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
            <input
              type="text"
              placeholder="Buscar por nome ou telefone"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: 30, paddingRight: 12, height: 32, fontSize: 12, border: "0.5px solid #e5e7eb", borderRadius: 6, width: 240, outline: "none", background: "#fff" }}
            />
          </div>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <Th label="Lead" col="nome" sortCol={sortCol} sortDir={sortDir} onClick={toggleSort} />
              <Th label="Origem" col="origem" sortCol={sortCol} sortDir={sortDir} onClick={toggleSort} />
              <Th label="Etapa" col="etapa" sortCol={sortCol} sortDir={sortDir} onClick={toggleSort} />
              <Th label="Corretor" col="corretor" sortCol={sortCol} sortDir={sortDir} onClick={toggleSort} />
              <Th label="Equipe" col="equipe" sortCol={sortCol} sortDir={sortDir} onClick={toggleSort} />
              <Th label="Dias no funil" col="diasNoFunil" sortCol={sortCol} sortDir={sortDir} onClick={toggleSort} />
              <Th label="Última atividade" col="ultimaAtividade" sortCol={sortCol} sortDir={sortDir} onClick={toggleSort} />
            </tr>
          </thead>
          <tbody>
            {paged.map((l) => (
              <tr key={l.id} style={{ borderBottom: "0.5px solid #f3f4f6" }} className="hover:bg-[#f9fafb]">
                <td style={{ padding: "10px 16px", fontSize: 13 }}>
                  <div style={{ fontWeight: 500, color: "#111827" }}>{l.nome}</div>
                  <div style={{ fontSize: 11, color: "#9ca3af" }}>{l.telefone}</div>
                </td>
                <td style={{ padding: "10px 16px", fontSize: 13, color: "#374151" }}>{l.origem}</td>
                <td style={{ padding: "10px 16px" }}><EtapaBadge label={l.etapa} /></td>
                <td style={{ padding: "10px 16px", fontSize: 13, color: "#374151" }}>{l.corretor}</td>
                <td style={{ padding: "10px 16px", fontSize: 13, color: "#374151" }}>{l.equipe}</td>
                <td style={{ padding: "10px 16px", fontSize: 13, color: "#374151" }}>{l.diasNoFunil}</td>
                <td style={{ padding: "10px 16px", fontSize: 13, color: "#374151" }}>{l.ultimaAtividade}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {totalPages > 1 && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 16px", borderTop: "0.5px solid #e5e7eb" }}>
            <div style={{ fontSize: 11, color: "#9ca3af" }}>Página {page + 1} de {totalPages}</div>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} style={{ padding: "4px 10px", fontSize: 12, border: "0.5px solid #e5e7eb", borderRadius: 6, background: "#fff", cursor: page === 0 ? "not-allowed" : "pointer", opacity: page === 0 ? 0.5 : 1 }}>Anterior</button>
              <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} style={{ padding: "4px 10px", fontSize: 12, border: "0.5px solid #e5e7eb", borderRadius: 6, background: "#fff", cursor: page >= totalPages - 1 ? "not-allowed" : "pointer", opacity: page >= totalPages - 1 ? 0.5 : 1 }}>Próxima</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function KpiCard({ label, value, subtitle, variation }: { label: string; value: string; subtitle?: string; variation: { label: string; positive: boolean } | null }) {
  return (
    <div style={{ background: "#fff", borderRadius: 10, border: "0.5px solid #e5e7eb", padding: "14px 16px" }}>
      <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", color: "#9ca3af", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 500, color: "#111827" }}>{value}</div>
      {subtitle && <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{subtitle}</div>}
      {variation && (
        <div style={{ fontSize: 11, color: variation.positive ? "#10b981" : "#ef4444", marginTop: 4 }}>
          {variation.label} vs período anterior
        </div>
      )}
    </div>
  );
}

function Th({ label, col, sortCol, sortDir, onClick }: { label: string; col: SortCol; sortCol: SortCol; sortDir: SortDir; onClick: (c: SortCol) => void }) {
  const active = sortCol === col;
  return (
    <th onClick={() => onClick(col)} style={{ fontSize: 11, color: "#9ca3af", fontWeight: 500, padding: "8px 16px", borderBottom: "0.5px solid #e5e7eb", background: "#fafafa", textAlign: "left", cursor: "pointer", userSelect: "none" }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
        {label}
        {active && (sortDir === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
      </span>
    </th>
  );
}
