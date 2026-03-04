import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Sparkles, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import CsvUploader from "@/components/CsvUploader";
import ColumnMapper from "@/components/ColumnMapper";
import LeadTable from "@/components/LeadTable";
import StatsCards from "@/components/StatsCards";
import type { Lead, LeadCSVRow } from "@/types/lead";
import { supabase } from "@/integrations/supabase/client";

type Step = "upload" | "map" | "dashboard";

export default function Index() {
  const [step, setStep] = useState<Step>("upload");
  const [csvData, setCsvData] = useState<LeadCSVRow[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loadingLeadId, setLoadingLeadId] = useState<string | null>(null);
  const [classifyingAll, setClassifyingAll] = useState(false);

  const handleDataParsed = useCallback((data: LeadCSVRow[], headers: string[]) => {
    setCsvData(data);
    setCsvHeaders(headers);
    setStep("map");
  }, []);

  const handleMappingComplete = useCallback(
    (mapping: Record<string, string>) => {
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
    },
    [csvData]
  );

  const generateMessage = useCallback(async (lead: Lead) => {
    setLoadingLeadId(lead.id);
    try {
      const { data, error } = await supabase.functions.invoke("generate-followup", {
        body: {
          type: "message",
          lead: {
            nome: lead.nome,
            interesse: lead.interesse,
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
          })),
        },
      });
      if (error) throw error;
      const classifications = data.classifications as Array<{
        id: string;
        priority: "alta" | "media" | "baixa";
      }>;
      setLeads((prev) =>
        prev.map((l) => {
          const c = classifications.find((cl) => cl.id === l.id);
          return c ? { ...l, prioridade: c.priority } : l;
        })
      );
      toast.success("Leads classificados com sucesso!");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao classificar leads.");
    } finally {
      setClassifyingAll(false);
    }
  }, [leads]);

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
              LeadRecovery<span className="text-primary">AI</span>
            </h1>
          </div>
          {step === "dashboard" && (
            <Button
              onClick={classifyAllLeads}
              disabled={classifyingAll}
              className="gap-2"
            >
              <Sparkles className={`h-4 w-4 ${classifyingAll ? "animate-pulse-soft" : ""}`} />
              {classifyingAll ? "Classificando..." : "Classificar Todos"}
            </Button>
          )}
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
            <LeadTable
              leads={leads}
              onGenerateMessage={generateMessage}
              loadingLeadId={loadingLeadId}
            />
          </motion.div>
        )}
      </main>
    </div>
  );
}
