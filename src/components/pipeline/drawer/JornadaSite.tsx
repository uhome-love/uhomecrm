// Parte "Jornada no site" dentro do quadro Veio do site: resumo curto + (no Ver mais) origem, interesse e sessões.
import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { ROTULO, detalheEvento, type Jornada, type OrigemJornada } from "@/lib/siteJornada";

const BRT = "America/Sao_Paulo";
const dia = (d: Date) => d.toLocaleDateString("pt-BR", { timeZone: BRT, day: "2-digit", month: "2-digit" });
const hora = (d: Date) => d.toLocaleTimeString("pt-BR", { timeZone: BRT, hour: "2-digit", minute: "2-digit" });

const Rot = ({ children }: { children: React.ReactNode }) => (
  <h3 className="mb-1 mt-3 text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">{children}</h3>
);
function Linha({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 py-1 text-[13px]">
      <span className="w-20 shrink-0 text-muted-foreground">{rotulo}</span>
      <span className="min-w-0 flex-1 break-words text-foreground">{children}</span>
    </div>
  );
}
const Chip = ({ children }: { children: React.ReactNode }) => (
  <span className="mb-1 mr-1 inline-block max-w-full break-words rounded-md bg-muted px-1.5 py-0.5 text-[12px]">{children}</span>
);
function Origem({ o }: { o: OrigemJornada }) {
  return (
    <>
      {[o.fonte, o.campanha, o.data && dia(o.data)].filter(Boolean).join(" · ")}
      {o.anuncio && <span className="ml-1.5 rounded-md bg-primary/10 px-1.5 py-0.5 text-[11px] font-semibold text-primary">Anúncio {o.anuncio}</span>}
    </>
  );
}

export function JornadaResumo({ j }: { j: Jornada }) {
  const volta = j.ultima && j.primeira && j.ultima.fonte !== j.primeira.fonte ? ` → voltou pelo ${j.ultima.fonte}` : "";
  const ped = j.pedidos[0];
  const l2 = [j.visitas ? `${j.visitas} ${j.visitas === 1 ? "visita" : "visitas"}${j.primeiraVisita ? ` desde ${dia(j.primeiraVisita)}` : ""}` : null].filter(Boolean).join("");
  return (
    <>
      <Rot>Jornada no site</Rot>
      <div className="rounded-lg bg-muted/60 px-3 py-2 text-[13px] leading-relaxed text-foreground">
        {j.primeira && <div>{j.primeira.fonte}{volta}</div>}
        <div>{l2}{ped && <>{l2 && " · "}<strong>{ped.tipo === "visita" ? "Pediu visita" : "Pediu informações"} {dia(ped.quando)}</strong></>}</div>
      </div>
    </>
  );
}

export function JornadaDetalhe({ j }: { j: Jornada }) {
  const [abertas, setAbertas] = useState<Set<string>>(() => new Set(j.sessoes[0] ? [j.sessoes[0].id] : []));
  const alternar = (id: string) => setAbertas((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const temInteresse = j.imoveis.length || j.procurou.length || j.favoritos.length || j.pedidos.length;
  return (
    <div className="mt-3 border-t border-border pt-1">
      {(j.primeira || j.ultima) && (
        <>
          <Rot>1. Origem</Rot>
          {j.primeira && <Linha rotulo="Primeira"><Origem o={j.primeira} /></Linha>}
          {j.ultima && <Linha rotulo="Última"><Origem o={j.ultima} /></Linha>}
        </>
      )}
      {temInteresse ? (
        <>
          <Rot>2. Interesse</Rot>
          {j.imoveis.length > 0 && <Linha rotulo="Viu">{j.imoveis.map((i) => <Chip key={i.titulo}>{i.titulo} · {i.vezes}x</Chip>)}</Linha>}
          {j.procurou.length > 0 && <Linha rotulo="Procurou">{j.procurou.map((p) => <Chip key={p}>{p}</Chip>)}</Linha>}
          {j.favoritos.length > 0 && <Linha rotulo="Favoritou">{j.favoritos.join(", ")}</Linha>}
          {j.pedidos.length > 0 && (
            <Linha rotulo="Pedidos">
              {j.pedidos.slice(0, 4).map((p, i) => (
                <div key={i} className={i === 0 ? "font-semibold" : "text-muted-foreground"}>{p.texto} <span className="font-normal text-muted-foreground">({dia(p.quando)})</span></div>
              ))}
            </Linha>
          )}
        </>
      ) : null}
      {j.sessoes.length > 0 && (
        <>
          <Rot>3. Sessões ({j.sessoes.length}) · últimos 90 dias</Rot>
          {j.sessoes.map((s) => {
            const aberta = abertas.has(s.id);
            return (
              <div key={s.id} className="border-t border-border py-1.5">
                <button type="button" onClick={() => alternar(s.id)} aria-expanded={aberta}
                  className="flex min-h-[32px] w-full items-center gap-1 text-left text-[12px] font-semibold text-foreground">
                  {aberta ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                  {dia(s.inicio)} · {hora(s.inicio)}–{hora(s.fim)} · {s.eventos.length} {s.eventos.length === 1 ? "ação" : "ações"}
                </button>
                {aberta && s.eventos.map((e) => {
                  const n = Number(e.dados._n ?? 1);
                  const rot = e.tipo === "pagina_vista" && n > 1 ? `Viu ${n} páginas` : ROTULO[e.tipo] ?? e.tipo.replace(/_/g, " ");
                  const det = e.tipo === "pagina_vista" && n > 1 ? null : detalheEvento(e);
                  const forte = e.tipo === "visita_pedida" || e.tipo === "informacoes_pedidas";
                  return (
                    <div key={e.id} className="flex gap-2 py-0.5 pl-5 text-[12px] text-foreground">
                      <span className="w-10 shrink-0 tabular-nums text-muted-foreground">{hora(e.quando)}</span>
                      <span className="min-w-0 flex-1 break-words">{forte ? <strong>{rot}</strong> : rot}{det && ` · ${det}`}</span>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
