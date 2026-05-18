import { useState } from "react";
import { RefreshCw, ChevronDown, ChevronUp, Settings, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQueryClient } from "@tanstack/react-query";
import DisparoCustomizadoCard from "@/components/central-nutricao/DisparoCustomizadoCard";
import ReengajamentoTab from "@/components/central-nutricao/ReengajamentoTab";
import AuditoriaWebhookTab from "@/components/central-nutricao/AuditoriaWebhookTab";
import VisitaAmanhaTab from "@/components/central-nutricao/VisitaAmanhaTab";

export default function CentralNutricaoPage() {
  const qc = useQueryClient();
  const [showConfig, setShowConfig] = useState(false);
  const [showVisitaLegacy, setShowVisitaLegacy] = useState(false);

  const onFired = () => {
    qc.invalidateQueries({ queryKey: ["reengajamento-runs"] });
    qc.invalidateQueries({ queryKey: ["reengajamento-active-run"] });
    qc.invalidateQueries({ queryKey: ["reengajamento-ultimos"] });
    qc.invalidateQueries({ queryKey: ["reengajamento-kpis"] });
    qc.invalidateQueries({ queryKey: ["auditoria-meta-webhook"] });
    qc.invalidateQueries({ queryKey: ["visita-amanha-stats"] });
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <RefreshCw className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold">Central de Reengajamento</h1>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Disparos via WhatsApp (Meta ou Evolution) para qualquer público: descartados, pipeline ativo,
          listas da Oferta Ativa ou convite de visita amanhã. Tudo em um só lugar.
        </p>
      </div>

      {/* SEÇÃO 1 — Novo disparo (principal) */}
      <section>
        <DisparoCustomizadoCard onFired={onFired} />
      </section>

      {/* SEÇÃO 2 — Auditoria de webhooks (relatório de retorno) */}
      <section>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Auditoria de webhooks (retorno dos disparos)</CardTitle>
            <p className="text-[11px] text-muted-foreground">
              Status de entrega, leitura, respostas (SIM/NÃO) e classificação automática dos leads
              que receberam disparos via Meta.
            </p>
          </CardHeader>
          <CardContent>
            <AuditoriaWebhookTab />
          </CardContent>
        </Card>
      </section>

      {/* SEÇÃO 3 — Histórico Visita Amanhã (collapse, mantido para auditoria) */}
      <section>
        <Card>
          <CardHeader className="pb-3">
            <button
              className="flex items-center gap-2 text-left w-full"
              onClick={() => setShowVisitaLegacy((v) => !v)}
            >
              <Calendar className="h-4 w-4 text-primary" />
              <CardTitle className="text-base flex-1">Histórico — Visita Amanhã</CardTitle>
              <Button variant="ghost" size="sm" className="h-6">
                {showVisitaLegacy ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </button>
            {!showVisitaLegacy && (
              <p className="text-[11px] text-muted-foreground">
                Disparos enviados pelo cron automático e suas respostas. Clique para expandir.
              </p>
            )}
          </CardHeader>
          {showVisitaLegacy && (
            <CardContent>
              <VisitaAmanhaTab />
            </CardContent>
          )}
        </Card>
      </section>

      {/* SEÇÃO 4 — Configurações avançadas (collapse) */}
      <section>
        <Card>
          <CardHeader className="pb-3">
            <button
              className="flex items-center gap-2 text-left w-full"
              onClick={() => setShowConfig((v) => !v)}
            >
              <Settings className="h-4 w-4 text-primary" />
              <CardTitle className="text-base flex-1">Configurações avançadas (templates, janelas, throttle, instância)</CardTitle>
              <Button variant="ghost" size="sm" className="h-6">
                {showConfig ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </button>
            {!showConfig && (
              <p className="text-[11px] text-muted-foreground">
                Conexão da instância WhatsApp, templates Meta, variantes Evolution, janelas de horário,
                throttle, pausa global e disparo padrão de descartados. Clique para expandir.
              </p>
            )}
          </CardHeader>
          {showConfig && (
            <CardContent>
              <ReengajamentoTab />
            </CardContent>
          )}
        </Card>
      </section>
    </div>
  );
}
