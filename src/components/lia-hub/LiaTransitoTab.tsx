import { useMemo, useState, type ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Handshake } from "lucide-react";
import FiltroImovel from "./FiltroImovel";
import {
  useLiaEstados,
  useLiaPipelineLeads,
  produtosDeEstados,
  type LiaEstado,
} from "./useLiaHub";

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

  const stageDe = (l: any) => (l.stage_id && stages ? stages.get(l.stage_id) : undefined);
  const andou = (l: any) => (stageDe(l)?.ordem ?? 0) > 1;
  const chegouVisita = (l: any) => {
    const s = stageDe(l);
    return !!s && s.ordem >= 4 && s.ordem <= 9;
  };
  const vendeu = (l: any) => stageDe(l)?.tipo === "venda";

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
    const visitas = comCorretor.filter((l: any) => chegouVisita(l)).length;
    const vendas = comCorretor.filter((l: any) => vendeu(l)).length;

    return { falaram, responderam, engajaram, qualificados, repassados, aceitos, andaram, visitas, vendas };
  }, [estados, leads, stages]);

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
      if (chegouVisita(l)) cur.visitas++;
      if (vendeu(l)) cur.vendas++;
      const idade = l.created_at ? (agora - new Date(l.created_at).getTime()) / 86400000 : 0;
      if (!andou(l) && idade > 3) cur.parados++;
      map.set(k, cur);
    }
    return Array.from(map.entries())
      .map(([id, v]) => ({ nome: corretores?.get(id) ?? "(sem nome)", ...v }))
      .sort((a, b) => b.recebidos - a.recebidos);
  }, [leads, corretores, stages]);

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
                <FunilLinha label="Chegou na visita" value={funil.visitas} max={topo} tone="corretor" />
                <FunilLinha label="Venda" value={funil.vendas} max={topo} tone="corretor" />
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
        Visita e venda saem da etapa atual do lead no pipeline. A camada fina (visita agendada × realizada, negócio, e os tempos entre etapas) entra cruzando <code>visitas_unicas</code> e <code>negocios</code> na próxima passada. Filtro por imóvel recalcula tudo.
      </p>
    </div>
  );
}
