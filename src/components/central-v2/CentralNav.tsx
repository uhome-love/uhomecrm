import { cn } from "@/lib/utils";
import { CENTRAL_SECTIONS, type CentralSection, type CentralSectionId } from "./sections";

interface Props {
  active: CentralSectionId;
  onSelect: (id: CentralSectionId) => void;
}

interface NavGroup {
  label: string;
  ids: CentralSectionId[];
}

const GROUPS: NavGroup[] = [
  { label: "Visão", ids: ["geral"] },
  { label: "Comercial", ids: ["pipeline-leads", "origem-segmento", "oferta-ativa", "visitas"] },
  { label: "Resultado", ids: ["negocios", "vendas"] },
  { label: "Equipe", ids: ["ranking"] },
];

function getSection(id: CentralSectionId): CentralSection {
  return CENTRAL_SECTIONS.find((s) => s.id === id)!;
}

/**
 * Navegação por grupos em pills (estilo Central de Roleta).
 * Scroll horizontal no mobile, divisores entre grupos no desktop.
 */
export function CentralNav({ active, onSelect }: Props) {
  return (
    <nav
      aria-label="Seções da Central de Relatórios"
      className="central-card flex items-center gap-1 overflow-x-auto p-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {GROUPS.map((g, gi) => (
        <div key={g.label} className="flex items-center gap-1">
          {gi > 0 && <span aria-hidden className="mx-1 h-6 w-px shrink-0 bg-border" />}
          {g.ids.map((id) => {
            const s = getSection(id);
            const Icon = s.icon;
            const isActive = id === active;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onSelect(id)}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "central-navpill",
                  isActive ? "central-navpill-active" : "central-navpill-idle"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" strokeWidth={1.85} />
                <span>{s.label}</span>
              </button>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
