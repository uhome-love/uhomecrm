import type {} from "./generated/ai-gateway/models.d.ts";
import { generateChatCompletion, streamChatCompletion, generateEmbeddings, GatewayError,
  type ChatRequest, type EmbeddingsRequest } from "@lovable.dev/ai-gateway";
import { createClient } from "npm:@supabase/supabase-js@2";
import { usageStart, usageFinish, type HomiCallContext } from "./homiUsage.ts";

/** Durable start row before inference; one row per call, including failed/cancelled streams. */
async function startUsage(context: HomiCallContext, model: string) {
  const url = Deno.env.get("SUPABASE_URL"), key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Medição HOMI indisponível; chamada de IA não iniciada.");
  const client = createClient(url,key,{ auth: { persistSession:false } });
  let papel: string | null = null;
  if (context.userId) {
    const { data } = await client.from("user_roles").select("role").eq("user_id",context.userId).limit(1).maybeSingle();
    papel = data?.role ?? null;
  }
  const { data, error } = await client.from("homi_ia_uso").insert(usageStart({...context,papel},model)).select("id").single();
  if (error || !data) throw new Error("Medição HOMI indisponível; chamada de IA não iniciada.");
  const started = performance.now();
  let finished = false;
  return async (usage: unknown, success: boolean, code: string | null = null) => {
    if (finished) return;
    finished = true;
    const { error: updateError } = await client.from("homi_ia_uso")
      .update(usageFinish(usage,performance.now()-started,success,code)).eq("id",data.id);
    if (updateError) { console.error("[homi-usage] finalização indisponível",data.id); throw new Error("Medição HOMI não finalizada."); }
  };
}

const failure = (e: unknown) => e instanceof GatewayError ? e.code : "falha_gateway";
const failureResponse = (e: unknown) => new Response(JSON.stringify({ error: failure(e) }), {
  status: e instanceof GatewayError ? e.httpStatus ?? 500 : 500,
  headers:{"Content-Type":"application/json"},
});

/** Response adapter preserves existing JSON/SSE consumers; SDK owns the gateway transport. */
export async function homiGateway(payload: ChatRequest, context: HomiCallContext, streaming = false): Promise<Response> {
  const finish = await startUsage(context,payload.model);
  try {
    if (!streaming) {
      const data = await generateChatCompletion(payload,{maxRetries:0});
      await finish(data.usage,true);
      return new Response(JSON.stringify(data),{headers:{"Content-Type":"application/json"}});
    }
    const events = await streamChatCompletion({...payload,stream_options:{include_usage:true}},{maxRetries:0});
    const iterator = events[Symbol.asyncIterator]();
    let usage: unknown = null;
    let streamFailed = false;
    const encoder = new TextEncoder();
    return new Response(new ReadableStream<Uint8Array>({
      async pull(controller) {
        try {
          const next = await iterator.next();
          if (next.done) {
            await finish(usage,!streamFailed,streamFailed ? "falha_stream" : null);
            controller.enqueue(encoder.encode("data: [DONE]\n\n")); controller.close(); return;
          }
          if (next.value.usage) usage = next.value.usage;
          if (next.value.choices.some(choice => choice.finish_reason === "error")) streamFailed = true;
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(next.value)}\n\n`));
        } catch (e) {
          await finish(usage,false,failure(e));
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({error:failure(e)})}\n\n`)); controller.close();
        }
      },
      async cancel() { await finish(usage,false,"cancelado"); await iterator.return?.(); },
    }),{headers:{"Content-Type":"text/event-stream"}});
  } catch (e) { await finish(null,false,failure(e)); return failureResponse(e); }
}

export async function homiEmbeddings(payload: EmbeddingsRequest, context: HomiCallContext) {
  const finish = await startUsage(context,payload.model);
  try { const data = await generateEmbeddings(payload,{maxRetries:0}); await finish(data.usage,true); return data; }
  catch (e) { await finish(null,false,failure(e)); throw e; }
}