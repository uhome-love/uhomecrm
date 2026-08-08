import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, QrCode, RefreshCw, LogOut, Smartphone } from "lucide-react";
import { toast } from "sonner";

type Estado = "open" | "connecting" | "close" | string;

export default function LiaConexao() {
  const [instancia, setInstancia] = useState("uhome-lia-canoas");
  const [estado, setEstado] = useState<Estado>("close");
  const [webhookOk, setWebhookOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrBase64, setQrBase64] = useState<string | null>(null);
  const [qrTimer, setQrTimer] = useState(60);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const invoke = useCallback(async (action: string) => {
    const { data, error } = await supabase.functions.invoke("lia-instance-connect", {
      body: { action },
    });
    if (error) throw error;
    if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
    return data as Record<string, unknown>;
  }, []);

  const carregarStatus = useCallback(async () => {
    try {
      const d = await invoke("status");
      setEstado(String(d.status || "close"));
      setInstancia(String(d.instance_name || "uhome-lia-canoas"));
      setWebhookOk(Boolean(d.webhook_configurado));
    } catch (e) {
      console.error(e);
    }
  }, [invoke]);

  useEffect(() => {
    carregarStatus();
  }, [carregarStatus]);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, []);

  const abrirQr = async (criar: boolean) => {
    setBusy(true);
    try {
      if (criar) await invoke("create");
      const qr = await invoke("qrcode");
      setQrBase64((qr.qrcode as string) || null);
      setQrTimer(60);
      setQrOpen(true);

      if (tickRef.current) clearInterval(tickRef.current);
      tickRef.current = setInterval(() => {
        setQrTimer((t) => {
          if (t <= 1) {
            setQrBase64(null);
            if (tickRef.current) clearInterval(tickRef.current);
            return 0;
          }
          return t - 1;
        });
      }, 1000);

      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(async () => {
        try {
          const d = await invoke("status");
          if (String(d.status) === "open") {
            setEstado("open");
            setQrOpen(false);
            if (pollRef.current) clearInterval(pollRef.current);
            if (tickRef.current) clearInterval(tickRef.current);
            toast.success("Número conectado na instância da Lia");
          }
        } catch {
          /* ignora */
        }
      }, 4000);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao gerar QR");
    } finally {
      setBusy(false);
    }
  };

  const desconectar = async () => {
    setBusy(true);
    try {
      await invoke("disconnect");
      toast.success("Instância desconectada");
      carregarStatus();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao desconectar");
    } finally {
      setBusy(false);
    }
  };

  const conectado = estado === "open";

  return (
    <div className="container mx-auto max-w-3xl p-4 space-y-4">
      <header>
        <h1 className="text-2xl font-semibold">Lia · conexão do número</h1>
        <p className="text-sm text-muted-foreground">
          Chip dedicado da Casa Tua Canoas. A caixa da Lia é isolada: as mensagens vão para
          <code className="mx-1 text-[11px]">ia_mensagens</code>, nunca para o pipeline.
        </p>
      </header>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Smartphone className="h-4 w-4" /> Instância{" "}
              <code className="text-[12px]">{instancia}</code>
            </CardTitle>
            <CardDescription>
              Webhook: {webhookOk ? "configurado para lia-webhook" : "ainda não configurado"}
            </CardDescription>
          </div>
          <Badge variant={conectado ? "default" : "secondary"}>
            {conectado ? "Conectado" : estado === "connecting" ? "Conectando" : "Desconectado"}
          </Badge>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button onClick={() => abrirQr(true)} disabled={busy}>
            {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <QrCode className="mr-1 h-4 w-4" />}
            {conectado ? "Reconectar (QR)" : "Conectar número (QR)"}
          </Button>
          <Button variant="outline" onClick={carregarStatus} disabled={busy}>
            <RefreshCw className="mr-1 h-4 w-4" /> Atualizar status
          </Button>
          {conectado && (
            <Button variant="destructive" onClick={desconectar} disabled={busy}>
              <LogOut className="mr-1 h-4 w-4" /> Desconectar
            </Button>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Conectar o número não liga a Lia: o envio continua desligado e a lista de captura segue vazia
        até você liberar.
      </p>

      <Dialog
        open={qrOpen}
        onOpenChange={(o) => {
          if (!o) {
            setQrOpen(false);
            if (pollRef.current) clearInterval(pollRef.current);
            if (tickRef.current) clearInterval(tickRef.current);
          }
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Escaneie com o WhatsApp da Lia</DialogTitle>
            <DialogDescription>
              No celular dedicado: WhatsApp → Dispositivos conectados → Conectar dispositivo.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-3 py-2">
            {qrBase64 ? (
              <>
                <img
                  src={qrBase64.startsWith("data:") ? qrBase64 : `data:image/png;base64,${qrBase64}`}
                  alt="QR Code de conexão da instância da Lia"
                  className="h-56 w-56 rounded-lg border"
                />
                <span className="text-xs text-muted-foreground">
                  Expira em <strong>{qrTimer}s</strong>
                </span>
              </>
            ) : (
              <div className="flex flex-col items-center gap-3 py-6">
                <p className="text-sm text-muted-foreground">QR Code expirado</p>
                <Button size="sm" onClick={() => abrirQr(false)} disabled={busy}>
                  {busy ? (
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-1 h-4 w-4" />
                  )}
                  Gerar novo QR
                </Button>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQrOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
