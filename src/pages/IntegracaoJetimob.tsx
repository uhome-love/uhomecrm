import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle2, AlertTriangle, RefreshCw, Database, Building2, Users, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";

// ── Field mapping definitions ──

interface FieldMapping {
  jetimobField: string;
  jetimobDescription: string;
  uhomeField: string;
  uhomeTable: string;
  transform?: string;
  status: "ok" | "warning" | "missing";
  notes?: string;
}

const LEAD_FIELD_MAPPINGS: FieldMapping[] = [
  { jetimobField: "full_name / name / nome", jetimobDescription: "Nome completo do lead", uhomeField: "nome", uhomeTable: "pipeline_leads", status: "ok" },
  { jetimobField: "phones[0]", jetimobDescription: "Telefone principal", uhomeField: "telefone", uhomeTable: "pipeline_leads", status: "ok" },
  { jetimobField: "phones[1]", jetimobDescription: "Telefone secundário", uhomeField: "telefone2", uhomeTable: "pipeline_leads", status: "ok" },
  { jetimobField: "emails[0]", jetimobDescription: "E-mail principal", uhomeField: "email", uhomeTable: "pipeline_leads", status: "ok" },
  { jetimobField: "message", jetimobDescription: "Mensagem do formulário", uhomeField: "observacoes", uhomeTable: "pipeline_leads", status: "ok", transform: "Texto livre; usado para extrair campanha" },
  { jetimobField: "message (parsed)", jetimobDescription: "Nome do formulário dentro da mensagem", uhomeField: "empreendimento", uhomeTable: "pipeline_leads", status: "ok", transform: "extractCampanha() → normalizeEmpreendimento()" },
  { jetimobField: "message (parsed)", jetimobDescription: "Nome da campanha completa", uhomeField: "origem_detalhe", uhomeTable: "pipeline_leads", status: "ok", transform: "extractCampanha() direto" },
  { jetimobField: "source / origin / message", jetimobDescription: "Canal de origem", uhomeField: "origem", uhomeTable: "pipeline_leads", status: "ok", transform: "detectCanal() → Meta Ads / TikTok / Google / Portal / Site / Outro" },
  { jetimobField: "created_at", jetimobDescription: "Data de criação no Jetimob", uhomeField: "created_at", uhomeTable: "pipeline_leads", status: "ok", notes: "Filtro CUTOFF: apenas >= 2026-03-07" },
  { jetimobField: "campaign_id", jetimobDescription: "ID da campanha no Jetimob", uhomeField: "(usado no jetimob_lead_id)", uhomeTable: "pipeline_leads", status: "ok", transform: "Parte do buildJetimobId()" },
  { jetimobField: "broker_id / responsavel_id", jetimobDescription: "Responsável no Jetimob", uhomeField: "(não mapeado)", uhomeTable: "—", status: "warning", notes: "Usado apenas para filtro manual; a distribuição é feita pela roleta" },
  { jetimobField: "cpf", jetimobDescription: "CPF do lead", uhomeField: "(não mapeado)", uhomeTable: "—", status: "missing", notes: "Campo disponível na API mas não coletado" },
  { jetimobField: "address", jetimobDescription: "Endereço do lead", uhomeField: "(não mapeado)", uhomeTable: "—", status: "missing", notes: "Campo disponível mas não coletado" },
  { jetimobField: "gender", jetimobDescription: "Gênero", uhomeField: "(não mapeado)", uhomeTable: "—", status: "missing", notes: "Campo disponível mas não coletado" },
  { jetimobField: "birthday", jetimobDescription: "Data de nascimento", uhomeField: "(não mapeado)", uhomeTable: "—", status: "missing", notes: "Campo disponível mas não coletado" },
];

const IMOVEL_FIELD_MAPPINGS: FieldMapping[] = [
  { jetimobField: "codigo / referencia", jetimobDescription: "Código de referência do imóvel", uhomeField: "codigo (busca)", uhomeTable: "jetimob-proxy", status: "ok", transform: "isCodigoMatch() — normaliza e compara" },
  { jetimobField: "titulo / nome", jetimobDescription: "Título do imóvel", uhomeField: "titulo (exibição)", uhomeTable: "jetimob-proxy", status: "ok" },
  { jetimobField: "valor_venda / preco_venda", jetimobDescription: "Valor de venda", uhomeField: "valor (exibição)", uhomeTable: "jetimob-proxy", status: "ok", transform: "getPrice() — fallback para locação" },
  { jetimobField: "valor_locacao / preco_locacao", jetimobDescription: "Valor de locação", uhomeField: "valor (fallback)", uhomeTable: "jetimob-proxy", status: "ok" },
  { jetimobField: "dormitorios / quartos / suites", jetimobDescription: "Número de dormitórios", uhomeField: "dormitorios (filtro)", uhomeTable: "jetimob-proxy", status: "ok", transform: "getDorms()" },
  { jetimobField: "endereco_bairro / bairro", jetimobDescription: "Bairro do imóvel", uhomeField: "bairro (filtro)", uhomeTable: "jetimob-proxy", status: "ok", transform: "getBairro()" },
  { jetimobField: "subtipo / tipo_imovel / tipo", jetimobDescription: "Tipo do imóvel", uhomeField: "tipo (filtro)", uhomeTable: "jetimob-proxy", status: "ok", transform: "getTipo() — prefere subtipo" },
  { jetimobField: "fotos[] / imagens[]", jetimobDescription: "Galeria de fotos", uhomeField: "imagens (exibição)", uhomeTable: "jetimob-proxy", status: "ok", transform: "normalizeImages() — 9 campos + 10 sub-props" },
  { jetimobField: "area_total / area_privativa", jetimobDescription: "Metragem", uhomeField: "area (exibição)", uhomeTable: "jetimob-proxy", status: "ok" },
  { jetimobField: "descricao", jetimobDescription: "Descrição completa", uhomeField: "descricao (exibição)", uhomeTable: "jetimob-proxy", status: "ok" },
  { jetimobField: "situacao / status", jetimobDescription: "Situação do imóvel", uhomeField: "status (filtro)", uhomeTable: "jetimob-proxy", status: "ok" },
  { jetimobField: "plantas[]", jetimobDescription: "Plantas do imóvel", uhomeField: "(não mapeado)", uhomeTable: "—", status: "missing", notes: "Campo disponível mas não exibido na UI" },
  { jetimobField: "videos[]", jetimobDescription: "Vídeos do imóvel", uhomeField: "(não mapeado)", uhomeTable: "—", status: "missing", notes: "Campo disponível mas não exibido na UI" },
  { jetimobField: "caracteristicas[]", jetimobDescription: "Características (piscina, churrasqueira...)", uhomeField: "(não mapeado)", uhomeTable: "—", status: "missing", notes: "Campo disponível mas não filtrado" },
];

const EMPREENDIMENTO_MAPPINGS: { jetimobName: string; uhomeName: string; segmento: string; status: "ok" | "warning" }[] = [
  { jetimobName: "Casa Tua", uhomeName: "Casa Tua", segmento: "Altíssimo", status: "ok" },
  { jetimobName: "Orygem", uhomeName: "Orygem", segmento: "Médio-Alto", status: "ok" },
  { jetimobName: "Lake Eyre", uhomeName: "Lake Eyre", segmento: "Altíssimo", status: "ok" },
  { jetimobName: "Open Bosque", uhomeName: "Open Bosque", segmento: "Médio-Alto", status: "ok" },
  { jetimobName: "Casa Bastian", uhomeName: "Casa Bastian", segmento: "Altíssimo", status: "ok" },
  { jetimobName: "Shift", uhomeName: "Shift", segmento: "Médio-Alto", status: "ok" },
  { jetimobName: "Seen Menino Deus", uhomeName: "Seen Menino Deus", segmento: "Médio-Alto", status: "ok" },
  { jetimobName: "Botanique", uhomeName: "Botanique", segmento: "Altíssimo", status: "ok" },
  { jetimobName: "Me Day", uhomeName: "Me Day", segmento: "MCMV", status: "ok" },
  { jetimobName: "Melnick Day", uhomeName: "Melnick Day", segmento: "MCMV", status: "ok" },
  { jetimobName: "Go Carlos Bosque", uhomeName: "Go Carlos Bosque", segmento: "Médio-Alto", status: "ok" },
  { jetimobName: "Go Carlos Gomes", uhomeName: "Go Carlos Gomes", segmento: "Médio-Alto", status: "ok" },
  { jetimobName: "Vista Menino Deus", uhomeName: "Vista Menino Deus", segmento: "Médio-Alto", status: "ok" },
  { jetimobName: "Nilo Square", uhomeName: "Nilo Square", segmento: "Médio-Alto", status: "ok" },
  { jetimobName: "High Garden Iguatemi", uhomeName: "High Garden Iguatemi", segmento: "Altíssimo", status: "ok" },
  { jetimobName: "High Garden Rio Branco", uhomeName: "High Garden Rio Branco", segmento: "Altíssimo", status: "ok" },
  { jetimobName: "Las Casas (Vértice)", uhomeName: "Las Casas", segmento: "Altíssimo", status: "ok" },
  { jetimobName: "Essenza Club", uhomeName: "Essenza Club", segmento: "Médio-Alto", status: "ok" },
  { jetimobName: "Prime Wish", uhomeName: "Prime Wish", segmento: "Altíssimo", status: "ok" },
  { jetimobName: "Alto Lindóia", uhomeName: "Alto Lindóia", segmento: "MCMV", status: "ok" },
  { jetimobName: "San Andreas", uhomeName: "San Andreas", segmento: "Médio-Alto", status: "ok" },
  { jetimobName: "Supreme", uhomeName: "Supreme", segmento: "Altíssimo", status: "ok" },
  { jetimobName: "Boa Vista Country Club", uhomeName: "Boa Vista Country Club", segmento: "Altíssimo", status: "ok" },
  { jetimobName: "Pontal", uhomeName: "Pontal", segmento: "Médio-Alto", status: "ok" },
  { jetimobName: "Alfa", uhomeName: "Alfa", segmento: "Médio-Alto", status: "ok" },
  { jetimobName: "Avulso Canoas", uhomeName: "Avulso Canoas", segmento: "MCMV", status: "ok" },
];

function StatusIcon({ status }: { status: "ok" | "warning" | "missing" }) {
  if (status === "ok") return <CheckCircle2 className="h-4 w-4 text-green-500" />;
  if (status === "warning") return <AlertTriangle className="h-4 w-4 text-amber-500" />;
  return <AlertTriangle className="h-4 w-4 text-destructive" />;
}

function StatusBadge({ status }: { status: "ok" | "warning" | "missing" }) {
  const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    ok: "default",
    warning: "secondary",
    missing: "destructive",
  };
  const labels: Record<string, string> = { ok: "Mapeado", warning: "Parcial", missing: "Não mapeado" };
  return <Badge variant={variants[status]}>{labels[status]}</Badge>;
}

function FieldMappingTable({ mappings, title }: { mappings: FieldMapping[]; title: string }) {
  const okCount = mappings.filter(m => m.status === "ok").length;
  const warnCount = mappings.filter(m => m.status === "warning").length;
  const missCount = mappings.filter(m => m.status === "missing").length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{title}</CardTitle>
          <div className="flex gap-2 text-xs">
            <Badge variant="default" className="bg-green-600">{okCount} mapeados</Badge>
            {warnCount > 0 && <Badge variant="secondary">{warnCount} parciais</Badge>}
            {missCount > 0 && <Badge variant="destructive">{missCount} pendentes</Badge>}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Campo Jetimob</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground w-8"><ArrowRight className="h-3.5 w-3.5" /></th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Campo uHome</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Tabela</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Transformação</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Notas</th>
              </tr>
            </thead>
            <tbody>
              {mappings.map((m, i) => (
                <tr key={i} className={`border-b last:border-0 ${m.status === "missing" ? "bg-destructive/5" : m.status === "warning" ? "bg-amber-500/5" : ""}`}>
                  <td className="px-4 py-2.5"><StatusIcon status={m.status} /></td>
                  <td className="px-4 py-2.5">
                    <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{m.jetimobField}</span>
                    <p className="text-xs text-muted-foreground mt-0.5">{m.jetimobDescription}</p>
                  </td>
                  <td className="px-4 py-2.5"><ArrowRight className="h-3.5 w-3.5 text-muted-foreground" /></td>
                  <td className="px-4 py-2.5">
                    <span className={`font-mono text-xs px-1.5 py-0.5 rounded ${m.status === "missing" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>
                      {m.uhomeField}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">{m.uhomeTable}</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground max-w-[200px] truncate">{m.transform || "—"}</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground max-w-[180px]">{m.notes || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

export default function IntegracaoJetimob() {
  const [syncing, setSyncing] = useState(false);

  // Live stats
  const { data: stats } = useQuery({
    queryKey: ["integracao-stats"],
    queryFn: async () => {
      const [leadsRes, processedRes, campanhasRes] = await Promise.all([
        supabase.from("pipeline_leads").select("id", { count: "exact", head: true }).not("jetimob_lead_id", "is", null),
        supabase.from("jetimob_processed").select("jetimob_lead_id", { count: "exact", head: true }),
        supabase.from("roleta_campanhas").select("id", { count: "exact", head: true }).eq("ativo", true),
      ]);
      return {
        leadsAtivos: leadsRes.count ?? 0,
        leadsProcessados: processedRes.count ?? 0,
        campanhasAtivas: campanhasRes.count ?? 0,
      };
    },
    staleTime: 30_000,
  });

  const handleManualSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("jetimob-sync", { body: {} });
      if (error) throw error;
      toast.success(`Sync concluído: ${data?.synced ?? 0} novos, ${data?.skipped ?? 0} ignorados`);
    } catch (err: any) {
      toast.error("Erro no sync: " + (err.message || "desconhecido"));
    } finally {
      setSyncing(false);
    }
  };

  const leadOk = LEAD_FIELD_MAPPINGS.filter(m => m.status === "ok").length;
  const leadTotal = LEAD_FIELD_MAPPINGS.length;
  const imovelOk = IMOVEL_FIELD_MAPPINGS.filter(m => m.status === "ok").length;
  const imovelTotal = IMOVEL_FIELD_MAPPINGS.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
            <Zap className="h-6 w-6 text-primary" />
            Integração Jetimob ↔ uHome Sales
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Mapeamento completo de campos entre o Jetimob e o sistema uHome Sales
          </p>
        </div>
        <Button onClick={handleManualSync} disabled={syncing} variant="outline" className="gap-2">
          <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Sincronizando..." : "Sync Manual"}
        </Button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5 pb-4 flex items-center gap-4">
            <div className="rounded-lg bg-primary/10 p-2.5"><Users className="h-5 w-5 text-primary" /></div>
            <div>
              <p className="text-2xl font-bold">{stats?.leadsAtivos ?? "—"}</p>
              <p className="text-xs text-muted-foreground">Leads Jetimob ativos</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4 flex items-center gap-4">
            <div className="rounded-lg bg-green-500/10 p-2.5"><Database className="h-5 w-5 text-green-600" /></div>
            <div>
              <p className="text-2xl font-bold">{stats?.leadsProcessados ?? "—"}</p>
              <p className="text-xs text-muted-foreground">Leads processados (dedup)</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4 flex items-center gap-4">
            <div className="rounded-lg bg-amber-500/10 p-2.5"><Building2 className="h-5 w-5 text-amber-600" /></div>
            <div>
              <p className="text-2xl font-bold">{stats?.campanhasAtivas ?? "—"}</p>
              <p className="text-xs text-muted-foreground">Campanhas / Empreendimentos</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="leads" className="space-y-4">
        <TabsList>
          <TabsTrigger value="leads" className="gap-1.5"><Users className="h-3.5 w-3.5" /> Leads ({leadOk}/{leadTotal})</TabsTrigger>
          <TabsTrigger value="imoveis" className="gap-1.5"><Building2 className="h-3.5 w-3.5" /> Imóveis ({imovelOk}/{imovelTotal})</TabsTrigger>
          <TabsTrigger value="empreendimentos" className="gap-1.5"><Zap className="h-3.5 w-3.5" /> Empreendimentos ({EMPREENDIMENTO_MAPPINGS.length})</TabsTrigger>
          <TabsTrigger value="dedup" className="gap-1.5"><Database className="h-3.5 w-3.5" /> Deduplicação</TabsTrigger>
        </TabsList>

        <TabsContent value="leads">
          <FieldMappingTable mappings={LEAD_FIELD_MAPPINGS} title="Mapeamento de Leads — Jetimob → pipeline_leads" />
        </TabsContent>

        <TabsContent value="imoveis">
          <FieldMappingTable mappings={IMOVEL_FIELD_MAPPINGS} title="Mapeamento de Imóveis — Jetimob API → jetimob-proxy" />
        </TabsContent>

        <TabsContent value="empreendimentos">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Normalização de Empreendimentos</CardTitle>
              <CardDescription>Como nomes de campanha do Jetimob são traduzidos para empreendimentos no uHome</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Nome Jetimob</th>
                      <th className="px-4 py-2.5 text-left font-medium text-muted-foreground w-8"><ArrowRight className="h-3.5 w-3.5" /></th>
                      <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Nome uHome</th>
                      <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Segmento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {EMPREENDIMENTO_MAPPINGS.map((e, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="px-4 py-2.5 font-mono text-xs">{e.jetimobName}</td>
                        <td className="px-4 py-2.5"><ArrowRight className="h-3.5 w-3.5 text-muted-foreground" /></td>
                        <td className="px-4 py-2.5 font-medium">{e.uhomeName}</td>
                        <td className="px-4 py-2.5">
                          <Badge variant={e.segmento === "MCMV" ? "default" : e.segmento === "Altíssimo" ? "secondary" : "outline"}>
                            {e.segmento}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dedup">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Sistema de Deduplicação</CardTitle>
              <CardDescription>Como o uHome evita leads duplicados vindos do Jetimob</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-lg border p-4 space-y-2">
                  <h4 className="font-semibold text-sm flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-500" /> Camada 1 — jetimob_lead_id</h4>
                  <p className="text-xs text-muted-foreground">
                    ID composto: <code className="bg-muted px-1 rounded">phone_campaignId_createdAt</code>. Mesmo formulário + mesmo lead = skip silencioso.
                  </p>
                </div>
                <div className="rounded-lg border p-4 space-y-2">
                  <h4 className="font-semibold text-sm flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-500" /> Camada 2 — Telefone</h4>
                  <p className="text-xs text-muted-foreground">
                    Mesmo telefone, novo formulário = lead reativado. Notifica o corretor dono e cria tarefa SLA 2h. Não entra na roleta novamente.
                  </p>
                </div>
                <div className="rounded-lg border p-4 space-y-2">
                  <h4 className="font-semibold text-sm flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-500" /> Camada 3 — jetimob_processed</h4>
                  <p className="text-xs text-muted-foreground">
                    Tabela permanente que registra todos os jetimob_lead_id + telefone já processados. Protege contra reentrada mesmo após exclusão de leads.
                  </p>
                </div>
                <div className="rounded-lg border p-4 space-y-2">
                  <h4 className="font-semibold text-sm flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-500" /> Camada 4 — CUTOFF date</h4>
                  <p className="text-xs text-muted-foreground">
                    Apenas leads criados a partir de <code className="bg-muted px-1 rounded">2026-03-07</code> são importados. Impede histórico antigo de invadir o pipeline.
                  </p>
                </div>
              </div>

              <div className="rounded-lg bg-muted/50 border p-4 mt-4">
                <h4 className="font-semibold text-sm mb-2">Fluxo de Processamento</h4>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Badge variant="outline">API Jetimob</Badge>
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  <Badge variant="outline">Filtro Cutoff</Badge>
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  <Badge variant="outline">Dedup (ID + Phone + Processed)</Badge>
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  <Badge variant="outline">extractCampanha()</Badge>
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  <Badge variant="outline">normalizeEmpreendimento()</Badge>
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  <Badge variant="outline">resolveSegmentoId()</Badge>
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  <Badge variant="outline">INSERT pipeline_leads</Badge>
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  <Badge variant="default">distribute-lead</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
