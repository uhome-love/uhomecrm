/**
 * SearchAlertModal — modal to create search alerts for the current filter set.
 */

import React, { useState, useMemo } from "react";
import { X, Bell, MessageCircle, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import type { ImoveisFilters } from "@/stores/imoveisSearchStore";

interface Props {
  open: boolean;
  onClose: () => void;
  filters: ImoveisFilters;
  queryIA?: string | null;
  userId: string;
}

export function SearchAlertModal({ open, onClose, filters, queryIA, userId }: Props) {
  const resumo = useMemo(() => {
    const parts: string[] = [];
    if (filters.tipo) parts.push(filters.tipo.charAt(0).toUpperCase() + filters.tipo.slice(1) + "s");
    if (filters.bairro) {
      const bairros = filters.bairro.split(",").map(s => s.trim()).filter(Boolean);
      parts.push(bairros.length <= 2 ? bairros.join(", ") : `${bairros[0]} +${bairros.length - 1}`);
    }
    if (filters.precoMax) {
      const fmt = filters.precoMax >= 1_000_000
        ? `R$ ${(filters.precoMax / 1_000_000).toFixed(1).replace(".0", "")}M`
        : `R$ ${Math.round(filters.precoMax / 1_000)}k`;
      parts.push(`até ${fmt}`);
    }
    if (filters.quartos) parts.push(`${filters.quartos}+ quartos`);
    if (queryIA) parts.push(`IA: "${queryIA}"`);
    return parts.length > 0 ? parts.join(" · ") : "Todos os imóveis";
  }, [filters, queryIA]);

  const [nome, setNome] = useState(resumo);
  const [frequencia, setFrequencia] = useState<"imediato" | "diario" | "semanal">("imediato");
  const [whatsapp, setWhatsapp] = useState(true);
  const [email, setEmail] = useState(false);
  const [saving, setSaving] = useState(false);

  // Reset on open
  React.useEffect(() => {
    if (open) {
      setNome(resumo);
      setFrequencia("imediato");
      setWhatsapp(true);
      setEmail(false);
    }
  }, [open, resumo]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from("alertas_busca").insert({
        corretor_id: userId,
        filtros: filters as any,
        query_ia: queryIA || null,
        nome,
        frequencia,
        canais: { whatsapp, email },
        ativo: true,
      });
      if (error) throw error;
      toast.success("Alerta criado! Você será notificado quando novos imóveis corresponderem a essa busca.");
      onClose();
    } catch (e) {
      console.error("Save alert error:", e);
      toast.error("Erro ao criar alerta");
    } finally {
      setSaving(false);
    }
  };

  const freqOptions = [
    { value: "imediato" as const, label: "Imediato" },
    { value: "diario" as const, label: "Diário" },
    { value: "semanal" as const, label: "Semanal" },
  ];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
                  <Bell className="h-4.5 w-4.5 text-primary" />
                </div>
                <h3 className="text-base font-bold text-foreground">Criar alerta para essa busca</h3>
              </div>
              <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-5 px-5 py-5">
              {/* Resumo */}
              <div className="rounded-xl bg-muted/30 border border-border/50 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Filtros ativos</p>
                <p className="text-sm font-medium text-foreground">{resumo}</p>
              </div>

              {/* Nome */}
              <div>
                <label className="text-[12px] font-semibold text-muted-foreground mb-1.5 block">Nome do alerta</label>
                <Input value={nome} onChange={(e) => setNome(e.target.value)} className="h-10" placeholder="Ex: Aptos Moinhos até 800k" />
              </div>

              {/* Frequência */}
              <div>
                <label className="text-[12px] font-semibold text-muted-foreground mb-2 block">Frequência</label>
                <div className="flex gap-2">
                  {freqOptions.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setFrequencia(opt.value)}
                      className={cn(
                        "flex-1 rounded-lg border px-3 py-2.5 text-[13px] font-semibold transition-all",
                        frequencia === opt.value
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-card text-foreground hover:border-foreground/30"
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Canais */}
              <div>
                <label className="text-[12px] font-semibold text-muted-foreground mb-2 block">Canais de notificação</label>
                <div className="flex gap-3">
                  <button
                    onClick={() => setWhatsapp(!whatsapp)}
                    className={cn(
                      "flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-[13px] font-semibold transition-all",
                      whatsapp
                        ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400"
                        : "border-border bg-card text-muted-foreground hover:border-foreground/30"
                    )}
                  >
                    <MessageCircle className="h-4 w-4" /> WhatsApp
                  </button>
                  <button
                    onClick={() => setEmail(!email)}
                    className={cn(
                      "flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-[13px] font-semibold transition-all",
                      email
                        ? "border-blue-500/50 bg-blue-500/10 text-blue-400"
                        : "border-border bg-card text-muted-foreground hover:border-foreground/30"
                    )}
                  >
                    <Mail className="h-4 w-4" /> Email
                  </button>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
              <Button variant="ghost" onClick={onClose} className="rounded-lg">Cancelar</Button>
              <Button onClick={handleSave} disabled={saving || !nome.trim()} className="gap-1.5 rounded-lg">
                <Bell className="h-4 w-4" />
                {saving ? "Salvando..." : "Criar alerta"}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
