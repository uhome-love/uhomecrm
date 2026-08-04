/**
 * Fonte única de empreendimentos usados nos seletores da Oferta Ativa
 * (ScriptPanel, HomiObjectionHelper, FichaRapida).
 *
 * Antes existiam 3 listas hardcoded e divergentes espalhadas pelos componentes.
 * Consolidadas aqui para evitar divergência. Mantida ordenada alfabeticamente.
 */
export const EMPREENDIMENTOS: string[] = [
  "Alfa",
  "Alto Lindóia",
  "Avulso",
  "Avulso Canoas",
  "Boa Vista",
  "Boa Vista Country Club",
  "Botanique",
  "Casa Bastian",
  "Casa Tua Canoas",
  "Casa Tua Porto Alegre",
  "Connect JW",
  "Duetto",
  "Essenza Club",
  "Flow",
  "Go Carlos Bosque",
  "Go Carlos Gomes",
  "High Garden Iguatemi",
  "High Garden Rio Branco",
  "Lake Baikal",
  "Lake Eyre",
  "Las Casas",
  "Me Day",
  "Melnick Day",
  "Nilo Square",
  "Open Bosque",
  "Orygem",
  "Pontal",
  "Prime Wish",
  "Salzburg",
  "San Andreas",
  "Seen Menino Deus",
  "Seen Três Figueiras",
  "Shift",
  "Supreme",
  "Terrace",
  "The Arch",
  "Vista Menino Deus",
  "Vivid",
  "Vivid Terrace",
  "Vértice",
];

/**
 * Allowlist de produtos permitidos como FOCO DETALHADO do HOMI.
 *
 * Fonte única do contrato de foco (workspace /homi e Oferta Ativa).
 * Não confundir com EMPREENDIMENTOS acima (lista comercial ampla da Oferta Ativa).
 *
 * Fora desta lista propositalmente, até validação oficial da ficha:
 * - "Átrio - ABF" (ficha insuficiente)
 * - "Melnick Day Alto Padrão" / "Melnick Day Compactos" / "Melnick Day Médio Padrão"
 *   (registros de evento/conteúdo vencido)
 */
export const HOMI_EMPREENDIMENTOS_FOCO: string[] = [
  "Casa Bastian",
  "Casa Tua",
  "Lake Eyre",
  "Las Casas",
  "Open Bosque",
  "Orygem",
  "Shift",
  "Vértice - Las Casas",
];

/**
 * Devolve o nome canônico do produto se ele estiver na allowlist de foco do HOMI
 * (correspondência exata, case-insensitive). Caso contrário, null.
 * Sem aliases, sem inferência.
 */
export function resolverFocoHomi(nome: unknown): string | null {
  if (typeof nome !== "string") return null;
  const alvo = nome.trim().toLowerCase();
  if (!alvo) return null;
  return HOMI_EMPREENDIMENTOS_FOCO.find((e) => e.toLowerCase() === alvo) ?? null;
}
