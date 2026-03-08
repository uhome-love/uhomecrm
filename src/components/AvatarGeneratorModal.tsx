import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Sparkles, RefreshCw, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface AvatarGeneratorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerated: (url: string) => void;
}

const HAIR_COLORS = [
  { label: "Castanho", value: "brown", color: "#8B4513" },
  { label: "Preto", value: "black", color: "#1a1a1a" },
  { label: "Loiro", value: "blonde", color: "#F0D060" },
  { label: "Ruivo", value: "red", color: "#C04000" },
  { label: "Grisalho", value: "gray", color: "#A0A0A0" },
];

const EYE_COLORS = [
  { label: "Castanho", value: "brown", color: "#8B4513" },
  { label: "Azul", value: "blue", color: "#3B82F6" },
  { label: "Verde", value: "green", color: "#22C55E" },
  { label: "Preto", value: "dark brown", color: "#1a1a1a" },
];

const SKIN_TONES = [
  { label: "Claro", value: "light/fair", color: "#FDDCB5" },
  { label: "Médio-claro", value: "medium-light", color: "#E8B88A" },
  { label: "Médio", value: "medium/tan", color: "#C68D5B" },
  { label: "Médio-escuro", value: "medium-dark", color: "#8D5E3C" },
  { label: "Escuro", value: "dark", color: "#5C3A1E" },
];

const HAIR_STYLES = ["Curto", "Médio", "Longo", "Raspado", "Cacheado"];
const GENDERS = ["Masculino", "Feminino"];
const OUTFITS = [
  { label: "Social (terno/blazer)", value: "formal suit and blazer" },
  { label: "Business casual (camisa)", value: "business casual shirt" },
  { label: "Casual (camiseta)", value: "casual t-shirt" },
  { label: "Esportivo", value: "sporty outfit" },
];
const EXPRESSIONS = [
  { label: "😊 Sorrindo", value: "warm smile" },
  { label: "😎 Confiante", value: "confident" },
  { label: "🤩 Animado", value: "excited and enthusiastic" },
  { label: "😌 Sereno", value: "calm and serene" },
];
const ACCESSORIES = [
  { label: "Óculos", value: "glasses" },
  { label: "Barba", value: "beard" },
  { label: "Bigode", value: "mustache" },
  { label: "Brinco", value: "earring" },
];

type Step = "customize" | "generating" | "preview";

export default function AvatarGeneratorModal({ open, onOpenChange, onGenerated }: AvatarGeneratorModalProps) {
  const { user } = useAuth();
  const [step, setStep] = useState<Step>("customize");
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [gender, setGender] = useState("Masculino");
  const [hairColor, setHairColor] = useState("brown");
  const [hairStyle, setHairStyle] = useState("Curto");
  const [eyeColor, setEyeColor] = useState("brown");
  const [skinTone, setSkinTone] = useState("medium/tan");
  const [outfit, setOutfit] = useState("formal suit and blazer");
  const [accessories, setAccessories] = useState<string[]>([]);
  const [expression, setExpression] = useState("warm smile");

  function toggleAccessory(val: string) {
    setAccessories((prev) => prev.includes(val) ? prev.filter((a) => a !== val) : [...prev, val]);
  }

  function buildPrompt(): string {
    const genderEn = gender === "Masculino" ? "male" : "female";
    const hairStyleEn = { Curto: "short", Médio: "medium-length", Longo: "long", Raspado: "buzz-cut", Cacheado: "curly" }[hairStyle] || "short";
    const accStr = accessories.length > 0 ? `, with ${accessories.join(" and ")}` : "";

    return `3D chibi vinyl toy character figure, ${genderEn}, ${hairColor} ${hairStyleEn} hair, ${eyeColor} eyes, ${skinTone} skin tone, wearing ${outfit}${accStr}, ${expression} expression, blue Uhome logo on chest, house-shaped hood detail, glowing cyan eyes accent, chibi proportions with oversized head, matte plastic toy appearance, soft studio lighting, pure white background, high quality render, same style as Homi AI mascot from UhomeSales, centered full body, square image`;
  }

  async function handleGenerate() {
    if (!user) return;
    setStep("generating");
    setError(null);

    try {
      const prompt = buildPrompt();
      const { data, error: fnError } = await supabase.functions.invoke("generate-avatar", {
        body: { prompt },
      });

      if (fnError) throw new Error(fnError.message || "Erro ao gerar avatar");
      if (data?.error) throw new Error(data.error);
      const url = data?.url;
      if (!url) throw new Error("Nenhuma imagem retornada");

      setGeneratedUrl(url);
      setStep("preview");
    } catch (err: any) {
      console.error("Avatar generation error:", err);
      const msg = err?.message || "";
      if (msg.includes("Rate limit")) {
        setError("Limite atingido. Tente novamente em alguns minutos.");
      } else if (msg.includes("Créditos")) {
        setError("Créditos insuficientes para gerar avatar.");
      } else {
        setError("Não conseguimos gerar seu avatar. Tente novamente.");
      }
      setStep("customize");
    }
  }

  function handleApprove() {
    if (generatedUrl) {
      onGenerated(generatedUrl);
      toast.success("Avatar HOMI aplicado! 🤖✨");
    }
    handleClose();
  }

  function handleRetry() {
    setGeneratedUrl(null);
    setStep("customize");
  }

  function handleClose() {
    if (step === "generating") return;
    setStep("customize");
    setGeneratedUrl(null);
    setError(null);
    onOpenChange(false);
  }

  // Color swatch button
  function ColorBtn({ selected, color, label, onClick }: { selected: boolean; color: string; label: string; onClick: () => void }) {
    return (
      <button
        type="button"
        onClick={onClick}
        title={label}
        className={cn(
          "w-8 h-8 rounded-full border-2 transition-all flex items-center justify-center",
          selected ? "border-primary ring-2 ring-primary/30 scale-110" : "border-border hover:scale-105"
        )}
        style={{ backgroundColor: color }}
      >
        {selected && <Check className="h-3.5 w-3.5 text-white drop-shadow-md" />}
      </button>
    );
  }

  // Radio pill
  function RadioPill({ selected, label, onClick }: { selected: boolean; label: string; onClick: () => void }) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
          selected
            ? "bg-primary text-primary-foreground border-primary"
            : "bg-muted/40 text-muted-foreground border-border hover:bg-muted"
        )}
      >
        {label}
      </button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-primary" />
            ✨ Criar seu Avatar HOMI
          </DialogTitle>
          <DialogDescription>Personalize seu personagem 3D exclusivo</DialogDescription>
        </DialogHeader>

        {/* ── STEP: CUSTOMIZE ── */}
        {step === "customize" && (
          <div className="space-y-5 pt-1">
            {/* Gênero */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Gênero</Label>
              <div className="flex gap-2">
                {GENDERS.map((g) => (
                  <RadioPill key={g} label={g} selected={gender === g} onClick={() => setGender(g)} />
                ))}
              </div>
            </div>

            {/* Cor do cabelo */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Cor do cabelo</Label>
              <div className="flex gap-2">
                {HAIR_COLORS.map((c) => (
                  <ColorBtn key={c.value} label={c.label} color={c.color} selected={hairColor === c.value} onClick={() => setHairColor(c.value)} />
                ))}
              </div>
            </div>

            {/* Estilo do cabelo */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Estilo do cabelo</Label>
              <div className="flex flex-wrap gap-2">
                {HAIR_STYLES.map((s) => (
                  <RadioPill key={s} label={s} selected={hairStyle === s} onClick={() => setHairStyle(s)} />
                ))}
              </div>
            </div>

            {/* Cor dos olhos */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Cor dos olhos</Label>
              <div className="flex gap-2">
                {EYE_COLORS.map((c) => (
                  <ColorBtn key={c.value} label={c.label} color={c.color} selected={eyeColor === c.value} onClick={() => setEyeColor(c.value)} />
                ))}
              </div>
            </div>

            {/* Tom de pele */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tom de pele</Label>
              <div className="flex gap-2">
                {SKIN_TONES.map((t) => (
                  <ColorBtn key={t.value} label={t.label} color={t.color} selected={skinTone === t.value} onClick={() => setSkinTone(t.value)} />
                ))}
              </div>
            </div>

            {/* Roupa */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Roupa / Estilo</Label>
              <div className="flex flex-wrap gap-2">
                {OUTFITS.map((o) => (
                  <RadioPill key={o.value} label={o.label} selected={outfit === o.value} onClick={() => setOutfit(o.value)} />
                ))}
              </div>
            </div>

            {/* Acessórios */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Acessórios</Label>
              <div className="flex flex-wrap gap-3">
                {ACCESSORIES.map((a) => (
                  <label key={a.value} className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <Checkbox
                      checked={accessories.includes(a.value)}
                      onCheckedChange={() => toggleAccessory(a.value)}
                    />
                    {a.label}
                  </label>
                ))}
              </div>
            </div>

            {/* Expressão */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Expressão</Label>
              <div className="flex flex-wrap gap-2">
                {EXPRESSIONS.map((ex) => (
                  <RadioPill key={ex.value} label={ex.label} selected={expression === ex.value} onClick={() => setExpression(ex.value)} />
                ))}
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-center">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            {/* Generate button */}
            <Button onClick={handleGenerate} className="w-full gap-2 bg-emerald-600 hover:bg-emerald-500 text-white" size="lg">
              <Sparkles className="h-4 w-4" />
              ✨ Gerar meu Avatar
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              Seu avatar será gerado no estilo chibi 3D da Uhome 🤖
            </p>
          </div>
        )}

        {/* ── STEP: GENERATING ── */}
        {step === "generating" && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center animate-pulse">
                <span className="text-4xl">🤖</span>
              </div>
              <Loader2 className="absolute -bottom-1 -right-1 h-6 w-6 animate-spin text-primary" />
            </div>
            <p className="text-base font-medium text-foreground">HOMI está criando seu avatar...</p>
            <p className="text-xs text-muted-foreground animate-pulse">Isso pode levar ~15 segundos</p>
          </div>
        )}

        {/* ── STEP: PREVIEW ── */}
        {step === "preview" && generatedUrl && (
          <div className="flex flex-col items-center gap-5 py-4">
            <div className="w-48 h-48 rounded-2xl overflow-hidden ring-2 ring-primary shadow-xl">
              <img src={generatedUrl} alt="Avatar gerado" className="w-full h-full object-cover" />
            </div>
            <p className="text-sm text-muted-foreground">Ficou do seu jeito?</p>
            <div className="flex gap-3 w-full">
              <Button onClick={handleApprove} className="flex-1 gap-2 bg-emerald-600 hover:bg-emerald-500 text-white" size="lg">
                <Check className="h-4 w-4" />
                Usar este avatar
              </Button>
              <Button onClick={handleRetry} variant="outline" className="gap-2" size="lg">
                <RefreshCw className="h-4 w-4" />
                Gerar outro
              </Button>
              <Button onClick={handleClose} variant="ghost" size="lg">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
