import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { fmtMoney } from "@/lib/fmtMoney";
import { consolidarFunil, type FunilLinha } from "@/hooks/useFunilPerformance";
import { cn } from "@/lib/utils";

type RankKey = "vgv_assinado" | "leads_recebidos" | "visitas_realizadas";

const ABAS: { key: RankKey; label: string }[] = [
  { key: "vgv_assinado", label: "VGV assinado" },
  { key: "leads_recebidos", label: "Leads" },
  { key: "visitas_realizadas", label: "Visitas realizadas" },
];

const MEDALHAS = ["🥇", "🥈", "🥉"];

const iniciais = (n: string | null) =>
  (n ?? "?")
    .split(" ")
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase();

interface Props {
  linhas: FunilLinha[];
  loading: boolean;
  /** auth id do usuário logado — destaca a linha dele. */
  meuId?: string | null;
}

/** Rankings: pódio + tabela completa, por Leads, Visitas e VGV. */
export default function RankingsTabs({ linhas, loading, meuId }: Props) {
  const [aba, setAba] = useState<RankKey>("vgv_assinado");

  if (loading) return <Skeleton className="h-72 rounded-2xl" />;

  const ordenado = consolidarFunil(linhas)
    .filter((l) => l[aba] > 0)
    .sort((a, b) => (b[aba] as number) - (a[aba] as number));

  const fmt = (l: FunilLinha) =>
    aba === "vgv_assinado" ? fmtMoney(l.vgv_assinado, "short") : String(l[aba]);

  const podio = ordenado.slice(0, 3);
  const resto = ordenado.slice(3);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-5 border-b border-border">
        {ABAS.map((a) => (
          <button
            key={a.key}
            onClick={() => setAba(a.key)}
            className={cn(
              "py-2 text-[13px] font-semibold border-b-2 -mb-px transition-colors",
              aba === a.key ? "text-primary border-primary" : "text-muted-foreground border-transparent hover:text-foreground"
            )}
          >
            {a.label}
          </button>
        ))}
      </div>

      {ordenado.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">Sem dados no período.</Card>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {podio.map((l, i) => (
              <Card
                key={l.corretor_auth_id}
                className={cn("p-4 text-center", i === 0 && "border-primary/60 shadow-md")}
              >
                <div className="text-xl">{MEDALHAS[i]}</div>
                <Avatar className="h-10 w-10 mx-auto my-2">
                  <AvatarImage src={l.avatar_url ?? undefined} />
                  <AvatarFallback className="text-[11px]">{iniciais(l.corretor_nome)}</AvatarFallback>
                </Avatar>
                <p className="text-sm font-bold truncate">{l.corretor_nome ?? "—"}</p>
                <p className="text-xs text-muted-foreground">{fmt(l)} · {l.equipe ?? "sem equipe"}</p>
              </Card>
            ))}
          </div>

          <Card className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  {["#", "Corretor", "Equipe", ABAS.find((a) => a.key === aba)!.label, "Vendas"].map((c) => (
                    <th key={c} className="text-left py-2.5 px-2 text-[10.5px] uppercase tracking-wide text-muted-foreground">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {resto.map((l, i) => (
                  <tr
                    key={l.corretor_auth_id}
                    className={cn("border-b border-border/60", meuId === l.corretor_auth_id && "bg-primary/[0.06]")}
                  >
                    <td className="py-2 px-2">{i + 4}</td>
                    <td className="py-2 px-2">
                      <span className="inline-flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={l.avatar_url ?? undefined} />
                          <AvatarFallback className="text-[9px]">{iniciais(l.corretor_nome)}</AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{l.corretor_nome ?? "—"}</span>
                      </span>
                    </td>
                    <td className="py-2 px-2">{l.equipe ?? "—"}</td>
                    <td className="py-2 px-2 font-semibold">{fmt(l)}</td>
                    <td className="py-2 px-2">{l.vendas}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}
