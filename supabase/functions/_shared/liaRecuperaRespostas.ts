/** Decisões puras compartilhadas por conversa real, Laboratório e testes. */
export type AcaoResposta = "opt_out" | "ja_comprou" | "seguir";
export const normalizarTexto = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();

export function classificarResposta(texto: string, payload?: string | null): AcaoResposta {
  const p = normalizarTexto(payload ?? "");
  // Identificador, não rótulo visual nem índice 0/1/2 (ambíguo entre campanhas).
  if (/^(lia )?(recupera )?(opt out|optout|stop|sair|nao quero mais contato)$/.test(p)) return "opt_out";
  const t = normalizarTexto(texto);
  if (/\b(nao quero (mais )?(contato|receber|falar com voces)|nao me (mande|mandem|envie|enviem)|para de (me )?(mandar|enviar)|pare de (me )?(mandar|enviar)|me (tira|tire|remove|remova) (da|dessa) lista|sair da lista|remover da lista|descadastr|me bloqueia)\b/.test(t) || /^(stop|cancelar mensagens)$/.test(t)) return "opt_out";
  if (/\b(ja (comprei|compramos|adquiri|adquirimos)|comprei (um |uma |o |a )?(imovel|apartamento|apto|casa))\b/.test(t) && !/\b(nao|ainda nao|nunca) (comprei|compramos|adquiri)\b/.test(t)) return "ja_comprou";
  return "seguir";
}

export function encerramento(acao: AcaoResposta): string | null {
  if (acao === "opt_out") return "Tudo bem, vou encerrar por aqui e não enviar mais mensagens. Obrigada por avisar!";
  if (acao === "ja_comprou") return "Parabéns pela compra! Vou encerrar os envios por aqui. Felicidades nessa nova etapa!";
  return null;
}

/** Só pedido novo explícito, nunca resposta a disparo antigo ou simples 'oi/ok'. */
export function novoContatoWhatsApp(texto: string, contexto?: string | null, payload?: string | null): boolean {
  if (contexto || payload || classificarResposta(texto) !== "seguir") return false;
  return /\b(quero (voltar|retomar|comprar|conhecer|informacoes)|voltei a procurar|estou procurando|gostaria de (comprar|informacoes)|mudei de ideia.*(imovel|comprar|procurar))\b/.test(normalizarTexto(texto));
}

/** 30 minutos úteis, seg–sáb, 09h inclusivo/20h exclusivo, BRT. */
export function prazoReaviso(entrada: Date): Date {
  let restante = 30 * 60_000;
  let t = entrada.getTime();
  while (restante > 0) {
    const b = new Date(t - 3 * 3600_000);
    const h = b.getUTCHours() * 60 + b.getUTCMinutes();
    if (b.getUTCDay() === 0 || h < 540 || h >= 1200) {
      if (b.getUTCDay() === 0 || h >= 1200) b.setUTCDate(b.getUTCDate() + 1);
      b.setUTCHours(9, 0, 0, 0);
      t = b.getTime() + 3 * 3600_000;
      continue;
    }
    const fim = new Date(b); fim.setUTCHours(20, 0, 0, 0);
    const passo = Math.min(restante, fim.getTime() + 3 * 3600_000 - t);
    restante -= passo; t += passo;
  }
  return new Date(t);
}