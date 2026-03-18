import { useState, useCallback, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Radar, Search, Building2, MapPin, DollarSign,
  Copy, ExternalLink, Loader2, Sparkles, Home, Send, Check,
  Brain, AlertTriangle, Star, Eye, ChevronDown, ChevronUp,
  MessageSquare, Bed, Car, Maximize2, RefreshCw,
  Heart, HeartOff, X, Clock, History, Save, ThumbsDown
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useTypesenseSearch } from "@/hooks/useTypesenseSearch";
import { useLeadPropertyProfile } from "@/hooks/useLeadPropertyProfile";
import { useLeadPropertySearch } from "@/hooks/useLeadPropertySearch";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import LeadMatchesWidget from "./LeadMatchesWidget";

/* ═══════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════ */

interface ImovelResult {
  id?: number | string;
  codigo?: string;
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

const ITENS_POSSIVEIS = [
  "Churrasqueira", "Sacada", "Lavabo", "Office", "Rooftop", "Piscina",
  "Academia", "Salão de festas", "Playground", "Pet place", "Bicicletário",
  "Portaria 24h", "Elevador", "Depósito", "Vaga coberta",
];

const MEDAY_CATALOG: ImovelResult[] = [
  { nome: "Open Major", codigo: "open-major", bairro: "Marechal Rondon", dorms: 2, preco: 235505, metragens: "43 m²", status: "Em obras", source: "meday", score: 0, imagem: "https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2026/03/03122722/open-major.png", tipo: "apartamento", justificativas: [] },
  { nome: "Open Alto Ipiranga", codigo: "open-alto-ipiranga", bairro: "Jardim Carvalho", dorms: 2, preco: 271310, metragens: "42 m²", status: "Em obras", source: "meday", score: 0, imagem: "https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2026/03/03122643/Camada-20.png", tipo: "apartamento", justificativas: [] },
  { nome: "Open Bosque", codigo: "open-bosque", bairro: "Passo d'Areia", dorms: 3, preco: 240582, metragens: "31-63 m²", status: "Em obras", source: "meday", score: 0, imagem: "https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2026/03/03122725/Retangulo-2.png", tipo: "apartamento", justificativas: [] },
  { nome: "Supreme Altos do Central Parque", codigo: "supreme-central", bairro: "Jardim do Salso", dorms: 3, preco: 499448, metragens: "59-70 m²", status: "Pronto", source: "meday", score: 0, imagem: "https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2026/03/03122731/supreme.png", tipo: "apartamento", justificativas: [] },
  { nome: "Grand Park Lindóia", codigo: "grand-park", bairro: "São Sebastião", dorms: 3, preco: 485792, metragens: "56-81 m²", status: "Pronto", source: "meday", score: 0, imagem: "https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2026/03/03122658/Camada-933.png", tipo: "apartamento", justificativas: [] },
  { nome: "GO Cidade Baixa", codigo: "go-cidade-baixa", bairro: "Cidade Baixa", dorms: 1, preco: 338274, metragens: "27 m²", status: "Pronto", source: "meday", score: 0, imagem: "https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2026/03/03122703/cidade-baixa.png", tipo: "apartamento", justificativas: [] },
  { nome: "GO Rio Branco", codigo: "go-rio-branco", bairro: "Rio Branco", dorms: 1, preco: 448766, metragens: "25-63 m²", status: "Pronto", source: "meday", score: 0, imagem: "https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2026/03/03122727/rio-granco.png", tipo: "apartamento", justificativas: [] },
  { nome: "SEEN Três Figueiras", codigo: "seen-tres-figueiras", bairro: "Três Figueiras", dorms: 4, preco: 1596482, metragens: "149-169 m²", status: "Em obras", source: "meday", score: 0, imagem: "https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2026/03/03122710/fachada_seen_tres_figueiras-1.png", tipo: "apartamento", justificativas: [] },
  { nome: "SEEN Menino Deus", codigo: "seen-menino-deus", bairro: "Menino Deus", dorms: 3, preco: 1338633, metragens: "98-151 m²", status: "Em obras", source: "meday", score: 0, imagem: "https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2026/03/03122721/menino-deus.png", tipo: "apartamento", justificativas: [] },
  { nome: "High Garden Rio Branco", codigo: "high-garden-rb", bairro: "Rio Branco", dorms: 3, preco: 1636005, metragens: "123-143 m²", status: "Em obras", source: "meday", score: 0, imagem: "https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2026/03/03122716/high-garden.png", tipo: "apartamento", justificativas: [] },
  { nome: "High Garden Iguatemi", codigo: "high-garden-ig", bairro: "Boa Vista", dorms: 3, preco: 1232604, metragens: "102-125 m²", status: "Em obras", source: "meday", score: 0, imagem: "https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2026/03/03122629/Camada-7.png", tipo: "apartamento", justificativas: [] },
  { nome: "Nilo Square Résidence", codigo: "nilo-square", bairro: "Boa Vista", dorms: 3, preco: 2500000, metragens: "176-216 m²", status: "Em obras", source: "meday", score: 0, imagem: "https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2026/03/03122659/Camada-934.png", tipo: "apartamento", justificativas: [] },
  { nome: "Arte Country Club", codigo: "arte-country", bairro: "Bela Vista", dorms: 4, preco: 3500000, metragens: "246-321 m²", status: "Em obras", source: "meday", score: 0, imagem: "https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2026/03/03122653/Camada-923.png", tipo: "apartamento", justificativas: [] },
  { nome: "Casa Moinhos", codigo: "casa-moinhos", bairro: "Moinhos de Vento", dorms: 4, preco: 5000000, metragens: "292-644 m²", status: "Em obras", source: "meday", score: 0, imagem: "https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2026/03/03122707/Fachada_EF-scaled-1-1.png", tipo: "apartamento", justificativas: [] },
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

function getPropertyCode(item: ImovelResult): string {
  return String(item.codigo || item.id || item.nome || "unknown");
}

/* ═══════════════════════════════════════════
   ENHANCED SCORING — uses full profile
   ═══════════════════════════════════════════ */

interface ScoringProfile {
  valor_min: number | null;
  valor_max: number | null;
  bairros: string[];
  tipos: string[];
  dormitorios_min: number | null;
  suites_min: number | null;
  vagas_min: number | null;
  area_min: number | null;
  area_max: number | null;
  itens_obrigatorios: string[];
  rejeicoes: string[];
  objetivo: string[];
  status_imovel: string;
}

function scoreProperty(
  profile: ScoringProfile,
  imovel: ImovelResult,
  objecoes: string[],
  leadEmp?: string,
  discardedCodes?: Set<string>,
): { score: number; justificativas: string[] } {
  let score = 0;
  const justificativas: string[] = [];
  const code = getPropertyCode(imovel);

  // Discarded → penalty
  if (discardedCodes?.has(code)) {
    return { score: 0, justificativas: ["❌ Descartado anteriormente"] };
  }

  // ── Valor (25 pts) ──
  if ((profile.valor_min || profile.valor_max) && imovel.preco > 0) {
    const aboveMin = !profile.valor_min || imovel.preco >= profile.valor_min;
    const belowMax = !profile.valor_max || imovel.preco <= profile.valor_max;
    if (aboveMin && belowMax) {
      score += 25;
      justificativas.push("💰 Dentro da faixa de valor");
    } else if (!profile.valor_max || imovel.preco <= profile.valor_max * 1.15) {
      score += 12;
      justificativas.push("💰 Próximo da faixa (até 15% acima)");
    }
  } else score += 12;

  // ── Bairro (20 pts) ──
  if (profile.bairros.length > 0 && imovel.bairro) {
    const nb = normalize(imovel.bairro);
    if (profile.bairros.some(b => nb.includes(normalize(b)) || normalize(b).includes(nb))) {
      score += 20;
      justificativas.push(`📍 ${imovel.bairro} — região de interesse`);
    }
  } else score += 10;

  // ── Dormitórios (15 pts) ──
  if (profile.dormitorios_min && imovel.dorms > 0) {
    if (imovel.dorms >= profile.dormitorios_min) {
      score += 15;
      justificativas.push(`🛏️ ${imovel.dorms} dorms — atende`);
    } else if (imovel.dorms === profile.dormitorios_min - 1) {
      score += 7;
      justificativas.push(`🛏️ ${imovel.dorms} dorms — próximo`);
    }
  } else score += 7;

  // ── Tipologia (10 pts) ──
  if (profile.tipos.length > 0 && imovel.tipo) {
    if (profile.tipos.some(t => normalize(imovel.tipo || "").includes(normalize(t)))) {
      score += 10;
      justificativas.push("✅ Tipologia compatível");
    }
  } else score += 5;

  // ── Suítes (5 pts) ──
  if (profile.suites_min && (imovel.suites || 0) >= profile.suites_min) {
    score += 5;
    justificativas.push(`🛁 ${imovel.suites} suíte(s)`);
  } else if (!profile.suites_min) score += 2;

  // ── Vagas (5 pts) ──
  if (profile.vagas_min && (imovel.vagas || 0) >= profile.vagas_min) {
    score += 5;
    justificativas.push(`🚗 ${imovel.vagas} vaga(s)`);
  } else if (!profile.vagas_min) score += 2;

  // ── Área (5 pts) ──
  if (imovel.metragem && imovel.metragem > 0) {
    const inMin = !profile.area_min || imovel.metragem >= profile.area_min;
    const inMax = !profile.area_max || imovel.metragem <= profile.area_max;
    if (inMin && inMax) {
      score += 5;
      justificativas.push(`📐 ${imovel.metragem}m² — dentro da faixa`);
    }
  } else score += 2;

  // ── Status (5 pts) ──
  if (profile.status_imovel && imovel.status) {
    const ns = normalize(imovel.status);
    const nf = normalize(profile.status_imovel);
    if (nf === "pronto" && ns.includes("pronto")) { score += 5; justificativas.push("🏠 Pronto para morar"); }
    else if (nf === "obras" && (ns.includes("obra") || ns.includes("lancamento"))) { score += 5; justificativas.push("🏗️ Em obras/Lançamento"); }
  } else score += 2;

  // ── Empreendimento match bonus (10 pts) ──
  if (leadEmp && imovel.empreendimento) {
    if (normalize(imovel.empreendimento).includes(normalize(leadEmp)) || normalize(imovel.nome || "").includes(normalize(leadEmp))) {
      score += 10;
      justificativas.push("⭐ Mesmo empreendimento de interesse");
    }
  }

  // ── Rejeições penalty ──
  for (const rej of profile.rejeicoes) {
    const nRej = normalize(rej);
    if (normalize(imovel.bairro).includes(nRej) || normalize(imovel.nome || "").includes(nRej)) {
      score -= 15;
      justificativas.push(`⚠️ Rejeição: ${rej}`);
    }
  }

  // ── Objeções ──
  for (const obj of objecoes) {
    switch (obj) {
      case "caro":
        if (profile.valor_max && imovel.preco <= profile.valor_max * 0.85) { score += 5; justificativas.push("💡 Alternativa após objeção de preço"); }
        break;
      case "metragem":
        if (imovel.metragem && imovel.metragem > 80) { score += 5; justificativas.push("📐 Maior metragem"); }
        break;
      case "casa":
        if (normalize(imovel.tipo || "").includes("casa")) { score += 8; justificativas.push("🏡 Casa"); }
        break;
      case "pronto":
        if (normalize(imovel.status || "").includes("pronto")) { score += 5; justificativas.push("🏠 Pronto"); }
        break;
      case "central":
        if (["Centro Histórico", "Cidade Baixa", "Bom Fim", "Moinhos de Vento", "Rio Branco"].some(b => normalize(imovel.bairro).includes(normalize(b)))) {
          score += 5; justificativas.push("📍 Mais central");
        }
        break;
      case "investir":
        if (imovel.dorms <= 2 && imovel.preco > 0 && imovel.preco <= 600000) { score += 5; justificativas.push("📈 Perfil investidor"); }
        break;
    }
  }

  return { score: Math.min(Math.max(Math.round((score / 105) * 100), 0), 99), justificativas };
}

/* ═══════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════ */

export default function RadarImoveisTab({ leadId, leadNome, leadTelefone, leadData, currentProfile, onUpdate }: Props) {
  const navigate = useNavigate();
  const { search: typesenseSearch } = useTypesenseSearch();

  // ── New hooks ──
  const { profile: savedProfile, upsertProfile, isSaving: isSavingProfile } = useLeadPropertyProfile(leadId);
  const {
    searchHistory, favoriteCodes, sentCodes, discardedCodes,
    saveSearch, trackInteraction, isLoadingHistory,
  } = useLeadPropertySearch(leadId);

  // ── Tab state ──
  const [subTab, setSubTab] = useState<"radar" | "matches" | "perfil" | "historico">("radar");

  // ── Profile form state (initialized from savedProfile or legacy fields) ──
  const [profileForm, setProfileForm] = useState({
    objetivo: [] as string[],
    valor_min: "",
    valor_max: "",
    bairros: [] as string[],
    tipos: ["apartamento"] as string[],
    dormitorios_min: "",
    suites_min: "",
    vagas_min: "",
    area_min: "",
    area_max: "",
    itens_obrigatorios: [] as string[],
    itens_desejaveis: [] as string[],
    rejeicoes: [] as string[],
    momento_compra: "",
    urgencia: "",
    aceita_financiamento: null as boolean | null,
    possui_imovel_troca: false,
    observacoes: "",
    status_imovel: "qualquer",
  });

  // Initialize form from saved profile or legacy
  useEffect(() => {
    if (savedProfile) {
      setProfileForm({
        objetivo: savedProfile.objetivo || [],
        valor_min: savedProfile.valor_min ? String(savedProfile.valor_min) : "",
        valor_max: savedProfile.valor_max ? String(savedProfile.valor_max) : "",
        bairros: savedProfile.bairros || [],
        tipos: savedProfile.tipos || ["apartamento"],
        dormitorios_min: savedProfile.dormitorios_min ? String(savedProfile.dormitorios_min) : "",
        suites_min: savedProfile.suites_min ? String(savedProfile.suites_min) : "",
        vagas_min: savedProfile.vagas_min ? String(savedProfile.vagas_min) : "",
        area_min: savedProfile.area_min ? String(savedProfile.area_min) : "",
        area_max: savedProfile.area_max ? String(savedProfile.area_max) : "",
        itens_obrigatorios: savedProfile.itens_obrigatorios || [],
        itens_desejaveis: savedProfile.itens_desejaveis || [],
        rejeicoes: savedProfile.rejeicoes || [],
        momento_compra: savedProfile.momento_compra || "",
        urgencia: savedProfile.urgencia || "",
        aceita_financiamento: savedProfile.aceita_financiamento,
        possui_imovel_troca: savedProfile.possui_imovel_troca || false,
        observacoes: savedProfile.observacoes || "",
        status_imovel: "qualquer",
      });
    } else if (currentProfile) {
      // Legacy migration
      setProfileForm(prev => ({
        ...prev,
        dormitorios_min: currentProfile.radar_quartos ? String(currentProfile.radar_quartos) : "",
        valor_max: currentProfile.radar_valor_max ? String(currentProfile.radar_valor_max) : (leadData?.valor_estimado ? String(leadData.valor_estimado) : ""),
        bairros: currentProfile.radar_bairros || [],
        tipos: (() => {
          const raw = currentProfile.radar_tipologia;
          if (raw) { try { const p = JSON.parse(raw); if (Array.isArray(p)) return p; } catch {} return [raw]; }
          return ["apartamento"];
        })(),
        status_imovel: currentProfile.radar_status_imovel || "qualquer",
      }));
    }
  }, [savedProfile, currentProfile, leadData?.valor_estimado]);

  // ── Results state ──
  const [results, setResults] = useState<ImovelResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [selectedResults, setSelectedResults] = useState<Set<number>>(new Set());
  const [aiExpanding, setAiExpanding] = useState(false);
  const [useMeDay, setUseMeDay] = useState(true);
  const [useTypesense, setUseTypesense] = useState(true);
  const [activeObjecoes, setActiveObjecoes] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [showObjecoes, setShowObjecoes] = useState(false);
  const [bairroSearch, setBairroSearch] = useState("");
  const [newRejeicao, setNewRejeicao] = useState("");

  const toggleBairro = (b: string) => setProfileForm(prev => ({ ...prev, bairros: prev.bairros.includes(b) ? prev.bairros.filter(x => x !== b) : [...prev.bairros, b] }));
  const toggleTipologia = (t: string) => setProfileForm(prev => ({ ...prev, tipos: prev.tipos.includes(t) ? prev.tipos.filter(x => x !== t) : [...prev.tipos, t] }));
  const filteredBairros = BAIRROS_POA.filter(b => !bairroSearch || normalize(b).includes(normalize(bairroSearch)));
  const toggleObjecao = (key: string) => setActiveObjecoes(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);

  // Build scoring profile
  const scoringProfile: ScoringProfile = useMemo(() => ({
    valor_min: profileForm.valor_min ? parseFloat(profileForm.valor_min) : null,
    valor_max: profileForm.valor_max ? parseFloat(profileForm.valor_max) : null,
    bairros: profileForm.bairros,
    tipos: profileForm.tipos,
    dormitorios_min: profileForm.dormitorios_min ? parseInt(profileForm.dormitorios_min) : null,
    suites_min: profileForm.suites_min ? parseInt(profileForm.suites_min) : null,
    vagas_min: profileForm.vagas_min ? parseInt(profileForm.vagas_min) : null,
    area_min: profileForm.area_min ? parseInt(profileForm.area_min) : null,
    area_max: profileForm.area_max ? parseInt(profileForm.area_max) : null,
    itens_obrigatorios: profileForm.itens_obrigatorios,
    rejeicoes: profileForm.rejeicoes,
    objetivo: profileForm.objetivo,
    status_imovel: profileForm.status_imovel === "qualquer" ? "" : profileForm.status_imovel,
  }), [profileForm]);

  // Save profile to DB
  const handleSaveProfile = useCallback(async () => {
    try {
      await upsertProfile({
        lead_id: leadId,
        objetivo: profileForm.objetivo.length ? profileForm.objetivo : null,
        valor_min: profileForm.valor_min ? parseFloat(profileForm.valor_min) : null,
        valor_max: profileForm.valor_max ? parseFloat(profileForm.valor_max) : null,
        bairros: profileForm.bairros.length ? profileForm.bairros : null,
        tipos: profileForm.tipos.length ? profileForm.tipos : null,
        dormitorios_min: profileForm.dormitorios_min ? parseInt(profileForm.dormitorios_min) : null,
        suites_min: profileForm.suites_min ? parseInt(profileForm.suites_min) : null,
        vagas_min: profileForm.vagas_min ? parseInt(profileForm.vagas_min) : null,
        area_min: profileForm.area_min ? parseInt(profileForm.area_min) : null,
        area_max: profileForm.area_max ? parseInt(profileForm.area_max) : null,
        itens_obrigatorios: profileForm.itens_obrigatorios.length ? profileForm.itens_obrigatorios : null,
        itens_desejaveis: profileForm.itens_desejaveis.length ? profileForm.itens_desejaveis : null,
        rejeicoes: profileForm.rejeicoes.length ? profileForm.rejeicoes : null,
        momento_compra: profileForm.momento_compra || null,
        urgencia: profileForm.urgencia || null,
        aceita_financiamento: profileForm.aceita_financiamento,
        possui_imovel_troca: profileForm.possui_imovel_troca,
        observacoes: profileForm.observacoes || null,
      });
      // Also sync legacy fields
      await onUpdate(leadId, {
        radar_quartos: profileForm.dormitorios_min ? parseInt(profileForm.dormitorios_min) : null,
        radar_valor_max: profileForm.valor_max ? parseFloat(profileForm.valor_max) : null,
        radar_tipologia: JSON.stringify(profileForm.tipos),
        radar_bairros: profileForm.bairros,
        radar_status_imovel: profileForm.status_imovel === "qualquer" ? null : profileForm.status_imovel,
        radar_atualizado_em: new Date().toISOString(),
      });
      toast.success("Perfil salvo!");
    } catch (err) {
      toast.error("Erro ao salvar perfil");
    }
  }, [leadId, profileForm, upsertProfile, onUpdate]);

  // ── Typesense search ──
  const searchTypesense = useCallback(async (): Promise<ImovelResult[]> => {
    try {
      const filterParts: string[] = ["valor_venda:>0"];
      if (profileForm.bairros.length === 1) filterParts.push(`bairro:=${profileForm.bairros[0]}`);
      else if (profileForm.bairros.length > 1) filterParts.push(`bairro:[${profileForm.bairros.join(",")}]`);
      if (profileForm.valor_min) filterParts.push(`valor_venda:>=${parseFloat(profileForm.valor_min) * 0.85}`);
      if (profileForm.valor_max) filterParts.push(`valor_venda:<=${parseFloat(profileForm.valor_max) * 1.2}`);
      if (profileForm.dormitorios_min) {
        const q = parseInt(profileForm.dormitorios_min);
        if (q >= 4) filterParts.push(`dormitorios:>=${q}`);
        else filterParts.push(`dormitorios:[${Math.max(1, q - 1)},${q},${q + 1}]`);
      }
      const validTipos = profileForm.tipos.filter(t => t && t !== "qualquer");
      if (validTipos.length === 1) filterParts.push(`tipo:=${validTipos[0]}`);
      else if (validTipos.length > 1) filterParts.push(`tipo:[${validTipos.join(",")}]`);
      if (profileForm.status_imovel === "pronto") filterParts.push(`em_obras:=false`);
      else if (profileForm.status_imovel === "obras") filterParts.push(`em_obras:=true`);

      const result = await typesenseSearch({ q: "*", page: 1, per_page: 48, filter_by: filterParts.join(" && "), sort_by: "data_atualizacao:desc" });
      if (!result) return [];
      return result.data.map((doc: any) => ({
        id: doc.codigo || doc.id,
        codigo: doc.codigo || String(doc.id),
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
  }, [typesenseSearch, profileForm]);

  // ── Main search ──
  const handleSearch = useCallback(async (silent = false) => {
    setLoading(true);
    setSearched(true);
    setSelectedResults(new Set());

    let allResults: ImovelResult[] = [];
    if (useMeDay) allResults.push(...MEDAY_CATALOG.map(item => ({ ...item, justificativas: [] })));
    if (useTypesense) allResults.push(...(await searchTypesense()));

    const leadEmp = leadData?.empreendimento || "";
    const scored = allResults.map(item => {
      const { score, justificativas } = scoreProperty(scoringProfile, item, activeObjecoes, leadEmp, discardedCodes as Set<string>);
      return { ...item, score, justificativas };
    });
    scored.sort((a, b) => b.score - a.score);

    // Deduplicate
    const seen = new Set<string>();
    const deduped = scored.filter(item => {
      const key = normalize(item.nome || `${item.id}`);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    setResults(deduped.slice(0, 30));
    setLoading(false);

    if (!silent) {
      await handleSaveProfile();
      // Save search history
      try {
        await saveSearch({
          filters: { ...scoringProfile, objecoes: activeObjecoes },
          result_codes: deduped.slice(0, 30).map(r => getPropertyCode(r)),
          total_results: deduped.length,
        });
      } catch {}
      toast.success(`${deduped.length} imóveis analisados!`);
    }
  }, [useMeDay, useTypesense, scoringProfile, activeObjecoes, searchTypesense, handleSaveProfile, leadData?.empreendimento, discardedCodes, saveSearch]);

  // AI expand
  const handleAIExpand = useCallback(async () => {
    setAiExpanding(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-search-imoveis", {
        body: {
          query: [
            leadData?.empreendimento && `empreendimento ${leadData.empreendimento}`,
            scoringProfile.valor_max && `até ${fmtPrice(scoringProfile.valor_max)}`,
            scoringProfile.dormitorios_min && `${scoringProfile.dormitorios_min} quartos`,
            scoringProfile.bairros.length > 0 && `bairros ${scoringProfile.bairros.join(", ")}`,
            activeObjecoes.includes("investir") && "para investimento",
          ].filter(Boolean).join(", ") || "apartamento Porto Alegre",
        },
      });
      if (error || data?.error) { toast.error(data?.error || "Erro na busca com IA"); return; }
      const aiResult = await typesenseSearch({ q: data.text_query || "*", page: 1, per_page: 20, filter_by: data.filter_by || undefined });
      if (aiResult && aiResult.data.length > 0) {
        const newItems: ImovelResult[] = aiResult.data.map((doc: any) => {
          const item: ImovelResult = {
            id: doc.codigo || doc.id, codigo: doc.codigo || String(doc.id),
            nome: doc.titulo || doc.empreendimento || "Imóvel", empreendimento: doc.empreendimento,
            bairro: doc.bairro || "", metragem: Number(doc.area_privativa || 0),
            dorms: Number(doc.dormitorios || 0), vagas: Number(doc.vagas || 0), suites: Number(doc.suites || 0),
            preco: Number(doc.valor_venda || 0), status: doc.situacao || "",
            imagem: doc.fotos?.[0] || doc.foto_principal || "", tipo: doc.tipo || "",
            score: 0, source: "typesense", justificativas: ["🤖 Sugestão IA"],
          };
          const { score, justificativas } = scoreProperty(scoringProfile, item, activeObjecoes, leadData?.empreendimento || "", discardedCodes as Set<string>);
          return { ...item, score, justificativas: [...item.justificativas, ...justificativas] };
        });
        const existingKeys = new Set(results.map(r => normalize(r.nome || `${r.id}`)));
        const fresh = newItems.filter(n => !existingKeys.has(normalize(n.nome || `${n.id}`)));
        setResults(prev => [...prev, ...fresh].sort((a, b) => b.score - a.score).slice(0, 30));
        toast.success(`+${fresh.length} imóveis sugeridos pela IA`);
      } else toast.info("A IA não encontrou resultados adicionais");
    } catch { toast.error("Erro ao expandir com IA"); }
    finally { setAiExpanding(false); }
  }, [leadData, scoringProfile, activeObjecoes, typesenseSearch, results, discardedCodes]);

  // Auto-search
  useEffect(() => {
    if (leadData?.empreendimento || profileForm.valor_max || profileForm.bairros.length > 0) {
      handleSearch(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (searched && activeObjecoes.length > 0) handleSearch(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeObjecoes]);

  const toggleSelect = (idx: number) => setSelectedResults(prev => { const next = new Set(prev); if (next.has(idx)) next.delete(idx); else next.add(idx); return next; });
  const selectedItems = results.filter((_, i) => selectedResults.has(i));

  // ── Interaction handlers ──
  const handleFavorite = useCallback(async (item: ImovelResult, e: React.MouseEvent) => {
    e.stopPropagation();
    const code = getPropertyCode(item);
    try {
      await trackInteraction({ property_code: code, acao: favoriteCodes.has(code) ? "desfavorito" : "favorito" });
      toast.success(favoriteCodes.has(code) ? "Removido dos favoritos" : "Favoritado! ⭐");
    } catch { toast.error("Erro"); }
  }, [trackInteraction, favoriteCodes]);

  const handleDiscard = useCallback(async (item: ImovelResult, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await trackInteraction({ property_code: getPropertyCode(item), acao: "descartado" });
      toast.success("Imóvel descartado");
    } catch { toast.error("Erro"); }
  }, [trackInteraction]);

  const handleMarkSent = useCallback(async (items: ImovelResult[]) => {
    for (const item of items) {
      try {
        await trackInteraction({ property_code: getPropertyCode(item), acao: "enviado", canal_envio: "whatsapp" });
      } catch {}
    }
  }, [trackInteraction]);

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
    const items = selectedItems.length > 0 ? selectedItems : results.filter(r => r.score >= 60).slice(0, 5);
    handleMarkSent(items);
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
    <div className="px-6 pb-8 space-y-3">
      {/* ── SUB-TABS ── */}
      <Tabs value={subTab} onValueChange={(v) => setSubTab(v as any)}>
        <TabsList className="h-8 bg-muted/50 w-full">
          <TabsTrigger value="radar" className="text-xs h-6 flex-1 gap-1">
            <Radar className="h-3 w-3" /> Radar
          </TabsTrigger>
          <TabsTrigger value="matches" className="text-xs h-6 flex-1 gap-1">
            <Sparkles className="h-3 w-3" /> Matches
          </TabsTrigger>
          <TabsTrigger value="perfil" className="text-xs h-6 flex-1 gap-1">
            <Home className="h-3 w-3" /> Perfil
            {savedProfile && <span className="text-[8px] text-emerald-500">●</span>}
          </TabsTrigger>
          <TabsTrigger value="historico" className="text-xs h-6 flex-1 gap-1">
            <History className="h-3 w-3" /> Histórico
            {searchHistory.length > 0 && <Badge variant="secondary" className="h-3.5 text-[8px] px-1">{searchHistory.length}</Badge>}
          </TabsTrigger>
        </TabsList>

        {/* ════════ TAB: MATCHES ════════ */}
        <TabsContent value="matches" className="mt-3">
          <LeadMatchesWidget leadId={leadId} leadNome={leadNome} leadTelefone={leadTelefone} />
        </TabsContent>

        {/* ════════ TAB: RADAR ════════ */}
        <TabsContent value="radar" className="mt-3 space-y-3">
          {/* Context badges */}
          {(leadData?.empreendimento || leadData?.valor_estimado) && (
            <div className="flex flex-wrap gap-1.5">
              {leadData?.empreendimento && <Badge variant="secondary" className="text-[10px] gap-1"><Building2 className="h-2.5 w-2.5" /> {leadData.empreendimento}</Badge>}
              {leadData?.valor_estimado && <Badge variant="outline" className="text-[10px] gap-1"><DollarSign className="h-2.5 w-2.5" /> {fmtPrice(leadData.valor_estimado)}</Badge>}
              {savedProfile && <Badge className="text-[10px] gap-1 bg-emerald-100 text-emerald-700 border-emerald-200"><Check className="h-2.5 w-2.5" /> Perfil salvo</Badge>}
              {favoriteCodes.size > 0 && <Badge variant="outline" className="text-[10px] gap-1"><Heart className="h-2.5 w-2.5 text-red-500" /> {favoriteCodes.size} favoritos</Badge>}
              {sentCodes.size > 0 && <Badge variant="outline" className="text-[10px] gap-1"><Send className="h-2.5 w-2.5 text-blue-500" /> {sentCodes.size} enviados</Badge>}
            </div>
          )}

          {/* Objeções */}
          <Card className="border-amber-200/50 bg-amber-50/30 dark:bg-amber-950/10">
            <CardContent className="p-3">
              <button className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400 w-full" onClick={() => setShowObjecoes(!showObjecoes)}>
                <AlertTriangle className="h-3.5 w-3.5" /> Objeções do Lead
                {activeObjecoes.length > 0 && <Badge className="ml-1 text-[9px] bg-amber-100 text-amber-700 border-amber-200">{activeObjecoes.length}</Badge>}
                {showObjecoes ? <ChevronUp className="h-3 w-3 ml-auto" /> : <ChevronDown className="h-3 w-3 ml-auto" />}
              </button>
              {showObjecoes && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {OBJECOES.map(obj => (
                    <button key={obj.key} onClick={() => toggleObjecao(obj.key)} className={`text-[10px] px-2.5 py-1 rounded-full border transition-colors ${activeObjecoes.includes(obj.key) ? "bg-amber-500 text-white border-amber-500" : "bg-background text-muted-foreground border-border hover:border-amber-300"}`}>
                      {obj.icon} {obj.label}
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick filters */}
          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 w-full justify-start" onClick={() => setShowFilters(!showFilters)}>
            {showFilters ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {showFilters ? "Ocultar filtros rápidos" : "Ajustar filtros rápidos"}
          </Button>

          {showFilters && (
            <Card className="border-primary/20">
              <CardContent className="p-4 space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-[11px] text-muted-foreground">Quartos</Label>
                    <Select value={profileForm.dormitorios_min} onValueChange={(v) => setProfileForm(p => ({ ...p, dormitorios_min: v }))}>
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
                    <Label className="text-[11px] text-muted-foreground">Valor Mín</Label>
                    <Input type="number" className="h-9 text-sm" placeholder="200000" value={profileForm.valor_min} onChange={(e) => setProfileForm(p => ({ ...p, valor_min: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-[11px] text-muted-foreground">Valor Máx</Label>
                    <Input type="number" className="h-9 text-sm" placeholder="500000" value={profileForm.valor_max} onChange={(e) => setProfileForm(p => ({ ...p, valor_max: e.target.value }))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-[11px] text-muted-foreground">Tipologia</Label>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {[{ value: "apartamento", label: "🏢 Apto" }, { value: "casa", label: "🏡 Casa" }, { value: "terreno", label: "🏞️ Terreno" }].map(t => (
                        <button key={t.value} onClick={() => toggleTipologia(t.value)} className={`text-[10px] px-2 py-1 rounded-md border transition-colors ${profileForm.tipos.includes(t.value) ? "bg-primary text-primary-foreground border-primary" : "bg-muted/50 text-muted-foreground border-border hover:border-primary/30"}`}>
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label className="text-[11px] text-muted-foreground">Status</Label>
                    <Select value={profileForm.status_imovel} onValueChange={(v) => setProfileForm(p => ({ ...p, status_imovel: v }))}>
                      <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="qualquer">Qualquer</SelectItem>
                        <SelectItem value="pronto">Pronto</SelectItem>
                        <SelectItem value="obras">Em obras</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground">Bairros</Label>
                  <Input className="h-8 text-xs mt-1 mb-1.5" placeholder="Buscar bairro..." value={bairroSearch} onChange={(e) => setBairroSearch(e.target.value)} />
                  <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                    {filteredBairros.map(b => (
                      <button key={b} onClick={() => toggleBairro(b)} className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${profileForm.bairros.includes(b) ? "bg-primary text-primary-foreground border-primary" : "bg-muted/50 text-muted-foreground border-border hover:border-primary/30"}`}>
                        {b}
                      </button>
                    ))}
                  </div>
                  {profileForm.bairros.length > 0 && <p className="text-[10px] text-primary mt-1">{profileForm.bairros.length} bairro(s)</p>}
                </div>
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

          {/* Search button */}
          <div className="flex gap-2">
            <Button className="flex-1 gap-2" onClick={() => { handleSearch(false); setShowFilters(false); }} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              {searched ? "Atualizar Radar" : "Buscar Imóveis"}
            </Button>
            <Button variant="outline" className="gap-1.5 border-purple-300 text-purple-600 hover:bg-purple-50 dark:border-purple-700 dark:hover:bg-purple-950" onClick={handleAIExpand} disabled={aiExpanding || loading}>
              {aiExpanding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
              IA
            </Button>
          </div>

          {/* Results */}
          {searched && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h5 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5" />
                  {results.length > 0 ? `${results.length} imóveis sugeridos` : "Nenhum resultado"}
                </h5>
                {selectedResults.size > 0 && <Badge variant="secondary" className="text-[10px]">{selectedResults.size} selecionado(s)</Badge>}
              </div>

              {results.length === 0 && !loading && (
                <div className="text-center py-8 text-muted-foreground">
                  <Building2 className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Nenhum imóvel encontrado.</p>
                  <p className="text-xs mt-1">Ajuste os filtros ou use a busca com IA.</p>
                </div>
              )}

              <div className="space-y-2">
                {results.map((item, idx) => {
                  const code = getPropertyCode(item);
                  const isFav = favoriteCodes.has(code);
                  const isSent = sentCodes.has(code);
                  const isDiscarded = discardedCodes.has(code);
                  return (
                    <Card key={idx} className={`overflow-hidden transition-all duration-150 ${selectedResults.has(idx) ? "ring-2 ring-primary border-primary" : isDiscarded ? "opacity-50 border-border/30" : "border-border/50 hover:border-primary/30"}`}>
                      <div className="flex">
                        {item.imagem && (
                          <div className="w-20 h-20 shrink-0 overflow-hidden bg-muted cursor-pointer" onClick={() => toggleSelect(idx)}>
                            <img src={item.imagem} alt="" className="w-full h-full object-cover" loading="lazy" />
                          </div>
                        )}
                        <CardContent className="p-2.5 flex-1 min-w-0" onClick={() => toggleSelect(idx)}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className="text-xs font-bold text-foreground truncate">{item.nome || "Imóvel"}</p>
                                {item.source === "meday" && <Badge className="text-[8px] py-0 px-1 bg-amber-100 text-amber-700 border-amber-200">MeDay</Badge>}
                                {isSent && <Badge className="text-[8px] py-0 px-1 bg-blue-100 text-blue-700 border-blue-200">Enviado</Badge>}
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
                              <div className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${item.score >= 80 ? "bg-emerald-100 text-emerald-700" : item.score >= 60 ? "bg-amber-100 text-amber-700" : item.score >= 40 ? "bg-orange-100 text-orange-600" : "bg-muted text-muted-foreground"}`}>
                                {item.score}%
                              </div>
                            </div>
                          </div>
                          {item.preco > 0 && <p className="text-xs font-bold text-emerald-600 mt-0.5">R$ {item.preco.toLocaleString("pt-BR")}</p>}
                          {item.justificativas.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {item.justificativas.slice(0, 2).map((j, i) => (
                                <span key={i} className="text-[9px] text-primary/80 bg-primary/5 px-1.5 py-0.5 rounded">{j}</span>
                              ))}
                            </div>
                          )}
                        </CardContent>
                        {/* Action buttons */}
                        <div className="flex flex-col items-center justify-center gap-1 pr-2">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button onClick={(e) => handleFavorite(item, e)} className={`p-1 rounded-md transition-colors ${isFav ? "text-red-500 bg-red-50" : "text-muted-foreground hover:text-red-500 hover:bg-red-50"}`}>
                                <Heart className={`h-3.5 w-3.5 ${isFav ? "fill-current" : ""}`} />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="left" className="text-xs">{isFav ? "Remover favorito" : "Favoritar"}</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button onClick={(e) => handleDiscard(item, e)} className="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                                <ThumbsDown className="h-3.5 w-3.5" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="left" className="text-xs">Descartar</TooltipContent>
                          </Tooltip>
                          {selectedResults.has(idx) ? (
                            <Check className="h-3.5 w-3.5 text-primary" />
                          ) : (
                            <div className="h-3.5 w-3.5 rounded border border-border" />
                          )}
                        </div>
                      </div>
                    </Card>
                  );
                })}
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

          {loading && !searched && (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm">Analisando perfil e buscando imóveis...</p>
            </div>
          )}
        </TabsContent>

        {/* ════════ TAB: PERFIL ════════ */}
        <TabsContent value="perfil" className="mt-3 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold flex items-center gap-1.5">
              <Home className="h-4 w-4 text-primary" /> Perfil de Interesse
            </h4>
            <Button size="sm" className="h-7 text-xs gap-1" onClick={handleSaveProfile} disabled={isSavingProfile}>
              {isSavingProfile ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
              Salvar Perfil
            </Button>
          </div>

          {/* Objetivo */}
          <div>
            <Label className="text-[11px] text-muted-foreground">Objetivo</Label>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {["Moradia", "Investimento", "Troca", "Locação"].map(obj => (
                <button key={obj} onClick={() => setProfileForm(p => ({ ...p, objetivo: p.objetivo.includes(obj) ? p.objetivo.filter(o => o !== obj) : [...p.objetivo, obj] }))}
                  className={`text-[10px] px-2.5 py-1 rounded-full border transition-colors ${profileForm.objetivo.includes(obj) ? "bg-primary text-primary-foreground border-primary" : "bg-muted/50 text-muted-foreground border-border hover:border-primary/30"}`}>
                  {obj}
                </button>
              ))}
            </div>
          </div>

          {/* Valores */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-[11px] text-muted-foreground">Valor Mín</Label>
              <Input type="number" className="h-9 text-sm" value={profileForm.valor_min} onChange={e => setProfileForm(p => ({ ...p, valor_min: e.target.value }))} placeholder="200.000" />
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">Valor Ideal</Label>
              <Input type="number" className="h-9 text-sm" value={profileForm.valor_max} onChange={e => setProfileForm(p => ({ ...p, valor_max: e.target.value }))} placeholder="500.000" />
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">Dorms Mín</Label>
              <Select value={profileForm.dormitorios_min} onValueChange={v => setProfileForm(p => ({ ...p, dormitorios_min: v }))}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="-" /></SelectTrigger>
                <SelectContent>
                  {["1", "2", "3", "4"].map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-[11px] text-muted-foreground">Suítes Mín</Label>
              <Select value={profileForm.suites_min} onValueChange={v => setProfileForm(p => ({ ...p, suites_min: v }))}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="-" /></SelectTrigger>
                <SelectContent>
                  {["1", "2", "3", "4"].map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">Vagas Mín</Label>
              <Select value={profileForm.vagas_min} onValueChange={v => setProfileForm(p => ({ ...p, vagas_min: v }))}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="-" /></SelectTrigger>
                <SelectContent>
                  {["1", "2", "3"].map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">Área (m²)</Label>
              <div className="flex gap-1">
                <Input type="number" className="h-9 text-sm" placeholder="Mín" value={profileForm.area_min} onChange={e => setProfileForm(p => ({ ...p, area_min: e.target.value }))} />
                <Input type="number" className="h-9 text-sm" placeholder="Máx" value={profileForm.area_max} onChange={e => setProfileForm(p => ({ ...p, area_max: e.target.value }))} />
              </div>
            </div>
          </div>

          {/* Tipologia */}
          <div>
            <Label className="text-[11px] text-muted-foreground">Tipologia</Label>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {[{ value: "apartamento", label: "🏢 Apartamento" }, { value: "casa", label: "🏡 Casa" }, { value: "terreno", label: "🏞️ Terreno" }, { value: "comercial", label: "🏪 Comercial" }].map(t => (
                <button key={t.value} onClick={() => toggleTipologia(t.value)}
                  className={`text-[10px] px-2.5 py-1 rounded-full border transition-colors ${profileForm.tipos.includes(t.value) ? "bg-primary text-primary-foreground border-primary" : "bg-muted/50 text-muted-foreground border-border hover:border-primary/30"}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Bairros */}
          <div>
            <Label className="text-[11px] text-muted-foreground">Bairros de Interesse</Label>
            <Input className="h-8 text-xs mt-1 mb-1.5" placeholder="Buscar bairro..." value={bairroSearch} onChange={e => setBairroSearch(e.target.value)} />
            <div className="flex flex-wrap gap-1 max-h-28 overflow-y-auto">
              {filteredBairros.map(b => (
                <button key={b} onClick={() => toggleBairro(b)} className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${profileForm.bairros.includes(b) ? "bg-primary text-primary-foreground border-primary" : "bg-muted/50 text-muted-foreground border-border hover:border-primary/30"}`}>
                  {b}
                </button>
              ))}
            </div>
            {profileForm.bairros.length > 0 && <p className="text-[10px] text-primary mt-1">{profileForm.bairros.join(", ")}</p>}
          </div>

          {/* Itens obrigatórios */}
          <div>
            <Label className="text-[11px] text-muted-foreground">Itens Obrigatórios</Label>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {ITENS_POSSIVEIS.map(item => (
                <button key={item} onClick={() => setProfileForm(p => ({ ...p, itens_obrigatorios: p.itens_obrigatorios.includes(item) ? p.itens_obrigatorios.filter(i => i !== item) : [...p.itens_obrigatorios, item] }))}
                  className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${profileForm.itens_obrigatorios.includes(item) ? "bg-emerald-500 text-white border-emerald-500" : "bg-muted/50 text-muted-foreground border-border hover:border-emerald-300"}`}>
                  {item}
                </button>
              ))}
            </div>
          </div>

          {/* Itens desejáveis */}
          <div>
            <Label className="text-[11px] text-muted-foreground">Itens Desejáveis</Label>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {ITENS_POSSIVEIS.filter(i => !profileForm.itens_obrigatorios.includes(i)).map(item => (
                <button key={item} onClick={() => setProfileForm(p => ({ ...p, itens_desejaveis: p.itens_desejaveis.includes(item) ? p.itens_desejaveis.filter(i => i !== item) : [...p.itens_desejaveis, item] }))}
                  className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${profileForm.itens_desejaveis.includes(item) ? "bg-blue-500 text-white border-blue-500" : "bg-muted/50 text-muted-foreground border-border hover:border-blue-300"}`}>
                  {item}
                </button>
              ))}
            </div>
          </div>

          {/* Rejeições */}
          <div>
            <Label className="text-[11px] text-muted-foreground">Rejeições (bairros, empreendimentos, itens que o cliente NÃO quer)</Label>
            <div className="flex gap-1.5 mt-1">
              <Input className="h-8 text-xs flex-1" placeholder="Ex: Canoas, studio..." value={newRejeicao} onChange={e => setNewRejeicao(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && newRejeicao.trim()) { setProfileForm(p => ({ ...p, rejeicoes: [...p.rejeicoes, newRejeicao.trim()] })); setNewRejeicao(""); } }} />
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => { if (newRejeicao.trim()) { setProfileForm(p => ({ ...p, rejeicoes: [...p.rejeicoes, newRejeicao.trim()] })); setNewRejeicao(""); } }}>+</Button>
            </div>
            {profileForm.rejeicoes.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {profileForm.rejeicoes.map((r, i) => (
                  <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200 flex items-center gap-1">
                    {r}
                    <button onClick={() => setProfileForm(p => ({ ...p, rejeicoes: p.rejeicoes.filter((_, idx) => idx !== i) }))} className="hover:text-red-900">
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Momento + Urgência */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-[11px] text-muted-foreground">Momento de Compra</Label>
              <Select value={profileForm.momento_compra} onValueChange={v => setProfileForm(p => ({ ...p, momento_compra: v }))}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="imediato">Imediato</SelectItem>
                  <SelectItem value="30_dias">Até 30 dias</SelectItem>
                  <SelectItem value="90_dias">Até 90 dias</SelectItem>
                  <SelectItem value="6_meses">6 meses</SelectItem>
                  <SelectItem value="indefinido">Indefinido</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">Urgência</Label>
              <Select value={profileForm.urgencia} onValueChange={v => setProfileForm(p => ({ ...p, urgencia: v }))}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="alta">🔴 Alta</SelectItem>
                  <SelectItem value="media">🟡 Média</SelectItem>
                  <SelectItem value="baixa">🟢 Baixa</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Financiamento + Troca */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Switch checked={profileForm.aceita_financiamento || false} onCheckedChange={v => setProfileForm(p => ({ ...p, aceita_financiamento: v }))} />
              <Label className="text-xs">Aceita financiamento</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={profileForm.possui_imovel_troca} onCheckedChange={v => setProfileForm(p => ({ ...p, possui_imovel_troca: v }))} />
              <Label className="text-xs">Tem imóvel p/ troca</Label>
            </div>
          </div>

          {/* Observações */}
          <div>
            <Label className="text-[11px] text-muted-foreground">Observações do Corretor</Label>
            <textarea
              className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              rows={3}
              placeholder="Preferências, detalhes de conversa, restrições..."
              value={profileForm.observacoes}
              onChange={e => setProfileForm(p => ({ ...p, observacoes: e.target.value }))}
            />
          </div>

          <Button className="w-full gap-2" onClick={handleSaveProfile} disabled={isSavingProfile}>
            {isSavingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar Perfil Completo
          </Button>
        </TabsContent>

        {/* ════════ TAB: HISTÓRICO ════════ */}
        <TabsContent value="historico" className="mt-3 space-y-4">
          <h4 className="text-sm font-bold flex items-center gap-1.5">
            <History className="h-4 w-4 text-primary" /> Histórico de Buscas
          </h4>

          {isLoadingHistory ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : searchHistory.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Search className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nenhuma busca registrada ainda.</p>
              <p className="text-xs mt-1">Use o Radar para buscar imóveis e salvar o histórico.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {searchHistory.map(search => {
                const filters = (search.filters || {}) as Record<string, any>;
                const codes = search.result_codes || [];
                return (
                  <Card key={search.id} className="border-border/50">
                    <CardContent className="p-3 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Clock className="h-2.5 w-2.5" />
                          {search.created_at ? formatDistanceToNow(new Date(search.created_at), { addSuffix: true, locale: ptBR }) : "—"}
                        </span>
                        <Badge variant="secondary" className="text-[9px]">{search.total_results || codes.length} resultados</Badge>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {filters.valor_max && <Badge variant="outline" className="text-[9px]">Até {fmtPrice(filters.valor_max)}</Badge>}
                        {filters.dormitorios_min && <Badge variant="outline" className="text-[9px]">{filters.dormitorios_min}+ dorms</Badge>}
                        {(filters.bairros || []).length > 0 && <Badge variant="outline" className="text-[9px]">{(filters.bairros as string[]).slice(0, 2).join(", ")}{(filters.bairros as string[]).length > 2 ? ` +${(filters.bairros as string[]).length - 2}` : ""}</Badge>}
                        {(filters.tipos || []).length > 0 && <Badge variant="outline" className="text-[9px]">{(filters.tipos as string[]).join(", ")}</Badge>}
                        {(filters.objecoes || []).length > 0 && <Badge className="text-[9px] bg-amber-100 text-amber-700 border-amber-200">{(filters.objecoes as string[]).length} objeções</Badge>}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Interaction summary */}
          {(favoriteCodes.size > 0 || sentCodes.size > 0 || discardedCodes.size > 0) && (
            <div className="pt-4 border-t border-border/50 space-y-2">
              <h5 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Resumo de Interações</h5>
              <div className="grid grid-cols-3 gap-2">
                <div className="text-center p-2 rounded-lg bg-red-50 dark:bg-red-950/20">
                  <Heart className="h-4 w-4 text-red-500 mx-auto mb-1" />
                  <p className="text-lg font-bold text-red-600">{favoriteCodes.size}</p>
                  <p className="text-[10px] text-muted-foreground">Favoritos</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-blue-50 dark:bg-blue-950/20">
                  <Send className="h-4 w-4 text-blue-500 mx-auto mb-1" />
                  <p className="text-lg font-bold text-blue-600">{sentCodes.size}</p>
                  <p className="text-[10px] text-muted-foreground">Enviados</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-muted/50">
                  <ThumbsDown className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
                  <p className="text-lg font-bold text-muted-foreground">{discardedCodes.size}</p>
                  <p className="text-[10px] text-muted-foreground">Descartados</p>
                </div>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
