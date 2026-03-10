/**
 * Gamification celebrations system — confetti, sounds, and micro-celebrations.
 */

// ─── Web Audio Sounds (no external files) ───

const audioCtx = typeof window !== "undefined" ? new (window.AudioContext || (window as any).webkitAudioContext)() : null;

function playTone(freq: number, duration: number, type: OscillatorType = "sine", volume = 0.15) {
  if (!audioCtx || !getSoundEnabled()) return;
  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(volume, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  } catch { /* silent fail */ }
}

export function playSoundDing() {
  playTone(880, 0.3, "sine", 0.1);
  setTimeout(() => playTone(1100, 0.2, "sine", 0.08), 100);
}

export function playSoundSuccess() {
  playTone(523, 0.15, "sine", 0.12);
  setTimeout(() => playTone(659, 0.15, "sine", 0.12), 120);
  setTimeout(() => playTone(784, 0.3, "sine", 0.12), 240);
}

export function playSoundFanfare() {
  [523, 659, 784, 1047].forEach((freq, i) => {
    setTimeout(() => playTone(freq, 0.25, "triangle", 0.1), i * 150);
  });
}

export function playSoundAchievement() {
  [440, 554, 659, 880].forEach((freq, i) => {
    setTimeout(() => playTone(freq, 0.3, "sine", 0.1), i * 100);
  });
  setTimeout(() => playTone(1047, 0.5, "triangle", 0.08), 450);
}

// ─── Sound preferences ───

export function getSoundEnabled(): boolean {
  try { return localStorage.getItem("uhome-sounds") === "true"; } catch { return false; }
}

export function setSoundEnabled(v: boolean) {
  try { localStorage.setItem("uhome-sounds", v ? "true" : "false"); } catch { /* */ }
}

export function getCelebrationEnabled(): boolean {
  try { return localStorage.getItem("uhome-celebrations") !== "false"; } catch { return true; }
}

export function setCelebrationEnabled(v: boolean) {
  try { localStorage.setItem("uhome-celebrations", v ? "true" : "false"); } catch { /* */ }
}

// ─── Dynamic greetings ───

interface GreetingContext {
  nome: string;
  rankingPos: number;
  slaExpired: number;
  metaBatidaOntem?: boolean;
  streak?: number;
  /** Must be > 0 for leadership greeting to trigger */
  myPts?: number;
  /** Total participants with points > 0 */
  totalWithPoints?: number;
}

function getGreetingByHour(nome: string): string {
  const h = new Date().getHours();
  if (h < 5) return `Boa madrugada, ${nome}! 🌙`;
  if (h < 12) return `Bom dia, ${nome}! 👋`;
  if (h < 18) return `Boa tarde, ${nome}! ☀️`;
  return `Boa noite, ${nome}! 🌙`;
}

export function getDynamicGreeting(ctx: GreetingContext): { greeting: string; subtitle: string } {
  const hour = new Date().getHours();
  const { nome, rankingPos, slaExpired, metaBatidaOntem, streak, myPts = 0, totalWithPoints = 0 } = ctx;
  const n = nome || "Corretor";

  // Priority contexts first
  if (slaExpired > 0) {
    return { greeting: `Atenção, ${n}! 🚨`, subtitle: `Tem ${slaExpired} lead${slaExpired > 1 ? "s" : ""} te esperando. Bora resolver!` };
  }

  // Only show leader greeting if genuinely #1 WITH points AND more than just themselves
  if (rankingPos === 1 && myPts > 0 && totalWithPoints > 1) {
    return { greeting: `Líder do ranking, ${n}! 👑`, subtitle: "Defende o trono. Ninguém tira isso de quem executa." };
  }

  // Has points but not #1
  if (rankingPos > 1 && myPts > 0) {
    return { greeting: `Continue subindo, ${n}! 💪`, subtitle: `Você está em #${rankingPos}. O topo está perto.` };
  }

  if (metaBatidaOntem) {
    return { greeting: `Que dia ontem, ${n}! 🏆`, subtitle: "Repete hoje? Eu sei que dá." };
  }

  // Everyone at 0 or no ranking data — neutral/motivational greeting
  if (myPts === 0 && totalWithPoints === 0) {
    return { greeting: getGreetingByHour(n), subtitle: "A arena está esperando. Quem ligar primeiro, lidera." };
  }

  // Time-based
  const morningGreets = [
    { greeting: `Fala, ${n}! ☀️`, subtitle: "Bora começar forte! O ranking te espera." },
    { greeting: `Bom dia, ${n}! 🚀`, subtitle: "Hoje é dia de superar ontem." },
    { greeting: `Oi, ${n}! 💪`, subtitle: "Foco total. Uma ligação por vez, um resultado por vez." },
  ];
  const afternoonGreets = [
    { greeting: `Ainda dá tempo, ${n}! 🔥`, subtitle: "Foco total na segunda metade." },
    { greeting: `Hora do gás, ${n}! ⚡`, subtitle: "Acelera! Bora fechar mais um." },
    { greeting: `Segue firme, ${n}! 🎯`, subtitle: "As melhores ligações vêm agora." },
  ];
  const eveningGreets = [
    { greeting: `Reta final, ${n}! 🌙`, subtitle: "Cada ligação conta. Finaliza com chave de ouro." },
    { greeting: `Ainda por aqui, ${n}? 💎`, subtitle: "Quem fica mais, conquista mais." },
  ];

  const pool = hour < 12 ? morningGreets : hour < 18 ? afternoonGreets : eveningGreets;
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  const idx = (dayOfYear + (streak || 0)) % pool.length;
  return pool[idx];
}

// ─── Streak formatting ───

export function formatStreak(streak: number): { emoji: string; label: string; color: string } {
  if (streak <= 0) return { emoji: "🔥", label: "Comece hoje seu streak!", color: "text-gray-400 italic" };
  if (streak === 1) return { emoji: "🔥", label: "Começou bem!", color: "text-orange-500" };
  if (streak <= 3) return { emoji: "🔥🔥", label: `Sequência de ${streak}!`, color: "text-orange-500" };
  if (streak <= 5) return { emoji: "🔥🔥🔥", label: `${streak} dias! Consistente!`, color: "text-orange-600" };
  if (streak <= 10) return { emoji: "⚡", label: `${streak} dias! Lendário!`, color: "text-amber-500" };
  return { emoji: "💎", label: `${streak} dias! Histórico!`, color: "text-purple-500" };
}

// ─── Emoji maps ───

export const PIPELINE_STAGE_EMOJIS: Record<string, string> = {
  "Novo Lead": "🆕",
  "Contato Iniciado": "📞",
  "Sem Contato": "📵",
  "Qualificação": "🎯",
  "Possível Visita": "🏠",
  "Visita Marcada": "📅",
  "Visita Realizada": "✅",
  "Descarte": "🗑️",
};

export const PIPELINE_STAGE_COLORS: Record<string, string> = {
  "Novo Lead": "bg-purple-500/20 text-purple-600 dark:text-purple-400 border-purple-500",
  "Contato Iniciado": "bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500",
  "Sem Contato": "bg-gray-500/20 text-gray-600 dark:text-gray-400 border-gray-500",
  "Qualificação": "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border-yellow-500",
  "Possível Visita": "bg-orange-500/20 text-orange-600 dark:text-orange-400 border-orange-500",
  "Visita Marcada": "bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border-cyan-500",
  "Visita Realizada": "bg-green-500/20 text-green-600 dark:text-green-400 border-green-500",
  "Descarte": "bg-red-500/20 text-red-600 dark:text-red-400 border-red-500",
};

// Background colors for pipeline kanban columns (light theme friendly)
export const PIPELINE_STAGE_BG: Record<string, { bg: string; border: string; headerBg: string }> = {
  "Novo Lead": { bg: "rgba(139,92,246,0.06)", border: "rgba(139,92,246,0.18)", headerBg: "rgba(139,92,246,0.10)" },
  "Sem Contato": { bg: "rgba(107,114,128,0.06)", border: "rgba(107,114,128,0.18)", headerBg: "rgba(107,114,128,0.10)" },
  "Contato Iniciado": { bg: "rgba(59,130,246,0.06)", border: "rgba(59,130,246,0.18)", headerBg: "rgba(59,130,246,0.10)" },
  "Qualificação": { bg: "rgba(245,158,11,0.06)", border: "rgba(245,158,11,0.18)", headerBg: "rgba(245,158,11,0.10)" },
  "Possível Visita": { bg: "rgba(249,115,22,0.06)", border: "rgba(249,115,22,0.18)", headerBg: "rgba(249,115,22,0.10)" },
  "Visita Marcada": { bg: "rgba(6,182,212,0.06)", border: "rgba(6,182,212,0.18)", headerBg: "rgba(6,182,212,0.10)" },
  "Visita Realizada": { bg: "rgba(34,197,94,0.06)", border: "rgba(34,197,94,0.18)", headerBg: "rgba(34,197,94,0.10)" },
  "Descarte": { bg: "rgba(239,68,68,0.06)", border: "rgba(239,68,68,0.18)", headerBg: "rgba(239,68,68,0.10)" },
};

export const TEMPERATURA_EMOJIS: Record<string, string> = {
  quente: "🔥",
  morno: "🌤️",
  frio: "🧊",
  gelado: "❄️",
};

export const VISITA_STATUS_EMOJIS: Record<string, string> = {
  marcada: "📅",
  confirmada: "✅",
  realizada: "🏠",
  reagendada: "🔄",
  cancelada: "❌",
  no_show: "👻",
};

export const OA_RESULTADO_EMOJIS: Record<string, string> = {
  com_interesse: "✅",
  agendar_visita: "📅",
  ligar_depois: "🔄",
  sem_interesse: "😐",
  nao_atendeu: "📵",
  numero_errado: "🚫",
  caixa_postal: "📵",
  ocupado: "🔄",
};

// ─── Ranking personality ───

export function getRankingStyle(pos: number, isMe: boolean) {
  if (pos === 1) return { bg: "bg-amber-50 dark:bg-amber-950/30", border: "border-amber-200 dark:border-amber-800", icon: "👑", phrase: isMe ? "Você é o rei/rainha hoje!" : "" };
  if (pos === 2) return { bg: "bg-gray-50 dark:bg-gray-900/30", border: "border-gray-200 dark:border-gray-700", icon: "🥈", phrase: isMe ? "Tão perto do topo..." : "" };
  if (pos === 3) return { bg: "bg-orange-50 dark:bg-orange-950/30", border: "border-orange-200 dark:border-orange-800", icon: "🥉", phrase: isMe ? "Pódio! Mas dá pra mais." : "" };
  if (pos <= 6) return { bg: "", border: "", icon: "🔥", phrase: isMe ? "Bora subir!" : "" };
  return { bg: "", border: "", icon: "", phrase: isMe ? "💪 Bora subir!" : "" };
}

// ─── Empty states ───

export const EMPTY_STATES = {
  pipeline: { emoji: "🎉", text: "Nenhum lead parado! Você está em dia." },
  visitas: { emoji: "😴", text: "Agenda livre hoje. Que tal marcar uma?" },
  aproveitamentos: { emoji: "🎯", text: "Ainda zerado. O primeiro é o mais difícil!" },
  notificacoes: { emoji: "🦗", text: "Silêncio total por aqui. Aproveita!" },
  pdn: { emoji: "✨", text: "Tudo em movimento! Nenhum negócio parado." },
  prioridades: { emoji: "✅", text: "Tudo em dia! Bora prospectar." },
};
