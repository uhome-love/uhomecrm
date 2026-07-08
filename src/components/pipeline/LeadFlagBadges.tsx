import { memo } from "react";

interface Props {
  flagStatus: Record<string, string> | null | undefined;
  stageTipo?: string;
}

const FLAG_CONFIGS: Record<string, Record<string, { label: string; color: string; bg: string }>> = {
  qualificacao: {
    contato_inicial: { label: "📞 Contato inicial", color: "hsl(var(--primary-600))", bg: "rgba(37,99,235,0.12)" },
    alinhamento_perfil: { label: "🎯 Alinhando perfil", color: "#7C3AED", bg: "rgba(124,58,237,0.12)" },
    busca: { label: "🔍 Busca de imóveis", color: "#D97706", bg: "rgba(217,119,6,0.12)" },
    follow_up: { label: "🔁 Follow up", color: "#059669", bg: "rgba(5,150,105,0.12)" },
    alinhando_visita: { label: "📅 Alinhando visita", color: "hsl(var(--primary-600))", bg: "rgba(37,99,235,0.12)" },
  },
  visita: {
    marcada: { label: "📅 Visita marcada", color: "hsl(var(--primary-600))", bg: "rgba(37,99,235,0.12)" },
    realizada: { label: "✅ Visita realizada", color: "#059669", bg: "rgba(5,150,105,0.12)" },
    no_show: { label: "👻 No-show", color: "#DC2626", bg: "rgba(220,38,38,0.12)" },
    reagendada: { label: "🔁 Reagendada", color: "#D97706", bg: "rgba(217,119,6,0.12)" },
  },
  proposta: {
    proposta_enviada: { label: "📤 Proposta enviada", color: "hsl(var(--primary-600))", bg: "rgba(37,99,235,0.12)" },
    proposta_aprovada: { label: "✅ Proposta aprovada", color: "#059669", bg: "rgba(5,150,105,0.12)" },
    aprovacao_bancaria: { label: "🏦 Aprovação bancária", color: "#D97706", bg: "rgba(217,119,6,0.12)" },
    correspondente_bancario: { label: "🤝 Correspondente", color: "#7C3AED", bg: "rgba(124,58,237,0.12)" },
    aprovacao_proprietario: { label: "👤 Aprov. proprietário", color: "#D97706", bg: "rgba(217,119,6,0.12)" },
    documentacao_enviada: { label: "📄 Documentação enviada", color: "#059669", bg: "rgba(5,150,105,0.12)" },
  },
  contrato_gerado: {
    em_confeccao: { label: "✍️ Em confecção", color: "#D97706", bg: "rgba(217,119,6,0.12)" },
    gerado: { label: "📄 Gerado", color: "hsl(var(--primary-600))", bg: "rgba(37,99,235,0.12)" },
    em_leitura: { label: "📖 Em leitura", color: "#059669", bg: "rgba(5,150,105,0.12)" },
  },
  sem_contato: {
    tentativa: { label: "☎️", color: "#6B7280", bg: "rgba(107,114,128,0.12)" },
  },
  contato_inicial: {
    gostou: { label: "👍 Gostou", color: "#059669", bg: "rgba(5,150,105,0.12)" },
    nao_gostou: { label: "👎 Não gostou", color: "#DC2626", bg: "rgba(220,38,38,0.12)" },
    morar: { label: "🏠 Morar", color: "hsl(var(--primary-600))", bg: "rgba(37,99,235,0.12)" },
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
    simulacao_enviada: { label: "💰 Simulação", color: "hsl(var(--primary-600))", bg: "rgba(37,99,235,0.12)" },
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

  // "Sem Contato": tentativas vêm do badge automático da cadência (📲), não do manual.


  if (stageTipo === "aquecimento" && flagStatus.prazo) {
    badges.push({
      label: `⏰ Retomar ${flagStatus.prazo}D`,
      color: "#D97706",
      bg: "rgba(217,119,6,0.12)",
    });
  }

  if (stageTipo === "qualificacao" && flagStatus.status_atendimento && stageConfig) {
    const cfg = stageConfig[flagStatus.status_atendimento];
    if (cfg) badges.push(cfg);
  }

  if (stageTipo === "visita" && flagStatus.status_visita && stageConfig) {
    const cfg = stageConfig[flagStatus.status_visita];
    if (cfg) badges.push(cfg);
  }

  if (stageTipo === "proposta" && flagStatus.status_negociacao && stageConfig) {
    const cfg = stageConfig[flagStatus.status_negociacao];
    if (cfg) badges.push(cfg);
  }

  if (stageTipo === "contrato_gerado" && flagStatus.status_contrato && stageConfig) {
    const cfg = stageConfig[flagStatus.status_contrato];
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
