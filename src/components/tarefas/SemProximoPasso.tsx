import { ExternalLink, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface LeadRef { id: string; nome: string; empreendimento: string | null; etapa?: string | null; ultima_acao_at?: string | null }

interface Props {
  leads: LeadRef[];
  onCriar: (lead: { id: string; nome: string }) => void;
  onAbrir: (leadId: string) => void;
}

const diaBRT = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

function ultimaAcao(iso: string | null | undefined): { texto: string; velha: boolean } {
  if (!iso) return { texto: "Sem ação registrada", velha: true };
  const d = new Date(iso);
  const dias = Math.round((Date.parse(diaBRT(new Date())) - Date.parse(diaBRT(d))) / 86400_000);
  const dm = d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" });
  const texto = dias <= 0 ? "hoje" : dias === 1 ? "ontem" : `há ${dias} dias (${dm})`;
  return { texto: `Última ação: ${texto}`, velha: dias > 7 };
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
      <p className="text-[12px] text-muted-foreground">Crie uma tarefa para não esquecer destes clientes. Quem está há mais tempo sem ação aparece primeiro.</p>
      {leads.map((l) => {
        const ua = ultimaAcao(l.ultima_acao_at);
        return (
          <div key={l.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
            <div className="min-w-0 flex-1">
              <div className="truncate text-[14px] font-semibold text-foreground">{l.nome}</div>
              <div className="truncate text-[12px] text-muted-foreground">
                {[l.empreendimento, l.etapa].filter(Boolean).join(" · ")}
                {(l.empreendimento || l.etapa) && " · "}
                <span className={cn(ua.velha && "font-semibold text-destructive")}>{ua.texto}</span>
              </div>
            </div>
            <button type="button" onClick={() => onAbrir(l.id)} className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-[12px] font-medium hover:bg-muted">
              <ExternalLink className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Abrir lead</span>
            </button>
            <button type="button" onClick={() => onCriar({ id: l.id, nome: l.nome })} className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-[12px] font-semibold text-primary-foreground hover:bg-primary/90">
              <Plus className="h-3.5 w-3.5" /> Criar tarefa
            </button>
          </div>
        );
      })}
    </div>
  );
}
