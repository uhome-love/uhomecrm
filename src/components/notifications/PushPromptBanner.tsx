import { useState, useEffect } from "react";
import { usePushSubscription } from "@/hooks/usePushSubscription";
import { useAuth } from "@/hooks/useAuth";
import { Bell, X, Download, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";

/**
 * Detects if the app is running as an installed PWA (standalone mode).
 */
function useIsInstalled() {
  const [installed, setInstalled] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(display-mode: standalone)");
    setInstalled(mq.matches || (navigator as any).standalone === true);
    const handler = (e: MediaQueryListEvent) => setInstalled(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return installed;
}

const DISMISS_KEY = "uhome_push_prompt_dismissed";
const INSTALL_DISMISS_KEY = "uhome_install_prompt_dismissed";

export default function PushPromptBanner() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const isInstalled = useIsInstalled();
  const {
    isSubscribed,
    isLoading,
    permission,
    subscribe,
  } = usePushSubscription();

  const [dismissed, setDismissed] = useState(true);
  const [installDismissed, setInstallDismissed] = useState(true);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  // Listen for install prompt (Android/Chrome)
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  // Check dismissal state
  useEffect(() => {
    if (!user) return;
    const pushDismissed = localStorage.getItem(`${DISMISS_KEY}_${user.id}`);
    const installDism = localStorage.getItem(`${INSTALL_DISMISS_KEY}_${user.id}`);
    // Show again after 7 days
    if (pushDismissed) {
      const ts = parseInt(pushDismissed, 10);
      setDismissed(Date.now() - ts < 7 * 24 * 60 * 60 * 1000);
    } else {
      setDismissed(false);
    }
    if (installDism) {
      const ts = parseInt(installDism, 10);
      setInstallDismissed(Date.now() - ts < 7 * 24 * 60 * 60 * 1000);
    } else {
      setInstallDismissed(false);
    }
  }, [user]);

  const handleDismiss = (type: "push" | "install") => {
    if (!user) return;
    const key = type === "push" ? DISMISS_KEY : INSTALL_DISMISS_KEY;
    localStorage.setItem(`${key}_${user.id}`, Date.now().toString());
    if (type === "push") setDismissed(true);
    else setInstallDismissed(true);
  };

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const result = await deferredPrompt.userChoice;
      if (result.outcome === "accepted") {
        setDeferredPrompt(null);
        handleDismiss("install");
      }
    }
  };

  const handleSubscribe = async () => {
    const success = await subscribe();
    if (success) handleDismiss("push");
  };

  if (!user) return null;

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

  // Step 1: Show install prompt if on mobile and not installed
  if (isMobile && !isInstalled && !installDismissed) {
    return (
      <div className="mx-3 mt-2 mb-1 rounded-xl border border-primary/30 bg-primary/5 p-3 flex items-start gap-3 animate-in slide-in-from-top-2 duration-300">
        <div className="rounded-full bg-primary/10 p-2 shrink-0">
          <Download className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">Instale o UhomeSales</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isIOS
              ? "Toque em Compartilhar (⬆) → \"Adicionar à Tela de Início\" para receber notificações push."
              : "Instale o app para receber notificações push em tempo real."}
          </p>
          <div className="flex gap-2 mt-2">
            {!isIOS && deferredPrompt && (
              <Button size="sm" onClick={handleInstall} className="gap-1.5 h-8 text-xs">
                <Smartphone className="h-3.5 w-3.5" />
                Instalar agora
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleDismiss("install")}
              className="h-8 text-xs text-muted-foreground"
            >
              Depois
            </Button>
          </div>
        </div>
        <button
          onClick={() => handleDismiss("install")}
          className="text-muted-foreground hover:text-foreground p-0.5"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  // Step 2: Show push notification prompt if installed (or desktop) and not subscribed
  if (
    isSubscribed ||
    dismissed ||
    isLoading ||
    permission === "denied"
  )
    return null;

  // On mobile, only show if installed as PWA
  if (isMobile && !isInstalled) return null;

  return (
    <div className="mx-3 mt-2 mb-1 rounded-xl border border-primary/30 bg-primary/5 p-3 flex items-start gap-3 animate-in slide-in-from-top-2 duration-300">
      <div className="rounded-full bg-primary/10 p-2 shrink-0">
        <Bell className="h-5 w-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground">Ative as notificações push</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Receba alertas de novos leads e tarefas em tempo real, mesmo com o app fechado.
        </p>
        <div className="flex gap-2 mt-2">
          <Button size="sm" onClick={handleSubscribe} className="gap-1.5 h-8 text-xs">
            <Bell className="h-3.5 w-3.5" />
            Ativar push
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleDismiss("push")}
            className="h-8 text-xs text-muted-foreground"
          >
            Depois
          </Button>
        </div>
      </div>
      <button
        onClick={() => handleDismiss("push")}
        className="text-muted-foreground hover:text-foreground p-0.5"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
