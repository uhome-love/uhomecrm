/**
 * dashboardTelemetry — Fire-and-forget logger para eventos do Dashboard do Corretor v3.
 * Padrão alinhado com focusTelemetry.
 */
import { supabase } from "@/integrations/supabase/client";

export type DashboardEvent =
  | "dashboard_kpi_click"
  | "dashboard_action_click"
  | "dashboard_task_click"
  | "dashboard_tasks_accordion_toggled";

export function logDashboard(event: DashboardEvent, ctx: Record<string, unknown> = {}): void {
  void supabase
    .from("ops_events")
    .insert({
      fn: event,
      level: "info",
      category: "dashboard_corretor",
      message: event,
      ctx: ctx as never,
    })
    .then(({ error }) => {
      if (error) console.warn("[dashboardTelemetry]", event, error.message);
    });
}
