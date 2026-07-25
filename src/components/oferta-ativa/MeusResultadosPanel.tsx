// MeusResultadosPanel — Oferta Ativa · Fase 5 · Bloco 5 (Onda 5)
// Dashboard pessoal do corretor: KPIs, funil, ranking por empreendimento,
// horários e histórico das últimas ligações. Sem ranking público.

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthUser } from "@/hooks/useAuthUser";
import { formatBRT } from "@/lib/brtTime";
import { Loader2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

type Periodo = "hoje" | "7d" | "mes" | "30d";

const PERIODOS: { key: Periodo; label: string }[] = [
  { key: "hoje", label: "Hoje" },
  { key: "7d", label: "Últimos 7 dias" },
  { key: "mes", label: "Este mês" },
  { key: "30d", label: "Últimos 30d" },
];

const RESULT_LABEL: Record<string, { label: string; tone: string }> = {
  aproveitado:         { label: "✓ Aproveitado",     tone: "bg-emerald-500/15 text-emerald-300" },
  com_interesse:       { label: "✓ Com interesse",   tone: "bg-emerald-500/15 text-emerald-300" },
  visita_agendada:     { label: "🏠 Visita",         tone: "bg-indigo-500/15 text-indigo-300" },
  sem_interesse:       { label: "🗣 Sem interesse",  tone: "bg-sky-500/15 text-sky-300" },
  nao_atendeu:         { label: "📵 Não atendeu",    tone: "bg-amber-500/15 text-amber-300" },
  numero_errado:       { label: "✕ Nº errado",       tone: "bg-rose-500/15 text-rose-300" },
  descarte_definitivo: { label: "✕ Descartado",      tone: "bg-rose-500/15 text-rose-300" },
  pulado:              { label: "⤼ Pulado",          tone: "bg-slate-500/15 text-slate-300" },
};

const APROVEITADOS = new Set(["aproveitado", "com_interesse", "visita_agendada"]);
const NAO_ATENDIDAS = new Set(["nao_atendeu", "pulado"]);

function periodoRange(p: Periodo): { start: Date; prevStart: Date; prevEnd: Date } {
  const now = new Date();
  const start = new Date(now);
  let days = 1;
  if (p === "hoje") { start.setHours(0, 0, 0, 0); days = 1; }
  else if (p === "7d") { start.setDate(now.getDate() - 7); days = 7; }
  else if (p === "mes") { start.setDate(1); start.setHours(0, 0, 0, 0);
                          days = Math.max(1, Math.ceil((now.getTime() - start.getTime()) / 86400000)); }
  else { start.setDate(now.getDate() - 30); days = 30; }
  const prevEnd = new Date(start);
  const prevStart = new Date(start); prevStart.setDate(prevStart.getDate() - days);
  return { start, prevStart, prevEnd };
}

export default function MeusResultadosPanel() {
  const { authUserId, isLoading: authLoading } = useAuthUser();
  const [periodo, setPeriodo] = useState<Periodo>("7d");
  const [filtroResultado, setFiltroResultado] = useState<string>("todos");

  const range = useMemo(() => periodoRange(periodo), [periodo]);

  const { data, isLoading } = useQuery({
    queryKey: ["oa-meus-resultados", authUserId, periodo],
    enabled: !!authUserId,
    queryFn: async () => {
      const [atuais, anteriores] = await Promise.all([
        supabase
          .from("oferta_ativa_tentativas")
          .select("id, resultado, empreendimento, created_at, lead_id, feedback")
          .eq("corretor_id", authUserId!)
          .gte("created_at", range.start.toISOString())
          .order("created_at", { ascending: false })
          .limit(1000),
        supabase
          .from("oferta_ativa_tentativas")
          .select("id, resultado", { count: "exact", head: false })
          .eq("corretor_id", authUserId!)
          .gte("created_at", range.prevStart.toISOString())
          .lt("created_at", range.prevEnd.toISOString())
          .limit(2000),
      ]);
      if (atuais.error) throw atuais.error;
      return {
        rows: atuais.data ?? [],
        anteriores: anteriores.data ?? [],
      };
    },
    staleTime: 60_000,
  });

  const kpis = useMemo(() => {
    const rows = data?.rows ?? [];
    const prev = data?.anteriores ?? [];
    const calc = (arr: any[]) => {
      const total = arr.length;
      const atendidas = arr.filter((r) => !NAO_ATENDIDAS.has(r.resultado)).length;
      const aproveitados = arr.filter((r) => APROVEITADOS.has(r.resultado)).length;
      const visitas = arr.filter((r) => r.resultado === "visita_agendada").length;
      return { total, atendidas, aproveitados, visitas };
    };
    return { atual: calc(rows), anterior: calc(prev) };
  }, [data]);

  const funnel = useMemo(() => {
    const rows = data?.rows ?? [];
    const total = rows.length || 1;
    const atendidas = kpis.atual.atendidas;
    const aproveitados = kpis.atual.aproveitados;
    const visitas = kpis.atual.visitas;
    return [
      { label: "Ligações discadas", n: rows.length, pct: 100, color: "#4969FF" },
      { label: "Atendidas",         n: atendidas,   pct: (atendidas / total) * 100, color: "#4969FF" },
      { label: "Aproveitados",      n: aproveitados, pct: (aproveitados / total) * 100, color: "#10B981" },
      { label: "Visita agendada",   n: visitas,     pct: (visitas / total) * 100, color: "#F59E0B" },
    ];
  }, [data, kpis]);

  const porEmpreendimento = useMemo(() => {
    const rows = data?.rows ?? [];
    const map = new Map<string, { total: number; ok: number }>();
    for (const r of rows) {
      const emp = r.empreendimento || "—";
      const cur = map.get(emp) ?? { total: 0, ok: 0 };
      cur.total += 1;
      if (APROVEITADOS.has(r.resultado)) cur.ok += 1;
      map.set(emp, cur);
    }
    return Array.from(map.entries())
      .map(([emp, v]) => ({ emp, ...v, pct: v.total ? (v.ok / v.total) * 100 : 0 }))
      .sort((a, b) => b.pct - a.pct || b.total - a.total)
      .slice(0, 6);
  }, [data]);

  const heatmap = useMemo(() => {
    const rows = data?.rows ?? [];
    // Hours 8..20 BRT
    const buckets: Record<number, { total: number; ok: number }> = {};
    for (let h = 8; h <= 20; h++) buckets[h] = { total: 0, ok: 0 };
    for (const r of rows) {
      const d = new Date(r.created_at);
      // Converte para BRT (offset fixo -3h)
      const brt = new Date(d.getTime() - 3 * 3600000);
      const h = brt.getUTCHours();
      if (buckets[h]) {
        buckets[h].total += 1;
        if (APROVEITADOS.has(r.resultado)) buckets[h].ok += 1;
      }
    }
    const max = Math.max(1, ...Object.values(buckets).map((b) => b.total));
    return Object.entries(buckets).map(([h, v]) => ({
      hora: Number(h),
      total: v.total,
      pct: v.total ? (v.total / max) * 100 : 0,
      okPct: v.total ? (v.ok / v.total) * 100 : 0,
    }));
  }, [data]);

  const historico = useMemo(() => {
    const rows = data?.rows ?? [];
    const filtered = filtroResultado === "todos"
      ? rows
      : rows.filter((r) => r.resultado === filtroResultado);
    return filtered.slice(0, 30);
  }, [data, filtroResultado]);

  const diff = (a: number, b: number) => {
    const d = a - b;
    if (d === 0) return { label: "= mesma do período anterior", tone: "text-muted-foreground" };
    return {
      label: `${d > 0 ? "▲" : "▼"} ${Math.abs(d)} vs período anterior`,
      tone: d > 0 ? "text-emerald-400" : "text-rose-400",
    };
  };

  const pct = (n: number, total: number) =>
    total ? `${((n / total) * 100).toFixed(1).replace(".", ",")}%` : "0%";

  const exportCsv = () => {
    const rows = data?.rows ?? [];
    const header = "created_at,resultado,empreendimento,feedback\n";
    const body = rows.map((r) =>
      [r.created_at, r.resultado, (r.empreendimento ?? "").replace(/,/g, " "), (r.feedback ?? "").replace(/[,\n]/g, " ")]
        .join(","),
    ).join("\n");
    const blob = new Blob([header + body], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `meus-resultados-${periodo}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando seus resultados…
      </div>
    );
  }

  const rowsCount = data?.rows.length ?? 0;

  return (
    <div className="space-y-4">
      {/* Filtro de período */}
      <div className="flex flex-wrap items-center gap-2">
        {PERIODOS.map((p) => {
          const active = periodo === p.key;
          return (
            <button
              key={p.key}
              onClick={() => setPeriodo(p.key)}
              className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                active
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card hover:bg-muted border-border text-muted-foreground"
              }`}
            >
              {p.label}
            </button>
          );
        })}
        <div className="ml-auto text-xs text-muted-foreground">
          {formatBRT(range.start.toISOString(), "dd/MM")} → hoje · comparado ao anterior
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi title="Ligações" value={kpis.atual.total} sub={diff(kpis.atual.total, kpis.anterior.total)} />
        <Kpi
          title="Atendidas"
          value={`${kpis.atual.atendidas} (${pct(kpis.atual.atendidas, kpis.atual.total)})`}
          sub={diff(kpis.atual.atendidas, kpis.anterior.atendidas)}
        />
        <Kpi
          title="Aproveitados"
          value={`${kpis.atual.aproveitados} (${pct(kpis.atual.aproveitados, kpis.atual.total)})`}
          sub={diff(kpis.atual.aproveitados, kpis.anterior.aproveitados)}
        />
        <Kpi
          title="Visitas agendadas"
          value={kpis.atual.visitas}
          sub={diff(kpis.atual.visitas, kpis.anterior.visitas)}
        />
      </div>

      {/* Funil */}
      <section className="rounded-xl border bg-card p-5">
        <h3 className="text-base font-semibold mb-4">Seu funil da Oferta Ativa</h3>
        <div className="space-y-3">
          {funnel.map((f) => (
            <div key={f.label}>
              <div className="flex items-center justify-between text-sm mb-1">
                <span>{f.label}</span>
                <span className="text-muted-foreground">
                  {f.n} · {f.pct.toFixed(1).replace(".", ",")}%
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${Math.max(2, f.pct)}%`, background: f.color }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Onde acerta mais + heatmap */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="rounded-xl border bg-card p-5">
          <h3 className="text-base font-semibold mb-3">🎯 Onde você acerta mais</h3>
          {porEmpreendimento.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem ligações no período.</p>
          ) : (
            <div className="space-y-2.5">
              {porEmpreendimento.map((e) => (
                <div key={e.emp} className="flex items-center justify-between text-sm">
                  <span className="truncate max-w-[55%]">{e.emp}</span>
                  <span className="text-muted-foreground">
                    {e.pct.toFixed(1).replace(".", ",")}% aproveit. · {e.total} lig.
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-xl border bg-card p-5">
          <h3 className="text-base font-semibold mb-3">⏰ Seu horário mais quente</h3>
          <div className="grid grid-cols-13 gap-1 items-end h-32" style={{ gridTemplateColumns: "repeat(13,1fr)" }}>
            {heatmap.map((b) => (
              <div
                key={b.hora}
                title={`${b.hora}h · ${b.total} ligações · ${b.okPct.toFixed(0)}% aproveit.`}
                className="rounded"
                style={{
                  height: `${Math.max(4, b.pct)}%`,
                  background:
                    b.okPct >= 10
                      ? "#4969FF"
                      : b.total > 0
                      ? "rgba(73,105,255,0.45)"
                      : "rgba(148,163,184,0.15)",
                }}
              />
            ))}
          </div>
          <div className="grid gap-1 text-[10px] text-muted-foreground mt-1 text-center" style={{ gridTemplateColumns: "repeat(13,1fr)" }}>
            {heatmap.map((b) => (<div key={b.hora}>{b.hora}h</div>))}
          </div>
        </section>
      </div>

      {/* Histórico */}
      <section className="rounded-xl border bg-card overflow-hidden">
        <div className="p-4 border-b flex flex-wrap items-center gap-2">
          <div className="mr-auto">
            <h3 className="text-base font-semibold">🕘 Histórico de ligações</h3>
            <p className="text-xs text-muted-foreground">
              Mostrando {historico.length} de {rowsCount}
            </p>
          </div>
          {["todos", "aproveitado", "com_interesse", "sem_interesse", "nao_atendeu"].map((k) => {
            const active = filtroResultado === k;
            return (
              <button
                key={k}
                onClick={() => setFiltroResultado(k)}
                className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
                  active
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card hover:bg-muted border-border text-muted-foreground"
                }`}
              >
                {k === "todos" ? "Todos" : RESULT_LABEL[k]?.label ?? k}
              </button>
            );
          })}
          <Button size="sm" variant="outline" onClick={exportCsv} className="h-7 text-[11px]">
            <Download className="w-3 h-3 mr-1" /> CSV
          </Button>
        </div>
        <div className="divide-y">
          {historico.length === 0 && (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Nada aqui ainda no período selecionado.
            </div>
          )}
          {historico.map((r) => {
            const meta = RESULT_LABEL[r.resultado] ?? { label: r.resultado, tone: "bg-muted text-muted-foreground" };
            return (
              <div key={r.id} className="px-4 py-2.5 flex items-center gap-3 text-sm hover:bg-muted/30">
                <span className="text-[11px] text-muted-foreground w-24 shrink-0">
                  {formatBRT(r.created_at, "dd/MM HH:mm")}
                </span>
                <span className={`text-[11px] px-2 py-0.5 rounded-full ${meta.tone} shrink-0`}>
                  {meta.label}
                </span>
                <div className="flex-1 truncate">
                  <span className="text-foreground">{r.empreendimento || "—"}</span>
                  {r.feedback && (
                    <span className="text-muted-foreground text-xs ml-2">· {r.feedback}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function Kpi({
  title,
  value,
  sub,
}: {
  title: string;
  value: number | string;
  sub: { label: string; tone: string };
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{title}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
      <div className={`text-[11px] mt-1 ${sub.tone}`}>{sub.label}</div>
    </div>
  );
}
