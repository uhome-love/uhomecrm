// oferta-ativa-popular-fila — Fase 1 Mutirão Inteligente
// Popula oferta_ativa_fila para uma sessão. Admin/Diretor only.
// verify_jwt=false (valida role em código para tolerar chamadas server-side controladas).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";

const RED_MOTIVO_RE =
  /(quer mais contato|respondeu n[aã]o ao reeng|bloqueou|block|retirada do nome|n[uú]mero inv[aá]lido|contato errado|lead real|auto-reply|resposta negativa|duplicado)/i;
const RED_REENG = new Set([
  "telefone_invalido",
  "respondeu_nao",
  "respondeu_nao_wave2",
  "respondeu_outro",
]);
const YELLOW_MOTIVO_RE =
  /(sem condi|sem perfil|perfil incompat|desistiu|n[aã]o atende necess|previsibilidade)/i;
const HOT_REENG = new Set(["respondeu_sim", "respondeu_sim_wave2"]);

const DESCARTE_STAGE_ID = "1dd66c25-3848-4053-9f66-82e902989b4d";

function normalizeAlias(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleCors();

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return errorResponse("Unauthorized", 401);
    }

    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Valida usuário e role
    const userClient = createClient(url, anon, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) return errorResponse("Unauthorized", 401);
    const userId = claimsData.claims.sub as string;

    const admin = createClient(url, service);

    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const roleSet = new Set((roles ?? []).map((r: any) => r.role));
    if (!roleSet.has("admin") && !roleSet.has("diretor")) {
      return errorResponse("Forbidden — admin/diretor required", 403);
    }

    const body = await req.json().catch(() => ({}));
    const sessao_id: string | undefined = body?.sessao_id;
    if (!sessao_id) return errorResponse("sessao_id required", 400);

    // Confere sessão
    const { data: sessao, error: sessaoErr } = await admin
      .from("oferta_ativa_sessoes")
      .select("id, status")
      .eq("id", sessao_id)
      .maybeSingle();
    if (sessaoErr) return errorResponse(sessaoErr.message, 500);
    if (!sessao) return errorResponse("sessao not found", 404);

    // 1) Candidatos em Descarte (últimos 90d, com telefone, não arquivado)
    const cutoffIso = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString();

    const candidates: any[] = [];
    const pageSize = 1000;
    let from = 0;
    while (true) {
      const { data, error } = await admin
        .from("pipeline_leads")
        .select(
          "id, nome, telefone, telefone_normalizado, empreendimento, motivo_descarte, tipo_descarte, reengajamento_status, corretor_id, corretor_anterior_id, stage_changed_at",
        )
        .eq("stage_id", DESCARTE_STAGE_ID)
        // NOTE: NÃO filtrar arquivado — cron arquiva descartes após 24h, mas eles seguem elegíveis para oferta ativa
        .not("telefone_normalizado", "is", null)
        .gte("stage_changed_at", cutoffIso)
        .order("stage_changed_at", { ascending: false })
        .range(from, from + pageSize - 1);
      if (error) return errorResponse(error.message, 500);
      if (!data || data.length === 0) break;
      candidates.push(...data);
      if (data.length < pageSize) break;
      from += pageSize;
    }

    if (candidates.length === 0) {
      return jsonResponse({ ok: true, inserted: 0, skipped_red: 0, skipped_dup: 0, skipped_cooldown: 0 });
    }

    // 2) Detecta duplicados ativos por telefone_normalizado
    const phones = Array.from(new Set(candidates.map((c) => c.telefone_normalizado).filter(Boolean)));
    const activePhones = new Set<string>();
    for (let i = 0; i < phones.length; i += 500) {
      const batch = phones.slice(i, i + 500);
      const { data } = await admin
        .from("pipeline_leads")
        .select("telefone_normalizado")
        .in("telefone_normalizado", batch)
        .neq("stage_id", DESCARTE_STAGE_ID)
        .eq("arquivado", false)
        .neq("aceite_status", "descartado");
      (data ?? []).forEach((r: any) => r.telefone_normalizado && activePhones.add(r.telefone_normalizado));
    }

    // 3) Cooldown 7d cross-sessão (lig recent)
    const cooldownIso = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    const leadIds = candidates.map((c) => c.id);
    const recentLeads = new Set<string>();
    for (let i = 0; i < leadIds.length; i += 500) {
      const batch = leadIds.slice(i, i + 500);
      const { data } = await admin
        .from("oferta_ativa_ligacoes")
        .select("pipeline_lead_id")
        .in("pipeline_lead_id", batch)
        .gte("created_at", cooldownIso);
      (data ?? []).forEach((r: any) => recentLeads.add(r.pipeline_lead_id));
    }

    // 4) Resolve empreendimento canônico via aliases
    const aliasKeys = Array.from(
      new Set(candidates.map((c) => normalizeAlias(c.empreendimento)).filter(Boolean)),
    );
    const aliasMap = new Map<string, { empreendimento_id: string; segmento_id: string | null }>();
    if (aliasKeys.length) {
      for (let i = 0; i < aliasKeys.length; i += 500) {
        const batch = aliasKeys.slice(i, i + 500);
        const { data } = await admin
          .from("empreendimento_aliases")
          .select("alias_norm, empreendimento_id, empreendimentos_canonicos:empreendimento_id(id, segmento_id)")
          .in("alias_norm", batch);
        (data ?? []).forEach((r: any) => {
          aliasMap.set(r.alias_norm, {
            empreendimento_id: r.empreendimento_id,
            segmento_id: r.empreendimentos_canonicos?.segmento_id ?? null,
          });
        });
      }
    }

    // 4b) Mapeia auth.users.id (pipeline_leads.corretor_id) → profiles.id (FK da fila)
    const authIds = Array.from(
      new Set(
        candidates
          .flatMap((c) => [c.corretor_id, c.corretor_anterior_id])
          .filter(Boolean),
      ),
    ) as string[];
    const authToProfile = new Map<string, string>();
    if (authIds.length) {
      for (let i = 0; i < authIds.length; i += 500) {
        const batch = authIds.slice(i, i + 500);
        const { data } = await admin
          .from("profiles")
          .select("id, auth_user_id")
          .in("auth_user_id", batch);
        (data ?? []).forEach((r: any) => {
          if (r.auth_user_id) authToProfile.set(r.auth_user_id, r.id);
        });
      }
    }

    // 5) Classifica e monta insert rows
    let skippedRed = 0;
    let skippedDup = 0;
    let skippedCooldown = 0;
    const rows: any[] = [];

    for (const c of candidates) {
      if (activePhones.has(c.telefone_normalizado)) {
        skippedDup++;
        continue;
      }
      if (recentLeads.has(c.id)) {
        skippedCooldown++;
        continue;
      }
      const motivo = c.motivo_descarte ?? "";
      const reeng = c.reengajamento_status ?? "";
      const isRed =
        RED_MOTIVO_RE.test(motivo) ||
        RED_REENG.has(reeng) ||
        c.tipo_descarte === "definitivo";
      if (isRed) {
        skippedRed++;
        continue;
      }

      let balde: "verde" | "verde_hot" | "amarelo";
      let bucket_order: number;
      if (HOT_REENG.has(reeng)) {
        balde = "verde_hot";
        bucket_order = 0;
      } else if (YELLOW_MOTIVO_RE.test(motivo)) {
        balde = "amarelo";
        bucket_order = 2;
      } else {
        balde = "verde";
        bucket_order = 1;
      }

      const aliasMatch = aliasMap.get(normalizeAlias(c.empreendimento));
      rows.push({
        sessao_id,
        pipeline_lead_id: c.id,
        balde,
        bucket_order,
        ultimo_corretor_id:
          (c.corretor_id && authToProfile.get(c.corretor_id)) ||
          (c.corretor_anterior_id && authToProfile.get(c.corretor_anterior_id)) ||
          null,
        empreendimento_id: aliasMatch?.empreendimento_id ?? null,
        segmento_id: aliasMatch?.segmento_id ?? null,
        motivo_descarte_raw: motivo || null,
        reengajamento_status_raw: reeng || null,
      });
    }

    // 6) Insere em lotes (ON CONFLICT DO NOTHING via upsert com ignoreDuplicates)
    let inserted = 0;
    for (let i = 0; i < rows.length; i += 500) {
      const batch = rows.slice(i, i + 500);
      const { data, error } = await admin
        .from("oferta_ativa_fila")
        .upsert(batch, { onConflict: "sessao_id,pipeline_lead_id", ignoreDuplicates: true })
        .select("id");
      if (error) return errorResponse(`insert fila failed: ${error.message}`, 500);
      inserted += data?.length ?? 0;
    }

    return jsonResponse({
      ok: true,
      candidates: candidates.length,
      inserted,
      skipped_red: skippedRed,
      skipped_dup: skippedDup,
      skipped_cooldown: skippedCooldown,
    });
  } catch (e) {
    console.error("[popular-fila] erro:", e);
    return errorResponse((e as Error).message ?? "internal", 500);
  }
});
