import { useState, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { Sparkles, Upload, Send, CloudDownload, Loader2, Flame, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import CsvUploader from "@/components/CsvUploader";
import ColumnMapper from "@/components/ColumnMapper";
import LeadTable from "@/components/LeadTable";
import StatsCards from "@/components/StatsCards";
import ReactivationPanel from "@/components/ReactivationPanel";
import BulkWhatsAppDialog from "@/components/BulkWhatsAppDialog";
import QuickFilters from "@/components/QuickFilters";
import CampaignsPanel from "@/components/CampaignsPanel";
import EmpreendimentoGroup from "@/components/EmpreendimentoGroup";
import CorretorRanking from "@/components/CorretorRanking";
import RecoveryAgentPanel from "@/components/RecoveryAgentPanel";
import RecoveryDashboard from "@/components/recovery/RecoveryDashboard";
import RecoveredLeadAlert from "@/components/recovery/RecoveredLeadAlert";
import { getDaysSinceContact, calculateRecoveryScore, type QuickFilter } from "@/lib/leadUtils";
import type { Lead, LeadPriority, StatusRecuperacao } from "@/types/lead";
import { supabase } from "@/integrations/supabase/client";
import { useLeadsPersistence } from "@/hooks/useLeadsPersistence";

function mapPriority(p: string): LeadPriority {
  const map: Record<string, LeadPriority> = {
    muito_quente: "muito_quente", quente: "quente", morno: "morno", frio: "frio", perdido: "perdido",
    alta: "muito_quente", media: "morno", baixa: "frio",
  };
  return map[p] || "morno";
}

export default function GestorDashboard() {
  const { leads, setLeads, loading: loadingLeads, hasLeads, saveLeads, updateLead, deleteAllLeads } = useLeadsPersistence();
  const [csvData, setCsvData] = useState<Record<string, string>[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [loadingLeadId, setLoadingLeadId] = useState<string | null>(null);
  const [classifyingAll, setClassifyingAll] = useState(false);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [reactivationFilter, setReactivationFilter] = useState<number | null>(null);
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("todos");
  const [importingFromApi, setImportingFromApi] = useState(false);
  const [interesseFilter, setInteresseFilter] = useState<string | null>(null);
  const [generatingBulk, setGeneratingBulk] = useState(false);
  const [showMapper, setShowMapper] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusRecuperacao | null>(null);
  const [recoveredLead, setRecoveredLead] = useState<Lead | null>(null);
  const [showRecoveredAlert, setShowRecoveredAlert] = useState(false);

  const step = (!hasLeads && !loadingLeads) || showUpload ? "upload" : "dashboard";

  const handleDataParsed = useCallback((data: Record<string, string>[], headers: string[]) => {
    setCsvData(data);
    setCsvHeaders(headers);
    setShowMapper(true);
  }, []);

  const handleImportFromApi = useCallback(async () => {
    setImportingFromApi(true);
    try {
      const { data, error } = await supabase.functions.invoke("jetimob-proxy", { body: { action: "list_leads" } });
      if (error) throw error;
      const apiLeads = Array.isArray(data?.result) ? data.result : Array.isArray(data) ? data : [];
      if (apiLeads.length === 0) { toast.warning("Nenhum lead encontrado na API."); return; }
      const mapped: Lead[] = apiLeads.map((l: any, i: number) => {
        const lead: Lead = {
          id: String(l.id || i + 1), nome: l.full_name || "", email: l.emails?.[0] || "",
          telefone: l.phones?.[0] || "", interesse: l.message || l.subject || "",
          origem: l.campaign_id ? `Campanha ${l.campaign_id}` : "API Jetimob",
          ultimoContato: l.created_at ? new Date(l.created_at).toLocaleDateString("pt-BR") : "",
          status: l.stage || "", corretor: l.broker_name || "", etapa: l.stage || "", dataCriacao: l.created_at || "",
          statusRecuperacao: "pendente",
        };
        lead.recoveryScore = calculateRecoveryScore(lead);
        return lead;
      });
      await saveLeads(mapped);
      setShowUpload(false);
      toast.success(`${mapped.length} leads importados e salvos!`);
    } catch (err) {
      console.error("API import error:", err);
      toast.error("Erro ao importar leads da API Jetimob.");
    } finally { setImportingFromApi(false); }
  }, [saveLeads]);

  const handleMappingComplete = useCallback(async (mapping: Record<string, string>) => {
    const mapped: Lead[] = csvData.map((row, i) => {
      const lead: Lead = {
        id: String(i + 1), nome: row[mapping.nome] || "", email: row[mapping.email] || "",
        telefone: row[mapping.telefone] || "", interesse: row[mapping.interesse] || "",
        origem: row[mapping.origem] || "", ultimoContato: row[mapping.ultimoContato] || "", status: row[mapping.status] || "",
        statusRecuperacao: "pendente",
      };
      lead.recoveryScore = calculateRecoveryScore(lead);
      return lead;
    });
    const savedLeads = await saveLeads(mapped);
    setShowMapper(false);
    setShowUpload(false);
    toast.success(`${savedLeads.length} leads importados e salvos no banco!`);
  }, [csvData, saveLeads]);

  const generateMessage = useCallback(async (lead: Lead) => {
    setLoadingLeadId(lead.id);
    try {
      const { data, error } = await supabase.functions.invoke("generate-followup", {
        body: {
          type: "message",
          lead: {
            nome: lead.nome,
            interesse: lead.imovel
              ? `${lead.imovel.tipo} ${lead.imovel.codigo} - ${lead.imovel.dormitorios} dormitórios, ${lead.imovel.endereco_bairro}`
              : lead.interesse,
            origem: lead.origem, ultimoContato: lead.ultimoContato, status: lead.status,
          },
        },
      });
      if (error) throw error;
      const prio = mapPriority(data.priority);
      await updateLead(lead.id, { mensagemGerada: data.message, prioridade: prio });
      toast.success("Mensagem gerada!");
    } catch { toast.error("Erro ao gerar mensagem."); } finally { setLoadingLeadId(null); }
  }, [updateLead]);

  const classifyAllLeads = useCallback(async () => {
    setClassifyingAll(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-followup", {
        body: { type: "classify", leads: leads.map((l) => ({ id: l.id, nome: l.nome, interesse: l.interesse, origem: l.origem, ultimoContato: l.ultimoContato, status: l.status, temTelefone: !!l.telefone, temEmail: !!l.email })) },
      });
      if (error) throw error;
      const classifications = data.classifications as Array<{ id: string; priority: string }>;
      for (const c of classifications) {
        await updateLead(c.id, { prioridade: mapPriority(c.priority) });
      }
      toast.success("Leads classificados!");
    } catch { toast.error("Erro ao classificar."); } finally { setClassifyingAll(false); }
  }, [leads, updateLead]);

  const handleBulkGenerateMessages = useCallback(async (leadIds: string[]) => {
    setGeneratingBulk(true);
    let success = 0;
    for (const id of leadIds) {
      const lead = leads.find((l) => l.id === id);
      if (!lead) continue;
      try {
        const { data, error } = await supabase.functions.invoke("generate-followup", {
          body: { type: "message", lead: { nome: lead.nome, interesse: lead.interesse, origem: lead.origem, ultimoContato: lead.ultimoContato, status: lead.status } },
        });
        if (!error && data?.message) {
          await updateLead(id, { mensagemGerada: data.message, prioridade: mapPriority(data.priority) });
          success++;
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 500));
    }
    setGeneratingBulk(false);
    toast.success(`${success} mensagens geradas!`);
  }, [leads, updateLead]);

  const handleDeleteAll = useCallback(async () => {
    if (!confirm("Tem certeza que deseja apagar todos os leads? Esta ação não pode ser desfeita.")) return;
    await deleteAllLeads();
    setShowUpload(false);
  }, [deleteAllLeads]);

  const handleUpdateLead = useCallback(async (leadId: string, updates: Partial<Lead>) => {
    await updateLead(leadId, updates);
  }, [updateLead]);

  const handleLeadRecovered = useCallback((lead: Lead) => {
    setRecoveredLead({ ...lead, statusRecuperacao: "recuperado" });
    setShowRecoveredAlert(true);
  }, []);

  // Filter counts
  const filterCounts = useMemo(() => {
    const counts: Record<QuickFilter, number> = { todos: leads.length, muito_quentes: 0, followup_hoje: 0, "7dias": 0, "15dias": 0, "30dias": 0, "90dias": 0, top50: Math.min(50, leads.length), esquecidos: 0, com_interesse: 0, com_telefone: 0 };
    leads.forEach((l) => {
      if (l.prioridade === "muito_quente") counts.muito_quentes++;
      if (l.interesse && l.interesse.trim().length > 2) counts.com_interesse++;
      if (l.telefone && l.telefone.replace(/\D/g, "").length >= 8) counts.com_telefone++;
      const days = getDaysSinceContact(l.ultimoContato);
      if (days !== null) {
        if (days >= 7 && days < 15) counts["7dias"]++;
        if (days >= 15 && days < 30) counts["15dias"]++;
        if (days >= 30 && days < 60) counts["30dias"]++;
        if (days >= 90) { counts["90dias"]++; counts.esquecidos++; }
      } else { counts["90dias"]++; counts.esquecidos++; }
      if (l.prioridade === "muito_quente" || l.prioridade === "quente") counts.followup_hoje++;
    });
    return counts;
  }, [leads]);

  const filteredLeads = useMemo(() => {
    let result = leads;
    
    // Status filter
    if (statusFilter) {
      result = result.filter((l) => l.statusRecuperacao === statusFilter);
    }
    
    if (quickFilter !== "todos") {
      if (quickFilter === "top50") {
        result = [...result].sort((a, b) => (b.recoveryScore || 0) - (a.recoveryScore || 0)).slice(0, 50);
      } else {
        result = result.filter((l) => {
          const days = getDaysSinceContact(l.ultimoContato);
          switch (quickFilter) {
            case "muito_quentes": return l.prioridade === "muito_quente";
            case "followup_hoje": return l.prioridade === "muito_quente" || l.prioridade === "quente";
            case "com_interesse": return l.interesse && l.interesse.trim().length > 2;
            case "com_telefone": return l.telefone && l.telefone.replace(/\D/g, "").length >= 8;
            case "esquecidos": return days === null || days >= 90;
            case "7dias": return days !== null && days >= 7 && days < 15;
            case "15dias": return days !== null && days >= 15 && days < 30;
            case "30dias": return days !== null && days >= 30 && days < 60;
            case "90dias": return days === null || days >= 90;
            default: return true;
          }
        });
      }
    }
    if (reactivationFilter && reactivationFilter > 0) {
      result = result.filter((l) => {
        const days = getDaysSinceContact(l.ultimoContato);
        if (days === null) return reactivationFilter === 90;
        if (reactivationFilter === 3) return days <= 3;
        if (reactivationFilter === 7) return days > 3 && days <= 7;
        if (reactivationFilter === 15) return days > 7 && days <= 15;
        if (reactivationFilter === 30) return days > 15 && days <= 30;
        if (reactivationFilter === 60) return days > 30 && days <= 60;
        if (reactivationFilter === 90) return days > 60;
        return true;
      });
    }
    if (interesseFilter) {
      result = result.filter((l) => {
        const key = l.imovel?.codigo ? `${l.imovel.tipo} ${l.imovel.codigo} — ${l.imovel.endereco_bairro}` : l.interesse || "Sem interesse definido";
        return key === interesseFilter;
      });
    }
    return result;
  }, [leads, quickFilter, reactivationFilter, interesseFilter, statusFilter]);

  // Status filter buttons
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    leads.forEach((l) => {
      const s = l.statusRecuperacao || "pendente";
      counts[s] = (counts[s] || 0) + 1;
    });
    return counts;
  }, [leads]);

  if (loadingLeads) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {step === "upload" && (
        <div className="max-w-2xl mx-auto space-y-6">
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-center">
            <h2 className="font-display text-2xl font-bold text-foreground">
              Recuperação de <span className="text-primary">Leads</span>
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Importe leads não aproveitados do Jetimob para recuperação com IA
            </p>
          </motion.div>

          {showMapper ? (
            <ColumnMapper csvHeaders={csvHeaders} onMappingComplete={handleMappingComplete} />
          ) : (
            <>
              <CsvUploader onDataParsed={handleDataParsed} />
              <div className="flex items-center gap-4">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs text-muted-foreground">ou</span>
                <div className="h-px flex-1 bg-border" />
              </div>
              <Button variant="outline" className="w-full gap-2" disabled={importingFromApi} onClick={handleImportFromApi}>
                {importingFromApi ? <Loader2 className="h-4 w-4 animate-spin" /> : <CloudDownload className="h-4 w-4" />}
                {importingFromApi ? "Importando..." : "Importar da API Jetimob"}
              </Button>
              {hasLeads && (
                <Button variant="ghost" className="w-full" onClick={() => setShowUpload(false)}>
                  ← Voltar para os leads
                </Button>
              )}
            </>
          )}
        </div>
      )}

      {step === "dashboard" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-xl font-bold text-foreground">
                Recuperação de Leads
              </h2>
              <p className="text-sm text-muted-foreground">Máquina de recuperação de leads não aproveitados</p>
            </div>
          </div>

          {/* Action bar */}
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => { setQuickFilter("followup_hoje"); toast.info("🔥 Leads quentes para atacar hoje!"); }} className="gap-2 bg-destructive hover:bg-destructive/90 text-destructive-foreground">
              <Flame className="h-4 w-4" /> ATACAR LEADS HOJE
            </Button>
            <Button onClick={classifyAllLeads} disabled={classifyingAll} variant="outline" className="gap-2">
              <Sparkles className={`h-4 w-4 ${classifyingAll ? "animate-pulse" : ""}`} />
              {classifyingAll ? "Classificando..." : "Classificar com IA"}
            </Button>
            <Button variant="outline" onClick={() => setBulkDialogOpen(true)} className="gap-1.5">
              <Send className="h-4 w-4" /> Disparo em Massa
            </Button>
            <div className="flex items-center gap-2 ml-auto">
              <Button variant="ghost" onClick={() => setShowUpload(true)} className="gap-1.5">
                <Upload className="h-4 w-4" /> Importar mais
              </Button>
              <Button variant="ghost" onClick={handleDeleteAll} className="gap-1.5 text-destructive hover:text-destructive">
                <Trash2 className="h-4 w-4" /> Apagar todos
              </Button>
            </div>
          </div>

          {/* Recovery Dashboard */}
          <RecoveryDashboard leads={leads} />

          {/* Status filter bar */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-muted-foreground">Status:</span>
            <Button size="sm" variant={!statusFilter ? "default" : "outline"} className="h-7 text-xs" onClick={() => setStatusFilter(null)}>
              Todos ({leads.length})
            </Button>
            {([
              { key: "pendente" as const, label: "⏳ Pendente", color: "" },
              { key: "contato_realizado" as const, label: "📞 Contatado", color: "" },
              { key: "respondeu" as const, label: "💬 Respondeu", color: "" },
              { key: "reativado" as const, label: "🔄 Reativado", color: "" },
              { key: "recuperado" as const, label: "✅ Recuperado", color: "" },
              { key: "sem_interesse" as const, label: "❌ Sem Interesse", color: "" },
              { key: "numero_invalido" as const, label: "📵 Inválido", color: "" },
            ] as const).map((s) => {
              const count = statusCounts[s.key] || 0;
              if (count === 0) return null;
              return (
                <Button key={s.key} size="sm" variant={statusFilter === s.key ? "default" : "outline"} className="h-7 text-xs" onClick={() => setStatusFilter(statusFilter === s.key ? null : s.key)}>
                  {s.label} ({count})
                </Button>
              );
            })}
          </div>

          <RecoveryAgentPanel leads={leads} />
          <QuickFilters active={quickFilter} onChange={setQuickFilter} counts={filterCounts} />
          <ReactivationPanel leads={leads} onFilterByDays={(days) => setReactivationFilter(days || null)} activeFilter={reactivationFilter} />
          <CampaignsPanel leads={leads} onGenerateMessages={handleBulkGenerateMessages} generatingBulk={generatingBulk} />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <EmpreendimentoGroup leads={leads} onFilterByInteresse={setInteresseFilter} activeInteresse={interesseFilter} />
            <CorretorRanking leads={leads} />
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{filteredLeads.length} de {leads.length} leads</p>
          </div>
          <LeadTable 
            leads={filteredLeads} 
            onGenerateMessage={generateMessage} 
            loadingLeadId={loadingLeadId}
            onUpdateLead={handleUpdateLead}
            onLeadRecovered={handleLeadRecovered}
          />
        </motion.div>
      )}

      <BulkWhatsAppDialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen} leads={leads} />
      <RecoveredLeadAlert lead={recoveredLead} open={showRecoveredAlert} onOpenChange={setShowRecoveredAlert} />
    </div>
  );
}
