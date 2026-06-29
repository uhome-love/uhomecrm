import { useMemo, useState } from "react";
import { Trophy, Medal, ArrowUpDown } from "lucide-react";
import type { UseQueryResult } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { SectionError } from "@/components/central-v2/shared/SectionError";
import { safeGet } from "@/components/central-v2/shared/safeGet";
import { fmtMoney } from "@/lib/fmtMoney";

interface Props {
  query: UseQueryResult<Record<string, unknown>>;
}

interface CorretorRow {
  corretor_auth_id?: string;
  corretor_profile_id?: string;
  nome?: string;
  avatar_url?: string | null;
  vendas_qtd?: number;
  vendas_vgv?: number;
  visitas_criadas?: number;
  visitas_realizadas?: number;
  leads_recebidos?: number;
  oa_tentativas?: number;
  oa_pontos?: number;
}

type SortKey = "vendas_vgv" | "vendas_qtd" | "visitas_realizadas" | "leads_recebidos";

const SORT_OPTIONS: Array<{ key: SortKey; label: string }> = [
  { key: "vendas_vgv", label: "VGV" },
  { key: "vendas_qtd", label: "Vendas" },
  { key: "visitas_realizadas", label: "Visitas" },
  { key: "leads_recebidos", label: "Leads" },
];

function fmtInt(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "0";
  return Math.round(v).toLocaleString("pt-BR");
}

function initials(nome?: string): string {
  if (!nome) return "?";
  return nome
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function SectionRanking({ query }: Props) {
  const data = query.data;
  const loading = query.isLoading && !data;
  const [sortKey, setSortKey] = useState<SortKey>("vendas_vgv");

  const rows = useMemo<CorretorRow[]>(() => {
    const arr = safeGet<CorretorRow[]>(data ?? {}, "corretores", "Ranking corretores") ?? [];
    return [...arr].sort((a, b) => (Number(b[sortKey] ?? 0) - Number(a[sortKey] ?? 0)));
  }, [data, sortKey]);

  const podium = rows.slice(0, 3);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-primary" strokeWidth={1.75} />
          <h2 className="font-display text-xl text-foreground">Ranking da equipe</h2>
        </div>
        <div className="flex items-center gap-1.5">
          <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
          {SORT_OPTIONS.map((o) => (
            <button
              key={o.key}
              type="button"
              onClick={() => setSortKey(o.key)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs transition-colors",
                sortKey === o.key
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {query.error ? (
        <SectionError query={query} label="Ranking" />
      ) : loading ? (
        <div className="grid gap-3 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="central-card p-5">
              <Skeleton className="h-12 w-12 rounded-full" />
              <Skeleton className="mt-3 h-4 w-28" />
              <Skeleton className="mt-2 h-6 w-20" />
            </div>
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="central-card px-4 py-10 text-center text-sm text-muted-foreground">
          Sem dados de ranking no período.
        </div>
      ) : (
        <>
          {/* Pódio */}
          <div className="grid gap-3 sm:grid-cols-3">
            {podium.map((c, i) => (
              <PodiumCard key={c.corretor_profile_id ?? c.corretor_auth_id ?? i} pos={i} row={c} sortKey={sortKey} />
            ))}
          </div>

          {/* Tabela completa */}
          <div className="central-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2 text-left">#</th>
                  <th className="px-4 py-2 text-left">Corretor</th>
                  <th className="px-4 py-2 text-right">VGV</th>
                  <th className="px-4 py-2 text-right">Vendas</th>
                  <th className="px-4 py-2 text-right">Visitas</th>
                  <th className="px-4 py-2 text-right">Leads</th>
                  <th className="px-4 py-2 text-right">OA</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c, i) => (
                  <tr
                    key={c.corretor_profile_id ?? c.corretor_auth_id ?? i}
                    className="border-b border-border last:border-b-0 hover:bg-muted/30"
                  >
                    <td className="px-4 py-2.5 text-muted-foreground">{i + 1}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-7 w-7">
                          <AvatarImage src={c.avatar_url ?? undefined} alt={c.nome ?? ""} />
                          <AvatarFallback className="text-[10px]">{initials(c.nome)}</AvatarFallback>
                        </Avatar>
                        <span className="text-foreground">{c.nome ?? "—"}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium text-foreground">
                      {fmtMoney(c.vendas_vgv ?? 0, "short")}
                    </td>
                    <td className="px-4 py-2.5 text-right text-foreground">{fmtInt(c.vendas_qtd)}</td>
                    <td className="px-4 py-2.5 text-right text-foreground">{fmtInt(c.visitas_realizadas)}</td>
                    <td className="px-4 py-2.5 text-right text-foreground">{fmtInt(c.leads_recebidos)}</td>
                    <td className="px-4 py-2.5 text-right text-foreground">{fmtInt(c.oa_tentativas)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

const MEDAL_COLORS = ["text-amber-500", "text-slate-400", "text-orange-700"];

function PodiumCard({ pos, row, sortKey }: { pos: number; row: CorretorRow; sortKey: SortKey }) {
  const metricLabel =
    sortKey === "vendas_vgv"
      ? "VGV"
      : sortKey === "vendas_qtd"
        ? "Vendas"
        : sortKey === "visitas_realizadas"
          ? "Visitas realizadas"
          : "Leads recebidos";
  const metricValue =
    sortKey === "vendas_vgv"
      ? fmtMoney(row.vendas_vgv ?? 0, "short")
      : fmtInt(row[sortKey]);

  return (
    <div
      className={cn(
        "central-card flex items-center gap-3 p-4",
        pos === 0 && "ring-1 ring-primary/40"
      )}
    >
      <div className="relative">
        <Avatar className="h-12 w-12">
          <AvatarImage src={row.avatar_url ?? undefined} alt={row.nome ?? ""} />
          <AvatarFallback>{initials(row.nome)}</AvatarFallback>
        </Avatar>
        <Medal className={cn("absolute -bottom-1 -right-1 h-5 w-5", MEDAL_COLORS[pos])} />
      </div>
      <div className="min-w-0">
        <div className="truncate font-medium text-foreground">{row.nome ?? "—"}</div>
        <div className="text-xs text-muted-foreground">{metricLabel}</div>
        <div className="font-display text-lg text-foreground">{metricValue}</div>
      </div>
    </div>
  );
}
