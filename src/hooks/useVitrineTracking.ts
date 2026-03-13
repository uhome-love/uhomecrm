import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Tracks client behavior on the public vitrine page.
 * Events: vitrine_opened, scroll_depth, time_on_page
 */
export function useVitrineTracking(vitrineId: string | undefined) {
  const startTime = useRef(Date.now());
  const maxScroll = useRef(0);
  const tracked = useRef({ opened: false, scroll50: false, scroll100: false });

  const track = useCallback((eventType: string, imovelId = "general", metadata: Record<string, any> = {}) => {
    if (!vitrineId) return;
    supabase.functions.invoke("vitrine-public", {
      body: { action: "track_event", vitrine_id: vitrineId, event_type: eventType, imovel_id: imovelId, metadata },
    }).catch(() => {});
  }, [vitrineId]);

  useEffect(() => {
    if (!vitrineId) return;

    // Track open
    if (!tracked.current.opened) {
      tracked.current.opened = true;
      track("vitrine_opened");
    }

    // Track scroll depth
    const handleScroll = () => {
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (scrollHeight <= 0) return;
      const pct = Math.round((window.scrollY / scrollHeight) * 100);
      maxScroll.current = Math.max(maxScroll.current, pct);

      if (pct >= 50 && !tracked.current.scroll50) {
        tracked.current.scroll50 = true;
        track("scroll_50");
      }
      if (pct >= 90 && !tracked.current.scroll100) {
        tracked.current.scroll100 = true;
        track("scroll_100");
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });

    // Track time on page when leaving
    const handleUnload = () => {
      const seconds = Math.round((Date.now() - startTime.current) / 1000);
      if (seconds > 5) {
        // Use sendBeacon for reliability
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/vitrine-public`;
        navigator.sendBeacon(url, JSON.stringify({
          action: "track_event",
          vitrine_id: vitrineId,
          event_type: "time_on_page",
          imovel_id: "general",
          metadata: { seconds, max_scroll_pct: maxScroll.current },
        }));
      }
    };

    window.addEventListener("beforeunload", handleUnload);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("beforeunload", handleUnload);
    };
  }, [vitrineId, track]);

  return track;
}
