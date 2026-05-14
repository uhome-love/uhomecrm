import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/customClient";
import { useAuth } from "@/hooks/useAuth";

export type AppRole = "admin" | "gestor" | "corretor" | "backoffice" | "rh";

export function useUserRole() {
  const { user } = useAuth();

  const { data: roles = [], isLoading: loading } = useQuery({
    queryKey: ["user-roles", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id);
      if (error) throw error;
      return (data || []).map((r) => r.role as AppRole);
    },
    enabled: !!user,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  });

  const hasRole = useCallback(
    (role: AppRole) => roles.includes(role),
    [roles]
  );

  const isGestor = hasRole("gestor") || hasRole("admin");
  const isCorretor = hasRole("corretor");
  const isAdmin = hasRole("admin");
  const isBackoffice = hasRole("backoffice");
  const isRh = hasRole("rh");

  return { roles, loading, hasRole, isGestor, isCorretor, isAdmin, isBackoffice, isRh };
}
