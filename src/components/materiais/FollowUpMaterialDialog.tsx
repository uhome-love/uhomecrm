import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, Sparkles, Copy, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { MaterialLink } from "@/hooks/useMateriais";
import { registrarMaterialRecente } from "@/hooks/useMateriaisFavoritos";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  empreendimentoNome: string;
  materiais: MaterialLink[]; // 1 material ou o empreendimento todo
}

type Tom = "amigavel" | "consultivo" | "urgencia";

export function FollowUpMaterialDialog({ open, onOpenChange, empreendimentoNome, materiais }: Props) {
  const [tom, setTom] = useState<Tom>("amigavel");
  const [loading, setLoading] = useState(false);
  const [mensagens, setMensagens] = useState<Array<{ titulo: string; texto: string }>>([]);

  const gerar = async () => {
    setLoading(true);
    setMensagens([]);
    try {
      const { data, error } = await supabase.functions.invoke("homi-follow-up-message", {
        body: {
          empreendimento_nome: empreendimentoNome,
          materiais: materiais.map((m) => ({
            titulo: m.titulo,
            kind: m.categoria || m.tipo || "material",
          })),
          tom,
        },
      });
      if (error) throw error;
      const arr = (data as any)?.mensagens ?? [];
      if (!arr.length) throw new Error("IA não retornou mensagens");
      setMensagens(arr);
      // Registrar recente na primeira ocorrência (só faz sentido quando 1 material)
      if (materiais.length === 1) {
        registrarMaterialRecente(materiais[0].id, "followup");
      }
    } catch (e: any) {
      toast({ title: "Erro ao gerar mensagem", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const copiar = async (txt: string) => {
    try {
      await navigator.clipboard.writeText(txt);
      toast({ title: "Mensagem copiada" });
    } catch {
      toast({ title: "Não foi possível copiar", variant: "destructive" });
    }
  };

  const enviarWhats = (txt: string) => {
    window.open(`https://wa.me/?text=${encodeURIComponent(txt)}`, "_blank", "noopener,noreferrer");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> Follow-up com IA
          </DialogTitle>
          <DialogDescription>
            {materiais.length === 1
              ? <>Gerar mensagem sobre <strong>{materiais[0].titulo}</strong> — {empreendimentoNome}.</>
              : <>Gerar mensagem sobre <strong>{materiais.length} materiais</strong> — {empreendimentoNome}.</>}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Tom da mensagem</Label>
            <Select value={tom} onValueChange={(v) => setTom(v as Tom)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="amigavel">Amigável — próximo, sem pressão</SelectItem>
                <SelectItem value="consultivo">Consultivo — como especialista</SelectItem>
                <SelectItem value="urgencia">Oportunidade — senso de urgência sutil</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {mensagens.length === 0 ? (
            <Button onClick={gerar} disabled={loading} className="w-full">
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
              Gerar 3 sugestões
            </Button>
          ) : (
            <>
              <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                {mensagens.map((m, i) => (
                  <div key={i} className="rounded-lg border border-border/60 bg-card p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-primary uppercase tracking-wide">{m.titulo}</span>
                    </div>
                    <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{m.texto}</p>
                    <div className="flex gap-2 pt-1">
                      <Button size="sm" variant="outline" className="flex-1 h-8 text-xs" onClick={() => copiar(m.texto)}>
                        <Copy className="h-3.5 w-3.5 mr-1.5" /> Copiar
                      </Button>
                      <Button size="sm" className="flex-1 h-8 text-xs bg-green-600 hover:bg-green-700" onClick={() => enviarWhats(m.texto)}>
                        <MessageCircle className="h-3.5 w-3.5 mr-1.5" /> WhatsApp
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <Button variant="outline" onClick={gerar} disabled={loading} className="w-full">
                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                Gerar novamente
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
