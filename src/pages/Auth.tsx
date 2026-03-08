import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Navigate } from "react-router-dom";
import { Mail, Lock, User, Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

const uhomeSalesLogo = "/images/uhomesales-logo.png";
const homiHero = "/images/homi-hero.png";

/* ─── Homi speech bubble phrases ─── */
const HOMI_PHRASES = [
  "Bem-vindo de volta! 👋",
  "Vamos bater a meta hoje? 🎯",
  "Seus leads estão esperando! 🔥",
  "Pronto para a Arena? ⚡",
];

/* ─── Particle Canvas ─── */
function ParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    const dpr = window.devicePixelRatio || 1;

    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.scale(dpr, dpr);
    };
    resize();
    window.addEventListener("resize", resize);

    interface Particle {
      x: number; y: number; r: number; vx: number; vy: number;
      baseOpacity: number; opacity: number; twinkle: boolean;
      twinkleSpeed: number; twinklePhase: number; isBlue: boolean; glow: boolean;
    }

    const W = () => window.innerWidth;
    const H = () => window.innerHeight;

    const particles: Particle[] = Array.from({ length: 80 }, (_, i) => {
      const isStar = i < 4;
      const isBlue = Math.random() < 0.35;
      return {
        x: Math.random() * W(),
        y: Math.random() * H(),
        r: isStar ? 3 : 1 + Math.random(),
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        baseOpacity: isStar ? 0.7 : 0.2 + Math.random() * 0.4,
        opacity: 0.4,
        twinkle: isStar || Math.random() < 0.25,
        twinkleSpeed: 0.008 + Math.random() * 0.015,
        twinklePhase: Math.random() * Math.PI * 2,
        isBlue,
        glow: isStar,
      };
    });

    const draw = () => {
      ctx.clearRect(0, 0, W(), H());
      const w = W(), h = H();

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < -10) p.x = w + 10;
        if (p.x > w + 10) p.x = -10;
        if (p.y < -10) p.y = h + 10;
        if (p.y > h + 10) p.y = -10;

        if (p.twinkle) {
          p.twinklePhase += p.twinkleSpeed;
          p.opacity = p.baseOpacity * (0.3 + 0.7 * ((Math.sin(p.twinklePhase) + 1) / 2));
        }

        if (p.glow) {
          ctx.shadowColor = "rgba(99,179,237,0.6)";
          ctx.shadowBlur = 12;
        } else {
          ctx.shadowColor = "transparent";
          ctx.shadowBlur = 0;
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.isBlue
          ? `rgba(99,179,237,${p.opacity})`
          : `rgba(255,255,255,${p.opacity})`;
        ctx.fill();
      }
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;

      animId = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 1 }}
    />
  );
}

/* ─── Homi Speech Bubble ─── */
function HomiSpeechBubble() {
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(false);
  const [fade, setFade] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 1800);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!visible) return;
    const interval = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setIdx((p) => (p + 1) % HOMI_PHRASES.length);
        setFade(true);
      }, 300);
    }, 4000);
    return () => clearInterval(interval);
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      className="absolute -top-14 left-1/2 -translate-x-1/2 whitespace-nowrap transition-opacity duration-300"
      style={{
        opacity: fade ? 1 : 0,
        background: "rgba(30,41,59,0.95)",
        border: "1px solid rgba(99,179,237,0.3)",
        borderRadius: "12px 12px 12px 4px",
        padding: "8px 14px",
        fontSize: "13px",
        color: "#E2E8F0",
        boxShadow: "0 0 20px rgba(59,130,246,0.2)",
        animation: "fade-in 0.4s ease-out both",
      }}
    >
      {HOMI_PHRASES[idx]}
    </div>
  );
}

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

/* Homi entrance bounce */
@keyframes homiEntrada {
  0%   { transform: translateY(80px); opacity: 0; }
  60%  { transform: translateY(-10px); opacity: 1; }
  80%  { transform: translateY(4px); }
  100% { transform: translateY(0); }
}
/* Homi wave/sway after entrance */
@keyframes homiAceno {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  25%      { transform: translateY(-6px) rotate(3deg); }
  75%      { transform: translateY(-3px) rotate(-2deg); }
}
.homi-entrance {
  opacity: 0;
  animation: homiEntrada 0.8s cubic-bezier(0.34,1.56,0.64,1) forwards;
  animation-delay: 0.3s;
}
.homi-wave {
  animation: homiAceno 3s ease-in-out infinite;
  animation-delay: 1.2s;
}

/* Button pulse */
@keyframes authBtnPulse {
  0%, 100% { box-shadow: 0 4px 24px hsla(229,100%,64%,0.3), 0 0 0 0 rgba(59,130,246,0.4); }
  50%      { box-shadow: 0 4px 24px hsla(229,100%,64%,0.3), 0 0 0 8px rgba(59,130,246,0); }
}

/* Input focus glows */
.auth-input-email:focus {
  border-color: #3B82F6 !important;
  box-shadow: 0 0 0 3px rgba(59,130,246,0.15), 0 0 20px rgba(59,130,246,0.1) !important;
}
.auth-input-password:focus {
  border-color: #22C55E !important;
  box-shadow: 0 0 0 3px rgba(34,197,94,0.15), 0 0 20px rgba(34,197,94,0.1) !important;
}
`;

export default function Auth() {
  const { user, loading, signIn, signUp } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nome, setNome] = useState("");
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

  const inputBase =
    "pl-10 h-12 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder:text-white/20 transition-all duration-200 focus:bg-white/[0.08] focus:ring-0 focus:outline-none";

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

      {/* Particle Canvas */}
      <ParticleCanvas />

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
              className="relative rounded-2xl overflow-hidden"
              style={{
                border: "1px solid rgba(255,255,255,0.08)",
                boxShadow: "0 25px 50px rgba(0,0,0,0.5), 0 0 80px rgba(59,130,246,0.05)",
              }}
            >
              <div
                className="rounded-2xl p-6 space-y-4"
                style={{
                  background: "rgba(15,23,42,0.8)",
                  backdropFilter: "blur(20px)",
                }}
              >
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
                      className={inputBase}
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
                    className={`${inputBase} auth-input-email`}
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
                    className={`${inputBase} auth-input-password`}
                    minLength={6}
                    required
                  />
                </div>

                {/* Submit + Forgot */}
                <div className="flex items-center gap-3">
                  <Button
                    type="submit"
                    className="h-12 flex-1 gap-2 text-sm font-bold rounded-xl border-0 transition-all duration-200 bg-gradient-to-r from-[hsl(229,100%,64%)] to-[hsl(229,78%,54%)] hover:from-[hsl(229,100%,68%)] hover:to-[hsl(229,78%,58%)] hover:-translate-y-0.5"
                    style={{
                      animation: submitting ? "none" : "authBtnPulse 2s ease-in-out infinite",
                    }}
                    disabled={submitting}
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Entrando...</span>
                      </>
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

        {/* HOMI MASCOT with animations */}
        <div className="flex flex-col items-center anim-fade-in-up anim-delay-3">
          <div className="relative homi-entrance">
            <HomiSpeechBubble />
            <div className="homi-wave">
              <div className="absolute inset-0 -m-4 rounded-full bg-[hsl(229,100%,64%/0.2)] blur-[40px] anim-glow" />
              <img
                src={homiHero}
                alt="Homi AI"
                className="relative w-32 h-32 object-contain drop-shadow-[0_0_30px_hsl(229,100%,64%,0.5)]"
              />
            </div>
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
