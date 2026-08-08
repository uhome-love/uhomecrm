// Travas de saída da Lia.
//
// TODAS rodam DEPOIS do modelo e ANTES do envio. Proibição no prompt não é
// garantia: o que vale é o bloqueio em código sobre o texto final.
//
// Cada trava devolve `null` quando aprova, ou um objeto com código e detalhe
// quando reprova. O turno reprovado é gravado em ia_turnos com o motivo.

export type Trava = { codigo: string; detalhe: string };

// ── Áreas reais do Casa Tua Santos Ferreira (material aprovado) ────────────
// 3 dorm: construída 96,23 | total 157,51 a 170,74
// 4 dorm: construída 116,02 | total 176,30 a 210,51
export const AREAS_REAIS = [96.23, 116.02, 157.51, 170.74, 176.3, 210.51];

export const FRASES_PROIBIDAS = [
  "ainda tem interesse",
  "tentei contato e não obtive retorno",
  "tentei contato e nao obtive retorno",
  "você não apareceu",
  "voce nao apareceu",
];

function normaliza(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ── 1. Travessão bloqueado na saída ────────────────────────────────────────
export function travaTravessao(texto: string): Trava | null {
  const achado = /[—–]/.exec(texto);
  if (!achado) return null;
  return {
    codigo: "travessao",
    detalhe: `Texto contém travessão (${achado[0]}). O prompt proíbe; a saída bloqueia.`,
  };
}

// ── 2. Frases proibidas ────────────────────────────────────────────────────
export function travaFrasesProibidas(texto: string): Trava | null {
  const alvo = normaliza(texto);
  for (const frase of FRASES_PROIBIDAS) {
    if (alvo.includes(normaliza(frase))) {
      return { codigo: "frase_proibida", detalhe: `Frase proibida detectada: "${frase}".` };
    }
  }
  return null;
}

// ── 3. Arredondamento de metragem ──────────────────────────────────────────
// Só passa número de metragem que seja exatamente uma área real, ou um número
// redondo (múltiplo de 5) MENOR OU IGUAL à área real mais próxima.
// Pode falar 150; nunca 157; nunca nada acima da área real.
export function travaMetragem(texto: string): Trava | null {
  const regex = /(\d{2,4}(?:[.,]\d{1,2})?)\s*(?:m²|m2|metros quadrados|m\b)/gi;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(texto)) !== null) {
    const valor = Number(m[1].replace(",", "."));
    if (!Number.isFinite(valor) || valor < 30) continue; // não é metragem de casa

    const exata = AREAS_REAIS.some((a) => Math.abs(a - valor) < 0.005);
    if (exata) continue;

    const referencia = AREAS_REAIS.reduce((prev, cur) =>
      Math.abs(cur - valor) < Math.abs(prev - valor) ? cur : prev
    );

    if (valor > referencia) {
      return {
        codigo: "metragem_inflada",
        detalhe: `"${m[1]}m²" é maior que a área real de referência (${referencia}m²).`,
      };
    }
    if (valor % 5 !== 0) {
      return {
        codigo: "metragem_arredondamento",
        detalhe: `"${m[1]}m²" não é área real nem número redondo. Use a área real ou arredonde para baixo (ex.: 150).`,
      };
    }
  }
  return null;
}

// ── 4. Mensagem repetida ───────────────────────────────────────────────────
export function travaRepeticao(texto: string, jaEnviadas: string[]): Trava | null {
  const alvo = normaliza(texto);
  if (!alvo) return null;
  const repetida = jaEnviadas.some((t) => normaliza(t || "") === alvo);
  if (!repetida) return null;
  return {
    codigo: "mensagem_repetida",
    detalhe: "Texto idêntico a mensagem já enviada para este lead.",
  };
}

// ── 5. Horário escrito pelo modelo ─────────────────────────────────────────
// Qualquer horário no texto precisa vir da lista de slots gerada pelo sistema.
// A janela de agenda sozinha não pega "hoje às 18h" escrito às 21h02: o
// problema é o texto, não o slot.
export function extrairHorarios(texto: string): string[] {
  const achados: string[] = [];
  const regex = /\b(\d{1,2})\s*(?::|h)\s*(\d{2})?\b/gi;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(texto)) !== null) {
    const hora = Number(m[1]);
    if (!Number.isFinite(hora) || hora > 23) continue;
    const bruto = m[0].toLowerCase();
    // "10:30" sem "h" e sem contexto de hora pode ser outra coisa; só aceita
    // formatos com ":" ou "h", que é o que a regex já garante.
    const minuto = m[2] ? Number(m[2]) : 0;
    if (minuto > 59) continue;
    achados.push(`${String(hora).padStart(2, "0")}:${String(minuto).padStart(2, "0")}`);
    void bruto;
  }
  return achados;
}

export function travaHorarioNaoOfertado(
  texto: string,
  horariosOfertados: string[],
): Trava | null {
  const ofertados = new Set(
    horariosOfertados.map((h) => {
      const [hh, mm] = String(h).split(":");
      return `${String(Number(hh)).padStart(2, "0")}:${String(Number(mm ?? 0)).padStart(2, "0")}`;
    }),
  );
  for (const h of extrairHorarios(texto)) {
    if (!ofertados.has(h)) {
      return {
        codigo: "horario_nao_ofertado",
        detalhe: `Horário "${h}" não veio da lista gerada pelo sistema (${
          [...ofertados].join(", ") || "nenhum slot gerado"
        }).`,
      };
    }
  }
  return null;
}

// ── 6. Linhas vermelhas ────────────────────────────────────────────────────
export function travaLinhasVermelhas(texto: string): Trava | null {
  const alvo = normaliza(texto);

  // Negar ser IA de forma enganosa.
  const negaIa = [
    "nao sou um robo",
    "nao sou robo",
    "nao sou uma ia",
    "sou humana de verdade",
    "sou uma pessoa de verdade",
  ];
  if (negaIa.some((f) => alvo.includes(f))) {
    return { codigo: "linha_vermelha_robo", detalhe: "Texto nega ser IA de forma enganosa." };
  }

  // Pedido de documento / CPF / RG.
  const pedeDoc = /\b(cpf|rg|cnh|numero do documento|documento de identidade)\b/;
  if (pedeDoc.test(alvo)) {
    return { codigo: "linha_vermelha_documento", detalhe: "Texto pede documento/CPF." };
  }

  return null;
}

// ── Orquestrador ───────────────────────────────────────────────────────────
export type ContextoTravas = {
  mensagensEnviadas: string[];
  horariosOfertados: string[];
};

export function avaliarTravasDeSaida(texto: string, ctx: ContextoTravas): Trava[] {
  const reprovas: Trava[] = [];
  const checks = [
    travaLinhasVermelhas(texto),
    travaTravessao(texto),
    travaFrasesProibidas(texto),
    travaMetragem(texto),
    travaRepeticao(texto, ctx.mensagensEnviadas),
    travaHorarioNaoOfertado(texto, ctx.horariosOfertados),
  ];
  for (const c of checks) if (c) reprovas.push(c);
  return reprovas;
}
