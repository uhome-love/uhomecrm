import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, Loader2, UserPlus, Trash2, Sparkles, FileCheck, AlertCircle, Search } from "lucide-react";
import { toast } from "sonner";

export interface Comprador {
  nome: string;
  cpf: string;
  rg: string;
  nacionalidade: string;
  estado_civil: string;
  telefone: string;
  email: string;
  cep: string;
  endereco: string;
  cidade: string;
  estado: string;
  bairro: string;
  doc_identidade_url: string | null;
  doc_comprovante_url: string | null;
}

const emptyComprador: Comprador = {
  nome: "", cpf: "", rg: "", nacionalidade: "brasileira", estado_civil: "",
  telefone: "", email: "", cep: "", endereco: "", cidade: "", estado: "", bairro: "",
  doc_identidade_url: null, doc_comprovante_url: null,
};

const ESTADOS_CIVIS = [
  { value: "solteiro(a)", label: "Solteiro(a)" },
  { value: "casado(a)", label: "Casado(a)" },
  { value: "divorciado(a)", label: "Divorciado(a)" },
  { value: "viúvo(a)", label: "Viúvo(a)" },
  { value: "união estável", label: "União Estável" },
];

interface Props {
  compradores: Comprador[];
  onChange: (compradores: Comprador[]) => void;
}

export default function CompradorDocUpload({ compradores, onChange }: Props) {
  const [extracting, setExtracting] = useState<Record<string, boolean>>({});
  const [cepLoading, setCepLoading] = useState<Record<number, boolean>>({});

  const updateComprador = (idx: number, field: keyof Comprador, value: string | null) => {
    const updated = [...compradores];
    updated[idx] = { ...updated[idx], [field]: value };
    onChange(updated);
  };

  const addComprador = () => {
    if (compradores.length >= 2) return;
    onChange([...compradores, { ...emptyComprador }]);
  };

  const removeComprador = (idx: number) => {
    if (compradores.length <= 1) return;
    onChange(compradores.filter((_, i) => i !== idx));
  };

  const buscarCep = useCallback(async (idx: number, cep: string) => {
    const cleanCep = cep.replace(/\D/g, "");
    if (cleanCep.length !== 8) return;
    setCepLoading(prev => ({ ...prev, [idx]: true }));
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await res.json();
      if (data.erro) {
        toast.error("CEP não encontrado");
        return;
      }
      const updated = [...compradores];
      updated[idx] = {
        ...updated[idx],
        endereco: `${data.logradouro || ""}${data.complemento ? `, ${data.complemento}` : ""}`,
        bairro: data.bairro || "",
        cidade: data.localidade || "",
        estado: data.uf || "",
        cep: cleanCep.replace(/(\d{5})(\d{3})/, "$1-$2"),
      };
      onChange(updated);
      toast.success("Endereço preenchido!");
    } catch {
      toast.error("Erro ao buscar CEP");
    } finally {
      setCepLoading(prev => ({ ...prev, [idx]: false }));
    }
  }, [compradores, onChange]);

  const handleFileUpload = useCallback(async (
    idx: number,
    docType: "identidade" | "comprovante",
    file: File
  ) => {
    const key = `${idx}-${docType}`;
    setExtracting(prev => ({ ...prev, [key]: true }));

    try {
      // 1. Upload file to storage
      const ext = file.name.split(".").pop();
      const path = `comprador-${idx}/${docType}-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("pagadoria-docs")
        .upload(path, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Store the path
      const urlField = docType === "identidade" ? "doc_identidade_url" : "doc_comprovante_url";
      updateComprador(idx, urlField, path);
      toast.success(`${docType === "identidade" ? "Documento" : "Comprovante"} enviado!`);

      // 2. Convert to base64 for OCR
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64 = (reader.result as string).split(",")[1];
          const { data, error } = await supabase.functions.invoke("extract-doc-data", {
            body: {
              imageBase64: base64,
              mimeType: file.type,
              docType: docType === "identidade" ? "identidade" : "comprovante",
            },
          });

          if (error) throw error;

          const extracted = data?.extracted;
          if (!extracted) return;

          // Apply extracted data
          const updated = [...compradores];
          const c = { ...updated[idx] };

          if (docType === "identidade") {
            if (extracted.nome_completo) c.nome = extracted.nome_completo;
            if (extracted.cpf) c.cpf = extracted.cpf;
            if (extracted.rg) c.rg = extracted.rg;
            if (extracted.nacionalidade) c.nacionalidade = extracted.nacionalidade;
          } else {
            if (extracted.endereco_completo) c.endereco = extracted.endereco_completo;
            if (extracted.cidade) c.cidade = extracted.cidade;
            if (extracted.estado) c.estado = extracted.estado;
          }

          updated[idx] = c;
          onChange(updated);
          toast.success("✨ Dados extraídos! Revise os campos preenchidos.");
        } catch (e: any) {
          console.error("OCR error:", e);
          toast.error("Não foi possível extrair dados automaticamente. Preencha manualmente.");
        } finally {
          setExtracting(prev => ({ ...prev, [key]: false }));
        }
      };
      reader.readAsDataURL(file);
    } catch (e: any) {
      toast.error("Erro no upload: " + e.message);
      setExtracting(prev => ({ ...prev, [key]: false }));
    }
  }, [compradores, onChange]);

  return (
    <div className="space-y-4">
      {compradores.map((comp, idx) => (
        <Card key={idx} className="border-primary/20">
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-sm text-foreground">
                👤 Comprador {compradores.length > 1 ? idx + 1 : ""}
              </h4>
              {compradores.length > 1 && (
                <Button variant="ghost" size="sm" className="h-7 text-destructive" onClick={() => removeComprador(idx)}>
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Remover
                </Button>
              )}
            </div>

            {/* Upload section */}
            <div className="grid grid-cols-2 gap-3">
              <UploadBox
                label="📄 RG / CPF"
                hint="Foto ou scan do documento"
                uploading={!!extracting[`${idx}-identidade`]}
                hasFile={!!comp.doc_identidade_url}
                onFile={(f) => handleFileUpload(idx, "identidade", f)}
                accept="image/*,.pdf"
              />
              <UploadBox
                label="🏠 Comprovante de Residência"
                hint="Conta de luz, água ou similar"
                uploading={!!extracting[`${idx}-comprovante`]}
                hasFile={!!comp.doc_comprovante_url}
                onFile={(f) => handleFileUpload(idx, "comprovante", f)}
                accept="image/*,.pdf"
              />
            </div>

            {(extracting[`${idx}-identidade`] || extracting[`${idx}-comprovante`]) && (
              <div className="flex items-center gap-2 text-xs text-primary bg-primary/5 rounded-lg px-3 py-2">
                <Sparkles className="h-3.5 w-3.5 animate-pulse" />
                Extraindo dados do documento com IA...
              </div>
            )}

            {/* Form fields */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Nome Completo *</Label>
                <Input value={comp.nome} onChange={e => updateComprador(idx, "nome", e.target.value)} placeholder="Nome completo" className="h-8 text-sm" />
              </div>
              <div>
                <Label className="text-xs">CPF *</Label>
                <Input value={comp.cpf} onChange={e => updateComprador(idx, "cpf", e.target.value)} placeholder="000.000.000-00" className="h-8 text-sm" />
              </div>
              <div>
                <Label className="text-xs">RG</Label>
                <Input value={comp.rg} onChange={e => updateComprador(idx, "rg", e.target.value)} placeholder="Número do RG" className="h-8 text-sm" />
              </div>
              <div>
                <Label className="text-xs">Nacionalidade</Label>
                <Input value={comp.nacionalidade} onChange={e => updateComprador(idx, "nacionalidade", e.target.value)} placeholder="brasileira" className="h-8 text-sm" />
              </div>
              <div>
                <Label className="text-xs">Estado Civil *</Label>
                <Select value={comp.estado_civil} onValueChange={v => updateComprador(idx, "estado_civil", v)}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {ESTADOS_CIVIS.map(e => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Telefone *</Label>
                <Input value={comp.telefone} onChange={e => updateComprador(idx, "telefone", e.target.value)} placeholder="(51) 99999-9999" className="h-8 text-sm" />
              </div>
              <div>
                <Label className="text-xs">E-mail *</Label>
                <Input value={comp.email} onChange={e => updateComprador(idx, "email", e.target.value)} placeholder="email@email.com" className="h-8 text-sm" />
              </div>
              <div>
                <Label className="text-xs">Cidade / Estado</Label>
                <div className="flex gap-1.5">
                  <Input value={comp.cidade} onChange={e => updateComprador(idx, "cidade", e.target.value)} placeholder="Cidade" className="h-8 text-sm flex-1" />
                  <Input value={comp.estado} onChange={e => updateComprador(idx, "estado", e.target.value)} placeholder="RS" className="h-8 text-sm w-14" />
                </div>
              </div>
              <div>
                <Label className="text-xs">CEP</Label>
                <div className="flex gap-1.5">
                  <Input
                    value={comp.cep}
                    onChange={e => updateComprador(idx, "cep", e.target.value)}
                    onBlur={() => buscarCep(idx, comp.cep)}
                    placeholder="00000-000"
                    className="h-8 text-sm flex-1"
                    maxLength={9}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    disabled={!!cepLoading[idx]}
                    onClick={() => buscarCep(idx, comp.cep)}
                  >
                    {cepLoading[idx] ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Endereço (Rua, nº, complemento) *</Label>
                <Input value={comp.endereco} onChange={e => updateComprador(idx, "endereco", e.target.value)} placeholder="Rua, número, complemento" className="h-8 text-sm" />
              </div>
              <div>
                <Label className="text-xs">Bairro</Label>
                <Input value={comp.bairro} onChange={e => updateComprador(idx, "bairro", e.target.value)} placeholder="Bairro" className="h-8 text-sm" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      {compradores.length < 2 && (
        <Button variant="outline" size="sm" onClick={addComprador} className="gap-1.5">
          <UserPlus className="h-4 w-4" /> Adicionar 2º Comprador
        </Button>
      )}

      {/* Preview generated text */}
      {compradores.some(c => c.nome && c.cpf) && (
        <Card className="bg-muted/30 border-dashed">
          <CardContent className="p-3">
            <p className="text-[10px] font-semibold text-muted-foreground mb-1.5">📋 PRÉVIA DO TEXTO DO CONTRATO:</p>
            <p className="text-xs text-foreground leading-relaxed">
              {compradores.filter(c => c.nome).map((c, i) => (
                <span key={i}>
                  {i > 0 && " e "}
                  <strong>{c.nome || "_______________"}</strong>, {c.nacionalidade || "___________"}, {c.estado_civil || "___________"}, inscrito no CPF/MF sob o nº {c.cpf || "___.___.___-__"}, telefone: {c.telefone || "(__) _____-____"}, e-mail: {c.email || "________________"}, residente e domiciliado na {c.endereco || "________________________________"}{c.bairro ? `, Bairro ${c.bairro}` : ""}{c.cidade ? `, ${c.cidade}` : ""}{c.estado ? `/${c.estado}` : ""}{c.cep ? `, CEP: ${c.cep}` : ""}
                </span>
              ))}
              .
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function UploadBox({ label, hint, uploading, hasFile, onFile, accept }: {
  label: string; hint: string; uploading: boolean; hasFile: boolean;
  onFile: (f: File) => void; accept: string;
}) {
  return (
    <label className={`flex flex-col items-center justify-center gap-1.5 border-2 border-dashed rounded-lg p-3 cursor-pointer transition-colors ${
      hasFile ? "border-green-400 bg-green-50/50" : "border-border hover:border-primary/40 hover:bg-primary/5"
    }`}>
      {uploading ? (
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      ) : hasFile ? (
        <FileCheck className="h-5 w-5 text-green-600" />
      ) : (
        <Upload className="h-5 w-5 text-muted-foreground" />
      )}
      <span className="text-xs font-medium text-foreground">{label}</span>
      <span className="text-[10px] text-muted-foreground">{uploading ? "Processando..." : hasFile ? "✅ Enviado" : hint}</span>
      <input type="file" accept={accept} className="hidden" onChange={e => { if (e.target.files?.[0]) onFile(e.target.files[0]); }} disabled={uploading} />
    </label>
  );
}
