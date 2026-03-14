/**
 * edgeLogger.ts — Structured logging utility for Edge Functions
 * 
 * Provides consistent JSON-structured logs with trace ID support.
 * Copy this file into edge functions that need structured logging.
 * 
 * Usage:
 *   const logger = createEdgeLogger("receive-landing-lead");
 *   const traceId = extractTraceId(req);
 *   const L = logger.withTrace(traceId);
 *   L.info("Lead received", { phone, source });
 *   L.error("Insert failed", { phone }, error, "system");
 */

export type ErrorCategory = "validation" | "user" | "system" | "integration";

interface LogPayload {
  fn: string;
  msg: string;
  level: string;
  traceId?: string;
  category?: ErrorCategory;
  ctx?: Record<string, unknown>;
  err?: Record<string, unknown>;
  ts: string;
}

function formatError(err: unknown): Record<string, unknown> | undefined {
  if (!err) return undefined;
  if (err instanceof Error) {
    return { name: err.name, message: err.message };
  }
  if (typeof err === "object") return err as Record<string, unknown>;
  return { raw: String(err) };
}

function emit(payload: LogPayload) {
  const line = JSON.stringify(payload);
  switch (payload.level) {
    case "error": console.error(line); break;
    case "warn": console.warn(line); break;
    case "info": console.info(line); break;
    default: console.log(line);
  }
}

type LogFn = (msg: string, ctx?: Record<string, unknown>, err?: unknown, category?: ErrorCategory) => void;

interface Logger {
  debug: LogFn;
  info: LogFn;
  warn: LogFn;
  error: LogFn;
  validation: (msg: string, ctx?: Record<string, unknown>, err?: unknown) => void;
  integration: (msg: string, ctx?: Record<string, unknown>, err?: unknown) => void;
  /** Create a child logger with a bound trace ID */
  withTrace: (traceId: string) => Omit<Logger, 'withTrace'>;
}

export function createEdgeLogger(functionName: string): Logger {
  const make = (level: string, boundTraceId?: string): LogFn =>
    (msg, ctx, err, category) => {
      emit({
        fn: functionName,
        msg,
        level,
        traceId: boundTraceId || ctx?.traceId as string | undefined,
        category: category || (level === "error" ? "system" : undefined),
        ctx,
        err: formatError(err),
        ts: new Date().toISOString(),
      });
    };

  const buildLogger = (traceId?: string) => ({
    debug: make("debug", traceId),
    info: make("info", traceId),
    warn: make("warn", traceId),
    error: make("error", traceId),
    validation: (msg: string, ctx?: Record<string, unknown>, err?: unknown) =>
      make("error", traceId)(msg, ctx, err, "validation"),
    integration: (msg: string, ctx?: Record<string, unknown>, err?: unknown) =>
      make("error", traceId)(msg, ctx, err, "integration"),
  });

  return {
    ...buildLogger(),
    withTrace: (traceId: string) => buildLogger(traceId),
  };
}

/** Extract trace ID from request headers, or generate a new one */
export function extractTraceId(req: Request): string {
  return req.headers.get("x-trace-id") || `t-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 8)}`;
}
