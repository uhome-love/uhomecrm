/**
 * CorretorCall — Oferta Ativa do corretor.
 * Entrada direta: meta, campanha, script e discador. Sem tela de warm-up.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Phone, Layers, Bookmark, CheckCircle, BarChart3, Trophy } from "lucide-react";
import CorretorEntrada from "@/components/oferta-ativa/CorretorEntrada";
import AproveitadosPanel from "@/components/oferta-ativa/AproveitadosPanel";
import RankingPanel from "@/components/oferta-ativa/RankingPanel";
import BasesAtivasGrid from "@/components/oferta-ativa/BasesAtivasGrid";
import ReservadosPanel from "@/components/oferta-ativa/ReservadosPanel";
import MeusResultadosPanel from "@/components/oferta-ativa/MeusResultadosPanel";
import PortasOfertaAtiva, { type Porta } from "@/components/oferta-ativa/bolsao/PortasOfertaAtiva";
import BolsaoDiscador from "@/components/oferta-ativa/bolsao/BolsaoDiscador";

export default function CorretorCall() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("call");
  const [porta, setPorta] = useState<Porta | null>(null);

  // Mantém o badge leve de sessão (não escurece a tela)
  useEffect(() => {
    document.body.classList.add("arena-session");
    return () => {
      document.body.classList.remove("arena-session");
      document.body.classList.remove("arena-mode");
    };
  }, []);

  return (
    <div className="w-full max-w-[1600px] mx-auto px-3 md:px-4 py-3 space-y-3">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex h-10 w-full justify-start overflow-x-auto md:inline-flex md:w-auto" style={{ scrollbarWidth: "none" }}>
          <TabsTrigger value="call" className="shrink-0 gap-1.5">
            <Phone className="h-3.5 w-3.5" /> Ligar
          </TabsTrigger>
          <TabsTrigger value="bases" className="shrink-0 gap-1.5">
            <Layers className="h-3.5 w-3.5" /> Bases
          </TabsTrigger>
          <TabsTrigger value="reservados" className="shrink-0 gap-1.5">
            <Bookmark className="h-3.5 w-3.5" /> Reservados
          </TabsTrigger>
          <TabsTrigger value="aproveitados" className="shrink-0 gap-1.5">
            <CheckCircle className="h-3.5 w-3.5" /> Aproveitados
          </TabsTrigger>
          <TabsTrigger value="resultados" className="shrink-0 gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" /> Meus resultados
          </TabsTrigger>
          <TabsTrigger value="ranking" className="shrink-0 gap-1.5">
            <Trophy className="h-3.5 w-3.5" /> Ranking
          </TabsTrigger>
        </TabsList>

        <TabsContent value="call" className="mt-3 space-y-3">
          {!porta && (
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">Para quem você quer ligar hoje?</h2>
              <p className="text-sm text-muted-foreground">Escolha uma opção. Depois você escolhe o empreendimento.</p>
            </div>
          )}
          <PortasOfertaAtiva value={porta} onChange={setPorta} />
          {!porta ? null : porta === "listas" ? (
            <CorretorEntrada onSair={() => navigate("/corretor")} />
          ) : (
            <BolsaoDiscador key={porta} porta={porta} />
          )}
        </TabsContent>
        <TabsContent value="bases" className="mt-3">
          <BasesAtivasGrid />
        </TabsContent>
        <TabsContent value="reservados" className="mt-3">
          <ReservadosPanel />
        </TabsContent>
        <TabsContent value="aproveitados" className="mt-3">
          <AproveitadosPanel />
        </TabsContent>
        <TabsContent value="resultados" className="mt-3">
          <MeusResultadosPanel />
        </TabsContent>
        <TabsContent value="ranking" className="mt-3">
          <RankingPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
