/**
 * MutiraoPulseBanner — CTA grande no dashboard do corretor.
 * Só aparece quando existe uma sessão de Mutirão AO VIVO agora.
 * Mostra a janela real da sessão em BRT.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Radio } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRT } from "@/lib/brtTime";

export function MutiraoPulseBanner() {
  const nav = useNavigate();
  const [sessao, setSessao] = useState<{ inicio_at: string; fim_at: string } | null>(null);

  useEffect(() => {
    let mounted = true;
    async function check() {
      const nowIso = new Date().toISOString();
      const { data } = await supabase.from("oferta_ativa_sessoes")
        .select("inicio_at, fim_at").eq("status", "ao_vivo")
        .lte("inicio_at", nowIso).gte("fim_at", nowIso).limit(1);
      if (mounted) setSessao((data ?? [])[0] ?? null);
    }
    check();
    const i = setInterval(check, 60_000);
    return () => { mounted = false; clearInterval(i); };
  }, []);

  const live = !!sessao;

  // Sem sessão ao vivo agora → nada aparece.
  if (!live) return null;

  const janela = sessao
    ? `Hoje das ${formatBRT(sessao.inicio_at, "HH:mm")} às ${formatBRT(sessao.fim_at, "HH:mm")} — entre agora`
    : "Prepare-se — a fila abre já já";

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
          {janela}
        </p>
      </div>
      <div className="px-3 py-1.5 rounded-full bg-white/20 text-sm font-semibold">Entrar →</div>
    </button>
  );
}
