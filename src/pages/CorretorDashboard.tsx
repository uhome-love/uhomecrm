import { useState, useCallback, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import { Phone, MessageSquare, Home, Sparkles, ExternalLink, Clock, CheckCircle2, Loader2, CloudDownload, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import PriorityBadge from "@/components/PriorityBadge";
import { getDaysSinceContact } from "@/lib/leadUtils";
import type { Lead, LeadPriority } from "@/types/lead";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

function mapPriority(p: string): LeadPriority {
  const map: Record<string, LeadPriority> = {
    muito_quente: "muito_quente", quente: "quente", morno: "morno", frio: "frio", perdido: "perdido",
    alta: "muito_quente", media: "morno", baixa: "frio",
  };
  return map[p] || "morno";
}

function buildWhatsAppLink(telefone: string, mensagem: string): string {
  let phone = telefone.replace(/\D/g, "");
  if (phone.length <= 11 && !phone.startsWith("55")) phone = "55" + phone;
  return `https://wa.me/${phone}?text=${encodeURIComponent(mensagem)}`;
}

export default function CorretorDashboard() {
  const { user } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loadingLeadId, setLoadingLeadId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [jetimobUserId, setJetimobUserId] = useState<string | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);

  // Fetch the corretor's jetimob_user_id from profile
  useEffect(() => {
    if (!user) return;
    const fetchProfile = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("jetimob_user_id")
        .eq("user_id", user.id)
        .single();
      setJetimobUserId(data?.jetimob_user_id || null);
      setProfileLoaded(true);
    };
    fetchProfile();
  }, [user]);

  // Auto-load leads when profile is ready
  useEffect(() => {
    if (!profileLoaded) return;
    if (!jetimobUserId) {
      setLoading(false);
      return;
    }
    loadLeads();
  }, [profileLoaded, jetimobUserId]);

  const loadLeads = useCallback(async () => {
    if (!jetimobUserId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("jetimob-proxy", {
        body: { action: "list_leads", broker_id: jetimobUserId },
      });
      if (error) throw error;
      const apiLeads = Array.isArray(data?.result) ? data.result : Array.isArray(data) ? data : [];
      
      // Filter: only leads with phone or email
      const mapped: Lead[] = apiLeads
        .filter((l: any) => (l.phones?.[0] || l.emails?.[0]))
        .map((l: any, i: number) => ({
          id: String(l.id || i + 1), nome: l.full_name || "", email: l.emails?.[0] || "",
          telefone: l.phones?.[0] || "", interesse: l.message || l.subject || "",
          origem: l.campaign_id ? `Campanha ${l.campaign_id}` : "API Jetimob",
          ultimoContato: l.created_at ? new Date(l.created_at).toLocaleDateString("pt-BR") : "",
          status: l.stage || "", corretor: l.broker_name || "",
        }));
      setLeads(mapped);

      if (mapped.length > 0) {
        // Auto-classify first batch
        const batch = mapped.slice(0, 50);
        const { data: classData } = await supabase.functions.invoke("generate-followup", {
          body: { type: "classify", leads: batch.map((l) => ({ id: l.id, nome: l.nome, interesse: l.interesse, origem: l.origem, ultimoContato: l.ultimoContato, status: l.status, temTelefone: !!l.telefone, temEmail: !!l.email })) },
        });
        if (classData?.classifications) {
          const cls = classData.classifications as Array<{ id: string; priority: string }>;
          setLeads((prev) => prev.map((l) => {
            const c = cls.find((cl) => cl.id === l.id);
            return c ? { ...l, prioridade: mapPriority(c.priority) } : l;
          }));
        }
        toast.success(`${mapped.length} leads carregados!`);
      } else {
        toast.info("Nenhum lead encontrado para você.");
      }
    } catch {
      toast.error("Erro ao carregar leads.");
    } finally { setLoading(false); }
  }, [jetimobUserId]);

  const generateMessage = useCallback(async (lead: Lead) => {
    setLoadingLeadId(lead.id);
    try {
      const { data, error } = await supabase.functions.invoke("generate-followup", {
        body: { type: "message", lead: { nome: lead.nome, interesse: lead.interesse, origem: lead.origem, ultimoContato: lead.ultimoContato, status: lead.status } },
      });
      if (error) throw error;
      setLeads((prev) => prev.map((l) => l.id === lead.id ? { ...l, mensagemGerada: data.message, prioridade: mapPriority(data.priority) } : l));
      toast.success("Mensagem gerada!");
    } catch { toast.error("Erro ao gerar mensagem."); } finally { setLoadingLeadId(null); }
  }, []);

  const handleWhatsApp = (lead: Lead) => {
    if (!lead.mensagemGerada) { toast.error("Gere a mensagem primeiro."); return; }
    if (!lead.telefone) { toast.error("Lead sem telefone."); return; }
    window.open(buildWhatsAppLink(lead.telefone, lead.mensagemGerada), "_blank");
    setCompletedIds((prev) => new Set(prev).add(lead.id));
    toast.success(`WhatsApp aberto para ${lead.nome}!`);
  };

  const markDone = (id: string) => {
    setCompletedIds((prev) => new Set(prev).add(id));
    toast.success("Tarefa concluída!");
  };

  // Organize leads into task categories
  const taskGroups = useMemo(() => {
    const active = leads.filter((l) => !completedIds.has(l.id));
    const ligar = active.filter((l) => l.telefone && (l.prioridade === "muito_quente" || l.prioridade === "quente") && !l.mensagemGerada);
    const whatsapp = active.filter((l) => l.telefone && l.mensagemGerada);
    const visita = active.filter((l) => l.imovel && l.prioridade === "muito_quente");
    return { ligar, whatsapp, visita };
  }, [leads, completedIds]);

  // No jetimob_user_id configured
  if (profileLoaded && !jetimobUserId) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center max-w-md">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-warning/10 mx-auto mb-4">
            <AlertCircle className="h-6 w-6 text-warning" />
          </div>
          <h2 className="font-display text-xl font-bold text-foreground">Configuração Pendente</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Seu perfil ainda não está vinculado ao Jetimob. Peça ao administrador para configurar seu <strong>ID do Jetimob</strong> no painel de administração.
          </p>
        </motion.div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Carregando seus leads do Jetimob...</p>
      </div>
    );
  }

  const totalTasks = taskGroups.ligar.length + taskGroups.whatsapp.length + taskGroups.visita.length;
  const allTasks = [...taskGroups.ligar, ...taskGroups.whatsapp, ...taskGroups.visita];
  // Deduplicate (a lead can appear in multiple groups)
  const uniqueTasks = Array.from(new Map(allTasks.map((l) => [l.id, l])).values());

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-bold text-foreground">Tarefas do Dia</h2>
          <p className="text-sm text-muted-foreground">{uniqueTasks.length} tarefas pendentes • {completedIds.size} concluídas • {leads.length} leads na base</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadLeads} className="gap-1.5">
          <CloudDownload className="h-3.5 w-3.5" /> Atualizar
        </Button>
      </div>

      {/* Task summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-border bg-card p-5 shadow-card">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Phone className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-display font-bold text-foreground">{taskGroups.ligar.length}</p>
              <p className="text-xs text-muted-foreground">📞 Ligar</p>
            </div>
          </div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="rounded-xl border border-border bg-card p-5 shadow-card">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
              <MessageSquare className="h-5 w-5 text-accent" />
            </div>
            <div>
              <p className="text-2xl font-display font-bold text-foreground">{taskGroups.whatsapp.length}</p>
              <p className="text-xs text-muted-foreground">💬 WhatsApp</p>
            </div>
          </div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="rounded-xl border border-border bg-card p-5 shadow-card">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10">
              <Home className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-display font-bold text-foreground">{taskGroups.visita.length}</p>
              <p className="text-xs text-muted-foreground">🏠 Convidar para visita</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Task list */}
      {uniqueTasks.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-sm">Nenhuma tarefa pendente. Todos os leads estão atualizados! 🎉</p>
        </div>
      )}

      <div className="space-y-3">
        {uniqueTasks.slice(0, 30).map((lead, i) => {
          const days = getDaysSinceContact(lead.ultimoContato);
          const dayLabel = days !== null ? `${days}d sem contato` : "sem data";

          return (
            <motion.div
              key={lead.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.02 }}
              className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card shadow-card hover:shadow-elevated transition-shadow"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-medium text-foreground truncate">{lead.nome}</p>
                  <PriorityBadge priority={lead.prioridade} />
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{lead.telefone || "sem tel"}</span>
                  <span>•</span>
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {dayLabel}</span>
                  {lead.interesse && <><span>•</span><span className="truncate max-w-[150px]">{lead.interesse}</span></>}
                </div>
                {lead.mensagemGerada && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-1 italic">"{lead.mensagemGerada}"</p>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {!lead.mensagemGerada && (
                  <Button size="sm" variant="outline" onClick={() => generateMessage(lead)} disabled={loadingLeadId === lead.id} className="gap-1.5 text-xs">
                    <Sparkles className={`h-3.5 w-3.5 ${loadingLeadId === lead.id ? "animate-pulse" : ""}`} /> Gerar IA
                  </Button>
                )}
                {lead.mensagemGerada && lead.telefone && (
                  <Button size="sm" onClick={() => handleWhatsApp(lead)} className="gap-1.5 text-xs">
                    <ExternalLink className="h-3 w-3" /> WhatsApp
                  </Button>
                )}
                {lead.telefone && !lead.mensagemGerada && (
                  <Button size="sm" variant="outline" onClick={() => window.open(`tel:${lead.telefone}`, "_self")} className="gap-1.5 text-xs">
                    <Phone className="h-3 w-3" /> Ligar
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => markDone(lead.id)} className="gap-1 text-xs text-muted-foreground hover:text-accent">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
