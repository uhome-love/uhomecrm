import { useState, useEffect, useRef, useCallback } from "react";
import { Navigate } from "react-router-dom";
import { Mail, Lock, User, Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

const uhomeSalesLogo = "/images/uhomesales-logo.png";
const homiHero = "/images/homi-hero.png";

const HOMI_PHRASES = [
  "Pronto para sua melhor sessão hoje? ⚡",
  "Vamos dominar a Arena! 🔥",
  "Seus leads estão esperando! 🎯",
  "Hora de liderar o ranking! 🏆",
];

const MOTIVATIONAL = [
  "15.267 leads esperando por você.",
  "Os melhores corretores já estão dentro.",
  "Cada login é uma nova chance de liderar.",
  "A Arena está aberta. Entre agora.",
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
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    interface Particle {
      x: number; y: number; r: number; vx: number; vy: number;
      baseOpacity: number; opacity: number; twinkle: boolean;
      twinkleSpeed: number; twinklePhase: number; isGreen: boolean; glow: boolean;
    }

    const W = () => window.innerWidth;
    const H = () => window.innerHeight;

    const particles: Particle[] = Array.from({ length: 90 }, (_, i) => {
      const isStar = i < 5;
      const isGreen = Math.random() < 0.25;
      return {
        x: Math.random() * W(),
        y: Math.random() * H(),
        r: isStar ? 2.5 : 0.8 + Math.random() * 1.2,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
        baseOpacity: isStar ? 0.8 : 0.15 + Math.random() * 0.35,
        opacity: 0.4,
        twinkle: isStar || Math.random() < 0.3,
        twinkleSpeed: 0.006 + Math.random() * 0.012,
        twinklePhase: Math.random() * Math.PI * 2,
        isGreen,
        glow: isStar,
      };
    });

    const draw = () => {
      ctx.clearRect(0, 0, W(), H());
      const w = W(), h = H();
      for (const p of particles) {
        p.x += p.vx; p.y += p.vy;
        if (p.x < -10) p.x = w + 10;
        if (p.x > w + 10) p.x = -10;
        if (p.y < -10) p.y = h + 10;
        if (p.y > h + 10) p.y = -10;
        if (p.twinkle) {
          p.twinklePhase += p.twinkleSpeed;
          p.opacity = p.baseOpacity * (0.3 + 0.7 * ((Math.sin(p.twinklePhase) + 1) / 2));
        }
        if (p.glow) {
          ctx.shadowColor = p.isGreen ? "rgba(34,197,94,0.6)" : "rgba(99,179,237,0.6)";
          ctx.shadowBlur = 10;
        } else {
          ctx.shadowColor = "transparent";
          ctx.shadowBlur = 0;
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.isGreen
          ? `rgba(34,197,94,${p.opacity})`
          : `rgba(255,255,255,${p.opacity})`;
        ctx.fill();
      }
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(animId); window.removeEventListener("resize", resize); };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" style={{ zIndex: 1 }} />;
}

/* ─── Homi Speech Bubble ─── */
function HomiSpeechBubble() {
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(false);
  const [fade, setFade] = useState(true);

  useEffect(() => { const t = setTimeout(() => setVisible(true), 1500); return () => clearTimeout(t); }, []);
  useEffect(() => {
    if (!visible) return;
    const interval = setInterval(() => {
      setFade(false);
      setTimeout(() => { setIdx(p => (p + 1) % HOMI_PHRASES.length); setFade(true); }, 300);
    }, 4000);
    return () => clearInterval(interval);
  }, [visible]);

  if (!visible) return null;
  return (
    <div className="absolute -top-12 left-1/2 -translate-x-1/2 whitespace-nowrap transition-opacity duration-300 z-20" style={{ opacity: fade ? 1 : 0 }}>
      <div style={{ background: "rgba(15,23,42,0.95)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 12, padding: "8px 14px", fontSize: 13, color: "#E2E8F0", boxShadow: "0 0 20px rgba(34,197,94,0.15)" }}>
        {HOMI_PHRASES[idx]}
      </div>
      <div className="mx-auto" style={{ width: 0, height: 0, borderLeft: "6px solid transparent", borderRight: "6px solid transparent", borderTop: "6px solid rgba(15,23,42,0.95)" }} />
    </div>
  );
}

/* ─── Motivational Rotator ─── */
function MotivationalLine() {
  const [idx, setIdx] = useState(0);
  const [fade, setFade] = useState(true);
  useEffect(() => {
    const interval = setInterval(() => {
      setFade(false);
      setTimeout(() => { setIdx(p => (p + 1) % MOTIVATIONAL.length); setFade(true); }, 300);
    }, 4000);
    return () => clearInterval(interval);
  }, []);
  return (
    <p className="text-center transition-opacity duration-300 mt-4" style={{ opacity: fade ? 1 : 0, color: "rgba(255,255,255,0.3)", fontSize: 13 }}>
      {MOTIVATIONAL[idx]}
    </p>
  );
}

/* ─── CSS Animations ─── */
const styles = `
@keyframes fade-in-up { from { opacity:0; transform:translateY(14px) } to { opacity:1; transform:translateY(0) } }
@keyframes fade-in-scale { from { opacity:0; transform:scale(0.92) } to { opacity:1; transform:scale(1) } }
@keyframes homiEntrada { 0%{transform:translateY(60px);opacity:0} 60%{transform:translateY(-8px);opacity:1} 80%{transform:translateY(3px)} 100%{transform:translateY(0)} }
@keyframes homiAceno { 0%,100%{transform:translateY(0) rotate(0)} 25%{transform:translateY(-5px) rotate(2deg)} 75%{transform:translateY(-2px) rotate(-1.5deg)} }
@keyframes pulse-glow { 0%,100%{box-shadow:0 0 20px rgba(34,197,94,0.4),0 0 0 0 rgba(34,197,94,0.3)} 50%{box-shadow:0 0 20px rgba(34,197,94,0.4),0 0 0 8px rgba(34,197,94,0)} }
@keyframes glow-pulse { 0%,100%{opacity:0.4} 50%{opacity:0.7} }
.anim-fiu { animation: fade-in-up 0.5s cubic-bezier(.22,1,.36,1) both }
.anim-fis { animation: fade-in-scale 0.6s cubic-bezier(.22,1,.36,1) both }
.anim-d1 { animation-delay:.12s } .anim-d2 { animation-delay:.25s } .anim-d3 { animation-delay:.38s }
.homi-entrance { opacity:0; animation: homiEntrada .8s cubic-bezier(.34,1.56,.64,1) forwards; animation-delay:.3s }
.homi-wave { animation: homiAceno 3s ease-in-out infinite; animation-delay:1.2s }
.auth-input:focus { border-color: rgba(34,197,94,0.5) !important; box-shadow: 0 0 0 3px rgba(34,197,94,0.1), 0 0 16px rgba(34,197,94,0.08) !important }
`;

export default function Auth() {
  const { user, loading, signIn, signUp } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nome, setNome] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0A0F1E" }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: "#22C55E" }} />
      </div>
    );
  }
  if (user) return <Navigate to="/welcome" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) {
          if (error.message?.includes("Invalid login")) toast.error("Email ou senha incorretos.");
          else if (error.message?.includes("Email not confirmed")) toast.error("Confirme seu email antes de entrar.");
          else toast.error(error.message || "Erro ao entrar.");
        }
      } else {
        if (!nome.trim()) { toast.error("Informe seu nome."); setSubmitting(false); return; }
        const { error } = await signUp(email, password, nome);
        if (error) toast.error(error.message || "Erro ao criar conta.");
        else toast.success("Conta criada! Verifique seu email para confirmar.");
      }
    } finally { setSubmitting(false); }
  };

  const inputCls = "auth-input pl-10 h-12 w-full text-white placeholder:opacity-40 transition-all duration-200 focus:ring-0 focus:outline-none";
  const inputStyle: React.CSSProperties = { background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, color: "white" };

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-between overflow-hidden" style={{ background: "#0A0F1E" }}>
      <style>{styles}</style>

      {/* BG layers */}
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 800px 500px at 50% 10%, rgba(34,197,94,0.08) 0%, transparent 70%)" }} />
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 400px 300px at 50% 20%, rgba(34,197,94,0.05) 0%, transparent 60%)" }} />
      <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")" }} />
      <ParticleCanvas />

      {/* CONTENT */}
      <div className="relative z-10 w-full max-w-[400px] px-5 pt-10 pb-4 flex-1 flex flex-col">

        {/* Badge */}
        <p className="text-center anim-fiu" style={{ letterSpacing: "0.3em", color: "rgba(255,255,255,0.4)", fontSize: 11, marginBottom: 4 }}>
          ✦ UHOMESALES ✦
        </p>

        {/* Logo */}
        <div className="flex flex-col items-center anim-fis">
          <img src={uhomeSalesLogo} alt="UhomeSales" loading="eager" decoding="async" className="relative w-auto object-contain" style={{ height: 200, clipPath: "inset(10% 0 8% 0)", margin: "-16px 0 -28px 0", filter: "drop-shadow(0 0 50px rgba(34,197,94,0.25))" }} />
        </div>

        {/* Subtitle */}
        <p className="text-center anim-fiu anim-d1" style={{ color: "rgba(255,255,255,0.6)", fontSize: 15, marginTop: -8, marginBottom: 20 }}>
          A plataforma dos corretores que vendem mais.
        </p>

        {/* FORM */}
        <div className="anim-fiu anim-d2">
          <form onSubmit={handleSubmit}>
            <div style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, backdropFilter: "blur(10px)", padding: 24 }}>
              <div className="space-y-3">
                {!isLogin && (
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "rgba(255,255,255,0.3)" }} />
                    <Input placeholder="Seu nome completo" value={nome} onChange={e => setNome(e.target.value)} className={inputCls} style={inputStyle} required={!isLogin} />
                  </div>
                )}
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "rgba(255,255,255,0.3)" }} />
                  <Input type="email" placeholder="Seu e-mail" value={email} onChange={e => setEmail(e.target.value)} className={inputCls} style={inputStyle} required />
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "rgba(255,255,255,0.3)" }} />
                  <Input type="password" placeholder="Sua senha" value={password} onChange={e => setPassword(e.target.value)} className={inputCls} style={inputStyle} minLength={6} required />
                </div>

                <div className="flex items-center gap-3 pt-1">
                  <Button type="submit" disabled={submitting} className="h-12 flex-1 gap-2 font-black text-sm border-0 rounded-xl text-white" style={{ background: "linear-gradient(135deg, #22C55E, #16A34A)", letterSpacing: "0.05em", animation: submitting ? "none" : "pulse-glow 2s ease-in-out infinite" }}>
                    {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /><span>Entrando...</span></> : <>{isLogin ? "ENTRAR" : "CRIAR CONTA"}<ArrowRight className="h-4 w-4" /></>}
                  </Button>
                  {isLogin && (
                    <button type="button" className="text-xs transition-colors whitespace-nowrap" style={{ color: "rgba(255,255,255,0.3)" }}>
                      Esqueceu?
                    </button>
                  )}
                </div>
              </div>
            </div>
          </form>

          {/* Toggle */}
          <p className="text-center text-sm mt-4">
            <span style={{ color: "rgba(255,255,255,0.4)" }}>{isLogin ? "Não tem conta?" : "Já tem conta?"} </span>
            <button onClick={() => setIsLogin(!isLogin)} className="font-semibold transition-colors" style={{ color: "#60A5FA" }}>
              {isLogin ? "Criar conta" : "Entrar"}
            </button>
          </p>

          {/* Motivational */}
          <MotivationalLine />
        </div>

        <div className="flex-1" />
      </div>

      {/* HOMI + Footer */}
      <div className="relative z-10 flex flex-col items-center pb-6 pt-2 gap-3">
        <div className="relative homi-entrance">
          <HomiSpeechBubble />
          <div className="homi-wave">
            <div className="absolute inset-0 -m-4 rounded-full blur-[40px]" style={{ background: "rgba(34,197,94,0.15)", animation: "glow-pulse 3s ease-in-out infinite" }} />
            <img src={homiHero} alt="Homi AI" className="relative object-contain" style={{ height: 80, filter: "drop-shadow(0 0 24px rgba(34,197,94,0.4))" }} />
          </div>
        </div>
        <p className="text-center tracking-wider" style={{ fontSize: 10, color: "rgba(255,255,255,0.2)" }}>
          © {new Date().getFullYear()} Uhome · Impulsione suas vendas · Todos os direitos reservados
        </p>
      </div>
    </div>
  );
}
