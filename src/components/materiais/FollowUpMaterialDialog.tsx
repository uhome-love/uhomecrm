import { useEffect, useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, Sparkles, Copy, MessageCircle, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { MaterialLink } from "@/hooks/useMateriais";
import { registrarMaterialRecente } from "@/hooks/useMateriaisFavoritos";
import { getCategoriaInfo } from "./CategoriaIcon";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  empreendimentoNome: string;
  /** Todos os materiais do empreendimento (base da seleção). */
  todosMateriais: MaterialLink[];
  /** IDs pré-selecionados quando o diálogo abre. */
  preSelectedIds: string[];
}

type Tom = "amigavel" | "consultivo" | "urgencia";

export function FollowUpMaterialDialog({
  open, onOpenChange, empreendimentoNome, todosMateriais, preSelectedIds,
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [tom, setTom] = useState<Tom>("amigavel");
  const [loading, setLoading] = useState(false);
  const [mensagens, setMensagens] = useState<Array<{ titulo: string; texto: string }>>([]);

  // Reseta seleção sempre que o diálogo abre com uma nova base.
  useEffect(() => {
    if (open) {
      setSelected(new Set(preSelectedIds));
      setMensagens([]);
    }
  }, [open, preSelectedIds.join("|")]);

  const selectedMateriais = useMemo(
    () => todosMateriais.filter((m) => selected.has(m.id)),
    [todosMateriais, selected],
  );

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const selectAll = () => setSelected(new Set(todosMateriais.map((m) => m.id)));
  const clearAll = () => setSelected(new Set());

  const gerar = async () => {
    if (selectedMateriais.length === 0) {
      toast({ title: "Selecione ao menos 1 material", variant: "destructive" });
      return;
    }
    setLoading(true);
    setMensagens([]);
    try {
      const { data, error } = await supabase.functions.invoke("homi-follow-up-message", {
        body: {
          empreendimento_nome: empreendimentoNome,
          material_ids: selectedMateriais.map((m) => m.id),
          materiais: selectedMateriais.map((m) => ({
            titulo: m.titulo,
            kind: m.categoria || "material",
          })),
          tom,
        },
      });
      if (error) throw error;
      const arr = (data as any)?.mensagens ?? [];
      if (!arr.length) throw new Error("IA não retornou mensagens");
      setMensagens(arr);
      if (selectedMateriais.length === 1) {
        registrarMaterialRecente(selectedMateriais[0].id, "followup");
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

  const total = todosMateriais.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> Follow-up com IA
          </DialogTitle>
          <DialogDescription>
            {mensagens.length === 0
              ? <>Selecione os materiais que a IA vai usar como base — {empreendimentoNome}.</>
              : <>{selectedMateriais.length} {selectedMateriais.length === 1 ? "material selecionado" : "materiais selecionados"} — {empreendimentoNome}.</>}
          </DialogDescription>
        </DialogHeader>

        {mensagens.length === 0 ? (
          <div className="flex flex-col gap-3 min-h-0 flex-1">
            {/* Toolbar seleção */}
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                {selected.size} de {total} selecionados
              </span>
              <div className="flex gap-2">
                <button type="button" className="text-primary hover:underline" onClick={selectAll}>
                  Selecionar todos
                </button>
                <span className="text-muted-foreground">·</span>
                <button type="button" className="text-muted-foreground hover:underline" onClick={clearAll}>
                  Limpar
                </button>
              </div>
            </div>

            {/* Lista de materiais com checkbox */}
            <div className="flex-1 min-h-[180px] max-h-[320px] overflow-y-auto border border-border/60 rounded-lg divide-y divide-border/60">
              {todosMateriais.map((m) => {
                const cat = getCategoriaInfo(m.categoria);
                const on = selected.has(m.id);
                return (
                  <label
                    key={m.id}
                    className={cn(
                      "flex items-start gap-2.5 px-3 py-2 cursor-pointer hover:bg-muted/40 transition-colors",
                      on && "bg-primary/5",
                    )}
                  >
                    <Checkbox
                      checked={on}
                      onCheckedChange={() => toggle(m.id)}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground line-clamp-2 leading-snug">
                        {m.titulo}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                        {cat.label}
                        {m.ingest_status === "done" && (m.tags?.length ?? 0) > 0 && (
                          <span className="ml-1.5 text-primary">· ✨ IA</span>
                        )}
                      </p>
                    </div>
                  </label>
                );
              })}
              {todosMateriais.length === 0 && (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  Nenhum material disponível.
                </p>
              )}
            </div>

            {/* Tom */}
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

            <Button onClick={gerar} disabled={loading || selected.size === 0} className="w-full">
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
              Gerar 3 sugestões {selected.size > 0 && `(${selected.size} ${selected.size === 1 ? "material" : "materiais"})`}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3 min-h-0 flex-1">
            <div className="space-y-2 flex-1 overflow-y-auto pr-1">
              {mensagens.map((m, i) => (
                <div key={i} className="rounded-lg border border-border/60 bg-card p-3 space-y-2">
                  <span className="text-[11px] font-semibold text-primary uppercase tracking-wide">{m.titulo}</span>
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
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setMensagens([])} className="flex-1">
                <ArrowLeft className="h-4 w-4 mr-2" /> Trocar materiais
              </Button>
              <Button variant="outline" onClick={gerar} disabled={loading} className="flex-1">
                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                Gerar novamente
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
