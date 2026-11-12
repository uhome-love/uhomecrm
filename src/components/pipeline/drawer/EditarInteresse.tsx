// Editor do "Interesse" do lead: escolher empreendimento oficial ou digitar.
// Grava só via RPC alterar_interesse_lead (atualiza empreendimento+campanha e registra na linha do tempo).
import { useEffect, useMemo, useState } from "react";
import { Check, Pencil } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type Produto = { id: string; nome: string };

export default function EditarInteresse({ leadId, atual, onSalvo }: { leadId: string; atual: string | null; onSalvo: (nome: string) => void }) {
  const [aberto, setAberto] = useState(false);
  const [modo, setModo] = useState<"lista" | "digitar">("lista");
  const [busca, setBusca] = useState("");
  const [manual, setManual] = useState("");
  const [escolhido, setEscolhido] = useState<Produto | null>(null);
  const [produtos, setProdutos] = useState<Produto[] | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!aberto || produtos) return;
    supabase.from("empreendimentos_canonicos").select("id, nome").eq("ativo", true).order("nome")
      .then(({ data, error }) => { if (error) toast.error("Não foi possível carregar os empreendimentos."); setProdutos((data ?? []) as Produto[]); });
  }, [aberto, produtos]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return (produtos ?? []).filter((p) => !q || p.nome.toLowerCase().includes(q)).slice(0, 50);
  }, [produtos, busca]);

  const podeSalvar = modo === "lista" ? !!escolhido : manual.trim().length >= 2;

  const salvar = async () => {
    if (!podeSalvar) return;
    setSalvando(true);
    const { data, error } = await supabase.rpc("alterar_interesse_lead", {
      p_lead_id: leadId,
      p_nome: modo === "lista" ? escolhido!.nome : manual.trim(),
      p_canonico_id: modo === "lista" ? escolhido!.id : null,
    });
    setSalvando(false);
    if (error) { toast.error("Não foi possível alterar o interesse."); return; }
    onSalvo(String(data));
    toast.success("Interesse atualizado");
    setAberto(false);
  };

  const abrir = (v: boolean) => { setAberto(v); if (v) { setModo("lista"); setBusca(""); setManual(""); setEscolhido(null); } };
  const atualNorm = (atual ?? "").trim().toLowerCase();

  return (
    <Popover open={aberto} onOpenChange={abrir}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" aria-label="Alterar interesse" className="ml-1.5 h-6 w-6 shrink-0"><Pencil className="h-3 w-3" /></Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(320px,calc(100vw-24px))] p-3">
        <p className="mb-2 text-xs text-muted-foreground">Alterar interesse</p>
        <div className="mb-2.5 grid grid-cols-2 gap-1.5">
          {(["lista", "digitar"] as const).map((m) => (
            <Button key={m} size="sm" variant={modo === m ? "default" : "secondary"} onClick={() => setModo(m)}>{m === "lista" ? "Da lista" : "Digitar"}</Button>
          ))}
        </div>
        {modo === "lista" ? (
          <>
            <input autoFocus value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar empreendimento..." aria-label="Buscar empreendimento"
              className="w-full rounded-md border border-border bg-card px-2.5 py-2 text-sm text-foreground focus:border-primary/60 focus:outline-none" />
            <div className="mt-1.5 max-h-56 overflow-y-auto">
              {produtos === null ? <p className="p-2 text-sm text-muted-foreground">Carregando...</p>
                : filtrados.length === 0 ? <p className="p-2 text-sm text-muted-foreground">Nenhum encontrado. Use "Digitar".</p>
                : filtrados.map((p) => {
                  const sel = escolhido?.id === p.id;
                  return (
                    <button key={p.id} type="button" onClick={() => setEscolhido(p)}
                      className={`flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-sm ${sel ? "bg-primary/10 font-semibold text-primary" : "text-foreground hover:bg-muted"}`}>
                      <span>{p.nome}{p.nome.trim().toLowerCase() === atualNorm ? <span className="font-normal text-muted-foreground"> (atual)</span> : null}</span>
                      {sel && <Check className="h-4 w-4" />}
                    </button>
                  );
                })}
            </div>
          </>
        ) : (
          <>
            <input autoFocus value={manual} maxLength={120} onChange={(e) => setManual(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void salvar(); }}
              placeholder="Nome do produto" aria-label="Nome do produto"
              className="w-full rounded-md border border-border bg-card px-2.5 py-2 text-sm text-foreground focus:border-primary/60 focus:outline-none" />
            <p className="mt-1.5 text-xs text-muted-foreground">Produto fora da lista oficial.</p>
          </>
        )}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={() => setAberto(false)}>Cancelar</Button>
          <Button onClick={() => void salvar()} disabled={!podeSalvar || salvando}>{salvando ? "Salvando..." : "Salvar"}</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
