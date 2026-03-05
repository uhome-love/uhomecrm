import { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Lock, User, Loader2, ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import uhomeSalesLogo from "@/assets/uhomesales-logo.png";
import homiMascot from "@/assets/homi-mascot.png";

/* ─── Floating particle component ─── */
function Particles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {Array.from({ length: 30 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full bg-[hsl(229,100%,72%)]"
          style={{
            width: Math.random() * 3 + 1,
            height: Math.random() * 3 + 1,
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
          }}
          animate={{
            y: [0, -(Math.random() * 80 + 40)],
            opacity: [0, 0.6, 0],
          }}
          transition={{
            duration: Math.random() * 6 + 4,
            repeat: Infinity,
            delay: Math.random() * 5,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

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
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        >
          <Loader2 className="h-8 w-8 text-[hsl(229,100%,64%)]" />
        </motion.div>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
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
          toast.success("Bem-vindo de volta!");
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
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* ─── BACKGROUND LAYERS ─── */}
      {/* Base dark */}
      <div className="absolute inset-0 bg-[hsl(224,44%,5%)]" />

      {/* Gradient mesh */}
      <div className="absolute inset-0">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-[hsl(229,80%,12%)] via-[hsl(224,44%,6%)] to-[hsl(224,44%,4%)]" />
      </div>

      {/* Primary glow — centered behind logo */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-[5%] left-1/2 -translate-x-1/2 w-[800px] h-[500px] rounded-full bg-[hsl(229,100%,55%/0.10)] blur-[150px]" />
        <div className="absolute top-[15%] left-1/2 -translate-x-1/2 w-[400px] h-[300px] rounded-full bg-[hsl(229,100%,64%/0.08)] blur-[80px]" />
      </div>

      {/* Secondary accents */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute bottom-[-5%] left-[-10%] w-[500px] h-[500px] rounded-full bg-[hsl(260,70%,50%/0.05)] blur-[120px]" />
        <div className="absolute top-[-10%] right-[-5%] w-[400px] h-[400px] rounded-full bg-[hsl(200,80%,50%/0.04)] blur-[100px]" />
      </div>

      {/* Noise texture */}
      <div
        className="absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      {/* Grid lines */}
      <div
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage:
            "linear-gradient(hsl(229,100%,70%) 1px, transparent 1px), linear-gradient(90deg, hsl(229,100%,70%) 1px, transparent 1px)",
          backgroundSize: "100px 100px",
        }}
      />

      {/* Floating particles */}
      <Particles />

      {/* ─── CONTENT ─── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
        className="relative z-10 w-full max-w-[420px] px-5"
      >
        {/* ─── LOGO AREA ─── */}
        <div className="flex flex-col items-center mb-10">
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.1, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="relative mb-5"
          >
            {/* Glow behind logo */}
            <div className="absolute inset-0 -m-8 rounded-full bg-[hsl(229,100%,64%/0.12)] blur-[40px]" />
            <img
              src={uhomeSalesLogo}
              alt="UhomeSales"
              className="relative h-36 w-auto drop-shadow-[0_0_50px_hsl(229,100%,64%,0.3)]"
            />
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="text-[11px] text-white/30 font-medium tracking-[0.25em] uppercase text-center"
          >
            Plataforma de vendas imobiliárias de alta performance
          </motion.p>
        </div>

        {/* ─── LOGIN CARD ─── */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          <form onSubmit={handleSubmit}>
            <div
              className="relative rounded-2xl p-[1px] overflow-hidden"
              style={{
                background:
                  "linear-gradient(135deg, hsl(229 100% 64% / 0.2), hsl(229 100% 64% / 0.05), hsl(260 70% 55% / 0.1))",
              }}
            >
              <div className="rounded-2xl bg-[hsl(224,36%,8%/0.85)] backdrop-blur-2xl p-7 space-y-5">
                {/* Card header */}
                <div className="text-center mb-1">
                  <AnimatePresence mode="wait">
                    <motion.h2
                      key={isLogin ? "login" : "signup"}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.25 }}
                      className="font-display font-bold text-xl text-white"
                    >
                      {isLogin ? "Acesse sua conta" : "Crie sua conta"}
                    </motion.h2>
                  </AnimatePresence>
                  <p className="text-xs text-white/35 mt-1.5">
                    {isLogin
                      ? "Entre com suas credenciais"
                      : "Preencha seus dados para começar"}
                  </p>
                </div>

                {/* Name field */}
                <AnimatePresence>
                  {!isLogin && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3 }}
                      className="space-y-1.5 overflow-hidden"
                    >
                      <Label htmlFor="nome" className="text-xs font-medium text-white/50">
                        Nome
                      </Label>
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
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Email */}
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs font-medium text-white/50">
                    Email
                  </Label>
                  <div className="relative">
                    <Mail className={iconClasses("email")} />
                    <Input
                      id="email"
                      type="email"
                      placeholder="seu@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onFocus={() => setFocusedField("email")}
                      onBlur={() => setFocusedField(null)}
                      className={inputClasses}
                      required
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                  <Label htmlFor="password" className="text-xs font-medium text-white/50">
                    Senha
                  </Label>
                  <div className="relative">
                    <Lock className={iconClasses("password")} />
                    <Input
                      id="password"
                      type="password"
                      placeholder="Mínimo 6 caracteres"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onFocus={() => setFocusedField("password")}
                      onBlur={() => setFocusedField(null)}
                      className={inputClasses}
                      minLength={6}
                      required
                    />
                  </div>
                </div>

                {/* Submit button */}
                <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}>
                  <Button
                    type="submit"
                    className="w-full h-12 gap-2 text-sm font-bold rounded-xl border-0 transition-all duration-300 bg-gradient-to-r from-[hsl(229,100%,64%)] to-[hsl(229,78%,54%)] hover:from-[hsl(229,100%,68%)] hover:to-[hsl(229,78%,58%)] shadow-[0_4px_24px_hsl(229,100%,64%/0.3)] hover:shadow-[0_8px_32px_hsl(229,100%,64%/0.4)]"
                    disabled={submitting}
                  >
                    {submitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        {isLogin ? "Entrar" : "Criar conta"}
                        <ArrowRight className="h-4 w-4 ml-1" />
                      </>
                    )}
                  </Button>
                </motion.div>
              </div>
            </div>
          </form>

          {/* Toggle login/signup */}
          <p className="text-center text-sm text-white/40 mt-6">
            {isLogin ? "Não tem conta?" : "Já tem conta?"}{" "}
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-[hsl(229,100%,72%)] font-semibold hover:text-[hsl(229,100%,80%)] transition-colors duration-200"
            >
              {isLogin ? "Criar conta" : "Entrar"}
            </button>
          </p>
        </motion.div>

        {/* ─── HOMI PRESENCE ─── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.5 }}
          className="flex items-center justify-center gap-2.5 mt-10"
        >
          <motion.div
            animate={{ y: [0, -3, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            className="relative"
          >
            <div className="absolute inset-0 -m-1 rounded-full bg-[hsl(229,100%,64%/0.15)] blur-md" />
            <img src={homiMascot} alt="Homi" className="relative h-8 w-8 object-contain" />
          </motion.div>
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-3 w-3 text-[hsl(229,100%,64%/0.5)]" />
            <span className="text-[11px] text-white/30 font-medium">
              Homi AI vai ajudar você a vender mais hoje
            </span>
          </div>
        </motion.div>

        {/* Footer */}
        <p className="text-center text-[10px] text-white/15 mt-6 tracking-wider">
          © {new Date().getFullYear()} UhomeSales · Powered by Homi AI
        </p>
      </motion.div>
    </div>
  );
}
