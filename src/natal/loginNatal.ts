import { isNatal } from "./config";

/** Textos/imagens do login no período de Natal. Remover junto com a pasta src/natal. */
export function loginNatal() {
  if (!isNatal()) return null;
  return {
    selo: "Missão de Natal · até 18/12",
    balao: "Bora fechar o ano com chave de ouro?",
    homi: "/natal/homi_noel.png",
    homiAlt: "Homi com gorro de Natal",
  };
}
