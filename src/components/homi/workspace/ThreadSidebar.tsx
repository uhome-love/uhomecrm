import { Pin, PinOff, Archive, Trash2, Plus, MessageSquare, Search } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { HomiThread } from "@/hooks/useHomiThreads";

interface Props {
  threads: HomiThread[];
  activeId?: string;
  onSelect: (id: string) => void;
  onNew: () => void;
  onUpdate: (id: string, patch: Partial<HomiThread>) => void;
  onRemove: (id: string) => void;
}

export default function ThreadSidebar({ threads, activeId, onSelect, onNew, onUpdate, onRemove }: Props) {
  const [busca, setBusca] = useState("");
  const [mostrarArquivadas, setMostrarArquivadas] = useState(false);

  const visiveis = threads
    .filter(t => (mostrarArquivadas ? t.arquivada : !t.arquivada))
    .filter(t => !busca.trim() || (t.titulo || "").toLowerCase().includes(busca.toLowerCase()));

  return (
    <div className="flex h-full flex-col gap-3 p-3">
      <Button onClick={onNew} className="w-full justify-start gap-2" size="sm">
        <Plus className="h-4 w-4" /> Nova conversa
      </Button>

      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar conversa"
          className="h-8 pl-8 text-xs"
        />
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto">
        {visiveis.length === 0 && (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">
            {mostrarArquivadas ? "Nada arquivado." : "Sem conversas ainda."}
          </p>
        )}
        {grupos.map(([rotulo, itens]) => (
          <div key={rotulo} className="space-y-0.5">
            <p className="px-2 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">
              {rotulo}
            </p>
            {itens.map((t) => (
              <div
                key={t.id}
                className={cn(
                  "group relative flex items-center gap-1 rounded-lg py-1.5 pl-3 pr-1 text-sm transition-colors",
                  activeId === t.id
                    ? "bg-accent/60 text-accent-foreground before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-0.5 before:rounded-full before:bg-primary"
                    : "hover:bg-muted/60",
                )}
              >
                <button
                  type="button"
                  onClick={() => onSelect(t.id)}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                >
                  {t.pinned
                    ? <Pin className="h-3.5 w-3.5 shrink-0 text-primary" />
                    : <MessageSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />}
                  <span className="truncate">{t.titulo || "Conversa"}</span>
                </button>
                <div className="flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                  <Button
                    variant="ghost" size="icon" className="h-6 w-6"
                    title={t.pinned ? "Desafixar" : "Fixar"}
                    onClick={() => onUpdate(t.id, { pinned: !t.pinned })}
                  >
                    {t.pinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
                  </Button>
                  <Button
                    variant="ghost" size="icon" className="h-6 w-6"
                    title={t.arquivada ? "Desarquivar" : "Arquivar"}
                    onClick={() => onUpdate(t.id, { arquivada: !t.arquivada })}
                  >
                    <Archive className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost" size="icon" className="h-6 w-6 text-destructive"
                    title="Excluir"
                    onClick={() => onRemove(t.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>


      <Button
        variant="ghost" size="sm"
        className="justify-start gap-2 text-xs text-muted-foreground"
        onClick={() => setMostrarArquivadas(v => !v)}
      >
        <Archive className="h-3.5 w-3.5" />
        {mostrarArquivadas ? "Ver conversas ativas" : "Ver arquivadas"}
      </Button>
    </div>
  );
}
