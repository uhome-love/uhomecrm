import { useState } from "react";
import { Sparkles, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { useUhomeIa } from "@/hooks/useUhomeIa";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

interface IaCoreActionProps {
  module: string;
  prompt: string;
  context?: any;
  label?: string;
  variant?: "default" | "outline" | "secondary" | "ghost";
  size?: "default" | "sm" | "lg";
  className?: string;
}

export default function IaCoreAction({
  module,
  prompt,
  context,
  label = "Gerar Análise IA",
  variant = "secondary",
  size = "sm",
  className = "",
}: IaCoreActionProps) {
  const { analyze, loading } = useUhomeIa();
  const [result, setResult] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);

  const handleClick = async () => {
    try {
      const text = await analyze({ module, prompt, context });
      setResult(text);
      setShowResult(true);
    } catch {
      toast.error("Erro ao gerar análise IA.");
    }
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={handleClick}
        disabled={loading}
        className={`gap-1.5 ${className}`}
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
        {loading ? "Analisando..." : label}
      </Button>

      <AnimatePresence>
        {showResult && result && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 rounded-xl border border-border bg-muted/50 p-4 relative"
          >
            <Button
              variant="ghost"
              size="sm"
              className="absolute top-2 right-2 h-6 w-6 p-0"
              onClick={() => setShowResult(false)}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">UHOME IA</span>
            </div>
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <ReactMarkdown>{result}</ReactMarkdown>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
