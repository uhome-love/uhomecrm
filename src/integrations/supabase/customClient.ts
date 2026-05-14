// Wrapper Supabase apontando para o domínio próprio (proxy Cloudflare).
// Objetivo: evitar bloqueios de WiFi/firewall/DNS que filtram *.supabase.co.
//
// IMPORTANTE: NÃO importar do client.ts oficial — ele é auto-gerado pelo Lovable.
// O tipo Database vem direto de ./types (também auto-gerado, mas estável e seguro).
//
// Rollback: trocar SUPABASE_URL para "https://hunbxqzhvuemgntklyzb.supabase.co"
// e remover o override de realtime.
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const SUPABASE_URL = "https://api.uhomesales.com";
const REALTIME_URL = "wss://realtime.uhomesales.com/realtime/v1";
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

// Força o WebSocket do Realtime a usar o subdomínio próprio.
// O cliente do supabase-js calcula endPoint internamente a partir da URL principal;
// sobrescrevemos depois da construção para evitar conexões em wss://*.supabase.co.
try {
  (supabase.realtime as any).endPoint = REALTIME_URL;
  (supabase.realtime as any).endPointURL = () => REALTIME_URL;
} catch {
  // noop — fallback silencioso, REST/Auth continuam funcionando
}
