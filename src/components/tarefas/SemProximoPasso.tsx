import { useState } from "react";
import { AlertTriangle, ChevronDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface LeadRef { id: string; nome: string; empreendimento: string | null }

interface Props {
  leads: LeadRef[];
  onCriar: (lead: { id: string; nome: string }) => void;
  onAbrir: (leadId: string) => void;
}

/** Leads ativos do corretor sem nenhuma tarefa marcada — convite a criar o próximo passo. */
export default function SemProximoPasso({ leads, onCriar, onAbrir }: Props) {
  const [aberto, setAberto] = useState(false);
  if (leads.length === 0) return null;
  const lista = aberto ? leads.slice(0, 50) : leads.slice(0, 3);
  return (
    <div className="rounded-xl border border-warning/40 bg-warning/[0.06] p-3">
      <div className="mb-2 flex items-center gap-2 text-[13px] font-semibold text-foreground">
        <AlertTriangle className="h-4 w-4 text-warning" />
        {leads.length} cliente{leads.length !== 1 ? "s" : ""} sem próximo passo
        <span className="font-normal text-muted-foreground">— crie uma tarefa para não esquecer</span>
      </div>
      <div className="space-y-1.5">
        {lista.map((l) => (
          <div key={l.id} className="flex items-center gap-2 rounded-lg bg-card px-3 py-2">
            <button type="button" onClick={() => onAbrir(l.id)} className="min-w-0 flex-1 truncate text-left text-[13px] font-medium hover:underline">
              {l.nome}{l.empreendimento ? <span className="text-muted-foreground"> · {l.empreendimento}</span> : null}
            </button>
            <button type="button" onClick={() => onCriar({ id: l.id, nome: l.nome })} className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[12px] font-medium hover:bg-muted">
              <Plus className="h-3.5 w-3.5" /> Criar tarefa
            </button>
          </div>
        ))}
      </div>
      {leads.length > 3 && (
        <button type="button" onClick={() => setAberto((v) => !v)} className="mt-2 inline-flex items-center gap-1 text-[12px] font-medium text-muted-foreground hover:text-foreground">
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", aberto && "rotate-180")} />
          {aberto ? "Mostrar menos" : `Ver todos (${leads.length > 50 ? "50 primeiros" : leads.length})`}
        </button>
      )}
    </div>
  );
}
