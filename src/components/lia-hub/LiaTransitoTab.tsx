import { useMemo, useState, type ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Handshake, CalendarCheck, Clock } from "lucide-react";
import FiltroImovel from "./FiltroImovel";
import {
  useLiaEstados,
  useLiaPipelineLeads,
  useLiaConversao,
  produtosDeEstados,
  type LiaEstado,
} from "./useLiaHub";

/** Mediana de uma lista de números (dias). Retorna null se vazia. */
function mediana(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}
const diasEntre = (a?: string | null, b?: string | null): number | null => {
  if (!a || !b) return null;
  const d = (new Date(b).getTime() - new Date(a).getTime()) / 86400000;
  return d >= 0 ? d : null;
};

/** Uma linha do funil: rótulo, valor, % sobre o topo, barra colorida por fase. */
function FunilLinha({
  label,
  value,
  max,
  tone = "lia",
}: {
  label: string;
  value: number;
  max: number;
  tone?: "lia" | "corretor";
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  const barColor = tone === "corretor" ? "hsl(152 62% 40%)" : "hsl(var(--primary))";
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold tabular-nums text-foreground">
          {value} <span className="text-xs font-normal text-muted-foreground">({pct}%)</span>
        </span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: barColor }}
        />
      </div>
    </div>
  );
}

function FaseLabel({ tone, children }: { tone: "lia" | "corretor"; children: ReactNode }) {
  const color = tone === "corretor" ? "hsl(152 62% 40%)" : "hsl(var(--primary))";
  return (
    <div
      className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider"
      style={{ color }}
    >
      <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />
      {children}
    </div>
  );
}

export default function LiaTransitoTab() {
  const { data: estadosRaw, isLoading } = useLiaEstados();
  const { data: pipeRaw, isLoading: loadingPipe } = useLiaPipelineLeads();
  const { data: conv } = useLiaConversao();

  const [produto, setProduto] = useState("todos");
  const [periodo, setPeriodo] = useState<"hoje" | "semana" | "30d" | "tudo">("30d");
  const produtos = useMemo(() => produtosDeEstados(estadosRaw), [estadosRaw]);

  const desde = useMemo(() => {
    const now = Date.now();
    if (periodo === "hoje") return now - 1 * 86400000;
    if (periodo === "semana") return now - 7 * 86400000;
    if (periodo === "30d") return now - 30 * 86400000;
    return 0;
  }, [periodo]);

  // recorte: por imóvel + por período (data de entrada do lead na LIA)
  const estados = useMemo(
    () =>
      (estadosRaw ?? []).filter((e) => {
        if (produto !== "todos" && (e.produto_slug ?? "") !== produto) return false;
        const dt = e.created_at ?? e.last_msg_em;
        if (desde && dt && new Date(dt).getTime() < desde) return false;
        return true;
      }),
    [estadosRaw, produto, desde],
  );
  const idsDoFiltro = useMemo(
    () => new Set((estados ?? []).map((e) => e.lead_id).filter(Boolean) as string[]),
    [estados],
  );
  // fase corretor: só leads VIVOS (não arquivados) do recorte
  const leads = useMemo(
    () => (pipeRaw?.leads ?? []).filter((l: any) => !l.arquivado && idsDoFiltro.has(l.id)),
    [pipeRaw, idsDoFiltro],
  );
  const stages = pipeRaw?.stages;
  const corretores = pipeRaw?.corretores;
  const visMap = conv?.visitas;
  const negMap = conv?.negocios;

  const stageDe = (l: any) => (l.stage_id && stages ? stages.get(l.stage_id) : undefined);
  const andou = (l: any) => (stageDe(l)?.ordem ?? 0) > 1;
  // Verdade da agenda e da mesa (não o estágio): visita e venda vêm de visitas_unicas / negocios.
  const vis = (l: any) => visMap?.get(l.id);
  const neg = (l: any) => negMap?.get(l.id);
  const visitaRealizada = (l: any) => !!vis(l)?.realizada;
  const vendeu = (l: any) => !!neg(l)?.ganho;

  // ── Funil de vida inteira ──
  const funil = useMemo(() => {
    const list: LiaEstado[] = estados ?? [];
    const falaram = list.length;
    const responderam = list.filter((e) => !!e.last_user_at).length;
    const engajaram = list.filter((e) => e.status === "em_conversa" || e.status === "qualificado").length;
    const qualificados = list.filter((e) => e.status === "qualificado").length;
    // Passou o bastão = leads que a LIA levou pro pipeline (lead criado). Todo qualificado gera lead,
    // então é ~= qualificados; usar repassado_em subcontava (só o fluxo novo preenche esse campo).
    const repassados = list.filter((e) => !!e.lead_id).length;

    const comCorretor = leads.filter((l: any) => l.corretor_id);
    const aceitos = comCorretor.filter((l: any) => l.aceite_status === "aceito").length;
    const andaram = comCorretor.filter((l: any) => l.aceite_status === "aceito" && andou(l)).length;
    // camada fina: verdade da agenda + da mesa de negócios
    const agendou = leads.filter((l: any) => vis(l)?.agendada).length;
    const realizou = leads.filter((l: any) => vis(l)?.realizada).length;
    const noShow = leads.filter((l: any) => vis(l)?.noShow).length;
    const negocioAberto = leads.filter((l: any) => neg(l)?.aberto).length;
    const vendas = leads.filter((l: any) => neg(l)?.ganho).length;

    return { falaram, responderam, engajaram, qualificados, repassados, aceitos, andaram, agendou, realizou, noShow, negocioAberto, vendas };
  }, [estados, leads, stages, visMap, negMap]);

  // ── Tempos médios entre as mãos (mediana em dias) ──
  const tempos = useMemo(() => {
    const leadById = new Map<string, any>((leads as any[]).map((l) => [l.id, l]));
    const tHandoff: number[] = []; // LIA falou → passou o bastão
    const tVisita: number[] = []; // bastão → visita realizada
    const tVenda: number[] = []; // visita realizada → venda (assinatura)
    for (const e of estados ?? []) {
      if (!e.lead_id) continue;
      const l = leadById.get(e.lead_id);
      if (!l) continue;
      const bastaoEm = e.repassado_em ?? l.created_at;
      const dH = diasEntre(e.created_at, bastaoEm);
      if (dH != null) tHandoff.push(dH);
      const v = visMap?.get(l.id);
      if (v?.realizada && v.primeiraData) {
        const dV = diasEntre(bastaoEm, v.primeiraData);
        if (dV != null) tVisita.push(dV);
        const n = negMap?.get(l.id);
        if (n?.ganho && n.assinaturaEm) {
          const dVd = diasEntre(v.primeiraData, n.assinaturaEm);
          if (dVd != null) tVenda.push(dVd);
        }
      }
    }
    return {
      handoff: { med: mediana(tHandoff), n: tHandoff.length },
      visita: { med: mediana(tVisita), n: tVisita.length },
      venda: { med: mediana(tVenda), n: tVenda.length },
    };
  }, [estados, leads, visMap, negMap]);

  // ── Por corretor ──
  const porCorretor = useMemo(() => {
    const map = new Map<string, { recebidos: number; aceitos: number; andaram: number; visitas: number; vendas: number; parados: number }>();
    const agora = Date.now();
    for (const l of leads as any[]) {
      if (!l.corretor_id) continue;
      const k = l.corretor_id as string;
      const cur = map.get(k) ?? { recebidos: 0, aceitos: 0, andaram: 0, visitas: 0, vendas: 0, parados: 0 };
      cur.recebidos++;
      if (l.aceite_status === "aceito") cur.aceitos++;
      if (l.aceite_status === "aceito" && andou(l)) cur.andaram++;
      if (visitaRealizada(l)) cur.visitas++;
      if (vendeu(l)) cur.vendas++;
      const idade = l.created_at ? (agora - new Date(l.created_at).getTime()) / 86400000 : 0;
      if (!andou(l) && idade > 3) cur.parados++;
      map.set(k, cur);
    }
    return Array.from(map.entries())
      .map(([id, v]) => ({ nome: corretores?.get(id) ?? "(sem nome)", ...v }))
      .sort((a, b) => b.recebidos - a.recebidos);
  }, [leads, corretores, stages, visMap, negMap]);

  // ── Parados (lista de cobrança) ──
  const parados = useMemo(() => {
    const agora = Date.now();
    return (leads as any[])
      .filter((l) => l.corretor_id && !andou(l))
      .map((l) => ({
        nome: l.nome || "Lead",
        corretor: corretores?.get(l.corretor_id) ?? "—",
        dias: l.created_at ? Math.floor((agora - new Date(l.created_at).getTime()) / 86400000) : 0,
        aceito: l.aceite_status === "aceito",
      }))
      .filter((l) => l.dias > 3)
      .sort((a, b) => b.dias - a.dias)
      .slice(0, 20);
  }, [leads, corretores, stages]);

  const carregando = isLoading || loadingPipe;
  const topo = funil.falaram || 1;

  return (
    <div className="space-y-5">
      {/* filtros */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="inline-flex rounded-lg border border-border bg-card p-0.5">
          {([
            ["hoje", "Hoje"],
            ["semana", "Semana"],
            ["30d", "30 dias"],
            ["tudo", "Tudo"],
          ] as const).map(([v, label]) => (
            <button
              key={v}
              type="button"
              onClick={() => setPeriodo(v)}
              className={`rounded-md px-3 py-1 text-xs font-semibold transition ${
                periodo === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <FiltroImovel produtos={produtos} valor={produto} onChange={setProduto} />
        <span className="ml-auto text-xs text-muted-foreground">{funil.falaram} leads no recorte</span>
      </div>

      {/* FUNIL DE VIDA INTEIRA */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Funil de vida inteira do lead</CardTitle>
          <CardDescription>
            Do primeiro oi à venda. % sempre sobre quem falou com a LIA. É aqui que você vê se trava na LIA ou no corretor.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {carregando ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <>
              <FaseLabel tone="lia">Fase LIA · pré-atendimento</FaseLabel>
              <div className="space-y-3">
                <FunilLinha label="Falaram com a LIA" value={funil.falaram} max={topo} />
                <FunilLinha label="Responderam" value={funil.responderam} max={topo} />
                <FunilLinha label="Engajaram" value={funil.engajaram} max={topo} />
                <FunilLinha label="Qualificados" value={funil.qualificados} max={topo} />
                <FunilLinha label="Passou o bastão" value={funil.repassados} max={topo} />
              </div>

              <div className="flex items-center gap-3 py-1">
                <div className="h-px flex-1 border-t border-dashed border-border" />
                <span className="flex items-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-muted/40 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <Handshake className="h-3.5 w-3.5" /> Handoff · {funil.repassados} foram pro corretor
                </span>
                <div className="h-px flex-1 border-t border-dashed border-border" />
              </div>

              <FaseLabel tone="corretor">Fase corretor · pós-handoff</FaseLabel>
              <div className="space-y-3">
                <FunilLinha label="Corretor aceitou" value={funil.aceitos} max={topo} tone="corretor" />
                <FunilLinha label="Andou no pipeline" value={funil.andaram} max={topo} tone="corretor" />
                <FunilLinha label="Visita agendada" value={funil.agendou} max={topo} tone="corretor" />
                <FunilLinha label="Visita realizada" value={funil.realizou} max={topo} tone="corretor" />
                <FunilLinha label="Em negociação" value={funil.negocioAberto} max={topo} tone="corretor" />
                <FunilLinha label="Venda (ganho)" value={funil.vendas} max={topo} tone="corretor" />
              </div>

              {funil.aceitos - funil.andaram > 0 && (
                <div className="mt-2 flex items-start gap-2.5 rounded-lg border border-amber-300/60 bg-amber-50 p-3 text-[13px] text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-200">
                  <AlertTriangle className="mt-0.5 h-4 w-4 flex-none text-amber-600" />
                  <p>
                    <strong>{funil.aceitos - funil.andaram} leads aceitos que não andaram.</strong> A LIA entrega {funil.qualificados} qualificados, mas só {funil.andaram} avançaram no pipeline. O gargalo está entre "aceitou" e "andou", no corretor.
                  </p>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* CAMADA FINA · agenda + mesa de negócios */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarCheck className="h-4 w-4 text-primary" /> Visita e negócio de verdade
          </CardTitle>
          <CardDescription>
            Da agenda e da mesa de negócios, não do estágio do pipeline. É o que separa "marcou" de "apareceu".
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {carregando ? (
            <Skeleton className="h-28 w-full" />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                {[
                  { rot: "Agendou visita", val: funil.agendou, sub: "marcou na agenda" },
                  { rot: "Realizou", val: funil.realizou, sub: "cliente compareceu" },
                  { rot: "No-show", val: funil.noShow, sub: "marcou e não veio", alerta: funil.noShow > 0 },
                  { rot: "Em negociação", val: funil.negocioAberto, sub: "abriu negócio" },
                  { rot: "Venda", val: funil.vendas, sub: "negócio ganho", ok: funil.vendas > 0 },
                ].map((t) => (
                  <div key={t.rot} className="rounded-lg border border-border bg-card p-3">
                    <div className={`text-2xl font-bold tabular-nums ${t.alerta ? "text-red-600" : t.ok ? "text-emerald-600" : "text-foreground"}`}>
                      {t.val}
                    </div>
                    <div className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t.rot}</div>
                    <div className="text-[11px] text-muted-foreground">{t.sub}</div>
                  </div>
                ))}
              </div>

              {funil.agendou > 0 && (
                <p className="text-[13px] text-muted-foreground">
                  Comparecimento:{" "}
                  <strong className="text-foreground">
                    {Math.round((funil.realizou / funil.agendou) * 100)}%
                  </strong>{" "}
                  das visitas agendadas de leads da LIA foram realizadas
                  {funil.noShow > 0 ? ` · ${funil.noShow} no-show` : ""}.
                </p>
              )}

              {/* TEMPOS entre as mãos */}
              <div>
                <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" /> Tempo entre as mãos (mediana)
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {[
                    { rot: "LIA → passou o bastão", t: tempos.handoff },
                    { rot: "Bastão → visita realizada", t: tempos.visita },
                    { rot: "Visita → venda", t: tempos.venda },
                  ].map((x) => (
                    <div key={x.rot} className="rounded-lg border border-border bg-muted/30 p-3">
                      <div className="text-[11px] text-muted-foreground">{x.rot}</div>
                      {x.t.n < 2 ? (
                        <div className="mt-0.5 text-sm font-medium text-muted-foreground">coletando ({x.t.n})</div>
                      ) : (
                        <div className="mt-0.5 text-lg font-bold tabular-nums text-foreground">
                          {x.t.med} <span className="text-xs font-normal text-muted-foreground">dias · n={x.t.n}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* POR CORRETOR */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">O lead da LIA por corretor</CardTitle>
          <CardDescription>quem faz o lead andar, e quem só aceita e engaveta</CardDescription>
        </CardHeader>
        <CardContent>
          {carregando ? (
            <Skeleton className="h-48 w-full" />
          ) : porCorretor.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Nenhum lead da LIA com corretor nesse recorte.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm tabular-nums">
                <thead>
                  <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="py-2.5 pr-3 text-left font-semibold">Corretor</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Recebidos</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Aceitou</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Andou</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Visita</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Venda</th>
                    <th className="py-2.5 pl-3 text-right font-semibold">Parados +3d</th>
                  </tr>
                </thead>
                <tbody>
                  {porCorretor.map((c) => (
                    <tr key={c.nome} className="border-b border-border/50 hover:bg-primary/5">
                      <td className="py-2.5 pr-3 text-left font-semibold text-foreground">{c.nome}</td>
                      <td className="px-3 py-2.5 text-right">{c.recebidos}</td>
                      <td className="px-3 py-2.5 text-right">{c.aceitos}</td>
                      <td className={`px-3 py-2.5 text-right font-semibold ${c.aceitos > 0 && c.andaram === 0 ? "text-red-600" : c.andaram === c.recebidos ? "text-emerald-600" : ""}`}>{c.andaram}</td>
                      <td className="px-3 py-2.5 text-right text-muted-foreground">{c.visitas || "—"}</td>
                      <td className="px-3 py-2.5 text-right text-muted-foreground">{c.vendas || "—"}</td>
                      <td className="py-2.5 pl-3 text-right">
                        {c.parados > 0 ? (
                          <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-xs font-bold text-red-600 dark:bg-red-950/40">{c.parados}</span>
                        ) : (
                          "0"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-500" /> andou = todos avançaram</span>
            <span className="flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded-sm bg-red-500" /> andou 0 = aceitou e não tocou</span>
          </div>
        </CardContent>
      </Card>

      {/* PARADOS */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Parados no corretor · lista de cobrança</CardTitle>
          <CardDescription>lead da LIA repassado, sem avançar no pipeline há +3 dias</CardDescription>
        </CardHeader>
        <CardContent>
          {carregando ? (
            <Skeleton className="h-24 w-full" />
          ) : parados.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">Nenhum lead da LIA parado no corretor. 🎉</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pr-3 text-left font-semibold">Lead</th>
                    <th className="px-3 py-2 text-left font-semibold">Corretor</th>
                    <th className="px-3 py-2 text-left font-semibold">Situação</th>
                    <th className="py-2 pl-3 text-right font-semibold">Parado há</th>
                  </tr>
                </thead>
                <tbody>
                  {parados.map((p, i) => (
                    <tr key={i} className="border-b border-border/50">
                      <td className="py-2 pr-3 text-left font-medium text-foreground">{p.nome}</td>
                      <td className="px-3 py-2 text-left text-muted-foreground">{p.corretor}</td>
                      <td className="px-3 py-2 text-left text-muted-foreground">{p.aceito ? "aceitou, não avançou" : "aguardando aceite"}</td>
                      <td className="py-2 pl-3 text-right">
                        <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-xs font-bold text-red-600 dark:bg-red-950/40">{p.dias} dias</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs leading-relaxed text-muted-foreground">
        Visita e venda agora saem da verdade: <code>visitas_unicas</code> (agendada × realizada × no-show) e <code>negocios</code> (em negociação × ganho), não do estágio do pipeline. "Andou" ainda usa o estágio. Os tempos entre as mãos aparecem quando há dado suficiente (n≥2). Filtro por período e imóvel recalcula tudo.
      </p>
    </div>
  );
}
