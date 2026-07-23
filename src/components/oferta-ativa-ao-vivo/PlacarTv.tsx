import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMutiraoRanking } from "@/hooks/useMutiraoRealtime";
import { motion, AnimatePresence } from "framer-motion";

export function PlacarTv({ sessaoId }: { sessaoId: string | null }) {
  const rank = useMutiraoRanking(sessaoId);
  const [flash, setFlash] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!sessaoId) return;
    const ch = supabase
      .channel(`placar-tv-${sessaoId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "oferta_ativa_ligacoes", filter: `sessao_id=eq.${sessaoId}` },
        (payload: any) => {
          if (payload.new?.resultado === "visita_agendada") {
            try { audioRef.current?.play(); } catch {}
            setFlash("🎉 VISITA MARCADA!");
            setTimeout(() => setFlash(null), 3500);
          }
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [sessaoId]);

  const equipes = rank.data?.equipes ?? [];
  const individuais = rank.data?.corretores ?? [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-purple-950 text-white p-6 overflow-hidden">
      {/* Beep via <audio> */}
      <audio ref={audioRef} src="https://cdn.pixabay.com/download/audio/2022/03/15/audio_b7f96eae82.mp3?filename=whistle-blow-1-101183.mp3" preload="auto" />

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-4xl font-black">⚡ MUTIRÃO INTELIGENTE</h1>
          <p className="text-sm text-white/60">Placar ao vivo · atualização em tempo real</p>
        </div>
        <div className="text-right">
          <p className="text-6xl font-black tabular-nums">
            {individuais.reduce((s, c) => s + c.visitas, 0)}
          </p>
          <p className="text-sm uppercase tracking-widest">Visitas hoje</p>
        </div>
      </div>

      <AnimatePresence>
        {flash && (
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 1.5, opacity: 0 }}
            className="fixed inset-0 flex items-center justify-center bg-black/50 z-50"
          >
            <div className="text-8xl font-black text-emerald-400 drop-shadow-[0_0_40px_rgba(52,211,153,0.8)] animate-pulse">
              {flash}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-2 gap-6">
        <div className="rounded-2xl bg-white/5 backdrop-blur border border-white/10 p-5">
          <h2 className="text-xl font-bold mb-3 text-amber-400">🏆 EQUIPES</h2>
          <div className="space-y-2">
            <AnimatePresence>
              {equipes.slice(0, 6).map((e, i) => (
                <motion.div
                  key={e.equipe}
                  layout
                  className="flex items-center gap-3 p-3 rounded-xl bg-white/5"
                >
                  <span className="text-3xl font-black w-10 text-amber-400">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-2xl font-bold truncate">TIME {e.equipe}</p>
                    <p className="text-sm text-white/60">{e.ligacoes} lig · {e.corretores} corr</p>
                  </div>
                  <div className="text-right">
                    <p className="text-4xl font-black tabular-nums text-emerald-400">{e.visitas}</p>
                    <p className="text-xs uppercase tracking-widest">Visitas</p>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>

        <div className="rounded-2xl bg-white/5 backdrop-blur border border-white/10 p-5">
          <h2 className="text-xl font-bold mb-3 text-amber-400">⭐ RANKING INDIVIDUAL</h2>
          <div className="space-y-1">
            <AnimatePresence>
              {individuais.slice(0, 10).map((c, i) => (
                <motion.div
                  key={c.corretor_id}
                  layout
                  className="flex items-center gap-3 p-2 rounded-lg bg-white/5"
                >
                  <span className="text-2xl font-black w-8 text-amber-400">{i + 1}</span>
                  {c.foto_url ? <img src={c.foto_url} className="w-10 h-10 rounded-full object-cover" /> :
                    <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">{c.nome?.slice(0, 1)}</div>}
                  <p className="flex-1 text-lg font-semibold truncate">{c.nome}</p>
                  <div className="flex gap-3 text-sm text-white/70">
                    <span>{c.ligacoes} lig</span>
                    <span className="text-emerald-400 font-bold">{c.visitas} vis</span>
                  </div>
                  <p className="text-2xl font-black tabular-nums w-16 text-right">{c.pontos}</p>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
