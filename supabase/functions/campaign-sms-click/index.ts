/**
 * campaign-sms-click — Public endpoint for Brevo SMS campaign clicks
 * 
 * Receives click data from the /melnickday landing page,
 * creates/updates leads in pipeline_leads, logs everything to campaign_clicks.
 * 
 * POST body: { phone, nome, email, utm_source, utm_medium, utm_campaign, canal, origem, campanha, user_agent }
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";

const WHATSAPP_REDIRECT = "https://wa.me/5551992597097?text=Quero%20saber%20mais%20sobre%20o%20Melnick%20Day";

function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return null;
  // Remove country code 55
  if (digits.startsWith("55") && digits.length >= 12) return digits.slice(2);
  return digits;
}

// Extract a human-readable name from an email address as last resort
function nameFromEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const local = email.split("@")[0];
  if (!local || local.length < 3) return null;
  // Skip purely numeric or random-looking usernames
  if (/^\d+$/.test(local) || /^[a-z0-9]{20,}$/i.test(local)) return null;
  // Replace common separators with spaces, then title-case
  const cleaned = local
    .replace(/[._-]/g, " ")
    .replace(/\d+/g, "") // remove numbers
    .trim();
  if (cleaned.length < 3) return null;
  // Title case each word
  const titled = cleaned
    .split(/\s+/)
    .filter(w => w.length > 0)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
  return titled || null;
}

// Build all normalized variants for matching (with/without 55, with/without 9th digit)
function phoneVariants(normalized: string): string[] {
  const variants = new Set<string>();
  variants.add(normalized);
  variants.add(`55${normalized}`);
  
  // Handle 9th digit: DDD(2) + 9 + number(8) = 11 digits
  // If has 9th digit (11 digits, 3rd char is 9), also try without it
  if (normalized.length === 11 && normalized[2] === "9") {
    const without9 = normalized.slice(0, 2) + normalized.slice(3);
    variants.add(without9);
    variants.add(`55${without9}`);
  }
  // If missing 9th digit (10 digits), also try with it
  if (normalized.length === 10) {
    const with9 = normalized.slice(0, 2) + "9" + normalized.slice(2);
    variants.add(with9);
    variants.add(`55${with9}`);
  }

  return [...variants];
}

function isBlockedTestLead(input: { nome?: string | null; email?: string | null; phone?: string | null }) {
  const nome = (input.nome || "").trim().toLowerCase();
  const email = (input.email || "").trim().toLowerCase();
  const phone = (input.phone || "").replace(/\D/g, "");

  const blockedNames = new Set(["test", "teste", "test dummy"]);
  const hasBlockedName = blockedNames.has(nome) || nome.startsWith("<test");
  const hasBlockedEmail = email.includes("test") || email.endsWith("@example.com") || email.endsWith("@teste.com");
  const hasBlockedPhone = phone !== "" && /^9{8,}$/.test(phone);

  return hasBlockedName || hasBlockedEmail || hasBlockedPhone;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleCors();

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);
  const traceId = req.headers.get("x-trace-id") || `t-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 8)}`;

  const log = (level: string, msg: string, ctx?: Record<string, unknown>) =>
    console[level === "error" ? "error" : "info"](
      JSON.stringify({ fn: "campaign-sms-click", level, msg, traceId, ctx, ts: new Date().toISOString() })
    );

  // Helper: insert click record
  async function insertClick(data: Record<string, unknown>) {
    const { error } = await supabase.from("campaign_clicks").insert(data);
    if (error) log("error", "Failed to insert click", { error: error.message });
  }

  // Helper: update whatsapp_campaign_sends.clicked_at when lead clicks campaign button
  async function markWhatsAppSendClicked(phoneNorm: string | null) {
    if (!phoneNorm) return;
    try {
      const variants = phoneVariants(phoneNorm);
      const { data: sends } = await supabase
        .from("whatsapp_campaign_sends")
        .select("id, batch_id")
        .in("telefone_normalizado", variants)
        .in("status_envio", ["sent", "delivered", "read"])
        .is("clicked_at", null)
        .order("sent_at", { ascending: false })
        .limit(5);

      if (sends && sends.length > 0) {
        const now = new Date().toISOString();
        for (const send of sends) {
          await supabase
            .from("whatsapp_campaign_sends")
            .update({ clicked_at: now, status_envio: "clicked" })
            .eq("id", send.id);

          // Increment batch counter
          const { data: batch } = await supabase
            .from("whatsapp_campaign_batches")
            .select("total_clicked")
            .eq("id", send.batch_id)
            .single();
          if (batch) {
            await supabase
              .from("whatsapp_campaign_batches")
              .update({ total_clicked: (batch.total_clicked || 0) + 1 })
              .eq("id", send.batch_id);
          }
        }
        log("info", "Marked whatsapp_campaign_sends as clicked", { count: sends.length, phoneNorm });
      }
    } catch (e) {
      log("error", "Failed to mark WA send clicked", { error: e instanceof Error ? e.message : String(e) });
    }
  }

  try {
    const body = await req.json();
    const {
      phone, nome, email,
      utm_source, utm_medium, utm_campaign,
      canal = "brevo", origem = "SMS_MELNICK_DAY",
      campanha = "MELNICK_DAY_POA_2026",
      bloco = "",
      user_agent,
    } = body;

    const telefoneNormalizado = normalizePhone(phone);
    const normalizedEmail = email?.toLowerCase().trim() || null;
    const tags = ["MELNICK_DAY", "SMS", "Brevo"];
    const blocoLabel = bloco ? ` - bloco ${bloco}` : "";
    const obsText = `Lead veio do email Melnick Day 2026${blocoLabel} (${new Date().toLocaleDateString("pt-BR")})`;

    log("info", "Click received", { phone, telefoneNormalizado, nome, email: normalizedEmail, canal, origem, bloco });

    if (isBlockedTestLead({ nome, email: normalizedEmail, phone: telefoneNormalizado || phone })) {
      log("info", "Blocked test lead", { nome, email: normalizedEmail, phone: telefoneNormalizado || phone });
      await insertClick({
        telefone: phone || null,
        telefone_normalizado: telefoneNormalizado,
        nome: nome || null,
        email: normalizedEmail,
        origem,
        canal,
        campanha,
        utm_source: utm_source || null,
        utm_medium: utm_medium || null,
        utm_campaign: utm_campaign || null,
        tags,
        redirect_url: WHATSAPP_REDIRECT,
        user_agent: user_agent || null,
        status: "click_blocked_test",
        lead_action: "blocked",
        redirected: true,
      });
      return jsonResponse({ success: true, action: "blocked_test", redirect_url: WHATSAPP_REDIRECT });
    }

    // Base click record
    const clickBase: Record<string, unknown> = {
      telefone: phone || null,
      telefone_normalizado: telefoneNormalizado,
      nome: nome || null,
      email: email || null,
      origem,
      canal,
      campanha,
      utm_source: utm_source || null,
      utm_medium: utm_medium || null,
      utm_campaign: utm_campaign || null,
      tags,
      redirect_url: WHATSAPP_REDIRECT,
      user_agent: user_agent || null,
    };

    // ─── Enrich from brevo_contacts — always lookup to fill missing name/phone/email ───
    let enrichedNome = nome;
    let enrichedEmail = email;
    let enrichedPhone = telefoneNormalizado;
    let interesseBrevo: string | null = null;

    if (telefoneNormalizado || email) {
      let brevoContact: Record<string, unknown> | null = null;
      const brevoFields = "nome_completo, nome, sobrenome, email, telefone, telefone_normalizado, conversao_recente";

      if (telefoneNormalizado) {
        const variants = phoneVariants(telefoneNormalizado);
        const { data } = await supabase
          .from("brevo_contacts")
          .select(brevoFields)
          .in("telefone_normalizado", variants)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        brevoContact = data;
      }

      if (!brevoContact && email) {
        const { data } = await supabase
          .from("brevo_contacts")
          .select(brevoFields)
          .eq("email", email.toLowerCase().trim())
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        brevoContact = data;
      }

      if (brevoContact) {
        if (!enrichedNome || enrichedNome === "Lead Melnick Day") {
          enrichedNome = (brevoContact.nome_completo as string) || enrichedNome;
        }
        if (!enrichedEmail && brevoContact.email) {
          enrichedEmail = brevoContact.email as string;
        }
        if (!enrichedPhone && brevoContact.telefone_normalizado) {
          enrichedPhone = brevoContact.telefone_normalizado as string;
        }
        if (brevoContact.conversao_recente) {
          interesseBrevo = brevoContact.conversao_recente as string;
        }
        log("info", "Enriched from brevo_contacts", { enrichedNome, enrichedEmail, enrichedPhone, interesseBrevo });
      }

      // ─── Fallback: enrich from existing pipeline_leads if brevo didn't have data ───
      if (!enrichedNome || enrichedNome === "Lead Melnick Day" || !enrichedPhone) {
        let fallbackLead: Record<string, unknown> | null = null;
        const fallbackFields = "nome, email, telefone, telefone_normalizado";

        if (enrichedEmail || email) {
          const searchEmail = (enrichedEmail || email).toLowerCase().trim();
          const { data } = await supabase
            .from("pipeline_leads")
            .select(fallbackFields)
            .eq("email", searchEmail)
            .not("nome", "eq", "Lead Melnick Day")
            .not("aceite_status", "eq", "descartado")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          fallbackLead = data;
        }

        if (!fallbackLead && telefoneNormalizado) {
          const variants = phoneVariants(telefoneNormalizado);
          const { data } = await supabase
            .from("pipeline_leads")
            .select(fallbackFields)
            .in("telefone_normalizado", variants)
            .not("nome", "eq", "Lead Melnick Day")
            .not("aceite_status", "eq", "descartado")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          fallbackLead = data;
        }

        if (fallbackLead) {
          if ((!enrichedNome || enrichedNome === "Lead Melnick Day") && fallbackLead.nome) {
            enrichedNome = fallbackLead.nome as string;
          }
          if (!enrichedPhone && fallbackLead.telefone_normalizado) {
            enrichedPhone = fallbackLead.telefone_normalizado as string;
          }
          if (!enrichedEmail && fallbackLead.email) {
            enrichedEmail = fallbackLead.email as string;
          }
          log("info", "Enriched from pipeline_leads fallback", { enrichedNome, enrichedEmail, enrichedPhone });
        }
      }
    }

    // ─── Try to find existing lead by phone OR email ───
    let existingLead: Record<string, unknown> | null = null;

    // Search with all available phone numbers (original + enriched)
    const phonesToSearch = new Set<string>();
    if (telefoneNormalizado) phoneVariants(telefoneNormalizado).forEach(v => phonesToSearch.add(v));
    if (enrichedPhone && enrichedPhone !== telefoneNormalizado) phoneVariants(enrichedPhone).forEach(v => phonesToSearch.add(v));

    if (phonesToSearch.size > 0) {
      const { data } = await supabase
        .from("pipeline_leads")
        .select("id, nome, email, telefone, telefone_normalizado, tags, stage_id, corretor_id")
        .in("telefone_normalizado", [...phonesToSearch])
        .not("aceite_status", "eq", "descartado")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      existingLead = data;
    }

    if (!existingLead && (enrichedEmail || email)) {
      const searchEmail = (enrichedEmail || email).toLowerCase().trim();
      const { data } = await supabase
        .from("pipeline_leads")
        .select("id, nome, email, telefone, telefone_normalizado, tags, stage_id, corretor_id")
        .ilike("email", searchEmail)
        .not("aceite_status", "eq", "descartado")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      existingLead = data;
    }

    // If no phone AND no email (even after enrichment), still log click and redirect
    if (!telefoneNormalizado && !email && !enrichedEmail) {
      log("warn", "No valid phone or email, logging click only", { phone, email });
      await insertClick({ ...clickBase, status: "click_no_contact", lead_action: "none", redirected: true });
      return jsonResponse({ success: true, action: "redirect_only", redirect_url: WHATSAPP_REDIRECT });
    }

    if (existingLead) {
      // ─── UPDATE existing lead ───
      log("info", "Lead exists, updating", { leadId: existingLead.id });

      const currentTags: string[] = (existingLead.tags as string[]) || [];
      const newTags = [...new Set([...currentTags, ...tags])];

      // Preserve existing observacoes — append instead of overwrite
      const campaignObs = interesseBrevo
        ? `${obsText} | Interesse: ${interesseBrevo}`
        : obsText;
      const existingObs = (existingLead.observacoes as string) || "";
      const mergedObs = existingObs
        ? `${existingObs}\n---\n${campaignObs}`
        : campaignObs;

      const updateData: Record<string, unknown> = {
        tags: newTags,
        campanha: campanha,
        observacoes: mergedObs,
      };
      // Update name if we have one and existing is generic
      const bestNome = enrichedNome || nome || nameFromEmail(enrichedEmail || email);
      if (bestNome && (!existingLead.nome || existingLead.nome === "Lead Melnick Day")) {
        updateData.nome = bestNome;
      }
      // Update email if we have one and existing doesn't
      const bestEmail = enrichedEmail || email;
      if (bestEmail && !existingLead.email) {
        updateData.email = bestEmail;
      }
      // Update phone if we have one and existing doesn't
      const bestPhone = enrichedPhone || telefoneNormalizado;
      if (bestPhone && !existingLead.telefone_normalizado) {
        updateData.telefone_normalizado = bestPhone;
        updateData.telefone = phone || bestPhone;
      }

      await supabase.from("pipeline_leads").update(updateData).eq("id", existingLead.id);

      // ─── Notify the responsible corretor ───
      const corretorId = existingLead.corretor_id as string | null;
      if (corretorId) {
        const leadNome = (enrichedNome || nome || existingLead.nome || "Lead") as string;
        const interesseMsg = interesseBrevo ? `\nInteresse detectado: ${interesseBrevo}` : "";
        await supabase.from("notifications").insert({
          user_id: corretorId,
          titulo: `🔥 ${leadNome} clicou no Melnick Day!`,
          mensagem: `Seu lead "${leadNome}" demonstrou interesse clicando na campanha Melnick Day 2026${blocoLabel}. Entre em contato agora!${interesseMsg}`,
          tipo: "lead_reengajado",
          categoria: "leads",
          dados: { pipeline_lead_id: existingLead.id, campanha, bloco, origem, interesse: interesseBrevo },
        });
        log("info", "Corretor notified", { corretorId, leadId: existingLead.id });
      }

      // ─── Add atividade to timeline so corretor sees in histórico ───
      const canalLabel = canal === "email" ? "📧 Email" : canal === "sms" ? "📱 SMS" : "🟢 WhatsApp";
      const interesseLabel = interesseBrevo ? ` | Interesse: ${interesseBrevo}` : "";
      await supabase.from("pipeline_atividades").insert({
        pipeline_lead_id: existingLead.id,
        tipo: "email",
        titulo: `${canalLabel} Campanha Melnick Day`,
        descricao: `Lead clicou na campanha Melnick Day 2026 via ${canal}${blocoLabel}${interesseLabel}`,
        data: new Date().toISOString().slice(0, 10),
        status: "concluida",
        responsavel_id: corretorId || null,
      });

      // Log progression
      await supabase.from("lead_progressao").insert({
        lead_id: existingLead.id,
        modulo_origem: "campanha_email",
        modulo_destino: "pipeline",
        fase_origem: "email_click",
        fase_destino: "lead_reengaged",
        triggered_by: "campaign-sms-click",
      });

      // ─── Mark WhatsApp campaign send as clicked ───
      await markWhatsAppSendClicked(telefoneNormalizado || enrichedPhone);


      await supabase.from("melnick_campaign_analytics").insert({
        tipo: "reactivated",
        pipeline_lead_id: existingLead.id,
        telefone: telefoneNormalizado,
        origem_canal: canal,
        rule_applied: "existing_lead_notified",
      });

      await insertClick({
        ...clickBase,
        status: "lead_updated",
        lead_action: "updated",
        pipeline_lead_id: existingLead.id,
        redirected: true,
      });

      log("info", "Lead updated & corretor notified", { leadId: existingLead.id, corretorId });
      return jsonResponse({
        success: true,
        action: "updated",
        lead_id: existingLead.id,
        redirect_url: WHATSAPP_REDIRECT,
      });
    }

    // ─── CREATE new lead ───
    log("info", "Creating new lead", { telefoneNormalizado, enrichedNome, enrichedEmail, interesseBrevo });

    // Get first pipeline stage
    const { data: firstStage } = await supabase
      .from("pipeline_stages")
      .select("id")
      .eq("pipeline_tipo", "leads")
      .order("ordem", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!firstStage) {
      log("error", "No pipeline stages found");
      await insertClick({ ...clickBase, status: "error", error_message: "No pipeline stages", lead_action: "none", redirected: true });
      return jsonResponse({ success: false, error: "No pipeline stages", redirect_url: WHATSAPP_REDIRECT }, 500);
    }

    const leadNome = enrichedNome || nome || nameFromEmail(enrichedEmail || email) || "Lead Melnick Day";
    const leadEmail = enrichedEmail || email;
    const leadPhone = enrichedPhone || telefoneNormalizado;
    const obsComInteresse = interesseBrevo
      ? `${obsText} | Interesse: ${interesseBrevo}`
      : obsText;

    // Use upsert-like approach: try insert, if unique constraint fails, find existing
    let newLead: { id: string } | null = null;
    let insertErr: { message: string } | null = null;

    const insertResult = await supabase
      .from("pipeline_leads")
      .insert({
        nome: leadNome,
        telefone: phone || leadPhone || null,
        telefone_normalizado: leadPhone,
        email: leadEmail || null,
        origem: origem,
        campanha: campanha,
        stage_id: firstStage.id,
        aceite_status: "pendente_distribuicao",
        tags,
        observacoes: obsComInteresse,
      })
      .select("id")
      .single();

    if (insertResult.error) {
      // Unique constraint violation — lead was created between our check and insert (race condition)
      if (insertResult.error.code === "23505") {
        log("info", "Duplicate detected by DB constraint, finding existing", { error: insertResult.error.message });
        // Re-search for the existing lead
        let raceLead: Record<string, unknown> | null = null;
        if (leadEmail) {
          const { data } = await supabase
            .from("pipeline_leads")
            .select("id, nome, email, telefone, telefone_normalizado, tags, stage_id, corretor_id")
            .ilike("email", leadEmail.toLowerCase().trim())
            .not("aceite_status", "eq", "descartado")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          raceLead = data;
        }
        if (!raceLead && leadPhone) {
          const variants = phoneVariants(leadPhone);
          const { data } = await supabase
            .from("pipeline_leads")
            .select("id, nome, email, telefone, telefone_normalizado, tags, stage_id, corretor_id")
            .in("telefone_normalizado", variants)
            .not("aceite_status", "eq", "descartado")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          raceLead = data;
        }
        if (raceLead) {
          // Update the existing lead instead
          const currentTags: string[] = (raceLead.tags as string[]) || [];
          const newTags = [...new Set([...currentTags, ...tags])];
          await supabase.from("pipeline_leads").update({ tags: newTags, campanha, observacoes: obsComInteresse }).eq("id", raceLead.id);
          await insertClick({ ...clickBase, status: "lead_updated", lead_action: "updated_race", pipeline_lead_id: raceLead.id as string, redirected: true });
          return jsonResponse({ success: true, action: "updated", lead_id: raceLead.id, redirect_url: WHATSAPP_REDIRECT });
        }
        // If we still can't find it, treat as error
        insertErr = insertResult.error;
      } else {
        insertErr = insertResult.error;
      }
    } else {
      newLead = insertResult.data;
    }

    if (insertErr || !newLead) {
      log("error", "Failed to create lead", { error: insertErr?.message });
      await insertClick({ ...clickBase, status: "error", error_message: insertErr?.message || "Insert failed", lead_action: "none", redirected: true });
      return jsonResponse({ success: false, error: "Failed to create lead", redirect_url: WHATSAPP_REDIRECT }, 500);
    }

    log("info", "Lead created", { leadId: newLead.id });

    // ── Register entry activity with campaign info ──
    const entradaParts: string[] = [];
    entradaParts.push(origem || canal || "Campanha");
    if (campanha) entradaParts.push(`Campanha: ${campanha}`);

    await supabase.from("pipeline_atividades").insert({
      pipeline_lead_id: newLead.id,
      tipo: "entrada",
      titulo: `Lead gerado via ${origem || canal}${campanha ? ` — ${campanha}` : ""}`,
      descricao: entradaParts.join(" • "),
      status: "concluida",
      created_by: "00000000-0000-0000-0000-000000000000",
    }).then(() => {}).catch(() => {});

    // Distribute via roleta
    try {
      await fetch(`${supabaseUrl}/functions/v1/distribute-lead`, {
        method: "POST",
        headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json", "x-trace-id": traceId },
        body: JSON.stringify({ action: "distribute_single", pipeline_lead_id: newLead.id }),
      });
      log("info", "Lead sent to roleta", { leadId: newLead.id });
    } catch (e) {
      log("error", "Roleta failed", { leadId: newLead.id, error: e instanceof Error ? e.message : String(e) });
    }

    // ─── Mark WhatsApp campaign send as clicked (new lead) ───
    await markWhatsAppSendClicked(telefoneNormalizado || enrichedPhone);

    // Analytics
    await supabase.from("melnick_campaign_analytics").insert([
      { tipo: "new_lead", pipeline_lead_id: newLead.id, telefone: telefoneNormalizado, origem_canal: canal, rule_applied: "sms_new" },
      { tipo: "sent_to_roleta", pipeline_lead_id: newLead.id, telefone: telefoneNormalizado, origem_canal: canal, rule_applied: "sms_new" },
    ]);

    await insertClick({
      ...clickBase,
      status: "lead_created",
      lead_action: "created",
      pipeline_lead_id: newLead.id,
      redirected: true,
    });

    return jsonResponse({
      success: true,
      action: "created",
      lead_id: newLead.id,
      redirect_url: WHATSAPP_REDIRECT,
    });

  } catch (err) {
    log("error", "Unhandled error", { error: err instanceof Error ? err.message : String(err) });

    // Still try to log the click
    try {
      await supabase.from("campaign_clicks").insert({
        status: "error",
        error_message: err instanceof Error ? err.message : String(err),
        lead_action: "none",
        redirected: true,
        redirect_url: WHATSAPP_REDIRECT,
      });
    } catch (_) { /* ignore */ }

    // Always return redirect URL even on error
    return jsonResponse({
      success: false,
      error: "Internal error",
      redirect_url: WHATSAPP_REDIRECT,
    }, 500);
  }
});
