import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FlaskConical, Loader2 } from "lucide-react";
import { nomeFicha, type FichaLia } from "./liaConhecimento";
import { formatBRT } from "@/lib/brtTime";

type Simulacao = { texto: string; produto: string; ficha_versao: string; ficha_hash: string };
export default function LiaFollowupSimulacao({ produto, onClose }: { produto: FichaLia; onClose: () => void }) {
  const [contexto, setContexto] = useState("Cliente fictício: gostei do empreendimento, mas preciso conversar com minha família. Lia: pode conversar com calma, depois vemos as opções.");
  const simular = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("lia-laboratorio", { body: { modo: "followup", produto_slug: produto.slug, contexto } });
      if (error || data?.error) throw new Error(data?.error || "Não foi possível simular. Seu contexto foi preservado.");
      return data as Simulacao;
    },
  });
  return <Dialog open onOpenChange={(open) => { if (!open && !simular.isPending) onClose(); }}>
    <DialogContent className="sm:max-w-2xl" onInteractOutside={(e) => e.preventDefault()}>
      <DialogHeader><DialogTitle>Simular follow-up · {nomeFicha(produto)}</DialogTitle>
        <DialogDescription>Cliente fictício, ficha salva. Nenhuma mensagem será enviada pelo WhatsApp.</DialogDescription></DialogHeader>
      <label htmlFor="contexto-simulado" className="text-sm font-medium">Conversa fictícia para testar</label>
      <Textarea id="contexto-simulado" className="min-h-28" value={contexto} onChange={(e) => { setContexto(e.target.value); simular.reset(); }} disabled={simular.isPending} maxLength={5000} />
      {simular.isError && <p role="alert" className="text-sm text-destructive">{simular.error.message}</p>}
      {simular.data && <section className="space-y-2 border-t border-border pt-4">
        <h3 className="text-sm font-semibold">Resposta simulada da Lia</h3>
        <p className="whitespace-pre-wrap rounded-md bg-muted p-3 text-sm">{simular.data.texto || "A Lia optou por não enviar um follow-up neste contexto."}</p>
        <p className="text-xs text-muted-foreground">Ficha usada: {formatBRT(simular.data.ficha_versao, "dd/MM/yyyy HH:mm")} · {simular.data.produto}</p>
      </section>}
      <div className="flex flex-wrap justify-end gap-2"><Button variant="ghost" onClick={onClose} disabled={simular.isPending}>Fechar</Button>
        <Button onClick={() => simular.mutate()} disabled={simular.isPending || contexto.trim().length < 10}>
          {simular.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />}Simular sem enviar
        </Button></div>
    </DialogContent>
  </Dialog>;
}