import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ClipboardCheck, Users, BarChart3, Bot, CheckSquare, FileText } from "lucide-react";
import CheckpointDaily from "@/components/checkpoint/CheckpointDaily";
import TeamManagement from "@/components/checkpoint/TeamManagement";
import CheckpointReports from "@/components/checkpoint/CheckpointReports";
import CoachPanel from "@/components/checkpoint/CoachPanel";
import ManagerChecklist from "@/components/checkpoint/ManagerChecklist";
import JetimobPaste from "@/components/checkpoint/JetimobPaste";

export default function CheckpointGerente() {
  const [activeTab, setActiveTab] = useState("checkpoint");

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">
          Checkpoint do <span className="text-primary">Gerente</span>
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gestão diária do time comercial com metas, resultados e IA
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-6 h-auto">
          <TabsTrigger value="checkpoint" className="gap-1.5 text-xs py-2">
            <ClipboardCheck className="h-3.5 w-3.5" /> Checkpoint
          </TabsTrigger>
          <TabsTrigger value="time" className="gap-1.5 text-xs py-2">
            <Users className="h-3.5 w-3.5" /> Meu Time
          </TabsTrigger>
          <TabsTrigger value="relatorios" className="gap-1.5 text-xs py-2">
            <BarChart3 className="h-3.5 w-3.5" /> Relatórios
          </TabsTrigger>
          <TabsTrigger value="jetimob" className="gap-1.5 text-xs py-2">
            <FileText className="h-3.5 w-3.5" /> Jetimob
          </TabsTrigger>
          <TabsTrigger value="coach" className="gap-1.5 text-xs py-2">
            <Bot className="h-3.5 w-3.5" /> Coach IA
          </TabsTrigger>
          <TabsTrigger value="checklist" className="gap-1.5 text-xs py-2">
            <CheckSquare className="h-3.5 w-3.5" /> Checklist
          </TabsTrigger>
        </TabsList>

        <TabsContent value="checkpoint" className="mt-4">
          <CheckpointDaily />
        </TabsContent>
        <TabsContent value="time" className="mt-4">
          <TeamManagement />
        </TabsContent>
        <TabsContent value="relatorios" className="mt-4">
          <CheckpointReports />
        </TabsContent>
        <TabsContent value="jetimob" className="mt-4">
          <JetimobPaste />
        </TabsContent>
        <TabsContent value="coach" className="mt-4">
          <CoachPanel />
        </TabsContent>
        <TabsContent value="checklist" className="mt-4">
          <ManagerChecklist />
        </TabsContent>
      </Tabs>
    </div>
  );
}
