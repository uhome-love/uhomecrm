import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageSquare, UserPlus, CheckCircle2, Flame, AlertTriangle } from "lucide-react";
import { todayBRT, dateToBRT } from "@/lib/brtTime";
import {
  useLiaConversasHoje,
  useLiaEstados,
  useLiaFollowups,
  NIVEL_META,
  type LiaEstado,
} from "./useLiaHub";

function Kpi({
  label,
  value,
  icon: Icon,
  loading,
}: {
  label: string;
  value: number | string;
  icon: any;
  loading?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {label}
          </span>
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="h-4 w-4" strokeWidth={1.75} />
          </span>
        </div>
        <div className="mt-2 text-xl font-bold tabular-nums text-foreground sm:text-2xl">
          {loading ? <Skeleton className="h-7 w-16" /> : value}
        </div>
      </CardContent>
    </Card>
  );
}

function FunilLinha({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold tabular-nums text-foreground">
          {value} <span className="text-xs font-normal text-muted-foreground">({pct}%)</span>
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function LiaPainelTab() {
  const { data: estados, isLoading } = useLiaEstados();
  const { data: conversasHoje, isLoading: loadingConv } = useLiaConversasHoje();
  const { data: followups } = useLiaFollowups();

  const hoje = todayBRT();

  const kpis = useMemo(() => {
    const list: LiaEstado[] = estados ?? [];
    const conversasHojeCount = new Set(
      (conversasHoje ?? []).filter((c) => c.role === "user").map((c) => c.telefone)
    ).size;
    const novosHoje = list.filter(
      (e) => e.last_msg_em && dateToBRT(e.last_msg_em) === hoje && e.status === "novo"
    ).length;
    const qualificadosHoje = list.filter(
      (e) => e.qualificado_em && dateToBRT(e.qualificado_em) === hoje
    ).length;
    const quentesHoje = list.filter(
      (e) => e.nivel === "quente" && e.qualificado_em && dateToBRT(e.qualificado_em) === hoje
    ).length;
    return { conversasHojeCount, novosHoje, qualificadosHoje, quentesHoje };
  }, [estados, conversasHoje, hoje]);

  const funil = useMemo(() => {
    const list: LiaEstado[] = estados ?? [];
    const falaram = list.length;
    const responderam = list.filter((e) => !!e.last_user_at).length;
    const engajaram = list.filter(
      (e) => e.status === "em_conversa" || e.status === "qualificado"
    ).length;
    const qualificados = list.filter((e) => e.status === "qualificado").length;
    const porNivel = (n: string) =>
      list.filter((e) => e.status === "qualificado" && String(e.nivel ?? "").toLowerCase() === n).length;
    return {
      falaram,
      responderam,
      engajaram,
      qualificados,
      quente: porNivel("quente"),
      morno: porNivel("morno"),
      frio: porNivel("frio"),
    };
  }, [estados]);

  const atencao = useMemo(() => {
    const list: LiaEstado[] = estados ?? [];
    const pendentes = (followups ?? []).filter((f) => f.status === "pendente");
    const telsPendentes = new Set(pendentes.map((f) => f.telefone));
    const naFila = list.filter((e) => e.status === "qualificado" && !e.lead_id).length;
    const esfriando = list.filter((e) => telsPendentes.has(e.telefone)).length;
    const optoutsHoje = list.filter(
      (e) => e.status === "opt_out" && e.last_msg_em && dateToBRT(e.last_msg_em) === hoje
    ).length;
    return { naFila, esfriando, optoutsHoje };
  }, [estados, followups, hoje]);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Conversas hoje" value={kpis.conversasHojeCount} icon={MessageSquare} loading={loadingConv} />
        <Kpi label="Leads novos hoje" value={kpis.novosHoje} icon={UserPlus} loading={isLoading} />
        <Kpi label="Qualificados hoje" value={kpis.qualificadosHoje} icon={CheckCircle2} loading={isLoading} />
        <Kpi label="Quentes hoje" value={kpis.quentesHoje} icon={Flame} loading={isLoading} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Funil da LIA</CardTitle>
            <CardDescription>Base completa de contatos atendidos pela IA.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              <>
                <FunilLinha label="Falaram com a LIA" value={funil.falaram} max={funil.falaram} />
                <FunilLinha label="Responderam" value={funil.responderam} max={funil.falaram} />
                <FunilLinha label="Engajaram" value={funil.engajaram} max={funil.falaram} />
                <FunilLinha label="Qualificados" value={funil.qualificados} max={funil.falaram} />
                <div className="grid grid-cols-3 gap-2 pt-1">
                  {(["quente", "morno", "frio"] as const).map((n) => (
                    <div
                      key={n}
                      className={`rounded-lg border px-3 py-2 ${NIVEL_META[n].cls}`}
                    >
                      <div className="text-[11px] font-semibold">
                        {NIVEL_META[n].emoji} {NIVEL_META[n].label}
                      </div>
                      <div className="text-lg font-bold tabular-nums">{funil[n]}</div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-warning" />
              Precisa da sua atenção
            </CardTitle>
            <CardDescription>Pontos que travam resultado agora.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <LinhaAtencao label="Qualificados aguardando na fila" value={atencao.naFila} />
            <LinhaAtencao label="Esfriando (follow-up pendente)" value={atencao.esfriando} />
            <LinhaAtencao label="Opt-outs de hoje" value={atencao.optoutsHoje} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function LinhaAtencao({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-lg font-bold tabular-nums text-foreground">{value}</span>
    </div>
  );
}
