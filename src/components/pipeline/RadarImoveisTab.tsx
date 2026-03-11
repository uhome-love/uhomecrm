import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Radar, Search, Building2, MapPin, Maximize2, DollarSign,
  Copy, ExternalLink, Loader2, Sparkles, Tag, Home, Send, Check, X
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

/* ═══════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════ */

interface RadarProfile {
  quartos: number | null;
  valor_max: number | null;
  tipologia: string;
  bairros: string[];
  status_imovel: string;
}

interface ImovelResult {
  id?: number;
  nome?: string;
  titulo?: string;
  empreendimento?: string;
  bairro: string;
  metragem?: number;
  metragens?: string;
  dorms: number;
  preco: number;
  status?: string;
  imagem?: string;
  tipo?: string;
  score: number;
  source: "jetimob" | "meday";
}

interface Props {
  leadId: string;
  leadNome: string;
  leadTelefone?: string | null;
  currentProfile?: {
    radar_quartos?: number | null;
    radar_valor_max?: number | null;
    radar_tipologia?: string | null;
    radar_bairros?: string[] | null;
    radar_status_imovel?: string | null;
  };
  onUpdate: (leadId: string, updates: any) => Promise<void>;
}

/* ═══════════════════════════════════════════
   BAIRROS LIST (Porto Alegre)
   ═══════════════════════════════════════════ */

const BAIRROS_POA = [
  "Auxiliadora", "Bela Vista", "Boa Vista", "Bom Fim", "Centro Histórico",
  "Cidade Baixa", "Cristo Redentor", "Glória", "Higienópolis", "Jardim Carvalho",
  "Jardim do Salso", "Lindóia", "Marechal Rondon", "Menino Deus", "Moinhos de Vento",
  "Mont'Serrat", "Passo d'Areia", "Petrópolis", "Rio Branco", "Santa Cecília",
  "São Sebastião", "Teresópolis", "Três Figueiras", "Vila Ipiranga", "Canoas",
];

/* ═══════════════════════════════════════════
   MELNICK DAY STATIC CATALOG
   ═══════════════════════════════════════════ */

const MEDAY_CATALOG: ImovelResult[] = [
  { nome: "Open Major", bairro: "Marechal Rondon", dorms: 2, preco: 235505, metragens: "43 m²", status: "Em obras", source: "meday", score: 0, imagem: "https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2026/03/03122722/open-major.png", tipo: "apartamento" },
  { nome: "Open Alto Ipiranga", bairro: "Jardim Carvalho", dorms: 2, preco: 271310, metragens: "42 m²", status: "Em obras", source: "meday", score: 0, imagem: "https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2026/03/03122643/Camada-20.png", tipo: "apartamento" },
  { nome: "Open Bosque", bairro: "Passo d'Areia", dorms: 3, preco: 240582, metragens: "31-63 m²", status: "Em obras", source: "meday", score: 0, imagem: "https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2026/03/03122725/Retangulo-2.png", tipo: "apartamento" },
  { nome: "Supreme Altos do Central Parque", bairro: "Jardim do Salso", dorms: 3, preco: 499448, metragens: "59-70 m²", status: "Pronto", source: "meday", score: 0, imagem: "https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2026/03/03122731/supreme.png", tipo: "apartamento" },
  { nome: "Grand Park Lindóia", bairro: "São Sebastião", dorms: 3, preco: 485792, metragens: "56-81 m²", status: "Pronto", source: "meday", score: 0, imagem: "https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2026/03/03122658/Camada-933.png", tipo: "apartamento" },
  { nome: "Vida Viva Linked", bairro: "Teresópolis", dorms: 3, preco: 499303, metragens: "55-67 m²", status: "Pronto", source: "meday", score: 0, imagem: "https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2026/03/03122656/Camada-932.png", tipo: "apartamento" },
  { nome: "GO Cidade Baixa", bairro: "Cidade Baixa", dorms: 1, preco: 338274, metragens: "27 m²", status: "Pronto", source: "meday", score: 0, imagem: "https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2026/03/03122703/cidade-baixa.png", tipo: "apartamento" },
  { nome: "GO Rio Branco", bairro: "Rio Branco", dorms: 1, preco: 448766, metragens: "25-63 m²", status: "Pronto", source: "meday", score: 0, imagem: "https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2026/03/03122727/rio-granco.png", tipo: "apartamento" },
  { nome: "Carlos Gomes Square", bairro: "Auxiliadora", dorms: 1, preco: 304169, metragens: "25 m²", status: "Pronto", source: "meday", score: 0, imagem: "https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2026/03/03122655/Camada-931.png", tipo: "apartamento" },
  { nome: "SEEN Três Figueiras", bairro: "Três Figueiras", dorms: 4, preco: 1596482, metragens: "149-169 m²", status: "Em obras", source: "meday", score: 0, imagem: "https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2026/03/03122710/fachada_seen_tres_figueiras-1.png", tipo: "apartamento" },
  { nome: "Gama, 1375", bairro: "Auxiliadora", dorms: 3, preco: 1707589, metragens: "159 m²", status: "Em obras", source: "meday", score: 0, imagem: "https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2026/03/03122713/gama.png", tipo: "apartamento" },
  { nome: "SEEN Menino Deus", bairro: "Menino Deus", dorms: 3, preco: 1338633, metragens: "98-151 m²", status: "Em obras", source: "meday", score: 0, imagem: "https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2026/03/03122721/menino-deus.png", tipo: "apartamento" },
  { nome: "High Garden Rio Branco", bairro: "Rio Branco", dorms: 3, preco: 1636005, metragens: "123-143 m²", status: "Em obras", source: "meday", score: 0, imagem: "https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2026/03/03122716/high-garden.png", tipo: "apartamento" },
  { nome: "Botanique Residence", bairro: "Petrópolis", dorms: 3, preco: 1407003, metragens: "98-115 m²", status: "Pronto", source: "meday", score: 0, imagem: "https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2026/03/03122620/botanique.png", tipo: "apartamento" },
  { nome: "Yofi", bairro: "Bom Fim", dorms: 3, preco: 1645058, metragens: "131-144 m²", status: "Em obras", source: "meday", score: 0, imagem: "https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2026/03/03122741/yofi.png", tipo: "apartamento" },
  { nome: "Square Garden", bairro: "Santa Cecília", dorms: 3, preco: 1312054, metragens: "93-119 m²", status: "Lançamento", source: "meday", score: 0, imagem: "https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2026/03/03122634/Camada-12.png", tipo: "apartamento" },
  { nome: "High Garden Iguatemi", bairro: "Boa Vista", dorms: 3, preco: 1232604, metragens: "102-125 m²", status: "Em obras", source: "meday", score: 0, imagem: "https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2026/03/03122629/Camada-7.png", tipo: "apartamento" },
  { nome: "Linked Teresópolis", bairro: "Glória", dorms: 1, preco: 461914, metragens: "35-53 m²", status: "Pronto", source: "meday", score: 0, imagem: "https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2026/03/03122644/Camada-913.png", tipo: "apartamento" },
  { nome: "Nilo Square Résidence", bairro: "Boa Vista", dorms: 3, preco: 2500000, metragens: "176-216 m²", status: "Em obras", source: "meday", score: 0, imagem: "https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2026/03/03122659/Camada-934.png", tipo: "apartamento" },
  { nome: "Arte Country Club", bairro: "Bela Vista", dorms: 4, preco: 3500000, metragens: "246-321 m²", status: "Em obras", source: "meday", score: 0, imagem: "https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2026/03/03122653/Camada-923.png", tipo: "apartamento" },
  { nome: "Casa Moinhos", bairro: "Moinhos de Vento", dorms: 4, preco: 5000000, metragens: "292-644 m²", status: "Em obras", source: "meday", score: 0, imagem: "https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2026/03/03122707/Fachada_EF-scaled-1-1.png", tipo: "apartamento" },
  { nome: "Reserva do Lago", bairro: "Petrópolis", dorms: 0, preco: 148500, metragens: "Até 406 m²", status: "Pronto", source: "meday", score: 0, imagem: "https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2026/03/03122630/Camada-8.png", tipo: "terreno" },
];

/* ═══════════════════════════════════════════
   SCORING ENGINE
   ═══════════════════════════════════════════ */

function normalize(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function scoreMatch(profile: RadarProfile, imovel: ImovelResult): number {
  let score = 0;
  const maxScore = 100;

  // Quartos match (30 pts)
  if (profile.quartos && imovel.dorms > 0) {
    if (imovel.dorms === profile.quartos) score += 30;
    else if (Math.abs(imovel.dorms - profile.quartos) === 1) score += 15;
  } else {
    score += 15; // no filter = partial match
  }

  // Valor match (30 pts)
  if (profile.valor_max && imovel.preco > 0) {
    if (imovel.preco <= profile.valor_max) {
      score += 30;
    } else if (imovel.preco <= profile.valor_max * 1.15) {
      score += 15; // up to 15% above budget
    }
  } else {
    score += 15;
  }

  // Bairro match (25 pts)
  if (profile.bairros.length > 0 && imovel.bairro) {
    const normBairro = normalize(imovel.bairro);
    const match = profile.bairros.some(b => normBairro.includes(normalize(b)) || normalize(b).includes(normBairro));
    if (match) score += 25;
  } else {
    score += 12;
  }

  // Status match (15 pts)
  if (profile.status_imovel && imovel.status) {
    const normStatus = normalize(imovel.status);
    const normFilter = normalize(profile.status_imovel);
    if (normFilter === "pronto" && normStatus.includes("pronto")) score += 15;
    else if (normFilter === "obras" && (normStatus.includes("obra") || normStatus.includes("lancamento"))) score += 15;
    else score += 5;
  } else {
    score += 7;
  }

  return Math.min(Math.round((score / maxScore) * 100), 100);
}

/* ═══════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════ */

export default function RadarImoveisTab({ leadId, leadNome, leadTelefone, currentProfile, onUpdate }: Props) {
  const navigate = useNavigate();

  // Safely parse bairros (could be JSON string from DB)
  const safeBairros = (() => {
    const raw = currentProfile?.radar_bairros;
    if (Array.isArray(raw)) return raw;
    if (typeof raw === "string") {
      try { const parsed = JSON.parse(raw); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
    }
    return [];
  })();

  // Profile state
  const [quartos, setQuartos] = useState<string>(currentProfile?.radar_quartos ? String(currentProfile.radar_quartos) : "");
  const [valorMax, setValorMax] = useState<string>(currentProfile?.radar_valor_max ? String(currentProfile.radar_valor_max) : "");
  const [tipologia, setTipologia] = useState(currentProfile?.radar_tipologia || "apartamento");
  const [selectedBairros, setSelectedBairros] = useState<string[]>(safeBairros);
  const [statusImovel, setStatusImovel] = useState(currentProfile?.radar_status_imovel || "");
  const [bairroSearch, setBairroSearch] = useState("");

  // Results state
  const [results, setResults] = useState<ImovelResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [selectedResults, setSelectedResults] = useState<Set<number>>(new Set());

  // Source toggle
  const [useMeDay, setUseMeDay] = useState(false);
  const [useJetimob, setUseJetimob] = useState(true);

  const profile: RadarProfile = {
    quartos: quartos ? parseInt(quartos) : null,
    valor_max: valorMax ? parseFloat(valorMax) : null,
    tipologia,
    bairros: selectedBairros,
    status_imovel: statusImovel,
  };

  const toggleBairro = (b: string) => {
    setSelectedBairros(prev => prev.includes(b) ? prev.filter(x => x !== b) : [...prev, b]);
  };

  const filteredBairros = BAIRROS_POA.filter(b => !bairroSearch || normalize(b).includes(normalize(bairroSearch)));

  // Save profile to lead
  const saveProfile = useCallback(async () => {
    await onUpdate(leadId, {
      radar_quartos: quartos ? parseInt(quartos) : null,
      radar_valor_max: valorMax ? parseFloat(valorMax) : null,
      radar_tipologia: tipologia,
      radar_bairros: selectedBairros,
      radar_status_imovel: statusImovel || null,
      radar_atualizado_em: new Date().toISOString(),
    });
    toast.success("Perfil de interesse salvo!");
  }, [leadId, quartos, valorMax, tipologia, selectedBairros, statusImovel, onUpdate]);

  // Search Jetimob
  const searchJetimob = useCallback(async (): Promise<ImovelResult[]> => {
    try {
      const params: any = {};
      if (tipologia) params.tipo = tipologia;
      if (selectedBairros.length > 0) params.search = selectedBairros[0];
      if (valorMax) params.valor_max = parseFloat(valorMax);
      if (quartos) params.dormitorios = parseInt(quartos);
      if (statusImovel === "pronto") params.status = "pronto";

      const { data, error } = await supabase.functions.invoke("jetimob-proxy", {
        body: { action: "list_imoveis", ...params, pageSize: 50 },
      });

      if (error) throw error;
      const items = data?.data || data?.items || data || [];
      return items.map((item: any) => ({
        id: item.id || item.codigo,
        nome: item.titulo || item.empreendimento || item.endereco_logradouro || "Imóvel",
        bairro: item.endereco_bairro || item.bairro || "",
        metragem: Number(item.area_util || item.area_total || 0),
        dorms: Number(item.dormitorios || item.quartos || 0),
        preco: Number(item.valor_venda || item.preco_venda || item.valor || 0),
        status: item.status || "",
        imagem: item.fotos?.[0]?.url || item.foto_principal || "",
        tipo: item.subtipo || item.tipo_imovel || "",
        score: 0,
        source: "jetimob" as const,
      }));
    } catch (err) {
      console.error("Jetimob search error:", err);
      return [];
    }
  }, [tipologia, selectedBairros, valorMax, quartos, statusImovel]);

  // Run search
  const handleSearch = useCallback(async () => {
    setLoading(true);
    setSearched(true);
    setSelectedResults(new Set());

    let allResults: ImovelResult[] = [];

    // Melnick Day results
    if (useMeDay) {
      const medayScored = MEDAY_CATALOG.map(item => ({
        ...item,
        score: scoreMatch(profile, item),
      }));
      allResults.push(...medayScored);
    }

    // Jetimob results
    if (useJetimob) {
      const jetimobItems = await searchJetimob();
      const jetimobScored = jetimobItems.map(item => ({
        ...item,
        score: scoreMatch(profile, item),
      }));
      allResults.push(...jetimobScored);
    }

    // Sort by score, take top results
    allResults.sort((a, b) => b.score - a.score);
    setResults(allResults.slice(0, 20));
    setLoading(false);

    // Save profile
    await saveProfile();
  }, [useMeDay, useJetimob, profile, searchJetimob, saveProfile]);

  const toggleSelect = (idx: number) => {
    setSelectedResults(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const selectedItems = results.filter((_, i) => selectedResults.has(i));

  // Generate WhatsApp message
  const generateWhatsAppMsg = () => {
    const items = selectedItems.length > 0 ? selectedItems : results.slice(0, 5);
    let msg = `Olá ${leadNome}! 😊\n\nSelecionei ${items.length} imóveis que combinam com o que você procura:\n\n`;
    items.forEach((item, i) => {
      const name = item.nome || item.titulo || "Imóvel";
      msg += `${i + 1}. *${name}*\n`;
      msg += `📍 ${item.bairro}`;
      if (item.dorms > 0) msg += ` · ${item.dorms} dorms`;
      if (item.metragens) msg += ` · ${item.metragens}`;
      else if (item.metragem) msg += ` · ${item.metragem}m²`;
      if (item.preco > 0) msg += `\n💰 R$ ${item.preco.toLocaleString("pt-BR")}`;
      if (item.source === "meday") msg += ` *(Oferta Melnick Day!)*`;
      msg += `\n\n`;
    });
    msg += `Gostou de algum? Posso agendar uma visita! 🏠`;
    return msg;
  };

  const sendWhatsApp = () => {
    if (!leadTelefone) {
      toast.error("Lead sem telefone cadastrado");
      return;
    }
    const phone = leadTelefone.replace(/\D/g, "");
    const msg = generateWhatsAppMsg();
    window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(msg)}`, "_blank");
    toast.success("Abrindo WhatsApp...");
  };

  const copyMessage = () => {
    navigator.clipboard.writeText(generateWhatsAppMsg());
    toast.success("Mensagem copiada!");
  };

  return (
    <div className="px-6 pb-8 space-y-4">
      {/* ── HEADER ── */}
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <Radar className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h4 className="text-sm font-bold text-foreground">Radar Homi Imóveis</h4>
          <p className="text-[10px] text-muted-foreground">Preencha o perfil do cliente e encontre os melhores imóveis</p>
        </div>
      </div>

      {/* ── PERFIL DE INTERESSE ── */}
      <Card className="border-primary/20">
        <CardContent className="p-4 space-y-3">
          <h5 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Home className="h-3.5 w-3.5" /> Perfil de Interesse do Cliente
          </h5>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-[11px] text-muted-foreground">Quartos</Label>
              <Select value={quartos} onValueChange={setQuartos}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Qtd" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 dorm</SelectItem>
                  <SelectItem value="2">2 dorms</SelectItem>
                  <SelectItem value="3">3 dorms</SelectItem>
                  <SelectItem value="4">4+ dorms</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">Valor Máximo (R$)</Label>
              <Input
                type="number"
                className="h-9 text-sm"
                placeholder="Ex: 500000"
                value={valorMax}
                onChange={(e) => setValorMax(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-[11px] text-muted-foreground">Tipologia</Label>
              <Select value={tipologia} onValueChange={setTipologia}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="apartamento">Apartamento</SelectItem>
                  <SelectItem value="casa">Casa</SelectItem>
                  <SelectItem value="terreno">Terreno</SelectItem>
                  <SelectItem value="comercial">Comercial</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">Status</Label>
              <Select value={statusImovel} onValueChange={setStatusImovel}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Qualquer" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Qualquer</SelectItem>
                  <SelectItem value="pronto">Pronto p/ morar</SelectItem>
                  <SelectItem value="obras">Em obras / Lançamento</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Bairros */}
          <div>
            <Label className="text-[11px] text-muted-foreground">Bairros de Interesse</Label>
            <Input
              className="h-8 text-xs mt-1 mb-1.5"
              placeholder="Buscar bairro..."
              value={bairroSearch}
              onChange={(e) => setBairroSearch(e.target.value)}
            />
            <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
              {filteredBairros.map((b) => (
                <button
                  key={b}
                  onClick={() => toggleBairro(b)}
                  className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                    selectedBairros.includes(b)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted/50 text-muted-foreground border-border hover:border-primary/30"
                  }`}
                >
                  {b}
                </button>
              ))}
            </div>
            {selectedBairros.length > 0 && (
              <p className="text-[10px] text-primary mt-1">
                {selectedBairros.length} bairro(s) selecionado(s): {selectedBairros.join(", ")}
              </p>
            )}
          </div>

          {/* Source toggle */}
          <div className="flex items-center gap-4 pt-1 border-t border-border/30">
            <div className="flex items-center gap-2">
              <Switch checked={useJetimob} onCheckedChange={setUseJetimob} />
              <Label className="text-[11px]">Imóveis Jetimob</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={useMeDay} onCheckedChange={setUseMeDay} />
              <Label className="text-[11px] flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-amber-500" /> Ofertas Melnick Day
              </Label>
            </div>
          </div>

          <Button
            className="w-full gap-2"
            onClick={handleSearch}
            disabled={loading}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Buscar Imóveis
          </Button>
        </CardContent>
      </Card>

      {/* ── RESULTADOS ── */}
      {searched && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h5 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5" />
              {results.length > 0 ? `${results.length} imóveis encontrados` : "Nenhum resultado"}
            </h5>
            {selectedResults.size > 0 && (
              <Badge variant="secondary" className="text-[10px]">
                {selectedResults.size} selecionado(s)
              </Badge>
            )}
          </div>

          {results.length === 0 && !loading && (
            <div className="text-center py-8 text-muted-foreground">
              <Building2 className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nenhum imóvel encontrado com esses critérios.</p>
              <p className="text-xs mt-1">Tente ampliar os filtros (valor, bairros ou quartos).</p>
            </div>
          )}

          <div className="space-y-2">
            {results.map((item, idx) => (
              <Card
                key={idx}
                className={`overflow-hidden cursor-pointer transition-all duration-150 ${
                  selectedResults.has(idx) ? "ring-2 ring-primary border-primary" : "border-border/50 hover:border-primary/30"
                }`}
                onClick={() => toggleSelect(idx)}
              >
                <div className="flex">
                  {item.imagem && (
                    <div className="w-20 h-20 shrink-0 overflow-hidden bg-muted">
                      <img src={item.imagem} alt="" className="w-full h-full object-cover" loading="lazy" />
                    </div>
                  )}
                  <CardContent className="p-2.5 flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-bold text-foreground truncate">{item.nome || item.titulo || "Imóvel"}</p>
                          {item.source === "meday" && (
                            <Badge className="text-[8px] py-0 px-1 bg-amber-100 text-amber-700 border-amber-200">MeDay</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                          <span className="flex items-center gap-0.5"><MapPin className="h-2.5 w-2.5" />{item.bairro}</span>
                          {item.dorms > 0 && <span>{item.dorms}d</span>}
                          {item.metragens && <span>{item.metragens}</span>}
                          {!item.metragens && item.metragem && item.metragem > 0 && <span>{item.metragem}m²</span>}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                          item.score >= 70 ? "bg-emerald-100 text-emerald-700" :
                          item.score >= 40 ? "bg-amber-100 text-amber-700" :
                          "bg-muted text-muted-foreground"
                        }`}>
                          {item.score}%
                        </div>
                      </div>
                    </div>
                    {item.preco > 0 && (
                      <p className="text-xs font-bold text-emerald-600 mt-1">
                        R$ {item.preco.toLocaleString("pt-BR")}
                      </p>
                    )}
                  </CardContent>
                  <div className="flex items-center pr-2.5">
                    {selectedResults.has(idx) ? (
                      <Check className="h-4 w-4 text-primary" />
                    ) : (
                      <div className="h-4 w-4 rounded border border-border" />
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Actions */}
          {results.length > 0 && (
            <div className="flex gap-2 pt-2">
              <Button
                size="sm"
                className="flex-1 gap-1.5"
                onClick={sendWhatsApp}
              >
                <Send className="h-3.5 w-3.5" />
                Enviar via WhatsApp
                {selectedResults.size > 0 && ` (${selectedResults.size})`}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={copyMessage}
              >
                <Copy className="h-3.5 w-3.5" /> Copiar
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => navigate(`/melnick-day`)}
              >
                <Sparkles className="h-3.5 w-3.5" /> MeDay
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
