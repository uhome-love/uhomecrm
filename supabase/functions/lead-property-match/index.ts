import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";

/**
 * lead-property-match
 * 
 * Computes match scores between leads (with property profiles) and
 * the local properties mirror. Can be called:
 * 1. For a specific lead:  POST { lead_id: "..." }
 * 2. For all leads with profiles:  POST { all: true }  (cron mode)
 */

const WEIGHTS = {
  price: 25,
  neighborhood: 20,
  bedrooms: 15,
  type: 10,
  suites: 8,
  parking: 7,
  area: 8,
  financing: 4,
  mandatory: 3,
};

const MIN_SCORE_THRESHOLD = 30; // Only store matches ≥ 30%

serve(async (req) => {
  if (req.method === "OPTIONS") return handleCors();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);

    const body = await req.json().catch(() => ({}));
    const specificLeadId = body.lead_id as string | undefined;
    const isAll = body.all === true;

    // 1. Fetch profiles
    let profileQuery = sb.from("lead_property_profiles").select("*");
    if (specificLeadId) {
      profileQuery = profileQuery.eq("lead_id", specificLeadId);
    }
    const { data: profiles, error: pErr } = await profileQuery;
    if (pErr) return errorResponse(pErr.message);
    if (!profiles || profiles.length === 0) {
      return jsonResponse({ matched: 0, message: "No profiles found" });
    }

    // 2. Fetch properties (active only)
    const { data: properties, error: propErr } = await sb
      .from("properties")
      .select("id, codigo, tipo, bairro, dormitorios, suites, vagas, area_privativa, valor_venda, aceita_financiamento, tags, empreendimento, construtora, fotos, titulo")
      .eq("ativo", true)
      .limit(2000);
    if (propErr) return errorResponse(propErr.message);
    if (!properties || properties.length === 0) {
      return jsonResponse({ matched: 0, message: "No properties in mirror" });
    }

    let totalMatches = 0;

    for (const profile of profiles) {
      const matches: { property_id: string; score: number; breakdown: Record<string, number> }[] = [];

      for (const prop of properties) {
        const breakdown: Record<string, number> = {};
        let score = 0;

        // Price
        if (profile.valor_max && prop.valor_venda) {
          const v = Number(prop.valor_venda);
          const min = Number(profile.valor_min || 0);
          const max = Number(profile.valor_max);
          const ideal = Number(profile.valor_ideal || (min + max) / 2);
          if (v >= min * 0.9 && v <= max * 1.1) {
            const dist = Math.abs(v - ideal) / (max - min || 1);
            breakdown.price = Math.round(WEIGHTS.price * Math.max(0, 1 - dist));
          }
        }

        // Neighborhood
        if (profile.bairros?.length && prop.bairro) {
          const normalized = prop.bairro.toLowerCase().trim();
          if (profile.bairros.some((b: string) => b.toLowerCase().trim() === normalized)) {
            breakdown.neighborhood = WEIGHTS.neighborhood;
          }
        }

        // Bedrooms (±1 tolerance)
        if (profile.dormitorios_min != null && prop.dormitorios != null) {
          const diff = prop.dormitorios - profile.dormitorios_min;
          if (diff >= 0) breakdown.bedrooms = WEIGHTS.bedrooms;
          else if (diff === -1) breakdown.bedrooms = Math.round(WEIGHTS.bedrooms * 0.5);
        }

        // Type
        if (profile.tipos?.length && prop.tipo) {
          const normalized = prop.tipo.toLowerCase().trim();
          if (profile.tipos.some((t: string) => t.toLowerCase().trim() === normalized)) {
            breakdown.type = WEIGHTS.type;
          }
        }

        // Suites
        if (profile.suites_min != null && prop.suites != null) {
          if (prop.suites >= profile.suites_min) breakdown.suites = WEIGHTS.suites;
        }

        // Parking
        if (profile.vagas_min != null && prop.vagas != null) {
          if (prop.vagas >= profile.vagas_min) breakdown.parking = WEIGHTS.parking;
        }

        // Area
        if (profile.area_min != null && prop.area_privativa != null) {
          const area = Number(prop.area_privativa);
          const aMin = Number(profile.area_min);
          const aMax = Number(profile.area_max || aMin * 1.5);
          if (area >= aMin * 0.9 && area <= aMax * 1.1) {
            breakdown.area = WEIGHTS.area;
          }
        }

        // Financing
        if (profile.aceita_financiamento && prop.aceita_financiamento) {
          breakdown.financing = WEIGHTS.financing;
        }

        score = Object.values(breakdown).reduce((a, b) => a + b, 0);

        if (score >= MIN_SCORE_THRESHOLD) {
          matches.push({ property_id: prop.id, score, breakdown });
        }
      }

      // Sort and keep top 50
      matches.sort((a, b) => b.score - a.score);
      const top = matches.slice(0, 50);

      if (top.length > 0) {
        // Delete old matches for this lead, then insert new ones
        await sb.from("lead_property_matches").delete().eq("lead_id", profile.lead_id);

        const rows = top.map(m => ({
          lead_id: profile.lead_id,
          property_id: m.property_id,
          score: m.score,
          score_breakdown: m.breakdown,
          status: "novo",
          notified: false,
        }));

        await sb.from("lead_property_matches").insert(rows);
        totalMatches += top.length;
      }
    }

    return jsonResponse({
      matched: totalMatches,
      profiles_processed: profiles.length,
      properties_evaluated: properties.length,
    });
  } catch (err: any) {
    return errorResponse(err.message || "Internal error");
  }
});
