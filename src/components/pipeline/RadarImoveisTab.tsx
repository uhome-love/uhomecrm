import { useState, useCallback, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Radar, Search, Building2, MapPin, DollarSign,
  Copy, ExternalLink, Loader2, Sparkles, Home, Send, Check,
  Brain, AlertTriangle, Star, Eye, ChevronDown, ChevronUp,
  MessageSquare, Bed, Car, Maximize2, RefreshCw
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useTypesenseSearch } from "@/hooks/useTypesenseSearch";

/* ═══════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════ */

interface RadarProfile {
  quartos: number | null;
  valor_min: number | null;
  valor_max: number | null;
  tipologias: string[];
  bairros: string[];
  status_imovel: string;
}

interface ImovelResult {
  id?: number | string;
  nome?: string;
  titulo?: string;
  empreendimento?: string;
  bairro: string;
  metragem?: number;
  metragens?: string;
  dorms: number;
  preco: number;
  vagas?: number;
  suites?: number;
  status?: string;
  imagem?: string;
  tipo?: string;
  score: number;
  source: "typesense" | "meday" | "campanha";
  justificativas: string[];
}

interface Props {
  leadId: string;
  leadNome: string;
  leadTelefone?: string | null;
  leadData?: {
    empreendimento?: string | null;
    campanha?: string | null;
    campanha_id?: string | null;
    valor_estimado?: number | null;
    origem?: string | null;
    observacoes?: string | null;
    segmento_id?: string | null;
    temperatura?: string;
  };
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
   CONSTANTS
   ═══════════════════════════════════════════ */

const BAIRROS_POA = [
  "Auxiliadora", "Bela Vista", "Boa Vista", "Bom Fim", "Centro Histórico",
  "Cidade Baixa", "Cristal", "Cristo Redentor", "Glória", "Higienópolis", "Jardim Carvalho",
  "Jardim do Salso", "Lindóia", "Marechal Rondon", "Mário Quintana", "Menino Deus",
  "Moinhos de Vento", "Mont'Serrat", "Passo d'Areia", "Petrópolis", "Rio Branco",
  "Santa Cecília", "São Sebastião", "Teresópolis", "Três Figueiras", "Vila Ipiranga", "Canoas",
];

const OBJECOES = [
  { key: "caro", label: "Achou caro", icon: "💰" },
  { key: "central", label: "Quer mais central", icon: "📍" },
  { key: "pronto", label: "Quer pronto", icon: "🏠" },
  { key: "entrada", label: "Quer menor entrada", icon: "💳" },
  { key: "metragem", label: "Quer mais metragem", icon: "📐" },
  { key: "casa", label: "Quer casa", icon: "🏡" },
  { key: "apartamento", label: "Quer apartamento", icon: "🏢" },
  { key: "condominio", label: "Quer condomínio", icon: "🏘️" },
  { key: "investir", label: "Quer investir", icon: "📈" },
];

// Fallback hints — used when empreendimento_overrides has no data for a product
const EMPREENDIMENTO_HINTS_FALLBACK: Record<string, { faixa_min?: number; faixa_max?: number; bairros?: string[]; tipo?: string; dorms?: number }> = {
  // MCMV
  "open bosque": { faixa_min: 200000, faixa_max: 280000, bairros: ["Passo d'Areia"], tipo: "apartamento", dorms: 2 },
  "open major": { faixa_min: 200000, faixa_max: 270000, bairros: ["Marechal Rondon"], tipo: "apartamento", dorms: 2 },
  "open alto ipiranga": { faixa_min: 200000, faixa_max: 300000, bairros: ["Jardim Carvalho", "Vila Ipiranga"], tipo: "apartamento", dorms: 2 },
  "melnick day": { faixa_min: 200000, faixa_max: 350000, tipo: "apartamento", dorms: 2 },
  // Médio-Alto
  "casa tua": { faixa_min: 500000, faixa_max: 650000, bairros: ["Petrópolis", "Mário Quintana", "Jardim Carvalho", "Jardim do Salso"], tipo: "casa", dorms: 3 },
  "las casas": { faixa_min: 600000, faixa_max: 900000, bairros: ["Petrópolis", "Higienópolis"], tipo: "casa", dorms: 3 },
  "orygem": { faixa_min: 700000, faixa_max: 1200000, bairros: ["Petrópolis"], tipo: "apartamento", dorms: 3 },
  "me day": { faixa_min: 400000, faixa_max: 700000, tipo: "apartamento", dorms: 2 },
  "alto lindoia": { faixa_min: 400000, faixa_max: 650000, bairros: ["Lindóia", "Cristo Redentor"], tipo: "apartamento", dorms: 2 },
  "alto lindóia": { faixa_min: 400000, faixa_max: 650000, bairros: ["Lindóia", "Cristo Redentor"], tipo: "apartamento", dorms: 2 },
  "terrace": { faixa_min: 500000, faixa_max: 900000, bairros: ["Petrópolis", "Bela Vista"], tipo: "apartamento", dorms: 3 },
  "alfa": { faixa_min: 400000, faixa_max: 700000, tipo: "apartamento", dorms: 2 },
  "duetto": { faixa_min: 500000, faixa_max: 800000, tipo: "apartamento", dorms: 2 },
  "salzburg": { faixa_min: 600000, faixa_max: 1000000, bairros: ["Auxiliadora", "Petrópolis"], tipo: "apartamento", dorms: 3 },
  // Altíssimo
  "lake eyre": { faixa_min: 2000000, faixa_max: 4000000, bairros: ["Cristal"], tipo: "apartamento", dorms: 3 },
  "seen": { faixa_min: 1200000, faixa_max: 2500000, bairros: ["Três Figueiras", "Menino Deus"], tipo: "apartamento", dorms: 3 },
  "boa vista country": { faixa_min: 2000000, faixa_max: 5000000, bairros: ["Boa Vista", "Três Figueiras"], tipo: "apartamento", dorms: 4 },
  // Investimento
  "shift": { faixa_min: 250000, faixa_max: 500000, bairros: ["Centro Histórico", "Cidade Baixa"], tipo: "apartamento", dorms: 1 },
  "casa bastian": { faixa_min: 300000, faixa_max: 550000, bairros: ["Cidade Baixa", "Menino Deus"], tipo: "apartamento", dorms: 1 },
};

/** Build hints from empreendimento_overrides data */
function buildHintsFromOverrides(
  overrides: Array<{ nome: string | null; codigo: string; bairro: string | null; valor_min: number | null; valor_max: number | null; dormitorios: number | null }>,
): Record<string, { faixa_min?: number; faixa_max?: number; bairros?: string[]; tipo?: string; dorms?: number }> {
  const hints: Record<string, { faixa_min?: number; faixa_max?: number; bairros?: string[]; tipo?: string; dorms?: number }> = {};
  for (const o of overrides) {
    const key = normalize(o.nome || o.codigo);
    if (!key) continue;
    const h: any = {};
    if (o.valor_min) h.faixa_min = o.valor_min;
    if (o.valor_max) h.faixa_max = o.valor_max * 1.1; // 10% margin
    if (o.bairro) h.bairros = [o.bairro];
    if (o.dormitorios) h.dorms = o.dormitorios;
    h.tipo = "apartamento";
    hints[key] = h;
  }
  return hints;
}

const MEDAY_CATALOG: ImovelResult[] = [
  { nome: "Open Major", bairro: "Marechal Rondon", dorms: 2, preco: 235505, metragens: "43 m²", status: "Em obras", source: "meday", score: 0, imagem: "https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2026/03/03122722/open-major.png", tipo: "apartamento", justificativas: [] },
  { nome: "Open Alto Ipiranga", bairro: "Jardim Carvalho", dorms: 2, preco: 271310, metragens: "42 m²", status: "Em obras", source: "meday", score: 0, imagem: "https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2026/03/03122643/Camada-20.png", tipo: "apartamento", justificativas: [] },
  { nome: "Open Bosque", bairro: "Passo d'Areia", dorms: 3, preco: 240582, metragens: "31-63 m²", status: "Em obras", source: "meday", score: 0, imagem: "https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2026/03/03122725/Retangulo-2.png", tipo: "apartamento", justificativas: [] },
  { nome: "Supreme Altos do Central Parque", bairro: "Jardim do Salso", dorms: 3, preco: 499448, metragens: "59-70 m²", status: "Pronto", source: "meday", score: 0, imagem: "https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2026/03/03122731/supreme.png", tipo: "apartamento", justificativas: [] },
  { nome: "Grand Park Lindóia", bairro: "São Sebastião", dorms: 3, preco: 485792, metragens: "56-81 m²", status: "Pronto", source: "meday", score: 0, imagem: "https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2026/03/03122658/Camada-933.png", tipo: "apartamento", justificativas: [] },
  { nome: "Vida Viva Linked", bairro: "Teresópolis", dorms: 3, preco: 499303, metragens: "55-67 m²", status: "Pronto", source: "meday", score: 0, imagem: "https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2026/03/03122656/Camada-932.png", tipo: "apartamento", justificativas: [] },
  { nome: "GO Cidade Baixa", bairro: "Cidade Baixa", dorms: 1, preco: 338274, metragens: "27 m²", status: "Pronto", source: "meday", score: 0, imagem: "https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2026/03/03122703/cidade-baixa.png", tipo: "apartamento", justificativas: [] },
  { nome: "GO Rio Branco", bairro: "Rio Branco", dorms: 1, preco: 448766, metragens: "25-63 m²", status: "Pronto", source: "meday", score: 0, imagem: "https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2026/03/03122727/rio-granco.png", tipo: "apartamento", justificativas: [] },
  { nome: "Carlos Gomes Square", bairro: "Auxiliadora", dorms: 1, preco: 304169, metragens: "25 m²", status: "Pronto", source: "meday", score: 0, imagem: "https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2026/03/03122655/Camada-931.png", tipo: "apartamento", justificativas: [] },
  { nome: "SEEN Três Figueiras", bairro: "Três Figueiras", dorms: 4, preco: 1596482, metragens: "149-169 m²", status: "Em obras", source: "meday", score: 0, imagem: "https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2026/03/03122710/fachada_seen_tres_figueiras-1.png", tipo: "apartamento", justificativas: [] },
  { nome: "Gama, 1375", bairro: "Auxiliadora", dorms: 3, preco: 1707589, metragens: "159 m²", status: "Em obras", source: "meday", score: 0, imagem: "https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2026/03/03122713/gama.png", tipo: "apartamento", justificativas: [] },
  { nome: "SEEN Menino Deus", bairro: "Menino Deus", dorms: 3, preco: 1338633, metragens: "98-151 m²", status: "Em obras", source: "meday", score: 0, imagem: "https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2026/03/03122721/menino-deus.png", tipo: "apartamento", justificativas: [] },
  { nome: "High Garden Rio Branco", bairro: "Rio Branco", dorms: 3, preco: 1636005, metragens: "123-143 m²", status: "Em obras", source: "meday", score: 0, imagem: "https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2026/03/03122716/high-garden.png", tipo: "apartamento", justificativas: [] },
  { nome: "Botanique Residence", bairro: "Petrópolis", dorms: 3, preco: 1407003, metragens: "98-115 m²", status: "Pronto", source: "meday", score: 0, imagem: "https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2026/03/03122620/botanique.png", tipo: "apartamento", justificativas: [] },
  { nome: "Yofi", bairro: "Bom Fim", dorms: 3, preco: 1645058, metragens: "131-144 m²", status: "Em obras", source: "meday", score: 0, imagem: "https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2026/03/03122741/yofi.png", tipo: "apartamento", justificativas: [] },
  { nome: "Square Garden", bairro: "Santa Cecília", dorms: 3, preco: 1312054, metragens: "93-119 m²", status: "Lançamento", source: "meday", score: 0, imagem: "https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2026/03/03122634/Camada-12.png", tipo: "apartamento", justificativas: [] },
  { nome: "High Garden Iguatemi", bairro: "Boa Vista", dorms: 3, preco: 1232604, metragens: "102-125 m²", status: "Em obras", source: "meday", score: 0, imagem: "https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2026/03/03122629/Camada-7.png", tipo: "apartamento", justificativas: [] },
  { nome: "Linked Teresópolis", bairro: "Glória", dorms: 1, preco: 461914, metragens: "35-53 m²", status: "Pronto", source: "meday", score: 0, imagem: "https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2026/03/03122644/Camada-913.png", tipo: "apartamento", justificativas: [] },
  { nome: "Nilo Square Résidence", bairro: "Boa Vista", dorms: 3, preco: 2500000, metragens: "176-216 m²", status: "Em obras", source: "meday", score: 0, imagem: "https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2026/03/03122659/Camada-934.png", tipo: "apartamento", justificativas: [] },
  { nome: "Arte Country Club", bairro: "Bela Vista", dorms: 4, preco: 3500000, metragens: "246-321 m²", status: "Em obras", source: "meday", score: 0, imagem: "https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2026/03/03122653/Camada-923.png", tipo: "apartamento", justificativas: [] },
  { nome: "Casa Moinhos", bairro: "Moinhos de Vento", dorms: 4, preco: 5000000, metragens: "292-644 m²", status: "Em obras", source: "meday", score: 0, imagem: "https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2026/03/03122707/Fachada_EF-scaled-1-1.png", tipo: "apartamento", justificativas: [] },
  { nome: "Reserva do Lago", bairro: "Mário Quintana", dorms: 0, preco: 148500, metragens: "Até 406 m²", status: "Pronto", source: "meday", score: 0, imagem: "https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2026/03/03122630/Camada-8.png", tipo: "terreno", justificativas: [] },
];

/* ═══════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════ */

function normalize(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function fmtPrice(v: number): string {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1).replace(".0", "")}M`;
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(0)}mil`;
  return `R$ ${v}`;
}

type HintMap = Record<string, { faixa_min?: number; faixa_max?: number; bairros?: string[]; tipo?: string; dorms?: number }>;

/** Infer profile from lead context */
function inferProfileFromLead(leadData?: Props["leadData"], currentProfile?: Props["currentProfile"], dynamicHints?: HintMap): RadarProfile {
  const emp = normalize(leadData?.empreendimento || "");
  const allHints: HintMap = { ...EMPREENDIMENTO_HINTS_FALLBACK, ...(dynamicHints || {}) };
  const hint = Object.entries(allHints).find(([k]) => emp.includes(normalize(k)))?.[1];

  return {
    quartos: currentProfile?.radar_quartos ?? hint?.dorms ?? null,
    valor_min: hint?.faixa_min ?? null,
    valor_max: currentProfile?.radar_valor_max ?? leadData?.valor_estimado ?? hint?.faixa_max ?? null,
    tipologias: (() => {
      const raw = currentProfile?.radar_tipologia;
      if (raw) {
        try { const p = JSON.parse(raw); if (Array.isArray(p)) return p; } catch {}
        return [raw];
      }
      return hint?.tipo ? [hint.tipo] : ["apartamento"];
    })(),
    bairros: (() => {
      const raw = currentProfile?.radar_bairros;
      if (Array.isArray(raw) && raw.length > 0) return raw;
      if (typeof raw === "string") { try { const p = JSON.parse(raw); if (Array.isArray(p) && p.length) return p; } catch {} }
      return hint?.bairros || [];
    })(),
    status_imovel: currentProfile?.radar_status_imovel || "",
  };
}

/** Score + justify */
function scoreAndJustify(profile: RadarProfile, imovel: ImovelResult, objecoes: string[], leadEmp?: string): { score: number; justificativas: string[] } {
  let score = 0;
  const justificativas: string[] = [];

  // Quartos (30 pts)
  if (profile.quartos && imovel.dorms > 0) {
    if (imovel.dorms === profile.quartos) { score += 30; justificativas.push(`${imovel.dorms} dorms — exatamente o que busca`); }
    else if (Math.abs(imovel.dorms - profile.quartos) === 1) { score += 15; justificativas.push(`${imovel.dorms} dorms — próximo do ideal`); }
  } else score += 15;

  // Valor (30 pts)
  if (profile.valor_max && imovel.preco > 0) {
    if (imovel.preco <= profile.valor_max) {
      score += 30;
      const ratio = imovel.preco / profile.valor_max;
      if (ratio >= 0.7) justificativas.push("Dentro da faixa de valor do lead");
      else justificativas.push("Abaixo do orçamento — boa economia");
    } else if (imovel.preco <= profile.valor_max * 1.15) {
      score += 15;
      justificativas.push("Até 15% acima do orçamento — negociável");
    }
  } else score += 15;

  // Bairro (25 pts)
  if (profile.bairros.length > 0 && imovel.bairro) {
    const nb = normalize(imovel.bairro);
    if (profile.bairros.some(b => nb.includes(normalize(b)) || normalize(b).includes(nb))) {
      score += 25;
      justificativas.push(`Bairro ${imovel.bairro} — região de interesse`);
    }
  } else score += 12;

  // Status (15 pts)
  if (profile.status_imovel && imovel.status) {
    const ns = normalize(imovel.status);
    const nf = normalize(profile.status_imovel);
    if (nf === "pronto" && ns.includes("pronto")) { score += 15; justificativas.push("Pronto para morar"); }
    else if (nf === "obras" && (ns.includes("obra") || ns.includes("lancamento"))) { score += 15; justificativas.push("Lançamento / em obras"); }
    else score += 5;
  } else score += 7;

  // Empreendimento match bonus
  if (leadEmp && imovel.empreendimento) {
    if (normalize(imovel.empreendimento).includes(normalize(leadEmp)) || normalize(imovel.nome || "").includes(normalize(leadEmp))) {
      score += 10;
      justificativas.push("Mesmo empreendimento de interesse");
    }
  }

  // Objection adjustments
  for (const obj of objecoes) {
    switch (obj) {
      case "caro":
        if (profile.valor_max && imovel.preco <= profile.valor_max * 0.85) {
          score += 5; justificativas.push("Alternativa após objeção de preço");
        }
        break;
      case "metragem":
        if (imovel.metragem && imovel.metragem > 80) {
          score += 5; justificativas.push("Maior metragem — atende objeção");
        }
        break;
      case "casa":
        if (normalize(imovel.tipo || "").includes("casa")) {
          score += 8; justificativas.push("Casa — conforme preferência");
        }
        break;
      case "apartamento":
        if (normalize(imovel.tipo || "").includes("apartamento")) {
          score += 5; justificativas.push("Apartamento — conforme preferência");
        }
        break;
      case "pronto":
        if (normalize(imovel.status || "").includes("pronto")) {
          score += 5; justificativas.push("Pronto — atende objeção");
        }
        break;
      case "central":
        if (["Centro Histórico", "Cidade Baixa", "Bom Fim", "Moinhos de Vento", "Rio Branco", "Independência"].some(b => normalize(imovel.bairro).includes(normalize(b)))) {
          score += 5; justificativas.push("Localização mais central");
        }
        break;
      case "investir":
        if (imovel.dorms <= 2 && imovel.preco > 0 && imovel.preco <= 600000) {
          score += 5; justificativas.push("Perfil investidor — compacto e acessível");
        }
        break;
    }
  }

  return { score: Math.min(Math.round((score / 110) * 100), 99), justificativas };
}

/* ═══════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════ */

export default function RadarImoveisTab({ leadId, leadNome, leadTelefone, leadData, currentProfile, onUpdate }: Props) {
  const navigate = useNavigate();
  const { search: typesenseSearch } = useTypesenseSearch();

  // Load dynamic hints from empreendimento_overrides
  const [dynamicHints, setDynamicHints] = useState<HintMap>({});
  useEffect(() => {
    supabase.from("empreendimento_overrides")
      .select("nome, codigo, bairro, valor_min, valor_max, dormitorios")
      .then(({ data }) => {
        if (data && data.length > 0) {
          setDynamicHints(buildHintsFromOverrides(data));
        }
      });
  }, []);

  // Inferred profile
  const inferred = useMemo(() => inferProfileFromLead(leadData, currentProfile, dynamicHints), [leadData, currentProfile, dynamicHints]);

  // Profile state
  const [quartos, setQuartos] = useState<string>(inferred.quartos ? String(inferred.quartos) : "");
  const [valorMin, setValorMin] = useState<string>(inferred.valor_min ? String(inferred.valor_min) : "");
  const [valorMax, setValorMax] = useState<string>(inferred.valor_max ? String(inferred.valor_max) : "");
  const [selectedTipologias, setSelectedTipologias] = useState<string[]>(inferred.tipologias);
  const [selectedBairros, setSelectedBairros] = useState<string[]>(inferred.bairros);
  const [statusImovel, setStatusImovel] = useState(inferred.status_imovel || "qualquer");
  const [bairroSearch, setBairroSearch] = useState("");

  // Results
  const [results, setResults] = useState<ImovelResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [selectedResults, setSelectedResults] = useState<Set<number>>(new Set());
  const [aiExpanding, setAiExpanding] = useState(false);

  // Source toggles
  const [useMeDay, setUseMeDay] = useState(true);
  const [useTypesense, setUseTypesense] = useState(true);

  // Objections
  const [activeObjecoes, setActiveObjecoes] = useState<string[]>([]);

  // UI
  const [showFilters, setShowFilters] = useState(false);
  const [showObjecoes, setShowObjecoes] = useState(false);

  const profile: RadarProfile = {
    quartos: quartos ? parseInt(quartos) : null,
    valor_min: valorMin ? parseFloat(valorMin) : null,
    valor_max: valorMax ? parseFloat(valorMax) : null,
    tipologias: selectedTipologias,
    bairros: selectedBairros,
    status_imovel: statusImovel === "qualquer" ? "" : statusImovel,
  };

  const toggleBairro = (b: string) => setSelectedBairros(prev => prev.includes(b) ? prev.filter(x => x !== b) : [...prev, b]);
  const toggleTipologia = (t: string) => setSelectedTipologias(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  const filteredBairros = BAIRROS_POA.filter(b => !bairroSearch || normalize(b).includes(normalize(bairroSearch)));
  const toggleObjecao = (key: string) => setActiveObjecoes(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);

  // Save profile
  const saveProfile = useCallback(async () => {
    await onUpdate(leadId, {
      radar_quartos: quartos ? parseInt(quartos) : null,
      radar_valor_max: valorMax ? parseFloat(valorMax) : null,
      radar_tipologia: JSON.stringify(selectedTipologias),
      radar_bairros: selectedBairros,
      radar_status_imovel: statusImovel === "qualquer" ? null : statusImovel,
      radar_atualizado_em: new Date().toISOString(),
    });
  }, [leadId, quartos, valorMax, selectedTipologias, selectedBairros, statusImovel, onUpdate]);

  // Search Typesense
  const searchTypesense = useCallback(async (): Promise<ImovelResult[]> => {
    try {
      const filterParts: string[] = ["valor_venda:>0"];
      if (selectedBairros.length === 1) filterParts.push(`bairro:=${selectedBairros[0]}`);
      else if (selectedBairros.length > 1) filterParts.push(`bairro:[${selectedBairros.join(",")}]`);
      if (valorMin) filterParts.push(`valor_venda:>=${parseFloat(valorMin)}`);
      if (valorMax) filterParts.push(`valor_venda:<=${parseFloat(valorMax) * 1.15}`);
      if (quartos) filterParts.push(`dormitorios:>=${parseInt(quartos)}`);

      const result = await typesenseSearch({
        q: leadData?.empreendimento || "*",
        page: 1,
        per_page: 30,
        filter_by: filterParts.join(" && "),
        sort_by: "valor_venda:asc",
      });

      if (!result) return [];
      return result.data.map((doc: any) => ({
        id: doc.codigo || doc.id,
        nome: doc.titulo || doc.empreendimento || "Imóvel",
        empreendimento: doc.empreendimento,
        bairro: doc.bairro || "",
        metragem: Number(doc.area_privativa || 0),
        dorms: Number(doc.dormitorios || 0),
        vagas: Number(doc.vagas || 0),
        suites: Number(doc.suites || 0),
        preco: Number(doc.valor_venda || 0),
        status: doc.situacao || "",
        imagem: doc.fotos?.[0] || doc.foto_principal || "",
        tipo: doc.tipo || "",
        score: 0,
        source: "typesense" as const,
        justificativas: [],
      }));
    } catch (err) {
      console.error("Typesense radar search error:", err);
      return [];
    }
  }, [typesenseSearch, selectedBairros, valorMax, quartos, leadData?.empreendimento]);

  // Main search
  const handleSearch = useCallback(async (silent = false) => {
    setLoading(true);
    setSearched(true);
    setSelectedResults(new Set());

    let allResults: ImovelResult[] = [];

    // MeDay catalog
    if (useMeDay) {
      allResults.push(...MEDAY_CATALOG.map(item => ({ ...item, justificativas: [] })));
    }

    // Typesense
    if (useTypesense) {
      const tsItems = await searchTypesense();
      allResults.push(...tsItems);
    }

    // Score all
    const leadEmp = leadData?.empreendimento || "";
    const scored = allResults.map(item => {
      const { score, justificativas } = scoreAndJustify(profile, item, activeObjecoes, leadEmp);
      return { ...item, score, justificativas };
    });

    scored.sort((a, b) => b.score - a.score);

    // Deduplicate by name
    const seen = new Set<string>();
    const deduped = scored.filter(item => {
      const key = normalize(item.nome || item.titulo || `${item.id}`);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    setResults(deduped.slice(0, 20));
    setLoading(false);

    if (!silent) {
      await saveProfile();
      toast.success(`${deduped.length} imóveis analisados!`);
    }
  }, [useMeDay, useTypesense, profile, activeObjecoes, searchTypesense, saveProfile, leadData?.empreendimento]);

  // AI expand
  const handleAIExpand = useCallback(async () => {
    setAiExpanding(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-search-imoveis", {
        body: {
          query: [
            leadData?.empreendimento && `empreendimento ${leadData.empreendimento}`,
            profile.valor_max && `até ${fmtPrice(profile.valor_max)}`,
            profile.quartos && `${profile.quartos} quartos`,
            profile.bairros.length > 0 && `bairros ${profile.bairros.join(", ")}`,
            activeObjecoes.includes("investir") && "para investimento",
            activeObjecoes.includes("casa") && "casa",
            activeObjecoes.includes("caro") && "mais barato",
            activeObjecoes.includes("pronto") && "pronto para morar",
          ].filter(Boolean).join(", ") || "apartamento Porto Alegre",
        },
      });

      if (error || data?.error) {
        toast.error(data?.error || "Erro na busca com IA");
        return;
      }

      // Search Typesense with AI filters
      const aiResult = await typesenseSearch({
        q: data.text_query || "*",
        page: 1,
        per_page: 20,
        filter_by: data.filter_by || undefined,
      });

      if (aiResult && aiResult.data.length > 0) {
        const newItems: ImovelResult[] = aiResult.data.map((doc: any) => {
          const item: ImovelResult = {
            id: doc.codigo || doc.id,
            nome: doc.titulo || doc.empreendimento || "Imóvel",
            empreendimento: doc.empreendimento,
            bairro: doc.bairro || "",
            metragem: Number(doc.area_privativa || 0),
            dorms: Number(doc.dormitorios || 0),
            vagas: Number(doc.vagas || 0),
            suites: Number(doc.suites || 0),
            preco: Number(doc.valor_venda || 0),
            status: doc.situacao || "",
            imagem: doc.fotos?.[0] || doc.foto_principal || "",
            tipo: doc.tipo || "",
            score: 0,
            source: "typesense",
            justificativas: ["🤖 Sugestão expandida pela IA"],
          };
          const { score, justificativas } = scoreAndJustify(profile, item, activeObjecoes, leadData?.empreendimento || "");
          return { ...item, score, justificativas: [...item.justificativas, ...justificativas] };
        });

        // Merge with existing, deduplicate
        const existingKeys = new Set(results.map(r => normalize(r.nome || r.titulo || `${r.id}`)));
        const fresh = newItems.filter(n => !existingKeys.has(normalize(n.nome || n.titulo || `${n.id}`)));
        const merged = [...results, ...fresh].sort((a, b) => b.score - a.score);
        setResults(merged.slice(0, 30));
        toast.success(`+${fresh.length} imóveis sugeridos pela IA`);
      } else {
        toast.info("A IA não encontrou resultados adicionais");
      }
    } catch (err) {
      console.error("AI expand error:", err);
      toast.error("Erro ao expandir com IA");
    } finally {
      setAiExpanding(false);
    }
  }, [leadData, profile, activeObjecoes, typesenseSearch, results]);

  // Auto-search on mount if we have context
  useEffect(() => {
    if (leadData?.empreendimento || inferred.valor_max || inferred.bairros.length > 0) {
      handleSearch(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-search when objections change
  useEffect(() => {
    if (searched && activeObjecoes.length > 0) {
      handleSearch(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeObjecoes]);

  const toggleSelect = (idx: number) => {
    setSelectedResults(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const selectedItems = results.filter((_, i) => selectedResults.has(i));

  // WhatsApp
  const generateWhatsAppMsg = () => {
    const items = selectedItems.length > 0 ? selectedItems : results.filter(r => r.score >= 60).slice(0, 5);
    if (items.length === 0) return "";
    let msg = `Olá ${leadNome}! 😊\n\nSelecionei ${items.length} imóveis que combinam com o seu perfil:\n\n`;
    items.forEach((item, i) => {
      msg += `${i + 1}. *${item.nome || "Imóvel"}*\n`;
      msg += `📍 ${item.bairro}`;
      if (item.dorms > 0) msg += ` · ${item.dorms} dorms`;
      if (item.metragens) msg += ` · ${item.metragens}`;
      else if (item.metragem && item.metragem > 0) msg += ` · ${item.metragem}m²`;
      if (item.preco > 0) msg += `\n💰 R$ ${item.preco.toLocaleString("pt-BR")}`;
      if (item.score >= 80) msg += ` ⭐`;
      msg += `\n\n`;
    });
    msg += `Gostou de algum? Posso agendar uma visita! 🏠`;
    return msg;
  };

  const sendWhatsApp = () => {
    if (!leadTelefone) { toast.error("Lead sem telefone cadastrado"); return; }
    const phone = leadTelefone.replace(/\D/g, "");
    window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(generateWhatsAppMsg())}`, "_blank");
    toast.success("Abrindo WhatsApp...");
  };

  const copyMessage = () => {
    const msg = generateWhatsAppMsg();
    if (!msg) { toast.error("Nenhum imóvel para copiar"); return; }
    navigator.clipboard.writeText(msg);
    toast.success("Mensagem copiada!");
  };

  return (
    <div className="px-6 pb-8 space-y-4">
      {/* ── HEADER ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Radar className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-foreground">Radar Automático</h4>
            <p className="text-[10px] text-muted-foreground">
              {leadData?.empreendimento
                ? `Perfil baseado em: ${leadData.empreendimento}`
                : "Analisando perfil do lead..."}
            </p>
          </div>
        </div>
        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => setShowFilters(!showFilters)}>
          {showFilters ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          Filtros
        </Button>
      </div>

      {/* ── CONTEXT BADGES ── */}
      {(leadData?.empreendimento || leadData?.campanha || leadData?.valor_estimado || leadData?.origem) && (
        <div className="flex flex-wrap gap-1.5">
          {leadData?.empreendimento && (
            <Badge variant="secondary" className="text-[10px] gap-1"><Building2 className="h-2.5 w-2.5" /> {leadData.empreendimento}</Badge>
          )}
          {leadData?.campanha && (
            <Badge variant="outline" className="text-[10px] gap-1"><MessageSquare className="h-2.5 w-2.5" /> {leadData.campanha}</Badge>
          )}
          {leadData?.valor_estimado && (
            <Badge variant="outline" className="text-[10px] gap-1"><DollarSign className="h-2.5 w-2.5" /> {fmtPrice(leadData.valor_estimado)}</Badge>
          )}
          {leadData?.origem && (
            <Badge variant="outline" className="text-[10px] gap-1">{leadData.origem}</Badge>
          )}
        </div>
      )}

      {/* ── OBJEÇÕES ── */}
      <Card className="border-amber-200/50 bg-amber-50/30">
        <CardContent className="p-3">
          <button
            className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 w-full"
            onClick={() => setShowObjecoes(!showObjecoes)}
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            Objeções do Lead
            {activeObjecoes.length > 0 && <Badge className="ml-auto text-[9px] bg-amber-100 text-amber-700 border-amber-200">{activeObjecoes.length}</Badge>}
            {showObjecoes ? <ChevronUp className="h-3 w-3 ml-auto" /> : <ChevronDown className="h-3 w-3 ml-auto" />}
          </button>
          {showObjecoes && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {OBJECOES.map(obj => (
                <button
                  key={obj.key}
                  onClick={() => toggleObjecao(obj.key)}
                  className={`text-[10px] px-2.5 py-1 rounded-full border transition-colors ${
                    activeObjecoes.includes(obj.key)
                      ? "bg-amber-500 text-white border-amber-500"
                      : "bg-background text-muted-foreground border-border hover:border-amber-300"
                  }`}
                >
                  {obj.icon} {obj.label}
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── FILTROS (collapsed by default) ── */}
      {showFilters && (
        <Card className="border-primary/20">
          <CardContent className="p-4 space-y-3">
            <h5 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Home className="h-3.5 w-3.5" /> Perfil de Interesse
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
                <Input type="number" className="h-9 text-sm" placeholder="Ex: 500000" value={valorMax} onChange={(e) => setValorMax(e.target.value)} />
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
                    <SelectItem value="qualquer">Qualquer</SelectItem>
                    <SelectItem value="pronto">Pronto p/ morar</SelectItem>
                    <SelectItem value="obras">Em obras / Lançamento</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {/* Bairros */}
            <div>
              <Label className="text-[11px] text-muted-foreground">Bairros</Label>
              <Input className="h-8 text-xs mt-1 mb-1.5" placeholder="Buscar bairro..." value={bairroSearch} onChange={(e) => setBairroSearch(e.target.value)} />
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
                <p className="text-[10px] text-primary mt-1">{selectedBairros.length} bairro(s): {selectedBairros.join(", ")}</p>
              )}
            </div>
            {/* Sources */}
            <div className="flex items-center gap-4 pt-1 border-t border-border/30">
              <div className="flex items-center gap-2">
                <Switch checked={useTypesense} onCheckedChange={setUseTypesense} />
                <Label className="text-[11px]">Catálogo Geral</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={useMeDay} onCheckedChange={setUseMeDay} />
                <Label className="text-[11px] flex items-center gap-1"><Sparkles className="h-3 w-3 text-amber-500" /> Melnick Day</Label>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── SEARCH BUTTON ── */}
      <div className="flex gap-2">
        <Button className="flex-1 gap-2" onClick={() => { handleSearch(false); setShowFilters(false); }} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          {searched ? "Atualizar Radar" : "Buscar Imóveis"}
        </Button>
        <Button variant="outline" className="gap-1.5 border-purple-300 text-purple-600 hover:bg-purple-50" onClick={handleAIExpand} disabled={aiExpanding || loading}>
          {aiExpanding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
          IA
        </Button>
      </div>

      {/* ── RESULTS ── */}
      {searched && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h5 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5" />
              {results.length > 0 ? `${results.length} imóveis sugeridos` : "Nenhum resultado"}
            </h5>
            {selectedResults.size > 0 && (
              <Badge variant="secondary" className="text-[10px]">{selectedResults.size} selecionado(s)</Badge>
            )}
          </div>

          {results.length === 0 && !loading && (
            <div className="text-center py-8 text-muted-foreground">
              <Building2 className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nenhum imóvel encontrado.</p>
              <p className="text-xs mt-1">Ajuste os filtros ou use a busca com IA.</p>
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
                          {item.dorms > 0 && <span><Bed className="h-2.5 w-2.5 inline" /> {item.dorms}</span>}
                          {item.vagas && item.vagas > 0 && <span><Car className="h-2.5 w-2.5 inline" /> {item.vagas}</span>}
                          {item.metragens && <span>{item.metragens}</span>}
                          {!item.metragens && item.metragem && item.metragem > 0 && <span>{item.metragem}m²</span>}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                          item.score >= 80 ? "bg-emerald-100 text-emerald-700" :
                          item.score >= 60 ? "bg-amber-100 text-amber-700" :
                          item.score >= 40 ? "bg-orange-100 text-orange-600" :
                          "bg-muted text-muted-foreground"
                        }`}>
                          {item.score}%
                        </div>
                      </div>
                    </div>
                    {item.preco > 0 && (
                      <p className="text-xs font-bold text-emerald-600 mt-0.5">
                        R$ {item.preco.toLocaleString("pt-BR")}
                      </p>
                    )}
                    {/* Justifications */}
                    {item.justificativas.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {item.justificativas.slice(0, 2).map((j, i) => (
                          <span key={i} className="text-[9px] text-primary/80 bg-primary/5 px-1.5 py-0.5 rounded">
                            {j}
                          </span>
                        ))}
                      </div>
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
              <Button size="sm" className="flex-1 gap-1.5" onClick={sendWhatsApp}>
                <Send className="h-3.5 w-3.5" />
                Enviar WhatsApp
                {selectedResults.size > 0 && ` (${selectedResults.size})`}
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={copyMessage}>
                <Copy className="h-3.5 w-3.5" /> Copiar
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Loading overlay */}
      {loading && !searched && (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm">Analisando perfil e buscando imóveis...</p>
        </div>
      )}
    </div>
  );
}
