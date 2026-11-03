import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { agruparPorEquipe, consolidarPorCorretor, fetchMetricas, somarMetricas } from "@/lib/metricasSSOT";
import { todayBRT } from "@/lib/brtTime";
import { CAMPANHA_FIM, CAMPANHA_INICIO, diasAte18, isNatal } from "./config";
import { brlCurto, META_EQUIPE, META_UHOME, META_VGV_MINIMA, segundaDaSemana } from "./missao";
import { BarraOuro } from "./MissaoNatalCard";
import "./natal.css";

function useMissaoNatalEmpresa(ativo: boolean) {
  return useQuery({
    queryKey: ["natal-missao-empresa"],
    enabled: ativo,
    staleTime: 120_000,
    refetchInterval: 120_000,
    queryFn: async () => {
      const hoje = todayBRT();
      const end = hoje > CAMPANHA_FIM ? CAMPANHA_FIM : hoje;
      const [camp, ano, semana, neg, metas] = await Promise.all([
        fetchMetricas({ start: CAMPANHA_INICIO, end }),
        fetchMetricas({ start: "2026-01-01", end: hoje }),
        fetchMetricas({ start: segundaDaSemana(hoje), end: hoje }),
        supabase.from("negocios").select("id", { count: "exact", head: true })
          .gte("created_at", `${CAMPANHA_INICIO}T00:00:00-03:00`).lte("created_at", `${end}T23:59:59-03:00`),
        supabase.from("campanha_natal_metas").select("user_id, meta_vgv"),
      ]);
      const ativos = consolidarPorCorretor(camp).filter((c) => c.corretor_ativo);
      const metaMap = new Map<string, number>((metas.data ?? []).map((m) => [m.user_id, Number(m.meta_vgv)]));
      const definiram = ativos.filter((c) => metaMap.has(c.corretor_auth_id)).length;
      const somaMetas = ativos.reduce((s, c) => s + (metaMap.get(c.corretor_auth_id) ?? META_VGV_MINIMA), 0);
      return {
        hoje,
        totais: somarMetricas(camp),
        anoVgv: somarMetricas(ano).vgv_assinado,
        equipes: agruparPorEquipe(camp).filter((e) => e.equipe !== "Sem equipe"),
        top3: consolidarPorCorretor(semana).filter((c) => c.visitas_realizadas > 0)
          .sort((a, b) => b.visitas_realizadas - a.visitas_realizadas).slice(0, 3),
        negocios: neg.count ?? 0,
        definiram, total: ativos.length, somaMetas,
      };
    },
  });
}

const primeiroNome = (n: string | null) => {
  const p = (n ?? "").trim().split(/\s+/);
  return p.length > 1 ? `${p[0]} ${p[p.length - 1][0]}.` : p[0] || "—";
};

/** Quadro só de leitura: resumo da empresa na campanha de Natal (CEO/diretora). */
export function MissaoNatalEmpresa() {
  const ativo = isNatal();
  const { data } = useMissaoNatalEmpresa(ativo);
  if (!ativo || !data) return null;
  const t = data.totais;
  const numeros: [string, string | number][] = [
    ["Leads recebidos", t.leads_recebidos], ["Visitas agendadas", t.visitas_agendadas], ["Visitas realizadas", t.visitas_realizadas],
    ["Negócios", data.negocios], ["Vendas", t.vendas.toLocaleString("pt-BR", { maximumFractionDigits: 1 })], ["VGV assinado", brlCurto(t.vgv_assinado)],
  ];
  const medalha = ["🥇", "🥈", "🥉"];

  return (
    <section className="natal-borda-ouro relative overflow-hidden rounded-2xl border bg-card p-4 md:p-5">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <img src="/natal/chave_de_ouro_com_laco.svg" alt="" aria-hidden className="h-10 w-10" />
          <div>
            <h2 className="text-base font-bold text-foreground">Missão de Natal · Uhome</h2>
            <p className="text-xs text-muted-foreground">Campanha de 02/11 a 18/12 · resumo da empresa</p>
          </div>
        </div>
        {data.hoje <= CAMPANHA_FIM && <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold">🎄 Faltam {diasAte18(data.hoje)} dias</span>}
      </header>

      <div className="mt-4 grid gap-3 lg:grid-cols-[1.1fr_1.6fr]">
        <div className="natal-noite rounded-xl p-4">
          <p className="text-xs font-semibold uppercase opacity-70">Missão 100 milhões · VGV 2026</p>
          <p className="mt-1 text-3xl font-extrabold">{brlCurto(data.anoVgv)}</p>
          <p className="text-xs opacity-70">de R$ 100 mi · faltam {brlCurto(Math.max(0, META_UHOME - data.anoVgv))}</p>
          <div className="mt-4"><BarraOuro pct={(data.anoVgv / META_UHOME) * 100} chave /></div>
          <p className="mt-3 text-xs"><b>{Math.floor((data.anoVgv / META_UHOME) * 100)}%</b> da missão</p>
        </div>
        <div className="rounded-xl bg-muted/40 p-4">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Corrida das equipes · meta R$ 10 mi</p>
          <div className="mt-3 space-y-3">
            {data.equipes.map((e, i) => (
              <div key={e.equipe}>
                <div className="mb-1 flex justify-between text-sm"><span>{medalha[i] ?? `${i + 1}º`} {e.equipe}</span><b>{brlCurto(e.totais.vgv_assinado)}</b></div>
                <BarraOuro pct={(e.totais.vgv_assinado / META_EQUIPE) * 100} fina />
              </div>
            ))}
            {data.equipes.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma venda na campanha ainda.</p>}
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">Equipe que fizer R$ 10 mi: gerente ganha 2 diárias no Rosa com acompanhante.</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 md:grid-cols-6">
        {numeros.map(([rot, v]) => (
          <div key={rot} className="rounded-lg border bg-background p-2 text-center">
            <p className="text-lg font-bold">{v}</p>
            <p className="text-[10.5px] leading-tight text-muted-foreground">{rot}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border p-3">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Metas dos corretores</p>
          <p className="mt-1 text-sm"><b>{data.definiram}</b> de {data.total} já definiram · <b>{data.total - data.definiram}</b> ainda não</p>
          <p className="text-sm">Soma das metas: <b>{brlCurto(data.somaMetas)}</b></p>
          <p className="text-[11px] text-muted-foreground">Quem não definiu conta como R$ 1 mi.</p>
        </div>
        <div className="rounded-xl border p-3">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Destaque da semana · visitas realizadas</p>
          {data.top3.length === 0 ? <p className="mt-1 text-sm text-muted-foreground">Ninguém com visita realizada nesta semana ainda.</p> : (
            <ol className="mt-1 space-y-0.5 text-sm">
              {data.top3.map((c, i) => <li key={c.corretor_auth_id}>{medalha[i]} {primeiroNome(c.corretor_nome)} · <b>{c.visitas_realizadas}</b></li>)}
            </ol>
          )}
        </div>
      </div>
    </section>
  );
}
