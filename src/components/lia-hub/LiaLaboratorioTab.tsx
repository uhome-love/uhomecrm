import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, FlaskConical, Play, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { CENARIOS } from "../../../supabase/functions/_shared/liaLaboratorio";
import LiaCenarioCard, { type Execucao } from "./LiaCenarioCard";
import { fichaVigente, ultimasExecucoes } from "./liaLaboratorioEstado";
import { useLiaConhecimento } from "./useLiaConhecimento";
import LiaLeituraAviso from "./LiaLeituraAviso";
import LiaFollowupSimulacao from "./LiaFollowupSimulacao";

export default function LiaLaboratorioTab() {
  const qc = useQueryClient();
  const lock = useRef(false);
  const [ocupado, setOcupado] = useState(false);
  const [rodando, setRodando] = useState<string | null>(null);
  const [busca,setBusca] = useState("");
  const [filtro,setFiltro] = useState("todos");
  const [selecao,setSelecao] = useState<string | null>(null);
  const [simular,setSimular] = useState(false);
  const conhecimento = useLiaConhecimento();
  const q = useQuery({ queryKey: ["lia-lab-execucoes"], queryFn: async () => {
    const { data,error } = await supabase.from("lia_laboratorio_execucoes").select("*").order("created_at", { ascending:false }).order("id", { ascending:false }).limit(300);
    if (error) throw error;
    return (data ?? []) as unknown as Execucao[];
  } });
  const ultima = ultimasExecucoes(q.data ?? []);
  const atual = (slug: string | null) => slug ? conhecimento.data?.find((p) => p.slug === slug)?.updated_at : "sem-produto";
  const vigente = (id: string,slug: string | null) => fichaVigente(ultima.get(id),atual(slug));
  const cenarios = CENARIOS.filter((c) => {
    const e = ultima.get(c.id);
    const v = vigente(c.id,c.produto);
    return `${c.titulo} ${c.produtoNome} ${c.grupo}`.toLocaleLowerCase("pt-BR").includes(busca.toLocaleLowerCase("pt-BR")) &&
      (filtro === "todos" || (filtro === "alertas" && e && !e.passou_automatico) || (filtro === "aprovados" && e?.avaliacao === "ok" && v) || (filtro === "revisar" && (!e || !e.avaliacao || !v)));
  });
  const cenario = cenarios.find((c) => c.id === selecao) ?? cenarios[0];
  const executar = async (id: string) => {
    setRodando(id);
    const { data,error } = await supabase.functions.invoke("lia-laboratorio", { body: { cenario_id:id } });
    if (error || data?.error) throw new Error(data?.error || "Não foi possível concluir a simulação.");
    await qc.invalidateQueries({ queryKey:["lia-lab-execucoes"] });
  };
  const rodar = async (ids: string[]) => {
    if (lock.current) return;
    lock.current=true; setOcupado(true);
    try { for (const id of ids) await executar(id); } catch (e) { toast.error(e instanceof Error ? e.message : "Simulação indisponível."); }
    finally { setRodando(null);setOcupado(false);lock.current=false; }
  };
  const avaliar = useMutation({ mutationFn: async ({e,a,comentario}:{e:Execucao;a:"ok"|"ajustar";comentario?:string}) => {
    const { error } = await supabase.rpc("lia_avaliar_cenario",{p_id:e.id,p_avaliacao:a,p_comentario:comentario ?? null});
    if (error) throw error;
    await qc.invalidateQueries({queryKey:["lia-lab-execucoes"]});
  },onError:(e:Error)=>toast.error(e.message),onSuccess:()=>toast.success("Avaliação salva. Nenhum disparo foi ativado.") });
  if (q.isError || conhecimento.isError) return <LiaLeituraAviso titulo="Não foi possível conferir execuções e fichas." tentar={() => { void q.refetch();void conhecimento.refetch(); }} />;
  if (q.isLoading || conhecimento.isLoading) return <p role="status" className="py-10 text-sm text-muted-foreground">Carregando o Laboratório…</p>;
  const aprovados=CENARIOS.filter(c=>ultima.get(c.id)?.avaliacao==="ok" && vigente(c.id,c.produto)).length;
  const pendentes=CENARIOS.filter(c=>!ultima.get(c.id)?.avaliacao || !vigente(c.id,c.produto)).length;
  const alertas=CENARIOS.filter(c=>ultima.get(c.id) && !ultima.get(c.id)?.passou_automatico).length;
  const produto=conhecimento.data?.find(p=>p.slug===cenario?.produto && p.ativo);
  return <div className="space-y-5">
    <div className="grid grid-cols-2 gap-4 border-y border-border py-4 lg:grid-cols-4">{[[CENARIOS.length,"Cenários"],[aprovados,"Aprovados na ficha atual"],[pendentes,"Para revisar ou revalidar"],[alertas,"Últimas execuções com alertas"]].map(([n,r])=><div key={r} className="border-l-2 border-border pl-3"><p className="text-2xl font-semibold tabular-nums">{n}</p><p className="mt-1 text-xs text-muted-foreground">{r}</p></div>)}</div>
    <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex flex-wrap gap-1">{[['todos','Todos'],['revisar','Para revisar'],['alertas','Com alertas'],['aprovados','Aprovados']].map(([v,r])=><Button key={v} size="sm" variant={filtro===v?"secondary":"ghost"} aria-pressed={filtro===v} onClick={()=>{setFiltro(v);setSelecao(null);}}>{r}</Button>)}</div>
      <Button size="sm" variant="outline" disabled={ocupado} onClick={()=>void rodar(CENARIOS.filter(c=>!vigente(c.id,c.produto)||ultima.get(c.id)?.avaliacao!=="ok").map(c=>c.id))}>{ocupado?<Loader2 className="h-4 w-4 animate-spin"/>:<Play className="h-4 w-4"/>}Simular pendentes</Button></div>
    <div className="grid min-w-0 gap-5 lg:grid-cols-2">
      <section className={cn("min-w-0",selecao && "hidden lg:block")}><Input aria-label="Buscar cenário" placeholder="Buscar cenário, produto ou tema" value={busca} onChange={e=>setBusca(e.target.value)} className="mb-3"/>
        <div className="max-h-[650px] divide-y divide-border overflow-y-auto border-y border-border">{cenarios.map(c=><Button key={c.id} variant="ghost" className={cn("h-auto w-full justify-between whitespace-normal rounded-none px-3 py-3 text-left",cenario?.id===c.id&&"bg-accent")} onClick={()=>setSelecao(c.id)}><span><span className="block text-sm font-semibold">{c.titulo}</span><span className="mt-1 block text-xs font-normal text-muted-foreground">{c.grupo} · {c.produtoNome}</span></span></Button>)}</div>
        {!cenarios.length&&<p className="py-8 text-sm text-muted-foreground">Nenhum cenário neste filtro.</p>}</section>
      {cenario&&<section className={cn("min-w-0 space-y-3",!selecao&&"hidden lg:block")}>
        <Button variant="ghost" size="sm" className="lg:hidden" onClick={()=>setSelecao(null)}><ArrowLeft className="h-4 w-4"/>Cenários</Button>
        <LiaCenarioCard key={ultima.get(cenario.id)?.id ?? cenario.id} cenario={cenario} execucao={ultima.get(cenario.id)} desatualizado={!vigente(cenario.id,cenario.produto)} rodando={rodando===cenario.id} bloqueado={ocupado || avaliar.isPending} onRodar={()=>void rodar([cenario.id])} onAvaliar={(e,a,comentario)=>avaliar.mutate({e,a,comentario})}/>
        <div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" disabled={!produto || ocupado} onClick={()=>setSimular(true)}><FlaskConical className="h-4 w-4"/>Simular follow-up deste produto</Button><Button asChild size="sm" variant="ghost"><Link to="/lia-teste">Conversa livre</Link></Button></div>
        <details className="border-t border-border pt-3"><summary className="cursor-pointer text-sm font-medium">Execuções anteriores</summary><div className="space-y-3 pt-3">{(q.data??[]).filter(e=>e.cenario_id===cenario.id&&e.id!==ultima.get(cenario.id)?.id).map(e=><LiaCenarioCard key={e.id} cenario={cenario} execucao={e} bloqueado rodando={false} desatualizado onRodar={()=>{}} onAvaliar={()=>{}}/>)}</div></details>
      </section>}
    </div><p className="text-xs text-muted-foreground">Simulações com clientes fictícios. Avaliações não treinam o cérebro nem ligam disparos automaticamente.</p>
    {simular&&produto&&<LiaFollowupSimulacao produto={produto} onClose={()=>setSimular(false)}/>}
  </div>;
}