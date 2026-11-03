import { useMemo, useState } from "react";
import { Download, Loader2, RefreshCw, TrendingUp, Trophy } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/PageHeader";
import { periodoAtivo, datasDoPeriodo } from "@/lib/periodoPadraoDatas";
import { PeriodSelector } from "@/components/ui/PeriodSelector";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUserRole } from "@/hooks/useUserRole";
import { useVendasRelatorio } from "@/hooks/useVendasRelatorio";
import { todayBRT } from "@/lib/brtTime";
import { FILTROS_VENDAS, agruparVendas, filtrarVendas, rankingVendas, resumoVendas, type VendaRelatorio } from "@/lib/vendasRelatorio";
import { exportarVendas } from "@/lib/vendasExport";
import { VendasFiltros } from "@/components/vendas/VendasFiltros";
import { VendasIndicadores } from "@/components/vendas/VendasIndicadores";
import { VendasTabela } from "@/components/vendas/VendasTabela";
import { VendasAnalises } from "@/components/vendas/VendasAnalises";
import { VendaDetalhes } from "@/components/vendas/VendaDetalhes";
import { PendenciasVendas } from "@/components/vendas/PendenciasVendas";
import { EditarVendaDrawer } from "@/components/vendas/EditarVendaDrawer";

export default function VendasRealizadas() {
  const { isAdmin, isDiretor } = useUserRole();
  const hoje = todayBRT();
  const [start,setStart] = useState(`${hoje.slice(0,7)}-01`);
  const [end,setEnd] = useState(hoje);
  const [filtros,setFiltros] = useState({ ...FILTROS_VENDAS });
  const [detalhe,setDetalhe] = useState<VendaRelatorio|null>(null);
  const [editar,setEditar] = useState<VendaRelatorio|null>(null);
  const query = useVendasRelatorio(start,end);
  const vendas = query.data ?? [];
  const filtradas = useMemo(()=>filtrarVendas(vendas,filtros),[vendas,filtros]);
  const resumo = resumoVendas(filtradas,filtros);
  return <div className="space-y-2 min-w-0">
    <PageHeader title="Vendas" subtitle="Resultados e vendas assinadas" icon={<TrendingUp size={18} strokeWidth={1.5}/>} actions={<div className="flex items-center gap-2"><Button variant="outline" size="icon" aria-label="Atualizar vendas" title="Atualizar vendas" onClick={()=>void query.refetch()}><RefreshCw className={query.isFetching ? "animate-spin" : ""}/></Button><Button variant="outline" disabled={!filtradas.length} onClick={()=>exportarVendas(filtradas,filtros,{start,end})}><Download/>Excel</Button></div>}/>
    <PeriodSelector className="mb-3" value={periodoAtivo(start,end,hoje)} onChange={p=>{if(p==="personalizado"){document.getElementById("vendas-de")?.click();return;}const x=datasDoPeriodo(p,hoje);setStart(x.inicio);setEnd(x.fim);}}/>
    <VendasFiltros value={filtros} onChange={setFiltros} vendas={vendas} start={start} end={end} onStart={setStart} onEnd={setEnd}/>
    <VendasIndicadores resumo={resumo}/>
    {query.isPending ? <div className="flex justify-center py-16"><Loader2 className="animate-spin text-primary"/></div> : query.error ? <div role="alert" className="text-destructive py-8">Não foi possível carregar as vendas. <Button variant="outline" onClick={()=>void query.refetch()}>Tentar novamente</Button></div> : <Tabs defaultValue="vendas" className="space-y-5">
      <div className="overflow-x-auto"><TabsList className="h-auto bg-transparent border-b border-border rounded-none p-0 gap-2"><TabsTrigger value="vendas">Vendas</TabsTrigger><TabsTrigger value="ranking">Ranking</TabsTrigger><TabsTrigger value="construtoras">Construtoras</TabsTrigger><TabsTrigger value="origens">Origens</TabsTrigger>{(isAdmin||isDiretor)&&<TabsTrigger value="pendencias" className="text-warning-700 dark:text-warning-500">Pendências</TabsTrigger>}</TabsList></div>
      <TabsContent value="vendas">{!filtradas.length ? <EmptyState icon={<Trophy className="size-5"/>} title="Nenhuma venda neste período" description="Troque o período ou limpe os filtros para ver outras vendas."/> : <VendasTabela vendas={filtradas} filtros={filtros} onOpen={setDetalhe}/>}</TabsContent>
      <TabsContent value="ranking" className="space-y-8"><VendasAnalises titulo="Corretores" rows={rankingVendas(filtradas,filtros)} total={resumo.vgv}/><VendasAnalises titulo="Equipes" rows={rankingVendas(filtradas,filtros,true)} total={resumo.vgv}/></TabsContent>
      <TabsContent value="construtoras"><VendasAnalises titulo="Construtoras" rows={agruparVendas(filtradas,filtros,"construtora")} total={resumo.vgv}/></TabsContent>
      <TabsContent value="origens"><VendasAnalises titulo="Origens e campanhas" rows={agruparVendas(filtradas,filtros,"origem")} total={resumo.vgv}/></TabsContent>
      {(isAdmin||isDiretor)&&<TabsContent value="pendencias"><PendenciasVendas/></TabsContent>}
    </Tabs>}
    <VendaDetalhes venda={detalhe} onClose={()=>setDetalhe(null)} onEditar={isAdmin||isDiretor?v=>{setDetalhe(null);setEditar(v);}:undefined}/>
    <EditarVendaDrawer venda={editar} open={!!editar} canEdit={isAdmin||isDiretor} onOpenChange={o=>{if(!o)setEditar(null);}}/>
  </div>;
}
