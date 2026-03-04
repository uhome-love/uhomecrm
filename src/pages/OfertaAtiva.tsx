import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUserRole } from "@/hooks/useUserRole";
import { Phone, Upload, Trophy, Settings, CheckCircle, LayoutGrid } from "lucide-react";
import ImportListPanel from "@/components/oferta-ativa/ImportListPanel";
import CampaignManager from "@/components/oferta-ativa/CampaignManager";
import CorretorListSelection from "@/components/oferta-ativa/CorretorListSelection";
import AproveitadosPanel from "@/components/oferta-ativa/AproveitadosPanel";
import RankingPanel from "@/components/oferta-ativa/RankingPanel";

export default function OfertaAtiva() {
  const { isAdmin, isGestor, isCorretor } = useUserRole();
  const [activeTab, setActiveTab] = useState(isAdmin ? "campanhas" : "discagem");

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
          <Phone className="h-6 w-6 text-primary" />
          Oferta Ativa
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Prospecção ativa gamificada — ligações, WhatsApp e e-mail com controle total
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 h-auto">
          {isAdmin && (
            <TabsTrigger value="importar" className="gap-1.5 text-xs">
              <Upload className="h-3.5 w-3.5" /> Importar
            </TabsTrigger>
          )}
          {(isAdmin || isGestor) && (
            <TabsTrigger value="campanhas" className="gap-1.5 text-xs">
              <Settings className="h-3.5 w-3.5" /> Campanhas
            </TabsTrigger>
          )}
          <TabsTrigger value="discagem" className="gap-1.5 text-xs">
            <Phone className="h-3.5 w-3.5" /> Discagem
          </TabsTrigger>
          <TabsTrigger value="aproveitados" className="gap-1.5 text-xs">
            <CheckCircle className="h-3.5 w-3.5" /> Aproveitados
          </TabsTrigger>
          <TabsTrigger value="ranking" className="gap-1.5 text-xs">
            <Trophy className="h-3.5 w-3.5" /> Ranking
          </TabsTrigger>
        </TabsList>

        {isAdmin && (
          <TabsContent value="importar">
            <ImportListPanel />
          </TabsContent>
        )}
        {(isAdmin || isGestor) && (
          <TabsContent value="campanhas">
            <CampaignManager />
          </TabsContent>
        )}
        <TabsContent value="discagem">
          <CorretorListSelection />
        </TabsContent>
        <TabsContent value="aproveitados">
          <AproveitadosPanel />
        </TabsContent>
        <TabsContent value="ranking">
          <RankingPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
