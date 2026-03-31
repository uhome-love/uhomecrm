import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import {
  Phone, Play, Pause, BarChart3, Plus, Loader2,
  CheckCircle2, XCircle, Clock, PhoneOff, PhoneCall,
  Users, TrendingUp, AlertCircle, Volume2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

const TEMPLATES = [
  { value: "reativacao", label: "Reativação", desc: "Reativar leads frios com novidades" },
  { value: "novidades", label: "Novidades / Campanha", desc: "Divulgar campanha ou empreendimento" },
  { value: "confirmacao_interesse", label: "Confirmação de Interesse", desc: "Confirmar interesse de leads mornos" },
  { value: "convite_visita", label: "Convite para Visita", desc: "Convidar para visita presencial" },
];

const STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
  agendada: { label: "Agendada", color: "bg-blue-100 text-blue-800", icon: Clock },
  em_andamento: { label: "Em Andamento", color: "bg-amber-100 text-amber-800", icon: PhoneCall },
  concluida: { label: "Concluída", color: "bg-green-100 text-green-800", icon: CheckCircle2 },
  pausada: { label: "Pausada", color: "bg-muted text-muted-foreground", icon: Pause },
};

export default function CampanhasVozPage() {
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [callLogs, setCallLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  // Create form
  const [template, setTemplate] = useState("reativacao");
  const [stageFiltro, setStageFiltro] = useState("descartado");
  const [limit, setLimit] = useState("50");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const [campRes, logsRes] = await Promise.all([
      supabase.from("voice_campaigns").select("*").order("created_at", { ascending: false }).limit(20),
      supabase.from("voice_call_logs").select("*, pipeline_leads(nome)").order("created_at", { ascending: false }).limit(100),
    ]);
    setCampaigns(campRes.data || []);
    setCallLogs(logsRes.data || []);
    setLoading(false);
  }

  async function handleCreateCampaign() {
    if (!user) return;
    setCreating(true);

    // Fetch leads matching filter
    const { data: leads, error: leadsErr } = await supabase
      .from("pipeline_leads")
      .select("id")
      .eq("stage_tipo", stageFiltro)
      .not("telefone", "is", null)
      .limit(parseInt(limit));

    if (leadsErr || !leads?.length) {
      toast.error("Nenhum lead encontrado com os filtros selecionados");
      setCreating(false);
      return;
    }

    const { data, error } = await supabase.functions.invoke("voice-campaign-launcher", {
      body: {
        template,
        lead_ids: leads.map((l) => l.id),
        criado_por: user.id,
        nome: `${TEMPLATES.find((t) => t.value === template)?.label} — ${new Date().toLocaleDateString("pt-BR")}`,
      },
    });

    setCreating(false);
    if (error) {
      toast.error("Erro ao criar campanha: " + (error.message || "Erro desconhecido"));
      return;
    }
    toast.success(`Campanha criada! ${data?.processed || 0} ligações iniciadas.`);
    loadData();
  }

  // Aggregate stats
  const totalCampaigns = campaigns.length;
  const totalCalls = callLogs.length;
  const atendidas = callLogs.filter((l) => l.status === "atendida").length;
  const interessados = callLogs.filter((l) => l.resultado === "interessado").length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 max-w-6xl mx-auto">
      <div className="flex items-center gap-3">
        <Volume2 className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-xl font-bold">Campanhas de Voz IA</h1>
          <p className="text-xs text-muted-foreground">Ligações automáticas com IA — HOMI</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-3 text-center">
          <Phone className="h-5 w-5 mx-auto text-primary mb-1" />
          <p className="text-2xl font-bold">{totalCampaigns}</p>
          <p className="text-[10px] text-muted-foreground">Campanhas</p>
        </Card>
        <Card className="p-3 text-center">
          <PhoneCall className="h-5 w-5 mx-auto text-blue-500 mb-1" />
          <p className="text-2xl font-bold">{totalCalls}</p>
          <p className="text-[10px] text-muted-foreground">Ligações</p>
        </Card>
        <Card className="p-3 text-center">
          <CheckCircle2 className="h-5 w-5 mx-auto text-green-500 mb-1" />
          <p className="text-2xl font-bold">{atendidas}</p>
          <p className="text-[10px] text-muted-foreground">Atendidas</p>
        </Card>
        <Card className="p-3 text-center">
          <TrendingUp className="h-5 w-5 mx-auto text-amber-500 mb-1" />
          <p className="text-2xl font-bold">{interessados}</p>
          <p className="text-[10px] text-muted-foreground">Interessados</p>
        </Card>
      </div>

      <Tabs defaultValue="criar">
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="criar" className="text-xs">
            <Plus className="h-3 w-3 mr-1" /> Criar
          </TabsTrigger>
          <TabsTrigger value="ativas" className="text-xs">
            <Play className="h-3 w-3 mr-1" /> Campanhas
          </TabsTrigger>
          <TabsTrigger value="historico" className="text-xs">
            <BarChart3 className="h-3 w-3 mr-1" /> Histórico
          </TabsTrigger>
        </TabsList>

        {/* ── Criar Campanha ── */}
        <TabsContent value="criar">
          <Card className="p-4 space-y-4">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <Plus className="h-4 w-4" /> Nova Campanha de Voz
            </h3>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium mb-1 block">Template</label>
                <Select value={template} onValueChange={setTemplate}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TEMPLATES.map((t) => (
                      <SelectItem key={t.value} value={t.value} className="text-xs">
                        {t.label} — {t.desc}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-medium mb-1 block">Filtro de Leads</label>
                <Select value={stageFiltro} onValueChange={setStageFiltro}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="descartado" className="text-xs">Descartados</SelectItem>
                    <SelectItem value="sem_contato" className="text-xs">Sem Contato</SelectItem>
                    <SelectItem value="qualificacao" className="text-xs">Qualificação</SelectItem>
                    <SelectItem value="contato_iniciado" className="text-xs">Contato Iniciado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-medium mb-1 block">Máximo de Leads</label>
                <Input
                  type="number"
                  value={limit}
                  onChange={(e) => setLimit(e.target.value)}
                  className="h-9 text-xs"
                  min="1"
                  max="50"
                />
              </div>

              <div className="flex items-center gap-2 p-2 bg-amber-50 dark:bg-amber-950 rounded text-xs text-amber-700 dark:text-amber-400">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>Ligações só serão feitas entre 9h e 20h BRT (seg-sex). Máx 50 por campanha.</span>
              </div>

              <Button
                className="w-full gap-2"
                onClick={handleCreateCampaign}
                disabled={creating}
              >
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <PhoneCall className="h-4 w-4" />}
                Iniciar Campanha
              </Button>
            </div>
          </Card>
        </TabsContent>

        {/* ── Campanhas Ativas ── */}
        <TabsContent value="ativas">
          <ScrollArea className="h-[500px]">
            <div className="space-y-3">
              {campaigns.filter((c) => ["agendada", "em_andamento"].includes(c.status)).length === 0 && (
                <p className="text-center text-xs text-muted-foreground py-8">Nenhuma campanha ativa</p>
              )}
              {campaigns
                .filter((c) => ["agendada", "em_andamento"].includes(c.status))
                .map((c) => {
                  const info = STATUS_MAP[c.status] || STATUS_MAP.agendada;
                  const Icon = info.icon;
                  const progress = c.total ? Math.round(((c.atendidas + c.nao_atendidas + c.sem_interesse + c.pediu_remocao) / c.total) * 100) : 0;

                  return (
                    <Card key={c.id} className="p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          <span className="text-sm font-semibold">{c.nome}</span>
                        </div>
                        <Badge className={`text-[10px] ${info.color}`}>{info.label}</Badge>
                      </div>

                      <div className="w-full bg-muted rounded-full h-2">
                        <div className="bg-primary rounded-full h-2 transition-all" style={{ width: `${progress}%` }} />
                      </div>

                      <div className="grid grid-cols-4 gap-2 text-center text-[10px]">
                        <div><p className="font-bold text-sm">{c.total}</p>Total</div>
                        <div><p className="font-bold text-sm text-green-600">{c.atendidas}</p>Atendidas</div>
                        <div><p className="font-bold text-sm text-amber-600">{c.interessados}</p>Interessados</div>
                        <div><p className="font-bold text-sm text-red-600">{c.nao_atendidas}</p>Não Atendeu</div>
                      </div>
                    </Card>
                  );
                })}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* ── Histórico ── */}
        <TabsContent value="historico">
          <ScrollArea className="h-[500px]">
            <div className="space-y-2">
              {campaigns.filter((c) => c.status === "concluida").length === 0 && (
                <p className="text-center text-xs text-muted-foreground py-8">Nenhuma campanha concluída</p>
              )}
              {campaigns
                .filter((c) => c.status === "concluida")
                .map((c) => {
                  const taxaAtendimento = c.total ? Math.round((c.atendidas / c.total) * 100) : 0;
                  const taxaInteresse = c.atendidas ? Math.round((c.interessados / c.atendidas) * 100) : 0;

                  return (
                    <Card key={c.id} className="p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold">{c.nome}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {c.completed_at ? formatDistanceToNow(new Date(c.completed_at), { addSuffix: true, locale: ptBR }) : ""}
                        </span>
                      </div>
                      <div className="grid grid-cols-5 gap-1 text-center text-[10px]">
                        <div><p className="font-bold">{c.total}</p>Total</div>
                        <div><p className="font-bold text-green-600">{c.atendidas}</p>Atend.</div>
                        <div><p className="font-bold text-amber-600">{c.interessados}</p>Interes.</div>
                        <div><p className="font-bold">{taxaAtendimento}%</p>Taxa At.</div>
                        <div><p className="font-bold">{taxaInteresse}%</p>Conversão</div>
                      </div>
                    </Card>
                  );
                })}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
