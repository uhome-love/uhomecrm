import { useState, useEffect } from "react";
import { useNotificationPreferences } from "@/hooks/useNotifications";
import { usePushSubscription } from "@/hooks/usePushSubscription";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Bell, Save, Loader2, Smartphone, Send } from "lucide-react";

const CATEGORIES = [
  { key: "novo_lead", label: "Novo lead recebido" },
  { key: "lead_aguardando", label: "Lead aguardando contato" },
  { key: "lead_redistribuido", label: "Lead redistribuído" },
  { key: "lead_sem_atendimento", label: "Lead sem atendimento" },
  { key: "corretor_parado", label: "Corretor parado" },
  { key: "visita_confirmada", label: "Visita confirmada" },
  { key: "visita_marcada", label: "Visita marcada" },
  { key: "proposta_enviada", label: "Proposta enviada" },
  { key: "proposta_criada", label: "Proposta criada" },
  { key: "meta_abaixo", label: "Meta do dia abaixo" },
  { key: "venda_assinada", label: "Venda assinada" },
  { key: "volume_leads", label: "Volume alto de leads" },
  { key: "problema_atendimento", label: "Problema de atendimento" },
  { key: "alerta_previsao", label: "Alerta de previsão" },
];

export default function NotificationPreferences() {
  const { preferences, isLoading, updatePreferences } = useNotificationPreferences();
  const { 
    isSupported: pushSupported, 
    isSubscribed: pushSubscribed, 
    isLoading: pushLoading, 
    permission: pushPermission,
    subscribe: subscribePush, 
    unsubscribe: unsubscribePush,
    checkSubscription,
    sendTestPush 
  } = usePushSubscription();
  const [saving, setSaving] = useState(false);

  const [popup, setPopup] = useState(true);
  const [push, setPush] = useState(false);
  const [whatsapp, setWhatsapp] = useState(false);
  const [dashboardAlerts, setDashboardAlerts] = useState(true);
  const [agrupar, setAgrupar] = useState(true);
  const [intervalo, setIntervalo] = useState(5);
  const [silencioInicio, setSilencioInicio] = useState("");
  const [silencioFim, setSilencioFim] = useState("");
  const [silenciadas, setSilenciadas] = useState<string[]>([]);

  // Load preferences from DB
  useEffect(() => {
    if (preferences) {
      setPopup(preferences.popup_enabled);
      // Don't override push state if already subscribed
      if (!pushSubscribed) {
        setPush(preferences.push_enabled);
      }
      setWhatsapp(preferences.whatsapp_enabled);
      setDashboardAlerts(preferences.dashboard_alerts_enabled);
      setAgrupar(preferences.agrupar_similares);
      setIntervalo(preferences.intervalo_minimo_minutos);
      setSilencioInicio(preferences.horario_silencio_inicio || "");
      setSilencioFim(preferences.horario_silencio_fim || "");
      setSilenciadas(preferences.categorias_silenciadas || []);
    }
  }, [preferences, pushSubscribed]);

  // Sync push toggle with actual subscription state
  useEffect(() => {
    if (pushSubscribed) {
      setPush(true);
    }
  }, [pushSubscribed]);

  // Check existing push subscription on mount and when vapidKey loads
  useEffect(() => {
    checkSubscription();
  }, [checkSubscription]);

  const handlePushToggle = async (enabled: boolean) => {
    if (enabled && !pushSubscribed) {
      const success = await subscribePush();
      if (success) {
        setPush(true);
        // Auto-save push_enabled to DB
        updatePreferences({ push_enabled: true });
      }
    } else if (!enabled && pushSubscribed) {
      await unsubscribePush();
      setPush(false);
      updatePreferences({ push_enabled: false });
    } else {
      setPush(enabled);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    await updatePreferences({
      popup_enabled: popup,
      push_enabled: push,
      whatsapp_enabled: whatsapp,
      dashboard_alerts_enabled: dashboardAlerts,
      agrupar_similares: agrupar,
      intervalo_minimo_minutos: intervalo,
      horario_silencio_inicio: silencioInicio || null,
      horario_silencio_fim: silencioFim || null,
      categorias_silenciadas: silenciadas,
    });
    setSaving(false);
  };

  const toggleSilenciada = (key: string) => {
    setSilenciadas((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  if (isLoading) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Bell className="h-5 w-5 text-primary" />
          Notificações
        </CardTitle>
        <CardDescription>Configure como e quando deseja receber notificações</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Canais */}
        <div className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Canais</p>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="popup" className="text-sm">Pop-up no sistema</Label>
              <Switch id="popup" checked={popup} onCheckedChange={setPopup} />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Label htmlFor="push" className="text-sm">Push notification</Label>
                  {pushSubscribed && (
                    <span className="text-[10px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded-full font-medium">
                      Ativo
                    </span>
                  )}
                  {!pushSupported && (
                    <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">
                      Não suportado
                    </span>
                  )}
                  {pushPermission === "denied" && (
                    <span className="text-[10px] bg-destructive/20 text-destructive px-1.5 py-0.5 rounded-full">
                      Bloqueado
                    </span>
                  )}
                </div>
                <Switch
                  id="push"
                  checked={push}
                  onCheckedChange={handlePushToggle}
                  disabled={!pushSupported || pushLoading || pushPermission === "denied"}
                />
              </div>
              {pushSubscribed && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={sendTestPush}
                  className="gap-2 text-xs"
                >
                  <Send className="h-3 w-3" />
                  Enviar teste push
                </Button>
              )}
              {pushPermission === "denied" && (
                <p className="text-xs text-destructive">
                  Permissão bloqueada. Ative nas configurações do navegador (Configurações → Notificações).
                </p>
              )}
              {!pushSupported && (
                <p className="text-xs text-muted-foreground">
                  Instale o app (PWA) para receber push notifications no celular.
                </p>
              )}
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="whatsapp" className="text-sm">WhatsApp</Label>
              <Switch id="whatsapp" checked={whatsapp} onCheckedChange={setWhatsapp} />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="dashboard" className="text-sm">Alertas no dashboard</Label>
              <Switch id="dashboard" checked={dashboardAlerts} onCheckedChange={setDashboardAlerts} />
            </div>
          </div>
        </div>

        {/* Anti-spam */}
        <div className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Anti-spam</p>
          <div className="flex items-center justify-between">
            <Label htmlFor="agrupar" className="text-sm">Agrupar notificações similares</Label>
            <Switch id="agrupar" checked={agrupar} onCheckedChange={setAgrupar} />
          </div>
          <div className="flex items-center gap-3">
            <Label htmlFor="intervalo" className="text-sm whitespace-nowrap">Intervalo mínimo</Label>
            <Input
              id="intervalo"
              type="number"
              min={0}
              max={60}
              value={intervalo}
              onChange={(e) => setIntervalo(Number(e.target.value))}
              className="w-20"
            />
            <span className="text-xs text-muted-foreground">min</span>
          </div>
        </div>

        {/* Horário de silêncio */}
        <div className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Horário de silêncio</p>
          <div className="flex flex-wrap items-center gap-3">
            <div className="space-y-1 flex-1 min-w-[120px]">
              <Label className="text-xs">Início</Label>
              <Input type="time" value={silencioInicio} onChange={(e) => setSilencioInicio(e.target.value)} />
            </div>
            <div className="space-y-1 flex-1 min-w-[120px]">
              <Label className="text-xs">Fim</Label>
              <Input type="time" value={silencioFim} onChange={(e) => setSilencioFim(e.target.value)} />
            </div>
          </div>
        </div>

        {/* Categorias silenciadas */}
        <div className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Categorias silenciadas
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {CATEGORIES.map((cat) => (
              <label key={cat.key} className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={silenciadas.includes(cat.key)}
                  onCheckedChange={() => toggleSilenciada(cat.key)}
                />
                <span className={silenciadas.includes(cat.key) ? "line-through text-muted-foreground" : ""}>
                  {cat.label}
                </span>
              </label>
            ))}
          </div>
        </div>

        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar preferências
        </Button>
      </CardContent>
    </Card>
  );
}
