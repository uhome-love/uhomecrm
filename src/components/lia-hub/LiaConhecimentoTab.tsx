import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, BookOpen, ExternalLink, FlaskConical, Lock, Pencil, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatBRT } from "@/lib/brtTime";
import { useLiaConhecimento } from "./useLiaConhecimento";
import { grupoFicha, materiaisFicha, nomeFicha, type FichaLia } from "./liaConhecimento";
import LiaFichaEditor from "./LiaFichaEditor";
import LiaFollowupSimulacao from "./LiaFollowupSimulacao";
import LiaLeituraAviso from "./LiaLeituraAviso";

export default function LiaConhecimentoTab() {
  const q = useLiaConhecimento();
  const [busca, setBusca] = useState("");
  const [grupo, setGrupo] = useState<"natal" | "outros" | "anteriores">("natal");
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [editar, setEditar] = useState<FichaLia | null>(null);
  const [simular, setSimular] = useState<FichaLia | null>(null);
  const produtos = (q.data ?? []).filter((p) => grupoFicha(p) === grupo && nomeFicha(p).toLocaleLowerCase("pt-BR").includes(busca.toLocaleLowerCase("pt-BR")));
  const produto = q.data?.find((p) => p.id === selecionado) ?? produtos[0];
  if (q.isLoading) return <p role="status" className="py-10 text-sm text-muted-foreground">Carregando fichas…</p>;
  if (q.isError) return <LiaLeituraAviso titulo="Não foi possível ler as fichas dos empreendimentos." tentar={() => void q.refetch()} />;
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-2 border-y border-border py-3">
      <div><p className="text-sm font-semibold">Conhecimento dos empreendimentos</p><p className="mt-1 text-xs text-muted-foreground">Fichas cadastradas · Campanha Natal até 18/12/2026</p></div>
      <Badge variant="outline"><Lock className="mr-1 h-3 w-3" />Sem ativação de campanhas</Badge>
    </div>
    <div className="flex flex-wrap gap-2" role="group" aria-label="Grupo de fichas">
      {([['natal', 'Campanha Natal'], ['outros', 'Outros produtos'], ['anteriores', 'Versões anteriores']] as const).map(([g,r]) =>
        <Button key={g} size="sm" variant={grupo === g ? "secondary" : "ghost"} aria-pressed={grupo === g} onClick={() => { setGrupo(g); setSelecionado(null); }}>{r}</Button>)}
    </div>
    <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,.8fr)_minmax(0,1.2fr)]">
      <section aria-label="Empreendimentos" className={cn("min-w-0", selecionado && "hidden lg:block")}>
        <div className="relative mb-3"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input aria-label="Buscar empreendimento" placeholder="Buscar empreendimento" value={busca} onChange={(e) => setBusca(e.target.value)} className="pl-9" /></div>
        <div className="divide-y divide-border border-y border-border">
          {produtos.map((p) => <Button key={p.id} variant="ghost" onClick={() => setSelecionado(p.id)} aria-pressed={p.id === produto?.id}
            className={cn("h-auto w-full justify-between gap-3 whitespace-normal rounded-none px-3 py-4 text-left", p.id === produto?.id && "bg-accent text-accent-foreground")}>
            <span className="min-w-0"><span className="block text-sm font-semibold">{nomeFicha(p)}</span><span className="mt-1 block text-xs font-normal text-muted-foreground">{materiaisFicha(p).length} materiais · {formatBRT(p.updated_at, "dd/MM HH:mm")}</span></span>
            <Badge variant={p.ativo ? "secondary" : "outline"} className="shrink-0 text-[10px]">{p.ativo ? "Disponível" : "Desligada"}</Badge>
          </Button>)}
        </div>
        {!produtos.length && <p className="py-10 text-sm text-muted-foreground">Nenhuma ficha encontrada.</p>}
      </section>
      {produto && <section aria-label="Ficha selecionada" className={cn("min-w-0 overflow-hidden rounded-xl border border-border bg-card", !selecionado && "hidden lg:block")}>
        <div className="flex items-start justify-between gap-3 border-b border-border p-4 sm:p-5">
          <div><Button variant="ghost" size="sm" className="mb-2 lg:hidden" onClick={() => setSelecionado(null)}><ArrowLeft className="h-4 w-4" />Empreendimentos</Button>
            <h2 className="text-lg font-semibold">{nomeFicha(produto)}</h2><p className="mt-1 text-xs text-muted-foreground">Atualizada em {formatBRT(produto.updated_at, "dd/MM/yyyy HH:mm")} · Brasília</p></div><BookOpen className="h-5 w-5 shrink-0 text-primary" />
        </div>
        <div className="space-y-4 p-4 sm:p-5">
          <details className="group" open><summary className="cursor-pointer text-sm font-semibold">Ficha completa</summary>
            <pre className="mt-3 max-h-[440px] overflow-y-auto whitespace-pre-wrap break-words rounded-md bg-muted/50 p-3 font-sans text-xs leading-relaxed">{produto.ficha || "Ficha sem conteúdo."}</pre></details>
          <details><summary className="cursor-pointer text-sm font-semibold">Fotos e materiais · {materiaisFicha(produto).length}</summary>
            <div className="mt-2 divide-y divide-border">{materiaisFicha(produto).map(([nome,url]) => <a key={nome} href={url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between gap-3 py-2 text-xs text-primary"><span className="break-all">{nome}</span><ExternalLink className="h-3.5 w-3.5 shrink-0" /></a>)}</div>
            {!materiaisFicha(produto).length && <p className="mt-2 text-xs text-muted-foreground">Sem materiais vinculados a este produto.</p>}</details>
          <p className="flex items-start gap-2 border-t border-border pt-3 text-xs text-muted-foreground"><Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />Ficha disponível não significa anúncio ligado. Informações e materiais pertencem a este empreendimento.</p>
        </div>
        <div className="flex flex-wrap justify-between gap-2 border-t border-border p-4">
          <Button size="sm" variant="outline" onClick={() => setSimular(produto)} disabled={!produto.ativo}><FlaskConical className="h-4 w-4" />Simular follow-up</Button>
          <Button size="sm" onClick={() => setEditar(produto)} disabled={grupoFicha(produto) === "anteriores"}><Pencil className="h-4 w-4" />Editar ficha</Button>
        </div>
      </section>}
    </div>
    {editar && <LiaFichaEditor key={editar.id} produto={editar} saving={q.salvar.isPending} onClose={() => setEditar(null)} onSave={(ficha) => q.salvar.mutateAsync({ produto: editar, ficha })} />}
    {simular && <LiaFollowupSimulacao produto={simular} onClose={() => setSimular(null)} />}
  </div>;
}
