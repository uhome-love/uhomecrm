// Health-check leve do backend (Lovable Cloud).
// NÃO intercepta fetches, NÃO usa wrapper, NÃO cria segundo cliente.
// É só um useQuery que pinga um endpoint barato a cada 60s.
//
// Após 2 falhas consecutivas, sinaliza degraded=true para o banner único.
// Volta sozinho quando o próximo ping passa.
//
// Regra-mestra: este hook NUNCA pausa retries de outras queries, NUNCA cancela
// nada, NUNCA muda comportamento de fetch. É só observador.

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useBackendHealth() {
  const [degraded, setDegraded] = useState(false);
  const failuresRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const ping = async () => {
      try {
        // Query super leve: count(*) na tabela pública pipeline_stages com head=true.
        // Não traz dados, só valida que o REST/JWT estão vivos.
        const { error } = await supabase
          .from("pipeline_stages")
          .select("id", { count: "exact", head: true })
          .limit(1);

        if (cancelled) return;
        if (error) throw error;

        failuresRef.current = 0;
        if (degraded) setDegraded(false);
      } catch {
        if (cancelled) return;
        failuresRef.current += 1;
        if (failuresRef.current >= 2 && !degraded) {
          setDegraded(true);
        }
      } finally {
        if (!cancelled) {
          timer = setTimeout(ping, 60_000);
        }
      }
    };

    // Primeiro ping após 5s (deixa o app iniciar tranquilo)
    timer = setTimeout(ping, 5_000);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [degraded]);

  return { degraded };
}
