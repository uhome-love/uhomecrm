import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { leadSaude, diasSemToque, type LeadSaude } from "@/lib/leadSaude";
import type { PipelineStage } from "@/hooks/usePipeline";
import { todayBRT } from "@/lib/brtTime";

/**
 * useFilaDoDia — a "Agenda do corretor" (Nova Gestão). Duas visões:
 *  1) prioridades: a FILA DE AÇÃO. Só entra lead com um GATILHO (novo lead sem
 *     contato · retorno agendado devido · pós-visita/no-show · quente esfriando).
 *     Lead só "âmbar/vermelho de saúde" SEM gatilho (ex.: Aquecimento aquecendo)
 *     NÃO entra — não tem ação imediata.
 *  2) lembretes: TODOS os compromissos do corretor agrupados por prazo (planejamento).
 */

const TERMINAIS = new Set(["descarte", "convertido", "venda", "caiu"]);

export type MotivoFila = "novo_lead" | "retorno_hoje" | "no_show" | "pos_visita" | "quente_esfriando";

export interface LeadFila {
  id: string;
  nome: string;
  telefone: string | null;
  empreendimento: string | null;
  stage_id: string;
  corretor_id: string;
  stage_nome: string;
  stage_tipo: string;
  temperatura: string;
  saude: LeadSaude;
  dias_sem_atividade: number | null;
  tem_atividade: boolean;
  motivo: MotivoFila;
  ultimo_registro: string | null;
}

export interface Compromisso {
  id: string;
  tipo: "visita" | "lembrete";
  data: string; // yyyy-mm-dd
  hora: string | null;
  titulo: string;
  lead_nome: string;
  lead_id: string | null;
  icon: "phone" | "whatsapp" | "home" | "bell";
}

export interface LembretesAgrupados {
  atrasados: Compromisso[];
  hoje: Compromisso[];
  amanha: Compromisso[];
  semana: Compromisso[];
  proximos: Compromisso[];
}

export interface FilaDoDia {
  prioridades: LeadFila[];
  lembretes: LembretesAgrupados;
  totalLembretes: number;
  stages: PipelineStage[];
}

const MOTIVO_PESO: Record<MotivoFila, number> = {
  novo_lead: 0, retorno_hoje: 1, no_show: 2, pos_visita: 3, quente_esfriando: 4,
};

function tempTier(t?: string | null): number {
  const s = (t ?? "").toLowerCase();
  if (s === "quente" || s === "muito_quente" || s === "urgente") return 4;
  if (s === "morno") return 3;
  if (s === "frio" || s === "gelado") return 1;
  return 2;
}

function iconDeTipo(tipo?: string | null): Compromisso["icon"] {
  const s = (tipo ?? "").toLowerCase();
  if (s.includes("whats")) return "whatsapp";
  if (s.includes("visita")) return "home";
  if (s.includes("lig")) return "phone";
  return "bell";
}

function addDias(base: string, n: number): string {
  const d = new Date(base + "T12:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export function useFilaDoDia() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["fila-do-dia", user?.id],
    enabled: !!user?.id,
    staleTime: 30_000,
    queryFn: async (): Promise<FilaDoDia> => {
      const uid = user!.id;
      const hoje = todayBRT();
      const amanha = addDias(hoje, 1);
      const fimSemana = addDias(hoje, 7);

      // 1) TODOS os lembretes pendentes do corretor (aba Lembretes + gatilho retorno)
      const lembretes: LembretesAgrupados = { atrasados: [], hoje: [], amanha: [], semana: [], proximos: [] };
      const retornoHojeLeadIds = new Set<string>();
      const { data: tarefas } = await supabase
        .from("pipeline_tarefas")
        .select("id, titulo, tipo, vence_em, hora_vencimento, pipeline_lead_id, pipeline_leads(nome)")
        .eq("responsavel_id", uid)
        .eq("status", "pendente")
        .order("vence_em", { ascending: true })
        .order("hora_vencimento", { ascending: true })
        .limit(400);
      for (const t of (tarefas ?? []) as unknown as {
        id: string; titulo: string; tipo: string; vence_em: string; hora_vencimento: string | null;
        pipeline_lead_id: string | null; pipeline_leads: { nome: string } | null;
      }[]) {
        const c: Compromisso = {
          id: t.id, tipo: "lembrete", data: t.vence_em,
          hora: t.hora_vencimento ? t.hora_vencimento.slice(0, 5) : null,
          titulo: t.titulo, lead_nome: t.pipeline_leads?.nome ?? "Lead",
          lead_id: t.pipeline_lead_id, icon: iconDeTipo(t.tipo),
        };
        if (t.vence_em < hoje) { lembretes.atrasados.push(c); if (t.pipeline_lead_id) retornoHojeLeadIds.add(t.pipeline_lead_id); }
        else if (t.vence_em === hoje) { lembretes.hoje.push(c); if (t.pipeline_lead_id) retornoHojeLeadIds.add(t.pipeline_lead_id); }
        else if (t.vence_em === amanha) lembretes.amanha.push(c);
        else if (t.vence_em <= fimSemana) lembretes.semana.push(c);
        else lembretes.proximos.push(c);
      }
      const totalLembretes =
        lembretes.atrasados.length + lembretes.hoje.length + lembretes.amanha.length +
        lembretes.semana.length + lembretes.proximos.length;

      // 2) Visitas de hoje → entram no grupo "Hoje" dos compromissos
      const { data: visitas } = await supabase
        .from("visitas")
        .select("id, nome_cliente, hora_visita, empreendimento, pipeline_lead_id")
        .eq("corretor_id", uid)
        .eq("data_visita", hoje)
        .in("status", ["marcada", "confirmada", "reagendada"])
        .limit(50);
      for (const v of (visitas ?? []) as unknown as {
        id: string; nome_cliente: string; hora_visita: string | null; empreendimento: string | null; pipeline_lead_id: string | null;
      }[]) {
        lembretes.hoje.push({
          id: v.id, tipo: "visita", data: hoje,
          hora: v.hora_visita ? v.hora_visita.slice(0, 5) : null,
          titulo: v.empreendimento ? `Visita — ${v.empreendimento}` : "Visita",
          lead_nome: v.nome_cliente, lead_id: v.pipeline_lead_id, icon: "home",
        });
      }
      for (const g of Object.values(lembretes)) g.sort((a, b) => (a.hora ?? "99:99").localeCompare(b.hora ?? "99:99"));

      // 3) Leads ativos → FILA DE AÇÃO (só com gatilho)
      const { data: leadsRaw } = await supabase
        .from("pipeline_leads")
        .select("id, nome, telefone, empreendimento, temperatura, ultimo_toque_at, distribuido_em, aceito_em, created_at, flag_status, stage_id, pipeline_stages!inner(nome, tipo)")
        .eq("corretor_id", uid)
        .eq("arquivado", false)
        .limit(1000);
      type Row = {
        id: string; nome: string; telefone: string | null; empreendimento: string | null;
        temperatura: string | null; ultimo_toque_at: string | null; distribuido_em: string | null;
        aceito_em: string | null; created_at: string; flag_status: Record<string, unknown> | null;
        stage_id: string; pipeline_stages: { nome: string; tipo: string };
      };
      const rows = (leadsRaw ?? []) as unknown as Row[];
      const now = Date.now();
      const ranked: LeadFila[] = [];
      for (const l of rows) {
        const tipo = l.pipeline_stages?.tipo ?? "";
        if (TERMINAIS.has(tipo)) continue;
        const saude = leadSaude({
          ultimo_toque_at: l.ultimo_toque_at, distribuido_em: l.distribuido_em,
          aceito_em: l.aceito_em, created_at: l.created_at, stage_tipo: tipo,
        });
        if (saude === "estagnado") continue;
        const flag = (l.flag_status || {}) as Record<string, unknown>;
        const statusVisita = String(flag.status_visita ?? "");
        const idadeMin = (now - new Date(l.created_at).getTime()) / 60000;

        // Critério ESTRITO: só entra quem tem gatilho de ação.
        let motivo: MotivoFila | null = null;
        if (tipo === "novo_lead" && !l.ultimo_toque_at && idadeMin < 1440) motivo = "novo_lead";
        else if (retornoHojeLeadIds.has(l.id)) motivo = "retorno_hoje";
        else if (statusVisita === "no_show" && (tipo === "visita" || tipo === "pos_visita")) motivo = "no_show";
        else if (tipo === "pos_visita" && saude !== "verde") motivo = "pos_visita";
        else if (tempTier(l.temperatura) >= 4 && saude !== "verde") motivo = "quente_esfriando";
        if (!motivo) continue; // sem gatilho → fora da fila (fica no pipeline)

        ranked.push({
          id: l.id, nome: l.nome, telefone: l.telefone, empreendimento: l.empreendimento,
          stage_id: l.stage_id, corretor_id: uid,
          stage_nome: l.pipeline_stages?.nome ?? "", stage_tipo: tipo,
          temperatura: l.temperatura ?? "nao_definida", saude,
          dias_sem_atividade: diasSemToque({
            ultimo_toque_at: l.ultimo_toque_at, distribuido_em: l.distribuido_em,
            aceito_em: l.aceito_em, created_at: l.created_at,
          }),
          tem_atividade: !!l.ultimo_toque_at, motivo, ultimo_registro: null,
        });
      }
      ranked.sort((a, b) => {
        const m = MOTIVO_PESO[a.motivo] - MOTIVO_PESO[b.motivo];
        if (m !== 0) return m;
        const t = tempTier(b.temperatura) - tempTier(a.temperatura);
        if (t !== 0) return t;
        return (b.dias_sem_atividade ?? 0) - (a.dias_sem_atividade ?? 0);
      });
      const prioridades = ranked.slice(0, 30);

      // 4) Último registro (norte) das prioridades
      if (prioridades.length > 0) {
        const ids = prioridades.map((p) => p.id);
        const { data: ativs } = await supabase
          .from("pipeline_atividades")
          .select("pipeline_lead_id, descricao, created_at")
          .in("pipeline_lead_id", ids)
          .not("descricao", "is", null)
          .order("created_at", { ascending: false })
          .limit(600);
        const ult = new Map<string, string>();
        for (const a of (ativs ?? []) as { pipeline_lead_id: string; descricao: string | null }[]) {
          if (a.descricao && !ult.has(a.pipeline_lead_id)) ult.set(a.pipeline_lead_id, a.descricao);
        }
        for (const p of prioridades) p.ultimo_registro = ult.get(p.id) ?? null;
      }

      // 5) Etapas (pro menu ⋮ do card)
      const { data: stagesRaw } = await supabase
        .from("pipeline_stages")
        .select("id, nome, tipo, ordem")
        .eq("pipeline_tipo", "leads")
        .order("ordem", { ascending: true });
      const stages = (stagesRaw ?? []) as unknown as PipelineStage[];

      return { prioridades, lembretes, totalLembretes, stages };
    },
  });
}
