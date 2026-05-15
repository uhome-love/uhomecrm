import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, RefreshCw, AlertTriangle, Download, Zap } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

interface Row {
  id: string;
  created_at: string;
  user_id: string | null;
  profile_role: string | null;
  url: string;
  method: string | null;
  error_name: string | null;
  error_message: string | null;
  duration_ms: number | null;
  online: boolean | null;
  connection_type: string | null;
  user_agent: string | null;
  origin_host: string | null;
  retry_count: number | null;
  cf_ray: string | null;
  session_id: string | null;
}

interface Summary {
  total_falhas: number;
  por_method: Record<string, number>;
  por_error_name: Record<string, number>;
  por_origin_host: Record<string, number>;
  por_connection_type: Record<string, number>;
  top_urls: { url: string; count: number }[];
  janela_horas: number;
  desde: string;
}

const HOURS_OPTIONS = [
  { v: 1, label: "Última hora" },
  { v: 24, label: "Últimas 24h" },
  { v: 168, label: "Últimos 7 dias" },
];

export default function TelemetriaRede() {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const [horas, setHoras] = useState(24);
  const [filterHost, setFilterHost] = useState<string>("all");
  const [filterMethod, setFilterMethod] = useState<string>("all");
  const [filterError, setFilterError] = useState<string>("all");
  const [rows, setRows] = useState<Row[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [forcing, setForcing] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const since = new Date(Date.now() - horas * 3600_000).toISOString();
      const [{ data: rowData }, { data: sumData }] = await Promise.all([
        supabase
          .from("network_telemetry" as any)
          .select("*")
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(500),
        supabase.rpc("get_network_telemetry_summary" as any, { p_horas: horas }),
      ]);
      setRows((rowData as Row[] | null) || []);
      setSummary((sumData as Summary | null) || null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [horas]);

  const filtered = useMemo(() => rows.filter((r) =>
    (filterHost === "all" || r.origin_host === filterHost) &&
    (filterMethod === "all" || r.method === filterMethod) &&
    (filterError === "all" || r.error_name === filterError)
  ), [rows, filterHost, filterMethod, filterError]);

  const uniq = (arr: (string | null | undefined)[]) =>
    Array.from(new Set(arr.filter(Boolean) as string[])).sort();

  const hosts = uniq(rows.map((r) => r.origin_host));
  const methods = uniq(rows.map((r) => r.method));
  const errors = uniq(rows.map((r) => r.error_name));

  const exportCsv = () => {
    const headers = ["created_at","origin_host","method","url","error_name","error_message","duration_ms","retry_count","cf_ray","connection_type","online","user_id","profile_role","session_id"];
    const csv = [headers.join(",")].concat(filtered.map((r) =>
      headers.map((h) => {
        const v = (r as any)[h];
        if (v === null || v === undefined) return "";
        const s = String(v).replace(/"/g, '""');
        return /[",\n]/.test(s) ? `"${s}"` : s;
      }).join(",")
    )).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `network_telemetry_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const forcarFalha = async () => {
    setForcing(true);
    try {
      await fetch("https://api.uhomesales.com/__rota_inexistente_teste_telemetria")
        .catch(() => undefined);
    } finally {
      setTimeout(async () => {
        await load();
        setForcing(false);
      }, 2000);
    }
  };

  if (authLoading || roleLoading) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  if (!user) return <Navigate to="/auth" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <AlertTriangle className="h-6 w-6 text-amber-500" />
          Telemetria de Rede
        </h1>
        <div className="flex items-center gap-2">
          <Select value={String(horas)} onValueChange={(v) => setHoras(Number(v))}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {HOURS_OPTIONS.map((o) => (
                <SelectItem key={o.v} value={String(o.v)}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={load} size="sm" variant="outline" disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />Atualizar
          </Button>
          <Button onClick={forcarFalha} size="sm" variant="outline" disabled={forcing}>
            <Zap className={`h-4 w-4 mr-2 ${forcing ? "animate-pulse" : ""}`} />Forçar falha de teste
          </Button>
          <Button onClick={exportCsv} size="sm" variant="outline" disabled={!filtered.length}>
            <Download className="h-4 w-4 mr-2" />CSV
          </Button>
        </div>
      </div>

      {/* Cards de agregação */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Total de falhas</div>
          <div className="text-3xl font-bold mt-1">{summary?.total_falhas ?? 0}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Por método</div>
          <div className="text-xs font-mono mt-1 space-y-0.5">
            {summary && Object.entries(summary.por_method).map(([k, v]) => (
              <div key={k} className="flex justify-between"><span>{k}</span><span className="font-bold">{v}</span></div>
            ))}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Por erro</div>
          <div className="text-xs font-mono mt-1 space-y-0.5">
            {summary && Object.entries(summary.por_error_name).map(([k, v]) => (
              <div key={k} className="flex justify-between truncate"><span className="truncate mr-2">{k}</span><span className="font-bold">{v}</span></div>
            ))}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Por host de origem</div>
          <div className="text-xs font-mono mt-1 space-y-0.5">
            {summary && Object.entries(summary.por_origin_host).map(([k, v]) => (
              <div key={k} className="flex justify-between truncate"><span className="truncate mr-2">{k}</span><span className="font-bold">{v}</span></div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground mb-2">Top 5 URLs com falha</div>
          {summary?.top_urls?.length ? (
            <ol className="text-xs font-mono space-y-1">
              {summary.top_urls.map((t, i) => (
                <li key={i} className="flex justify-between gap-2 border-b border-border/40 py-1">
                  <span className="truncate">{t.url}</span>
                  <span className="font-bold">{t.count}</span>
                </li>
              ))}
            </ol>
          ) : <div className="text-xs text-muted-foreground">Sem dados.</div>}
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground mb-2">Por tipo de conexão</div>
          {summary?.por_connection_type ? (
            <div className="text-xs font-mono space-y-1">
              {Object.entries(summary.por_connection_type).map(([k, v]) => (
                <div key={k} className="flex justify-between border-b border-border/40 py-1">
                  <span>{k}</span><span className="font-bold">{v}</span>
                </div>
              ))}
            </div>
          ) : <div className="text-xs text-muted-foreground">Sem dados.</div>}
        </Card>
      </div>

      {/* Filtros + Tabela */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-2 mb-3">
          <Select value={filterHost} onValueChange={setFilterHost}>
            <SelectTrigger className="w-[260px]"><SelectValue placeholder="Host" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os hosts</SelectItem>
              {hosts.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterMethod} onValueChange={setFilterMethod}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Method" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {methods.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterError} onValueChange={setFilterError}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="Erro" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os erros</SelectItem>
              {errors.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground self-center ml-auto">
            {filtered.length} registros
          </span>
        </div>

        <div className="overflow-auto max-h-[600px] border border-border/40 rounded-md">
          <table className="w-full text-xs font-mono">
            <thead className="bg-muted sticky top-0">
              <tr className="text-left">
                <th className="p-2">Hora</th>
                <th className="p-2">Host</th>
                <th className="p-2">Method</th>
                <th className="p-2">URL</th>
                <th className="p-2">Erro</th>
                <th className="p-2">ms</th>
                <th className="p-2">retry</th>
                <th className="p-2">cf-ray</th>
                <th className="p-2">conn</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-b border-border/30 hover:bg-muted/40">
                  <td className="p-2 whitespace-nowrap">{new Date(r.created_at).toLocaleTimeString()}</td>
                  <td className="p-2 truncate max-w-[180px]">{r.origin_host}</td>
                  <td className="p-2">{r.method}</td>
                  <td className="p-2 truncate max-w-[280px]" title={r.url}>{r.url}</td>
                  <td className="p-2 truncate max-w-[180px]" title={r.error_message || ""}>{r.error_name}</td>
                  <td className="p-2">{r.duration_ms ?? "—"}</td>
                  <td className="p-2">{r.retry_count ?? 0}</td>
                  <td className="p-2 truncate max-w-[120px]">{r.cf_ray ?? "—"}</td>
                  <td className="p-2">{r.connection_type ?? "—"}</td>
                </tr>
              ))}
              {!filtered.length && (
                <tr><td colSpan={9} className="p-6 text-center text-muted-foreground">Nenhuma falha registrada nesta janela.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
