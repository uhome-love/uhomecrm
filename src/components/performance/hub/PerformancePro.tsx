import { useMemo, useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Download, FileText, Building2, Users, User, ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuthUser } from "@/hooks/useAuthUser";
import { useUserRole } from "@/hooks/useUserRole";
import { resolverPeriodo, type PeriodoState, type PeriodoTipo } from "@/lib/perfPeriodo";
import { useFunilPerformance, consolidarFunil, somarFunil, type FunilLinha } from "@/hooks/useFunilPerformance";
import { baixarRelatorioHtml, baixarRelatorioPdf } from "@/lib/performanceReport";
import { buildFunnel, aproveitamentoGeral, buildSinais } from "./perfData";
import { PerfKpis } from "./PerfKpis";
import { PerfFunnel } from "./PerfFunnel";
import { PerfSinais } from "./PerfSinais";
import { PerfAproveitamento, type AprovTab } from "./PerfAproveitamento";
import { PerfRankings } from "./PerfRankings";

type Nivel = "base" | "equipe" | "corretor";
interface Drill {
  nivel: Nivel;
  equipe?: string;
  corretorId?: string;
  nome?: string;
}

const PERIODOS: { tipo: PeriodoTipo; label: string }[] = [
  { tipo: "semana", label: "Semana" },
  { tipo: "mes", label: "Mês" },
  { tipo: "custom", label: "Personalizado" },
];

/**
 * PerformancePro — hub único de Performance, adaptativo por papel.
 * Fonte única: rpc_perf_funil (via useFunilPerformance). Drill = filtro client-side.
 */
export default function PerformancePro() {
  const { user } = useAuthUser();
  const { isAdmin, isGestor, isDiretor, isCorretor } = useUserRole();
  const soCorretor = isCorretor && !isGestor && !isAdmin && !isDiretor;
  const podeEmpresa = isAdmin || isDiretor;

  // Abre em "semana passada" (reunião de domingo)
  const [periodo, setPeriodo] = useState<PeriodoState>({ tipo: "semana", offset: -1 });
  const [drill, setDrill] = useState<Drill>({ nivel: "base" });

  const p = useMemo(() => resolverPeriodo(periodo), [periodo]);

  // Escopo base da busca por papel: corretor→ele; gestor→equipe; admin→empresa
  const baseUserId = soCorretor ? user?.id ?? null : null;
  const baseGerenteId = !soCorretor && isGestor && !podeEmpresa ? user?.id ?? null : null;

  const atualQ = useFunilPerformance({ start: p.start, end: p.end, gerenteId: baseGerenteId, userId: baseUserId }, !!user);
  const antQ = useFunilPerformance({ start: p.prevStart, end: p.prevEnd, gerenteId: baseGerenteId, userId: baseUserId }, !!user);

  // Reset drill ao trocar período (mantém coerência)
  useEffect(() => { setDrill({ nivel: "base" }); }, [periodo.tipo]);

  // Filtro client-side conforme o drill
  const filtrar = (linhas: FunilLinha[]) => {
    if (drill.nivel === "equipe") return linhas.filter((l) => (l.equipe || "Sem equipe") === drill.equipe);
    if (drill.nivel === "corretor") return linhas.filter((l) => l.corretor_auth_id === drill.corretorId);
    return linhas;
  };
  const linhas = useMemo(() => filtrar(atualQ.linhas), [atualQ.linhas, drill]);
  const linhasAnt = useMemo(() => filtrar(antQ.linhas), [antQ.linhas, drill]);

  const tAtual = useMemo(() => somarFunil(linhas), [linhas]);
  const tAnt = useMemo(() => somarFunil(linhasAnt), [linhasAnt]);
  const loading = atualQ.isLoading;

  // Escopo efetivo (papel + drill)
  const escopo: "empresa" | "equipe" | "corretor" =
    soCorretor || drill.nivel === "corretor" ? "corretor" : (isGestor && !podeEmpresa) || drill.nivel === "equipe" ? "equipe" : "empresa";

  const funnel = useMemo(() => buildFunnel(tAtual), [tAtual]);
  const sinais = useMemo(() => buildSinais(linhas, escopo), [linhas, escopo]);

  const aprovTabs: AprovTab[] = escopo === "empresa" ? ["equipe", "corretor"] : escopo === "equipe" ? ["corretor"] : [];
  const mostraAprov = escopo !== "corretor";
  const mostraRank = escopo !== "corretor";

  // Contexto / breadcrumb
  const ctx = (() => {
    if (escopo === "corretor") return { icon: User, titulo: drill.nome ? `${drill.nome}` : "Seus resultados", sub: soCorretor ? "seus números" : "relatório individual · 1-a-1" };
    if (escopo === "equipe") return { icon: Users, titulo: drill.equipe ? `Equipe ${drill.equipe}` : "Sua equipe", sub: `${tAtual.corretores} corretores` };
    return { icon: Building2, titulo: "Empresa", sub: `${tAtual.corretores} corretores` };
  })();
  const CtxIcon = ctx.icon;

  const exportar = (tipo: "pdf" | "html") => {
    const cons = consolidarFunil(linhas);
    if (cons.length === 0) { toast.error("Sem dados para exportar."); return; }
    const meta = {
      periodoLabel: p.label,
      escopo: escopo === "corretor" ? (drill.nome ?? "Individual") : escopo === "equipe" ? (drill.equipe ? `Equipe ${drill.equipe}` : "Minha equipe") : "Empresa",
      geradoEm: format(new Date(), "dd/MM/yyyy HH:mm"),
    };
    try {
      tipo === "pdf" ? baixarRelatorioPdf(cons, meta) : baixarRelatorioHtml(cons, meta);
      toast.success(`Relatório ${tipo.toUpperCase()} gerado.`);
    } catch { toast.error("Não foi possível gerar o relatório."); }
  };

  const navPeriodo = (dir: number) => setPeriodo((s) => ({ ...s, offset: s.offset + dir }));

  if (atualQ.error) {
    return <div className="rounded-2xl border border-danger-500/40 bg-danger-500/5 p-6 text-sm">Não foi possível carregar: {atualQ.error.message}</div>;
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ── Header: contexto + período + ações ── */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          {drill.nivel !== "base" && (
            <button onClick={() => setDrill({ nivel: "base" })} className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-colors hover:text-foreground" aria-label="Voltar">
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <CtxIcon className="h-5 w-5" strokeWidth={2} />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-lg font-extrabold tracking-tight text-foreground">{ctx.titulo}</h2>
            <p className="truncate text-xs text-muted-foreground">{p.label} · {ctx.sub}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl bg-muted p-0.5">
            {PERIODOS.map((op) => (
              <button
                key={op.tipo}
                onClick={() => setPeriodo({ tipo: op.tipo, offset: op.tipo === "semana" ? -1 : 0 })}
                className={cn("cursor-pointer rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition-colors",
                  periodo.tipo === op.tipo ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
              >
                {op.label}
              </button>
            ))}
          </div>

          {p.navegavel && (
            <div className="inline-flex items-center rounded-xl border border-border bg-card">
              <button onClick={() => navPeriodo(-1)} className="flex h-8 w-8 items-center justify-center text-muted-foreground hover:text-foreground" aria-label="Anterior"><ChevronLeft className="h-4 w-4" /></button>
              <button onClick={() => navPeriodo(1)} disabled={p.noPresente} className="flex h-8 w-8 items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30" aria-label="Próximo"><ChevronRight className="h-4 w-4" /></button>
            </div>
          )}

          <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={() => exportar("html")}>
            <FileText className="h-3.5 w-3.5" /> HTML
          </Button>
          <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={() => exportar("pdf")}>
            <Download className="h-3.5 w-3.5" /> {escopo === "corretor" ? "PDF 1-a-1" : "PDF"}
          </Button>
        </div>
      </div>

      {/* Período custom */}
      {periodo.tipo === "custom" && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">De</span>
          <input type="date" value={periodo.customStart ?? p.start} onChange={(e) => setPeriodo((s) => ({ ...s, customStart: e.target.value }))} className="rounded-lg border border-border bg-card px-2 py-1.5 text-[13px]" />
          <span className="text-muted-foreground">até</span>
          <input type="date" value={periodo.customEnd ?? p.end} onChange={(e) => setPeriodo((s) => ({ ...s, customEnd: e.target.value }))} className="rounded-lg border border-border bg-card px-2 py-1.5 text-[13px]" />
        </div>
      )}

      {/* ── 1. Como foi ── */}
      <PerfKpis atual={tAtual} anterior={tAnt} loading={loading} />

      {/* ── 2. Funil + Sinais ── */}
      <div className="grid gap-3.5 lg:grid-cols-[1.25fr_0.9fr]">
        <PerfFunnel stages={funnel} aproveitamento={aproveitamentoGeral(tAtual)} escopoLabel={ctx.titulo.toLowerCase()} loading={loading} />
        <PerfSinais sinais={sinais} loading={loading} />
      </div>

      {/* ── 3. Aproveitamento ── */}
      {mostraAprov && (
        <PerfAproveitamento
          linhas={linhas}
          tabs={aprovTabs}
          loading={loading}
          onDrill={(tab, l) => {
            if (tab === "equipe") setDrill({ nivel: "equipe", equipe: l.nome });
            else setDrill({ nivel: "corretor", corretorId: l.id, nome: l.nome });
          }}
        />
      )}

      {/* ── 4. Rankings ── */}
      {mostraRank && (
        <PerfRankings
          linhas={linhas}
          loading={loading}
          meuId={user?.id}
          onDrill={(id, nome) => setDrill({ nivel: "corretor", corretorId: id, nome })}
        />
      )}

      <p className="mt-2 text-[11px] text-muted-foreground/70">Fonte única: rpc_perf_funil · comparativo vs. {p.prevLabel}.</p>
    </div>
  );
}
