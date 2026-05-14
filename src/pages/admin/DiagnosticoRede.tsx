import { useEffect, useState, useCallback } from "react";
import { useApiHealth } from "@/lib/apiHealth";
import {
  PRIMARY,
  BACKUP,
  getActiveTarget,
  setActiveTarget,
} from "@/lib/proxyEndpoints";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CheckCircle2, XCircle, RefreshCw, Wifi, WifiOff } from "lucide-react";

type ProbeResult = { ok: boolean; ms: number; status?: number; error?: string };

async function probe(url: string): Promise<ProbeResult> {
  const t0 = performance.now();
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    const res = await fetch(url + "/auth/v1/health", {
      method: "GET",
      cache: "no-store",
      credentials: "omit",
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    return { ok: res.ok || res.status < 500, ms: Math.round(performance.now() - t0), status: res.status };
  } catch (err: any) {
    return { ok: false, ms: Math.round(performance.now() - t0), error: String(err?.message || err) };
  }
}

export default function DiagnosticoRede() {
  const health = useApiHealth();
  const [target, setTarget] = useState(getActiveTarget());
  const [primaryR, setPrimaryR] = useState<ProbeResult | null>(null);
  const [backupR, setBackupR] = useState<ProbeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [switches, setSwitches] = useState<any[]>([]);

  const runProbes = useCallback(async () => {
    setLoading(true);
    const [p, b] = await Promise.all([probe(PRIMARY.api), probe(BACKUP.api)]);
    setPrimaryR(p);
    setBackupR(b);
    setLoading(false);
  }, []);

  useEffect(() => {
    void runProbes();
    const id = setInterval(runProbes, 15_000);
    return () => clearInterval(id);
  }, [runProbes]);

  useEffect(() => {
    try {
      const log = JSON.parse(localStorage.getItem("uhome:proxy:switches") || "[]");
      setSwitches(log);
    } catch {
      setSwitches([]);
    }
  }, [target]);

  const force = (t: "primary" | "backup") => {
    setActiveTarget(t);
    setTarget(t);
    setTimeout(runProbes, 200);
  };

  const Row = ({ label, url, r }: { label: string; url: string; r: ProbeResult | null }) => (
    <div className="flex items-center justify-between py-2 border-b border-border/40 last:border-0">
      <div className="min-w-0">
        <div className="font-semibold text-sm">{label}</div>
        <div className="text-xs text-muted-foreground truncate">{url}</div>
      </div>
      <div className="flex items-center gap-3 text-sm">
        {r ? (
          r.ok ? (
            <span className="flex items-center gap-1 text-emerald-500">
              <CheckCircle2 className="h-4 w-4" /> {r.status ?? "OK"} · {r.ms}ms
            </span>
          ) : (
            <span className="flex items-center gap-1 text-red-500">
              <XCircle className="h-4 w-4" /> {r.error || `HTTP ${r.status}`} · {r.ms}ms
            </span>
          )
        ) : (
          <span className="text-muted-foreground">…</span>
        )}
      </div>
    </div>
  );

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          {health === "online" ? <Wifi className="h-6 w-6 text-emerald-500" /> : <WifiOff className="h-6 w-6 text-amber-500" />}
          Diagnóstico de Rede
        </h1>
        <Button onClick={runProbes} disabled={loading} size="sm" variant="outline">
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Testar
        </Button>
      </div>

      <Card className="p-4">
        <div className="text-sm mb-2">
          <span className="text-muted-foreground">Estado do app: </span>
          <span className="font-semibold">{health}</span>
          <span className="text-muted-foreground ml-4">Host ativo: </span>
          <span className="font-semibold uppercase">{target}</span>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant={target === "primary" ? "default" : "outline"} onClick={() => force("primary")}>
            Forçar primary
          </Button>
          <Button size="sm" variant={target === "backup" ? "default" : "outline"} onClick={() => force("backup")}>
            Forçar backup
          </Button>
        </div>
      </Card>

      <Card className="p-4">
        <h2 className="font-semibold mb-2">Health checks</h2>
        <Row label="Primary" url={PRIMARY.api} r={primaryR} />
        <Row label="Backup" url={BACKUP.api} r={backupR} />
      </Card>

      <Card className="p-4">
        <h2 className="font-semibold mb-2">Histórico de switches ({switches.length})</h2>
        {switches.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum switch registrado nesta sessão.</p>
        ) : (
          <ul className="text-xs space-y-1 font-mono max-h-64 overflow-auto">
            {switches.map((s, i) => (
              <li key={i} className="flex justify-between gap-3 border-b border-border/40 py-1">
                <span>{new Date(s.ts).toLocaleTimeString()}</span>
                <span className="font-bold">→ {s.target}</span>
                <span className="text-muted-foreground">{s.reason}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
