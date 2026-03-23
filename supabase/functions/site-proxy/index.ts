/**
 * site-proxy — Proxies property queries to the Site Uhome's Supabase.
 *
 * Actions:
 *   - list: fetch paginated property listings
 *   - pins: fetch map pin data via get_map_pins RPC
 *   - bairros: fetch available neighborhoods via get_bairros_disponiveis RPC
 *   - count: fetch count via count_imoveis RPC
 *   - detail: fetch single property by slug
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders, handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";

const SITE_URL = Deno.env.get("UHOMESITE_URL")!;
const SITE_KEY = Deno.env.get("UHOMESITE_SERVICE_KEY")!;

function getSiteClient() {
  if (!SITE_URL || !SITE_KEY) throw new Error("UHOMESITE_URL or UHOMESITE_SERVICE_KEY not configured");
  return createClient(SITE_URL, SITE_KEY);
}

const CIDADES_PERMITIDAS = ["Porto Alegre", "Canoas", "Cachoeirinha", "Gravataí", "Guaíba"];
const LISTING_COLUMNS = "id,slug,tipo,finalidade,status,destaque,preco,preco_condominio,area_total,quartos,banheiros,vagas,bairro,cidade,uf,publicado_em,foto_principal,condominio_nome";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleCors();

  try {
    const { action, ...params } = await req.json();
    const site = getSiteClient();

    switch (action) {
      case "list": {
        const { tipo, bairro, bairros, cidade, precoMin, precoMax, areaMin, areaMax,
                quartos, banheiros, vagas, q, ordem, limit = 24, offset = 0, bounds } = params;

        let query = site.from("imoveis").select(LISTING_COLUMNS)
          .eq("status", "disponivel").eq("finalidade", "venda");

        if (cidade) query = query.eq("cidade", cidade);
        else query = query.in("cidade", CIDADES_PERMITIDAS);

        if (tipo) {
          const tipos = tipo.split(",").map((s: string) => s.trim()).filter(Boolean);
          if (tipos.length === 1) query = query.eq("tipo", tipos[0]);
          else if (tipos.length > 1) query = query.in("tipo", tipos);
        }
        if (bairros?.length) {
          query = query.or(bairros.map((b: string) => `bairro.ilike.%${b}%`).join(","));
        } else if (bairro) {
          query = query.ilike("bairro", `%${bairro}%`);
        }
        if (precoMin) query = query.gte("preco", precoMin);
        if (precoMax) query = query.lte("preco", precoMax);
        if (areaMin) query = query.gte("area_total", areaMin);
        if (areaMax) query = query.lte("area_total", areaMax);
        if (quartos) query = query.gte("quartos", quartos);
        if (banheiros) query = query.gte("banheiros", banheiros);
        if (vagas) query = query.gte("vagas", vagas);
        if (q) query = query.or(`bairro.ilike.%${q}%,tipo.ilike.%${q}%,condominio_nome.ilike.%${q}%`);
        if (bounds) {
          query = query.gte("latitude", bounds.lat_min).lte("latitude", bounds.lat_max)
                       .gte("longitude", bounds.lng_min).lte("longitude", bounds.lng_max);
        }

        const orderMap: Record<string, { column: string; ascending: boolean }> = {
          recentes: { column: "publicado_em", ascending: false },
          preco_asc: { column: "preco", ascending: true },
          preco_desc: { column: "preco", ascending: false },
          area_desc: { column: "area_total", ascending: false },
        };
        const ord = orderMap[ordem ?? "recentes"] ?? orderMap.recentes;
        query = query.order(ord.column, { ascending: ord.ascending });
        query = query.range(offset, offset + limit - 1);

        // Count in parallel (skip if paginating)
        const skipCount = offset > 0;
        const countParams: Record<string, unknown> = {};
        if (cidade) countParams.p_cidade = cidade;
        else countParams.p_cidades = CIDADES_PERMITIDAS;
        if (tipo) {
          const tipos = tipo.split(",").map((s: string) => s.trim()).filter(Boolean);
          if (tipos.length === 1) countParams.p_tipo = tipos[0];
          else if (tipos.length > 1) countParams.p_tipos = tipos;
        }
        if (bairros?.length) countParams.p_bairros = bairros;
        else if (bairro) countParams.p_bairro = bairro;
        if (precoMin) countParams.p_preco_min = precoMin;
        if (precoMax) countParams.p_preco_max = precoMax;
        if (quartos) countParams.p_quartos = quartos;
        if (banheiros) countParams.p_banheiros = banheiros;
        if (vagas) countParams.p_vagas = vagas;
        if (areaMin) countParams.p_area_min = areaMin;
        if (areaMax) countParams.p_area_max = areaMax;
        if (bounds) {
          countParams.lat_min = bounds.lat_min;
          countParams.lat_max = bounds.lat_max;
          countParams.lng_min = bounds.lng_min;
          countParams.lng_max = bounds.lng_max;
        }

        const [dataResult, countResult] = await Promise.all([
          query,
          skipCount ? Promise.resolve({ data: -1 }) : site.rpc("count_imoveis", countParams),
        ]);

        if (dataResult.error) return errorResponse(dataResult.error.message, 400);

        return jsonResponse({
          data: dataResult.data ?? [],
          count: (countResult as any).data ?? 0,
        });
      }

      case "pins": {
        const rpcParams: Record<string, unknown> = { p_limite: params.limit ?? 2000 };
        if (params.cidade) rpcParams.p_cidade = params.cidade;
        else rpcParams.p_cidades = CIDADES_PERMITIDAS;
        if (params.tipo) rpcParams.p_tipo = params.tipo;
        if (params.bairros?.length) rpcParams.p_bairros = params.bairros;
        else if (params.bairro) rpcParams.p_bairro = params.bairro;
        if (params.precoMin) rpcParams.p_preco_min = params.precoMin;
        if (params.precoMax) rpcParams.p_preco_max = params.precoMax;
        if (params.areaMin) rpcParams.p_area_min = params.areaMin;
        if (params.areaMax) rpcParams.p_area_max = params.areaMax;
        if (params.quartos) rpcParams.p_quartos = params.quartos;
        if (params.banheiros) rpcParams.p_banheiros = params.banheiros;
        if (params.vagas) rpcParams.p_vagas = params.vagas;
        if (params.bounds) {
          rpcParams.lat_min = params.bounds.lat_min;
          rpcParams.lat_max = params.bounds.lat_max;
          rpcParams.lng_min = params.bounds.lng_min;
          rpcParams.lng_max = params.bounds.lng_max;
        }

        const { data, error } = await site.rpc("get_map_pins", rpcParams);
        if (error) return errorResponse(error.message, 400);
        return jsonResponse({ data: data ?? [] });
      }

      case "bairros": {
        const { data, error } = await site.rpc("get_bairros_disponiveis");
        if (error) return errorResponse(error.message, 400);
        return jsonResponse({ data: data ?? [] });
      }

      case "detail": {
        const { slug } = params;
        if (!slug) return errorResponse("slug required", 400);
        const { data, error } = await site.from("imoveis").select("*").eq("slug", slug).maybeSingle();
        if (error) return errorResponse(error.message, 400);
        return jsonResponse({ data });
      }

      default:
        return errorResponse(`Unknown action: ${action}`, 400);
    }
  } catch (err) {
    console.error("[site-proxy]", err);
    return errorResponse(err instanceof Error ? err.message : "Internal error", 500);
  }
});
