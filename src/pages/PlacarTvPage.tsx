/**
 * PlacarTvPage — página fullscreen dedicada para exibição em TV.
 * Público (sem login). Usa a RPC `rpc_placar_mutirao` (SECURITY DEFINER) para carregar sessão + dados.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PlacarTv } from "@/components/oferta-ativa-ao-vivo/PlacarTv";
import { Loader2, Radio } from "lucide-react";

export default function PlacarTvPage() {
  const q = useQuery({
    queryKey: ["placar-tv-public"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rpc_placar_mutirao");
      if (error) throw error;
      return data as {
        sessao: { id: string; status: string; inicio_at: string; fim_at: string; data: string } | null;
        corretores: any[];
        equipes: any[];
        feed: any[];
      } | null;
    },
    refetchInterval: 15_000,
    refetchOnWindowFocus: false,
  });

  if (q.isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-white/70" />
      </div>
    );
  }

  if (q.error) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-8">
        <div className="text-center max-w-lg">
          <h1 className="text-2xl font-black mb-3 text-red-400">Erro ao carregar o placar</h1>
          <p className="text-white/60 text-sm font-mono">{(q.error as Error).message}</p>
        </div>
      </div>
    );
  }

  const sessao = q.data?.sessao ?? null;

  if (!sessao) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-purple-950 text-white flex items-center justify-center p-8">
        <div className="text-center">
          <Radio className="w-16 h-16 mx-auto mb-6 text-white/40" />
          <h1 className="text-4xl font-black mb-3">Nenhum Mutirão ao vivo agora</h1>
          <p className="text-white/60 text-lg">O placar aparecerá aqui automaticamente quando um mutirão começar.</p>
        </div>
      </div>
    );
  }

  return (
    <PlacarTv
      sessaoId={sessao.id}
      overrideData={{
        corretores: q.data?.corretores ?? [],
        equipes: q.data?.equipes ?? [],
        feed: q.data?.feed ?? [],
      }}
    />
  );
}
