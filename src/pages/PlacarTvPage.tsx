/**
 * PlacarTvPage — página fullscreen dedicada para exibição em TV.
 * Público (sem login). Usa a RPC `rpc_placar_mutirao` (SECURITY DEFINER) para carregar sessão + dados.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PlacarTv } from "@/components/oferta-ativa-ao-vivo/PlacarTv";
import { Loader2, Radio } from "lucide-react";
import { TvRankingLigacoes } from "@/components/oferta-ativa-ao-vivo/TvRankingLigacoes";

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
        <div className="flex w-full flex-col items-center gap-8 text-center">
          <TvRankingLigacoes />
          <div className="flex items-center gap-3 text-white/60">
            <Radio className="h-6 w-6 text-white/40" />
            <p className="text-lg">Nenhum Mutirão ao vivo agora. O placar do Mutirão aparece aqui quando começar.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
    <PlacarTv
      rodapePx={52}
      sessaoId={sessao.id}
      overrideData={{
        corretores: q.data?.corretores ?? [],
        equipes: q.data?.equipes ?? [],
        feed: q.data?.feed ?? [],
      }}
    />
    <div className="fixed inset-x-0 bottom-0 z-50 h-[52px]"><TvRankingLigacoes faixa /></div>
    </>
  );
}
