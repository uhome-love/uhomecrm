import { useMutiraoRanking } from "@/hooks/useMutiraoRealtime";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Trophy, Loader2 } from "lucide-react";

export function RankingPanel({ sessaoId }: { sessaoId: string | null }) {
  const { data, isLoading } = useMutiraoRanking(sessaoId);

  if (isLoading) return <div className="flex justify-center py-6"><Loader2 className="w-4 h-4 animate-spin" /></div>;
  if (!data?.corretores?.length) return <div className="text-xs text-muted-foreground p-4">Nenhum participante ainda.</div>;

  const rows = data.corretores;

  const rank = (key: "pontos" | "visitas" | "aproveitamentos" | "ligacoes") =>
    [...rows].sort((a, b) => (b as any)[key] - (a as any)[key]);

  const List = ({ items, metric }: { items: any[]; metric: keyof typeof rows[0] }) => (
    <div className="space-y-1">
      {items.slice(0, 10).map((c, i) => (
        <div key={c.corretor_id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/40">
          <span className={`text-xs font-bold w-5 text-center ${i === 0 ? "text-amber-500" : "text-muted-foreground"}`}>
            {i + 1}
          </span>
          {c.foto_url ? <img src={c.foto_url} className="w-6 h-6 rounded-full object-cover" /> : (
            <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px]">{(c.nome || "?").slice(0, 1)}</div>
          )}
          <span className="text-sm truncate flex-1">{c.nome}</span>
          <span className="text-sm font-bold tabular-nums">{(c as any)[metric]}</span>
        </div>
      ))}
    </div>
  );

  return (
    <div className="rounded-xl border border-border bg-card p-2">
      <div className="flex items-center gap-2 px-2 pb-1 text-sm font-semibold">
        <Trophy className="w-4 h-4 text-amber-500" /> Ranking ao vivo
      </div>
      <Tabs defaultValue="pontos">
        <TabsList className="grid grid-cols-3 h-8 mx-2 mb-2">
          <TabsTrigger value="pontos" className="text-xs h-7">Pontos</TabsTrigger>
          <TabsTrigger value="visitas" className="text-xs h-7">Visitas</TabsTrigger>
          <TabsTrigger value="ligacoes" className="text-xs h-7">Ligações</TabsTrigger>
        </TabsList>
        <TabsContent value="pontos"><List items={rank("pontos")} metric="pontos" /></TabsContent>
        <TabsContent value="visitas"><List items={rank("visitas")} metric="visitas" /></TabsContent>
        <TabsContent value="ligacoes"><List items={rank("ligacoes")} metric="ligacoes" /></TabsContent>
      </Tabs>
      <p className="text-[10px] text-muted-foreground px-2 pt-2 border-t">
        Visita = 10 pts · Aproveitamento = 4 pts · Ligação = 1 pt
      </p>
    </div>
  );
}
