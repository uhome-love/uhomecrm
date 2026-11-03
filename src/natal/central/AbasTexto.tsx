import { todayBRT } from "@/lib/brtTime";
import { CAMPANHA, EMPREENDIMENTOS, FOLLOWUPS, PREMIOS, REGRAS, SCRIPTS, SEMANAS, URNA } from "./conteudo";
import { BotoesTexto, TextoMarcado } from "./Pecas";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Download } from "lucide-react";
import type React from "react";
import { baixarMaterial, type Material } from "./useMateriais";

const fmt = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
const bate = (busca: string, ...t: string[]) => !busca || t.join(" ").toLowerCase().includes(busca.toLowerCase());

function Secao({ titulo, sub, children }: { titulo: string; sub?: string; children: React.ReactNode }) {
  return <section><h3 className="natal-secao-titulo">{titulo}</h3>{sub ? <p className="natal-secao-sub">{sub}</p> : <div className="mb-3" />}{children}</section>;
}
const CORES_URNA = ["hsl(var(--muted-foreground))", "hsl(43 74% 52%)", "hsl(var(--primary))"];

export function AbaVisaoGeral({ busca = "" }: { busca?: string }) {
  const hoje = todayBRT();
  const premios = PREMIOS.filter((p) => bate(busca, p.quem, p.titulo, p.texto));
  const regras = REGRAS.filter((r) => bate(busca, r.titulo, r.texto));
  return (
    <div className="space-y-8">
      <div className="natal-card natal-card-ouro flex items-start gap-3 p-4"><span className="text-2xl">🔑</span><p className="text-sm font-semibold md:text-base">{CAMPANHA.missao.texto}</p></div>
      <Secao titulo="Sua meta em 3 passos" sub={`A conta: ${CAMPANHA.conta.frase}`}>
        <div className="grid gap-3 md:grid-cols-3">
          {CAMPANHA.conta.caminhos.map((c, i) => (
            <div key={c.titulo} className="natal-card flex gap-3 p-4">
              <span className="natal-num">{i + 1}</span>
              <div><p className="font-semibold">{c.titulo}</p><p className="text-sm">{c.visitas}</p><p className="mt-1 text-xs text-muted-foreground">{c.exemplos}</p></div>
            </div>
          ))}
        </div>
        <p className="mt-3 rounded-xl bg-muted/60 p-3 text-sm">💡 {CAMPANHA.conta.rotina}</p>
      </Secao>
      {premios.length > 0 && (
        <Secao titulo="Prêmios" sub="O que cada um pode ganhar até 18/12.">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {premios.map((p) => (
              <div key={p.titulo} className="natal-card natal-card-ouro p-4">
                <span className="natal-chip-ouro inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase">{p.quem}</span>
                <p className="mt-2 text-base font-bold">🏆 {p.titulo}</p>
                <p className="mt-1 text-sm text-muted-foreground">{p.texto}</p>
              </div>
            ))}
          </div>
        </Secao>
      )}
      {regras.length > 0 && (
        <Secao titulo="Regras">
          <div className="grid gap-3 md:grid-cols-2">
            {regras.map((r, i) => (
              <div key={r.titulo} className="natal-card flex gap-3 p-4"><span className="natal-num">{i + 1}</span><p className="text-sm"><b>{r.titulo}</b> {r.texto}</p></div>
            ))}
          </div>
        </Secao>
      )}
      <Secao titulo={`Urna Premiada · ${URNA.reduce((s, n) => s + n.cartoes, 0)} cartões`} sub="Cliente que assinar tira um cartão da urna.">
        <div className="grid gap-3 md:grid-cols-3">
          {URNA.map((n, i) => (
            <div key={n.nivel} className="natal-card overflow-hidden">
              <div className="natal-urna-faixa" style={{ background: CORES_URNA[i % 3] }} />
              <div className="p-4">
                <p className="font-bold">{"⭐".repeat(n.estrelas)} {n.nivel}</p>
                <p className="text-xs text-muted-foreground">{n.cartoes} cartões · {n.faixa}</p>
                <ul className="mt-3 space-y-1.5 text-sm">{n.itens.map((it) => <li key={it.nome} className="flex justify-between gap-2 border-b border-dashed pb-1 last:border-0"><span>{it.nome}</span><b>{it.qtd}×</b></li>)}</ul>
              </div>
            </div>
          ))}
        </div>
      </Secao>
      <Secao titulo="Semanas do prêmio surpresa" sub="Quem mais realizar visitas na Uhome toda, de segunda a domingo.">
        <div className="flex flex-wrap gap-2">
          {SEMANAS.map((s) => {
            const atual = hoje >= s.inicio && hoje <= s.fim; const passou = hoje > s.fim;
            return <span key={s.semana} className={`rounded-full border px-3 py-1 text-sm ${atual ? "natal-chip-ouro font-bold" : passou ? "bg-muted text-muted-foreground line-through" : "bg-card"}`}>{s.semana} · {fmt(s.inicio)} a {fmt(s.fim)}{atual ? " · agora" : ""}{"destaque" in s && s.destaque ? ` · ${s.destaque}` : ""}</span>;
          })}
        </div>
      </Secao>
    </div>
  );
}

export function AbaEmpreendimentos({ busca, porChave, urls }: { busca: string; porChave: Record<string, Material>; urls: Record<string, string> }) {
  const lista = EMPREENDIMENTOS.filter((e) => bate(busca, e.nome, e.incorporadora, e.local, e.gancho));
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
              <div className="rounded-xl bg-muted/50 p-3"><p className="mb-1 text-[11px] font-bold uppercase text-muted-foreground">Gancho pronto</p><TextoMarcado texto={e.gancho} /></div>
              <div className="mt-auto space-y-2">
                <BotoesTexto texto={e.gancho} />
                <div className="grid grid-cols-2 gap-2">
                  <Button size="sm" variant="outline" disabled={!card} title={card ? "Baixar card" : "O card ainda não foi publicado"} onClick={() => card && baixarMaterial(card)}><Download className="mr-1 h-4 w-4" />Card</Button>
                  <Button size="sm" variant="outline" disabled={!disp} title={disp ? "Baixar disparo" : "O disparo ainda não foi publicado"} onClick={() => disp && baixarMaterial(disp)}><Download className="mr-1 h-4 w-4" />Disparo</Button>
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
