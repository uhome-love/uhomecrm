export interface HomiCallContext {
  funcao: string;
  userId?: string | null;
  leadId?: string | null;
  versaoPrompt: string;
  papel?: string | null;
}

const object = (v: unknown): Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v) ? v as Record<string,unknown> : {};
const tokens = (v: unknown) => typeof v === "number" && Number.isFinite(v) ? Math.max(0,Math.trunc(v)) : 0;

/** Store only returned usage, never prompt/response content or invented costs. */
export function usageColumns(usage: unknown) {
  const u = object(usage), input = object(u.prompt_tokens_details), output = object(u.completion_tokens_details);
  return { tokens_entrada: tokens(u.prompt_tokens ?? u.input_tokens),
    tokens_saida: tokens(u.completion_tokens ?? u.output_tokens),
    tokens_cache: tokens(input.cached_tokens ?? object(u.input_tokens_details).cached_tokens ?? u.cached_tokens),
    tokens_raciocinio: tokens(output.reasoning_tokens ?? u.reasoning_tokens) };
}

export function usageStart(context: HomiCallContext, modelo: string) {
  return { funcao: context.funcao, modelo, versao_prompt: context.versaoPrompt,
    user_id: context.userId ?? null, lead_id: context.leadId ?? null, papel: context.papel ?? null,
    ...usageColumns(null), sucesso: false, erro: "em_andamento" };
}

export function usageFinish(usage: unknown, elapsed: number, success: boolean, errorCode: string | null = null) {
  return { ...usageColumns(usage), latencia_ms: Math.max(0,Math.round(elapsed)), sucesso: success,
    erro: success ? (usage ? null : "usage_nao_retornado") : errorCode ?? "falha_gateway" };
}