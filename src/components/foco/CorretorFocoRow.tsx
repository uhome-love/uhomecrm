import { useMemo, useState } from "react";
import { AlertCircle, X, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmpreendimentoMultiSelect, type EmpreendimentoOption } from "./EmpreendimentoMultiSelect";
import type { CorretorRow, EmpreendimentoCanonico } from "@/hooks/useFocoCorretores";

interface Props {
  corretor: CorretorRow;
  /** Somente ativos — alimentam o seletor de adicionar. */
  empreendimentos: EmpreendimentoCanonico[];
  /** Ativos + inativos — usados só para exibir chips herdados. */
  todosEmpreendimentos?: EmpreendimentoCanonico[];
  canEdit: boolean;
  saving: boolean;
  onSave: (empreendimentos: string[]) => void;
  perfSummary?: { leads: number; visitasRealizadas: number; vendas: number };
}

export function CorretorFocoRow({ corretor, empreendimentos, todosEmpreendimentos, canEdit, saving, onSave, perfSummary }: Props) {
  const [draft, setDraft] = useState<string[]>(corretor.alocacao);
  const options: EmpreendimentoOption[] = useMemo(
    () => empreendimentos.map((e) => ({ id: e.id, nome: e.nome, segmento: e.segmento_nome })),
    [empreendimentos]
  );

  const ativosSet = useMemo(() => new Set(empreendimentos.map((e) => e.id)), [empreendimentos]);
  const empMap = useMemo(
    () => new Map((todosEmpreendimentos?.length ? todosEmpreendimentos : empreendimentos).map((e) => [e.id, e])),
    [todosEmpreendimentos, empreendimentos]
  );

  // Só empreendimentos ativos podem ser gravados (a RPC recusa inativos).
  const draftAtivos = useMemo(() => draft.filter((id) => ativosSet.has(id)), [draft, ativosSet]);
  const dirty =
    JSON.stringify([...draftAtivos].sort()) !== JSON.stringify([...corretor.alocacao].sort());
  const isEmpty = draft.length === 0;

  const initials = corretor.nome.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="flex flex-col md:flex-row md:items-center gap-3 py-3 px-3 border-b last:border-b-0 hover:bg-muted/30 transition">
      {/* Avatar + nome */}
      <div className="flex items-center gap-3 md:w-56 shrink-0">
        {corretor.avatar_url ? (
          <img src={corretor.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover" />
        ) : (
          <div className="h-9 w-9 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
            {initials}
          </div>
        )}
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">{corretor.nome}</p>
          <p className="text-[11px] text-muted-foreground truncate">{corretor.equipe || "Sem equipe"}</p>
        </div>
      </div>

      {/* Chips + botão adicionar */}
      <div className="flex-1 flex flex-wrap items-center gap-1.5 min-w-0">
        {isEmpty && (
          <span className="inline-flex items-center gap-1 text-xs text-destructive">
            <AlertCircle className="h-3.5 w-3.5" /> Sem alocação
          </span>
        )}
        {draft.map((id) => {
          const emp = empMap.get(id);
          const inativo = !ativosSet.has(id);
          const nome = emp?.nome ?? "Empreendimento removido";
          return (
            <Badge
              key={id}
              variant={inativo ? "outline" : "secondary"}
              className={
                inativo
                  ? "text-[11px] gap-1 pr-1 text-muted-foreground border-dashed"
                  : "text-[11px] gap-1 pr-1"
              }
              title={inativo ? "Empreendimento inativo — não será salvo" : undefined}
            >
              {nome}{inativo ? " (inativo)" : ""}
              {canEdit && (
                <button
                  type="button"
                  onClick={() => setDraft(draft.filter((d) => d !== id))}
                  className="hover:text-destructive"
                  aria-label={`Remover ${nome}`}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </Badge>
          );
        })}
        {canEdit && (
          <EmpreendimentoMultiSelect
            options={options}
            value={draft}
            onChange={setDraft}
            triggerLabel="+ Empreendimento"
          />
        )}
      </div>

      {/* Resumo 30d */}
      <div className="flex items-center gap-3 text-[11px] text-muted-foreground shrink-0 md:w-52 md:justify-end">
        <span>Leads <b className="text-foreground">{perfSummary?.leads ?? 0}</b></span>
        <span>Vis. Real. <b className="text-foreground">{perfSummary?.visitasRealizadas ?? 0}</b></span>
        <span>Vendas <b className="text-foreground">{perfSummary?.vendas ?? 0}</b></span>
      </div>

      {/* Save */}
      {canEdit && (
        <div className="shrink-0">
          <Button
            size="sm"
            variant={dirty ? "default" : "outline"}
            disabled={!dirty || saving}
            onClick={() => onSave(draftAtivos)}
            className="h-7 text-xs gap-1"
          >
            <Save className="h-3 w-3" /> Salvar
          </Button>
        </div>
      )}
    </div>
  );
}
