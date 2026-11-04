import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Ban, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { FAIXA_ROTULO, NATAL_VIGENCIA, PRODUTOS_NATAL, formatarPreco, precoAPartir, type FaixaNatal } from "@/lia/catalogoNatal";

const FAIXAS: FaixaNatal[] = ["ate_300", "300_400", "casas", "alto_padrao"];

function dataBR(iso: string) {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

export default function LiaConhecimentoTab() {
  const { data: liaAtivos } = useQuery({
    queryKey: ["lia-hub", "produtos-ativos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("lia_produtos").select("slug, ativo");
      if (error) throw error;
      return new Map((data ?? []).map((p) => [p.slug, p.ativo]));
    },
  });

  return (
    <div className="space-y-4">
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4 text-xs text-muted-foreground">
          <p className="text-sm font-semibold text-foreground">Natal Chave de Ouro · 8 oportunidades</p>
          Preços válidos de {dataBR(NATAL_VIGENCIA.inicio)} a {dataBR(NATAL_VIGENCIA.fim)}. Depois disso a Lia para de citar valores.
          A Lia só responde com o que está nas fichas; o resto ela passa para o corretor confirmar.
        </CardContent>
      </Card>

      {FAIXAS.map((f) => (
        <section key={f} className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{FAIXA_ROTULO[f]}</h3>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {PRODUTOS_NATAL.filter((p) => p.faixa === f).map((p) => {
              const ativoLia = p.liaSlug ? liaAtivos?.get(p.liaSlug) : undefined;
              return (
                <Card key={p.slug} className="flex flex-col">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <CardTitle className="text-sm">{p.nome}</CardTitle>
                        <CardDescription className="flex items-center gap-1 text-[11px]"><MapPin className="h-3 w-3" />{p.local}</CardDescription>
                      </div>
                      <p className="text-right text-xs text-muted-foreground">a partir de<br /><b className="text-base text-foreground">{formatarPreco(precoAPartir(p))}</b></p>
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-1 flex-col gap-2 text-xs">
                    <div className="flex flex-wrap gap-1">
                      <Badge variant="secondary" className="text-[10px]">{p.situacao}</Badge>
                      <Badge variant="outline" className="text-[10px]">{p.incorporadora}</Badge>
                      {ativoLia === true && <Badge className="text-[10px]">Ficha da Lia ativa</Badge>}
                      {ativoLia === false && <Badge variant="secondary" className="text-[10px]">Ficha da Lia desligada</Badge>}
                      {!p.liaSlug && <Badge variant="outline" className="text-[10px]">Sem ficha na Lia</Badge>}
                    </div>
                    <ul className="divide-y divide-border">
                      {p.tipologias.map((t) => (
                        <li key={t.nome} className="flex justify-between py-1"><span className="text-muted-foreground">{t.nome}</span><b className="tabular-nums">{formatarPreco(t.valor)}</b></li>
                      ))}
                    </ul>
                    {p.condicao && <p className="text-[11px] text-foreground/80">{p.condicao}</p>}
                    <p className="text-[11px]"><span className="text-muted-foreground">Entrega:</span> {p.entrega}</p>
                    {p.rendaReferencia && <p className="text-[11px]"><span className="text-muted-foreground">Renda:</span> {p.rendaReferencia}</p>}
                    {p.pendencia && (
                      <p className="mt-auto flex gap-1 rounded-md bg-muted p-2 text-[11px] text-muted-foreground"><AlertTriangle className="h-3.5 w-3.5 shrink-0" />{p.pendencia}</p>
                    )}
                    {p.naoCitar?.map((n) => (
                      <p key={n} className="flex gap-1 text-[11px] text-destructive"><Ban className="h-3.5 w-3.5 shrink-0" />Não citar: {n}</p>
                    ))}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
