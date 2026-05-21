import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Clock } from "lucide-react";
import type { FocusLead } from "@/hooks/useFocusLeads";

interface Props {
  lead: FocusLead;
  onAlertClick?: (taskId: string, titulo: string) => void;
}

export default function LeadHeader({ lead, onAlertClick }: Props) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shrink-0"
          style={{ background: "var(--gradient-focus, linear-gradient(135deg, #4969FF, #7C3AED))" }}
        >
          {lead.name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-white font-bold text-base sm:text-lg truncate" style={{ fontFamily: "var(--font-focus-display, inherit)" }}>
            {lead.name}
          </h3>
          <span className="text-gray-400 text-xs">{lead.stage}</span>
        </div>
      </div>

      {lead.alert_reasons.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {lead.alert_reasons.map((reason, i) => {
            const isOverdue = reason.includes("vencida");
            const canClick = isOverdue && lead.overdue_task_list.length > 0 && !!onAlertClick;
            const isCritical = reason.startsWith("🔴") || isOverdue;
            const isWarning = reason.startsWith("🟠");
            const isAttention = reason.startsWith("🟡");
            const bg = isCritical ? "rgba(239,68,68,0.15)"
              : isWarning ? "rgba(249,115,22,0.15)"
              : isAttention ? "rgba(245,158,11,0.15)"
              : "rgba(148,163,184,0.15)";
            const fg = isCritical ? "#f87171"
              : isWarning ? "#fb923c"
              : isAttention ? "#fbbf24"
              : "#94a3b8";
            return (
              <Badge
                key={i}
                onClick={canClick ? () => {
                  const t = lead.overdue_task_list[0];
                  onAlertClick!(t.id, t.titulo);
                } : undefined}
                className={`text-[10px] font-semibold border-0 ${canClick ? "cursor-pointer hover:brightness-125 transition" : ""}`}
                style={{ background: bg, color: fg }}
              >
                <AlertTriangle className="w-3 h-3 mr-1" />
                {reason}{canClick ? " · concluir" : ""}
              </Badge>
            );
          })}
        </div>
      )}

      {lead.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {lead.tags.map((tag, i) => (
            <Badge
              key={i}
              variant="secondary"
              className="text-[10px]"
              style={{ background: "rgba(255,255,255,0.06)", color: "#94a3b8", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              {tag}
            </Badge>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="flex items-center gap-1.5 text-gray-400">
          <Clock className="w-3.5 h-3.5" />
          <span>{lead.days_without_contact < 999 ? `${lead.days_without_contact}d sem contato` : "Sem contato"}</span>
        </div>
        {lead.origin && <div className="text-gray-400 truncate">📍 {lead.origin}</div>}
        {lead.interest && <div className="text-gray-400 truncate">🏠 {lead.interest}</div>}
        {lead.phone && <div className="text-gray-400 truncate">📱 {lead.phone}</div>}
      </div>
    </div>
  );
}
