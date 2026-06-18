import { useCallback, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type AppRole = "admin" | "diretor" | "gestor" | "corretor" | "backoffice" | "rh";

const STORAGE_PREFIX = "uhome:roles:";

function readCachedRoles(userId: string | undefined): AppRole[] | null {
  if (!userId || typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_PREFIX + userId);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as AppRole[];
  } catch {
    // ignore
  }
  return null;
}

function writeCachedRoles(userId: string, roles: AppRole[]) {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_PREFIX + userId, JSON.stringify(roles));
  } catch {
    // ignore
  }
}

export function useUserRole() {
  const { user } = useAuth();
  const lastKnownRef = useRef<AppRole[] | null>(null);

  // Hidrata cache ao montar / trocar de usuário
  useEffect(() => {
    if (!user?.id) {
      lastKnownRef.current = null;
      return;
    }
    const cached = readCachedRoles(user.id);
    if (cached && cached.length > 0) lastKnownRef.current = cached;
  }, [user?.id]);

  // Pré-carrega cache sessionStorage para a primeira render (evita loading=true bloqueando UI)
  const initialCached = user?.id ? readCachedRoles(user.id) : null;

  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: ["user-roles", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id);
      if (error) throw error;
      const roles = (data || []).map((r) => r.role as AppRole);
      if (user?.id && roles.length > 0) {
        writeCachedRoles(user.id, roles);
        lastKnownRef.current = roles;
      }
      return roles;
    },
    enabled: !!user,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    // Cache do sessionStorage destrava o loading inicial; refetch acontece em background.
    placeholderData: initialCached && initialCached.length > 0 ? initialCached : undefined,
    // Retry curto: não segura a UI por minutos em flap de Wi-Fi.
    retry: 1,
    retryDelay: 500,
  });

  // Loading só conta se NÃO temos cache; com cache, UI prossegue.
  const loading = isLoading && !(initialCached && initialCached.length > 0);

  // Se a query falhou e temos cache, usar cache. Caso contrário, array vazio.
  const queryRoles = data ?? [];
  const roles: AppRole[] =
    queryRoles.length > 0
      ? queryRoles
      : lastKnownRef.current ?? [];

  const rolesStale = queryRoles.length === 0 && (lastKnownRef.current?.length ?? 0) > 0;
  const rolesUnavailable = queryRoles.length === 0 && (lastKnownRef.current?.length ?? 0) === 0 && !!error;

  const hasRole = useCallback(
    (role: AppRole) => roles.includes(role),
    [roles]
  );

  const isGestor = hasRole("gestor") || hasRole("admin");
  const isCorretor = hasRole("corretor");
  const isAdmin = hasRole("admin");
  const isBackoffice = hasRole("backoffice");
  const isRh = hasRole("rh");

  return {
    roles,
    loading,
    isFetching,
    error,
    rolesStale,
    rolesUnavailable,
    hasRole,
    isGestor,
    isCorretor,
    isAdmin,
    isBackoffice,
    isRh,
  };
}
