import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Users } from "lucide-react";
import {
  useCorretoresComAlocacao,
  useEmpreendimentosCanonicos,
  useSetAlocacao,
  useFocoPerformance,
  type CorretorRow,
} from "@/hooks/useFocoCorretores";
import { CorretorFocoRow } from "./CorretorFocoRow";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";

/** BRT day range (últimos 30 dias inclusivo) — para o resumo por corretor. */
function last30dRange() {
  const now = new Date();
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const from = new Date(to);
  from.setDate(to.getDate() - 29);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { from: fmt(from), to: fmt(to) };
}

export function FocoAlocacaoTab() {
  const { user } = useAuth();
  const { isAdmin, isDiretor, isGestor } = useUserRole();
  const scope: "all" | "gerente" = isAdmin || isDiretor ? "all" : "gerente";

  const empQ = useEmpreendimentosCanonicos();
  const empAllQ = useEmpreendimentosCanonicos({ includeInactive: true });
  const corrQ = useCorretoresComAlocacao(scope, user?.id);
  const { from, to } = useMemo(last30dRange, []);
  const perfQ = useFocoPerformance(from, to, !!corrQ.data?.length);
  const setAlocacao = useSetAlocacao();

  const canEdit = isAdmin || isDiretor || isGestor;

  const perfByUser = useMemo(() => {
    const m = new Map<string, { leads: number; visitasRealizadas: number; vendas: number }>();
    for (const r of perfQ.data || []) {
      const cur = m.get(r.auth_user_id) || { leads: 0, visitasRealizadas: 0, vendas: 0 };
      cur.leads += r.leads;
      cur.visitasRealizadas += r.visitas_realizadas;
      cur.vendas += r.vendas;
      m.set(r.auth_user_id, cur);
    }
    return m;
  }, [perfQ.data]);

  const groupedByTeam = useMemo(() => {
    const rows = corrQ.data || [];
    const groups = new Map<string, CorretorRow[]>();
    for (const r of rows) {
      const k = r.equipe || "Sem equipe";
      const arr = groups.get(k) || [];
      arr.push(r);
      groups.set(k, arr);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [corrQ.data]);

  if (empQ.isLoading || corrQ.isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!corrQ.data?.length) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Nenhum corretor encontrado.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {groupedByTeam.map(([equipe, rows]) => (
        <Card key={equipe}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              {equipe}
              <span className="text-xs text-muted-foreground font-normal">
                · {rows.length} corretor{rows.length === 1 ? "" : "es"}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {rows.map((r) => (
              <CorretorFocoRow
                key={r.user_id}
                corretor={r}
                empreendimentos={empQ.data || []}
                todosEmpreendimentos={empAllQ.data || []}
                canEdit={canEdit}
                saving={setAlocacao.isPending}
                perfSummary={perfByUser.get(r.user_id)}
                onSave={(emps) => setAlocacao.mutate({ userId: r.user_id, empreendimentos: emps })}
              />
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
