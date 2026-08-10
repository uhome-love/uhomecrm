import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { leadSaude, diasSemToque, type LeadSaude } from "@/lib/leadSaude";
import { todayBRT } from "@/lib/brtTime";

/**
 * useFilaDoDia — a "Agenda do corretor" (Nova Gestão). Duas listas:
 *  1) prioridades: leads ranqueados pelo SISTEMA (situação + temperatura × saúde),
 *     cada um com o motivo + o último registro (norte do próximo passo).
 *  2) agenda: compromissos de HOJE (lembretes + visitas), por horário.
 * Coerente com a Nova Gestão: exclui terminais e estagnados; nada de "tarefa".
 */

const TERMINAIS = new Set(["descarte", "convertido", "venda", "caiu"]);

export type MotivoFila =
  | "retorno_hoje"
  | "pos_visita"
  | "no_show"
  | "novo_lead"
  | "quente_esfriando"
  | "esfriando";

export interface LeadFila {
  id: string;
  nome: string;
  telefone: string | null;
  empreendimento: string | null;
  stage_nome: string;
  stage_tipo: string;
  temperatura: string;
  saude: LeadSaude;
  dias_sem_atividade: number | null;
  tem_atividade: boolean;
  motivo: MotivoFila;
  ultimo_registro: string | null; // a obs da última atividade = o norte
}

export interface CompromissoHoje {
  id: string;
  tipo: "visita" | "lembrete";
  hora: string | null; // "HH:MM"
  titulo: string;
  lead_nome: string;
  atrasado: boolean;
  icon: "phone" | "whatsapp" | "home" | "bell";
}

export interface FilaDoDia {
  prioridades: LeadFila[];
  agenda: CompromissoHoje[];
  totalLeads: number;
}

const MOTIVO_PESO: Record<MotivoFila, number> = {
  retorno_hoje: 0,
  no_show: 1,
  pos_visita: 2,
  novo_lead: 3,
  quente_esfriando: 4,
  esfriando: 5,
};

function tempTier(t?: string | null): number {
  const s = (t ?? "").toLowerCase();
  if (s === "quente" || s === "muito_quente" || s === "urgente") return 4;
  if (s === "morno") return 3;
  if (s === "frio" || s === "gelado") return 1;
  return 2;
}

function iconDeTipo(tipo?: string | null): CompromissoHoje["icon"] {
  const s = (tipo ?? "").toLowerCase();
  if (s.includes("whats")) return "whatsapp";
  if (s.includes("visita")) return "home";
  if (s.includes("lig") || s.includes("ligar") || s.includes("ligacao")) return "phone";
  return "bell";
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

      // 1) Leads ativos do corretor
      const { data: leadsRaw, error } = await supabase
        .from("pipeline_leads")
        .select(
          "id, nome, telefone, empreendimento, temperatura, ultimo_toque_at, distribuido_em, aceito_em, created_at, flag_status, stage_id, pipeline_stages!inner(nome, tipo)"
        )
        .eq("corretor_id", uid)
        .eq("arquivado", false)
        .limit(1000);
      if (error) throw error;

      type Row = {
        id: string; nome: string; telefone: string | null; empreendimento: string | null;
        temperatura: string | null; ultimo_toque_at: string | null; distribuido_em: string | null;
        aceito_em: string | null; created_at: string; flag_status: Record<string, unknown> | null;
        pipeline_stages: { nome: string; tipo: string };
      };
      const rows = (leadsRaw ?? []) as unknown as Row[];

      const now = Date.now();
      const ranked: LeadFila[] = [];
      for (const l of rows) {
        const tipo = l.pipeline_stages?.tipo ?? "";
        if (TERMINAIS.has(tipo)) continue;
        const saude = leadSaude({
          ultimo_toque_at: l.ultimo_toque_at,
          distribuido_em: l.distribuido_em,
          aceito_em: l.aceito_em,
          created_at: l.created_at,
          stage_tipo: tipo,
        });
        if (saude === "estagnado") continue; // estagnado vive na página própria
        const dias = diasSemToque({
          ultimo_toque_at: l.ultimo_toque_at,
          distribuido_em: l.distribuido_em,
          aceito_em: l.aceito_em,
          created_at: l.created_at,
        });
        const flag = l.flag_status || {};
        const statusVisita = String((flag as Record<string, unknown>).status_visita ?? "");
        const idadeMin = (now - new Date(l.created_at).getTime()) / 60000;

        // Detecta o motivo (situação) — o mais forte primeiro.
        // No-show só é acionável enquanto o lead está em Visita/Pós-visita
        // (flag_status.status_visita fica gravado mesmo depois — não usar fora daí).
        let motivo: MotivoFila;
        if (statusVisita === "no_show" && (tipo === "visita" || tipo === "pos_visita")) motivo = "no_show";
        else if (tipo === "pos_visita" && saude !== "verde") motivo = "pos_visita";
        else if (tipo === "novo_lead" && !l.ultimo_toque_at && idadeMin < 720) motivo = "novo_lead";
        else if (tempTier(l.temperatura) >= 4 && saude !== "verde") motivo = "quente_esfriando";
        else motivo = "esfriando";

        // Só entra na fila quem precisa de atenção (não os verdes tranquilos),
        // exceto novo lead e no-show que sempre entram.
        if (saude === "verde" && motivo !== "novo_lead" && motivo !== "no_show") continue;

        ranked.push({
          id: l.id, nome: l.nome, telefone: l.telefone, empreendimento: l.empreendimento,
          stage_nome: l.pipeline_stages?.nome ?? "", stage_tipo: tipo,
          temperatura: l.temperatura ?? "nao_definida", saude,
          dias_sem_atividade: dias, tem_atividade: !!l.ultimo_toque_at, motivo, ultimo_registro: null,
        });
      }

      // Ordena: motivo (situação) → temperatura → mais dias sem atividade
      ranked.sort((a, b) => {
        const m = MOTIVO_PESO[a.motivo] - MOTIVO_PESO[b.motivo];
        if (m !== 0) return m;
        const t = tempTier(b.temperatura) - tempTier(a.temperatura);
        if (t !== 0) return t;
        return (b.dias_sem_atividade ?? 0) - (a.dias_sem_atividade ?? 0);
      });
      const prioridades = ranked.slice(0, 25);

      // 2) Último registro (norte) — última atividade com descrição dos leads da fila
      if (prioridades.length > 0) {
        const ids = prioridades.map((p) => p.id);
        const { data: ativs } = await supabase
          .from("pipeline_atividades")
          .select("pipeline_lead_id, descricao, titulo, created_at")
          .in("pipeline_lead_id", ids)
          .not("descricao", "is", null)
          .order("created_at", { ascending: false })
          .limit(400);
        const ultimoPorLead = new Map<string, string>();
        for (const a of (ativs ?? []) as { pipeline_lead_id: string; descricao: string | null }[]) {
          if (a.descricao && !ultimoPorLead.has(a.pipeline_lead_id)) {
            ultimoPorLead.set(a.pipeline_lead_id, a.descricao);
          }
        }
        for (const p of prioridades) p.ultimo_registro = ultimoPorLead.get(p.id) ?? null;
      }

      // 3) Agenda de hoje: lembretes (vence hoje ou atrasado) + visitas de hoje
      const agenda: CompromissoHoje[] = [];
      const { data: tarefas } = await supabase
        .from("pipeline_tarefas")
        .select("id, titulo, tipo, vence_em, hora_vencimento, pipeline_lead_id, pipeline_leads(nome)")
        .eq("responsavel_id", uid)
        .eq("status", "pendente")
        .lte("vence_em", hoje)
        .order("hora_vencimento", { ascending: true })
        .limit(50);
      for (const t of (tarefas ?? []) as unknown as {
        id: string; titulo: string; tipo: string; vence_em: string; hora_vencimento: string | null;
        pipeline_leads: { nome: string } | null;
      }[]) {
        agenda.push({
          id: t.id, tipo: "lembrete",
          hora: t.hora_vencimento ? t.hora_vencimento.slice(0, 5) : null,
          titulo: t.titulo, lead_nome: t.pipeline_leads?.nome ?? "Lead",
          atrasado: t.vence_em < hoje, icon: iconDeTipo(t.tipo),
        });
      }
      const { data: visitas } = await supabase
        .from("visitas")
        .select("id, nome_cliente, hora_visita, status, empreendimento")
        .eq("corretor_id", uid)
        .eq("data_visita", hoje)
        .in("status", ["marcada", "confirmada", "reagendada"])
        .limit(50);
      for (const v of (visitas ?? []) as unknown as {
        id: string; nome_cliente: string; hora_visita: string | null; empreendimento: string | null;
      }[]) {
        agenda.push({
          id: v.id, tipo: "visita",
          hora: v.hora_visita ? v.hora_visita.slice(0, 5) : null,
          titulo: v.empreendimento ? `Visita — ${v.empreendimento}` : "Visita",
          lead_nome: v.nome_cliente, atrasado: false, icon: "home",
        });
      }
      agenda.sort((a, b) => (a.hora ?? "99:99").localeCompare(b.hora ?? "99:99"));

      return { prioridades, agenda, totalLeads: ranked.length };
    },
  });
}
