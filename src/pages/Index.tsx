import { useState, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { Sparkles, Zap, Upload, Send, LogOut, CloudDownload, Loader2, Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import CsvUploader from "@/components/CsvUploader";
import ColumnMapper from "@/components/ColumnMapper";
import LeadTable from "@/components/LeadTable";
import StatsCards from "@/components/StatsCards";
import ReactivationPanel from "@/components/ReactivationPanel";
import BulkWhatsAppDialog from "@/components/BulkWhatsAppDialog";
import TasksPanel from "@/components/TasksPanel";
import QuickFilters from "@/components/QuickFilters";
import CampaignsPanel from "@/components/CampaignsPanel";
import EmpreendimentoGroup from "@/components/EmpreendimentoGroup";
import CorretorRanking from "@/components/CorretorRanking";
import { generateTasksForLeads, type LeadTask } from "@/lib/taskGenerator";
import { getDaysSinceContact, calculateRecoveryScore, type QuickFilter } from "@/lib/leadUtils";
import type { Lead, LeadPriority } from "@/types/lead";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type Step = "upload" | "map" | "dashboard";

// Map old API priority values to new ones
function mapPriority(p: string): LeadPriority {
  const map: Record<string, LeadPriority> = {
    muito_quente: "muito_quente", quente: "quente", morno: "morno", frio: "frio", perdido: "perdido",
    // legacy mapping
    alta: "muito_quente", media: "morno", baixa: "frio",
  };
  return map[p] || "morno";
}

export default function Index() {
  const { user, signOut } = useAuth();
  const [step, setStep] = useState<Step>("upload");
  const [csvData, setCsvData] = useState<Record<string, string>[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loadingLeadId, setLoadingLeadId] = useState<string | null>(null);
  const [classifyingAll, setClassifyingAll] = useState(false);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [reactivationFilter, setReactivationFilter] = useState<number | null>(null);
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("todos");
  const [tasks, setTasks] = useState<LeadTask[]>([]);
  const [importingFromApi, setImportingFromApi] = useState(false);
  const [interesseFilter, setInteresseFilter] = useState<string | null>(null);
  const [generatingBulk, setGeneratingBulk] = useState(false);

  const handleDataParsed = useCallback((data: Record<string, string>[], headers: string[]) => {
    setCsvData(data);
    setCsvHeaders(headers);
    setStep("map");
  }, []);

  const fetchImovelData = useCallback(async (codigo: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("jetimob-proxy", { body: { action: "get_imovel", codigo } });
      if (error || !data) return null;
      const imovel = Array.isArray(data.data) ? data.data[0] : data;
      if (!imovel?.codigo) return null;
      return {
        codigo: imovel.codigo, contrato: imovel.contrato || "", descricao_anuncio: imovel.descricao_anuncio || "",
        endereco_bairro: imovel.endereco_bairro || "", endereco_cidade: imovel.endereco_cidade || "",
        endereco_logradouro: imovel.endereco_logradouro || "", dormitorios: imovel.dormitorios || 0,
        garagens: imovel.garagens || 0, area_privativa: imovel.area_privativa || 0,
        valor: imovel.valor || imovel.valor_venda || imovel.valor_locacao || 0,
        imagem_thumb: imovel.imagens?.[0]?.link_thumb || "", tipo: imovel.tipo || "",
      };
    } catch { return null; }
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
    } finally {
      setImportingFromApi(false);
    }
  }, []);

  const handleMappingComplete = useCallback(async (mapping: Record<string, string>) => {
    const mapped: Lead[] = csvData.map((row, i) => {
      const lead: Lead = {
        id: String(i + 1), nome: row[mapping.nome] || "", email: row[mapping.email] || "",
        telefone: row[mapping.telefone] || "", interesse: row[mapping.interesse] || "",
        origem: row[mapping.origem] || "", ultimoContato: row[mapping.ultimoContato] || "",
        status: row[mapping.status] || "",
      };
      lead.recoveryScore = calculateRecoveryScore(lead);
      return lead;
    });
    setLeads(mapped);
    setStep("dashboard");
    toast.success(`${mapped.length} leads importados com sucesso!`);
    const leadsWithCodigo = mapped.filter((l) => l.interesse);
    if (leadsWithCodigo.length > 0) {
      toast.info(`Buscando ${leadsWithCodigo.length} imóveis no Jetimob...`);
      const uniqueCodigos = [...new Set(leadsWithCodigo.map((l) => l.interesse))];
      const imovelCache: Record<string, any> = {};
      for (const codigo of uniqueCodigos) {
        const imovel = await fetchImovelData(codigo);
        if (imovel) imovelCache[codigo] = imovel;
      }
      setLeads((prev) => prev.map((l) => l.interesse && imovelCache[l.interesse] ? { ...l, imovel: imovelCache[l.interesse] } : l));
      toast.success(`${Object.keys(imovelCache).length} imóveis encontrados!`);
    }
  }, [csvData, fetchImovelData]);

  const generateMessage = useCallback(async (lead: Lead) => {
    setLoadingLeadId(lead.id);
    try {
      const { data, error } = await supabase.functions.invoke("generate-followup", {
        body: {
          type: "message",
          lead: {
            nome: lead.nome,
            interesse: lead.imovel
              ? `${lead.imovel.tipo} ${lead.imovel.codigo} - ${lead.imovel.dormitorios} dormitórios, ${lead.imovel.endereco_bairro}, ${lead.imovel.endereco_cidade} (${lead.imovel.contrato})`
              : lead.interesse,
            origem: lead.origem, ultimoContato: lead.ultimoContato, status: lead.status,
          },
        },
      });
      if (error) throw error;
      setLeads((prev) =>
        prev.map((l) =>
          l.id === lead.id
            ? { ...l, mensagemGerada: data.message, prioridade: mapPriority(data.priority) }
            : l
        )
      );
      toast.success("Mensagem gerada com sucesso!");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao gerar mensagem. Tente novamente.");
    } finally {
      setLoadingLeadId(null);
    }
  }, []);

  const classifyAllLeads = useCallback(async () => {
    setClassifyingAll(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-followup", {
        body: {
          type: "classify",
          leads: leads.map((l) => ({
            id: l.id, nome: l.nome, interesse: l.interesse, origem: l.origem,
            ultimoContato: l.ultimoContato, status: l.status, temTelefone: !!l.telefone, temEmail: !!l.email,
          })),
        },
      });
      if (error) throw error;
      const classifications = data.classifications as Array<{ id: string; priority: string }>;
      const updatedLeads = leads.map((l) => {
        const c = classifications.find((cl) => cl.id === l.id);
        return c ? { ...l, prioridade: mapPriority(c.priority) } : l;
      });
      setLeads(updatedLeads);
      setTasks(generateTasksForLeads(updatedLeads));
      toast.success("Leads classificados e tarefas geradas!");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao classificar leads.");
    } finally {
      setClassifyingAll(false);
    }
  }, [leads]);

  // Quick filter counts
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
    // Apply quick filter
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
    // Apply reactivation panel filter
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
    // Apply interesse/empreendimento filter
    if (interesseFilter) {
      result = result.filter((l) => {
        const key = l.imovel?.codigo
          ? `${l.imovel.tipo} ${l.imovel.codigo} — ${l.imovel.endereco_bairro}`
          : l.interesse || "Sem interesse definido";
        return key === interesseFilter;
      });
    }
    return result;
  }, [leads, quickFilter, reactivationFilter, interesseFilter]);

  const handleTaskStatusChange = useCallback((taskId: string, status: LeadTask["status"]) => {
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status } : t)));
  }, []);

  const handleBulkGenerateMessages = useCallback(async (leadIds: string[]) => {
    setGeneratingBulk(true);
    let success = 0;
    for (const id of leadIds) {
      const lead = leads.find((l) => l.id === id);
      if (!lead) continue;
      try {
        const { data, error } = await supabase.functions.invoke("generate-followup", {
          body: {
            type: "message",
            lead: { nome: lead.nome, interesse: lead.interesse, origem: lead.origem, ultimoContato: lead.ultimoContato, status: lead.status },
          },
        });
        if (!error && data?.message) {
          setLeads((prev) => prev.map((l) => l.id === id ? { ...l, mensagemGerada: data.message, prioridade: mapPriority(data.priority) } : l));
          success++;
        }
      } catch {}
      // Delay to avoid rate limiting
      await new Promise((r) => setTimeout(r, 500));
    }
    setGeneratingBulk(false);
    toast.success(`${success} mensagens geradas com sucesso!`);
  }, [leads]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg gradient-warm">
              <Zap className="h-5 w-5 text-primary-foreground" />
            </div>
            <h1 className="font-display text-xl font-bold text-foreground">
              Uhome <span className="text-primary">Gestão e IA</span>
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {step === "dashboard" && (
              <>
                <Button variant="outline" onClick={() => { setStep("upload"); setLeads([]); setCsvData([]); setCsvHeaders([]); setQuickFilter("todos"); }} className="gap-1.5">
                  <Upload className="h-4 w-4" /> Reimportar
                </Button>
                <Button variant="outline" onClick={() => setBulkDialogOpen(true)} className="gap-1.5">
                  <Send className="h-4 w-4" /> Disparo em Massa
                </Button>
                <Button onClick={classifyAllLeads} disabled={classifyingAll} className="gap-2" variant="outline">
                  <Sparkles className={`h-4 w-4 ${classifyingAll ? "animate-pulse-soft" : ""}`} />
                  {classifyingAll ? "Classificando..." : "Classificar Todos"}
                </Button>
                <Button onClick={() => { setQuickFilter("followup_hoje"); toast.info("🔥 Mostrando leads quentes para atacar hoje!"); }} className="gap-2 bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                  <Flame className="h-4 w-4" /> ATACAR LEADS HOJE
                </Button>
              </>
            )}
            <Button variant="ghost" size="sm" onClick={signOut} className="gap-1.5 text-muted-foreground">
              <LogOut className="h-4 w-4" /> Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="container py-8">
        {step === "upload" && (
          <div className="mx-auto max-w-xl">
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8 text-center">
              <h2 className="font-display text-3xl font-bold text-foreground">
                Resgate seus leads com <span className="text-primary">inteligência artificial</span>
              </h2>
              <p className="mt-2 text-muted-foreground">Importe sua base do Jetimob e deixe a IA gerar mensagens personalizadas de follow-up</p>
            </motion.div>
            <CsvUploader onDataParsed={handleDataParsed} />
            <div className="mt-4 flex items-center gap-4">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">ou</span>
              <div className="h-px flex-1 bg-border" />
            </div>
            <Button variant="outline" className="mt-4 w-full gap-2" disabled={importingFromApi} onClick={handleImportFromApi}>
              {importingFromApi ? <Loader2 className="h-4 w-4 animate-spin" /> : <CloudDownload className="h-4 w-4" />}
              {importingFromApi ? "Importando da API..." : "Importar Leads da API Jetimob"}
            </Button>
          </div>
        )}

        {step === "map" && (
          <div className="mx-auto max-w-lg">
            <ColumnMapper csvHeaders={csvHeaders} onMappingComplete={handleMappingComplete} />
          </div>
        )}

        {step === "dashboard" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <StatsCards leads={leads} />
            <QuickFilters active={quickFilter} onChange={setQuickFilter} counts={filterCounts} />
            <ReactivationPanel leads={leads} onFilterByDays={(days) => setReactivationFilter(days || null)} activeFilter={reactivationFilter} />
            <CampaignsPanel leads={leads} onGenerateMessages={handleBulkGenerateMessages} generatingBulk={generatingBulk} />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <EmpreendimentoGroup leads={leads} onFilterByInteresse={setInteresseFilter} activeInteresse={interesseFilter} />
              <CorretorRanking leads={leads} />
            </div>
            <TasksPanel tasks={tasks} onTaskStatusChange={handleTaskStatusChange} />
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{filteredLeads.length} de {leads.length} leads</p>
            </div>
            <LeadTable leads={filteredLeads} onGenerateMessage={generateMessage} loadingLeadId={loadingLeadId} />
          </motion.div>
        )}
      </main>

      <BulkWhatsAppDialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen} leads={leads} />
    </div>
  );
}
