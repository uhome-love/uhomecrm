import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import ImmersiveScreen, { ConfettiBurst } from "@/components/immersive/ImmersiveScreen";
import { Trophy, PartyPopper, ArrowRight, TrendingUp, Star } from "lucide-react";

interface Props {
  nomeCliente: string;
  empreendimento?: string;
  vgv: number;
  corretorNome?: string;
  onDismiss: () => void;
}

function formatVGVBig(value: number): string {
  if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(2).replace(".", ",")}M`;
  return `R$ ${value.toLocaleString("pt-BR")}`;
}

export default function VendaCelebration({ nomeCliente, empreendimento, vgv, corretorNome, onDismiss }: Props) {
  const navigate = useNavigate();
  const [show, setShow] = useState(true);

  // Auto-dismiss after 12 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setShow(false);
      setTimeout(onDismiss, 500);
    }, 12000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  // Generate sparkle positions
  const sparkles = useMemo(() =>
    Array.from({ length: 20 }, (_, i) => ({
      id: i,
      left: `${10 + Math.random() * 80}%`,
      top: `${10 + Math.random() * 80}%`,
      delay: Math.random() * 2,
      size: 8 + Math.random() * 16,
    })), []);

  if (!show) return null;

  return (
    <AnimatePresence>
      <ImmersiveScreen fullScreen onClose={onDismiss} particleCount={60}>
        <div className="flex flex-col items-center justify-center min-h-screen px-6 gap-4 relative z-10">
          {/* Multi-burst confetti */}
          <ConfettiBurst count={80} />

          {/* Sparkles */}
          {sparkles.map(s => (
            <motion.div
              key={s.id}
              className="absolute pointer-events-none"
              style={{ left: s.left, top: s.top }}
              initial={{ scale: 0, opacity: 0 }}
              animate={{
                scale: [0, 1, 0],
                opacity: [0, 1, 0],
                rotate: [0, 180, 360],
              }}
              transition={{
                duration: 2,
                delay: s.delay,
                repeat: Infinity,
                repeatDelay: 1 + Math.random() * 2,
              }}
            >
              <Star className="text-amber-400" style={{ width: s.size, height: s.size }} fill="currentColor" />
            </motion.div>
          ))}

          {/* Trophy icon */}
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 12, delay: 0.2 }}
            className="relative"
          >
            <div className="h-28 w-28 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-[0_0_60px_rgba(245,158,11,0.6)]">
              <Trophy className="h-14 w-14 text-white" fill="white" />
            </div>
            {/* Pulsing ring */}
            <motion.div
              className="absolute inset-0 rounded-full border-4 border-amber-400/50"
              animate={{ scale: [1, 1.4, 1], opacity: [0.5, 0, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          </motion.div>

          {/* Title */}
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-center"
          >
            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
              🏆 VENDA FECHADA!
            </h1>
            <p className="text-white/60 text-sm mt-1">Parabéns, esse é o momento da vitória!</p>
          </motion.div>

          {/* VGV Big Display */}
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", delay: 0.8 }}
            className="relative"
          >
            <div className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 backdrop-blur-sm border border-green-400/30 rounded-2xl px-8 py-5 text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <TrendingUp className="h-5 w-5 text-green-400" />
                <span className="text-green-400 text-xs font-bold uppercase tracking-wider">VGV Assinado</span>
              </div>
              <p className="text-4xl sm:text-5xl font-black text-white">
                {formatVGVBig(vgv)}
              </p>
            </div>
          </motion.div>

          {/* Client info */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 1.2 }}
            className="text-center space-y-1"
          >
            <p className="text-white text-lg font-bold">{nomeCliente}</p>
            {empreendimento && (
              <p className="text-white/50 text-sm">{empreendimento}</p>
            )}
            {corretorNome && (
              <p className="text-amber-400/80 text-xs font-semibold mt-2">⭐ Corretor: {corretorNome}</p>
            )}
          </motion.div>

          {/* Actions */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 1.6 }}
            className="flex items-center gap-3 mt-4"
          >
            <Button
              onClick={() => { onDismiss(); navigate("/pos-vendas"); }}
              className="gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold px-6 h-11 text-sm shadow-lg"
            >
              <PartyPopper className="h-4 w-4" />
              Iniciar Pós-Venda
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              onClick={onDismiss}
              className="text-white/60 hover:text-white hover:bg-white/10 text-sm"
            >
              Fechar
            </Button>
          </motion.div>
        </div>
      </ImmersiveScreen>
    </AnimatePresence>
  );
}
