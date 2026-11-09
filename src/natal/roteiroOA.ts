/** Roteiro de ligação da Oferta Ativa quando o empreendimento está na Campanha de Natal (até 18/12). */
import { EMPREENDIMENTOS, SCRIPTS } from "./central/conteudo";

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
/** Nomes de anúncio que pertencem a um produto da campanha. */
const APELIDOS: Record<string, string[]> = { "Golden Lake": ["lake eyre"] };
const FIM = "2026-12-18";
const doisHorarios = (t: string) => t.replace(/\[dia\] às \[hora\] ou \[dia\] às \[hora\]\?/g, "melhor durante a semana ou no sábado?");

export interface ObjecaoOA { emoji: string; label: string; resposta: string }

export function produtoNatal(empreendimento: string | null | undefined) {
  if (!empreendimento) return null;
  const e = norm(empreendimento);
  return EMPREENDIMENTOS.find((p) => {
    const nomes = [p.nome, ...(APELIDOS[p.nome] ?? [])].map(norm);
    return nomes.some((n) => e.includes(n) || n.includes(e));
  }) ?? null;
}

export function roteiroNatalOA(empreendimento: string | null | undefined, hojeISO: string): { modelo: string; produto: string; objecoes: ObjecaoOA[] } | null {
  if (hojeISO > FIM) return null;
  const p = produtoNatal(empreendimento);
  if (!p) return null;
  const condicao = p.gancho.split(" O melhor é você ver de perto.")[0];
  const modelo = `Oi {nome}, {eu}da Uhome 🎄 Tudo bem?\n\nLembrei de você porque o ${p.nome} entrou na nossa campanha de Natal: ${condicao}\n\nÉ a melhor condição do ano, e quem fecha até 18/12 ganha um presente de Natal da Uhome 🎁\n\nO melhor é você ver de perto. Fica melhor durante a semana ou no sábado?`;
  const script = (n: string) => SCRIPTS.find((s) => s.titulo.startsWith(n))?.texto ?? "";
  const objecoes: ObjecaoOA[] = [
    { emoji: "💰", label: "Está caro", resposta: doisHorarios(script("7.")) },
    { emoji: "📅", label: "Ano que vem", resposta: doisHorarios(script("6.")) },
    { emoji: "🤔", label: "Preciso pensar", resposta: "Faz todo sentido. Essa condição de fim de ano vale até 18/12 e, fechando, você ainda leva o seu presente de Natal 🎁 Que tal ver de perto sem compromisso? Melhor durante a semana ou no sábado?" },
    { emoji: "👫", label: "Falar com cônjuge", resposta: "Claro! O ideal é virem juntos conhecer. Qual dia fica melhor para os dois, durante a semana ou no sábado?" },
    { emoji: "🏠", label: "Já comprei", resposta: "Que bom, parabéns! Se puder me dizer onde comprou, eu tiro você da nossa lista. Conhece alguém que esteja procurando?" },
  ];
  return { modelo, produto: p.nome, objecoes };
}
