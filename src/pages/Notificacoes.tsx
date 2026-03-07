import { useState } from "react";
import { useNotifications } from "@/hooks/useNotifications";
import NotificationList from "@/components/notifications/NotificationList";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, CheckCheck, Trash2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const FILTER_TABS = [
  { key: "todas", label: "Todas" },
  { key: "leads", label: "Leads" },
  { key: "visitas", label: "Visitas" },
  { key: "propostas", label: "Propostas" },
  { key: "vendas", label: "Vendas" },
  { key: "alertas", label: "Alertas" },
];

export default function Notificacoes() {
  const { notifications, unreadCount, isLoading, markAsRead, markAllAsRead, deleteNotification } = useNotifications();
  const [activeFilter, setActiveFilter] = useState("todas");
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);

  const filtered = notifications.filter((n) => {
    if (activeFilter !== "todas" && n.tipo !== activeFilter) return false;
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Bell className="h-6 w-6 text-primary" />
            Central de Notificações
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {unreadCount > 0 ? `${unreadCount} não lida${unreadCount > 1 ? "s" : ""}` : "Tudo em dia!"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="text-xs gap-1.5"
            onClick={() => setShowUnreadOnly(!showUnreadOnly)}
          >
            {showUnreadOnly ? "Mostrar todas" : "Só não lidas"}
          </Button>
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={() => markAllAsRead()}>
              <CheckCheck className="h-3.5 w-3.5" />
              Marcar todas como lidas
            </Button>
          )}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {FILTER_TABS.map((tab) => {
          const count = notifications.filter((n) => tab.key === "todas" || n.tipo === tab.key).length;
          return (
            <Button
              key={tab.key}
              variant={activeFilter === tab.key ? "default" : "outline"}
              size="sm"
              className="text-xs gap-1.5 h-8"
              onClick={() => setActiveFilter(tab.key)}
            >
              {tab.label}
              {count > 0 && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 ml-1">
                  {count}
                </Badge>
              )}
            </Button>
          );
        })}
      </div>

      {/* Notification list */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <NotificationList
          notifications={filtered}
          onMarkAsRead={markAsRead}
          onDelete={deleteNotification}
        />
      </div>
    </div>
  );
}
