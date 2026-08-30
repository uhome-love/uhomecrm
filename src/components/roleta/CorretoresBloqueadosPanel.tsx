import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert, Unlock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface BloqueadoInfo {
  corretor_id: string;
  nome: string;
  avatar_url: string | null;
  descartes_mes: number;
  ja_desbloqueado: boolean;
}

interface Props {
  teamUserIds?: string[];
}

export default function CorretoresBloqueadosPanel({ teamUserIds }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const mesAtual = format(new Date(), "yyyy-MM");

  const { data: bloqueados = [], isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["corretores-bloqueados-descarte", teamUserIds, mesAtual],
    queryFn: async () => {
      // Fonte única: mesma contagem usada por roleta_motivo_bloqueio (sem cap de 1000 linhas).
      const { data, error } = await supabase.rpc("roleta_bloqueados_descarte" as any);
      if (error) throw error;

      return ((data || []) as any[])
        .filter((r) => !teamUserIds || teamUserIds.includes(r.corretor_id))
        .map((r) => ({
          corretor_id: r.corretor_id,
          nome: r.nome || "Corretor",
          avatar_url: r.avatar_url,
          descartes_mes: r.descartes_mes ?? 0,
          ja_desbloqueado: !!r.ja_desbloqueado,
        })) as BloqueadoInfo[];
    },
    refetchInterval: 60_000,
  });


  const unblockMutation = useMutation({
    mutationFn: async (corretorId: string) => {
      const { error } = await supabase.from("roleta_desbloqueios" as any).insert({
        corretor_id: corretorId,
        desbloqueado_por: user?.id,
        mes: mesAtual,
        motivo: "Desbloqueio manual via dashboard",
      } as any);
      if (error) throw error;
    },
    onSuccess: (_, corretorId) => {
      const nome = bloqueados.find((b) => b.corretor_id === corretorId)?.nome;
      toast.success(`${nome} desbloqueado da roleta com sucesso`);
      queryClient.invalidateQueries({ queryKey: ["corretores-bloqueados-descarte"] });
    },
    onError: () => toast.error("Erro ao desbloquear corretor"),
  });

  const reblockMutation = useMutation({
    mutationFn: async (corretorId: string) => {
      const { error } = await supabase
        .from("roleta_desbloqueios" as any)
        .delete()
        .eq("corretor_id", corretorId)
        .eq("mes", mesAtual);
      if (error) throw error;
    },
    onSuccess: (_, corretorId) => {
      const nome = bloqueados.find((b) => b.corretor_id === corretorId)?.nome;
      toast.success(`Bloqueio de ${nome} restaurado`);
      queryClient.invalidateQueries({ queryKey: ["corretores-bloqueados-descarte"] });
    },
    onError: () => toast.error("Erro ao restaurar bloqueio"),
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando bloqueios...
      </div>
    );
  }

  if (isError) {
    return (
      <Card className="border-destructive/30 bg-destructive/5">
        <CardContent className="py-6 space-y-3 text-center">
          <p className="text-sm font-medium flex items-center justify-center gap-2">
            <ShieldAlert className="h-4 w-4 text-destructive" />
            Não foi possível carregar a lista de bloqueados
          </p>
          <p className="text-xs text-muted-foreground break-words">
            {(error as any)?.message || "Erro desconhecido"}
          </p>
          <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
            Tentar de novo
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (bloqueados.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Nenhum corretor bloqueado por descartes este mês.
        </CardContent>
      </Card>
    );
  }


  const stillBlocked = bloqueados.filter((b) => !b.ja_desbloqueado);
  const alreadyUnblocked = bloqueados.filter((b) => b.ja_desbloqueado);

  return (
    <Card className="border-destructive/30 bg-destructive/5 dark:bg-destructive/10">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-destructive" />
          Corretores bloqueados por descartes
          <Badge variant="destructive" className="text-[10px]">
            {stillBlocked.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
          {stillBlocked.map((b) => (
            <div
              key={b.corretor_id}
              className="flex items-center justify-between gap-3 p-2.5 rounded-xl border border-destructive/20 bg-card"
            >
              <div className="flex items-center gap-3 min-w-0">
                <Avatar className="h-8 w-8">
                  {b.avatar_url && <AvatarImage src={b.avatar_url} />}
                  <AvatarFallback className="text-xs bg-destructive/10 text-destructive">
                    {b.nome.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{b.nome}</p>
                  <p className="text-[11px] text-destructive">
                    {b.descartes_mes} descartes este mês
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="shrink-0 gap-1.5 text-xs border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10"
                onClick={() => unblockMutation.mutate(b.corretor_id)}
                disabled={unblockMutation.isPending}
              >
                {unblockMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Unlock className="h-3.5 w-3.5" />
                )}
                Desbloquear
              </Button>
            </div>
          ))}
          {alreadyUnblocked.map((b) => (
            <div
              key={b.corretor_id}
              className="flex items-center justify-between gap-3 p-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5"
            >
              <div className="flex items-center gap-3 min-w-0">
                <Avatar className="h-8 w-8">
                  {b.avatar_url && <AvatarImage src={b.avatar_url} />}
                  <AvatarFallback className="text-xs bg-emerald-500/10 text-emerald-600">
                    {b.nome.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{b.nome}</p>
                  <p className="text-[11px] text-emerald-600">
                    ✓ Desbloqueado manualmente ({b.descartes_mes} descartes)
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="shrink-0 text-xs text-muted-foreground hover:text-destructive"
                onClick={() => reblockMutation.mutate(b.corretor_id)}
                disabled={reblockMutation.isPending}
              >
                Reverter
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
