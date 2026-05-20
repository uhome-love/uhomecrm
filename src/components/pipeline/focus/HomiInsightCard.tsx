import { Sparkles, Loader2 } from "lucide-react";

interface Props {
  loading: boolean;
  insight: string;
}

export default function HomiInsightCard({ loading, insight }: Props) {
  return (
    <div
      className="rounded-xl p-3.5"
      style={{
        background: "linear-gradient(135deg, rgba(79,70,229,0.1), rgba(124,58,237,0.08))",
        border: "1px solid rgba(79,70,229,0.2)",
      }}
    >
      <div className="flex items-center gap-1.5 mb-2">
        <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
        <span className="text-indigo-300 text-xs font-semibold">HOMI Insight</span>
      </div>
      {loading ? (
        <div className="flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
          <span className="text-gray-400 text-xs">Analisando histórico do lead...</span>
        </div>
      ) : (
        <p className="text-gray-300 text-xs leading-relaxed">{insight || "Sem insight disponível."}</p>
      )}
    </div>
  );
}
