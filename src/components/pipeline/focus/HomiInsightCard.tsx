import { useState, useEffect } from "react";
import { Sparkles, Loader2, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  insight: string | null;
  loading: boolean;
  onGenerate: () => void;
  onRegenerate: () => void;
}

export default function HomiInsightCard({ insight, loading, onGenerate, onRegenerate }: Props) {
  const [confirmingRegenerate, setConfirmingRegenerate] = useState(false);

  // Reset confirm UI quando o insight muda (troca de lead / regen concluído)
  useEffect(() => {
    setConfirmingRegenerate(false);
  }, [insight]);

  const wrapperStyle = {
    background: "linear-gradient(135deg, rgba(79,70,229,0.1), rgba(124,58,237,0.08))",
    border: "1px solid rgba(79,70,229,0.2)",
  } as const;

  const Header = (
    <div className="flex items-center gap-1.5 mb-2">
      <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
      <span className="text-indigo-300 text-xs font-semibold">HOMI Insight</span>
    </div>
  );

  // Loading
  if (loading) {
    return (
      <div className="rounded-xl p-3.5" style={wrapperStyle}>
        {Header}
        <div className="flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
          <span className="text-muted-foreground text-xs">Analisando histórico do lead...</span>
        </div>
      </div>
    );
  }

  // Vazio
  if (!insight) {
    return (
      <div className="rounded-xl p-3.5 space-y-2" style={wrapperStyle}>
        {Header}
        <p className="text-muted-foreground text-xs leading-relaxed">
          Receba uma análise contextualizada deste lead quando precisar.
        </p>
        <Button
          onClick={onGenerate}
          size="sm"
          className="w-full gap-2 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-200 border border-indigo-400/30"
        >
          <Sparkles className="w-3.5 h-3.5" />
          Gerar insight
        </Button>
      </div>
    );
  }

  // Confirmando regenerar
  if (confirmingRegenerate) {
    return (
      <div className="rounded-xl p-3.5 space-y-2" style={wrapperStyle}>
        {Header}
        <p className="text-foreground text-xs leading-relaxed">
          Gerar novo insight? Vai substituir o atual.
        </p>
        <div className="flex gap-2">
          <Button
            onClick={() => setConfirmingRegenerate(false)}
            size="sm"
            variant="outline"
            className="flex-1 gap-1.5"
          >
            <X className="w-3.5 h-3.5" />
            Cancelar
          </Button>
          <Button
            onClick={() => {
              setConfirmingRegenerate(false);
              onRegenerate();
            }}
            size="sm"
            className="flex-1 gap-1.5 bg-indigo-500/30 hover:bg-indigo-500/40 text-indigo-100 border border-indigo-400/40"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Sim, gerar
          </Button>
        </div>
      </div>
    );
  }

  // Com insight
  return (
    <div className="rounded-xl p-3.5 space-y-2" style={wrapperStyle}>
      {Header}
      <p className="text-foreground text-xs leading-relaxed">{insight}</p>
      <button
        type="button"
        onClick={() => setConfirmingRegenerate(true)}
        className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
      >
        <RefreshCw className="w-3 h-3" />
        Regenerar
      </button>
    </div>
  );
}
