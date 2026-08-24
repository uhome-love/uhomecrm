import { useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Bot, RefreshCw } from "lucide-react";
import LiaPainelTab from "@/components/lia-hub/LiaPainelTab";
import LiaLeadsTab from "@/components/lia-hub/LiaLeadsTab";
import LiaKanbanTab from "@/components/lia-hub/LiaKanbanTab";
import LiaFollowupsTab from "@/components/lia-hub/LiaFollowupsTab";
import LiaQualificadosTab from "@/components/lia-hub/LiaQualificadosTab";
import { useLiaRealtime } from "@/components/lia-hub/useLiaHub";

const ABAS = [
  { valor: "painel", rotulo: "Painel" },
  { valor: "leads", rotulo: "Leads e conversas" },
  { valor: "kanban", rotulo: "Kanban" },
  { valor: "followups", rotulo: "Follow-ups" },
  { valor: "qualificados", rotulo: "Qualificados" },
];

export default function LiaHub() {
  const [params, setParams] = useSearchParams();
  const qc = useQueryClient();
  const aba = params.get("aba") ?? "painel";
  useLiaRealtime(); // ao vivo via Realtime (sem o refresh interminável de polling)

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-4 p-3 sm:space-y-5 sm:p-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary sm:h-10 sm:w-10">
            <Bot className="h-5 w-5" strokeWidth={1.9} />
          </span>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-foreground sm:text-2xl">LIA · Uhome</h1>
            <p className="text-xs text-muted-foreground sm:text-sm">
              Acompanhamento da atendente de IA no WhatsApp.
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-2 sm:w-auto"
          onClick={() => qc.invalidateQueries({ queryKey: ["lia-hub"] })}
        >
          <RefreshCw className="h-4 w-4" />
          Atualizar
        </Button>
      </header>

      <Tabs
        value={aba}
        onValueChange={(v) => setParams({ aba: v }, { replace: true })}
        className="w-full"
      >
        <div className="-mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <TabsList className="flex w-max min-w-full justify-start gap-1">
            {ABAS.map((a) => (
              <TabsTrigger key={a.valor} value={a.valor} className="h-9 shrink-0 px-3 text-xs sm:text-sm">
                {a.rotulo}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="painel" className="mt-5">
          <LiaPainelTab />
        </TabsContent>
        <TabsContent value="leads" className="mt-5">
          <LiaLeadsTab />
        </TabsContent>
        <TabsContent value="kanban" className="mt-5">
          <LiaKanbanTab />
        </TabsContent>
        <TabsContent value="followups" className="mt-5">
          <LiaFollowupsTab />
        </TabsContent>
        <TabsContent value="qualificados" className="mt-5">
          <LiaQualificadosTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
