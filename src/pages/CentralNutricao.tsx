import { useState } from "react";
import { RefreshCw, Send, Activity, Settings, Calendar, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQueryClient } from "@tanstack/react-query";
import DisparoCustomizadoCard from "@/components/central-nutricao/DisparoCustomizadoCard";
import ReengajamentoTab from "@/components/central-nutricao/ReengajamentoTab";
import AuditoriaWebhookTab from "@/components/central-nutricao/AuditoriaWebhookTab";
import VisitaAmanhaTab from "@/components/central-nutricao/VisitaAmanhaTab";

export default function CentralNutricaoPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState("disparo");
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
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <RefreshCw className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Central de Reengajamento</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Selecione a lista, o modelo da mensagem e dispare via Meta ou Evolution. Acompanhe o retorno
            em tempo real em uma única página.
          </p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList className="grid w-full md:w-auto md:inline-grid grid-cols-3 h-11">
          <TabsTrigger value="disparo" className="gap-2 text-sm">
            <Send className="h-4 w-4" /> Novo disparo
          </TabsTrigger>
          <TabsTrigger value="retorno" className="gap-2 text-sm">
            <Activity className="h-4 w-4" /> Retorno ao vivo
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

        {/* Aba 3: Configurações */}
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
