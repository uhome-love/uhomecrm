import { Link } from "react-router-dom";
import { UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { CENTRAL_SECTIONS, type CentralSectionId } from "./sections";

interface Props {
  secaoAtiva: CentralSectionId;
  onSelect: (id: CentralSectionId) => void;
}

export function CentralSidebar({ secaoAtiva, onSelect }: Props) {
  const grupo1 = CENTRAL_SECTIONS.slice(0, 1); // Geral
  const grupo2 = CENTRAL_SECTIONS.slice(1, 6); // Pipeline → Vendas
  const grupo3 = CENTRAL_SECTIONS.slice(6);    // Ranking

  return (
    <nav className="flex h-full flex-col gap-1 p-3" aria-label="Seções da Central de Relatórios">
      <SectionGroup items={grupo1} active={secaoAtiva} onSelect={onSelect} />
      <Divider />
      <SectionGroup items={grupo2} active={secaoAtiva} onSelect={onSelect} />
      <Divider />
      <SectionGroup items={grupo3} active={secaoAtiva} onSelect={onSelect} />

      <div className="mt-auto pt-3">
        <Divider />
        <Link
          to="/relatorios-1-1"
          className="mt-2 flex items-center gap-2.5 rounded-[10px] px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <UserRound className="h-4 w-4" strokeWidth={1.75} />
          <span>1:1 Corretor</span>
        </Link>
      </div>
    </nav>
  );
}

function Divider() {
  return <div className="my-1 h-px bg-border" />;
}

function SectionGroup({
  items,
  active,
  onSelect,
}: {
  items: typeof CENTRAL_SECTIONS;
  active: CentralSectionId;
  onSelect: (id: CentralSectionId) => void;
}) {
  return (
    <ul className="flex flex-col gap-0.5">
      {items.map((s) => {
        const Icon = s.icon;
        const isActive = s.id === active;
        return (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => onSelect(s.id)}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "group relative flex w-full items-center gap-2.5 rounded-[10px] px-3 py-2 text-left text-sm transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
                s.highlight &&
                  !isActive &&
                  "bg-gradient-to-r from-primary/[0.06] to-transparent text-foreground"
              )}
            >
              {isActive && (
                <span
                  aria-hidden
                  className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r bg-primary"
                />
              )}
              <Icon
                className={cn("h-4 w-4 shrink-0", s.highlight && !isActive && "text-primary")}
                strokeWidth={1.75}
              />
              <span className={cn("truncate", isActive && "font-medium")}>{s.label}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
