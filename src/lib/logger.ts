/**
 * logger.ts — Structured logging utility for UhomeSales
 * 
 * Classifies errors into categories for debugging:
 *   - validation: bad input data, missing fields
 *   - user: user-initiated errors (wrong password, duplicate, permission)
 *   - system: unexpected failures (network, DB, null refs)
 *   - integration: external service failures (WhatsApp, Jetimob, AI gateway)
 * 
 * Usage:
 *   import { log } from "@/lib/logger";
 *   log.error("pipeline", "Lead creation failed", { leadId }, error);
 *   log.warn("checkpoint", "Missing presenca data", { date });
 *   log.info("roleta", "Lead distributed", { leadId, corretorId });
 * 
 * Trace support:
 *   log.info("pipeline", "Lead saved", { traceId, leadId });
 */

export type LogLevel = "debug" | "info" | "warn" | "error";
export type ErrorCategory = "validation" | "user" | "system" | "integration";

interface LogEntry {
  module: string;
  message: string;
  level: LogLevel;
  category?: ErrorCategory;
  traceId?: string;
  context?: Record<string, unknown>;
  error?: unknown;
  timestamp: string;
}

function formatError(err: unknown): Record<string, unknown> | undefined {
  if (!err) return undefined;
  if (err instanceof Error) {
    return { name: err.name, message: err.message, stack: err.stack?.split("\n").slice(0, 5).join("\n") };
  }
  if (typeof err === "object") return err as Record<string, unknown>;
  return { raw: String(err) };
}

function emit(entry: LogEntry) {
  const prefix = `[${entry.module}]`;
  const payload = {
    ...entry,
    error: formatError(entry.error),
  };

  switch (entry.level) {
    case "error":
      console.error(prefix, entry.message, payload);
      break;
    case "warn":
      console.warn(prefix, entry.message, payload);
      break;
    case "info":
      console.info(prefix, entry.message, payload);
      break;
    default:
      console.debug(prefix, entry.message, payload);
  }
}

function createLogFn(level: LogLevel) {
  return (
    module: string,
    message: string,
    context?: Record<string, unknown>,
    error?: unknown,
    category?: ErrorCategory
  ) => {
    // Extract traceId from context for top-level field
    const traceId = context?.traceId as string | undefined;
    emit({
      module,
      message,
      level,
      category: category || (level === "error" ? "system" : undefined),
      traceId,
      context,
      error,
      timestamp: new Date().toISOString(),
    });
  };
}

export const log = {
  debug: createLogFn("debug"),
  info: createLogFn("info"),
  warn: createLogFn("warn"),
  error: createLogFn("error"),

  /** Convenience: log a validation error (bad input) */
  validation: (module: string, message: string, context?: Record<string, unknown>, error?: unknown) =>
    createLogFn("error")(module, message, context, error, "validation"),

  /** Convenience: log a user-caused error (permission, duplicate) */
  userError: (module: string, message: string, context?: Record<string, unknown>, error?: unknown) =>
    createLogFn("warn")(module, message, context, error, "user"),

  /** Convenience: log an integration/external service error */
  integration: (module: string, message: string, context?: Record<string, unknown>, error?: unknown) =>
    createLogFn("error")(module, message, context, error, "integration"),
};
