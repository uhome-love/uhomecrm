import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { MultiPicker } from "./MultiPicker";

export interface EscopoState {
  equipes: string[];
  corretores: string[];
  liberar: boolean;
}

export function PassoEscopo({
  state,
  set,
  opcoes,
  esconderLiberar,
}: {
  state: EscopoState;
  set: (p: Partial<EscopoState>) => void;
  opcoes?: {
    equipes: { id: string; nome: string }[];
    corretores: { id: string; nome: string }[];
    semEquipeIds?: string[];
  };
  /** Na edição de campanha já liberada não faz sentido perguntar de novo. */
  esconderLiberar?: boolean;
}) {
  const restrito = state.equipes.length > 0 || state.corretores.length > 0;
  const semEquipeForaDoEscopo = (opcoes?.semEquipeIds ?? []).filter((id) => !state.corretores.includes(id)).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={restrito ? "outline" : "default"}
          className="h-7 text-xs"
          onClick={() => set({ equipes: [], corretores: [] })}
        >
          Todos os corretores
        </Button>
        <Button
          type="button"
          size="sm"
          variant={restrito ? "default" : "outline"}
          className="h-7 text-xs"
          onClick={() => {
            if (!restrito && opcoes?.equipes.length) set({ equipes: [opcoes.equipes[0].id] });
          }}
        >
          Somente selecionados
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Equipes</Label>
          <MultiPicker
            items={opcoes?.equipes ?? []}
            value={state.equipes}
            onChange={(v) => set({ equipes: v })}
            placeholder="Buscar equipe…"
            emptyLabel="Nenhuma equipe específica"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Corretores</Label>
          <MultiPicker
            items={opcoes?.corretores ?? []}
            value={state.corretores}
            onChange={(v) => set({ corretores: v })}
            placeholder="Buscar corretor…"
            emptyLabel="Nenhum corretor específico"
          />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {restrito
          ? "Só as equipes e corretores selecionados verão esta campanha em “Bases ativas”."
          : "Sem restrição: todos os corretores verão esta campanha."}
      </p>

      {restrito && semEquipeForaDoEscopo > 0 && (
        <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-2 text-[11px] text-amber-700 dark:text-amber-400">
          {semEquipeForaDoEscopo} corretor(es) ativo(s) não estão em nenhuma equipe e não verão esta campanha — use
          “Todos os corretores” ou inclua-os individualmente no campo Corretores.
        </p>
      )}

      {!esconderLiberar && (
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <Checkbox checked={state.liberar} onCheckedChange={(c) => set({ liberar: !!c })} />
          Liberar imediatamente para os corretores (senão fica pendente)
        </label>
      )}
    </div>
  );
}

export default PassoEscopo;
