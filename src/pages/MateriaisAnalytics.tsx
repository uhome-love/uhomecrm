import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { BarChart3, ArrowLeft, Copy, Download, Eye, Sparkles, Loader2, Search } from "lucide-react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface RecenteRow {
  user_id: string;
  material_id: string;
  acao: string;
  last_at: string;
  count: number;
  materiais_links: {
    id: string;
    titulo: string;
    categoria: string;
    materiais_empreendimentos?: { nome: string } | null;
  } | null;
}

interface ProfileLite { id: string; nome: string | null; email: string | null; }

function useUsageAnalytics(days: number) {
  return useQuery({
    queryKey: ["materiais", "usage", days],
    queryFn: async () => {
      const since = new Date(Date.now() - days * 86400_000).toISOString();
      const { data, error } = await (supabase as any)
        .from("materiais_recentes")
        .select(
          "user_id, material_id, acao, last_at, count, materiais_links!inner(id, titulo, categoria, materiais_empreendimentos(nome))"
        )
        .gte("last_at", since)
        .order("last_at", { ascending: false })
        .limit(1500);
      if (error) throw error;

      const rows = (data ?? []) as RecenteRow[];
      const userIds = Array.from(new Set(rows.map((r) => r.user_id)));

      let profiles: ProfileLite[] = [];
      if (userIds.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, user_id, nome, email")
          .in("user_id", userIds);
        profiles = ((profs ?? []) as any[]).map((p) => ({
          id: p.user_id, nome: p.nome, email: p.email,
        }));
      }
      return { rows, profiles };
    },
    staleTime: 60_000,
  });
}

const ACAO_LABEL: Record<string, { label: string; icon: any }> = {
  copiar: { label: "Copiar", icon: Copy },
  download: { label: "Download", icon: Download },
  preview: { label: "Preview", icon: Eye },
  abrir: { label: "Abrir", icon: Eye },
  followup: { label: "Follow-up IA", icon: Sparkles },
  whatsapp: { label: "WhatsApp", icon: Sparkles },
};

export default function MateriaisAnalytics() {
  const [days, setDays] = useState(30);
  const [search, setSearch] = useState("");
  const { data, isLoading } = useUsageAnalytics(days);

  const rows = data?.rows ?? [];
  const profByUser = useMemo(
    () => Object.fromEntries((data?.profiles ?? []).map((p) => [p.id, p])),
    [data]
  );

  const totals = useMemo(() => {
    const totalAcoes = rows.reduce((a, r) => a + (r.count ?? 1), 0);
    const totalCopiar = rows.filter((r) => r.acao === "copiar").reduce((a, r) => a + (r.count ?? 1), 0);
    const totalDownload = rows.filter((r) => r.acao === "download").reduce((a, r) => a + (r.count ?? 1), 0);
    const totalFollowUp = rows.filter((r) => r.acao === "followup").reduce((a, r) => a + (r.count ?? 1), 0);
    return { totalAcoes, totalCopiar, totalDownload, totalFollowUp };
  }, [rows]);

  const topCorretores = useMemo(() => {
    const map = new Map<string, { nome: string; acoes: number }>();
    for (const r of rows) {
      const p = profByUser[r.user_id];
      const nome = p?.nome || p?.email || "—";
      const cur = map.get(r.user_id) ?? { nome, acoes: 0 };
      cur.acoes += r.count ?? 1;
      map.set(r.user_id, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.acoes - a.acoes).slice(0, 10);
  }, [rows, profByUser]);

  const topMateriais = useMemo(() => {
    const map = new Map<string, { titulo: string; empreendimento: string; acoes: number }>();
    for (const r of rows) {
      if (!r.materiais_links) continue;
      const cur = map.get(r.material_id) ?? {
        titulo: r.materiais_links.titulo,
        empreendimento: r.materiais_links.materiais_empreendimentos?.nome ?? "—",
        acoes: 0,
      };
      cur.acoes += r.count ?? 1;
      map.set(r.material_id, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.acoes - a.acoes).slice(0, 10);
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const p = profByUser[r.user_id];
      return (
        (r.materiais_links?.titulo ?? "").toLowerCase().includes(q) ||
        (r.materiais_links?.materiais_empreendimentos?.nome ?? "").toLowerCase().includes(q) ||
        (p?.nome ?? "").toLowerCase().includes(q) ||
        (p?.email ?? "").toLowerCase().includes(q)
      );
    });
  }, [rows, search, profByUser]);

  return (
    <div className="container max-w-7xl mx-auto py-6 space-y-6">
      <PageHeader
        title="Analytics de Materiais"
        subtitle="Uso dos materiais do Hub pelos corretores (copiar, download, follow-up IA)."
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
            <KpiCard icon={BarChart3} label="Total de ações" value={totals.totalAcoes} />
            <KpiCard icon={Copy} label="Copiar link" value={totals.totalCopiar} />
            <KpiCard icon={Download} label="Downloads" value={totals.totalDownload} />
            <KpiCard icon={Sparkles} label="Follow-ups IA" value={totals.totalFollowUp} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Top corretores</CardTitle></CardHeader>
              <CardContent className="p-0">
                <RankTable rows={topCorretores.map((r) => ({ label: r.nome, sub: null, valor: r.acoes }))} emptyMsg="Sem uso no período." />
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Top materiais</CardTitle></CardHeader>
              <CardContent className="p-0">
                <RankTable rows={topMateriais.map((r) => ({ label: r.titulo, sub: r.empreendimento, valor: r.acoes }))} emptyMsg="Sem uso no período." />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <CardTitle className="text-base">Atividade recente ({filtered.length})</CardTitle>
                <div className="relative w-full sm:w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por corretor, material..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 h-9"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {filtered.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">Sem atividade no período.</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Corretor</TableHead>
                        <TableHead>Material</TableHead>
                        <TableHead>Empreendimento</TableHead>
                        <TableHead>Ação</TableHead>
                        <TableHead className="text-right">Qtd</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.slice(0, 200).map((r) => {
                        const p = profByUser[r.user_id];
                        const nome = p?.nome || p?.email || "—";
                        const acaoInfo = ACAO_LABEL[r.acao] ?? { label: r.acao, icon: Eye };
                        const AIcon = acaoInfo.icon;
                        return (
                          <TableRow key={`${r.user_id}-${r.material_id}-${r.acao}`}>
                            <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                              {format(new Date(r.last_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                            </TableCell>
                            <TableCell className="text-sm">{nome}</TableCell>
                            <TableCell className="text-sm max-w-[280px] truncate">
                              {r.materiais_links?.titulo ?? "—"}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {r.materiais_links?.materiais_empreendimentos?.nome ?? "—"}
                            </TableCell>
                            <TableCell className="text-sm">
                              <span className="inline-flex items-center gap-1 text-xs">
                                <AIcon className="h-3 w-3" /> {acaoInfo.label}
                              </span>
                            </TableCell>
                            <TableCell className="text-right text-sm font-medium">{r.count ?? 1}</TableCell>
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

function RankTable({ rows, emptyMsg }: { rows: { label: string; sub: string | null; valor: number }[]; emptyMsg: string }) {
  if (rows.length === 0) {
    return <div className="py-8 text-center text-sm text-muted-foreground">{emptyMsg}</div>;
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nome</TableHead>
          <TableHead className="text-right">Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r, i) => (
          <TableRow key={`${r.label}-${i}`}>
            <TableCell className="text-sm">
              {r.label}
              {r.sub && <span className="block text-xs text-muted-foreground">{r.sub}</span>}
            </TableCell>
            <TableCell className="text-right text-sm font-medium">{r.valor}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
