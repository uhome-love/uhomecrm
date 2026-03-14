/**
 * traceContext.ts — Lightweight correlation ID support for UhomeSales
 * 
 * Generates and propagates trace IDs across frontend services and edge functions.
 * 
 * Frontend flow:
 *   1. UI action generates a traceId via generateTraceId()
 *   2. traceId is passed to service calls and included in log context
 *   3. When calling edge functions, traceId is sent as x-trace-id header
 * 
 * Edge function flow:
 *   1. Extract traceId from x-trace-id header or generate new one
 *   2. Include in all structured log entries
 *   3. Pass to downstream function calls via x-trace-id header
 *   4. Store in audit_log.request_id for post-hoc querying
 * 
 * Trace ID format: "t-{timestamp_base36}-{random_hex}"
 *   Example: "t-m1abc3-7f3a2d"
 */

/** Generate a short, unique trace ID */
export function generateTraceId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(16).slice(2, 8);
  return `t-${ts}-${rand}`;
}

/** Build headers object with trace ID for edge function calls */
export function traceHeaders(traceId: string): Record<string, string> {
  return { "x-trace-id": traceId };
}

/** Extract trace ID from request headers, or generate a new one */
export function extractTraceId(req: { headers: { get: (name: string) => string | null } }): string {
  return req.headers.get("x-trace-id") || generateTraceId();
}
