import { useState, useEffect, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Bot } from "lucide-react";
import homiMascot from "@/assets/homi-mascot.png";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";

const greetings = {
  morning: [
    "Bom dia, {nome}! ☀️ Pronto pra bater meta hoje?",
    "Bom dia, {nome}! 🚀 O dia é de resultados!",
    "Bom dia, {nome}! ☕ Vamos começar forte!",
  ],
  afternoon: [
    "Boa tarde, {nome}! 💪 Como estão os números?",
    "Boa tarde, {nome}! 🎯 Foco total na segunda metade!",
    "E aí, {nome}! 🔥 A tarde é pra fechar negócio!",
  ],
  evening: [
    "Boa noite, {nome}! 🌙 Revisando o dia?",
    "Boa noite, {nome}! ✨ Planejando o amanhã?",
    "Boa noite, {nome}! 📊 Hora de analisar os resultados!",
  ],
};

const roleTips: Record<string, string[]> = {
  admin: [
    "Dica: confira os alertas do Centro de Comando.",
    "Dica: veja o ranking das equipes e identifique oportunidades.",
    "Dica: monitore o CPL das campanhas de marketing.",
  ],
  gestor: [
    "Dica: faça o checkpoint do time agora!",
    "Dica: acompanhe os negócios quentes no PDN.",
    "Dica: gere os relatórios 1:1 da semana.",
  ],
  corretor: [
    "Dica: defina sua meta do dia e comece a discagem!",
    "Dica: foque nos leads mais quentes primeiro.",
    "Dica: registre todas as tentativas para ganhar pontos!",
  ],
};

function getTimeOfDay(): "morning" | "afternoon" | "evening" {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 18) return "afternoon";
  return "evening";
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const STORAGE_KEY = "homi_last_greeting";

function HomiGreetingInner() {
  const { user } = useAuth();
  const { isAdmin, isGestor } = useUserRole();
  const [show, setShow] = useState(false);
  const [nome, setNome] = useState("");
  const [greeting, setGreeting] = useState("");
  const [tip, setTip] = useState("");

  useEffect(() => {
    if (!user) return;

    const last = localStorage.getItem(STORAGE_KEY);
    const today = new Date().toLocaleDateString("sv-SE");
    if (last === today) return;

    supabase
      .from("profiles")
      .select("nome")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        const firstName = data?.nome?.split(" ")[0] || "você";
        setNome(firstName);

        const tod = getTimeOfDay();
        setGreeting(pickRandom(greetings[tod]).replace("{nome}", firstName));

        const role = isAdmin ? "admin" : isGestor ? "gestor" : "corretor";
        setTip(pickRandom(roleTips[role]));

        localStorage.setItem(STORAGE_KEY, today);
        setTimeout(() => setShow(true), 300);
      });
  }, [user, isAdmin, isGestor]);

  useEffect(() => {
    if (!show) return;
    const timer = setTimeout(() => setShow(false), 8000);
    return () => clearTimeout(timer);
  }, [show]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 40, x: 20, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, x: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.9 }}
          transition={{ type: "spring", stiffness: 260, damping: 20 }}
          className="fixed bottom-24 right-6 z-[60] max-w-xs"
        >
          <div className="relative rounded-2xl border border-primary/15 bg-card shadow-elevated p-4 pr-9">
            <button
              onClick={() => setShow(false)}
              className="absolute top-2 right-2 h-6 w-6 flex items-center justify-center rounded-full hover:bg-muted transition-colors text-muted-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>

            <div className="flex gap-3 items-start">
              <motion.div
                animate={{ rotate: [0, 14, -8, 14, -4, 10, 0] }}
                transition={{ duration: 1.5, ease: "easeInOut", repeat: 1, repeatDelay: 1 }}
                className="shrink-0 origin-bottom-right"
              >
                <div className="h-16 w-16 rounded-2xl bg-accent border-2 border-primary/20 flex items-center justify-center overflow-hidden">
                  <img src={homiMascot} alt="Homi" className="h-14 w-14 object-contain" />
                </div>
              </motion.div>

              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold text-primary uppercase tracking-wider flex items-center gap-1 mb-1">
                  <Bot className="h-3 w-3" /> Homi AI
                </p>
                <p className="text-sm font-semibold text-foreground leading-snug">
                  {greeting}
                </p>
                <p className="text-xs text-muted-foreground mt-1.5">{tip}</p>
              </div>
            </div>

            <div className="absolute -bottom-2 right-10 w-4 h-4 bg-card border-b border-r border-primary/15 rotate-45" />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const HomiGreeting = memo(HomiGreetingInner);
export default HomiGreeting;
