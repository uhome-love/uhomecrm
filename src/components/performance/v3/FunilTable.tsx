import { Fragment } from "react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtMoney } from "@/lib/fmtMoney";
import { agruparFunilPorEquipe, somarFunil, type FunilLinha, type FunilTotais } from "@/hooks/useFunilPerformance";
import { cn } from "@/lib/utils";

const COLS = [
  "Presença",
  "Leads",
  "Pipeline ativo",
  "Descartes",
  "Visitas",
  "Realizadas",
  "Negócios",
  "Gerado",
  "Assinado",
];

function Pill({ v, base }: { v: number; base: number }) {
  const r = base > 0 ? v / base : 0;
  const tone = r >= 0.8 ? "bg-success-500/12 text-success-700 dark:text-success-500" : r >= 0.6 ? "bg-warning-500/14 text-warning-700 dark:text-warning-500" : "bg-danger-500/12 text-danger-500";
  return <span className={cn("px-2 py-0.5 rounded-full text-[10.5px] font-bold", tone)}>{v}/{base}</span>;
}

function Linha({ l }: { l: FunilLinha }) {
  return (
    <tr className="border-b border-border/60">
      <td className="py-2 px-2 whitespace-nowrap">
        <span className="font-medium">{l.corretor_nome ?? "—"}</span>
        {!l.corretor_ativo && <span className="ml-2 text-[10px] text-muted-foreground">inativo</span>}
      </td>
      <td className="py-2 px-2"><Pill v={l.presenca_dias} base={l.dias_uteis} /></td>
      <td className="py-2 px-2">{l.leads_recebidos}</td>
      <td className="py-2 px-2">{l.pipeline_ativo}</td>
      <td className="py-2 px-2">{l.descartes}</td>
      <td className="py-2 px-2">{l.visitas_agendadas}</td>
      <td className="py-2 px-2">{l.visitas_realizadas}</td>
      <td className="py-2 px-2">{l.negocios_abertos}</td>
      <td className="py-2 px-2">{fmtMoney(l.vgv_gerado, "short")}</td>
      <td className="py-2 px-2 font-semibold">{fmtMoney(l.vgv_assinado, "short")}</td>
    </tr>
  );
}

function LinhaTotal({ nome, t }: { nome: string; t: FunilTotais }) {
  return (
    <tr className="bg-muted/60 font-bold">
      <td className="py-2 px-2 whitespace-nowrap">{nome}</td>
      <td className="py-2 px-2">{t.dias_uteis * t.corretores > 0 ? `${Math.round((t.presenca_dias / (t.dias_uteis * t.corretores)) * 100)}%` : "—"}</td>
      <td className="py-2 px-2">{t.leads_recebidos}</td>
      <td className="py-2 px-2">{t.pipeline_ativo}</td>
      <td className="py-2 px-2">{t.descartes}</td>
      <td className="py-2 px-2">{t.visitas_agendadas}</td>
      <td className="py-2 px-2">{t.visitas_realizadas}</td>
      <td className="py-2 px-2">{t.negocios_abertos}</td>
      <td className="py-2 px-2">{fmtMoney(t.vgv_gerado, "short")}</td>
      <td className="py-2 px-2">{fmtMoney(t.vgv_assinado, "short")}</td>
    </tr>
  );
}

interface Props {
  linhas: FunilLinha[];
  loading: boolean;
  /** Corretor puro: some o agrupamento por equipe. */
  simples?: boolean;
}

/** Planilha densa do funil, agrupada por equipe com totais. */
export default function FunilTable({ linhas, loading, simples }: Props) {
  if (loading) return <Skeleton className="h-64 rounded-2xl" />;
  if (linhas.length === 0)
    return <Card className="p-8 text-center text-sm text-muted-foreground">Sem dados no período.</Card>;

  const grupos = agruparFunilPorEquipe(linhas);
  const total = somarFunil(linhas);

  return (
    <Card className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-2.5 px-2 text-[10.5px] uppercase tracking-wide text-muted-foreground">Corretor</th>
            {COLS.map((c) => (
              <th key={c} className="text-left py-2.5 px-2 text-[10.5px] uppercase tracking-wide text-muted-foreground whitespace-nowrap">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {simples
            ? linhas.map((l) => <Linha key={l.corretor_auth_id} l={l} />)
            : grupos.map((g) => (
                <Fragment key={g.equipe}>
                  <tr className="bg-muted/40">
                    <td colSpan={10} className="py-2 px-2 text-[11px] font-bold">
                      {g.equipe} · {g.totais.corretores} corretores
                    </td>
                  </tr>
                  {g.membros.map((l) => (
                    <Linha key={l.corretor_auth_id} l={l} />
                  ))}
                  <LinhaTotal nome={`Total ${g.equipe}`} t={g.totais} />
                </Fragment>
              ))}
          <LinhaTotal nome="Total geral" t={total} />
        </tbody>
      </table>
    </Card>
  );
}
