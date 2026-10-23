import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileSignature, Loader2, Paperclip, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { comprovantePermitido } from "@/lib/vendaConfirmacao";

export interface VendaParaResolver {
  id: string; nome_cliente: string; pipeline_lead_id: string | null;
  intermediacao_id: string | null; comprovante_ato_path: string | null;
}

const norm = (s: string | null | undefined) => (s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

/** Anexa intermediação e/ou comprovante do ato numa venda assinada. CEO/diretora (validado no servidor). Não mexe em valores. */
export function ResolverPendenciaVenda({ venda, onClose, onEditarDados }: { venda: VendaParaResolver | null; onClose: () => void; onEditarDados?: () => void }) {
  const qc = useQueryClient();
  const [interId, setInterId] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const precisaInter = !!venda && !venda.intermediacao_id;
  const precisaAto = !!venda && !venda.comprovante_ato_path;
  const inters = useQuery({
    queryKey: ["intermediacoes-livres"], enabled: precisaInter,
    queryFn: async () => {
      const r = await supabase.from("intermediacoes").select("id,comprador_nome,empreendimento,unidade").in("status", ["ativa", "pendente_conferencia"]).is("negocio_id", null).order("created_at", { ascending: false });
      if (r.error) throw r.error; return r.data ?? [];
    },
  });
  const primeiro = norm(venda?.nome_cliente).split(" ")[0];
  const lista = [...(inters.data ?? [])].sort((a, b) => Number(!!primeiro && norm(b.comprador_nome).includes(primeiro)) - Number(!!primeiro && norm(a.comprador_nome).includes(primeiro)));

  function fechar() { setInterId(""); setArquivo(null); onClose(); }

  async function salvar() {
    if (!venda || (!interId && !arquivo)) return;
    setSaving(true);
    let path: string | null = null;
    try {
      if (arquivo) {
        const ext = arquivo.name.split(".").pop()?.toLowerCase() || "pdf";
        path = `negocio/${venda.id}/${crypto.randomUUID()}.${ext}`;
        const up = await supabase.storage.from("vendas-docs").upload(path, arquivo, { upsert: false, contentType: arquivo.type });
        if (up.error) throw up.error;
      }
      const r = await supabase.rpc("anexar_documentos_venda", { p_id: venda.id, p_intermediacao_id: interId || null, p_comprovante_path: path });
      if (r.error) throw r.error;
      toast.success("Documentos anexados à venda.");
      void qc.invalidateQueries({ queryKey: ["vendas-pendencias-documentos"] });
      void qc.invalidateQueries({ queryKey: ["intermediacoes-livres"] });
      void qc.invalidateQueries({ predicate: q => String(q.queryKey[0] ?? "").includes("vendas") });
      fechar();
    } catch (e) {
      if (path) void supabase.storage.from("vendas-docs").remove([path]);
      toast.error(e instanceof Error && e.message ? e.message : "Não foi possível anexar.");
    } finally { setSaving(false); }
  }

  return <Sheet open={!!venda} onOpenChange={o => { if (!o) fechar(); }}>
    <SheetContent className="w-full sm:max-w-md overflow-y-auto">
      <SheetHeader><SheetTitle>Resolver pendência</SheetTitle><SheetDescription>{venda?.nome_cliente}</SheetDescription></SheetHeader>
      {venda && <div className="space-y-6 py-5">
        {precisaInter && <div className="space-y-2">
          <Label>Intermediação</Label>
          <Select value={interId} onValueChange={setInterId}>
            <SelectTrigger aria-label="Intermediação"><SelectValue placeholder={inters.isLoading ? "Carregando…" : "Escolher intermediação"} /></SelectTrigger>
            <SelectContent>{lista.map(i => <SelectItem key={i.id} value={i.id}>{i.comprador_nome} · {i.empreendimento} · {i.unidade || "sem unidade"}</SelectItem>)}</SelectContent>
          </Select>
          {!inters.isLoading && lista.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma intermediação livre. Gere uma nova.</p>}
          {venda.pipeline_lead_id && <Button variant="outline" size="sm" asChild><Link to={`/intermediacao?lead=${encodeURIComponent(venda.pipeline_lead_id)}`} target="_blank"><FileSignature className="mr-2 size-4" />Gerar intermediação</Link></Button>}
        </div>}
        {precisaAto && <div className="space-y-2">
          <Label>Comprovante do ato</Label>
          <input ref={input} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="hidden" onChange={e => {
            const f = e.target.files?.[0]; e.target.value = ""; if (!f) return;
            if (!comprovantePermitido(f)) { toast.error("Selecione um PDF ou imagem de até 20 MB."); return; }
            setArquivo(f);
          }} />
          {arquivo ? <div className="flex items-center gap-2 border border-border rounded-lg p-3"><Paperclip className="size-4 text-primary shrink-0" /><span className="text-sm break-all flex-1">{arquivo.name}</span><Button variant="ghost" size="icon" aria-label="Remover arquivo" onClick={() => setArquivo(null)}><X className="size-4" /></Button></div>
            : <Button variant="outline" className="w-full h-12" onClick={() => input.current?.click()}><Upload className="mr-2 size-4" />Anexar PDF ou imagem</Button>}
        </div>}
        {onEditarDados && <Button variant="ghost" size="sm" onClick={onEditarDados}>Corrigir empreendimento, unidade ou VGV</Button>}
        <p className="text-xs text-muted-foreground">Não altera valores, recebimentos nem divisão de comissão. Fica registrado no histórico.</p>
        <div className="flex justify-end gap-2"><Button variant="outline" onClick={fechar}>Cancelar</Button><Button disabled={saving || (!interId && !arquivo)} onClick={() => void salvar()}>{saving && <Loader2 className="mr-2 size-4 animate-spin" />}Salvar</Button></div>
      </div>}
    </SheetContent>
  </Sheet>;
}
