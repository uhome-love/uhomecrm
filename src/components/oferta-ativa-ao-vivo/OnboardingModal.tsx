import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles, Filter, ShieldCheck, Timer } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  filters: { empreendimento_ids: string[]; segmento_ids: string[] };
  onSave: (f: { empreendimento_ids: string[]; segmento_ids: string[] }) => void;
  firstTime?: boolean;
}

export function OnboardingModal({ open, onClose, filters, onSave, firstTime }: Props) {
  const [empreendimentos, setEmpreendimentos] = useState<{ id: string; nome: string }[]>([]);
  const [segmentos, setSegmentos] = useState<{ id: string; nome: string; cor: string | null }[]>([]);
  const [empSel, setEmpSel] = useState<string[]>(filters.empreendimento_ids);
  const [segSel, setSegSel] = useState<string[]>(filters.segmento_ids);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const [e, s] = await Promise.all([
        supabase.from("empreendimentos_canonicos").select("id, nome").order("nome"),
        supabase.from("roleta_segmentos").select("id, nome, cor").order("nome"),
      ]);
      setEmpreendimentos((e.data ?? []) as any);
      setSegmentos((s.data ?? []) as any);
    })();
  }, [open]);

  const toggle = (arr: string[], id: string) =>
    arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Sparkles className="w-5 h-5 text-primary" />
            {firstTime ? "Bem-vindo ao Mutirão Inteligente" : "Editar filtros da fila"}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh] pr-2">
          <div className="space-y-4">
            {firstTime && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="rounded-xl border border-border p-3 bg-muted/30">
                  <ShieldCheck className="w-5 h-5 text-primary mb-1" />
                  <p className="text-sm font-semibold">Só leads descartados nos últimos 90 dias</p>
                  <p className="text-xs text-muted-foreground">Higienizados: sem duplicados, sem números inválidos, sem quem já respondeu "não".</p>
                </div>
                <div className="rounded-xl border border-border p-3 bg-muted/30">
                  <Sparkles className="w-5 h-5 text-primary mb-1" />
                  <p className="text-sm font-semibold">Ordenados pelos melhores primeiro</p>
                  <p className="text-xs text-muted-foreground">Verdes quentes → verdes → amarelos. A IA prioriza quem tem mais chance.</p>
                </div>
                <div className="rounded-xl border border-border p-3 bg-muted/30">
                  <Timer className="w-5 h-5 text-primary mb-1" />
                  <p className="text-sm font-semibold">Nunca leads que você descartou</p>
                  <p className="text-xs text-muted-foreground">Exclusão permanente do último dono anterior — sem retrabalho.</p>
                </div>
              </div>
            )}

            <div>
              <div className="flex items-center gap-2 mb-2">
                <Filter className="w-4 h-4" />
                <p className="text-sm font-semibold">Segmentos (opcional)</p>
                {segSel.length > 0 && <Badge variant="secondary">{segSel.length}</Badge>}
              </div>
              <div className="flex flex-wrap gap-2">
                {segmentos.map((s) => {
                  const on = segSel.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      onClick={() => setSegSel((cur) => toggle(cur, s.id))}
                      className={`px-3 py-1.5 rounded-full text-sm border transition ${on ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:bg-muted"}`}
                    >
                      {s.nome}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <Filter className="w-4 h-4" />
                <p className="text-sm font-semibold">Empreendimentos (opcional)</p>
                {empSel.length > 0 && <Badge variant="secondary">{empSel.length}</Badge>}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-1 max-h-64 overflow-y-auto rounded-lg border border-border p-2">
                {empreendimentos.map((e) => {
                  const on = empSel.includes(e.id);
                  return (
                    <label key={e.id} className="flex items-center gap-2 text-sm px-2 py-1 rounded hover:bg-muted cursor-pointer">
                      <Checkbox checked={on} onCheckedChange={() => setEmpSel((cur) => toggle(cur, e.id))} />
                      <span className="truncate">{e.nome}</span>
                    </label>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Sem seleção = todos os empreendimentos.
              </p>
            </div>
          </div>
        </ScrollArea>

        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="outline" onClick={() => { setEmpSel([]); setSegSel([]); }}>Limpar</Button>
          <Button
            onClick={() => {
              onSave({ empreendimento_ids: empSel, segmento_ids: segSel });
              onClose();
            }}
          >
            {firstTime ? "Começar mutirão" : "Aplicar filtros"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
