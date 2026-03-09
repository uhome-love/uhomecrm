import { useState } from "react";
import { useNotifications } from "@/hooks/useNotifications";
import NotificationList from "@/components/notifications/NotificationList";
import { Badge } from "@/components/ui/badge";
import { CheckCheck, Loader2 } from "lucide-react";

const LEAD_TIPOS = ["leads", "lead_roleta", "lead_timeout", "lead_sem_contato", "lead_parado", "lead_alto_valor", "fila_ceo"];
const VISITA_TIPOS = ["visitas", "visita_agendada", "visita_confirmada", "visita_noshow"];
const NEGOCIO_TIPOS = ["propostas", "proposta_assinada", "vendas", "negocio_fechado"];
const PERF_TIPOS = ["meta_atingida", "xp_conquista", "relatorio_semanal"];
const ALERTA_TIPOS = ["alertas", "corretor_inativo", "gerente_sem_visita", "zero_ligacoes", "corretor_ajuda"];
const MSG_TIPOS = ["mensagem_gerente"];

const CATEGORY_MAP: Record<string, string[]> = {
  leads: LEAD_TIPOS,
  visitas: VISITA_TIPOS,
  negocios: NEGOCIO_TIPOS,
  performance: PERF_TIPOS,
  alertas: ALERTA_TIPOS,
  mensagens: MSG_TIPOS,
};

const FILTER_TABS = [
  { key: "todas", label: "Todas", activeColor: "#2563EB" },
  { key: "leads", label: "⚡ Leads", activeColor: "#2563EB" },
  { key: "visitas", label: "📅 Visitas", activeColor: "#059669" },
  { key: "negocios", label: "💼 Negócios", activeColor: "#9333EA" },
  { key: "performance", label: "🏆 Performance", activeColor: "#D97706" },
  { key: "alertas", label: "⚠️ Alertas", activeColor: "#DC2626" },
  { key: "mensagens", label: "💬 Mensagens", activeColor: "#3B82F6" },
];

export default function Notificacoes() {
  const { notifications, unreadCount, isLoading, markAsRead, markAllAsRead, deleteNotification } = useNotifications();
  const [activeFilter, setActiveFilter] = useState("todas");
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);

  const filtered = notifications.filter((n) => {
    if (activeFilter !== "todas") {
      const tipos = CATEGORY_MAP[activeFilter];
      if (tipos && !tipos.includes(n.tipo)) return false;
    }
    if (showUnreadOnly && n.lida) return false;
    return true;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-black text-gray-900" style={{ fontSize: 28 }}>
            🔔 Central de Notificações
          </h1>
          <p className="mt-1" style={{ fontSize: 14 }}>
            {unreadCount > 0 ? (
              <span className="text-gray-500">{unreadCount} não lida{unreadCount > 1 ? "s" : ""}</span>
            ) : (
              <span className="text-green-500 font-medium">Tudo em dia! ✅</span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowUnreadOnly(!showUnreadOnly)}
            className="text-gray-600 font-medium transition-colors"
            style={{
              border: "1px solid #E5E7EB",
              borderRadius: 8,
              padding: "6px 14px",
              fontSize: 13,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "#F9FAFB"; e.currentTarget.style.borderColor = "#D1D5DB"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "#E5E7EB"; }}
          >
            {showUnreadOnly ? "Mostrar todas" : "Só não lidas"}
          </button>
          {unreadCount > 0 && (
            <button
              onClick={() => markAllAsRead()}
              className="flex items-center gap-1.5 text-gray-600 font-medium transition-colors"
              style={{
                border: "1px solid #E5E7EB",
                borderRadius: 8,
                padding: "6px 14px",
                fontSize: 13,
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "#F9FAFB"; e.currentTarget.style.borderColor = "#D1D5DB"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "#E5E7EB"; }}
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Marcar todas como lidas
            </button>
          )}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {FILTER_TABS.map((tab) => {
          const count = notifications.filter((n) => tab.key === "todas" || n.tipo === tab.key).length;
          const isActive = activeFilter === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveFilter(tab.key)}
              className="flex items-center gap-1.5 font-medium transition-all"
              style={{
                background: isActive ? tab.activeColor : "transparent",
                color: isActive ? "#fff" : "#4B5563",
                border: isActive ? `1px solid ${tab.activeColor}` : "1px solid #E5E7EB",
                borderRadius: 8,
                padding: "6px 14px",
                fontSize: 13,
              }}
              onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = "#F9FAFB"; } }}
              onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = "transparent"; } }}
            >
              {tab.label}
              {count > 0 && (
                <span
                  className="font-semibold"
                  style={{
                    fontSize: 10,
                    background: isActive ? "rgba(255,255,255,0.25)" : "#F3F4F6",
                    color: isActive ? "#fff" : "#6B7280",
                    padding: "1px 6px",
                    borderRadius: 999,
                  }}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Notification list */}
      <div
        style={{
          borderRadius: 16,
          border: "1px solid rgba(0,0,0,0.06)",
          overflow: "hidden",
          background: "#fff",
        }}
      >
        <NotificationList
          notifications={filtered}
          onMarkAsRead={markAsRead}
          onDelete={deleteNotification}
        />
      </div>
    </div>
  );
}
