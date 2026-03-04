import { useState, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { Sparkles, Zap, Upload, Send, LogOut, CloudDownload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import CsvUploader from "@/components/CsvUploader";
import ColumnMapper from "@/components/ColumnMapper";
import LeadTable from "@/components/LeadTable";
import StatsCards from "@/components/StatsCards";
import ReactivationPanel from "@/components/ReactivationPanel";
import { getDaysSinceContact } from "@/components/ReactivationPanel";
import BulkWhatsAppDialog from "@/components/BulkWhatsAppDialog";
import TasksPanel from "@/components/TasksPanel";
import { generateTasksForLeads, type LeadTask } from "@/lib/taskGenerator";
import type { Lead, LeadCSVRow } from "@/types/lead";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type Step = "upload" | "map" | "dashboard";

export default function Index() {
  const { user, signOut } = useAuth();
  const [step, setStep] = useState<Step>("upload");
  const [csvData, setCsvData] = useState<LeadCSVRow[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loadingLeadId, setLoadingLeadId] = useState<string | null>(null);
  const [classifyingAll, setClassifyingAll] = useState(false);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [reactivationFilter, setReactivationFilter] = useState<number | null>(null);
  const [tasks, setTasks] = useState<LeadTask[]>([]);
  const [importingFromApi, setImportingFromApi] = useState(false);

  const handleDataParsed = useCallback((data: LeadCSVRow[], headers: string[]) => {
    setCsvData(data);
    setCsvHeaders(headers);
    setStep("map");
  }, []);

  const fetchImovelData = useCallback(async (codigo: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("jetimob-proxy", {
        body: { action: "get_imovel", codigo },
      });
      if (error || !data) return null;
      // Handle both single object and array response
      const imovel = Array.isArray(data.data) ? data.data[0] : data;
      if (!imovel?.codigo) return null;
      return {
        codigo: imovel.codigo,
        contrato: imovel.contrato || "",
        descricao_anuncio: imovel.descricao_anuncio || "",
        endereco_bairro: imovel.endereco_bairro || "",
        endereco_cidade: imovel.endereco_cidade || "",
        endereco_logradouro: imovel.endereco_logradouro || "",
        dormitorios: imovel.dormitorios || 0,
        garagens: imovel.garagens || 0,
        area_privativa: imovel.area_privativa || 0,
        valor: imovel.valor || imovel.valor_venda || imovel.valor_locacao || 0,
        imagem_thumb: imovel.imagens?.[0]?.link_thumb || "",
        tipo: imovel.tipo || "",
      };
    } catch {
      return null;
    }
  }, []);

  const handleImportFromApi = useCallback(async () => {
    setImportingFromApi(true);
    try {
      const { data, error } = await supabase.functions.invoke("jetimob-proxy", {
        body: { action: "list_leads" },
      });
      if (error) throw error;
      const apiLeads = Array.isArray(data?.result) ? data.result : Array.isArray(data) ? data : [];
      if (apiLeads.length === 0) {
        toast.warning("Nenhum lead encontrado na API.");
        return;
      }
      // Limit to first 500 leads for performance - full list available via pagination later
      const limitedLeads = apiLeads.slice(0, 500);
      const mapped: Lead[] = limitedLeads.map((l: any, i: number) => ({
        id: String(l.id || i + 1),
        nome: l.full_name || "",
        email: l.emails?.[0] || "",
        telefone: l.phones?.[0] || "",
        interesse: l.message || l.subject || "",
        origem: l.campaign_id ? `Campanha ${l.campaign_id}` : "API Jetimob",
        ultimoContato: l.created_at ? new Date(l.created_at).toLocaleDateString("pt-BR") : "",
        status: "",
      }));
      setLeads(mapped);
      setStep("dashboard");
      toast.success(`${mapped.length} leads importados (de ${apiLeads.length} total) da API Jetimob!`);
    } catch (err) {
      console.error("API import error:", err);
      toast.error("Erro ao importar leads da API Jetimob.");
    } finally {
      setImportingFromApi(false);
    }
  }, []);

  const handleMappingComplete = useCallback(
    async (mapping: Record<string, string>) => {
      const mapped: Lead[] = csvData.map((row, i) => ({
        id: String(i + 1),
        nome: row[mapping.nome] || "",
        email: row[mapping.email] || "",
        telefone: row[mapping.telefone] || "",
        interesse: row[mapping.interesse] || "",
        origem: row[mapping.origem] || "",
        ultimoContato: row[mapping.ultimoContato] || "",
        status: row[mapping.status] || "",
      }));
      setLeads(mapped);
      setStep("dashboard");
      toast.success(`${mapped.length} leads importados com sucesso!`);

      // Fetch imóvel data for leads that have a código
      const leadsWithCodigo = mapped.filter((l) => l.interesse);
      if (leadsWithCodigo.length > 0) {
        toast.info(`Buscando ${leadsWithCodigo.length} imóveis no Jetimob...`);
        const uniqueCodigos = [...new Set(leadsWithCodigo.map((l) => l.interesse))];
        const imovelCache: Record<string, any> = {};

        for (const codigo of uniqueCodigos) {
          const imovel = await fetchImovelData(codigo);
          if (imovel) imovelCache[codigo] = imovel;
        }

        setLeads((prev) =>
          prev.map((l) =>
            l.interesse && imovelCache[l.interesse]
              ? { ...l, imovel: imovelCache[l.interesse] }
              : l
          )
        );
        toast.success(`${Object.keys(imovelCache).length} imóveis encontrados!`);
      }
    },
    [csvData, fetchImovelData]
  );

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
            origem: lead.origem,
            ultimoContato: lead.ultimoContato,
            status: lead.status,
          },
        },
      });
      if (error) throw error;
      setLeads((prev) =>
        prev.map((l) =>
          l.id === lead.id
            ? { ...l, mensagemGerada: data.message, prioridade: data.priority }
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
            id: l.id,
            nome: l.nome,
            interesse: l.interesse,
            origem: l.origem,
            ultimoContato: l.ultimoContato,
            status: l.status,
            temTelefone: !!l.telefone,
            temEmail: !!l.email,
          })),
        },
      });
      if (error) throw error;
      const classifications = data.classifications as Array<{
        id: string;
        priority: "alta" | "media" | "baixa" | "frio" | "perdido";
      }>;
      const updatedLeads = leads.map((l) => {
        const c = classifications.find((cl) => cl.id === l.id);
        return c ? { ...l, prioridade: c.priority } : l;
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

  const filteredLeads = useMemo(() => {
    if (!reactivationFilter || reactivationFilter === 0) return leads;
    return leads.filter((lead) => {
      const days = getDaysSinceContact(lead.ultimoContato);
      if (days === null) return reactivationFilter === 90;
      if (reactivationFilter === 90) return days >= 90;
      if (reactivationFilter === 60) return days >= 60 && days < 90;
      if (reactivationFilter === 30) return days >= 30 && days < 60;
      if (reactivationFilter === 15) return days >= 15 && days < 30;
      if (reactivationFilter === 7) return days >= 7 && days < 15;
      return true;
    });
  }, [leads, reactivationFilter]);

  const handleTaskStatusChange = useCallback((taskId: string, status: LeadTask["status"]) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status } : t))
    );
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg gradient-warm">
              <Zap className="h-5 w-5 text-primary-foreground" />
            </div>
            <h1 className="font-display text-xl font-bold text-foreground">
              LeadRecovery<span className="text-primary">UhomeAI</span>
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {step === "dashboard" && (
              <>
                <Button
                  variant="outline"
                  onClick={() => { setStep("upload"); setLeads([]); setCsvData([]); setCsvHeaders([]); }}
                  className="gap-1.5"
                >
                  <Upload className="h-4 w-4" /> Reimportar
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setBulkDialogOpen(true)}
                  className="gap-1.5"
                >
                  <Send className="h-4 w-4" /> Disparo em Massa
                </Button>
                <Button
                  onClick={classifyAllLeads}
                  disabled={classifyingAll}
                  className="gap-2"
                >
                  <Sparkles className={`h-4 w-4 ${classifyingAll ? "animate-pulse-soft" : ""}`} />
                  {classifyingAll ? "Classificando..." : "Classificar Todos"}
                </Button>
              </>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={signOut}
              className="gap-1.5 text-muted-foreground"
            >
              <LogOut className="h-4 w-4" /> Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="container py-8">
        {step === "upload" && (
          <div className="mx-auto max-w-xl">
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-8 text-center"
            >
              <h2 className="font-display text-3xl font-bold text-foreground">
                Resgate seus leads com{" "}
                <span className="text-primary">inteligência artificial</span>
              </h2>
              <p className="mt-2 text-muted-foreground">
                Importe sua base do Jetimob e deixe a IA gerar mensagens personalizadas de follow-up
              </p>
            </motion.div>
            <CsvUploader onDataParsed={handleDataParsed} />
            <div className="mt-4 flex items-center gap-4">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">ou</span>
              <div className="h-px flex-1 bg-border" />
            </div>
            <Button
              variant="outline"
              className="mt-4 w-full gap-2"
              disabled={importingFromApi}
              onClick={handleImportFromApi}
            >
              {importingFromApi ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CloudDownload className="h-4 w-4" />
              )}
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
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
          >
            <StatsCards leads={leads} />
            <ReactivationPanel
              leads={leads}
              onFilterByDays={(days) => setReactivationFilter(days || null)}
              activeFilter={reactivationFilter}
            />
            <TasksPanel
              tasks={tasks}
              onTaskStatusChange={handleTaskStatusChange}
            />
            <LeadTable
              leads={filteredLeads}
              onGenerateMessage={generateMessage}
              loadingLeadId={loadingLeadId}
            />
          </motion.div>
        )}
      </main>

      <BulkWhatsAppDialog
        open={bulkDialogOpen}
        onOpenChange={setBulkDialogOpen}
        leads={leads}
      />
    </div>
  );
}
