import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface VendaEvent {
  nomeCliente: string;
  empreendimento?: string;
  vgv: number;
  corretorNome?: string;
}

/**
 * Global hook that listens to realtime changes on the negocios table.
 * Triggers a celebration toast when a deal moves to "assinado" or "vendido".
 */
export function useVendaRealtimeNotification() {
  const { user } = useAuth();
  const [lastVenda, setLastVenda] = useState<VendaEvent | null>(null);
  const processedIds = useRef(new Set<string>());

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("negocios-venda-realtime")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "negocios",
        },
        async (payload) => {
          const newRow = payload.new as any;
          const oldRow = payload.old as any;

          // Only trigger when fase changes TO assinado or vendido
          const targetFases = ["assinado", "vendido"];
          if (!targetFases.includes(newRow?.fase)) return;
          if (oldRow?.fase === newRow?.fase) return;

          // Prevent duplicate processing
          const eventKey = `${newRow.id}-${newRow.fase}`;
          if (processedIds.current.has(eventKey)) return;
          processedIds.current.add(eventKey);

          // Resolve corretor name
          let corretorNome = "";
          if (newRow.corretor_id) {
            const { data: profile } = await supabase
              .from("profiles")
              .select("nome")
              .eq("id", newRow.corretor_id)
              .maybeSingle();
            corretorNome = profile?.nome || "";
          }

          const venda: VendaEvent = {
            nomeCliente: newRow.nome_cliente || "Cliente",
            empreendimento: newRow.empreendimento || undefined,
            vgv: newRow.vgv_final || newRow.vgv_estimado || 0,
            corretorNome,
          };

          setLastVenda(venda);

          // Show celebratory toast for everyone
          const vgvStr = venda.vgv > 0
            ? `R$ ${venda.vgv.toLocaleString("pt-BR")}`
            : "";

          toast.success("🏆 VENDA FECHADA!", {
            description: `${venda.nomeCliente}${venda.empreendimento ? ` — ${venda.empreendimento}` : ""}${corretorNome ? ` · ${corretorNome}` : ""}${vgvStr ? ` · ${vgvStr}` : ""}`,
            duration: 8000,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return { lastVenda, clearVenda: () => setLastVenda(null) };
}
