import { Eye, Search, MessageCircle, FileText, Heart, History, Flame, Globe } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { formatBRT } from "@/lib/brtTime";
import { ptBR } from "date-fns/locale";
import { type EventoSite, resumirAtividadeSite, descreverEvento } from "./useAtividadeSite";

const ICONES: Record<string, typeof Eye> = {
  visitou_imovel: Eye, buscou_ia: Search, clicou_contato: MessageCircle,
  formulario_enviado: FileText, favoritou_imovel: Heart, historico_site: History,
};

export default function AtividadeSite({ eventos }: { eventos: EventoSite[] }) {
  const r = resumirAtividadeSite(eventos);
  const linha = eventos.filter((e) => e.tipo !== "historico_site");
  return (
    <div className="mx-auto w-full max-w-[720px] px-4 md:px-7 py-4 space-y-4">
      <section className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Globe className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Resumo no site</h3>
          {r.esquentando && (
            <Badge className="gap-1 bg-warning/15 text-warning border-warning/30 hover:bg-warning/15" variant="outline">
              <Flame className="h-3 w-3" /> Esquentando
            </Badge>
          )}
          {r.ultimaVisita && (
            <span className="ml-auto text-xs text-muted-foreground">
              Última visita {formatDistanceToNow(new Date(r.ultimaVisita), { addSuffix: true, locale: ptBR })}
            </span>
          )}
        </div>
        {r.esquentando && <p className="text-xs text-muted-foreground">Por quê: {r.motivos.join(", ")}.</p>}
        {r.resumoTexto && <p className="text-sm text-foreground/90 break-words">{r.resumoTexto}</p>}
        <div className="grid gap-3 sm:grid-cols-3">
          <Bloco titulo="Imóveis mais vistos" vazio="Nenhum ainda">
            {r.imoveis.map((i) => (
              <li key={i.nome} className="flex justify-between gap-2 min-w-0">
                <span className="truncate">{i.nome}</span>
                <span className="shrink-0 text-muted-foreground">{i.vezes}x</span>
              </li>
            ))}
          </Bloco>
          <Bloco titulo="Bairros" vazio="—">
            {r.bairros.map((b) => <li key={b} className="truncate">{b}</li>)}
          </Bloco>
          <Bloco titulo="Buscas" vazio="—">
            {r.buscas.map((b) => <li key={b} className="truncate">“{b}”</li>)}
          </Bloco>
        </div>
      </section>

      <section className="space-y-1">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground px-1">Linha do tempo no site</h3>
        <ol className="relative border-l border-border ml-3">
          {linha.map((e) => {
            const Ic = ICONES[e.tipo] ?? Globe;
            const { titulo, detalhe } = descreverEvento(e);
            return (
              <li key={e.id} className="ml-4 py-2 min-w-0">
                <span className="absolute -left-[11px] mt-0.5 flex h-[22px] w-[22px] items-center justify-center rounded-full border border-border bg-background">
                  <Ic className="h-3 w-3 text-primary" />
                </span>
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-sm font-medium">{titulo}</span>
                  <span className="text-xs text-muted-foreground">{formatBRT(e.created_at, "dd/MM HH:mm")}</span>
                </div>
                {detalhe && <p className="text-xs text-muted-foreground break-words">{detalhe}</p>}
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}

function Bloco({ titulo, vazio, children }: { titulo: string; vazio: string; children: React.ReactNode[] }) {
  return (
    <div className="min-w-0 rounded-lg bg-muted/40 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">{titulo}</p>
      {children.length ? <ul className="space-y-1 text-sm">{children}</ul> : <p className="text-sm text-muted-foreground">{vazio}</p>}
    </div>
  );
}
