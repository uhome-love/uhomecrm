import { Fragment } from "react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtMoney } from "@/lib/fmtMoney";
import { agruparFunilPorEquipe, somarFunil, type FunilLinha, type FunilTotais } from "@/hooks/useFunilPerformance";
import { cn } from "@/lib/utils";

const rate = (a: number, b: number) => (b > 0 ? (a / b) * 100 : 0);

function Taxa({ v, bom, medio }: { v: number; bom: number; medio: number }) {
  const tone = v >= bom ? "bg-success-500/12 text-success-700 dark:text-success-500" : v >= medio ? "bg-warning-500/14 text-warning-700 dark:text-warning-500" : "bg-danger-500/12 text-danger-500";
  return <span className={cn("px-2 py-0.5 rounded-full text-[10.5px] font-bold", tone)}>{v.toFixed(1)}%</span>;
}

function LinhaConv({ nome, t, forte }: { nome: string; t: FunilTotais; forte?: boolean }) {
  const leadVisita = rate(t.visitas_total, t.leads_recebidos);
  const visitaVenda = rate(t.vendas, t.visitas_realizadas);
  const leadVenda = rate(t.vendas, t.leads_recebidos);
  const ticket = t.vendas > 0 ? t.vgv_assinado / t.vendas : 0;
  return (
    <tr className={cn("border-b border-border/60", forte && "bg-muted/60 font-bold")}>
      <td className="py-2 px-2 whitespace-nowrap">{nome}</td>
      <td className="py-2 px-2"><Taxa v={leadVisita} bom={12} medio={7} /></td>
      <td className="py-2 px-2"><Taxa v={visitaVenda} bom={15} medio={8} /></td>
      <td className="py-2 px-2"><Taxa v={leadVenda} bom={2} medio={1} /></td>
      <td className="py-2 px-2">{ticket > 0 ? fmtMoney(ticket, "short") : "—"}</td>
      <td className="py-2 px-2">{t.vendas.toLocaleString("pt-BR")}</td>
    </tr>
  );
}

interface Props {
  linhas: FunilLinha[];
  loading: boolean;
  simples?: boolean;
}

/** Tabela de conversão por equipe e por corretor. */
export default function ConversaoTable({ linhas, loading, simples }: Props) {
  if (loading) return <Skeleton className="h-64 rounded-2xl" />;
  if (linhas.length === 0)
    return <Card className="p-8 text-center text-sm text-muted-foreground">Sem dados no período.</Card>;

  const grupos = agruparFunilPorEquipe(linhas);

  return (
    <Card className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border">
            {["Escopo", "Leads → Visita", "Visita → Venda", "Leads → Venda", "Ticket médio", "Vendas"].map((c) => (
              <th key={c} className="text-left py-2.5 px-2 text-[10.5px] uppercase tracking-wide text-muted-foreground whitespace-nowrap">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {simples
            ? linhas.map((l) => <LinhaConv key={l.corretor_auth_id} nome={l.corretor_nome ?? "—"} t={somarFunil([l])} />)
            : grupos.map((g) => (
                <Fragment key={g.equipe}>
                  <LinhaConv nome={`Equipe ${g.equipe}`} t={g.totais} forte />
                  {g.membros.map((l) => (
                    <LinhaConv key={l.corretor_auth_id} nome={l.corretor_nome ?? "—"} t={somarFunil([l])} />
                  ))}
                </Fragment>
              ))}
          <LinhaConv nome="Empresa" t={somarFunil(linhas)} forte />
        </tbody>
      </table>
    </Card>
  );
}
