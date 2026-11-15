// Quadro "Veio do site": onde o lead clicou, página, interesse e fonte do tráfego.
import { useEffect, useState } from "react";
import { Globe, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lerSiteOrigem, type SiteOrigem } from "@/lib/siteOrigem";

function Item({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 py-1.5 text-[13px]">
      <span className="w-24 shrink-0 font-medium text-muted-foreground">{rotulo}</span>
      <span className="min-w-0 break-words text-foreground">{children}</span>
    </div>
  );
}

function Chips({ itens }: { itens: string[] }) {
  const vis = itens.slice(0, 3);
  return (
    <span className="flex min-w-0 flex-wrap gap-1">
      {vis.map((f) => <span key={f} className="max-w-full truncate rounded-md bg-muted px-1.5 py-0.5 text-[12px]" title={f}>{f}</span>)}
      {itens.length > 3 && <span className="rounded-md bg-muted px-1.5 py-0.5 text-[12px] text-muted-foreground" title={itens.slice(3).join(", ")}>+{itens.length - 3}</span>}
    </span>
  );
}

export default function VeioDoSite({ leadId, origem, empreendimento }: { leadId: string; origem?: string | null; empreendimento?: string | null }) {
  const [info, setInfo] = useState<SiteOrigem | null>(null);
  const ehSite = (origem ?? "").toLowerCase().includes("site");

  useEffect(() => {
    if (!ehSite) { setInfo(null); return; }
    let cancel = false;
    (async () => {
      const { data, error } = await supabase.from("pipeline_leads").select("dados_site, observacoes").eq("id", leadId).maybeSingle();
      if (cancel || error || !data) return;
      const row = data as { dados_site: Record<string, unknown> | null; observacoes: string | null };
      setInfo(lerSiteOrigem(row.dados_site, row.observacoes, empreendimento));
    })();
    return () => { cancel = true; };
  }, [leadId, ehSite, empreendimento]);

  if (!ehSite || !info) return null;
  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <h2 className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
        <Globe className="h-3.5 w-3.5" aria-hidden /> Veio do site
      </h2>
      <div className="mb-1 mt-1 flex flex-wrap items-center gap-1.5">
        <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[12px] font-semibold text-primary">{info.fonteTexto}</span>
        {info.conversouLia && <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-accent-foreground">Conversou com a LIA</span>}
        {info.clienteVoltou && <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-secondary-foreground">Cliente que voltou</span>}
      </div>
      {info.palavraPesquisada && <Item rotulo="Pesquisou">"{info.palavraPesquisada}"</Item>}
      <Item rotulo="Onde clicou">{info.ondeClicou ?? "Não informado pelo site"}</Item>
      <Item rotulo="Página">
        {info.pagina ? (
          <a href={info.pagina} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
            {info.paginaRotulo} <ExternalLink className="h-3 w-3" aria-hidden />
          </a>
        ) : "Não informada pelo site"}
      </Item>
      {info.entrouPor && <Item rotulo="Entrou por">{info.entrouPor}</Item>}
      {info.visitas && <Item rotulo="Visitas">{info.visitas}</Item>}
      {info.imoveisVistos.length > 0 && <Item rotulo="Imóveis vistos"><Chips itens={info.imoveisVistos} /></Item>}
      {info.favoritos.length > 0 && <Item rotulo="Favoritos"><Chips itens={info.favoritos} /></Item>}
      {info.buscas.length > 0 && <Item rotulo="Buscas"><Chips itens={info.buscas} /></Item>}
      {info.imovel && <Item rotulo="Imóvel">{info.imovel}</Item>}
      {info.filtros.length > 0 && (
        <Item rotulo="Interesse">
          <span className="flex min-w-0 flex-wrap gap-1">
            {info.filtros.map((f) => <span key={f} className="max-w-full break-words rounded-full bg-primary/10 px-2 py-0.5 text-[12px] font-medium text-primary">{f}</span>)}
          </span>
        </Item>
      )}
      {info.bairros.length > 0 && <Item rotulo="Bairros">{info.bairros.join(", ")}</Item>}
      {info.aparelho && <Item rotulo="Aparelho">{info.aparelho}</Item>}
    </section>
  );
}
