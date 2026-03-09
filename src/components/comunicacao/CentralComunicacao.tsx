import { useState, useEffect, useMemo } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageSquare, Phone, Smartphone, Copy, Sparkles, RotateCcw, Check, Loader2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import {
  useComunicacaoTemplates,
  useIncrementTemplateUsage,
  substituirVariaveis,
  personalizarComHomi,
  TIPO_CONFIG,
  type ComunicacaoTemplate,
  type LeadContext,
} from "@/hooks/useComunicacao";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

interface CentralComunicacaoProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId?: string;
  leadNome?: string;
  leadTelefone?: string | null;
  leadEmpreendimento?: string;
  leadScore?: number;
  leadFase?: string;
}

const TIPO_FILTERS = [
  { value: "todos", label: "Todos" },
  { value: "contato_inicial", label: "Contato Inicial" },
  { value: "follow_up_ligacao", label: "Follow Up" },
  { value: "follow_up_visita", label: "Follow Up Visita" },
  { value: "proposta", label: "Proposta" },
  { value: "campanha", label: "Campanha" },
  { value: "reengajamento", label: "Reengajamento" },
  { value: "pos_venda", label: "Pós-Venda" },
];

export default function CentralComunicacao({
  open,
  onOpenChange,
  leadId,
  leadNome,
  leadTelefone,
  leadEmpreendimento,
  leadScore,
  leadFase,
}: CentralComunicacaoProps) {
  const [canal, setCanal] = useState<"whatsapp" | "ligacao">("whatsapp");
  const [tipoFilter, setTipoFilter] = useState("todos");
  const [selectedTemplate, setSelectedTemplate] = useState<ComunicacaoTemplate | null>(null);
  const [previewText, setPreviewText] = useState("");
  const [isPersonalizing, setIsPersonalizing] = useState(false);
  const [isHomiVersion, setIsHomiVersion] = useState(false);
  const [copied, setCopied] = useState(false);
  const [corretorNome, setCorretorNome] = useState("");

  const { user } = useAuth();
  const { data: templates = [], isLoading } = useComunicacaoTemplates(canal, tipoFilter);
  const incrementUsage = useIncrementTemplateUsage();

  const leadContext: LeadContext = useMemo(() => ({
    nome: leadNome || "Cliente",
    empreendimento: leadEmpreendimento,
    score: leadScore,
    fase: leadFase,
  }), [leadNome, leadEmpreendimento, leadScore, leadFase]);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("nome").eq("user_id", user.id).maybeSingle().then(({ data }) => {
      if (data?.nome) setCorretorNome(data.nome);
    });
  }, [user]);

  const handleUseTemplate = (tmpl: ComunicacaoTemplate) => {
    const filled = substituirVariaveis(tmpl.conteudo, leadContext, corretorNome);
    setPreviewText(filled);
    setSelectedTemplate(tmpl);
    setIsHomiVersion(false);
  };

  const handlePersonalize = async (tmpl: ComunicacaoTemplate) => {
    setSelectedTemplate(tmpl);
    setIsPersonalizing(true);
    setIsHomiVersion(true);
    try {
      const filled = substituirVariaveis(tmpl.conteudo, leadContext, corretorNome);
      const personalized = await personalizarComHomi(filled, leadContext, corretorNome);
      setPreviewText(personalized);
    } catch {
      toast.error("Erro ao personalizar. Usando template original.");
      const filled = substituirVariaveis(tmpl.conteudo, leadContext, corretorNome);
      setPreviewText(filled);
      setIsHomiVersion(false);
    } finally {
      setIsPersonalizing(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(previewText);
    setCopied(true);
    toast.success("Copiado! Cola no WhatsApp ✅");
    setTimeout(() => setCopied(false), 2000);

    if (selectedTemplate) {
      incrementUsage.mutate({
        templateId: selectedTemplate.id,
        leadId,
        canal,
        mensagem: previewText,
        personalizado: isHomiVersion,
      });
    }
  };

  const handleRegenerate = async () => {
    if (!selectedTemplate) return;
    await handlePersonalize(selectedTemplate);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg p-0 flex flex-col"
        style={{ background: "#FAFAFA" }}
      >
        {/* Header */}
        <SheetHeader className="px-5 pt-5 pb-3" style={{ borderBottom: "1px solid #E5E7EB" }}>
          <SheetTitle className="flex items-center gap-2 text-lg font-bold" style={{ color: "#1F2937" }}>
            <MessageSquare className="h-5 w-5" style={{ color: "#3B82F6" }} />
            Central de Comunicação
          </SheetTitle>
          {leadNome && (
            <p className="text-sm" style={{ color: "#6B7280" }}>
              {leadNome} {leadEmpreendimento ? `· ${leadEmpreendimento}` : ""}
            </p>
          )}
        </SheetHeader>

        {/* Preview mode */}
        {selectedTemplate ? (
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            <Button variant="ghost" size="sm" className="text-xs gap-1" style={{ color: "#6B7280" }}
              onClick={() => { setSelectedTemplate(null); setPreviewText(""); }}>
              ← Voltar aos templates
            </Button>

            {isHomiVersion && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
                style={{ background: "rgba(139,92,246,0.1)", color: "#8B5CF6", width: "fit-content" }}>
                <Sparkles className="h-3 w-3" /> Personalizado pelo HOMI
              </div>
            )}

            {isPersonalizing ? (
              <div className="flex items-center justify-center py-12 gap-2" style={{ color: "#8B5CF6" }}>
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm font-medium">✨ HOMI está personalizando...</span>
              </div>
            ) : (
              <>
                <Textarea
                  value={previewText}
                  onChange={(e) => setPreviewText(e.target.value)}
                  className="min-h-[200px] text-sm"
                  style={{
                    background: "white",
                    border: "1px solid #E5E7EB",
                    borderRadius: 12,
                    color: "#374151",
                  }}
                />
                <div className="flex gap-2">
                  <Button
                    onClick={handleCopy}
                    className="flex-1 gap-2 font-semibold"
                    style={{
                      background: copied ? "#22C55E" : "#3B82F6",
                      color: "white",
                      borderRadius: 10,
                    }}
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copied ? "Copiado!" : "📋 Copiar mensagem"}
                  </Button>
                  {isHomiVersion && (
                    <Button variant="outline" onClick={handleRegenerate} className="gap-1.5"
                      style={{ borderRadius: 10, borderColor: "#E5E7EB" }}>
                      <RotateCcw className="h-3.5 w-3.5" /> Gerar outra
                    </Button>
                  )}
                </div>

                {leadTelefone && (
                  <Button
                    onClick={() => {
                      const digits = leadTelefone.replace(/\D/g, "");
                      const number = digits.startsWith("55") ? digits : `55${digits}`;
                      const encoded = encodeURIComponent(previewText);
                      window.open(`https://wa.me/${number}?text=${encoded}`, "_blank");

                      if (selectedTemplate) {
                        incrementUsage.mutate({
                          templateId: selectedTemplate.id,
                          leadId,
                          canal,
                          mensagem: previewText,
                          personalizado: isHomiVersion,
                        });
                      }
                    }}
                    className="w-full gap-2 font-semibold"
                    style={{
                      background: "#25D366",
                      color: "white",
                      borderRadius: 10,
                    }}
                  >
                    <ExternalLink className="h-4 w-4" />
                    Enviar no WhatsApp
                  </Button>
                )}
              </>
            )}
          </div>
        ) : (
          /* Template browser */
          <div className="flex-1 overflow-y-auto">
            {/* Canal tabs */}
            <div className="px-5 pt-3">
              <Tabs value={canal} onValueChange={(v) => setCanal(v as any)}>
                <TabsList className="grid w-full grid-cols-2 h-10" style={{ background: "#F3F4F6", borderRadius: 8 }}>
                  <TabsTrigger value="whatsapp" className="gap-1.5 text-xs font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm" style={{ borderRadius: 6 }}>
                    <Smartphone className="h-3.5 w-3.5" /> WhatsApp
                  </TabsTrigger>
                  <TabsTrigger value="ligacao" className="gap-1.5 text-xs font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm" style={{ borderRadius: 6 }}>
                    <Phone className="h-3.5 w-3.5" /> Ligação
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Type filter pills */}
            <div className="px-5 py-3 flex gap-1.5 overflow-x-auto no-scrollbar">
              {TIPO_FILTERS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setTipoFilter(f.value)}
                  className="shrink-0 text-xs font-medium px-3 py-1.5 rounded-full transition-colors"
                  style={{
                    background: tipoFilter === f.value ? "#1F2937" : "white",
                    color: tipoFilter === f.value ? "white" : "#6B7280",
                    border: `1px solid ${tipoFilter === f.value ? "#1F2937" : "#E5E7EB"}`,
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Template cards */}
            <div className="px-5 pb-5 space-y-3">
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="rounded-xl p-4 space-y-2" style={{ background: "white", border: "1px solid #E5E7EB" }}>
                    <Skeleton className="h-4 w-2/3 rounded" />
                    <Skeleton className="h-3 w-full rounded" />
                    <Skeleton className="h-3 w-4/5 rounded" />
                  </div>
                ))
              ) : templates.length === 0 ? (
                <div className="text-center py-12" style={{ color: "#9CA3AF" }}>
                  <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Nenhum template encontrado</p>
                </div>
              ) : (
                templates.map((tmpl) => {
                  const cfg = TIPO_CONFIG[tmpl.tipo] || { label: tmpl.tipo, color: "#6B7280", emoji: "📝" };
                  return (
                    <div
                      key={tmpl.id}
                      className="rounded-xl p-4 transition-all duration-150 hover:shadow-md"
                      style={{
                        background: "white",
                        border: "1px solid #E5E7EB",
                        borderLeft: `3px solid ${cfg.color}`,
                      }}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-semibold text-sm" style={{ color: "#1F2937" }}>{tmpl.titulo}</h4>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                            style={{ background: `${cfg.color}15`, color: cfg.color, border: `1px solid ${cfg.color}30` }}>
                            {cfg.emoji} {cfg.label}
                          </span>
                          {tmpl.campanha && (
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                              style={{ background: "rgba(236,72,153,0.1)", color: "#EC4899", border: "1px solid rgba(236,72,153,0.3)" }}>
                              🎉 {tmpl.campanha}
                            </span>
                          )}
                        </div>
                      </div>

                      <p className="text-xs line-clamp-2 mb-3" style={{ color: "#9CA3AF" }}>
                        {tmpl.conteudo.slice(0, 120)}...
                      </p>

                      {tmpl.uso_count > 0 && (
                        <p className="text-[10px] mb-2" style={{ color: "#D1D5DB" }}>
                          Usado {tmpl.uso_count}x
                        </p>
                      )}

                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 gap-1.5 text-xs font-semibold"
                          style={{ borderRadius: 8, borderColor: "#E5E7EB" }}
                          onClick={() => handlePersonalize(tmpl)}
                        >
                          <Sparkles className="h-3 w-3" style={{ color: "#8B5CF6" }} />
                          Personalizar com HOMI
                        </Button>
                        <Button
                          size="sm"
                          className="flex-1 gap-1.5 text-xs font-semibold"
                          style={{ background: "#3B82F6", color: "white", borderRadius: 8 }}
                          onClick={() => handleUseTemplate(tmpl)}
                        >
                          <Copy className="h-3 w-3" />
                          Usar template
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
