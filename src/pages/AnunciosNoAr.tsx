import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Building2, MapPin, BedDouble, Maximize2, Tag, Loader2, Download,
  Upload, Trash2, Image as ImageIcon, Video, FileText, ChevronLeft, ChevronRight,
  Radio, Megaphone, Eye, DollarSign, Sparkles, ChevronDown, Pencil, Save, X
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

/* ═══════════════════════════════════════════════
   SEGMENTOS + CÓDIGOS DE ANÚNCIOS
   ═══════════════════════════════════════════════ */

type AnuncioConfig = {
  nome: string;
  codigo: string;
};

type SegmentoConfig = {
  key: string;
  label: string;
  emoji: string;
  gradient: string;
  borderColor: string;
  badgeColor: string;
  empreendimentos: AnuncioConfig[];
};

const SEGMENTOS: SegmentoConfig[] = [
  {
    key: "mcmv",
    label: "MCMV e Até 500k",
    emoji: "🏠",
    gradient: "from-emerald-600/90 to-emerald-800/90",
    borderColor: "border-emerald-500/40",
    badgeColor: "bg-emerald-500/20 text-emerald-300 border-emerald-400/30",
    empreendimentos: [
      { nome: "Open Bosque", codigo: "32849-UH" },
    ],
  },
  {
    key: "medio-alto",
    label: "Médio e Alto Padrão",
    emoji: "🏢",
    gradient: "from-blue-600/90 to-blue-800/90",
    borderColor: "border-blue-500/40",
    badgeColor: "bg-blue-500/20 text-blue-300 border-blue-400/30",
    empreendimentos: [
      { nome: "Orygem", codigo: "57290-UH" },
      { nome: "Casa Tua", codigo: "52101-UH" },
      { nome: "Las Casas", codigo: "41190-UH" },
      { nome: "Melnick Day Médio Padrão", codigo: "76953-UH" },
    ],
  },
  {
    key: "alto",
    label: "Alto Padrão",
    emoji: "🏙️",
    gradient: "from-violet-600/90 to-violet-800/90",
    borderColor: "border-violet-500/40",
    badgeColor: "bg-violet-500/20 text-violet-300 border-violet-400/30",
    empreendimentos: [
      { nome: "Lake Eyre", codigo: "58935-UH" },
      { nome: "Melnick Day Alto Padrão", codigo: "91245-UH" },
    ],
  },
  {
    key: "investimento",
    label: "Investimento",
    emoji: "📊",
    gradient: "from-amber-600/90 to-amber-800/90",
    borderColor: "border-amber-500/40",
    badgeColor: "bg-amber-500/20 text-amber-300 border-amber-400/30",
    empreendimentos: [
      { nome: "Casa Bastian", codigo: "4688-UH" },
      { nome: "Shift", codigo: "97325-UH" },
      { nome: "Melnick Day Compactos", codigo: "39808-UH" },
    ],
  },
];

/* ═══════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════ */

type JetimobImovel = {
  codigo: string;
  nome?: string;
  bairro?: string;
  endereco_bairro?: string;
  area_total?: number;
  area_privativa?: number;
  dormitorios?: number;
  suites?: number;
  vagas?: number;
  valor_venda?: number;
  preco_venda?: number;
  valor?: number;
  status_obra?: string;
  previsao_entrega?: string;
  imagens?: { url: string; descricao?: string }[];
  fotos?: { url: string }[];
  foto_principal?: string;
  descricao?: string;
};

type Material = {
  id: string;
  empreendimento_codigo: string;
  empreendimento_nome: string;
  segmento: string;
  tipo: string;
  nome_arquivo: string;
  url: string;
  mime_type: string | null;
  uploaded_by: string | null;
  created_at: string;
};

/* ═══════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════ */

function getPrice(item: JetimobImovel): number {
  return Number(item.valor_venda || item.preco_venda || item.valor || 0);
}

function formatPrice(v: number): string {
  if (!v) return "Sob consulta";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 });
}

function getImages(item: JetimobImovel): string[] {
  // Use normalized photos from edge function if available
  if ((item as any)._fotos_normalized?.length) {
    return (item as any)._fotos_normalized.slice(0, 8);
  }
  const imgs: string[] = [];
  if (item.foto_principal) imgs.push(item.foto_principal);
  if (item.imagens) {
    for (const i of item.imagens) {
      const url = typeof i === "string" ? i : (i.url || "");
      if (url && !imgs.includes(url)) imgs.push(url);
    }
  }
  if (item.fotos) {
    for (const f of item.fotos) {
      const url = typeof f === "string" ? f : (f.url || "");
      if (url && !imgs.includes(url)) imgs.push(url);
    }
  }
  return imgs.slice(0, 8);
}

const TIPO_ICONS: Record<string, any> = {
  criativo: Video,
  tabela: FileText,
  book: FileText,
  material: ImageIcon,
};

const TIPO_LABELS: Record<string, string> = {
  criativo: "Criativo (Vídeo/Imagem)",
  tabela: "Tabela de Preços",
  book: "Book do Empreendimento",
  material: "Outro Material",
};

/* ═══════════════════════════════════════════════
   IMAGE SLIDER
   ═══════════════════════════════════════════════ */

function ImageSlider({ images, height = "h-48" }: { images: string[]; height?: string }) {
  const [idx, setIdx] = useState(0);
  if (!images.length) {
    return (
      <div className={cn("w-full rounded-xl bg-muted/30 flex items-center justify-center", height)}>
        <Building2 className="h-10 w-10 text-muted-foreground/20" />
      </div>
    );
  }
  return (
    <div className={cn("relative w-full rounded-xl overflow-hidden group", height)}>
      <img
        src={images[idx]}
        alt=""
        className="w-full h-full object-cover transition-transform duration-500"
        loading="lazy"
      />
      {images.length > 1 && (
        <>
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
          <button
            onClick={(e) => { e.stopPropagation(); setIdx(i => (i - 1 + images.length) % images.length); }}
            className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setIdx(i => (i + 1) % images.length); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={(e) => { e.stopPropagation(); setIdx(i); }}
                className={cn("h-1.5 rounded-full transition-all", i === idx ? "w-4 bg-white" : "w-1.5 bg-white/50")}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════
   MATERIAL UPLOAD SECTION
   ═══════════════════════════════════════════════ */

function MaterialSection({
  empreendimentoCodigo,
  empreendimentoNome,
  segmento,
  materiais,
  canUpload,
  onRefresh,
}: {
  empreendimentoCodigo: string;
  empreendimentoNome: string;
  segmento: string;
  materiais: Material[];
  canUpload: boolean;
  onRefresh: () => void;
}) {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [uploadTipo, setUploadTipo] = useState("criativo");
  const [uploadNome, setUploadNome] = useState("");

  const myMateriais = materiais.filter(m => m.empreendimento_codigo === empreendimentoCodigo);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${segmento}/${empreendimentoCodigo}/${Date.now()}.${ext}`;

      const { error: storageError } = await supabase.storage
        .from("anuncio-materiais")
        .upload(path, file, { contentType: file.type });
      if (storageError) throw storageError;

      const { data: { publicUrl } } = supabase.storage.from("anuncio-materiais").getPublicUrl(path);

      const { error: dbError } = await supabase.from("anuncio_materiais").insert({
        empreendimento_codigo: empreendimentoCodigo,
        empreendimento_nome: empreendimentoNome,
        segmento,
        tipo: uploadTipo,
        nome_arquivo: uploadNome.trim() || file.name,
        url: publicUrl,
        mime_type: file.type,
        uploaded_by: user.id,
      });
      if (dbError) throw dbError;

      toast.success("✅ Material enviado com sucesso!");
      onRefresh();
    } catch (err: any) {
      toast.error("Erro ao enviar: " + (err.message || "tente novamente"));
    } finally {
      setUploading(false);
      setUploadNome("");
      e.target.value = "";
    }
  };

  const handleDelete = async (mat: Material) => {
    if (!confirm(`Excluir "${mat.nome_arquivo}"?`)) return;
    // Extract path from URL
    const urlParts = mat.url.split("/anuncio-materiais/");
    const path = urlParts[1];
    if (path) {
      await supabase.storage.from("anuncio-materiais").remove([path]);
    }
    await supabase.from("anuncio_materiais").delete().eq("id", mat.id);
    toast.success("Material excluído");
    onRefresh();
  };

  const grouped = useMemo(() => {
    const map = new Map<string, Material[]>();
    for (const m of myMateriais) {
      if (!map.has(m.tipo)) map.set(m.tipo, []);
      map.get(m.tipo)!.push(m);
    }
    return map;
  }, [myMateriais]);

  return (
    <div className="mt-3 space-y-2">
      {/* Existing materials */}
      {myMateriais.length > 0 && (
        <div className="space-y-1.5">
          {Array.from(grouped.entries()).map(([tipo, items]) => {
            const Icon = TIPO_ICONS[tipo] || FileText;
            return (
              <div key={tipo}>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Icon className="h-3 w-3" /> {TIPO_LABELS[tipo] || tipo}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {items.map(mat => {
                    const isImage = mat.mime_type?.startsWith("image/");
                    const isVideo = mat.mime_type?.startsWith("video/");
                    return (
                      <div key={mat.id} className="group/mat relative">
                        {isImage ? (
                          <a href={mat.url} target="_blank" rel="noopener noreferrer">
                            <img
                              src={mat.url}
                              alt={mat.nome_arquivo}
                              className="h-16 w-24 rounded-lg object-cover border border-border/40 hover:scale-105 transition-transform cursor-pointer"
                            />
                          </a>
                        ) : (
                          <a
                            href={mat.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="h-16 w-24 rounded-lg border border-border/40 bg-muted/30 flex flex-col items-center justify-center gap-1 hover:bg-accent/30 transition-colors"
                          >
                            {isVideo ? <Video className="h-5 w-5 text-primary" /> : <FileText className="h-5 w-5 text-primary" />}
                            <span className="text-[8px] text-muted-foreground truncate max-w-[80px] px-1">{mat.nome_arquivo}</span>
                          </a>
                        )}
                        <div className="absolute -top-1 -right-1 flex gap-0.5">
                          <a
                            href={mat.url}
                            download={mat.nome_arquivo}
                            className="h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center opacity-0 group-hover/mat:opacity-100 transition-opacity shadow-sm"
                          >
                            <Download className="h-3 w-3" />
                          </a>
                          {canUpload && (
                            <button
                              onClick={() => handleDelete(mat)}
                              className="h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover/mat:opacity-100 transition-opacity shadow-sm"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Upload area (CEO/Gerente only) */}
      {canUpload && (
        <div className="flex items-center gap-2 pt-1 flex-wrap">
          <Input
            value={uploadNome}
            onChange={(e) => setUploadNome(e.target.value)}
            placeholder="Nome do arquivo..."
            className="h-8 text-[11px] w-[160px]"
          />
          <Select value={uploadTipo} onValueChange={setUploadTipo}>
            <SelectTrigger className="h-8 text-[11px] w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="criativo">🎬 Criativo</SelectItem>
              <SelectItem value="tabela">📊 Tabela</SelectItem>
              <SelectItem value="book">📖 Book</SelectItem>
              <SelectItem value="material">📎 Outro</SelectItem>
            </SelectContent>
          </Select>
          <label className="cursor-pointer">
            <input type="file" className="hidden" accept="image/*,video/*,.pdf,.xlsx,.xls,.pptx" onChange={handleUpload} disabled={uploading} />
            <div className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all border border-dashed",
              uploading
                ? "bg-muted/50 text-muted-foreground border-border cursor-wait"
                : "bg-primary/10 text-primary border-primary/30 hover:bg-primary/20"
            )}>
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              {uploading ? "Enviando..." : "Enviar"}
            </div>
          </label>
        </div>
      )}

      {myMateriais.length === 0 && !canUpload && (
        <p className="text-[10px] text-muted-foreground/50 italic">Nenhum material disponível ainda.</p>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════
   EMPREENDIMENTO CARD
   ═══════════════════════════════════════════════ */

function EmpreendimentoCard({
  config,
  segmento,
  imovelData,
  loading,
  materiais,
  canUpload,
  onRefreshMateriais,
}: {
  config: AnuncioConfig;
  segmento: SegmentoConfig;
  imovelData: JetimobImovel | null;
  loading: boolean;
  materiais: Material[];
  canUpload: boolean;
  onRefreshMateriais: () => void;
}) {
  const images = imovelData ? getImages(imovelData) : [];
  const price = imovelData ? getPrice(imovelData) : 0;
  const bairro = imovelData?.bairro || imovelData?.endereco_bairro || "";
  const area = imovelData?.area_privativa || imovelData?.area_total || 0;
  const dorms = imovelData?.dormitorios || 0;
  const suites = imovelData?.suites || 0;
  const vagas = imovelData?.vagas || 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Card className={cn(
        "overflow-hidden border-2 hover:shadow-xl hover:-translate-y-1 transition-all duration-300",
        segmento.borderColor,
        "bg-card"
      )}>
        {/* Image */}
        {loading ? (
          <div className="h-48 flex items-center justify-center bg-muted/20">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <ImageSlider images={images} height="h-48" />
        )}

        <CardContent className="p-4 space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="text-base font-black text-foreground tracking-tight leading-tight">
                {config.nome}
              </h3>
              {bairro && (
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <MapPin className="h-3 w-3" /> {bairro}
                </p>
              )}
            </div>
            <Badge variant="outline" className="text-[9px] font-bold shrink-0 bg-muted/50">
              {config.codigo}
            </Badge>
          </div>

          {/* Specs */}
          {imovelData && (
            <div className="flex flex-wrap gap-2">
              {area > 0 && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Maximize2 className="h-3.5 w-3.5" />
                  <span className="font-semibold text-foreground">{area}m²</span>
                </div>
              )}
              {dorms > 0 && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <BedDouble className="h-3.5 w-3.5" />
                  <span className="font-semibold text-foreground">{dorms} dorm{dorms > 1 ? "s" : ""}</span>
                  {suites > 0 && <span className="text-[10px]">({suites} suíte{suites > 1 ? "s" : ""})</span>}
                </div>
              )}
              {vagas > 0 && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  🚗 <span className="font-semibold text-foreground">{vagas} vaga{vagas > 1 ? "s" : ""}</span>
                </div>
              )}
            </div>
          )}

          {/* Price */}
          <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-xl px-3 py-2">
            <p className="text-[10px] text-muted-foreground font-medium">A partir de</p>
            <p className="text-lg font-black text-primary tracking-tight">
              {loading ? "Carregando..." : formatPrice(price)}
            </p>
          </div>

          {/* Status */}
          {imovelData?.status_obra && (
            <div className="flex items-center gap-1.5">
              <Badge variant="outline" className="text-[10px] font-bold">
                🏗️ {imovelData.status_obra}
              </Badge>
              {imovelData.previsao_entrega && (
                <Badge variant="outline" className="text-[10px]">
                  📅 {imovelData.previsao_entrega}
                </Badge>
              )}
            </div>
          )}

          {/* Separator */}
          <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />

          {/* Materials section */}
          <div>
            <p className="text-[11px] font-black text-foreground flex items-center gap-1.5 mb-1">
              <FileText className="h-3.5 w-3.5 text-primary" />
              Materiais & Criativos
            </p>
            <MaterialSection
              empreendimentoCodigo={config.codigo}
              empreendimentoNome={config.nome}
              segmento={segmento.key}
              materiais={materiais}
              canUpload={canUpload}
              onRefresh={onRefreshMateriais}
            />
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════ */

export default function AnunciosNoAr() {
  const { isAdmin, isGestor } = useUserRole();
  const canUpload = isAdmin || isGestor;
  const [imoveis, setImoveis] = useState<Record<string, JetimobImovel>>({});
  const [loading, setLoading] = useState(true);
  const [materiais, setMateriais] = useState<Material[]>([]);

  // Fetch all imóveis from Jetimob
  useEffect(() => {
    let cancelled = false;

    async function fetchImovelByCodigo(codigo: string): Promise<JetimobImovel | null> {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 8000);
        const { data, error } = await supabase.functions.invoke("jetimob-proxy", {
          body: { action: "get_imovel", codigo },
        });
        clearTimeout(timer);

        if (error) return null;
        const imovel = (data as { imovel?: JetimobImovel | null } | null)?.imovel;
        return imovel && typeof imovel === "object" ? imovel : null;
      } catch {
        return null;
      }
    }

    async function fetchAll() {
      setLoading(true);
      const codigos = SEGMENTOS.flatMap((s) => s.empreendimentos.map((e) => e.codigo));

      try {
        const batchPromise = supabase.functions.invoke("jetimob-proxy", {
          body: { action: "get_imoveis_by_codigos", codigos },
        });

        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error("timeout_imoveis_batch")), 12000);
        });

        const { data, error } = (await Promise.race([batchPromise, timeoutPromise])) as Awaited<typeof batchPromise>;
        if (error) throw error;

        const mapped = (data as { imoveis?: Record<string, JetimobImovel | null> } | null)?.imoveis || {};
        const filtered = Object.fromEntries(
          Object.entries(mapped).filter(([, value]) => value && typeof value === "object")
        ) as Record<string, JetimobImovel>;

        if (!cancelled) {
          setImoveis(filtered);
          setLoading(false);
        }
      } catch (batchError) {
        console.warn("Falha no batch, tentando fallback individual:", batchError);
        // Immediately stop loading so cards render with basic info
        if (!cancelled) setLoading(false);

        // Fallback: fetch individually in parallel with short timeout
        try {
          const settled = await Promise.allSettled(
            codigos.map((codigo) =>
              Promise.race([
                fetchImovelByCodigo(codigo),
                new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000)),
              ])
            )
          );
          const fallbackMap: Record<string, JetimobImovel> = {};

          settled.forEach((result, index) => {
            if (result.status === "fulfilled" && result.value) {
              fallbackMap[codigos[index]] = result.value;
            }
          });

          if (!cancelled && Object.keys(fallbackMap).length > 0) {
            setImoveis(fallbackMap);
          }
        } catch (fallbackError) {
          console.warn("Fallback por código também falhou:", fallbackError);
        }
      }
    }

    fetchAll();
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch materials
  const fetchMateriais = useCallback(async () => {
    const { data } = await supabase
      .from("anuncio_materiais")
      .select("*")
      .order("created_at", { ascending: false });
    setMateriais((data || []) as Material[]);
  }, []);

  useEffect(() => { fetchMateriais(); }, [fetchMateriais]);

  const totalAnuncios = SEGMENTOS.reduce((acc, s) => acc + s.empreendimentos.length, 0);

  return (
    <div className="space-y-6 pb-8">
      {/* ─── HEADER ─── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[hsl(222,47%,11%)] via-[hsl(222,47%,15%)] to-[hsl(222,47%,20%)] p-6 border border-border/20">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center shadow-lg shadow-red-500/30">
              <Radio className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
                Anúncios no Ar
                <motion.span
                  className="inline-block h-3 w-3 rounded-full bg-red-500 shadow-lg shadow-red-500/50"
                  animate={{ scale: [1, 1.3, 1], opacity: [1, 0.7, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              </h1>
              <p className="text-sm text-white/60">
                {totalAnuncios} produto{totalAnuncios !== 1 ? "s" : ""} com anúncios ativos por segmento
              </p>
            </div>
          </div>

          {/* Segment summary pills */}
          <div className="flex flex-wrap gap-2 mt-4">
            {SEGMENTOS.map(seg => (
              <a
                key={seg.key}
                href={`#seg-${seg.key}`}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all hover:scale-105",
                  seg.badgeColor
                )}
              >
                <span>{seg.emoji}</span>
                <span>{seg.label}</span>
                <span className="font-black">{seg.empreendimentos.length}</span>
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* ─── SEGMENTS ─── */}
      {SEGMENTOS.map(seg => (
        <Collapsible key={seg.key} defaultOpen asChild>
          <section id={`seg-${seg.key}`} className="space-y-4">
            {/* Segment header */}
            <CollapsibleTrigger asChild>
              <div className={cn(
                "rounded-xl p-4 bg-gradient-to-r text-white relative overflow-hidden cursor-pointer hover:opacity-95 transition-opacity",
                seg.gradient
              )}>
                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAwIDEwIEwgNDAgMTAgTSAxMCAwIEwgMTAgNDAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjA1KSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNncmlkKSIvPjwvc3ZnPg==')] opacity-50" />
                <div className="relative z-10 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{seg.emoji}</span>
                    <div>
                      <h2 className="text-lg font-black tracking-tight">{seg.label}</h2>
                      <p className="text-xs text-white/70 font-medium">
                        {seg.empreendimentos.length} empreendimento{seg.empreendimentos.length !== 1 ? "s" : ""} com anúncio ativo
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-white/20 text-white border-white/30 text-xs font-bold px-3">
                      <Megaphone className="h-3.5 w-3.5 mr-1" /> NO AR
                    </Badge>
                    <ChevronDown className="h-5 w-5 text-white/70 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                  </div>
                </div>
              </div>
            </CollapsibleTrigger>

            {/* Cards grid */}
            <CollapsibleContent>
              <div className={cn(
                "grid gap-4 pt-1",
                seg.empreendimentos.length === 1
                  ? "grid-cols-1 max-w-lg"
                  : seg.empreendimentos.length === 2
                    ? "grid-cols-1 md:grid-cols-2"
                    : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
              )}>
                {seg.empreendimentos.map(emp => (
                  <EmpreendimentoCard
                    key={emp.codigo}
                    config={emp}
                    segmento={seg}
                    imovelData={imoveis[emp.codigo] || null}
                    loading={loading}
                    materiais={materiais}
                    canUpload={canUpload}
                    onRefreshMateriais={fetchMateriais}
                  />
                ))}
              </div>
            </CollapsibleContent>
          </section>
        </Collapsible>
      ))}
    </div>
  );
}

