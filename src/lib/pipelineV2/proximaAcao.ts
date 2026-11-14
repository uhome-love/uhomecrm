// ─────────────────────────────────────────────────────────────────
// pipelineV2/proximaAcao — decide o que o card mostra como "próxima ação"
// e qual botão aparece para fazer a ação. Funções puras, com testes.
//
// Regras (mesma lógica de status do CardMinimal, em BRT):
//   • atrasada: vence_em antes de hoje, ou hoje com hora já passada
//   • hoje: vence hoje, hora ainda não passou (ou sem hora)
//   • futura: vence depois de hoje
//   • sem: nenhuma tarefa pendente (fora Novo Lead e Sem Contato)
// ─────────────────────────────────────────────────────────────────

export interface TarefaV2 {
  id?: string;
  titulo?: string;
  tipo: string | null;
  subtipo?: string | null;
  vence_em: string | null; // YYYY-MM-DD
  hora_vencimento: string | null; // HH:MM[:SS]
  origem?: string | null;
}

export interface CadenciaV2 {
  tentativa: number;
  proxima_em: string | null; // ISO
}

export type TomAcao = "atrasada" | "hoje" | "visita" | "futura" | "atencao" | "sem" | "nenhum";
export type BotaoAcao = "whats" | "ligar" | "confirmar" | "concluir" | "definir" | "virar" | null;
export type StatusTarefa = "atrasada" | "hoje" | "futura" | "sem" | "terminal";

export interface ProximaAcaoV2 {
  tom: TomAcao;
  emoji: string;
  titulo: string;
  quando: string;
  botao: BotaoAcao;
}

/** Etapas sem fluxo de tarefa no card. */
export const ETAPAS_TERMINAIS = new Set(["venda", "descarte", "caiu", "convertido"]);
/** Etapas em que "sem próxima ação" é um problema a mostrar e contar. */
export const ETAPAS_COM_PROXIMA_ACAO = new Set(["qualificacao", "aquecimento", "visita", "pos_visita", "documentacao", "proposta", "contrato_gerado"]);

const DIAS_SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

export function hojeBRT(agora: Date = new Date()): string {
  return agora.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

export function horaAgoraBRT(agora: Date = new Date()): string {
  return agora.toLocaleTimeString("en-GB", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
}

function diffDias(deISO: string, ateISO: string): number {
  const [y1, m1, d1] = deISO.split("-").map(Number);
  const [y2, m2, d2] = ateISO.split("-").map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}

function ddmm(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

/** "15:00:00" → "15h"; "09:56" → "9h56". */
export function horaCurta(hora: string | null | undefined): string {
  if (!hora) return "";
  const [h, m] = hora.split(":");
  const hh = String(Number(h));
  return m && m !== "00" ? `${hh}h${m}` : `${hh}h`;
}

export function statusTarefa(
  tarefa: TarefaV2 | null | undefined,
  stageTipo: string | null | undefined,
  hoje: string = hojeBRT(),
  agoraHHMM: string = horaAgoraBRT(),
): StatusTarefa {
  if (stageTipo && ETAPAS_TERMINAIS.has(stageTipo)) return "terminal";
  if (!tarefa?.vence_em) return "sem";
  if (tarefa.vence_em < hoje) return "atrasada";
  if (tarefa.vence_em === hoje) {
    if (tarefa.hora_vencimento && tarefa.hora_vencimento.slice(0, 5) < agoraHHMM) return "atrasada";
    return "hoje";
  }
  return "futura";
}

/** Quando a tarefa vence, em texto curto. */
export function quandoTarefa(
  tarefa: TarefaV2 | null | undefined,
  hoje: string = hojeBRT(),
  agoraHHMM: string = horaAgoraBRT(),
): string {
  if (!tarefa?.vence_em) return "";
  const hora = horaCurta(tarefa.hora_vencimento);
  const d = diffDias(hoje, tarefa.vence_em);
  if (d < 0) {
    const n = -d;
    return `venceu ${ddmm(tarefa.vence_em)} · há ${n} ${n === 1 ? "dia" : "dias"}`;
  }
  if (d === 0) {
    const passou = tarefa.hora_vencimento && tarefa.hora_vencimento.slice(0, 5) < agoraHHMM;
    if (passou) return `venceu hoje · ${hora}`;
    return hora ? `hoje · ${hora}` : "hoje";
  }
  if (d === 1) return hora ? `amanhã · ${hora}` : "amanhã";
  const [y, m, dd] = tarefa.vence_em.split("-").map(Number);
  const semana = DIAS_SEMANA[new Date(Date.UTC(y, m - 1, dd)).getUTCDay()];
  const base = d <= 6 ? `${semana} ${ddmm(tarefa.vence_em)}` : ddmm(tarefa.vence_em);
  return hora ? `${base} · ${hora}` : base;
}

const VISITA_AUTO: Record<string, { titulo: string; botao: BotaoAcao }> = {
  confirmar_visita: { titulo: "Confirmar a visita", botao: "confirmar" },
  atualizar_visita: { titulo: "Atualizar a agenda", botao: "concluir" },
  agendar_visita: { titulo: "Agendar a visita", botao: "whats" },
  reagendar_visita: { titulo: "Remarcar a visita", botao: "whats" },
  pegar_feedback: { titulo: "Alinhar o pós-visita", botao: "whats" },
  decidir_descarte_visita: { titulo: "Decidir descarte", botao: "concluir" },
  definir_sequencia: { titulo: "Definir a próxima ação", botao: "concluir" },
};

type Categoria = "call" | "msg" | "followup" | "visit" | "outro";

function categoria(tipo: string | null | undefined): Categoria {
  const t = String(tipo ?? "").toLowerCase();
  if (t === "ligacao" || t === "ligar" || t.includes("ligaç")) return "call";
  if (t === "whatsapp" || t.includes("mensagem")) return "msg";
  if (t === "visita") return "visit";
  if (t.includes("follow")) return "followup";
  return "outro";
}

const EMOJI_CATEGORIA: Record<Categoria, string> = { call: "📞", msg: "💬", followup: "📨", visit: "📅", outro: "📝" };
const BOTAO_CATEGORIA: Record<Categoria, BotaoAcao> = { call: "ligar", msg: "whats", followup: "whats", visit: "confirmar", outro: "concluir" };

/**
 * Título curto da tarefa: sem o nome do lead, sem a data e sem o parêntese do fim.
 * "Alinhar próximos passos (Pós-Visita) — Leonardo Prado" → "Alinhar próximos passos"
 * "Tentativa 1: Ligar agora — Gerson Sperotto" → "Tentativa 1 · ligar agora"
 * "WhatsApp: Laís Barriles · 21/09" → "Mandar WhatsApp"
 */
export function tituloCurto(titulo: string | null | undefined, nomeLead?: string | null): string {
  let t = String(titulo ?? "").trim();
  if (!t) return "Tarefa";
  t = t.split(/\s+[—–]\s+/)[0] ?? t;
  if (nomeLead) {
    const nome = nomeLead.trim();
    if (nome) t = t.replace(new RegExp(`\\s*[-·:]?\\s*${nome.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "i"), "");
  }
  const tentativa = t.match(/^tentativa\s+(\d+)\s*:\s*(.+)$/i);
  if (tentativa) return `Tentativa ${tentativa[1]} · ${tentativa[2].trim().toLowerCase()}`;
  if (/^whats\s*app\s*:/i.test(t)) return "Mandar WhatsApp";
  if (/^liga(ção|r)\s*:/i.test(t)) return "Ligar";
  t = t.replace(/\s*·\s*\d{2}\/\d{2}\s*$/, "");
  t = t.replace(/\s*\([^)]*\)\s*$/, "").trim();
  return t || "Tarefa";
}

function chegouHa(desdeISO: string | null | undefined, agora: Date): { texto: string; horas: number } {
  if (!desdeISO) return { texto: "chegou agora", horas: 0 };
  const min = Math.max(0, Math.round((agora.getTime() - new Date(desdeISO).getTime()) / 60000));
  if (min < 60) return { texto: `chegou há ${min} min`, horas: min / 60 };
  const h = Math.round(min / 60);
  if (h < 24) return { texto: `chegou há ${h}h`, horas: h };
  const d = Math.round(h / 24);
  return { texto: `chegou há ${d} ${d === 1 ? "dia" : "dias"}`, horas: h };
}

function quandoCadencia(proximaISO: string | null, agora: Date): { texto: string; minutos: number | null } {
  if (!proximaISO) return { texto: "sem data da próxima", minutos: null };
  const min = Math.round((new Date(proximaISO).getTime() - agora.getTime()) / 60000);
  if (min <= 0) return { texto: "era para agora", minutos: min };
  if (min < 60) return { texto: `próxima em ${min} min`, minutos: min };
  if (min < 1440) return { texto: `próxima em ${Math.round(min / 60)}h`, minutos: min };
  const d = Math.round(min / 1440);
  return { texto: `próxima em ${d} ${d === 1 ? "dia" : "dias"}`, minutos: min };
}

export interface EntradaProximaAcao {
  stageTipo: string | null | undefined;
  tarefa: TarefaV2 | null | undefined;
  cadencia?: CadenciaV2 | null;
  flagStatus?: Record<string, string> | null;
  nomeLead?: string | null;
  chegouEm?: string | null; // distribuido_em ?? created_at
  agora?: Date;
}

export function resolverProximaAcao(e: EntradaProximaAcao): ProximaAcaoV2 {
  const agora = e.agora ?? new Date();
  const hoje = hojeBRT(agora);
  const hhmm = horaAgoraBRT(agora);
  const tipo = e.stageTipo ?? "";

  if (ETAPAS_TERMINAIS.has(tipo)) return { tom: "nenhum", emoji: "", titulo: "", quando: "", botao: null };

  // Sem Contato com cadência: a tentativa é a próxima ação.
  if (tipo === "sem_contato" && e.cadencia) {
    const n = Math.min(7, (e.cadencia.tentativa ?? 0) + 1);
    const q = quandoCadencia(e.cadencia.proxima_em, agora);
    const tom: TomAcao = q.minutos !== null && q.minutos <= 0 ? "atrasada" : n >= 6 ? "atencao" : q.minutos !== null && q.minutos < 1440 ? "hoje" : "futura";
    const botao: BotaoAcao = e.tarefa ? BOTAO_CATEGORIA[categoria(e.tarefa.tipo)] === "ligar" ? "ligar" : "whats" : "ligar";
    return { tom, emoji: "📲", titulo: `Tentativa ${n} de 7`, quando: q.texto, botao };
  }

  // Novo lead sem tarefa: primeiro contato, com o tempo desde a chegada.
  if (tipo === "novo_lead" && !e.tarefa) {
    const c = chegouHa(e.chegouEm, agora);
    return { tom: c.horas >= 1 ? "atrasada" : "hoje", emoji: "📞", titulo: "Fazer o 1º contato", quando: c.texto, botao: "ligar" };
  }

  // Faltou na visita: remarcar.
  if (tipo === "visita" && e.flagStatus?.status_visita === "no_show" && (!e.tarefa || e.tarefa.subtipo === "reagendar_visita")) {
    return { tom: "atencao", emoji: "🔁", titulo: "Remarcar a visita", quando: e.tarefa ? quandoTarefa(e.tarefa, hoje, hhmm) : "faltou na visita", botao: "whats" };
  }

  if (e.tarefa) {
    const status = statusTarefa(e.tarefa, tipo, hoje, hhmm);
    const cat = categoria(e.tarefa.tipo);
    const auto = e.tarefa.origem === "visita_auto" && e.tarefa.subtipo ? VISITA_AUTO[e.tarefa.subtipo] : undefined;
    const titulo = auto?.titulo ?? tituloCurto(e.tarefa.titulo, e.nomeLead);
    const botao = auto?.botao ?? BOTAO_CATEGORIA[cat];
    const ehVisita = cat === "visit" || e.tarefa.subtipo === "confirmar_visita";
    const tom: TomAcao = status === "atrasada" ? "atrasada" : ehVisita ? "visita" : status === "hoje" ? "hoje" : "futura";
    const emoji = status === "atrasada" ? "⏰" : ehVisita ? "📅" : EMOJI_CATEGORIA[cat];
    return { tom, emoji, titulo, quando: quandoTarefa(e.tarefa, hoje, hhmm), botao };
  }

  if (tipo === "pos_visita") {
    return { tom: "sem", emoji: "⚠️", titulo: "Sem próxima ação", quando: "Definir: proposta ou visita", botao: "definir" };
  }
  return { tom: "sem", emoji: "⚠️", titulo: "Sem próxima ação", quando: "Definir agora", botao: "definir" };
}

// ─── Contadores dos atalhos "Tarefa atrasada · Para hoje · Sem próxima ação" ───

export type FiltroAcao = "todos" | "atrasada" | "hoje" | "sem";

export function acaoDoLead(
  stageTipo: string | null | undefined,
  tarefa: TarefaV2 | null | undefined,
  hoje: string = hojeBRT(),
  agoraHHMM: string = horaAgoraBRT(),
): Exclude<FiltroAcao, "todos"> | null {
  const tipo = stageTipo ?? "";
  if (ETAPAS_TERMINAIS.has(tipo)) return null;
  const s = statusTarefa(tarefa, tipo, hoje, agoraHHMM);
  if (s === "atrasada") return "atrasada";
  if (s === "hoje") return "hoje";
  if (s === "sem") return ETAPAS_COM_PROXIMA_ACAO.has(tipo) ? "sem" : null;
  return null;
}

export function contarAcoes<L extends { id: string; stage_id: string }>(
  leads: L[],
  tarefasMap: Record<string, TarefaV2 | undefined | null>,
  stageTipoById: Record<string, string>,
  agora: Date = new Date(),
): { atrasada: number; hoje: number; sem: number } {
  const hoje = hojeBRT(agora);
  const hhmm = horaAgoraBRT(agora);
  const out = { atrasada: 0, hoje: 0, sem: 0 };
  for (const l of leads) {
    const a = acaoDoLead(stageTipoById[l.stage_id], tarefasMap[l.id] ?? null, hoje, hhmm);
    if (a) out[a]++;
  }
  return out;
}

export function filtrarPorAcao<L extends { id: string; stage_id: string }>(
  leads: L[],
  filtro: FiltroAcao,
  tarefasMap: Record<string, TarefaV2 | undefined | null>,
  stageTipoById: Record<string, string>,
  agora: Date = new Date(),
): L[] {
  if (filtro === "todos") return leads;
  const hoje = hojeBRT(agora);
  const hhmm = horaAgoraBRT(agora);
  return leads.filter((l) => acaoDoLead(stageTipoById[l.stage_id], tarefasMap[l.id] ?? null, hoje, hhmm) === filtro);
}
