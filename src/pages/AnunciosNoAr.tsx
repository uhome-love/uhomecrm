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
  Radio, Megaphone, Eye, DollarSign, Sparkles, ChevronDown, Pencil, Save, X, Plus, Send, Link2, ExternalLink, GripVertical, ArrowLeft, ArrowRight
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/hooks/useAuth";
import { cn, formatBRL, formatBRLCompact } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import LandingPageEditor from "@/components/landing/LandingPageEditor";

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

type Tipologia = {
  dorms: number;
  area_min?: number;
  area_max?: number;
  suites?: number;
};

type EmpreendimentoOverride = {
  id: string;
  codigo: string;
  nome: string | null;
  bairro: string | null;
  area_privativa: number | null;
  dormitorios: number | null;
  suites: number | null;
  vagas: number | null;
  valor_venda: number | null;
  valor_min: number | null;
  valor_max: number | null;
  tipologias: Tipologia[];
  status_obra: string | null;
  previsao_entrega: string | null;
  descricao: string | null;
  fotos: string[];
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
  return formatBRL(v);
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
  const [linkUrl, setLinkUrl] = useState("");

  const myMateriais = materiais.filter(m => m.empreendimento_codigo === empreendimentoCodigo);

  const handleSaveLink = async () => {
    if (!linkUrl.trim() || !user) return;
    setUploading(true);
    try {
      const { error: dbError } = await supabase.from("anuncio_materiais").insert({
        empreendimento_codigo: empreendimentoCodigo,
        empreendimento_nome: empreendimentoNome,
        segmento,
        tipo: uploadTipo,
        nome_arquivo: uploadNome.trim() || "Vídeo Instagram",
        url: linkUrl.trim(),
        mime_type: "text/uri-list",
        uploaded_by: user.id,
      });
      if (dbError) throw dbError;
      toast.success("✅ Link salvo com sucesso!");
      onRefresh();
    } catch (err: any) {
      toast.error("Erro ao salvar: " + (err.message || "tente novamente"));
    } finally {
      setUploading(false);
      setUploadNome("");
      setLinkUrl("");
    }
  };

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
                    const isLink = mat.mime_type === "text/uri-list";
                    const isInstagram = isLink && mat.url.includes("instagram.com");
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
                            {isInstagram ? <span className="text-lg">📸</span> : isVideo ? <Video className="h-5 w-5 text-primary" /> : isLink ? <ExternalLink className="h-5 w-5 text-primary" /> : <FileText className="h-5 w-5 text-primary" />}
                            <span className="text-[8px] text-muted-foreground truncate max-w-[80px] px-1">{isInstagram ? "Instagram" : mat.nome_arquivo}</span>
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
        <div className="space-y-2 pt-1">
          <div className="flex items-center gap-2 flex-wrap">
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
                {uploading ? "Enviando..." : "Enviar arquivo"}
              </div>
            </label>
          </div>
          {/* Link input (Instagram/video URL) */}
          <div className="flex items-center gap-2 flex-wrap">
            <Input
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="Cole o link do Instagram ou vídeo..."
              className="h-8 text-[11px] flex-1 min-w-[200px]"
            />
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-[11px] gap-1.5"
              disabled={!linkUrl.trim() || uploading}
              onClick={handleSaveLink}
            >
              {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Link2 className="h-3 w-3" />}
              Salvar link
            </Button>
          </div>
        </div>
      )}

      {myMateriais.length === 0 && !canUpload && (
        <p className="text-[10px] text-muted-foreground/50 italic">Nenhum material disponível ainda.</p>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════
   EDIT OVERRIDE MODAL
   ═══════════════════════════════════════════════ */

function EditOverrideModal({
  open,
  onOpenChange,
  config,
  override,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  config: AnuncioConfig;
  override: EmpreendimentoOverride | null;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [bairro, setBairro] = useState("");
  const [valorMin, setValorMin] = useState("");
  const [valorMax, setValorMax] = useState("");
  const [vagasVal, setVagasVal] = useState("");
  const [statusObra, setStatusObra] = useState("");
  const [previsaoEntrega, setPrevisaoEntrega] = useState("");
  const [descricao, setDescricao] = useState("");
  const [fotosText, setFotosText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [tipologias, setTipologias] = useState<Tipologia[]>([]);

  useEffect(() => {
    if (open) {
      setBairro(override?.bairro || "");
      setValorMin(override?.valor_min?.toString() || override?.valor_venda?.toString() || "");
      setValorMax(override?.valor_max?.toString() || "");
      setVagasVal(override?.vagas?.toString() || "");
      setStatusObra(override?.status_obra || "");
      setPrevisaoEntrega(override?.previsao_entrega || "");
      setDescricao(override?.descricao || "");
      setFotosText((override?.fotos || []).join("\n"));
      setTipologias(override?.tipologias?.length ? override.tipologias : [{ dorms: 2 }]);
    }
  }, [open, override]);

  const addTipologia = () => setTipologias(prev => [...prev, { dorms: 1 }]);
  const removeTipologia = (idx: number) => setTipologias(prev => prev.filter((_, i) => i !== idx));
  const updateTipologia = (idx: number, field: keyof Tipologia, val: string) => {
    setTipologias(prev => prev.map((t, i) => i === idx ? { ...t, [field]: val ? Number(val) : undefined } : t));
  };

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const newUrls: string[] = [];
      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop() || "jpg";
        const path = `empreendimentos/${config.codigo}/${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`;
        const { error } = await supabase.storage.from("anuncio-materiais").upload(path, file, { upsert: true });
        if (error) throw error;
        const { data: { publicUrl } } = supabase.storage.from("anuncio-materiais").getPublicUrl(path);
        newUrls.push(publicUrl);
      }
      setFotosText(prev => prev ? prev + "\n" + newUrls.join("\n") : newUrls.join("\n"));
      toast.success(`${newUrls.length} imagem(ns) enviada(s)!`);
    } catch (err: any) {
      toast.error("Erro ao enviar imagem: " + (err.message || ""));
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function handleSave() {
    if (!user) return;
    setSaving(true);
    try {
      const fotos = fotosText.split("\n").map(s => s.trim()).filter(Boolean);
      const payload: any = {
        codigo: config.codigo,
        nome: config.nome,
        bairro: bairro || null,
        area_privativa: tipologias[0]?.area_min || null,
        dormitorios: tipologias.length > 0 ? Math.max(...tipologias.map(t => t.dorms)) : null,
        suites: tipologias[0]?.suites || null,
        vagas: vagasVal ? parseInt(vagasVal) : null,
        valor_venda: valorMin ? parseFloat(valorMin) : null,
        valor_min: valorMin ? parseFloat(valorMin) : null,
        valor_max: valorMax ? parseFloat(valorMax) : null,
        tipologias: tipologias.filter(t => t.dorms > 0),
        status_obra: statusObra || null,
        previsao_entrega: previsaoEntrega || null,
        descricao: descricao || null,
        fotos,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      };

      if (override?.id) {
        const { error } = await supabase.from("empreendimento_overrides").update(payload).eq("id", override.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("empreendimento_overrides").insert(payload);
        if (error) throw error;
      }

      toast.success("Dados personalizados salvos!");
      onSaved();
      onOpenChange(false);
    } catch (err: any) {
      toast.error("Erro: " + (err.message || "Falha ao salvar"));
    } finally {
      setSaving(false);
    }
  }

  const fotosArray = fotosText.split("\n").map(s => s.trim()).filter(Boolean);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-4 w-4 text-primary" />
            Personalizar — {config.nome}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Bairro */}
          <div>
            <Label className="text-xs font-semibold">Bairro</Label>
            <Input value={bairro} onChange={e => setBairro(e.target.value)} placeholder="Ex: Bela Vista" className="h-9 text-sm" />
          </div>

          {/* Faixa de Preço */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold flex items-center gap-1"><DollarSign className="h-3.5 w-3.5 text-primary" /> Faixa de Valor</Label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[10px] text-muted-foreground">A partir de (R$)</Label>
                <Input type="number" value={valorMin} onChange={e => setValorMin(e.target.value)} placeholder="240000" className="h-9 text-sm" />
                {valorMin && <p className="text-[10px] text-muted-foreground mt-0.5">{formatBRL(Number(valorMin))}</p>}
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground">Até (R$)</Label>
                <Input type="number" value={valorMax} onChange={e => setValorMax(e.target.value)} placeholder="450000" className="h-9 text-sm" />
                {valorMax && <p className="text-[10px] text-muted-foreground mt-0.5">{formatBRL(Number(valorMax))}</p>}
              </div>
            </div>
          </div>

          {/* Tipologias (Plantas) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold flex items-center gap-1"><BedDouble className="h-3.5 w-3.5 text-primary" /> Tipologias (Plantas)</Label>
              <Button type="button" size="sm" variant="ghost" onClick={addTipologia} className="h-7 text-xs gap-1">
                <Plus className="h-3 w-3" /> Adicionar
              </Button>
            </div>
            {tipologias.map((tip, idx) => (
              <div key={idx} className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-2 items-end rounded-lg border border-border/50 p-2 bg-muted/20">
                <div>
                  <Label className="text-[10px] text-muted-foreground">Dorms</Label>
                  <Input type="number" value={tip.dorms} onChange={e => updateTipologia(idx, "dorms", e.target.value)} className="h-8 text-xs" min={0} />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">Área mín m²</Label>
                  <Input type="number" value={tip.area_min ?? ""} onChange={e => updateTipologia(idx, "area_min", e.target.value)} className="h-8 text-xs" />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">Área máx m²</Label>
                  <Input type="number" value={tip.area_max ?? ""} onChange={e => updateTipologia(idx, "area_max", e.target.value)} className="h-8 text-xs" />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">Suítes</Label>
                  <Input type="number" value={tip.suites ?? ""} onChange={e => updateTipologia(idx, "suites", e.target.value)} className="h-8 text-xs" />
                </div>
                <Button type="button" size="sm" variant="ghost" onClick={() => removeTipologia(idx)} className="h-8 w-8 p-0 text-destructive hover:text-destructive" disabled={tipologias.length <= 1}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>

          {/* Vagas + Status */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Vagas</Label>
              <Input type="number" value={vagasVal} onChange={e => setVagasVal(e.target.value)} className="h-9 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Status da Obra</Label>
              <Input value={statusObra} onChange={e => setStatusObra(e.target.value)} placeholder="Em construção" className="h-9 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Previsão Entrega</Label>
              <Input value={previsaoEntrega} onChange={e => setPrevisaoEntrega(e.target.value)} placeholder="Dez/2027" className="h-9 text-sm" />
            </div>
          </div>

          {/* Descrição */}
          <div>
            <Label className="text-xs">Descrição</Label>
            <Textarea value={descricao} onChange={e => setDescricao(e.target.value)} rows={2} placeholder="Breve descrição do empreendimento..." className="text-sm" />
          </div>

          {/* Fotos — multi upload with drag reorder */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold flex items-center gap-1"><ImageIcon className="h-3.5 w-3.5 text-primary" /> Fotos para Slide (arraste para reordenar)</Label>
            {fotosArray.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {fotosArray.map((url, i) => (
                  <div
                    key={`${url}-${i}`}
                    draggable
                    onDragStart={e => { e.dataTransfer.setData("text/plain", String(i)); e.dataTransfer.effectAllowed = "move"; }}
                    onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
                    onDrop={e => {
                      e.preventDefault();
                      const from = parseInt(e.dataTransfer.getData("text/plain"), 10);
                      if (isNaN(from) || from === i) return;
                      const arr = [...fotosArray];
                      const [moved] = arr.splice(from, 1);
                      arr.splice(i, 0, moved);
                      setFotosText(arr.join("\n"));
                    }}
                    className="relative group/foto cursor-grab active:cursor-grabbing"
                  >
                    <img src={url} alt="" className="h-16 w-24 rounded-lg object-cover border border-border/40" />
                    {/* Position badge */}
                    <span className="absolute top-0.5 left-0.5 h-4 min-w-[16px] px-0.5 rounded bg-foreground/70 text-background text-[9px] font-bold flex items-center justify-center">{i + 1}</span>
                    {/* Grip icon */}
                    <span className="absolute bottom-0.5 left-0.5 opacity-0 group-hover/foto:opacity-80 transition-opacity">
                      <GripVertical className="h-3.5 w-3.5 text-background drop-shadow" />
                    </span>
                    {/* Arrow buttons */}
                    {i > 0 && (
                      <button
                        onClick={e2 => { e2.stopPropagation(); const arr = [...fotosArray]; [arr[i-1], arr[i]] = [arr[i], arr[i-1]]; setFotosText(arr.join("\n")); }}
                        className="absolute top-0.5 right-6 h-5 w-5 rounded-full bg-background/80 border border-border flex items-center justify-center opacity-0 group-hover/foto:opacity-100 transition-opacity"
                      ><ArrowLeft className="h-2.5 w-2.5" /></button>
                    )}
                    {i < fotosArray.length - 1 && (
                      <button
                        onClick={e2 => { e2.stopPropagation(); const arr = [...fotosArray]; [arr[i], arr[i+1]] = [arr[i+1], arr[i]]; setFotosText(arr.join("\n")); }}
                        className="absolute top-0.5 right-[1px] h-5 w-5 rounded-full bg-background/80 border border-border flex items-center justify-center opacity-0 group-hover/foto:opacity-100 transition-opacity"
                      ><ArrowRight className="h-2.5 w-2.5" /></button>
                    )}
                    {/* Delete */}
                    <button
                      onClick={() => setFotosText(prev => prev.split("\n").filter((_, idx) => idx !== i).join("\n"))}
                      className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover/foto:opacity-100 transition-opacity"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <label className="cursor-pointer">
              <input type="file" className="hidden" accept="image/*" multiple onChange={handleImageUpload} disabled={uploading} />
              <div className={cn(
                "flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all border border-dashed w-fit",
                uploading
                  ? "bg-muted/50 text-muted-foreground border-border cursor-wait"
                  : "bg-primary/10 text-primary border-primary/30 hover:bg-primary/20"
              )}>
                {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                {uploading ? "Enviando..." : "Upload de imagens (múltiplas)"}
              </div>
            </label>
            <Textarea value={fotosText} onChange={e => setFotosText(e.target.value)} rows={2} placeholder="Ou cole URLs, uma por linha..." className="text-xs font-mono" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            <X className="h-3.5 w-3.5 mr-1" /> Cancelar
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ═══════════════════════════════════════════════
   CREATE VITRINE DIALOG
   ═══════════════════════════════════════════════ */

function CriarVitrineDialog({
  open,
  onOpenChange,
  config,
  override,
  imovelData,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  config: AnuncioConfig;
  override: EmpreendimentoOverride | null;
  imovelData: JetimobImovel | null;
}) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [leadNome, setLeadNome] = useState("");
  const [leadTel, setLeadTel] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [vitrineUrl, setVitrineUrl] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setTitulo(`${config.nome} — Vitrine Exclusiva`);
      setLeadNome("");
      setLeadTel("");
      setMensagem("");
      setVitrineUrl(null);
    }
  }, [open, config.nome]);

  async function handleCreate() {
    if (!user) return;
    setSaving(true);
    try {
      const images = override?.fotos?.length ? override.fotos : (imovelData ? getImages(imovelData) : []);
      const price = override?.valor_min ?? override?.valor_venda ?? (imovelData ? getPrice(imovelData) : 0);
      const bairro = override?.bairro || imovelData?.bairro || imovelData?.endereco_bairro || "";

      const dadosCustom = [{
        nome: config.nome,
        codigo: config.codigo,
        bairro,
        valor_venda: price,
        valor_min: override?.valor_min || price,
        valor_max: override?.valor_max || null,
        tipologias: override?.tipologias || [],
        area_privativa: override?.area_privativa || imovelData?.area_privativa || 0,
        dormitorios: override?.dormitorios || imovelData?.dormitorios || 0,
        suites: override?.suites || imovelData?.suites || 0,
        vagas: override?.vagas || imovelData?.vagas || 0,
        status_obra: override?.status_obra || imovelData?.status_obra || "",
        previsao_entrega: override?.previsao_entrega || imovelData?.previsao_entrega || "",
        descricao: override?.descricao || imovelData?.descricao || "",
        fotos: images,
      }];

      const { data, error } = await supabase.from("vitrines").insert({
        titulo: titulo || config.nome,
        created_by: user.id,
        tipo: "anuncio",
        imovel_ids: [config.codigo],
        dados_custom: dadosCustom,
        lead_nome: leadNome || null,
        lead_telefone: leadTel || null,
        mensagem_corretor: mensagem || null,
      }).select("id").single();

      if (error) throw error;

      const url = `https://uhomesales.com/vitrine/${data.id}`;
      setVitrineUrl(url);
      toast.success("Vitrine criada!");
    } catch (err: any) {
      toast.error("Erro: " + (err.message || "Falha ao criar vitrine"));
    } finally {
      setSaving(false);
    }
  }

  function shareWhatsApp() {
    if (!vitrineUrl) return;
    const text = `Olá${leadNome ? ` ${leadNome}` : ""}! 🏡\n\nPreparei uma vitrine exclusiva do *${config.nome}* para você:\n\n${vitrineUrl}\n\n${mensagem || "Qualquer dúvida, estou à disposição!"}`;
    const encoded = encodeURIComponent(text);
    const whatsUrl = leadTel
      ? `https://wa.me/55${leadTel.replace(/\D/g, "")}?text=${encoded}`
      : `https://wa.me/?text=${encoded}`;
    window.open(whatsUrl, "_blank");
  }

  function copyLink() {
    if (!vitrineUrl) return;
    navigator.clipboard.writeText(vitrineUrl);
    toast.success("Link copiado!");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Criar Vitrine — {config.nome}
          </DialogTitle>
        </DialogHeader>

        {!vitrineUrl ? (
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Título da Vitrine</Label>
              <Input value={titulo} onChange={e => setTitulo(e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Nome do Cliente (opcional)</Label>
                <Input value={leadNome} onChange={e => setLeadNome(e.target.value)} placeholder="João" className="h-9 text-sm" />
              </div>
              <div>
                <Label className="text-xs">WhatsApp (opcional)</Label>
                <Input value={leadTel} onChange={e => setLeadTel(e.target.value)} placeholder="51999999999" className="h-9 text-sm" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Mensagem personalizada</Label>
              <Textarea value={mensagem} onChange={e => setMensagem(e.target.value)} rows={2} placeholder="Qualquer dúvida, estou à disposição!" className="text-sm" />
            </div>
            <Button onClick={handleCreate} disabled={saving} className="w-full gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {saving ? "Criando..." : "Criar Vitrine"}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl border border-success/30 bg-success/5 p-4 text-center space-y-2">
              <p className="text-sm font-bold text-success">✅ Vitrine criada com sucesso!</p>
              <p className="text-xs text-muted-foreground break-all font-mono bg-muted/30 rounded-lg p-2">{vitrineUrl}</p>
            </div>
            <div className="flex gap-2">
              <Button onClick={shareWhatsApp} className="flex-1 gap-2 bg-emerald-600 hover:bg-emerald-700">
                <Send className="h-4 w-4" /> Enviar via WhatsApp
              </Button>
              <Button onClick={copyLink} variant="outline" className="gap-2">
                <Link2 className="h-4 w-4" /> Copiar
              </Button>
            </div>
            <Button variant="ghost" size="sm" onClick={() => window.open(vitrineUrl, "_blank")} className="w-full gap-2 text-xs">
              <ExternalLink className="h-3.5 w-3.5" /> Visualizar vitrine
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
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
  isAdmin,
  onRefreshMateriais,
  override,
  onEditOverride,
  onEditLanding,
  landingRefreshKey,
}: {
  config: AnuncioConfig;
  segmento: SegmentoConfig;
  imovelData: JetimobImovel | null;
  loading: boolean;
  materiais: Material[];
  canUpload: boolean;
  isAdmin: boolean;
  onRefreshMateriais: () => void;
  override: EmpreendimentoOverride | null;
  onEditOverride: () => void;
  onEditLanding: () => void;
  landingRefreshKey: number;
}) {
  const { user } = useAuth();
  const [vitrineOpen, setVitrineOpen] = useState(false);
  const [landingUrl, setLandingUrl] = useState<string | null>(null);

  // Check for existing landing page vitrine
  useEffect(() => {
    if (!user) return;
    supabase
      .from("vitrines")
      .select("id")
      .eq("tipo", "anuncio")
      .contains("imovel_ids", [config.codigo])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setLandingUrl(`${window.location.origin}/vitrine/${data.id}`);
        }
      });
  }, [config.codigo, user, landingRefreshKey]);

  // Merge: override takes priority over Jetimob data
  const hasOverride = !!override;
  const images = override?.fotos?.length ? override.fotos : (imovelData ? getImages(imovelData) : []);
  const priceMin = override?.valor_min ?? override?.valor_venda ?? (imovelData ? getPrice(imovelData) : 0);
  const priceMax = override?.valor_max ?? 0;
  const bairro = override?.bairro || imovelData?.bairro || imovelData?.endereco_bairro || "";
  const tipologias = override?.tipologias?.length ? override.tipologias : [];
  const area = override?.area_privativa ?? (imovelData?.area_privativa || imovelData?.area_total || 0);
  const dorms = override?.dormitorios ?? (imovelData?.dormitorios || 0);
  const suites = override?.suites ?? (imovelData?.suites || 0);
  const vagas = override?.vagas ?? (imovelData?.vagas || 0);
  const statusObra = override?.status_obra || imovelData?.status_obra || "";
  const previsaoEntrega = override?.previsao_entrega || imovelData?.previsao_entrega || "";
  const hasData = hasOverride || !!imovelData;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Card className={cn(
        "overflow-hidden border-2 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative group/card",
        segmento.borderColor,
        "bg-card"
      )}>
        {/* Edit button for CEO */}
        {canUpload && (
          <button
            onClick={onEditOverride}
            className="absolute top-2 right-2 z-20 h-7 w-7 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover/card:opacity-100 transition-opacity hover:bg-primary"
            title="Personalizar card"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}

        {/* Override indicator */}
        {hasOverride && (
          <div className="absolute top-2 left-2 z-20">
            <Badge className="text-[8px] bg-primary/80 text-primary-foreground border-0 px-1.5 py-0.5">
              ✏️ Personalizado
            </Badge>
          </div>
        )}

        {/* Image */}
        {loading && !hasOverride ? (
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

          {/* Tipologias */}
          {tipologias.length > 0 ? (
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Plantas disponíveis</p>
              <div className="flex flex-wrap gap-1.5">
                {tipologias.map((t, i) => (
                  <Badge key={i} variant="outline" className="text-[10px] gap-1 font-semibold">
                    <BedDouble className="h-3 w-3" />
                    {t.dorms} dorm{t.dorms > 1 ? "s" : ""}
                    {(t.area_min || t.area_max) && (
                      <span className="text-muted-foreground font-normal">
                        · {t.area_min && t.area_max ? `${t.area_min}–${t.area_max}m²` : t.area_min ? `${t.area_min}m²` : `${t.area_max}m²`}
                      </span>
                    )}
                    {t.suites ? <span className="text-muted-foreground font-normal">· {t.suites} suíte{t.suites > 1 ? "s" : ""}</span> : null}
                  </Badge>
                ))}
              </div>
            </div>
          ) : hasData && (
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

          {/* Vagas (when tipologias exist) */}
          {tipologias.length > 0 && vagas > 0 && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              🚗 <span className="font-semibold text-foreground">{vagas} vaga{vagas > 1 ? "s" : ""}</span>
            </div>
          )}

          {/* Price Range */}
          <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-xl px-3 py-2">
            {priceMax > 0 && priceMin > 0 ? (
              <>
                <p className="text-[10px] text-muted-foreground font-medium">Faixa de valores</p>
                <p className="text-lg font-black text-primary tracking-tight">
                  {loading && !hasOverride ? "Carregando..." : `${formatBRLCompact(priceMin)} — ${formatBRLCompact(priceMax)}`}
                </p>
              </>
            ) : (
              <>
                <p className="text-[10px] text-muted-foreground font-medium">A partir de</p>
                <p className="text-lg font-black text-primary tracking-tight">
                  {loading && !hasOverride ? "Carregando..." : formatPrice(priceMin)}
                </p>
              </>
            )}
          </div>

          {/* Status */}
          {statusObra && (
            <div className="flex items-center gap-1.5">
              <Badge variant="outline" className="text-[10px] font-bold">
                🏗️ {statusObra}
              </Badge>
              {previsaoEntrega && (
                <Badge variant="outline" className="text-[10px]">
                  📅 {previsaoEntrega}
                </Badge>
              )}
            </div>
          )}

          {/* Landing Page + Vitrine Buttons */}
          <div className="space-y-2">
            {/* Admin: edit landing page */}
            {isAdmin && (
              <Button
                size="sm"
                variant="outline"
                onClick={onEditLanding}
                className="w-full gap-2 text-xs font-bold border-amber-500/30 text-amber-600 hover:bg-amber-500/10"
              >
                <Pencil className="h-3.5 w-3.5" />
                Editar Landing Page
              </Button>
            )}

            {/* Everyone: view landing if exists */}
            {landingUrl && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => window.open(landingUrl, "_blank")}
                className="w-full gap-2 text-xs font-bold border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10"
              >
                <Eye className="h-3.5 w-3.5" />
                Ver Landing Page
              </Button>
            )}

            {/* Vitrine button */}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setVitrineOpen(true)}
              className="w-full gap-2 text-xs font-bold border-primary/30 text-primary hover:bg-primary/10"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Criar Vitrine
            </Button>
          </div>

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

      {/* Vitrine Dialog */}
      <CriarVitrineDialog
        open={vitrineOpen}
        onOpenChange={setVitrineOpen}
        config={config}
        override={override}
        imovelData={imovelData}
      />
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
  const [overrides, setOverrides] = useState<Record<string, EmpreendimentoOverride>>({});
  const [editingCodigo, setEditingCodigo] = useState<string | null>(null);
  const [landingCodigo, setLandingCodigo] = useState<string | null>(null);
  const [landingRefreshKey, setLandingRefreshKey] = useState(0);

  // Fetch overrides from DB
  const fetchOverrides = useCallback(async () => {
    const { data } = await supabase
      .from("empreendimento_overrides")
      .select("*");
    if (data) {
      const map: Record<string, EmpreendimentoOverride> = {};
      for (const row of data) {
        map[row.codigo] = row as any as EmpreendimentoOverride;
      }
      setOverrides(map);
    }
  }, []);

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
        if (!cancelled) setLoading(false);

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
    fetchOverrides();
    return () => {
      cancelled = true;
    };
  }, [fetchOverrides]);

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
  const editingConfig = editingCodigo ? SEGMENTOS.flatMap(s => s.empreendimentos).find(e => e.codigo === editingCodigo) : null;

  return (
    <div className="space-y-6 pb-8">
      {/* Edit Override Modal */}
      {editingConfig && (
        <EditOverrideModal
          open={!!editingCodigo}
          onOpenChange={(v) => { if (!v) setEditingCodigo(null); }}
          config={editingConfig}
          override={overrides[editingConfig.codigo] || null}
          onSaved={fetchOverrides}
        />
      )}

      {/* Landing Page Editor */}
      {landingCodigo && (() => {
        const landingConfig = SEGMENTOS.flatMap(s => s.empreendimentos).find(e => e.codigo === landingCodigo);
        const landingOverride = overrides[landingCodigo] || null;
        return landingConfig ? (
          <LandingPageEditor
            open={!!landingCodigo}
            onOpenChange={(v) => { if (!v) setLandingCodigo(null); }}
            codigo={landingConfig.codigo}
            nome={landingConfig.nome}
            existing={landingOverride ? {
              id: landingOverride.id,
              codigo: landingOverride.codigo,
              diferenciais: (landingOverride as any).diferenciais || [],
              plantas: (landingOverride as any).plantas || [],
              video_url: (landingOverride as any).video_url || "",
              mapa_url: (landingOverride as any).mapa_url || "",
              cor_primaria: (landingOverride as any).cor_primaria || "#1e3a5f",
              landing_titulo: (landingOverride as any).landing_titulo || "",
              landing_subtitulo: (landingOverride as any).landing_subtitulo || "",
            } : null}
            onSaved={fetchOverrides}
          />
        ) : null;
      })()}

      {/* ─── HEADER ─── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[hsl(222,47%,11%)] via-[hsl(222,47%,15%)] to-[hsl(222,47%,20%)] p-6 border border-border/20">
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
                    isAdmin={isAdmin}
                    onRefreshMateriais={fetchMateriais}
                    override={overrides[emp.codigo] || null}
                    onEditOverride={() => setEditingCodigo(emp.codigo)}
                    onEditLanding={() => setLandingCodigo(emp.codigo)}
                    landingRefreshKey={landingRefreshKey}
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
