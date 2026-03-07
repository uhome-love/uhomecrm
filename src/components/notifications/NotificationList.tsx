import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  UserPlus, Phone, RefreshCcw, Calendar, FileText,
  AlertTriangle, TrendingDown, ShoppingCart, BarChart3,
  Bell, X, Check
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { Notification } from "@/hooks/useNotifications";

const CATEGORY_CONFIG: Record<string, { icon: React.ElementType; color: string }> = {
  novo_lead: { icon: UserPlus, color: "text-emerald-500" },
  lead_aguardando: { icon: Phone, color: "text-amber-500" },
  lead_redistribuido: { icon: RefreshCcw, color: "text-blue-500" },
  visita_confirmada: { icon: Calendar, color: "text-primary" },
  proposta_enviada: { icon: FileText, color: "text-violet-500" },
  lead_sem_atendimento: { icon: AlertTriangle, color: "text-destructive" },
  corretor_parado: { icon: AlertTriangle, color: "text-amber-500" },
  visita_marcada: { icon: Calendar, color: "text-emerald-500" },
  proposta_criada: { icon: FileText, color: "text-violet-500" },
  meta_abaixo: { icon: TrendingDown, color: "text-destructive" },
  venda_assinada: { icon: ShoppingCart, color: "text-emerald-600" },
  volume_leads: { icon: BarChart3, color: "text-blue-500" },
  problema_atendimento: { icon: AlertTriangle, color: "text-destructive" },
  alerta_previsao: { icon: TrendingDown, color: "text-amber-500" },
};

const TIPO_LABELS: Record<string, string> = {
  leads: "Leads",
  visitas: "Visitas",
  propostas: "Propostas",
  vendas: "Vendas",
  alertas: "Alertas",
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
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Bell className="h-8 w-8 mb-2 opacity-40" />
        <p className="text-sm">Nenhuma notificação</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border">
      {notifications.map((n) => {
        const config = CATEGORY_CONFIG[n.categoria] || { icon: Bell, color: "text-muted-foreground" };
        const Icon = config.icon;

        return (
          <div
            key={n.id}
            className={cn(
              "flex gap-3 px-4 py-3 hover:bg-muted/50 transition-colors cursor-pointer group",
              !n.lida && "bg-primary/5"
            )}
            onClick={() => !n.lida && onMarkAsRead(n.id)}
          >
            <div className={cn("mt-0.5 shrink-0", config.color)}>
              <Icon className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <p className={cn("text-xs font-medium text-foreground leading-tight", !n.lida && "font-semibold")}>
                  {n.titulo}
                  {n.agrupamento_count > 1 && (
                    <span className="ml-1.5 text-[10px] bg-muted px-1.5 py-0.5 rounded-full text-muted-foreground">
                      ×{n.agrupamento_count}
                    </span>
                  )}
                </p>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  {!n.lida && (
                    <Button variant="ghost" size="icon" className="h-5 w-5" onClick={(e) => { e.stopPropagation(); onMarkAsRead(n.id); }}>
                      <Check className="h-3 w-3" />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive" onClick={(e) => { e.stopPropagation(); onDelete(n.id); }}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              {!compact && (
                <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{n.mensagem}</p>
              )}
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] text-muted-foreground">
                  {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: ptBR })}
                </span>
                <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                  {TIPO_LABELS[n.tipo] || n.tipo}
                </span>
                {!n.lida && <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
