import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Check, X, Clock, AlertTriangle, Building2, User, Inbox, ChevronLeft, ChevronRight, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface PendingLead {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  empreendimento: string | null;
  origem: string | null;
  observacoes: string | null;
  aceite_expira_em: string | null;
  distribuido_em: string | null;
  prioridade_lead: string;
  campanha?: string | null;
}

function getCampaignLabel(origem?: string | null, campanha?: string | null) {
  if (!origem && !campanha) return null;
  const o = origem?.toLowerCase() || "";
  const c = campanha?.toLowerCase() || "";
  if (o.includes("brevo_email") || o.includes("email")) {
    return c.includes("melnick") ? "📧 Email Melnick Day" : "📧 Campanha Email";
  }
  if (o.includes("brevo_sms") || o.includes("sms")) {
    return c.includes("melnick") ? "📱 SMS Melnick Day" : "📱 Campanha SMS";
  }
  if (o.includes("whatsapp")) {
    return c.includes("melnick") ? "💬 WhatsApp Melnick Day" : "💬 Campanha WhatsApp";
  }
  return null;
}

const REJECTION_REASONS = [
  { value: "ocupado", label: "Estou ocupado" },
  { value: "cliente_repetido", label: "Cliente repetido" },
  { value: "fora_regiao", label: "Fora da minha região" },
  { value: "produto_nao_trabalha", label: "Não trabalho este produto" },
  { value: "outro", label: "Outro motivo" },
];

function CountdownRing({ expiresAt }: { expiresAt: string }) {
  const [remaining, setRemaining] = useState(0);
  // TODO: TEMPORÁRIO - dia de teste 09/03. Reverter para 300 depois.
  const TOTAL = 600; // 10 min

  useEffect(() => {
    const update = () => {
      const diff = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
      setRemaining(diff);
    };
    update();
    const iv = setInterval(update, 1000);
    return () => clearInterval(iv);
  }, [expiresAt]);

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const isUrgent = remaining < 60;
  const pct = Math.min(remaining / TOTAL, 1);
  const circumference = 2 * Math.PI * 40;
  const offset = circumference * (1 - pct);

  return (
    <div className="relative flex items-center justify-center">
      <svg width="100" height="100" className="-rotate-90">
        <circle cx="50" cy="50" r="40" fill="none" strokeWidth="6" className="stroke-muted/30" />
        <circle
          cx="50" cy="50" r="40" fill="none" strokeWidth="6"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={`transition-all duration-1000 ${isUrgent ? "stroke-destructive" : "stroke-primary"}`}
        />
      </svg>
      <div className={`absolute font-mono text-xl font-black ${isUrgent ? "text-destructive animate-pulse" : "text-foreground"}`}>
        {mins}:{secs.toString().padStart(2, "0")}
      </div>
    </div>
  );
}

function LeadPopupCard({ lead, onResult, total, current }: { lead: PendingLead; onResult: () => void; total: number; current: number }) {
  const [mode, setMode] = useState<"initial" | "rejecting">("initial");
  const [selectedReason, setSelectedReason] = useState("ocupado");
  const [loading, setLoading] = useState(false);

  const handleAccept = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("distribute-lead", {
        body: { pipeline_lead_id: lead.id, action: "aceitar" },
      });
      if (error) throw error;
      if (data?.success === false) {
        toast.error(data.reason === "sla_expired" ? "SLA expirado. Lead redistribuído." : "Erro ao aceitar lead.");
      } else {
        toast.success("Lead aceito! Bom atendimento! 🚀");
      }
    } catch {
      toast.error("Erro ao aceitar lead");
    }
    setLoading(false);
    onResult();
  };

  const handleReject = async () => {
    setLoading(true);
    try {
      await supabase.functions.invoke("distribute-lead", {
        body: { pipeline_lead_id: lead.id, action: "rejeitar", motivo: selectedReason },
      });
      toast.info("Lead devolvido à roleta.");
    } catch {
      toast.error("Erro ao rejeitar lead");
    }
    setLoading(false);
    setMode("initial");
    onResult();
  };

  const isHighPriority = lead.prioridade_lead === "alta";

  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0, y: 20 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      exit={{ scale: 0.9, opacity: 0, y: -20 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      className="w-full max-w-md mx-auto"
    >
      <div className={`relative rounded-2xl border-2 shadow-2xl overflow-hidden bg-card ${
        isHighPriority ? "border-destructive/50 shadow-destructive/20" : "border-primary/30 shadow-primary/10"
      }`}>
        {/* Glow effect */}
        <div className={`absolute inset-0 opacity-5 ${isHighPriority ? "bg-destructive" : "bg-primary"}`} />

        {/* Header bar */}
        <div className={`relative px-4 py-3 flex items-center justify-between ${
          isHighPriority ? "bg-destructive/10" : "bg-primary/10"
        }`}>
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-full ${isHighPriority ? "bg-destructive/20" : "bg-primary/20"}`}>
              <Zap className={`h-4 w-4 ${isHighPriority ? "text-destructive" : "text-primary"}`} />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Novo Lead</p>
              {total > 1 && (
                <p className="text-[10px] text-muted-foreground">{current} de {total} pendentes</p>
              )}
            </div>
          </div>
          <Badge variant={isHighPriority ? "destructive" : "secondary"} className="text-[10px] font-bold">
            {isHighPriority ? "🔥 PRIORIDADE" : "NORMAL"}
          </Badge>
        </div>

        {/* Timer + Lead info */}
        <div className="relative p-5 space-y-4">
          {/* Countdown */}
          {lead.aceite_expira_em && (
            <div className="flex justify-center">
              <CountdownRing expiresAt={lead.aceite_expira_em} />
            </div>
          )}

          {/* Lead details */}
          <div className="text-center space-y-1">
            <div className="flex items-center justify-center gap-2">
              <User className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-xl font-bold">{lead.nome}</h2>
            </div>
            {lead.telefone && (
              <p className="text-sm text-muted-foreground font-mono">📞 {lead.telefone}</p>
            )}
          </div>

          {/* Meta info chips */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            {lead.empreendimento && (
              <div className="flex items-center gap-1 bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-medium">
                <Building2 className="h-3 w-3" />
                {lead.empreendimento}
              </div>
            )}
            {lead.origem && (
              <div className="bg-muted px-3 py-1 rounded-full text-xs text-muted-foreground">
                {getCampaignLabel(lead.origem, lead.campanha) || lead.origem}
              </div>
            )}
          </div>

          {lead.observacoes && (
            <p className="text-xs text-muted-foreground italic text-center bg-muted/50 rounded-lg p-2">
              "{lead.observacoes}"
            </p>
          )}

          {/* Actions */}
          {mode === "initial" ? (
            <div className="flex gap-3 pt-2">
              <Button
                onClick={handleAccept}
                disabled={loading}
                size="lg"
                className="flex-1 gap-2 h-14 text-base font-bold rounded-xl shadow-lg hover:shadow-xl transition-shadow"
              >
                <Check className="h-5 w-5" />
                Aceitar Lead
              </Button>
              <Button
                onClick={() => setMode("rejecting")}
                disabled={loading}
                variant="outline"
                size="lg"
                className="gap-2 h-14 rounded-xl border-2"
              >
                <X className="h-5 w-5" />
                Rejeitar
              </Button>
            </div>
          ) : (
            <div className="space-y-3 pt-2">
              <p className="text-xs font-medium text-muted-foreground text-center">Motivo da rejeição:</p>
              <RadioGroup value={selectedReason} onValueChange={setSelectedReason} className="space-y-1.5">
                {REJECTION_REASONS.map((r) => (
                  <Label
                    key={r.value}
                    htmlFor={`r-${lead.id}-${r.value}`}
                    className={`flex items-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition-all text-sm ${
                      selectedReason === r.value
                        ? "border-destructive bg-destructive/5 text-destructive"
                        : "border-border hover:bg-accent"
                    }`}
                  >
                    <RadioGroupItem value={r.value} id={`r-${lead.id}-${r.value}`} />
                    {r.label}
                  </Label>
                ))}
              </RadioGroup>
              <div className="flex gap-3 pt-1">
                <Button
                  onClick={handleReject}
                  disabled={loading}
                  variant="destructive"
                  size="lg"
                  className="flex-1 gap-2 h-12 rounded-xl font-bold"
                >
                  <X className="h-4 w-4" /> Confirmar Rejeição
                </Button>
                <Button onClick={() => setMode("initial")} variant="ghost" size="lg" className="rounded-xl">
                  Voltar
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default function AceiteLeads() {
  const { user } = useAuth();
  const [leads, setLeads] = useState<PendingLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);

  const fetchPending = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("pipeline_leads")
      .select("id, nome, telefone, email, empreendimento, origem, observacoes, aceite_expira_em, distribuido_em, prioridade_lead, campanha")
      .eq("corretor_id", user.id)
      .eq("aceite_status", "pendente")
      .order("distribuido_em", { ascending: true });
    const newLeads = (data as PendingLead[]) || [];
    setLeads(newLeads);
    setCurrentIndex(0);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchPending(); }, [fetchPending]);

  // Realtime — listen to ALL pipeline_leads changes (FULL replica identity enables filtered delivery)
  useEffect(() => {
    if (!user) return;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const channel = supabase
      .channel("aceite-leads-rt")
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "pipeline_leads",
      }, (payload) => {
        // Only refetch if the change is relevant to this user
        const newRow = payload.new as any;
        const oldRow = payload.old as any;
        if (newRow?.corretor_id === user.id || oldRow?.corretor_id === user.id) {
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => fetchPending(), 800);
        }
      })
      .subscribe();
    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, [user, fetchPending]);

  // Auto-refresh when tab becomes visible
  useEffect(() => {
    if (!user) return;
    const handleVisibility = () => {
      if (document.visibilityState === "visible") fetchPending();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [user, fetchPending]);

  // Polling removed — realtime channel + visibilitychange handle freshness

  const currentLead = leads[currentIndex] || null;

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center px-4 py-6">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="flex items-center justify-center gap-2 mb-1">
          <Inbox className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-bold">Aceite de Leads</h1>
        </div>
        {leads.length > 0 && (
          <Badge variant="destructive" className="animate-pulse">
            {leads.length} pendente{leads.length > 1 ? "s" : ""}
          </Badge>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Clock className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : leads.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-4 py-12"
        >
          <div className="w-20 h-20 mx-auto rounded-full bg-muted/50 flex items-center justify-center">
            <Check className="h-10 w-10 text-muted-foreground/40" />
          </div>
          <div>
            <p className="font-medium text-muted-foreground">Nenhum lead pendente</p>
            <p className="text-xs text-muted-foreground/70 mt-1">Quando um novo lead for distribuído, ele aparecerá aqui.</p>
          </div>
        </motion.div>
      ) : (
        <>
          <AnimatePresence mode="wait">
            {currentLead && (
              <LeadPopupCard
                key={currentLead.id}
                lead={currentLead}
                onResult={fetchPending}
                total={leads.length}
                current={currentIndex + 1}
              />
            )}
          </AnimatePresence>

          {/* Navigation dots for multiple leads */}
          {leads.length > 1 && (
            <div className="flex items-center gap-3 mt-6">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full"
                disabled={currentIndex === 0}
                onClick={() => setCurrentIndex(i => Math.max(0, i - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex gap-1.5">
                {leads.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentIndex(i)}
                    className={`w-2 h-2 rounded-full transition-all ${
                      i === currentIndex ? "bg-primary w-6" : "bg-muted-foreground/30"
                    }`}
                  />
                ))}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full"
                disabled={currentIndex === leads.length - 1}
                onClick={() => setCurrentIndex(i => Math.min(leads.length - 1, i + 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
