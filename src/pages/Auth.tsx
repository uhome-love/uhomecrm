import { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { Mail, Lock, Loader2, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import UhomeSalesLogo from "@/components/brand/UhomeSalesLogo";
import { AuthBrandPanel, AuthMobileHeader } from "@/components/auth/AuthBrandPanel";

function handleHardRecovery() {
  // Botão "Corrigir acesso" — limpa tudo e recarrega via flag de recuperação.
  // O wipe acontece no main.tsx assim que a página recarrega.
  try { localStorage.clear(); } catch { /* ignore */ }
  try { sessionStorage.clear(); } catch { /* ignore */ }
  try {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister().catch(() => {})));
    }
  } catch { /* ignore */ }
  try {
    if ("caches" in window) {
      caches.keys().then((ks) => ks.forEach((k) => caches.delete(k).catch(() => {})));
    }
  } catch { /* ignore */ }
  setTimeout(() => {
    window.location.replace("/?_recover=1");
  }, 150);
}

function isNetworkError(msg: string) {
  return ["Failed to fetch", "NetworkError", "network", "Load failed", "offline", "timeout"].some((k) => msg.includes(k));
}

export default function Auth() {
  const { user, loading, signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submittingTooLong, setSubmittingTooLong] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("recovered") === "1") {
      toast.success("Acesso recuperado neste dispositivo. Faça login normalmente.");
      params.delete("recovered");
      const clean = window.location.pathname + (params.toString() ? `?${params}` : "");
      window.history.replaceState({}, "", clean);
    }
  }, []);

  useEffect(() => {
    if (!submitting) { setSubmittingTooLong(false); return; }
    const t = window.setTimeout(() => setSubmittingTooLong(true), 6000);
    return () => window.clearTimeout(t);
  }, [submitting]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (user) return <Navigate to="/" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { error } = await signIn(email, password);
      if (error) {
        const msg = String(error.message || "");
        if (msg.includes("Invalid login")) toast.error("Email ou senha incorretos.");
        else if (msg.includes("Email not confirmed")) toast.error("Confirme seu email antes de entrar.");
        else if (isNetworkError(msg)) toast.error("Falha de conexão. Verifique sua internet e tente novamente em alguns segundos.");
        else toast.error(msg || "Erro ao entrar.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err ?? "");
      if (isNetworkError(msg)) toast.error("Falha de conexão. Tente novamente em alguns segundos.");
      else toast.error(msg || "Erro inesperado. Tente novamente.");
    } finally { setSubmitting(false); }
  };

  const inputCls = "h-12 rounded-xl bg-card pl-10 text-[15px] focus-visible:ring-4 focus-visible:ring-primary/15 focus-visible:border-primary";

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-background text-foreground">
      <AuthMobileHeader />

      <main className="flex flex-1 flex-col justify-start lg:justify-center px-6 py-8 lg:max-w-[620px] lg:px-[72px]">
        <div className="mb-14 hidden lg:block"><UhomeSalesLogo height={48} /></div>

        <span className="inline-flex items-center gap-2 self-start rounded-full bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
          <i className="block h-[7px] w-[7px] rounded-full bg-success" />CRM da equipe Uhome
        </span>
        <h2 className="mt-4 mb-2 font-display text-[26px] font-extrabold tracking-tight lg:text-[34px]">Bem-vindo de volta</h2>
        <p className="mb-7 text-[15px] text-muted-foreground">Entre para ver seus leads, visitas e tarefas de hoje.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="auth-email" className="mb-1.5 block text-[13px] font-semibold">E-mail</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="auth-email" type="email" autoComplete="email" placeholder="seu.nome@uhome.com.br" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} required />
            </div>
          </div>
          <div>
            <label htmlFor="auth-senha" className="mb-1.5 block text-[13px] font-semibold">Senha</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="auth-senha" type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="Sua senha" value={password} onChange={(e) => setPassword(e.target.value)} className={`${inputCls} pr-11`} minLength={6} required />
              <button type="button" aria-label={showPassword ? "Esconder senha" : "Mostrar senha"} onClick={() => setShowPassword(!showPassword)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="flex justify-end">
            <button type="button" className="text-[13px] font-semibold text-primary hover:underline">Esqueci minha senha</button>
          </div>

          <Button type="submit" disabled={submitting} className="h-[50px] w-full rounded-xl text-[15px] font-semibold shadow-lg shadow-primary/25">
            {submitting ? <><Loader2 className="h-4 w-4 animate-spin" />Entrando...</> : "Entrar no CRM"}
          </Button>
          {submittingTooLong && (
            <button type="button" onClick={handleHardRecovery} className="w-full text-center text-xs text-destructive hover:underline">
              ⚠️ Demorando demais? Toque aqui para corrigir o acesso neste dispositivo
            </button>
          )}
        </form>

        <p className="mt-7 text-xs text-muted-foreground">🔐 Acesso restrito à equipe Uhome</p>
        <button type="button" onClick={handleHardRecovery} className="mt-2 self-start text-[11px] text-muted-foreground/80 hover:underline">
          Está preso na tela de login? Corrigir acesso neste dispositivo
        </button>
      </main>

      <AuthBrandPanel />
    </div>
  );
}
