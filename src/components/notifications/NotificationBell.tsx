import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNotifications } from "@/hooks/useNotifications";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import NotificationList from "./NotificationList";

export default function NotificationBell() {
  const { notifications, unreadCount, markAllAsRead, markAsRead, deleteNotification } = useNotifications();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9 rounded-xl hover:bg-muted/50">
          <Bell className="h-4 w-4 text-muted-foreground" />
          {unreadCount > 0 && (
            <>
              <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
              <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-destructive animate-ping opacity-40" />
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0 max-h-[500px] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Notificações</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-primary h-7"
              onClick={() => markAllAsRead()}
            >
              Marcar todas como lidas
            </Button>
          )}
        </div>
        <div className="overflow-y-auto flex-1">
          <NotificationList
            notifications={notifications.slice(0, 20)}
            onMarkAsRead={markAsRead}
            onDelete={deleteNotification}
            compact
          />
        </div>
        {notifications.length > 20 && (
          <div className="border-t border-border px-4 py-2">
            <a href="/notificacoes" className="text-xs text-primary hover:underline">
              Ver todas as notificações
            </a>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
