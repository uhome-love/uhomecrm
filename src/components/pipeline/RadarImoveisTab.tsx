import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Radar, Search, Building2, MapPin, DollarSign,
  Copy, ExternalLink, Loader2, Sparkles, Home, Send, Check,
  Brain, AlertTriangle, Star, Eye, ChevronDown, ChevronUp,
  MessageSquare, Bed, Car, Maximize2, RefreshCw,
  Heart, HeartOff, X, Clock, History, Save, ThumbsDown, Wand2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { supabaseSite } from "@/lib/supabaseSite";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useBrokerSlug } from "@/hooks/useBrokerSlug";
import { getVitrinePublicUrl } from "@/lib/vitrineUrl";
import { useTypesenseSearch } from "@/hooks/useTypesenseSearch";
import { useLeadPropertyProfile } from "@/hooks/useLeadPropertyProfile";
import { useLeadPropertySearch } from "@/hooks/useLeadPropertySearch";
import { useLeadImoveisEvents } from "@/hooks/useLeadImoveisEvents";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import LeadMatchesWidget from "./LeadMatchesWidget";
import RadarFullscreenModal from "./radar/RadarFullscreenModal";

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
   EMPREENDIMENTO INFERENCE MAP
   ═══════════════════════════════════════════ */

const EMPREENDIMENTO_INFER: Record<string, { bairros: string[]; tipos: string[]; valor_min: number; valor_max: number }> = {
  "orygem": { bairros: ["Teresópolis"], tipos: ["casa"], valor_min: 800000, valor_max: 1200000 },
  "connect": { bairros: ["Passo d'Areia"], tipos: ["apartamento"], valor_min: 300000, valor_max: 600000 },
  "connect jw": { bairros: ["Passo d'Areia"], tipos: ["apartamento"], valor_min: 300000, valor_max: 600000 },
  "high garden": { bairros: ["Rio Branco", "Boa Vista"], tipos: ["apartamento"], valor_min: 1200000, valor_max: 2500000 },
  "high garden rio branco": { bairros: ["Rio Branco"], tipos: ["apartamento"], valor_min: 1400000, valor_max: 2000000 },
  "high garden iguatemi": { bairros: ["Boa Vista"], tipos: ["apartamento"], valor_min: 1000000, valor_max: 1500000 },
  "seen": { bairros: ["Três Figueiras", "Menino Deus"], tipos: ["apartamento"], valor_min: 1200000, valor_max: 2000000 },
  "seen tres figueiras": { bairros: ["Três Figueiras"], tipos: ["apartamento"], valor_min: 1400000, valor_max: 2000000 },
  "seen menino deus": { bairros: ["Menino Deus"], tipos: ["apartamento"], valor_min: 1100000, valor_max: 1600000 },
  "casa bastian": { bairros: ["Três Figueiras"], tipos: ["casa"], valor_min: 3000000, valor_max: 6000000 },
  "casa moinhos": { bairros: ["Moinhos de Vento"], tipos: ["apartamento"], valor_min: 4000000, valor_max: 8000000 },
  "monjardin": { bairros: ["Petrópolis"], tipos: ["apartamento"], valor_min: 800000, valor_max: 1500000 },
  "lake eyre": { bairros: ["Cristal"], tipos: ["apartamento"], valor_min: 600000, valor_max: 1200000 },
  "open major": { bairros: ["Marechal Rondon"], tipos: ["apartamento"], valor_min: 200000, valor_max: 350000 },
  "open alto ipiranga": { bairros: ["Jardim Carvalho"], tipos: ["apartamento"], valor_min: 200000, valor_max: 350000 },
  "open bosque": { bairros: ["Passo d'Areia"], tipos: ["apartamento"], valor_min: 200000, valor_max: 350000 },
  "go cidade baixa": { bairros: ["Cidade Baixa"], tipos: ["apartamento"], valor_min: 250000, valor_max: 450000 },
  "go rio branco": { bairros: ["Rio Branco"], tipos: ["apartamento"], valor_min: 350000, valor_max: 550000 },
  "nilo square": { bairros: ["Boa Vista"], tipos: ["apartamento"], valor_min: 2000000, valor_max: 3500000 },
  "arte country": { bairros: ["Bela Vista"], tipos: ["apartamento"], valor_min: 3000000, valor_max: 5000000 },
  "supreme": { bairros: ["Jardim do Salso"], tipos: ["apartamento"], valor_min: 400000, valor_max: 600000 },
  "grand park": { bairros: ["São Sebastião"], tipos: ["apartamento"], valor_min: 400000, valor_max: 600000 },
};

/**
 * Try to infer profile from lead's empreendimento name
 */
function inferFromEmpreendimento(emp: string): { bairros: string[]; tipos: string[]; valor_min: number; valor_max: number } | null {
  const nEmp = normalize(emp);
  // Try exact match first, then partial
  for (const [key, val] of Object.entries(EMPREENDIMENTO_INFER)) {
    if (nEmp.includes(normalize(key)) || normalize(key).includes(nEmp)) return val;
  }
  return null;
}

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

  if (discardedCodes?.has(code)) {
    return { score: 0, justificativas: ["❌ Descartado anteriormente"] };
  }

  // Track how many criteria were actually evaluated (only count if filter is set)
  let maxPossible = 0;

  // ── Valor (25 pts) — only score if filter is set ──
  if ((profile.valor_min || profile.valor_max) && imovel.preco > 0) {
    maxPossible += 25;
    const aboveMin = !profile.valor_min || imovel.preco >= profile.valor_min;
    const belowMax = !profile.valor_max || imovel.preco <= profile.valor_max;
    if (aboveMin && belowMax) {
      score += 25;
      justificativas.push("💰 Dentro da faixa de valor");
    } else if (!profile.valor_max || imovel.preco <= profile.valor_max * 1.15) {
      score += 10;
      justificativas.push("💰 Próximo da faixa (até 15% acima)");
    }
  }

  // ── Bairro (25 pts) — only score if filter is set ──
  if (profile.bairros.length > 0 && imovel.bairro) {
    maxPossible += 25;
    const nb = normalize(imovel.bairro);
    if (profile.bairros.some(b => nb.includes(normalize(b)) || normalize(b).includes(nb))) {
      score += 25;
      justificativas.push(`📍 ${imovel.bairro} — região de interesse`);
    }
  }

  // ── Dormitórios (15 pts) — only score if filter is set ──
  if (profile.dormitorios_min && imovel.dorms > 0) {
    maxPossible += 15;
    if (imovel.dorms >= profile.dormitorios_min) {
      score += 15;
      justificativas.push(`🛏️ ${imovel.dorms} dorms — atende`);
    } else if (imovel.dorms === profile.dormitorios_min - 1) {
      score += 7;
      justificativas.push(`🛏️ ${imovel.dorms} dorms — próximo`);
    }
  }

  // ── Tipologia (15 pts) — only score if filter is set ──
  if (profile.tipos.length > 0 && imovel.tipo) {
    maxPossible += 15;
    if (profile.tipos.some(t => normalize(imovel.tipo || "").includes(normalize(t)))) {
      score += 15;
      justificativas.push("✅ Tipologia compatível");
    }
  }

  // ── Área (10 pts) — only score if filter is set ──
  if ((profile.area_min || profile.area_max) && imovel.metragem && imovel.metragem > 0) {
    maxPossible += 10;
    const inMin = !profile.area_min || imovel.metragem >= profile.area_min * 0.9;
    const inMax = !profile.area_max || imovel.metragem <= profile.area_max * 1.1;
    if (inMin && inMax) {
      score += 10;
      justificativas.push(`📐 ${imovel.metragem}m² — dentro da faixa`);
    }
  }

  // ── Suítes (5 pts) ──
  if (profile.suites_min && (imovel.suites || 0) >= profile.suites_min) {
    maxPossible += 5;
    score += 5;
    justificativas.push(`🛁 ${imovel.suites} suíte(s)`);
  } else if (profile.suites_min) {
    maxPossible += 5;
  }

  // ── Vagas (5 pts) ──
  if (profile.vagas_min && (imovel.vagas || 0) >= profile.vagas_min) {
    maxPossible += 5;
    score += 5;
    justificativas.push(`🚗 ${imovel.vagas} vaga(s)`);
  } else if (profile.vagas_min) {
    maxPossible += 5;
  }

  // ── Status (5 pts) ──
  if (profile.status_imovel && imovel.status) {
    maxPossible += 5;
    const ns = normalize(imovel.status);
    const nf = normalize(profile.status_imovel);
    if (nf === "pronto" && ns.includes("pronto")) { score += 5; justificativas.push("🏠 Pronto para morar"); }
    else if (nf === "obras" && (ns.includes("obra") || ns.includes("lancamento"))) { score += 5; justificativas.push("🏗️ Em obras/Lançamento"); }
  }

  // ── Empreendimento match bonus (20 pts) ──
  if (leadEmp && (imovel.empreendimento || imovel.nome)) {
    maxPossible += 20;
    const nEmp = normalize(leadEmp);
    const nImovelEmp = normalize(imovel.empreendimento || "");
    const nImovelNome = normalize(imovel.nome || "");
    if (nImovelEmp.includes(nEmp) || nImovelNome.includes(nEmp) || nEmp.includes(nImovelEmp)) {
      score += 20;
      justificativas.push("⭐ Mesmo empreendimento de interesse");
    } else {
      // Check condominio_nome similarity via partial match
      const nCond = normalize((imovel as any).condominio_nome || "");
      if (nCond && (nCond.includes(nEmp) || nEmp.includes(nCond))) {
        score += 20;
        justificativas.push("⭐ Mesmo condomínio de interesse");
      }
    }
  }

  // ── Rejeições penalty ──
  for (const rej of profile.rejeicoes) {
    const nRej = normalize(rej);
    if (normalize(imovel.bairro).includes(nRej) || normalize(imovel.nome || "").includes(nRej)) {
      score -= 20;
      justificativas.push(`⚠️ Rejeição: ${rej}`);
    }
  }

  // ── Objeções bonuses ──
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

  // Calculate percentage based on actual max possible (not a fixed denominator)
  // If no criteria were set but we have an empreendimento match, give a base score
  if (maxPossible === 0) {
    // If we got bonus points from empreendimento or objeções, normalize them
    if (score > 0) {
      const pct = Math.min(Math.max(score, 30), 99);
      return { score: pct, justificativas };
    }
    return { score: 15, justificativas: ["⚙️ Perfil incompleto — use IA Perfil"] };
  }
  const pct = Math.min(Math.max(Math.round((score / maxPossible) * 100), 0), 99);
  return { score: pct, justificativas };
}

/* ═══════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════ */

export default function RadarImoveisTab({ leadId, leadNome, leadTelefone, leadData, currentProfile, onUpdate }: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const slugRef = useBrokerSlug();
  const { search: typesenseSearch } = useTypesenseSearch();
  const [creatingVitrine, setCreatingVitrine] = useState(false);
  const [radarOpen, setRadarOpen] = useState(false);

  // ── New hooks ──
  const { profile: savedProfile, upsertProfile, isSaving: isSavingProfile } = useLeadPropertyProfile(leadId);
  const {
    searchHistory, favoriteCodes, sentCodes, discardedCodes,
    saveSearch, trackInteraction, isLoadingHistory,
  } = useLeadPropertySearch(leadId);
  const { data: siteEvents } = useLeadImoveisEvents(leadId);

  // ── Histórico radar (vitrine/match/envio) ──
  const { data: radarHistory = [] } = useQuery({
    queryKey: ["radar-history", leadId],
    queryFn: async () => {
      const { data } = await supabase
        .from("pipeline_atividades")
        .select("id, titulo, tipo, created_at")
        .eq("pipeline_lead_id", leadId)
        .in("tipo", ["vitrine", "match", "envio_imovel", "radar"])
        .order("created_at", { ascending: false })
        .limit(5);
      return data || [];
    },
    enabled: !!leadId,
  });

  // ── Tab state ──
  const [subTab, setSubTab] = useState<"radar" | "matches" | "perfil" | "historico">("radar");
  const [aiAnalyzing, setAiAnalyzing] = useState(false);

  // ── Profile form state (initialized from savedProfile or legacy fields) ──
  const [profileForm, setProfileForm] = useState({
    objetivo: [] as string[],
    valor_min: "",
    valor_max: "",
    bairros: [] as string[],
    tipos: [] as string[],
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
        tipos: savedProfile.tipos || [],
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
          return [];
        })(),
        status_imovel: currentProfile.radar_status_imovel || "qualquer",
      }));
    } else if (leadData?.empreendimento) {
      // Auto-fill from empreendimento inference when no saved profile exists
      const inferred = inferFromEmpreendimento(leadData.empreendimento);
      if (inferred) {
        setProfileForm(prev => ({
          ...prev,
          bairros: prev.bairros.length > 0 ? prev.bairros : inferred.bairros,
          tipos: prev.tipos.length > 0 ? prev.tipos : inferred.tipos,
          valor_min: prev.valor_min || String(inferred.valor_min),
          valor_max: prev.valor_max || String(inferred.valor_max),
        }));
        console.log("[Match] Auto-inferred profile from empreendimento:", leadData.empreendimento, inferred);
      }
    }
  }, [savedProfile, currentProfile, leadData?.valor_estimado]);

  // ── Results state ──
  const [results, setResults] = useState<ImovelResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [selectedResults, setSelectedResults] = useState<Set<number>>(new Set());
  const [showAllResults, setShowAllResults] = useState(false);
  const [aiExpanding, setAiExpanding] = useState(false);
  const [useMeDay, setUseMeDay] = useState(false);
  const [useTypesense, setUseTypesense] = useState(true);
  const [activeObjecoes, setActiveObjecoes] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [showObjecoes, setShowObjecoes] = useState(false);
  const [bairroSearch, setBairroSearch] = useState("");
  const [newRejeicao, setNewRejeicao] = useState("");
  const [bairroSuggestions, setBairroSuggestions] = useState<string[]>([]);
  const [showBairroDropdown, setShowBairroDropdown] = useState(false);
  const bairroInputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toggleBairro = (b: string) => setProfileForm(prev => ({ ...prev, bairros: prev.bairros.includes(b) ? prev.bairros.filter(x => x !== b) : [...prev.bairros, b] }));
  const toggleTipologia = (t: string) => setProfileForm(prev => ({ ...prev, tipos: prev.tipos.includes(t) ? prev.tipos.filter(x => x !== t) : [...prev.tipos, t] }));
  const filteredBairros = BAIRROS_POA.filter(b => !bairroSearch || normalize(b).includes(normalize(bairroSearch)));
  const toggleObjecao = (key: string) => setActiveObjecoes(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);

  // Bairro autocomplete from DB
  useEffect(() => {
    if (bairroSearch.length < 3) { setBairroSuggestions([]); setShowBairroDropdown(false); return; }
    const timer = setTimeout(async () => {
      const { data } = await supabaseSite
        .from("imoveis")
        .select("bairro")
        .ilike("bairro", `%${bairroSearch}%`)
        .eq("status", "disponivel")
        .limit(20);
      const seen = new Set<string>();
      const unique: string[] = [];
      for (const d of (data || [])) {
        const b = String((d as any).bairro || "");
        if (b && !seen.has(b) && !profileForm.bairros.includes(b)) { seen.add(b); unique.push(b); }
        if (unique.length >= 10) break;
      }
      setBairroSuggestions(unique);
      setShowBairroDropdown(unique.length > 0);
    }, 300);
    return () => clearTimeout(timer);
  }, [bairroSearch, profileForm.bairros]);

  // Debounced auto-search when filters change
  const hasSearchedOnce = useRef(false);
  useEffect(() => {
    if (!hasSearchedOnce.current) return; // Don't auto-search before first manual search
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      handleSearch(false);
    }, 800);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [profileForm.valor_min, profileForm.valor_max, profileForm.area_min, profileForm.dormitorios_min, profileForm.tipos, profileForm.bairros]);

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
      // Log profile update as activity
      try {
        const parts: string[] = [];
        if (profileForm.tipos.length) parts.push(`Tipo: ${profileForm.tipos.join(", ")}`);
        if (profileForm.bairros.length) parts.push(`Bairros: ${profileForm.bairros.join(", ")}`);
        if (profileForm.valor_min || profileForm.valor_max) parts.push(`Preço: ${profileForm.valor_min || "0"}-${profileForm.valor_max || "∞"}`);
        if (profileForm.dormitorios_min) parts.push(`Dorms: ${profileForm.dormitorios_min}+`);
        await supabase.from("pipeline_atividades").insert({
          pipeline_lead_id: leadId,
          tipo: "match",
          titulo: "Perfil de busca atualizado",
          descricao: parts.join(" · ") || "Perfil atualizado",
          created_by: user?.id || null,
        });
      } catch {}
      toast.success("Perfil salvo!");
    } catch (err) {
      toast.error("Erro ao salvar perfil");
    }
  }, [leadId, profileForm, upsertProfile, onUpdate]);

  // ── Compute site behavior insights ──
  const siteInsights = useMemo(() => {
    if (!siteEvents || siteEvents.length === 0) return null;
    const viewedCodes = new Set<string>();
    const favCodes = new Set<string>();
    const searchQueries: string[] = [];
    const viewedBairros: Record<string, number> = {};
    const viewedPrecos: number[] = [];

    for (const ev of siteEvents) {
      if (ev.event_type === "site_view" && ev.imovel_codigo) {
        viewedCodes.add(ev.imovel_codigo);
        const payload = ev.payload || {};
        if (payload.bairro) viewedBairros[payload.bairro] = (viewedBairros[payload.bairro] || 0) + 1;
        if (payload.preco && Number(payload.preco) > 0) viewedPrecos.push(Number(payload.preco));
      }
      if (ev.event_type === "favoritou" && ev.imovel_codigo) favCodes.add(ev.imovel_codigo);
      if (ev.event_type === "buscou_ia" && ev.search_query) searchQueries.push(ev.search_query);
    }

    const topBairros = Object.entries(viewedBairros).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([b]) => b);
    const avgPreco = viewedPrecos.length > 0 ? viewedPrecos.reduce((a, b) => a + b, 0) / viewedPrecos.length : null;

    return { viewedCodes, favCodes, searchQueries, topBairros, avgPreco, totalViews: viewedCodes.size };
  }, [siteEvents]);

  // ── AI Auto-Fill Profile ──
  const handleAIAnalyze = useCallback(async () => {
    setAiAnalyzing(true);
    try {
      const contextParts: string[] = [];
      if (leadData?.observacoes) contextParts.push(`Observações do lead: ${leadData.observacoes}`);
      if (leadData?.empreendimento) contextParts.push(`Empreendimento de interesse: ${leadData.empreendimento}`);
      if (leadData?.valor_estimado) contextParts.push(`Valor estimado: R$ ${leadData.valor_estimado.toLocaleString("pt-BR")}`);
      if (leadData?.campanha) contextParts.push(`Campanha: ${leadData.campanha}`);
      if (leadData?.origem) contextParts.push(`Origem: ${leadData.origem}`);
      if (siteInsights) {
        if (siteInsights.topBairros.length > 0) contextParts.push(`Bairros mais visualizados no site: ${siteInsights.topBairros.join(", ")}`);
        if (siteInsights.avgPreco) contextParts.push(`Faixa de preço média dos imóveis visualizados: R$ ${Math.round(siteInsights.avgPreco).toLocaleString("pt-BR")}`);
        if (siteInsights.searchQueries.length > 0) contextParts.push(`Buscas realizadas no site: ${siteInsights.searchQueries.slice(0, 5).join("; ")}`);
        contextParts.push(`Total de imóveis visualizados no site: ${siteInsights.totalViews}`);
      }

      if (contextParts.length === 0) {
        toast.error("Sem dados suficientes para análise. Adicione observações ao lead.");
        return;
      }

      const prompt = `Analise os seguintes dados de um lead imobiliário e extraia o perfil de interesse do cliente para busca de imóveis. Retorne APENAS um JSON válido com os campos:
{
  "valor_min": number ou null,
  "valor_max": number ou null,
  "bairros": ["lista de bairros"],
  "tipos": ["apartamento", "casa", "terreno"],
  "dormitorios_min": number ou null,
  "suites_min": number ou null,
  "vagas_min": number ou null,
  "area_min": number ou null,
  "area_max": number ou null,
  "status_imovel": "qualquer" | "pronto" | "obras",
  "objetivo": ["Moradia", "Investimento", "Troca", "Locação"],
  "momento_compra": "imediato" | "30_dias" | "90_dias" | "6_meses" | "indefinido" | "",
  "urgencia": "alta" | "media" | "baixa" | "",
  "observacoes_ia": "resumo curto das preferências extraídas"
}

IMPORTANTE: Se o lead veio de um empreendimento específico, infira o tipo do imóvel baseado no nome:
- "Orygem" = casa em condomínio, bairro Teresópolis, Porto Alegre, valor 800k-1M
- Empreendimentos com "Casa", "Villa", "Village", "Park", "Garden" (isolado) geralmente = casa
- Empreendimentos com "Tower", "Heights", "Residencial", "Open", "GO", "Supreme" geralmente = apartamento
Se não conseguir inferir com certeza, deixe tipos: [] (busca todos os tipos).

Dados do lead "${leadNome}":
${contextParts.join("\n")}

Responda SOMENTE com o JSON, sem markdown.`;

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/uhome-ia-core`;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: [{ role: "user", content: prompt }],
          role: "corretor",
          module: "match_imoveis",
        }),
      });

      if (!resp.ok) throw new Error("AI request failed");

      // Parse SSE stream
      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let result = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) result += content;
          } catch {}
        }
      }

      // Parse the JSON from AI response
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("Invalid AI response");
      const aiProfile = JSON.parse(jsonMatch[0]);

      // Apply AI-extracted profile to form
      setProfileForm(prev => ({
        ...prev,
        valor_min: aiProfile.valor_min ? String(aiProfile.valor_min) : prev.valor_min,
        valor_max: aiProfile.valor_max ? String(aiProfile.valor_max) : prev.valor_max,
        bairros: aiProfile.bairros?.length > 0 ? aiProfile.bairros : prev.bairros,
        tipos: aiProfile.tipos?.length > 0 ? aiProfile.tipos : prev.tipos,
        dormitorios_min: aiProfile.dormitorios_min ? String(aiProfile.dormitorios_min) : prev.dormitorios_min,
        suites_min: aiProfile.suites_min ? String(aiProfile.suites_min) : prev.suites_min,
        vagas_min: aiProfile.vagas_min ? String(aiProfile.vagas_min) : prev.vagas_min,
        area_min: aiProfile.area_min ? String(aiProfile.area_min) : prev.area_min,
        area_max: aiProfile.area_max ? String(aiProfile.area_max) : prev.area_max,
        status_imovel: aiProfile.status_imovel || prev.status_imovel,
        objetivo: aiProfile.objetivo?.length > 0 ? aiProfile.objetivo : prev.objetivo,
        momento_compra: aiProfile.momento_compra || prev.momento_compra,
        urgencia: aiProfile.urgencia || prev.urgencia,
        observacoes: aiProfile.observacoes_ia
          ? (prev.observacoes ? `${prev.observacoes}\n\n🤖 IA: ${aiProfile.observacoes_ia}` : `🤖 IA: ${aiProfile.observacoes_ia}`)
          : prev.observacoes,
      }));

      toast.success("🧠 Perfil preenchido pela IA! Revise e busque.");
    } catch (err) {
      console.error("AI analyze error:", err);
      toast.error("Erro ao analisar com IA");
    } finally {
      setAiAnalyzing(false);
    }
  }, [leadNome, leadData, siteInsights]);

  // ── Typesense search with broadening fallback ──
  const buildTypesenseFilters = useCallback((broaden = false): string => {
    const filterParts: string[] = ["valor_venda:>0"];
    if (profileForm.bairros.length === 1) filterParts.push(`bairro:=\`${profileForm.bairros[0]}\``);
    else if (profileForm.bairros.length > 1) filterParts.push(`bairro:[\`${profileForm.bairros.join("`,`")}\`]`);
    if (profileForm.valor_min) filterParts.push(`valor_venda:>=${parseFloat(profileForm.valor_min) * (broaden ? 0.7 : 0.85)}`);
    if (profileForm.valor_max) filterParts.push(`valor_venda:<=${parseFloat(profileForm.valor_max) * (broaden ? 1.4 : 1.2)}`);
    if (!broaden && profileForm.dormitorios_min) {
      const q = parseInt(profileForm.dormitorios_min);
      if (q >= 4) filterParts.push(`dormitorios:>=${q}`);
      else filterParts.push(`dormitorios:[${Math.max(1, q - 1)},${q},${q + 1}]`);
    }
    const validTipos = profileForm.tipos.filter(t => t && t !== "qualquer");
    if (validTipos.length > 0) {
      if (validTipos.length === 1) filterParts.push(`tipo:=${validTipos[0]}`);
      else filterParts.push(`tipo:[${validTipos.join(",")}]`);
    }
    if (!broaden) {
      if (profileForm.status_imovel === "pronto") filterParts.push(`em_obras:=false`);
      else if (profileForm.status_imovel === "obras") filterParts.push(`em_obras:=true`);
    }
    if (profileForm.area_min && !broaden) filterParts.push(`area_privativa:>=${parseInt(profileForm.area_min) * 0.8}`);
    if (profileForm.area_max && !broaden) filterParts.push(`area_privativa:<=${parseInt(profileForm.area_max) * 1.2}`);
    return filterParts.join(" && ");
  }, [profileForm]);

  const parseTypesenseResults = (data: any[]): ImovelResult[] =>
    data.map((doc: any) => ({
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

  // ── Supabase direct fallback when Typesense is empty ──
  const searchSupabaseFallback = useCallback(async (): Promise<ImovelResult[]> => {
    try {
      console.log("[Match] Typesense vazio — usando fallback supabaseSite (imoveis)");
      let query = supabaseSite
        .from("imoveis")
        .select("id, jetimob_id, titulo, tipo, bairro, preco, quartos, suites, vagas, area_total, condominio_nome, fotos, foto_principal, slug")
        .eq("status", "disponivel")
        .gt("preco", 0)
        .order("updated_at", { ascending: false })
        .limit(50);

      const validTipos = profileForm.tipos.filter(t => t && t !== "qualquer");
      if (validTipos.length > 0) query = query.in("tipo", validTipos);
      
      if (profileForm.bairros.length > 0) {
        query = query.in("bairro", profileForm.bairros);
      } else if (leadData?.empreendimento) {
        const empNome = leadData.empreendimento
          .replace(/\s+JW$/i, '')
          .replace(/\s+João\s+Wallig$/i, '')
          .trim();
        if (empNome.length >= 3) {
          console.log("[Match] Sem bairro — buscando por empreendimento:", empNome);
          query = query.or(`condominio_nome.ilike.%${empNome}%,titulo.ilike.%${empNome}%`);
        }
      }
      
      if (profileForm.valor_min) query = query.gte("preco", parseFloat(profileForm.valor_min) * 0.85);
      if (profileForm.valor_max) query = query.lte("preco", parseFloat(profileForm.valor_max) * 1.15);
      if (profileForm.dormitorios_min) query = query.gte("quartos", Math.max(1, parseInt(profileForm.dormitorios_min) - 1));

      const { data, error } = await query;
      if (error) { console.error("[Match] Supabase fallback error:", error); return []; }

      return (data || []).map((doc: any) => {
        const fotos = Array.isArray(doc.fotos) ? doc.fotos.map((f: any) => typeof f === "string" ? f : f?.url || "").filter(Boolean) : [];
        const firstImage = fotos[0] || doc.foto_principal || "";
        return {
          id: doc.jetimob_id || String(doc.id),
          codigo: doc.jetimob_id || String(doc.id),
          nome: doc.titulo || doc.condominio_nome || "Imóvel",
          empreendimento: doc.condominio_nome || "",
          bairro: doc.bairro || "",
          metragem: Number(doc.area_total || 0),
          dorms: Number(doc.quartos || 0),
          vagas: Number(doc.vagas || 0),
          suites: Number(doc.suites || 0),
          preco: Number(doc.preco || 0),
          status: "disponivel",
          imagem: firstImage,
          tipo: doc.tipo || "",
          score: 0,
          source: "typesense" as const,
          justificativas: [],
        };
      });
    } catch (err) {
      console.error("[Match] Supabase fallback exception:", err);
      return [];
    }
  }, [profileForm, leadData]);

  const searchTypesense = useCallback(async (): Promise<ImovelResult[]> => {
    try {
      // Use empreendimento name as q for relevance when available, otherwise "*"
      const smartQ = leadData?.empreendimento && !profileForm.bairros.length && !profileForm.valor_max
        ? leadData.empreendimento.replace(/\s+JW$/i, "").replace(/\s+João\s+Wallig$/i, "").trim()
        : "*";

      // 1. Strict search
      const strictFilter = buildTypesenseFilters(false);
      const result = await typesenseSearch({ q: smartQ, page: 1, per_page: 48, filter_by: strictFilter, sort_by: smartQ !== "*" ? "_text_match:desc,data_atualizacao:desc" : "data_atualizacao:desc" });
      if (result && result.data.length >= 3) return parseTypesenseResults(result.data);

      // 2. Broadened search (relax price, remove dorms/status/area)
      const broadFilter = buildTypesenseFilters(true);
      const broadResult = await typesenseSearch({ q: smartQ, page: 1, per_page: 48, filter_by: broadFilter, sort_by: smartQ !== "*" ? "_text_match:desc,data_atualizacao:desc" : "data_atualizacao:desc" });
      const items = parseTypesenseResults(broadResult?.data || []);

      // 3. If still empty AND we have bairro, search just by bairro + price
      if (items.length === 0 && profileForm.bairros.length > 0) {
        const minimalParts = ["valor_venda:>0"];
        if (profileForm.bairros.length === 1) minimalParts.push(`bairro:=\`${profileForm.bairros[0]}\``);
        else minimalParts.push(`bairro:[\`${profileForm.bairros.join("`,`")}\`]`);
        const minResult = await typesenseSearch({ q: "*", page: 1, per_page: 48, filter_by: minimalParts.join(" && "), sort_by: "data_atualizacao:desc" });
        return parseTypesenseResults(minResult?.data || []);
      }

      // Merge strict + broad (strict first)
      const strictItems = result?.data?.length ? parseTypesenseResults(result.data) : [];
      const allCodes = new Set(strictItems.map(i => i.codigo));
      const broadNew = items.filter(i => !allCodes.has(i.codigo));
      return [...strictItems, ...broadNew];
    } catch (err) {
      console.error("Typesense radar search error:", err);
      return [];
    }
  }, [typesenseSearch, buildTypesenseFilters, profileForm.bairros, profileForm.valor_max, leadData?.empreendimento]);

  // ── Main search ──
  const handleSearch = useCallback(async (silent = false) => {
    setLoading(true);
    setSearched(true);
    setSelectedResults(new Set());

    let allResults: ImovelResult[] = [];
    // Only include MeDay catalog if profile doesn't exclusively want "casa" or "terreno"
    const incluirMeDay = useMeDay && (!profileForm.tipos.length || profileForm.tipos.includes("apartamento"));
    if (incluirMeDay) allResults.push(...MEDAY_CATALOG.map(item => ({ ...item, justificativas: [] })));

    if (useTypesense) {
      const tsResults = await searchTypesense();
      if (tsResults.length > 0) {
        allResults.push(...tsResults);
      } else {
        // Fallback: busca direta no Supabase
        const fallbackResults = await searchSupabaseFallback();
        allResults.push(...fallbackResults);
      }
    }

    const leadEmp = leadData?.empreendimento || "";
    const scored = allResults.map(item => {
      let { score, justificativas } = scoreProperty(scoringProfile, item, activeObjecoes, leadEmp, discardedCodes as Set<string>);
      // Boost from site browsing history
      const code = getPropertyCode(item);
      if (siteInsights?.viewedCodes.has(code)) {
        score = Math.min(99, score + 8);
        justificativas = [...justificativas, "👁️ Visualizado no site"];
      }
      if (siteInsights?.favCodes.has(code)) {
        score = Math.min(99, score + 12);
        justificativas = [...justificativas, "❤️ Favoritado no site"];
      }
      return { ...item, score, justificativas };
    });
    scored.sort((a, b) => b.score - a.score);

    // Deduplicate by codigo
    const seen = new Set<string>();
    const deduped = scored.filter(item => {
      if (item.score <= 0 && item.justificativas.some(j => j.includes("Descartado"))) return false; // Only hide explicitly discarded
      const key = item.codigo || normalize(item.nome || `${item.id}`);
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
  }, [useMeDay, useTypesense, scoringProfile, activeObjecoes, searchTypesense, handleSaveProfile, leadData?.empreendimento, discardedCodes, saveSearch, siteInsights]);

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
    const finalPhone = phone.startsWith("55") ? phone : `55${phone}`;
    const items = selectedItems.length > 0 ? selectedItems : results.filter(r => r.score >= 60).slice(0, 5);
    handleMarkSent(items);
    window.open(`https://wa.me/${finalPhone}?text=${encodeURIComponent(generateWhatsAppMsg())}`, "_blank");
    toast.success("Abrindo WhatsApp...");
  };

  const copyMessage = () => {
    const msg = generateWhatsAppMsg();
    if (!msg) { toast.error("Nenhum imóvel para copiar"); return; }
    navigator.clipboard.writeText(msg);
    toast.success("Mensagem copiada!");
  };

  // ── Criar Vitrine ──
  const handleCreateVitrine = useCallback(async () => {
    if (!user?.id) { toast.error("Você precisa estar logado"); return; }
    const items = selectedItems.length > 0 ? selectedItems : results.filter(r => r.score >= 60).slice(0, 5);
    if (items.length === 0) { toast.error("Selecione ao menos 1 imóvel"); return; }

    setCreatingVitrine(true);
    try {
      const imovelCodigos = items.map(item => getPropertyCode(item));

      const titulo = `Seleção para ${leadNome}`;
      const mensagem = `Olá ${leadNome}! Selecionei ${items.length} imóveis especialmente para você. Confira!`;

      const { data: vitrine, error } = await supabase
        .from("vitrines")
        .insert({
          titulo,
          mensagem_corretor: mensagem,
          imovel_ids: imovelCodigos,
          lead_nome: leadNome,
          lead_telefone: leadTelefone || null,
          corretor_slug: slugRef || null,
          created_by: user.id,
          tipo: "property_selection",
        })
        .select("id")
        .single();

      if (error) throw error;

      const vitrineUrl = getVitrinePublicUrl(vitrine.id);

      // Mark items as sent
      handleMarkSent(items);

      // Copy link + open WhatsApp
      await navigator.clipboard.writeText(vitrineUrl);

      if (leadTelefone) {
        const phone = leadTelefone.replace(/\D/g, "");
        const finalPhone = phone.startsWith("55") ? phone : `55${phone}`;
        const msg = `Olá ${leadNome}! 😊\n\nPreparei uma seleção especial de ${items.length} imóveis para você:\n\n🔗 ${vitrineUrl}\n\nDá uma olhada e me conta o que achou! 🏠`;
        window.open(`https://wa.me/${finalPhone}?text=${encodeURIComponent(msg)}`, "_blank");
      }

      toast.success("Vitrine criada! Link copiado ✨", { description: vitrineUrl, duration: 6000 });
    } catch (err: any) {
      console.error("Erro ao criar vitrine:", err);
      toast.error("Erro ao criar vitrine");
    } finally {
      setCreatingVitrine(false);
    }
  }, [user?.id, selectedItems, results, leadNome, leadTelefone, slugRef, handleMarkSent]);

  return (
    <div className="px-6 pb-8 space-y-3">
      {/* ── Botão Radar Fullscreen ── */}
      <Button
        className="w-full gap-2 h-10 bg-[#4F46E5] hover:bg-[#4338CA] text-white"
        onClick={() => setRadarOpen(true)}
      >
        <Maximize2 className="h-4 w-4" />
        Abrir Radar Completo
      </Button>
      <RadarFullscreenModal
        open={radarOpen}
        onClose={() => setRadarOpen(false)}
        leadNome={leadNome}
        leadTelefone={leadTelefone}
        leadId={leadId}
        profile={{
          tipos: profileForm.tipos,
          bairros: profileForm.bairros,
          valor_min: profileForm.valor_min,
          valor_max: profileForm.valor_max,
          dormitorios_min: profileForm.dormitorios_min,
          suites_min: profileForm.suites_min,
          vagas_min: profileForm.vagas_min,
          area_min: profileForm.area_min,
          area_max: profileForm.area_max,
          empreendimento: leadData?.empreendimento,
          momento_compra: profileForm.momento_compra,
          urgencia: profileForm.urgencia,
          status_imovel: profileForm.status_imovel,
        }}
        matches={results}
        isSearching={loading}
        onUpdateMatch={(edited) => {
          setProfileForm(prev => ({
            ...prev,
            tipos: edited.tipos,
            bairros: edited.bairros,
            valor_min: edited.valor_min,
            valor_max: edited.valor_max,
            dormitorios_min: edited.dormitorios_min,
            suites_min: edited.suites_min,
            vagas_min: edited.vagas_min,
            area_min: edited.area_min,
            area_max: edited.area_max,
            momento_compra: edited.momento_compra,
            urgencia: edited.urgencia,
            status_imovel: edited.status_imovel,
          }));
          setTimeout(() => handleSearch(), 50);
        }}
        onIAPerfil={handleAIAnalyze}
        isAIAnalyzing={aiAnalyzing}
        isCreatingVitrine={creatingVitrine}
        onCriarVitrine={async (selectedIndexes) => {
          if (!user?.id) { toast.error("Você precisa estar logado"); return undefined; }
          const items = selectedIndexes.map(i => results[i]).filter(Boolean);
          if (items.length === 0) { toast.error("Selecione ao menos 1 imóvel"); return undefined; }
          setCreatingVitrine(true);
          try {
            const imovelCodigos = items.map(item => getPropertyCode(item));
            const titulo = `Seleção para ${leadNome}`;
            const mensagem = `Olá ${leadNome}! Selecionei ${items.length} imóveis especialmente para você. Confira!`;
            const { data: vitrine, error } = await supabase
              .from("vitrines")
              .insert({
                titulo,
                mensagem_corretor: mensagem,
                imovel_ids: imovelCodigos,
                lead_nome: leadNome,
                lead_telefone: leadTelefone || null,
                corretor_slug: slugRef || null,
                created_by: user.id,
                tipo: "property_selection",
              })
              .select("id")
              .single();
            if (error) throw error;
            const vitrineUrl = getVitrinePublicUrl(vitrine.id);

            // Fire-and-forget: mark sent & log activity
            handleMarkSent(items);
            supabase.from("pipeline_atividades").insert({
              pipeline_lead_id: leadId,
              tipo: "vitrine",
              titulo: `Vitrine criada (${items.length} imóveis)`,
              descricao: `Link: ${vitrineUrl}\nImóveis: ${imovelCodigos.join(", ")}`,
              created_by: user.id,
            }).then(() => {}).catch(() => {});

            console.log("[RadarImoveisTab] vitrineUrl gerada:", vitrineUrl);
            // Don't reset creatingVitrine until after returning the URL
            const urlToReturn = vitrineUrl;
            setCreatingVitrine(false);
            return urlToReturn;
          } catch (err: any) {
            console.error("Erro ao criar vitrine:", err);
            toast.error("Erro ao criar vitrine");
            setCreatingVitrine(false);
            return undefined;
          }
        }}
      />

      {/* ── Resumo do perfil — pills somente leitura ── */}
      <div className="flex items-center gap-1.5 flex-wrap mt-2">
        {profileForm.tipos.length > 0 && (
          <span className="text-[10px] px-2 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center gap-1">
            <Home className="h-2.5 w-2.5" /> {profileForm.tipos.join(", ")}
          </span>
        )}
        {profileForm.bairros.length > 0 && (
          <span className="text-[10px] px-2 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center gap-1">
            <MapPin className="h-2.5 w-2.5" /> {profileForm.bairros.join(", ")}
          </span>
        )}
        {(profileForm.valor_min || profileForm.valor_max) && (
          <span className="text-[10px] px-2 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center gap-1">
            <DollarSign className="h-2.5 w-2.5" />
            {profileForm.valor_min ? fmtPrice(parseFloat(profileForm.valor_min)) : "0"} – {profileForm.valor_max ? fmtPrice(parseFloat(profileForm.valor_max)) : "∞"}
          </span>
        )}
        {profileForm.dormitorios_min && (
          <span className="text-[10px] px-2 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center gap-1">
            <Bed className="h-2.5 w-2.5" /> {profileForm.dormitorios_min}+ dorms
          </span>
        )}
        {leadData?.empreendimento && (
          <Badge variant="secondary" className="text-[9px] gap-1"><Building2 className="h-2.5 w-2.5" /> {leadData.empreendimento}</Badge>
        )}
      </div>

      {/* ── Contagem de resultados ── */}
      <p className="text-sm text-muted-foreground mt-3">
        {results.length > 0
          ? `${results.length} imóveis compatíveis`
          : "Nenhum imóvel buscado ainda"}
      </p>

      {/* ── Histórico do Radar ── */}
      {radarHistory.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Últimas ações</p>
          <div className="space-y-1.5">
            {radarHistory.map((item) => {
              const icon = item.tipo === 'vitrine' ? '📋' : item.tipo === 'envio_imovel' ? '📨' : '🔍';
              return (
                <div key={item.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{icon}</span>
                  <span className="truncate">{item.titulo}</span>
                  <span className="shrink-0">· {format(new Date(item.created_at), 'dd/MM')}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}
