/**
 * lia-recupera-simular — SÓ LEITURA. Monta, sem enviar nada, a mensagem final dos 6 modelos
 * da Lia Recupera para clientes reais da base recuperável, usando as mesmas regras do envio
 * (_shared/liaRecuperaModelos.ts). Acesso: admin ou diretor.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  escolherModelo, imovelLembrete, paramsModelo, textoFinal, converterEmpreendimento, recuperaVigente, hojeBRT,
  type Alias, type Canonico, type ModeloKey, type CaminhoLembrete,
} from "../_shared/liaRecuperaModelos.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

const SISTEMA = "00000000-0000-0000-0000-000000000000";
/** Ação humana do corretor/equipe. Fora: entrada, sistema, nurturing, mudança de etapa, descarte, tarefas, notas, campanhas, alertas. */
const TIPOS_HUMANOS = ["whatsapp", "ligacao", "contato", "nao_atendeu", "visita", "presencial", "mensagem", "followup", "envio_material", "proposta"];
const NUNCA = new Set(["definitivo", "nao_quer_contato", "ja_comprou", "telefone_invalido"]);
const ESPERA_90 = new Set(["sem_condicao_financeira", "desistiu_compra"]);

async function todas<T>(fn: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; ; i += 1000) {
    const { data, error } = await fn(i, i + 999);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) return out;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "sem login" }, 401);
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: u } = await sb.auth.getUser(token);
    if (!u?.user) return json({ error: "sem login" }, 401);
    const { data: roles } = await sb.from("user_roles").select("role").eq("user_id", u.user.id);
    if (!(roles ?? []).some((r: { role: string }) => r.role === "admin" || r.role === "diretor")) return json({ error: "sem acesso" }, 403);

    type Eleg = { pipeline_lead_id: string; nome: string | null; empreendimento: string | null; balde: string; stage_changed_at: string | null };
    const [eleg, canon, als] = await Promise.all([
      todas<Eleg>((a, b) => sb.from("lia_reengajamento_elegiveis").select("pipeline_lead_id, nome, empreendimento, balde, stage_changed_at").range(a, b)),
      todas<Canonico>((a, b) => sb.from("empreendimentos_canonicos").select("id, nome").range(a, b)),
      todas<Alias>((a, b) => sb.from("empreendimento_aliases").select("alias_norm, empreendimento_id").range(a, b)),
    ]);

    const limite90 = Date.now() - 90 * 86400000;
    const base = eleg.filter((e) => !NUNCA.has(e.balde) && (!ESPERA_90.has(e.balde) || (e.stage_changed_at && Date.parse(e.stage_changed_at) <= limite90)));
    const ids = base.map((e) => e.pipeline_lead_id);

    // corretor e produto atual do lead
    const leadInfo = new Map<string, { corretor_id: string | null; empreendimento: string | null }>();
    const contato = new Map<string, string[]>(); // datas de ação humana
    for (let i = 0; i < ids.length; i += 300) {
      const lote = ids.slice(i, i + 300);
      const [{ data: ls }, at] = await Promise.all([
        sb.from("pipeline_leads").select("id, corretor_id, empreendimento").in("id", lote),
        todas<{ pipeline_lead_id: string; created_at: string }>((a, b) => sb.from("pipeline_atividades").select("pipeline_lead_id, created_at")
          .in("pipeline_lead_id", lote).in("tipo", TIPOS_HUMANOS).not("created_by", "is", null).neq("created_by", SISTEMA).range(a, b)),
      ]);
      for (const l of ls ?? []) leadInfo.set(l.id, { corretor_id: l.corretor_id, empreendimento: l.empreendimento });
      for (const a of at) { const arr = contato.get(a.pipeline_lead_id) ?? []; arr.push(a.created_at); contato.set(a.pipeline_lead_id, arr); }
    }
    const corretores = [...new Set([...leadInfo.values()].map((l) => l.corretor_id).filter(Boolean))] as string[];
    const ativos = new Set<string>();
    for (let i = 0; i < corretores.length; i += 300) {
      const { data } = await sb.from("profiles").select("user_id, ativo").in("user_id", corretores.slice(i, i + 300));
      for (const p of data ?? []) if (p.ativo !== false) ativos.add(p.user_id);
    }

    const totais = { A: 0, B: 0, C: 0, D: 0, sem_nome: 0 };
    const caminhos: Record<CaminhoLembrete, number> = { proprio: 0, tabela: 0, open_bosque: 0 };
    const naoConverteu = new Map<string, number>();
    const exemplos: Record<ModeloKey, unknown[]> = { lia_recupera_a: [], lia_recupera_b: [], lia_recupera_c: [], lia_recupera_d: [], lia_recupera_lembrete: [], lia_recupera_final: [] };

    for (const e of base) {
      const info = leadInfo.get(e.pipeline_lead_id);
      const empRaw = e.empreendimento ?? info?.empreendimento ?? null;
      const limiteData = e.stage_changed_at ?? new Date().toISOString();
      const teveContato = (contato.get(e.pipeline_lead_id) ?? []).some((d) => d <= limiteData);
      const corretorInativo = !!info?.corretor_id && !ativos.has(info.corretor_id);
      const esc = escolherModelo({ nome: e.nome, balde: e.balde, empreendimentoRaw: empRaw, teveContatoHumano: teveContato, corretorInativo }, canon, als);
      if (!esc.ok) { totais.sem_nome++; continue; }
      totais[esc.base]++;
      const conv = converterEmpreendimento(empRaw, canon, als); // memoizado pelo índice
      if (!esc.empreendimento && empRaw && empRaw.trim()) { const k = empRaw.trim(); naoConverteu.set(k, (naoConverteu.get(k) ?? 0) + 1); }
      const lem = imovelLembrete(conv.nome ? conv.canonico : null);
      caminhos[lem.caminho]++;

      const ctx = { motivo_descarte: e.balde, empreendimento_original: empRaw, empreendimento_convertido: esc.empreendimento, porque: esc.motivo };
      const lista = exemplos[esc.modelo];
      if (lista.length < 5) {
        const p = paramsModelo(esc.modelo, { nome: esc.nome, empreendimento: esc.empreendimento });
        lista.push({ ...ctx, modelo: esc.modelo, params: p, texto: textoFinal(esc.modelo, p) });
      }
      if (exemplos.lia_recupera_lembrete.length < 5 && (exemplos.lia_recupera_lembrete as { caminho: string }[]).filter((x) => x.caminho === lem.caminho).length < 2) {
        const p = paramsModelo("lia_recupera_lembrete", { nome: esc.nome, imovel: lem.imovel, oferta: lem.oferta });
        exemplos.lia_recupera_lembrete.push({ ...ctx, modelo: "lia_recupera_lembrete", caminho: lem.caminho, imovel_lembrete: lem.imovel, params: p, texto: textoFinal("lia_recupera_lembrete", p) });
      }
      if (exemplos.lia_recupera_final.length < 5) {
        const p = paramsModelo("lia_recupera_final", { nome: esc.nome });
        exemplos.lia_recupera_final.push({ ...ctx, modelo: "lia_recupera_final", params: p, texto: textoFinal("lia_recupera_final", p) });
      }
    }

    return json({
      ok: true, gerado_em: new Date().toISOString(), vigente: recuperaVigente(hojeBRT()), base_total: base.length,
      totais, caminhos_lembrete: caminhos,
      nao_converteu: [...naoConverteu.entries()].sort((a, b) => b[1] - a[1]).map(([nome, n]) => ({ nome, n })),
      exemplos,
    });
  } catch (e) {
    console.error("[lia-recupera-simular]", e);
    return json({ ok: false, error: String(e) }, 500);
  }
});
