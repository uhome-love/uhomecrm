import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Tarefa pendente/concluída do corretor, com o lead já resolvido. */
export interface TarefaItem {
  id: string;
  titulo: string;
  descricao: string | null;
  tipo: string | null;
  status: string;
  vence_em: string | null;
  hora_vencimento: string | null;
  created_at: string;
  concluida_em: string | null;
  responsavel_id: string | null;
  pipeline_lead_id: string | null;
  lead: { id: string; nome: string; telefone: string | null; empreendimento: string | null } | null;
}

export type AbaTarefa = "vencidas" | "hoje" | "proximas" | "novas" | "concluidas";

/** hoje em BRT → 'yyyy-MM-dd' */
export function hojeBRT(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

const SELECT =
  "id, titulo, descricao, tipo, status, vence_em, hora_vencimento, created_at, concluida_em, responsavel_id, pipeline_lead_id, lead:pipeline_leads(id, nome, telefone, empreendimento)";

async function paginar(build: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: unknown }>) {
  const out: TarefaItem[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(from, from + 999);
    if (error) throw error;
    const rows = (data ?? []) as TarefaItem[];
    out.push(...rows);
    if (rows.length < 1000) break;
  }
  return out;
}

/**
 * Tarefas dos responsáveis informados. Pendentes: todas. Concluídas: últimos 7 dias.
 * Visitas têm fluxo próprio (Agenda de Visitas) e ficam fora.
 */
export function useMinhasTarefas(responsaveis: string[]) {
  const key = [...responsaveis].sort().join(",");
  return useQuery({
    queryKey: ["minhas-tarefas-v2", key],
    enabled: responsaveis.length > 0,
    staleTime: 30_000,
    queryFn: async () => {
      const seteDias = new Date(Date.now() - 7 * 86400_000).toISOString();
      const [pendentes, concluidas] = await Promise.all([
        paginar((a, b) =>
          supabase.from("pipeline_tarefas").select(SELECT)
            .in("responsavel_id", responsaveis).eq("status", "pendente")
            .order("vence_em", { ascending: true }).order("id").range(a, b) as never,
        ),
        paginar((a, b) =>
          supabase.from("pipeline_tarefas").select(SELECT)
            .in("responsavel_id", responsaveis).eq("status", "concluida")
            .gte("concluida_em", seteDias)
            .order("concluida_em", { ascending: false }).order("id").range(a, b) as never,
        ),
      ]);
      const semVisita = (t: TarefaItem) => !(t.tipo || "").startsWith("visita") && t.tipo !== "confirmar_visita";
      return { pendentes: pendentes.filter(semVisita), concluidas: concluidas.filter(semVisita) };
    },
  });
}

/** Separa as pendentes nas abas. "Novas" = criadas nas últimas 24h (sobrepõe as outras). */
export function separarAbas(pendentes: TarefaItem[], concluidas: TarefaItem[]) {
  const hoje = hojeBRT();
  const ontem = Date.now() - 86400_000;
  const ord = (a: TarefaItem, b: TarefaItem) =>
    `${a.vence_em ?? ""}${a.hora_vencimento ?? ""}`.localeCompare(`${b.vence_em ?? ""}${b.hora_vencimento ?? ""}`);
  return {
    vencidas: pendentes.filter((t) => t.vence_em && t.vence_em < hoje).sort(ord),
    hoje: pendentes.filter((t) => t.vence_em === hoje).sort(ord),
    proximas: pendentes.filter((t) => !t.vence_em || t.vence_em > hoje).sort(ord),
    novas: pendentes.filter((t) => new Date(t.created_at).getTime() >= ontem).sort(ord),
    concluidas,
  } satisfies Record<AbaTarefa, TarefaItem[]>;
}

const TERMINAIS = ["descarte", "convertido", "venda", "caiu", "ganho"];

/** Leads ativos do corretor sem nenhuma tarefa pendente marcada. */
export function useSemProximoPasso(corretorId: string | null, pendentes: TarefaItem[] | undefined) {
  return useQuery({
    queryKey: ["sem-proximo-passo", corretorId, pendentes?.length ?? -1],
    enabled: !!corretorId && !!pendentes,
    staleTime: 60_000,
    queryFn: async () => {
      const { data: stages } = await supabase.from("pipeline_stages").select("id, tipo").eq("pipeline_tipo", "leads");
      const ativos = ((stages ?? []) as { id: string; tipo: string }[])
        .filter((s) => !TERMINAIS.includes(s.tipo)).map((s) => s.id);
      const leads: { id: string; nome: string; telefone: string | null; empreendimento: string | null }[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase.from("pipeline_leads")
          .select("id, nome, telefone, empreendimento")
          .eq("corretor_id", corretorId!).eq("arquivado", false).in("stage_id", ativos)
          .order("updated_at", { ascending: false }).range(from, from + 999);
        if (error) throw error;
        leads.push(...((data ?? []) as typeof leads));
        if (!data || data.length < 1000) break;
      }
      const comTarefa = new Set((pendentes ?? []).map((t) => t.pipeline_lead_id).filter(Boolean));
      return leads.filter((l) => !comTarefa.has(l.id));
    },
  });
}

/** Corretores visíveis para gestão (só leitura). admin/diretor: todos; gestor: sua equipe. */
export function useCorretoresEquipe(userId: string | null, isGestao: boolean, verTodos: boolean) {
  return useQuery({
    queryKey: ["tarefas-equipe", userId, verTodos],
    enabled: !!userId && isGestao,
    staleTime: 300_000,
    queryFn: async () => {
      let q = supabase.from("team_members").select("user_id, nome").eq("status", "ativo").not("user_id", "is", null);
      if (!verTodos) q = q.eq("gerente_id", userId!);
      const { data, error } = await q;
      if (error) throw error;
      const m = new Map<string, string>();
      for (const r of (data ?? []) as { user_id: string; nome: string | null }[]) m.set(r.user_id, r.nome || "Corretor");
      return [...m.entries()].map(([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome));
    },
  });
}
