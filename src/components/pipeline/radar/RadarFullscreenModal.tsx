import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { X, Search, Sparkles, Home, MapPin, DollarSign, Bed, Car, Ruler } from "lucide-react";
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
  matches: any[];
  onUpdateMatch?: () => void;
  onIAPerfil?: () => void;
}

function ProfileField({ label, icon, value }: { label: string; icon: React.ReactNode; value: string | null | undefined }) {
  const display = value?.trim() || null;
  return (
    <div className="bg-muted/50 rounded-lg p-3 mb-3">
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <span className="text-xs text-muted-foreground uppercase font-semibold tracking-wide">{label}</span>
      </div>
      {display ? (
        <p className="text-sm font-medium text-foreground">{display}</p>
      ) : (
        <p className="text-sm italic text-muted-foreground">Não informado</p>
      )}
    </div>
  );
}

function formatPriceRange(min: string, max: string): string | null {
  const vMin = min ? Number(min) : 0;
  const vMax = max ? Number(max) : 0;
  if (!vMin && !vMax) return null;
  if (vMin && vMax) return `${formatBRL(vMin)} — ${formatBRL(vMax)}`;
  if (vMin) return `A partir de ${formatBRL(vMin)}`;
  return `Até ${formatBRL(vMax)}`;
}

export default function RadarFullscreenModal({ open, onClose, leadNome, profile, matches, onUpdateMatch, onIAPerfil }: RadarFullscreenModalProps) {
  const priceRange = formatPriceRange(profile.valor_min, profile.valor_max);

  const MOMENTO_LABELS: Record<string, string> = {
    imediato: "Imediato", "3_meses": "3 meses", "6_meses": "6 meses", "1_ano": "1 ano", pesquisando: "Pesquisando",
  };

  const STATUS_LABELS: Record<string, string> = {
    qualquer: "Qualquer", pronto: "Pronto p/ morar", obras: "Em obras / Lançamento",
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
          {/* Coluna esquerda — Perfil */}
          <div className="w-[320px] min-w-[320px] border-r border-border p-4 overflow-y-auto">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Perfil do Lead</h3>

            <ProfileField
              label="Tipo de imóvel"
              icon={<Home className="h-3.5 w-3.5 text-muted-foreground" />}
              value={profile.tipos.length > 0 ? profile.tipos.join(", ") : null}
            />

            <ProfileField
              label="Bairros de interesse"
              icon={<MapPin className="h-3.5 w-3.5 text-muted-foreground" />}
              value={profile.bairros.length > 0 ? profile.bairros.join(", ") : null}
            />

            <ProfileField
              label="Faixa de preço"
              icon={<DollarSign className="h-3.5 w-3.5 text-muted-foreground" />}
              value={priceRange}
            />

            <ProfileField
              label="Dormitórios"
              icon={<Bed className="h-3.5 w-3.5 text-muted-foreground" />}
              value={profile.dormitorios_min ? `${profile.dormitorios_min}+ dorms${profile.suites_min ? `, ${profile.suites_min}+ suítes` : ""}` : null}
            />

            <ProfileField
              label="Vagas"
              icon={<Car className="h-3.5 w-3.5 text-muted-foreground" />}
              value={profile.vagas_min ? `${profile.vagas_min}+ vagas` : null}
            />

            <ProfileField
              label="Metragem"
              icon={<Ruler className="h-3.5 w-3.5 text-muted-foreground" />}
              value={
                (profile.area_min || profile.area_max)
                  ? `${profile.area_min || "?"}–${profile.area_max || "?"} m²`
                  : null
              }
            />

            {profile.empreendimento && (
              <ProfileField
                label="Empreendimento"
                icon={<Home className="h-3.5 w-3.5 text-muted-foreground" />}
                value={profile.empreendimento}
              />
            )}

            <ProfileField
              label="Status do imóvel"
              icon={<Home className="h-3.5 w-3.5 text-muted-foreground" />}
              value={STATUS_LABELS[profile.status_imovel] || profile.status_imovel}
            />

            {profile.momento_compra && (
              <ProfileField
                label="Momento de compra"
                icon={<Home className="h-3.5 w-3.5 text-muted-foreground" />}
                value={MOMENTO_LABELS[profile.momento_compra] || profile.momento_compra}
              />
            )}

            <div className="space-y-2 mt-4">
              <Button
                className="w-full gap-2 bg-[#4F46E5] hover:bg-[#4338CA] text-white"
                onClick={onUpdateMatch}
              >
                <Search className="h-4 w-4" />
                🔍 Atualizar Match
              </Button>
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={onIAPerfil}
              >
                <Sparkles className="h-4 w-4" />
                🤖 IA Perfil
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

                    return (
                      <div key={item.codigo || item.id || idx} className="border border-border rounded-lg overflow-hidden bg-card">
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
        <div className="p-4 border-t border-border flex justify-between items-center shrink-0">
          <span className="text-sm text-muted-foreground">0 selecionados</span>
          <Button disabled className="bg-emerald-600 text-white hover:bg-emerald-700">
            Criar Vitrine
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
