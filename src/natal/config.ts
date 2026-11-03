// Campanha Natal Chave de Ouro — tudo de Natal fica em src/natal/.
// Para remover depois: apagar src/natal/, public/natal/ e os imports que apontam para cá.
import { todayBRT } from "@/lib/brtTime";

export const NATAL_INICIO = "2026-11-02";
export const NATAL_FIM = "2026-12-26";
export const CAMPANHA_INICIO = "2026-11-02";
export const CAMPANHA_FIM = "2026-12-18";

/** Ritmo médio Uhome (mai–out/2026). */
export const TICKET_MEDIO = 649000;
export const VISITAS_POR_VENDA = 13.4;

export const isNatal = (hoje: string = todayBRT()): boolean =>
  hoje >= NATAL_INICIO && hoje <= NATAL_FIM;

/** Dias corridos de hoje (BRT) até 18/12; nunca negativo. */
export function diasAte18(hoje: string = todayBRT()): number {
  const a = Date.UTC(+hoje.slice(0, 4), +hoje.slice(5, 7) - 1, +hoje.slice(8, 10));
  const b = Date.UTC(2026, 11, 18);
  return Math.max(0, Math.round((b - a) / 86400000));
}

const CHAVE_EFEITOS = "uhome_natal_efeitos";
export const EVENTO_EFEITOS = "natal-efeitos-mudou";

export function efeitosLigados(): boolean {
  try {
    return localStorage.getItem(CHAVE_EFEITOS) !== "off";
  } catch {
    return true;
  }
}

export function setEfeitos(ligado: boolean) {
  try {
    localStorage.setItem(CHAVE_EFEITOS, ligado ? "on" : "off");
  } catch {
    /* sem localStorage: ignora */
  }
  window.dispatchEvent(new Event(EVENTO_EFEITOS));
}
