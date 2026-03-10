import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { todayBRT } from "@/lib/utils";

export interface SmartAlert {
  id: string;
  type: "checkpoint" | "pdn" | "meta" | "info";
  severity: "critical" | "warning" | "info";
  title: string;
  description: string;
  action?: { label: string; url: string };
}

export function useSmartAlerts() {
  const { user } = useAuth();
  const { isAdmin, isGestor } = useUserRole();
  const [alerts, setAlerts] = useState<SmartAlert[]>([]);
  const [loading, setLoading] = useState(true);

  // Badge counts by route
  const [badges, setBadges] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!user || (!isGestor && !isAdmin)) {
      setAlerts([]);
      setLoading(false);
      return;
    }

    const check = async () => {
      setLoading(true);
      const result: SmartAlert[] = [];
      const badgeCounts: Record<string, number> = {};
      const today = todayBRT();
      const now = new Date();
      const monthStart = format(startOfMonth(now), "yyyy-MM-dd");
      const monthEnd = format(endOfMonth(now), "yyyy-MM-dd");
      const dayOfMonth = now.getDate();
      const daysInMonth = endOfMonth(now).getDate();
      const pctMonthElapsed = dayOfMonth / daysInMonth;

      // 1. Checkpoint não preenchido hoje
      try {
        let cpQuery = supabase.from("checkpoints").select("id").eq("data", today);
        if (!isAdmin) cpQuery = cpQuery.eq("gerente_id", user.id);
        const { data: todayCps } = await cpQuery;

        if (!todayCps || todayCps.length === 0) {
          result.push({
            id: "checkpoint_missing",
            type: "checkpoint",
            severity: "critical",
            title: "Checkpoint não preenchido",
            description: "O checkpoint de hoje ainda não foi preenchido. Preencha para manter o controle do time.",
            action: { label: "Preencher agora", url: "/checkpoint" },
          });
          badgeCounts["/checkpoint"] = (badgeCounts["/checkpoint"] || 0) + 1;
        }
      } catch (e) {
        console.error("Alert check checkpoint:", e);
      }

      // 2. Negócios não preenchidos no mês atual
      try {
        const currentMonth = format(now, "yyyy-MM");
        const nextMonth = now.getMonth() === 11
          ? `${now.getFullYear() + 1}-01-01`
          : `${now.getFullYear()}-${String(now.getMonth() + 2).padStart(2, "0")}-01`;
        let negQuery = supabase.from("negocios").select("id", { count: "exact", head: true }).gte("created_at", `${currentMonth}-01T00:00:00`).lt("created_at", `${nextMonth}T00:00:00`);
        // Admin/CEO vê todos os negócios; gerente filtra pelo seu time (inclui negócios sem gerente_id)
        if (!isAdmin) {
          // Buscar corretores do time do gerente
          const { data: teamMembers } = await supabase
            .from("team_members")
            .select("user_id")
            .eq("gerente_id", user.id)
            .eq("status", "ativo");
          const teamIds = teamMembers?.map(m => m.user_id) || [];
          teamIds.push(user.id); // inclui o próprio gerente
          negQuery = negQuery.in("corretor_id", teamIds);
        }
        const { count: negCount } = await negQuery;

        if (negCount === 0 || negCount === null) {
          result.push({
            id: "negocios_missing",
            type: "pdn",
            severity: dayOfMonth > 5 ? "critical" : "warning",
            title: "Nenhum negócio registrado este mês",
            description: `O pipeline de negócios de ${format(now, "MMMM/yyyy")} ainda não possui registros.`,
            action: { label: "Ver Pipeline", url: "/pipeline" },
          });
          badgeCounts["/pipeline"] = (badgeCounts["/pipeline"] || 0) + 1;
        }
      } catch (e) {
        console.error("Alert check negocios:", e);
      }

      // 3. Metas em risco — check checkpoint_lines vs metas
      try {
        let cpMonthQuery = supabase.from("checkpoints").select("id, gerente_id").gte("data", monthStart).lte("data", monthEnd);
        if (!isAdmin) cpMonthQuery = cpMonthQuery.eq("gerente_id", user.id);
        const { data: monthCps } = await cpMonthQuery;

        if (monthCps && monthCps.length > 0) {
          const cpIds = monthCps.map(c => c.id);
          const { data: lines } = await supabase.from("checkpoint_lines").select("meta_visitas_realizadas, real_visitas_realizadas, meta_propostas, real_propostas, meta_vgv_assinado, real_vgv_assinado, corretor_id").in("checkpoint_id", cpIds);

          if (lines && lines.length > 0) {
            // Aggregate per corretor
            const corretorMap = new Map<string, { metaVis: number; realVis: number; metaProp: number; realProp: number }>();
            for (const l of lines) {
              const prev = corretorMap.get(l.corretor_id) || { metaVis: 0, realVis: 0, metaProp: 0, realProp: 0 };
              prev.metaVis += l.meta_visitas_realizadas ?? 0;
              prev.realVis += l.real_visitas_realizadas ?? 0;
              prev.metaProp += l.meta_propostas ?? 0;
              prev.realProp += l.real_propostas ?? 0;
              corretorMap.set(l.corretor_id, prev);
            }

            // Total aggregation
            let totalMetaVis = 0, totalRealVis = 0, totalMetaProp = 0, totalRealProp = 0;
            corretorMap.forEach(v => {
              totalMetaVis += v.metaVis;
              totalRealVis += v.realVis;
              totalMetaProp += v.metaProp;
              totalRealProp += v.realProp;
            });

            // If past 50% of month and below 40% of target
            if (pctMonthElapsed > 0.5) {
              const visPct = totalMetaVis > 0 ? totalRealVis / totalMetaVis : 1;
              const propPct = totalMetaProp > 0 ? totalRealProp / totalMetaProp : 1;

              if (visPct < 0.4) {
                result.push({
                  id: "meta_visitas_risco",
                  type: "meta",
                  severity: "critical",
                  title: "Meta de visitas em risco",
                  description: `Apenas ${Math.round(visPct * 100)}% da meta de visitas atingida com ${Math.round(pctMonthElapsed * 100)}% do mês transcorrido.`,
                  action: { label: "Ver checkpoint", url: "/checkpoint" },
                });
              }
              if (propPct < 0.4) {
                result.push({
                  id: "meta_propostas_risco",
                  type: "meta",
                  severity: "warning",
                  title: "Meta de propostas em risco",
                  description: `Apenas ${Math.round(propPct * 100)}% da meta de propostas atingida. Intensifique o acompanhamento.`,
                  action: { label: "Ver checkpoint", url: "/checkpoint" },
                });
              }
            }
          }
        }
      } catch (e) {
        console.error("Alert check metas:", e);
      }

      // 4. Negócios parados (sem atualização há mais de 7 dias)
      try {
        const sevenDaysAgo = format(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), "yyyy-MM-dd");
        let stalledQuery = supabase.from("negocios").select("id, nome_cliente, fase, updated_at").lt("updated_at", sevenDaysAgo).not("fase", "eq", "assinado").neq("status", "perdido");
        if (!isAdmin) stalledQuery = stalledQuery.eq("gerente_id", user.id);
        const { data: stalledNegocios } = await stalledQuery;

        if (stalledNegocios && stalledNegocios.length > 0) {
          result.push({
            id: "negocios_stalled",
            type: "pdn",
            severity: "warning",
            title: `${stalledNegocios.length} negócio(s) parado(s)`,
            description: `Existem negócios sem atualização há mais de 7 dias. Ex: ${stalledNegocios[0].nome_cliente}`,
            action: { label: "Ver Negócios", url: "/negocios" },
          });
          badgeCounts["/negocios"] = (badgeCounts["/negocios"] || 0) + stalledNegocios.length;
        }
      } catch (e) {
        console.error("Alert check stalled negocios:", e);
      }

      setAlerts(result.sort((a, b) => {
        const sev = { critical: 0, warning: 1, info: 2 };
        return sev[a.severity] - sev[b.severity];
      }));
      setBadges(badgeCounts);
      setLoading(false);
    };

    check();
  }, [user, isAdmin, isGestor]);

  return { alerts, badges, loading, alertCount: alerts.length };
}
