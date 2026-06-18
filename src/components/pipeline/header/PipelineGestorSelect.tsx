/**
 * PipelineGestorSelect — Filtro "por gestor" exclusivo do CEO/Admin.
 *
 * Lista de gestores agora é DINÂMICA (useGestoresPipeline): busca os gerentes
 * reais de team_members + nomes de profiles. A constante GERENTES_REAIS é mantida
 * apenas como fallback estático (usada pelo hook e por gestorTheme/ScopeBadge).
 */
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useGestoresPipeline } from "@/hooks/useGestoresPipeline";

export const GERENTES_REAIS = [
  { id: "fb61ecda-5c4b-49d7-bda7-ccf9b589da07", nome: "Bruno Schuler", apelido: "Bruno" },
  { id: "b3a1c3a4-f109-40ae-b5d4-15eff3a541ab", nome: "Gabriel Vieira", apelido: "Gabriel" },
  { id: "7a270cc1-a457-4a02-8a62-462ba5a98937", nome: "Junior Padilha", apelido: "Junior" },
] as const;

export type GestorFilterValue = "todos" | (typeof GERENTES_REAIS)[number]["id"];

export interface PipelineGestorSelectProps {
  value: string;
  onChange: (v: string) => void;
  variant?: "compact" | "desktop";
}

export default function PipelineGestorSelect({
  value,
  onChange,
  variant = "desktop",
}: PipelineGestorSelectProps) {
  const { data: gestores } = useGestoresPipeline();
  const lista = gestores && gestores.length > 0 ? gestores : GERENTES_REAIS;
  const active = value !== "todos";
  const triggerCls =
    variant === "compact"
      ? `h-7 text-[10px] w-[120px] shrink-0 rounded-[7px] font-semibold ${
          active
            ? "border-violet-300 dark:border-violet-800 bg-violet-50 dark:bg-violet-950 text-violet-700 dark:text-violet-300"
            : "border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-slate-500 dark:text-slate-400"
        }`
      : `h-[32px] text-[12px] max-w-[170px] min-w-[140px] shrink rounded-lg font-medium truncate ${
          active
            ? "border-violet-500 bg-violet-50 dark:bg-violet-950 text-violet-700 dark:text-violet-300"
            : "border-[#e8e8f0] dark:border-white/[0.07] bg-[#f7f7fb] dark:bg-white/[0.04] text-[#52525b] dark:text-[#a1a1aa]"
        }`;

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={triggerCls} aria-label="Filtrar por gestor">
        <SelectValue placeholder="Filtrar por gestor" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="todos">Todos gestores</SelectItem>
        {lista.map((g) => (
          <SelectItem key={g.id} value={g.id}>{g.nome}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
