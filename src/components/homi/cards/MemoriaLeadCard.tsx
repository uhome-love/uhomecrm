import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Check, Loader2, Brain } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function MemoriaLeadCard({ leadId, nome, chave, valor }: { leadId?: string; nome?: string; chave: string; valor: string }) {
  const [text, setText] = useState(valor);
  const [state, setState] = useState<"preview" | "saving" | "saved" | "cancelled">("preview");
  if (state === "cancelled") return null;
  if (state === "saved") return <p className="flex items-center gap-2 text-sm text-foreground"><Check className="h-4 w-4 text-primary" /> Fato salvo · {nome}</p>;
  return <div className="border border-border rounded-lg p-3 space-y-3 bg-card">
    <p className="text-sm font-semibold flex items-center gap-2"><Brain className="h-4 w-4 text-primary" /> Memória · {nome} · {chave}</p>
    <Textarea value={text} onChange={e=>setText(e.target.value)} maxLength={400} />
    <div className="flex gap-2">
      <Button size="sm" disabled={!leadId || !text.trim() || state==="saving"} onClick={async()=>{
        if (!leadId) return;
        setState("saving");
        const { error } = await supabase.rpc("homi_memoria_confirmar", { p_lead:leadId, p_chave:chave, p_valor:text, p_confirmado:true });
        if (error) { toast.error(error.message); setState("preview"); return; }
        setState("saved");
      }}>{state==="saving" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Confirmar</Button>
      <Button size="sm" variant="ghost" disabled={state==="saving"} onClick={()=>setState("cancelled")}>Cancelar</Button>
    </div>
  </div>;
}