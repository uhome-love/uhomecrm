import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Send, Pause, Play, XCircle, RefreshCw, TestTube, Rocket, Filter, BarChart3, List, CheckCircle2, AlertTriangle, Database, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import {
  useCampaignBatches,
  useCampaignSends,
  useCampaignSendCounts,
  useFetchEligibleLeads,
  useFetchOAEligibleLeads,
  useCreateCampaignBatch,
  useDispatchBatch,
  useDispatchBatchLoop,
  useUpdateBatchStatus,
  type EligibleLead,
  type CampaignBatch,
} from "@/hooks/useWhatsAppCampaign";
import { useOAListas } from "@/hooks/useOfertaAtiva";

/* ─── Status config ─── */
const STATUS_MAP: Record<string, { label: string; color: string }> = {
  draft: { label: "Rascunho", color: "bg-muted text-muted-foreground" },
  queued: { label: "Na Fila", color: "bg-yellow-100 text-yellow-800" },
  sending: { label: "Enviando…", color: "bg-blue-100 text-blue-800" },
  paused: { label: "Pausado", color: "bg-orange-100 text-orange-800" },
  completed: { label: "Concluído", color: "bg-green-100 text-green-800" },
  cancelled: { label: "Cancelado", color: "bg-red-100 text-red-800" },
  pending: { label: "Pendente", color: "bg-muted text-muted-foreground" },
  sent: { label: "Enviado", color: "bg-blue-100 text-blue-800" },
  delivered: { label: "Entregue", color: "bg-green-100 text-green-800" },
  read: { label: "Lido", color: "bg-emerald-100 text-emerald-800" },
  replied: { label: "Respondeu", color: "bg-purple-100 text-purple-800" },
  clicked: { label: "Clicou", color: "bg-indigo-100 text-indigo-800" },
  aproveitado: { label: "Aproveitado", color: "bg-green-200 text-green-900" },
  failed: { label: "Falha", color: "bg-red-100 text-red-800" },
  skipped: { label: "Ignorado", color: "bg-gray-100 text-gray-600" },
};

const StatusBadge = ({ status }: { status: string }) => {
  const cfg = STATUS_MAP[status] || { label: status, color: "bg-muted text-muted-foreground" };
  return <Badge variant="outline" className={`${cfg.color} border-0 text-xs`}>{cfg.label}</Badge>;
};

/* ─── Main Page ─── */
export default function WhatsAppCampaignDispatcherPage() {
  const [tab, setTab] = useState("nova");
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Send className="h-6 w-6 text-green-500" />
            Disparador WhatsApp
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Dispare campanhas em lote via WhatsApp para leads da base
          </p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="nova" className="gap-1"><Rocket className="h-3.5 w-3.5" /> Nova Campanha</TabsTrigger>
          <TabsTrigger value="campanhas" className="gap-1"><List className="h-3.5 w-3.5" /> Campanhas</TabsTrigger>
          <TabsTrigger value="metricas" className="gap-1"><BarChart3 className="h-3.5 w-3.5" /> Métricas</TabsTrigger>
        </TabsList>

        <TabsContent value="nova" className="mt-4">
          <NovaCampanhaTab onCreated={(id) => { setSelectedBatchId(id); setTab("campanhas"); }} />
        </TabsContent>

        <TabsContent value="campanhas" className="mt-4">
          <CampanhasTab selectedBatchId={selectedBatchId} onSelect={setSelectedBatchId} />
        </TabsContent>

        <TabsContent value="metricas" className="mt-4">
          <MetricasTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ─── Stage Select component ─── */
function StageSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [stages, setStages] = useState<{ id: string; nome: string }[]>([]);
  useEffect(() => {
    supabase.from("pipeline_stages").select("id, nome").order("ordem").then(({ data }) => {
      if (data) setStages(data);
    });
  }, []);
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger><SelectValue placeholder="Todas as etapas" /></SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Todas as etapas</SelectItem>
        {stages.map((s) => (
          <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}


const TEMPLATE_DEFAULT_IMAGES: Record<string, string> = {
  melnick_day_poa_2026: "https://hunbxqzhvuemgntklyzb.supabase.co/storage/v1/object/public/campaign-images/templates%2Fmelnick-day-2026-header.png",
  melnick_day_wa_v2: "https://hunbxqzhvuemgntklyzb.supabase.co/storage/v1/object/public/campaign-images/templates%2Fmelnick-day-2026-header.png",
  ofertas_meday: "https://hunbxqzhvuemgntklyzb.supabase.co/storage/v1/object/public/campaign-images/templates%2Fmelnick-day-2026-header.png",
};

/* ─── Template default redirect URLs ─── */
const TEMPLATE_DEFAULT_URLS: Record<string, string> = {
  melnick_day_poa_2026: "https://uhomesales.com/wa?origem=whatsapp_api&campanha=melnick_day_2026&bloco=cta1",
  melnick_day_wa_v2: "https://uhomesales.com/wa?phone={{phone}}&nome={{nome}}&origem=whatsapp_api&campanha=melnick_day_2026&bloco=cta1",
  ofertas_meday: "https://uhomesales.com/wa?phone={{phone}}&nome={{nome}}&origem=whatsapp_api&campanha=ofertas_meday&bloco=cta1",
};



/* ─── Tab: Nova Campanha ─── */
function NovaCampanhaTab({ onCreated }: { onCreated: (id: string) => void }) {
  const [nome, setNome] = useState("");
  const [fonte, setFonte] = useState<"pipeline" | "oferta_ativa">("pipeline");
  const [campanha, setCampanha] = useState("");
  const [empreendimento, setEmpreendimento] = useState("");
  const [templateName, setTemplateName] = useState("ofertas_meday");
  const [templateLang, setTemplateLang] = useState("pt_BR");
  const [periodo, setPeriodo] = useState("90");
  const [limite, setLimite] = useState("3000");
  const [batchSize, setBatchSize] = useState("500");
  const [origem, setOrigem] = useState("");
  const [tag, setTag] = useState("");
  const [stageId, setStageId] = useState("");
  const [redirectUrl, setRedirectUrl] = useState(TEMPLATE_DEFAULT_URLS["ofertas_meday"] || "");
  const [headerImageUrl, setHeaderImageUrl] = useState(TEMPLATE_DEFAULT_IMAGES["ofertas_meday"] || "");
  const [selectedListaIds, setSelectedListaIds] = useState<string[]>([]);

  const [eligibleLeads, setEligibleLeads] = useState<EligibleLead[]>([]);
  const [showConfirm, setShowConfirm] = useState(false);

  const fetchLeads = useFetchEligibleLeads();
  const fetchOALeads = useFetchOAEligibleLeads();
  const createBatch = useCreateCampaignBatch();
  const { listas: oaListas } = useOAListas();

  const toggleListaId = (id: string) => {
    setSelectedListaIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleBuscar = () => {
    if (fonte === "oferta_ativa") {
      if (selectedListaIds.length === 0) return toast.error("Selecione ao menos uma lista da Oferta Ativa");
      fetchOALeads.mutate(
        { listaIds: selectedListaIds, limite: parseInt(limite) || 3000 },
        {
          onSuccess: (leads) => {
            setEligibleLeads(leads);
            toast.success(`${leads.length} leads da OA (fora do pipeline) encontrados`);
          },
        }
      );
    } else {
      fetchLeads.mutate(
        {
          campanha: campanha || undefined,
          empreendimento: empreendimento || undefined,
          periodosDias: parseInt(periodo) || 90,
          limite: parseInt(limite) || 3000,
          origem: origem || undefined,
          tag: tag || undefined,
          stageId: stageId && stageId !== "all" ? stageId : undefined,
        },
        {
          onSuccess: (leads) => {
            setEligibleLeads(leads);
            toast.success(`${leads.length} leads elegíveis encontrados`);
          },
        }
      );
    }
  };

  const validateHeaderImageUrl = (url: string): boolean => {
    if (!url) return true; // optional
    if (!url.startsWith("https://")) return false;
    return /\.(jpe?g|png)(\?.*)?$/i.test(url);
  };

  const handleCriar = () => {
    if (!nome.trim()) return toast.error("Preencha o nome da campanha");
    if (!templateName.trim()) return toast.error("Preencha o template");
    if (eligibleLeads.length === 0) return toast.error("Busque os leads primeiro");
    if (headerImageUrl && !validateHeaderImageUrl(headerImageUrl)) {
      return toast.error("URL da imagem inválida. Use HTTPS e formato jpg, jpeg ou png.");
    }
    setShowConfirm(true);
  };

  const handleConfirm = () => {
    const normalizedHeaderImageUrl = headerImageUrl.trim();

    createBatch.mutate(
      {
        nome,
        campanha,
        templateName,
        templateLanguage: templateLang,
        templateParams: {
          body_params: ["nome"],
          button_url: redirectUrl || undefined,
          button_dynamic: !!TEMPLATE_DEFAULT_URLS[templateName]?.includes("{{phone}}"),
          header_image_url: normalizedHeaderImageUrl || undefined,
        },
        redirectUrl,
        filtros: { campanha, empreendimento, periodo, limite, origem, tag },
        batchSize: parseInt(batchSize) || 500,
        leads: eligibleLeads,
      },
      {
        onSuccess: (batch) => {
          setShowConfirm(false);
          onCreated(batch.id);
        },
      }
    );
  };

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Filters */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Filter className="h-4 w-4" /> Filtros de Leads
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Source selector */}
            <div className="flex gap-2">
              <Button
                variant={fonte === "pipeline" ? "default" : "outline"}
                size="sm"
                onClick={() => { setFonte("pipeline"); setEligibleLeads([]); }}
                className="gap-1.5"
              >
                <Database className="h-3.5 w-3.5" /> Pipeline Leads
              </Button>
              <Button
                variant={fonte === "oferta_ativa" ? "default" : "outline"}
                size="sm"
                onClick={() => { setFonte("oferta_ativa"); setEligibleLeads([]); }}
                className="gap-1.5"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" /> Oferta Ativa (fora do pipeline)
              </Button>
            </div>

            {fonte === "oferta_ativa" ? (
              /* OA Lista picker */
              <div className="space-y-3">
                <div>
                  <Label className="text-xs">Nome da Campanha</Label>
                  <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: OA Melnick Day" />
                </div>
                <Label className="text-xs font-medium">Selecione as listas da Oferta Ativa</Label>
                {oaListas.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma lista encontrada</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-48 overflow-auto">
                    {oaListas.filter(l => ["ativa", "liberada"].includes(l.status)).map((lista) => (
                      <label
                        key={lista.id}
                        className={`flex items-center gap-2 p-2 rounded-md border cursor-pointer transition-colors ${
                          selectedListaIds.includes(lista.id) ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                        }`}
                      >
                        <Checkbox
                          checked={selectedListaIds.includes(lista.id)}
                          onCheckedChange={() => toggleListaId(lista.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{lista.nome}</p>
                          <p className="text-xs text-muted-foreground">{lista.empreendimento} · {lista.total_leads} leads</p>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Limite de Leads</Label>
                    <Select value={limite} onValueChange={setLimite}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="100">100</SelectItem>
                        <SelectItem value="500">500</SelectItem>
                        <SelectItem value="1000">1.000</SelectItem>
                        <SelectItem value="3000">3.000</SelectItem>
                        <SelectItem value="5000">5.000</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Tamanho do Lote</Label>
                    <Select value={batchSize} onValueChange={setBatchSize}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="100">100 por vez</SelectItem>
                        <SelectItem value="300">300 por vez</SelectItem>
                        <SelectItem value="500">500 por vez</SelectItem>
                        <SelectItem value="1000">1.000 por vez</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            ) : (
              /* Pipeline filters */
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Nome da Campanha</Label>
                <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Melnick Day POA" />
              </div>
              <div>
                <Label className="text-xs">Campanha (tag)</Label>
                <Input value={campanha} onChange={(e) => setCampanha(e.target.value)} placeholder="melnick_day_2026" />
              </div>
              <div>
                <Label className="text-xs">Empreendimento</Label>
                <Input value={empreendimento} onChange={(e) => setEmpreendimento(e.target.value)} placeholder="Opcional" />
              </div>
              <div>
                <Label className="text-xs">Período (dias)</Label>
                <Select value={periodo} onValueChange={setPeriodo}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">Últimos 30 dias</SelectItem>
                    <SelectItem value="60">Últimos 60 dias</SelectItem>
                    <SelectItem value="90">Últimos 90 dias</SelectItem>
                    <SelectItem value="180">Últimos 180 dias</SelectItem>
                    <SelectItem value="365">Último ano</SelectItem>
                    <SelectItem value="9999">Todos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Limite de Leads</Label>
                <Select value={limite} onValueChange={setLimite}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="100">100</SelectItem>
                    <SelectItem value="500">500</SelectItem>
                    <SelectItem value="1000">1.000</SelectItem>
                    <SelectItem value="3000">3.000</SelectItem>
                    <SelectItem value="5000">5.000</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Tamanho do Lote</Label>
                <Select value={batchSize} onValueChange={setBatchSize}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="100">100 por vez</SelectItem>
                    <SelectItem value="300">300 por vez</SelectItem>
                    <SelectItem value="500">500 por vez</SelectItem>
                    <SelectItem value="1000">1.000 por vez</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Origem</Label>
                <Input value={origem} onChange={(e) => setOrigem(e.target.value)} placeholder="Opcional" />
              </div>
              <div>
                <Label className="text-xs">Tag</Label>
                <Input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="Opcional" />
              </div>
              <div>
                <Label className="text-xs">Etapa do Pipeline</Label>
                <StageSelect value={stageId} onChange={setStageId} />
              </div>
            </div>
            )}

            <div className="flex items-center gap-2 pt-2">
              <Button onClick={handleBuscar} disabled={fetchLeads.isPending || fetchOALeads.isPending}>
                {(fetchLeads.isPending || fetchOALeads.isPending) ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Filter className="h-4 w-4 mr-2" />}
                {fonte === "oferta_ativa" ? "Buscar Leads OA (fora do Pipeline)" : "Buscar Leads Elegíveis"}
              </Button>
              {eligibleLeads.length > 0 && (
                <Badge variant="secondary" className="text-sm px-3 py-1">
                  ✅ {eligibleLeads.length.toLocaleString()} leads
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Template config */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">📱 Template WhatsApp</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs">Template Name (Meta)</Label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={templateName}
                onChange={(e) => {
                  const val = e.target.value;
                  setTemplateName(val);
                  const defaultImg = TEMPLATE_DEFAULT_IMAGES[val];
                  if (defaultImg) setHeaderImageUrl(defaultImg);
                  const defaultUrl = TEMPLATE_DEFAULT_URLS[val];
                  if (defaultUrl) setRedirectUrl(defaultUrl);
                }}
              >
                <option value="ofertas_meday">ofertas_meday (MEDAY Ofertas ✅)</option>
                <option value="melnick_day_poa_2026">melnick_day_poa_2026 (botão estático)</option>
                <option value="melnick_day_wa_v2">melnick_day_wa_v2 (botão dinâmico)</option>
              </select>
            </div>
            <div>
              <Label className="text-xs">Idioma</Label>
              <Input value={templateLang} onChange={(e) => setTemplateLang(e.target.value)} placeholder="pt_BR" />
            </div>
            <div>
              <Label className="text-xs">URL de Rastreamento (botão)</Label>
              <Input value={redirectUrl} onChange={(e) => setRedirectUrl(e.target.value)} className="text-xs" />
            </div>
            <div>
              <Label className="text-xs">URL da Imagem (header)</Label>
              <Input value={headerImageUrl} onChange={(e) => setHeaderImageUrl(e.target.value)} placeholder="https://exemplo.com/imagem.jpg" className="text-xs" />
              <p className="text-[10px] text-muted-foreground mt-1">URL pública HTTPS da imagem (jpg/png, máx 5MB) que aparecerá no cabeçalho do WhatsApp.</p>
            </div>

            <Button onClick={handleCriar} disabled={eligibleLeads.length === 0 || createBatch.isPending} className="w-full bg-green-600 hover:bg-green-700 text-white">
              {createBatch.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Rocket className="h-4 w-4 mr-2" />}
              Criar Campanha ({eligibleLeads.length.toLocaleString()} leads)
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Preview leads */}
      {eligibleLeads.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Prévia dos Leads ({eligibleLeads.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-64 overflow-auto rounded border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Empreendimento</TableHead>
                    <TableHead>Origem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {eligibleLeads.slice(0, 50).map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="font-medium">{l.nome}</TableCell>
                      <TableCell className="text-xs">{l.telefone_normalizado || l.telefone}</TableCell>
                      <TableCell className="text-xs">{l.email || "—"}</TableCell>
                      <TableCell className="text-xs">{l.empreendimento || "—"}</TableCell>
                      <TableCell className="text-xs">{l.origem || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {eligibleLeads.length > 50 && (
              <p className="text-xs text-muted-foreground mt-2">Mostrando 50 de {eligibleLeads.length.toLocaleString()}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Confirm dialog */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Criação da Campanha</DialogTitle>
            <DialogDescription>
              Serão criados <strong>{eligibleLeads.length.toLocaleString()}</strong> registros de envio usando o template <strong>{templateName}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <p>📌 Nome: <strong>{nome}</strong></p>
            <p>📋 Campanha: <strong>{campanha}</strong></p>
            <p>📱 Template: <strong>{templateName}</strong> ({templateLang})</p>
            <p>📦 Lote: <strong>{batchSize}</strong> por vez</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirm(false)}>Cancelar</Button>
            <Button onClick={handleConfirm} disabled={createBatch.isPending} className="bg-green-600 hover:bg-green-700 text-white">
              {createBatch.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ─── Tab: Campanhas ─── */
function CampanhasTab({ selectedBatchId, onSelect }: { selectedBatchId: string | null; onSelect: (id: string | null) => void }) {
  const { data: batches = [], isLoading } = useCampaignBatches();
  const { data: sends = [] } = useCampaignSends(selectedBatchId);
  const { data: liveCounts } = useCampaignSendCounts(selectedBatchId);
  const dispatchBatch = useDispatchBatch();
  const { start: startLoop, stop: stopLoop, loopRunning } = useDispatchBatchLoop();
  const updateStatus = useUpdateBatchStatus();

  const selectedBatch = batches.find((b) => b.id === selectedBatchId);


  const handleDispatch = (batchId: string) => {
    startLoop(batchId);
  };

  const handleTest = (batchId: string) => {
    const testSends = sends.filter((s) => s.status_envio === "pending").slice(0, 5).map((s) => s.id);
    if (testSends.length === 0) return toast.error("Sem envios pendentes para teste");
    dispatchBatch.mutate({ batchId, action: "test", sendIds: testSends });
  };

  const handlePause = (batchId: string) => {
    stopLoop();
    updateStatus.mutate({ batchId, status: "paused" });
  };
  const handleResume = (batchId: string) => {
    updateStatus.mutate({ batchId, status: "sending" }, {
      onSuccess: () => startLoop(batchId),
    });
  };
  const handleCancel = (batchId: string) => updateStatus.mutate({ batchId, status: "cancelled" });

  const handleRetryFailed = (batchId: string) => {
    // Reset failed to pending then dispatch
    const failedIds = sends.filter((s) => s.status_envio === "failed").map((s) => s.id);
    if (failedIds.length === 0) return toast.error("Sem falhas para reenviar");
    // We'll just dispatch again — edge fn handles pending
    toast.info("Use o botão Disparar para reprocessar envios pendentes");
  };

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      {/* Batch list */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Campanhas Criadas</CardTitle>
        </CardHeader>
        <CardContent>
          {batches.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma campanha criada ainda</p>
          ) : (
            <div className="space-y-2">
              {batches.map((b) => (
                <div
                  key={b.id}
                  onClick={() => onSelect(b.id)}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${selectedBatchId === b.id ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium text-sm">{b.nome}</span>
                      <StatusBadge status={b.status} />
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>{b.total_leads.toLocaleString()} leads</span>
                      <span>{b.total_sent} enviados</span>
                      <span>{b.total_failed} falhas</span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Template: {b.template_name} • Campanha: {b.campanha || "—"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Selected batch detail */}
      {selectedBatch && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{selectedBatch.nome}</CardTitle>
              <div className="flex gap-2">
                {(selectedBatch.status === "draft" || selectedBatch.status === "queued") && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => handleTest(selectedBatch.id)} disabled={dispatchBatch.isPending}>
                      <TestTube className="h-3.5 w-3.5 mr-1" /> Teste (5)
                    </Button>
                    <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => handleDispatch(selectedBatch.id)} disabled={dispatchBatch.isPending}>
                      {dispatchBatch.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Send className="h-3.5 w-3.5 mr-1" />}
                      Disparar
                    </Button>
                  </>
                )}
                {selectedBatch.status === "sending" && (
                  <Button size="sm" variant="outline" onClick={() => handlePause(selectedBatch.id)}>
                    <Pause className="h-3.5 w-3.5 mr-1" /> Pausar
                  </Button>
                )}
                {selectedBatch.status === "paused" && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => handleResume(selectedBatch.id)}>
                      <Play className="h-3.5 w-3.5 mr-1" /> Retomar
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => handleCancel(selectedBatch.id)}>
                      <XCircle className="h-3.5 w-3.5 mr-1" /> Cancelar
                    </Button>
                  </>
                )}
                {selectedBatch.status === "completed" && selectedBatch.total_failed > 0 && (
                  <Button size="sm" variant="outline" onClick={() => handleRetryFailed(selectedBatch.id)}>
                    <RefreshCw className="h-3.5 w-3.5 mr-1" /> Reenviar Falhas
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Mini metrics */}
            <div className="grid grid-cols-4 md:grid-cols-8 gap-2 mb-4">
              {[
                { label: "Total", value: selectedBatch.total_leads, icon: "📋" },
                { label: "Enviados", value: liveCounts?.sent ?? selectedBatch.total_sent, icon: "✅" },
                { label: "Entregues", value: liveCounts?.delivered ?? selectedBatch.total_delivered, icon: "📬" },
                { label: "Lidos", value: liveCounts?.read ?? selectedBatch.total_read, icon: "👁" },
                { label: "Respondidos", value: liveCounts?.replied ?? selectedBatch.total_replied, icon: "💬" },
                { label: "Clicados", value: liveCounts?.clicked ?? selectedBatch.total_clicked, icon: "🔗" },
                { label: "Aproveitados", value: liveCounts?.aproveitado ?? selectedBatch.total_aproveitado, icon: "🎯" },
                { label: "Falhas", value: liveCounts?.failed ?? selectedBatch.total_failed, icon: "❌" },
              ].map((m) => (
                <div key={m.label} className="text-center p-2 rounded-lg bg-muted/50">
                  <span className="text-lg">{m.icon}</span>
                  <p className="text-lg font-bold">{m.value.toLocaleString()}</p>
                  <p className="text-[10px] text-muted-foreground">{m.label}</p>
                </div>
              ))}
            </div>

            {/* Sends table */}
            <div className="max-h-96 overflow-auto rounded border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Enviado</TableHead>
                    <TableHead>Erro</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sends.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-4 text-muted-foreground">
                      {selectedBatch.status === "draft" ? "Nenhum envio realizado ainda — inicie o disparo" : "Carregando envios..."}
                    </TableCell></TableRow>
                  ) : sends.slice(0, 200).map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="text-xs font-medium">{s.nome || "—"}</TableCell>
                      <TableCell className="text-xs">{s.telefone_normalizado || s.telefone || "—"}</TableCell>
                      <TableCell><StatusBadge status={s.status_envio} /></TableCell>
                      <TableCell className="text-xs">{s.sent_at ? new Date(s.sent_at).toLocaleString("pt-BR") : "—"}</TableCell>
                      <TableCell className="text-xs text-red-500 max-w-32 truncate">{s.error_message || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {sends.length > 200 && <p className="text-xs text-muted-foreground mt-1">Mostrando 200 de {sends.length}</p>}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ─── Tab: Métricas ─── */
function MetricasTab() {
  const { data: batches = [] } = useCampaignBatches();

  const totals = useMemo(() => {
    return batches.reduce(
      (acc, b) => ({
        leads: acc.leads + b.total_leads,
        sent: acc.sent + b.total_sent,
        delivered: acc.delivered + b.total_delivered,
        read: acc.read + b.total_read,
        replied: acc.replied + b.total_replied,
        clicked: acc.clicked + b.total_clicked,
        aproveitado: acc.aproveitado + b.total_aproveitado,
        failed: acc.failed + b.total_failed,
      }),
      { leads: 0, sent: 0, delivered: 0, read: 0, replied: 0, clicked: 0, aproveitado: 0, failed: 0 }
    );
  }, [batches]);

  const pct = (v: number, base: number) => base > 0 ? ((v / base) * 100).toFixed(1) + "%" : "—";

  const metrics = [
    { label: "Total Leads", value: totals.leads, icon: "📋", rate: null },
    { label: "Enviados", value: totals.sent, icon: "✅", rate: pct(totals.sent, totals.leads) },
    { label: "Entregues", value: totals.delivered, icon: "📬", rate: pct(totals.delivered, totals.sent) },
    { label: "Lidos", value: totals.read, icon: "👁", rate: pct(totals.read, totals.delivered) },
    { label: "Respondidos", value: totals.replied, icon: "💬", rate: pct(totals.replied, totals.sent) },
    { label: "Clicados", value: totals.clicked, icon: "🔗", rate: pct(totals.clicked, totals.sent) },
    { label: "Aproveitados", value: totals.aproveitado, icon: "🎯", rate: pct(totals.aproveitado, totals.sent) },
    { label: "Falhas", value: totals.failed, icon: "❌", rate: pct(totals.failed, totals.leads) },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4" /> Dashboard Consolidado
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {metrics.map((m) => (
              <div key={m.label} className="text-center p-4 rounded-xl bg-muted/30 border">
                <span className="text-2xl">{m.icon}</span>
                <p className="text-2xl font-bold mt-1">{m.value.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">{m.label}</p>
                {m.rate && <p className="text-xs font-medium text-primary mt-1">{m.rate}</p>}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Per-campaign breakdown */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Por Campanha</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campanha</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Leads</TableHead>
                <TableHead className="text-right">Enviados</TableHead>
                <TableHead className="text-right">Entregues</TableHead>
                <TableHead className="text-right">Lidos</TableHead>
                <TableHead className="text-right">Respondidos</TableHead>
                <TableHead className="text-right">Aproveitados</TableHead>
                <TableHead className="text-right">Falhas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {batches.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium text-xs">{b.nome}</TableCell>
                  <TableCell><StatusBadge status={b.status} /></TableCell>
                  <TableCell className="text-right">{b.total_leads}</TableCell>
                  <TableCell className="text-right">{b.total_sent}</TableCell>
                  <TableCell className="text-right">{b.total_delivered}</TableCell>
                  <TableCell className="text-right">{b.total_read}</TableCell>
                  <TableCell className="text-right">{b.total_replied}</TableCell>
                  <TableCell className="text-right">{b.total_aproveitado}</TableCell>
                  <TableCell className="text-right">{b.total_failed}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
