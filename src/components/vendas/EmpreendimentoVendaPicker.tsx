import { useState } from "react";
import { Check, ChevronsUpDown, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import type { EmpreendimentoVenda } from "@/hooks/useConfirmarVenda";

interface Props {
  value: string;
  onChange: (id: string) => void;
  empreendimentos: EmpreendimentoVenda[];
  onCriado: (emp: EmpreendimentoVenda) => void;
}

type Tipo = "empreendimento" | "avulso";

/** Campo de empreendimento da venda: busca em todo o cadastro (ativos primeiro) e permite adicionar imóvel avulso/empreendimento novo. */
export function EmpreendimentoVendaPicker({ value, onChange, empreendimentos, onCriado }: Props) {
  const [aberto, setAberto] = useState(false);
  const [adicionando, setAdicionando] = useState(false);
  const [tipo, setTipo] = useState<Tipo>("avulso");
  const [nome, setNome] = useState("");
  const [construtora, setConstrutora] = useState("Imóvel de terceiros");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const atual = empreendimentos.find(e => e.id === value);

  function abrirAdicionar(busca: string) {
    setAberto(false); setAdicionando(true); setErro(null);
    setNome(busca); setTipo("avulso"); setConstrutora("Imóvel de terceiros");
  }

  async function salvar() {
    setSalvando(true); setErro(null);
    const { data, error } = await supabase.rpc("criar_empreendimento_venda", { p_nome: nome, p_construtora: construtora, p_tipo: tipo });
    setSalvando(false);
    if (error || !data) { setErro(error?.message ?? "Não foi possível salvar."); return; }
    const existente = empreendimentos.find(e => e.id === data);
    onCriado(existente ?? { id: data, nome: nome.trim().replace(/\s+/g, " "), construtora: construtora.trim() || "Imóvel de terceiros", ativo: false });
    onChange(data);
    setAdicionando(false);
  }

  const [busca, setBusca] = useState("");

  if (adicionando) {
    return <div className="space-y-2.5 rounded-lg border border-primary/40 bg-primary/5 p-3">
      <p className="text-sm font-semibold">Adicionar imóvel ou empreendimento</p>
      <div className="grid grid-cols-2 gap-2">
        {([["empreendimento", "Empreendimento novo", ""], ["avulso", "Imóvel avulso", "terceiros, revenda"]] as const).map(([v, l, d]) =>
          <button key={v} type="button" onClick={() => { setTipo(v); setConstrutora(v === "avulso" ? "Imóvel de terceiros" : ""); }}
            className={cn("rounded-lg border p-2 text-left text-sm", tipo === v ? "border-primary bg-primary/10 ring-1 ring-primary" : "border-border bg-background hover:bg-muted")}>
            <span className="block font-medium">{l}</span>{d && <span className="block text-xs text-muted-foreground">{d}</span>}
          </button>)}
      </div>
      <div className="space-y-1"><Label htmlFor="emp-novo-nome">Nome</Label><Input id="emp-novo-nome" value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex.: Apto Rua Ramiro Barcelos 1200" autoFocus /></div>
      <div className="space-y-1"><Label htmlFor="emp-novo-cons">Construtora</Label><Input id="emp-novo-cons" value={construtora} onChange={e => setConstrutora(e.target.value)} placeholder="Ex.: Cyrela" /></div>
      <p className="text-xs text-muted-foreground">Fica só para vendas: não entra na Roleta, Foco nem anúncios.</p>
      {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={() => setAdicionando(false)} disabled={salvando}>Cancelar</Button>
        <Button size="sm" onClick={() => void salvar()} disabled={salvando || nome.trim().length < 3 || !construtora.trim()}>{salvando && <Loader2 className="mr-1.5 size-4 animate-spin" />}Salvar e usar</Button>
      </div>
    </div>;
  }

  return <Popover open={aberto} onOpenChange={setAberto}>
    <PopoverTrigger asChild>
      <Button variant="outline" role="combobox" aria-label="Empreendimento" aria-expanded={aberto} className="w-full justify-between font-normal">
        <span className={cn("truncate", !atual && "text-muted-foreground")}>{atual?.nome ?? "Selecionar empreendimento ou imóvel"}</span>
        <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
      </Button>
    </PopoverTrigger>
    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
      <Command>
        <CommandInput placeholder="Buscar empreendimento ou imóvel..." value={busca} onValueChange={setBusca} />
        <CommandList className="max-h-64">
          <CommandEmpty>Nada encontrado.</CommandEmpty>
          <CommandGroup>
            {empreendimentos.map(e => <CommandItem key={e.id} value={`${e.nome} ${e.id}`} onSelect={() => { onChange(e.id); setAberto(false); }}>
              <Check className={cn("mr-2 size-4", value === e.id ? "opacity-100" : "opacity-0")} />
              <span className={cn("truncate", !e.ativo && "text-muted-foreground")}>{e.nome}</span>
              {!e.ativo && <span className="ml-2 shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">fora de linha</span>}
            </CommandItem>)}
          </CommandGroup>
        </CommandList>
        <button type="button" onClick={() => abrirAdicionar(busca)} className="flex w-full items-center gap-1.5 border-t border-border px-3 py-2.5 text-sm font-semibold text-primary hover:bg-muted">
          <Plus className="size-4" />Adicionar imóvel ou empreendimento
        </button>
      </Command>
    </PopoverContent>
  </Popover>;
}
