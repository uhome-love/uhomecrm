import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface CalendarIntegration {
  connected: boolean;
  email: string | null;
  status: string | null;
  connected_at: string | null;
}

export function useCalendarIntegration() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const query = useQuery<CalendarIntegration>({
    queryKey: ["calendar-integration", user?.id],
    enabled: !!user?.id,
    staleTime: 30_000,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("corretor_calendar_integrations")
        .select("account_email, status, connected_at")
        .eq("corretor_id", user!.id)
        .eq("provider", "google")
        .maybeSingle();
      return {
        connected: data?.status === "active",
        email: data?.account_email ?? null,
        status: data?.status ?? null,
        connected_at: data?.connected_at ?? null,
      };
    },
  });

  const connect = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("google-oauth-start", {
        body: { redirect_origin: window.location.origin },
      });
      if (error) throw error;
      if (!data?.authorize_url) throw new Error("URL de autorização ausente");
      window.location.href = data.authorize_url;
    },
    onError: (e: any) => toast.error(e.message || "Erro ao iniciar conexão"),
  });

  const disconnect = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke("calendar-disconnect");
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Google Calendar desconectado");
      qc.invalidateQueries({ queryKey: ["calendar-integration"] });
    },
    onError: (e: any) => toast.error(e.message || "Erro ao desconectar"),
  });

  return {
    integration: query.data,
    isLoading: query.isLoading,
    refetch: query.refetch,
    connect: connect.mutate,
    disconnect: disconnect.mutate,
    connecting: connect.isPending,
    disconnecting: disconnect.isPending,
  };
}

export async function sendVisitaInvite(visita_id: string) {
  const { data, error } = await supabase.functions.invoke("calendar-create-event", {
    body: { visita_id },
  });
  if (error) throw error;
  return data;
}
