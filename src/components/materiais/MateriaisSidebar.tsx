import { useMemo, useState } from "react";
import { Building2, Search, Star } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { MaterialEmpreendimento } from "@/hooks/useMateriais";
import { cn } from "@/lib/utils";

interface Props {
  empreendimentos: MaterialEmpreendimento[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  favIds?: Set<string>;
}

export function MateriaisSidebar({ empreendimentos, selectedId, onSelect, favIds }: Props) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return empreendimentos;
    return empreendimentos.filter((e) => e.nome.toLowerCase().includes(query));
  }, [empreendimentos, q]);

  const favoritos = useMemo(
    () => filtered.filter((e) => favIds?.has(e.id)),
    [filtered, favIds],
  );
  const outros = useMemo(
    () => filtered.filter((e) => !favIds?.has(e.id)),
    [filtered, favIds],
  );

  return (
    <div className="flex flex-col h-full bg-muted/20 border-r border-border/60">
      {/* Busca */}
      <div className="p-3 border-b border-border/40">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar empreendimento..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-8 h-9 text-sm bg-background"
          />
        </div>
        <p className="text-[11px] text-muted-foreground mt-2 px-1">
          {empreendimentos.length} {empreendimentos.length === 1 ? "empreendimento" : "empreendimentos"}
        </p>
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto p-2 space-y-4">
        {favoritos.length > 0 && (
          <div>
            <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" /> Favoritos
            </div>
            <div className="space-y-0.5 mt-1">
              {favoritos.map((emp) => (
                <SidebarItem
                  key={emp.id}
                  emp={emp}
                  active={selectedId === emp.id}
                  isFav
                  onClick={() => onSelect(emp.id)}
                />
              ))}
            </div>
          </div>
        )}

        <div>
          {favoritos.length > 0 && outros.length > 0 && (
            <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Todos
            </div>
          )}
          <div className="space-y-0.5 mt-1">
            {outros.map((emp) => (
              <SidebarItem
                key={emp.id}
                emp={emp}
                active={selectedId === emp.id}
                onClick={() => onSelect(emp.id)}
              />
            ))}
          </div>
        </div>

        {filtered.length === 0 && (
          <div className="text-center text-xs text-muted-foreground py-8 px-4">
            Nenhum empreendimento encontrado.
          </div>
        )}
      </div>
    </div>
  );
}

function SidebarItem({
  emp,
  active,
  isFav,
  onClick,
}: {
  emp: MaterialEmpreendimento;
  active: boolean;
  isFav?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={emp.nome}
      className={cn(
        "w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-left transition-colors",
        active
          ? "bg-primary/10 text-foreground ring-1 ring-primary/30"
          : "hover:bg-muted/60 text-foreground/90",
      )}
    >
      {emp.logo_url ? (
        <img
          src={emp.logo_url}
          alt=""
          className="h-9 w-9 rounded-md object-cover border border-border/60 flex-shrink-0"
        />
      ) : (
        <div className="h-9 w-9 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
          <Building2 className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <p className="text-sm font-medium truncate">{emp.nome}</p>
          {isFav && <Star className="h-3 w-3 fill-yellow-500 text-yellow-500 flex-shrink-0" />}
        </div>
        <p className="text-[11px] text-muted-foreground">
          {emp.links.length} {emp.links.length === 1 ? "material" : "materiais"}
        </p>
      </div>
    </button>
  );
}
