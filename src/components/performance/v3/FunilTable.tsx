import { Fragment, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, ArrowUpDown, Rows3, Layers } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { fmtMoney } from "@/lib/fmtMoney";
import { agruparFunilPorEquipe, somarFunil, type FunilLinha, type FunilTotais } from "@/hooks/useFunilPerformance";
import { cn } from "@/lib/utils";

type ColKey =
  | "corretor_nome"
  | "presenca"
  | "leads_recebidos"
  | "pipeline_ativo"
  | "descartes"
  | "visitas_total"
  | "visitas_realizadas"
  | "negocios_abertos"
  | "vgv_gerado"
  | "vgv_assinado";

const COLS: { key: ColKey; label: string; hint: string }[] = [
  { key: "presenca", label: "Presença", hint: "Dias na empresa ÷ dias úteis já decorridos" },
  { key: "leads_recebidos", label: "Leads", hint: "Leads recebidos no período" },
  { key: "pipeline_ativo", label: "Pipeline", hint: "Leads ativos agora (fora de venda/descarte)" },
  { key: "descartes", label: "Descartes", hint: "Leads descartados no período" },
  { key: "visitas_total", label: "Visitas", hint: "Visitas que existiram no período (agendadas ou realizadas)" },
  { key: "visitas_realizadas", label: "Realizadas", hint: "Visitas ocorridas no período" },
  { key: "negocios_abertos", label: "Negócios", hint: "Negócios abertos no período" },
  { key: "vgv_gerado", label: "Gerado", hint: "VGV de negócios ativos (negociação + contrato)" },
  { key: "vgv_assinado", label: "Assinado", hint: "VGV assinado no período (rateio 50/50)" },
];

const valorDe = (l: FunilLinha, k: ColKey): number | string => {
  if (k === "corretor_nome") return (l.corretor_nome ?? "").toLowerCase();
  if (k === "presenca") return l.dias_uteis_decorridos > 0 ? l.presenca_dias / l.dias_uteis_decorridos : 0;
  return l[k] as number;
};

function iniciais(nome: string | null) {
  return (nome ?? "?")
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

function PresencaPill({ l }: { l: FunilLinha }) {
  const base = l.dias_uteis_decorridos || l.dias_uteis;
  const r = base > 0 ? l.presenca_dias / base : 0;
  const tone =
    r >= 0.8
      ? "bg-success-500/12 text-success-700 dark:text-success-500"
      : r >= 0.6
        ? "bg-warning-500/14 text-warning-700 dark:text-warning-500"
        : "bg-danger-500/12 text-danger-500";
  return (
    <span
      className={cn("px-2 py-0.5 rounded-full text-[10.5px] font-bold tabular-nums", tone)}
      title={`${l.presenca_dias} presenças · ${l.presenca_faltas} faltas · ${l.presenca_saidas} saídas · ${base} dias úteis decorridos`}
    >
      {l.presenca_dias}/{base}
    </span>
  );
}

/** Célula numérica com barra de intensidade discreta. */
function Num({ v, max, forte }: { v: number; max: number; forte?: boolean }) {
  const pct = max > 0 ? Math.min(100, (v / max) * 100) : 0;
  return (
    <td className="py-2 px-2 text-right relative">
      <span className={cn("relative z-10 tabular-nums", forte && "font-semibold")}>{v.toLocaleString("pt-BR")}</span>
      <span className="absolute inset-y-1 right-1 rounded-sm bg-primary/10 z-0" style={{ width: `${pct * 0.55}%` }} />
    </td>
  );
}

function Linha({ l, max }: { l: FunilLinha; max: Record<string, number> }) {
  return (
    <tr className="border-b border-border/50 hover:bg-muted/40 transition-colors">
      <td className="py-2 px-3 whitespace-nowrap sticky left-0 bg-card z-10">
        <div className="flex items-center gap-2">
          <Avatar className="h-6 w-6">
            <AvatarImage src={l.avatar_url ?? undefined} alt={l.corretor_nome ?? "Corretor"} />
            <AvatarFallback className="text-[9px]">{iniciais(l.corretor_nome)}</AvatarFallback>
          </Avatar>
          <span className="font-medium">{l.corretor_nome ?? "—"}</span>
          {!l.corretor_ativo && <span className="text-[10px] text-muted-foreground">inativo</span>}
        </div>
      </td>
      <td className="py-2 px-2 text-right"><PresencaPill l={l} /></td>
      <Num v={l.leads_recebidos} max={max.leads_recebidos} />
      <Num v={l.pipeline_ativo} max={max.pipeline_ativo} />
      <Num v={l.descartes} max={max.descartes} />
      <Num v={l.visitas_total} max={max.visitas_total} />
      <Num v={l.visitas_realizadas} max={max.visitas_realizadas} />
      <Num v={l.negocios_abertos} max={max.negocios_abertos} />
      <td className="py-2 px-2 text-right tabular-nums">{fmtMoney(l.vgv_gerado, "short")}</td>
      <td className="py-2 px-2 text-right tabular-nums font-semibold">{fmtMoney(l.vgv_assinado, "short")}</td>
    </tr>
  );
}

function LinhaTotal({ nome, t, geral }: { nome: string; t: FunilTotais; geral?: boolean }) {
  const base = (t.dias_uteis_decorridos || t.dias_uteis) * (t.corretores_ativos || t.corretores);
  return (
    <tr className={cn("font-bold", geral ? "bg-primary/8 border-t-2 border-primary/30" : "bg-muted/60")}>
      <td className="py-2 px-3 whitespace-nowrap sticky left-0 z-10" style={{ background: "inherit" }}>{nome}</td>
      <td className="py-2 px-2 text-right tabular-nums">{base > 0 ? `${Math.round((t.presenca_dias / base) * 100)}%` : "—"}</td>
      <td className="py-2 px-2 text-right tabular-nums">{t.leads_recebidos.toLocaleString("pt-BR")}</td>
      <td className="py-2 px-2 text-right tabular-nums">{t.pipeline_ativo.toLocaleString("pt-BR")}</td>
      <td className="py-2 px-2 text-right tabular-nums">{t.descartes.toLocaleString("pt-BR")}</td>
      <td className="py-2 px-2 text-right tabular-nums">{t.visitas_total.toLocaleString("pt-BR")}</td>
      <td className="py-2 px-2 text-right tabular-nums">{t.visitas_realizadas.toLocaleString("pt-BR")}</td>
      <td className="py-2 px-2 text-right tabular-nums">{t.negocios_abertos.toLocaleString("pt-BR")}</td>
      <td className="py-2 px-2 text-right tabular-nums">{fmtMoney(t.vgv_gerado, "short")}</td>
      <td className="py-2 px-2 text-right tabular-nums">{fmtMoney(t.vgv_assinado, "short")}</td>
    </tr>
  );
}

interface Props {
  linhas: FunilLinha[];
  loading: boolean;
  /** Corretor puro: some o agrupamento por equipe. */
  simples?: boolean;
}

/** Planilha densa do funil — agrupada por equipe, ordenável por coluna. */
export default function FunilTable({ linhas, loading, simples }: Props) {
  const [ordem, setOrdem] = useState<{ col: ColKey; dir: "asc" | "desc" }>({ col: "vgv_assinado", dir: "desc" });
  const [agrupar, setAgrupar] = useState(true);
  const [fechadas, setFechadas] = useState<Set<string>>(new Set());

  const ordenar = (arr: FunilLinha[]) =>
    [...arr].sort((a, b) => {
      const va = valorDe(a, ordem.col);
      const vb = valorDe(b, ordem.col);
      const cmp = typeof va === "string" ? va.localeCompare(String(vb)) : (va as number) - (vb as number);
      return ordem.dir === "asc" ? cmp : -cmp;
    });

  const max = useMemo(() => {
    const m: Record<string, number> = {};
    ["leads_recebidos", "pipeline_ativo", "descartes", "visitas_total", "visitas_realizadas", "negocios_abertos"].forEach((k) => {
      m[k] = Math.max(...linhas.map((l) => (l[k as keyof FunilLinha] as number) ?? 0), 1);
    });
    return m;
  }, [linhas]);

  if (loading) return <Skeleton className="h-64 rounded-2xl" />;
  if (linhas.length === 0)
    return <Card className="p-8 text-center text-sm text-muted-foreground">Sem dados no período.</Card>;

  const grupos = agruparFunilPorEquipe(linhas).map((g) => ({ ...g, membros: ordenar(g.membros) }));
  const total = somarFunil(linhas);
  const usarGrupos = !simples && agrupar;

  const th = (key: ColKey, label: string, hint: string, align: "left" | "right") => (
    <th
      key={key}
      title={hint}
      onClick={() => setOrdem((o) => ({ col: key, dir: o.col === key && o.dir === "desc" ? "asc" : "desc" }))}
      className={cn(
        "py-2.5 px-2 text-[10.5px] uppercase tracking-wide text-muted-foreground whitespace-nowrap cursor-pointer select-none hover:text-foreground",
        align === "right" ? "text-right" : "text-left",
        ordem.col === key && "text-foreground"
      )}
    >
      <span className="inline-flex items-center gap-1">
        {align === "right" && ordem.col === key && <ArrowUpDown className="h-3 w-3" />}
        {label}
        {align === "left" && ordem.col === key && <ArrowUpDown className="h-3 w-3" />}
      </span>
    </th>
  );

  return (
    <Card className="overflow-hidden">
      {!simples && (
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border">
          <p className="text-[11px] text-muted-foreground">
            {total.corretores} corretores · {grupos.length} equipes · clique no cabeçalho para ordenar
          </p>
          <Button size="sm" variant="outline" className="h-7 gap-1.5 text-[11px]" onClick={() => setAgrupar((v) => !v)}>
            {agrupar ? <Rows3 className="h-3.5 w-3.5" /> : <Layers className="h-3.5 w-3.5" />}
            {agrupar ? "Lista única" : "Agrupar por equipe"}
          </Button>
        </div>
      )}

      <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 z-20 bg-muted/95 backdrop-blur">
            <tr className="border-b border-border">
              {th("corretor_nome", "Corretor", "Nome do corretor", "left")}
              {COLS.map((c) => th(c.key, c.label, c.hint, "right"))}
            </tr>
          </thead>
          <tbody>
            {usarGrupos
              ? grupos.map((g) => {
                  const aberta = !fechadas.has(g.equipe);
                  return (
                    <Fragment key={g.equipe}>
                      <tr
                        className="bg-muted/40 cursor-pointer hover:bg-muted/60"
                        onClick={() =>
                          setFechadas((s) => {
                            const n = new Set(s);
                            n.has(g.equipe) ? n.delete(g.equipe) : n.add(g.equipe);
                            return n;
                          })
                        }
                      >
                        <td colSpan={10} className="py-2 px-3 text-[11px] font-bold">
                          <span className="inline-flex items-center gap-1.5">
                            {aberta ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                            {g.equipe} · {g.totais.corretores} corretores · {fmtMoney(g.totais.vgv_assinado, "short")} assinado
                          </span>
                        </td>
                      </tr>
                      {aberta && g.membros.map((l) => <Linha key={l.corretor_auth_id} l={l} max={max} />)}
                      <LinhaTotal nome={`Total ${g.equipe}`} t={g.totais} />
                    </Fragment>
                  );
                })
              : ordenar(linhas).map((l) => <Linha key={l.corretor_auth_id} l={l} max={max} />)}
            <LinhaTotal nome="Total geral" t={total} geral />
          </tbody>
        </table>
      </div>
    </Card>
  );
}
