import { useState } from "react";
import { Navigate } from "react-router-dom";
import { Mail, Lock, User, Loader2, ArrowRight } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

const uhomeSalesLogo = "/images/uhomesales-logo.png";
const homiHero = "/images/homi-hero.png";

/* ─── CSS-only animations ─── */
const animationStyles = `
@keyframes float-up {
  0% { opacity: 0; transform: translateY(0); }
  30% { opacity: 0.5; }
  100% { opacity: 0; transform: translateY(-80px); }
}
.particle {
  position: absolute;
  border-radius: 50%;
  background: hsl(229 100% 72%);
  animation: float-up var(--d) var(--delay) ease-in-out infinite;
}
@keyframes fade-in-up {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes fade-in-scale {
  from { opacity: 0; transform: scale(0.9); }
  to { opacity: 1; transform: scale(1); }
}
@keyframes gentle-float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
}
@keyframes glow-pulse {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 0.7; }
}
.anim-fade-in-up {
  animation: fade-in-up 0.5s cubic-bezier(0.22, 1, 0.36, 1) both;
}
.anim-fade-in-scale {
  animation: fade-in-scale 0.6s cubic-bezier(0.22, 1, 0.36, 1) both;
}
.anim-delay-1 { animation-delay: 0.15s; }
.anim-delay-2 { animation-delay: 0.3s; }
.anim-delay-3 { animation-delay: 0.45s; }
.anim-float {
  animation: gentle-float 4s ease-in-out infinite;
}
.anim-glow {
  animation: glow-pulse 3s ease-in-out infinite;
}
`;

function Particles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {Array.from({ length: 18 }).map((_, i) => (
        <div
          key={i}
          className="particle"
          style={{
            width: (i % 3) + 1.5,
            height: (i % 3) + 1.5,
            left: `${(i * 5.5) % 100}%`,
            top: `${(i * 11.3) % 100}%`,
            "--d": `${5 + (i % 4) * 2}s`,
            "--delay": `${(i * 0.5) % 5}s`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}

export default function Auth() {
  const { user, loading, signIn, signUp } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState(() => localStorage.getItem("uhome_remember_email") || "");
  const [password, setPassword] = useState("");
  const [nome, setNome] = useState("");
  const [rememberMe, setRememberMe] = useState(() => !!localStorage.getItem("uhome_remember_email"));
  const [submitting, setSubmitting] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[hsl(224,44%,6%)]">
        <Loader2 className="h-8 w-8 text-[hsl(229,100%,64%)] animate-spin" />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/welcome" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) {
          if (error.message?.includes("Invalid login")) {
            toast.error("Email ou senha incorretos.");
          } else if (error.message?.includes("Email not confirmed")) {
            toast.error("Confirme seu email antes de entrar. Verifique sua caixa de entrada.");
          } else {
            toast.error(error.message || "Erro ao entrar.");
          }
        } else {
          // Save or clear remembered email
          if (rememberMe) {
            localStorage.setItem("uhome_remember_email", email);
          } else {
            localStorage.removeItem("uhome_remember_email");
          }
        }
      } else {
        if (!nome.trim()) {
          toast.error("Informe seu nome.");
          setSubmitting(false);
          return;
        }
        const { error } = await signUp(email, password, nome);
        if (error) {
          toast.error(error.message || "Erro ao criar conta.");
        } else {
          toast.success("Conta criada! Verifique seu email para confirmar.");
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  const inputClasses =
    "pl-10 h-12 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder:text-white/20 transition-all duration-300 focus:border-[hsl(229,100%,64%)] focus:bg-white/[0.08] focus:shadow-[0_0_20px_hsl(229,100%,64%/0.15)] focus:ring-1 focus:ring-[hsl(229,100%,64%/0.3)]";

  const iconClasses = (field: string) =>
    `absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 transition-colors duration-300 ${
      focusedField === field ? "text-[hsl(229,100%,64%)]" : "text-white/25"
    }`;

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-between overflow-hidden">
      <style>{animationStyles}</style>

      {/* ─── BACKGROUND ─── */}
      <div className="absolute inset-0 bg-[hsl(224,44%,5%)]" />
      <div className="absolute inset-0 bg-gradient-to-b from-[hsl(229,80%,12%)] via-[hsl(224,44%,6%)] to-[hsl(224,44%,4%)]" />
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-[5%] left-1/2 -translate-x-1/2 w-[800px] h-[500px] rounded-full bg-[hsl(229,100%,55%/0.10)] blur-[150px]" />
        <div className="absolute top-[15%] left-1/2 -translate-x-1/2 w-[400px] h-[300px] rounded-full bg-[hsl(229,100%,64%/0.08)] blur-[80px]" />
        <div className="absolute bottom-[-5%] left-[-10%] w-[500px] h-[500px] rounded-full bg-[hsl(260,70%,50%/0.05)] blur-[120px]" />
        <div className="absolute top-[-10%] right-[-5%] w-[400px] h-[400px] rounded-full bg-[hsl(200,80%,50%/0.04)] blur-[100px]" />
      </div>
      <div
        className="absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />
      <Particles />

      {/* ─── CONTENT ─── */}
      <div className="relative z-10 w-full max-w-[420px] px-5 pt-10 pb-4 flex-1 flex flex-col">
        {/* LOGO */}
        <div className="flex flex-col items-center anim-fade-in-scale">
          <div className="relative">
            
            <img
              src={uhomeSalesLogo}
              alt="UhomeSales"
              width={525}
              height={350}
              loading="eager"
              decoding="async"
              className="relative w-auto object-contain drop-shadow-[0_0_60px_hsl(229,100%,64%,0.4)]"
              style={{ height: "220px", clipPath: "inset(10% 0 8% 0)", margin: "-20px 0 -30px 0" }}
            />
          </div>
        </div>

        {/* HEADLINE */}
        <h2 className="text-center text-white/60 text-base font-medium -mt-4 mb-5 anim-fade-in-up anim-delay-1">
          Plataforma da Uhome de<br />performance e vendas
        </h2>

        {/* LOGIN FORM */}
        <div className="anim-fade-in-up anim-delay-2">
          <form onSubmit={handleSubmit}>
            <div
              className="relative rounded-2xl p-[1px] overflow-hidden"
              style={{
                background:
                  "linear-gradient(135deg, hsl(229 100% 64% / 0.2), hsl(229 100% 64% / 0.05), hsl(260 70% 55% / 0.1))",
              }}
            >
              <div className="rounded-2xl bg-[hsl(224,36%,8%/0.85)] backdrop-blur-2xl p-6 space-y-4">
                {/* Name field (signup only) */}
                {!isLogin && (
                  <div className="relative">
                    <User className={iconClasses("nome")} />
                    <Input
                      id="nome"
                      placeholder="Seu nome completo"
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      onFocus={() => setFocusedField("nome")}
                      onBlur={() => setFocusedField(null)}
                      className={inputClasses}
                      required={!isLogin}
                    />
                  </div>
                )}

                {/* Email */}
                <div className="relative">
                  <Mail className={iconClasses("email")} />
                  <Input
                    id="email"
                    type="email"
                    placeholder="Seu e-mail"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onFocus={() => setFocusedField("email")}
                    onBlur={() => setFocusedField(null)}
                    className={inputClasses}
                    required
                  />
                </div>

                {/* Password */}
                <div className="relative">
                  <Lock className={iconClasses("password")} />
                  <Input
                    id="password"
                    type="password"
                    placeholder="Sua senha"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={() => setFocusedField("password")}
                    onBlur={() => setFocusedField(null)}
                    className={inputClasses}
                    minLength={6}
                    required
                  />
                </div>

                {/* Submit + Forgot */}
                <div className="flex items-center gap-3">
                  <Button
                    type="submit"
                    className="h-12 flex-1 gap-2 text-sm font-bold rounded-xl border-0 transition-all duration-300 bg-gradient-to-r from-[hsl(229,100%,64%)] to-[hsl(229,78%,54%)] hover:from-[hsl(229,100%,68%)] hover:to-[hsl(229,78%,58%)] shadow-[0_4px_24px_hsl(229,100%,64%/0.3)] hover:shadow-[0_8px_32px_hsl(229,100%,64%/0.4)]"
                    disabled={submitting}
                  >
                    {submitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        {isLogin ? "Entrar" : "Criar conta"}
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                  {isLogin && (
                    <button
                      type="button"
                      className="text-xs text-white/30 hover:text-white/50 transition-colors whitespace-nowrap"
                    >
                      Esqueceu a senha?
                    </button>
                  )}
                </div>
              </div>
            </div>
          </form>

          {/* Toggle login/signup */}
          <p className="text-center text-sm text-white/40 mt-5">
            {isLogin ? "Não tem conta?" : "Já tem conta?"}{" "}
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-[hsl(229,100%,72%)] font-semibold hover:text-[hsl(229,100%,80%)] transition-colors"
            >
              {isLogin ? "Criar conta" : "Entrar"}
            </button>
          </p>
        </div>

        {/* SPACER */}
        <div className="flex-1" />

        {/* HOMI MASCOT */}
        <div className="flex flex-col items-center anim-fade-in-up anim-delay-3">
          <div className="relative anim-float">
            <div className="absolute inset-0 -m-4 rounded-full bg-[hsl(229,100%,64%/0.2)] blur-[40px] anim-glow" />
            <img
              src={homiHero}
              alt="Homi AI"
              className="relative w-32 h-32 object-contain drop-shadow-[0_0_30px_hsl(229,100%,64%,0.5)]"
            />
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <div className="relative z-10 pb-6 pt-2">
        <p className="text-center text-[10px] text-white/20 tracking-wider">
          © {new Date().getFullYear()} Uhome · Impulsione suas vendas · Todos os direitos reservados
        </p>
      </div>
    </div>
  );
}
