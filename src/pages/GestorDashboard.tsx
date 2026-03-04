import { useState, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { Sparkles, Upload, Send, CloudDownload, Loader2, Flame, Phone, MessageSquare, Home, TrendingUp, Users, BarChart3 } from "lucide-react";
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
import { getDaysSinceContact, calculateRecoveryScore, type QuickFilter } from "@/lib/leadUtils";
import type { Lead, LeadPriority } from "@/types/lead";
import { supabase } from "@/integrations/supabase/client";

type Step = "upload" | "dashboard";

function mapPriority(p: string): LeadPriority {
  const map: Record<string, LeadPriority> = {
    muito_quente: "muito_quente", quente: "quente", morno: "morno", frio: "frio", perdido: "perdido",
    alta: "muito_quente", media: "morno", baixa: "frio",
  };
  return map[p] || "morno";
}

export default function GestorDashboard() {
  const [step, setStep] = useState<Step>("upload");
  const [csvData, setCsvData] = useState<Record<string, string>[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loadingLeadId, setLoadingLeadId] = useState<string | null>(null);
  const [classifyingAll, setClassifyingAll] = useState(false);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [reactivationFilter, setReactivationFilter] = useState<number | null>(null);
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("todos");
  const [importingFromApi, setImportingFromApi] = useState(false);
  const [interesseFilter, setInteresseFilter] = useState<string | null>(null);
  const [generatingBulk, setGeneratingBulk] = useState(false);
  const [showMapper, setShowMapper] = useState(false);

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
        };
        lead.recoveryScore = calculateRecoveryScore(lead);
        return lead;
      });
      setLeads(mapped);
      setStep("dashboard");
      toast.success(`${mapped.length} leads importados da API Jetimob!`);
    } catch (err) {
      console.error("API import error:", err);
      toast.error("Erro ao importar leads da API Jetimob.");
    } finally { setImportingFromApi(false); }
  }, []);

  const handleMappingComplete = useCallback(async (mapping: Record<string, string>) => {
    const mapped: Lead[] = csvData.map((row, i) => {
      const lead: Lead = {
        id: String(i + 1), nome: row[mapping.nome] || "", email: row[mapping.email] || "",
        telefone: row[mapping.telefone] || "", interesse: row[mapping.interesse] || "",
        origem: row[mapping.origem] || "", ultimoContato: row[mapping.ultimoContato] || "", status: row[mapping.status] || "",
      };
      lead.recoveryScore = calculateRecoveryScore(lead);
      return lead;
    });
    setLeads(mapped);
    setStep("dashboard");
    setShowMapper(false);
    toast.success(`${mapped.length} leads importados com sucesso!`);
  }, [csvData]);

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
      setLeads((prev) => prev.map((l) => l.id === lead.id ? { ...l, mensagemGerada: data.message, prioridade: mapPriority(data.priority) } : l));
      toast.success("Mensagem gerada!");
    } catch { toast.error("Erro ao gerar mensagem."); } finally { setLoadingLeadId(null); }
  }, []);

  const classifyAllLeads = useCallback(async () => {
    setClassifyingAll(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-followup", {
        body: { type: "classify", leads: leads.map((l) => ({ id: l.id, nome: l.nome, interesse: l.interesse, origem: l.origem, ultimoContato: l.ultimoContato, status: l.status, temTelefone: !!l.telefone, temEmail: !!l.email })) },
      });
      if (error) throw error;
      const classifications = data.classifications as Array<{ id: string; priority: string }>;
      setLeads((prev) => prev.map((l) => {
        const c = classifications.find((cl) => cl.id === l.id);
        return c ? { ...l, prioridade: mapPriority(c.priority) } : l;
      }));
      toast.success("Leads classificados!");
    } catch { toast.error("Erro ao classificar."); } finally { setClassifyingAll(false); }
  }, [leads]);

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
          setLeads((prev) => prev.map((l) => l.id === id ? { ...l, mensagemGerada: data.message, prioridade: mapPriority(data.priority) } : l));
          success++;
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 500));
    }
    setGeneratingBulk(false);
    toast.success(`${success} mensagens geradas!`);
  }, [leads]);

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
  }, [leads, quickFilter, reactivationFilter, interesseFilter]);

  // KPI cards for gestão
  const kpis = useMemo(() => {
    const withPhone = leads.filter((l) => l.telefone).length;
    const highScore = leads.filter((l) => (l.recoveryScore || 0) >= 80).length;
    const goodScore = leads.filter((l) => (l.recoveryScore || 0) >= 60 && (l.recoveryScore || 0) < 80).length;
    const readyToContact = leads.filter((l) => l.telefone && (l.recoveryScore || 0) >= 60).length;
    const avgScore = leads.length > 0 ? Math.round(leads.reduce((sum, l) => sum + (l.recoveryScore || 0), 0) / leads.length) : 0;
    return [
      { label: "Oportunidade Alta (80+)", value: highScore, icon: "🟢", color: "bg-success/10 text-success border-success/20" },
      { label: "Oportunidade Boa (60-79)", value: goodScore, icon: "🔵", color: "bg-accent/10 text-accent border-accent/20" },
      { label: "Prontos p/ contato (60+)", value: readyToContact, icon: "📞", color: "bg-primary/10 text-primary border-primary/20" },
      { label: "Score Médio", value: avgScore, icon: "📊", color: "bg-warning/10 text-warning border-warning/20" },
    ];
  }, [leads]);

  return (
    <div className="p-6 space-y-6">
      {step === "upload" && (
        <div className="max-w-2xl mx-auto space-y-6">
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-center">
            <h2 className="font-display text-2xl font-bold text-foreground">
              Painel de <span className="text-primary">Gestão</span>
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Importe leads para análise estratégica e geração de campanhas
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
            </>
          )}
        </div>
      )}

      {step === "dashboard" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
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
            <Button variant="ghost" onClick={() => { setStep("upload"); setLeads([]); setQuickFilter("todos"); }} className="gap-1.5 ml-auto">
              <Upload className="h-4 w-4" /> Reimportar
            </Button>
          </div>

          {/* Strategic KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {kpis.map((kpi) => (
              <motion.div key={kpi.label} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className={`rounded-xl border p-4 ${kpi.color}`}>
                <span className="text-2xl">{kpi.icon}</span>
                <p className="text-2xl font-display font-bold mt-1">{kpi.value}</p>
                <p className="text-xs opacity-80">{kpi.label}</p>
              </motion.div>
            ))}
          </div>

          <StatsCards leads={leads} />
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
          <LeadTable leads={filteredLeads} onGenerateMessage={generateMessage} loadingLeadId={loadingLeadId} />
        </motion.div>
      )}

      <BulkWhatsAppDialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen} leads={leads} />
    </div>
  );
}
