/**
 * Trava de financiamento da Lia — confere CADA bolha antes de enviar ao cliente.
 * Arquivo puro (sem imports Deno): usado pela lia-chat e pelos testes do front.
 *
 * Se a bolha citar prazo em anos (fora "até 35 anos"), valor de parcela, taxa de juros
 * ou renda que não esteja na ficha, a bolha inteira é trocada pela FRASE_PADRAO.
 */

export const FRASE_PADRAO_FINANCIAMENTO =
  "O prazo pode chegar a 35 anos e varia conforme a idade e o cadastro. O especialista faz a simulação certinha pra você.";

/** Valores em reais citados no texto (R$ 7 mil, R$ 1.000, 7.000 reais). */
function valores(t: string): number[] {
  const out: number[] = [];
  const re = /(?:R\$\s?)(\d{1,3}(?:[.\s]\d{3})+|\d+(?:,\d+)?)\s?(mil|milh[ãa]o|milh[õo]es|mi)?/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t))) {
    const n = parseFloat(m[1].replace(/[.\s]/g, "").replace(",", "."));
    const u = (m[2] || "").toLowerCase();
    out.push(u === "mil" ? n * 1000 : u.startsWith("mi") ? n * 1_000_000 : n);
  }
  return out;
}

/** Valores que a ficha autoriza (qualquer R$ escrito nela). */
function valoresDaFicha(ficha: string): Set<number> {
  return new Set(valores(ficha).map(Math.round));
}

const RE_CONTEXTO_FIN = /(financi|prazo|parcel|banco|caixa|presta[çc]|idade|simula|cr[ée]dito|anos? para pagar|quitar)/i;
const RE_ANOS = /(\d{1,2})\s*(?:a|-|ou|e)?\s*(\d{1,2})?\s*anos/gi;
const RE_TAXA = /(\d+[,.]?\d*\s?%[^.!?]{0,30}(juros|a\.?a|ao ano|ao m[êe]s|a\.?m)|(juros|taxa)[^.!?]{0,40}\d+[,.]?\d*\s?%)/i;
const RE_PARCELA = /(parcela|presta[çc][ãa]o|por m[êe]s|mensal)/i;
const RE_RENDA = /(renda|sal[áa]rio|ganhar|ganha)/i;
/** Única referência de parcela permitida pelo Lucas: "a cada R$ 100 mil financiados, uns R$ 1.000 por mês". */
const RE_MEDIA_OK = /a cada R\$\s?100 mil/i;

export interface ResultadoTrava { texto: string; trocou: boolean; motivo?: string }

export function motivoTrava(bolha: string, ficha: string): string | null {
  const t = bolha;
  // prazo em anos fora "35 anos" (só em contexto de financiamento; ignora a idade que o cliente citou se vier sem contexto)
  if (RE_CONTEXTO_FIN.test(t)) {
    RE_ANOS.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = RE_ANOS.exec(t))) {
      const nums = [m[1], m[2]].filter(Boolean).map(Number);
      if (nums.some((n) => n !== 35)) {
        // "com 62 anos" repetindo a idade do cliente sem falar de prazo na mesma frase é aceito
        const frase = t.slice(Math.max(0, t.lastIndexOf(".", m.index) + 1), t.indexOf(".", m.index) === -1 ? t.length : t.indexOf(".", m.index));
        const soIdade = /(voc[êe]|tu) tem|com \d{1,2} anos|sua idade|de idade/i.test(frase) && !/(prazo|financ|pagar|limite|soma)/i.test(frase);
        if (!soIdade) return "prazo";
      }
    }
  }
  if (RE_TAXA.test(t)) return "taxa";
  const permitidos = valoresDaFicha(ficha);
  const fora = valores(t).filter((v) => !permitidos.has(Math.round(v)));
  if (RE_PARCELA.test(t) && !RE_MEDIA_OK.test(t) && fora.length) return "parcela";
  if (RE_RENDA.test(t) && fora.length) return "renda";
  return null;
}

/** Confere uma resposta completa (bolhas separadas por |||). Bolhas reprovadas viram a frase padrão (uma vez só). */
export function aplicarTravaFinanciamento(resposta: string, ficha: string): ResultadoTrava {
  const bolhas = resposta.split(/\s*\|\|\|\s*/);
  let trocou = false;
  let motivo: string | undefined;
  const out: string[] = [];
  for (const b of bolhas) {
    const limpa = b.replace(/\[\[[^\]]*\]\]/g, "");
    const mot = motivoTrava(limpa, ficha);
    if (mot) {
      trocou = true;
      motivo = motivo ?? mot;
      const marcadores = (b.match(/\[\[[^\]]*\]\]/g) ?? []).join(" ");
      if (!out.some((o) => o.startsWith(FRASE_PADRAO_FINANCIAMENTO))) out.push([FRASE_PADRAO_FINANCIAMENTO, marcadores].filter(Boolean).join(" "));
      else if (marcadores) out.push(marcadores);
    } else out.push(b);
  }
  return { texto: out.join("|||"), trocou, motivo };
}

/** Placeholder gravado pelo lia-whatsapp quando a transcrição do áudio falha. */
export const RE_AUDIO_SEM_TRANSCRICAO = /^\s*\(o cliente enviou (audio|voice)\b/i;
export const FRASE_AUDIO_FALHOU =
  "Vi que você mandou um áudio, mas ele não chegou certinho aqui do meu lado 😊 Pode me mandar de novo ou escrever?";
