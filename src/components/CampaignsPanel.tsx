import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Megaphone, ExternalLink, Users, Clock, ChevronDown, ChevronUp, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import type { Lead } from "@/types/lead";
import { getDaysSinceContact } from "@/lib/leadUtils";

interface CampaignsPanelProps {
  leads: Lead[];
  onGenerateMessages: (leadIds: string[]) => void;
  generatingBulk: boolean;
}

const CAMPAIGNS = [
  { key: "7dias", label: "Reativação 7 dias", description: "Leads sem contato há 7 dias — maior chance de reativação", minDays: 7, maxDays: 14, color: "bg-accent/10 text-accent border-accent/30" },
  { key: "30dias", label: "Reativação 30 dias", description: "Leads sem contato há 30 dias — enviar novidades relevantes", minDays: 30, maxDays: 59, color: "bg-warning/10 text-warning border-warning/30" },
  { key: "90dias", label: "Reativação 90 dias", description: "Leads antigos — última tentativa com oferta especial", minDays: 90, maxDays: Infinity, color: "bg-destructive/10 text-destructive border-destructive/30" },
];

function buildWhatsAppLink(telefone: string, mensagem: string): string {
  let phone = telefone.replace(/\D/g, "");
  if (phone.length <= 11 && !phone.startsWith("55")) phone = "55" + phone;
  return `https://wa.me/${phone}?text=${encodeURIComponent(mensagem)}`;
}

export default function CampaignsPanel({ leads, onGenerateMessages, generatingBulk }: CampaignsPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null);
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());

  const campaignLeads = useMemo(() => {
    const result: Record<string, Lead[]> = {};
    CAMPAIGNS.forEach((c) => {
      result[c.key] = leads.filter((l) => {
        const days = getDaysSinceContact(l.ultimoContato);
        if (days === null) return c.maxDays === Infinity;
        return days >= c.minDays && days < c.maxDays;
      });
    });
    return result;
  }, [leads]);

  const currentLeads = selectedCampaign ? campaignLeads[selectedCampaign] || [] : [];
  const leadsComMensagem = currentLeads.filter((l) => l.mensagemGerada && l.telefone);

  const toggleLead = (id: string) => {
    setSelectedLeadIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedLeadIds.size === leadsComMensagem.length) {
      setSelectedLeadIds(new Set());
    } else {
      setSelectedLeadIds(new Set(leadsComMensagem.map((l) => l.id)));
    }
  };

  const handleBulkWhatsApp = () => {
    const toSend = leadsComMensagem.filter((l) => selectedLeadIds.has(l.id));
    if (toSend.length === 0) { toast.error("Selecione leads com mensagem gerada."); return; }
    // Open wa.me links sequentially with delays
    let i = 0;
    const openNext = () => {
      if (i >= toSend.length) {
        toast.success(`${toSend.length} abas do WhatsApp abertas!`);
        return;
      }
      const lead = toSend[i];
      const url = buildWhatsAppLink(lead.telefone, lead.mensagemGerada!);
      window.open(url, "_blank");
      setSentIds((prev) => new Set(prev).add(lead.id));
      i++;
      if (i < toSend.length) setTimeout(openNext, 800);
      else toast.success(`${toSend.length} abas do WhatsApp abertas!`);
    };
    openNext();
  };

  const handleGenerateForCampaign = () => {
    const withoutMessage = currentLeads.filter((l) => !l.mensagemGerada).map((l) => l.id);
    if (withoutMessage.length === 0) { toast.info("Todos os leads já possuem mensagem."); return; }
    onGenerateMessages(withoutMessage);
  };

  if (leads.length === 0) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <Megaphone className="h-4 w-4 text-primary" />
          </div>
          <div className="text-left">
            <h3 className="font-display font-semibold text-foreground text-sm">Campanhas de Reativação</h3>
            <p className="text-xs text-muted-foreground">Selecione uma campanha e execute em massa</p>
          </div>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="px-4 pb-4 space-y-4">
              {/* Campaign cards */}
              <div className="grid grid-cols-3 gap-3">
                {CAMPAIGNS.map((c) => {
                  const count = campaignLeads[c.key].length;
                  const isActive = selectedCampaign === c.key;
                  return (
                    <button
                      key={c.key}
                      onClick={() => { setSelectedCampaign(isActive ? null : c.key); setSelectedLeadIds(new Set()); }}
                      className={`rounded-lg border p-4 text-left transition-all ${isActive ? "ring-2 ring-primary border-primary bg-primary/5" : `${c.color} hover:shadow-sm`}`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Clock className="h-3.5 w-3.5" />
                        <span className="text-sm font-semibold">{c.label}</span>
                      </div>
                      <p className="text-xs opacity-70 mb-2">{c.description}</p>
                      <div className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        <span className="text-lg font-display font-bold">{count}</span>
                        <span className="text-xs opacity-70">leads</span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Selected campaign details */}
              {selectedCampaign && currentLeads.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-foreground font-medium">
                      {currentLeads.length} leads na campanha • {leadsComMensagem.length} com mensagem pronta
                    </p>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={handleGenerateForCampaign} disabled={generatingBulk} className="gap-1.5 text-xs">
                        {generatingBulk ? "Gerando..." : "Gerar Mensagens IA"}
                      </Button>
                      <Button size="sm" onClick={handleBulkWhatsApp} disabled={selectedLeadIds.size === 0} className="gap-1.5 text-xs">
                        <ExternalLink className="h-3 w-3" /> Enviar WhatsApp ({selectedLeadIds.size})
                      </Button>
                    </div>
                  </div>

                  {leadsComMensagem.length > 0 && (
                    <div className="space-y-1 max-h-64 overflow-y-auto">
                      <div className="flex items-center gap-2 px-2 py-1">
                        <Checkbox checked={selectedLeadIds.size === leadsComMensagem.length && leadsComMensagem.length > 0} onCheckedChange={toggleAll} />
                        <span className="text-xs text-muted-foreground font-medium">Selecionar todos ({leadsComMensagem.length})</span>
                      </div>
                      {leadsComMensagem.map((lead) => (
                        <div key={lead.id} className={`flex items-center gap-3 px-2 py-2 rounded-md border transition-colors ${sentIds.has(lead.id) ? "bg-success/5 border-success/20" : "border-border hover:bg-muted/20"}`}>
                          <Checkbox checked={selectedLeadIds.has(lead.id)} onCheckedChange={() => toggleLead(lead.id)} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{lead.nome}</p>
                            <p className="text-xs text-muted-foreground truncate">{lead.telefone} • {lead.interesse || "—"}</p>
                          </div>
                          {sentIds.has(lead.id) && <Badge variant="outline" className="bg-success/10 text-success border-success/20 text-[10px]"><Check className="h-2.5 w-2.5 mr-0.5" />Enviado</Badge>}
                        </div>
                      ))}
                    </div>
                  )}

                  {leadsComMensagem.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Nenhum lead com mensagem gerada. Clique em "Gerar Mensagens IA" primeiro.
                    </p>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
