import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ChevronDown, ChevronUp, Sparkles, Loader2, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { LeadOferta } from "@/hooks/useMutiraoSession";
import { useNavigate } from "react-router-dom";

export function ScriptCollapsible({ lead }: { lead: LeadOferta | null }) {
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);

  async function gerar() {
    if (!lead) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-script", {
        body: {
          contexto: "oferta_ativa_mutirao",
          lead_nome: lead.nome,
          empreendimento: lead.empreendimento_canonico?.nome ?? lead.empreendimento_raw,
          segmento: lead.segmento?.nome,
          motivo_descarte: lead.motivo_descarte,
          dias_descarte: lead.dias_desde_descarte,
        },
      });
      if (error) throw error;
      const s = (data as any)?.script || (data as any)?.texto || "";
      setText(s);
    } catch (e: any) {
      toast.error("Erro ao gerar script — cole manualmente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card">
      <button
        className="w-full flex items-center justify-between px-4 py-2 text-sm font-medium"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="flex items-center gap-2"><Sparkles className="w-3.5 h-3.5 text-primary" /> Script de abordagem</span>
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {open && (
        <div className="px-4 pb-3 space-y-2">
          <div className="flex gap-2">
            <Button size="sm" onClick={gerar} disabled={loading || !lead}>
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Sparkles className="w-3.5 h-3.5 mr-1" />}
              Gerar com IA
            </Button>
            <Button size="sm" variant="outline" onClick={() => nav("/scripts")}>Ver Hub de Scripts</Button>
            {text && (
              <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(text); toast.success("Copiado"); }}>
                <Copy className="w-3.5 h-3.5 mr-1" /> Copiar
              </Button>
            )}
          </div>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Cole seu script ou clique em 'Gerar com IA'..."
            rows={5}
            className="font-mono text-xs"
          />
        </div>
      )}
    </div>
  );
}
