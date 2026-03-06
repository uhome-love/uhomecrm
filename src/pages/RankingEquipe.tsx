import { Trophy } from "lucide-react";
import RankingPanel from "@/components/oferta-ativa/RankingPanel";

export default function RankingEquipe() {
  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
          <Trophy className="h-6 w-6 text-primary" /> Ranking Corretores OA
        </h1>
        <p className="text-sm text-muted-foreground">Veja quem está mandando bem na Oferta Ativa e busque o topo! 🔥</p>
      </div>
      <RankingPanel />
    </div>
  );
}
