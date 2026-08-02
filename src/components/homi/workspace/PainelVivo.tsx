import { Brain, Zap, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useHomiMemoria } from "@/hooks/useHomiMemoria";

const ATALHOS: { label: string; prompt: string }[] = [
  { label: "Briefing do dia", prompt: "Me dá o briefing do dia" },
  { label: "O que está atrasado", prompt: "O que eu tenho de atrasado agora?" },
  { label: "Visitas a confirmar", prompt: "Quais visitas eu tenho que confirmar?" },
  { label: "Leads esfriando", prompt: "Quais leads estão esfriando?" },
  { label: "Fila de execução", prompt: "Me ajuda a resolver as atrasadas, uma por vez" },
  { label: "Buscar imóvel", prompt: "Me busca um apartamento de 3 dorms até 1,5M em Porto Alegre" },
];

export default function PainelVivo({ onPrompt }: { onPrompt: (t: string) => void }) {
  const { memorias, esquecer } = useHomiMemoria();

  return (
    <div className="flex h-full flex-col gap-5 overflow-y-auto p-4">
      <section>
        <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Zap className="h-3.5 w-3.5" /> Atalhos
        </h3>
        <div className="flex flex-wrap gap-1.5">
          {ATALHOS.map((a) => (
            <Button
              key={a.label}
              variant="outline"
              size="sm"
              className="h-7 rounded-full text-xs"
              onClick={() => onPrompt(a.prompt)}
            >
              {a.label}
            </Button>
          ))}
        </div>
      </section>

      <section className="min-h-0">
        <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Brain className="h-3.5 w-3.5" /> O que o HOMI lembra de você
        </h3>
        {memorias.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Ainda nada. Conte sua meta, seus produtos e como gosta de escrever — o HOMI guarda e usa nas próximas conversas.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {memorias.map((m) => (
              <li key={m.id} className="group flex items-start gap-2 rounded-lg bg-muted/50 px-2.5 py-2 text-xs">
                <div className="min-w-0 flex-1">
                  <span className="font-medium">{m.chave.replace(/_/g, " ")}</span>
                  <p className="text-muted-foreground">{m.valor}</p>
                </div>
                <Button
                  variant="ghost" size="icon"
                  className="h-6 w-6 shrink-0 text-destructive opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                  title="Esquecer"
                  onClick={() => esquecer(m.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
