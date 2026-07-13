import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { RefreshCw, Send, Activity, Settings, Sprout } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQueryClient } from "@tanstack/react-query";
import DisparoCustomizadoCard from "@/components/central-nutricao/DisparoCustomizadoCard";
import ReengajamentoTab from "@/components/central-nutricao/ReengajamentoTab";
import AuditoriaWebhookTab from "@/components/central-nutricao/AuditoriaWebhookTab";
import RespostasRecebidasHoje from "@/components/central-nutricao/RespostasRecebidasHoje";
import NutricaoTab from "@/components/central-nutricao/NutricaoTab";
import LiveDispatchBanner from "@/components/central-nutricao/LiveDispatchBanner";
import { PageHeader } from "@/components/ui/PageHeader";


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

  const onFired = () => {
    qc.invalidateQueries({ queryKey: ["reengajamento-runs"] });
    qc.invalidateQueries({ queryKey: ["reengajamento-active-run"] });
    qc.invalidateQueries({ queryKey: ["reengajamento-ultimos"] });
    qc.invalidateQueries({ queryKey: ["reengajamento-kpis"] });
    qc.invalidateQueries({ queryKey: ["auditoria-meta-webhook"] });
    handleTabChange("aovivo");
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto">
      <PageHeader
        title="Central de Reengajamento"
        subtitle="Tudo manual, acionável por você: dispare por base e template via Meta, ative fluxos de nutrição quando quiser e acompanhe ao vivo o que está sendo feito e o resultado."
        icon={<RefreshCw className="h-5 w-5" />}
      />

      <LiveDispatchBanner />

      <Tabs value={tab} onValueChange={handleTabChange} className="space-y-4">
        <TabsList className="grid w-full md:w-auto md:inline-grid grid-cols-2 md:grid-cols-5 h-auto md:h-11">
          <TabsTrigger value="disparo" className="gap-2 text-sm">
            <Send className="h-4 w-4" /> Disparo manual
          </TabsTrigger>
          <TabsTrigger value="nutricao" className="gap-2 text-sm">
            <Sprout className="h-4 w-4" /> Nutrição
          </TabsTrigger>
          <TabsTrigger value="aovivo" className="gap-2 text-sm">
            <Activity className="h-4 w-4" /> Ao vivo
          </TabsTrigger>
          <TabsTrigger value="ondas" className="gap-2 text-sm">
            <Radio className="h-4 w-4" /> Campanhas em ondas
          </TabsTrigger>
          <TabsTrigger value="config" className="gap-2 text-sm">
            <Settings className="h-4 w-4" /> Configurações
          </TabsTrigger>
        </TabsList>

        {/* Aba 1: Disparo manual */}
        <TabsContent value="disparo" className="mt-0 space-y-4">
          <DisparoCustomizadoCard onFired={onFired} />
        </TabsContent>

        {/* Aba 2: Nutrição (manual) */}
        <TabsContent value="nutricao" className="mt-0 space-y-4">
          <NutricaoTab />
        </TabsContent>

        {/* Aba 3: Ao vivo + resultado */}
        <TabsContent value="aovivo" className="mt-0 space-y-4">
          <RespostasRecebidasHoje />
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

        {/* Aba 4: Campanhas em ondas (Átrio) */}
        <TabsContent value="ondas" className="mt-0 space-y-4">
          <Suspense fallback={<div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
            <CampanhaOndasTab />
          </Suspense>
        </TabsContent>

        {/* Aba 5: Configurações */}
        <TabsContent value="config" className="mt-0 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Settings className="h-4 w-4 text-primary" />
                Templates, janelas, throttle e instância
              </CardTitle>
              <p className="text-[11px] text-muted-foreground">
                Conexão da instância WhatsApp, templates Meta, variantes Evolution, janelas de horário e throttle.
              </p>
            </CardHeader>
            <CardContent>
              <ReengajamentoTab />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
