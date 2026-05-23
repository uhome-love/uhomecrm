/**
 * useFocusKeyboardShortcuts — R5 Item 1.
 *
 * Atalhos do Modo Foco enquanto LeadFocusScreen está montado:
 *   ← / →  → navegar entre leads da sessão (chama os MESMOS handlers do FocusFooter — princípio 40)
 *   ESC    → sair do Modo Foco
 *
 * Guardrails:
 *   - `enabled=false` quando configPhase, empty state, TaskCompletionDialog ou Discard inline estão ativos
 *   - bail-out automático quando foco está em <input>/<textarea>/contentEditable
 *   - ignora combinações com modificador (Cmd/Ctrl/Alt) — preserva atalhos nativos do browser
 *
 * Telemetria: dispara `focus_keyboard_shortcut` em ops_events.
 */
import { useEffect } from "react";
import { logFocus } from "@/lib/focusTelemetry";

interface Params {
  onPrev: () => void;
  onNext: () => void;
  onExit: () => void;
  enabled: boolean;
  sessionId?: string | null;
  /** Callback opcional disparado quando uma seta é usada pela 1ª vez (dismissa o tooltip de R5 Item 3). */
  onArrowFirstUse?: () => void;
}

export function useFocusKeyboardShortcuts({
  onPrev, onNext, onExit, enabled, sessionId, onArrowFirstUse,
}: Params) {
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tgt = e.target as HTMLElement | null;
      if (tgt) {
        const tag = tgt.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tgt.isContentEditable) return;
      }
      let key: "arrow_left" | "arrow_right" | "escape" | null = null;
      if (e.key === "ArrowLeft") key = "arrow_left";
      else if (e.key === "ArrowRight") key = "arrow_right";
      else if (e.key === "Escape") key = "escape";
      if (!key) return;

      e.preventDefault();
      logFocus("focus_keyboard_shortcut", { key, session_id: sessionId ?? null });

      if (key === "arrow_left") {
        onArrowFirstUse?.();
        onPrev();
      } else if (key === "arrow_right") {
        onArrowFirstUse?.();
        onNext();
      } else {
        onExit();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [enabled, onPrev, onNext, onExit, sessionId, onArrowFirstUse]);
}
