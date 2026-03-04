import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Upload, FileSpreadsheet, CheckCircle, AlertTriangle, Loader2, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import Papa from "papaparse";
import { useOAListas, importLeadsToLista, normalizeTelefone } from "@/hooks/useOfertaAtiva";

const FIELD_MAP: Record<string, string[]> = {
  nome: ["nome", "name", "fn", "first_name", "cliente"],
  telefone: ["telefone", "phone", "phone_1", "celular", "fone", "tel"],
  telefone2: ["telefone2", "phone_2", "fone2", "tel2"],
  email: ["email", "e-mail", "email_1"],
  campanha: ["campanha", "campaign", "campanha_nome"],
  origem: ["origem", "source", "origin", "midia", "canal"],
  data_lead: ["data", "date", "event_time", "data_lead", "created_at"],
  observacoes: ["observacoes", "obs", "notes", "observacao"],
};

function autoMap(headers: string[]) {
  const result: Record<string, string> = {};
  const norm = headers.map(h => h.trim().toLowerCase().replace(/\s+/g, "_"));
  for (const [field, candidates] of Object.entries(FIELD_MAP)) {
    for (const c of candidates) {
      const idx = norm.indexOf(c);
      if (idx !== -1) { result[field] = headers[idx]; break; }
      const partial = norm.findIndex(h => h.includes(c));
      if (partial !== -1 && !result[field]) { result[field] = headers[partial]; break; }
    }
  }
  return result;
}

export default function ImportListPanel() {
  const { createLista } = useOAListas();
  const [step, setStep] = useState<"upload" | "map" | "config" | "result">("upload");
  const [rawData, setRawData] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [empreendimento, setEmpreendimento] = useState("");
  const [campanha, setCampanha] = useState("");
  const [origem, setOrigem] = useState("");
  const [nomeLista, setNomeLista] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ inserted: number; duplicates: number; invalid: number } | null>(null);

  const handleFile = useCallback((file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext === "csv" || ext === "txt") {
      Papa.parse(file, {
        complete: (results) => {
          const rows = results.data as string[][];
          if (rows.length < 2) { toast.error("Arquivo vazio"); return; }
          setHeaders(rows[0]);
          setRawData(rows.slice(1).filter(r => r.some(c => c?.trim())));
          const auto = autoMap(rows[0]);
          setMapping(auto);
          setNomeLista(file.name.replace(/\.(csv|xlsx|xls|txt)$/i, ""));
          // Try to detect empreendimento from headers
          const empCol = rows[0].find(h => /empreendimento|produto|project/i.test(h));
          if (empCol) {
            const firstVal = rows[1]?.[rows[0].indexOf(empCol)]?.trim();
            if (firstVal) setEmpreendimento(firstVal);
          }
          setStep("map");
          toast.success(`${rows.length - 1} linhas encontradas, ${Object.keys(auto).length} campos auto-mapeados`);
        },
        skipEmptyLines: true,
      });
    } else {
      toast.error("Use arquivos CSV. Para XLSX, salve como CSV primeiro.");
    }
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleImport = async () => {
    if (!empreendimento.trim()) { toast.error("Defina o empreendimento"); return; }
    if (!mapping.nome) { toast.error("Mapeie pelo menos o campo Nome"); return; }

    setImporting(true);
    try {
      const lista = await createLista({
        nome: nomeLista || empreendimento,
        empreendimento: empreendimento.trim(),
        campanha: campanha || null,
        origem: origem || null,
      });
      if (!lista) { setImporting(false); return; }

      const rows = rawData.map(row => {
        const obj: any = {};
        for (const [field, col] of Object.entries(mapping)) {
          const idx = headers.indexOf(col);
          if (idx !== -1) obj[field] = row[idx]?.trim() || "";
        }
        return obj;
      }).filter(r => r.nome);

      const res = await importLeadsToLista(
        lista.id, empreendimento.trim(), campanha || null, origem || null, rows
      );
      setResult(res);
      setStep("result");
      toast.success(`${res.inserted} leads importados!`);
    } catch (err) {
      toast.error("Erro na importação");
      console.error(err);
    }
    setImporting(false);
  };

  if (step === "upload") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" /> Importar Lista de Leads
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className="border-2 border-dashed border-border rounded-xl p-12 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            onClick={() => {
              const input = document.createElement("input");
              input.type = "file";
              input.accept = ".csv,.txt";
              input.onchange = (e: any) => {
                const file = e.target.files[0];
                if (file) handleFile(file);
              };
              input.click();
            }}
          >
            <FileSpreadsheet className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-lg font-medium text-foreground">Arraste um CSV aqui ou clique para selecionar</p>
            <p className="text-sm text-muted-foreground mt-1">Formatos aceitos: CSV, TXT</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (step === "map") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Mapear Colunas</CardTitle>
          <p className="text-sm text-muted-foreground">
            {rawData.length} linhas · Preview: {headers.slice(0, 5).join(", ")}...
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {Object.entries(FIELD_MAP).map(([field]) => (
            <div key={field} className="flex items-center gap-3">
              <span className="w-28 text-sm font-medium capitalize">
                {field.replace("_", " ")}
                {field === "nome" && <span className="text-destructive ml-0.5">*</span>}
              </span>
              <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
              <Select value={mapping[field] || ""} onValueChange={v => setMapping(p => ({ ...p, [field]: v === "__none__" ? "" : v }))}>
                <SelectTrigger className={`w-full ${mapping[field] ? "border-primary/40" : ""}`}>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Nenhuma —</SelectItem>
                  {headers.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          ))}

          <div className="pt-4 border-t border-border space-y-3">
            <div>
              <label className="text-sm font-medium">Empreendimento *</label>
              <Input value={empreendimento} onChange={e => setEmpreendimento(e.target.value)} placeholder="Ex: Open Bosque" className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Campanha</label>
                <Input value={campanha} onChange={e => setCampanha(e.target.value)} placeholder="Ex: Meta Ads Março" className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Origem</label>
                <Input value={origem} onChange={e => setOrigem(e.target.value)} placeholder="Ex: Facebook" className="mt-1" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Nome da Lista</label>
              <Input value={nomeLista} onChange={e => setNomeLista(e.target.value)} className="mt-1" />
            </div>
          </div>

          {/* Preview */}
          <div className="border rounded-lg overflow-x-auto max-h-48">
            <table className="text-xs w-full">
              <thead>
                <tr className="bg-muted/60">
                  {headers.slice(0, 6).map(h => <th key={h} className="px-2 py-1 text-left border-r border-border">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {rawData.slice(0, 5).map((row, i) => (
                  <tr key={i} className="border-t border-border">
                    {row.slice(0, 6).map((c, j) => <td key={j} className="px-2 py-1 border-r border-border truncate max-w-[150px]">{c}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep("upload")}>Voltar</Button>
            <Button onClick={handleImport} disabled={importing || !mapping.nome || !empreendimento.trim()}>
              {importing ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Importando...</> : `Importar ${rawData.length} leads`}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (step === "result" && result) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-emerald-500" /> Importação Concluída
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <p className="text-2xl font-bold text-emerald-600">{result.inserted}</p>
              <p className="text-xs text-muted-foreground">Importados</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <p className="text-2xl font-bold text-amber-600">{result.duplicates}</p>
              <p className="text-xs text-muted-foreground">Duplicados removidos</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-red-500/10 border border-red-500/20">
              <p className="text-2xl font-bold text-red-600">{result.invalid}</p>
              <p className="text-xs text-muted-foreground">Tel. inválidos</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
            Lembre-se: a lista precisa ser <strong className="text-foreground ml-1">LIBERADA</strong> na aba Campanhas antes dos corretores poderem ligar.
          </div>
          <Button onClick={() => { setStep("upload"); setResult(null); setRawData([]); }}>
            Importar outra lista
          </Button>
        </CardContent>
      </Card>
    );
  }

  return null;
}
