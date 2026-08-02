/**
 * Cartões da Fase 7 do HOMI — lente de liderança (gestor / diretor / CEO):
 *  - DesempenhoTimeCard: ranking do time com funil e conversões por corretor
 *  - RiscoMetaCard: meta do mês vs. realizado, ritmo e projeção
 *  - DiagnosticoCorretorCard: raio-x de um corretor vs. média do time
 */
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Target, TrendingUp, Users } from "lucide-react";
import HomiCard, { HomiKpi as Kpi } from "@/components/homi/cards/HomiCard";
import type { HomiResult } from "@/contexts/HomiContext";

function money(v?: number | null) {
  if (v == null) return "R$ 0";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

/* ───────────────────────────── Ranking do time */
export function DesempenhoTimeCard({ result, onPick }: { result: HomiResult; onPick: (t: string) => void }) {
  const navigate = useNavigate();
  const ranking = ((result.ranking as any[]) || []).filter((r) => r.leads || r.visitas || r.vendas);
  const t = (result.totais as any) || {};
  const risco = (result.risco as string[]) || [];

  return (
    <HomiCard
      icon={Users}
      tone="primario"
      titulo={`Time · ${String(result.periodo_label || "período")}`}
      selo={result.escopo === "global" ? "empresa" : "equipe"}
      fonte={`Fonte: rpc_metricas · ${String(result.inicio)} a ${String(result.fim)} · ver na Performance`}
      onFonteClick={() => navigate("/central-relatorios")}
    >
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        <Kpi label="Leads" valor={String(t.leads ?? 0)} />
        <Kpi label="Visitas" valor={String(t.visitas ?? 0)} />
        <Kpi label="Vendas" valor={String(t.vendas ?? 0)} />
        <Kpi label="VGV" valor={money(t.vgv)} />
      </div>


      {ranking.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-border/70 bg-card/60">
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 border-b border-border/70 px-2 py-1 text-[9px] uppercase tracking-wide text-muted-foreground">
            <span>Corretor</span><span>Vis.</span><span>Vd.</span><span className="text-right">VGV</span>
          </div>
          {ranking.map((r) => (
            <button
              key={r.auth_id || r.nome}
              type="button"
              onClick={() => onPick(`Me dá o raio-x do ${String(r.nome || "").split(" ")[0]}`)}
              className="grid w-full grid-cols-[1fr_auto_auto_auto] items-center gap-2 px-2 py-1.5 text-left text-[11px] transition-colors hover:bg-muted/60"
            >
              <span className="min-w-0 truncate font-medium text-foreground">
                {r.nome}
                {r.equipe && <span className="ml-1 text-[9px] text-muted-foreground">· {r.equipe}</span>}
              </span>
              <span className="tabular-nums text-muted-foreground">{r.visitas}</span>
              <span className="tabular-nums text-muted-foreground">{r.vendas}</span>
              <span className="text-right font-semibold tabular-nums text-foreground">{money(r.vgv)}</span>
            </button>
          ))}
        </div>
      )}

      {risco.length > 0 && (
        <p className="flex items-start gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-[11px] text-foreground">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
          <span>Sem visita e sem venda no período: {risco.join(", ")}</span>
        </p>
      )}

    </HomiCard>

  );
}

/* ───────────────────────────── Meta do mês */
export function RiscoMetaCard({ result }: { result: HomiResult }) {
  const navigate = useNavigate();
  const meta = Number(result.meta) || 0;
  const realizado = Number(result.realizado) || 0;
  const projecao = Number(result.projecao) || 0;
  const pct = meta ? Math.min(100, Math.round((realizado / meta) * 100)) : 0;
  const status = String(result.status || "sem_meta");
  const tone =
    status === "no_ritmo"
      ? { card: "sucesso" as const, bar: "bg-emerald-500", label: "No ritmo" }
      : status === "atencao"
        ? { card: "alerta" as const, bar: "bg-amber-500", label: "Atenção" }
        : status === "risco"
          ? { card: "critico" as const, bar: "bg-destructive", label: "Em risco" }
          : { card: "neutro" as const, bar: "bg-muted-foreground", label: "Sem meta" };

  return (
    <HomiCard
      icon={Target}
      tone={tone.card}
      titulo={`Meta ${String(result.mes)} · ${String(result.meta_fonte || "")}`}
      selo={tone.label}
      fonte="Fonte: rpc_metricas + metas cadastradas · ver na Performance"
      onFonteClick={() => navigate("/central-relatorios")}
    >
      {meta > 0 && (
        <div className="space-y-1">
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div className={`h-full rounded-full transition-all ${tone.bar}`} style={{ width: `${pct}%` }} />
          </div>
          <p className="text-[10px] text-muted-foreground">
            {money(realizado)} de {money(meta)} ({result.pct ?? 0}%) · dia {String(result.dias_corridos)}/{String(result.dias_mes)}
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        <Kpi label="Realizado" valor={money(realizado)} />
        <Kpi label="Projeção" valor={money(projecao)} />
        <Kpi label="Falta/dia" valor={money(Number(result.precisa_por_dia) || 0)} sub={`${result.dias_restantes} dias`} />
        <Kpi label="Vendas · visitas" valor={`${result.vendas ?? 0} · ${result.visitas_realizadas ?? 0}`} />
      </div>
    </HomiCard>
  );

}

/* ───────────────────────────── Raio-x do corretor */
export function DiagnosticoCorretorCard({ result, onPick }: { result: HomiResult; onPick: (t: string) => void }) {
  const c = (result.corretor as any) || {};
  const m = (result.media as any) || {};
  const parados = (result.parados as any[]) || [];

  return (
    <div className="space-y-2 rounded-xl border border-sky-500/25 bg-sky-500/5 p-2.5">
      <p className="flex items-center gap-1.5 text-xs font-bold text-foreground">
        <TrendingUp className="h-3.5 w-3.5 text-sky-500" />
        {c.nome} · {String(result.periodo_label || "período")}
        {c.equipe && <span className="rounded bg-muted px-1 text-[9px] uppercase text-muted-foreground">{c.equipe}</span>}
      </p>

      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
        <Kpi label="Leads" valor={String(c.leads ?? 0)} sub={`time ${m.leads ?? 0}`} />
        <Kpi label="Visitas realizadas" valor={String(c.visitas ?? 0)} sub={`time ${m.visitas ?? 0}`} />
        <Kpi label="No-show" valor={String(c.no_show ?? 0)} />
        <Kpi label="Vendas" valor={String(c.vendas ?? 0)} sub={`time ${m.vendas ?? 0}`} />
        <Kpi label="VGV" valor={money(c.vgv)} sub={`time ${money(m.vgv)}`} />
        <Kpi label="Conversões" valor={`${c.conv_lead_visita ?? 0}% / ${c.conv_visita_venda ?? 0}%`} sub="lead→visita / visita→venda" />
      </div>

      {parados.length > 0 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2">
          <p className="text-[11px] font-semibold text-foreground">Leads parados 7+ dias ({parados.length})</p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            {parados.slice(0, 5).map((l) => l.nome).join(" · ")}
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={() => onPick(`Me ajuda a preparar o 1:1 com ${String(c.nome || "").split(" ")[0]}`)}
        className="w-full rounded-lg border border-border bg-card/60 px-2 py-1.5 text-[11px] font-medium text-foreground transition-colors hover:bg-muted"
      >
        Preparar o 1:1 com {String(c.nome || "").split(" ")[0]}
      </button>
    </div>
  );
}
