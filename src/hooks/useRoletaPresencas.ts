// =============================================================================
// useRoletaPresencas — presenças validadas do dia + mutação para marcar
// =============================================================================
import { useCallback, useEffect, useMemo } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { PresencaRow, PresencaStatus } from "@/lib/roletaPresenca";
import { toast } from "sonner";

function todayBRT(): string {
  const now = new Date();
  const tz = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return tz; // YYYY-MM-DD
}

export function useRoletaPresencas(data?: string) {
  const qc = useQueryClient();
  const dataAlvo = data ?? todayBRT();

  const query = useQuery({
    queryKey: ["roleta-presencas", dataAlvo],
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("roleta_presencas")
        .select("id, corretor_id, data, turno, status, chegou_em, saiu_em")
        .eq("data", dataAlvo);
      if (error) throw error;
      return (rows ?? []) as PresencaRow[];
    },
    staleTime: 15_000,
  });

  useEffect(() => {
    const channel = supabase
      .channel(`roleta-presencas-${dataAlvo}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "roleta_presencas", filter: `data=eq.${dataAlvo}` },
        () => {
          qc.invalidateQueries({ queryKey: ["roleta-presencas", dataAlvo] });
          qc.invalidateQueries({ queryKey: ["dash-v4-dia"] });
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [dataAlvo, qc]);

  // Mapa por corretor_id → { turno → presenca }
  const mapa = useMemo(() => {
    const m = new Map<string, Record<string, PresencaRow>>();
    for (const p of query.data ?? []) {
      const rec = m.get(p.corretor_id) ?? {};
      rec[p.turno] = p;
      m.set(p.corretor_id, rec);
    }
    return m;
  }, [query.data]);

  const marcar = useMutation({
    mutationFn: async (input: {
      corretor_id: string;
      turnos: string[];
      status: PresencaStatus;
      observacao?: string;
      data?: string;
    }) => {
      const { data, error } = await supabase.rpc("roleta_marcar_presenca", {
        p_corretor_id: input.corretor_id,
        p_data: input.data ?? dataAlvo,
        p_turnos: input.turnos,
        p_status: input.status,
        p_observacao: input.observacao ?? null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["roleta-presencas", dataAlvo] });
      qc.invalidateQueries({ queryKey: ["dash-v4-dia"] });
    },
    onError: (err: any) => {
      toast.error(err?.message ?? "Erro ao marcar presença");
    },
  });

  const getPresenca = useCallback(
    (corretor_id: string, turno: string): PresencaRow | undefined => {
      return mapa.get(corretor_id)?.[turno];
    },
    [mapa],
  );

  return {
    presencas: query.data ?? [],
    isLoading: query.isLoading,
    getPresenca,
    marcar: marcar.mutate,
    marcarAsync: marcar.mutateAsync,
    isMutating: marcar.isPending,
    mapa,
  };
}
