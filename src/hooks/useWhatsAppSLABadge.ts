import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";

const SLA_KEY = "whatsapp_sla_critical";
const INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

function updateSLAStorage(count: number) {
  localStorage.setItem(SLA_KEY, String(count));
  window.dispatchEvent(
    new StorageEvent("storage", { key: SLA_KEY, newValue: String(count) })
  );
}

/**
 * For gestor/admin: periodically counts leads waiting >2h without reply.
 * Stores result in localStorage so Sidebar can read it.
 * Does nothing for corretores.
 */
export function useWhatsAppSLABadge() {
  const { user } = useAuth();
  const { isGestor, isAdmin } = useUserRole();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!user?.id || (!isGestor && !isAdmin)) return;

    const calculate = async () => {
      try {
        // Get team member profile IDs
        let profileIds: string[] = [];

        if (isAdmin) {
          const { data: members } = await supabase
            .from("team_members")
            .select("user_id")
            .eq("status", "ativo");
          if (members && members.length > 0) {
            const userIds = members.map(m => m.user_id).filter(Boolean) as string[];
            const { data: profiles } = await supabase
              .from("profiles")
              .select("id")
              .in("user_id", userIds);
            profileIds = (profiles || []).map(p => p.id);
          }
        } else {
          // Gestor: only their team
          const { data: members } = await supabase
            .from("team_members")
            .select("user_id")
            .eq("gerente_id", user.id)
            .eq("status", "ativo");
          if (members && members.length > 0) {
            const userIds = members.map(m => m.user_id).filter(Boolean) as string[];
            const { data: profiles } = await supabase
              .from("profiles")
              .select("id")
              .in("user_id", userIds);
            profileIds = (profiles || []).map(p => p.id);
          }
        }

        if (profileIds.length === 0) {
          updateSLAStorage(0);
          return;
        }

        // Get last message per lead for these corretores
        const { data: msgs } = await supabase
          .from("whatsapp_mensagens")
          .select("lead_id, direction, timestamp")
          .in("corretor_id", profileIds)
          .order("timestamp", { ascending: false })
          .limit(1000);

        if (!msgs || msgs.length === 0) {
          updateSLAStorage(0);
          return;
        }

        // Find leads where last message is "received" and older than 2h
        const now = new Date();
        const twoHoursMs = 2 * 60 * 60 * 1000;
        const lastByLead = new Map<string, { direction: string; timestamp: string }>();

        for (const m of msgs) {
          if (!m.lead_id) continue;
          if (!lastByLead.has(m.lead_id)) {
            lastByLead.set(m.lead_id, { direction: m.direction, timestamp: m.timestamp });
          }
        }

        let criticalCount = 0;
        for (const [, info] of lastByLead) {
          if (
            info.direction === "received" &&
            now.getTime() - new Date(info.timestamp).getTime() > twoHoursMs
          ) {
            criticalCount++;
          }
        }

        updateSLAStorage(criticalCount);
      } catch {
        // Silently fail
      }
    };

    calculate();
    intervalRef.current = setInterval(calculate, INTERVAL_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [user?.id, isGestor, isAdmin]);
}
