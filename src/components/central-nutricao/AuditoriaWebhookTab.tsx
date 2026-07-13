import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Loader2, CheckCircle2, XCircle, MessageSquare, ExternalLink, MousePointerClick, Radio, ChevronDown, AlertCircle } from "lucide-react";
import { formatBRT } from "@/lib/brtTime";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";


interface Row {
  id: string;
  lead_id: string | null;
  phone: string | null;
  status: string | null;
  button_response: string | null;
  response_text: string | null;
  sent_at: string | null;
  responded_at: string | null;
  template_name: string | null;
  audience_source: string | null;
  lead?: { nome: string | null; reativado_por_nutricao: boolean | null; corretor_id: string | null; empreendimento: string | null } | null;
  corretor_nome?: string | null;
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  sent: { label: "Enviado", className: "bg-neutral-100 text-neutral-600" },
  delivered: { label: "Entregue", className: "bg-blue-50 text-blue-700" },
  read: { label: "Lido", className: "bg-indigo-50 text-indigo-700" },
  responded: { label: "Respondido", className: "bg-emerald-50 text-emerald-700" },
  failed: { label: "Falhou", className: "bg-red-50 text-red-700" },
};

const AUDIENCE_LABEL: Record<string, { label: string; className: string }> = {
  descartados: { label: "Descartados", className: "bg-amber-50 text-amber-700 border-amber-200" },
  pipeline_ativo: { label: "Pipeline ativo", className: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  oferta_ativa_lista: { label: "Oferta ativa", className: "bg-purple-50 text-purple-700 border-purple-200" },
  visita_amanha: { label: "Visita amanhã", className: "bg-teal-50 text-teal-700 border-teal-200" },
  legacy: { label: "Legacy", className: "bg-neutral-100 text-neutral-600 border-neutral-200" },
};

const PAGE_SIZE = 100;

function parseResponse(raw: string | null): { text: string; type: string | null } {
  if (!raw) return { text: "—", type: null };
  try {
    const j = JSON.parse(raw);
    const text = j?.button?.text || j?.button?.payload || j?.text?.body || j?.body || raw;
    return { text: String(text).slice(0, 200), type: j?.type || null };
  } catch {
    return { text: raw.slice(0, 200), type: null };
  }
}

function KpiCell({ label, value, color, highlight }: { label: string; value: number; color: string; highlight?: boolean }) {
  return (
    <div className={`text-center rounded-md px-2 py-1.5 ${highlight ? "bg-emerald-100/60 dark:bg-emerald-900/20" : ""}`}>
      <div className="text-[10px] text-muted-foreground leading-tight">{label}</div>
      <div className={`text-lg font-bold leading-tight ${color}`}>{value}</div>
    </div>
  );
}

export default function AuditoriaWebhookTab({ from, to }: { from?: string; to?: string } = {}) {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<string>("all");
  const [audienceFilter, setAudienceFilter] = useState<string>("all");
  const [templateFilter, setTemplateFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [liveActive, setLiveActive] = useState(false);

  // Realtime subscription → invalidate query on change (throttled to avoid storm during active dispatch)
  const pendingInvalidateRef = useRef(false);
  const throttleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const flush = () => {
      throttleTimerRef.current = null;
      if (pendingInvalidateRef.current) {
        pendingInvalidateRef.current = false;
        qc.invalidateQueries({ queryKey: ["auditoria-meta-webhook"] });
      }
    };
    const channel = supabase
      .channel("audit-meta-disparos")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reengajamento_meta_disparos" },
        () => {
          // Coalesce bursts of events: invalidate at most once every 4s
          pendingInvalidateRef.current = true;
          if (!throttleTimerRef.current) {
            throttleTimerRef.current = setTimeout(flush, 4000);
          }
        }
      )
      .subscribe((status) => {
        setLiveActive(status === "SUBSCRIBED");
      });
    return () => {
      if (throttleTimerRef.current) clearTimeout(throttleTimerRef.current);
      supabase.removeChannel(channel);
    };
  }, [qc]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["auditoria-meta-webhook", page, from ?? null, to ?? null],
    queryFn: async () => {
      const rangeFrom = 0;
      const rangeTo = (page + 1) * PAGE_SIZE - 1;
      let q = supabase
        .from("reengajamento_meta_disparos")
        .select(
          "id, lead_id, phone, status, button_response, response_text, sent_at, responded_at, template_name, audience_source",
          { count: "estimated" }
        )
        .order("sent_at", { ascending: false });
      if (from) q = q.gte("sent_at", from);
      if (to) q = q.lte("sent_at", to);
      const { data: disparos, count, error } = await q.range(rangeFrom, rangeTo);
      if (error) throw error;
      const leadIds = Array.from(new Set((disparos ?? []).map((d) => d.lead_id).filter(Boolean))) as string[];
      let leadsMap: Record<string, { nome: string | null; reativado_por_nutricao: boolean | null; corretor_id: string | null; empreendimento: string | null }> = {};
      if (leadIds.length) {
        const { data: leads } = await supabase
          .from("pipeline_leads")
          .select("id, nome, reativado_por_nutricao, corretor_id, empreendimento")
          .in("id", leadIds);
        leadsMap = Object.fromEntries((leads ?? []).map((l) => [l.id, l]));
      }
      const corretorIds = Array.from(
        new Set(Object.values(leadsMap).map((l) => l.corretor_id).filter(Boolean))
      ) as string[];
      let corretoresMap: Record<string, string> = {};
      if (corretorIds.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, nome")
          .in("user_id", corretorIds);
        corretoresMap = Object.fromEntries((profs ?? []).map((p) => [p.user_id, p.nome ?? ""]));
      }
      const rows = (disparos ?? []).map((d) => {
        const lead = d.lead_id ? leadsMap[d.lead_id] || null : null;
        return {
          ...d,
          lead,
          corretor_nome: lead?.corretor_id ? corretoresMap[lead.corretor_id] || null : null,
        } as Row;
      });
      return { rows, total: count ?? rows.length };
    },
    refetchInterval: 10000,
    placeholderData: keepPreviousData,
  });

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;

  const templateOptions = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => r.template_name && set.add(r.template_name));
    return Array.from(set).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    let out = rows;
    if (filter === "sim") out = out.filter((r) => r.button_response === "sim");
    else if (filter === "nao") out = out.filter((r) => r.button_response === "nao");
    else if (filter === "responded") out = out.filter((r) => r.status === "responded");
    else if (filter === "no_response") out = out.filter((r) => !r.button_response && r.status !== "failed");
    else if (filter === "failed") out = out.filter((r) => r.status === "failed");
    else if (filter === "waiting")
      out = out.filter((r) => r.status === "sent" || r.status === null);

    if (audienceFilter !== "all") {
      out = out.filter((r) => (r.audience_source || "legacy") === audienceFilter);
    }
    if (templateFilter !== "all") {
      out = out.filter((r) => r.template_name === templateFilter);
    }
    if (search.trim()) {
      const s = search.toLowerCase();
      out = out.filter(
        (r) =>
          r.phone?.toLowerCase().includes(s) ||
          r.lead?.nome?.toLowerCase().includes(s) ||
          r.template_name?.toLowerCase().includes(s)
      );
    }
    return out;
  }, [rows, filter, audienceFilter, templateFilter, search]);

  const stats = useMemo(() => {
    const uniqueLeadIds = (predicate: (r: Row) => boolean) =>
      new Set(rows.filter(predicate).map((r) => r.lead_id).filter(Boolean)).size;
    return {
      total,
      loaded: rows.length,
      sim: uniqueLeadIds((r) => r.button_response === "sim"),
      nao: uniqueLeadIds((r) => r.button_response === "nao"),
      reativados: uniqueLeadIds((r) => !!r.lead?.reativado_por_nutricao),
      responded: rows.filter((r) => r.status === "responded").length,
      failed: rows.filter((r) => r.status === "failed").length,
      waiting: rows.filter((r) => r.status === "sent" || r.status === null).length,
    };
  }, [rows, total]);

  // Recent dispatch runs (so the user can see if a dispatch ran at all, even with 0 sent)
  const { data: recentRuns } = useQuery({
    queryKey: ["recent-dispatch-runs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reengajamento_dispatch_runs")
        .select("id, started_at, finished_at, status, total_alvo, enviados, falhas, ignorados, motivo_parada, audience_source, audience_payload, erros")
        .order("started_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 10000,
  });
  const [showRuns, setShowRuns] = useState(false);
  

  // Resumo de HOJE (server-side, agregado) — independente da paginação
  const { data: todayStats } = useQuery({
    queryKey: ["auditoria-meta-today"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("reengajamento_resumo_hoje");
      if (error) {
        // Fallback: agrega no cliente (last 2000 do dia)
        const sinceBRT = new Date();
        sinceBRT.setUTCHours(3, 0, 0, 0); // 00:00 BRT
        const { data: raws } = await supabase
          .from("reengajamento_meta_disparos")
          .select("lead_id, status, button_response, response_text, sent_at")
          .gte("sent_at", sinceBRT.toISOString())
          .limit(2000);
        const list = raws ?? [];
        const simIds = new Set<string>();
        const naoIds = new Set<string>();
        let failed = 0, sent = 0, delivered = 0, read = 0, responded = 0;
        list.forEach((r) => {
          if (r.status === "failed") failed++;
          else if (r.status === "sent") sent++;
          else if (r.status === "delivered") delivered++;
          else if (r.status === "read") read++;
          else if (r.status === "responded") responded++;
          const isSim = r.button_response === "sim" || (r.response_text || "").toLowerCase().startsWith("sim");
          const isNao = r.button_response === "nao" || /n[aã]o quero/i.test(r.response_text || "");
          if (r.lead_id && isSim) simIds.add(r.lead_id);
          if (r.lead_id && isNao) naoIds.add(r.lead_id);
        });
        return { total: list.length, sent, delivered, read, responded, failed, sim: simIds.size, nao: naoIds.size };
      }
      return data as unknown as { total: number; sent: number; delivered: number; read: number; responded: number; failed: number; sim: number; nao: number };
    },
    refetchInterval: 15000,
  });

  // Detector: bloqueio de qualidade Meta nos últimos 30 min
  const { data: qualityAlert } = useQuery({
    queryKey: ["auditoria-quality-alert"],
    queryFn: async () => {
      const since = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from("reengajamento_meta_disparos")
        .select("status, error_text, template_name")
        .gte("sent_at", since)
        .limit(2000);
      const list = data ?? [];
      if (list.length < 20) return null;
      const total = list.length;
      const failed131049 = list.filter(
        (r) => r.status === "failed" && /healthy ecosystem/i.test(r.error_text || "")
      ).length;
      const rate = failed131049 / total;
      if (rate < 0.3) return null;
      const tplCounts: Record<string, number> = {};
      list.forEach((r) => {
        if (r.status === "failed" && /healthy ecosystem/i.test(r.error_text || "")) {
          const t = r.template_name || "—";
          tplCounts[t] = (tplCounts[t] || 0) + 1;
        }
      });
      const topTpl = Object.entries(tplCounts).sort((a, b) => b[1] - a[1])[0];
      return { rate, failed131049, total, topTemplate: topTpl?.[0], topCount: topTpl?.[1] || 0 };
    },
    refetchInterval: 30000,
  });




  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const canLoadMore = rows.length < total;

  return (
    <div className="space-y-4">
      {/* Header bar: live indicator + counters */}
      <div className="flex items-center justify-between flex-wrap gap-3 px-1">
        <div className="flex items-center gap-2 text-xs">
          <Radio className={`h-3.5 w-3.5 ${liveActive ? "text-emerald-500 animate-pulse" : "text-muted-foreground"}`} />
          <span className={liveActive ? "text-emerald-700 font-medium" : "text-muted-foreground"}>
            {liveActive ? "Ao vivo" : "Conectando…"}
          </span>
          {isFetching && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground">
            <b className="text-foreground">{rows.length}</b> de <b className="text-foreground">{total}</b> carregados
          </span>
        </div>
      </div>

      {/* Alerta crítico de qualidade Meta */}
      {qualityAlert && (
        <Card className="border-red-300 bg-red-50/60">
          <CardContent className="p-3 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
            <div className="flex-1 text-xs">
              <div className="font-semibold text-red-800 text-sm">
                ⚠️ Bloqueio de qualidade Meta ({Math.round(qualityAlert.rate * 100)}% de falha nos últimos 30 min)
              </div>
              <div className="text-red-700 mt-1">
                {qualityAlert.failed131049} de {qualityAlert.total} mensagens bloqueadas pela Meta (erro 131049).
                {qualityAlert.topTemplate && (
                  <> Template mais afetado: <b>{qualityAlert.topTemplate}</b> ({qualityAlert.topCount} falhas).</>
                )}
              </div>
              <div className="text-red-700 mt-1.5">
                <b>Ação:</b> pausar o template e verificar quality rating no WhatsApp Manager.
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPI HERO — única fonte de números (substitui Stats duplicado) */}
      <Card className="border-indigo-200 bg-gradient-to-br from-indigo-50/60 to-white dark:from-indigo-950/20 dark:to-transparent">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-semibold text-indigo-900 dark:text-indigo-200 flex items-center gap-2">
              📅 Resumo de hoje
              <Badge variant="outline" className="text-[10px] font-normal">BRT</Badge>
            </div>
            <Badge variant="outline" className="text-[10px]">{todayStats?.total ?? 0} disparos hoje</Badge>
          </div>
          <div className="grid grid-cols-3 md:grid-cols-7 gap-3">
            <KpiCell label="Enviados" value={todayStats?.sent ?? stats.waiting} color="text-neutral-700" />
            <KpiCell label="Entregues" value={todayStats?.delivered ?? 0} color="text-blue-700" />
            <KpiCell label="Lidos" value={todayStats?.read ?? 0} color="text-indigo-700" />
            <KpiCell label="Responderam" value={todayStats?.responded ?? stats.responded} color="text-emerald-700" />
            <KpiCell label="✅ SIM" value={todayStats?.sim ?? stats.sim} color="text-emerald-700" highlight />
            <KpiCell label="❌ NÃO" value={todayStats?.nao ?? stats.nao} color="text-red-700" />
            <KpiCell label="Falhas" value={todayStats?.failed ?? stats.failed} color="text-red-600" />
          </div>
        </CardContent>
      </Card>

      {/* Painéis colapsáveis (default fechados, abre conforme necessidade) */}
      <div className="grid grid-cols-1 gap-3">


        {/* Disparos recentes (colapsável) */}
        {recentRuns && recentRuns.length > 0 && (
          <Collapsible open={showRuns} onOpenChange={setShowRuns}>
            <Card>
              <CollapsibleTrigger className="w-full">
                <CardContent className="p-3 flex items-center justify-between hover:bg-muted/40 transition">
                  <div className="flex items-center gap-2">
                    <Radio className="h-4 w-4 text-indigo-500" />
                    <span className="text-sm font-semibold">Disparos recentes</span>
                    <Badge variant="outline" className="text-[10px]">{recentRuns.length}</Badge>
                  </div>
                  <ChevronDown className={`h-4 w-4 transition ${showRuns ? "rotate-180" : ""}`} />
                </CardContent>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0 pb-3 px-3">
                  <div className="overflow-x-auto">
                    <Table className="min-w-[900px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[110px]">Início</TableHead>
                          <TableHead className="w-[100px]">Status</TableHead>
                          <TableHead className="w-[220px]">Template / Origem</TableHead>
                          <TableHead className="w-[70px] text-right">Alvo</TableHead>
                          <TableHead className="w-[80px] text-right text-emerald-700">Enviados</TableHead>
                          <TableHead className="w-[70px] text-right text-red-700">Falhas</TableHead>
                          <TableHead className="w-[80px] text-right">Ignorados</TableHead>
                          <TableHead>Motivo / Primeiro erro</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {recentRuns.map((run: any) => {
                          const payload = (run.audience_payload || {}) as Record<string, unknown>;
                          const tpl = (payload.template_name as string) || "—";
                          const firstError = (() => {
                            const e = run.erros;
                            if (!e) return null;
                            if (Array.isArray(e) && e.length > 0) return String(e[0]).slice(0, 200);
                            if (typeof e === "string") return e.slice(0, 200);
                            try { return JSON.stringify(e).slice(0, 200); } catch { return null; }
                          })();
                          const statusColors: Record<string, string> = {
                            running: "bg-blue-50 text-blue-700",
                            completed: "bg-emerald-50 text-emerald-700",
                            paused: "bg-amber-50 text-amber-700",
                            cancelled: "bg-rose-50 text-rose-700",
                            timeout: "bg-orange-50 text-orange-700",
                            failed: "bg-red-50 text-red-700",
                          };
                          const hasIssue = run.status !== "running" && (run.enviados ?? 0) === 0 && (run.falhas ?? 0) > 0;
                          return (
                            <TableRow key={run.id} className={hasIssue ? "bg-red-50/30" : ""}>
                              <TableCell className="text-xs whitespace-nowrap">{formatBRT(run.started_at, "dd/MM HH:mm")}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className={`text-[10px] ${statusColors[run.status] || "bg-neutral-100"}`}>
                                  {run.status || "—"}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs">
                                <div className="font-medium truncate max-w-[220px]" title={tpl}>{tpl}</div>
                                <div className="text-[10px] text-muted-foreground truncate max-w-[220px]">{run.audience_source || "—"}</div>
                              </TableCell>
                              <TableCell className="text-xs text-right">{run.total_alvo ?? 0}</TableCell>
                              <TableCell className="text-xs text-right font-semibold text-emerald-700">{run.enviados ?? 0}</TableCell>
                              <TableCell className="text-xs text-right font-semibold text-red-700">{run.falhas ?? 0}</TableCell>
                              <TableCell className="text-xs text-right text-muted-foreground">{run.ignorados ?? 0}</TableCell>
                              <TableCell className="text-xs">
                                {(run.motivo_parada || firstError) ? (
                                  <div className="flex items-start gap-1.5" title={run.motivo_parada || firstError || ""}>
                                    <AlertCircle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                                    <span className="line-clamp-2">{run.motivo_parada || firstError}</span>
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        )}
      </div>

      {/* Filtros agrupados em barra única */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-col lg:flex-row gap-2 flex-wrap items-stretch">
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-full lg:w-[170px] h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos status</SelectItem>
                <SelectItem value="waiting">Aguardando entrega</SelectItem>
                <SelectItem value="responded">Responderam</SelectItem>
                <SelectItem value="sim">Classificado SIM</SelectItem>
                <SelectItem value="nao">Classificado NÃO</SelectItem>
                <SelectItem value="no_response">Sem resposta</SelectItem>
                <SelectItem value="failed">Falhas</SelectItem>
              </SelectContent>
            </Select>
            <Select value={audienceFilter} onValueChange={setAudienceFilter}>
              <SelectTrigger className="w-full lg:w-[170px] h-9 text-xs"><SelectValue placeholder="Origem" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas origens</SelectItem>
                <SelectItem value="descartados">Descartados</SelectItem>
                <SelectItem value="pipeline_ativo">Pipeline ativo</SelectItem>
                <SelectItem value="oferta_ativa_lista">Oferta ativa</SelectItem>
                <SelectItem value="visita_amanha">Visita amanhã</SelectItem>
                <SelectItem value="legacy">Legacy</SelectItem>
              </SelectContent>
            </Select>
            <Select value={templateFilter} onValueChange={setTemplateFilter}>
              <SelectTrigger className="w-full lg:w-[200px] h-9 text-xs"><SelectValue placeholder="Template" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos templates</SelectItem>
                {templateOptions.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="Buscar por telefone, nome ou template…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full lg:flex-1 h-9 text-xs"
            />
          </div>
        </CardContent>
      </Card>


      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <MessageSquare className="h-10 w-10 mb-3 opacity-40" />
          <p className="text-sm">Nenhuma entrada encontrada</p>
        </div>
      ) : (
        <TooltipProvider>
          <div className="rounded-lg border bg-card overflow-x-auto">
            <Table className="min-w-[1400px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[90px]">Enviado</TableHead>
                  <TableHead className="w-[160px]">Lead</TableHead>
                  <TableHead className="w-[200px]">Disparo</TableHead>
                  <TableHead className="w-[130px]">Empreendimento</TableHead>
                  <TableHead className="w-[130px]">Corretor</TableHead>
                  <TableHead className="w-[120px]">Telefone</TableHead>
                  <TableHead className="w-[100px]">Status</TableHead>
                  <TableHead>Resposta do cliente</TableHead>
                  <TableHead className="w-[110px]">Classificação</TableHead>
                  <TableHead className="w-[110px]">Reativado?</TableHead>
                  <TableHead className="w-[60px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => {
                  const parsed = parseResponse(r.response_text);
                  const cls = r.button_response;
                  const statusInfo = STATUS_BADGE[r.status || ""];
                  const aud = AUDIENCE_LABEL[r.audience_source || "legacy"] || AUDIENCE_LABEL.legacy;
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap text-xs px-3 py-2">{r.sent_at ? formatBRT(r.sent_at, "dd/MM HH:mm") : "—"}</TableCell>
                      <TableCell className="text-sm font-medium px-3 py-2 truncate max-w-[160px]">{r.lead?.nome || "—"}</TableCell>
                      <TableCell className="px-3 py-2">
                        <div className="flex flex-col gap-1">
                          <Badge variant="outline" className={`text-[10px] w-fit ${aud.className}`}>{aud.label}</Badge>
                          <span className="text-[11px] text-muted-foreground truncate max-w-[200px]" title={r.template_name || ""}>
                            {r.template_name || "—"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs px-3 py-2 truncate max-w-[130px]">{r.lead?.empreendimento || <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell className="text-xs px-3 py-2 truncate max-w-[130px]">{r.corretor_nome || <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap px-3 py-2">{r.phone || "—"}</TableCell>
                      <TableCell className="px-3 py-2">
                        <Badge variant="outline" className={`text-[10px] whitespace-nowrap ${statusInfo?.className || "bg-neutral-100"}`}>
                          {statusInfo?.label || r.status || "—"}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-3 py-2">
                        {cls ? (
                          <div className="flex items-center gap-1.5">
                            <MousePointerClick className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                            <span className="text-xs">
                              Botão <b className={cls === "sim" ? "text-emerald-700" : "text-red-700"}>{cls.toUpperCase()}</b>
                              {parsed.text && parsed.text !== "—" && (
                                <span className="text-muted-foreground"> · "{parsed.text}"</span>
                              )}
                            </span>
                          </div>
                        ) : r.response_text ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center gap-1.5 cursor-default">
                                <MessageSquare className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                                <span className="text-sm line-clamp-2">{parsed.text}</span>
                              </div>
                            </TooltipTrigger>
                            {parsed.text.length > 50 && <TooltipContent className="max-w-md"><p className="text-xs">{parsed.text}</p></TooltipContent>}
                          </Tooltip>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="px-3 py-2">
                        {cls === "sim" ? (
                          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 whitespace-nowrap"><CheckCircle2 className="h-3 w-3 mr-1" />SIM</Badge>
                        ) : cls === "nao" ? (
                          <Badge className="bg-red-100 text-red-700 border-red-200 whitespace-nowrap"><XCircle className="h-3 w-3 mr-1" />NÃO</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="px-3 py-2">
                        {r.lead?.reativado_por_nutricao ? (
                          <Badge variant="purple" className="text-[10px] whitespace-nowrap">🔄 Reativado</Badge>
                        ) : cls === "sim" ? (
                          <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 whitespace-nowrap">Pendente</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="px-3 py-2">
                        {r.lead_id && (
                          <Link to={`/pipeline-leads?lead=${r.lead_id}`} className="text-xs text-primary inline-flex items-center gap-1 hover:underline whitespace-nowrap">
                            <ExternalLink className="h-3 w-3" /> Abrir
                          </Link>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </TooltipProvider>
      )}

      {canLoadMore && (
        <div className="flex justify-center pt-2">
          <Button variant="outline" onClick={() => setPage((p) => p + 1)} disabled={isFetching}>
            {isFetching ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Carregar mais ({total - rows.length} restantes)
          </Button>
        </div>
      )}
    </div>
  );
}
