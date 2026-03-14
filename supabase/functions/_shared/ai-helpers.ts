/**
 * _shared/ai-helpers.ts — Shared AI gateway utilities for Edge Functions
 * 
 * Centralizes:
 *   - LOVABLE_API_KEY validation
 *   - AI gateway call (non-streaming)
 *   - AI gateway stream (SSE passthrough)
 *   - Standard 429/402 error handling
 * 
 * Usage:
 *   import { requireApiKey, callAI, streamAI } from "../_shared/ai-helpers.ts";
 *   import { corsHeaders, errorResponse } from "../_shared/cors.ts";
 * 
 *   const apiKey = requireApiKey(); // throws if missing
 *   
 *   // Non-streaming (returns parsed content string):
 *   const content = await callAI(apiKey, messages, { model, fnName });
 * 
 *   // Streaming (returns SSE Response):
 *   return streamAI(apiKey, messages, { model, fnName });
 */

import { corsHeaders } from "./cors.ts";

const AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const DEFAULT_MODEL = "google/gemini-2.5-flash";

export interface AICallOptions {
  /** Model to use. Defaults to google/gemini-2.5-flash */
  model?: string;
  /** Function name for error logging */
  fnName?: string;
  /** Max tokens (optional) */
  maxTokens?: number;
  /** Temperature (optional) */
  temperature?: number;
  /** Tool calling definitions (optional) */
  tools?: unknown[];
  /** Tool choice (optional) */
  toolChoice?: unknown;
}

export interface AIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * Get and validate LOVABLE_API_KEY from environment.
 * @throws Error if key is not configured
 */
export function requireApiKey(): string {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) throw new Error("LOVABLE_API_KEY is not configured");
  return key;
}

/**
 * Build the request body for the AI gateway.
 */
function buildRequestBody(messages: AIMessage[], options: AICallOptions, stream: boolean): string {
  const body: Record<string, unknown> = {
    model: options.model || DEFAULT_MODEL,
    messages,
    stream,
  };
  if (options.maxTokens) body.max_tokens = options.maxTokens;
  if (options.temperature !== undefined) body.temperature = options.temperature;
  if (options.tools) body.tools = options.tools;
  if (options.toolChoice) body.tool_choice = options.toolChoice;
  return JSON.stringify(body);
}

/**
 * Handle AI gateway error responses, returning a standardized Response.
 * Returns null if the response is OK (caller should proceed with parsing).
 */
export function handleAIError(response: globalThis.Response, fnName?: string): Response | null {
  if (response.ok) return null;

  const status = response.status;
  if (status === 429) {
    return new Response(
      JSON.stringify({ error: "Rate limit excedido, tente novamente em alguns segundos." }),
      { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
  if (status === 402) {
    return new Response(
      JSON.stringify({ error: "Créditos insuficientes." }),
      { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Log and throw for other errors
  response.text().then(t => console.error(`${fnName || "AI"} gateway error:`, status, t)).catch(() => {});
  return new Response(
    JSON.stringify({ error: "AI gateway error" }),
    { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

/**
 * Non-streaming AI call. Returns the parsed content string from the first choice.
 * 
 * @throws Response — if the gateway returns an error, throws a Response object
 *         that can be returned directly from the edge function handler.
 */
export async function callAI(
  apiKey: string,
  messages: AIMessage[],
  options: AICallOptions = {}
): Promise<string> {
  const fnName = options.fnName || "callAI";

  const response = await fetch(AI_GATEWAY_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: buildRequestBody(messages, options, false),
  });

  const errResp = handleAIError(response, fnName);
  if (errResp) throw errResp;

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

/**
 * Non-streaming AI call that returns the raw response JSON (for tool_calls parsing).
 */
export async function callAIRaw(
  apiKey: string,
  messages: AIMessage[],
  options: AICallOptions = {}
): Promise<unknown> {
  const fnName = options.fnName || "callAIRaw";

  const response = await fetch(AI_GATEWAY_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: buildRequestBody(messages, options, false),
  });

  const errResp = handleAIError(response, fnName);
  if (errResp) throw errResp;

  return await response.json();
}

/**
 * Streaming AI call. Returns an SSE Response that can be returned directly.
 * 
 * @throws Response — if the gateway returns an error, throws a Response object.
 */
export async function streamAI(
  apiKey: string,
  messages: AIMessage[],
  options: AICallOptions = {}
): Promise<Response> {
  const fnName = options.fnName || "streamAI";

  const response = await fetch(AI_GATEWAY_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: buildRequestBody(messages, options, true),
  });

  const errResp = handleAIError(response, fnName);
  if (errResp) throw errResp;

  return new Response(response.body, {
    headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
  });
}

/**
 * Wrap an edge function handler with standard CORS + error handling.
 * Reduces boilerplate in each function.
 * 
 * Usage:
 *   Deno.serve(withCorsAndErrorHandling("my-function", async (req) => {
 *     // ... your logic ...
 *     return jsonResponse({ result });
 *   }));
 */
export function withCorsAndErrorHandling(
  fnName: string,
  handler: (req: Request) => Promise<Response>
): (req: Request) => Promise<Response> {
  return async (req: Request) => {
    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      return await handler(req);
    } catch (e) {
      // If the thrown value is already a Response (from handleAIError), return it
      if (e instanceof Response) return e;

      console.error(`${fnName} error:`, e);
      return new Response(
        JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  };
}
