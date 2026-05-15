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

  const { data: bloqueados = [], isLoading } = useQuery({
    queryKey: ["corretores-bloqueados-descarte", teamUserIds, mesAtual],
    queryFn: async () => {
      // Get discard limit
      const { data: configData } = await supabase
        .from("roleta_config")
        .select("valor")
        .eq("chave", "limite_descartes_mes")
        .single();
      const limite = configData?.valor ? parseInt(configData.valor) : 50;

      // Get discard stage
      const stageDescarte = "1dd66c25-3848-4053-9f66-82e902989b4d";
      const monthStart = format(new Date(), "yyyy-MM-01");

      // Get all corretores with discards this month
      const { data: leads } = await supabase
        .from("pipeline_leads")
        .select("corretor_id")
        .eq("stage_id", stageDescarte)
        .gte("stage_changed_at", monthStart);

      if (!leads?.length) return [];

      // Count per corretor
      const countMap: Record<string, number> = {};
      for (const l of leads) {
        if (!l.corretor_id) continue;
        if (teamUserIds && !teamUserIds.includes(l.corretor_id)) continue;
        countMap[l.corretor_id] = (countMap[l.corretor_id] || 0) + 1;
      }

      // Filter only blocked ones
      const blockedIds = Object.entries(countMap)
        .filter(([, count]) => count >= limite)
        .map(([id]) => id);

      if (!blockedIds.length) return [];

      // Get profiles
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, nome, avatar_url")
        .in("user_id", blockedIds);

      // Check existing overrides
      const { data: overrides } = await supabase
        .from("roleta_desbloqueios" as any)
        .select("corretor_id")
        .eq("mes", mesAtual)
        .in("corretor_id", blockedIds);

      const overrideSet = new Set((overrides || []).map((o: any) => o.corretor_id));

      return (profiles || []).map((p) => ({
        corretor_id: p.user_id,
        nome: p.nome || "Corretor",
        avatar_url: p.avatar_url,
        descartes_mes: countMap[p.user_id] || 0,
        ja_desbloqueado: overrideSet.has(p.user_id),
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

  // Don't render if no blocked brokers
  if (isLoading || bloqueados.length === 0) return null;

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
