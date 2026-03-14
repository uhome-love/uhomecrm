/**
 * edgeLogger.ts — Structured logging utility for Edge Functions
 * 
 * Provides consistent JSON-structured logs for Deno edge functions.
 * Copy this file into edge functions that need structured logging.
 * 
 * Usage:
 *   const logger = createEdgeLogger("receive-landing-lead");
 *   logger.info("Lead received", { phone, source });
 *   logger.error("Insert failed", { phone }, error, "system");
 */

export type ErrorCategory = "validation" | "user" | "system" | "integration";

interface LogPayload {
  fn: string;
  msg: string;
  level: string;
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

export function createEdgeLogger(functionName: string) {
  const make = (level: string) =>
    (msg: string, ctx?: Record<string, unknown>, err?: unknown, category?: ErrorCategory) => {
      emit({
        fn: functionName,
        msg,
        level,
        category: category || (level === "error" ? "system" : undefined),
        ctx,
        err: formatError(err),
        ts: new Date().toISOString(),
      });
    };

  return {
    debug: make("debug"),
    info: make("info"),
    warn: make("warn"),
    error: make("error"),
    validation: (msg: string, ctx?: Record<string, unknown>, err?: unknown) =>
      make("error")(msg, ctx, err, "validation"),
    integration: (msg: string, ctx?: Record<string, unknown>, err?: unknown) =>
      make("error")(msg, ctx, err, "integration"),
  };
}
