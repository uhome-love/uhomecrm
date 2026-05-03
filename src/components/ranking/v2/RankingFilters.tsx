import { useEffect, useState } from "react";
import { fetchEquipes } from "@/hooks/useRankingsData";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users } from "lucide-react";

interface Props {
  equipeId?: string;
  onEquipeChange: (id: string | undefined) => void;
  showEquipe: boolean;
}

export default function RankingFilters({ equipeId, onEquipeChange, showEquipe }: Props) {
  const [equipes, setEquipes] = useState<{ user_id: string; nome: string }[]>([]);

  useEffect(() => {
    if (!showEquipe) return;
    fetchEquipes().then(setEquipes);
  }, [showEquipe]);

  if (!showEquipe) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Users className="h-3.5 w-3.5" /> Equipe:
      </div>
      <Select value={equipeId || "all"} onValueChange={(v) => onEquipeChange(v === "all" ? undefined : v)}>
        <SelectTrigger className="w-[200px] h-8 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas as equipes</SelectItem>
          {equipes.map(eq => (
            <SelectItem key={eq.user_id} value={eq.user_id}>{eq.nome}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
