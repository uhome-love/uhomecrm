import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { BarChart3, ArrowLeft, Eye, MousePointerClick, Share2, TrendingUp, Loader2, Search } from "lucide-react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ShareRow {
  id: string;
  corretor_id: string;
  empreendimento_slug: string;
  empreendimento_nome: string | null;
  titulo: string | null;
  assets: any[];
  views: number;
  cliques: number;
  created_at: string;
  expires_at: string | null;
}

interface ProfileLite { id: string; nome: string | null; email: string | null; }

function useSharesAnalytics(days: number) {
  return useQuery({
    queryKey: ["materiais", "analytics", days],
    queryFn: async () => {
      const since = new Date(Date.now() - days * 86400_000).toISOString();
      const { data: shares, error } = await supabase
        .from("materiais_shares" as any)
        .select("*")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;

      const list = (shares ?? []) as unknown as ShareRow[];
      const corretorIds = Array.from(new Set(list.map((s) => s.corretor_id)));

      let profiles: ProfileLite[] = [];
      if (corretorIds.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, user_id, nome, email")
          .in("user_id", corretorIds);
        profiles = ((profs ?? []) as any[]).map((p) => ({
          id: p.user_id, nome: p.nome, email: p.email,
        }));
      }
      return { shares: list, profiles };
    },
    staleTime: 60_000,
  });
}

export default function MateriaisAnalytics() {
  const [days, setDays] = useState(30);
  const [search, setSearch] = useState("");
  const { data, isLoading } = useSharesAnalytics(days);

  const shares = data?.shares ?? [];
  const profByCorretor = useMemo(
    () => Object.fromEntries((data?.profiles ?? []).map((p) => [p.id, p])),
    [data]
  );

  const totals = useMemo(() => {
    const totalShares = shares.length;
    const totalViews = shares.reduce((a, s) => a + (s.views ?? 0), 0);
    const totalCliques = shares.reduce((a, s) => a + (s.cliques ?? 0), 0);
    const zero = shares.filter((s) => (s.views ?? 0) === 0).length;
    return {
      totalShares,
      totalViews,
      totalCliques,
      taxaAbertura: totalShares ? Math.round(((totalShares - zero) / totalShares) * 100) : 0,
    };
  }, [shares]);

  const topCorretores = useMemo(() => {
    const map = new Map<string, { nome: string; shares: number; views: number; cliques: number }>();
    for (const s of shares) {
      const p = profByCorretor[s.corretor_id];
      const nome = p?.nome || p?.email || "—";
      const cur = map.get(s.corretor_id) ?? { nome, shares: 0, views: 0, cliques: 0 };
      cur.shares++;
      cur.views += s.views ?? 0;
      cur.cliques += s.cliques ?? 0;
      map.set(s.corretor_id, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.views - a.views).slice(0, 10);
  }, [shares, profByCorretor]);

  const topEmpreendimentos = useMemo(() => {
    const map = new Map<string, { nome: string; shares: number; views: number; cliques: number }>();
    for (const s of shares) {
      const key = s.empreendimento_slug;
      const cur = map.get(key) ?? {
        nome: s.empreendimento_nome || s.empreendimento_slug,
        shares: 0, views: 0, cliques: 0,
      };
      cur.shares++;
      cur.views += s.views ?? 0;
      cur.cliques += s.cliques ?? 0;
      map.set(key, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.views - a.views).slice(0, 10);
  }, [shares]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return shares;
    return shares.filter((s) => {
      const p = profByCorretor[s.corretor_id];
      return (
        (s.titulo ?? "").toLowerCase().includes(q) ||
        (s.empreendimento_nome ?? "").toLowerCase().includes(q) ||
        (p?.nome ?? "").toLowerCase().includes(q) ||
        (p?.email ?? "").toLowerCase().includes(q)
      );
    });
  }, [shares, search, profByCorretor]);

  return (
    <div className="container max-w-7xl mx-auto py-6 space-y-6">
      <PageHeader
        title="Analytics de Materiais"
        subtitle="Performance dos links comerciais gerados pelos corretores."
        icon={<BarChart3 className="h-5 w-5" />}
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link to="/materiais">
              <ArrowLeft className="h-4 w-4 mr-2" /> Voltar aos Materiais
            </Link>
          </Button>
        }
      />

      <div className="flex flex-wrap gap-2">
        {[7, 30, 90].map((d) => (
          <Button
            key={d}
            variant={days === d ? "default" : "outline"}
            size="sm"
            onClick={() => setDays(d)}
          >
            Últimos {d} dias
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard icon={Share2} label="Links gerados" value={totals.totalShares} />
            <KpiCard icon={Eye} label="Visualizações" value={totals.totalViews} />
            <KpiCard icon={MousePointerClick} label="Cliques em assets" value={totals.totalCliques} />
            <KpiCard icon={TrendingUp} label="Taxa de abertura" value={`${totals.taxaAbertura}%`} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top corretores</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <RankTable
                  headerLabel="Corretor"
                  rows={topCorretores}
                  emptyMsg="Nenhum share no período."
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top empreendimentos</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <RankTable
                  headerLabel="Empreendimento"
                  rows={topEmpreendimentos}
                  emptyMsg="Nenhum share no período."
                />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <CardTitle className="text-base">
                  Todos os shares ({filtered.length})
                </CardTitle>
                <div className="relative w-full sm:w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por corretor, título..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 h-9"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {filtered.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  Nenhum share no período selecionado.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Corretor</TableHead>
                        <TableHead>Empreendimento</TableHead>
                        <TableHead>Título</TableHead>
                        <TableHead className="text-right">Assets</TableHead>
                        <TableHead className="text-right">Views</TableHead>
                        <TableHead className="text-right">Cliques</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.slice(0, 200).map((s) => {
                        const p = profByCorretor[s.corretor_id];
                        const nome = p?.nome || p?.email || "—";
                        const url = `${window.location.origin}/m/${s.id}`;
                        return (
                          <TableRow key={s.id}>
                            <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                              {format(new Date(s.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                            </TableCell>
                            <TableCell className="text-sm">{nome}</TableCell>
                            <TableCell className="text-sm">{s.empreendimento_nome ?? s.empreendimento_slug}</TableCell>
                            <TableCell className="text-sm text-muted-foreground max-w-[240px] truncate">
                              {s.titulo ?? "—"}
                            </TableCell>
                            <TableCell className="text-right text-xs">
                              <Badge variant="secondary">{Array.isArray(s.assets) ? s.assets.length : 0}</Badge>
                            </TableCell>
                            <TableCell className="text-right font-medium">{s.views}</TableCell>
                            <TableCell className="text-right font-medium">{s.cliques}</TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  navigator.clipboard.writeText(url);
                                }}
                              >
                                Copiar link
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function KpiCard({ icon: Icon, label, value }: { icon: any; label: string; value: number | string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide">
          <Icon className="h-3.5 w-3.5" />
          {label}
        </div>
        <div className="mt-2 text-2xl font-semibold text-foreground">{value}</div>
      </CardContent>
    </Card>
  );
}

function RankTable({
  headerLabel,
  rows,
  emptyMsg,
}: {
  headerLabel: string;
  rows: { nome: string; shares: number; views: number; cliques: number }[];
  emptyMsg: string;
}) {
  if (rows.length === 0) {
    return <div className="py-8 text-center text-sm text-muted-foreground">{emptyMsg}</div>;
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{headerLabel}</TableHead>
          <TableHead className="text-right">Shares</TableHead>
          <TableHead className="text-right">Views</TableHead>
          <TableHead className="text-right">Cliques</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r, i) => (
          <TableRow key={`${r.nome}-${i}`}>
            <TableCell className="text-sm">{r.nome}</TableCell>
            <TableCell className="text-right text-sm">{r.shares}</TableCell>
            <TableCell className="text-right text-sm font-medium">{r.views}</TableCell>
            <TableCell className="text-right text-sm font-medium">{r.cliques}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
