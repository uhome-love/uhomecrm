/**
 * PipelineTeamOfertaAtiva — Compact collapsible panel showing the gerente's
 * team oferta ativa activity (today's calls, results, active sessions).
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/paginatedFetch";
import { useAuth } from "@/hooks/useAuth";
import { format, startOfDay } from "date-fns";
import { ChevronDown, ChevronRight, Phone, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface TeamTentativa {
  corretor_id: string;
  resultado: string;
}

interface TeamMember {
  user_id: string;
  nome: string;
}

const RESULT_LABELS: Record<string, { label: string; color: string }> = {
  com_interesse: { label: "Com interesse", color: "#10b981" },
  sem_interesse: { label: "Sem interesse", color: "#ef4444" },
  nao_atendeu: { label: "Não atendeu", color: "#f59e0b" },
  numero_errado: { label: "Nº errado", color: "#a1a1aa" },
  retornar: { label: "Retornar", color: "#6366f1" },
  caixa_postal: { label: "Cx. postal", color: "#a1a1aa" },
};

export default function PipelineTeamOfertaAtiva() {
  const { user } = useAuth();
  const [expanded, setExpanded] = useState(false);

  const today = format(startOfDay(new Date()), "yyyy-MM-dd");

  const { data, isLoading } = useQuery({
    queryKey: ["pipeline-team-oferta-ativa", user?.id, today],
    queryFn: async () => {
      // Get team members
      const { data: team } = await supabase
        .from("team_members")
        .select("user_id, nome")
        .eq("gerente_id", user!.id)
        .eq("status", "ativo");

      const members = (team || []) as TeamMember[];
      const teamUserIds = members.map(t => t.user_id).filter(Boolean);
      if (teamUserIds.length === 0) return { members: [], tentativas: [], byCorretor: {} };

      // Get today's tentativas — paginated to avoid 1000-row cap
      const tentativas = await fetchAllRows<TeamTentativa>((from, to) =>
        supabase
          .from("oferta_ativa_tentativas")
          .select("corretor_id, resultado")
          .in("corretor_id", teamUserIds)
          .gte("created_at", today + "T00:00:00")
          .lte("created_at", today + "T23:59:59")
          .range(from, to)
      );

      const allTentativas = (tentativas || []) as TeamTentativa[];

      // Group by corretor
      const byCorretor: Record<string, { nome: string; total: number; comInteresse: number; results: Record<string, number> }> = {};
      for (const m of members) {
        if (!m.user_id) continue;
        byCorretor[m.user_id] = { nome: m.nome, total: 0, comInteresse: 0, results: {} };
      }
      for (const t of allTentativas) {
        if (!byCorretor[t.corretor_id]) continue;
        byCorretor[t.corretor_id].total++;
        if (t.resultado === "com_interesse") byCorretor[t.corretor_id].comInteresse++;
        byCorretor[t.corretor_id].results[t.resultado] = (byCorretor[t.corretor_id].results[t.resultado] || 0) + 1;
      }

      return { members, tentativas: allTentativas, byCorretor };
    },
    enabled: !!user,
    staleTime: 30000,
    refetchInterval: 60000,
  });

  const totalLigacoes = data?.tentativas.length || 0;
  const totalInteresse = data?.tentativas.filter(t => t.resultado === "com_interesse").length || 0;
  const activeCorretores = Object.values(data?.byCorretor || {}).filter(c => c.total > 0);

  if (isLoading) return null;
  if (!data || data.members.length === 0) return null;

  return (
    <div
      className="rounded-[10px] overflow-hidden"
      style={{
        background: "#fff",
        border: "1px solid #e8e8f0",
      }}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-2 transition-colors hover:bg-[#f7f7fb]"
        style={{ height: 36, padding: "0 12px" }}
      >
        {expanded
          ? <ChevronDown className="h-3 w-3 text-[#a1a1aa]" />
          : <ChevronRight className="h-3 w-3 text-[#a1a1aa]" />
        }
        <Phone className="h-3.5 w-3.5 text-[#f59e0b]" />
        <span style={{ fontSize: 12, fontWeight: 700, color: "#0a0a0a", letterSpacing: "-0.2px" }}>
          Oferta Ativa — Hoje
        </span>

        {totalLigacoes > 0 && (
          <span
            className="rounded-full"
            style={{
              fontSize: 10, fontWeight: 700, color: "#52525b",
              background: "#f0f0f5", padding: "1px 6px",
            }}
          >
            {totalLigacoes} lig.
          </span>
        )}
        {totalInteresse > 0 && (
          <span
            className="rounded-full"
            style={{
              fontSize: 9, fontWeight: 700, color: "#fff",
              background: "#10b981", padding: "1px 6px",
            }}
          >
            {totalInteresse} ✓
          </span>
        )}
        {totalLigacoes === 0 && (
          <span style={{ fontSize: 10, color: "#a1a1aa" }}>Sem atividade</span>
        )}
      </button>

      {/* Expanded content */}
      {expanded && (
        <div style={{ borderTop: "1px solid #e8e8f0", maxHeight: 260, overflowY: "auto" }}>
          {/* Summary bar */}
          {totalLigacoes > 0 && (
            <div
              className="flex items-center gap-3 flex-wrap"
              style={{ padding: "6px 12px", background: "#f7f7fb", borderBottom: "1px solid #e8e8f0" }}
            >
              {Object.entries(
                data!.tentativas.reduce<Record<string, number>>((acc, t) => {
                  acc[t.resultado] = (acc[t.resultado] || 0) + 1;
                  return acc;
                }, {})
              )
                .sort((a, b) => b[1] - a[1])
                .map(([resultado, count]) => {
                  const info = RESULT_LABELS[resultado] || { label: resultado, color: "#a1a1aa" };
                  return (
                    <span key={resultado} className="flex items-center gap-1" style={{ fontSize: 10, fontWeight: 600 }}>
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: info.color }} />
                      <span style={{ color: info.color }}>{count}</span>
                      <span style={{ color: "#71717a" }}>{info.label}</span>
                    </span>
                  );
                })}
            </div>
          )}

          {/* Per-corretor rows */}
          {Object.entries(data!.byCorretor)
            .sort((a, b) => b[1].total - a[1].total)
            .map(([userId, c]) => (
              <div
                key={userId}
                className="flex items-center gap-2 hover:bg-[#f7f7fb] transition-colors"
                style={{ padding: "6px 12px", borderBottom: "1px solid #f0f0f5" }}
              >
                <span
                  className="truncate"
                  style={{ fontSize: 11, fontWeight: 600, color: "#0a0a0a", minWidth: 80, maxWidth: 110 }}
                  title={c.nome}
                >
                  {c.nome.split(" ")[0]}
                </span>

                <span style={{ fontSize: 11, fontWeight: 700, color: "#52525b", minWidth: 30 }}>
                  {c.total}
                </span>

                {/* Mini result breakdown */}
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  {Object.entries(c.results)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 4)
                    .map(([res, cnt]) => {
                      const info = RESULT_LABELS[res] || { label: res, color: "#a1a1aa" };
                      return (
                        <span
                          key={res}
                          className="flex items-center gap-0.5"
                          style={{ fontSize: 9, fontWeight: 600, color: info.color }}
                          title={info.label}
                        >
                          <div className="w-1 h-1 rounded-full" style={{ background: info.color }} />
                          {cnt}
                        </span>
                      );
                    })}
                </div>

                {/* Conversion rate */}
                {c.total > 0 && (
                  <span
                    style={{
                      fontSize: 10, fontWeight: 700,
                      color: c.comInteresse > 0 ? "#10b981" : "#a1a1aa",
                    }}
                  >
                    {Math.round((c.comInteresse / c.total) * 100)}%
                  </span>
                )}

                {c.total === 0 && (
                  <span style={{ fontSize: 10, color: "#d4d4d8" }}>—</span>
                )}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
