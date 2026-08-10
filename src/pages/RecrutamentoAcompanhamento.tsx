import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/ui/PageHeader";
import { KpiGrid, type KpiCardData } from "@/components/central-v2/shared/KpiCard";
import { FunnelChart } from "@/components/central-v2/shared/FunnelChart";
import { Skeleton } from "@/components/ui/skeleton";
import { ETAPAS } from "@/components/rh/RecrutamentoKanban";
import { Users, Flame, CalendarCheck, UserCheck } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

/**
 * Recrutamento · Acompanhamento — painel READ-ONLY para CEO (admin) e Diretoria.
 * Não executa nenhuma escrita: só leitura de rh_candidatos / rh_entrevistas.
 */

interface CandidatoRow {
  id: string;
  etapa: string | null;
  origem: string | null;
  temperatura: string | null;
  gerente_id: string | null;
  created_at: string;
}

const TEMP_META: Record<string, { label: string; color: string }> = {
  quente: { label: "Quente", color: "#E0533A" },
  morno: { label: "Morno", color: "#E0982A" },
  frio: { label: "Frio", color: "#7C8AA3" },
};

function normTemp(v?: string | null) {
  const s = (v || "").toLowerCase();
  return s === "quente" || s === "morno" || s === "frio" ? s : null;
}

function brtDayKey(iso: string) {
  const d = new Date(new Date(iso).getTime() - 3 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

export default function RecrutamentoAcompanhamento() {
  const { data, isLoading } = useQuery({
    queryKey: ["recrutamento-acompanhamento"],
    queryFn: async () => {
      const [cand, entrev, profs] = await Promise.all([
        supabase
          .from("rh_candidatos" as any)
          .select("id, etapa, origem, temperatura, gerente_id, created_at")
          .order("created_at", { ascending: false })
          .limit(5000),
        supabase.from("rh_entrevistas" as any).select("id, candidato_id, data_hora").limit(5000),
        supabase.from("profiles" as any).select("id, nome").limit(2000),
      ]);
      if (cand.error) throw cand.error;
      return {
        candidatos: ((cand.data as any[]) || []) as CandidatoRow[],
        entrevistas: ((entrev.data as any[]) || []) as { id: string; candidato_id: string }[],
        profiles: ((profs.data as any[]) || []) as { id: string; nome: string | null }[],
      };
    },
    staleTime: 60_000,
  });

  const candidatos = data?.candidatos ?? [];

  const kpis: KpiCardData[] = useMemo(() => {
    const total = candidatos.length;
    const q = candidatos.filter((c) => normTemp(c.temperatura) === "quente").length;
    const m = candidatos.filter((c) => normTemp(c.temperatura) === "morno").length;
    const f = candidatos.filter((c) => normTemp(c.temperatura) === "frio").length;
    const marcadas = candidatos.filter((c) => c.etapa === "entrevista_marcada").length;
    const contratados = candidatos.filter((c) => c.etapa === "contratado").length;
    return [
      { label: "Candidatos", value: String(total), icon: Users },
      { label: "Temperatura", value: `${q}`, suffix: " quentes", icon: Flame, hint: `${m} mornos · ${f} frios` },
      { label: "Entrevistas marcadas", value: String(marcadas), icon: CalendarCheck },
      { label: "Contratados", value: String(contratados), icon: UserCheck },
    ];
  }, [candidatos]);

  const funil = useMemo(
    () =>
      ETAPAS.map((e) => ({
        label: e.label,
        value: candidatos.filter((c) => c.etapa === e.key).length,
      })),
    [candidatos]
  );

  const origens = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of candidatos) {
      const k = (c.origem || "não informado").toLowerCase();
      map.set(k, (map.get(k) || 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]).map(([nome, qtd]) => ({ nome, qtd }));
  }, [candidatos]);

  const porGerente = useMemo(() => {
    const nomes = new Map((data?.profiles || []).map((p) => [p.id, p.nome || "Sem nome"]));
    const map = new Map<string, number>();
    for (const c of candidatos) {
      const k = c.gerente_id ? nomes.get(c.gerente_id) || "Gerente desconhecido" : "Sem gerente";
      map.set(k, (map.get(k) || 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]).map(([nome, qtd]) => ({ nome, qtd }));
  }, [candidatos, data?.profiles]);

  const porDia = useMemo(() => {
    const days: { dia: string; label: string; qtd: number }[] = [];
    const hoje = new Date(Date.now() - 3 * 60 * 60 * 1000);
    for (let i = 29; i >= 0; i--) {
      const d = new Date(hoje);
      d.setUTCDate(d.getUTCDate() - i);
      const key = d.toISOString().slice(0, 10);
      days.push({ dia: key, label: key.slice(8, 10) + "/" + key.slice(5, 7), qtd: 0 });
    }
    const idx = new Map(days.map((d, i) => [d.dia, i]));
    for (const c of candidatos) {
      const i = idx.get(brtDayKey(c.created_at));
      if (i != null) days[i].qtd++;
    }
    return days;
  }, [candidatos]);

  return (
    <div className="flex flex-col gap-5 p-4 sm:p-6">
      <PageHeader
        title="Recrutamento · Acompanhamento"
        subtitle="Visão executiva do funil de recrutamento (somente leitura)."
      />

      <KpiGrid items={kpis} loading={isLoading} />

      <div className="grid gap-4 lg:grid-cols-2">
        <FunnelChart title="Funil por etapa" stages={funil} loading={isLoading} />

        <div className="central-card overflow-hidden">
          <div className="border-b border-border px-4 py-3 text-sm font-medium text-foreground">
            Entrada por origem
          </div>
          <div className="p-4">
            {isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : origens.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Sem dados.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {origens.map((o) => {
                  const max = origens[0].qtd || 1;
                  return (
                    <li key={o.nome} className="flex flex-col gap-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium capitalize text-foreground">{o.nome}</span>
                        <span className="font-semibold text-foreground">{o.qtd}</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-muted/50">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${Math.max((o.qtd / max) * 100, 4)}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="central-card overflow-hidden">
          <div className="border-b border-border px-4 py-3 text-sm font-medium text-foreground">
            Distribuição por gerente
          </div>
          <div className="p-4">
            {isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              <ul className="flex flex-col divide-y divide-border">
                {porGerente.map((g) => (
                  <li key={g.nome} className="flex items-center justify-between py-2 text-sm">
                    <span className="text-foreground">{g.nome}</span>
                    <span className="font-semibold tabular-nums text-foreground">{g.qtd}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="central-card overflow-hidden">
          <div className="border-b border-border px-4 py-3 text-sm font-medium text-foreground">
            Entrada nos últimos 30 dias
          </div>
          <div className="p-4">
            {isLoading ? (
              <Skeleton className="h-52 w-full" />
            ) : (
              <div className="h-52 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={porDia} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={4} tickLine={false} axisLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <Tooltip
                      cursor={{ fill: "hsl(var(--muted) / 0.4)" }}
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 12,
                        fontSize: 12,
                      }}
                    />
                    <Bar dataKey="qtd" name="Candidatos" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Painel somente leitura · temperatura:{" "}
        {Object.values(TEMP_META)
          .map((t) => t.label)
          .join(" · ")}
      </p>
    </div>
  );
}
