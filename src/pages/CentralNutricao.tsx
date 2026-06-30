import { useState, useEffect, lazy, Suspense } from "react";
import { useSearchParams } from "react-router-dom";
import { RefreshCw, Send, Activity, Settings, Calendar, ChevronDown, ChevronUp, Radio, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQueryClient } from "@tanstack/react-query";
import DisparoCustomizadoCard from "@/components/central-nutricao/DisparoCustomizadoCard";
import ReengajamentoTab from "@/components/central-nutricao/ReengajamentoTab";
import AuditoriaWebhookTab from "@/components/central-nutricao/AuditoriaWebhookTab";
import VisitaAmanhaTab from "@/components/central-nutricao/VisitaAmanhaTab";
import LiveDispatchBanner from "@/components/central-nutricao/LiveDispatchBanner";
import { PageHeader } from "@/components/ui/PageHeader";

const CampanhaOndasTab = lazy(() => import("@/components/central-nutricao/CampanhaOndasTab"));

export default function CentralNutricaoPage() {
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") || "disparo";
  const [tab, setTab] = useState(initialTab);

  useEffect(() => {
    const t = searchParams.get("tab");
    if (t && t !== tab) setTab(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleTabChange = (v: string) => {
    setTab(v);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (v === "disparo") next.delete("tab");
      else next.set("tab", v);
      return next;
    }, { replace: true });
  };
  const [showVisitaLegacy, setShowVisitaLegacy] = useState(false);

  const onFired = () => {
    qc.invalidateQueries({ queryKey: ["reengajamento-runs"] });
    qc.invalidateQueries({ queryKey: ["reengajamento-active-run"] });
    qc.invalidateQueries({ queryKey: ["reengajamento-ultimos"] });
    qc.invalidateQueries({ queryKey: ["reengajamento-kpis"] });
    qc.invalidateQueries({ queryKey: ["auditoria-meta-webhook"] });
    qc.invalidateQueries({ queryKey: ["visita-amanha-stats"] });
    setTab("retorno");
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto">
      <PageHeader
        title="Central de Reengajamento"
        subtitle="Disparos avulsos e campanhas em ondas. Selecione a lista, o modelo e dispare via Meta ou Evolution. Acompanhe o retorno em tempo real em uma única página."
        icon={<RefreshCw className="h-5 w-5" />}
      />

      <LiveDispatchBanner />

      <Tabs value={tab} onValueChange={handleTabChange} className="space-y-4">
        <TabsList className="grid w-full md:w-auto md:inline-grid grid-cols-2 md:grid-cols-4 h-auto md:h-11">
          <TabsTrigger value="disparo" className="gap-2 text-sm">
            <Send className="h-4 w-4" /> Novo disparo
          </TabsTrigger>
          <TabsTrigger value="retorno" className="gap-2 text-sm">
            <Activity className="h-4 w-4" /> Retorno ao vivo
          </TabsTrigger>
          <TabsTrigger value="ondas" className="gap-2 text-sm">
            <Radio className="h-4 w-4" /> Campanhas em ondas
          </TabsTrigger>
          <TabsTrigger value="config" className="gap-2 text-sm">
            <Settings className="h-4 w-4" /> Configurações
          </TabsTrigger>
        </TabsList>

        {/* Aba 1: Novo disparo */}
        <TabsContent value="disparo" className="mt-0 space-y-4">
          <DisparoCustomizadoCard onFired={onFired} />
        </TabsContent>

        {/* Aba 2: Retorno em tempo real */}
        <TabsContent value="retorno" className="mt-0 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Auditoria de webhooks — retorno dos disparos</CardTitle>
              <p className="text-[11px] text-muted-foreground">
                Status de entrega, leitura, respostas (SIM/NÃO ou texto livre) e classificação automática dos
                leads que receberam disparos via Meta. Atualiza em tempo real conforme novos eventos chegam.
              </p>
            </CardHeader>
            <CardContent>
              <AuditoriaWebhookTab />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Aba 3: Campanhas em ondas (Átrio) */}
        <TabsContent value="ondas" className="mt-0 space-y-4">
          <Suspense fallback={<div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
            <CampanhaOndasTab />
          </Suspense>
        </TabsContent>

        {/* Aba 4: Configurações */}
        <TabsContent value="config" className="mt-0 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Settings className="h-4 w-4 text-primary" />
                Templates, janelas, throttle e instância
              </CardTitle>
              <p className="text-[11px] text-muted-foreground">
                Conexão da instância WhatsApp, templates Meta, variantes Evolution, janelas de horário,
                throttle, pausa global e disparo padrão de descartados.
              </p>
            </CardHeader>
            <CardContent>
              <ReengajamentoTab />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <button
                className="flex items-center gap-2 text-left w-full"
                onClick={() => setShowVisitaLegacy((v) => !v)}
              >
                <Calendar className="h-4 w-4 text-primary" />
                <CardTitle className="text-base flex-1">Histórico legado — Visita Amanhã</CardTitle>
                <Button variant="ghost" size="sm" className="h-6">
                  {showVisitaLegacy ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </button>
              {!showVisitaLegacy && (
                <p className="text-[11px] text-muted-foreground">
                  Disparos enviados pelo cron automático antigo. Clique para expandir.
                </p>
              )}
            </CardHeader>
            {showVisitaLegacy && (
              <CardContent>
                <VisitaAmanhaTab />
              </CardContent>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
