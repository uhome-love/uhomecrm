import { useState, useEffect } from "react";
import { Copy, Check, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import {
  getScriptsForStage,
  buildScriptText,
  type ScriptId,
} from "./scriptsByStage";

interface ScriptsCardProps {
  leadName: string;
  leadEmpreendimento?: string;
  leadStage: string;
}

export default function ScriptsCard({
  leadName,
  leadEmpreendimento,
  leadStage,
}: ScriptsCardProps) {
  const { user } = useAuth();
  const [selectedScriptId, setSelectedScriptId] = useState<ScriptId | null>(null);
  const [scriptText, setScriptText] = useState("");
  const [copied, setCopied] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const availableScripts = getScriptsForStage(leadStage);
  const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
  const corretorName =
    (typeof meta.first_name === "string" && meta.first_name) ||
    (typeof meta.full_name === "string" && (meta.full_name as string).split(" ")[0]) ||
    user?.email?.split("@")[0] ||
    "corretor";

  // Gera texto contextualizado ao selecionar script
  useEffect(() => {
    if (!selectedScriptId) {
      setScriptText("");
      return;
    }
    const text = buildScriptText(selectedScriptId, {
      nome: leadName.split(" ")[0],
      empreendimento: leadEmpreendimento || "nosso empreendimento",
      corretor: corretorName,
    });
    setScriptText(text);
  }, [selectedScriptId, leadName, leadEmpreendimento, corretorName]);

  // Reset ao mudar de lead
  useEffect(() => {
    setSelectedScriptId(null);
    setScriptText("");
    setCopied(false);
  }, [leadName]);

  const handleCopy = async () => {
    if (!scriptText.trim()) return;
    try {
      await navigator.clipboard.writeText(scriptText);
      setCopied(true);
      toast.success("Texto copiado!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Erro ao copiar");
    }
  };

  return (
    <div
      className="rounded-xl p-3 space-y-2.5"
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center justify-between text-sm font-semibold text-foreground/90"
      >
        <span className="flex items-center gap-2">
          <span>💬 Scripts</span>
          <span className="text-xs font-normal text-muted-foreground">
            ({availableScripts.length} para {leadStage})
          </span>
        </span>
        {collapsed ? (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        )}
      </button>

      {!collapsed && (
        <>
          <div className="flex flex-wrap gap-1.5">
            {availableScripts.map((script) => (
              <button
                key={script.id}
                type="button"
                onClick={() => setSelectedScriptId(script.id)}
                className={cn(
                  "text-xs px-3 py-1.5 rounded-lg border transition-colors gap-1 inline-flex items-center",
                  selectedScriptId === script.id
                    ? "bg-primary/20 border-primary/50 text-foreground font-medium"
                    : "bg-background/30 border-white/10 text-foreground/70 hover:bg-background/50 hover:text-foreground"
                )}
              >
                <span>{script.emoji}</span>
                <span>{script.label}</span>
              </button>
            ))}
          </div>

          {selectedScriptId ? (
            <>
              <Textarea
                value={scriptText}
                onChange={(e) => setScriptText(e.target.value)}
                className="min-h-[120px] text-sm resize-y border-0"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  color: "#e2e8f0",
                }}
                placeholder="O script aparece aqui — você pode editar antes de copiar"
              />
              <Button
                onClick={handleCopy}
                disabled={!scriptText.trim()}
                className="w-full gap-2"
                variant="secondary"
                size="sm"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4" /> Copiado!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" /> Copiar texto
                  </>
                )}
              </Button>
            </>
          ) : (
            <p className="text-xs text-muted-foreground italic">
              Selecione um script acima para gerar o texto
            </p>
          )}
        </>
      )}
    </div>
  );
}
