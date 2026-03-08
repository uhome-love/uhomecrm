import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import AvatarUpload from "@/components/AvatarUpload";
import { Loader2, Save, Lock, User, Mail, Phone, Volume2, PartyPopper, Sparkles, RefreshCw } from "lucide-react";
import NotificationPreferences from "@/components/notifications/NotificationPreferences";
import MetaAdsSettings from "@/components/marketing/MetaAdsSettings";
import { useUserRole } from "@/hooks/useUserRole";
import { getSoundEnabled, setSoundEnabled, getCelebrationEnabled, setCelebrationEnabled } from "@/lib/celebrations";

export default function Configuracoes() {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  // Profile fields
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [cargo, setCargo] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [gamifiedAvatarUrl, setGamifiedAvatarUrl] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);

  // Password fields
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    if (!user) return;
    loadProfile();
  }, [user]);

  async function loadProfile() {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("nome, email, telefone, cargo, avatar_url, avatar_gamificado_url")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      console.error("Erro ao carregar perfil:", error);
    }

    if (data) {
      setNome(data.nome || "");
      setEmail(data.email || user.email || "");
      setTelefone(data.telefone || "");
      setCargo(data.cargo || "");
      setAvatarUrl(data.avatar_url);
      setGamifiedAvatarUrl((data as any).avatar_gamificado_url);
    }
    setLoading(false);
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);

    const { error } = await supabase
      .from("profiles")
      .update({
        nome: nome.trim(),
        telefone: telefone.trim(),
        cargo: cargo.trim(),
      })
      .eq("user_id", user.id);

    if (error) {
      toast.error("Erro ao salvar perfil: " + error.message);
    } else {
      toast.success("Perfil atualizado com sucesso!");
    }
    setSaving(false);
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!newPassword || !confirmPassword) {
      toast.error("Preencha todos os campos de senha.");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("A nova senha deve ter no mínimo 6 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("As senhas não coincidem.");
      return;
    }

    setChangingPassword(true);

    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      toast.error("Erro ao trocar senha: " + error.message);
    } else {
      toast.success("Senha alterada com sucesso!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    }
    setChangingPassword(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gerencie seu perfil e altere sua senha
        </p>
      </div>

      {/* Profile Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <User className="h-5 w-5 text-primary" />
            Dados do Perfil
          </CardTitle>
          <CardDescription>Atualize suas informações pessoais</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveProfile} className="space-y-5">
            {/* Avatar */}
            <div className="flex items-center gap-4">
              <AvatarUpload
                avatarUrl={avatarUrl}
                nome={nome}
                size="lg"
                onUploaded={(url) => setAvatarUrl(url)}
                onGamifiedGenerated={(url) => setGamifiedAvatarUrl(url)}
              />
              {gamifiedAvatarUrl && (
                <div className="relative group">
                  <div className="h-20 w-20 rounded-full overflow-hidden ring-2 ring-primary/40 shadow-lg">
                    <img src={gamifiedAvatarUrl} alt="Avatar gamificado" className="h-full w-full object-cover" />
                  </div>
                  <div className="absolute -bottom-1 -right-1 bg-primary text-primary-foreground rounded-full p-1">
                    <Sparkles className="h-3 w-3" />
                  </div>
                </div>
              )}
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">{nome || "Seu nome"}</p>
                <p className="text-xs text-muted-foreground">Clique na foto para alterar</p>
                {avatarUrl && (
                  <button
                    type="button"
                    disabled={regenerating}
                    onClick={async () => {
                      setRegenerating(true);
                      const toastId = toast.loading("✨ Regenerando avatar gamificado...");
                      try {
                        const { data, error } = await supabase.functions.invoke("generate-avatar", {
                          body: { photo_url: avatarUrl },
                        });
                        if (error) throw error;
                        if (data?.error) throw new Error(data.error);
                        if (data?.url) {
                          setGamifiedAvatarUrl(data.url);
                          toast.success("🎮 Avatar regenerado!", { id: toastId });
                        }
                      } catch (err: any) {
                        toast.error("Erro ao regenerar: " + (err.message || "tente novamente"), { id: toastId });
                      } finally {
                        setRegenerating(false);
                      }
                    }}
                    className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
                  >
                    {regenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                    {gamifiedAvatarUrl ? "Regenerar avatar gamificado" : "Gerar avatar gamificado"}
                  </button>
                )}
              </div>
            </div>

            <Separator />

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="nome" className="flex items-center gap-1.5 text-xs">
                  <User className="h-3.5 w-3.5" /> Nome
                </Label>
                <Input
                  id="nome"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Seu nome completo"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email-display" className="flex items-center gap-1.5 text-xs">
                  <Mail className="h-3.5 w-3.5" /> Email
                </Label>
                <Input
                  id="email-display"
                  value={email}
                  disabled
                  className="opacity-60"
                />
                <p className="text-[10px] text-muted-foreground">O email não pode ser alterado</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="telefone" className="flex items-center gap-1.5 text-xs">
                  <Phone className="h-3.5 w-3.5" /> Telefone
                </Label>
                <Input
                  id="telefone"
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  placeholder="(00) 00000-0000"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cargo" className="flex items-center gap-1.5 text-xs">
                  Cargo
                </Label>
                <Input
                  id="cargo"
                  value={cargo}
                  disabled
                  className="opacity-60"
                />
              </div>
            </div>

            <Button type="submit" disabled={saving} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar alterações
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Integrations - Admin only */}
      {isAdmin && <MetaAdsSettings />}

      {/* Notification Preferences */}
      <NotificationPreferences />

      {/* Sound & Celebration Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <PartyPopper className="h-5 w-5 text-primary" />
            Experiência
          </CardTitle>
          <CardDescription>Sons e celebrações do sistema</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="flex items-center gap-1.5 text-sm">
                <Volume2 className="h-3.5 w-3.5" /> Sons de notificação
              </Label>
              <p className="text-xs text-muted-foreground">Toques sonoros ao registrar ações</p>
            </div>
            <Switch
              checked={getSoundEnabled()}
              onCheckedChange={(v) => { setSoundEnabled(v); toast.success(v ? "🔔 Sons ativados!" : "🔇 Sons desativados."); }}
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="flex items-center gap-1.5 text-sm">
                <PartyPopper className="h-3.5 w-3.5" /> Celebrações visuais
              </Label>
              <p className="text-xs text-muted-foreground">Confete e animações ao bater metas</p>
            </div>
            <Switch
              checked={getCelebrationEnabled()}
              onCheckedChange={(v) => { setCelebrationEnabled(v); toast.success(v ? "🎉 Celebrações ativadas!" : "Celebrações desativadas."); }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Password Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Lock className="h-5 w-5 text-primary" />
            Alterar Senha
          </CardTitle>
          <CardDescription>Defina uma nova senha para sua conta</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password" className="text-xs">Nova senha</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                minLength={6}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password" className="text-xs">Confirmar nova senha</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repita a nova senha"
                minLength={6}
                required
              />
            </div>

            <Button type="submit" variant="outline" disabled={changingPassword} className="gap-2">
              {changingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
              Alterar senha
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
