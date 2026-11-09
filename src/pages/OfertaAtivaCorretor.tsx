/**
 * Oferta Ativa do corretor — módulo único de ligações.
 * Entrada (meta do dia + escolha da fila + ranking) → Tela de ligação (igual para Listas, Estagnados e Descartados).
 * Grava só pelas funções já existentes, então placar, ranking, TV e relatórios leem a mesma fonte.
 */
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Phone, Bookmark, CheckCircle, BarChart3, History } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import ArenaRanking from "@/components/arena/ArenaRanking";
import ReservadosPanel from "@/components/oferta-ativa/ReservadosPanel";
import AproveitadosPanel from "@/components/oferta-ativa/AproveitadosPanel";
import MeusResultadosPanel from "@/components/oferta-ativa/MeusResultadosPanel";
import MetaDoDia from "@/components/oferta-ativa-v2/MetaDoDia";
import EscolhaOrigem from "@/components/oferta-ativa-v2/EscolhaOrigem";
import FiltroOrigem from "@/components/oferta-ativa-v2/FiltroOrigem";
import HistoricoLigacoes from "@/components/oferta-ativa-v2/HistoricoLigacoes";
import TelaLigacao from "@/components/oferta-ativa-v2/TelaLigacao";
import { primeiroNome, type OrigemOA } from "@/components/oferta-ativa-v2/tipos";

interface Sessao { origem: OrigemOA; listaIds: string[]; empreendimentos: string[] }

function saudacao() {
  const h = Number(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo", hour: "numeric", hour12: false }));
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

export default function OfertaAtivaCorretor() {
  const { user } = useAuth();
  const [escolhendo, setEscolhendo] = useState<OrigemOA | null>(null);
  const [sessao, setSessao] = useState<Sessao | null>(null);
  const [aba, setAba] = useState("ligar");
  const nome = primeiroNome(String((user?.user_metadata as { nome?: string } | undefined)?.nome ?? ""));

  useEffect(() => { window.scrollTo({ top: 0 }); }, [sessao]);

  if (sessao) {
    return (
      <div className="mx-auto w-full max-w-[1500px] py-1">
        <TelaLigacao key={`${sessao.origem}-${sessao.listaIds.join()}-${sessao.empreendimentos.join()}`} {...sessao} onSair={() => setSessao(null)} />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1500px] py-2">
      <motion.header initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><Phone className="h-6 w-6 text-primary" aria-hidden /> Oferta Ativa</h1>
          <p className="text-sm text-muted-foreground">{saudacao()}{nome ? `, ${nome}` : ""}. Escolha de onde ligar e bora pra cima. 📞</p>
        </div>
      </motion.header>

      <Tabs value={aba} onValueChange={setAba}>
        <TabsList className="mb-4 flex h-10 w-full justify-start overflow-x-auto md:inline-flex md:w-auto" style={{ scrollbarWidth: "none" }}>
          <TabsTrigger value="ligar" className="shrink-0 gap-1.5"><Phone className="h-3.5 w-3.5" aria-hidden /> Ligar</TabsTrigger>
          <TabsTrigger value="reservados" className="shrink-0 gap-1.5"><Bookmark className="h-3.5 w-3.5" aria-hidden /> Reservados</TabsTrigger>
          <TabsTrigger value="aproveitados" className="shrink-0 gap-1.5"><CheckCircle className="h-3.5 w-3.5" aria-hidden /> Aproveitados</TabsTrigger>
          <TabsTrigger value="historico" className="shrink-0 gap-1.5"><History className="h-3.5 w-3.5" aria-hidden /> Histórico</TabsTrigger>
          <TabsTrigger value="resultados" className="shrink-0 gap-1.5"><BarChart3 className="h-3.5 w-3.5" aria-hidden /> Meus resultados</TabsTrigger>
        </TabsList>

        <TabsContent value="ligar" className="mt-0">
          <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
            <main className="min-w-0 space-y-4">
              <MetaDoDia />
              <div>
                <h2 className="mb-2 text-sm font-semibold text-muted-foreground">De onde você vai ligar?</h2>
                <EscolhaOrigem onEscolher={setEscolhendo} />
              </div>
            </main>
            <aside className="min-w-0"><ArenaRanking /></aside>
          </div>
        </TabsContent>
        <TabsContent value="reservados" className="mt-0"><ReservadosPanel /></TabsContent>
        <TabsContent value="aproveitados" className="mt-0"><AproveitadosPanel /></TabsContent>
        <TabsContent value="historico" className="mt-0"><HistoricoLigacoes /></TabsContent>
        <TabsContent value="resultados" className="mt-0"><MeusResultadosPanel /></TabsContent>
      </Tabs>

      <FiltroOrigem origem={escolhendo} onFechar={() => setEscolhendo(null)}
        onComecar={(origem, ids, todos) => {
          setEscolhendo(null);
          setSessao(origem === "listas" ? { origem, listaIds: ids.length ? ids : todos, empreendimentos: [] } : { origem, listaIds: [], empreendimentos: ids });
        }} />
    </div>
  );
}
