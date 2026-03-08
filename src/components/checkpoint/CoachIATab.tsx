import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, RefreshCw } from "lucide-react";
import { type CheckpointRow, type MetasMes, fmtR } from "@/pages/CheckpointGerente";

interface Props {
  rows: CheckpointRow[];
  metasMes: MetasMes;
  dateFmt: string;
}

export default function CoachIATab({ rows, metasMes, dateFmt }: Props) {
  const [analysis, setAnalysis] = useState("");
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    setAnalysis("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/homi-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          message: `Analise o checkpoint do time de hoje (${dateFmt}).\nDados:\n${rows.map(r => `- ${r.nome}: ${r.presenca}, ${r.res_ligacoes}/${r.meta_ligacoes} lig, ${r.res_aproveitados}/${r.meta_aproveitados} aprov, ${r.res_visitas_marcadas} visitas, status: ${r.status}`).join("\n")}\nMetas mês: VGV ${fmtR(metasMes.vgv_realizado)}/${fmtR(metasMes.vgv_meta)}, Visitas ${metasMes.visitas_realizadas_realizado}/${metasMes.visitas_realizadas_meta}, Ligações ${metasMes.ligacoes_realizado}/${metasMes.ligacoes_meta}.\nIdentifique gargalos e sugira ações práticas.`,
          context: "checkpoint_gerente",
        }),
      });
      const json = await res.json();
      setAnalysis(json.response ?? json.message ?? "Sem resposta.");
    } catch {
      setAnalysis("Erro ao conectar com o HOMI. Tente novamente.");
    }
    setLoading(false);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-b-xl rounded-tr-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
            <Sparkles size={18} className="text-blue-600" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-800">HOMI — Coach de Performance</h2>
            <p className="text-xs text-gray-400">IA que analisa o desempenho do time e sugere ações práticas</p>
          </div>
        </div>
        <button onClick={run} disabled={loading} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-all disabled:opacity-70">
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          {loading ? "Analisando..." : "Analisar Semana"}
        </button>
      </div>

      {!analysis && !loading && (
        <div className="text-center py-16 text-gray-400">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <Sparkles size={24} className="text-gray-300" />
          </div>
          <p className="font-medium">Clique em "Analisar Semana"</p>
          <p className="text-xs mt-1">O HOMI irá analisar metas vs resultados, identificar gargalos e sugerir ações.</p>
        </div>
      )}

      {loading && (
        <div className="text-center py-16 text-gray-400">
          <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-3 animate-pulse">
            <Sparkles size={24} className="text-blue-400" />
          </div>
          <p className="text-sm">Analisando dados do time...</p>
        </div>
      )}

      {analysis && !loading && (
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={14} className="text-blue-500" />
            <span className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Análise do HOMI</span>
          </div>
          <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{analysis}</div>
        </div>
      )}
    </div>
  );
}
