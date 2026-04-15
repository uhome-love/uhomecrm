import { useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

/**
 * Global hook — shows a toast when a WhatsApp message is received
 * while the user is on any page EXCEPT /whatsapp (to avoid duplication).
 * Only fires when the tab is visible (browser notifications cover background tabs).
 */
export function useWhatsAppNotifications() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const profileIdRef = useRef<string | null>(null);
  const locationRef = useRef(location.pathname);
  locationRef.current = location.pathname;

  // Fetch profileId once
  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        if (data) profileIdRef.current = data.id;
      });
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel("global-whatsapp-toast")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "whatsapp_mensagens" },
        async (payload) => {
          const msg = payload.new as any;

          // Only received messages for this corretor
          if (msg.direction !== "received") return;
          if (!profileIdRef.current || msg.corretor_id !== profileIdRef.current) return;

          // Skip if user is on the WhatsApp inbox (it has its own notifications)
          if (locationRef.current.startsWith("/whatsapp")) return;

          // Skip if tab is not visible (browser notification covers this)
          if (document.visibilityState !== "visible") return;

          // Get lead name
          let leadName = "Novo lead";
          if (msg.lead_id) {
            const { data } = await supabase
              .from("pipeline_leads")
              .select("nome")
              .eq("id", msg.lead_id)
              .maybeSingle();
            if (data?.nome) leadName = data.nome;
          }

          const preview = (msg.body || "Nova mensagem").slice(0, 50);

          toast(`💬 ${leadName}`, {
            description: preview,
            duration: 5000,
            action: {
              label: "Responder",
              onClick: () => navigate(`/whatsapp?lead=${msg.lead_id}`),
            },
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, navigate]);
}
