import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import ImmersiveScreen, { ConfettiBurst, ImmersiveLabel } from "./ImmersiveScreen";

interface SessionStats {
  ligacoes: number;
  aproveitados: number;
  visitas: number;
  pontos: number;
  taxaAproveitamento: number;
  mediaAnterior?: number;
  tituloAnterior?: { emoji: string; label: string };
  tituloAtual?: { emoji: string; label: string };
  metaCompleta?: boolean;
}

interface Props {
  stats: SessionStats;
  homiMessage?: string;
  onNewSession: () => void;
  onClose: () => void;
}

export default function SessionSummaryScreen({ stats, homiMessage, onNewSession, onClose }: Props) {
  const navigate = useNavigate();
  const titleChanged = stats.tituloAnterior && stats.tituloAtual &&
    stats.tituloAnterior.label !== stats.tituloAtual.label;

  return (
    <ImmersiveScreen fullScreen onClose={onClose}>
      <div className="flex flex-col items-center justify-center min-h-screen px-4 py-8 gap-6">
        {stats.metaCompleta && <ConfettiBurst count={60} />}

        <ImmersiveLabel>
          {stats.metaCompleta ? "META COMPLETA" : "SESSÃO ENCERRADA"}
        </ImmersiveLabel>

        <motion.h1
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-4xl font-black text-white text-center"
        >
          {stats.metaCompleta ? "Você é LENDA hoje!" : "Boa sessão!"}
        </motion.h1>

        {/* Stats grid */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-4 gap-3 w-full max-w-lg"
        >
          {[
            { icon: "📞", value: stats.ligacoes, label: "ligações" },
            { icon: "✅", value: stats.aproveitados, label: "aprov." },
            { icon: "📅", value: stats.visitas, label: "visitas" },
            { icon: "⭐", value: `${stats.pontos}pts`, label: "ganhos" },
          ].map((item, i) => (
            <motion.div
              key={item.label}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.3 + i * 0.1 }}
              className="rounded-xl border border-white/15 bg-white/5 p-3 text-center backdrop-blur-sm"
            >
              <p className="text-lg mb-0.5">{item.icon}</p>
              <p className="text-2xl font-bold text-white">{item.value}</p>
              <p className="text-[10px] text-neutral-400">{item.label}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* HOMI feedback */}
        {homiMessage && (
          <motion.div
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="max-w-md w-full rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm"
          >
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                <img src="/images/homi-mascot-official.png" alt="HOMI" className="h-6 w-6 object-contain" />
              </div>
              <p className="text-sm text-neutral-300 leading-relaxed">{homiMessage}</p>
            </div>
          </motion.div>
        )}

        {/* Title evolution */}
        {titleChanged && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="flex items-center gap-3 text-white"
          >
            <span className="text-3xl">{stats.tituloAnterior!.emoji}</span>
            <span className="text-xl text-neutral-500">→</span>
            <span className="text-3xl">{stats.tituloAtual!.emoji}</span>
            <p className="text-sm text-[#60A5FA] font-bold">
              Você virou {stats.tituloAtual!.label} hoje!
            </p>
          </motion.div>
        )}

        {/* Actions */}
        <motion.div
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 1 }}
          className="flex gap-3 mt-2"
        >
          <Button
            onClick={onNewSession}
            className="gap-2 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white border-0 rounded-xl px-6 h-11"
          >
            🔥 Nova sessão
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate("/pipeline-leads")}
            className="gap-2 border-white/20 text-white bg-white/5 hover:bg-white/10 rounded-xl px-6 h-11"
          >
            📋 Ver pipeline
          </Button>
        </motion.div>
      </div>
    </ImmersiveScreen>
  );
}
