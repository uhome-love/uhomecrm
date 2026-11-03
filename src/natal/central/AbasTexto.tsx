import { todayBRT } from "@/lib/brtTime";
import { CAMPANHA, EMPREENDIMENTOS, FOLLOWUPS, PREMIOS, REGRAS, SCRIPTS, SEMANAS, URNA } from "./conteudo";
import { BotoesTexto, TextoMarcado } from "./Pecas";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { baixarMaterial, type Material } from "./useMateriais";

const fmt = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
const bate = (busca: string, ...t: string[]) => !busca || t.join(" ").toLowerCase().includes(busca.toLowerCase());

export function AbaVisaoGeral() {
  const hoje = todayBRT();
  return (
    <div className="space-y-6">
      <div className="natal-card p-4"><p className="text-sm font-semibold">{CAMPANHA.missao.texto}</p></div>
      <section>
        <h3 className="mb-2 font-bold">A conta: {CAMPANHA.conta.frase}</h3>
        <div className="grid gap-3 md:grid-cols-3">
          {CAMPANHA.conta.caminhos.map((c) => (
            <div key={c.titulo} className="natal-card p-4"><p className="font-semibold">{c.titulo}</p><p className="text-sm">{c.visitas}</p><p className="mt-1 text-xs text-muted-foreground">{c.exemplos}</p></div>
          ))}
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{CAMPANHA.conta.rotina}</p>
      </section>
      <section>
        <h3 className="mb-2 font-bold">Prêmios</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {PREMIOS.map((p) => (
            <div key={p.titulo} className="natal-card p-4"><p className="text-[11px] font-bold uppercase text-muted-foreground">{p.quem}</p><p className="font-semibold">{p.titulo}</p><p className="mt-1 text-xs">{p.texto}</p></div>
          ))}
        </div>
      </section>
      <section>
        <h3 className="mb-2 font-bold">Regras</h3>
        <ol className="natal-card list-decimal space-y-2 p-4 pl-8 text-sm">
          {REGRAS.map((r) => <li key={r.titulo}><b>{r.titulo}</b> {r.texto}</li>)}
        </ol>
      </section>
      <section>
        <h3 className="mb-2 font-bold">Urna Premiada · {URNA.reduce((s, n) => s + n.cartoes, 0)} cartões</h3>
        <div className="grid gap-3 md:grid-cols-3">
          {URNA.map((n) => (
            <div key={n.nivel} className="natal-card p-4">
              <p className="font-semibold">{"⭐".repeat(n.estrelas)} {n.nivel} · {n.cartoes} cartões</p>
              <p className="text-xs text-muted-foreground">{n.faixa}</p>
              <ul className="mt-2 space-y-1 text-sm">{n.itens.map((i) => <li key={i.nome}>{i.qtd}× {i.nome}</li>)}</ul>
            </div>
          ))}
        </div>
      </section>
      <section>
        <h3 className="mb-2 font-bold">Semanas do prêmio surpresa</h3>
        <div className="flex flex-wrap gap-2">
          {SEMANAS.map((s) => {
            const atual = hoje >= s.inicio && hoje <= s.fim;
            return <span key={s.semana} className={`rounded-full border px-3 py-1 text-sm ${atual ? "natal-chip-ouro font-bold" : "bg-card"}`}>{s.semana} · {fmt(s.inicio)} a {fmt(s.fim)}</span>;
          })}
        </div>
      </section>
    </div>
  );
}

export function AbaEmpreendimentos({ busca, porChave, urls }: { busca: string; porChave: Record<string, Material>; urls: Record<string, string> }) {
  const lista = EMPREENDIMENTOS.filter((e) => bate(busca, e.nome, e.incorporadora, e.local, e.gancho));
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {lista.map((e) => {
        const foto = porChave[e.arquivos.foto]; const card = porChave[e.arquivos.card]; const disp = porChave[e.arquivos.disparo];
        return (
          <div key={e.nome} className="natal-card flex flex-col overflow-hidden">
            {foto && urls[foto.arquivo_path]
              ? <img src={urls[foto.arquivo_path]} alt={e.nome} loading="lazy" className="aspect-[4/3] w-full object-cover" />
              : foto ? <Skeleton className="aspect-[4/3] w-full" /> : <div className="aspect-[4/3] w-full bg-muted" />}
            <div className="flex flex-1 flex-col gap-2 p-3">
              <p className="text-[11px] text-muted-foreground">{[e.incorporadora, e.local].filter(Boolean).join(" · ")}</p>
              <p className="font-bold">{e.nome}</p>
              <p className="text-sm">a partir de <b>{e.aPartirDe}</b></p>
              <ul className="text-xs text-muted-foreground">{e.linhas.map((l) => <li key={l.tipo}>{l.tipo}: {l.valor}</li>)}</ul>
              <div className="flex flex-wrap gap-1">{e.selos.map((s) => <span key={s.texto} className="rounded-md bg-destructive/10 px-1.5 py-0.5 text-[11px] text-destructive">{s.texto}</span>)}</div>
              <div className="rounded-lg bg-muted/50 p-2"><p className="text-[11px] font-bold">Gancho pronto</p><TextoMarcado texto={e.gancho} /></div>
              <div className="mt-auto space-y-2">
                <BotoesTexto texto={e.gancho} />
                <div className="grid grid-cols-2 gap-2">
                  <Button size="sm" variant="outline" disabled={!card} onClick={() => card && baixarMaterial(card)}>Card</Button>
                  <Button size="sm" variant="outline" disabled={!disp} onClick={() => disp && baixarMaterial(disp)}>Disparo</Button>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function AbaScripts({ busca }: { busca: string }) {
  const lista = SCRIPTS.filter((s) => bate(busca, s.titulo, s.quando, s.texto));
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {lista.map((s) => (
        <div key={s.titulo} className="natal-card space-y-2 p-4">
          <p className="font-bold">{s.titulo}</p>
          <p className="text-xs text-muted-foreground">{s.quando}</p>
          <div className="rounded-lg bg-muted/50 p-3"><TextoMarcado texto={s.texto} /></div>
          {"dica" in s && s.dica && <p className="text-xs text-muted-foreground">💡 {s.dica}</p>}
          <BotoesTexto texto={s.texto} rotuloWhats="Abrir no WhatsApp" />
        </div>
      ))}
    </div>
  );
}

export function AbaFollowups({ busca }: { busca: string }) {
  const grupos = FOLLOWUPS.map((g) => ({ ...g, mensagens: g.mensagens.filter((m) => bate(busca, g.situacao, m.texto, m.quando)) })).filter((g) => g.mensagens.length);
  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold">Siga a ordem e pare assim que o cliente responder: aí volte para os scripts.</p>
      <div className="grid gap-3 lg:grid-cols-2">
        {grupos.map((g) => (
          <div key={g.situacao} className="natal-card space-y-3 p-4">
            <p className="font-bold">{g.situacao}</p>
            {g.mensagens.map((m, i) => (
              <div key={i} className="space-y-2 border-t pt-3">
                <p className="text-xs font-semibold text-muted-foreground">{i + 1}. {m.quando}</p>
                <TextoMarcado texto={m.texto} />
                <BotoesTexto texto={m.texto} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
