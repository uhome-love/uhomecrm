import { useState, useEffect, useMemo } from "react";
import { Copy, Check, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  getScriptsForStage,
  buildScriptText,
  type ScriptId,
} from "./scriptsByStage";
import { useFocusScripts, type FocusScript } from "@/hooks/useFocusScripts";

interface ScriptsCardProps {
  leadName: string;
  leadEmpreendimento?: string;
  leadStage: string;
}

const SOURCE_BADGE: Record<FocusScript["source"] | "default", { emoji: string; label: string; cls: string }> = {
  marketplace: { emoji: "⭐", label: "Marketplace", cls: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30" },
  team:        { emoji: "👥", label: "Do Time",    cls: "bg-blue-500/15 text-blue-300 border-blue-500/30" },
  default:     { emoji: "📝", label: "Padrão",     cls: "bg-white/10 text-foreground/70 border-white/15" },
};

function fillVars(text: string, vars: { nome: string; empreendimento: string; corretor: string }) {
  return text
    .replace(/\{\{?nome\}?\}/g, vars.nome || "cliente")
    .replace(/\{\{?empreendimento\}?\}/g, vars.empreendimento || "nosso empreendimento")
    .replace(/\{\{?corretor\}?\}/g, vars.corretor || "corretor");
}

export default function ScriptsCard({
  leadName,
  leadEmpreendimento,
  leadStage,
}: ScriptsCardProps) {
  const { user } = useAuth();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [scriptText, setScriptText] = useState("");
  const [copied, setCopied] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const { scripts: realScripts, source, isLoading } = useFocusScripts({
    leadStage,
    empreendimento: leadEmpreendimento,
  });

  const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
  const corretorName =
    (typeof meta.first_name === "string" && meta.first_name) ||
    (typeof meta.full_name === "string" && (meta.full_name as string).split(" ")[0]) ||
    user?.email?.split("@")[0] ||
    "corretor";

  // Fallback default (hardcoded) — só se marketplace e time vazios.
  const defaultOptions = useMemo(() => {
    if (source !== "default") return [];
    return getScriptsForStage(leadStage).map((s) => ({
      key: `default-${s.id}`,
      label: s.label,
      emoji: s.emoji,
      source: "default" as const,
      scriptId: s.id as ScriptId,
    }));
  }, [source, leadStage]);

  const options = source === "default" ? defaultOptions : realScripts;
  const currentSource: FocusScript["source"] | "default" = source;
  const badge = SOURCE_BADGE[currentSource];

  // Reset ao mudar lead ou fonte
  useEffect(() => {
    setSelectedKey(null);
    setScriptText("");
    setCopied(false);
  }, [leadName, source]);

  // Gera texto ao selecionar
  useEffect(() => {
    if (!selectedKey) {
      setScriptText("");
      return;
    }
    const nome = leadName.split(" ")[0];
    const empreendimento = leadEmpreendimento || "nosso empreendimento";
    if (currentSource === "default") {
      const opt = defaultOptions.find((o) => o.key === selectedKey);
      if (!opt) return;
      setScriptText(buildScriptText(opt.scriptId, { nome, empreendimento, corretor: corretorName }));
    } else {
      const opt = realScripts.find((s) => s.key === selectedKey);
      if (!opt) return;
      setScriptText(fillVars(opt.content, { nome, empreendimento, corretor: corretorName }));
    }
  }, [selectedKey, leadName, leadEmpreendimento, corretorName, currentSource, defaultOptions, realScripts]);

  const handleCopy = async () => {
    if (!scriptText.trim()) return;
    try {
      await navigator.clipboard.writeText(scriptText);
      setCopied(true);
      toast.success("Texto copiado!");
      setTimeout(() => setCopied(false), 2000);

      // Registra uso no Marketplace (best-effort, sem bloquear UX)
      if (currentSource === "marketplace") {
        const opt = realScripts.find((s) => s.key === selectedKey);
        if (opt?.marketplaceId && user?.id) {
          supabase.from("marketplace_usage").insert({
            item_id: opt.marketplaceId,
            user_id: user.id,
          } as any).then(() => {
            // trigger no BD atualiza total_usos
          }, () => { /* silent */ });
        }
      }
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
        className="w-full flex items-center justify-between text-sm font-semibold text-foreground"
      >
        <span className="flex items-center gap-2 flex-wrap">
          <span>💬 Scripts</span>
          <span className={cn("text-[10px] px-1.5 py-0.5 rounded-md border font-medium", badge.cls)}>
            {badge.emoji} {badge.label}
          </span>
          <span className="text-xs font-normal text-foreground/75">
            ({isLoading ? "…" : options.length} para {leadStage})
          </span>
        </span>
        {collapsed ? (
          <ChevronDown className="w-4 h-4 text-foreground/70" />
        ) : (
          <ChevronUp className="w-4 h-4 text-foreground/70" />
        )}
      </button>

      {!collapsed && (
        <>
          <div className="flex flex-wrap gap-1.5">
            {options.map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setSelectedKey(opt.key)}
                className={cn(
                  "text-xs px-3 py-1.5 rounded-lg border transition-colors gap-1 inline-flex items-center",
                  selectedKey === opt.key
                    ? "bg-primary/20 border-primary/50 text-foreground font-medium"
                    : "bg-background/40 border-border/60 text-foreground/85 hover:bg-background/60 hover:text-foreground"
                )}
                title={opt.label}
              >
                <span>{opt.emoji}</span>
                <span className="truncate max-w-[160px]">{opt.label}</span>
              </button>
            ))}
            {!isLoading && options.length === 0 && (
              <p className="text-xs text-foreground/60 italic">Nenhum script disponível para esta etapa.</p>
            )}
          </div>

          {selectedKey ? (
            <>
              <Textarea
                value={scriptText}
                onChange={(e) => setScriptText(e.target.value)}
                className="min-h-[120px] text-sm resize-y text-foreground bg-background/60 border border-border/50 placeholder:text-muted-foreground/60"
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
            options.length > 0 && (
              <p className="text-xs text-foreground/60 italic">
                Selecione um script acima para gerar o texto
              </p>
            )
          )}
        </>
      )}
    </div>
  );
}
