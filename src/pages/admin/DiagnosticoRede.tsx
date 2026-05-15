import { useEffect, useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, RefreshCw, Wifi } from "lucide-react";

// Runtime 16/05/2026 v5 — DIRETO ÚNICO + arquitetura simplificada (pré-13/05).
// Painel apenas de diagnóstico read-only. Não altera host de runtime.
const HOSTS = {
  direct: "https://hunbxqzhvuemgntklyzb.supabase.co",
  proxy: "https://api.uhomesales.com",
} as const;

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
  const [proxyR, setProxyR] = useState<ProbeResult | null>(null);
  const [directR, setDirectR] = useState<ProbeResult | null>(null);
  const [loading, setLoading] = useState(false);

  const runProbes = useCallback(async () => {
    setLoading(true);
    const [p, d] = await Promise.all([probe(HOSTS.proxy), probe(HOSTS.direct)]);
    setProxyR(p);
    setDirectR(d);
    setLoading(false);
  }, []);

  useEffect(() => {
    void runProbes();
    const id = setInterval(runProbes, 15_000);
    return () => clearInterval(id);
  }, [runProbes]);

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
          <Wifi className="h-6 w-6 text-emerald-500" />
          Diagnóstico de Rede
        </h1>
        <Button onClick={runProbes} disabled={loading} size="sm" variant="outline">
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Testar
        </Button>
      </div>

      <Card className="p-4">
        <div className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">Runtime v5:</span> direto único —
          todo o tráfego do app vai para <code>hunbxqzhvuemgntklyzb.supabase.co</code>.
          Sem fetch wrappers, sem detector agressivo de offline. O domínio
          <code> api.uhomesales.com</code> permanece publicado apenas para integrações
          server-side e como ferramenta de diagnóstico abaixo.
        </div>
      </Card>

      <Card className="p-4">
        <h2 className="font-semibold mb-2">Health checks</h2>
        <Row label="Direct (em uso)" url={HOSTS.direct} r={directR} />
        <Row label="Proxy Cloudflare (server-side / diagnóstico)" url={HOSTS.proxy} r={proxyR} />
      </Card>
    </div>
  );
}
