import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, FileSpreadsheet, TrendingUp, CheckCircle2, XCircle, Eye, Calendar, Zap, Clock, AlertCircle } from "lucide-react";
import { format, subMonths, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useCorretorPdn } from "@/hooks/useCorretorPdn";
import type { PdnEntry, PdnSituacao } from "@/hooks/usePdn";

const SITUACAO_CONFIG: Record<PdnSituacao, { label: string; color: string; icon: typeof Eye }> = {
  visita: { label: "Visita", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300", icon: Eye },
  gerado: { label: "Gerado", color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300", icon: TrendingUp },
  assinado: { label: "Assinado", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300", icon: CheckCircle2 },
  caiu: { label: "Caiu", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300", icon: XCircle },
};

const TEMPERATURA_COLORS: Record<string, string> = {
  quente: "bg-red-500",
  morno: "bg-amber-500",
  frio: "bg-blue-400",
};

function formatCurrency(v: number | null) {
  if (!v) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
}

function getDiasParado(updatedAt: string) {
  return differenceInDays(new Date(), new Date(updatedAt));
}

function getProbabilidade(entry: PdnEntry): { value: number; color: string } {
  // Probabilidade baseada na situação e temperatura
  let base = 10;
  if (entry.situacao === "visita") base = 20;
  if (entry.situacao === "gerado") base = 50;
  if (entry.situacao === "assinado") base = 95;
  if (entry.situacao === "caiu") base = 0;

  // Ajuste por temperatura
  if (entry.temperatura === "quente") base = Math.min(base + 20, 100);
  if (entry.temperatura === "frio") base = Math.max(base - 15, 0);

  // Ajuste por docs
  if (entry.docs_status === "com_docs") base = Math.min(base + 10, 100);

  const color = base >= 70 ? "text-emerald-600 dark:text-emerald-400" : base >= 40 ? "text-amber-600 dark:text-amber-400" : "text-red-500";
  return { value: base, color };
}

function MonthSelector({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = subMonths(new Date(), i);
    return { value: format(d, "yyyy-MM"), label: format(d, "MMMM yyyy", { locale: ptBR }) };
  });

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[180px] h-9 text-xs">
        <Calendar className="h-3.5 w-3.5 mr-1.5" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {months.map((m) => (
          <SelectItem key={m.value} value={m.value} className="text-xs capitalize">
            {m.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function StatsRow({ stats }: { stats: ReturnType<typeof useCorretorPdn>["stats"] }) {
  const cards = [
    { label: "Total", value: stats.total, icon: FileSpreadsheet, color: "text-primary" },
    { label: "Visitas", value: stats.total_visitas, icon: Eye, color: "text-blue-600" },
    { label: "Gerados", value: stats.total_gerados, icon: TrendingUp, color: "text-amber-600" },
    { label: "Assinados", value: stats.total_assinados, icon: CheckCircle2, color: "text-emerald-600" },
    { label: "Caíram", value: stats.total_caidos, icon: XCircle, color: "text-red-500" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
      {cards.map((c) => (
        <Card key={c.label} className="p-3">
          <div className="flex items-center gap-2">
            <c.icon className={`h-4 w-4 ${c.color}`} />
            <span className="text-xs text-muted-foreground">{c.label}</span>
          </div>
          <p className="text-xl font-bold mt-1">{c.value}</p>
        </Card>
      ))}
    </div>
  );
}

function ReadOnlyList({ entries }: { entries: PdnEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-12">Nenhum negócio encontrado neste mês.</p>;
  }

  return (
    <div className="rounded-lg border overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-xs">Cliente</TableHead>
            <TableHead className="text-xs">Empreendimento</TableHead>
            <TableHead className="text-xs">Status</TableHead>
            <TableHead className="text-xs">Temperatura</TableHead>
            <TableHead className="text-xs">Prob.</TableHead>
            <TableHead className="text-xs">Próxima Ação</TableHead>
            <TableHead className="text-xs">VGV</TableHead>
            <TableHead className="text-xs">Dias Parado</TableHead>
            <TableHead className="text-xs">Atualizado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((e) => {
            const cfg = SITUACAO_CONFIG[e.situacao] || SITUACAO_CONFIG.visita;
            const prob = getProbabilidade(e);
            const diasParado = getDiasParado(e.updated_at);
            return (
              <TableRow key={e.id}>
                <TableCell className="text-xs font-medium">{e.nome || "—"}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{e.empreendimento || "—"}</TableCell>
                <TableCell>
                  <Badge className={`text-[10px] ${cfg.color}`}>{cfg.label}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    <span className={`h-2 w-2 rounded-full ${TEMPERATURA_COLORS[e.temperatura] || "bg-muted"}`} />
                    <span className="text-xs capitalize">{e.temperatura}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <span className={`text-xs font-bold ${prob.color}`}>{prob.value}%</span>
                </TableCell>
                <TableCell>
                  {e.proxima_acao ? (
                    <div className="flex items-center gap-1">
                      <Zap className="h-3 w-3 text-primary shrink-0" />
                      <span className="text-[11px] text-foreground truncate max-w-[120px]">{e.proxima_acao}</span>
                      {e.data_proxima_acao && (
                        <span className="text-[9px] text-muted-foreground shrink-0">
                          {format(new Date(e.data_proxima_acao + "T12:00:00"), "dd/MM", { locale: ptBR })}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-[10px] text-destructive font-semibold flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" /> Sem ação
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-xs">{formatCurrency(e.vgv)}</TableCell>
                <TableCell>
                  {diasParado >= 3 ? (
                    <span className="text-[10px] font-bold text-red-600 dark:text-red-400 flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {diasParado}d
                    </span>
                  ) : diasParado >= 1 ? (
                    <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {diasParado}d
                    </span>
                  ) : (
                    <span className="text-[10px] text-emerald-600">Hoje</span>
                  )}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {format(new Date(e.updated_at), "dd/MM HH:mm", { locale: ptBR })}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function ReadOnlyKanban({ entries }: { entries: PdnEntry[] }) {
  const columns: PdnSituacao[] = ["visita", "gerado", "assinado", "caiu"];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {columns.map((col) => {
        const cfg = SITUACAO_CONFIG[col];
        const items = entries.filter((e) => e.situacao === col);
        return (
          <div key={col} className="space-y-2">
            <div className="flex items-center gap-2 px-2">
              <cfg.icon className={`h-4 w-4 ${col === "visita" ? "text-blue-600" : col === "gerado" ? "text-amber-600" : col === "assinado" ? "text-emerald-600" : "text-red-500"}`} />
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{cfg.label}</h3>
              <Badge variant="secondary" className="text-[10px] h-5 px-1.5">{items.length}</Badge>
            </div>
            <div className="space-y-2 min-h-[80px]">
              {items.map((e) => {
                const prob = getProbabilidade(e);
                const diasParado = getDiasParado(e.updated_at);
                return (
                  <Card key={e.id} className="p-3 space-y-1.5">
                    <div className="flex items-start justify-between gap-1">
                      <p className="text-xs font-semibold truncate flex-1">{e.nome || "—"}</p>
                      <span className={`text-[10px] font-bold ${prob.color} shrink-0`}>{prob.value}%</span>
                    </div>
                    {e.empreendimento && (
                      <p className="text-[10px] text-muted-foreground truncate">{e.empreendimento}</p>
                    )}
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <span className={`h-2 w-2 rounded-full ${TEMPERATURA_COLORS[e.temperatura] || "bg-muted"}`} />
                        <span className="text-[10px] capitalize text-muted-foreground">{e.temperatura}</span>
                      </div>
                      {e.vgv ? (
                        <span className="text-[10px] font-medium">{formatCurrency(e.vgv)}</span>
                      ) : null}
                    </div>
                    {/* Próxima ação */}
                    {e.proxima_acao ? (
                      <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/10 border border-primary/20">
                        <Zap className="h-2.5 w-2.5 text-primary shrink-0" />
                        <span className="text-[9px] font-semibold text-primary truncate">{e.proxima_acao}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-destructive/10 border border-destructive/20">
                        <AlertCircle className="h-2.5 w-2.5 text-destructive shrink-0" />
                        <span className="text-[9px] font-semibold text-destructive">Sem ação definida</span>
                      </div>
                    )}
                    {/* Dias parado */}
                    {diasParado >= 2 && (
                      <div className={`text-[9px] font-bold flex items-center gap-1 ${diasParado >= 3 ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"}`}>
                        <Clock className="h-2.5 w-2.5" />
                        {diasParado}d sem atualização
                      </div>
                    )}
                    <p className="text-[9px] text-muted-foreground/50">
                      Atualizado {format(new Date(e.updated_at), "dd/MM HH:mm", { locale: ptBR })}
                    </p>
                  </Card>
                );
              })}
              {items.length === 0 && (
                <p className="text-[10px] text-muted-foreground/50 text-center py-6">Nenhum</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function MeusNegocios() {
  const [mes, setMes] = useState(format(new Date(), "yyyy-MM"));
  const { entries, loading, stats } = useCorretorPdn(mes);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Meus Negócios
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Gestão de oportunidades — visitas realizadas até venda
          </p>
        </div>
        <MonthSelector value={mes} onChange={setMes} />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <>
          <StatsRow stats={stats} />

          {stats.vgv_gerado > 0 || stats.vgv_assinado > 0 ? (
            <div className="flex gap-4 text-xs">
              {stats.vgv_gerado > 0 && (
                <span className="text-muted-foreground">
                  VGV Gerado: <strong className="text-amber-600">{formatCurrency(stats.vgv_gerado)}</strong>
                </span>
              )}
              {stats.vgv_assinado > 0 && (
                <span className="text-muted-foreground">
                  VGV Assinado: <strong className="text-emerald-600">{formatCurrency(stats.vgv_assinado)}</strong>
                </span>
              )}
            </div>
          ) : null}

          <Tabs defaultValue="lista" className="space-y-4">
            <TabsList>
              <TabsTrigger value="lista" className="text-xs">Lista</TabsTrigger>
              <TabsTrigger value="kanban" className="text-xs">Kanban</TabsTrigger>
            </TabsList>

            <TabsContent value="lista">
              <ReadOnlyList entries={entries} />
            </TabsContent>

            <TabsContent value="kanban">
              <ReadOnlyKanban entries={entries} />
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
