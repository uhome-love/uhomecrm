import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Save, CheckCircle2, XCircle, Wifi, BarChart3 } from "lucide-react";
import { toast } from "sonner";

export default function MetaAdsSettings() {
  const { user } = useAuth();
  const [accessToken, setAccessToken] = useState("");
  const [accountId, setAccountId] = useState("");
  const [cplLimit, setCplLimit] = useState("80");
  const [autoSync, setAutoSync] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    loadSettings();
  }, [user]);

  async function loadSettings() {
    if (!user) return;
    const { data } = await supabase
      .from("integration_settings")
      .select("key, value")
      .in("key", ["meta_ads_access_token", "meta_ads_account_id", "meta_ads_cpl_limit", "meta_ads_auto_sync"]);

    const map: Record<string, string> = {};
    (data || []).forEach((s) => { map[s.key] = s.value; });

    if (map.meta_ads_access_token) setAccessToken(map.meta_ads_access_token);
    if (map.meta_ads_account_id) setAccountId(map.meta_ads_account_id);
    if (map.meta_ads_cpl_limit) setCplLimit(map.meta_ads_cpl_limit);
    if (map.meta_ads_auto_sync) setAutoSync(map.meta_ads_auto_sync === "true");
    setLoading(false);
  }

  async function saveSetting(key: string, value: string) {
    const { data: existing } = await supabase
      .from("integration_settings")
      .select("id")
      .eq("key", key)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("integration_settings")
        .update({ value, updated_by: user!.id, updated_at: new Date().toISOString() })
        .eq("key", key);
    } else {
      await supabase
        .from("integration_settings")
        .insert({ key, value, updated_by: user!.id, label: key } as any);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      await Promise.all([
        saveSetting("meta_ads_access_token", accessToken.trim()),
        saveSetting("meta_ads_account_id", accountId.trim()),
        saveSetting("meta_ads_cpl_limit", cplLimit),
        saveSetting("meta_ads_auto_sync", autoSync ? "true" : "false"),
      ]);
      toast.success("Configurações do Meta Ads salvas!");
    } catch {
      toast.error("Erro ao salvar configurações");
    }
    setSaving(false);
  }

  async function handleTestConnection() {
    setTesting(true);
    setTestResult(null);
    try {
      // Save first so edge function can read them
      await handleSave();

      const { data: session } = await (supabase.auth as any).getSession();
      const { data, error } = await supabase.functions.invoke("meta-ads-sync", {
        body: { mode: "test" },
        headers: { Authorization: `Bearer ${session.session?.access_token}` },
      });

      if (error) throw error;
      setTestResult({ success: data.success, message: data.message || data.error });
    } catch (e: any) {
      setTestResult({ success: false, message: e.message || "Erro ao testar conexão" });
    }
    setTesting(false);
  }

  if (loading) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <BarChart3 className="h-5 w-5 text-primary" />
          Meta Ads (Facebook / Instagram)
        </CardTitle>
        <CardDescription>
          Conecte sua conta do Meta Ads para importar dados de campanhas automaticamente
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="meta-token" className="text-xs">Access Token</Label>
            <Input
              id="meta-token"
              type="password"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              placeholder="EAAxxxxxxx..."
            />
            <p className="text-[10px] text-muted-foreground">
              Gere em developers.facebook.com → Marketing API
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="meta-account" className="text-xs">Account ID</Label>
            <Input
              id="meta-account"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              placeholder="act_123456789"
            />
            <p className="text-[10px] text-muted-foreground">
              Formato: act_ seguido do número da conta
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="cpl-limit" className="text-xs">Limite de CPL para alerta (R$)</Label>
            <Input
              id="cpl-limit"
              type="number"
              value={cplLimit}
              onChange={(e) => setCplLimit(e.target.value)}
              placeholder="80"
            />
            <p className="text-[10px] text-muted-foreground">
              Notifica o CEO quando o CPL de uma campanha ultrapassa este valor
            </p>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg border border-border">
            <div>
              <p className="text-sm font-medium">Sincronizar automaticamente</p>
              <p className="text-[10px] text-muted-foreground">Atualiza dados a cada 6 horas</p>
            </div>
            <Switch checked={autoSync} onCheckedChange={setAutoSync} />
          </div>
        </div>

        {testResult && (
          <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
            testResult.success
              ? "bg-green-500/10 text-green-700 dark:text-green-400 border border-green-500/20"
              : "bg-destructive/10 text-destructive border border-destructive/20"
          }`}>
            {testResult.success
              ? <CheckCircle2 className="h-4 w-4 shrink-0" />
              : <XCircle className="h-4 w-4 shrink-0" />}
            {testResult.message}
          </div>
        )}

        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar
          </Button>
          <Button
            variant="outline"
            onClick={handleTestConnection}
            disabled={testing || !accessToken || !accountId}
            className="gap-2"
          >
            {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wifi className="h-4 w-4" />}
            Testar Conexão
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
