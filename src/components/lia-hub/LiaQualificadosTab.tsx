import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBRT } from "@/lib/brtTime";
import { useLiaEstados, useLiaPipelineLeads } from "./useLiaHub";

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <div className="mt-2 text-2xl font-bold tabular-nums text-foreground">{value}</div>
        {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

function FunilLinha({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold tabular-nums text-foreground">
          {value} <span className="text-xs font-normal text-muted-foreground">({pct}%)</span>
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-success transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function LiaQualificadosTab() {
  const navigate = useNavigate();
  const { data: estados } = useLiaEstados();
  const { data, isLoading } = useLiaPipelineLeads();

  const leads = data?.leads ?? [];
  const stages = data?.stages;
  const corretores = data?.corretores;

  const kpis = useMemo(() => {
    const total = (estados ?? []).length;
    const qualificados = (estados ?? []).filter((e) => e.status === "qualificado").length;
    const assumidos = leads.filter((l) => l.corretor_id).length;
    const vendas = leads.filter((l) => {
      const s = l.stage_id ? stages?.get(l.stage_id) : null;
      return s?.tipo === "venda";
    }).length;
    const visitas = leads.filter((l) => {
      const s = l.stage_id ? stages?.get(l.stage_id) : null;
      return s ? (s.ordem ?? 0) >= 4 && s.tipo !== "descarte" && s.tipo !== "caiu" : false;
    }).length;
    return {
      total,
      qualificados,
      assumidos,
      vendas,
      visitas,
      taxaQualificacao: total > 0 ? ((qualificados / total) * 100).toFixed(1) : "0.0",
      taxaVenda: qualificados > 0 ? ((vendas / qualificados) * 100).toFixed(1) : "0.0",
    };
  }, [estados, leads, stages]);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Qualificados" value={String(kpis.qualificados)} hint={`de ${kpis.total} contatos`} />
        <Kpi label="Taxa de qualificação" value={`${kpis.taxaQualificacao}%`} />
        <Kpi label="Leads no pipeline" value={String(leads.length)} hint={`${kpis.assumidos} assumidos`} />
        <Kpi label="Qualificado → Venda" value={`${kpis.taxaVenda}%`} hint={`${kpis.vendas} vendas`} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Funil de resultado</CardTitle>
          <CardDescription>Do contato com a LIA até a venda.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FunilLinha label="Contatos" value={kpis.total} max={kpis.total} />
          <FunilLinha label="Qualificados" value={kpis.qualificados} max={kpis.total} />
          <FunilLinha label="No pipeline" value={leads.length} max={kpis.total} />
          <FunilLinha label="Assumidos por corretor" value={kpis.assumidos} max={kpis.total} />
          <FunilLinha label="Visita ou além" value={kpis.visitas} max={kpis.total} />
          <FunilLinha label="Vendas" value={kpis.vendas} max={kpis.total} />
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle className="text-base">Leads da LIA no pipeline</CardTitle>
          <CardDescription>Origem “LIA”.</CardDescription>
        </CardHeader>
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : leads.length === 0 ? (
          <p className="px-4 pb-8 text-center text-sm text-muted-foreground">
            Nenhum lead da LIA no pipeline ainda.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y border-border bg-muted/30 text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2 text-left font-semibold">Lead</th>
                  <th className="px-4 py-2 text-left font-semibold">Corretor</th>
                  <th className="px-4 py-2 text-left font-semibold">Etapa</th>
                  <th className="px-4 py-2 text-left font-semibold">Aceite</th>
                  <th className="px-4 py-2 text-right font-semibold">Criado</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((l) => {
                  const stage = l.stage_id ? stages?.get(l.stage_id) : null;
                  return (
                    <tr
                      key={l.id}
                      onClick={() => navigate(`/pipeline-leads?lead=${l.id}`)}
                      className="cursor-pointer border-b border-border transition-colors last:border-b-0 hover:bg-muted/40"
                    >
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-foreground">{l.nome || "Sem nome"}</div>
                        <div className="text-xs text-muted-foreground">{l.telefone}</div>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {(l.corretor_id && corretores?.get(l.corretor_id)) || "Sem corretor"}
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge variant="secondary">{stage?.nome ?? "—"}</Badge>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">{l.aceite_status ?? "—"}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-right text-xs text-muted-foreground">
                        {formatBRT(l.created_at, "dd/MM/yy HH:mm")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
