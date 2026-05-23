/**
 * FocusFirstTimeTip — R5 Item 3.
 *
 * Pílula flutuante (canto inferior direito, acima do FocusFooter) que ensina
 * os atalhos ← / → na primeira sessão de Modo Foco do dia operacional BRT.
 *
 * Persistência: localStorage key `focus_keyboard_tip_shown_<YYYY-MM-DD>`
 * onde o dia operacional corta às 04h BRT (subtrai 4h antes de formatar).
 *
 * Dismiss: 6s (auto) · click fora · pressionar ← ou → (via onArrowFirstUse do hook de atalhos).
 *
 * Telemetria: focus_tip_shown / focus_tip_dismissed.
 */
import { useEffect, useState, useCallback, useRef } from "react";
import { Keyboard, X } from "lucide-react";
import { logFocus } from "@/lib/focusTelemetry";

const STORAGE_PREFIX = "focus_keyboard_tip_shown_";
const AUTO_DISMISS_MS = 6000;

/** Dia operacional BRT cortando às 04h: yyyy-mm-dd. */
function operationalDayBRT(): string {
  const now = new Date();
  // -4h para alinhar à virada às 04h BRT
  const shifted = new Date(now.getTime() - 4 * 60 * 60 * 1000);
  return shifted.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

interface Props {
  /** Sessão Focus para correlacionar telemetria. */
  sessionId?: string | null;
  /** Bump esse valor quando uma seta for usada — dismissa com reason='shortcut_used'. */
  arrowUsedSignal?: number;
}

export default function FocusFirstTimeTip({ sessionId, arrowUsedSignal }: Props) {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);
  const dayKeyRef = useRef<string>("");
  const dismissedRef = useRef(false);
  const lastArrowSignalRef = useRef<number | undefined>(arrowUsedSignal);

  const dismiss = useCallback((reason: "auto" | "click" | "shortcut_used") => {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    setExiting(true);
    logFocus("focus_tip_dismissed", { dismiss_reason: reason, session_id: sessionId ?? null });
    setTimeout(() => setVisible(false), 200);
  }, [sessionId]);

  // Mostrar 1× por dia operacional
  useEffect(() => {
    const day = operationalDayBRT();
    dayKeyRef.current = `${STORAGE_PREFIX}${day}`;
    try {
      if (localStorage.getItem(dayKeyRef.current)) return;
      localStorage.setItem(dayKeyRef.current, "1");
    } catch {
      // localStorage pode estar bloqueado — mostra mesmo assim
    }
    setVisible(true);
    logFocus("focus_tip_shown", { session_id: sessionId ?? null, day });
  }, [sessionId]);

  // Auto dismiss em 6s
  useEffect(() => {
    if (!visible || exiting) return;
    const t = setTimeout(() => dismiss("auto"), AUTO_DISMISS_MS);
    return () => clearTimeout(t);
  }, [visible, exiting, dismiss]);

  // Click-outside (qualquer click fora dismissa)
  useEffect(() => {
    if (!visible || exiting) return;
    const handler = (e: MouseEvent) => {
      const el = document.getElementById("focus-first-time-tip");
      if (el && !el.contains(e.target as Node)) dismiss("click");
    };
    // delay para não capturar o próprio click que abriu
    const t = setTimeout(() => document.addEventListener("mousedown", handler), 50);
    return () => {
      clearTimeout(t);
      document.removeEventListener("mousedown", handler);
    };
  }, [visible, exiting, dismiss]);

  // Sinal externo de seta usada
  useEffect(() => {
    if (arrowUsedSignal !== lastArrowSignalRef.current) {
      lastArrowSignalRef.current = arrowUsedSignal;
      if (visible && !exiting) dismiss("shortcut_used");
    }
  }, [arrowUsedSignal, visible, exiting, dismiss]);

  if (!visible) return null;

  return (
    <div
      id="focus-first-time-tip"
      role="status"
      className="fixed z-20 flex items-center gap-2.5 transition-all duration-200"
      style={{
        bottom: "88px",
        right: "24px",
        left: "auto",
        maxWidth: "320px",
        padding: "12px 18px",
        borderRadius: "8px",
        background: "rgba(15, 15, 35, 0.92)",
        border: "1px solid rgba(255,255,255,0.12)",
        color: "white",
        boxShadow: "0 10px 30px -8px rgba(0,0,0,0.5)",
        opacity: exiting ? 0 : 1,
        transform: exiting ? "translateY(8px)" : "translateY(0)",
      }}
    >
      <Keyboard className="w-4 h-4 text-indigo-300 shrink-0" />
      <span className="text-xs sm:text-sm font-medium leading-snug">
        Use <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-[11px] font-mono">←</kbd> /{" "}
        <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-[11px] font-mono">→</kbd> para navegar entre leads
      </span>
      <button
        onClick={() => dismiss("click")}
        className="ml-1 text-gray-400 hover:text-white shrink-0"
        aria-label="Fechar"
      >
        <X className="w-3.5 h-3.5" />
      </button>

      <style>{`
        @media (max-width: 640px) {
          #focus-first-time-tip {
            left: 16px !important;
            right: 16px !important;
            bottom: 80px !important;
            max-width: none !important;
          }
        }
      `}</style>
    </div>
  );
}
