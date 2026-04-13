import { memo } from "react";

interface Props {
  flagStatus: Record<string, string> | null | undefined;
  stageTipo?: string;
}

const FLAG_CONFIGS: Record<string, Record<string, { label: string; color: string; bg: string }>> = {
  visita: {
    marcada: { label: "📅 Marcada", color: "#3350E6", bg: "rgba(37,99,235,0.12)" },
    realizada: { label: "✅ Realizada", color: "#059669", bg: "rgba(5,150,105,0.12)" },
    no_show: { label: "❌ No-show", color: "#DC2626", bg: "rgba(220,38,38,0.12)" },
    reagendada: { label: "🔁 Reagendada", color: "#D97706", bg: "rgba(217,119,6,0.12)" },
  },
  sem_contato: {
    tentativa: { label: "☎️", color: "#6B7280", bg: "rgba(107,114,128,0.12)" },
  },
  contato_inicial: {
    gostou: { label: "👍 Gostou", color: "#059669", bg: "rgba(5,150,105,0.12)" },
    nao_gostou: { label: "👎 Não gostou", color: "#DC2626", bg: "rgba(220,38,38,0.12)" },
    morar: { label: "🏠 Morar", color: "#3350E6", bg: "rgba(37,99,235,0.12)" },
    investir: { label: "💰 Investir", color: "#7C3AED", bg: "rgba(124,58,237,0.12)" },
  },
  busca: {
    busca_pendente: { label: "🔍 Busca pendente", color: "#D97706", bg: "rgba(217,119,6,0.12)" },
    imoveis_enviados: { label: "📨 Imóveis enviados", color: "#059669", bg: "rgba(5,150,105,0.12)" },
  },
  aquecimento: {
    prazo: { label: "⏰", color: "#D97706", bg: "rgba(217,119,6,0.12)" },
  },
  pos_visita: {
    feedback_coletado: { label: "💬 Feedback", color: "#059669", bg: "rgba(5,150,105,0.12)" },
    simulacao_enviada: { label: "💰 Simulação", color: "#3350E6", bg: "rgba(37,99,235,0.12)" },
    objecoes_mapeadas: { label: "🤔 Objeções", color: "#D97706", bg: "rgba(217,119,6,0.12)" },
    interesse_alto: { label: "🔥 Alto", color: "#DC2626", bg: "rgba(220,38,38,0.12)" },
    interesse_medio: { label: "🟡 Médio", color: "#D97706", bg: "rgba(217,119,6,0.12)" },
    interesse_baixo: { label: "❄️ Baixo", color: "#6B7280", bg: "rgba(107,114,128,0.12)" },
  },
};

const LeadFlagBadges = memo(function LeadFlagBadges({ flagStatus, stageTipo }: Props) {
  if (!flagStatus || !stageTipo) return null;

  const badges: { label: string; color: string; bg: string }[] = [];
  const stageConfig = FLAG_CONFIGS[stageTipo];

  if (stageTipo === "sem_contato" && flagStatus.tentativas) {
    badges.push({
      label: `☎️ ${flagStatus.tentativas}/7`,
      color: parseInt(flagStatus.tentativas) >= 5 ? "#DC2626" : "#6B7280",
      bg: parseInt(flagStatus.tentativas) >= 5 ? "rgba(220,38,38,0.12)" : "rgba(107,114,128,0.12)",
    });
  }

  if (stageTipo === "aquecimento" && flagStatus.prazo) {
    badges.push({
      label: `⏰ ${flagStatus.prazo} dias`,
      color: "#D97706",
      bg: "rgba(217,119,6,0.12)",
    });
  }

  if (stageTipo === "visita" && flagStatus.status_visita && stageConfig) {
    const cfg = stageConfig[flagStatus.status_visita];
    if (cfg) badges.push(cfg);
  }

  if (stageTipo === "contato_inicial") {
    if (flagStatus.impressao && stageConfig) {
      const cfg = stageConfig[flagStatus.impressao];
      if (cfg) badges.push(cfg);
    }
    if (flagStatus.intencao && stageConfig) {
      const cfg = stageConfig[flagStatus.intencao];
      if (cfg) badges.push(cfg);
    }
  }

  if (stageTipo === "busca" && stageConfig) {
    if (flagStatus.status_busca) {
      const cfg = stageConfig[flagStatus.status_busca];
      if (cfg) badges.push(cfg);
    }
  }

  if (stageTipo === "pos_visita" && stageConfig) {
    if (flagStatus.feedback_coletado === "sim") badges.push(stageConfig.feedback_coletado);
    if (flagStatus.simulacao_enviada === "sim") badges.push(stageConfig.simulacao_enviada);
    if (flagStatus.objecoes_mapeadas === "sim") badges.push(stageConfig.objecoes_mapeadas);
    if (flagStatus.interesse) {
      const key = `interesse_${flagStatus.interesse}`;
      const cfg = stageConfig[key];
      if (cfg) badges.push(cfg);
    }
  }

  if (badges.length === 0) return null;

  return (
    <div className="flex items-center gap-1 flex-wrap" style={{ marginBottom: 4 }}>
      {badges.map((b, i) => (
        <span
          key={i}
          style={{
            fontSize: 9,
            fontWeight: 700,
            color: b.color,
            background: b.bg,
            padding: "2px 6px",
            borderRadius: 5,
            whiteSpace: "nowrap",
          }}
        >
          {b.label}
        </span>
      ))}
    </div>
  );
});

export default LeadFlagBadges;
