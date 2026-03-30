import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X, Search, Sparkles, Home, MapPin, DollarSign, Bed, Car, Ruler, Copy, ExternalLink, Check, MessageSquare, Save } from "lucide-react";
import { toast } from "sonner";
import { formatBRL } from "@/lib/utils";
import { gerarSlugUhome } from "@/services/siteImoveis";
import { supabase } from "@/integrations/supabase/client";

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
  leadTelefone?: string | null;
  leadId?: string;
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
  { value: "apartamento", label: "Apto" },
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

/** Toggle chip for multi-select */
function ToggleChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-background text-muted-foreground border-border hover:border-primary/50"
      }`}
    >
      {label}
    </button>
  );
}

export default function RadarFullscreenModal({ open, onClose, leadNome, leadTelefone, leadId, profile, matches, isSearching, onUpdateMatch, onIAPerfil, isAIAnalyzing, onCriarVitrine, isCreatingVitrine }: RadarFullscreenModalProps) {
  const [form, setForm] = useState<RadarProfileData>(profile);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [vitrineUrl, setVitrineUrl] = useState<string | null>(null);
  const vitrineUrlRef = useRef<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [discarded, setDiscarded] = useState<Set<number>>(new Set());
  const [previewFoto, setPreviewFoto] = useState<string | null>(null);
  const [bairroInput, setBairroInput] = useState("");
  const [bairroSuggestions, setBairroSuggestions] = useState<string[]>([]);
  const [showBairroDropdown, setShowBairroDropdown] = useState(false);
  const bairroInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) { setForm(profile); setSelected(new Set()); setVitrineUrl(null); vitrineUrlRef.current = null; }
  }, [open, profile]);

  const updateField = <K extends keyof RadarProfileData>(key: K, value: RadarProfileData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  // Multi-select togglers
  const toggleTipo = (tipo: string) => {
    setForm(prev => ({
      ...prev,
      tipos: prev.tipos.includes(tipo)
        ? prev.tipos.filter(t => t !== tipo)
        : [...prev.tipos, tipo],
    }));
  };

  const toggleDorm = (dorm: string) => {
    setForm(prev => ({
      ...prev,
      dormitorios_min: prev.dormitorios_min === dorm ? "" : dorm,
      // For multi-dorm, store as comma-separated or just use the value
    }));
  };

  const toggleVaga = (vaga: string) => {
    setForm(prev => ({
      ...prev,
      vagas_min: prev.vagas_min === vaga ? "" : vaga,
    }));
  };

  const addBairro = (bairro: string) => {
    if (bairro && !form.bairros.includes(bairro)) {
      setForm(prev => ({ ...prev, bairros: [...prev.bairros, bairro] }));
    }
    setBairroInput("");
    setShowBairroDropdown(false);
  };

  const removeBairro = (bairro: string) => {
    setForm(prev => ({ ...prev, bairros: prev.bairros.filter(b => b !== bairro) }));
  };

  // Bairro autocomplete from DB
  useEffect(() => {
    if (bairroInput.length < 2) { setBairroSuggestions([]); setShowBairroDropdown(false); return; }
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from("properties")
        .select("bairro")
        .ilike("bairro", `%${bairroInput}%`)
        .eq("ativo", true)
        .limit(20);
      const seen = new Set<string>();
      const unique: string[] = [];
      for (const d of (data || [])) {
        const b = String((d as any).bairro || "");
        if (b && !seen.has(b) && !form.bairros.includes(b)) { seen.add(b); unique.push(b); }
        if (unique.length >= 8) break;
      }
      setBairroSuggestions(unique);
      setShowBairroDropdown(unique.length > 0);
    }, 300);
    return () => clearTimeout(timer);
  }, [bairroInput, form.bairros]);

  const handleBairroKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && bairroInput.trim()) {
      e.preventDefault();
      addBairro(bairroInput.trim());
    }
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

            {/* Tipo de imóvel — multi-select chips */}
            <EditableField label="Tipo de imóvel" icon={<Home className="h-3.5 w-3.5 text-muted-foreground" />}>
              <div className="flex flex-wrap gap-1.5">
                {TIPO_OPTIONS.map((o) => (
                  <ToggleChip
                    key={o.value}
                    label={o.label}
                    active={form.tipos.includes(o.value)}
                    onClick={() => toggleTipo(o.value)}
                  />
                ))}
              </div>
            </EditableField>

            {/* Bairros — input com tags */}
            <EditableField label="Bairros de interesse" icon={<MapPin className="h-3.5 w-3.5 text-muted-foreground" />}>
              {form.bairros.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {form.bairros.map(b => (
                    <Badge key={b} variant="secondary" className="text-xs gap-1 pr-1">
                      {b}
                      <button
                        onClick={() => removeBairro(b)}
                        className="ml-0.5 rounded-full hover:bg-destructive/20 p-0.5"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              <div className="relative">
                <Input
                  ref={bairroInputRef}
                  className="h-8 text-sm"
                  placeholder="Digite e Enter para adicionar..."
                  value={bairroInput}
                  onChange={(e) => setBairroInput(e.target.value)}
                  onKeyDown={handleBairroKeyDown}
                  onBlur={() => setTimeout(() => setShowBairroDropdown(false), 200)}
                  onFocus={() => { if (bairroSuggestions.length > 0) setShowBairroDropdown(true); }}
                />
                {showBairroDropdown && (
                  <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-md max-h-40 overflow-y-auto">
                    {bairroSuggestions.map(b => (
                      <button
                        key={b}
                        className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent transition-colors"
                        onMouseDown={(e) => { e.preventDefault(); addBairro(b); }}
                      >
                        {b}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </EditableField>

            {/* Faixa de preço */}
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

            {/* Dormitórios — multi-select chips */}
            <EditableField label="Dormitórios" icon={<Bed className="h-3.5 w-3.5 text-muted-foreground" />}>
              <div className="flex flex-wrap gap-1.5">
                {DORM_OPTIONS.map((o) => (
                  <ToggleChip
                    key={o.value}
                    label={o.label}
                    active={form.dormitorios_min === o.value}
                    onClick={() => toggleDorm(o.value)}
                  />
                ))}
              </div>
            </EditableField>

            {/* Vagas — multi-select chips */}
            <EditableField label="Vagas" icon={<Car className="h-3.5 w-3.5 text-muted-foreground" />}>
              <div className="flex flex-wrap gap-1.5">
                {VAGAS_OPTIONS.map((o) => (
                  <ToggleChip
                    key={o.value}
                    label={o.label}
                    active={form.vagas_min === o.value}
                    onClick={() => toggleVaga(o.value)}
                  />
                ))}
              </div>
            </EditableField>

            {/* Metragem */}
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
              <div className="flex flex-wrap gap-1.5">
                {STATUS_OPTIONS.map((o) => (
                  <ToggleChip
                    key={o.value}
                    label={o.label}
                    active={form.status_imovel === o.value}
                    onClick={() => updateField("status_imovel", o.value)}
                  />
                ))}
              </div>
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
              <p className="text-xs text-muted-foreground text-center">
                Perfil salvo automaticamente ao buscar
              </p>
            </div>
          </div>

          {/* Coluna direita — Imóveis */}
          <div className="flex-1 p-4 overflow-y-auto">
            {matches.length > 0 ? (
              <>
                {(() => {
                  const visibleMatches = matches.map((item, idx) => ({ item, idx })).filter(({ idx }) => !discarded.has(idx));
                  return (
                    <>
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="font-semibold text-lg text-foreground">Imóveis Compatíveis</h3>
                        <span className="bg-muted text-muted-foreground text-xs font-semibold px-2 py-1 rounded-full">
                          {visibleMatches.length}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                        {visibleMatches.map(({ item, idx }) => {
                          const foto = item.imagem || item.foto_principal_url || item.foto_principal || (item.fotos && item.fotos[0]) || null;
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

                          const slug = gerarSlugUhome({
                            tipo: item.tipo || "imovel",
                            quartos: item.dorms ? Number(item.dorms) : null,
                            bairro: item.bairro || "",
                            codigo: String(item.codigo || item.id || ""),
                            slug: item.slug || null,
                          });
                          const siteUrl = `https://uhome.com.br/imovel/${slug}`;

                          return (
                            <div
                              key={item.codigo || item.id || idx}
                              className={`border rounded-lg overflow-hidden bg-card transition-colors ${isSelected ? "border-primary ring-2 ring-primary/30" : "border-border"}`}
                            >
                              {/* Foto com overlay de ações */}
                              <div className="relative group">
                                {foto ? (
                                  <img
                                    src={foto}
                                    alt={nome}
                                    className="h-40 w-full object-cover cursor-pointer"
                                    loading="lazy"
                                    onClick={() => setPreviewFoto(foto)}
                                  />
                                ) : (
                                  <div className="h-40 w-full bg-muted flex items-center justify-center">
                                    <Home className="h-8 w-8 text-muted-foreground/40" />
                                  </div>
                                )}
                                {/* Botão descartar */}
                                <button
                                  className="absolute top-2 right-2 bg-black/50 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive"
                                  onClick={(e) => { e.stopPropagation(); setDiscarded(prev => new Set(prev).add(idx)); setSelected(prev => { const n = new Set(prev); n.delete(idx); return n; }); }}
                                  title="Descartar imóvel"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                                {/* Checkbox seleção */}
                                <button
                                  className={`absolute top-2 left-2 w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${isSelected ? "bg-primary border-primary text-primary-foreground" : "bg-white/80 border-border text-transparent hover:border-primary"}`}
                                  onClick={(e) => { e.stopPropagation(); toggleSelect(); }}
                                >
                                  {isSelected && <Check className="h-3.5 w-3.5" />}
                                </button>
                              </div>

                              {/* Corpo */}
                              <div className="p-3 cursor-pointer" onClick={toggleSelect}>
                                <p className="font-semibold text-sm truncate text-foreground">{nome}</p>
                                <p className="text-xs text-muted-foreground">{item.bairro || "—"}</p>
                                <p className="text-base font-bold text-primary mt-1">{preco}</p>
                              </div>
                              {infoParts.length > 0 && (
                                <div className="px-3 pb-2">
                                  <p className="text-xs text-muted-foreground">{infoParts.join(" · ")}</p>
                                </div>
                              )}

                              {/* Footer do card */}
                              <div className="px-3 pb-3">
                                <a
                                  href={siteUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <ExternalLink className="h-3 w-3" />
                                  Ver no site
                                </a>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  );
                })()}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center gap-3">
                <Search className="h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">Clique em Atualizar Match para buscar imóveis</p>
              </div>
            )}
          </div>

          {/* Dialog preview de foto */}
          <Dialog open={!!previewFoto} onOpenChange={() => setPreviewFoto(null)}>
            <DialogContent className="max-w-3xl p-2 bg-black/90 border-none">
              {previewFoto && (
                <img src={previewFoto} alt="Preview" className="w-full h-auto max-h-[80vh] object-contain rounded" />
              )}
            </DialogContent>
          </Dialog>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border flex justify-between items-center shrink-0 gap-3">
          <span className="text-sm text-muted-foreground">{selected.size} selecionado{selected.size !== 1 ? "s" : ""}</span>
          
          {(vitrineUrl || vitrineUrlRef.current) && (
            (() => {
              const displayUrl = vitrineUrl || vitrineUrlRef.current!;
              return (
                <div className="flex items-center gap-2 flex-1 justify-center">
                  <div className="flex items-center gap-1.5 bg-muted rounded-md px-3 py-1.5 max-w-lg">
                    <span className="text-xs text-muted-foreground truncate">{displayUrl}</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 shrink-0"
                      onClick={async () => {
                        await navigator.clipboard.writeText(displayUrl);
                        setCopied(true);
                        toast.success("Link copiado!");
                        setTimeout(() => setCopied(false), 2000);
                      }}
                      title="Copiar link"
                    >
                      {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 shrink-0"
                      onClick={() => window.open(displayUrl, "_blank")}
                      title="Abrir no navegador"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                    {leadTelefone && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 shrink-0 text-emerald-600 hover:text-emerald-700"
                        onClick={() => {
                          const phone = leadTelefone.replace(/\D/g, "");
                          const msg = `Olá ${leadNome}! 😊\n\nPreparei uma seleção especial de imóveis para você:\n\n🔗 ${displayUrl}\n\nDá uma olhada e me conta o que achou! 🏠`;
                          window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(msg)}`, "_blank");
                        }}
                        title="Enviar via WhatsApp"
                      >
                        <MessageSquare className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })()
          )}

          <Button
            disabled={selected.size === 0 || isCreatingVitrine}
            className="bg-emerald-600 text-white hover:bg-emerald-700"
            onClick={async () => {
              const selectedArr = Array.from(selected);
              try {
                const url = await onCriarVitrine?.(selectedArr);
                console.log("[Radar] onCriarVitrine retornou:", url);
                if (url && typeof url === "string") {
                  vitrineUrlRef.current = url;
                  setVitrineUrl(url);
                  navigator.clipboard.writeText(url).catch(() => {});
                  setCopied(true);
                  setTimeout(() => setCopied(false), 3000);
                }
              } catch (err) {
                console.error("[Radar] Erro no onCriarVitrine:", err);
              }
            }}
          >
            {isCreatingVitrine ? "Criando..." : "Criar Vitrine"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
