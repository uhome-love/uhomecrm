import { useState } from "react";
import { useNotifications } from "@/hooks/useNotifications";
import NotificationList from "@/components/notifications/NotificationList";
import { CheckCheck, Loader2 } from "lucide-react";

const ROLETA_TIPOS = ["lead_roleta", "lead", "leads", "lead_timeout", "lead_urgente", "lead_ultimo_alerta", "fila_ceo"];
const ROLETA_CATEGORIAS = ["lead_novo", "lead_aceito", "lead_atribuido"];

const PIPELINE_TIPOS = ["lead_sem_contato", "lead_parado", "lead_alto_valor", "automacao", "sequencias", "radar_intencao"];
const PIPELINE_CATEGORIAS = ["lead_retorno", "lead_sem_atendimento", "problema_atendimento", "volume_leads"];

const VISITA_TIPOS = ["visitas", "visita_agendada", "visita_confirmada", "visita_noshow"];

const PERF_TIPOS = ["meta_atingida", "xp_conquista", "relatorio_semanal", "corretor_inativo", "zero_ligacoes", "corretor_ajuda", "alertas", "mensagem_gerente", "gerente_sem_visita", "propostas", "proposta_assinada", "vendas", "negocio_fechado"];

function matchesFilter(n: { tipo: string; categoria: string }, filter: string): boolean {
  if (filter === "todas") return true;
  if (filter === "roleta") return ROLETA_TIPOS.includes(n.tipo) || ROLETA_CATEGORIAS.includes(n.categoria);
  if (filter === "pipeline") return PIPELINE_TIPOS.includes(n.tipo) || PIPELINE_CATEGORIAS.includes(n.categoria);
  if (filter === "visitas") return VISITA_TIPOS.includes(n.tipo) || n.categoria?.startsWith("visita");
  if (filter === "performance") return PERF_TIPOS.includes(n.tipo);
  return true;
}

const FILTER_TABS = [
  { key: "todas", label: "Todas", activeColor: "#2563EB" },
  { key: "roleta", label: "🎰 Roleta", activeColor: "#3B82F6" },
  { key: "pipeline", label: "📋 Pipeline", activeColor: "#8B5CF6" },
  { key: "visitas", label: "📅 Visitas", activeColor: "#059669" },
  { key: "performance", label: "🏆 Performance", activeColor: "#D97706" },
];

export default function Notificacoes() {
  const { notifications, unreadCount, isLoading, markAsRead, markAllAsRead, deleteNotification } = useNotifications();
  const [activeFilter, setActiveFilter] = useState("todas");
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);

  const filtered = notifications.filter((n) => {
    if (!matchesFilter(n, activeFilter)) return false;
    if (showUnreadOnly && n.lida) return false;
    return true;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-black text-foreground" style={{ fontSize: 28 }}>
            🔔 Central de Notificações
          </h1>
          <p className="mt-1" style={{ fontSize: 14 }}>
            {unreadCount > 0 ? (
              <span className="text-muted-foreground">{unreadCount} não lida{unreadCount > 1 ? "s" : ""}</span>
            ) : (
              <span className="text-green-500 font-medium">Tudo em dia! ✅</span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowUnreadOnly(!showUnreadOnly)}
            className="text-muted-foreground font-medium transition-colors border border-border rounded-lg px-3.5 py-1.5 text-[13px] hover:bg-muted"
          >
            {showUnreadOnly ? "Mostrar todas" : "Só não lidas"}
          </button>
          {unreadCount > 0 && (
            <button
              onClick={() => markAllAsRead()}
              className="flex items-center gap-1.5 text-muted-foreground font-medium transition-colors border border-border rounded-lg px-3.5 py-1.5 text-[13px] hover:bg-muted"
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
          const count = notifications.filter((n) => matchesFilter(n, tab.key)).length;
          const isActive = activeFilter === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveFilter(tab.key)}
              className="flex items-center gap-1.5 font-medium transition-all rounded-lg px-3.5 py-1.5 text-[13px]"
              style={{
                background: isActive ? tab.activeColor : "transparent",
                color: isActive ? "#fff" : undefined,
                border: isActive ? `1px solid ${tab.activeColor}` : "1px solid hsl(var(--border))",
              }}
            >
              {tab.label}
              {count > 0 && (
                <span
                  className="font-semibold text-[10px] rounded-full px-1.5"
                  style={{
                    background: isActive ? "rgba(255,255,255,0.25)" : "hsl(var(--muted))",
                    color: isActive ? "#fff" : "hsl(var(--muted-foreground))",
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
      <div className="rounded-2xl border border-border overflow-hidden bg-card">
        <NotificationList
          notifications={filtered}
          onMarkAsRead={markAsRead}
          onDelete={deleteNotification}
        />
      </div>
    </div>
  );
}
