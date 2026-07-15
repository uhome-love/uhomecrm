import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Target, Shield, Zap, Check, ChevronsUpDown, MousePointerClick, Pencil, RefreshCw, Users, Filter, MessageSquare, Flame, Settings2, TrendingUp, Send, Loader2, X, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import FunilLateral from "./disparo/FunilLateral";
import EmpreendimentoMultiSelect from "./disparo/EmpreendimentoMultiSelect";

type Source = "descartados" | "pipeline_ativo" | "oferta_ativa_lista";
type Canal = "meta" | "evolution";
type DedupMode = "cooldown" | "exclude_sent" | "include_all" | "only_sent_before";
type Recencia = "7d" | "30d" | "90d" | "180d" | "mais" | "todos";

interface FunilData {
  por_fonte?: Record<string, number>;
  duplicados_removidos?: number;
  removidos_pipeline_ativo?: number;
  removidos_frequencia?: number;
  telefones_invalidos?: number;
  total_bruto?: number;
  count_pre_dedup?: number;
  total_em_descarte?: number;
  inativados_definitivos?: number;
  sem_telefone?: number;
  arquivados?: number;
  suprimidos_meta?: number;
  em_cooldown?: number;
  cooldown_dias?: number;
  elegiveis?: number;
}
interface PreviewResult {
  count: number;
  sample: Array<{ id: string; nome: string; telefone: string | null }>;
  funil?: FunilData;
  breakdown_por_empreendimento?: Array<{ empreendimento: string; total: number }>;
  breakdown_por_recencia?: Record<Recencia, number>;
  breakdown_por_motivo_descarte?: Array<{ motivo: string; total: number }>;
  breakdown_truncado?: boolean;
  ultimo_disparo_template?: { template: string; quantos: number; quando: string } | null;
}

async function getEdgeErrorMessage(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    const text = await error.context.text().catch(() => "");
    if (text) {
      try {
        const parsed = JSON.parse(text) as { error?: string; message?: string; motivo?: string; reason?: string };
        return parsed.error || parsed.message || parsed.motivo || parsed.reason || text;
      } catch { return text; }
    }
  }
  return error instanceof Error ? error.message : String(error);
}

const TEMPLATE_HEADER_IMAGES: Record<string, string> = {
  casatua_junho25k: "https://api.uhomesales.com/storage/v1/object/public/campaign-images/reengajamento/casatua-junho25k.png",
  casatua_eventosabado: "https://api.uhomesales.com/storage/v1/object/public/campaign-images/reengajamento/casatua-eventosabado.png",
  atrio_lancamento: "https://api.uhomesales.com/storage/v1/object/public/campaign-images/reengajamento/atrio-lancamento.png",
  vividterrace2: "https://api.uhomesales.com/storage/v1/object/public/campaign-images/reengajamento/vividterrace2.png",
  lakebaical_novidade: "https://api.uhomesales.com/storage/v1/object/public/campaign-images/reengajamento/lakebaical-novidade.png",
  lakebaikal_novidade2: "https://api.uhomesales.com/storage/v1/object/public/campaign-images/reengajamento/lakebaical-golden-lake.png",
  lakebaikal_novidade3: "https://api.uhomesales.com/storage/v1/object/public/campaign-images/reengajamento/lakebaikal-novidade3.png",
  connectjw_julho: "https://api.uhomesales.com/storage/v1/object/public/campaign-images/reengajamento/connectjw-julho.png",
  flow_novidade2: "https://api.uhomesales.com/storage/v1/object/public/campaign-images/reengajamento/flow-novidade2.jpg",
};

const RECENCIA_LABELS: Record<Recencia, string> = {
  "7d": "Últimos 7 dias",
  "30d": "Últimos 30 dias",
  "90d": "Últimos 90 dias",
  "180d": "3–6 meses",
  "mais": "Mais de 6 meses",
  "todos": "Todos",
};

function recenciaToPeriodo(r: Recencia): { from?: string; to?: string } | undefined {
  if (r === "todos") return undefined;
  const now = new Date();
  const days = r === "7d" ? 7 : r === "30d" ? 30 : r === "90d" ? 90 : r === "180d" ? 180 : 365 * 5;
  const from = new Date(now.getTime() - days * 24 * 3600 * 1000);
  if (r === "mais") {
    return { to: new Date(now.getTime() - 180 * 24 * 3600 * 1000).toISOString() };
  }
  return { from: from.toISOString(), to: now.toISOString() };
}

export default function DisparoCustomizadoCard({ onFired }: { onFired?: () => void }) {
  const [canal, setCanal] = useState<Canal>("meta");
  const [sources, setSources] = useState<Source[]>(["descartados"]);
  const has = (s: Source) => sources.includes(s);
  const isCombined = sources.length > 1;
  const source = sources[0] ?? "descartados";

  const [tipoDescarte, setTipoDescarte] = useState<"reengajavel" | "definitivo" | "todos">("reengajavel");
  const [stageIds, setStageIds] = useState<string[]>([]);
  const [listaIds, setListaIds] = useState<string[]>([]);
  const [recencia, setRecencia] = useState<Recencia>("todos");
  const [empreendimentos, setEmpreendimentos] = useState<string[]>([]);
  const [motivosDescarte, setMotivosDescarte] = useState<string[]>([]);
  const [mobileFunilOpen, setMobileFunilOpen] = useState(false);
  const [dedupMode, setDedupMode] = useState<DedupMode>("cooldown");
  const [dedupCutoff, setDedupCutoff] = useState<string>("");
  const [cooldownDias, setCooldownDias] = useState<number>(7);
  const [includeArchived, setIncludeArchived] = useState<boolean>(true);
  const [limit, setLimit] = useState<number>(1000);
  const [templateName, setTemplateName] = useState<string>("");
  const [templateLanguage, setTemplateLanguage] = useState<string>("pt_BR");
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [templateManualMode, setTemplateManualMode] = useState(false);
  const [headerImageUrl, setHeaderImageUrl] = useState<string>("");
  const [mensagem, setMensagem] = useState<string>("");
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [firing, setFiring] = useState(false);
  const [modoTeste, setModoTeste] = useState<boolean>(false);
  const [tab, setTab] = useState<"publico" | "filtros" | "mensagem">("publico");


  const { data: stages = [] } = useQuery({
    queryKey: ["pipeline_stages_all"],
    queryFn: async () => {
      const { data } = await supabase.from("pipeline_stages").select("id, nome, ordem").order("ordem");
      return data || [];
    },
  });

  const { data: listas = [] } = useQuery({
    queryKey: ["oferta_ativa_listas_for_nutricao"],
    queryFn: async () => {
      const { data } = await supabase
        .from("oferta_ativa_listas")
        .select("id, nome, empreendimento, total_leads, created_at")
        .order("created_at", { ascending: false })
        .limit(100);
      return data || [];
    },
  });

  const { data: metaTemplatesResp, isLoading: loadingTemplates, refetch: refetchTemplates, isFetching: fetchingTemplates } = useQuery({
    queryKey: ["meta-templates-list"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("meta-templates-list", { body: {} });
      if (error) throw error;
      return data as { templates: Array<{ name: string; language: string; status: string; category: string | null; has_buttons: boolean }>; total: number };
    },
    staleTime: 5 * 60 * 1000,
    enabled: canal === "meta",
  });
  const metaTemplates = metaTemplatesResp?.templates || [];

  const { data: cfgDefaults } = useQuery({
    queryKey: ["reengajamento-config-defaults"],
    queryFn: async () => {
      const { data: reng } = await supabase
        .from("reengajamento_config")
        .select("meta_template_name, meta_template_name_2, meta_template_language")
        .limit(1).maybeSingle();
      return { reng };
    },
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (canal !== "meta" || !cfgDefaults || templateName) return;
    if (source === "descartados" && cfgDefaults.reng?.meta_template_name) {
      setTemplateName(cfgDefaults.reng.meta_template_name);
      setTemplateLanguage(cfgDefaults.reng.meta_template_language || "pt_BR");
    }
  }, [canal, source, cfgDefaults, templateName]);

  useEffect(() => {
    if (canal !== "meta" || !templateName) return;
    const mapped = TEMPLATE_HEADER_IMAGES[templateName];
    if (mapped) setHeaderImageUrl(mapped);
  }, [canal, templateName]);

  function selectTemplate(name: string, language: string) {
    setTemplateName(name);
    setTemplateLanguage(language);
    setTemplatePickerOpen(false);
    setHeaderImageUrl(TEMPLATE_HEADER_IMAGES[name] || "");
  }

  const currentTemplateMeta = metaTemplates.find((t) => t.name === templateName && t.language === templateLanguage);

  const audience = useMemo(() => {
    const periodo = recenciaToPeriodo(recencia);
    const base: Record<string, unknown> = {
      source, sources, canal, periodo,
      empreendimentos: empreendimentos.length ? empreendimentos : undefined,
      motivos_descarte: motivosDescarte.length ? motivosDescarte : undefined,
      dedup_mode: dedupMode,
      cooldown_dias: dedupMode === "cooldown" ? cooldownDias : undefined,
      include_archived: includeArchived,
      limit,
    };
    if (dedupMode === "only_sent_before" && dedupCutoff) {
      base.dedup_cutoff = new Date(dedupCutoff + "T00:00:00-03:00").toISOString();
    }
    if (has("descartados")) base.tipo_descarte = tipoDescarte;
    if (has("pipeline_ativo")) base.stage_ids = stageIds;
    if (has("oferta_ativa_lista")) base.lista_ids = listaIds;
    if (canal === "meta" && templateName) {
      base.template_name = templateName;
      base.template_language = templateLanguage;
      if (headerImageUrl.trim()) base.header_image_url = headerImageUrl.trim();
    }
    if (canal === "evolution" && mensagem) base.mensagem = mensagem;
    if (modoTeste && canal === "meta") base.modo_teste = true;
    return base;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, sources.join(","), canal, recencia, empreendimentos.join(","), motivosDescarte.join(","), dedupMode, cooldownDias, includeArchived, limit, dedupCutoff, tipoDescarte, stageIds.join(","), listaIds.join(","), templateName, templateLanguage, headerImageUrl, mensagem, modoTeste]);


  // ── Auto-preview com debounce ──
  const previewSeq = useRef(0);
  const runPreview = useCallback(async () => {
    if (has("pipeline_ativo") && stageIds.length === 0) return;
    if (has("oferta_ativa_lista") && listaIds.length === 0) return;
    const seq = ++previewSeq.current;
    setPreviewing(true);
    try {
      const { data, error } = await supabase.functions.invoke("reengajamento-audience-preview", {
        body: { audience },
      });
      if (seq !== previewSeq.current) return; // corrida: descarta resultado velho
      if (error) throw new Error(await getEdgeErrorMessage(error));
      const d = data as { error?: string } & PreviewResult;
      if (d?.error) throw new Error(d.error);
      setPreview({
        count: d.count || 0,
        sample: d.sample || [],
        funil: d.funil,
        breakdown_por_empreendimento: d.breakdown_por_empreendimento,
        breakdown_por_recencia: d.breakdown_por_recencia,
        breakdown_por_motivo_descarte: d.breakdown_por_motivo_descarte,
        ultimo_disparo_template: d.ultimo_disparo_template,
      });
    } catch (e) {
      if (seq === previewSeq.current) toast.error("Erro no preview: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      if (seq === previewSeq.current) setPreviewing(false);
    }
  }, [audience, stageIds.length, listaIds.length, sources]);

  useEffect(() => {
    const t = setTimeout(() => { runPreview(); }, 450);
    return () => clearTimeout(t);
  }, [runPreview]);

  async function disparar() {
    if (!preview || preview.count === 0) {
      toast.error("Nenhum lead elegível para disparar");
      return;
    }
    if (canal === "meta" && !templateName) {
      toast.error("Selecione o template Meta"); setTab("mensagem"); return;
    }
    if (canal === "meta" && metaTemplates.length > 0 && !currentTemplateMeta) {
      toast.error(`Template "${templateName}" não está na lista de aprovados. Clique em Atualizar ou escolha outro.`);
      setTab("mensagem"); return;
    }
    if (canal === "evolution" && !mensagem && !has("descartados")) {
      toast.error("Escreva a mensagem"); setTab("mensagem"); return;
    }
    if (canal === "meta" && templateName) {
      const { data: blocked } = await supabase
        .from("blocked_templates").select("template_name, reason")
        .eq("template_name", templateName).maybeSingle();
      if (blocked) {
        toast.error(`⛔ Template "${templateName}" bloqueado: ${blocked.reason}`);
        return;
      }
    }
    const { data: cfgLock } = await supabase
      .from("reengajamento_config")
      .select("paused_until_release, paused_reason")
      .limit(1).maybeSingle();
    if (cfgLock?.paused_until_release) {
      toast.error("⛔ Central travada: " + (cfgLock?.paused_reason || "liberação manual necessária"));
      return;
    }
    const sampleEst = modoTeste ? Math.min(300, Math.max(50, Math.ceil(preview.count * 0.05))) : preview.count;
    const confirmMsg = modoTeste
      ? `Modo teste cauteloso: enviar apenas ~${Math.min(sampleEst, preview.count).toLocaleString("pt-BR")} de ${preview.count.toLocaleString("pt-BR")} elegíveis (amostra aleatória, 5% com mín 50 e máx 300). Auto-pausa se falhar >15% na janela de 20 ou atingir 20 falhas totais. Continuar?`
      : `Disparar para ${preview.count.toLocaleString("pt-BR")} leads via ${canal === "meta" ? "Meta" : "Evolution"}?`;
    if (!confirm(confirmMsg)) return;


    setFiring(true);
    try {
      const body = { force: true, iniciado_por: "manual_custom", audience };
      const { data, error } = await supabase.functions.invoke("reengajamento-descartados-enqueue", { body });
      if (error) throw new Error(await getEdgeErrorMessage(error));
      const resp = data as any;
      const reason = String(resp?.reason || "");
      const backendMessage = resp?.message || resp?.motivo || resp?.error;
      if (reason === "no_leads") { toast.info("Nenhum lead elegível após filtros"); return; }
      if (reason === "active_run_in_progress") {
        toast.info(`Já há disparo em andamento${resp?.active_run_id ? ` (${String(resp.active_run_id).slice(0, 8)})` : ""}`);
        return;
      }
      if (["meta_quality_cooldown", "locked_quality_pause", "auto_paused_meta_quality", "auto_paused_delivery_quality"].includes(reason)) {
        toast.error("⛔ Meta pausou por qualidade: " + String(resp?.motivo || "aguarde recuperação"));
        return;
      }
      if (reason === "auto_paused_50_consecutive_failures") {
        toast.error(`⛔ Pausado por 50 falhas seguidas: ${String(resp?.motivo || backendMessage || "veja histórico")}`);
        onFired?.(); return;
      }
      if (resp?.ok === false || (resp?.error && reason !== "no_send")) {
        toast.error(`Erro no disparo: ${backendMessage || "veja histórico"}`);
        onFired?.(); return;
      }
      const queued = resp?.queued ?? resp?.total ?? resp?.audit?.enfileirados ?? preview.count;
      toast.success(`🚀 Fila criada com ${Number(queued || 0).toLocaleString("pt-BR")} números`);
      setPreview(null);
      onFired?.();
    } catch (e) {
      toast.error("Erro: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setFiring(false);
    }
  }

  function toggleStage(id: string) { setStageIds((p) => p.includes(id) ? p.filter((s) => s !== id) : [...p, id]); }
  function toggleSource(s: Source) {
    setSources((prev) => {
      const next = prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s];
      return next.length ? next : ["descartados"];
    });
  }

  return (
    <Card className="border-indigo-300 bg-indigo-50/30 dark:bg-indigo-950/10">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Target className="h-4 w-4 text-indigo-600" /> Novo disparo
          <Badge variant="outline" className="text-[10px] ml-auto">Central unificada</Badge>
        </CardTitle>
        <p className="text-[11px] text-muted-foreground">
          Monte o público, ajuste filtros e escolha a mensagem. Preview atualiza sozinho conforme você mexe.
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid lg:grid-cols-[1fr_320px] gap-4 items-start">
          {/* ─── COLUNA PRINCIPAL — ABAS ─── */}
          <div>
            <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
              <TabsList className="w-full grid grid-cols-3 h-9">
                <TabsTrigger value="publico" className="gap-1.5 text-xs"><Users className="h-3.5 w-3.5" /> 1. Público</TabsTrigger>
                <TabsTrigger value="filtros" className="gap-1.5 text-xs"><Filter className="h-3.5 w-3.5" /> 2. Filtros</TabsTrigger>
                <TabsTrigger value="mensagem" className="gap-1.5 text-xs"><MessageSquare className="h-3.5 w-3.5" /> 3. Mensagem</TabsTrigger>
              </TabsList>

              {/* ─── PÚBLICO ─── */}
              <TabsContent value="publico" className="space-y-3 pt-3">
                <div>
                  <Label className="text-xs">Canal de envio</Label>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <Button type="button" variant={canal === "meta" ? "default" : "outline"} onClick={() => setCanal("meta")} className="h-9 justify-start gap-2" size="sm">
                      <Shield className="h-3.5 w-3.5" /> Meta (template oficial)
                    </Button>
                    <Button type="button" variant={canal === "evolution" ? "default" : "outline"} onClick={() => setCanal("evolution")} className="h-9 justify-start gap-2" size="sm">
                      <Zap className="h-3.5 w-3.5" /> Evolution (free text)
                    </Button>
                  </div>
                </div>

                <div>
                  <Label className="text-xs flex items-center gap-1.5">
                    Fonte de leads
                    {isCombined && <Badge variant="outline" className="text-[9px]">combinado · dedup telefone</Badge>}
                  </Label>
                  <div className="grid sm:grid-cols-3 gap-2 mt-1">
                    {([
                      { v: "descartados" as Source, label: "Descartados", desc: "Reengajar quem já esteve no funil" },
                      { v: "oferta_ativa_lista" as Source, label: "Oferta Ativa", desc: "Disparar para listas específicas" },
                      { v: "pipeline_ativo" as Source, label: "Pipeline ativo", desc: "Etapas selecionadas" },
                    ]).map(({ v, label, desc }) => {
                      const active = has(v);
                      return (
                        <button
                          key={v}
                          type="button"
                          onClick={() => toggleSource(v)}
                          className={cn(
                            "border rounded-lg p-3 text-left transition-colors",
                            active
                              ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 ring-1 ring-indigo-500"
                              : "border-border hover:border-indigo-300 hover:bg-muted/50"
                          )}
                        >
                          <div className="flex items-center gap-1.5 text-sm font-medium">
                            <Check className={cn("h-3.5 w-3.5 transition-opacity", active ? "opacity-100 text-indigo-600" : "opacity-0")} />
                            {label}
                          </div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">{desc}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="border-t pt-3 flex justify-end">
                  <Button size="sm" onClick={() => setTab("filtros")}>
                    Próximo: Filtros <Filter className="h-3.5 w-3.5 ml-1.5" />
                  </Button>
                </div>
              </TabsContent>

              {/* ─── FILTROS ─── */}
              <TabsContent value="filtros" className="space-y-3 pt-3">
                {/* Recência */}
                {(has("descartados") || has("oferta_ativa_lista") || has("pipeline_ativo")) && (
                  <div>
                    <Label className="text-xs flex items-center gap-1.5">
                      <Flame className="h-3.5 w-3.5" /> Recência
                    </Label>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {(["7d", "30d", "90d", "180d", "mais", "todos"] as Recencia[]).map((r) => {
                        const active = recencia === r;
                        const brk = preview?.breakdown_por_recencia;
                        const n = r === "todos"
                          ? (brk ? Object.values(brk).reduce((s, v) => s + (v as number), 0) : null)
                          : (brk ? (brk[r] ?? 0) : null);
                        return (
                          <Button
                            key={r}
                            type="button"
                            size="sm"
                            variant={active ? "default" : "outline"}
                            onClick={() => setRecencia(r)}
                            className="h-7 text-[10px] gap-1"
                          >
                            {r === "7d" && <Flame className="h-3 w-3" />}
                            {RECENCIA_LABELS[r]}
                            {n !== null && (
                              <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4 tabular-nums">
                                {n.toLocaleString("pt-BR")}
                              </Badge>
                            )}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Empreendimento multi-select */}
                {(has("descartados") || has("oferta_ativa_lista") || has("pipeline_ativo")) && (
                  <EmpreendimentoMultiSelect
                    options={preview?.breakdown_por_empreendimento || []}
                    selected={empreendimentos}
                    onChange={setEmpreendimentos}
                  />
                )}

                {/* Descartados: tipo + arquivados */}
                {has("descartados") && (
                  <div className="space-y-2 border-t pt-2">
                    <div>
                      <Label className="text-xs">Tipo de descarte</Label>
                      <Select value={tipoDescarte} onValueChange={(v) => setTipoDescarte(v as typeof tipoDescarte)}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="reengajavel">Reengajáveis (exclui inativados)</SelectItem>
                          <SelectItem value="definitivo">Apenas inativados definitivos</SelectItem>
                          <SelectItem value="todos">Todos</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <label className="flex items-center gap-2 text-xs cursor-pointer">
                      <Checkbox checked={includeArchived} onCheckedChange={(v) => setIncludeArchived(v === true)} />
                      <span>Incluir leads arquivados (recomendado)</span>
                    </label>
                    {preview?.breakdown_por_motivo_descarte && preview.breakdown_por_motivo_descarte.length > 0 && (
                      <div className="mt-1">
                        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Motivos de descarte (informativo)</Label>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {preview.breakdown_por_motivo_descarte.slice(0, 8).map((m) => (
                            <Badge key={m.motivo} variant="outline" className="text-[10px] font-normal">
                              {m.motivo} <span className="ml-1 text-muted-foreground tabular-nums">{m.total}</span>
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Pipeline ativo */}
                {has("pipeline_ativo") && (
                  <div className="border-t pt-2">
                    <Label className="text-xs">Etapas ({stageIds.length} selecionada{stageIds.length !== 1 ? "s" : ""})</Label>
                    <div className="flex flex-wrap gap-1 mt-1 p-2 border rounded-md bg-background max-h-40 overflow-y-auto">
                      {stages
                        .filter((s: any) => !["Descarte", "Negócio Criado", "Venda"].includes(s.nome))
                        .map((s: any) => (
                          <Badge
                            key={s.id}
                            variant={stageIds.includes(s.id) ? "default" : "outline"}
                            className="cursor-pointer text-[10px]"
                            onClick={() => toggleStage(s.id)}
                          >
                            {s.nome}
                          </Badge>
                        ))}
                    </div>
                  </div>
                )}

                {/* Oferta ativa listas */}
                {has("oferta_ativa_lista") && (
                  <div className="border-t pt-2">
                    <Label className="text-xs">Listas ({listaIds.length} selecionada{listaIds.length !== 1 ? "s" : ""})</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" role="combobox" className="w-full justify-between h-9 font-normal">
                          <span className="truncate text-left">
                            {listaIds.length === 0 ? "Selecione uma ou mais listas…"
                              : listaIds.length === 1 ? (listas.find((l: any) => l.id === listaIds[0])?.nome || "1 lista")
                              : `${listaIds.length} listas selecionadas`}
                          </span>
                          <ChevronsUpDown className="h-3.5 w-3.5 opacity-50 ml-2 shrink-0" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Buscar lista…" />
                          <CommandList>
                            <CommandEmpty>Nenhuma lista encontrada.</CommandEmpty>
                            {listaIds.length > 0 && (
                              <>
                                <CommandGroup>
                                  <CommandItem onSelect={() => setListaIds([])}>
                                    <span className="text-xs text-muted-foreground">Limpar seleção</span>
                                  </CommandItem>
                                </CommandGroup>
                                <CommandSeparator />
                              </>
                            )}
                            <CommandGroup>
                              {listas.map((l: any) => {
                                const checked = listaIds.includes(l.id);
                                const isNew = l.created_at && (Date.now() - new Date(l.created_at).getTime()) < 7 * 24 * 3600 * 1000;
                                return (
                                  <CommandItem
                                    key={l.id}
                                    value={`${l.nome} ${l.empreendimento || ""}`}
                                    onSelect={() => setListaIds((p) => p.includes(l.id) ? p.filter((x) => x !== l.id) : [...p, l.id])}
                                  >
                                    <Check className={cn("mr-2 h-4 w-4", checked ? "opacity-100" : "opacity-0")} />
                                    <span className="truncate flex-1">{l.nome} — {l.empreendimento} ({l.total_leads || 0})</span>
                                    {isNew && <Badge variant="secondary" className="text-[9px]">🔥 nova</Badge>}
                                  </CommandItem>
                                );
                              })}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                )}

                {/* Regras (colapsável) */}
                <details className="border rounded-md bg-background/60">
                  <summary className="cursor-pointer p-2 text-xs flex items-center gap-1.5">
                    <Settings2 className="h-3.5 w-3.5" /> Regras de dedup
                    <span className="ml-auto text-[10px] text-muted-foreground">
                      {dedupMode === "cooldown" && `Cooldown ${cooldownDias}d`}
                      {dedupMode === "exclude_sent" && "Excluir quem já recebeu"}
                      {dedupMode === "include_all" && "Sem dedup"}
                      {dedupMode === "only_sent_before" && `Antes de ${dedupCutoff || "…"}`}
                    </span>
                  </summary>
                  <div className="p-3 pt-0 space-y-2">
                    <Select value={dedupMode} onValueChange={(v) => setDedupMode(v as DedupMode)}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cooldown">Reenviar quem não respondeu (com cooldown)</SelectItem>
                        <SelectItem value="exclude_sent">Excluir todo mundo que já recebeu</SelectItem>
                        <SelectItem value="include_all">Incluir todos (sem cooldown)</SelectItem>
                        <SelectItem value="only_sent_before">Só quem recebeu antes de…</SelectItem>
                      </SelectContent>
                    </Select>
                    {dedupMode === "cooldown" && (
                      <div className="flex items-center gap-2">
                        <Label className="text-[11px] text-muted-foreground whitespace-nowrap">Cooldown (dias)</Label>
                        <Input type="number" min={1} max={60} value={cooldownDias} onChange={(e) => setCooldownDias(Math.max(1, Number(e.target.value) || 7))} className="h-8 w-20" />
                      </div>
                    )}
                    {dedupMode === "only_sent_before" && (
                      <Input type="date" value={dedupCutoff} onChange={(e) => setDedupCutoff(e.target.value)} className="h-9" />
                    )}
                    <div>
                      <Label className="text-[11px] text-muted-foreground">Limite máximo de envios</Label>
                      <Input type="number" value={limit} min={1} max={10000} onChange={(e) => setLimit(Number(e.target.value))} className="h-9" />
                    </div>
                  </div>
                </details>

                <div className="border-t pt-3 flex justify-between">
                  <Button size="sm" variant="ghost" onClick={() => setTab("publico")}>← Público</Button>
                  <Button size="sm" onClick={() => setTab("mensagem")}>
                    Próximo: Mensagem <MessageSquare className="h-3.5 w-3.5 ml-1.5" />
                  </Button>
                </div>
              </TabsContent>

              {/* ─── MENSAGEM ─── */}
              <TabsContent value="mensagem" className="space-y-3 pt-3">
                {canal === "meta" && (
                  <div className={cn(
                    "rounded-md border p-2.5 flex items-start gap-2.5 text-xs",
                    modoTeste ? "bg-amber-50 border-amber-300 dark:bg-amber-950/30 dark:border-amber-800" : "bg-muted/40 border-muted"
                  )}>
                    <input
                      type="checkbox"
                      id="modo-teste-toggle"
                      checked={modoTeste}
                      onChange={(e) => setModoTeste(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-input"
                    />
                    <label htmlFor="modo-teste-toggle" className="flex-1 cursor-pointer leading-relaxed">
                      <span className="font-medium flex items-center gap-1.5">
                        🧪 Modo teste cauteloso
                        {modoTeste && <Badge variant="outline" className="text-[9px] bg-amber-100 border-amber-300">ativo</Badge>}
                      </span>
                      <span className="text-muted-foreground block mt-0.5">
                        Dispara para uma amostra pequena (5%, mín 50 · máx 300) sorteada aleatoriamente e{" "}
                        <strong>ignora apenas a supressão de "Recebeu e/ou leu"</strong> (30d cooldown) —
                        bloqueios da Meta (131049/131050/131026) e respostas NÃO continuam intocáveis. Auto-pausa
                        se &gt;15% falharem na janela de 20 envios ou totalizar 20 falhas.
                      </span>
                      {modoTeste && preview && preview.count > 0 && (
                        <span className="block mt-1.5 text-amber-900 dark:text-amber-200 font-medium">
                          → ~{Math.min(300, Math.max(50, Math.ceil(preview.count * 0.05))).toLocaleString("pt-BR")} números
                          de {preview.count.toLocaleString("pt-BR")} elegíveis serão testados.
                        </span>
                      )}
                    </label>
                  </div>
                )}
                {canal === "meta" ? (

                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <Label className="text-xs">Template Meta aprovado</Label>
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => setTemplateManualMode((v) => !v)} className="text-[10px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                          <Pencil className="h-3 w-3" /> {templateManualMode ? "Voltar à lista" : "Manual"}
                        </button>
                        <button type="button" onClick={() => refetchTemplates()} disabled={fetchingTemplates} className="text-[10px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                          <RefreshCw className={cn("h-3 w-3", fetchingTemplates && "animate-spin")} /> Atualizar
                        </button>
                      </div>
                    </div>
                    {templateManualMode ? (
                      <div className="grid grid-cols-[1fr_120px] gap-2">
                        <Input placeholder="ex.: reativacao_v2" value={templateName} onChange={(e) => setTemplateName(e.target.value)} className="h-9" />
                        <Input placeholder="pt_BR" value={templateLanguage} onChange={(e) => setTemplateLanguage(e.target.value)} className="h-9" />
                      </div>
                    ) : (
                      <Popover open={templatePickerOpen} onOpenChange={setTemplatePickerOpen}>
                        <PopoverTrigger asChild>
                          <Button variant="outline" role="combobox" className="h-9 w-full justify-between font-normal">
                            {templateName ? (
                              <span className="flex items-center gap-2 min-w-0">
                                <span className="truncate">{templateName}</span>
                                <Badge variant="outline" className="text-[9px] shrink-0">{templateLanguage}</Badge>
                                {currentTemplateMeta?.has_buttons && <MousePointerClick className="h-3 w-3 text-indigo-500 shrink-0" />}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">{loadingTemplates ? "Carregando..." : "Selecione um template..."}</span>
                            )}
                            <ChevronsUpDown className="h-3.5 w-3.5 opacity-50 shrink-0" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[420px] p-0" align="start">
                          <Command>
                            <CommandInput placeholder="Buscar template..." />
                            <CommandList>
                              <CommandEmpty>{loadingTemplates ? "Carregando..." : "Nenhum template aprovado."}</CommandEmpty>
                              <CommandGroup heading={`${metaTemplates.length} templates aprovados`}>
                                {metaTemplates.map((t) => {
                                  const selected = t.name === templateName && t.language === templateLanguage;
                                  return (
                                    <CommandItem key={`${t.name}-${t.language}`} value={`${t.name} ${t.language}`} onSelect={() => selectTemplate(t.name, t.language)} className="flex items-center gap-2">
                                      <Check className={cn("h-3.5 w-3.5", selected ? "opacity-100" : "opacity-0")} />
                                      <span className="flex-1 truncate">{t.name}</span>
                                      {t.has_buttons && <Badge variant="outline" className="text-[9px]"><MousePointerClick className="h-2.5 w-2.5 mr-0.5" />botões</Badge>}
                                      <Badge variant="outline" className="text-[9px]">{t.language}</Badge>
                                    </CommandItem>
                                  );
                                })}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    )}

                    <div className="mt-3">
                      <Label className="text-xs">Imagem do header (opcional)</Label>
                      <Input placeholder="https://…" value={headerImageUrl} onChange={(e) => setHeaderImageUrl(e.target.value)} className="h-9 mt-1" />
                      {headerImageUrl.trim() && (
                        <div className="flex items-center gap-2 mt-1.5">
                          <img src={headerImageUrl} alt="" className="h-12 w-12 rounded object-cover border" />
                          <p className="text-[10px] text-muted-foreground">
                            {TEMPLATE_HEADER_IMAGES[templateName] === headerImageUrl ? "✓ Imagem mapeada automaticamente" : "Imagem personalizada"}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div>
                    <Label className="text-xs">Mensagem (Evolution)</Label>
                    <Textarea rows={4} placeholder="Oi {{nome}}, tudo bem? ..." value={mensagem} onChange={(e) => setMensagem(e.target.value)} />
                    <p className="text-[10px] text-muted-foreground mt-1">Use {"{{nome}}"} como variável.</p>
                  </div>
                )}

                <div className="border-t pt-3 flex justify-between">
                  <Button size="sm" variant="ghost" onClick={() => setTab("filtros")}>← Filtros</Button>
                  {preview && preview.sample.length > 0 && (
                    <details className="text-[10px] text-muted-foreground">
                      <summary className="cursor-pointer">Ver amostra ({preview.sample.length})</summary>
                      <ul className="mt-1 max-h-32 overflow-y-auto border rounded p-2 bg-background w-64">
                        {preview.sample.slice(0, 20).map((l) => (
                          <li key={l.id}>• {l.nome} — {l.telefone || "(sem tel.)"}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* ─── FUNIL LATERAL ─── */}
          <FunilLateral
            loading={previewing}
            count={preview?.count ?? null}
            funil={preview?.funil}
            breakdownEmpreendimento={preview?.breakdown_por_empreendimento}
            ultimoDisparoTemplate={preview?.ultimo_disparo_template}
            canal={canal}
            templateName={templateName}
            firing={firing}
            onDisparar={disparar}
            onFocusEmpreendimento={(nome) => setEmpreendimentos([nome])}
          />
        </div>
      </CardContent>
    </Card>
  );
}
