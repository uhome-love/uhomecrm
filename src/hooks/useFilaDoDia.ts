import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { leadSaude, diasSemToque, type LeadSaude } from "@/lib/leadSaude";
import type { PipelineStage } from "@/hooks/usePipeline";
import { todayBRT } from "@/lib/brtTime";

/**
 * useFilaDoDia — a "Agenda do corretor" (Nova Gestão). Duas visões:
 *  1) prioridades: a FILA DE AÇÃO, ordenada por VALOR/URGÊNCIA:
 *       Negócio/Quer proposta · Pós-visita → Novo/No-show → Retorno(prazo) → Esfriando.
 *     Só entra lead com um GATILHO. Lead só "âmbar de saúde" sem gatilho fica no pipeline.
 *  2) lembretes: compromissos do corretor por prazo (planejamento) — SÓ com hora real.
 *
 *  A cadência Sem Contato (volume de "tentar de novo") NÃO polui a fila nem a
 *  timeline: vira UM bloco expansível ("X leads da cadência pra hoje").
 */

const TERMINAIS = new Set(["descarte", "convertido", "venda", "caiu"]);
// Horas "fantasma" — vencimento default/cadência, não é compromisso marcado.
const HORA_FANTASMA = new Set(["21:00", "21:00:00", "00:00", "00:00:00"]);

export type MotivoFila = "negocio" | "pos_visita" | "novo_lead" | "no_show" | "retorno_hoje" | "quente_esfriando";

// Ordem de valor/urgência (menor = mais em cima).
const MOTIVO_PESO: Record<MotivoFila, number> = {
  negocio: 0, pos_visita: 1, novo_lead: 2, no_show: 3, retorno_hoje: 4, quente_esfriando: 5,
};

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
  /** resultado da visita / negociação (ex.: "Quer proposta", "Interesse alto") */
  resultado: string | null;
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
  lead_stage: string | null;
  telefone: string | null;
  tarefa_tipo: string | null;
  icon: "phone" | "whatsapp" | "home" | "bell";
}

export interface LembretesAgrupados {
  atrasados: Compromisso[];
  hoje: Compromisso[];
  amanha: Compromisso[];
  semana: Compromisso[];
  proximos: Compromisso[];
}

export interface CadenciaBloco {
  total: number;
  leads: LeadFila[];
}

export interface FilaDoDia {
  prioridades: LeadFila[];
  cadencia: CadenciaBloco;
  lembretes: LembretesAgrupados;
  totalLembretes: number;
  stages: PipelineStage[];
}

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

/** hora só entra na timeline se for hora REAL (não o vencimento fantasma). */
function horaReal(h?: string | null): string | null {
  if (!h) return null;
  if (HORA_FANTASMA.has(h)) return null;
  return h.slice(0, 5);
}

/** resultado legível para pós-visita/negócio, a partir do flag_status. */
function resultadoDeFlag(flag: Record<string, unknown>): string | null {
  const neg = String(flag.status_negociacao ?? "");
  if (neg === "proposta_solicitada") return "Quer proposta";
  if (neg === "em_negociacao") return "Em negociação";
  const interesse = String(flag.interesse ?? "");
  if (interesse === "alto") return "Interesse alto";
  if (interesse === "medio") return "Interesse médio";
  return null;
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

      // 1) Leads ativos primeiro — precisamos da etapa de cada lead para saber
      //    o que é cadência Sem Contato (some da timeline) e o que é retorno real.
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
      const stageTipoDe = new Map<string, string>();
      const stageNomeDe = new Map<string, string>();
      for (const l of rows) {
        stageTipoDe.set(l.id, l.pipeline_stages?.tipo ?? "");
        stageNomeDe.set(l.id, l.pipeline_stages?.nome ?? "");
      }

      // 2) Lembretes pendentes → timeline (aba Lembretes) + gatilho de retorno.
      //    Cadência Sem Contato NÃO entra na timeline (vira bloco na fila).
      const lembretes: LembretesAgrupados = { atrasados: [], hoje: [], amanha: [], semana: [], proximos: [] };
      const retornoHojeLeadIds = new Set<string>();   // gatilho: retorno real vencido/hoje (fora Sem Contato)
      const cadenciaDueLeadIds = new Set<string>();   // Sem Contato com tentativa vencida/hoje
      const { data: tarefas } = await supabase
        .from("pipeline_tarefas")
        .select("id, titulo, tipo, vence_em, hora_vencimento, pipeline_lead_id, pipeline_leads(nome, telefone)")
        .eq("responsavel_id", uid)
        .eq("status", "pendente")
        .order("vence_em", { ascending: true })
        .order("hora_vencimento", { ascending: true })
        .limit(400);
      for (const t of (tarefas ?? []) as unknown as {
        id: string; titulo: string; tipo: string; vence_em: string; hora_vencimento: string | null;
        pipeline_lead_id: string | null; pipeline_leads: { nome: string; telefone: string | null } | null;
      }[]) {
        const leadStage = t.pipeline_lead_id ? stageTipoDe.get(t.pipeline_lead_id) : undefined;
        const isCadenciaSC = leadStage === "sem_contato";
        const devido = t.vence_em <= hoje;

        if (isCadenciaSC) {
          if (devido && t.pipeline_lead_id) cadenciaDueLeadIds.add(t.pipeline_lead_id);
          continue; // fora da timeline
        }

        const c: Compromisso = {
          id: t.id, tipo: "lembrete", data: t.vence_em,
          hora: horaReal(t.hora_vencimento),
          titulo: t.titulo, lead_nome: t.pipeline_leads?.nome ?? "Lead",
          lead_id: t.pipeline_lead_id,
          lead_stage: t.pipeline_lead_id ? (stageNomeDe.get(t.pipeline_lead_id) ?? null) : null,
          telefone: t.pipeline_leads?.telefone ?? null,
          tarefa_tipo: t.tipo, icon: iconDeTipo(t.titulo),
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

      // 3) Visitas de hoje → grupo "Hoje" (compromisso com hora real).
      const { data: visitas } = await supabase
        .from("visitas")
        .select("id, nome_cliente, hora_visita, empreendimento, pipeline_lead_id, telefone")
        .eq("corretor_id", uid)
        .eq("data_visita", hoje)
        .in("status", ["marcada", "confirmada", "reagendada"])
        .limit(50);
      for (const v of (visitas ?? []) as unknown as {
        id: string; nome_cliente: string; hora_visita: string | null; empreendimento: string | null;
        pipeline_lead_id: string | null; telefone: string | null;
      }[]) {
        lembretes.hoje.push({
          id: v.id, tipo: "visita", data: hoje,
          hora: v.hora_visita ? v.hora_visita.slice(0, 5) : null,
          titulo: v.empreendimento ? `Visita — ${v.empreendimento}` : "Visita",
          lead_nome: v.nome_cliente, lead_id: v.pipeline_lead_id,
          lead_stage: v.pipeline_lead_id ? (stageNomeDe.get(v.pipeline_lead_id) ?? null) : null,
          telefone: v.telefone ?? null, tarefa_tipo: "visita", icon: "home",
        });
      }
      // ordena cada grupo: com hora primeiro (por hora), sem hora depois
      for (const g of Object.values(lembretes)) {
        g.sort((a, b) => (a.hora ?? "99:99").localeCompare(b.hora ?? "99:99"));
      }

      // 4) FILA DE AÇÃO — percorre leads e classifica o motivo (só com gatilho).
      const now = Date.now();
      const ranked: LeadFila[] = [];
      const cadencia: LeadFila[] = [];
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
        const statusNeg = String(flag.status_negociacao ?? "");
        const idadeMin = (now - new Date(l.created_at).getTime()) / 60000;

        const base: LeadFila = {
          id: l.id, nome: l.nome, telefone: l.telefone, empreendimento: l.empreendimento,
          stage_id: l.stage_id, corretor_id: uid,
          stage_nome: l.pipeline_stages?.nome ?? "", stage_tipo: tipo,
          temperatura: l.temperatura ?? "nao_definida", saude,
          dias_sem_atividade: diasSemToque({
            ultimo_toque_at: l.ultimo_toque_at, distribuido_em: l.distribuido_em,
            aceito_em: l.aceito_em, created_at: l.created_at,
          }),
          tem_atividade: !!l.ultimo_toque_at, motivo: "retorno_hoje",
          resultado: null, ultimo_registro: null,
        };

        // Cadência Sem Contato → bloco (não card individual).
        if (tipo === "sem_contato") {
          if (cadenciaDueLeadIds.has(l.id)) cadencia.push(base);
          continue;
        }

        // Critério ESTRITO por VALOR — a ordem dos ifs define a prioridade.
        let motivo: MotivoFila | null = null;
        if ((tipo === "proposta" || tipo === "contrato_gerado" || statusNeg === "proposta_solicitada" || statusNeg === "em_negociacao") && saude !== "verde") {
          motivo = "negocio";
        } else if (tipo === "pos_visita" && saude !== "verde") {
          motivo = "pos_visita";
        } else if (statusVisita === "no_show" && (tipo === "visita" || tipo === "pos_visita")) {
          motivo = "no_show";
        } else if (tipo === "novo_lead" && !l.ultimo_toque_at && idadeMin < 1440) {
          motivo = "novo_lead";
        } else if (retornoHojeLeadIds.has(l.id)) {
          motivo = "retorno_hoje";
        } else if (tempTier(l.temperatura) >= 4 && saude !== "verde") {
          motivo = "quente_esfriando";
        }
        if (!motivo) continue;

        base.motivo = motivo;
        if (motivo === "negocio" || motivo === "pos_visita" || motivo === "no_show") {
          base.resultado = resultadoDeFlag(flag);
        }
        ranked.push(base);
      }

      ranked.sort((a, b) => {
        const m = MOTIVO_PESO[a.motivo] - MOTIVO_PESO[b.motivo];
        if (m !== 0) return m;
        const t = tempTier(b.temperatura) - tempTier(a.temperatura);
        if (t !== 0) return t;
        return (b.dias_sem_atividade ?? 0) - (a.dias_sem_atividade ?? 0);
      });
      const prioridades = ranked.slice(0, 40);

      // 5) Último registro (norte) — para a fila e os leads do bloco de cadência.
      const alvo = [...prioridades, ...cadencia];
      if (alvo.length > 0) {
        const ids = alvo.map((p) => p.id);
        const { data: ativs } = await supabase
          .from("pipeline_atividades")
          .select("pipeline_lead_id, descricao, created_at")
          .in("pipeline_lead_id", ids)
          .not("descricao", "is", null)
          .order("created_at", { ascending: false })
          .limit(800);
        const ult = new Map<string, string>();
        for (const a of (ativs ?? []) as { pipeline_lead_id: string; descricao: string | null }[]) {
          if (a.descricao && !ult.has(a.pipeline_lead_id)) ult.set(a.pipeline_lead_id, a.descricao);
        }
        for (const p of alvo) p.ultimo_registro = ult.get(p.id) ?? null;
      }

      // 6) Etapas (pro menu ⋮ do card)
      const { data: stagesRaw } = await supabase
        .from("pipeline_stages")
        .select("id, nome, tipo, ordem")
        .eq("pipeline_tipo", "leads")
        .order("ordem", { ascending: true });
      const stages = (stagesRaw ?? []) as unknown as PipelineStage[];

      return {
        prioridades,
        cadencia: { total: cadencia.length, leads: cadencia },
        lembretes, totalLembretes, stages,
      };
    },
  });
}
