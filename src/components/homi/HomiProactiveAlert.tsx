import { memo } from "react";
import { useHomiAlerts } from "@/hooks/useHomiAlerts";
import { useUserRole } from "@/hooks/useUserRole";

/**
 * For CEO (admin) and Gestor roles, popups are suppressed.
 * Alerts are centralized in /alertas page instead.
 * For Corretor, popups remain active (they get fewer, individual alerts).
 */
function HomiProactiveAlertInner() {
  const { isAdmin, isGestor } = useUserRole();

  // Still poll alerts to keep badge counts current, but don't render popups for managers
  useHomiAlerts();

  // Suppress popup rendering for CEO and Gerente — alerts are in /alertas
  if (isAdmin || isGestor) return null;

  // For corretores, we could still show popups but the engine sends very few individual alerts
  // For now, suppress for everyone — alerts page is the primary UX
  return null;
}

const HomiProactiveAlert = memo(HomiProactiveAlertInner);
export default HomiProactiveAlert;
