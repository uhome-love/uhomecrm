import { useCallback, useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Cache the VAPID key in memory across hook instances
let cachedVapidKey: string | null = null;
let vapidFetchPromise: Promise<string | null> | null = null;

async function fetchVapidPublicKey(): Promise<string | null> {
  if (cachedVapidKey) return cachedVapidKey;
  if (vapidFetchPromise) return vapidFetchPromise;

  vapidFetchPromise = (async () => {
    try {
      const { data, error } = await supabase.functions.invoke("vapid-public-key");
      if (error) throw error;
      if (data?.publicKey) {
        cachedVapidKey = data.publicKey;
        return cachedVapidKey;
      }
      return null;
    } catch (err) {
      console.warn("Could not fetch VAPID public key:", err);
      return null;
    } finally {
      vapidFetchPromise = null;
    }
  })();

  return vapidFetchPromise;
}

export function usePushSubscription() {
  const { user } = useAuth();
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [vapidKey, setVapidKey] = useState<string | null>(cachedVapidKey);
  const [vapidChecked, setVapidChecked] = useState(!!cachedVapidKey);
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "default"
  );

  const hasBrowserSupport = "serviceWorker" in navigator && "PushManager" in window;

  // Detect iOS not in standalone (PWA) mode
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as any).standalone === true;
  const isIOSNotPWA = isIOS && !isStandalone;

  // Still loading support info if browser supports but vapid not yet checked
  const isCheckingSupport = hasBrowserSupport && !vapidChecked;
  const isSupported = hasBrowserSupport && !!vapidKey;

  // Fetch VAPID key on mount
  useEffect(() => {
    if (!hasBrowserSupport) {
      setVapidChecked(true);
      return;
    }
    fetchVapidPublicKey().then((key) => {
      if (key) setVapidKey(key);
      setVapidChecked(true);
    });
  }, [hasBrowserSupport]);

  const checkSubscription = useCallback(async () => {
    if (!hasBrowserSupport || !vapidKey || !user) return false;
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        setIsSubscribed(false);
        return false;
      }

      // Local subscription exists — verify it's also in the DB. If not, re-sync it.
      const subJson = subscription.toJSON();
      const endpoint = subJson.endpoint!;
      const { data: existing } = await supabase
        .from("push_subscriptions")
        .select("id")
        .eq("user_id", user.id)
        .eq("endpoint", endpoint)
        .maybeSingle();

      if (!existing) {
        console.warn("[push] Local subscription found but missing in DB — re-syncing");
        const { error: upsertErr } = await supabase.from("push_subscriptions").upsert(
          {
            user_id: user.id,
            endpoint,
            p256dh: subJson.keys!.p256dh,
            auth: subJson.keys!.auth,
            user_agent: navigator.userAgent,
            updated_at: new Date().toISOString(),
          } as any,
          { onConflict: "user_id,endpoint" }
        );
        if (upsertErr) {
          console.error("[push] Re-sync failed:", upsertErr);
          setIsSubscribed(false);
          return false;
        }
        toast.success("Push notification re-sincronizado com o servidor 🔄");
      }

      setIsSubscribed(true);
      return true;
    } catch (err) {
      console.error("[push] checkSubscription error:", err);
      return false;
    }
  }, [hasBrowserSupport, vapidKey, user]);

  const subscribe = useCallback(async () => {
    if (!hasBrowserSupport) {
      toast.error("Push notifications não são suportadas neste navegador");
      return false;
    }

    // Ensure we have the VAPID key
    let key = vapidKey;
    if (!key) {
      key = await fetchVapidPublicKey();
      if (key) setVapidKey(key);
    }

    if (!key || !user) {
      toast.error("Configuração de push não disponível. Tente novamente em instantes.");
      return false;
    }

    setIsLoading(true);
    try {
      // Request permission
      const perm = await Notification.requestPermission();
      setPermission(perm);

      if (perm !== "granted") {
        toast.error("Permissão de notificação negada. Ative nas configurações do navegador.");
        setIsLoading(false);
        return false;
      }

      const registration = await navigator.serviceWorker.ready;

      // Subscribe to push — use Uint8Array directly (avoid .buffer offset issues)
      const applicationServerKey = urlBase64ToUint8Array(key);
      // Create a clean ArrayBuffer copy to avoid SharedArrayBuffer type issues
      const keyBuffer = new ArrayBuffer(applicationServerKey.byteLength);
      new Uint8Array(keyBuffer).set(applicationServerKey);
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyBuffer,
      });

      const subJson = subscription.toJSON();

      // Save to database
      const { error } = await supabase.from("push_subscriptions").upsert(
        {
          user_id: user.id,
          endpoint: subJson.endpoint!,
          p256dh: subJson.keys!.p256dh,
          auth: subJson.keys!.auth,
          user_agent: navigator.userAgent,
          updated_at: new Date().toISOString(),
        } as any,
        { onConflict: "user_id,endpoint" }
      );

      if (error) throw error;

      setIsSubscribed(true);
      toast.success("Push notifications ativadas! 🔔");
      return true;
    } catch (err: any) {
      console.error("Push subscription error:", err);
      const detail = err?.message || err?.error_description || String(err);
      toast.error(`Erro ao ativar push: ${detail.substring(0, 120)}`);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [hasBrowserSupport, vapidKey, user]);

  const unsubscribe = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
        await supabase
          .from("push_subscriptions")
          .delete()
          .eq("user_id", user.id)
          .eq("endpoint", subscription.endpoint);
      }
      setIsSubscribed(false);
      toast.success("Push notifications desativadas");
    } catch (err) {
      console.error("Push unsubscribe error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const sendTestPush = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase.functions.invoke("send-push", {
        body: {
          user_id: user.id,
          title: "🏠 Teste UhomeSales",
          body: "Se você recebeu isso, push notifications estão funcionando! 🎉",
          url: "/notificacoes",
        },
      });
      if (error) throw error;
      if (data?.sent > 0) {
        toast.success(`Push enviado para ${data.sent} dispositivo(s)!`);
      } else {
        toast.error("Nenhum dispositivo registrado. Ative as push notifications primeiro.");
      }
    } catch (err: any) {
      console.error("Test push error:", err);
      toast.error("Erro ao enviar teste: " + err.message);
    }
  }, [user]);

  return {
    isSupported,
    isCheckingSupport,
    isIOSNotPWA,
    isSubscribed,
    isLoading,
    permission,
    subscribe,
    unsubscribe,
    checkSubscription,
    sendTestPush,
  };
}
