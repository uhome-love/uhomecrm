import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Phone, MessageSquare, BookOpen } from "lucide-react";
import ScriptLigacao from "@/components/scripts/ScriptLigacao";
import ScriptFollowUp from "@/components/scripts/ScriptFollowUp";
import ScriptLibrary from "@/components/scripts/ScriptLibrary";

export default function ScriptsGenerator() {
  const [activeTab, setActiveTab] = useState("ligacao");

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">
          Gerador de <span className="text-primary">Scripts & Follow Ups</span>
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Crie scripts de ligação e mensagens de follow-up com IA para sua equipe comercial
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-auto">
          <TabsTrigger value="ligacao" className="gap-1.5 text-xs py-2">
            <Phone className="h-3.5 w-3.5" /> Script de Ligação
          </TabsTrigger>
          <TabsTrigger value="followup" className="gap-1.5 text-xs py-2">
            <MessageSquare className="h-3.5 w-3.5" /> Follow Up
          </TabsTrigger>
          <TabsTrigger value="biblioteca" className="gap-1.5 text-xs py-2">
            <BookOpen className="h-3.5 w-3.5" /> Biblioteca
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ligacao" className="mt-4"><ScriptLigacao /></TabsContent>
        <TabsContent value="followup" className="mt-4"><ScriptFollowUp /></TabsContent>
        <TabsContent value="biblioteca" className="mt-4"><ScriptLibrary /></TabsContent>
      </Tabs>
    </div>
  );
}
