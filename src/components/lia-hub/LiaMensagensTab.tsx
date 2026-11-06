import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { supabase } from "@/integrations/supabase/client";
import { BOTOES_RECUPERA, MODELOS_RECUPERA } from "@/lia/recupera";
import LiaLeituraAviso from "./LiaLeituraAviso";

function exemplo(texto: string) {
  return texto.replace("{{1}}", "[nome do cliente]").replace("{{2}}", "[empreendimento]").replace("{{3}}", "[condição confirmada]");
}

export default function LiaMensagensTab() {
  const atuais = useQuery({
    queryKey: ["lia-hub", "templates"],
    queryFn: async () => {
      const { data, error } = await supabase.from("lia_templates").select("key, nome, descricao, corpo, dentro_24h, ativo").order("key");
      if (error) throw error;
      return data ?? [];
    },
  });

  return <div className="space-y-7">
    <section>
      <header className="mb-4">
        <h2 className="text-sm font-semibold text-foreground">Propostas de recuperação</h2>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Textos aprovados na Meta no número da Lia (Marketing, pt_BR). Disparos seguem desligados.</p>
      </header>
      <div className="grid gap-3 md:grid-cols-2">
        {MODELOS_RECUPERA.map((m) => <article key={m.chave} className="min-w-0 rounded-xl border border-border bg-card p-4">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0"><h3 className="text-sm font-semibold text-foreground">{m.titulo}</h3><p className="mt-1 text-[11px] text-muted-foreground">{m.quando}</p></div>
            <Badge variant={m.aprovadoMeta ? "default" : "secondary"} className="text-[10px]">{m.aprovadoMeta ? `Aprovado na Meta · ${m.aprovadoMeta.slice(0, 5)}` : "Proposta"}</Badge>
          </div>
          <p className="whitespace-pre-wrap break-words text-xs leading-relaxed text-foreground">{exemplo(m.texto)}</p>
          <div className="mt-4 flex flex-wrap gap-1.5 border-t border-border pt-3">
            {BOTOES_RECUPERA.map((b) => <span key={b} className="text-[10px] text-muted-foreground">{b}{b !== BOTOES_RECUPERA[BOTOES_RECUPERA.length - 1] && <span className="ml-1.5 text-border">·</span>}</span>)}
          </div>
        </article>)}
      </div>
    </section>
    <section className="border-t border-border pt-5">
      <header className="mb-3 flex items-center justify-between gap-3">
        <div><h2 className="text-sm font-semibold text-foreground">Modelos cadastrados na Lia</h2><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Cadastro e disponibilidade no CRM; não indicam aprovação da Meta.</p></div>
        {atuais.data && <span className="text-sm font-semibold tabular-nums text-muted-foreground">{atuais.data.length}</span>}
      </header>
      {atuais.isLoading && <Skeleton className="h-24 w-full" />}
      {atuais.isError && <LiaLeituraAviso titulo="Não foi possível consultar os modelos cadastrados." tentar={() => { void atuais.refetch(); }} />}
      {!atuais.isLoading && !atuais.isError && !atuais.data?.length && <p className="py-8 text-sm text-muted-foreground">Nenhum modelo cadastrado.</p>}
      {!atuais.isError && <Accordion type="multiple">
        {atuais.data?.map((t) => <AccordionItem key={t.key} value={t.key}>
          <AccordionTrigger className="gap-3 text-left hover:no-underline">
            <span className="min-w-0 flex-1"><span className="block text-sm font-medium text-foreground">{t.nome ?? t.key}</span>{t.descricao && <span className="mt-1 block text-[11px] font-normal leading-relaxed text-muted-foreground">{t.descricao}</span>}</span>
            <Badge variant="secondary" className="shrink-0 text-[10px]">{t.ativo ? "Disponível" : "Desligado"}</Badge>
          </AccordionTrigger>
          <AccordionContent>
            <Badge variant="outline" className="mb-3 text-[10px]">{t.dentro_24h ? "Conversa aberta" : "Modelo Meta"}</Badge>
            <p className="whitespace-pre-wrap break-words text-xs leading-relaxed text-foreground">{t.corpo}</p>
          </AccordionContent>
        </AccordionItem>)}
      </Accordion>}
    </section>
  </div>;
}
