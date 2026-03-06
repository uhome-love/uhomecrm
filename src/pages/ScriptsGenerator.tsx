import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookOpen, Users, Sparkles } from "lucide-react";
import ScriptLibrary from "@/components/scripts/ScriptLibrary";
import TeamScriptAssignment from "@/components/scripts/TeamScriptAssignment";
import CorretorScriptsView from "@/components/scripts/CorretorScriptsView";
import { useUserRole } from "@/hooks/useUserRole";
const homiMascot = "/images/homi-mascot-opt.png";

export default function ScriptsGenerator() {
  const { isGestor, isAdmin } = useUserRole();
  const isManager = isGestor || isAdmin;
  const [activeTab, setActiveTab] = useState(isManager ? "time" : "time-scripts");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">
          <span className="text-primary">Scripts & Follow Ups</span>
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {isManager
            ? "Gerencie os scripts do seu time e acesse a biblioteca de scripts salvos"
            : "Scripts do seu time e biblioteca pessoal"}
        </p>
      </div>

      {isManager && (
        <div className="flex items-center gap-3 p-3 rounded-xl border border-primary/20 bg-primary/5">
          <img src={homiMascot} alt="Homi" className="h-10 w-10 object-contain shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary" /> Precisa criar um script com IA?
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Use o <strong>HOMI Gerencial</strong> no menu para gerar scripts de ligação, WhatsApp ou follow-up e publicar para o time.
            </p>
          </div>
        </div>
      )}

      {isManager ? (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 h-auto max-w-md">
            <TabsTrigger value="time" className="gap-1.5 text-xs py-2">
              <Users className="h-3.5 w-3.5" /> Scripts do Time
            </TabsTrigger>
            <TabsTrigger value="biblioteca" className="gap-1.5 text-xs py-2">
              <BookOpen className="h-3.5 w-3.5" /> Biblioteca
            </TabsTrigger>
          </TabsList>
          <TabsContent value="time" className="mt-4"><TeamScriptAssignment /></TabsContent>
          <TabsContent value="biblioteca" className="mt-4"><ScriptLibrary /></TabsContent>
        </Tabs>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 h-auto max-w-md">
            <TabsTrigger value="time-scripts" className="gap-1.5 text-xs py-2">
              <Users className="h-3.5 w-3.5" /> Scripts do Time
            </TabsTrigger>
            <TabsTrigger value="biblioteca" className="gap-1.5 text-xs py-2">
              <BookOpen className="h-3.5 w-3.5" /> Minha Biblioteca
            </TabsTrigger>
          </TabsList>
          <TabsContent value="time-scripts" className="mt-4"><CorretorScriptsView /></TabsContent>
          <TabsContent value="biblioteca" className="mt-4"><ScriptLibrary /></TabsContent>
        </Tabs>
      )}
    </div>
  );
}
