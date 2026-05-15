// Base URL para chamadas diretas a edge functions.
// Usa o host pinado dinâmico (failover bidirecional automático).
// Ver src/lib/hostFailover.ts.
import { getCurrentApiBase } from "./hostFailover";

// ⚠️ Re-exporta como getter; consumidores que importam EDGE_BASE_URL diretamente
// recebem o valor no momento da importação. Para chamadas dinâmicas, use
// `getEdgeBaseUrl()`.
export const EDGE_BASE_URL = getCurrentApiBase();

export function getEdgeBaseUrl(): string {
  return getCurrentApiBase();
}
