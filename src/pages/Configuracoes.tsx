import { useState, useEffect, useRef } from "react";
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
import { Loader2, Save, Lock, User, Mail, Phone, Volume2, PartyPopper, Gamepad2, ExternalLink, Upload } from "lucide-react";
import NotificationPreferences from "@/components/notifications/NotificationPreferences";
import MetaAdsSettings from "@/components/marketing/MetaAdsSettings";
import { useUserRole } from "@/hooks/useUserRole";
import { getSoundEnabled, setSoundEnabled, getCelebrationEnabled, setCelebrationEnabled } from "@/lib/celebrations";
import "@google/model-viewer";

export default function Configuracoes() {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [uploadingGlb, setUploadingGlb] = useState(false);

  const glbInputRef = useRef<HTMLInputElement>(null);
  const modelViewerRef = useRef<HTMLElement>(null);

  // Profile fields
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [cargo, setCargo] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);

  // Password fields
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const has3DAvatar = avatarUrl?.includes(".glb") || avatarUrl?.includes(".gltf");

  useEffect(() => {
    if (!user) return;
    loadProfile();
  }, [user]);

  async function loadProfile() {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("nome, email, telefone, cargo, avatar_url, avatar_preview_url")
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
      setAvatarPreviewUrl(data.avatar_preview_url);
    }
    setLoading(false);
  }

  async function generatePreviewPng(glbPublicUrl: string) {
    if (!user) return;
    // Use a hidden model-viewer to capture a screenshot
    const mv = modelViewerRef.current as any;
    if (!mv) return;
    mv.src = glbPublicUrl;

    // Wait for model to fully load and render
    await new Promise<void>((resolve) => {
      const onLoad = () => { mv.removeEventListener("load", onLoad); setTimeout(resolve, 1500); };
      if (mv.loaded) {
        setTimeout(resolve, 1500);
      } else {
        mv.addEventListener("load", onLoad);
        setTimeout(resolve, 10000);
      }
    });

    try {
      const blob = await mv.toBlob({ idealAspect: true });
      const previewPath = `${user.id}/avatar-preview.png`;
      const { error: uploadErr } = await supabase.storage
        .from("avatars")
        .upload(previewPath, blob, { upsert: true, contentType: "image/png" });

      if (uploadErr) {
        console.error("Preview upload error:", uploadErr);
        return;
      }

      const { data: { publicUrl } } = supabase.storage
        .from("avatars")
        .getPublicUrl(previewPath);

      const previewUrlWithBust = `${publicUrl}?t=${Date.now()}`;

      await supabase
        .from("profiles")
        .update({ avatar_preview_url: previewUrlWithBust })
        .eq("user_id", user.id);

      setAvatarPreviewUrl(previewUrlWithBust);
    } catch (err) {
      console.error("Error generating preview:", err);
    }
  }

  async function handleGlbUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Validate extension
    if (!file.name.toLowerCase().endsWith(".glb")) {
      toast.error("Selecione um arquivo .glb válido");
      return;
    }

    // Validate size (50MB)
    if (file.size > 50 * 1024 * 1024) {
      toast.error("O arquivo deve ter no máximo 50MB");
      return;
    }

    setUploadingGlb(true);
    try {
      const filePath = `${user.id}/avatar.glb`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true, contentType: "model/gltf-binary" });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      const urlWithBust = `${publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          avatar_url: urlWithBust,
          avatar_updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);

      if (updateError) throw updateError;

      setAvatarUrl(urlWithBust);
      toast.success("Avatar 3D enviado! 🎮");

      // Generate preview PNG in background
      generatePreviewPng(urlWithBust);
    } catch (err: any) {
      console.error("GLB upload error:", err);
      toast.error("Erro ao enviar avatar: " + (err.message || "tente novamente"));
    } finally {
      setUploadingGlb(false);
      if (glbInputRef.current) glbInputRef.current.value = "";
    }
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
            {/* Avatar Section */}
            <div className="flex items-start gap-4">
              <AvatarUpload
                avatarUrl={has3DAvatar ? avatarPreviewUrl : avatarUrl}
                nome={nome}
                size="lg"
                onUploaded={(url) => {
                  setAvatarUrl(url);
                  setAvatarPreviewUrl(null);
                }}
              />

              {/* 3D Avatar preview */}
              {has3DAvatar && avatarUrl && (
                <div className="rounded-xl overflow-hidden ring-2 ring-indigo-500/40 shadow-lg bg-muted/30"
                     style={{ width: 200, height: 280 }}>
                  {/* @ts-ignore */}
                  <model-viewer
                    src={avatarUrl}
                    camera-orbit="0deg 80deg 2.2m"
                    camera-target="0m 0.9m 0m"
                    auto-rotate
                    rotation-per-second="18deg"
                    interaction-prompt="none"
                    shadow-intensity="0"
                    style={{ width: "100%", height: "100%", background: "transparent" } as React.CSSProperties}
                  />
                </div>
              )}

              <div className="space-y-2 flex-1">
                <p className="text-sm font-medium text-foreground">{nome || "Seu nome"}</p>
                <p className="text-xs text-muted-foreground">Clique na foto para alterar</p>

                {/* Link to Avaturn */}
                <a
                  href="https://avaturn.me"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-indigo-400 hover:text-indigo-300 underline transition-colors"
                >
                  Não tem avatar? Crie gratuitamente em avaturn.me
                  <ExternalLink className="h-3 w-3" />
                </a>

                {/* GLB upload button */}
                <button
                  type="button"
                  onClick={() => glbInputRef.current?.click()}
                  disabled={uploadingGlb}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold transition-colors shadow-sm"
                >
                  {uploadingGlb ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Upload className="h-3.5 w-3.5" />
                  )}
                  {uploadingGlb
                    ? "Enviando avatar..."
                    : has3DAvatar
                    ? "Recriar avatar 3D"
                    : "🎮 Enviar meu avatar 3D (.glb)"}
                </button>

                <input
                  ref={glbInputRef}
                  type="file"
                  accept=".glb"
                  className="hidden"
                  onChange={handleGlbUpload}
                  disabled={uploadingGlb}
                />
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

      {/* Hidden model-viewer for generating preview PNGs */}
      <div style={{ position: "absolute", left: -9999, top: -9999, width: 512, height: 512 }}>
        {/* @ts-ignore */}
        <model-viewer
          ref={modelViewerRef}
          camera-orbit="0deg 80deg 2.2m"
          camera-target="0m 0.9m 0m"
          interaction-prompt="none"
          shadow-intensity="0"
          style={{ width: 512, height: 512, background: "transparent" } as React.CSSProperties}
        />
      </div>
    </div>
  );
}
