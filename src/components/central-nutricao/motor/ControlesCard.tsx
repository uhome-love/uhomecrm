import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Sliders, Pause, Play, ShieldAlert, Lock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useUserRole } from "@/hooks/useUserRole";
import { useMotorConfig, useMotorFlags, useMotorActions, useMotorQuality } from "@/hooks/useMotorReengajamento";
import { QualityBadge } from "./SaudeMotorCard";

export default function ControlesCard() {
  const { isAdmin, isDiretor } = useUserRole();
  const canControl = isAdmin || isDiretor;
  const cfgQ = useMotorConfig();
  const flagsQ = useMotorFlags();
  const qualityQ = useMotorQuality();
  const { pause, resume, setGlobalGate, setWarmupInicial } = useMotorActions();
  const [warmupInput, setWarmupInput] = useState<string>("");

  const cfg = cfgQ.data;
  const flags = flagsQ.data;
  const rating = qualityQ.data?.quality_rating ?? "UNKNOWN";
  const dangerousResume = rating === "RED" || rating === "YELLOW";

  async function doPause() {
    try {
      await pause.mutateAsync("Pausa manual via painel Motor");
      toast.success("Motor pausado");
    } catch (e) { toast.error("Erro: " + (e instanceof Error ? e.message : String(e))); }
  }
  async function doResume() {
    try {
      await resume.mutateAsync();
      toast.success("Motor retomado");
    } catch (e) { toast.error("Erro: " + (e instanceof Error ? e.message : String(e))); }
  }
  async function doGate(enabled: boolean) {
    try {
      await setGlobalGate.mutateAsync(enabled);
      toast.success(`Gate global ${enabled ? "ligado" : "desligado"}`);
    } catch (e) { toast.error("Erro: " + (e instanceof Error ? e.message : String(e))); }
  }
  async function doWarmup() {
    const v = parseInt(warmupInput, 10);
    if (!Number.isFinite(v) || v <= 0 || v > 5000) {
      toast.error("Valor inválido (1-5000)");
      return;
    }
    try {
      await setWarmupInicial.mutateAsync(v);
      toast.success(`Warm-up inicial atualizado para ${v}/dia`);
      setWarmupInput("");
    } catch (e) { toast.error("Erro: " + (e instanceof Error ? e.message : String(e))); }
  }

  if (!canControl) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Sliders className="h-4 w-4 text-primary" /> Controles
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <Lock className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Somente Admin ou Diretor podem operar os controles do motor. Você pode ver o estado nas demais seções.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-base flex items-center gap-2">
            <Sliders className="h-4 w-4 text-primary" /> Controles
          </CardTitle>
          <div className="flex items-center gap-2">
            <QualityBadge rating={rating} />
            {cfg?.paused && <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-900 text-[10px]">Pausado</Badge>}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Pausar/Retomar */}
        <div className="rounded-lg border p-3 space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="min-w-0">
              <div className="text-sm font-medium">Estado do disparo</div>
              <p className="text-[11px] text-muted-foreground truncate">
                {cfg?.paused_reason || (cfg?.paused ? "Pausado" : "Ativo")}
              </p>
            </div>
            <div className="flex gap-2">
              {cfg?.paused ? (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" disabled={resume.isPending}>
                      {resume.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Play className="h-3.5 w-3.5 mr-1" />}
                      Retomar
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle className="flex items-center gap-2">
                        {dangerousResume && <ShieldAlert className="h-4 w-4 text-rose-600" />}
                        Retomar o motor?
                      </AlertDialogTitle>
                      <AlertDialogDescription asChild>
                        <div className="space-y-2">
                          <div>Qualidade atual do número: <QualityBadge rating={rating} /></div>
                          {dangerousResume && (
                            <div className="text-rose-700 text-sm">
                              ⚠ Retomar com qualidade {rating === "RED" ? "vermelha" : "amarela"} pode piorar o rating e derrubar o número. Só continue se souber o que está fazendo.
                            </div>
                          )}
                        </div>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={doResume}>Retomar mesmo assim</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : (
                <Button size="sm" variant="outline" onClick={doPause} disabled={pause.isPending}>
                  {pause.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Pause className="h-3.5 w-3.5 mr-1" />}
                  Pausar
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Gate global */}
        <div className="rounded-lg border p-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="min-w-0">
              <div className="text-sm font-medium">Gate global de disparo</div>
              <p className="text-[11px] text-muted-foreground">
                Chave mestra <code className="text-[10px]">campaign_dispatch_enabled</code>. Se desligada, nada sai — nem manual, nem nutrição.
              </p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <div className="flex items-center gap-2">
                  <Switch checked={!!flags?.campaign_dispatch_enabled} onCheckedChange={() => { /* aciona via dialog */ }} />
                  <span className="text-[11px] text-muted-foreground">{flags?.campaign_dispatch_enabled ? "Ligado" : "Desligado"}</span>
                </div>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {flags?.campaign_dispatch_enabled ? "Desligar" : "Ligar"} gate global?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {flags?.campaign_dispatch_enabled
                      ? "Vai congelar todos os disparos (manual, nutrição, reengajamento). Use quando precisar parar tudo imediatamente."
                      : "Vai liberar disparo em todo o sistema. Confirme que a qualidade do número e a fila estão saudáveis."}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={() => doGate(!flags?.campaign_dispatch_enabled)}>Confirmar</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {/* Warm-up inicial */}
        <div className="rounded-lg border p-3 space-y-2">
          <div>
            <div className="text-sm font-medium">Warm-up inicial (msgs/dia)</div>
            <p className="text-[11px] text-muted-foreground">
              Atual: <span className="font-medium">{cfg?.warmup_inicial ?? 0}/dia</span>. Alterar reinicia o ramp a partir do valor novo.
            </p>
          </div>
          <div className="flex gap-2">
            <Label htmlFor="warmup-inicial" className="sr-only">Warm-up inicial</Label>
            <Input
              id="warmup-inicial"
              type="number"
              min={1}
              max={5000}
              placeholder={String(cfg?.warmup_inicial ?? 50)}
              value={warmupInput}
              onChange={(e) => setWarmupInput(e.target.value)}
              className="h-8 max-w-[120px]"
            />
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="outline" disabled={!warmupInput || setWarmupInicial.isPending}>
                  {setWarmupInicial.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : null}
                  Salvar
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Alterar warm-up inicial para {warmupInput}/dia?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Isso reinicia a curva de warm-up com o novo teto de partida. O cap do dia é recalculado no próximo tick.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={doWarmup}>Confirmar</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
