import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageSquare, UserPlus, CheckCircle2, Flame, AlertTriangle, CalendarCheck, DollarSign, Send, Trash2 } from "lucide-react";
import { todayBRT, dateToBRT } from "@/lib/brtTime";
import {
  useLiaConversasHoje,
  useLiaEstados,
  useLiaFollowups,
  useLiaPipelineLeads,
  useLiaCusto,
  NIVEL_META,
  type LiaEstado,
} from "./useLiaHub";

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const custoPor = (total: number, n: number) => (n > 0 ? brl(total / n) : "—");

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
  const { data: pipe } = useLiaPipelineLeads();
  const { data: custo, isLoading: loadingCusto } = useLiaCusto();

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
    const agendadasHoje = list.filter(
      (e) => e.agendou && e.agendou_em && dateToBRT(e.agendou_em) === hoje
    ).length;
    return { conversasHojeCount, novosHoje, qualificadosHoje, quentesHoje, agendadasHoje };
  }, [estados, conversasHoje, hoje]);

  const funil = useMemo(() => {
    const list: LiaEstado[] = estados ?? [];
    const falaram = list.length;
    const responderam = list.filter((e) => !!e.last_user_at).length;
    const engajaram = list.filter(
      (e) => e.status === "em_conversa" || e.status === "qualificado"
    ).length;
    const qualificados = list.filter((e) => e.status === "qualificado").length;
    const agendaram = list.filter((e) => e.agendou).length;
    const porNivel = (n: string) =>
      list.filter((e) => e.status === "qualificado" && String(e.nivel ?? "").toLowerCase() === n).length;

    // etapas reais do pipeline pros leads da LIA: visita (ordem>=4) e venda (tipo=venda)
    const leads = pipe?.leads ?? [];
    const stages = pipe?.stages;
    let visitaram = 0;
    let venderam = 0;
    for (const l of leads) {
      const s = l.stage_id && stages ? stages.get(l.stage_id) : undefined;
      if (!s) continue;
      if (s.tipo === "venda") venderam++;
      if (s.ordem >= 4 && s.ordem <= 9) visitaram++; // Visita..Ganho, fora de Caiu/Descarte
    }
    return {
      falaram,
      responderam,
      engajaram,
      qualificados,
      agendaram,
      visitaram,
      venderam,
      quente: porNivel("quente"),
      morno: porNivel("morno"),
      frio: porNivel("frio"),
    };
  }, [estados, pipe]);

  const atencao = useMemo(() => {
    const list: LiaEstado[] = estados ?? [];
    const pendentes = (followups ?? []).filter((f) => f.status === "pendente");
    const telsPendentes = new Set(pendentes.map((f) => f.telefone));
    const naFila = list.filter((e) => e.status === "qualificado" && !e.lead_id).length;
    const esfriando = list.filter((e) => telsPendentes.has(e.telefone)).length;
    const optoutsHoje = list.filter(
      (e) => e.status === "opt_out" && e.last_msg_em && dateToBRT(e.last_msg_em) === hoje
    ).length;
    // quentes que ainda NÃO marcaram apresentação: o time tem que atacar agora
    const quentesSemAgenda = list.filter(
      (e) => e.status === "qualificado" && String(e.nivel ?? "").toLowerCase() === "quente" && !e.agendou
    ).length;
    return { naFila, esfriando, optoutsHoje, quentesSemAgenda };
  }, [estados, followups, hoje]);

  // recuperação: de quem recebeu um follow-up (enviado), quantos voltaram a falar depois dele
  const recuperacao = useMemo(() => {
    const ultimoEnvio = new Map<string, string>();
    for (const f of followups ?? []) {
      if (f.status !== "enviado" || !f.enviado_em || !f.telefone) continue;
      const prev = ultimoEnvio.get(f.telefone);
      if (!prev || f.enviado_em > prev) ultimoEnvio.set(f.telefone, f.enviado_em);
    }
    let voltaram = 0;
    for (const e of estados ?? []) {
      const env = ultimoEnvio.get(e.telefone);
      if (env && e.last_user_at && e.last_user_at > env) voltaram++;
    }
    return { cutucados: ultimoEnvio.size, voltaram };
  }, [followups, estados]);

  // passagem de bastão: quantos leads a LIA avisou do repasse, e quantos o corretor assumiu
  const repasse = useMemo(() => {
    const list: LiaEstado[] = estados ?? [];
    const avisados = list.filter((e) => !!e.repassado_em);
    const leadsAceitos = new Set(
      (pipe?.leads ?? [])
        .filter((l) => l.corretor_id && l.aceite_status === "aceito")
        .map((l) => l.id)
    );
    const assumidos = avisados.filter((e) => e.lead_id && leadsAceitos.has(e.lead_id)).length;
    return { avisados: avisados.length, assumidos };
  }, [estados, pipe]);

  // descartes manuais pelo hub, agrupados por motivo
  const descartes = useMemo(() => {
    const list: LiaEstado[] = estados ?? [];
    const desc = list.filter((e) => e.status === "descartado");
    const porMotivo = new Map<string, number>();
    for (const e of desc) {
      const m = (e.motivo ?? "").trim() || "Sem motivo";
      porMotivo.set(m, (porMotivo.get(m) ?? 0) + 1);
    }
    const linhas = Array.from(porMotivo.entries()).sort((a, b) => b[1] - a[1]);
    return { total: desc.length, linhas };
  }, [estados]);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi label="Conversas hoje" value={kpis.conversasHojeCount} icon={MessageSquare} loading={loadingConv} />
        <Kpi label="Leads novos hoje" value={kpis.novosHoje} icon={UserPlus} loading={isLoading} />
        <Kpi label="Qualificados hoje" value={kpis.qualificadosHoje} icon={CheckCircle2} loading={isLoading} />
        <Kpi label="Agendadas hoje" value={kpis.agendadasHoje} icon={CalendarCheck} loading={isLoading} />
        <Kpi label="Quentes hoje" value={kpis.quentesHoje} icon={Flame} loading={isLoading} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Funil da LIA</CardTitle>
            <CardDescription>Do primeiro oi até a venda. O que importa é o fundo.</CardDescription>
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
                <FunilLinha label="Agendaram apresentação" value={funil.agendaram} max={funil.falaram} />
                <FunilLinha label="Foram pra visita" value={funil.visitaram} max={funil.falaram} />
                <FunilLinha label="Viraram venda" value={funil.venderam} max={funil.falaram} />
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
                {recuperacao.cutucados > 0 && (
                  <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
                    <span className="text-muted-foreground">🔁 Recuperados pelo follow-up</span>
                    <span className="font-semibold tabular-nums text-foreground">
                      {recuperacao.voltaram}{" "}
                      <span className="text-xs font-normal text-muted-foreground">
                        de {recuperacao.cutucados} cutucados
                      </span>
                    </span>
                  </div>
                )}
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
            <LinhaAtencao label="Quentes sem apresentação agendada" value={atencao.quentesSemAgenda} />
            <LinhaAtencao label="Qualificados aguardando na fila" value={atencao.naFila} />
            <LinhaAtencao label="Esfriando (follow-up pendente)" value={atencao.esfriando} />
            <LinhaAtencao label="Opt-outs de hoje" value={atencao.optoutsHoje} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Send className="h-4 w-4 text-primary" />
              Passagem de bastão
            </CardTitle>
            <CardDescription>
              A LIA avisa o lead que um especialista vai seguir. Aqui você vê se o time assumiu.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <LinhaAtencao label="Avisados do repasse" value={repasse.avisados} />
            <LinhaAtencao label="Assumidos por um corretor" value={repasse.assumidos} />
            {repasse.avisados > 0 && (
              <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
                <span className="text-muted-foreground">Taxa de repasse assumido</span>
                <span className="font-semibold tabular-nums text-foreground">
                  {Math.round((repasse.assumidos / repasse.avisados) * 100)}%
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Trash2 className="h-4 w-4 text-muted-foreground" />
              Descartados por motivo
            </CardTitle>
            <CardDescription>Leads tirados da fila da LIA à mão, e o porquê.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {isLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : descartes.total === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">Nenhum descarte ainda.</p>
            ) : (
              <>
                <div className="flex items-baseline justify-between border-b border-border pb-2">
                  <span className="text-sm text-muted-foreground">Total descartados</span>
                  <span className="text-lg font-bold tabular-nums text-foreground">{descartes.total}</span>
                </div>
                {descartes.linhas.map(([motivo, n]) => (
                  <div key={motivo} className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-muted-foreground">{motivo}</span>
                    <span className="font-semibold tabular-nums text-foreground">{n}</span>
                  </div>
                ))}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <DollarSign className="h-4 w-4 text-primary" />
            Investimento e custo
          </CardTitle>
          <CardDescription>
            Gasto real dos anúncios que trouxeram os leads da LIA. O número-norte é o custo por apresentação agendada.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingCusto ? (
            <Skeleton className="h-16 w-full" />
          ) : !custo?.ok ? (
            <p className="text-sm text-muted-foreground">
              {custo?.motivo === "sem_token"
                ? "Meta Ads ainda não conectado nas configurações."
                : "Não foi possível carregar o investimento agora."}
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <CustoStat label="Investimento" valor={brl(custo.investimento)} destaque />
              <CustoStat label="Custo por lead" valor={custoPor(custo.investimento, funil.falaram)} />
              <CustoStat label="Custo por qualificado" valor={custoPor(custo.investimento, funil.qualificados)} />
              <CustoStat label="Custo por apresentação" valor={custoPor(custo.investimento, funil.agendaram)} destaque />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function CustoStat({ label, valor, destaque }: { label: string; valor: string; destaque?: boolean }) {
  return (
    <div className={`rounded-lg border px-3 py-2.5 ${destaque ? "border-primary/30 bg-primary/5" : "border-border bg-muted/30"}`}>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-bold tabular-nums text-foreground">{valor}</div>
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
