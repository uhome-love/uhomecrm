/**
 * homi-reindex — ingestão em lote de TODO o acervo Uhome no cérebro do HOMI.
 *
 * Fontes: documentos/método, materiais do Hub, aulas da Academia, scripts do time,
 * empreendimentos canônicos (+ fichas) e imóveis ativos do CRM.
 *
 * Cada fonte vira um homi_documents (source_type + source_id) e seus chunks
 * com embedding via Lovable AI Gateway.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { embedTexts, type HomiSourceType } from "../_shared/homi-brain.ts";

interface SourceDoc {
  source_type: HomiSourceType;
  source_id: string;
  title: string;
  category: string;
  content: string;
  source_url?: string | null;
  empreendimento?: string | null;
  priority?: number;
}

const CHUNK_SIZE = 900;
const OVERLAP = 120;

function chunkText(text: string): string[] {
  const clean = text.replace(/\s+\n/g, "\n").replace(/[ \t]{2,}/g, " ").trim();
  if (clean.length <= CHUNK_SIZE) return clean.length > 40 ? [clean] : [];
  const chunks: string[] = [];
  for (let i = 0; i < clean.length; i += CHUNK_SIZE - OVERLAP) {
    const c = clean.slice(i, i + CHUNK_SIZE).trim();
    if (c.length > 40) chunks.push(c);
  }
  return chunks;
}

function money(v: number | null | undefined): string {
  if (!v) return "";
  return `R$ ${Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
}

async function collectMateriais(sb: any): Promise<SourceDoc[]> {
  const { data } = await sb
    .from("materiais_links")
    .select("id, titulo, descricao, categoria, url, resumo_ia, tags, empreendimento_id, empreendimentos_canonicos(nome)")
    .limit(1000);
  return (data ?? []).map((m: any) => ({
    source_type: "material" as const,
    source_id: m.id,
    title: m.titulo ?? "Material",
    category: m.categoria ?? "material",
    empreendimento: m.empreendimentos_canonicos?.nome ?? null,
    source_url: m.url ?? null,
    priority: 4,
    content: [
      `Material do Hub: ${m.titulo ?? ""}`,
      m.empreendimentos_canonicos?.nome ? `Empreendimento: ${m.empreendimentos_canonicos.nome}` : "",
      m.categoria ? `Categoria: ${m.categoria}` : "",
      m.descricao ?? "",
      m.resumo_ia ?? "",
      Array.isArray(m.tags) && m.tags.length ? `Tags: ${m.tags.join(", ")}` : "",
      m.url ? `Link: ${m.url}` : "",
    ].filter(Boolean).join("\n"),
  }));
}

async function collectAcademia(sb: any): Promise<SourceDoc[]> {
  const { data } = await sb
    .from("academia_aulas")
    .select("id, titulo, descricao, tipo, conteudo, duracao_minutos, academia_trilhas(titulo, descricao, categoria)")
    .limit(1000);
  return (data ?? []).map((a: any) => {
    const conteudoTexto = typeof a.conteudo === "string"
      ? a.conteudo
      : a.conteudo
        ? JSON.stringify(a.conteudo).slice(0, 6000)
        : "";
    return {
      source_type: "academia" as const,
      source_id: a.id,
      title: `Academia — ${a.titulo ?? "Aula"}`,
      category: a.academia_trilhas?.categoria ?? "academia",
      source_url: null,
      priority: 6,
      content: [
        `Aula da Academia Uhome: ${a.titulo ?? ""}`,
        a.academia_trilhas?.titulo ? `Módulo: ${a.academia_trilhas.titulo}` : "",
        a.academia_trilhas?.descricao ?? "",
        a.descricao ?? "",
        conteudoTexto,
      ].filter(Boolean).join("\n"),
    };
  });
}

async function collectScripts(sb: any): Promise<SourceDoc[]> {
  const { data } = await sb
    .from("team_scripts")
    .select("id, titulo, empreendimento, campanha, script_ligacao, script_whatsapp, script_email, ativo")
    .eq("ativo", true)
    .limit(500);
  return (data ?? []).map((s: any) => ({
    source_type: "script" as const,
    source_id: s.id,
    title: `Script — ${s.titulo ?? s.empreendimento ?? "Time"}`,
    category: "script",
    empreendimento: s.empreendimento ?? null,
    priority: 5,
    content: [
      `Script oficial do time${s.empreendimento ? ` (${s.empreendimento})` : ""}${s.campanha ? ` — campanha ${s.campanha}` : ""}`,
      s.script_ligacao ? `LIGAÇÃO:\n${s.script_ligacao}` : "",
      s.script_whatsapp ? `WHATSAPP:\n${s.script_whatsapp}` : "",
      s.script_email ? `E-MAIL:\n${s.script_email}` : "",
    ].filter(Boolean).join("\n\n"),
  }));
}

async function collectEmpreendimentos(sb: any): Promise<SourceDoc[]> {
  const [{ data: canon }, { data: fichas }] = await Promise.all([
    sb.from("empreendimentos_canonicos").select("id, nome, ativo").limit(500),
    sb.from("empreendimento_fichas").select("empreendimento, entrada, metragens, entrega, desconto, localizacao, notas").limit(500),
  ]);
  const fichaByNome = new Map<string, any>();
  for (const f of fichas ?? []) fichaByNome.set((f.empreendimento ?? "").toLowerCase(), f);

  return (canon ?? []).map((e: any) => {
    const f = fichaByNome.get((e.nome ?? "").toLowerCase());
    return {
      source_type: "empreendimento" as const,
      source_id: e.id,
      title: `Empreendimento — ${e.nome}`,
      category: "empreendimento",
      empreendimento: e.nome,
      priority: 7,
      content: [
        `Empreendimento canônico da Uhome: ${e.nome}${e.ativo ? " (ativo)" : " (inativo)"}`,
        f?.localizacao ? `Localização: ${f.localizacao}` : "",
        f?.metragens ? `Metragens/tipologias: ${f.metragens}` : "",
        f?.entrada ? `Entrada/condições: ${f.entrada}` : "",
        f?.desconto ? `Desconto/condição comercial: ${f.desconto}` : "",
        f?.entrega ? `Entrega: ${f.entrega}` : "",
        f?.notas ? `Notas internas: ${f.notas}` : "",
      ].filter(Boolean).join("\n"),
    };
  });
}

async function collectImoveis(sb: any): Promise<SourceDoc[]> {
  const { data } = await sb
    .from("properties")
    .select("id, codigo, titulo, tipo, bairro, cidade, dormitorios, suites, vagas, area_privativa, valor_venda, empreendimento, construtora, estoque_status, entrega_ano, descricao, is_mcmv, aceita_financiamento")
    .eq("ativo", true)
    .limit(1000);
  return (data ?? []).map((p: any) => ({
    source_type: "imovel" as const,
    source_id: p.id,
    title: `Imóvel ${p.codigo ?? ""} — ${p.titulo ?? p.empreendimento ?? "CRM"}`.trim(),
    category: "imovel",
    empreendimento: p.empreendimento ?? null,
    priority: 3,
    content: [
      `Imóvel do CRM${p.codigo ? ` (código ${p.codigo})` : ""}: ${p.titulo ?? ""}`,
      p.empreendimento ? `Empreendimento: ${p.empreendimento}` : "",
      p.construtora ? `Construtora: ${p.construtora}` : "",
      [p.tipo, p.bairro, p.cidade].filter(Boolean).join(" · "),
      [
        p.dormitorios ? `${p.dormitorios} dorm` : "",
        p.suites ? `${p.suites} suíte(s)` : "",
        p.vagas ? `${p.vagas} vaga(s)` : "",
        p.area_privativa ? `${p.area_privativa} m²` : "",
      ].filter(Boolean).join(" · "),
      p.valor_venda ? `Valor de venda: ${money(p.valor_venda)}` : "",
      p.entrega_ano ? `Entrega: ${p.entrega_ano}` : "",
      p.estoque_status ? `Estoque: ${p.estoque_status}` : "",
      p.is_mcmv ? "Enquadra Minha Casa Minha Vida" : "",
      p.aceita_financiamento ? "Aceita financiamento" : "",
      (p.descricao ?? "").slice(0, 1200),
    ].filter(Boolean).join("\n"),
  }));
}

async function indexDoc(sb: any, doc: SourceDoc): Promise<number> {
  const chunks = chunkText(doc.content);
  if (chunks.length === 0) return 0;

  const { data: existing } = await sb
    .from("homi_documents")
    .select("id")
    .eq("source_type", doc.source_type)
    .eq("source_id", doc.source_id)
    .maybeSingle();

  let docId = existing?.id as string | undefined;
  const payload = {
    title: doc.title,
    category: doc.category,
    empreendimento: doc.empreendimento ?? null,
    content: doc.content,
    source_type: doc.source_type,
    source_id: doc.source_id,
    source_url: doc.source_url ?? null,
    priority: doc.priority ?? 0,
    status: "processing",
    updated_at: new Date().toISOString(),
  };

  if (docId) {
    await sb.from("homi_documents").update(payload).eq("id", docId);
    await sb.from("homi_chunks").delete().eq("document_id", docId);
  } else {
    const { data: created, error } = await sb.from("homi_documents").insert(payload).select("id").single();
    if (error) throw new Error(`insert doc: ${error.message}`);
    docId = created.id;
  }

  const embeddings = await embedTexts(chunks);
  const rows = chunks.map((c, i) => ({
    document_id: docId,
    content: c,
    embedding: embeddings[i],
    metadata: {
      title: doc.title,
      category: doc.category,
      source_type: doc.source_type,
      source_url: doc.source_url ?? null,
      empreendimento: doc.empreendimento ?? null,
      chunk_index: i,
    },
  }));

  const { error: insErr } = await sb.from("homi_chunks").insert(rows);
  if (insErr) throw new Error(`insert chunks: ${insErr.message}`);

  await sb.from("homi_documents").update({ status: "indexed", chunk_count: rows.length }).eq("id", docId);
  return rows.length;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    // ── Auth: admin/gestor via JWT, ou CRON_SECRET ──
    const cronSecret = Deno.env.get("CRON_SECRET");
    const headerSecret = req.headers.get("x-cron-secret");
    let authorized = Boolean(cronSecret && headerSecret && headerSecret === cronSecret);

    if (!authorized) {
      const authHeader = req.headers.get("Authorization") ?? "";
      if (!authHeader.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await userClient.auth.getUser();
      if (!user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: roles } = await sb.from("user_roles").select("role").eq("user_id", user.id);
      authorized = (roles ?? []).some((r: any) => ["admin", "gestor", "diretor"].includes(r.role));
      if (!authorized) {
        return new Response(JSON.stringify({ error: "Acesso restrito a admin/gestor" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const requested: string[] = body.sources ?? ["material", "academia", "script", "empreendimento", "imovel"];
    const limitPerSource: number = body.limit ?? 400;

    const collectors: Record<string, (sb: any) => Promise<SourceDoc[]>> = {
      material: collectMateriais,
      academia: collectAcademia,
      script: collectScripts,
      empreendimento: collectEmpreendimentos,
      imovel: collectImoveis,
    };

    const report: Record<string, { docs: number; chunks: number; erros: number }> = {};

    for (const src of requested) {
      const collector = collectors[src];
      if (!collector) continue;
      const docs = (await collector(sb)).slice(0, limitPerSource);
      let chunks = 0;
      let erros = 0;
      for (const doc of docs) {
        try {
          chunks += await indexDoc(sb, doc);
        } catch (e) {
          erros++;
          console.error(`[homi-reindex] ${src}/${doc.source_id}:`, e);
        }
      }
      report[src] = { docs: docs.length, chunks, erros };
      console.log(`[homi-reindex] ${src}: ${docs.length} docs, ${chunks} chunks, ${erros} erros`);
    }

    return new Response(JSON.stringify({ success: true, report }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[homi-reindex] erro:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
