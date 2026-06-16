import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const DESCARTE_STAGE_FALLBACK = "1dd66c25-3848-4053-9f66-82e902989b4d";

/** Remove acentos, caixa e espaços extras → chave de comparação. */
function key(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

const MESES = [
  "JANEIRO", "FEVEREIRO", "MARCO", "ABRIL", "MAIO", "JUNHO",
  "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO",
];

/** Um segmento é "lixo" de data/campanha quando é ano, mês, mês+ano, ou apelido de origem. */
function isJunkSegment(seg: string): boolean {
  const k = key(seg);
  if (/^20\d\d$/.test(k)) return true;                 // 2026
  if (/^(20\d\d\/\d{1,2}|\d{1,2}\/20\d\d)$/.test(k)) return true;
  if (MESES.includes(k)) return true;                   // Junho
  if (MESES.some((m) => k === `${m} 20${k.slice(-2)}` || new RegExp(`^${m} 20\\d\\d$`).test(k))) return true; // Junho 2026
  if (k === "UHOME" || k === "CRM" || k === "CAMPANHA") return true;
  return false;
}

/** Apelidos → nome canônico do produto. Chaves já normalizadas por key(). */
const ALIASES: Record<string, string> = {
  "CASA TUA": "Casa Tua",
  "ATRIO": "Átrio - ABF",
  "ATRIO - ABF": "Átrio - ABF",
  "ALTO LINDOIA": "Alto Lindóia",
  "OPEN BOSQUE": "Open Bosque",
  "ISLA": "Isla",
  "ORYGEM": "Orygem",
  "LAKE EYRE": "Lake Eyre",
  "SHIFT": "Shift - Vanguard",
  "SHIFT - VANGUARD": "Shift - Vanguard",
  "TERRACE": "Terrace",
  "SQUARE GARDEN": "Square Garden",
  "CONNECT JW": "Connect JW",
  "LAS CASAS": "Las Casas",
  "VERTICE - LAS CASAS": "Vértice - Las Casas",
  "VERTICE LAS CASAS": "Vértice - Las Casas",
  "AVULSO - IMOVELWEB": "Avulso - ImovelWeb",
  "AVULSO IMOVELWEB": "Avulso - ImovelWeb",
  "GO MOINHOS": "Go Moinhos",
  "HIGH GARDEN IGUATEMI": "High Garden Iguatemi",
  "SKYLINE MENINO DEUS": "Skyline Menino Deus",
  "VISTA MENINO DEUS": "Vista Menino Deus",
  "VISTA PRAIA DE BELAS": "Vista Praia de Belas",
  "MELNICK DAY": "Melnick Day",
};

/** Normaliza o empreendimento bruto para o produto canônico. */
function normalizeProduto(raw: string | null | undefined): string {
  if (!raw) return "Sem empreendimento";
  let s = String(raw).trim();
  if (!s) return "Sem empreendimento";

  // Remove sufixos de data/campanha do fim ("Casa Tua - Junho 2026", "Terrace - 2026", "Casa Tua - Uhome")
  let segs = s.split(/\s*-\s*/).filter(Boolean);
  while (segs.length > 1 && isJunkSegment(segs[segs.length - 1])) segs.pop();
  s = segs.join(" - ").trim();
  if (!s) return "Sem empreendimento";

  const alias = ALIASES[key(s)];
  return alias || s;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // 1. Etapa de Descarte
    const { data: descarteStage } = await supabase
      .from("pipeline_stages")
      .select("id")
      .eq("tipo", "descarte")
      .maybeSingle();
    const descarteStageId = descarteStage?.id || DESCARTE_STAGE_FALLBACK;

    // 2. Leads em Descarte, não arquivados, reengajáveis OU sem tipo definido (lote de saída de corretor)
    const { data: leads, error: fetchErr } = await supabase
      .from("pipeline_leads")
      .select("id, nome, telefone, telefone2, email, empreendimento, observacoes, corretor_id, motivo_descarte, campanha, telefone_normalizado")
      .eq("stage_id", descarteStageId)
      .eq("arquivado", false)
      .or("tipo_descarte.eq.reengajavel,tipo_descarte.is.null");

    if (fetchErr) throw fetchErr;
    if (!leads || leads.length === 0) {
      return new Response(
        JSON.stringify({ message: "Nenhum lead descartado para rotear", moved: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Carrega todas as listas existentes p/ reuso por produto normalizado
    const { data: allListas } = await supabase
      .from("oferta_ativa_listas")
      .select("id, nome, empreendimento, status, total_leads");

    // Mapa produtoKey → melhor lista candidata
    const listaPorProduto = new Map<string, any>();
    for (const l of allListas || []) {
      const prod = normalizeProduto(l.empreendimento || l.nome?.replace(/\s*-\s*Leads.*$/i, ""));
      const k = key(prod);
      const cur = listaPorProduto.get(k);
      const isCanonical = /Leads N[ãa]o Aproveitados/i.test(l.nome || "");
      if (!cur) {
        listaPorProduto.set(k, l);
      } else {
        const curCanonical = /Leads N[ãa]o Aproveitados/i.test(cur.nome || "");
        // Prefere nome canônico; depois maior volume
        if ((isCanonical && !curCanonical) ||
            (isCanonical === curCanonical && (l.total_leads || 0) > (cur.total_leads || 0))) {
          listaPorProduto.set(k, l);
        }
      }
    }

    // 4. Agrupa leads por produto canônico
    const grupos = new Map<string, any[]>();
    for (const lead of leads) {
      const prod = normalizeProduto(lead.empreendimento);
      if (!grupos.has(prod)) grupos.set(prod, []);
      grupos.get(prod)!.push(lead);
    }

    const resumo: Record<string, { lista_id: string; inseridos: number; duplicados: number; arquivados: number }> = {};
    let totalInseridos = 0;
    let totalArquivados = 0;

    for (const [produto, grupoLeads] of grupos) {
      const k = key(produto);
      let lista = listaPorProduto.get(k);

      // Resolve/cria lista canônica do produto
      if (!lista) {
        const nomeLista = `${produto} - Leads Não Aproveitados`;
        const { data: nova, error: createErr } = await supabase
          .from("oferta_ativa_listas")
          .insert({
            nome: nomeLista,
            empreendimento: produto,
            campanha: "Descartados Pipeline",
            origem: "sistema",
            status: "ativa",
            max_tentativas: 5,
            cooldown_dias: 7,
            total_leads: 0,
            criado_por: "00000000-0000-0000-0000-000000000000",
          })
          .select("id, nome, empreendimento, status, total_leads")
          .single();
        if (createErr) { console.error("Criar lista falhou:", produto, createErr); continue; }
        lista = nova;
        listaPorProduto.set(k, lista);
      } else if (lista.status === "arquivada") {
        // Reativa lista arquivada do produto
        await supabase.from("oferta_ativa_listas").update({ status: "ativa" }).eq("id", lista.id);
      }

      // Dedup por telefone dentro da lista
      const { data: existingOA } = await supabase
        .from("oferta_ativa_leads")
        .select("telefone, telefone_normalizado")
        .eq("lista_id", lista.id);
      const existingPhones = new Set(
        (existingOA || []).flatMap((e: any) => [e.telefone, e.telefone_normalizado].filter(Boolean))
      );

      const seen = new Set<string>();
      const toInsert = grupoLeads.filter((l: any) => {
        const phone = l.telefone_normalizado || l.telefone;
        if (!phone) return false;
        if (existingPhones.has(phone) || seen.has(phone)) return false;
        seen.add(phone);
        return true;
      }).map((l: any) => ({
        lista_id: lista.id,
        nome: l.nome || "Sem nome",
        telefone: l.telefone || "",
        telefone2: l.telefone2 || null,
        email: l.email || "",
        empreendimento: produto,
        status: "na_fila",
        observacoes: l.observacoes || null,
        motivo_descarte: l.motivo_descarte || null,
        corretor_id: l.corretor_id || null,
        campanha: l.campanha || null,
        telefone_normalizado: l.telefone_normalizado || null,
      }));

      let inserted = 0;
      for (let i = 0; i < toInsert.length; i += 500) {
        const batch = toInsert.slice(i, i + 500);
        const { error: insErr } = await supabase.from("oferta_ativa_leads").insert(batch);
        if (insErr) console.error("Insert lote falhou:", produto, insErr);
        else inserted += batch.length;
      }

      // Arquiva do pipeline todo o grupo (roteado de forma permanente)
      const ids = grupoLeads.map((l: any) => l.id);
      for (let i = 0; i < ids.length; i += 500) {
        const batch = ids.slice(i, i + 500);
        const { error: archErr } = await supabase
          .from("pipeline_leads")
          .update({ arquivado: true })
          .in("id", batch);
        if (archErr) console.error("Arquivar lote falhou:", produto, archErr);
      }

      // Recalcula total da lista
      const { count } = await supabase
        .from("oferta_ativa_leads")
        .select("id", { count: "exact", head: true })
        .eq("lista_id", lista.id);
      await supabase.from("oferta_ativa_listas").update({ total_leads: count || 0 }).eq("id", lista.id);

      resumo[produto] = {
        lista_id: lista.id,
        inseridos: inserted,
        duplicados: grupoLeads.length - inserted,
        arquivados: ids.length,
      };
      totalInseridos += inserted;
      totalArquivados += ids.length;
    }

    return new Response(
      JSON.stringify({
        message: `Sweep concluído: ${totalInseridos} leads roteados às listas de produto, ${totalArquivados} arquivados do pipeline.`,
        moved: totalInseridos,
        archived: totalArquivados,
        produtos: resumo,
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
