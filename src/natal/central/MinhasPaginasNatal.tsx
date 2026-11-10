import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Copy, ExternalLink, Eye, MessageCircle, RefreshCw } from "lucide-react";
import { campanhaEncerrada, dataBR, formatarPreco, linkWhatsApp, urlSite, type NatalLinksResposta, type NatalProduto } from "./natalLinks";

async function buscar(): Promise<NatalLinksResposta> {
  const { data, error } = await supabase.functions.invoke("natal-links", { body: {} });
  if (error) {
    let msg = "Não foi possível buscar suas páginas agora.";
    const ctx = (error as { context?: Response }).context;
    try { const b = await ctx?.json(); if (b?.error) msg = b.error; } catch { /* ok */ }
    throw new Error(msg);
  }
  return data as NatalLinksResposta;
}

async function copiar(url: string) {
  try { await navigator.clipboard.writeText(url); toast.success("Link copiado!"); }
  catch { toast.error("Não consegui copiar. Segure no link para copiar."); }
}

function EnviarDialog({ alvo, onClose }: { alvo: { titulo: string; url: string; mensagem: string } | null; onClose: () => void }) {
  const [texto, setTexto] = useState("");
  const aberto = !!alvo;
  return (
    <Dialog open={aberto} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent onOpenAutoFocus={() => setTexto(alvo?.mensagem ?? "")}>
        <DialogHeader><DialogTitle>Enviar {alvo?.titulo}</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">Ajuste a mensagem se quiser. O link vai junto.</p>
        <Textarea rows={6} value={texto} onChange={(e) => setTexto(e.target.value)} />
        <Button className="w-full" onClick={() => { if (alvo) window.open(linkWhatsApp(texto, alvo.url), "_blank", "noopener"); onClose(); }}>
          <MessageCircle className="mr-2 h-4 w-4" />Abrir no WhatsApp
        </Button>
      </DialogContent>
    </Dialog>
  );
}

function Botoes({ url, onWhats, onPrevia, compacto }: { url: string; onWhats: () => void; onPrevia?: () => void; compacto?: boolean }) {
  const s = compacto ? "h-8 w-full px-2 text-xs" : "";
  return (
    <div className={compacto ? "grid grid-cols-4 gap-1 sm:grid-cols-2 sm:gap-1.5" : "flex flex-wrap gap-1.5"}>
      <Button size="sm" variant="outline" className={s} onClick={() => copiar(url)}><Copy className="mr-1 h-3.5 w-3.5" /><span className={compacto ? "max-sm:sr-only" : ""}>{compacto ? "Copiar" : "Copiar link"}</span></Button>
      <Button size="sm" className={s} onClick={onWhats}><MessageCircle className="mr-1 h-3.5 w-3.5 max-sm:mr-0" /><span className={compacto ? "max-sm:sr-only" : ""}>WhatsApp</span></Button>
      <Button size="sm" variant="outline" className={s} asChild><a href={url} target="_blank" rel="noopener noreferrer"><ExternalLink className="mr-1 h-3.5 w-3.5" /><span className={compacto ? "max-sm:sr-only" : ""}>Abrir</span></a></Button>
      {onPrevia && <Button size="sm" variant="outline" className={s} onClick={onPrevia}><Eye className="mr-1 h-3.5 w-3.5" /><span className={compacto ? "max-sm:sr-only" : ""}>Prévia</span></Button>}
    </div>
  );
}

export function MinhasPaginasNatal() {
  const q = useQuery({ queryKey: ["natal-links"], queryFn: buscar, staleTime: 5 * 60_000, retry: 1 });
  const [enviar, setEnviar] = useState<{ titulo: string; url: string; mensagem: string } | null>(null);
  const [previa, setPrevia] = useState<NatalProduto | null>(null);

  if (q.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28 w-full rounded-2xl" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-64 rounded-xl" />)}</div>
      </div>
    );
  }
  if (q.isError || !q.data) {
    return (
      <div className="rounded-2xl border bg-card p-8 text-center">
        <p className="font-semibold">{(q.error as Error)?.message ?? "Não foi possível buscar suas páginas agora."}</p>
        <Button className="mt-4" variant="outline" onClick={() => q.refetch()}><RefreshCw className="mr-2 h-4 w-4" />Tentar de novo</Button>
      </div>
    );
  }
  const d = q.data;
  if (campanhaEncerrada(d.campanha.fim)) {
    return <div className="rounded-2xl border bg-card p-8 text-center font-semibold">O Natal terminou em {dataBR(d.campanha.fim)}. Obrigado, time! 🎄</div>;
  }
  const msgCampanha = `Olá! Separei para você as oportunidades do ${d.campanha.nome} da Uhome. Dá uma olhada:`;

  return (
    <div className="space-y-4">
      <section className="natal-noite natal-borda-ouro flex flex-col gap-4 rounded-2xl p-4 md:flex-row md:items-center md:p-5">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          {urlSite(d.corretor.foto_url)
            ? <img src={urlSite(d.corretor.foto_url)!} alt={d.corretor.nome} className="h-16 w-16 shrink-0 rounded-full border-2 border-background/70 object-cover" />
            : <div className="h-16 w-16 shrink-0 rounded-full bg-muted" aria-hidden />}
          <div className="min-w-0">
            <p className="text-xs opacity-80">Sua página do {d.campanha.nome}</p>
            <p className="text-lg font-bold leading-tight">{d.corretor.nome}</p>
            <p className="mt-1 truncate rounded-md bg-background/15 px-2 py-1 text-xs">{d.campanha_url.replace(/^https?:\/\//, "")}</p>
          </div>
        </div>
        <Botoes url={d.campanha_url} onWhats={() => setEnviar({ titulo: "sua página", url: d.campanha_url, mensagem: msgCampanha })} />
      </section>

      {!d.corretor.tem_foto && (
        <div className="rounded-xl border border-warning/40 bg-warning/10 px-4 py-2.5 text-sm">⚠️ Sua foto ainda não está no site. Fale com o marketing.</div>
      )}

      {d.produtos.length === 0 ? (
        <div className="rounded-2xl border bg-card p-8 text-center text-muted-foreground">Nenhum empreendimento na campanha ainda.</div>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {d.produtos.map((p) => (
            <article key={p.slug} className="flex flex-col overflow-hidden rounded-xl border bg-card">
              {urlSite(p.capa_url) ? <img src={urlSite(p.capa_url)!} alt={p.nome} loading="lazy" className="aspect-[4/3] w-full object-cover" /> : <div className="aspect-[4/3] w-full bg-muted" />}
              <div className="flex flex-1 flex-col gap-1 p-3">
                <h3 className="font-bold leading-tight">{p.nome}</h3>
                <p className="text-xs text-muted-foreground">{[p.bairro, p.cidade].filter(Boolean).join(" · ")}{p.entrega ? ` · Entrega ${p.entrega}` : ""}</p>
                <p className="mb-2 text-sm font-bold text-primary">{formatarPreco(p.preco_a_partir, p.preco_texto)}</p>
                <div className="mt-auto">
                  <Botoes compacto url={p.url} onPrevia={() => setPrevia(p)}
                    onWhats={() => setEnviar({ titulo: p.nome, url: p.url, mensagem: p.mensagem || `Olá! Separei para você o ${p.nome}. Dá uma olhada:` })} />
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <EnviarDialog alvo={enviar} onClose={() => setEnviar(null)} />
      <Dialog open={!!previa} onOpenChange={(o) => { if (!o) setPrevia(null); }}>
        <DialogContent className="flex h-[85vh] max-w-4xl flex-col gap-2 p-3">
          <DialogHeader className="flex-row items-center justify-between gap-2 pr-8">
            <DialogTitle className="truncate">{previa?.nome}</DialogTitle>
            {previa && <a href={previa.url} target="_blank" rel="noopener noreferrer" className="shrink-0 text-sm text-primary underline">Abrir em nova aba</a>}
          </DialogHeader>
          {previa && <iframe src={previa.url} title={`Prévia ${previa.nome}`} className="w-full flex-1 rounded-md border" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
