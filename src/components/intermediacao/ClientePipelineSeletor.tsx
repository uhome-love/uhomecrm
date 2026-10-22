import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X } from "lucide-react";

export interface ClienteSelecionado {
  pipelineLeadId: string;
  negocioId: string | null;
  nome: string;
  telefone: string;
  email: string;
  empreendimento: string;
  unidade: string;
  vgv: number;
  corretorAuthId: string | null;
}

interface LeadRow {
  id: string; nome: string | null; telefone: string | null; email: string | null;
  empreendimento: string | null; negocio_id: string | null; corretor_id: string | null;
}

export function ClientePipelineSeletor({
  value, onSelect, onClear,
}: { value: ClienteSelecionado | null; onSelect: (c: ClienteSelecionado) => void; onClear: () => void }) {
  const [busca, setBusca] = useState("");
  const [resultados, setResultados] = useState<LeadRow[]>([]);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    const leadId = new URLSearchParams(window.location.search).get("lead");
    if (!leadId || value) return;
    let ativo = true;
    async function abrirCliente() {
      const { data, error } = await supabase.from("pipeline_leads")
        .select("id,nome,telefone,email,empreendimento,negocio_id,corretor_id")
        .eq("id", leadId).maybeSingle();
      if (ativo && data && !error) await escolher(data);
    }
    void abrirCliente();
    return () => { ativo = false; };
  }, []);

  useEffect(() => {
    const termo = busca.trim();
    if (termo.length < 3) { setResultados([]); return; }
    const t = setTimeout(async () => {
      setCarregando(true);
      const { data } = await supabase
        .from("pipeline_leads")
        .select("id, nome, telefone, email, empreendimento, negocio_id, corretor_id")
        .ilike("nome", `%${termo}%`)
        .limit(8);
      setResultados((data ?? []) as LeadRow[]);
      setCarregando(false);
    }, 300);
    return () => clearTimeout(t);
  }, [busca]);

  const escolher = async (l: LeadRow) => {
    let unidade = "", vgv = 0, empreendimento = l.empreendimento ?? "";
    let negocioId = l.negocio_id;
    const q = supabase.from("negocios").select("id, empreendimento, unidade, vgv_final, vgv_estimado");
    const { data: neg } = negocioId
      ? await q.eq("id", negocioId).maybeSingle()
      : await q.eq("pipeline_lead_id", l.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (neg) {
      negocioId = neg.id;
      unidade = neg.unidade ?? "";
      vgv = Number(neg.vgv_final ?? neg.vgv_estimado ?? 0);
      empreendimento = neg.empreendimento || empreendimento;
    }
    onSelect({
      pipelineLeadId: l.id, negocioId, nome: l.nome ?? "", telefone: l.telefone ?? "", email: l.email ?? "",
      empreendimento, unidade, vgv, corretorAuthId: l.corretor_id,
    });
    setBusca(""); setResultados([]);
  };

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">1. Cliente do Pipeline</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {value ? (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-primary bg-primary/5 p-3">
            <div className="text-sm">
              <p className="font-medium text-foreground">{value.nome}</p>
              <p className="text-muted-foreground">
                {value.empreendimento || "Sem empreendimento"}{value.unidade ? ` · Unidade ${value.unidade}` : ""}
                {value.negocioId ? " · venda ligada" : " · sem negócio aberto"}
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={onClear}><X className="h-4 w-4 mr-1" /> Trocar</Button>
          </div>
        ) : (
          <>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar cliente pelo nome (mín. 3 letras)" />
            </div>
            {carregando && <p className="text-xs text-muted-foreground">Buscando...</p>}
            {resultados.length > 0 && (
              <div className="rounded-lg border divide-y">
                {resultados.map((l) => (
                  <button key={l.id} type="button" onClick={() => escolher(l)} className="w-full text-left px-3 py-2 text-sm hover:bg-muted">
                    <span className="font-medium text-foreground">{l.nome}</span>
                    <span className="text-muted-foreground"> · {l.telefone ?? "sem telefone"} · {l.empreendimento ?? "—"}</span>
                  </button>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">Ao escolher o cliente, comprador, empreendimento, unidade, VGV e corretor são preenchidos.</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
