import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, CheckCircle2, Loader2, Unplug } from "lucide-react";
import { useCalendarIntegration } from "@/hooks/useCalendarIntegration";

export default function IntegracoesPage() {
  const { integration, isLoading, connect, disconnect, connecting, disconnecting } = useCalendarIntegration();

  return (
    <div className="container max-w-3xl mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Integrações</h1>
        <p className="text-sm text-muted-foreground">Conecte serviços externos à sua conta UHome.</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Calendar className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">Google Calendar</CardTitle>
                <CardDescription className="text-xs">
                  Envia convites oficiais ao cliente quando você agenda uma visita.
                </CardDescription>
              </div>
            </div>
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : integration?.connected ? (
              <Badge variant="default" className="gap-1 bg-emerald-600 hover:bg-emerald-600">
                <CheckCircle2 className="h-3 w-3" /> Conectado
              </Badge>
            ) : (
              <Badge variant="secondary">Não conectado</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {integration?.connected ? (
            <>
              <div className="text-sm">
                Conectado como <strong>{integration.email}</strong>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => disconnect()}
                disabled={disconnecting}
              >
                {disconnecting ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <Unplug className="h-3.5 w-3.5 mr-2" />}
                Desconectar
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Ao conectar, suas visitas viram eventos no Google Calendar e o cliente recebe
                e-mail de convite com botões "Sim / Talvez / Não".
              </p>
              <Button onClick={() => connect()} disabled={connecting}>
                {connecting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Calendar className="h-4 w-4 mr-2" />}
                Conectar Google Agenda
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
