import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Brain, Upload, FileText, Trash2, Loader2, CheckCircle2, AlertCircle, Clock } from "lucide-react";

const CATEGORIES = [
  { value: "empreendimentos", label: "🏢 Empreendimentos", icon: "🏢" },
  { value: "scripts", label: "📞 Scripts", icon: "📞" },
  { value: "objecoes", label: "⚡ Objeções", icon: "⚡" },
  { value: "processos", label: "📋 Processos", icon: "📋" },
  { value: "estrategia", label: "🎯 Estratégia", icon: "🎯" },
];

const EMPREENDIMENTOS = [
  "Alfa", "Orygem", "Las Casas", "Casa Tua", "Lake Eyre",
  "Open Bosque", "Casa Bastian", "Shift", "Geral",
];

const categoryColors: Record<string, string> = {
  empreendimentos: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  scripts: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  objecoes: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  processos: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  estrategia: "bg-rose-500/20 text-rose-400 border-rose-500/30",
};

export default function BaseConhecimento() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [empreendimento, setEmpreendimento] = useState("");
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState("empreendimentos");

  // Fetch documents
  const { data: documents = [], isLoading } = useQuery({
    queryKey: ["homi-documents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("homi_documents")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Delete document
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("homi_documents").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["homi-documents"] });
      toast.success("Documento removido");
    },
    onError: () => toast.error("Erro ao remover documento"),
  });

  // Extract text from file
  const extractText = useCallback(async (file: File): Promise<string> => {
    if (file.type === "text/plain" || file.name.endsWith(".txt") || file.name.endsWith(".md")) {
      return await file.text();
    }
    // For PDF, read as text (basic extraction)
    // For more complex PDFs, would need pdfjs-dist
    const text = await file.text();
    // Try to clean up PDF text
    return text.replace(/[^\x20-\x7E\xA0-\xFF\u0100-\uFFFF\n\r\t]/g, " ").replace(/\s+/g, " ").trim();
  }, []);

  // Handle upload
  const handleUpload = useCallback(async (file: File) => {
    if (!title.trim() || !category || !user) {
      toast.error("Preencha título e categoria");
      return;
    }

    setUploading(true);
    try {
      const content = await extractText(file);
      if (content.length < 50) {
        toast.error("O arquivo tem muito pouco conteúdo para indexar");
        setUploading(false);
        return;
      }

      // Insert document
      const { data: doc, error: insertError } = await supabase
        .from("homi_documents")
        .insert({
          title: title.trim(),
          category,
          empreendimento: empreendimento || null,
          file_type: file.name.split(".").pop() || "txt",
          content,
          status: "processing",
          created_by: user.id,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      toast.info("📄 Documento salvo. Indexando...");
      queryClient.invalidateQueries({ queryKey: ["homi-documents"] });

      // Call edge function to process
      const { data: result, error: fnError } = await supabase.functions.invoke("processar-documento", {
        body: { documentId: doc.id },
      });

      if (fnError) throw fnError;
      if (result?.error) throw new Error(result.error);

      toast.success(`✅ Documento indexado! ${result.chunks} chunks criados. HOMI já sabe tudo sobre isso.`);
      queryClient.invalidateQueries({ queryKey: ["homi-documents"] });

      // Reset form
      setTitle("");
      setCategory("");
      setEmpreendimento("");
      if (fileRef.current) fileRef.current.value = "";
    } catch (err: any) {
      console.error("Upload error:", err);
      toast.error(err?.message || "Erro ao processar documento");
      queryClient.invalidateQueries({ queryKey: ["homi-documents"] });
    } finally {
      setUploading(false);
    }
  }, [title, category, empreendimento, user, extractText, queryClient]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
  };

  const filteredDocs = documents.filter((d: any) => d.category === activeTab);
  const totalIndexed = documents.filter((d: any) => d.status === "indexed").length;

  const statusIcon = (status: string) => {
    switch (status) {
      case "indexed": return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
      case "processing": return <Clock className="h-4 w-4 text-amber-400 animate-spin" />;
      default: return <AlertCircle className="h-4 w-4 text-destructive" />;
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case "indexed": return "Indexado";
      case "processing": return "Processando";
      default: return "Erro";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Brain className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Base de Conhecimento do HOMI</h1>
            <p className="text-sm text-muted-foreground">
              Alimente o HOMI com conhecimento sobre empreendimentos, scripts e estratégias
            </p>
          </div>
        </div>
        <Badge variant="outline" className="text-sm gap-1.5 px-3 py-1.5">
          <FileText className="h-3.5 w-3.5" />
          {totalIndexed} documentos indexados
        </Badge>
      </div>

      {/* Upload card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Adicionar documento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Input
              placeholder="Título do documento"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={uploading}
            />
            <Select value={category} onValueChange={setCategory} disabled={uploading}>
              <SelectTrigger>
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={empreendimento} onValueChange={setEmpreendimento} disabled={uploading}>
              <SelectTrigger>
                <SelectValue placeholder="Empreendimento (opcional)" />
              </SelectTrigger>
              <SelectContent>
                {EMPREENDIMENTOS.map((e) => (
                  <SelectItem key={e} value={e}>{e}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={() => fileRef.current?.click()}
              disabled={uploading || !title.trim() || !category}
              className="gap-2"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Indexando...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Enviar arquivo (.txt, .md)
                </>
              )}
            </Button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".txt,.md,.text"
            className="hidden"
            onChange={handleFileChange}
          />
        </CardContent>
      </Card>

      {/* Documents by category */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-5 w-full">
          {CATEGORIES.map((c) => {
            const count = documents.filter((d: any) => d.category === c.value).length;
            return (
              <TabsTrigger key={c.value} value={c.value} className="gap-1.5 text-xs">
                <span>{c.icon}</span>
                <span className="hidden sm:inline">{c.label.split(" ").slice(1).join(" ")}</span>
                {count > 0 && (
                  <Badge variant="secondary" className="h-5 min-w-[20px] text-[10px] px-1">
                    {count}
                  </Badge>
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {CATEGORIES.map((c) => (
          <TabsContent key={c.value} value={c.value} className="mt-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredDocs.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Brain className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">Nenhum documento em {c.label}</p>
                <p className="text-sm mt-1">Faça upload de arquivos para alimentar o HOMI</p>
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {filteredDocs.map((doc: any) => (
                  <Card key={doc.id} className="group">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-sm truncate">{doc.title}</h3>
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <Badge variant="outline" className={categoryColors[doc.category] || ""}>
                              {doc.category}
                            </Badge>
                            {doc.empreendimento && (
                              <Badge variant="secondary" className="text-xs">
                                {doc.empreendimento}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                            {statusIcon(doc.status)}
                            <span>{statusLabel(doc.status)}</span>
                            {doc.chunk_count > 0 && (
                              <span>· {doc.chunk_count} chunks</span>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                          onClick={() => deleteMutation.mutate(doc.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
