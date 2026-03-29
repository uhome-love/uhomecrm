import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Bell, X, Check, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import type { Notification } from "@/hooks/useNotifications";

const TIPO_LABELS: Record<string, string> = {
  leads: "Leads",
  lead_roleta: "Roleta",
  lead_timeout: "Timeout",
  lead_sem_contato: "Sem Contato",
  lead_parado: "Lead Parado",
  lead_alto_valor: "Alto Valor",
  fila_ceo: "Fila CEO",
  lead_urgente: "Urgente",
  lead_ultimo_alerta: "Último Alerta",
  automacao: "Automação",
  visitas: "Visitas",
  visita_agendada: "Visita",
  visita_confirmada: "Visita",
  visita_noshow: "No Show",
  propostas: "Propostas",
  proposta_assinada: "Proposta",
  vendas: "Vendas",
  negocio_fechado: "Venda",
  meta_atingida: "Meta",
  corretor_inativo: "Inatividade",
  gerente_sem_visita: "Alerta Gerente",
  relatorio_semanal: "Relatório",
  xp_conquista: "Conquista",
  mensagem_gerente: "Mensagem",
  corretor_ajuda: "Ajuda",
  zero_ligacoes: "Alerta",
  alertas: "Alertas",
  radar_intencao: "Radar de Intenção",
};

const TIPO_CONFIG: Record<string, { emoji: string; borderColor: string; bgUnread: string }> = {
  radar_intencao: { emoji: "🚨", borderColor: "#EA580C", bgUnread: "#FFF3E6" },
  leads: { emoji: "⚡", borderColor: "#3B82F6", bgUnread: "#EFF6FF" },
  lead_roleta: { emoji: "⚡", borderColor: "#3B82F6", bgUnread: "#EFF6FF" },
  lead_timeout: { emoji: "⚠️", borderColor: "#EF4444", bgUnread: "#FEF2F2" },
  lead_sem_contato: { emoji: "⚠️", borderColor: "#F59E0B", bgUnread: "#FFFBEB" },
  lead_parado: { emoji: "⚠️", borderColor: "#F59E0B", bgUnread: "#FFFBEB" },
  lead_alto_valor: { emoji: "💼", borderColor: "#8B5CF6", bgUnread: "#F5F3FF" },
  fila_ceo: { emoji: "⚡", borderColor: "#EF4444", bgUnread: "#FEF2F2" },
  lead_urgente: { emoji: "⚡", borderColor: "#F97316", bgUnread: "#FFF7ED" },
  lead_ultimo_alerta: { emoji: "🚨", borderColor: "#EF4444", bgUnread: "#FEF2F2" },
  automacao: { emoji: "⚙️", borderColor: "#6366F1", bgUnread: "#EEF2FF" },
  visitas: { emoji: "📅", borderColor: "#10B981", bgUnread: "#ECFDF5" },
  visita_agendada: { emoji: "📅", borderColor: "#10B981", bgUnread: "#ECFDF5" },
  visita_confirmada: { emoji: "📅", borderColor: "#10B981", bgUnread: "#ECFDF5" },
  visita_noshow: { emoji: "⚠️", borderColor: "#EF4444", bgUnread: "#FEF2F2" },
  propostas: { emoji: "💼", borderColor: "#8B5CF6", bgUnread: "#F5F3FF" },
  proposta_assinada: { emoji: "💼", borderColor: "#8B5CF6", bgUnread: "#F5F3FF" },
  vendas: { emoji: "💼", borderColor: "#F59E0B", bgUnread: "#FFFBEB" },
  negocio_fechado: { emoji: "🎉", borderColor: "#10B981", bgUnread: "#ECFDF5" },
  meta_atingida: { emoji: "🏆", borderColor: "#F59E0B", bgUnread: "#FFFBEB" },
  corretor_inativo: { emoji: "⚠️", borderColor: "#EF4444", bgUnread: "#FEF2F2" },
  gerente_sem_visita: { emoji: "⚠️", borderColor: "#EF4444", bgUnread: "#FEF2F2" },
  relatorio_semanal: { emoji: "📋", borderColor: "#6B7280", bgUnread: "#F9FAFB" },
  xp_conquista: { emoji: "🎉", borderColor: "#F59E0B", bgUnread: "#FFFBEB" },
  mensagem_gerente: { emoji: "💬", borderColor: "#3B82F6", bgUnread: "#EFF6FF" },
  corretor_ajuda: { emoji: "💬", borderColor: "#EF4444", bgUnread: "#FEF2F2" },
  zero_ligacoes: { emoji: "⚠️", borderColor: "#EF4444", bgUnread: "#FEF2F2" },
  alertas: { emoji: "⚠️", borderColor: "#EF4444", bgUnread: "#FEF2F2" },
};

interface Props {
  notifications: Notification[];
  onMarkAsRead: (id: string) => void;
  onDelete: (id: string) => void;
  compact?: boolean;
}

function getNotificationRoute(n: Notification): string | null {
  const d = n.dados || {};
  const tipo = n.tipo;
  const categoria = n.categoria;

  // Radar de Intenção → deep-link to lead profile
  if (tipo === "radar_intencao" || categoria === "radar") {
    const leadId = d.pipeline_lead_id || d.lead_id;
    if (leadId) return `/pipeline-leads?lead=${leadId}`;
    return "/pipeline-leads";
  }

  // Lead notifications → pipeline with lead context
  if (["leads", "lead", "lead_roleta", "lead_urgente", "lead_ultimo_alerta", "lead_sem_contato", "lead_parado", "lead_alto_valor"].includes(tipo)) {
    const leadId = d.pipeline_lead_id || d.lead_id;
    if (leadId) return `/pipeline-leads?lead=${leadId}`;
    return "/pipeline-leads";
  }
  if (tipo === "fila_ceo" || categoria === "fila_ceo") return "/pipeline-leads";

  // Lead categories
  if (["lead_novo", "lead_aceito", "lead_retorno", "lead_atribuido"].includes(categoria)) {
    const leadId = d.pipeline_lead_id || d.lead_id;
    if (leadId) return `/pipeline-leads?lead=${leadId}`;
    return "/pipeline-leads";
  }

  // Visita notifications → agenda
  if (["visitas", "visita_agendada", "visita_confirmada", "visita_noshow"].includes(tipo) || categoria?.startsWith("visita")) {
    if (d.visita_id) return `/agenda-visitas?visita=${d.visita_id}`;
    return "/agenda-visitas";
  }

  // Pipeline visita_realizada → pipeline lead
  if (tipo === "pipeline" && categoria === "visita_realizada") {
    if (d.lead_id) return `/pipeline-leads?lead=${d.lead_id}`;
    return "/pipeline-leads";
  }

  // Propostas / vendas / negócios
  if (["propostas", "proposta_assinada", "vendas", "negocio_fechado"].includes(tipo)) {
    return "/pipeline-negocios";
  }

  // Performance / conquistas
  if (tipo === "meta_atingida" || tipo === "xp_conquista") return "/conquistas";
  if (tipo === "relatorio_semanal") return "/corretor/resumo";

  // Alertas de gestão
  if (categoria === "corretor_parado" || categoria === "corretor_inativo") return "/central-do-gerente";
  if (categoria === "lead_sem_atendimento") return "/pipeline-leads";
  if (categoria === "meta_abaixo") return "/gerente/dashboard";
  if (categoria === "escala_solicitada" || categoria === "escala_aprovado" || categoria === "escala_rejeitado") return "/escala-diaria";
  if (categoria === "problema_atendimento") return "/pipeline-leads";
  if (categoria === "volume_leads") return "/pipeline-leads";
  if (categoria === "alerta_previsao") return "/ceo";
  if (categoria === "venda_assinada") return "/pipeline-negocios";

  // Mensagens
  if (tipo === "mensagem_gerente") return "/notificacoes";

  // Automação / sequências — deep-link to lead if available
  if (tipo === "automacao" || tipo === "sequencias") {
    const leadId = d.pipeline_lead_id || d.lead_id;
    if (leadId) return `/pipeline-leads?lead=${leadId}`;
    return "/pipeline-leads";
  }

  return null;
}

/** Extract contextual details from notification data for display */
function getContextDetails(n: Notification): { leadName?: string; detail?: string } {
  const d = n.dados || {};

  // Try to extract lead name from dados or mensagem
  let leadName = d.lead_nome || d.nome;
  if (!leadName && n.mensagem) {
    // Try to extract name from patterns like "Você recebeu o lead João" or "João - Empreendimento"
    const matchRecebeu = n.mensagem.match(/lead\s+([^(.\n]+?)(?:\s*\(|\.|\s*-|\s*$)/i);
    const matchDash = n.mensagem.match(/^([^-–]+?)\s*[-–]\s/);
    if (matchRecebeu?.[1]) leadName = matchRecebeu[1].trim();
    else if (matchDash?.[1] && matchDash[1].length < 40) leadName = matchDash[1].trim();
  }

  // Build detail line with empreendimento/canal/campanha
  const parts: string[] = [];
  if (d.empreendimento || d.novo_empreendimento) parts.push(d.novo_empreendimento || d.empreendimento);
  if (d.canal) parts.push(d.canal);
  if (d.campanha) parts.push(d.campanha);
  if (d.origem) parts.push(d.origem);

  return {
    leadName: leadName || undefined,
    detail: parts.length > 0 ? parts.join(" · ") : undefined,
  };
}

export default function NotificationList({ notifications, onMarkAsRead, onDelete, compact }: Props) {
  const navigate = useNavigate();

  const handleClick = (n: Notification) => {
    if (!n.lida) onMarkAsRead(n.id);
    const route = getNotificationRoute(n);
    if (route) navigate(route);
  };

  if (notifications.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center text-center"
        style={{
          border: "1px dashed #E5E7EB",
          borderRadius: 16,
          background: "#FAFAFA",
          padding: "60px 24px",
          margin: 16,
        }}
      >
        <div style={{ fontSize: 48 }} className="mb-3">🔔</div>
        <p className="font-bold text-gray-700" style={{ fontSize: 20 }}>Tudo em dia!</p>
        <p className="text-gray-400 mt-2" style={{ fontSize: 14 }}>
          Nenhuma notificação no momento.
          <br />Continue executando! 💪
        </p>
      </div>
    );
  }

  return (
    <div>
      {notifications.map((n) => {
        const config = TIPO_CONFIG[n.tipo] || { emoji: "🔔", borderColor: "#9CA3AF", bgUnread: "#F9FAFB" };
        const route = getNotificationRoute(n);
        const isClickable = !!route;
        const { leadName, detail } = getContextDetails(n);
        const isRadar = n.tipo === "radar_intencao";

        return (
          <div
            key={n.id}
            className={`flex gap-3 px-4 py-3.5 group transition-colors ${isClickable ? "cursor-pointer" : ""} ${isRadar && !n.lida ? "ring-1 ring-orange-300" : ""}`}
            style={{
              borderLeft: `4px solid ${isRadar ? "#EA580C" : (!n.lida ? config.borderColor : "transparent")}`,
              background: isRadar && !n.lida ? "linear-gradient(90deg, #FFF7ED 0%, #FEF3C7 100%)" : (!n.lida ? config.bgUnread : "#fff"),
              borderBottom: "1px solid rgba(0,0,0,0.04)",
            }}
            onClick={() => handleClick(n)}
            onMouseEnter={e => { if (n.lida) e.currentTarget.style.background = "#F9FAFB"; }}
            onMouseLeave={e => { if (n.lida) e.currentTarget.style.background = "#fff"; }}
          >
            <div className="mt-0.5 shrink-0" style={{ fontSize: 20 }}>
              {config.emoji}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <p
                  className="leading-tight"
                  style={{
                    fontSize: isRadar ? 14 : 13,
                    fontWeight: isRadar ? 700 : (!n.lida ? 600 : 500),
                    color: isRadar && !n.lida ? "#9A3412" : (!n.lida ? "#1F2937" : "#6B7280"),
                  }}
                >
                  {!n.lida && (
                    <span
                      className="inline-block rounded-full mr-2"
                      style={{ width: 7, height: 7, background: config.borderColor, verticalAlign: "middle" }}
                    />
                  )}
                  {n.titulo}
                  {n.agrupamento_count > 1 && (
                    <span
                      className="ml-1.5"
                      style={{ fontSize: 10, background: "#F3F4F6", padding: "1px 6px", borderRadius: 999, color: "#6B7280" }}
                    >
                      ×{n.agrupamento_count}
                    </span>
                  )}
                </p>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  {!n.lida && (
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); onMarkAsRead(n.id); }}>
                      <Check className="h-3 w-3" />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-red-400 hover:text-red-600" onClick={(e) => { e.stopPropagation(); onDelete(n.id); }}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              {/* Context details: lead name + empreendimento/campanha */}
              {(leadName || detail) && (
                <div className="mt-1 space-y-0.5">
                  {leadName && (
                    <p style={{ fontSize: 12, fontWeight: 600, color: !n.lida ? "#374151" : "#6B7280" }} className="truncate">
                      👤 {leadName}
                    </p>
                  )}
                  {detail && (
                    <p style={{ fontSize: 11, color: "#9CA3AF" }} className="truncate">
                      🏠 {detail}
                    </p>
                  )}
                </div>
              )}

              {/* Message preview (non-compact only, and only if no context already shown) */}
              {!compact && !leadName && !detail && n.mensagem && (
                <p className="text-gray-500 mt-1 line-clamp-2" style={{ fontSize: 12 }}>{n.mensagem}</p>
              )}
              {!compact && (leadName || detail) && n.mensagem && (
                <p className="text-gray-400 mt-0.5 line-clamp-1" style={{ fontSize: 11 }}>{n.mensagem}</p>
              )}

              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-gray-400" style={{ fontSize: 11 }}>
                  {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: ptBR })}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    background: "#F3F4F6",
                    padding: "1px 6px",
                    borderRadius: 4,
                    color: "#6B7280",
                  }}
                >
                  {TIPO_LABELS[n.tipo] || TIPO_LABELS[n.categoria] || n.tipo}
                </span>
                {isClickable && (
                  <ChevronRight className="h-3 w-3 text-gray-300 ml-auto shrink-0" />
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
