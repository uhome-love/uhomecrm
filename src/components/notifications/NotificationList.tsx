import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Bell, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Notification } from "@/hooks/useNotifications";

const TIPO_LABELS: Record<string, string> = {
  leads: "Leads",
  lead_roleta: "Roleta",
  lead_timeout: "Timeout",
  lead_sem_contato: "Sem Contato",
  lead_parado: "Lead Parado",
  lead_alto_valor: "Alto Valor",
  fila_ceo: "Fila CEO",
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
};

const TIPO_CONFIG: Record<string, { emoji: string; borderColor: string; bgUnread: string }> = {
  leads: { emoji: "⚡", borderColor: "#3B82F6", bgUnread: "#EFF6FF" },
  lead_roleta: { emoji: "⚡", borderColor: "#3B82F6", bgUnread: "#EFF6FF" },
  lead_timeout: { emoji: "⚠️", borderColor: "#EF4444", bgUnread: "#FEF2F2" },
  lead_sem_contato: { emoji: "⚠️", borderColor: "#F59E0B", bgUnread: "#FFFBEB" },
  lead_parado: { emoji: "⚠️", borderColor: "#F59E0B", bgUnread: "#FFFBEB" },
  lead_alto_valor: { emoji: "💼", borderColor: "#8B5CF6", bgUnread: "#F5F3FF" },
  fila_ceo: { emoji: "⚡", borderColor: "#EF4444", bgUnread: "#FEF2F2" },
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

export default function NotificationList({ notifications, onMarkAsRead, onDelete, compact }: Props) {
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

        return (
          <div
            key={n.id}
            className="flex gap-3 px-4 py-4 cursor-pointer group transition-colors"
            style={{
              borderLeft: `3px solid ${!n.lida ? config.borderColor : "transparent"}`,
              background: !n.lida ? config.bgUnread : "#fff",
              borderBottom: "1px solid rgba(0,0,0,0.04)",
            }}
            onClick={() => !n.lida && onMarkAsRead(n.id)}
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
                    fontSize: 13,
                    fontWeight: !n.lida ? 600 : 500,
                    color: !n.lida ? "#1F2937" : "#6B7280",
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
              {!compact && (
                <p className="text-gray-500 mt-1 line-clamp-2" style={{ fontSize: 12 }}>{n.mensagem}</p>
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
                  {TIPO_LABELS[n.tipo] || n.tipo}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
