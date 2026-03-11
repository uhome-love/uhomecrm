import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Loader2, Upload, FileText } from "lucide-react";
import type { Negocio } from "@/hooks/useNegocios";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  negocio: Negocio;
}

export default function SolicitarPagadoriaDialog({ open, onOpenChange, negocio }: Props) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);

  // Form
  const [cpf, setCpf] = useState("");
  const [rg, setRg] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState(negocio.telefone || "");
  const [empreendimento, setEmpreendimento] = useState(negocio.empreendimento || "");
  const [unidade, setUnidade] = useState("");
  const [vgv, setVgv] = useState(negocio.vgv_estimado ? String(negocio.vgv_estimado) : "");
  const [percentual, setPercentual] = useState("");
  const [observacoes, setObservacoes] = useState("");

  // File uploads
  const [rgFile, setRgFile] = useState<File | null>(null);
  const [cpfFile, setCpfFile] = useState<File | null>(null);
  const [comprovanteFile, setComprovanteFile] = useState<File | null>(null);
  const [fichaFile, setFichaFile] = useState<File | null>(null);

  const uploadFile = async (file: File, folder: string): Promise<string | null> => {
    const ext = file.name.split(".").pop();
    const path = `${negocio.id}/${folder}_${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("pagadoria-docs").upload(path, file);
    if (error) { console.error("Upload error:", error); return null; }
    return path;
  };

  const handleSubmit = async () => {
    if (!user) return;
    if (!cpf.trim() && !rg.trim()) {
      toast.error("Preencha pelo menos CPF ou RG do comprador");
      return;
    }
    setSaving(true);
    try {
      // Upload docs
      const [rgUrl, cpfUrl, comprovanteUrl, fichaUrl] = await Promise.all([
        rgFile ? uploadFile(rgFile, "rg") : null,
        cpfFile ? uploadFile(cpfFile, "cpf") : null,
        comprovanteFile ? uploadFile(comprovanteFile, "comprovante") : null,
        fichaFile ? uploadFile(fichaFile, "ficha") : null,
      ]);

      const { error } = await supabase.from("pagadoria_solicitacoes").insert({
        negocio_id: negocio.id,
        solicitante_id: user.id,
        nome_cliente: negocio.nome_cliente,
        cpf: cpf.trim() || null,
        rg: rg.trim() || null,
        email: email.trim() || null,
        telefone: telefone.trim() || null,
        empreendimento: empreendimento.trim() || null,
        unidade: unidade.trim() || null,
        vgv_contrato: vgv ? parseFloat(vgv) : null,
        percentual_comissao: percentual ? parseFloat(percentual) : null,
        rg_url: rgUrl,
        cpf_url: cpfUrl,
        comprovante_residencia_url: comprovanteUrl,
        ficha_construtora_url: fichaUrl,
        observacoes: observacoes.trim() || null,
        status: "enviado",
      });

      if (error) throw error;
      toast.success("📋 Pagadoria solicitada com sucesso!");
      onOpenChange(false);
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao solicitar pagadoria: " + (err.message || ""));
    } finally {
      setSaving(false);
    }
  };

  const FileInput = ({ label, file, onFile }: { label: string; file: File | null; onFile: (f: File | null) => void }) => (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-border hover:border-primary/50 cursor-pointer transition-colors mt-1">
        {file ? <FileText className="h-4 w-4 text-primary shrink-0" /> : <Upload className="h-4 w-4 text-muted-foreground shrink-0" />}
        <span className="text-xs truncate text-muted-foreground">{file ? file.name : "Selecionar arquivo..."}</span>
        <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={e => onFile(e.target.files?.[0] || null)} />
      </label>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            📋 Solicitar Pagadoria
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            Cliente: <strong>{negocio.nome_cliente}</strong>
          </p>
        </DialogHeader>

        <div className="space-y-4">
          {/* Dados do comprador */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">Dados do Comprador</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">CPF *</Label>
                <Input value={cpf} onChange={e => setCpf(e.target.value)} placeholder="000.000.000-00" className="h-9 text-sm" />
              </div>
              <div>
                <Label className="text-xs">RG</Label>
                <Input value={rg} onChange={e => setRg(e.target.value)} className="h-9 text-sm" />
              </div>
              <div>
                <Label className="text-xs">E-mail</Label>
                <Input value={email} onChange={e => setEmail(e.target.value)} type="email" className="h-9 text-sm" />
              </div>
              <div>
                <Label className="text-xs">Telefone</Label>
                <Input value={telefone} onChange={e => setTelefone(e.target.value)} className="h-9 text-sm" />
              </div>
            </div>
          </div>

          {/* Dados do negócio */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">Dados do Contrato</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Empreendimento</Label>
                <Input value={empreendimento} onChange={e => setEmpreendimento(e.target.value)} className="h-9 text-sm" />
              </div>
              <div>
                <Label className="text-xs">Unidade</Label>
                <Input value={unidade} onChange={e => setUnidade(e.target.value)} className="h-9 text-sm" />
              </div>
              <div>
                <Label className="text-xs">VGV do Contrato (R$)</Label>
                <Input value={vgv} onChange={e => setVgv(e.target.value)} type="number" className="h-9 text-sm" />
              </div>
              <div>
                <Label className="text-xs">% Comissão</Label>
                <Input value={percentual} onChange={e => setPercentual(e.target.value)} type="number" step="0.1" placeholder="5.0" className="h-9 text-sm" />
              </div>
            </div>
          </div>

          {/* Documentos */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">Documentos</h4>
            <div className="grid grid-cols-2 gap-3">
              <FileInput label="RG (frente/verso)" file={rgFile} onFile={setRgFile} />
              <FileInput label="CPF" file={cpfFile} onFile={setCpfFile} />
              <FileInput label="Comprovante de Residência" file={comprovanteFile} onFile={setComprovanteFile} />
              <FileInput label="Ficha da Construtora" file={fichaFile} onFile={setFichaFile} />
            </div>
          </div>

          {/* Observações */}
          <div>
            <Label className="text-xs">Observações</Label>
            <Textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} placeholder="Instruções especiais..." className="text-sm h-16" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="text-xs">Cancelar</Button>
          <Button size="sm" onClick={handleSubmit} disabled={saving} className="text-xs gap-1">
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileText className="h-3 w-3" />}
            Solicitar Pagadoria
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
