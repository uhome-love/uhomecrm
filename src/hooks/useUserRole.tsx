import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type AppRole = "admin" | "gestor" | "corretor";

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
    staleTime: 5 * 60 * 1000, // 5 min cache
    gcTime: 10 * 60 * 1000,
  });

  const hasRole = useCallback(
    (role: AppRole) => roles.includes(role),
    [roles]
  );

  const isGestor = hasRole("gestor") || hasRole("admin");
  const isCorretor = hasRole("corretor");
  const isAdmin = hasRole("admin");

  return { roles, loading, hasRole, isGestor, isCorretor, isAdmin };
}
