import { useEffect, useState, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface UserProfile {
  id: string;         // profiles.id (FK for negocios, team_members, etc.)
  user_id: string;    // auth.users.id (FK for pipeline_leads.corretor_id)
  nome: string;
  email: string | null;
  telefone: string | null;
  cargo: string | null;
  avatar_url: string | null;
  avatar_gamificado_url: string | null;
  gerente_id: string | null;
}

/**
 * Central identity hook — provides both auth user and profile with both IDs.
 * 
 * Usage:
 *   const { authUserId, profileId, profile, isLoading } = useAuthUser();
 * 
 * ID Mapping Rules:
 *   - pipeline_leads.corretor_id → uses authUserId (auth.users.id)
 *   - negocios.corretor_id → uses profileId (profiles.id)
 *   - team_members.user_id → uses authUserId
 *   - team_members.gerente_id → uses authUserId
 *   - roleta_credenciamentos.corretor_id → uses profileId
 */
export function useAuthUser() {
  const { user, session, loading: authLoading } = useAuth();

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["auth-user-profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, user_id, nome, email, telefone, cargo, avatar_url, avatar_gamificado_url")
        .eq("user_id", user!.id)
        .single();
      if (error) throw error;
      return { ...data, gerente_id: null } as UserProfile;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const authUserId = user?.id ?? null;
  const profileId = profile?.id ?? null;

  const isLoading = authLoading || (!!user && profileLoading);

  return {
    user,
    session,
    profile,
    authUserId,
    profileId,
    isLoading,
  };
}

// ─── Utility helpers for ID resolution ───

/** Get profile IDs for a list of auth user IDs */
export async function resolveProfileIds(authUserIds: string[]): Promise<Map<string, string>> {
  if (authUserIds.length === 0) return new Map();
  const { data } = await supabase
    .from("profiles")
    .select("id, user_id")
    .in("user_id", authUserIds);
  return new Map((data || []).map(p => [p.user_id, p.id]));
}

/** Get auth user IDs for a list of profile IDs */
export async function resolveAuthUserIds(profileIds: string[]): Promise<Map<string, string>> {
  if (profileIds.length === 0) return new Map();
  const { data } = await supabase
    .from("profiles")
    .select("id, user_id")
    .in("id", profileIds);
  const entries: [string, string][] = (data || [])
    .filter(p => p.user_id)
    .map(p => [p.id, p.user_id!]);
  return new Map(entries);
}

/** Get team member user_ids managed by a gerente (using auth user ID) */
export async function getManagedTeamUserIds(gerenteAuthUserId: string): Promise<string[]> {
  const { data } = await supabase
    .from("team_members")
    .select("user_id")
    .eq("gerente_id", gerenteAuthUserId)
    .eq("status", "ativo");
  return (data || []).map(m => m.user_id).filter(Boolean) as string[];
}

/** Get team member profile IDs managed by a gerente */
export async function getManagedTeamProfileIds(gerenteAuthUserId: string): Promise<string[]> {
  const teamUserIds = await getManagedTeamUserIds(gerenteAuthUserId);
  if (teamUserIds.length === 0) return [];
  const mapping = await resolveProfileIds(teamUserIds);
  return [...mapping.values()];
}
