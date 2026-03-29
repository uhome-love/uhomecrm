import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // 1. Find descarte stage
    const { data: descarteStage } = await supabase
      .from("pipeline_stages")
      .select("id")
      .eq("tipo", "descarte")
      .single();

    if (!descarteStage) {
      return new Response(
        JSON.stringify({ error: "Descarte stage not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Find or create "Leads Descartados" list
    const mesesPt = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
    const now = new Date();
    const LISTA_NOME = `Leads não aproveitados - ${mesesPt[now.getMonth()]} ${now.getFullYear()}`;
    let { data: lista } = await supabase
      .from("oferta_ativa_listas")
      .select("id, total_leads")
      .eq("nome", LISTA_NOME)
      .maybeSingle();

    if (!lista) {
      const { data: newLista, error: createErr } = await supabase
        .from("oferta_ativa_listas")
        .insert({
          nome: LISTA_NOME,
          empreendimento: "Diversos",
          campanha: "Descartados Pipeline",
          origem: "sistema",
          status: "ativa",
          max_tentativas: 5,
          cooldown_dias: 7,
          total_leads: 0,
          criado_por: "00000000-0000-0000-0000-000000000000",
        })
        .select("id, total_leads")
        .single();

      if (createErr) throw createErr;
      lista = newLista;
    }

    // 3. Fetch all leads in descarte stage
    const { data: leads, error: fetchErr } = await supabase
      .from("pipeline_leads")
      .select("id, nome, telefone, telefone2, email, empreendimento, observacoes, corretor_id, motivo_descarte, campanha, telefone_normalizado")
      .eq("stage_id", descarteStage.id)
      .eq("arquivado", false);

    if (fetchErr) throw fetchErr;
    if (!leads || leads.length === 0) {
      return new Response(
        JSON.stringify({ message: "Nenhum lead descartado encontrado", moved: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Check existing phones in OA list to avoid duplicates
    const phones = leads
      .map((l: any) => l.telefone_normalizado || l.telefone)
      .filter(Boolean);

    const { data: existingOA } = await supabase
      .from("oferta_ativa_leads")
      .select("telefone, telefone_normalizado")
      .eq("lista_id", lista.id);

    const existingPhones = new Set(
      (existingOA || []).flatMap((e: any) => [e.telefone, e.telefone_normalizado].filter(Boolean))
    );

    // 5. Insert into OA (skip duplicates)
    const toInsert = leads
      .filter((l: any) => {
        const phone = l.telefone_normalizado || l.telefone;
        return phone && !existingPhones.has(phone);
      })
      .map((l: any) => ({
        lista_id: lista!.id,
        nome: l.nome || "Sem nome",
        telefone: l.telefone || "",
        telefone2: l.telefone2 || null,
        email: l.email || "",
        empreendimento: l.empreendimento || "",
        status: "na_fila",
        observacoes: l.observacoes || null,
        motivo_descarte: l.motivo_descarte || null,
        corretor_id: l.corretor_id || null,
        campanha: l.campanha || null,
        telefone_normalizado: l.telefone_normalizado || null,
      }));

    let inserted = 0;
    if (toInsert.length > 0) {
      // Insert in batches of 500
      for (let i = 0; i < toInsert.length; i += 500) {
        const batch = toInsert.slice(i, i + 500);
        const { error: insertErr } = await supabase
          .from("oferta_ativa_leads")
          .insert(batch);
        if (insertErr) {
          console.error("Insert batch error:", insertErr);
        } else {
          inserted += batch.length;
        }
      }
    }

    // 6. Archive leads from pipeline_leads (set arquivado = true)
    const leadIds = leads.map((l: any) => l.id);
    for (let i = 0; i < leadIds.length; i += 500) {
      const batch = leadIds.slice(i, i + 500);
      const { error: archErr } = await supabase
        .from("pipeline_leads")
        .update({ arquivado: true })
        .in("id", batch);
      if (archErr) console.error("Archive batch error:", archErr);
    }

    // 7. Update total_leads count
    const { count } = await supabase
      .from("oferta_ativa_leads")
      .select("id", { count: "exact", head: true })
      .eq("lista_id", lista.id);

    await supabase
      .from("oferta_ativa_listas")
      .update({ total_leads: count || 0 })
      .eq("id", lista.id);

    const skipped = leads.length - inserted;
    return new Response(
      JSON.stringify({
        message: `Sweep concluído: ${inserted} leads movidos para Oferta Ativa, ${skipped} duplicados ignorados, ${leads.length} arquivados do pipeline.`,
        moved: inserted,
        deleted: leads.length,
        skipped,
        lista_id: lista.id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Sweep error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
