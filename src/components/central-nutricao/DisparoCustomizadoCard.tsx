import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Send, Search, Target } from "lucide-react";
import { toast } from "sonner";

type Source = "descartados" | "pipeline_ativo" | "oferta_ativa_lista";
type DedupMode = "exclude_sent" | "include_all" | "only_sent_before";

export default function DisparoCustomizadoCard({ onFired }: { onFired?: () => void }) {
  const [source, setSource] = useState<Source>("descartados");
  const [tipoDescarte, setTipoDescarte] = useState<"reengajavel" | "definitivo" | "todos">("reengajavel");
  const [stageIds, setStageIds] = useState<string[]>([]);
  const [listaId, setListaId] = useState<string>("");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [empreendimento, setEmpreendimento] = useState<string>("");
  const [dedupMode, setDedupMode] = useState<DedupMode>("exclude_sent");
  const [dedupCutoff, setDedupCutoff] = useState<string>("");
  const [limit, setLimit] = useState<number>(100);
  const [preview, setPreview] = useState<{ count: number; sample: any[] } | null>(null);
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

  function buildAudience() {
    const periodo = (from || to) ? {
      from: from ? new Date(from + "T00:00:00-03:00").toISOString() : undefined,
      to: to ? new Date(to + "T23:59:59-03:00").toISOString() : undefined,
    } : undefined;
    const base: any = { source, periodo, empreendimento: empreendimento || undefined, dedup_mode: dedupMode, limit };
    if (dedupMode === "only_sent_before" && dedupCutoff) {
      base.dedup_cutoff = new Date(dedupCutoff + "T00:00:00-03:00").toISOString();
    }
    if (source === "descartados") base.tipo_descarte = tipoDescarte;
    if (source === "pipeline_ativo") base.stage_ids = stageIds;
    if (source === "oferta_ativa_lista") base.lista_id = listaId;
    return base;
  }

  async function doPreview() {
    if (source === "pipeline_ativo" && stageIds.length === 0) {
      toast.error("Selecione ao menos uma etapa do pipeline");
      return;
    }
    if (source === "oferta_ativa_lista" && !listaId) {
      toast.error("Selecione uma lista da Oferta Ativa");
      return;
    }
    setPreviewing(true);
    setPreview(null);
    try {
      const { data, error } = await supabase.functions.invoke("reengajamento-audience-preview", {
        body: { audience: buildAudience() },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setPreview({ count: (data as any).count || 0, sample: (data as any).sample || [] });
    } catch (e: any) {
      toast.error("Erro no preview: " + e.message);
    } finally {
      setPreviewing(false);
    }
  }

  async function disparar() {
    if (!preview || preview.count === 0) {
      toast.error("Faça o preview primeiro e confirme que há leads elegíveis");
      return;
    }
    if (!confirm(`Disparar para ${preview.count} leads? Esta ação envia mensagens reais via WhatsApp.`)) return;
    setFiring(true);
    try {
      supabase.functions.invoke("reengajamento-descartados-enqueue", {
        body: { force: true, iniciado_por: "manual_custom", audience: buildAudience() },
      }).then(({ data, error }) => {
        if (error) toast.error("Erro: " + error.message);
        else if ((data as any)?.reason === "no_leads") toast.info("Nenhum lead elegível");
        onFired?.();
      });
      toast.success(`🚀 Disparo iniciado para ${preview.count} leads`);
      setPreview(null);
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    } finally {
      setFiring(false);
    }
  }

  function toggleStage(id: string) {
    setStageIds((prev) => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
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
          <Target className="h-4 w-4 text-indigo-600" /> Disparo customizado por público
          <Badge variant="outline" className="text-[10px] ml-auto">Novo</Badge>
        </CardTitle>
        <p className="text-[11px] text-muted-foreground">
          Escolha o público, filtre por período/empreendimento e dispare reengajamento sob demanda.
          Usa o mesmo canal (Meta/Evolution), mensagens e regras de horário configurados acima.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Público */}
        <div>
          <Label className="text-xs">Público</Label>
          <Select value={source} onValueChange={(v) => { setSource(v as Source); setPreview(null); }}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="descartados">Descartados (padrão)</SelectItem>
              <SelectItem value="pipeline_ativo">Pipeline ativo (etapas específicas)</SelectItem>
              <SelectItem value="oferta_ativa_lista">Lista da Oferta Ativa</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Campos dinâmicos por source */}
        {source === "descartados" && (
          <div>
            <Label className="text-xs">Tipo de descarte</Label>
            <Select value={tipoDescarte} onValueChange={(v) => setTipoDescarte(v as any)}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="reengajavel">Reengajáveis</SelectItem>
                <SelectItem value="definitivo">Definitivos</SelectItem>
                <SelectItem value="todos">Todos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {source === "pipeline_ativo" && (
          <div>
            <Label className="text-xs">Etapas do pipeline ({stageIds.length} selecionada{stageIds.length !== 1 ? "s" : ""})</Label>
            <div className="flex flex-wrap gap-1 mt-1 p-2 border rounded-md max-h-40 overflow-y-auto bg-background">
              {stages.filter((s: any) => !["Descarte", "Negócio Criado", "Venda"].includes(s.nome)).map((s: any) => (
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

        {source === "oferta_ativa_lista" && (
          <div>
            <Label className="text-xs">Lista</Label>
            <Select value={listaId} onValueChange={setListaId}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Selecione…" /></SelectTrigger>
              <SelectContent>
                {listas.map((l: any) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.nome} — {l.empreendimento} ({l.total_leads || 0})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Período */}
        <div>
          <Label className="text-xs">Período (opcional)</Label>
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9" />
            </div>
            <div className="flex-1">
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9" />
            </div>
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

        {/* Dedup */}
        <div>
          <Label className="text-xs">Já receberam disparo</Label>
          <Select value={dedupMode} onValueChange={(v) => setDedupMode(v as DedupMode)}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="exclude_sent">Excluir quem já recebeu</SelectItem>
              <SelectItem value="include_all">Incluir todos (mesmo quem já recebeu)</SelectItem>
              <SelectItem value="only_sent_before">Só quem recebeu antes de…</SelectItem>
            </SelectContent>
          </Select>
          {dedupMode === "only_sent_before" && (
            <Input type="date" value={dedupCutoff} onChange={(e) => setDedupCutoff(e.target.value)} className="h-9 mt-2" />
          )}
        </div>

        {/* Limite */}
        <div>
          <Label className="text-xs">Limite máximo de envios</Label>
          <Input type="number" value={limit} min={1} max={1000} onChange={(e) => setLimit(Number(e.target.value))} className="h-9" />
        </div>

        {/* Preview + ação */}
        <div className="border-t pt-3 space-y-2">
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={doPreview} disabled={previewing}>
              {previewing ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Search className="h-3.5 w-3.5 mr-1" />}
              Calcular público
            </Button>
            {preview && (
              <span className="text-sm">
                <strong className="text-indigo-700">{preview.count}</strong> leads elegíveis
              </span>
            )}
          </div>

          {preview && preview.sample.length > 0 && (
            <div className="text-[11px] text-muted-foreground border rounded p-2 bg-background max-h-32 overflow-y-auto">
              <div className="font-medium mb-1">Amostra (primeiros {preview.sample.length}):</div>
              <ul className="space-y-0.5">
                {preview.sample.map((l: any) => (
                  <li key={l.id}>• {l.nome} — {l.telefone || "(sem telefone)"}</li>
                ))}
              </ul>
            </div>
          )}

          <Button
            className="w-full"
            onClick={disparar}
            disabled={firing || !preview || preview.count === 0}
          >
            {firing ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Send className="h-3.5 w-3.5 mr-1" />}
            {preview ? `Disparar para ${preview.count} leads` : "Faça o preview primeiro"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
