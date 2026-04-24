import {
  HardDrive,
  Presentation,
  Table2,
  CalendarCheck,
  FileText,
  Headphones,
  Link2,
  type LucideIcon,
} from "lucide-react";

export const CATEGORIAS = [
  { value: "drive_construtora", label: "Drive da construtora", icon: HardDrive },
  { value: "apresentacao",      label: "Apresentação",         icon: Presentation },
  { value: "tabela_vendas",     label: "Tabela de vendas",     icon: Table2 },
  { value: "disponibilidade",   label: "Disponibilidade",      icon: CalendarCheck },
  { value: "script_vendas",     label: "Script de vendas",     icon: FileText },
  { value: "material_atendimento", label: "Material de atendimento", icon: Headphones },
  { value: "outros",            label: "Outros",               icon: Link2 },
] as const;

export type CategoriaMaterial = typeof CATEGORIAS[number]["value"];

export const CATEGORIA_MAP: Record<string, { label: string; icon: LucideIcon }> =
  CATEGORIAS.reduce((acc, c) => {
    acc[c.value] = { label: c.label, icon: c.icon };
    return acc;
  }, {} as Record<string, { label: string; icon: LucideIcon }>);

export function getCategoriaInfo(value: string) {
  return CATEGORIA_MAP[value] ?? { label: "Outros", icon: Link2 };
}
