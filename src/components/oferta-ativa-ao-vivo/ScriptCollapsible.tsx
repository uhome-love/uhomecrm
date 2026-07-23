import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ChevronDown, ChevronUp, FileText, Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import type { LeadOferta } from "@/hooks/useMutiraoSession";

export function ScriptCollapsible({ lead: _lead }: { lead: LeadOferta | null }) {
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");

  return (
    <div className="rounded-xl border border-border bg-card">
      <button
        className="w-full flex items-center justify-between px-4 py-2 text-sm font-medium"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="flex items-center gap-2"><FileText className="w-3.5 h-3.5 text-primary" /> Script de abordagem</span>
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {open && (
        <div className="px-4 pb-3 space-y-2">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Cole aqui o script que você quer usar nessa ligação. Ele fica só nesta sessão."
            rows={8}
            className="font-mono text-xs"
          />
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => nav("/scripts")}>
              <ExternalLink className="w-3.5 h-3.5 mr-1" /> Ver Hub de Scripts
            </Button>
            {text && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => { navigator.clipboard.writeText(text); toast.success("Copiado"); }}
              >
                <Copy className="w-3.5 h-3.5 mr-1" /> Copiar
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
