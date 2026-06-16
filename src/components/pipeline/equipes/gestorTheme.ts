/**
 * gestorTheme — mapa de cores por gestor (reusa os auth_ids de GERENTES_REAIS).
 *
 * Diretoria (Gabrielle) → indigo · Bruno → azul · Gabriel → verde.
 * Fallback neutro (slate) para qualquer gestor fora do mapa.
 * Apenas classes Tailwind — zero hex inline.
 */
export interface GestorTheme {
  ring: string;        // borda/realce do card
  bar: string;         // preenchimento da barra de meta
  accentText: string;  // texto de destaque
  avatarBg: string;    // fundo do fallback de avatar
  dot: string;         // bolinha identificadora
}

const THEMES: Record<string, GestorTheme> = {
  // Gabrielle Rodrigues — indigo
  "7882d73e-ff5c-4b23-9b08-2adeadcd1800": {
    ring: "border-indigo-300 dark:border-indigo-800",
    bar: "bg-indigo-500",
    accentText: "text-indigo-600 dark:text-indigo-400",
    avatarBg: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
    dot: "bg-indigo-500",
  },
  // Bruno Schuler — azul
  "fb61ecda-5c4b-49d7-bda7-ccf9b589da07": {
    ring: "border-blue-300 dark:border-blue-800",
    bar: "bg-blue-500",
    accentText: "text-blue-600 dark:text-blue-400",
    avatarBg: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    dot: "bg-blue-500",
  },
  // Gabriel Vieira — verde
  "b3a1c3a4-f109-40ae-b5d4-15eff3a541ab": {
    ring: "border-emerald-300 dark:border-emerald-800",
    bar: "bg-emerald-500",
    accentText: "text-emerald-600 dark:text-emerald-400",
    avatarBg: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
};

const FALLBACK: GestorTheme = {
  ring: "border-slate-200 dark:border-gray-700",
  bar: "bg-slate-500",
  accentText: "text-slate-600 dark:text-slate-400",
  avatarBg: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  dot: "bg-slate-400",
};

export function getGestorTheme(authId: string): GestorTheme {
  return THEMES[authId] ?? FALLBACK;
}
