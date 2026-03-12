import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, Upload, Trash2, Plus, X, Palette, MapPin, FileText, Video, Image as ImageIcon, Save, Eye } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";

interface LandingOverride {
  id?: string;
  codigo: string;
  diferenciais?: string[];
  plantas?: string[];
  video_url?: string;
  mapa_url?: string;
  cor_primaria?: string;
  landing_titulo?: string;
  landing_subtitulo?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  codigo: string;
  nome: string;
  existing?: LandingOverride | null;
  onSaved: () => void;
}

export default function LandingPageEditor({ open, onOpenChange, codigo, nome, existing, onSaved }: Props) {
  const [titulo, setTitulo] = useState(existing?.landing_titulo || "");
  const [subtitulo, setSubtitulo] = useState(existing?.landing_subtitulo || "");
  const [cor, setCor] = useState(existing?.cor_primaria || "#1e3a5f");
  const [videoUrl, setVideoUrl] = useState(existing?.video_url || "");
  const [diferenciais, setDiferenciais] = useState<string[]>(existing?.diferenciais || []);
  const [plantas, setPlantas] = useState<string[]>(existing?.plantas || []);
  const [mapaUrl, setMapaUrl] = useState(existing?.mapa_url || "");
  const [newDif, setNewDif] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<"planta" | "mapa" | null>(null);

  const handleUpload = useCallback(async (file: File, type: "planta" | "mapa") => {
    setUploading(type);
    try {
      const ext = file.name.split(".").pop();
      const path = `${codigo}/${type}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("landing-assets").upload(path, file, { contentType: file.type });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from("landing-assets").getPublicUrl(path);

      if (type === "planta") {
        setPlantas(prev => [...prev, publicUrl]);
      } else {
        setMapaUrl(publicUrl);
      }
      toast.success(`${type === "planta" ? "Planta" : "Mapa"} enviado!`);
    } catch (err: any) {
      toast.error("Erro ao enviar arquivo: " + (err.message || ""));
    } finally {
      setUploading(null);
    }
  }, [codigo]);

  const removePlanta = (idx: number) => setPlantas(prev => prev.filter((_, i) => i !== idx));
  const addDiferencial = () => {
    if (newDif.trim()) {
      setDiferenciais(prev => [...prev, newDif.trim()]);
      setNewDif("");
    }
  };
  const removeDiferencial = (idx: number) => setDiferenciais(prev => prev.filter((_, i) => i !== idx));

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const payload = {
        codigo,
        diferenciais,
        plantas,
        video_url: videoUrl.trim() || null,
        mapa_url: mapaUrl || null,
        cor_primaria: cor,
        landing_titulo: titulo.trim() || null,
        landing_subtitulo: subtitulo.trim() || null,
        updated_at: new Date().toISOString(),
      };

      if (existing?.id) {
        const { error } = await supabase.from("empreendimento_overrides").update(payload as any).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("empreendimento_overrides").upsert(payload as any, { onConflict: "codigo" });
        if (error) throw error;
      }

      toast.success("Landing page salva com sucesso!");
      onSaved();
      onOpenChange(false);
    } catch (err: any) {
      toast.error("Erro: " + (err.message || ""));
    } finally {
      setSaving(false);
    }
  }, [codigo, titulo, subtitulo, cor, videoUrl, diferenciais, plantas, mapaUrl, existing, onSaved, onOpenChange]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg p-0 flex flex-col">
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border">
          <SheetTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-5 w-5 text-primary" />
            Landing Page — {nome}
          </SheetTitle>
        </SheetHeader>
        <ScrollArea className="flex-1 px-6 py-4">
          <div className="space-y-6 pb-6">

            {/* Hero */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-primary" /> Hero / Capa
              </h3>
              <div className="space-y-2">
                <Label className="text-xs">Título da Landing</Label>
                <Input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder={`Ex: Viva o melhor de Porto Alegre`} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Subtítulo</Label>
                <Input value={subtitulo} onChange={e => setSubtitulo(e.target.value)} placeholder="Ex: Apartamentos de 2 e 3 dormitórios no Menino Deus" />
              </div>
            </section>

            {/* Cor */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Palette className="h-4 w-4 text-primary" /> Cor Tema
              </h3>
              <div className="flex items-center gap-3">
                <input type="color" value={cor} onChange={e => setCor(e.target.value)} className="w-12 h-10 rounded-lg cursor-pointer border border-border" />
                <Input value={cor} onChange={e => setCor(e.target.value)} className="w-28 font-mono text-sm" />
                <div className="flex-1 h-10 rounded-lg" style={{ background: `linear-gradient(135deg, ${cor}, ${cor}cc)` }} />
              </div>
            </section>

            {/* Diferenciais */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                ✨ Diferenciais
              </h3>
              <div className="space-y-2">
                {diferenciais.map((d, i) => (
                  <div key={i} className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2 text-sm">
                    <span className="flex-1">{d}</span>
                    <button onClick={() => removeDiferencial(i)} className="text-muted-foreground hover:text-destructive">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <Input
                    value={newDif}
                    onChange={e => setNewDif(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && addDiferencial()}
                    placeholder="Ex: Piscina aquecida"
                    className="flex-1"
                  />
                  <Button variant="outline" size="icon" onClick={addDiferencial} disabled={!newDif.trim()}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </section>

            {/* Plantas */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" /> Plantas
              </h3>
              <div className="grid grid-cols-3 gap-2">
                {plantas.map((url, i) => (
                  <div key={i} className="relative aspect-square rounded-lg overflow-hidden group border border-border">
                    <img src={url} alt={`Planta ${i + 1}`} className="w-full h-full object-cover" />
                    <button
                      onClick={() => removePlanta(i)}
                      className="absolute top-1 right-1 bg-destructive text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                <label className="aspect-square rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center cursor-pointer hover:bg-muted/30 transition-colors">
                  {uploading === "planta" ? (
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  ) : (
                    <>
                      <Upload className="h-5 w-5 text-muted-foreground mb-1" />
                      <span className="text-[10px] text-muted-foreground">Adicionar</span>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0], "planta")}
                  />
                </label>
              </div>
            </section>

            {/* Vídeo */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Video className="h-4 w-4 text-primary" /> Vídeo
              </h3>
              <Input
                value={videoUrl}
                onChange={e => setVideoUrl(e.target.value)}
                placeholder="https://youtube.com/watch?v=... ou https://instagram.com/reel/..."
              />
              {videoUrl && videoUrl.includes("youtu") && (
                <div className="aspect-video rounded-lg overflow-hidden bg-black">
                  <iframe
                    src={`https://www.youtube.com/embed/${extractYoutubeId(videoUrl)}`}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              )}
            </section>

            {/* Mapa */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" /> Localização (imagem)
              </h3>
              {mapaUrl ? (
                <div className="relative rounded-lg overflow-hidden border border-border">
                  <img src={mapaUrl} alt="Mapa" className="w-full h-48 object-cover" />
                  <button
                    onClick={() => setMapaUrl("")}
                    className="absolute top-2 right-2 bg-destructive text-white rounded-full p-1.5"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <label className="h-32 rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center cursor-pointer hover:bg-muted/30 transition-colors">
                  {uploading === "mapa" ? (
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  ) : (
                    <>
                      <Upload className="h-6 w-6 text-muted-foreground mb-1" />
                      <span className="text-xs text-muted-foreground">Upload imagem do mapa</span>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0], "mapa")}
                  />
                </label>
              )}
            </section>
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving} className="flex-1 gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar Landing
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function extractYoutubeId(url: string): string {
  const match = url.match(/(?:youtu\.be\/|v=|\/embed\/)([^?&#]+)/);
  return match?.[1] || "";
}
