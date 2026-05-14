// Wrapper Supabase apontando para o domínio próprio (proxy Cloudflare).
// Objetivo: evitar bloqueios de WiFi/firewall/DNS que filtram *.supabase.co.
//
// IMPORTANTE: NÃO importar do client.ts oficial — ele é auto-gerado pelo Lovable.
// O tipo Database vem direto de ./types (também auto-gerado, mas estável e seguro).
//
// Failover: o REST sai via window.fetch que é interceptado pelo smartFetch
// (src/lib/fetchCircuitBreaker.ts) e reescrito para api-backup quando preciso.
// Para o Realtime (WebSocket) fazemos um watchdog dedicado abaixo.
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import { PRIMARY, BACKUP, getActiveTarget } from "@/lib/proxyEndpoints";

const SUPABASE_URL = PRIMARY.api;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabase = createClient<Database>(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      storage: localStorage,
      persistSession: true,
      autoRefreshToken: true,
    },
    realtime: {
      params: { eventsPerSecond: 10 },
    },
  },
);

// ─── Realtime: força host próprio + watchdog de failover ─────────────────────
function applyRealtimeEndpoint() {
  const url = getActiveTarget() === "backup" ? BACKUP.realtime : PRIMARY.realtime;
  try {
    (supabase.realtime as any).endPoint = url;
    (supabase.realtime as any).endPointURL = () => url;
  } catch {
    // noop
  }
}

applyRealtimeEndpoint();

// Quando o smartFetch chavear primary↔backup, reaplica e força reconnect
if (typeof window !== "undefined") {
  window.addEventListener("proxy:switched", () => {
    applyRealtimeEndpoint();
    try {
      const rt: any = supabase.realtime;
      if (typeof rt.disconnect === "function") rt.disconnect();
      if (typeof rt.connect === "function") setTimeout(() => rt.connect(), 250);
    } catch {
      // noop
    }
  });
}
