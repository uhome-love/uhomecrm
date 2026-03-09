import type { Lead, LeadPriority } from "@/types/lead";
import { getDaysSinceContact } from "@/lib/leadUtils";

export interface LeadTask {
  id: string;
  leadId: string;
  leadNome: string;
  leadTelefone: string;
  titulo: string;
  descricao: string;
  prioridade: LeadPriority;
  venceEm: string;
  status: "pendente" | "em_andamento" | "concluida" | "cancelada";
}

function todayISO(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

export function generateTasksForLeads(leads: Lead[]): LeadTask[] {
  const tasks: LeadTask[] = [];

  for (const lead of leads) {
    if (!lead.prioridade) continue;
    const days = getDaysSinceContact(lead.ultimoContato);

    switch (lead.prioridade) {
      case "muito_quente":
        tasks.push({
          id: `task-${lead.id}-call`, leadId: lead.id, leadNome: lead.nome, leadTelefone: lead.telefone,
          titulo: "Ligar AGORA", descricao: `Lead muito quente com interesse em ${lead.interesse || "imóveis"}. Contato urgente!`,
          prioridade: "muito_quente", venceEm: todayISO(), status: "pendente",
        });
        break;
      case "quente":
        tasks.push({
          id: `task-${lead.id}-followup`, leadId: lead.id, leadNome: lead.nome, leadTelefone: lead.telefone,
          titulo: "Enviar follow-up hoje", descricao: `Lead quente. Enviar mensagem personalizada de acompanhamento.`,
          prioridade: "quente", venceEm: todayISO(), status: "pendente",
        });
        break;
      case "morno":
        tasks.push({
          id: `task-${lead.id}-nurture`, leadId: lead.id, leadNome: lead.nome, leadTelefone: lead.telefone,
          titulo: "Incluir em campanha", descricao: `Lead morno. Incluir em campanha de nutrição com novidades.`,
          prioridade: "morno", venceEm: addDays(3), status: "pendente",
        });
        break;
      case "frio":
        tasks.push({
          id: `task-${lead.id}-reactivate`, leadId: lead.id, leadNome: lead.nome, leadTelefone: lead.telefone,
          titulo: "Reativar com oferta", descricao: `Lead frio (${days || "90+"}d sem contato). Enviar oferta especial.`,
          prioridade: "frio", venceEm: addDays(7), status: "pendente",
        });
        break;
      case "perdido":
        tasks.push({
          id: `task-${lead.id}-lastchance`, leadId: lead.id, leadNome: lead.nome, leadTelefone: lead.telefone,
          titulo: "Última tentativa", descricao: `Lead perdido (${days || "90+"}d). Última tentativa antes de arquivar.`,
          prioridade: "perdido", venceEm: addDays(14), status: "pendente",
        });
        break;
    }
  }

  const order: Record<LeadPriority, number> = { muito_quente: 0, quente: 1, morno: 2, frio: 3, perdido: 4 };
  tasks.sort((a, b) => order[a.prioridade] - order[b.prioridade]);
  return tasks;
}
