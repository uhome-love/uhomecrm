/**
 * PlacarTvPage — página fullscreen dedicada para exibição em TV.
 * Sem AppLayout, sem sidebar, sem chrome. Busca a sessão ao vivo atual.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PlacarTv } from "@/components/oferta-ativa-ao-vivo/PlacarTv";
import { Loader2, Radio } from "lucide-react";

export default function PlacarTvPage() {
  const sessaoQ = useQuery({
    queryKey: ["placar-tv", "sessao-ao-vivo"],
    queryFn: async () => {
      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from("oferta_ativa_sessoes")
        .select("*")
        .eq("status", "ao_vivo")
        .lte("inicio_at", nowIso)
        .gte("fim_at", nowIso)
        .order("inicio_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    refetchInterval: 60_000,
  });

  if (sessaoQ.isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-white/70" />
      </div>
    );
  }

  if (!sessaoQ.data) {
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

  return <PlacarTv sessaoId={sessaoQ.data.id} />;
}
