import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ─── Offline Retry Queue for failed finalizations ───
interface PendingAttempt {
  id: string;
  leadId: string;
  corretorId: string;
  canal: string;
  resultado: string;
  feedback: string;
  listaId: string;
  empreendimento: string | null;
  idempotencyKey: string;
  visitaMarcada: boolean;
  createdAt: number;
  retryCount: number;
}

const STORAGE_KEY = "oa_pending_attempts";
const MAX_RETRIES = 10;
const RETRY_INTERVAL = 15_000; // 15 seconds

function loadPending(): PendingAttempt[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function savePending(items: PendingAttempt[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function useOAPendingQueue() {
  const [pending, setPending] = useState<PendingAttempt[]>(() => loadPending());
  const retryRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Sync state → localStorage
  useEffect(() => {
    savePending(pending);
  }, [pending]);

  // Add to pending queue
  const addPending = useCallback((attempt: Omit<PendingAttempt, "id" | "createdAt" | "retryCount">) => {
    const item: PendingAttempt = {
      ...attempt,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      retryCount: 0,
    };
    setPending(prev => [...prev, item]);
    return item.id;
  }, []);

  // Remove from pending
  const removePending = useCallback((id: string) => {
    setPending(prev => prev.filter(p => p.id !== id));
  }, []);

  // Retry a single pending attempt
  const retryOne = useCallback(async (item: PendingAttempt): Promise<boolean> => {
    try {
      const { data, error } = await supabase.rpc("finalizar_tentativa_v2", {
        p_lead_id: item.leadId,
        p_corretor_id: item.corretorId,
        p_canal: item.canal,
        p_resultado: item.resultado,
        p_feedback: item.feedback,
        p_lista_id: item.listaId,
        p_empreendimento: item.empreendimento,
        p_idempotency_key: item.idempotencyKey,
        p_visita_marcada: item.visitaMarcada,
      });
      if (error) return false;
      const result = data as any;
      return result?.success === true;
    } catch {
      return false;
    }
  }, []);

  // Auto-retry loop
  useEffect(() => {
    if (retryRef.current) clearInterval(retryRef.current);
    if (pending.length === 0) return;

    retryRef.current = setInterval(async () => {
      const current = loadPending();
      if (current.length === 0) return;

      const updated: PendingAttempt[] = [];
      let synced = 0;

      for (const item of current) {
        if (item.retryCount >= MAX_RETRIES) {
          // Give up after max retries
          continue;
        }
        const success = await retryOne(item);
        if (success) {
          synced++;
        } else {
          updated.push({ ...item, retryCount: item.retryCount + 1 });
        }
      }

      setPending(updated);
      if (synced > 0) {
        toast.success(`✅ ${synced} resultado(s) pendente(s) sincronizado(s)!`);
      }
    }, RETRY_INTERVAL);

    return () => {
      if (retryRef.current) clearInterval(retryRef.current);
    };
  }, [pending.length, retryOne]);

  // Manual retry all
  const retryAll = useCallback(async () => {
    const current = loadPending();
    const updated: PendingAttempt[] = [];
    let synced = 0;

    for (const item of current) {
      const success = await retryOne(item);
      if (success) {
        synced++;
      } else {
        updated.push({ ...item, retryCount: item.retryCount + 1 });
      }
    }

    setPending(updated);
    if (synced > 0) {
      toast.success(`✅ ${synced} resultado(s) sincronizado(s)!`);
    } else if (current.length > 0) {
      toast.error("Falha ao sincronizar. Tentando novamente em breve...");
    }
  }, [retryOne]);

  return { pending, addPending, removePending, retryAll, hasPending: pending.length > 0 };
}
