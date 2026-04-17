import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ShoppingBag, ArrowUp, ArrowDown, ChevronUp, ChevronDown, Search } from "lucide-react";
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { ReportFilters, getDateRange, getPeriodoAnterior, fmtMoney, fmtDate } from "./reportUtils";
import { fetchAllRows } from "@/lib/paginatedFetch";

// ── Types ──────────────────────────────────────────────────────────────────────

interface RelatorioVendasProps {
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

interface VendaProcessada {
  id: string;
  corretor: string;
  equipe: string;
  empreendimento: string;
  vgv: number;
  vgvEfetivo: number;
  segmento: string;
  data: string;
  status: string;
}

type SortCol = "corretor" | "equipe" | "empreendimento" | "vgv" | "segmento" | "data" | "status";
type SortDir = "asc" | "desc";

// ── Helpers ────────────────────────────────────────────────────────────────────

function faseToStatus(fase: string): string {
  if (fase === "vendido") return "Confirmada";
  if (fase === "assinado") return "Pendente";
  if (fase === "distrato") return "Distrato";
  return fase;
}

// ── Badge components ───────────────────────────────────────────────────────────

const SEG_BADGE: Record<string, { bg: string; color: string }> = {
  "MCMV / Até 500k": { bg: "#d1fae5", color: "#065f46" },
  "Médio-Alto Padrão": { bg: "#EEF2FF", color: "#4F46E5" },
  "Altíssimo Padrão": { bg: "#ede9fe", color: "#5b21b6" },
  "Investimento": { bg: "#fef3c7", color: "#92400e" },
};

const STATUS_BADGE: Record<string, { bg: string; color: string }> = {
  Confirmada: { bg: "#d1fae5", color: "#065f46" },
  Pendente: { bg: "#fef3c7", color: "#92400e" },
  Distrato: { bg: "#fee2e2", color: "#991b1b" },
};

function Badge({ label, map }: { label: string; map: Record<string, { bg: string; color: string }> }) {
  const s = map[label] || { bg: "#f3f4f6", color: "#6b7280" };
  return (
    <span style={{ display: "inline-block", fontSize: 10, padding: "2px 8px", borderRadius: 10, background: s.bg, color: s.color, whiteSpace: "nowrap" }}>
      {label}
    </span>
  );
}

// ── Chart helpers ──────────────────────────────────────────────────────────────

function groupVendas(vendas: VendaProcessada[], periodo: string, startDate: Date, endDate: Date) {
  const diffDays = Math.ceil((endDate.getTime() - startDate.getTime()) / 86400000);

  if (periodo === "hoje") {
    const buckets = Array.from({ length: 24 }, (_, i) => ({ label: `${i}h`, vgv: 0 }));
    vendas.forEach((v) => { const h = 12; buckets[h].vgv += v.vgvEfetivo; });
    return buckets.filter((b) => b.vgv > 0);
  }
  if (periodo === "semana") {
    const days = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
    const buckets = days.map((d) => ({ label: d, vgv: 0 }));
    vendas.forEach((v) => {
      if (!v.data) return;
      const dt = new Date(v.data + "T12:00:00");
      const day = dt.getDay();
      const idx = day === 0 ? 6 : day - 1;
      buckets[idx].vgv += v.vgvEfetivo;
    });
    return buckets;
  }
  if (periodo === "mes") {
    const buckets = [{ label: "S1", vgv: 0 }, { label: "S2", vgv: 0 }, { label: "S3", vgv: 0 }, { label: "S4", vgv: 0 }, { label: "S5", vgv: 0 }];
    vendas.forEach((v) => {
      if (!v.data) return;
      const day = new Date(v.data + "T12:00:00").getDate();
      const idx = Math.min(Math.floor((day - 1) / 7), 4);
      buckets[idx].vgv += v.vgvEfetivo;
    });
    return buckets.filter((b) => b.vgv > 0 || buckets.indexOf(b) < 4);
  }
  // custom
  if (diffDays <= 14) {
    const map = new Map<string, number>();
    vendas.forEach((v) => { if (v.data) map.set(v.data, (map.get(v.data) || 0) + v.vgvEfetivo); });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([d, vgv]) => ({ label: fmtDate(d), vgv }));
  }
  if (diffDays <= 90) {
    const map = new Map<string, number>();
    vendas.forEach((v) => {
      if (!v.data) return;
      const dt = new Date(v.data + "T12:00:00");
      const weekStart = new Date(dt); weekStart.setDate(dt.getDate() - ((dt.getDay() + 6) % 7));
      const key = fmtDate(weekStart.toISOString().slice(0, 10));
      map.set(key, (map.get(key) || 0) + v.vgvEfetivo);
    });
    return Array.from(map.entries()).map(([label, vgv]) => ({ label, vgv }));
  }
  const map = new Map<string, number>();
  const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  vendas.forEach((v) => {
    if (!v.data) return;
    const dt = new Date(v.data + "T12:00:00");
    const key = `${months[dt.getMonth()]}/${dt.getFullYear() % 100}`;
    map.set(key, (map.get(key) || 0) + v.vgvEfetivo);
  });
  return Array.from(map.entries()).map(([label, vgv]) => ({ label, vgv }));
}

function chartTitle(periodo: string): string {
  const map: Record<string, string> = { hoje: "hora", semana: "dia", mes: "semana" };
  return `VGV por ${map[periodo] || "período"}`;
}

// ── Custom Tooltip ─────────────────────────────────────────────────────────────

function ChartTooltipCustom({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 8, padding: "6px 10px", fontSize: 12 }}>
      <div style={{ color: "#6b7280" }}>{label}</div>
      <div style={{ fontWeight: 500, color: "#111827" }}>{fmtMoney(payload[0].value)}</div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function RelatorioVendas({ filters }: RelatorioVendasProps) {
  const [loading, setLoading] = useState(true);
  const [vendas, setVendas] = useState<VendaProcessada[]>([]);
  const [vendasAnterior, setVendasAnterior] = useState<VendaProcessada[]>([]);
  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState<SortCol>("data");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(0);

  const { startDate, endDate } = useMemo(() => getDateRange(filters), [filters]);
  const prev = useMemo(() => getPeriodoAnterior(startDate, endDate), [startDate, endDate]);

  useEffect(() => { setPage(0); }, [filters, search, sortCol, sortDir]);

  useEffect(() => {
    let cancelled = false;

    async function fetchVendas(s: Date, e: Date): Promise<VendaProcessada[]> {
      const sISO = s.toISOString().slice(0, 10);
      const eISO = e.toISOString().slice(0, 10);

      const negocios = await fetchAllRows<NegocioRow>((from, to) => {
        let q = supabase
          .from("negocios")
          .select("id, empreendimento, fase, vgv_final, vgv_estimado, data_assinatura, corretor_id, pipeline_lead_id, created_at")
          .in("fase", ["vendido", "assinado"])
          .gte("data_assinatura", sISO)
          .lte("data_assinatura", eISO);
        if (filters.corretor) q = q.eq("corretor_id", filters.corretor);
        return q.range(from, to);
      });

      if (!negocios.length) return [];

      const rows = negocios;

      // Filter by equipe if needed
      let filteredRows = rows;
      if (filters.equipe && !filters.corretor) {
        const { data: membros } = await supabase
          .from("team_members")
          .select("user_id")
          .eq("gerente_id", filters.equipe);
        if (membros?.length) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id")
            .in("user_id", membros.map((m) => m.user_id));
          if (profiles?.length) {
            const ids = new Set(profiles.map((p) => p.id));
            filteredRows = rows.filter((r) => r.corretor_id && ids.has(r.corretor_id));
          } else {
            filteredRows = [];
          }
        } else {
          filteredRows = [];
        }
      }

      // Get pipeline_lead_ids for segmento lookup
      const leadIds = [...new Set(filteredRows.map((r) => r.pipeline_lead_id).filter(Boolean))] as string[];
      const segMap = new Map<string, string>();

      if (leadIds.length > 0) {
        const { data: leads } = await supabase
          .from("pipeline_leads")
          .select("id, segmento_id")
          .in("id", leadIds);
        if (leads?.length) {
          const segIds = [...new Set(leads.map((l) => l.segmento_id).filter(Boolean))] as string[];
          if (segIds.length) {
            const { data: segs } = await supabase
              .from("roleta_segmentos")
              .select("id, nome")
              .in("id", segIds);
            const segNameMap = new Map<string, string>((segs || []).map((s2) => [s2.id, s2.nome as string]));
            leads.forEach((l) => {
              const segId = l.segmento_id as string | null;
              if (segId) segMap.set(l.id, segNameMap.get(segId) || "—");
            });
          }
        }
      }

      // Filter by segmento
      if (filters.segmento) {
        filteredRows = filteredRows.filter((r) => {
          if (!r.pipeline_lead_id) return false;
          const seg = segMap.get(r.pipeline_lead_id) || "";
          return seg.toLowerCase().includes(filters.segmento.toLowerCase());
        });
      }

      // Get parcerias
      const parcMap = new Map<string, number>();
      if (leadIds.length > 0) {
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

      // Get corretor names + gestor info
      const corretorIds = [...new Set(filteredRows.map((r) => r.corretor_id).filter(Boolean))] as string[];
      const corretorNameMap = new Map<string, string>();
      const corretorUserMap = new Map<string, string>();

      if (corretorIds.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, nome, user_id")
          .in("id", corretorIds);
        (profs || []).forEach((p) => {
          corretorNameMap.set(p.id, p.nome || "—");
          if (p.user_id) corretorUserMap.set(p.id, p.user_id);
        });
      }

      // Get equipe (gestor name) via team_members
      const userIds = [...corretorUserMap.values()];
      const equipeMap = new Map<string, string>();

      if (userIds.length) {
        const { data: members } = await supabase
          .from("team_members")
          .select("user_id, gerente_id")
          .in("user_id", userIds);
        if (members?.length) {
          const gerenteIds = [...new Set(members.map((m) => m.gerente_id).filter(Boolean))] as string[];
          if (gerenteIds.length) {
            const { data: gerentes } = await supabase
              .from("profiles")
              .select("id, nome, user_id")
              .in("user_id", gerenteIds);
            const gerenteNameMap = new Map<string, string>((gerentes || []).map((g) => [g.user_id as string, g.nome || "—"]));
            members.forEach((m) => {
              const gId = m.gerente_id as string;
              equipeMap.set(m.user_id, gerenteNameMap.get(gId) || "—");
            });
          }
        }
      }

      return filteredRows.map((r): VendaProcessada => {
        const vgv = r.vgv_final ?? r.vgv_estimado ?? 0;
        const divPrincipal = r.pipeline_lead_id ? parcMap.get(r.pipeline_lead_id) : undefined;
        const vgvEfetivo = divPrincipal != null ? Math.round(vgv * divPrincipal / 100) : vgv;
        const userId = r.corretor_id ? corretorUserMap.get(r.corretor_id) : undefined;

        return {
          id: r.id,
          corretor: r.corretor_id ? corretorNameMap.get(r.corretor_id) || "—" : "—",
          equipe: userId ? equipeMap.get(userId) || "—" : "—",
          empreendimento: r.empreendimento || "—",
          vgv: Math.round(vgv),
          vgvEfetivo: Math.round(vgvEfetivo),
          segmento: r.pipeline_lead_id ? segMap.get(r.pipeline_lead_id) || "—" : "—",
          data: r.data_assinatura || r.created_at.slice(0, 10),
          status: faseToStatus(r.fase),
        };
      });
    }

    async function load() {
      setLoading(true);
      const [current, anterior] = await Promise.all([
        fetchVendas(startDate, endDate),
        fetchVendas(prev.startDate, prev.endDate),
      ]);
      if (!cancelled) {
        setVendas(current);
        setVendasAnterior(anterior);
        setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [startDate, endDate, prev.startDate, prev.endDate, filters.corretor, filters.equipe, filters.segmento]);

  // ── KPIs ───────────────────────────────────────────────────────────────────

  const vgvTotal = vendas.reduce((a, v) => a + v.vgvEfetivo, 0);
  const vgvAnterior = vendasAnterior.reduce((a, v) => a + v.vgvEfetivo, 0);
  const nVendas = vendas.length;
  const nVendasAnt = vendasAnterior.length;
  const ticketMedio = nVendas > 0 ? Math.round(vgvTotal / nVendas) : 0;
  const ticketMedioAnt = nVendasAnt > 0 ? Math.round(vgvAnterior / nVendasAnt) : 0;
  const comissao = Math.round(vgvTotal * 0.03);

  function pctVar(curr: number, prev2: number): { label: string; positive: boolean } | null {
    if (prev2 === 0 && curr === 0) return null;
    if (prev2 === 0) return { label: "+100%", positive: true };
    const pct = Math.round(((curr - prev2) / prev2) * 100);
    return { label: `${pct >= 0 ? "+" : ""}${pct}%`, positive: pct >= 0 };
  }

  // ── Chart data ─────────────────────────────────────────────────────────────

  const chartData = useMemo(() => groupVendas(vendas, filters.periodo, startDate, endDate), [vendas, filters.periodo, startDate, endDate]);

  // ── Table ──────────────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    if (!search) return vendas;
    const q = search.toLowerCase();
    return vendas.filter((v) => v.corretor.toLowerCase().includes(q) || v.empreendimento.toLowerCase().includes(q));
  }, [vendas, search]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let va: string | number = a[sortCol];
      let vb: string | number = b[sortCol];
      if (sortCol === "vgv") { va = a.vgvEfetivo; vb = b.vgvEfetivo; }
      if (typeof va === "string") va = va.toLowerCase();
      if (typeof vb === "string") vb = vb.toLowerCase();
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [filtered, sortCol, sortDir]);

  const pageSize = 20;
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const paged = sorted.slice(page * pageSize, (page + 1) * pageSize);

  function toggleSort(col: SortCol) {
    if (sortCol === col) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
  }

  // ── Shimmer / Loading ──────────────────────────────────────────────────────

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

  // ── Render ─────────────────────────────────────────────────────────────────

  const vgvVar = pctVar(vgvTotal, vgvAnterior);
  const ticketVar = pctVar(ticketMedio, ticketMedioAnt);
  const vendasDiff = nVendas - nVendasAnt;

  const kpis = [
    { label: "VGV TOTAL", value: fmtMoney(vgvTotal), variation: vgvVar },
    { label: "Nº DE VENDAS", value: String(nVendas), variation: vendasDiff !== 0 ? { label: `${vendasDiff > 0 ? "+" : ""}${vendasDiff} vs anterior`, positive: vendasDiff > 0 } : null },
    { label: "TICKET MÉDIO", value: fmtMoney(ticketMedio), variation: ticketVar },
    { label: "COMISSÃO ESTIMADA", value: fmtMoney(comissao), subtitle: "Estimativa 3%" },
  ];

  const thStyle: React.CSSProperties = { fontSize: 11, color: "#9ca3af", fontWeight: 500, textAlign: "left", padding: "8px 16px", borderBottom: "0.5px solid #e5e7eb", background: "#fafafa", cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" };
  const tdStyle: React.CSSProperties = { fontSize: 13, padding: "10px 16px" };

  const cols: { key: SortCol; label: string }[] = [
    { key: "corretor", label: "Corretor" },
    { key: "equipe", label: "Equipe" },
    { key: "empreendimento", label: "Empreendimento" },
    { key: "vgv", label: "VGV" },
    { key: "segmento", label: "Segmento" },
    { key: "data", label: "Data" },
    { key: "status", label: "Status" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        {kpis.map((k) => (
          <div key={k.label} style={{ background: "#fff", borderRadius: 10, border: "0.5px solid #e5e7eb", padding: "14px 16px" }}>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", color: "#9ca3af", marginBottom: 6 }}>{k.label}</div>
            <div style={{ fontSize: 22, fontWeight: 500, color: "#111827" }}>{k.value}</div>
            {k.variation && (
              <div style={{ display: "flex", alignItems: "center", gap: 3, marginTop: 3, fontSize: 11, color: k.variation.positive ? "#10b981" : "#ef4444" }}>
                {k.variation.positive ? <ArrowUp size={11} /> : <ArrowDown size={11} />}
                {k.variation.label}
              </div>
            )}
            {"subtitle" in k && k.subtitle && (
              <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 3 }}>{k.subtitle}</div>
            )}
          </div>
        ))}
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <div style={{ background: "#fff", borderRadius: 10, border: "0.5px solid #e5e7eb", padding: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: "#111827", marginBottom: 12 }}>{chartTitle(filters.periodo)}</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} barCategoryGap="20%">
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltipCustom />} cursor={false} />
              <Bar dataKey="vgv" radius={[4, 4, 0, 0]}>
                {chartData.map((_, i) => (
                  <Cell key={i} fill="#4F46E5" fillOpacity={0.85} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Table */}
      <div style={{ background: "#fff", borderRadius: 10, border: "0.5px solid #e5e7eb", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "0.5px solid #e5e7eb" }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: "#111827" }}>Vendas — detalhamento</span>
          <div style={{ position: "relative" }}>
            <Search size={14} style={{ position: "absolute", left: 8, top: 7, color: "#9ca3af" }} />
            <input
              type="text"
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ fontSize: 12, padding: "5px 8px 5px 28px", border: "0.5px solid #e5e7eb", borderRadius: 8, outline: "none", width: 180 }}
            />
          </div>
        </div>

        {sorted.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 200, gap: 8 }}>
            <ShoppingBag size={40} strokeWidth={1} color="#C7D2FE" />
            <span style={{ fontSize: 14, color: "#6b7280" }}>Nenhuma venda no período selecionado</span>
          </div>
        ) : (
          <>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {cols.map((c) => (
                    <th key={c.key} style={thStyle} onClick={() => toggleSort(c.key)}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
                        {c.label}
                        {sortCol === c.key && (sortDir === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paged.map((v, i) => (
                  <tr key={v.id} style={{ borderBottom: i === paged.length - 1 ? "none" : "0.5px solid #f3f4f6" }} onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#f9fafb"; }} onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = ""; }}>
                    <td style={tdStyle}>{v.corretor}</td>
                    <td style={{ ...tdStyle, color: "#6b7280" }}>{v.equipe}</td>
                    <td style={tdStyle}>{v.empreendimento}</td>
                    <td style={{ ...tdStyle, fontWeight: 500 }}>{fmtMoney(v.vgvEfetivo)}</td>
                    <td style={tdStyle}><Badge label={v.segmento} map={SEG_BADGE} /></td>
                    <td style={{ ...tdStyle, color: "#6b7280" }}>{fmtDate(v.data)}</td>
                    <td style={tdStyle}><Badge label={v.status} map={STATUS_BADGE} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {totalPages > 1 && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, padding: "10px 16px", borderTop: "0.5px solid #e5e7eb" }}>
                <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} style={{ border: "0.5px solid #e5e7eb", borderRadius: 8, padding: "4px 12px", fontSize: 12, background: "#fff", cursor: page === 0 ? "default" : "pointer", opacity: page === 0 ? 0.4 : 1 }}>Anterior</button>
                <span style={{ fontSize: 12, color: "#6b7280" }}>Página {page + 1} de {totalPages}</span>
                <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} style={{ border: "0.5px solid #e5e7eb", borderRadius: 8, padding: "4px 12px", fontSize: 12, background: "#fff", cursor: page >= totalPages - 1 ? "default" : "pointer", opacity: page >= totalPages - 1 ? 0.4 : 1 }}>Próximo</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
