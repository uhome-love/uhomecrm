import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X, Search, Sparkles, Home, MapPin, DollarSign, Bed, Car, Ruler, Copy, ExternalLink, Check } from "lucide-react";
import { toast } from "sonner";
import { formatBRL } from "@/lib/utils";

export interface RadarProfileData {
  tipos: string[];
  bairros: string[];
  valor_min: string;
  valor_max: string;
  dormitorios_min: string;
  suites_min: string;
  vagas_min: string;
  area_min: string;
  area_max: string;
  empreendimento?: string | null;
  momento_compra: string;
  urgencia: string;
  status_imovel: string;
}

interface RadarFullscreenModalProps {
  open: boolean;
  onClose: () => void;
  leadNome: string;
  profile: RadarProfileData;
  isSearching?: boolean;
  matches: any[];
  onUpdateMatch?: (editedProfile: RadarProfileData) => void;
  onIAPerfil?: () => void;
  isAIAnalyzing?: boolean;
  onCriarVitrine?: (selectedIndexes: number[]) => Promise<string | void>;
  isCreatingVitrine?: boolean;
}

function EditableField({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-muted/50 rounded-lg p-3 mb-3">
      <div className="flex items-center gap-1.5 mb-1.5">
        {icon}
        <span className="text-xs text-muted-foreground uppercase font-semibold tracking-wide">{label}</span>
      </div>
      {children}
    </div>
  );
}

const TIPO_OPTIONS = [
  { value: "apartamento", label: "Apartamento" },
  { value: "casa", label: "Casa" },
  { value: "terreno", label: "Terreno" },
  { value: "comercial", label: "Comercial" },
  { value: "cobertura", label: "Cobertura" },
];

const DORM_OPTIONS = [
  { value: "1", label: "1" },
  { value: "2", label: "2" },
  { value: "3", label: "3" },
  { value: "4", label: "4+" },
];

const VAGAS_OPTIONS = [
  { value: "1", label: "1" },
  { value: "2", label: "2" },
  { value: "3", label: "3+" },
];

const STATUS_OPTIONS = [
  { value: "qualquer", label: "Qualquer" },
  { value: "pronto", label: "Pronto p/ morar" },
  { value: "obras", label: "Em obras / Lançamento" },
];

const MOMENTO_OPTIONS = [
  { value: "imediato", label: "Imediato" },
  { value: "3_meses", label: "3 meses" },
  { value: "6_meses", label: "6 meses" },
  { value: "1_ano", label: "1 ano" },
  { value: "pesquisando", label: "Pesquisando" },
];

export default function RadarFullscreenModal({ open, onClose, leadNome, profile, matches, isSearching, onUpdateMatch, onIAPerfil, isAIAnalyzing, onCriarVitrine, isCreatingVitrine }: RadarFullscreenModalProps) {
  const [form, setForm] = useState<RadarProfileData>(profile);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [vitrineUrl, setVitrineUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open) { setForm(profile); setSelected(new Set()); }
  }, [open, profile]);

  const updateField = <K extends keyof RadarProfileData>(key: K, value: RadarProfileData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-[95vw] w-[95vw] h-[90vh] p-0 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-border flex justify-between items-center shrink-0">
          <h2 className="text-base font-bold text-foreground">Radar — {leadNome}</h2>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Body — 2 colunas */}
        <div className="flex flex-1 overflow-hidden">
          {/* Coluna esquerda — Perfil editável */}
          <div className="w-[320px] min-w-[320px] border-r border-border p-4 overflow-y-auto">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Perfil do Lead</h3>

            <EditableField label="Tipo de imóvel" icon={<Home className="h-3.5 w-3.5 text-muted-foreground" />}>
              <Select
                value={form.tipos[0] || ""}
                onValueChange={(v) => updateField("tipos", [v])}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {TIPO_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </EditableField>

            <EditableField label="Bairros de interesse" icon={<MapPin className="h-3.5 w-3.5 text-muted-foreground" />}>
              <Input
                className="h-8 text-sm"
                placeholder="Ex: Moema, Vila Mariana"
                value={form.bairros.join(", ")}
                onChange={(e) => updateField("bairros", e.target.value.split(",").map((b) => b.trim()).filter(Boolean))}
              />
            </EditableField>

            <EditableField label="Faixa de preço" icon={<DollarSign className="h-3.5 w-3.5 text-muted-foreground" />}>
              <div className="flex gap-2">
                <Input
                  className="h-8 text-sm flex-1"
                  type="number"
                  placeholder="Mín"
                  value={form.valor_min}
                  onChange={(e) => updateField("valor_min", e.target.value)}
                />
                <Input
                  className="h-8 text-sm flex-1"
                  type="number"
                  placeholder="Máx"
                  value={form.valor_max}
                  onChange={(e) => updateField("valor_max", e.target.value)}
                />
              </div>
            </EditableField>

            <EditableField label="Dormitórios" icon={<Bed className="h-3.5 w-3.5 text-muted-foreground" />}>
              <Select
                value={form.dormitorios_min || ""}
                onValueChange={(v) => updateField("dormitorios_min", v)}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {DORM_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </EditableField>

            <EditableField label="Vagas" icon={<Car className="h-3.5 w-3.5 text-muted-foreground" />}>
              <Select
                value={form.vagas_min || ""}
                onValueChange={(v) => updateField("vagas_min", v)}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {VAGAS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </EditableField>

            <EditableField label="Metragem (m²)" icon={<Ruler className="h-3.5 w-3.5 text-muted-foreground" />}>
              <div className="flex gap-2">
                <Input
                  className="h-8 text-sm flex-1"
                  type="number"
                  placeholder="Mín"
                  value={form.area_min}
                  onChange={(e) => updateField("area_min", e.target.value)}
                />
                <Input
                  className="h-8 text-sm flex-1"
                  type="number"
                  placeholder="Máx"
                  value={form.area_max}
                  onChange={(e) => updateField("area_max", e.target.value)}
                />
              </div>
            </EditableField>

            {form.empreendimento && (
              <EditableField label="Empreendimento" icon={<Home className="h-3.5 w-3.5 text-muted-foreground" />}>
                <p className="text-sm font-medium text-foreground">{form.empreendimento}</p>
              </EditableField>
            )}

            <EditableField label="Status do imóvel" icon={<Home className="h-3.5 w-3.5 text-muted-foreground" />}>
              <Select
                value={form.status_imovel || "qualquer"}
                onValueChange={(v) => updateField("status_imovel", v)}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </EditableField>

            <EditableField label="Momento de compra" icon={<Home className="h-3.5 w-3.5 text-muted-foreground" />}>
              <Select
                value={form.momento_compra || ""}
                onValueChange={(v) => updateField("momento_compra", v)}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {MOMENTO_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </EditableField>

            <div className="space-y-2 mt-4">
              <Button
                className="w-full gap-2 bg-[#4F46E5] hover:bg-[#4338CA] text-white"
                disabled={isSearching}
                onClick={() => onUpdateMatch?.(form)}
              >
                <Search className="h-4 w-4" />
                {isSearching ? "Buscando..." : "🔍 Atualizar Match"}
              </Button>
              <Button
                variant="outline"
                className="w-full gap-2"
                disabled={isAIAnalyzing}
                onClick={onIAPerfil}
              >
                <Sparkles className="h-4 w-4" />
                {isAIAnalyzing ? "Analisando..." : "🤖 IA Perfil"}
              </Button>
              <p className="text-xs text-muted-foreground text-center">Última busca: --</p>
            </div>
          </div>

          {/* Coluna direita — Imóveis */}
          <div className="flex-1 p-4 overflow-y-auto">
            {matches.length > 0 ? (
              <>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold text-lg text-foreground">Imóveis Compatíveis</h3>
                  <span className="bg-muted text-muted-foreground text-xs font-semibold px-2 py-1 rounded-full">
                    {matches.length}
                  </span>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                  {matches.map((item, idx) => {
                    const foto = item.imagem || item.foto_principal_url || (item.fotos && item.fotos[0]) || null;
                    const nome = item.nome || item.titulo || item.empreendimento || "Imóvel";
                    const preco = item.preco ? formatBRL(item.preco) : "—";
                    const infoParts = [
                      item.dorms ? `${item.dorms} quartos` : null,
                      item.vagas ? `${item.vagas} vagas` : null,
                      item.metragem ? `${item.metragem} m²` : (item.metragens || null),
                    ].filter(Boolean);

                    const isSelected = selected.has(idx);
                    const toggleSelect = () => setSelected(prev => {
                      const next = new Set(prev);
                      if (next.has(idx)) next.delete(idx); else next.add(idx);
                      return next;
                    });

                    return (
                      <div
                        key={item.codigo || item.id || idx}
                        className={`border rounded-lg overflow-hidden bg-card cursor-pointer transition-colors ${isSelected ? "border-primary ring-2 ring-primary/30" : "border-border"}`}
                        onClick={toggleSelect}
                      >
                        {foto ? (
                          <img src={foto} alt={nome} className="h-40 w-full object-cover" loading="lazy" />
                        ) : (
                          <div className="h-40 w-full bg-muted flex items-center justify-center">
                            <Home className="h-8 w-8 text-muted-foreground/40" />
                          </div>
                        )}
                        <div className="p-3">
                          <p className="font-semibold text-sm truncate text-foreground">{nome}</p>
                          <p className="text-xs text-muted-foreground">{item.bairro || "—"}</p>
                          <p className="text-base font-bold text-[#4F46E5] mt-1">{preco}</p>
                        </div>
                        {infoParts.length > 0 && (
                          <div className="px-3 pb-3">
                            <p className="text-xs text-muted-foreground">{infoParts.join(" · ")}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center gap-3">
                <Search className="h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">Clique em Atualizar Match para buscar imóveis</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border flex justify-between items-center shrink-0 gap-3">
          <span className="text-sm text-muted-foreground">{selected.size} selecionado{selected.size !== 1 ? "s" : ""}</span>
          
          {vitrineUrl && (
            <div className="flex items-center gap-2 flex-1 justify-center">
              <div className="flex items-center gap-1.5 bg-muted rounded-md px-3 py-1.5 max-w-md">
                <span className="text-xs text-muted-foreground truncate">{vitrineUrl}</span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 shrink-0"
                  onClick={async () => {
                    await navigator.clipboard.writeText(vitrineUrl);
                    setCopied(true);
                    toast.success("Link copiado!");
                    setTimeout(() => setCopied(false), 2000);
                  }}
                >
                  {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 shrink-0"
                  onClick={() => window.open(vitrineUrl, "_blank")}
                >
                  <ExternalLink className="h-3 w-3" />
                </Button>
              </div>
            </div>
          )}

          <Button
            disabled={selected.size === 0 || isCreatingVitrine}
            className="bg-emerald-600 text-white hover:bg-emerald-700"
            onClick={async () => {
              const url = await onCriarVitrine?.(Array.from(selected));
              if (url) setVitrineUrl(url);
            }}
          >
            {isCreatingVitrine ? "Criando..." : "Criar Vitrine"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
