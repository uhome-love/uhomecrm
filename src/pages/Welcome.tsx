import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import uhomeSalesLogo from "@/assets/uhomesales-logo-app.png";

const homiHero = "/images/homi-hero.png";

const animationStyles = `
@keyframes fade-in-up {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes fade-in-scale {
  from { opacity: 0; transform: scale(0.85); }
  to { opacity: 1; transform: scale(1); }
}
@keyframes gentle-float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}
@keyframes glow-pulse {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 0.6; }
}
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
.welcome-fade-up {
  animation: fade-in-up 0.7s cubic-bezier(0.22, 1, 0.36, 1) both;
}
.welcome-scale {
  animation: fade-in-scale 0.8s cubic-bezier(0.22, 1, 0.36, 1) both;
}
.welcome-float {
  animation: gentle-float 4s ease-in-out infinite;
}
.welcome-glow {
  animation: glow-pulse 3s ease-in-out infinite;
}
.welcome-d1 { animation-delay: 0.1s; }
.welcome-d2 { animation-delay: 0.3s; }
.welcome-d3 { animation-delay: 0.5s; }
.welcome-d4 { animation-delay: 0.7s; }
`;

function Particles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {Array.from({ length: 20 }).map((_, i) => (
        <div
          key={i}
          className="particle"
          style={{
            width: (i % 3) + 1.5,
            height: (i % 3) + 1.5,
            left: `${(i * 5) % 100}%`,
            top: `${(i * 11) % 100}%`,
            "--d": `${5 + (i % 4) * 2}s`,
            "--delay": `${(i * 0.4) % 5}s`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}

export default function Welcome() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [nome, setNome] = useState("");

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("nome")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        setNome(data?.nome?.split(" ")[0] || "");
      });
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[hsl(224,44%,6%)]">
        <Loader2 className="h-8 w-8 text-[hsl(229,100%,64%)] animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden">
      <style>{animationStyles}</style>

      {/* Background */}
      <div className="absolute inset-0 bg-[hsl(224,44%,5%)]" />
      <div className="absolute inset-0 bg-gradient-to-b from-[hsl(229,80%,12%)] via-[hsl(224,44%,6%)] to-[hsl(224,44%,4%)]" />
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-[20%] left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full bg-[hsl(229,100%,55%/0.12)] blur-[150px]" />
        <div className="absolute bottom-[10%] left-1/2 -translate-x-1/2 w-[400px] h-[300px] rounded-full bg-[hsl(229,100%,64%/0.08)] blur-[100px]" />
      </div>
      <Particles />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center px-6 text-center max-w-md">
        {/* Logo */}
        <div className="welcome-scale welcome-d1">
          <img
            src={uhomeSalesLogo}
            alt="UhomeSales"
            className="w-auto object-contain drop-shadow-[0_0_40px_hsl(229,100%,64%,0.3)]"
            style={{ height: "100px", clipPath: "inset(12% 0 10% 0)", margin: "-12px 0" }}
          />
        </div>

        {/* Headline */}
        <h1 className="text-3xl sm:text-4xl font-display font-bold text-white mt-6 welcome-fade-up welcome-d2">
          Bem-vindo ao{" "}
          <span className="bg-gradient-to-r from-[hsl(229,100%,72%)] to-[hsl(200,100%,70%)] bg-clip-text text-transparent">
            UhomeSales
          </span>
        </h1>

        <p className="text-white/40 text-sm sm:text-base mt-3 welcome-fade-up welcome-d2">
          Seu centro de performance imobiliária
        </p>

        {/* Homi Mascot */}
        <div className="my-10 relative welcome-scale welcome-d3">
          <div className="absolute inset-0 -m-8 rounded-full bg-[hsl(229,100%,64%/0.2)] blur-[50px] welcome-glow" />
          <div className="welcome-float">
            <img
              src={homiHero}
              alt="Homi AI"
              className="relative w-44 h-44 sm:w-52 sm:h-52 object-contain drop-shadow-[0_0_40px_hsl(229,100%,64%,0.5)]"
            />
          </div>
        </div>

        {/* CTA Button */}
        <div className="welcome-fade-up welcome-d4 w-full max-w-xs">
          <Button
            onClick={() => navigate("/")}
            className="w-full h-14 gap-3 text-base font-bold rounded-2xl border-0 transition-all duration-300 bg-gradient-to-r from-[hsl(229,100%,64%)] to-[hsl(229,78%,54%)] hover:from-[hsl(229,100%,68%)] hover:to-[hsl(229,78%,58%)] shadow-[0_4px_32px_hsl(229,100%,64%/0.35)] hover:shadow-[0_8px_40px_hsl(229,100%,64%/0.5)] active:scale-[0.98]"
          >
            Acessar meu dashboard
            <ArrowRight className="h-5 w-5" />
          </Button>
        </div>

        {nome && (
          <p className="text-white/25 text-xs mt-6 welcome-fade-up welcome-d4">
            Pronto para vender mais, {nome}? 🚀
          </p>
        )}
      </div>

      {/* Footer */}
      <div className="absolute bottom-6 z-10">
        <p className="text-center text-[10px] text-white/15 tracking-wider">
          Criado para impulsionar suas vendas · © {new Date().getFullYear()} Uhome<br />
          Todos os direitos reservados.
        </p>
      </div>
    </div>
  );
}
