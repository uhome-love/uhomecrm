import { useEffect, useState } from "react";
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
import { Loader2, Send, Search, Target, Shield, Zap, Check, ChevronsUpDown, MousePointerClick, Pencil, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Source = "descartados" | "pipeline_ativo" | "oferta_ativa_lista";
type Canal = "meta" | "evolution";
type DedupMode = "cooldown" | "exclude_sent" | "include_all" | "only_sent_before";

interface PreviewFunil {
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
  em_cooldown?: number;
  cooldown_dias?: number;
  elegiveis?: number;
}

async function getEdgeErrorMessage(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    const text = await error.context.text().catch(() => "");
    if (text) {
      try {
        const parsed = JSON.parse(text) as { error?: string; message?: string; motivo?: string; reason?: string };
        return parsed.error || parsed.message || parsed.motivo || parsed.reason || text;
      } catch {
        return text;
      }
    }
  }
  return error instanceof Error ? error.message : String(error);
}
interface PreviewResult {
  count: number;
  sample: unknown[];
  funil?: PreviewFunil;
}

// Imagem fixa de header por template Meta (templates com cabeçalho de imagem).
// Para um novo template, basta adicionar o nome → URL pública aqui (ou colar a URL no campo do card).
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



export default function DisparoCustomizadoCard({ onFired }: { onFired?: () => void }) {
  const [canal, setCanal] = useState<Canal>("meta");
  // Multi-fonte: combina públicos (descartados + oferta ativa + pipeline) com dedup por telefone.
  const [sources, setSources] = useState<Source[]>(["descartados"]);
  const source = sources[0] ?? "descartados";
  const has = (s: Source) => sources.includes(s);
  const isCombined = sources.length > 1;
  const [tipoDescarte, setTipoDescarte] = useState<"reengajavel" | "definitivo" | "todos">("reengajavel");
  const [stageIds, setStageIds] = useState<string[]>([]);
  const [listaIds, setListaIds] = useState<string[]>([]);

  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [empreendimento, setEmpreendimento] = useState<string>("");
  const [dedupMode, setDedupMode] = useState<DedupMode>("cooldown");
  const [dedupCutoff, setDedupCutoff] = useState<string>("");
  const [cooldownDias, setCooldownDias] = useState<number>(7);
  const [includeArchived, setIncludeArchived] = useState<boolean>(true);
  const [limit, setLimit] = useState<number>(100);
  const [templateName, setTemplateName] = useState<string>("");
  const [templateLanguage, setTemplateLanguage] = useState<string>("pt_BR");
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [templateManualMode, setTemplateManualMode] = useState(false);
  // Imagem fixa do header por template (Meta). Cada novo template pode ter sua imagem aqui.
  const [headerImageUrl, setHeaderImageUrl] = useState<string>("");
  const [mensagem, setMensagem] = useState<string>("");
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [firing, setFiring] = useState(false);

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

  // Templates Meta aprovados (Graph API)
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

  // Default template/language vindo da config (descartados)
  const { data: cfgDefaults } = useQuery({
    queryKey: ["reengajamento-config-defaults"],
    queryFn: async () => {
      const { data: reng } = await supabase
        .from("reengajamento_config")
        .select("meta_template_name, meta_template_name_2, meta_template_language")
        .limit(1)
        .maybeSingle();
      return { reng };
    },
    staleTime: 5 * 60 * 1000,
  });

  // Pré-preenche o template quando muda canal/source
  useEffect(() => {
    if (canal !== "meta" || !cfgDefaults || templateName) return;
    if (source === "descartados" && cfgDefaults.reng?.meta_template_name) {
      setTemplateName(cfgDefaults.reng.meta_template_name);
      setTemplateLanguage(cfgDefaults.reng.meta_template_language || "pt_BR");
    }
  }, [canal, source, cfgDefaults, templateName]);


  // Auto-preenche a imagem fixa do header conforme o template selecionado
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
    setPreview(null);
  }

  const currentTemplateMeta = metaTemplates.find((t) => t.name === templateName && t.language === templateLanguage);

  function buildAudience() {
    const periodo = (from || to) ? {
      from: from ? new Date(from + "T00:00:00-03:00").toISOString() : undefined,
      to: to ? new Date(to + "T23:59:59-03:00").toISOString() : undefined,
    } : undefined;
    const base: Record<string, unknown> = {
      source,
      sources,
      canal,
      periodo,
      empreendimento: empreendimento || undefined,
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
    return base;
  }

  async function doPreview() {
    if (has("pipeline_ativo") && stageIds.length === 0) {
      toast.error("Selecione ao menos uma etapa do pipeline");
      return;
    }
    if (has("oferta_ativa_lista") && listaIds.length === 0) {
      toast.error("Selecione ao menos uma lista da Oferta Ativa");
      return;
    }
    setPreviewing(true);
    setPreview(null);
    try {
      const { data, error } = await supabase.functions.invoke("reengajamento-audience-preview", {
        body: { audience: buildAudience() },
      });
      if (error) throw new Error(await getEdgeErrorMessage(error));
      const d = data as { error?: string; count?: number; sample?: unknown[]; funil?: PreviewFunil };
      if (d?.error) throw new Error(d.error);
      setPreview({ count: d.count || 0, sample: d.sample || [], funil: d.funil });
    } catch (e) {
      toast.error("Erro no preview: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setPreviewing(false);
    }
  }

  async function disparar() {
    if (!preview || preview.count === 0) {
      toast.error("Faça o preview primeiro e confirme que há leads elegíveis");
      return;
    }
    if (canal === "meta" && !templateName) {
      toast.error("Selecione o template Meta que será usado neste disparo");
      return;
    }
    if (canal === "meta" && metaTemplates.length > 0 && !currentTemplateMeta) {
      toast.error(`Template "${templateName}" não apareceu na lista de aprovados da Meta. Clique em Atualizar ou selecione outro template aprovado.`);
      return;
    }
    if (canal === "evolution" && !mensagem && !has("descartados")) {
      toast.error("Escreva a mensagem que será enviada");
      return;
    }
    // FIX B: bloquear templates em blacklist
    if (canal === "meta" && templateName) {
      const { data: blocked } = await supabase
        .from("blocked_templates")
        .select("template_name, reason")
        .eq("template_name", templateName)
        .maybeSingle();
      if (blocked) {
        toast.error(`⛔ Template "${templateName}" está bloqueado: ${blocked.reason}. Verifique no Business Manager antes de remover da blacklist.`);
        return;
      }
    }
    // FIX A: respeitar pausa travada
    const { data: cfgLock } = await supabase
      .from("reengajamento_config")
      .select("paused_until_release, paused_reason")
      .limit(1)
      .maybeSingle();
    if (cfgLock?.paused_until_release) {
      toast.error("⛔ Central travada: " + (cfgLock?.paused_reason || "liberação manual via SQL admin necessária"));
      return;
    }
    if (!confirm(`Disparar para ${preview.count} leads via ${canal === "meta" ? "Meta" : "Evolution"}? Esta ação envia mensagens reais.`)) return;
    setFiring(true);
    try {
      const body = { force: true, iniciado_por: "manual_custom", audience: buildAudience() };
      const { data, error } = await supabase.functions.invoke("reengajamento-descartados-enqueue", { body });
      if (error) throw new Error(await getEdgeErrorMessage(error));

      const resp = data as { reason?: string; motivo?: string; error?: string; run_id?: string; active_run_id?: string; sent?: number; failed?: number; skipped?: number; total?: number } | null;
      const reason = String(resp?.reason || "");
      if (reason === "no_leads") {
        toast.info("Nenhum lead elegível após os filtros de segurança");
        return;
      }
      if (reason === "active_run_in_progress") {
        toast.info(`Já existe um disparo em andamento. Acompanhe/retome pela faixa de execução ativa${resp?.active_run_id ? ` (${resp.active_run_id.slice(0, 8)})` : ""}.`);
        return;
      }
      if (["meta_quality_cooldown", "locked_quality_pause", "auto_paused_meta_quality", "auto_paused_delivery_quality"].includes(reason)) {
        toast.error("⛔ Meta pausou por qualidade: " + String(resp?.motivo || "aguarde a recuperação antes de retomar"));
        return;
      }
      if (resp?.error) throw new Error(resp.error);
      if (reason === "error") {
        toast.error(`Disparo encerrado sem envio: ${resp?.failed ?? 0} falhas, ${resp?.skipped ?? 0} ignorados. Veja o histórico para o motivo.`);
        return;
      }
      toast.success(`🚀 Disparo iniciado para ${preview.count} leads`);
      setPreview(null);
      onFired?.();
    } catch (e) {
      toast.error("Erro: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setFiring(false);
    }
  }

  function toggleStage(id: string) {
    setStageIds((prev) => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  }

  function toggleSource(s: Source) {
    setPreview(null);
    setSources((prev) => {
      const next = prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s];
      return next.length ? next : ["descartados"];
    });
  }


  function setPeriodoQuick(kind: "hoje" | "semana" | "mes" | "30d") {
    const now = new Date();
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    if (kind === "hoje") { setFrom(fmt(now)); setTo(fmt(now)); }
    else if (kind === "semana") {
      const d = new Date(now); d.setDate(d.getDate() - d.getDay());
      setFrom(fmt(d)); setTo(fmt(now));
    } else if (kind === "mes") {
      const d = new Date(now.getFullYear(), now.getMonth(), 1);
      setFrom(fmt(d)); setTo(fmt(now));
    } else {
      const d = new Date(now); d.setDate(d.getDate() - 30);
      setFrom(fmt(d)); setTo(fmt(now));
    }
  }

  return (
    <Card className="border-indigo-300 bg-indigo-50/30 dark:bg-indigo-950/10">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Target className="h-4 w-4 text-indigo-600" /> Novo disparo
          <Badge variant="outline" className="text-[10px] ml-auto">Central unificada</Badge>
        </CardTitle>
        <p className="text-[11px] text-muted-foreground">
          Escolha canal, público, filtre e dispare. Tudo passa pelas regras de horário, throttle e dedup configurados abaixo.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid lg:grid-cols-2 gap-x-5 gap-y-3 items-start">
        {/* COLUNA ESQUERDA: público e filtros */}
        <div className="space-y-3">
        {/* CANAL */}

        <div>
          <Label className="text-xs">Canal</Label>
          <div className="grid grid-cols-2 gap-2 mt-1">
            <Button
              type="button"
              variant={canal === "meta" ? "default" : "outline"}
              onClick={() => setCanal("meta")}
              className="h-9 justify-start gap-2"
              size="sm"
            >
              <Shield className="h-3.5 w-3.5" /> Meta (template oficial)
            </Button>
            <Button
              type="button"
              variant={canal === "evolution" ? "default" : "outline"}
              onClick={() => setCanal("evolution")}
              className="h-9 justify-start gap-2"
              size="sm"
            >
              <Zap className="h-3.5 w-3.5" /> Evolution (free text)
            </Button>
          </div>
        </div>

        {/* PÚBLICO (multi-fonte) */}
        <div>
          <Label className="text-xs">Público {isCombined && <Badge variant="outline" className="text-[9px] ml-1">combinado · dedup por telefone</Badge>}</Label>
          <div className="grid grid-cols-2 gap-1.5 mt-1">
            {([
              { v: "descartados", label: "Descartados" },
              { v: "oferta_ativa_lista", label: "Oferta Ativa (listas)" },
              { v: "pipeline_ativo", label: "Pipeline ativo (etapas)" },
            ] as { v: Source; label: string }[]).map(({ v, label }) => (
              <Button
                key={v}
                type="button"
                size="sm"
                variant={has(v) ? "default" : "outline"}
                onClick={() => toggleSource(v)}
                className="h-8 justify-start text-[11px]"
              >
                <Check className={cn("h-3 w-3 mr-1", has(v) ? "opacity-100" : "opacity-0")} />
                {label}
              </Button>
            ))}
          </div>
          {isCombined && (
            <p className="text-[10px] text-muted-foreground mt-1">
              Os públicos serão unidos em um único disparo. Cada lead recebe só 1 mensagem (dedup pelos últimos 8 dígitos do telefone; prioridade: descartados &gt; oferta ativa &gt; pipeline).
            </p>
          )}
        </div>



        {/* Filtros dinâmicos */}
        {has("descartados") && (
          <div className="space-y-2">
            <div>
              <Label className="text-xs">Tipo de descarte</Label>
              <Select value={tipoDescarte} onValueChange={(v) => setTipoDescarte(v as "reengajavel" | "definitivo" | "todos")}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="reengajavel">Reengajáveis (exclui inativados)</SelectItem>
                  <SelectItem value="definitivo">Apenas inativados definitivos</SelectItem>
                  <SelectItem value="todos">Todos (inclui inativados)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground mt-1">
                "Reengajáveis" remove automaticamente quem respondeu NÃO, foi bloqueado ou está com tipo definitivo.
              </p>
            </div>
            <label className="flex items-start gap-2 text-xs cursor-pointer">
              <Checkbox
                checked={includeArchived}
                onCheckedChange={(v) => { setIncludeArchived(v === true); setPreview(null); }}
                className="mt-0.5"
              />
              <span>Incluir leads arquivados (recomendado — descartados antigos ficam arquivados após 24h)</span>
            </label>

          </div>
        )}

        {has("pipeline_ativo") && (
          <div>
            <Label className="text-xs">Etapas ({stageIds.length} selecionada{stageIds.length !== 1 ? "s" : ""})</Label>
            <div className="flex flex-wrap gap-1 mt-1 p-2 border rounded-md max-h-40 overflow-y-auto bg-background">
              {stages
                .filter((s: { nome: string }) => !["Descarte", "Negócio Criado", "Venda"].includes(s.nome))
                .map((s: { id: string; nome: string }) => (
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

        {has("oferta_ativa_lista") && (
          <div>
            <Label className="text-xs">
              Listas {listaIds.length > 0 && `(${listaIds.length} selecionada${listaIds.length !== 1 ? "s" : ""})`}
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full justify-between h-9 font-normal">
                  <span className="truncate text-left">
                    {listaIds.length === 0
                      ? "Selecione uma ou mais listas…"
                      : listaIds.length === 1
                        ? (listas.find((l: any) => l.id === listaIds[0])?.nome || "1 lista")
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
                    <CommandGroup>
                      {listaIds.length > 0 && (
                        <>
                          <CommandItem onSelect={() => { setListaIds([]); setPreview(null); }}>
                            <span className="text-xs text-muted-foreground">Limpar seleção</span>
                          </CommandItem>
                          <CommandSeparator />
                        </>
                      )}
                      {listas.map((l: { id: string; nome: string; empreendimento: string | null; total_leads: number | null }) => {
                        const checked = listaIds.includes(l.id);
                        return (
                          <CommandItem
                            key={l.id}
                            value={`${l.nome} ${l.empreendimento || ""}`}
                            onSelect={() => {
                              setListaIds((prev) => prev.includes(l.id) ? prev.filter((x) => x !== l.id) : [...prev, l.id]);
                              setPreview(null);
                            }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", checked ? "opacity-100" : "opacity-0")} />
                            <span className="truncate">{l.nome} — {l.empreendimento} ({l.total_leads || 0})</span>
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {listaIds.length > 1 && (
              <p className="text-[10px] text-muted-foreground mt-1">
                Leads das {listaIds.length} listas serão combinados em um único disparo.
              </p>
            )}
          </div>
        )}

        {/* Período */}
        <div>
          <Label className="text-xs">Período (opcional)</Label>
          <div className="flex gap-2 items-end">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 flex-1" />
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 flex-1" />
          </div>
          <div className="flex gap-1 mt-1">
            <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => setPeriodoQuick("hoje")}>Hoje</Button>
            <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => setPeriodoQuick("semana")}>Semana</Button>
            <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => setPeriodoQuick("mes")}>Mês</Button>
            <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => setPeriodoQuick("30d")}>30d</Button>
            <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => { setFrom(""); setTo(""); }}>Limpar</Button>
          </div>
        </div>


        {/* Empreendimento */}
        <div>
          <Label className="text-xs">Empreendimento (opcional)</Label>
          <Input placeholder="ex.: Casa Tua" value={empreendimento} onChange={(e) => setEmpreendimento(e.target.value)} className="h-9" />
        </div>
        </div>{/* /coluna esquerda */}

        {/* COLUNA DIREITA: envio (dedup, limite, template, mensagem) */}
        <div className="space-y-3">
        {/* Dedup */}

        <div>
          <Label className="text-xs">Quem já recebeu disparo</Label>
          <Select value={dedupMode} onValueChange={(v) => { setDedupMode(v as DedupMode); setPreview(null); }}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="cooldown">Reenviar quem não respondeu (com cooldown)</SelectItem>
              <SelectItem value="exclude_sent">Excluir todo mundo que já recebeu</SelectItem>
              <SelectItem value="include_all">Incluir todos (sem cooldown)</SelectItem>
              <SelectItem value="only_sent_before">Só quem recebeu antes de…</SelectItem>
            </SelectContent>
          </Select>
          {dedupMode === "cooldown" && (
            <div className="mt-2 flex items-center gap-2">
              <Label className="text-[11px] text-muted-foreground whitespace-nowrap">Cooldown (dias)</Label>
              <Input
                type="number"
                min={1}
                max={60}
                value={cooldownDias}
                onChange={(e) => { setCooldownDias(Math.max(1, Number(e.target.value) || 7)); setPreview(null); }}
                className="h-8 w-20"
              />
              <p className="text-[10px] text-muted-foreground">
                Quem não respondeu volta a ficar elegível após {cooldownDias} dias do último envio. Quem clicou em "Não quero mais" fica excluído permanentemente.
              </p>
            </div>
          )}
          {dedupMode === "only_sent_before" && (
            <Input type="date" value={dedupCutoff} onChange={(e) => setDedupCutoff(e.target.value)} className="h-9 mt-2" />
          )}
        </div>

        {/* Limite */}
        <div>
          <Label className="text-xs">Limite máximo de envios</Label>
              <Input type="number" value={limit} min={1} max={10000} onChange={(e) => setLimit(Number(e.target.value))} className="h-9" />
              <p className="text-[10px] text-muted-foreground mt-1">Máx 10.000 por disparo. Paginação automática acima de 1.000.</p>
        </div>

        {/* Template Meta — sempre disponível quando canal=meta */}
        {canal === "meta" && (
          <div>
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs">Template Meta aprovado</Label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setTemplateManualMode((v) => !v)}
                  className="text-[10px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                >
                  <Pencil className="h-3 w-3" />
                  {templateManualMode ? "Voltar à lista" : "Digitar manualmente"}
                </button>
                <button
                  type="button"
                  onClick={() => refetchTemplates()}
                  disabled={fetchingTemplates}
                  className="text-[10px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                >
                  <RefreshCw className={cn("h-3 w-3", fetchingTemplates && "animate-spin")} />
                  Atualizar
                </button>
              </div>
            </div>

            {templateManualMode ? (
              <div className="grid grid-cols-[1fr_120px] gap-2 mt-1">
                <Input
                  placeholder="ex.: reativacao_opcoes_perfil_v2"
                  value={templateName}
                  onChange={(e) => { setTemplateName(e.target.value); setPreview(null); }}
                  className="h-9"
                />
                <Input
                  placeholder="pt_BR"
                  value={templateLanguage}
                  onChange={(e) => setTemplateLanguage(e.target.value)}
                  className="h-9"
                />
              </div>
            ) : (
              <Popover open={templatePickerOpen} onOpenChange={setTemplatePickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="h-9 w-full justify-between mt-1 font-normal"
                  >
                    {templateName ? (
                      <span className="flex items-center gap-2 min-w-0">
                        <span className="truncate">{templateName}</span>
                        <Badge variant="outline" className="text-[9px] shrink-0">{templateLanguage}</Badge>
                        {currentTemplateMeta?.has_buttons && (
                          <MousePointerClick className="h-3 w-3 text-indigo-500 shrink-0" />
                        )}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">
                        {loadingTemplates ? "Carregando templates da Meta..." : "Selecione um template aprovado..."}
                      </span>
                    )}
                    <ChevronsUpDown className="h-3.5 w-3.5 opacity-50 shrink-0" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[420px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar template..." />
                    <CommandList>
                      <CommandEmpty>
                        {loadingTemplates ? "Carregando..." : "Nenhum template aprovado encontrado."}
                      </CommandEmpty>
                      <CommandGroup heading={`${metaTemplates.length} templates aprovados`}>
                        {metaTemplates.map((t) => {
                          const selected = t.name === templateName && t.language === templateLanguage;
                          return (
                            <CommandItem
                              key={`${t.name}-${t.language}`}
                              value={`${t.name} ${t.language} ${t.category || ""}`}
                              onSelect={() => selectTemplate(t.name, t.language)}
                              className="flex items-center gap-2"
                            >
                              <Check className={cn("h-3.5 w-3.5", selected ? "opacity-100" : "opacity-0")} />
                              <span className="flex-1 truncate">{t.name}</span>
                              {t.has_buttons && (
                                <Badge variant="outline" className="text-[9px] bg-indigo-50 text-indigo-700 border-indigo-200">
                                  <MousePointerClick className="h-2.5 w-2.5 mr-0.5" /> botões
                                </Badge>
                              )}
                              <Badge variant="outline" className="text-[9px]">{t.language}</Badge>
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                      <CommandSeparator />
                      <CommandGroup>
                        <CommandItem onSelect={() => { setTemplateManualMode(true); setTemplatePickerOpen(false); }}>
                          <Pencil className="h-3.5 w-3.5 mr-2" /> Digitar nome manualmente (avançado)
                        </CommandItem>
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            )}

            <p className="text-[10px] text-muted-foreground mt-1">
              Lista vinda direto do Meta Business — apenas templates aprovados. Disparos com botões SIM/NÃO classificam respostas automaticamente.
            </p>

            {/* Imagem fixa do header (templates com cabeçalho de imagem) */}
            <div className="mt-2">
              <Label className="text-xs">Imagem do header (templates com cabeçalho de imagem)</Label>
              <Input
                placeholder="https://… URL pública da imagem do template"
                value={headerImageUrl}
                onChange={(e) => { setHeaderImageUrl(e.target.value); setPreview(null); }}
                className="h-9 mt-1"
              />
              {headerImageUrl.trim() ? (
                <div className="flex items-center gap-2 mt-1.5">
                  <img src={headerImageUrl} alt="Header do template" className="h-12 w-12 rounded object-cover border" />
                  <p className="text-[10px] text-muted-foreground">
                    {TEMPLATE_HEADER_IMAGES[templateName] === headerImageUrl
                      ? "✓ Imagem mapeada automaticamente para este template."
                      : "Imagem personalizada. Deixe em branco se o template não tiver cabeçalho de imagem."}
                  </p>
                </div>
              ) : (
                <p className="text-[10px] text-muted-foreground mt-1">
                  Deixe em branco se o template não tiver cabeçalho de imagem. Templates só de texto ignoram este campo.
                </p>
              )}
            </div>
          </div>

        )}
        {canal === "evolution" && !has("descartados") && (
          <div>
            <Label className="text-xs">Mensagem (Evolution)</Label>
            <Textarea
              rows={3}
              placeholder="Oi {{nome}}, tudo bem? ..."
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
            />
            <p className="text-[10px] text-muted-foreground mt-1">Use {"{{nome}}"} como variável. Para descartados, a configuração padrão é usada.</p>
          </div>
        )}
        </div>{/* /coluna direita */}
        </div>{/* /grid 2 colunas */}

        {/* Preview + ação */}
        <div className="border-t pt-4 space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" onClick={doPreview} disabled={previewing}>
              {previewing ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Search className="h-4 w-4 mr-1.5" />}
              1. Calcular público
            </Button>
            {preview ? (
              <span className="text-sm">
                <strong className="text-primary text-lg">{preview.count.toLocaleString("pt-BR")}</strong> leads elegíveis
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">Calcule o público antes de disparar.</span>
            )}
          </div>


          {preview?.funil && isCombined && preview.funil.por_fonte && (
            <div className="text-[11px] border rounded p-2 bg-background space-y-1">
              <div className="font-medium text-indigo-700 mb-1">Conferência — Público combinado</div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                {Object.entries(preview.funil.por_fonte as Record<string, number>).map(([fonte, qtd]) => (
                  <div key={fonte} className="contents">
                    <span className="text-muted-foreground capitalize">{fonte.replace(/_/g, " ")}</span>
                    <span className="text-right font-mono">{qtd}</span>
                  </div>
                ))}
                {typeof preview.funil.duplicados_removidos === "number" && (
                  <>
                    <span className="text-muted-foreground">— Duplicados removidos (mesmo telefone)</span>
                    <span className="text-right font-mono text-amber-600">−{preview.funil.duplicados_removidos}</span>
                  </>
                )}
                {typeof preview.funil.telefones_invalidos === "number" && preview.funil.telefones_invalidos > 0 && (
                  <>
                    <span className="text-muted-foreground">— Telefones inválidos</span>
                    <span className="text-right font-mono text-rose-600">−{preview.funil.telefones_invalidos}</span>
                  </>
                )}
                {typeof preview.funil.removidos_pipeline_ativo === "number" && preview.funil.removidos_pipeline_ativo > 0 && (
                  <>
                    <span className="text-muted-foreground">— Já ativos no pipeline</span>
                    <span className="text-right font-mono text-amber-600">−{preview.funil.removidos_pipeline_ativo}</span>
                  </>
                )}
                {typeof preview.funil.removidos_frequencia === "number" && preview.funil.removidos_frequencia > 0 && (
                  <>
                    <span className="text-muted-foreground">— Receberam marketing recente</span>
                    <span className="text-right font-mono text-amber-600">−{preview.funil.removidos_frequencia}</span>
                  </>
                )}
                <span className="font-medium pt-1 border-t mt-1">= Elegíveis (1 msg por telefone)</span>
                <span className="text-right font-mono font-bold text-indigo-700 pt-1 border-t mt-1">{preview.count}</span>
              </div>
            </div>
          )}

          {preview?.funil && has("descartados") && (
            <div className="text-[11px] border rounded p-2 bg-background space-y-1">
              <div className="font-medium text-indigo-700 mb-1">Conferência — Funil de descartados</div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                <span className="text-muted-foreground">Total em Descarte</span>
                <span className="text-right font-mono">{preview.funil.total_em_descarte}</span>
                <span className="text-muted-foreground">— Inativados (respondeu "não" / definitivo / bloqueado)</span>
                <span className="text-right font-mono text-rose-600">−{preview.funil.inativados_definitivos}</span>
                <span className="text-muted-foreground">— Sem telefone</span>
                <span className="text-right font-mono text-rose-600">−{preview.funil.sem_telefone}</span>
                <span className="text-muted-foreground">— Arquivados {includeArchived ? "(incluídos)" : "(excluídos)"}</span>
                <span className={`text-right font-mono ${includeArchived ? "text-muted-foreground" : "text-rose-600"}`}>
                  {includeArchived ? preview.funil.arquivados : `−${preview.funil.arquivados}`}
                </span>
                {typeof preview.funil.em_cooldown === "number" && preview.funil.em_cooldown > 0 && (
                  <>
                    <span className="text-muted-foreground">— Em cooldown (já receberam disparo nos últimos {preview.funil.cooldown_dias}d)</span>
                    <span className="text-right font-mono text-amber-600">−{preview.funil.em_cooldown}</span>
                  </>
                )}
                <span className="font-medium pt-1 border-t mt-1">= Elegíveis para disparo</span>
                <span className="text-right font-mono font-bold text-indigo-700 pt-1 border-t mt-1">{preview.funil.elegiveis}</span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1 leading-tight">
                💡 Regra: SIM → volta para o pipeline · NÃO → inativa permanentemente · sem resposta → continua elegível no próximo ciclo (respeitando cooldown). Novos descartados entram automaticamente.
              </p>
              {!includeArchived && (preview.funil.arquivados ?? 0) > (preview.funil.elegiveis ?? 0) && (
                <p className="text-[10px] text-amber-600 mt-1">
                  ⚠️ {preview.funil.arquivados} leads arquivados estão sendo excluídos. Marque "Incluir arquivados" para alcançar a base completa.
                </p>
              )}
            </div>
          )}

          {preview?.funil && has("oferta_ativa_lista") && !isCombined && (
            <div className="text-[11px] border rounded p-2 bg-background space-y-1">
              <div className="font-medium text-indigo-700 mb-1">Conferência — Oferta Ativa</div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                <span className="text-muted-foreground">Leads encontrados nas listas</span>
                <span className="text-right font-mono">{preview.funil.total_bruto ?? preview.funil.count_pre_dedup ?? preview.count}</span>
                {typeof preview.funil.duplicados_removidos === "number" && preview.funil.duplicados_removidos > 0 && (
                  <>
                    <span className="text-muted-foreground">— Duplicados/removidos por envio anterior</span>
                    <span className="text-right font-mono text-amber-600">−{preview.funil.duplicados_removidos}</span>
                  </>
                )}
                {typeof preview.funil.telefones_invalidos === "number" && preview.funil.telefones_invalidos > 0 && (
                  <>
                    <span className="text-muted-foreground">— Telefones inválidos</span>
                    <span className="text-right font-mono text-rose-600">−{preview.funil.telefones_invalidos}</span>
                  </>
                )}
                {typeof preview.funil.removidos_pipeline_ativo === "number" && preview.funil.removidos_pipeline_ativo > 0 && (
                  <>
                    <span className="text-muted-foreground">— Já ativos no pipeline</span>
                    <span className="text-right font-mono text-amber-600">−{preview.funil.removidos_pipeline_ativo}</span>
                  </>
                )}
                {typeof preview.funil.removidos_frequencia === "number" && preview.funil.removidos_frequencia > 0 && (
                  <>
                    <span className="text-muted-foreground">— Receberam marketing recente</span>
                    <span className="text-right font-mono text-amber-600">−{preview.funil.removidos_frequencia}</span>
                  </>
                )}
                <span className="font-medium pt-1 border-t mt-1">= Elegíveis para disparo</span>
                <span className="text-right font-mono font-bold text-indigo-700 pt-1 border-t mt-1">{preview.count}</span>
              </div>
            </div>
          )}

          {preview && preview.sample.length > 0 && (
            <div className="text-[11px] text-muted-foreground border rounded p-2 bg-background max-h-32 overflow-y-auto">
              <div className="font-medium mb-1">Amostra (primeiros {preview.sample.length}):</div>
              <ul className="space-y-0.5">
                {preview.sample.map((l: { id: string; nome: string; telefone: string | null }) => (
                  <li key={l.id}>• {l.nome} — {l.telefone || "(sem telefone)"}</li>
                ))}
              </ul>
            </div>
          )}

          <Button
            className="w-full h-11 text-base"
            size="lg"
            onClick={disparar}
            disabled={firing || !preview || preview.count === 0}
          >
            {firing ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Send className="h-4 w-4 mr-1.5" />}
            {preview ? `2. Disparar para ${preview.count.toLocaleString("pt-BR")} leads` : "2. Disparar (calcule o público primeiro)"}
          </Button>

        </div>
      </CardContent>
    </Card>
  );
}
