import { useState } from "react";
import { Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Mail, Lock, User, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import uhomeSalesLogo from "@/assets/uhomesales-logo.png";

export default function Auth() {
  const { user, loading, signIn, signUp } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nome, setNome] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
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

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Dark elegant background */}
      <div className="absolute inset-0 bg-[hsl(224,44%,8%)]" />
      {/* Radial glow behind logo area */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-[10%] left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-[hsl(229,100%,64%/0.12)] blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-5%] w-[400px] h-[400px] rounded-full bg-[hsl(260,70%,55%/0.08)] blur-[100px]" />
      </div>
      {/* Subtle noise texture */}
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")" }} />

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative z-10 w-full max-w-md px-4"
      >
        {/* Logo & branding */}
        <div className="flex flex-col items-center mb-10">
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.15, duration: 0.5, ease: "easeOut" }}
            className="mb-6"
          >
            <img src={uhomeSalesLogo} alt="UhomeSales" className="h-40 w-auto drop-shadow-[0_0_40px_hsl(229,100%,64%,0.35)]" />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="text-center"
          >
            <p className="text-sm text-white/40 font-medium tracking-[0.15em] uppercase">
              Plataforma de vendas imobiliárias de alta performance
            </p>
          </motion.div>
        </div>

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.4 }}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.07] backdrop-blur-xl p-7 shadow-2xl space-y-5">
              <div className="text-center mb-2">
                <h2 className="font-display font-bold text-xl text-white">
                  {isLogin ? "Acesse sua conta" : "Crie sua conta"}
                </h2>
                <p className="text-xs text-white/50 mt-1">
                  {isLogin ? "Entre com suas credenciais" : "Preencha seus dados para começar"}
                </p>
              </div>

              {!isLogin && (
                <div className="space-y-1.5">
                  <Label htmlFor="nome" className="text-sm font-medium text-white/70">Nome</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                    <Input
                      id="nome"
                      placeholder="Seu nome completo"
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      className="pl-10 h-11 rounded-xl bg-white/[0.06] border-white/10 text-white placeholder:text-white/25 focus:border-primary focus:bg-white/[0.1]"
                      required={!isLogin}
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-sm font-medium text-white/70">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 h-11 rounded-xl bg-white/[0.06] border-white/10 text-white placeholder:text-white/25 focus:border-primary focus:bg-white/[0.1]"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-sm font-medium text-white/70">Senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="Mínimo 6 caracteres"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 h-11 rounded-xl bg-white/[0.06] border-white/10 text-white placeholder:text-white/25 focus:border-primary focus:bg-white/[0.1]"
                    minLength={6}
                    required
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-12 gap-2 text-sm font-bold rounded-xl gradient-brand border-0 shadow-glow hover:opacity-90 transition-all duration-200"
                disabled={submitting}
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {isLogin ? "Entrar" : "Criar conta"}
              </Button>
            </div>
          </form>

          <p className="text-center text-sm text-white/70 mt-5">
            {isLogin ? "Não tem conta?" : "Já tem conta?"}{" "}
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-white font-semibold hover:underline underline-offset-2"
            >
              {isLogin ? "Criar conta" : "Entrar"}
            </button>
          </p>
        </motion.div>

        <p className="text-center text-xs text-white/25 mt-8">
          © {new Date().getFullYear()} UhomeSales. Powered by Homi AI.
        </p>
      </motion.div>
    </div>
  );
}
