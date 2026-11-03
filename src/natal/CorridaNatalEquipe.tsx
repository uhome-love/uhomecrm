import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { agruparPorEquipe, consolidarPorCorretor, fetchMetricas, somarMetricas } from "@/lib/metricasSSOT";
import { todayBRT } from "@/lib/brtTime";
import { CAMPANHA_FIM, CAMPANHA_INICIO, isNatal } from "./config";
import { brlCurto, META_EQUIPE, META_VGV_MINIMA, META_VISITAS_PADRAO, segundaDaSemana } from "./missao";
import { BarraOuro } from "./MissaoNatalCard";
import { NeveSuave } from "./NeveSuave";
import "./natal.css";

type Status = "No ritmo" | "Atenção" | "Parado";
const statusCor: Record<Status, string> = {
  "No ritmo": "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  "Atenção": "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  "Parado": "bg-destructive/15 text-destructive",
};

const nomeCurto = (n: string | null) => {
  const p = (n ?? "").trim().split(/\s+/);
  return p.length > 1 ? `${p[0]} ${p[p.length - 1][0]}.` : p[0] || "—";
};

function useCorrida(gerenteId?: string) {
  return useQuery({
    queryKey: ["natal-corrida", gerenteId],
    enabled: !!gerenteId,
    staleTime: 120_000,
    refetchInterval: 120_000,
    queryFn: async () => {
      const hoje = todayBRT();
      const end = hoje > CAMPANHA_FIM ? CAMPANHA_FIM : hoje;
      const seg = segundaDaSemana(hoje);
      const [time, timeSem, todos, todosSem, tm, neg] = await Promise.all([
        fetchMetricas({ start: CAMPANHA_INICIO, end, gerenteId }),
        fetchMetricas({ start: seg, end: hoje, gerenteId }),
        fetchMetricas({ start: CAMPANHA_INICIO, end }),
        fetchMetricas({ start: seg, end: hoje }),
        supabase.from("team_members").select("user_id, nome, equipe").eq("gerente_id", gerenteId!).eq("status", "ativo"),
        supabase.from("negocios").select("id", { count: "exact", head: true }).eq("equipe_gerente_auth_id", gerenteId!)
          .gte("created_at", `${CAMPANHA_INICIO}T00:00:00-03:00`).lte("created_at", `${end}T23:59:59-03:00`),
      ]);
      const membros = (tm.data ?? []).filter((m) => m.user_id && m.user_id !== gerenteId);
      const ids = membros.map((m) => m.user_id as string);
      const { data: metas } = ids.length
        ? await supabase.from("campanha_natal_metas").select("user_id, meta_vgv, meta_visitas_semana").in("user_id", ids)
        : { data: [] as { user_id: string; meta_vgv: number; meta_visitas_semana: number }[] };
      const metaMap = new Map((metas ?? []).map((m) => [m.user_id, m]));
      const camp = new Map(consolidarPorCorretor(time).map((c) => [c.corretor_auth_id, c]));
      const sem = new Map(consolidarPorCorretor(timeSem).map((c) => [c.corretor_auth_id, c]));
      const linhas = membros.map((m) => {
        const id = m.user_id as string;
        const meta = metaMap.get(id);
        const metaVgv = meta ? Number(meta.meta_vgv) : META_VGV_MINIMA;
        const metaSem = meta?.meta_visitas_semana ?? META_VISITAS_PADRAO;
        const c = camp.get(id); const s = sem.get(id);
        const vgv = c?.vgv_assinado ?? 0;
        const realizadas = s?.visitas_realizadas ?? 0;
        const status: Status = realizadas >= metaSem ? "No ritmo" : realizadas > 0 ? "Atenção" : "Parado";
        return { id, nome: c?.corretor_nome ?? m.nome, metaVgv, metaSem, definiu: !!meta, vgv, pct: (vgv / metaVgv) * 100, realizadas, agendadas: s?.visitas_agendadas ?? 0, status };
      }).sort((a, b) => b.pct - a.pct);
      const equipeNome = membros[0]?.equipe ?? consolidarPorCorretor(time)[0]?.equipe ?? null;
      const equipes = agruparPorEquipe(todos).filter((e) => e.equipe !== "Sem equipe");
      const lider = consolidarPorCorretor(todosSem).sort((a, b) => b.visitas_realizadas - a.visitas_realizadas)[0];
      return {
        totais: somarMetricas(time), negocios: neg.count ?? 0, linhas, equipeNome,
        outras: equipes.filter((e) => e.equipe !== equipeNome),
        top3: [...linhas].filter((l) => l.realizadas > 0).sort((a, b) => b.realizadas - a.realizadas).slice(0, 3),
        lider: lider && lider.visitas_realizadas > 0 ? { nome: nomeCurto(lider.corretor_nome), n: lider.visitas_realizadas } : null,
      };
    },
  });
}

/** Quadro só de leitura no topo do painel do gerente: a equipe dele na campanha de Natal. */
export function CorridaNatalEquipe({ gerenteId }: { gerenteId?: string }) {
  const ativo = isNatal();
  const { data } = useCorrida(ativo ? gerenteId : undefined);
  if (!ativo || !data) return null;
  const vgv = data.totais.vgv_assinado;
  const t = data.totais;
  const numeros: [string, string | number][] = [
    ["Leads recebidos", t.leads_recebidos], ["Visitas agendadas", t.visitas_agendadas], ["Visitas realizadas", t.visitas_realizadas],
    ["Negócios", data.negocios], ["Vendas", t.vendas.toLocaleString("pt-BR", { maximumFractionDigits: 1 })], ["VGV assinado", brlCurto(vgv)],
  ];
  const parados = data.linhas.filter((l) => l.status === "Parado");
  const abaixo = data.linhas.filter((l) => l.status === "Atenção");
  const semMeta = data.linhas.filter((l) => !l.definiu).length;
  const medalha = ["🥇", "🥈", "🥉"];

  return (
    <section className="space-y-3">
      <div className="natal-noite natal-borda-ouro relative overflow-hidden rounded-2xl p-5">
        <NeveSuave altura={180} flocos={20} />
        <img src="/natal/homi_noel.png" alt="" aria-hidden className="pointer-events-none absolute bottom-0 right-3 hidden h-28 select-none lg:block" />
        <div className="relative grid gap-5 lg:grid-cols-[1.3fr_1fr] lg:pr-28">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider opacity-70">Corrida de Natal · 02/11 a 18/12</p>
            <p className="mt-1 text-sm font-semibold">{data.equipeNome ? `Equipe ${data.equipeNome}` : "Sua equipe"}</p>
            <p className="mt-1 text-3xl font-extrabold" style={{ color: "hsl(var(--natal-gold))" }}>{brlCurto(vgv)}</p>
            <p className="text-xs opacity-70">de R$ 10 mi · faltam {brlCurto(Math.max(0, META_EQUIPE - vgv))}</p>
            <div className="mt-4"><BarraOuro pct={(vgv / META_EQUIPE) * 100} chave /></div>
          </div>
          <div className="space-y-2">
            {data.outras.map((e) => (
              <div key={e.equipe}>
                <div className="mb-1 flex justify-between text-xs"><span>Equipe {e.equipe}</span><b>{brlCurto(e.totais.vgv_assinado)}</b></div>
                <BarraOuro pct={(e.totais.vgv_assinado / META_EQUIPE) * 100} fina />
              </div>
            ))}
            <p className="pt-1 text-[11px] opacity-80">Equipe que fizer R$ 10 mi: gerente ganha 2 diárias no Rosa com acompanhante.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 md:grid-cols-6">
        {numeros.map(([rot, v]) => (
          <div key={rot} className="rounded-lg border bg-card p-2 text-center">
            <p className="text-lg font-bold">{v}</p>
            <p className="text-[10.5px] leading-tight text-muted-foreground">{rot}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-[2fr_1fr]">
        <div className="overflow-x-auto rounded-2xl border bg-card p-4">
          <p className="mb-2 text-sm font-bold">Meu time na missão</p>
          <table className="w-full min-w-[620px] text-sm">
            <thead className="text-left text-[11px] uppercase text-muted-foreground">
              <tr><th className="py-1.5">Corretor</th><th>Meta</th><th>VGV</th><th className="w-32">Progresso</th><th>Visitas sem.</th><th>Agendadas</th><th>Status</th></tr>
            </thead>
            <tbody>
              {data.linhas.map((l) => (
                <tr key={l.id} className="border-t">
                  <td className="py-2 font-medium">{nomeCurto(l.nome)}{!l.definiu && <span className="ml-1 text-[10px] text-muted-foreground">(padrão)</span>}</td>
                  <td>{brlCurto(l.metaVgv)}</td>
                  <td className="font-semibold">{brlCurto(l.vgv)}</td>
                  <td className="pr-3"><BarraOuro pct={l.pct} fina /></td>
                  <td>{l.realizadas}/{l.metaSem}</td>
                  <td>{l.agendadas}</td>
                  <td><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusCor[l.status]}`}>{l.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="space-y-3">
          <div className="rounded-2xl border bg-card p-4">
            <p className="flex items-center gap-2 text-sm font-bold"><img src="/natal/urna_premiada.svg" alt="" className="h-6 w-6" /> Prêmio surpresa da semana</p>
            {data.top3.length === 0 ? <p className="mt-1 text-sm text-muted-foreground">Ninguém do time com visita realizada nesta semana.</p> : (
              <ol className="mt-1 space-y-0.5 text-sm">{data.top3.map((l, i) => <li key={l.id}>{medalha[i]} {nomeCurto(l.nome)} · <b>{l.realizadas}</b></li>)}</ol>
            )}
            {data.lider && <p className="mt-2 text-[11px] text-muted-foreground">Na Uhome toda: {data.lider.nome} lidera com {data.lider.n}.</p>}
          </div>
          <div className="rounded-2xl border bg-card p-4">
            <p className="text-sm font-bold">Atenção hoje</p>
            <ul className="mt-1 space-y-1 text-sm">
              <li>🔴 Parados: {parados.length ? parados.map((l) => nomeCurto(l.nome)).join(", ") : "ninguém"}</li>
              <li>🟡 Abaixo da meta: {abaixo.length ? abaixo.map((l) => nomeCurto(l.nome)).join(", ") : "ninguém"}</li>
              <li>📝 Sem meta definida: {semMeta}</li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
