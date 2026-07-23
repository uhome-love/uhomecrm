import { useMutiraoRanking } from "@/hooks/useMutiraoRealtime";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Trophy, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const MEDALS = ["🥇", "🥈", "🥉"];

export function RankingPanel({ sessaoId }: { sessaoId: string | null }) {
  const { data, isLoading } = useMutiraoRanking(sessaoId);
  const { user } = useAuth();
  const { data: myProfileId } = useQuery({
    queryKey: ["rank-my-profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id").eq("user_id", user!.id).maybeSingle();
      return data?.id ?? null;
    },
  });

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 flex justify-center">
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!data?.corretores?.length) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-center">
        <Trophy className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
        <p className="text-xs text-muted-foreground">Nenhum participante ainda.</p>
      </div>
    );
  }

  const rows = data.corretores;
  const rank = (key: "pontos" | "visitas" | "ligacoes") =>
    [...rows].sort((a, b) => (b as any)[key] - (a as any)[key]);

  const RankList = ({ items, metric }: { items: any[]; metric: "pontos" | "visitas" | "ligacoes" }) => (
    <div className="space-y-0.5">
      {items.slice(0, 10).map((c, i) => {
        const isMe = c.corretor_id === myProfileId;
        const isPodium = i < 3;
        return (
          <div
            key={c.corretor_id}
            className={cn(
              "flex items-center gap-2.5 px-2 py-1.5 rounded-md transition-colors",
              isMe ? "bg-primary/10 ring-1 ring-primary/30" : "hover:bg-muted/60",
            )}
          >
            <span className={cn(
              "w-6 text-center text-sm tabular-nums shrink-0",
              isPodium ? "text-base" : "text-xs font-semibold text-muted-foreground",
            )}>
              {isPodium ? MEDALS[i] : i + 1}
            </span>
            <Avatar className="h-7 w-7">
              {c.foto_url && <AvatarImage src={c.foto_url} alt={c.nome} />}
              <AvatarFallback className="text-[10px]">{(c.nome || "?").slice(0, 1).toUpperCase()}</AvatarFallback>
            </Avatar>
            <span className={cn("text-sm truncate flex-1", isMe && "font-semibold text-foreground")}>
              {c.nome}{isMe && <span className="ml-1 text-[10px] text-primary font-bold">VOCÊ</span>}
            </span>
            <span className="text-sm font-bold tabular-nums text-foreground">{(c as any)[metric]}</span>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <Trophy className="w-4 h-4 text-warning-500" />
        <p className="text-sm font-semibold text-foreground">Ranking ao vivo</p>
      </div>
      <div className="p-2">
        <Tabs defaultValue="pontos">
          <TabsList className="grid grid-cols-3 h-8 w-full mb-2">
            <TabsTrigger value="pontos" className="text-xs h-7">Pontos</TabsTrigger>
            <TabsTrigger value="visitas" className="text-xs h-7">Visitas</TabsTrigger>
            <TabsTrigger value="ligacoes" className="text-xs h-7">Ligações</TabsTrigger>
          </TabsList>
          <TabsContent value="pontos"><RankList items={rank("pontos")} metric="pontos" /></TabsContent>
          <TabsContent value="visitas"><RankList items={rank("visitas")} metric="visitas" /></TabsContent>
          <TabsContent value="ligacoes"><RankList items={rank("ligacoes")} metric="ligacoes" /></TabsContent>
        </Tabs>
      </div>
      <p className="text-[10px] text-muted-foreground px-3 py-2 border-t border-border bg-muted/30">
        Visita = 10 pts · Aproveitamento = 4 pts · Ligação = 1 pt
      </p>
    </div>
  );
}
