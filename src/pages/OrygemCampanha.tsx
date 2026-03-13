import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Building2, Phone, MessageSquare, Copy, MapPin, Target, Star,
  ChevronDown, ChevronUp, Home, DollarSign, Users, Calendar,
  TreePine, Dumbbell, PartyPopper, Baby, Dog, Flame, Palmtree,
  Waves, Send, FileText, ArrowRight, Gift, Sparkles, Car, Eye,
  BadgeCheck, ShieldCheck, ExternalLink, Play, Clock, Navigation,
  Leaf, ShoppingBag, Gamepad2, Armchair, Sun, X, Link2, Loader2
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getVitrinePublicUrl } from "@/lib/vitrineUrl";

/* ═══════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════ */

const CAMPAIGN_TARGET = 10;
const CAMPAIGN_VGV = 10_000_000;

const GALLERY_IMAGES = [
  { label: "Fachada", url: "/images/orygem/fachada.jpg", category: "fachada" },
  { label: "Jardim & Lazer", url: "/images/orygem/lazer-jardim.jpg", category: "lazer" },
  { label: "Spa & Hidro", url: "/images/orygem/interior-spa.jpg", category: "interior" },
  { label: "Piscina", url: "/images/orygem/piscina.jpg", category: "lazer" },
  { label: "Market", url: "/images/orygem/market.jpg", category: "lazer" },
  { label: "Living Integrado", url: "/images/orygem/living.jpg", category: "interior" },
  { label: "Terraço", url: "/images/orygem/terraco.jpg", category: "interior" },
  { label: "Fachada Lateral", url: "/images/orygem/fachada2.jpg", category: "fachada" },
  { label: "Churrasqueira", url: "/images/orygem/churrasqueira.jpg", category: "interior" },
  { label: "Área Verde", url: "/images/orygem/area-verde.jpg", category: "lazer" },
  { label: "Quiosque Gourmet", url: "/images/orygem/quiosque.jpg", category: "lazer" },
  { label: "Playground", url: "/images/orygem/playground.jpg", category: "lazer" },
  { label: "Pátio Privativo", url: "/images/orygem/patio.jpg", category: "interior" },
  { label: "Cozinha", url: "/images/orygem/cozinha.jpg", category: "interior" },
  { label: "Suíte", url: "/images/orygem/suite.jpg", category: "interior" },
  { label: "Academia", url: "/images/orygem/academia.jpg", category: "lazer" },
  { label: "Salão de Festas", url: "/images/orygem/salao-festas.jpg", category: "lazer" },
  { label: "Beach Tennis", url: "/images/orygem/beach-tennis.jpg", category: "lazer" },
  { label: "Espaço Pet", url: "/images/orygem/pet-space.jpg", category: "lazer" },
  { label: "Redário", url: "/images/orygem/redario.jpg", category: "lazer" },
];

const INFRASTRUCTURE = [
  { icon: Home, label: "Quarto da Casa", img: "/images/orygem/suite.jpg" },
  { icon: Waves, label: "Piscina com Deck Solarium", img: "/images/orygem/piscina.jpg" },
  { icon: Home, label: "Pátio da Casa", img: "/images/orygem/patio.jpg" },
  { icon: Target, label: "Quadra Poliesportiva", img: "/images/orygem/beach-tennis.jpg" },
  { icon: Home, label: "Quarto da Casa", img: "/images/orygem/cozinha.jpg" },
  { icon: ShoppingBag, label: "Market 24h", img: "/images/orygem/market.jpg" },
  { icon: Armchair, label: "Sala da Casa", img: "/images/orygem/living.jpg" },
  { icon: Sun, label: "Terraço da Casa", img: "/images/orygem/terraco.jpg" },
  { icon: Sun, label: "Terraço da Casa", img: "/images/orygem/churrasqueira.jpg" },
  { icon: Palmtree, label: "Quiosque Gourmet", img: "/images/orygem/quiosque.jpg" },
  { icon: Baby, label: "Playground", img: "/images/orygem/playground.jpg" },
  { icon: Flame, label: "Fogo de Chão", img: "/images/orygem/redario.jpg" },
  { icon: Dog, label: "Espaço Pet", img: "/images/orygem/pet-space.jpg" },
  { icon: Dumbbell, label: "Academia", img: "/images/orygem/academia.jpg" },
  { icon: PartyPopper, label: "Salão de Festas", img: "/images/orygem/salao-festas.jpg" },
  { icon: TreePine, label: "Área Verde 13.000m²", img: "/images/orygem/area-verde.jpg" },
];

const PROXIMIDADES = [
  { local: "Colégio Pastor Dohms Zona Sul", tempo: "2 min" },
  { local: "Bourbon Teresópolis", tempo: "5 min" },
  { local: "Colégio João XXIII", tempo: "5 min" },
  { local: "Uniritter Campus Zona Sul", tempo: "6 min" },
  { local: "PUCRS", tempo: "10 min" },
  { local: "Jardim Botânico", tempo: "13 min" },
  { local: "Av. Carlos Gomes", tempo: "15 min" },
  { local: "Av. Nilo Peçanha", tempo: "16 min" },
  { local: "Parque Moinhos de Vento", tempo: "20 min" },
  { local: "Shopping Iguatemi", tempo: "24 min" },
];

const FASE1_UNITS = [
  { bloco: "2D", unidade: "20", area: "150 m²", valor: "R$ 871.500" },
  { bloco: "3D", unidade: "92", area: "173,71 m²", valor: "R$ 1.009.000" },
  { bloco: "3D", unidade: "93", area: "173,71 m²", valor: "R$ 1.009.000" },
  { bloco: "3D", unidade: "96", area: "173,71 m²", valor: "R$ 1.318.000" },
  { bloco: "3D", unidade: "97", area: "173,71 m²", valor: "R$ 1.009.000" },
  { bloco: "3D", unidade: "99", area: "173,71 m²", valor: "R$ 1.009.000" },
  { bloco: "3D", unidade: "100", area: "173,71 m²", valor: "R$ 1.009.000" },
  { bloco: "3D", unidade: "101", area: "173,71 m²", valor: "R$ 1.009.000" },
  { bloco: "3D", unidade: "102", area: "173,71 m²", valor: "R$ 1.009.000" },
  { bloco: "3D", unidade: "103", area: "173,71 m²", valor: "R$ 1.009.000" },
  { bloco: "3D", unidade: "104", area: "173,71 m²", valor: "R$ 1.009.000" },
  { bloco: "3D", unidade: "106", area: "173,71 m²", valor: "R$ 1.009.000" },
];

const FASE2_UNITS = [
  { bloco: "3D", unidade: "65", area: "173,71 m²", valor: "R$ 909.200" },
  { bloco: "3D", unidade: "66", area: "173,71 m²", valor: "R$ 909.200" },
  { bloco: "3D", unidade: "67", area: "173,71 m²", valor: "R$ 909.200" },
  { bloco: "3D", unidade: "68", area: "173,71 m²", valor: "R$ 909.200" },
  { bloco: "3D", unidade: "69", area: "173,71 m²", valor: "R$ 909.200" },
  { bloco: "3D", unidade: "72", area: "173,71 m²", valor: "R$ 1.201.800" },
  { bloco: "3D", unidade: "73", area: "173,71 m²", valor: "R$ 1.043.900" },
  { bloco: "3D", unidade: "75", area: "173,71 m²", valor: "R$ 1.009.000" },
  { bloco: "3D", unidade: "76", area: "173,71 m²", valor: "R$ 1.009.000" },
  { bloco: "3D", unidade: "77", area: "173,71 m²", valor: "R$ 1.009.000" },
  { bloco: "3D", unidade: "78", area: "173,71 m²", valor: "R$ 1.009.000" },
  { bloco: "3D", unidade: "79", area: "173,71 m²", valor: "R$ 1.009.000" },
  { bloco: "3D", unidade: "80", area: "173,71 m²", valor: "R$ 1.009.000" },
  { bloco: "3D", unidade: "81", area: "173,71 m²", valor: "R$ 1.009.000" },
  { bloco: "3D", unidade: "82", area: "173,71 m²", valor: "R$ 1.009.000" },
  { bloco: "3D", unidade: "85", area: "173,71 m²", valor: "R$ 1.009.000" },
  { bloco: "3D", unidade: "86", area: "173,71 m²", valor: "R$ 1.009.000" },
  { bloco: "3D", unidade: "87", area: "173,71 m²", valor: "R$ 1.009.000" },
  { bloco: "3D", unidade: "88", area: "173,71 m²", valor: "R$ 1.006.900" },
  { bloco: "3D", unidade: "89", area: "173,71 m²", valor: "R$ 1.006.900" },
];

const BROKER_ARGUMENTS = [
  "Casa com valor próximo de apartamento",
  "Condomínio clube completo com 16 espaços de lazer",
  "Casa com pátio privativo e terraço no 3º pavimento",
  "Produto raro em Porto Alegre — condomínio fechado de casas",
  "Empreendimento quase pronto — possibilidade de visitar obra e decorado",
  "Espera para lareira, piscina e spa no 1º e 3º pavimentos",
  "13.000m² de área verde preservada dentro do condomínio",
  "Localização estratégica: entre a Zona Sul e Zona Norte",
  "Incorporadora ENCORP — referência no mercado",
  "Market e conveniência exclusiva dentro do condomínio",
];

const SCRIPTS = [
  {
    title: "Primeiro contato",
    text: `Oi {{nome}}! Tudo bem?\n\nEstou com uma oportunidade incrível de casa em condomínio fechado no Orygem Residence Club, no Teresópolis.\n\n🏠 Casas de 150 a 173m² com 3 pavimentos\n🌿 Pátio privativo com churrasqueira\n🏊 Condomínio com infraestrutura de clube — piscina, academia, beach tennis\n👁️ Decorado disponível para visita\n\nValores a partir de R$ 871 mil.\n\nQuer que eu te mande as plantas e fotos?`,
  },
  {
    title: "Campanha 60 dias",
    text: `{{nome}}, estamos com uma campanha especial no Orygem Residence Club!\n\nCasas em condomínio fechado com:\n🌿 Pátio privativo com churrasqueira\n🏠 Terraço no 3º pavimento\n🏊 16 espaços de lazer — piscina, spa, beach tennis, academy\n🏪 Market exclusivo dentro do condomínio\n\n📍 Teresópolis — entre Zona Sul e Norte\n\nE o melhor: já dá para visitar o decorado e a obra!\n\nQuer agendar uma visita?`,
  },
  {
    title: "Urgência / Escassez",
    text: `Oi {{nome}}!\n\nO Orygem Residence Club está com poucas unidades disponíveis e condições especiais.\n\n📐 150 a 173m² | 2 ou 3 dormitórios\n🏠 3 pavimentos com pátio e terraço\n🏊 Condomínio clube completo\n🌳 13.000m² de área verde preservada\n\nÉ um dos únicos condomínios de casas em Porto Alegre com essa infraestrutura.\n\nPosso te mostrar as melhores unidades?`,
  },
  {
    title: "Investimento / Valor",
    text: `{{nome}}, você já conhece o Orygem?\n\nÉ um condomínio fechado de casas no Teresópolis com valor de casa próximo de apartamento.\n\n💰 A partir de R$ 871.500 (150m²)\n🏠 Casas de 3 pavimentos com pátio e terraço\n🏊 Infraestrutura de clube completa\n📍 2 min do Colégio Dohms, 5 min do Bourbon\n\nExcelente para moradia e valorização.\n\nTe mando mais detalhes?`,
  },
];

const PAYMENT_CONDITIONS = [
  "30% no fluxo durante a obra",
  "Saldo financiado após a entrega",
  "Crédito associativo disponível",
  "Financiamento bancário",
  "Aceita FGTS",
];

const PLANT_IMAGES = {
  "2d": [
    { label: "Térreo", url: "/images/orygem/planta-2d-terreo.jpg" },
    { label: "2º Pavimento", url: "/images/orygem/planta-2d-2pav.jpg" },
    { label: "Terraço", url: "/images/orygem/planta-2d-terraco.jpg" },
  ],
  "3d": [
    { label: "Térreo", url: "/images/orygem/planta-3d-terreo.jpg" },
    { label: "2º Pavimento", url: "/images/orygem/planta-3d-2pav.jpg" },
    { label: "Terraço", url: "/images/orygem/planta-3d-terraco.jpg" },
  ],
};

/* ═══════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════ */

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text);
  toast.success("Copiado!");
}

/* ═══════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════ */

export default function OrygemCampanha() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [showScripts, setShowScripts] = useState(false);
  const [showArguments, setShowArguments] = useState(false);
  const [showUnits, setShowUnits] = useState<"fase1" | "fase2" | null>(null);
  const [showPlants, setShowPlants] = useState<"2d" | "3d" | null>(null);
  const [galleryFilter, setGalleryFilter] = useState<string>("todos");
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);
  const [salesCount] = useState(0);

  // Enviar Página state
  const [showEnviar, setShowEnviar] = useState(false);
  const [enviarSaving, setEnviarSaving] = useState(false);
  const [enviarLeadNome, setEnviarLeadNome] = useState("");
  const [enviarLeadTel, setEnviarLeadTel] = useState("");
  const [enviarMensagem, setEnviarMensagem] = useState("");
  const [enviarVitrineUrl, setEnviarVitrineUrl] = useState<string | null>(null);
  const [orygemOverride, setOrygemOverride] = useState<any>(null);

  // Load Orygem override from empreendimento_overrides
  useEffect(() => {
    supabase
      .from("empreendimento_overrides")
      .select("*")
      .or("codigo.ilike.%orygem%,nome.ilike.%orygem%")
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setOrygemOverride(data);
      });
  }, []);

  // Reset enviar dialog on open
  useEffect(() => {
    if (showEnviar) {
      setEnviarLeadNome("");
      setEnviarLeadTel("");
      setEnviarMensagem("");
      setEnviarVitrineUrl(null);
    }
  }, [showEnviar]);

  const handleCreateVitrine = useCallback(async () => {
    if (!user) { toast.error("Você precisa estar logado."); return; }
    setEnviarSaving(true);
    try {
      const images = orygemOverride?.fotos || GALLERY_IMAGES.map(g => g.url);
      const dadosCustom = [{
        nome: "Orygem Residence Club",
        codigo: orygemOverride?.codigo || "ORYGEM",
        bairro: orygemOverride?.bairro || "Teresópolis",
        valor_venda: 871500,
        valor_min: 871500,
        valor_max: 1318000,
        tipologias: orygemOverride?.tipologias || [],
        area_privativa: 150,
        dormitorios: 2,
        suites: 1,
        vagas: 2,
        status_obra: orygemOverride?.status_obra || "Em obras",
        previsao_entrega: orygemOverride?.previsao_entrega || "",
        descricao: "Condomínio fechado de casas com infraestrutura de clube. 150 a 173m², 2 ou 3 dormitórios, pátio privativo, terraço e 16 espaços de lazer.",
        fotos: images,
      }];

      const { data, error } = await supabase.from("vitrines").insert({
        titulo: `Orygem Residence Club — Vitrine Exclusiva`,
        created_by: user.id,
        tipo: "product_page",
        imovel_ids: [orygemOverride?.codigo || "ORYGEM"],
        dados_custom: dadosCustom,
        lead_nome: enviarLeadNome || null,
        lead_telefone: enviarLeadTel || null,
        mensagem_corretor: enviarMensagem || null,
      }).select("id").single();

      if (error) throw error;
      const url = getVitrinePublicUrl(data.id);
      setEnviarVitrineUrl(url);
      toast.success("Vitrine criada!");
    } catch (err: any) {
      toast.error("Erro: " + (err.message || "Falha ao criar vitrine"));
    } finally {
      setEnviarSaving(false);
    }
  }, [user, orygemOverride, enviarLeadNome, enviarLeadTel, enviarMensagem]);

  function enviarWhatsApp() {
    if (!enviarVitrineUrl) return;
    const text = `Olá${enviarLeadNome ? ` ${enviarLeadNome}` : ""}! 🏡\n\nPreparei uma vitrine exclusiva do *Orygem Residence Club* para você:\n\n${enviarVitrineUrl}\n\n${enviarMensagem || "Qualquer dúvida, estou à disposição!"}`;
    const encoded = encodeURIComponent(text);
    const whatsUrl = enviarLeadTel
      ? `https://wa.me/55${enviarLeadTel.replace(/\D/g, "")}?text=${encoded}`
      : `https://wa.me/?text=${encoded}`;
    window.open(whatsUrl, "_blank");
  }

  function enviarCopyLink() {
    if (!enviarVitrineUrl) return;
    navigator.clipboard.writeText(enviarVitrineUrl);
    toast.success("Link copiado!");
  }

  const progress = Math.round((salesCount / CAMPAIGN_TARGET) * 100);

  const filteredGallery = galleryFilter === "todos"
    ? GALLERY_IMAGES
    : GALLERY_IMAGES.filter((img) => img.category === galleryFilter);

  return (
    <div className="space-y-5 pb-24">

      {/* ═══ ENVIAR PÁGINA DIALOG ═══ */}
      <Dialog open={showEnviar} onOpenChange={setShowEnviar}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-4 w-4 text-amber-500" />
              Enviar Página — Orygem Residence Club
            </DialogTitle>
          </DialogHeader>
          {!enviarVitrineUrl ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Nome do Cliente (opcional)</Label>
                  <Input value={enviarLeadNome} onChange={e => setEnviarLeadNome(e.target.value)} placeholder="João" className="h-9 text-sm" />
                </div>
                <div>
                  <Label className="text-xs">WhatsApp (opcional)</Label>
                  <Input value={enviarLeadTel} onChange={e => setEnviarLeadTel(e.target.value)} placeholder="51999999999" className="h-9 text-sm" />
                </div>
              </div>
              <div>
                <Label className="text-xs">Mensagem personalizada</Label>
                <Textarea value={enviarMensagem} onChange={e => setEnviarMensagem(e.target.value)} rows={2} placeholder="Qualquer dúvida, estou à disposição!" className="text-sm" />
              </div>
              <Button onClick={handleCreateVitrine} disabled={enviarSaving} className="w-full gap-2 bg-amber-500 hover:bg-amber-600">
                {enviarSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {enviarSaving ? "Criando..." : "Criar Vitrine e Enviar"}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-center space-y-2">
                <p className="text-sm font-bold text-amber-600">✅ Vitrine criada com sucesso!</p>
                <p className="text-xs text-muted-foreground break-all font-mono bg-muted/30 rounded-lg p-2">{enviarVitrineUrl}</p>
              </div>
              <div className="flex gap-2">
                <Button onClick={enviarWhatsApp} className="flex-1 gap-2 bg-green-600 hover:bg-green-700">
                  <Send className="h-4 w-4" /> Enviar via WhatsApp
                </Button>
                <Button onClick={enviarCopyLink} variant="outline" className="gap-2">
                  <Link2 className="h-4 w-4" /> Copiar
                </Button>
              </div>
              <Button variant="ghost" size="sm" onClick={() => window.open(enviarVitrineUrl!, "_blank")} className="w-full gap-2 text-xs">
                <ExternalLink className="h-3.5 w-3.5" /> Visualizar vitrine
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ═══ LIGHTBOX ═══ */}
      {lightboxImg && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setLightboxImg(null)}>
          <button className="absolute top-4 right-4 text-white/70 hover:text-white" onClick={() => setLightboxImg(null)}>
            <X className="h-8 w-8" />
          </button>
          <img src={lightboxImg} alt="" className="max-w-full max-h-[90vh] rounded-lg object-contain" />
        </div>
      )}

      {/* ═══ HERO with Real Image ═══ */}
      <div className="relative rounded-xl overflow-hidden min-h-[420px] md:min-h-[480px]">
        <img
          src="/images/orygem/fachada.jpg"
          alt="Orygem Residence Club - Fachada"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#1a1a1a]/95 via-[#1a1a1a]/70 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#1a1a1a]/80 via-transparent to-[#1a1a1a]/30" />

        <div className="relative z-10 p-6 md:p-10 flex flex-col justify-end h-full min-h-[420px] md:min-h-[480px]">
          <div className="space-y-4 max-w-xl">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className="bg-amber-500/90 text-white border-0 text-xs font-bold px-3 py-1">🏠 CAMPANHA 60 DIAS</Badge>
              <Badge className="bg-white/15 text-white border border-white/20 text-[10px] backdrop-blur-sm">Decorado disponível</Badge>
              <Badge className="bg-white/15 text-white border border-white/20 text-[10px] backdrop-blur-sm">Visita na obra</Badge>
            </div>

            <div>
              <p className="text-white/50 text-xs tracking-[0.3em] uppercase font-medium mb-1">ENCORP Empreendimentos</p>
              <h1 className="text-3xl md:text-5xl font-black text-white leading-none tracking-tight" style={{ fontFamily: "'Playfair Display', serif" }}>
                ORYGEM
              </h1>
              <p className="text-lg md:text-xl text-white/60 font-light tracking-[0.15em] mt-0.5">RESIDENCE CLUB</p>
            </div>

            <p className="text-white/50 text-sm leading-relaxed max-w-md">
              Sofisticação, conforto e segurança para viver a sua essência.
              <br />
              <span className="text-amber-400 font-semibold">Meta: vender {CAMPAIGN_TARGET} casas em 60 dias</span>
            </p>

            {/* Bateu Levou */}
            <div className="bg-gradient-to-r from-amber-500/20 to-amber-600/10 border border-amber-500/30 rounded-xl p-4 max-w-sm backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-1">
                <Gift className="h-5 w-5 text-amber-400" />
                <span className="text-amber-300 font-black text-sm tracking-wide">BATEU LEVOU</span>
              </div>
              <p className="text-white/80 text-xs">
                <strong className="text-amber-400 text-base">R$ 5.000</strong> por venda para o corretor
              </p>
            </div>

            <div className="flex gap-2 pt-1 flex-wrap">
              <Button size="sm" className="gap-1.5 bg-amber-500 hover:bg-amber-600 text-white border-0 font-bold">
                <Calendar className="h-3.5 w-3.5" /> Agendar Visita
              </Button>
              <Button size="sm" className="gap-1.5 bg-white/15 hover:bg-white/25 text-white border border-white/30 backdrop-blur-sm" onClick={() => navigate("/oferta-ativa")}>
                <Sparkles className="h-3.5 w-3.5" /> Iniciar Oferta
              </Button>
              <Button size="sm" className="gap-1.5 bg-white/15 hover:bg-white/25 text-white border border-white/30 backdrop-blur-sm" onClick={() => navigate("/imoveis")}>
                <Eye className="h-3.5 w-3.5" /> Ver Tipologias
              </Button>
              <Button size="sm" className="gap-1.5 bg-white/15 hover:bg-white/25 text-white border border-white/30 backdrop-blur-sm" onClick={() => navigate("/pipeline-leads")}>
                <Target className="h-3.5 w-3.5" /> Abrir Pipeline
              </Button>
              <Button size="sm" className="gap-1.5 bg-green-600 hover:bg-green-700 text-white border-0 font-bold" onClick={() => setShowEnviar(true)}>
                <Send className="h-3.5 w-3.5" /> Enviar Página
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ SALES GOAL TRACKER ═══ */}
      <Card className="border-amber-200/60 overflow-hidden">
        <CardHeader className="pb-2 bg-gradient-to-r from-amber-50 to-yellow-50">
          <CardTitle className="text-sm flex items-center gap-2">
            <Target className="h-4 w-4 text-amber-600" /> Meta da Campanha — 60 Dias
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 space-y-3">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-3xl font-black text-amber-600">{salesCount}/{CAMPAIGN_TARGET}</p>
              <p className="text-xs text-muted-foreground">casas vendidas</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-foreground">VGV Estimado</p>
              <p className="text-sm font-semibold text-amber-600">R$ {(CAMPAIGN_VGV / 1_000_000).toFixed(0)} milhões</p>
            </div>
          </div>
          <Progress value={progress} className="h-3 [&>div]:bg-gradient-to-r [&>div]:from-amber-400 [&>div]:to-amber-600" />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>{progress}% da meta</span>
            <span>{CAMPAIGN_TARGET - salesCount} unidades restantes</span>
          </div>
        </CardContent>
      </Card>

      {/* ═══ VIDEO SECTION ═══ */}
      <Card className="border-border/50 overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Play className="h-4 w-4 text-amber-500" /> Vídeo do Empreendimento
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid md:grid-cols-2 gap-3">
            <div className="rounded-xl overflow-hidden aspect-video bg-black">
              <iframe
                src="https://www.youtube.com/embed/a1XjjW8MvVc"
                title="Orygem Residence Club - Lançamento"
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
            <div className="rounded-xl overflow-hidden aspect-video bg-black">
              <iframe
                src="https://www.youtube.com/embed/N44k1sgTZtE"
                title="Orygem Residence Club - Localização"
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ═══ EMPREENDIMENTO INFO ═══ */}
      <Card className="border-border/50 overflow-hidden">
        <div className="relative h-48 overflow-hidden">
          <img src="/images/orygem/area-verde.jpg" alt="Orygem - Área verde" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-card via-card/50 to-transparent" />
          <div className="absolute bottom-4 left-6">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <MapPin className="h-3 w-3" /> Av. Eng. Ludolfo Boehl, 931 — Teresópolis, Porto Alegre/RS
            </p>
          </div>
        </div>
        <CardContent className="space-y-4 pt-4">
          <div>
            <h2 className="text-lg font-bold text-foreground">Condomínio Fechado de Casas</h2>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Sofisticação, conforto e segurança para viver a sua essência. Lazer completo com infraestrutura de Clube,
              espaço ao ar livre e Club House. Entre a Zona Sul e a Zona Norte, no centro de inúmeras possibilidades.
              Área de preservação permanente com mais de 13.000m².
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {[
              { icon: Home, label: "150 a 173m²", sub: "Área privativa" },
              { icon: Building2, label: "2 ou 3 dorms", sub: "Com suíte" },
              { icon: Car, label: "2 vagas", sub: "Garagem" },
              { icon: Building2, label: "3 pavimentos", sub: "Com pátio e terraço" },
            ].map((f) => (
              <div key={f.label} className="bg-muted/50 rounded-lg p-3 text-center">
                <f.icon className="h-4 w-4 mx-auto mb-1 text-amber-600" />
                <p className="text-xs font-bold text-foreground">{f.label}</p>
                <p className="text-[10px] text-muted-foreground">{f.sub}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {["Pátio privativo", "Terraço", "Churrasqueira", "Espera para lareira", "Espera para piscina/spa", "3 pavimentos", "Condomínio clube"].map((d) => (
              <Badge key={d} variant="outline" className="text-[10px] border-amber-200 text-amber-700 bg-amber-50">
                {d}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ═══ INFRAESTRUTURA com imagens ═══ */}
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Star className="h-4 w-4 text-amber-500" /> Infraestrutura do Clube — 16 Espaços de Lazer
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {INFRASTRUCTURE.map((item) => (
              <div
                key={item.label}
                className="relative group rounded-xl overflow-hidden aspect-[4/3] cursor-pointer"
                onClick={() => setLightboxImg(item.img)}
              >
                <img src={item.img} alt={item.label} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                <div className="absolute bottom-2 left-2 right-2 flex items-center gap-1.5">
                  <item.icon className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                  <p className="text-[10px] font-semibold text-white leading-tight">{item.label}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ═══ TIPOLOGIAS ═══ */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* 2 Dorms */}
        <Card className="border-border/50 overflow-hidden">
          <div className="relative h-48 overflow-hidden">
            <img src="/images/orygem/living.jpg" alt="Casa 2 dormitórios" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#1a1a1a] to-transparent" />
            <div className="absolute bottom-4 left-4">
              <Badge className="bg-amber-500/90 text-white border-0 text-[10px] mb-1">2 Dormitórios</Badge>
              <p className="text-2xl font-black text-white">150m²</p>
              <p className="text-white/60 text-[10px]">Opções com suíte ou estar e office</p>
            </div>
          </div>
          <CardContent className="pt-4 space-y-3">
            <div className="space-y-1.5">
              {["Suíte", "Pátio com churrasqueira", "Terraço com estar e office", "Living integrado", "2 vagas", "Espera para lareira e piscina"].map((f) => (
                <div key={f} className="flex items-center gap-2 text-xs text-foreground/80">
                  <BadgeCheck className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                  {f}
                </div>
              ))}
            </div>
            <div className="pt-2 border-t border-border/50">
              <p className="text-[10px] text-muted-foreground">A partir de</p>
              <p className="text-xl font-black text-amber-600">R$ 871.500</p>
            </div>
            <Button variant="outline" size="sm" className="w-full text-xs gap-1.5" onClick={() => setShowPlants(showPlants === "2d" ? null : "2d")}>
              <FileText className="h-3.5 w-3.5" /> {showPlants === "2d" ? "Ocultar" : "Ver"} Plantas
            </Button>
            {showPlants === "2d" && (
              <div className="grid grid-cols-3 gap-2 pt-2">
                {PLANT_IMAGES["2d"].map((p) => (
                  <div key={p.label} className="cursor-pointer" onClick={() => setLightboxImg(p.url)}>
                    <img src={p.url} alt={p.label} className="rounded-lg w-full aspect-square object-cover border border-border/50" loading="lazy" />
                    <p className="text-[9px] text-center text-muted-foreground mt-1">{p.label}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 3 Dorms */}
        <Card className="border-border/50 overflow-hidden">
          <div className="relative h-48 overflow-hidden">
            <img src="/images/orygem/terraco.jpg" alt="Casa 3 dormitórios" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#1a1a1a] to-transparent" />
            <div className="absolute bottom-4 left-4">
              <Badge className="bg-amber-500/90 text-white border-0 text-[10px] mb-1">3 Dormitórios</Badge>
              <p className="text-2xl font-black text-white">173,71m²</p>
              <p className="text-white/60 text-[10px]">Opções com suíte ou estar e office</p>
            </div>
          </div>
          <CardContent className="pt-4 space-y-3">
            <div className="space-y-1.5">
              {["Suíte", "Terraço com estar e office", "Pátio privativo", "Espaço para spa ou piscina", "2 vagas", "Espera para lareira"].map((f) => (
                <div key={f} className="flex items-center gap-2 text-xs text-foreground/80">
                  <BadgeCheck className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                  {f}
                </div>
              ))}
            </div>
            <div className="pt-2 border-t border-border/50">
              <p className="text-[10px] text-muted-foreground">A partir de</p>
              <p className="text-xl font-black text-amber-600">R$ 909.200</p>
            </div>
            <Button variant="outline" size="sm" className="w-full text-xs gap-1.5" onClick={() => setShowPlants(showPlants === "3d" ? null : "3d")}>
              <FileText className="h-3.5 w-3.5" /> {showPlants === "3d" ? "Ocultar" : "Ver"} Plantas
            </Button>
            {showPlants === "3d" && (
              <div className="grid grid-cols-3 gap-2 pt-2">
                {PLANT_IMAGES["3d"].map((p) => (
                  <div key={p.label} className="cursor-pointer" onClick={() => setLightboxImg(p.url)}>
                    <img src={p.url} alt={p.label} className="rounded-lg w-full aspect-square object-cover border border-border/50" loading="lazy" />
                    <p className="text-[9px] text-center text-muted-foreground mt-1">{p.label}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ═══ TABELA UNIDADES ═══ */}
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Building2 className="h-4 w-4 text-amber-500" /> Unidades Disponíveis — Tabela Fevereiro 2026
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={showUnits === "fase1" ? "default" : "outline"}
              className="text-xs"
              onClick={() => setShowUnits(showUnits === "fase1" ? null : "fase1")}
            >
              Fase 1 ({FASE1_UNITS.length} un.)
            </Button>
            <Button
              size="sm"
              variant={showUnits === "fase2" ? "default" : "outline"}
              className="text-xs"
              onClick={() => setShowUnits(showUnits === "fase2" ? null : "fase2")}
            >
              Fase 2 ({FASE2_UNITS.length} un.)
            </Button>
          </div>

          {showUnits && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-left py-2 px-2 text-muted-foreground font-medium">Tipo</th>
                    <th className="text-left py-2 px-2 text-muted-foreground font-medium">Unidade</th>
                    <th className="text-left py-2 px-2 text-muted-foreground font-medium">Área</th>
                    <th className="text-right py-2 px-2 text-muted-foreground font-medium">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {(showUnits === "fase1" ? FASE1_UNITS : FASE2_UNITS).map((u) => (
                    <tr key={u.unidade} className="border-b border-border/20 hover:bg-muted/30">
                      <td className="py-2 px-2">
                        <Badge variant="outline" className="text-[9px]">{u.bloco}</Badge>
                      </td>
                      <td className="py-2 px-2 font-semibold">{u.unidade}</td>
                      <td className="py-2 px-2 text-muted-foreground">{u.area}</td>
                      <td className="py-2 px-2 text-right font-bold text-amber-600">{u.valor}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ═══ CONDIÇÕES DE PAGAMENTO ═══ */}
      <Card className="border-amber-200/60 overflow-hidden">
        <CardHeader className="pb-2 bg-gradient-to-r from-amber-50 to-yellow-50">
          <CardTitle className="text-sm flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-amber-500" /> Condições de Pagamento
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-3 space-y-2">
          {PAYMENT_CONDITIONS.map((c) => (
            <div key={c} className="flex items-center gap-2 text-xs text-foreground/80">
              <BadgeCheck className="h-3.5 w-3.5 text-amber-500 shrink-0" />
              {c}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* ═══ LOCALIZAÇÃO ═══ */}
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Navigation className="h-4 w-4 text-amber-500" /> Localização — Entre a Zona Sul e Zona Norte
          </CardTitle>
          <p className="text-[10px] text-muted-foreground">Av. Engenheiro Ludolfo Boehl, 931 | Teresópolis | Porto Alegre, RS</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {PROXIMIDADES.map((p) => (
              <div key={p.local} className="bg-muted/50 rounded-lg p-2.5 text-center">
                <p className="text-xs font-bold text-amber-600">{p.tempo}</p>
                <p className="text-[9px] text-muted-foreground leading-tight mt-0.5">{p.local}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ═══ COMO VENDER ═══ */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-2 cursor-pointer select-none" onClick={() => setShowArguments(!showArguments)}>
          <CardTitle className="text-sm flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" /> Como Vender o Orygem — {BROKER_ARGUMENTS.length} Argumentos
            {showArguments ? <ChevronUp className="h-4 w-4 ml-auto text-muted-foreground" /> : <ChevronDown className="h-4 w-4 ml-auto text-muted-foreground" />}
          </CardTitle>
        </CardHeader>
        {showArguments && (
          <CardContent className="space-y-2 pt-0">
            {BROKER_ARGUMENTS.map((arg, i) => (
              <div key={i} className="flex items-start gap-2">
                <div className="w-5 h-5 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Star className="h-3 w-3 text-amber-600" />
                </div>
                <p className="text-xs text-foreground/80">{arg}</p>
              </div>
            ))}
          </CardContent>
        )}
      </Card>

      {/* ═══ SCRIPTS WHATSAPP ═══ */}
      <Card className="border-green-200/50">
        <CardHeader className="pb-2 cursor-pointer select-none" onClick={() => setShowScripts(!showScripts)}>
          <CardTitle className="text-sm flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-green-600" /> Scripts WhatsApp ({SCRIPTS.length})
            {showScripts ? <ChevronUp className="h-4 w-4 ml-auto text-muted-foreground" /> : <ChevronDown className="h-4 w-4 ml-auto text-muted-foreground" />}
          </CardTitle>
        </CardHeader>
        {showScripts && (
          <CardContent className="space-y-3 pt-0">
            {SCRIPTS.map((script, i) => (
              <div key={i} className="bg-green-50/50 border border-green-100 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-[10px] border-green-200 text-green-700">{script.title}</Badge>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyToClipboard(script.text)}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <p className="text-xs text-foreground/80 whitespace-pre-line leading-relaxed">{script.text}</p>
              </div>
            ))}
          </CardContent>
        )}
      </Card>

      {/* ═══ QUICK ACTIONS ═══ */}
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-500" /> Ações Rápidas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {[
              { icon: Calendar, label: "Agendar visita", color: "bg-amber-500 hover:bg-amber-600", action: () => toast.info("Funcionalidade em breve") },
              { icon: Target, label: "Abrir pipeline", color: "bg-primary hover:bg-primary/90", action: () => navigate("/pipeline-leads") },
              { icon: Send, label: "Enviar WhatsApp", color: "bg-green-600 hover:bg-green-700", action: () => { setShowScripts(true); toast.info("Copie um script acima"); } },
              { icon: FileText, label: "Enviar plantas", color: "bg-blue-600 hover:bg-blue-700", action: () => toast.info("Funcionalidade em breve") },
              { icon: DollarSign, label: "Gerar proposta", color: "bg-amber-600 hover:bg-amber-700", action: () => toast.info("Funcionalidade em breve") },
            ].map((btn) => (
              <Button
                key={btn.label}
                size="sm"
                className={`gap-1.5 text-white border-0 text-xs ${btn.color}`}
                onClick={btn.action}
              >
                <btn.icon className="h-3.5 w-3.5" />
                {btn.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ═══ IMAGE GALLERY ═══ */}
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Eye className="h-4 w-4 text-amber-500" /> Galeria do Empreendimento ({GALLERY_IMAGES.length} imagens)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-1.5 flex-wrap">
            {[
              { key: "todos", label: "Todos" },
              { key: "fachada", label: "Fachada" },
              { key: "lazer", label: "Lazer" },
              { key: "interior", label: "Interior" },
            ].map((f) => (
              <Button
                key={f.key}
                size="sm"
                variant={galleryFilter === f.key ? "default" : "outline"}
                className="text-[10px] h-7 px-2.5"
                onClick={() => setGalleryFilter(f.key)}
              >
                {f.label}
              </Button>
            ))}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {filteredGallery.map((img) => (
              <div
                key={img.label}
                className="relative group rounded-xl overflow-hidden aspect-[4/3] cursor-pointer"
                onClick={() => setLightboxImg(img.url)}
              >
                <img
                  src={img.url}
                  alt={img.label}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <span className="absolute bottom-2 left-2 text-white text-xs font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                  {img.label}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ═══ IMPLANTAÇÃO ═══ */}
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <MapPin className="h-4 w-4 text-amber-500" /> Implantação do Condomínio
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl overflow-hidden cursor-pointer" onClick={() => setLightboxImg("/images/orygem/implantacao.jpg")}>
            <img src="/images/orygem/implantacao.jpg" alt="Implantação Orygem" className="w-full rounded-xl" loading="lazy" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
