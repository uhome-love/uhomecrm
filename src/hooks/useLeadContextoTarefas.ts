import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface RegistroMini {
  quando: string;
  tipo: string; // WhatsApp, Ligação, Nota...
  resultado: string | null;
  texto: string | null;
}

export interface LeadContexto {
  etapa: string | null;
  etapaTipo: string | null;
  flagStatus: Record<string, string> | null;
  ultimaAcaoAt: string | null;
  registros: RegistroMini[];
}

const TIPO_LABEL: Record<string, string> = { ligacao: "Ligação", whatsapp: "WhatsApp", email: "E-mail", visita: "Visita" };
const RESULTADO_LABEL: Record<string, string> = {
  atendeu: "atendeu", nao_atendeu: "não atendeu", agendou_proximo: "agendou próximo",
  sem_interesse: "sem interesse", outro: "outro",
};

function chunks<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

/** Etapa do Pipeline + últimos 3 registros (atividades concluídas e anotações) de cada lead das tarefas. */
export function useLeadContextoTarefas(leadIds: string[]) {
  const ids = [...new Set(leadIds)].sort();
  return useQuery({
    queryKey: ["tarefas-lead-contexto", ids.join(",")],
    enabled: ids.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const { data: stages } = await supabase.from("pipeline_stages").select("id, tipo, nome");
      const stageMap = new Map(((stages ?? []) as { id: string; tipo: string; nome: string }[]).map((s) => [s.id, s]));
      const out = new Map<string, LeadContexto>();
      const regs = new Map<string, RegistroMini[]>();

      for (const grupo of chunks(ids, 100)) {
        const [leads, ativ, notas] = await Promise.all([
          supabase.from("pipeline_leads").select("id, stage_id, flag_status, ultima_acao_at").in("id", grupo),
          supabase.from("pipeline_atividades")
            .select("pipeline_lead_id, tipo, tipo_contato, resultado, titulo, descricao, created_at")
            .in("pipeline_lead_id", grupo).in("status", ["concluida", "completed"])
            .order("created_at", { ascending: false }).limit(1000),
          supabase.from("pipeline_anotacoes").select("pipeline_lead_id, conteudo, created_at")
            .in("pipeline_lead_id", grupo).order("created_at", { ascending: false }).limit(1000),
        ]);
        for (const l of (leads.data ?? []) as { id: string; stage_id: string | null; flag_status: unknown; ultima_acao_at: string | null }[]) {
          const st = l.stage_id ? stageMap.get(l.stage_id) : undefined;
          out.set(l.id, {
            etapa: st?.nome ?? null, etapaTipo: st?.tipo ?? null,
            flagStatus: (l.flag_status as Record<string, string> | null) ?? null,
            ultimaAcaoAt: l.ultima_acao_at, registros: [],
          });
        }
        for (const a of (ativ.data ?? []) as { pipeline_lead_id: string; tipo: string; tipo_contato: string | null; resultado: string | null; titulo: string; descricao: string | null; created_at: string }[]) {
          const k = a.tipo_contato || a.tipo;
          const arr = regs.get(a.pipeline_lead_id) ?? [];
          arr.push({
            quando: a.created_at, tipo: TIPO_LABEL[k] ?? "Atividade",
            resultado: a.resultado ? RESULTADO_LABEL[a.resultado] ?? null : null,
            texto: a.descricao || a.titulo || null,
          });
          regs.set(a.pipeline_lead_id, arr);
        }
        for (const n of (notas.data ?? []) as { pipeline_lead_id: string; conteudo: string; created_at: string }[]) {
          const arr = regs.get(n.pipeline_lead_id) ?? [];
          arr.push({ quando: n.created_at, tipo: "Nota", resultado: null, texto: n.conteudo });
          regs.set(n.pipeline_lead_id, arr);
        }
      }
      for (const [id, arr] of regs) {
        const c = out.get(id);
        if (c) c.registros = arr.sort((a, b) => b.quando.localeCompare(a.quando)).slice(0, 3);
      }
      return out;
    },
  });
}
