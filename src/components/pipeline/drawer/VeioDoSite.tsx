// Quadro "Veio do site": resumo recolhido (o que procura, como chegou, onde clicou, no site)
// e "Ver mais" com tudo organizado em três blocos. Linhas sem dado não aparecem.
import { useEffect, useState } from "react";
import { Globe, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lerSiteOrigem, type SiteOrigem } from "@/lib/siteOrigem";
import { resumirInteresseDeclarado } from "@/lib/resumirInteresseDeclarado";
import { lerJornada, type Jornada } from "@/lib/siteJornada";
import { JornadaResumo, JornadaDetalhe } from "./JornadaSite";
import { Button } from "@/components/ui/button";
import { lerNotasPedidoSite, type NotaPedidoSite } from "@/lib/sitePedidoNotas";

function Item({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 py-1 text-[13px]">
      <span className="w-24 shrink-0 text-muted-foreground">{rotulo}</span>
      <span className="min-w-0 flex-1 break-words text-foreground">{children}</span>
    </div>
  );
}

function Chips({ itens }: { itens: string[] }) {
  return (
    <span className="flex min-w-0 flex-wrap gap-1">
      {itens.map((f) => <span key={f} className="max-w-full break-words rounded-md bg-muted px-1.5 py-0.5 text-[12px]">{f}</span>)}
    </span>
  );
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-border pt-3 mt-3">
      <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">{titulo}</h3>
      {children}
    </div>
  );
}

function Link({ url, rotulo }: { url: string; rotulo: string }) {
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
      {rotulo} <ExternalLink className="h-3 w-3" aria-hidden />
    </a>
  );
}

const juntar = (...p: (string | null | undefined)[]) => { const t = p.filter(Boolean).join(" · "); return t ? t[0].toUpperCase() + t.slice(1) : null; };

export default function VeioDoSite({ leadId, origem, empreendimento }: { leadId: string; origem?: string | null; empreendimento?: string | null }) {
  const [info, setInfo] = useState<SiteOrigem | null>(null);
  const [jornada, setJornada] = useState<Jornada | null>(null);
  const [notas, setNotas] = useState<NotaPedidoSite[]>([]);
  const [aberto, setAberto] = useState(false);
  const [nomesMeta, setNomesMeta] = useState<Record<string, string>>({});
  const ehSite = (origem ?? "").toLowerCase().includes("site");

  useEffect(() => {
    setInfo(null); setJornada(null); setNotas([]); setAberto(false);
    let cancel = false;
    const carregar = async () => {
      const { data, error } = await supabase.rpc("ler_dados_site_lead", { p_lead_id: leadId });
      if (cancel || error || !data) return;
      const row = data[0];
      if (!row) return;
      const j = lerJornada(row.dados_site);
      if (!ehSite && !j) return;
      const o = lerSiteOrigem(row.dados_site, row.observacoes, empreendimento);
      setInfo(o);
      const ids = [o.idsMeta.campanha, o.idsMeta.anuncio].filter((v): v is string => !!v);
      if (ids.length) {
        const { data: nomes } = await supabase.rpc("site_nomes_anuncio", { p_ids: ids });
        if (!cancel && nomes) setNomesMeta(Object.fromEntries(nomes.map((n) => [n.id, n.nome])));
      }
      setJornada(j);
      setNotas(lerNotasPedidoSite(row.dados_site));
    };
    carregar();
    // Nova jornada chega pela integração do site: recarrega a cada 30s com a ficha aberta e ao voltar à aba.
    const t = window.setInterval(() => { if (document.visibilityState === "visible") carregar(); }, 30000);
    const onVis = () => { if (document.visibilityState === "visible") carregar(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { cancel = true; window.clearInterval(t); document.removeEventListener("visibilitychange", onVis); };
  }, [leadId, ehSite, empreendimento]);

  if (!info) return null;

  const declarado = empreendimento && /^interesse declarado/i.test(empreendimento)
    ? resumirInteresseDeclarado(empreendimento).replace(/^Interesse:\s*/i, "") : null;
  const procura = declarado ?? info.interesse;
  const comoChegou = info.fonte === "Não informada" && !/—/.test(info.fonteTexto) ? "Origem do tráfego não disponível" : info.fonteTexto;
  const ondeClicou = juntar(info.ondeClicou, info.paginaRotulo?.toLowerCase());
  const noSite = juntar(jornada ? null : info.visitas, info.aparelho?.toLowerCase());
  const tipos = info.filtros.filter((f) => !/quarto|vaga|R\$/.test(f));
  const detalhes = juntar(...info.filtros.filter((f) => /quarto|vaga|R\$/.test(f)));
  const contexto = juntar(info.clienteVoltou ? "Cliente que voltou" : null, info.conversouLia ? "conversou com a LIA" : null);

  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <h2 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
        <Globe className="h-3.5 w-3.5" aria-hidden /> Veio do site
      </h2>
      {procura && (
        <>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">O que procura</h3>
          <p className="mb-1 break-words text-[15px] font-semibold text-foreground" title={empreendimento ?? undefined}>{procura}</p>
        </>
      )}
      <Item rotulo="Como chegou">{comoChegou}</Item>
      {info.idsMeta.campanha && <Item rotulo="Campanha">{nomesMeta[info.idsMeta.campanha] ?? "Campanha do Meta (nome ainda não carregado)"}</Item>}
      {info.idsMeta.anuncio && nomesMeta[info.idsMeta.anuncio] && <Item rotulo="Anúncio">{nomesMeta[info.idsMeta.anuncio]}</Item>}
      {ondeClicou && <Item rotulo="Onde clicou">{ondeClicou}</Item>}
      {noSite && <Item rotulo="No site">{noSite}</Item>}
      {jornada && <JornadaResumo j={jornada} />}

      {aberto && (
        <>
          {(tipos.length > 0 || info.bairros.length > 0 || detalhes || info.imovel) && (
            <Bloco titulo="O que procura">
              {tipos.length > 0 && <Item rotulo="Tipos"><Chips itens={tipos} /></Item>}
              {info.bairros.length > 0 && <Item rotulo="Bairros">{info.bairros.join(", ")}</Item>}
              {detalhes && <Item rotulo="Detalhes">{detalhes}</Item>}
              {info.imovel && <Item rotulo="Imóvel">{info.imovel}</Item>}
            </Bloco>
          )}
          <Bloco titulo="Como chegou">
            {info.palavraPesquisada && <Item rotulo="Pesquisou"><strong>"{info.palavraPesquisada}"</strong></Item>}
            {info.entrouPor && <Item rotulo="Entrou por">{info.entrouPor}</Item>}
            {info.ondeClicou && <Item rotulo="Onde clicou">{info.ondeClicou}</Item>}
            {info.formulario && info.formulario !== info.ondeClicou && <Item rotulo="Formulário">{info.formulario}</Item>}
            <Item rotulo="Enviou em">{info.pagina ? <Link url={info.pagina} rotulo={info.paginaRotulo ?? "Página do site"} /> : "Não informado pelo site"}</Item>
          </Bloco>
          {(info.visitas || info.aparelho || info.imoveisVistos.length || info.favoritos.length || info.buscas.length || contexto) ? (
            <Bloco titulo="O que fez no site">
              {info.visitas && !jornada && <Item rotulo="Visitas">{info.visitas}</Item>}
              {info.aparelho && <Item rotulo="Aparelho">{info.aparelho}</Item>}
              {info.imoveisVistos.length > 0 && <Item rotulo="Viu"><Chips itens={info.imoveisVistos} /></Item>}
              {info.favoritos.length > 0 && <Item rotulo="Favoritou"><Chips itens={info.favoritos} /></Item>}
              {info.buscas.length > 0 && <Item rotulo="Buscou"><Chips itens={info.buscas} /></Item>}
              {contexto && <Item rotulo="Contexto">{contexto}</Item>}
            </Bloco>
          ) : null}
          {jornada && <JornadaDetalhe j={jornada} />}
          {notas.length > 0 && (
            <Bloco titulo="Pedidos no site">
              {notas.map(nota => (
                <div key={nota.id} className="border-b border-border py-2 text-[13px] last:border-b-0">
                  <p className="break-words font-semibold text-foreground">{nota.titulo}</p>
                  {nota.descricao && <p className="whitespace-pre-line break-words text-muted-foreground">{nota.descricao}</p>}
                </div>
              ))}
            </Bloco>
          )}
        </>
      )}

      <div className="mt-3 border-t border-border pt-2">
        <Button variant="link" type="button" onClick={() => setAberto((v) => !v)} aria-expanded={aberto}
          className="min-h-[36px] p-0 text-[13px]">
          {aberto ? <>Ver menos <ChevronUp className="h-4 w-4" aria-hidden /></> : <>Ver mais <ChevronDown className="h-4 w-4" aria-hidden /></>}
        </Button>
      </div>
    </section>
  );
}
