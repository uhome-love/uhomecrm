import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, differenceInDays, startOfDay, isWeekend, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "@/hooks/use-toast";
import { CalendarIcon, Save, MessageSquare, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
  Legend, ReferenceLine, Tooltip as RTooltip,
} from "recharts";

const EVENTO_DATE = new Date("2026-03-21T00:00:00");
const ENCERRA_DATE = new Date("2026-03-31T23:59:59");
const CAMPANHA_INICIO = new Date("2026-03-01");
const TODAY = () => startOfDay(new Date());

type MetaDiaria = {
  id: string;
  gerente_id: string;
  gerente_nome: string | null;
  data: string;
  prospects: number;
  interessados: number;
  pastas_montagem: number;
  pastas_completas: number;
  negocios_projetados: number;
  observacao: string | null;
  created_at: string;
  updated_at: string;
};

const FIELDS = [
  { key: "prospects", label: "👥 Nº de Prospects", desc: "Clientes contatados sobre o Melnick Day" },
  { key: "interessados", label: "⭐ Clientes Interessados", desc: "Confirmaram interesse em participar do evento" },
  { key: "pastas_montagem", label: "📁 Pastas em Montagem", desc: "Clientes com documentação sendo preparada" },
  { key: "pastas_completas", label: "✅ Pastas Completas", desc: "Documentação completa, pronto para assinar" },
  { key: "negocios_projetados", label: "🏆 Negócios Projetados", desc: "Estimativa de contratos que serão fechados no evento" },
] as const;

type FieldKey = typeof FIELDS[number]["key"];

function useMelnickData() {
  return useQuery({
    queryKey: ["melnick-metas-diarias"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("melnick_metas_diarias")
        .select("*")
        .order("data", { ascending: true });
      if (error) throw error;
      return (data || []) as MetaDiaria[];
    },
    staleTime: 30_000,
  });
}

/** Helper: relative time label for updated_at */
function relativeUpdate(updatedAt: string): { label: string; isOld: boolean } {
  const d = new Date(updatedAt);
  const now = new Date();
  const today = format(now, "yyyy-MM-dd");
  const updDay = format(d, "yyyy-MM-dd");
  if (updDay === today) {
    return { label: `hoje às ${format(d, "HH:mm")}`, isOld: false };
  }
  const diff = differenceInDays(now, d);
  if (diff === 1) return { label: "ontem", isOld: false };
  return { label: `há ${diff} dias`, isOld: diff >= 3 };
}

// ─── FORM SECTION ───
function FormSection({ userId, nome }: { userId: string; nome: string }) {
  const today = format(TODAY(), "yyyy-MM-dd");
  const qc = useQueryClient();
  const { data: allData = [] } = useMelnickData();
  const existing = allData.find((r) => r.gerente_id === userId && r.data === today);

  const [form, setForm] = useState<Record<FieldKey | "observacao", any>>({
    prospects: 0, interessados: 0, pastas_montagem: 0, pastas_completas: 0, negocios_projetados: 0, observacao: "",
  });

  useEffect(() => {
    if (existing) {
      setForm({
        prospects: existing.prospects,
        interessados: existing.interessados,
        pastas_montagem: existing.pastas_montagem,
        pastas_completas: existing.pastas_completas,
        negocios_projetados: existing.negocios_projetados,
        observacao: existing.observacao || "",
      });
    }
  }, [existing]);

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        gerente_id: userId,
        gerente_nome: nome,
        data: today,
        prospects: Number(form.prospects) || 0,
        interessados: Number(form.interessados) || 0,
        pastas_montagem: Number(form.pastas_montagem) || 0,
        pastas_completas: Number(form.pastas_completas) || 0,
        negocios_projetados: Number(form.negocios_projetados) || 0,
        observacao: form.observacao || null,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase
        .from("melnick_metas_diarias")
        .upsert(payload, { onConflict: "gerente_id,data" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["melnick-metas-diarias"] });
      toast({ title: "✓ Forecast salvo com sucesso" });
      window.dispatchEvent(new Event("melnick-meta-saved"));
    },
    onError: () => toast({ title: "Erro ao salvar", variant: "destructive" }),
  });

  const encerrada = new Date() > ENCERRA_DATE;

  return (
    <Card className="border-amber-500/30 bg-gradient-to-br from-neutral-900 to-neutral-800">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg text-white flex flex-wrap items-center gap-2">
          📝 Seu forecast de hoje — {format(TODAY(), "dd/MM/yyyy")}
          {existing ? (
            <Badge variant="outline" className="border-green-500/50 text-green-400 text-xs">
              ✓ Atualizado hoje às {format(new Date(existing.updated_at), "HH:mm")}
            </Badge>
          ) : (
            <Badge variant="outline" className="border-amber-500/50 text-amber-400 text-xs">
              ⚠️ Ainda não registrado hoje
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {encerrada ? (
          <p className="text-muted-foreground text-sm">Campanha encerrada em 31/03/2026. Formulário bloqueado.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FIELDS.map((f) => (
              <div key={f.key}>
                <label className="text-sm font-medium text-white/80">{f.label}</label>
                <p className="text-[11px] text-muted-foreground mb-1">{f.desc}</p>
                <Input
                  type="number"
                  min={0}
                  value={form[f.key]}
                  onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                  className="bg-white/5 border-white/10 text-white"
                />
              </div>
            ))}
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="text-sm font-medium text-white/80">💬 Observação do dia</label>
              <Textarea
                value={form.observacao}
                onChange={(e) => setForm((p) => ({ ...p, observacao: e.target.value }))}
                placeholder="Algum destaque, dificuldade ou informação relevante do dia..."
                className="bg-white/5 border-white/10 text-white mt-1"
                rows={2}
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <Button onClick={() => mutation.mutate()} disabled={mutation.isPending} className="bg-amber-600 hover:bg-amber-700 text-white">
                <Save className="h-4 w-4 mr-2" /> {mutation.isPending ? "Salvando..." : "💾 Salvar forecast de hoje"}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── CEO EXECUTIVE SUMMARY ───
function CeoSummaryCard({ data }: { data: MetaDiaria[] }) {
  const today = format(TODAY(), "yyyy-MM-dd");
  const todayData = data.filter((r) => r.data === today);

  const todayTotals = useMemo(() => {
    const t = { prospects: 0, interessados: 0, pastas_completas: 0, negocios_projetados: 0 };
    todayData.forEach((r) => {
      t.prospects += r.prospects || 0;
      t.interessados += r.interessados || 0;
      t.pastas_completas += r.pastas_completas || 0;
      t.negocios_projetados += r.negocios_projetados || 0;
    });
    return t;
  }, [todayData]);

  const campanhaTotals = useMemo(() => {
    const t = { prospects: 0, interessados: 0, pastas_completas: 0, negocios_projetados: 0 };
    data.forEach((r) => {
      t.prospects += r.prospects || 0;
      t.interessados += r.interessados || 0;
      t.pastas_completas += r.pastas_completas || 0;
      t.negocios_projetados += r.negocios_projetados || 0;
    });
    return t;
  }, [data]);

  const allGerentes = useMemo(() => {
    const map = new Map<string, string>();
    data.forEach((r) => { if (r.gerente_nome) map.set(r.gerente_id, r.gerente_nome); });
    return map;
  }, [data]);

  const todayIds = new Set(todayData.map((r) => r.gerente_id));

  return (
    <Card className="border-orange-500/40 bg-gradient-to-br from-neutral-900 to-neutral-800">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg text-orange-300">🎯 Forecast Consolidado — Melnick Day</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <p className="text-xs text-muted-foreground mb-1">Hoje</p>
          <p className="text-sm text-white">
            <strong>{todayTotals.prospects}</strong> prospects · <strong>{todayTotals.interessados}</strong> interessados · <strong>{todayTotals.pastas_completas}</strong> pastas completas · <strong>{todayTotals.negocios_projetados}</strong> projetados
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Acumulado da campanha</p>
          <p className="text-sm text-white">
            <strong>{campanhaTotals.prospects}</strong> prospects · <strong>{campanhaTotals.interessados}</strong> interessados · <strong>{campanhaTotals.pastas_completas}</strong> pastas completas · <strong>{campanhaTotals.negocios_projetados}</strong> projetados
          </p>
        </div>
        {allGerentes.size > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-1">Status dos gerentes hoje</p>
            <div className="flex flex-wrap gap-2">
              {Array.from(allGerentes.entries()).map(([gid, gname]) => (
                todayIds.has(gid) ? (
                  <Badge key={gid} variant="outline" className="border-green-500/50 text-green-400 text-xs">✅ {gname}</Badge>
                ) : (
                  <Badge key={gid} variant="outline" className="border-amber-500/50 text-amber-400 text-xs">⚠️ {gname}</Badge>
                )
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── TODAY TAB ───
function TodayTab({ data, isAdmin }: { data: MetaDiaria[]; isAdmin: boolean }) {
  const today = format(TODAY(), "yyyy-MM-dd");
  const todayData = data.filter((r) => r.data === today);

  const totals = useMemo(() => {
    const t = { prospects: 0, interessados: 0, pastas_montagem: 0, pastas_completas: 0, negocios_projetados: 0 };
    todayData.forEach((r) => {
      FIELDS.forEach((f) => { t[f.key] += r[f.key] || 0; });
    });
    return t;
  }, [todayData]);

  const allGerentes = useMemo(() => {
    const map = new Map<string, string>();
    data.forEach((r) => { if (r.gerente_nome) map.set(r.gerente_id, r.gerente_nome); });
    return map;
  }, [data]);

  // Last record per gerente (for "Última atualização" column)
  const lastUpdatePerGerente = useMemo(() => {
    const map = new Map<string, string>();
    data.forEach((r) => {
      const prev = map.get(r.gerente_id);
      if (!prev || r.updated_at > prev) map.set(r.gerente_id, r.updated_at);
    });
    return map;
  }, [data]);

  const missing = useMemo(() => {
    if (isWeekend(TODAY())) return [];
    const todayIds = new Set(todayData.map((r) => r.gerente_id));
    return Array.from(allGerentes.entries()).filter(([id]) => !todayIds.has(id)).map(([, nome]) => nome);
  }, [allGerentes, todayData]);

  const pct = (a: number, b: number) => (b > 0 ? ((a / b) * 100).toFixed(1) : "0");

  const highlight = useMemo(() => {
    if (todayData.length === 0) return null;
    const max = Math.max(...todayData.map((r) => r.negocios_projetados));
    if (max === 0) return null;
    const winners = todayData.filter((r) => r.negocios_projetados === max);
    return { names: winners.map((w) => w.gerente_nome || "—"), negocios: max, pastas: winners.reduce((s, w) => s + w.pastas_completas, 0) };
  }, [todayData]);

  return (
    <div className="space-y-4">
      {/* Admin red alert */}
      {isAdmin && missing.length > 0 && (
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-300">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {missing.map((n) => `🚨 ${n} ainda não registrou o forecast de hoje`).join(" · ")}
        </div>
      )}
      {!isAdmin && missing.length > 0 && (
        <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-sm text-amber-300">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {missing.map((n) => `⚠️ ${n} ainda não registrou hoje`).join(" · ")}
        </div>
      )}

      {/* KPI Cards — 3 + 2 layout */}
      <div className="space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {FIELDS.slice(0, 3).map((f) => (
            <Card key={f.key} className="bg-card">
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground">{f.label}</p>
                <p className="text-2xl font-bold mt-1">{totals[f.key]}</p>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3 max-w-md sm:max-w-lg mx-auto sm:mx-0">
          {FIELDS.slice(3).map((f) => (
            <Card key={f.key} className="bg-card">
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground">{f.label}</p>
                <p className="text-2xl font-bold mt-1">{totals[f.key]}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Conversion rates */}
      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
        <span>Prospects → Interessados: <strong className="text-foreground">{pct(totals.interessados, totals.prospects)}%</strong></span>
        <span>Interessados → Pastas completas: <strong className="text-foreground">{pct(totals.pastas_completas, totals.interessados)}%</strong></span>
        <span>Pastas completas → Negócios projetados: <strong className="text-foreground">{pct(totals.negocios_projetados, totals.pastas_completas)}%</strong></span>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground text-xs">
                <th className="text-left p-3">Gerente</th>
                {FIELDS.map((f) => <th key={f.key} className="text-center p-3 whitespace-nowrap">{f.label.split(" ").slice(1).join(" ")}</th>)}
                {isAdmin && <th className="text-center p-3 whitespace-nowrap">Última atualização</th>}
                {!isAdmin && <th className="text-center p-3">Obs</th>}
              </tr>
            </thead>
            <tbody>
              {Array.from(allGerentes.entries()).map(([gid, gname]) => {
                const row = todayData.find((r) => r.gerente_id === gid);
                const lastUpd = lastUpdatePerGerente.get(gid);
                const updInfo = lastUpd ? relativeUpdate(lastUpd) : null;

                if (!row) return (
                  <tr key={gid} className="border-b bg-amber-500/5">
                    <td className="p-3 font-medium">{gname}</td>
                    <td colSpan={FIELDS.length} className="p-3 text-center text-muted-foreground italic text-xs">— sem registro hoje —</td>
                    {isAdmin && (
                      <td className={cn("p-3 text-center text-xs", updInfo?.isOld ? "text-red-400" : "text-muted-foreground")}>
                        {updInfo ? updInfo.label : "—"}
                      </td>
                    )}
                    {!isAdmin && <td className="p-3 text-center">—</td>}
                  </tr>
                );
                return (
                  <tr key={gid} className="border-b">
                    <td className="p-3">
                      <span className="font-medium">{gname}</span>
                      {/* Admin: show obs inline under name */}
                      {isAdmin && row.observacao && (
                        <p className="text-xs italic text-muted-foreground mt-0.5">💬 {row.observacao}</p>
                      )}
                    </td>
                    {FIELDS.map((f) => <td key={f.key} className="p-3 text-center">{row[f.key]}</td>)}
                    {isAdmin && (
                      <td className="p-3 text-center text-xs text-muted-foreground">
                        {relativeUpdate(row.updated_at).label}
                      </td>
                    )}
                    {!isAdmin && (
                      <td className="p-3 text-center">
                        {row.observacao ? (
                          <Tooltip>
                            <TooltipTrigger><MessageSquare className="h-4 w-4 text-amber-400 mx-auto" /></TooltipTrigger>
                            <TooltipContent className="max-w-xs">{row.observacao}</TooltipContent>
                          </Tooltip>
                        ) : "—"}
                      </td>
                    )}
                  </tr>
                );
              })}
              {allGerentes.size > 0 && (
                <tr className="font-bold border-t-2">
                  <td className="p-3">Total</td>
                  {FIELDS.map((f) => <td key={f.key} className="p-3 text-center">{totals[f.key]}</td>)}
                  <td />
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Highlight */}
      {isAdmin && highlight && (
        <Card className="bg-green-900/30 border-green-500/30">
          <CardContent className="p-4 text-center">
            <p className="text-lg font-bold text-green-300">
              🏆 Destaque do dia: {highlight.names.join(", ")}
            </p>
            <p className="text-sm text-green-400/80">
              {highlight.negocios} negócios projetados · {highlight.pastas} pastas completas
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── HISTORY TAB ───
function HistoryTab({ data }: { data: MetaDiaria[] }) {
  const [selDate, setSelDate] = useState<Date | undefined>(TODAY());
  const dateStr = selDate ? format(selDate, "yyyy-MM-dd") : "";
  const dayData = data.filter((r) => r.data === dateStr);

  const allGerentes = useMemo(() => {
    const map = new Map<string, string>();
    data.forEach((r) => { if (r.gerente_nome) map.set(r.gerente_id, r.gerente_nome); });
    return map;
  }, [data]);

  const gerenteDays = useMemo(() => {
    const map = new Map<string, Set<string>>();
    data.forEach((r) => {
      if (!map.has(r.gerente_id)) map.set(r.gerente_id, new Set());
      map.get(r.gerente_id)!.add(r.data);
    });
    return map;
  }, [data]);

  const marchDays = useMemo(() => {
    const days: string[] = [];
    for (let d = 1; d <= 31; d++) {
      days.push(format(new Date(2026, 2, d), "yyyy-MM-dd"));
    }
    return days;
  }, []);

  return (
    <div className="space-y-4">
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className={cn("w-[200px] justify-start text-left font-normal", !selDate && "text-muted-foreground")}>
            <CalendarIcon className="mr-2 h-4 w-4" />
            {selDate ? format(selDate, "dd/MM/yyyy") : "Selecionar data"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selDate}
            onSelect={setSelDate}
            disabled={(d) => d < CAMPANHA_INICIO || d > ENCERRA_DATE}
            className="p-3 pointer-events-auto"
          />
        </PopoverContent>
      </Popover>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground text-xs">
                <th className="text-left p-3">Gerente</th>
                {FIELDS.map((f) => <th key={f.key} className="text-center p-3 whitespace-nowrap">{f.label.split(" ").slice(1).join(" ")}</th>)}
                <th className="text-center p-3">Obs</th>
              </tr>
            </thead>
            <tbody>
              {Array.from(allGerentes.entries()).map(([gid, gname]) => {
                const row = dayData.find((r) => r.gerente_id === gid);
                if (!row) return (
                  <tr key={gid} className="border-b bg-amber-500/5">
                    <td className="p-3 font-medium">{gname}</td>
                    <td colSpan={FIELDS.length + 1} className="p-3 text-center text-muted-foreground italic text-xs">— sem registro —</td>
                  </tr>
                );
                return (
                  <tr key={gid} className="border-b">
                    <td className="p-3 font-medium">{gname}</td>
                    {FIELDS.map((f) => <td key={f.key} className="p-3 text-center">{row[f.key]}</td>)}
                    <td className="p-3 text-center">
                      {row.observacao ? (
                        <Tooltip>
                          <TooltipTrigger><MessageSquare className="h-4 w-4 text-amber-400 mx-auto" /></TooltipTrigger>
                          <TooltipContent className="max-w-xs">{row.observacao}</TooltipContent>
                        </Tooltip>
                      ) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Timeline */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Linha do Tempo — Março 2026</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="text-[10px]">
            <thead>
              <tr>
                <th className="text-left p-1 whitespace-nowrap">Gerente</th>
                {marchDays.map((d) => <th key={d} className="p-1 text-center">{parseInt(d.slice(8))}</th>)}
              </tr>
            </thead>
            <tbody>
              {Array.from(allGerentes.entries()).map(([gid, gname]) => {
                const days = gerenteDays.get(gid) || new Set();
                return (
                  <tr key={gid}>
                    <td className="p-1 whitespace-nowrap font-medium">{gname}</td>
                    {marchDays.map((d) => (
                      <td key={d} className="p-1 text-center">
                        <span className={cn("inline-block h-2.5 w-2.5 rounded-full", days.has(d) ? "bg-green-500" : "bg-muted")} />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── EVOLUTION TAB ───
function EvolutionTab({ data }: { data: MetaDiaria[] }) {
  const chartData = useMemo(() => {
    const byDay = new Map<string, Record<FieldKey, number>>();
    data.forEach((r) => {
      const existing = byDay.get(r.data) || { prospects: 0, interessados: 0, pastas_montagem: 0, pastas_completas: 0, negocios_projetados: 0 };
      FIELDS.forEach((f) => { existing[f.key] += r[f.key] || 0; });
      byDay.set(r.data, existing);
    });
    const days: any[] = [];
    for (let d = 1; d <= 31; d++) {
      const dateStr = format(new Date(2026, 2, d), "yyyy-MM-dd");
      const label = `${d}/03`;
      const vals = byDay.get(dateStr) || { prospects: 0, interessados: 0, pastas_montagem: 0, pastas_completas: 0, negocios_projetados: 0 };
      days.push({ date: label, ...vals });
    }
    return days;
  }, [data]);

  const totals = useMemo(() => {
    const t = { prospects: 0, interessados: 0, pastas_montagem: 0, pastas_completas: 0, negocios_projetados: 0 };
    data.forEach((r) => { FIELDS.forEach((f) => { t[f.key] += r[f.key] || 0; }); });
    return t;
  }, [data]);

  const COLORS: Record<FieldKey, string> = {
    prospects: "#60a5fa",
    interessados: "#fbbf24",
    pastas_montagem: "#a78bfa",
    pastas_completas: "#34d399",
    negocios_projetados: "#f87171",
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-4">
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
              <RTooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <ReferenceLine x="21/03" stroke="#f59e0b" strokeDasharray="5 5" label={{ value: "Evento", fill: "#f59e0b", fontSize: 11 }} />
              <ReferenceLine x="31/03" stroke="#ef4444" strokeDasharray="5 5" label={{ value: "Encerra", fill: "#ef4444", fontSize: 11 }} />
              {FIELDS.map((f) => (
                <Line key={f.key} type="monotone" dataKey={f.key} stroke={COLORS[f.key]} strokeWidth={2} dot={false} name={f.label.split(" ").slice(1).join(" ")} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <p className="text-sm font-semibold mb-2">Total acumulado da campanha (até hoje):</p>
          <div className="flex flex-wrap gap-4 text-sm">
            {FIELDS.map((f) => (
              <span key={f.key}>{f.label.split(" ").slice(1).join(" ")}: <strong>{totals[f.key]}</strong></span>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── MAIN PAGE ───
export default function MelnickMetas() {
  const { user } = useAuth();
  const { isGestor, isAdmin } = useUserRole();
  const { data: allData = [], isLoading } = useMelnickData();
  const encerrada = new Date() > ENCERRA_DATE;

  const daysToEvento = differenceInDays(EVENTO_DATE, TODAY());
  const daysToEncerra = differenceInDays(ENCERRA_DATE, TODAY());

  const [nome, setNome] = useState("");
  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("nome").eq("user_id", user.id).single().then(({ data }) => {
      if (data?.nome) setNome(data.nome);
    });
  }, [user]);

  // Show form only for gestors who are NOT pure admins
  const showForm = isGestor && !encerrada && user;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <div className="flex flex-wrap gap-2 mb-2">
          {daysToEvento > 0 ? (
            <Badge className="bg-amber-600 text-white">🗓 21 DE MARÇO — DIA DO EVENTO · em {daysToEvento} dias</Badge>
          ) : daysToEvento === 0 ? (
            <Badge className="bg-amber-600 text-white animate-pulse">🗓 HOJE É O DIA DO EVENTO!</Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground">🗓 Evento realizado em 21/03</Badge>
          )}
          {daysToEncerra > 0 ? (
            <Badge className="bg-red-600 text-white">⚡ Encerra 31/03 · {daysToEncerra} dias</Badge>
          ) : (
            <Badge variant="outline" className="text-red-400 border-red-500/50">Campanha encerrada em 31/03/2026</Badge>
          )}
        </div>
        <h1 className="text-2xl font-bold">📊 Forecast Melnick Day — Acompanhamento Diário</h1>
        <p className="text-sm text-muted-foreground">Forecast atualizado diariamente pelos gerentes até 31/03/2026</p>
      </div>

      {encerrada && (
        <div className="bg-muted/50 border rounded-lg p-4 text-center text-muted-foreground">
          Campanha encerrada em 31/03/2026 — dados históricos abaixo.
        </div>
      )}

      {/* CEO executive summary (admin only, no form) */}
      {isAdmin && !isLoading && <CeoSummaryCard data={allData} />}

      {/* Gestor form (hidden for pure admin) */}
      {showForm && !isAdmin && <FormSection userId={user!.id} nome={nome} />}

      {/* Consolidated Panel */}
      <Tabs defaultValue="hoje" className="w-full">
        <TabsList>
          <TabsTrigger value="hoje">Hoje</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
          <TabsTrigger value="evolucao">Evolução</TabsTrigger>
        </TabsList>
        <TabsContent value="hoje">
          {isLoading ? <p className="text-muted-foreground p-4">Carregando...</p> : <TodayTab data={allData} isAdmin={isAdmin} />}
        </TabsContent>
        <TabsContent value="historico">
          {isLoading ? <p className="text-muted-foreground p-4">Carregando...</p> : <HistoryTab data={allData} />}
        </TabsContent>
        <TabsContent value="evolucao">
          {isLoading ? <p className="text-muted-foreground p-4">Carregando...</p> : <EvolutionTab data={allData} />}
        </TabsContent>
      </Tabs>
    </div>
  );
}
