import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";

export interface UsuarioCentralRow {
  user_id: string;
  profile_id: string | null;
  nome: string;
  email: string | null;
  telefone: string | null;
  cpf: string | null;
  creci: string | null;
  jetimob_user_id: string | null;
  avatar_url: string | null;
  role: string;
  ativo: boolean;
  gerente_id: string | null;
  gerente_nome: string | null;
  equipe: string | null;
  last_sign_in: string | null;
}

const ROLE_RANK: Record<string, number> = {
  admin: 6, diretor: 5, gestor: 4, backoffice: 3, rh: 2, corretor: 1,
};

export function useUsuariosCentral() {
  const { isAdmin, isDiretor } = useUserRole();
  const { user } = useAuth();
  const isPrivileged = isAdmin || isDiretor;

  const [rows, setRows] = useState<UsuarioCentralRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // list_profiles_admin (SECURITY DEFINER) devolve dados sensíveis (email/cpf/creci/telefone)
      // apenas para admin/gestor/diretor. Não podemos SELECT direto por causa de column privileges.
      const [profAdminRes, profBasicRes, rolesRes, tmRes, signInRes] = await Promise.all([
        supabase.rpc("list_profiles_admin"),
        supabase.from("profiles")
          .select("id, user_id, nome, avatar_url, ativo")
          .order("nome"),
        supabase.from("user_roles").select("user_id, role"),
        supabase.from("team_members").select("user_id, gerente_id, equipe, status"),
        isPrivileged
          ? supabase.functions.invoke("create-broker-user", { body: { action: "list_users" } })
          : Promise.resolve({ data: null, error: null } as any),
      ]);

      if (profBasicRes.error) throw profBasicRes.error;

      // profAdminRes pode falhar para papéis sem permissão — degradar sem quebrar.
      const adminById = new Map<string, any>();
      if (!profAdminRes.error && Array.isArray(profAdminRes.data)) {
        (profAdminRes.data as any[]).forEach((p) => adminById.set(p.id, p));
      }

      const roleMap = new Map<string, string>();
      (rolesRes.data || []).forEach((r: any) => {
        const cur = roleMap.get(r.user_id);
        if (!cur || (ROLE_RANK[r.role] || 0) > (ROLE_RANK[cur] || 0)) roleMap.set(r.user_id, r.role);
      });

      const teamByUser = new Map<string, { gerente_id: string | null; equipe: string | null }>();
      (tmRes.data || []).forEach((t: any) => {
        if (t.user_id) teamByUser.set(t.user_id, { gerente_id: t.gerente_id, equipe: t.equipe });
      });

      const nomeById = new Map<string, string>();
      (profBasicRes.data || []).forEach((p: any) => nomeById.set(p.user_id, p.nome || ""));

      const lastSignIn: Record<string, string | null> = signInRes?.data?.last_sign_in || {};

      let list: UsuarioCentralRow[] = (profBasicRes.data || []).map((p: any) => {
        const team = teamByUser.get(p.user_id);
        const gid = team?.gerente_id || null;
        const admin = adminById.get(p.user_id);
        return {
          user_id: p.user_id,
          profile_id: p.id,
          nome: p.nome || admin?.nome || "-",
          email: admin?.email ?? null,
          telefone: admin?.telefone ?? null,
          cpf: admin?.cpf ?? null,
          creci: admin?.creci ?? null,
          jetimob_user_id: null,
          avatar_url: p.avatar_url ?? admin?.avatar_url ?? null,
          role: roleMap.get(p.user_id) || "corretor",
          ativo: !!p.ativo,
          gerente_id: gid,
          gerente_nome: gid ? nomeById.get(gid) || null : null,
          equipe: team?.equipe || admin?.equipe || null,
          last_sign_in: lastSignIn[p.user_id] || null,
        };
      });

      if (!isPrivileged && user?.id) {
        list = list.filter((u) => u.gerente_id === user.id || u.user_id === user.id);
      }

      setRows(list);
    } catch (err: any) {
      console.error("[useUsuariosCentral] error", err);
      setError(err?.message || "Erro ao carregar usuários");
    } finally {
      setLoading(false);
    }
  }, [isPrivileged, user?.id]);

  useEffect(() => { load(); }, [load]);

  return { rows, loading, error, reload: load, isPrivileged };
}
