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
import LiaReengajarTab from "@/components/lia-hub/LiaReengajarTab";
import LiaTransitoTab from "@/components/lia-hub/LiaTransitoTab";
import LiaRecuperaTab from "@/components/lia-hub/LiaRecuperaTab";
import LiaMensagensTab from "@/components/lia-hub/LiaMensagensTab";
import LiaConhecimentoTab from "@/components/lia-hub/LiaConhecimentoTab";
import LiaLaboratorioTab from "@/components/lia-hub/LiaLaboratorioTab";
import { useLiaRealtime } from "@/components/lia-hub/useLiaHub";

const GRUPOS = [
  { grupo: "Atendimento", abas: [
    { valor: "painel", rotulo: "Painel" },
    { valor: "transito", rotulo: "Trânsito" },
    { valor: "leads", rotulo: "Leads e conversas" },
    { valor: "kanban", rotulo: "Kanban" },
    { valor: "followups", rotulo: "Follow-ups" },
    { valor: "qualificados", rotulo: "Qualificados" },
  ] },
  { grupo: "Recuperação", abas: [
    { valor: "recupera", rotulo: "Recupera" },
    { valor: "reengajar", rotulo: "Reengajamento" },
    { valor: "mensagens", rotulo: "Mensagens" },
  ] },
  { grupo: "Inteligência", abas: [
    { valor: "conhecimento", rotulo: "Conhecimento" },
    { valor: "laboratorio", rotulo: "Laboratório" },
  ] },
];

export default function LiaHub() {
  const [params, setParams] = useSearchParams();
  const qc = useQueryClient();
  const aba = params.get("aba") ?? "painel";
  useLiaRealtime(); // ao vivo via Realtime (sem o refresh interminável de polling)

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-3 p-3 sm:p-4">
      <header className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Bot className="h-4.5 w-4.5" strokeWidth={1.9} />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-base font-bold leading-tight text-foreground sm:text-lg">LIA · Uhome</h1>
          <p className="truncate text-[11px] text-muted-foreground sm:text-xs">
            Atendente de IA no WhatsApp · ao vivo
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 text-muted-foreground"
          title="Atualizar"
          onClick={() => qc.invalidateQueries({ queryKey: ["lia-hub"] })}
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </header>

      <Tabs
        value={aba}
        onValueChange={(v) => setParams({ aba: v }, { replace: true })}
        className="w-full"
      >
        <div className="-mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <TabsList className="flex w-max min-w-full justify-start gap-1">
            {GRUPOS.map((g, gi) => (
              <div key={g.grupo} className="flex items-center gap-1">
                {gi > 0 && <span className="mx-1 h-5 w-px bg-border" aria-hidden />}
                <span className="hidden px-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground lg:inline">{g.grupo}</span>
                {g.abas.map((a) => (
                  <TabsTrigger key={a.valor} value={a.valor} className="h-9 shrink-0 px-3 text-xs sm:text-sm">
                    {a.rotulo}
                  </TabsTrigger>
                ))}
              </div>
            ))}
          </TabsList>
        </div>

        <TabsContent value="painel" className="mt-3">
          <LiaPainelTab />
        </TabsContent>
        <TabsContent value="transito" className="mt-3">
          <LiaTransitoTab />
        </TabsContent>
        <TabsContent value="leads" className="mt-3">
          <LiaLeadsTab />
        </TabsContent>
        <TabsContent value="kanban" className="mt-3">
          <LiaKanbanTab />
        </TabsContent>
        <TabsContent value="followups" className="mt-3">
          <LiaFollowupsTab />
        </TabsContent>
        <TabsContent value="qualificados" className="mt-3">
          <LiaQualificadosTab />
        </TabsContent>
        <TabsContent value="reengajar" className="mt-3">
          <LiaReengajarTab />
        </TabsContent>
        <TabsContent value="recupera" className="mt-3">
          <LiaRecuperaTab />
        </TabsContent>
        <TabsContent value="mensagens" className="mt-3">
          <LiaMensagensTab />
        </TabsContent>
        <TabsContent value="conhecimento" className="mt-3">
          <LiaConhecimentoTab />
        </TabsContent>
        <TabsContent value="laboratorio" className="mt-3">
          <LiaLaboratorioTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
