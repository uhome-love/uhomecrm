import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Lock, Save } from "lucide-react";
import { formatBRT } from "@/lib/brtTime";
import { PROPOSTA_ENVIO, validarEnvio, type EnvioProgramado } from "@/lia/envioProgramado";
import { useLiaConfiguracoes } from "./useLiaConfiguracoes";
import LiaLeituraAviso from "./LiaLeituraAviso";

const DIAS=["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
export default function LiaConfiguracoesTab() {
  const q=useLiaConfiguracoes();
  const [draft,setDraft]=useState<EnvioProgramado>(PROPOSTA_ENVIO);
  const [revisar,setRevisar]=useState(false);
  useEffect(()=>{if(q.data)setDraft(q.data.config??PROPOSTA_ENVIO);},[q.data]);
  if(q.isLoading)return <p role="status" className="py-10 text-sm text-muted-foreground">Carregando configurações…</p>;
  if(q.isError||!q.data)return <LiaLeituraAviso titulo="Configurações indisponíveis ou sem permissão administrativa." tentar={()=>void q.refetch()}/>;
  const data=q.data;
  const erro=validarEnvio(draft);
  const mudou=JSON.stringify(draft)!==JSON.stringify(data.config);
  const salvar=async()=>{try{await q.salvar.mutateAsync({config:draft,versao:data.versao});setRevisar(false);}catch{/* rascunho mantido */}};
  const field=(key:"limite_dia"|"espera_horas",label:string)=><div><label htmlFor={key} className="mb-2 block text-xs font-semibold">{label}</label><Input id={key} type="number" min={key==="limite_dia"?1:24} max={key==="limite_dia"?100:2160} value={draft[key]} onChange={e=>setDraft({...draft,[key]:Number(e.target.value)})}/></div>;
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3 border-y border-border py-3"><div><p className="text-sm font-semibold">Estado dos envios preservado</p><p className="mt-1 text-xs text-muted-foreground">Salvar não liga o motor nem retoma lotes.</p></div><Badge variant="outline"><Lock className="mr-1 h-3 w-3"/>Sem ativação</Badge></div>
    <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,.8fr)]">
      <section className="space-y-5">
        <div><h2 className="text-lg font-semibold">Envio programado</h2><p className="mt-1 text-xs text-muted-foreground">Recuperação e follow-ups · Brasília</p></div>
        {!data.config&&<p className="border-l-2 border-warning pl-3 text-sm text-muted-foreground">Ainda não há parâmetros unificados salvos. Os valores abaixo são a proposta do piloto; abrir esta tela não os aplica.</p>}
        <div className="grid grid-cols-2 gap-4">{field("limite_dia","Teto diário total do piloto")}{field("espera_horas","Espera após descarte (horas)")}
          {([['inicio','Início'],['fim','Fim']] as const).map(([k,r])=><div key={k}><label htmlFor={`envio-${k}`} className="mb-2 block text-xs font-semibold">{r} do envio · 24h</label><Input id={`envio-${k}`} type="text" inputMode="numeric" maxLength={5} placeholder="HH:MM" value={draft[k]} onChange={e=>{const digits=e.target.value.replace(/\D/g,"").slice(0,4);setDraft({...draft,[k]:digits.length>2?`${digits.slice(0,2)}:${digits.slice(2)}`:digits});}}/></div>)}</div>
        <fieldset><legend className="mb-2 text-xs font-semibold">Dias permitidos</legend><div className="flex flex-wrap gap-2">{DIAS.map((d,i)=><Button key={d} size="sm" variant={draft.dias.includes(i)?"default":"outline"} aria-pressed={draft.dias.includes(i)} onClick={()=>setDraft({...draft,dias:draft.dias.includes(i)?draft.dias.filter(v=>v!==i):[...draft.dias,i].sort()})}>{d}</Button>)}</div></fieldset>
        <p className="text-xs text-muted-foreground">O teto diário inclui tentativas de contato entre lotes e follow-ups de recuperação. Falhas ou resultados incertos mantêm a reserva e exigem revisão antes de uma nova tentativa.</p>
        {erro&&<p role="alert" className="text-sm text-destructive">{erro}</p>}
        <section className="border-t border-border pt-4"><h2 className="mb-3 text-lg font-semibold">Regras protegidas</h2>{["Somente descartes com origem confirmada","Opt-out impede novo contato","Recuperado vai para Fila CEO com contexto","Não devolver ao corretor que descartou","Fora de 24h no WhatsApp: modelo aprovado"].map(r=><div key={r} className="flex items-center justify-between gap-3 border-b border-border py-3 text-sm"><span>{r}</span><Lock className="h-4 w-4 shrink-0 text-muted-foreground"/></div>)}</section>
      </section>
      <aside className="space-y-5"><section><h2 className="mb-3 text-lg font-semibold">Estado atual</h2><div className="flex flex-wrap justify-between gap-2 border-b border-border py-3 text-sm"><span>Motor antigo de reengajamento</span><Badge variant="secondary">{data.motor===null?"Não confirmado":data.motor?"Habilitado":"Desabilitado"}</Badge></div>
        <div className="flex justify-between border-b border-border py-3 text-sm"><span>Lotes ativos</span><b>{data.lotes.filter(l=>l.status==="ativo").length}</b></div>
        {data.lotes.map((l,i)=><div key={i} className="flex justify-between gap-3 border-b border-border py-3 text-sm"><span className="capitalize">Lote {l.status}</span><b>{l.cap_dia}/dia</b></div>)}
        <p className="mt-3 text-xs text-muted-foreground">Limites por lote continuam independentes do teto unificado. O menor limite disponível prevalece.</p></section>
        <section className="border-t border-border pt-4"><h2 className="text-base font-semibold">Atendimento isolado</h2><p className="mt-2 text-xs text-muted-foreground">Envio {data.isolado.envio?"habilitado":"desabilitado"} · {data.isolado.inicio.slice(0,5)}–{data.isolado.fim.slice(0,5)}. Não alterado por este formulário.</p><p className="mt-2 text-xs text-muted-foreground">A cadência Natal planejada não é ativada por estes controles.</p></section>
        <details className="border-t border-border pt-4"><summary className="cursor-pointer text-sm font-semibold">Histórico de alterações</summary>{data.historico.length?data.historico.map((h,i)=><div key={i} className="border-b border-border py-3 text-xs"><b>{formatBRT(h.created_at,"dd/MM/yyyy HH:mm")}</b><p className="mt-1 text-muted-foreground">{h.depois.limite_dia}/dia · {h.depois.inicio}–{h.depois.fim} · espera {h.depois.espera_horas}h</p></div>):<p className="mt-3 text-xs text-muted-foreground">Nenhuma alteração registrada nesta configuração.</p>}</details>
      </aside>
    </div>
    <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4"><Button variant="ghost" onClick={()=>setDraft(data.config??PROPOSTA_ENVIO)}>Cancelar</Button><Button disabled={!!erro||!mudou||q.salvar.isPending} onClick={()=>setRevisar(true)}><Save className="h-4 w-4"/>Revisar alterações</Button></div>
    <Dialog open={revisar} onOpenChange={open=>{if(!q.salvar.isPending)setRevisar(open);}}><DialogContent><DialogHeader><DialogTitle>Confirmar parâmetros de envio</DialogTitle><DialogDescription>Motor, lotes e campanhas não serão ativados ou retomados.</DialogDescription></DialogHeader>
      <div className="space-y-2 text-sm"><p>Teto: <b>{data.config?.limite_dia??"Não unificado"} → {draft.limite_dia}/dia</b></p><p>Horário: <b>{data.config?`${data.config.inicio}–${data.config.fim}`:"Legado 09h–20h"} → {draft.inicio}–{draft.fim}</b></p><p>Dias: <b>{draft.dias.map(d=>DIAS[d]).join(", ")}</b></p><p>Espera após descarte: <b>{draft.espera_horas} horas</b></p></div>
      <div className="flex flex-wrap justify-end gap-2"><Button variant="ghost" disabled={q.salvar.isPending} onClick={()=>setRevisar(false)}>Cancelar</Button><Button onClick={()=>void salvar()} disabled={q.salvar.isPending}>{q.salvar.isPending?<Loader2 className="h-4 w-4 animate-spin"/>:<Save className="h-4 w-4"/>}Confirmar sem ativar</Button></div>
    </DialogContent></Dialog>
  </div>;
}