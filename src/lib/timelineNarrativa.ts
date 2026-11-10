// Regras da linha do tempo "Atendimento" da ficha do lead.
// Funções puras: não leem nem gravam nada no banco.

import {
  ArrowRightLeft, Briefcase, Circle, Mail, MapPin, MessageCircle, Phone, Repeat, StickyNote, Target, Undo2,
  type LucideIcon,
} from "lucide-react";

export type DirecaoEtapa = "avancou" | "voltou" | "mesma";

interface EtapaComOrdem {
  id: string;
  ordem?: number | null;
}

/** Compara a ordem das etapas. Sem ordem, usa a posição na lista (as etapas já vêm ordenadas). */
export function direcaoEtapa(stages: EtapaComOrdem[], deId?: string | null, paraId?: string | null): DirecaoEtapa {
  if (!deId || !paraId || deId === paraId) return "mesma";
  const ordem = (id: string) => {
    const i = stages.findIndex((s) => s.id === id);
    return i === -1 ? null : stages[i].ordem ?? i;
  };
  const de = ordem(deId);
  const para = ordem(paraId);
  if (de == null || para == null) return "avancou";
  return para < de ? "voltou" : "avancou";
}

/** Título do item de mudança de etapa. */
export function tituloMudancaEtapa(direcao: DirecaoEtapa, etapaNova?: string | null): string {
  if (!etapaNova) return "Etapa atualizada";
  return direcao === "voltou" ? `Voltou para ${etapaNova}` : `Avançou para ${etapaNova}`;
}

/**
 * A caixa "Resultado da visita" só aparece para visita que aconteceu (ou não).
 * "Visita agendada" e mudança de data não são resultado.
 */
export function ehResultadoDeVisita(titulo?: string | null): boolean {
  const t = (titulo ?? "").toLowerCase();
  if (/agendad|marcad|data alterada|status alterado|reagend/.test(t)) return false;
  return /realizad|resultado|no.?show|n[ãa]o compareceu|compareceu/.test(t);
}

/** Dias inteiros entre duas datas ISO (a mais nova primeiro). */
export function diasEntre(maisNova: string, maisAntiga: string): number {
  const a = new Date(maisNova).getTime();
  const b = new Date(maisAntiga).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.floor(Math.abs(a - b) / 86_400_000);
}

/**
 * Buracos sem registro entre itens consecutivos da lista (ordem: mais recente primeiro).
 * Devolve um mapa: índice do item mais novo → dias até o item seguinte (mais antigo).
 * Ex.: { 0 => 9 } desenha "9 dias sem registro" logo abaixo do primeiro item.
 */
export function buracosSemRegistro<T extends { date: string }>(itensMaisRecentesPrimeiro: T[], minDias = 7): Map<number, number> {
  const buracos = new Map<number, number>();
  for (let i = 0; i < itensMaisRecentesPrimeiro.length - 1; i++) {
    const dias = diasEntre(itensMaisRecentesPrimeiro[i].date, itensMaisRecentesPrimeiro[i + 1].date);
    if (dias >= minDias) buracos.set(i, dias);
  }
  return buracos;
}

/** Ícone de traço para cada tipo de marco (substitui os emojis da Narrativa). */
export function iconeDoMarco(item: { title?: string | null; sourceType?: string | null }, direcao?: DirecaoEtapa): LucideIcon {
  const t = (item.title ?? "").toLowerCase();
  if (item.sourceType === "anotacao" || /nota|anota/.test(t)) return StickyNote;
  if (item.sourceType === "historico") return direcao === "voltou" ? Undo2 : ArrowRightLeft;
  if (/gerado|entrou|lead entrou|entrada/.test(t)) return Target;
  if (/ligaç|liga[rç]|telefon|atendeu/.test(t)) return Phone;
  if (/whats|mensagem/.test(t)) return MessageCircle;
  if (/e-mail|email/.test(t)) return Mail;
  if (/visita|tour|comparec/.test(t)) return MapPin;
  if (/proposta|neg[óo]cio|contrato|venda|ganho/.test(t)) return Briefcase;
  if (/follow|cad[êe]ncia/.test(t)) return Repeat;
  return Circle;
}
