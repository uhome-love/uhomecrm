/**
 * PlacarTvPage — página fullscreen para a TV da empresa (pública, sem login).
 * Mostra o ranking de ligações da Oferta Ativa (fonte única: oa_ranking_ligacoes).
 */
import { TvRankingLigacoes } from "@/components/oferta-ativa-ao-vivo/TvRankingLigacoes";

export default function PlacarTvPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950 p-8 text-white">
      <TvRankingLigacoes />
    </div>
  );
}
