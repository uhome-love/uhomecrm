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
      const [profRes, rolesRes, tmRes, signInRes] = await Promise.all([
        supabase.from("profiles")
          .select("id, user_id, nome, email, telefone, cpf, creci, jetimob_user_id, avatar_url, ativo")
          .order("nome"),
        supabase.from("user_roles").select("user_id, role"),
        supabase.from("team_members").select("user_id, gerente_id, equipe, status"),
        isPrivileged
          ? supabase.functions.invoke("create-broker-user", { body: { action: "list_users" } })
          : Promise.resolve({ data: null, error: null } as any),
      ]);

      if (profRes.error) throw profRes.error;

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
      (profRes.data || []).forEach((p: any) => nomeById.set(p.user_id, p.nome || ""));

      const lastSignIn: Record<string, string | null> = signInRes?.data?.last_sign_in || {};

      let list: UsuarioCentralRow[] = (profRes.data || []).map((p: any) => {
        const team = teamByUser.get(p.user_id);
        const gid = team?.gerente_id || null;
        return {
          user_id: p.user_id,
          profile_id: p.id,
          nome: p.nome || "-",
          email: p.email,
          telefone: p.telefone,
          cpf: p.cpf,
          creci: p.creci,
          jetimob_user_id: p.jetimob_user_id,
          avatar_url: p.avatar_url,
          role: roleMap.get(p.user_id) || "corretor",
          ativo: !!p.ativo,
          gerente_id: gid,
          gerente_nome: gid ? nomeById.get(gid) || null : null,
          equipe: team?.equipe || null,
          last_sign_in: lastSignIn[p.user_id] || null,
        };
      });

      // Non-privileged (gerente): scope to own team
      if (!isPrivileged && user?.id) {
        list = list.filter((u) => u.gerente_id === user.id || u.user_id === user.id);
      }

      setRows(list);
    } catch (err: any) {
      setError(err?.message || "Erro ao carregar usuários");
    } finally {
      setLoading(false);
    }
  }, [isPrivileged, user?.id]);

  useEffect(() => { load(); }, [load]);

  return { rows, loading, error, reload: load, isPrivileged };
}
