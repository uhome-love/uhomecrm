import { useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  BarChart3,
  CalendarDays,
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  Lock,
  Trophy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useUserRole } from "@/hooks/useUserRole";
import { useEquipesDisponiveis } from "@/hooks/useEquipesDisponiveis";
import { resolvePeriodo } from "@/hooks/useRelatoriosCentral";
import { useRelatorioEquipes, type CorretorRow } from "@/hooks/useRelatorioEquipes";
import { fmtMoney } from "@/lib/fmtMoney";
import {
  useCentralUrlState,
  type CentralPeriodo,
  type CentralUrlState,
} from "@/components/central-v2/useCentralUrlState";
import {
  METRICS,
  METRIC_BY_KEY,
  DEFAULT_METRICS,
  orderMetrics,
  agruparPorEquipe,
  somaMetricas,
  destaquesEquipe,
  type MetricKey,
} from "./metrics";
import { exportRelatorioPdf, exportRelatorioExcel } from "./reportExport";

const ALL_EQUIPES = "__all__";
const ALL_CORRETORES = "__all__";

const PILLS: Array<{ id: CentralPeriodo; label: string }> = [
  { id: "hoje", label: "Hoje" },
  { id: "semana", label: "Semana" },
  { id: "mes", label: "Mês" },
  { id: "acumulado", label: "Acumulado" },
  { id: "trimestre", label: "Trimestre" },
  { id: "custom", label: "Personalizado" },
];

const PERIODO_LABELS: Record<CentralPeriodo, string> = {
  hoje: "Hoje",
  semana: "Semana atual",
  mes: "Mês atual",
  acumulado: "Acumulado do mês",
  trimestre: "Trimestre atual",
  custom: "Período personalizado",
};

function fmtRange(start: string, end: string): string {
  const s = new Date(`${start}T00:00:00`);
  const e = new Date(`${end}T00:00:00`);
  return `${format(s, "dd/MM/yyyy", { locale: ptBR })} a ${format(e, "dd/MM/yyyy", { locale: ptBR })}`;
}

function fmtCell(v: number, key: MetricKey): string {
  const def = METRIC_BY_KEY[key];
  if (def.money) return v ? fmtMoney(v, "exact") : "R$ 0";
  return String(v ?? 0);
}

export function ReportBuilder() {
  const { state, update } = useCentralUrlState();
  const { isAdmin, isDiretor } = useUserRole();
  const { data: equipes = [] } = useEquipesDisponiveis();
  const [metricas, setMetricas] = useState<MetricKey[]>(DEFAULT_METRICS);

  const filters = {
    periodo: state.periodo,
    de: state.de,
    ate: state.ate,
    equipe: state.equipe,
  };
  const { query } = useRelatorioEquipes(filters);
  const range = useMemo(
    () => resolvePeriodo(state.periodo, state.de, state.ate),
    [state.periodo, state.de, state.ate]
  );

  const data = query.data;
  const orderedMetrics = orderMetrics(metricas);

  const corretorOptions = useMemo(() => {
    if (!data) return [];
    return [...new Set(data.corretores.map((c) => c.nome))].sort((a, b) =>
      a.localeCompare(b, "pt-BR")
    );
  }, [data]);

  const filteredCorretores = useMemo(() => {
    if (!data) return [] as CorretorRow[];
    if (!state.corretor) return data.corretores;
    return data.corretores.filter((c) => c.nome === state.corretor);
  }, [data, state.corretor]);

  const equipesAgrupadas = useMemo(
    () => agruparPorEquipe(filteredCorretores),
    [filteredCorretores]
  );
  const empresaTot = useMemo(() => somaMetricas(filteredCorretores), [filteredCorretores]);

  const escopoLabel = state.equipe
    ? equipes.find((e) => e.id === state.equipe)?.nome ?? "Equipe selecionada"
    : isAdmin || isDiretor
      ? "Todas as equipes"
      : "Minha equipe";

  const toggleMetric = (k: MetricKey) => {
    setMetricas((prev) =>
      prev.includes(k) ? prev.filter((m) => m !== k) : [...prev, k]
    );
  };

  const handleExport = (kind: "pdf" | "excel") => {
    if (!data) return;
    const payload = {
      data: { ...data, corretores: filteredCorretores },
      metricas: orderedMetrics,
      periodoLabel: `${PERIODO_LABELS[state.periodo]} (${fmtRange(range.start, range.end)})`,
      escopoLabel,
    };
    if (kind === "pdf") exportRelatorioPdf(payload);
    else exportRelatorioExcel(payload);
  };

  const isForbidden = query.isError && (query.error as Error)?.message === "forbidden";

  return (
    <div className="min-h-full bg-background">
      {/* ── Barra de configuração ────────────────────────────── */}
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-3 px-4 py-3.5 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <BarChart3 className="h-5 w-5" strokeWidth={2} />
              </span>
              <div className="min-w-0">
                <h1 className="truncate text-xl font-semibold leading-tight text-foreground sm:text-2xl">
                  Relatório por Equipe
                </h1>
                <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                  <CalendarDays className="h-3 w-3 shrink-0" />
                  {fmtRange(range.start, range.end)} · {escopoLabel}
                </p>
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" disabled={!data || filteredCorretores.length === 0}>
                  <Download className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Exportar</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleExport("pdf")}>
                  <FileText className="mr-2 h-4 w-4" /> PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport("excel")}>
                  <FileSpreadsheet className="mr-2 h-4 w-4" /> Excel (.xlsx)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* período */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap gap-1.5">
              {PILLS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => update({ periodo: p.id })}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    state.periodo === p.id
                      ? "border-transparent bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {state.periodo === "custom" && (
              <div className="flex flex-wrap items-center gap-1.5">
                <DateField
                  value={state.de ? new Date(`${state.de}T00:00:00`) : undefined}
                  placeholder="De"
                  onChange={(d) => update({ de: d ? format(d, "yyyy-MM-dd") : undefined })}
                />
                <span className="text-xs text-muted-foreground">→</span>
                <DateField
                  value={state.ate ? new Date(`${state.ate}T00:00:00`) : undefined}
                  placeholder="Até"
                  onChange={(d) => update({ ate: d ? format(d, "yyyy-MM-dd") : undefined })}
                />
              </div>
            )}
          </div>

          {/* equipe / corretor / métricas */}
          <div className="flex flex-wrap items-center gap-2">
            {(isAdmin || isDiretor) && (
              <Select
                value={state.equipe ?? ALL_EQUIPES}
                onValueChange={(v) =>
                  update({ equipe: v === ALL_EQUIPES ? undefined : v, corretor: undefined })
                }
              >
                <SelectTrigger className="h-8 w-[180px] text-xs">
                  <SelectValue placeholder="Todas as equipes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_EQUIPES}>Todas as equipes</SelectItem>
                  {equipes.map((eq) => (
                    <SelectItem key={eq.id} value={eq.id}>
                      {eq.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Select
              value={state.corretor ?? ALL_CORRETORES}
              onValueChange={(v) =>
                update({ corretor: v === ALL_CORRETORES ? undefined : v })
              }
            >
              <SelectTrigger className="h-8 w-[180px] text-xs">
                <SelectValue placeholder="Todos os corretores" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_CORRETORES}>Todos os corretores</SelectItem>
                {corretorOptions.map((nome) => (
                  <SelectItem key={nome} value={nome}>
                    {nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <MetricPicker metricas={metricas} onToggle={toggleMetric} />
          </div>
        </div>
      </header>

      {/* ── Corpo ─────────────────────────────────────────────── */}
      <main className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 p-4 sm:p-6">
        {isForbidden ? (
          <EmptyState
            icon={<Lock className="h-8 w-8" />}
            title="Sem acesso a este relatório"
            desc="Este relatório está disponível para gerentes, diretores e administradores."
          />
        ) : query.isLoading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : query.isError ? (
          <EmptyState
            title="Erro ao carregar o relatório"
            desc="Tente novamente em alguns instantes."
          />
        ) : filteredCorretores.length === 0 ? (
          <EmptyState
            title="Nenhum dado no período"
            desc="Ajuste o período ou os filtros de equipe/corretor."
          />
        ) : orderedMetrics.length === 0 ? (
          <EmptyState
            title="Nenhuma métrica selecionada"
            desc="Selecione ao menos uma métrica para exibir o relatório."
          />
        ) : (
          <div className="flex flex-col gap-8">
            {equipesAgrupadas.map((eq) => (
              <EquipeCard
                key={eq.gerente_id}
                nome={eq.gerente_nome}
                corretores={eq.corretores}
                totais={eq.totais}
                metricas={orderedMetrics}
                topEmp={
                  data?.top_empreendimentos?.slice(0, 5) ?? []
                }
              />
            ))}

            {/* Consolidado */}
            <ConsolidadoCard
              equipes={equipesAgrupadas.map((e) => ({ nome: e.gerente_nome, totais: e.totais }))}
              empresa={empresaTot}
              metricas={orderedMetrics}
            />

            {/* Negócios em andamento */}
            {data && data.negocios_andamento.length > 0 && (
              <NegociosAndamentoCard
                negocios={data.negocios_andamento}
                corretorFilter={state.corretor}
              />
            )}
          </div>
        )}
      </main>
    </div>
  );
}

// ─────────────────────────────────────── Sub-componentes ───────────────────
function DateField({
  value,
  placeholder,
  onChange,
}: {
  value: Date | undefined;
  placeholder: string;
  onChange: (d: Date | undefined) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("h-8 justify-start text-xs font-normal", !value && "text-muted-foreground")}
        >
          <CalendarDays className="mr-1.5 h-3.5 w-3.5" />
          {value ? format(value, "dd/MM/yy") : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value}
          onSelect={onChange}
          initialFocus
          className="p-3 pointer-events-auto"
        />
      </PopoverContent>
    </Popover>
  );
}

function MetricPicker({
  metricas,
  onToggle,
}: {
  metricas: MetricKey[];
  onToggle: (k: MetricKey) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 text-xs">
          Métricas ({metricas.length})
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-2">
        <p className="px-2 pb-2 pt-1 text-[11px] font-medium text-muted-foreground">
          Colunas do relatório
        </p>
        <div className="flex flex-col">
          {METRICS.map((m) => {
            const checked = metricas.includes(m.key);
            return (
              <button
                key={m.key}
                type="button"
                onClick={() => onToggle(m.key)}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted"
              >
                <span
                  className={cn(
                    "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                    checked ? "border-primary bg-primary text-primary-foreground" : "border-border"
                  )}
                >
                  {checked && "✓"}
                </span>
                <span className="text-foreground">{m.label}</span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function MetricTable({
  corretores,
  totais,
  metricas,
}: {
  corretores: CorretorRow[];
  totais: Record<MetricKey, number>;
  metricas: MetricKey[];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="sticky left-0 bg-card px-3 py-2 text-left text-xs font-semibold text-muted-foreground">
              Corretor
            </th>
            {metricas.map((k) => (
              <th
                key={k}
                className="whitespace-nowrap px-3 py-2 text-right text-xs font-semibold text-muted-foreground"
                title={METRIC_BY_KEY[k].descricao}
              >
                {METRIC_BY_KEY[k].label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {corretores.map((c) => (
            <tr key={c.nome} className="border-b border-border/60 hover:bg-muted/40">
              <td className="sticky left-0 bg-card px-3 py-2 font-medium text-foreground">
                {c.nome}
              </td>
              {metricas.map((k) => (
                <td key={k} className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-foreground">
                  {fmtCell(Number(c[k] ?? 0), k)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-border bg-muted/50">
            <td className="sticky left-0 bg-muted/50 px-3 py-2 text-xs font-bold text-foreground">
              TOTAL EQUIPE
            </td>
            {metricas.map((k) => (
              <td key={k} className="whitespace-nowrap px-3 py-2 text-right font-bold tabular-nums text-foreground">
                {fmtCell(totais[k], k)}
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function EquipeCard({
  nome,
  corretores,
  totais,
  metricas,
  topEmp,
}: {
  nome: string;
  corretores: CorretorRow[];
  totais: Record<MetricKey, number>;
  metricas: MetricKey[];
  topEmp: { empreendimento: string; leads: number }[];
}) {
  const destaques = destaquesEquipe(corretores);
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-3">
        <h2 className="text-base font-semibold text-foreground">Equipe {nome}</h2>
        <span className="text-xs text-muted-foreground">{corretores.length} corretores</span>
      </div>
      <MetricTable corretores={corretores} totais={totais} metricas={metricas} />

      <div className="grid gap-4 border-t border-border p-4 sm:grid-cols-2">
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Trophy className="h-3.5 w-3.5" /> Corretores destaque
          </p>
          <ul className="space-y-1 text-sm text-foreground">
            {destaques.vgv && (
              <li>🏆 Maior VGV: <strong>{destaques.vgv.nome}</strong> ({fmtMoney(destaques.vgv.vgv, "exact")})</li>
            )}
            {destaques.visitas && (
              <li>🏠 Mais visitas realizadas: <strong>{destaques.visitas.nome}</strong> ({destaques.visitas.visitas_realizadas})</li>
            )}
            {destaques.leads && (
              <li>📥 Mais leads recebidos: <strong>{destaques.leads.nome}</strong> ({destaques.leads.leads_recebidos})</li>
            )}
            {!destaques.vgv && !destaques.visitas && !destaques.leads && (
              <li className="text-muted-foreground">Sem destaques no período.</li>
            )}
          </ul>
        </div>
        {topEmp.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Empreendimentos com melhor resultado
            </p>
            <ul className="space-y-1 text-sm text-foreground">
              {topEmp.map((e) => (
                <li key={e.empreendimento} className="flex justify-between">
                  <span className="truncate pr-2">{e.empreendimento}</span>
                  <span className="tabular-nums text-muted-foreground">{e.leads} leads</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Card>
  );
}

function ConsolidadoCard({
  equipes,
  empresa,
  metricas,
}: {
  equipes: { nome: string; totais: Record<MetricKey, number> }[];
  empresa: Record<MetricKey, number>;
  metricas: MetricKey[];
}) {
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-border bg-primary/10 px-4 py-3">
        <h2 className="text-base font-semibold text-foreground">
          Consolidado — Diretoria (todas as equipes)
        </h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Indicador</th>
              {equipes.map((e) => (
                <th key={e.nome} className="whitespace-nowrap px-3 py-2 text-right text-xs font-semibold text-muted-foreground">
                  {e.nome}
                </th>
              ))}
              <th className="whitespace-nowrap px-3 py-2 text-right text-xs font-bold text-foreground">Empresa</th>
            </tr>
          </thead>
          <tbody>
            {metricas.map((k) => (
              <tr key={k} className="border-b border-border/60">
                <td className="px-3 py-2 font-medium text-foreground">{METRIC_BY_KEY[k].label}</td>
                {equipes.map((e) => (
                  <td key={e.nome} className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-foreground">
                    {fmtCell(e.totais[k], k)}
                  </td>
                ))}
                <td className="whitespace-nowrap px-3 py-2 text-right font-bold tabular-nums text-foreground">
                  {fmtCell(empresa[k], k)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function NegociosAndamentoCard({
  negocios,
  corretorFilter,
}: {
  negocios: import("@/hooks/useRelatorioEquipes").NegocioAndamento[];
  corretorFilter?: string;
}) {
  const rows = corretorFilter ? negocios.filter((n) => n.corretor === corretorFilter) : negocios;
  if (rows.length === 0) return null;
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-border bg-muted/30 px-4 py-3">
        <h2 className="text-base font-semibold text-foreground">
          Negócios em andamento (etapa Em Negociação)
        </h2>
        <p className="text-xs text-muted-foreground">{rows.length} negócios</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border">
              {["Equipe", "Corretor", "Cliente", "Empreendimento", "Valor estimado", "Dias na etapa"].map((h) => (
                <th key={h} className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold text-muted-foreground">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((n, i) => (
              <tr key={i} className="border-b border-border/60 hover:bg-muted/40">
                <td className="whitespace-nowrap px-3 py-2 text-foreground">{n.equipe}</td>
                <td className="whitespace-nowrap px-3 py-2 text-foreground">{n.corretor}</td>
                <td className="px-3 py-2 text-foreground">{n.cliente ?? "—"}</td>
                <td className="px-3 py-2 text-foreground">{n.empreendimento ?? "—"}</td>
                <td className="whitespace-nowrap px-3 py-2 tabular-nums text-foreground">
                  {n.valor_estimado ? fmtMoney(n.valor_estimado, "exact") : "—"}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-foreground">{n.dias_na_etapa}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function EmptyState({
  icon,
  title,
  desc,
}: {
  icon?: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-24 text-center">
      {icon && <div className="text-muted-foreground">{icon}</div>}
      <p className="text-base font-semibold text-foreground">{title}</p>
      <p className="max-w-sm text-sm text-muted-foreground">{desc}</p>
    </div>
  );
}
