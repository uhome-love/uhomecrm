import { useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Upload, FileSpreadsheet, CheckCircle, AlertTriangle, Loader2, ArrowRight, Building2, Layers, Pencil } from "lucide-react";
import { toast } from "sonner";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { useOAListas, importLeadsToLista, normalizeTelefone, fetchLeadImportIndexes } from "@/hooks/useOfertaAtiva";

const FIELD_MAP: Record<string, string[]> = {
  nome: ["nome", "name", "fn", "first_name", "cliente", "full_name"],
  telefone: ["telefone", "phone", "phone_1", "celular", "fone", "tel", "whatsapp"],
  telefone2: ["telefone2", "phone_2", "fone2", "tel2"],
  email: ["email", "e-mail", "email_1"],
  empreendimento: ["empreendimento", "produto", "project", "empreend", "imovel", "produto_interesse"],
  campanha: ["campanha", "campaign", "campanha_nome", "utm_campaign", "ad_name"],
  origem: ["origem", "source", "origin", "midia", "canal", "utm_source", "plataforma"],
  data_lead: ["data", "date", "event_time", "data_lead", "created_at", "data_cadastro"],
  observacoes: ["observacoes", "obs", "notes", "observacao", "mensagem", "message"],
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

/** Normalize string for grouping: lowercase, remove accents, trim */
function normalizeForGrouping(s: string): string {
  return s.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ");
}

/** Extract unique empreendimentos from data, merging similar names */
function detectEmpreendimentos(
  rows: string[][],
  headers: string[],
  mapping: Record<string, string>
): Record<string, { campanha: string | null; origem: string | null; count: number }[]> {
  const empCol = mapping.empreendimento ? headers.indexOf(mapping.empreendimento) : -1;
  const campCol = mapping.campanha ? headers.indexOf(mapping.campanha) : -1;
  const origemCol = mapping.origem ? headers.indexOf(mapping.origem) : -1;

  // Group by normalized empreendimento name
  const groups: Record<string, Map<string, { campanha: string | null; origem: string | null; count: number }>> = {};
  const displayNames: Record<string, string> = {};
  // Map raw emp values to their normalized key for later row matching
  const normMap: Record<string, string> = {};

  for (const row of rows) {
    const rawEmp = empCol >= 0 ? (row[empCol]?.trim() || "Sem empreendimento") : "Sem empreendimento";
    const normEmp = normalizeForGrouping(rawEmp);
    const camp = campCol >= 0 ? (row[campCol]?.trim() || null) : null;
    const orig = origemCol >= 0 ? (row[origemCol]?.trim() || null) : null;
    const key = `${camp || ""}|${orig || ""}`;

    normMap[rawEmp] = normEmp;
    if (!displayNames[normEmp] || rawEmp.length > displayNames[normEmp].length) {
      displayNames[normEmp] = rawEmp;
    }

    if (!groups[normEmp]) groups[normEmp] = new Map();
    const existing = groups[normEmp].get(key);
    if (existing) {
      existing.count++;
    } else {
      groups[normEmp].set(key, { campanha: camp, origem: orig, count: 1 });
    }
  }

  const result: Record<string, { campanha: string | null; origem: string | null; count: number }[]> = {};
  for (const [normEmp, subs] of Object.entries(groups)) {
    const displayName = displayNames[normEmp] || normEmp;
    result[displayName] = Array.from(subs.values());
  }
  return result;
}

/** Try to guess empreendimento from filename or campanha patterns */
function guessFromFilename(filename: string): string | null {
  const clean = filename
    .replace(/\.(csv|xlsx|xls|txt)$/i, "")
    .replace(/[-_]/g, " ")
    .replace(/\d{4}[-/]\d{2}[-/]\d{2}/g, "")
    .replace(/leads?/gi, "")
    .replace(/lista/gi, "")
    .replace(/importa(r|cao|ção)?/gi, "")
    .replace(/meta\s*ads?/gi, "")
    .replace(/facebook|instagram|google|tiktok|portal/gi, "")
    .trim();
  return clean.length >= 3 ? clean : null;
}

export default function ImportListPanel() {
  const { createLista } = useOAListas();
  const [step, setStep] = useState<"upload" | "map" | "review" | "result">("upload");
  const [rawData, setRawData] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ total: number; lists: { emp: string; inserted: number; duplicates: number; invalid: number }[] } | null>(null);
  const [selectedEmps, setSelectedEmps] = useState<Set<string>>(new Set());
  const [customNames, setCustomNames] = useState<Record<string, { emp: string; campanha: string }>>({});

  // Detected segments - computed for review step
  const detectedSegments = useMemo(
    () => (step === "review" || step === "map") ? detectEmpreendimentos(rawData, headers, mapping) : {},
    [rawData, headers, mapping, step]
  );

  // Final segments: if no empreendimento column, use filename guess
  const finalSegments = useMemo(() => {
    if (mapping.empreendimento) return detectedSegments;
    const fallback = guessFromFilename(fileName) || fileName.replace(/\.(csv|txt)$/i, "");
    return { [fallback]: [{ campanha: null, origem: null, count: rawData.length }] };
  }, [detectedSegments, mapping.empreendimento, fileName, rawData.length]);

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
          setFileName(file.name);
          setStep("map");
          toast.success(`${rows.length - 1} linhas encontradas, ${Object.keys(auto).length} campos auto-mapeados`);
        },
        skipEmptyLines: true,
      });
    } else if (ext === "xlsx" || ext === "xls") {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: "array" });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });
          if (jsonData.length < 2) { toast.error("Arquivo vazio"); return; }
          const headerRow = (jsonData[0] as any[]).map(String);
          const dataRows = jsonData.slice(1).filter((r: any) => r.some((c: any) => c != null && String(c).trim())).map((r: any) => r.map(String));
          setHeaders(headerRow);
          setRawData(dataRows);
          const auto = autoMap(headerRow);
          setMapping(auto);
          setFileName(file.name);
          setStep("map");
          toast.success(`${dataRows.length} linhas encontradas (XLSX), ${Object.keys(auto).length} campos auto-mapeados`);
        } catch {
          toast.error("Erro ao ler arquivo XLSX");
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      toast.error("Use arquivos CSV ou XLSX.");
    }
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleImport = async () => {
    setImporting(true);
    const results: { emp: string; inserted: number; duplicates: number; invalid: number }[] = [];

    try {
      const segmentsToImport = Object.fromEntries(
        Object.entries(finalSegments).filter(([emp]) => selectedEmps.has(emp))
      );

      // Preload dedup indexes only once (prevents repeated full-table scans per list)
      const leadIndexes = await fetchLeadImportIndexes();

      for (const [emp, subs] of Object.entries(segmentsToImport)) {
        // Get rows for this empreendimento using normalized matching
        const empCol = mapping.empreendimento ? headers.indexOf(mapping.empreendimento) : -1;
        const normEmp = normalizeForGrouping(emp);
        const empRows = empCol >= 0
          ? rawData.filter(row => normalizeForGrouping(row[empCol]?.trim() || "Sem empreendimento") === normEmp)
          : rawData;

        // Use custom names if provided
        const custom = customNames[emp];
        const empName = custom?.emp?.trim() || emp;
        const campName = custom?.campanha?.trim() || subs.sort((a, b) => b.count - a.count)[0]?.campanha || null;
        const mainOrig = subs.sort((a, b) => b.count - a.count)[0]?.origem || null;
        const listName = `${empName}${campName ? ` - ${campName}` : ""}`;

        // Validate: require empreendimento name
        if (!empName || empName === emp) {
          // If the original emp looks like a code (short or numeric), warn
        }

        const lista = await createLista({
          nome: listName,
          empreendimento: empName,
          campanha: campName,
          origem: mainOrig,
        });
        if (!lista) continue;

        const rows = empRows.map(row => {
          const obj: any = {};
          for (const [field, col] of Object.entries(mapping)) {
            if (field === "empreendimento") continue; // handled at list level
            const idx = headers.indexOf(col);
            if (idx !== -1) obj[field] = row[idx]?.trim() || "";
          }
          // Preserve per-row campanha/origem
          if (mapping.campanha) {
            const idx = headers.indexOf(mapping.campanha);
            if (idx !== -1) obj.campanha = row[idx]?.trim() || campName || "";
          }
          if (mapping.origem) {
            const idx = headers.indexOf(mapping.origem);
            if (idx !== -1) obj.origem = row[idx]?.trim() || mainOrig || "";
          }
          return obj;
        }).filter(r => r.nome);

        const res = await importLeadsToLista(
          lista.id, empName, campName, mainOrig, rows, leadIndexes
        );
        results.push({ emp: empName, ...res });
      }

      setResult({ total: results.reduce((s, r) => s + r.inserted, 0), lists: results });
      setStep("result");
      toast.success(`Importação concluída! ${results.length} lista(s) criada(s)`);
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
              input.accept = ".csv,.txt,.xlsx,.xls";
              input.onchange = (e: any) => {
                const file = e.target.files[0];
                if (file) handleFile(file);
              };
              input.click();
            }}
          >
            <FileSpreadsheet className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-lg font-medium text-foreground">Arraste um CSV ou XLSX aqui ou clique para selecionar</p>
            <p className="text-sm text-muted-foreground mt-1">Suporta CSV, TXT e XLSX — identifica automaticamente empreendimentos e segmenta as listas</p>
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
            {rawData.length} linhas · Arquivo: {fileName}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {Object.entries(FIELD_MAP).map(([field]) => (
            <div key={field} className="flex items-center gap-3">
              <span className="w-32 text-sm font-medium capitalize flex items-center gap-1">
                {field === "empreendimento" && <Building2 className="h-3.5 w-3.5 text-primary" />}
                {field.replace("_", " ")}
                {(field === "nome") && <span className="text-destructive ml-0.5">*</span>}
                {field === "empreendimento" && (
                  <Badge variant="outline" className="text-[9px] ml-1 text-primary border-primary/30">auto</Badge>
                )}
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

          {!mapping.empreendimento && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-sm text-amber-700 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <strong>Coluna "empreendimento" não detectada.</strong> Se o CSV não tiver essa coluna, o sistema tentará detectar pelo nome do arquivo
                {guessFromFilename(fileName) && (
                  <span> — sugestão: <strong>"{guessFromFilename(fileName)}"</strong></span>
                )}
              </div>
            </div>
          )}

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
            <Button
              onClick={() => {
                if (!mapping.nome) { toast.error("Mapeie pelo menos o campo Nome"); return; }
                // If no empreendimento column, check filename guess or ask
                if (!mapping.empreendimento) {
                  const guess = guessFromFilename(fileName);
                  if (!guess) {
                    toast.error("Mapeie a coluna Empreendimento ou renomeie o arquivo com o nome do empreendimento");
                    return;
                  }
                }
                // Auto-select all empreendimentos when entering review
                const segs = mapping.empreendimento ? detectEmpreendimentos(rawData, headers, mapping) : { [guessFromFilename(fileName) || fileName.replace(/\.(csv|txt)$/i, "")]: [{ campanha: null, origem: null, count: rawData.length }] };
                setSelectedEmps(new Set(Object.keys(segs)));
                // Init custom names with detected values
                const names: Record<string, { emp: string; campanha: string }> = {};
                for (const [emp, subs] of Object.entries(segs)) {
                  const mainCamp = subs.sort((a, b) => b.count - a.count)[0];
                  names[emp] = { emp, campanha: mainCamp.campanha || "" };
                }
                setCustomNames(names);
                setStep("review");
              }}
              disabled={!mapping.nome}
            >
              Analisar e segmentar <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (step === "review") {
    const selectedSegments = Object.fromEntries(
      Object.entries(finalSegments).filter(([emp]) => selectedEmps.has(emp))
    );
    const totalLeads = Object.values(selectedSegments).reduce(
      (sum, subs) => sum + subs.reduce((s, sub) => s + sub.count, 0), 0
    );
    const allEmps = Object.keys(finalSegments);
    const allSelected = allEmps.length === selectedEmps.size;

    const toggleEmp = (emp: string) => {
      setSelectedEmps(prev => {
        const next = new Set(prev);
        if (next.has(emp)) next.delete(emp); else next.add(emp);
        return next;
      });
    };

    const toggleAll = () => {
      if (allSelected) setSelectedEmps(new Set());
      else setSelectedEmps(new Set(allEmps));
    };

    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" /> Selecionar Empreendimentos
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {allEmps.length} empreendimento(s) detectado(s) — selecione quais deseja importar
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Global campaign name */}
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-1.5">
            <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
              📢 Nome da Campanha (aplicar a todas)
            </label>
            <div className="flex gap-2">
              <Input
                placeholder="Ex: Meta Ads Março 2026"
                className="h-8 text-sm flex-1"
                onChange={(e) => {
                  const val = e.target.value;
                  setCustomNames(prev => {
                    const next = { ...prev };
                    for (const emp of Object.keys(next)) {
                      next[emp] = { ...next[emp], campanha: val };
                    }
                    return next;
                  });
                }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground">Preencha aqui para definir a mesma campanha para todas as listas, ou edite individualmente abaixo.</p>
          </div>

          {/* Select all toggle */}
          <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/40 border border-border">
            <Checkbox
              id="select-all"
              checked={allSelected}
              onCheckedChange={toggleAll}
            />
            <label htmlFor="select-all" className="text-sm font-medium cursor-pointer">
              {allSelected ? "Desmarcar todos" : "Selecionar todos"}
            </label>
            <Badge variant="outline" className="ml-auto text-xs">
              {selectedEmps.size}/{allEmps.length} selecionado(s)
            </Badge>
          </div>

          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
            {Object.entries(finalSegments).map(([emp, subs]) => {
              const total = subs.reduce((s, sub) => s + sub.count, 0);
              const campaigns = [...new Set(subs.filter(s => s.campanha).map(s => s.campanha))];
              const origins = [...new Set(subs.filter(s => s.origem).map(s => s.origem))];
              const isSelected = selectedEmps.has(emp);

              return (
                <div
                  key={emp}
                  className={`rounded-lg p-3 border transition-colors ${
                    isSelected
                      ? "bg-primary/5 border-primary/30"
                      : "bg-muted/20 border-border opacity-60"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleEmp(emp)}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-muted-foreground font-mono">Código original: {emp}</span>
                        <Badge variant="outline" className="text-xs shrink-0">{total} leads</Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-muted-foreground mb-0.5 block">Nome do Empreendimento</label>
                          <Input
                            value={customNames[emp]?.emp || ""}
                            onChange={(e) => {
                              e.stopPropagation();
                              setCustomNames(prev => ({ ...prev, [emp]: { ...prev[emp], emp: e.target.value } }));
                            }}
                            onClick={(e) => e.stopPropagation()}
                            placeholder="Ex: Residencial Aurora"
                            className="h-8 text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-muted-foreground mb-0.5 block">Nome da Campanha</label>
                          <Input
                            value={customNames[emp]?.campanha || ""}
                            onChange={(e) => {
                              e.stopPropagation();
                              setCustomNames(prev => ({ ...prev, [emp]: { ...prev[emp], campanha: e.target.value } }));
                            }}
                            onClick={(e) => e.stopPropagation()}
                            placeholder="Ex: Meta Ads Março"
                            className="h-8 text-sm"
                          />
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {origins.map(o => (
                          <Badge key={o} variant="secondary" className="text-[10px]">🌐 {o}</Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg p-2.5">
            <CheckCircle className="h-3.5 w-3.5 text-success shrink-0" />
            Cada empreendimento selecionado será uma lista separada. Duplicados serão removidos automaticamente.
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep("map")}>Voltar</Button>
            <Button onClick={handleImport} disabled={importing || selectedEmps.size === 0}>
              {importing ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Importando...</> : `Importar ${totalLeads} leads em ${selectedEmps.size} lista(s)`}
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
          <p className="text-sm text-muted-foreground">
            {result.lists.length} lista(s) criada(s) · {result.total} leads importados
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {result.lists.map((r, i) => (
            <div key={i} className="rounded-lg border border-border p-3">
              <h4 className="font-bold text-foreground text-sm flex items-center gap-2 mb-2">
                <Building2 className="h-4 w-4 text-primary" /> {r.emp}
              </h4>
              <div className="grid grid-cols-3 gap-2">
                <div className="text-center p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  <p className="text-lg font-bold text-emerald-600">{r.inserted}</p>
                  <p className="text-[10px] text-muted-foreground">Importados</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <p className="text-lg font-bold text-amber-600">{r.duplicates}</p>
                  <p className="text-[10px] text-muted-foreground">Duplicados</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-red-500/10 border border-red-500/20">
                  <p className="text-lg font-bold text-red-600">{r.invalid}</p>
                  <p className="text-[10px] text-muted-foreground">Inválidos</p>
                </div>
              </div>
            </div>
          ))}

          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
            Lembre-se: as listas precisam ser <strong className="text-foreground ml-1">LIBERADAS</strong> na aba Campanhas antes dos corretores poderem ligar.
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
