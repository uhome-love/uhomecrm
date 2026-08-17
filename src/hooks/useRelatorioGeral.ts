import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { leadSaude } from "@/lib/leadSaude";

/**
 * useRelatorioGeral — o "Raio-X do Time": o caminho completo do corretor
 * (lead → venda) numa linha só, agrupado por time. Dados REAIS, escopo por RLS
 * (gerente vê seu time; diretora/CEO veem todos). Só leitura.
 *
 * Semântica VALIDADA no banco (time do Bruno Schuler, ago/2026):
 *  leads recebidos = distribuido_em no período · pipeline ativo = ativo+sem negócio+não-terminal
 *  descartes = etapa descarte recebidos no período · estagnados = leadSaude (régua única)
 *  visitas = tabela visitas (≠cancelada) por data_visita · negócios/vendas = negocios.auth_user_id
 */

const TERMINAIS = new Set(["venda", "caiu", "descarte", "convertido"]);

export interface RaioXCorretor {
  user_id: string;
  nome: string;
  leads_recebidos: number;
  pipeline_ativo: number;
  descartes: number;
  estagnados: number;
  qualif_aquec: number;
  negocios_zona: number;
  visitas_criadas: number;
  visitas_realizadas: number;
  no_show: number;
  negocios_criados: number;
  negocios_ativos: number;
  vendas: number;
}
export interface RaioXTime {
  gerente_id: string;
  gerente_nome: string;
  corretores: RaioXCorretor[];
  total: Omit<RaioXCorretor, "user_id" | "nome">;
}
export interface RelatorioGeral {
  times: RaioXTime[];
  totalGeral: Omit<RaioXCorretor, "user_id" | "nome">;
}

function zeros(): Omit<RaioXCorretor, "user_id" | "nome"> {
  return { leads_recebidos: 0, pipeline_ativo: 0, descartes: 0, estagnados: 0, qualif_aquec: 0, negocios_zona: 0, visitas_criadas: 0, visitas_realizadas: 0, no_show: 0, negocios_criados: 0, negocios_ativos: 0, vendas: 0 };
}
function soma(a: Omit<RaioXCorretor, "user_id" | "nome">, b: RaioXCorretor) {
  a.leads_recebidos += b.leads_recebidos; a.pipeline_ativo += b.pipeline_ativo; a.descartes += b.descartes;
  a.estagnados += b.estagnados; a.qualif_aquec += b.qualif_aquec; a.negocios_zona += b.negocios_zona;
  a.visitas_criadas += b.visitas_criadas; a.visitas_realizadas += b.visitas_realizadas;
  a.no_show += b.no_show; a.negocios_criados += b.negocios_criados; a.negocios_ativos += b.negocios_ativos; a.vendas += b.vendas;
}

async function fetchAll<T>(builder: (from: number, to: number) => any): Promise<T[]> {
  const out: T[] = [];
  const size = 1000;
  let from = 0;
  for (;;) {
    const { data, error } = await builder(from, from + size - 1);
    if (error) throw error;
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < size) break;
    from += size;
  }
  return out;
}

function mesAtualISO(): { start: string; end: string } {
  const hoje = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }); // YYYY-MM-DD
  const [y, m] = hoje.split("-").map(Number);
  const start = `${y}-${String(m).padStart(2, "0")}-01`;
  const nm = m === 12 ? 1 : m + 1;
  const ny = m === 12 ? y + 1 : y;
  const end = `${ny}-${String(nm).padStart(2, "0")}-01`;
  return { start, end };
}

export function useRelatorioGeral(periodo?: { start: string; end: string }) {
  const { start, end } = periodo ?? mesAtualISO();
  return useQuery({
    queryKey: ["relatorio-geral", start, end],
    staleTime: 60_000,
    queryFn: async (): Promise<RelatorioGeral> => {
      // 1) Escopo (RLS decide o que o usuário enxerga): quem é corretor de qual gerente.
      const { data: tm } = await supabase
        .from("team_members")
        .select("user_id, gerente_id")
        .eq("status", "ativo");
      const roster = (tm ?? []) as { user_id: string; gerente_id: string }[];
      const scopeIds = [...new Set(roster.map((r) => r.user_id))];
      if (scopeIds.length === 0) return { times: [], totalGeral: zeros() };
      const gerenteDe = new Map<string, string>();
      roster.forEach((r) => gerenteDe.set(r.user_id, r.gerente_id));

      // Nomes (corretores + gerentes)
      const nomeIds = [...new Set([...scopeIds, ...roster.map((r) => r.gerente_id)])];
      const { data: perfis } = await supabase.from("profiles").select("user_id, nome").in("user_id", nomeIds);
      const nomeDe = new Map<string, string>();
      (perfis ?? []).forEach((p: { user_id: string; nome: string | null }) => nomeDe.set(p.user_id, p.nome ?? "Corretor"));

      // acumulador por corretor
      const acc = new Map<string, RaioXCorretor>();
      for (const id of scopeIds) acc.set(id, { user_id: id, nome: nomeDe.get(id) ?? "Corretor", ...zeros() });
      const bump = (id: string, k: keyof RaioXCorretor) => { const c = acc.get(id); if (c) (c[k] as number)++; };

      // Etapas (pequeno, define os baldes do histórico).
      const { data: stagesRows } = await supabase.from("pipeline_stages").select("id, tipo");
      const tipoDeStage = new Map<string, string>();
      (stagesRows ?? []).forEach((s: { id: string; tipo: string }) => tipoDeStage.set(s.id, s.tipo));
      const B_DESCARTE = new Set(["descarte"]);
      const B_QUALIF = new Set(["qualificacao", "aquecimento"]);
      const B_ZONA = new Set(["documentacao", "proposta", "contrato_gerado", "venda"]);
      const bucketIds = (stagesRows ?? [])
        .filter((s: { tipo: string }) => B_DESCARTE.has(s.tipo) || B_QUALIF.has(s.tipo) || B_ZONA.has(s.tipo))
        .map((s: { id: string }) => s.id);

      // PERFORMANCE: as 5 buscas grandes correm em PARALELO (antes eram em fila → somava segundos).
      const [ativos, recebidos, histRaw, visitas, negocios] = await Promise.all([
        fetchAll<any>((f, t) => supabase.from("pipeline_leads")
          .select("corretor_id, ultimo_toque_at, distribuido_em, aceito_em, created_at, estagnacao_carencia_ate, pipeline_stages!inner(tipo)")
          .in("corretor_id", scopeIds).eq("arquivado", false).is("negocio_id", null).range(f, t)),
        fetchAll<any>((f, t) => supabase.from("pipeline_leads")
          .select("corretor_id").in("corretor_id", scopeIds).gte("distribuido_em", start).lt("distribuido_em", end).range(f, t)),
        bucketIds.length > 0
          ? fetchAll<any>((f, t) => supabase.from("pipeline_historico")
              .select("pipeline_lead_id, stage_novo_id").in("stage_novo_id", bucketIds).gte("created_at", start).lt("created_at", end).range(f, t))
          : Promise.resolve([] as any[]),
        fetchAll<any>((f, t) => supabase.from("visitas")
          .select("corretor_id, status").in("corretor_id", scopeIds).gte("data_visita", start).lt("data_visita", end).range(f, t)),
        fetchAll<any>((f, t) => supabase.from("negocios")
          .select("auth_user_id, created_at, status, fase, data_assinatura").in("auth_user_id", scopeIds).range(f, t)),
      ]);

      // Leads ativos → pipeline ativo + estagnados (saúde)
      for (const l of ativos) {
        const tipo = l.pipeline_stages?.tipo ?? "";
        if (TERMINAIS.has(tipo)) continue;
        bump(l.corretor_id, "pipeline_ativo");
        const s = leadSaude({ ultimo_toque_at: l.ultimo_toque_at, distribuido_em: l.distribuido_em, aceito_em: l.aceito_em, created_at: l.created_at, stage_tipo: tipo, estagnacao_carencia_ate: l.estagnacao_carencia_ate });
        if (s === "estagnado") bump(l.corretor_id, "estagnados");
      }
      // Leads recebidos no período
      for (const l of recebidos) bump(l.corretor_id, "leads_recebidos");

      // Progressão via histórico (descartes · qualif+aquec · negócios). Corretor dos leads
      // resolvido em chunks PARALELOS (não em fila).
      if (histRaw.length > 0) {
        const histLeadIds = [...new Set(histRaw.map((h) => h.pipeline_lead_id).filter(Boolean) as string[])];
        const chunks: string[][] = [];
        for (let i = 0; i < histLeadIds.length; i += 500) chunks.push(histLeadIds.slice(i, i + 500));
        const partes = await Promise.all(chunks.map((chunk) =>
          supabase.from("pipeline_leads").select("id, corretor_id").in("id", chunk)));
        const corretorDoLead = new Map<string, string>();
        partes.forEach(({ data }) => (data ?? []).forEach((l: { id: string; corretor_id: string | null }) => { if (l.corretor_id) corretorDoLead.set(l.id, l.corretor_id); }));
        const vDesc = new Set<string>(), vQual = new Set<string>(), vZona = new Set<string>();
        for (const h of histRaw) {
          const cid = corretorDoLead.get(h.pipeline_lead_id);
          if (!cid || !acc.has(cid)) continue;
          const tipo = tipoDeStage.get(h.stage_novo_id) ?? "";
          const lid = h.pipeline_lead_id;
          if (B_DESCARTE.has(tipo) && !vDesc.has(lid)) { vDesc.add(lid); bump(cid, "descartes"); }
          if (B_QUALIF.has(tipo) && !vQual.has(lid)) { vQual.add(lid); bump(cid, "qualif_aquec"); }
          if (B_ZONA.has(tipo) && !vZona.has(lid)) { vZona.add(lid); bump(cid, "negocios_zona"); }
        }
      }

      // Visitas no período
      for (const v of visitas) {
        if ((v.status ?? "") === "cancelada") continue;
        bump(v.corretor_id, "visitas_criadas");
        if (v.status === "realizada") bump(v.corretor_id, "visitas_realizadas");
        if (v.status === "no_show") bump(v.corretor_id, "no_show");
      }
      // Negócios (join por auth_user_id): criados no período · ativos (snapshot) · vendas (ganho no período)
      for (const n of negocios) {
        const id = n.auth_user_id as string;
        if (!acc.has(id)) continue;
        if (n.created_at >= start && n.created_at < end) bump(id, "negocios_criados");
        if (n.status === "ativo") bump(id, "negocios_ativos");
        if (n.fase === "ganho" && n.data_assinatura && n.data_assinatura >= start && n.data_assinatura < end) bump(id, "vendas");
      }

      // 6) Agrupa por time (gerente), corretores em ordem alfabética
      const porGerente = new Map<string, RaioXCorretor[]>();
      for (const c of acc.values()) {
        const g = gerenteDe.get(c.user_id) ?? c.user_id;
        if (!porGerente.has(g)) porGerente.set(g, []);
        porGerente.get(g)!.push(c);
      }
      const times: RaioXTime[] = [];
      const totalGeral = zeros();
      for (const [gerente_id, corretores] of porGerente) {
        corretores.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
        const total = zeros();
        corretores.forEach((c) => { soma(total, c); soma(totalGeral, c); });
        times.push({ gerente_id, gerente_nome: nomeDe.get(gerente_id) ?? "Equipe", corretores, total });
      }
      times.sort((a, b) => a.gerente_nome.localeCompare(b.gerente_nome, "pt-BR"));
      return { times, totalGeral };
    },
  });
}
