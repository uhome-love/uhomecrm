import { useState } from "react";
import { Loader2, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { MODELOS_RECUPERA } from "@/lia/recupera";

interface Exemplo { modelo: string; texto: string; porque: string; motivo_descarte: string; empreendimento_original: string | null; empreendimento_convertido: string | null; caminho?: string; imovel_lembrete?: string }
interface Resultado {
  ok: boolean; error?: string; vigente: boolean; base_total: number;
  totais: { A: number; B: number; C: number; D: number; sem_nome: number };
  caminhos_lembrete: { proprio: number; tabela: number; open_bosque: number };
  nao_converteu: { nome: string; n: number }[];
  exemplos: Record<string, Exemplo[]>;
}

const CAMINHO: Record<string, string> = { proprio: "Próprio imóvel de Natal", tabela: "Tabela de troca", open_bosque: "Open Bosque (padrão)" };

export default function LiaRecuperaSimulacao() {
  const [dados, setDados] = useState<Resultado | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const simular = async () => {
    setCarregando(true); setErro(null);
    const { data, error } = await supabase.functions.invoke<Resultado>("lia-recupera-simular", { body: {} });
    setCarregando(false);
    if (error || !data?.ok) { setErro(data?.error ?? "Não foi possível simular agora."); return; }
    setDados(data);
  };

  return <section className="space-y-5 border-t border-border pt-5">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="text-sm font-semibold text-foreground">Simular envio</h2>
        <p className="mt-1 text-xs text-muted-foreground">Mostra a mensagem final de clientes reais. Nada é enviado.</p>
      </div>
      <Button onClick={simular} disabled={carregando} size="sm">
        {carregando ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}Simular envio
      </Button>
    </header>
    {erro && <p className="text-sm text-destructive">{erro}</p>}
    {dados && <>
      {!dados.vigente && <p className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs text-foreground">Campanha encerrada (após 18/12): nenhum dos 6 modelos seria enviado.</p>}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {([["Base", dados.base_total], ["A", dados.totais.A], ["B", dados.totais.B], ["C", dados.totais.C], ["D", dados.totais.D], ["Sem nome", dados.totais.sem_nome]] as const).map(([r, v]) =>
          <div key={r} className="rounded-xl border border-border bg-card p-3"><p className="text-[11px] text-muted-foreground">{r}</p><p className="text-xl font-bold tabular-nums text-foreground">{v.toLocaleString("pt-BR")}</p></div>)}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="mb-2 text-xs font-semibold text-foreground">Caminho do lembrete</h3>
          {Object.entries(dados.caminhos_lembrete).map(([k, v]) => <div key={k} className="flex justify-between border-b border-border py-1.5 text-xs last:border-0"><span className="text-muted-foreground">{CAMINHO[k]}</span><b className="tabular-nums">{v.toLocaleString("pt-BR")}</b></div>)}
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="mb-2 text-xs font-semibold text-foreground">Empreendimentos que não converteram ({dados.nao_converteu.length})</h3>
          <div className="max-h-48 overflow-y-auto">
            {dados.nao_converteu.map((n) => <div key={n.nome} className="flex justify-between gap-3 border-b border-border py-1.5 text-xs last:border-0"><span className="min-w-0 truncate text-muted-foreground">{n.nome}</span><b className="tabular-nums">{n.n}</b></div>)}
          </div>
        </div>
      </div>
      {MODELOS_RECUPERA.map((m) => <div key={m.chave}>
        <h3 className="mb-2 text-xs font-semibold text-foreground">{m.titulo} <span className="font-normal text-muted-foreground">· {m.chave}</span></h3>
        {(dados.exemplos[m.chave] ?? []).length === 0 && <p className="text-xs text-muted-foreground">Nenhum cliente neste modelo.</p>}
        <div className="grid gap-3 lg:grid-cols-2">
          {(dados.exemplos[m.chave] ?? []).map((e, i) => <article key={i} className="grid gap-3 rounded-xl border border-border bg-card p-3 sm:grid-cols-[1fr_200px]">
            <p className="whitespace-pre-wrap break-words rounded-lg bg-muted/50 p-3 text-xs leading-relaxed text-foreground">{e.texto}</p>
            <dl className="space-y-1.5 text-[11px]">
              <Badge variant="secondary" className="text-[10px]">{e.modelo.replace("lia_recupera_", "").toUpperCase()}</Badge>
              <div><dt className="text-muted-foreground">Por quê</dt><dd className="text-foreground">{e.porque}</dd></div>
              <div><dt className="text-muted-foreground">Motivo do descarte</dt><dd className="text-foreground">{e.motivo_descarte}</dd></div>
              <div><dt className="text-muted-foreground">Empreendimento</dt><dd className="break-words text-foreground">{e.empreendimento_original ?? "—"}{e.empreendimento_convertido && ` → ${e.empreendimento_convertido}`}</dd></div>
              {e.imovel_lembrete && <div><dt className="text-muted-foreground">Imóvel do lembrete</dt><dd className="text-foreground">{e.imovel_lembrete} · {CAMINHO[e.caminho ?? ""]}</dd></div>}
            </dl>
          </article>)}
        </div>
      </div>)}
    </>}
  </section>;
}
