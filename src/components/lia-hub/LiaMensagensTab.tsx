import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { BOTOES_RECUPERA, MODELOS_RECUPERA } from "@/lia/recupera";

type Template = { key: string; nome: string | null; descricao: string | null; corpo: string | null; dentro_24h: boolean | null; ativo: boolean | null };

function exemplo(texto: string) {
  return texto.replace("{{1}}", "Andrio").replace("{{2}}", "Essence Canoas").replace("{{3}}", "a partir de R$ 289 mil");
}

export default function LiaMensagensTab() {
  const { data: atuais, isLoading } = useQuery({
    queryKey: ["lia-hub", "templates"],
    queryFn: async () => {
      const sb = supabase as unknown as { from: (t: string) => { select: (c: string) => { order: (c: string) => Promise<{ data: Template[] | null; error: Error | null }> } } };
      const { data, error } = await sb.from("lia_templates").select("key, nome, descricao, corpo, dentro_24h, ativo").order("key");
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Modelos da recuperação</CardTitle>
          <CardDescription className="text-xs">
            Textos aprovados no plano. Precisam da aprovação da Meta no número da Lia antes do primeiro envio. Toda mensagem leva os botões abaixo.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {MODELOS_RECUPERA.map((m) => (
            <div key={m.chave} className="flex flex-col rounded-xl border border-border p-3">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-foreground">{m.titulo}</p>
                  <p className="text-[11px] text-muted-foreground">{m.quando}</p>
                </div>
                <Badge variant="outline" className="shrink-0 text-[10px]">Enviar à Meta</Badge>
              </div>
              <p className="flex-1 rounded-lg bg-muted/60 p-3 text-xs leading-relaxed text-foreground">{exemplo(m.texto)}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {BOTOES_RECUPERA.map((b) => (
                  <span key={b} className="rounded-md border border-primary/30 px-2 py-0.5 text-[11px] text-primary">{b}</span>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Modelos já cadastrados na Lia</CardTitle>
          <CardDescription className="text-xs">Usados hoje no atendimento e no reengajamento manual.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading && <Skeleton className="h-24 w-full" />}
          {!isLoading && !atuais?.length && <p className="text-xs text-muted-foreground">Nenhum modelo cadastrado.</p>}
          {atuais?.map((t) => (
            <div key={t.key} className="rounded-lg border border-border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium text-foreground">{t.nome ?? t.key}</p>
                <Badge variant={t.ativo ? "default" : "secondary"} className="text-[10px]">{t.ativo ? "Ativo" : "Desligado"}</Badge>
                <Badge variant="outline" className="text-[10px]">{t.dentro_24h ? "Conversa aberta" : "Modelo Meta"}</Badge>
              </div>
              {t.descricao && <p className="mt-1 text-[11px] text-muted-foreground">{t.descricao}</p>}
              {t.corpo && <p className="mt-2 line-clamp-3 text-xs text-foreground/80">{t.corpo}</p>}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
