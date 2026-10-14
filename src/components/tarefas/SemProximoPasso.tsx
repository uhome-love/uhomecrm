import { ExternalLink, Plus } from "lucide-react";

interface LeadRef { id: string; nome: string; empreendimento: string | null }

interface Props {
  leads: LeadRef[];
  onCriar: (lead: { id: string; nome: string }) => void;
  onAbrir: (leadId: string) => void;
}

/** Aba "Sem próximo passo": leads ativos do corretor sem nenhuma tarefa marcada. */
export default function SemProximoPasso({ leads, onCriar, onAbrir }: Props) {
  if (leads.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-8 text-center text-[13px] text-muted-foreground">
        Todos os seus clientes têm próximo passo. Muito bem!
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <p className="text-[12px] text-muted-foreground">Crie uma tarefa para não esquecer destes clientes.</p>
      {leads.map((l) => (
        <div key={l.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
          <div className="min-w-0 flex-1">
            <div className="truncate text-[14px] font-semibold text-foreground">{l.nome}</div>
            {l.empreendimento && <div className="truncate text-[12px] text-muted-foreground">{l.empreendimento}</div>}
          </div>
          <button type="button" onClick={() => onAbrir(l.id)} className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-[12px] font-medium hover:bg-muted">
            <ExternalLink className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Abrir lead</span>
          </button>
          <button type="button" onClick={() => onCriar({ id: l.id, nome: l.nome })} className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-[12px] font-semibold text-primary-foreground hover:bg-primary/90">
            <Plus className="h-3.5 w-3.5" /> Criar tarefa
          </button>
        </div>
      ))}
    </div>
  );
}
