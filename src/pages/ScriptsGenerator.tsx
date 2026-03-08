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
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="font-black text-gray-900" style={{ fontSize: 28 }}>
          📋 Scripts & Follow Ups
        </h1>
        <p className="text-gray-500 mt-1" style={{ fontSize: 14 }}>
          {isManager
            ? "Gerencie os scripts do seu time e acesse a biblioteca de scripts salvos"
            : "Scripts do seu time e biblioteca pessoal"}
        </p>
      </div>

      {isManager && (
        <div
          className="flex items-center gap-3 p-4"
          style={{
            borderRadius: 12,
            background: "linear-gradient(135deg, #EFF6FF, #F0F9FF)",
            border: "1px solid rgba(59,130,246,0.15)",
          }}
        >
          <img src={homiMascot} alt="Homi" className="h-10 w-10 object-contain shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-gray-800 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-blue-500" /> Precisa criar um script com IA?
            </p>
            <p className="text-gray-500 mt-0.5" style={{ fontSize: 11 }}>
              Use o <strong>HOMI Gerencial</strong> no menu para gerar scripts de ligação, WhatsApp ou follow-up e publicar para o time.
            </p>
          </div>
        </div>
      )}

      {isManager ? (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="h-auto max-w-md bg-transparent p-0 gap-2">
            <TabsTrigger
              value="time"
              className="gap-1.5 py-2.5 px-4 data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-none data-[state=inactive]:text-gray-500 data-[state=inactive]:hover:text-gray-700 data-[state=inactive]:hover:bg-gray-100 font-semibold"
              style={{ borderRadius: 8, fontSize: 14 }}
            >
              <Users className="h-4 w-4" /> Scripts do Time
            </TabsTrigger>
            <TabsTrigger
              value="biblioteca"
              className="gap-1.5 py-2.5 px-4 data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-none data-[state=inactive]:text-gray-500 data-[state=inactive]:hover:text-gray-700 data-[state=inactive]:hover:bg-gray-100 font-semibold"
              style={{ borderRadius: 8, fontSize: 14 }}
            >
              <BookOpen className="h-4 w-4" /> Biblioteca
            </TabsTrigger>
          </TabsList>
          <TabsContent value="time" className="mt-5"><TeamScriptAssignment /></TabsContent>
          <TabsContent value="biblioteca" className="mt-5"><ScriptLibrary /></TabsContent>
        </Tabs>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="h-auto max-w-md bg-transparent p-0 gap-2">
            <TabsTrigger
              value="time-scripts"
              className="gap-1.5 py-2.5 px-4 data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-none data-[state=inactive]:text-gray-500 data-[state=inactive]:hover:text-gray-700 data-[state=inactive]:hover:bg-gray-100 font-semibold"
              style={{ borderRadius: 8, fontSize: 14 }}
            >
              <Users className="h-4 w-4" /> Scripts do Time
            </TabsTrigger>
            <TabsTrigger
              value="biblioteca"
              className="gap-1.5 py-2.5 px-4 data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-none data-[state=inactive]:text-gray-500 data-[state=inactive]:hover:text-gray-700 data-[state=inactive]:hover:bg-gray-100 font-semibold"
              style={{ borderRadius: 8, fontSize: 14 }}
            >
              <BookOpen className="h-4 w-4" /> Minha Biblioteca
            </TabsTrigger>
          </TabsList>
          <TabsContent value="time-scripts" className="mt-5"><CorretorScriptsView /></TabsContent>
          <TabsContent value="biblioteca" className="mt-5"><ScriptLibrary /></TabsContent>
        </Tabs>
      )}
    </div>
  );
}
