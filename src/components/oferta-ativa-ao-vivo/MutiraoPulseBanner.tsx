/**
 * MutiraoPulseBanner — CTA grande no dashboard do corretor.
 * Pulsa na quinta-feira entre 10h e 21h BRT (janela típica do mutirão).
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Radio, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { brtMinutesOfDay } from "@/lib/brtTime";

export function MutiraoPulseBanner() {
  const nav = useNavigate();
  const [live, setLive] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function check() {
      const nowIso = new Date().toISOString();
      const { data } = await supabase.from("oferta_ativa_sessoes")
        .select("id").eq("status", "ao_vivo")
        .lte("inicio_at", nowIso).gte("fim_at", nowIso).limit(1);
      if (mounted) setLive((data ?? []).length > 0);
    }
    check();
    const i = setInterval(check, 60_000);
    return () => { mounted = false; clearInterval(i); };
  }, []);

  // Pulsa se sessão ao vivo OU janela típica (quinta 10h-21h BRT)
  const dow = new Date().toLocaleDateString("en-US", { weekday: "long", timeZone: "America/Sao_Paulo" });
  const isThursday = dow === "Thursday";
  const min = brtMinutesOfDay();
  const inWindow = isThursday && min >= 600 && min <= 1260;
  const pulse = live || inWindow;

  if (!pulse && !live) return null;

  return (
    <button
      onClick={() => nav("/oferta-ativa-ao-vivo")}
      className={`w-full rounded-2xl px-5 py-4 flex items-center gap-3 text-white text-left transition
        ${live ? "bg-gradient-to-r from-emerald-600 via-primary to-purple-600 animate-pulse" : "bg-gradient-to-r from-primary to-purple-600"}`}
    >
      <div className="p-2 rounded-full bg-white/20">
        {live ? <Radio className="w-6 h-6" /> : <Sparkles className="w-6 h-6" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-lg leading-tight">
          {live ? "🔴 MUTIRÃO INTELIGENTE AO VIVO" : "⚡ Mutirão Inteligente"}
        </p>
        <p className="text-sm text-white/80">
          {live ? "Entre agora e reative leads descartados com a fila da IA" : "Prepare-se — a fila abre já já"}
        </p>
      </div>
      <div className="px-3 py-1.5 rounded-full bg-white/20 text-sm font-semibold">Entrar →</div>
    </button>
  );
}
