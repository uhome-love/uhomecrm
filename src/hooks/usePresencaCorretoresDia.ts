// =============================================================================
// usePresencaCorretoresDia — Lista TODOS os corretores relevantes do dia,
// credenciados ou não, para o painel de presença.
//
// - scope="gestor": corretores do time do gestor (team_members → profiles)
// - scope="ceo": todos os corretores ativos da empresa
//
// Junta com roleta_credenciamentos aprovados de hoje só pra saber quais turnos
// cada um se credenciou (informativo, não filtra a lista).
//
// IMPORTANTE: corretor_id retornado é profiles.id (mesmo id usado por
// roleta_presencas e roleta_credenciamentos).
// =============================================================================
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { todayBRT } from "@/lib/utils";
import { getCurrentWindowInfo } from "./useRoleta";

export type PresencaScope = "gestor" | "ceo";

export interface CorretorPresenca {
  corretor_id: string; // profiles.id
  nome: string | null;
  avatar_url: string | null;
  credenciamentos: string[]; // ex: ['manha','tarde'] ou ['dia_todo']
  gerente_id: string | null;   // profiles.id do gestor (ou null)
  gerente_nome: string | null; // nome do gestor (ou null)
}

export interface PresencaCorretoresDia {
  turno_ativo_atual: string;
  corretores: CorretorPresenca[];
}

export function usePresencaCorretoresDia(
  scope: PresencaScope,
  gestorId?: string,
) {
  const dataAlvo = todayBRT();
  const enabled = scope === "ceo" || !!gestorId;

  return useQuery({
    queryKey: ["presenca-corretores-dia", scope, gestorId, dataAlvo],
    enabled,
    staleTime: 30_000,
    queryFn: async (): Promise<PresencaCorretoresDia> => {
      // 1. Lista de profiles.id dos corretores no escopo
      let corretorProfileIds: string[] = [];
      const profilesById = new Map<
        string,
        { nome: string | null; avatar_url: string | null }
      >();

      if (scope === "gestor") {
        // team_members.user_id = auth.users.id → precisa mapear pra profiles.id
        const { data: tm, error: tmErr } = await supabase
          .from("team_members")
          .select("user_id")
          .eq("gerente_id", gestorId!)
          .eq("status", "ativo");
        if (tmErr) throw tmErr;
        const authIds = Array.from(
          new Set((tm ?? []).map((r: any) => r.user_id).filter(Boolean)),
        );
        if (authIds.length > 0) {
          const { data: profs, error: pErr } = await supabase
            .from("profiles")
            .select("id, nome, avatar_url")
            .in("user_id", authIds)
            .eq("ativo", true);
          if (pErr) throw pErr;
          for (const p of profs ?? []) {
            profilesById.set((p as any).id, {
              nome: (p as any).nome ?? null,
              avatar_url: (p as any).avatar_url ?? null,
            });
            corretorProfileIds.push((p as any).id);
          }
        }
      } else {
        // CEO: todos os corretores ativos
        const { data: profs, error } = await supabase
          .from("profiles")
          .select("id, nome, avatar_url")
          .eq("cargo", "corretor")
          .eq("ativo", true)
          .order("nome");
        if (error) throw error;
        for (const p of profs ?? []) {
          profilesById.set((p as any).id, {
            nome: (p as any).nome ?? null,
            avatar_url: (p as any).avatar_url ?? null,
          });
          corretorProfileIds.push((p as any).id);
        }
      }

      // 2. Credenciamentos aprovados de hoje (só selo informativo)
      const credByCorretor = new Map<string, string[]>();
      if (corretorProfileIds.length > 0) {
        const { data: creds, error } = await supabase
          .from("roleta_credenciamentos")
          .select("corretor_id, janela")
          .eq("data", dataAlvo)
          .eq("status", "aprovado")
          .in("corretor_id", corretorProfileIds);
        if (error) throw error;
        for (const c of creds ?? []) {
          const arr = credByCorretor.get((c as any).corretor_id) ?? [];
          arr.push((c as any).janela);
          credByCorretor.set((c as any).corretor_id, arr);
        }
      }

      // 3. Gestor de cada corretor (team_members.user_id = auth.users.id;
      //    resolvemos para profiles.id do corretor e do gestor).
      const gerenteByCorretor = new Map<
        string,
        { id: string | null; nome: string | null }
      >();
      if (corretorProfileIds.length > 0) {
        // profiles.id → user_id (auth) do corretor
        const { data: corretorProfs } = await supabase
          .from("profiles")
          .select("id, user_id")
          .in("id", corretorProfileIds);
        const userIdByProfileId = new Map<string, string>();
        const corretorUserIds: string[] = [];
        for (const p of corretorProfs ?? []) {
          const uid = (p as any).user_id as string | null;
          if (uid) {
            userIdByProfileId.set((p as any).id, uid);
            corretorUserIds.push(uid);
          }
        }
        if (corretorUserIds.length > 0) {
          const { data: tm } = await supabase
            .from("team_members")
            .select("user_id, gerente_id")
            .in("user_id", corretorUserIds)
            .eq("status", "ativo");
          // gerente_id em team_members = auth.users.id (não profiles.id)
          const gerenteByCorretorUserId = new Map<string, string>();
          const gerenteAuthIds = new Set<string>();
          for (const r of tm ?? []) {
            const uid = (r as any).user_id;
            const gid = (r as any).gerente_id;
            if (uid && gid) {
              gerenteByCorretorUserId.set(uid, gid);
              gerenteAuthIds.add(gid);
            }
          }
          const gerenteNomeByAuthId = new Map<string, string>();
          if (gerenteAuthIds.size > 0) {
            const { data: gps } = await supabase
              .from("profiles")
              .select("user_id, nome")
              .in("user_id", Array.from(gerenteAuthIds));
            for (const g of gps ?? []) {
              gerenteNomeByAuthId.set(
                (g as any).user_id,
                (g as any).nome ?? "—",
              );
            }
          }
          for (const [profileId, uid] of userIdByProfileId.entries()) {
            const gid = gerenteByCorretorUserId.get(uid) ?? null;
            gerenteByCorretor.set(profileId, {
              id: gid,
              nome: gid ? gerenteNomeByAuthId.get(gid) ?? null : null,
            });
          }
        }
      }

      const corretores: CorretorPresenca[] = corretorProfileIds
        .map((id) => {
          const prof = profilesById.get(id)!;
          const ger = gerenteByCorretor.get(id);
          return {
            corretor_id: id,
            nome: prof.nome,
            avatar_url: prof.avatar_url,
            credenciamentos: credByCorretor.get(id) ?? [],
            gerente_id: ger?.id ?? null,
            gerente_nome: ger?.nome ?? null,
          };
        })
        .sort((a, b) =>
          (a.nome ?? "").localeCompare(b.nome ?? "", "pt-BR", {
            sensitivity: "base",
          }),
        );

      return {
        turno_ativo_atual: getCurrentWindowInfo().janela,
        corretores,
      };
    },
  });
}
