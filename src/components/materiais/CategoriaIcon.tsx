import {
  Presentation,
  HardDrive,
  Table2,
  CalendarCheck,
  Image as ImageIcon,
  Video as VideoIcon,
  FileText,
  Megaphone,
  MessageCircle,
  Link2,
  type LucideIcon,
} from "lucide-react";

// Catálogo único de categorias do Hub de Materiais.
// Ordem = ordem preferida de exibição na página do empreendimento.
export const CATEGORIAS = [
  { value: "apresentacao_book",     label: "Apresentação - Book",     icon: Presentation },
  { value: "drive_construtora",     label: "Drive Construtora",       icon: HardDrive },
  { value: "tabela",                label: "Tabela",                  icon: Table2 },
  { value: "disponibilidade",       label: "Disponibilidade",         icon: CalendarCheck },
  { value: "imagens",               label: "Imagens",                 icon: ImageIcon },
  { value: "videos",                label: "Vídeos",                  icon: VideoIcon },
  { value: "script_atendimento",    label: "Script de Atendimento",   icon: FileText },
  { value: "anuncio_no_ar",         label: "Anúncio no Ar",           icon: Megaphone },
  { value: "whatsapp_responsavel",  label: "Whatsapp do responsável", icon: MessageCircle },
  { value: "outros",                label: "Outros",                  icon: Link2 },
] as const;

export type CategoriaMaterial = typeof CATEGORIAS[number]["value"];

const CATEGORIA_ORDER: Record<string, number> = CATEGORIAS.reduce((acc, c, i) => {
  acc[c.value] = i;
  return acc;
}, {} as Record<string, number>);

export const CATEGORIA_MAP: Record<string, { label: string; icon: LucideIcon }> =
  CATEGORIAS.reduce((acc, c) => {
    acc[c.value] = { label: c.label, icon: c.icon };
    return acc;
  }, {} as Record<string, { label: string; icon: LucideIcon }>);

export function getCategoriaInfo(value: string) {
  return CATEGORIA_MAP[value] ?? { label: "Outros", icon: Link2 };
}

export function getCategoriaOrder(value: string): number {
  return CATEGORIA_ORDER[value] ?? 999;
}
