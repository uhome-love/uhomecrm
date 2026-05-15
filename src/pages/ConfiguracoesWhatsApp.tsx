import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { MessageSquare, Shield, Loader2, Wifi, WifiOff, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type WaStatus = "conectado" | "aguardando_qr" | "desconectado" | "loading";

async function invokeWa(action: string) {
  const { data, error } = await supabase.functions.invoke("whatsapp-connect", {
    body: { action },
  });
  if (error) throw error;
  return data;
}

export default function ConfiguracoesWhatsApp() {
  const { toast } = useToast();
  const [status, setStatus] = useState<WaStatus>("loading");
  const [qrBase64, setQrBase64] = useState<string | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [busy, setBusy] = useState(false);
  const [timer, setTimer] = useState(60);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch status on mount
  useEffect(() => {
    fetchStatus();
    return () => stopPolling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchStatus() {
    try {
      const res = await invokeWa("status");
      const state = res?.status ?? "close";
      const map: Record<string, WaStatus> = {
        open: "conectado",
        close: "desconectado",
        connecting: "aguardando_qr",
      };
      setStatus(map[state] ?? "desconectado");
    } catch {
      setStatus("desconectado");
    }
  }

  function stopPolling() {
    if (pollingRef.current) clearInterval(pollingRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    pollingRef.current = null;
    timerRef.current = null;
  }

  function startPolling() {
    stopPolling();
    pollingRef.current = setInterval(async () => {
      try {
        const res = await invokeWa("status");
        const state = res?.status ?? "close";
        if (state === "open") {
          setStatus("conectado");
          setQrOpen(false);
          stopPolling();
          toast({ title: "WhatsApp conectado com sucesso!" });
        }
      } catch {
        // keep polling
      }
    }, 3000);
  }

  function startTimer() {
    setTimer(60);
    timerRef.current = setInterval(() => {
      setTimer((t) => {
        if (t <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          timerRef.current = null;
          setQrBase64(null);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  }

  const handleConnect = useCallback(async () => {
    setBusy(true);
    try {
      await invokeWa("create");
      const qrRes = await invokeWa("qrcode");
      const qr = qrRes?.qrcode;
      if (!qr) throw new Error("QR Code não disponível");
      setQrBase64(typeof qr === "string" ? qr : JSON.stringify(qr));
      setQrOpen(true);
      startPolling();
      startTimer();
    } catch (err: any) {
      toast({ title: "Erro ao conectar", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleNewQr = useCallback(async () => {
    setBusy(true);
    try {
      const qrRes = await invokeWa("qrcode");
      const qr = qrRes?.qrcode;
      if (!qr) throw new Error("QR Code não disponível");
      setQrBase64(typeof qr === "string" ? qr : JSON.stringify(qr));
      startTimer();
      startPolling();
    } catch (err: any) {
      toast({ title: "Erro ao gerar QR", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDisconnect = useCallback(async () => {
    setBusy(true);
    try {
      await invokeWa("disconnect");
      setStatus("desconectado");
      setConfirmDisconnect(false);
      toast({ title: "WhatsApp desconectado" });
    } catch (err: any) {
      toast({ title: "Erro ao desconectar", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }, [toast]);

  const handleCloseQr = () => {
    setQrOpen(false);
    stopPolling();
  };

  const badgeConfig: Record<string, { label: string; className: string }> = {
    conectado: { label: "Conectado", className: "bg-green-500/15 text-green-700 border-green-300" },
    aguardando_qr: { label: "Aguardando", className: "bg-yellow-500/15 text-yellow-700 border-yellow-300 animate-pulse" },
    desconectado: { label: "Desconectado", className: "bg-muted text-muted-foreground border-border" },
    loading: { label: "Carregando...", className: "bg-muted text-muted-foreground border-border animate-pulse" },
  };

  const badge = badgeConfig[status];

  return (
    <div className="min-h-screen bg-[#f7f7fb] p-4 pb-24 max-w-lg mx-auto space-y-4">
      <h1 className="text-xl font-bold text-foreground">WhatsApp</h1>

      {/* Status Card */}
      <Card>
        <CardHeader className="flex-row items-center gap-3 space-y-0 pb-2">
          {status === "conectado" ? (
            <Wifi className="h-7 w-7 text-green-600" />
          ) : (
            <WifiOff className="h-7 w-7 text-muted-foreground" />
          )}
          <div className="flex-1">
            <CardTitle className="text-base">Meu WhatsApp</CardTitle>
            <p className="text-sm text-muted-foreground mt-0.5">
              {status === "conectado" ? "Conectado e ativo" : "Não conectado"}
            </p>
          </div>
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${badge.className}`}>
            {badge.label}
          </span>
        </CardHeader>
        <CardContent className="pt-0 flex gap-2">
          {status !== "conectado" && (
            <Button onClick={handleConnect} disabled={busy || status === "loading"} className="flex-1">
              {busy ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <MessageSquare className="h-4 w-4 mr-1" />}
              Conectar meu WhatsApp
            </Button>
          )}
          {status === "conectado" && (
            <Button variant="destructive" onClick={() => setConfirmDisconnect(true)} disabled={busy} className="flex-1">
              Desconectar
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Privacy Card */}
      <Card>
        <CardHeader className="flex-row items-center gap-3 space-y-0">
          <Shield className="h-5 w-5 text-primary" />
          <CardTitle className="text-sm font-semibold">Privacidade</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Apenas conversas com contatos cadastrados como leads no UhomeSales são registradas. Suas conversas pessoais não são acessadas ou armazenadas.
          </p>
        </CardContent>
      </Card>

      {/* QR Code Modal */}
      <Dialog open={qrOpen} onOpenChange={(o) => { if (!o) handleCloseQr(); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Escaneie com seu WhatsApp</DialogTitle>
            <DialogDescription>
              Abra o WhatsApp no celular → Dispositivos conectados → Conectar dispositivo → Escaneie o código
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center gap-3 py-2">
            {qrBase64 ? (
              <>
                <img
                  src={qrBase64.startsWith("data:") ? qrBase64 : `data:image/png;base64,${qrBase64}`}
                  alt="QR Code WhatsApp"
                  className="w-56 h-56 rounded-lg border"
                />
                <span className="text-xs text-muted-foreground">
                  QR Code expira em <strong>{timer}s</strong>
                </span>
              </>
            ) : (
              <div className="flex flex-col items-center gap-3 py-6">
                <p className="text-sm text-muted-foreground">QR Code expirado</p>
                <Button size="sm" onClick={handleNewQr} disabled={busy}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
                  Gerar novo QR Code
                </Button>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseQr}>Cancelar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disconnect Confirmation */}
      <Dialog open={confirmDisconnect} onOpenChange={setConfirmDisconnect}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Desconectar WhatsApp?</DialogTitle>
            <DialogDescription>
              Você não receberá mais notificações de mensagens dos seus leads até reconectar.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmDisconnect(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDisconnect} disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
