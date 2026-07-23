import { useMemo } from "react";
import { Building2, Star } from "lucide-react";
import type { MaterialEmpreendimento } from "@/hooks/useMateriais";
import { cn } from "@/lib/utils";

interface Props {
  empreendimentos: MaterialEmpreendimento[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  favIds?: Set<string>;
  filterText?: string;
}

export function MateriaisSidebar({ empreendimentos, selectedId, onSelect, favIds, filterText }: Props) {
  const filtered = useMemo(() => {
    const query = (filterText ?? "").trim().toLowerCase();
    if (!query) return empreendimentos;
    return empreendimentos.filter((e) => e.nome.toLowerCase().includes(query));
  }, [empreendimentos, filterText]);

  const favoritos = useMemo(
    () => filtered.filter((e) => favIds?.has(e.id)),
    [filtered, favIds],
  );
  const outros = useMemo(
    () => filtered.filter((e) => !favIds?.has(e.id)),
    [filtered, favIds],
  );

  return (
    <div className="flex flex-col h-full bg-muted/20">
      <div className="flex-1 overflow-y-auto p-1.5">
        {favoritos.length > 0 && (
          <div className="mb-1">
            {favoritos.map((emp) => (
              <SidebarItem
                key={emp.id}
                emp={emp}
                active={selectedId === emp.id}
                isFav
                onClick={() => onSelect(emp.id)}
              />
            ))}
            {outros.length > 0 && <div className="my-1 border-t border-border/40" />}
          </div>
        )}
        {outros.map((emp) => (
          <SidebarItem
            key={emp.id}
            emp={emp}
            active={selectedId === emp.id}
            onClick={() => onSelect(emp.id)}
          />
        ))}

        {filtered.length === 0 && (
          <div className="text-center text-xs text-muted-foreground py-8 px-4">
            Nenhum empreendimento.
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
        "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-colors relative",
        active
          ? "bg-primary/10 text-foreground"
          : "hover:bg-muted/60 text-foreground/90",
      )}
    >
      {active && (
        <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r bg-primary" />
      )}
      {emp.logo_url ? (
        <img
          src={emp.logo_url}
          alt=""
          className="h-7 w-7 rounded object-cover border border-border/60 flex-shrink-0"
        />
      ) : (
        <div className="h-7 w-7 rounded bg-muted flex items-center justify-center flex-shrink-0">
          <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <p className="text-sm font-medium truncate leading-tight">{emp.nome}</p>
          {isFav && <Star className="h-3 w-3 fill-yellow-500 text-yellow-500 flex-shrink-0" />}
        </div>
        <p className="text-[10px] text-muted-foreground leading-tight">
          {emp.links.length} {emp.links.length === 1 ? "material" : "materiais"}
        </p>
      </div>
    </button>
  );
}
