import { useEffect, useRef } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";

export interface Notification {
  id: string;
  user_id: string;
  tipo: string;
  categoria: string;
  titulo: string;
  mensagem: string;
  dados: Record<string, any>;
  lida: boolean;
  lida_em: string | null;
  agrupamento_key: string | null;
  agrupamento_count: number;
  cargo_destino: string[] | null;
  created_at: string;
}

/** Map app roles to the cargo_destino values used in DB */
function roleToCargo(roles: string[]): string {
  if (roles.includes("admin")) return "admin";
  if (roles.includes("gestor")) return "gestor";
  if (roles.includes("backoffice")) return "backoffice";
  return "corretor";
}

export function useNotifications() {
  const { user } = useAuth();
  const { roles } = useUserRole();
  const queryClient = useQueryClient();
  const cargo = roleToCargo(roles);

  // Track already-toasted notification IDs to prevent duplicate toasts
  const toastedIds = useRef(new Set<string>());
  const seededInitialIds = useRef(false);

  const { data: preferences } = useQuery({
    queryKey: ["notification-preferences", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notification_preferences")
        .select("popup_enabled")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const popupEnabled = preferences?.popup_enabled ?? true;

  const getNotificationUrl = (notification: Notification | Record<string, any>) => {
    const dados = notification?.dados as Record<string, any> | undefined;
    if (typeof dados?.url === "string" && dados.url.length > 0) return dados.url;

    const leadId = dados?.pipeline_lead_id || dados?.lead_id;
    if (typeof leadId === "string" && leadId.length > 0) {
      return `/aceite?lead=${leadId}`;
    }

    return "/notificacoes";
  };

  const showDesktopNotification = async (notification: Notification) => {
    if (typeof window === "undefined" || typeof Notification === "undefined") return;
    if (Notification.permission !== "granted") return;

    const options = {
      body: notification.mensagem,
      icon: "/icons/icon-192x192.png",
      badge: "/icons/icon-192x192.png",
      tag: `notif-${notification.id}`,
      renotify: true,
      requireInteraction: ["novo_lead", "lead_novo", "lead_urgente", "lead_ultimo_alerta"].includes(notification.categoria),
      data: { url: getNotificationUrl(notification) },
    };

    if ("serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(notification.titulo, options);
      return;
    }

    new Notification(notification.titulo, options);
  };

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ["notifications", user?.id, cargo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, user_id, tipo, categoria, titulo, mensagem, dados, lida, lida_em, agrupamento_key, agrupamento_count, cargo_destino, created_at")
        .eq("user_id", user!.id)
        .or(`cargo_destino.cs.{${cargo}},cargo_destino.is.null`)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      const results = data as unknown as Notification[];
      if (!seededInitialIds.current) {
        results.forEach((n) => toastedIds.current.add(n.id));
        seededInitialIds.current = true;
      }
      return results;
    },
    enabled: !!user,
    refetchInterval: 60000,
  });

  const unreadCount = notifications.filter((n) => !n.lida).length;

  // Realtime subscription — deduplicated toasts
  useEffect(() => {
    if (!user) return;

    if (!seededInitialIds.current) {
      toastedIds.current.clear();
      seededInitialIds.current = false;
    }

    const channel = supabase
      .channel("notifications-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
        },
        (payload) => {
          const n = payload.new as any;
          if (n.user_id !== user.id) return;
          // Skip if already toasted (prevents repeats on reconnect/remount)
          if (toastedIds.current.has(n.id)) return;
          toastedIds.current.add(n.id);
          // Cap the set size to prevent memory leaks
          if (toastedIds.current.size > 200) {
            const arr = Array.from(toastedIds.current);
            toastedIds.current = new Set(arr.slice(-100));
          }

          queryClient.invalidateQueries({ queryKey: ["notifications", user.id] });

          if (!popupEnabled) return;

          const notification = n as Notification;
          const shouldShowDesktop = document.visibilityState !== "visible";

          if (shouldShowDesktop) {
            void showDesktopNotification(notification).catch(() => undefined);
          }

          toast(notification.titulo, {
            description: notification.mensagem,
            id: `notif-${notification.id}`,
            action: {
              label: "Abrir",
              onClick: () => window.location.assign(getNotificationUrl(notification)),
            },
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient, popupEnabled]);

  // Auto-refresh on tab visibility
  useEffect(() => {
    if (!user) return;
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        queryClient.invalidateQueries({ queryKey: ["notifications", user.id] });
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [user, queryClient]);

  const markAsRead = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from("notifications")
        .update({ lida: true, lida_em: new Date().toISOString() } as any)
        .eq("id", notificationId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications", user?.id] }),
  });

  const markAllAsRead = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("marcar_todas_notificacoes_lidas");
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications", user?.id] }),
  });

  const deleteNotification = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from("notifications")
        .delete()
        .eq("id", notificationId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications", user?.id] }),
  });

  return {
    notifications,
    unreadCount,
    isLoading,
    markAsRead: markAsRead.mutate,
    markAllAsRead: markAllAsRead.mutate,
    deleteNotification: deleteNotification.mutate,
  };
}

export function useNotificationPreferences() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: preferences, isLoading } = useQuery({
    queryKey: ["notification-preferences", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const updatePreferences = useMutation({
    mutationFn: async (updates: Record<string, any>) => {
      if (preferences) {
        const { error } = await supabase
          .from("notification_preferences")
          .update({ ...updates, updated_at: new Date().toISOString() } as any)
          .eq("user_id", user!.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("notification_preferences")
          .insert({ user_id: user!.id, ...updates } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-preferences", user?.id] });
      toast.success("Preferências salvas!");
    },
  });

  return { preferences, isLoading, updatePreferences: updatePreferences.mutate };
}
