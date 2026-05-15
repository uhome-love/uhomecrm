/**
 * Hook that returns the current broker's slug_ref for personalized share URLs.
 * Caches the value in memory so it's only fetched once per session.
 */
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

let cachedSlug: string | null = null;
let cacheUserId: string | null = null;

export function useBrokerSlug() {
  const { user } = useAuth();
  const [slugRef, setSlugRef] = useState<string | null>(
    user?.id === cacheUserId ? cachedSlug : null
  );

  useEffect(() => {
    if (!user?.id) return;
    if (user.id === cacheUserId && cachedSlug !== null) {
      setSlugRef(cachedSlug);
      return;
    }
    supabase
      .from("profiles")
      .select("slug_ref")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        const slug = data?.slug_ref ?? null;
        cachedSlug = slug;
        cacheUserId = user.id;
        setSlugRef(slug);
      });
  }, [user?.id]);

  return slugRef;
}
