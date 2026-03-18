import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  Building2, Phone, MessageSquare, Copy, ExternalLink, MapPin,
  Maximize2, Tag, Clock, Sparkles, Trophy, Plane, Users, Target,
  Star, TrendingUp, ShieldCheck, FileText, Zap, Gift, Search,
  DollarSign, Home, Share2, Link2, Loader2, CheckSquare, Send,
  ChevronLeft, ChevronRight, Calendar, Percent, CreditCard, HandCoins
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getVitrineShareUrl } from "@/lib/vitrineUrl";


// Images
import imgConnectJoaoWallig from "@/assets/cyrela/connect-joao-wallig.jpeg";
import imgJpRedencao from "@/assets/cyrela/jp-redencao.jpeg";
import imgFelixMoinhos from "@/assets/cyrela/felix-moinhos.jpeg";
import imgVistaPraiaBelas from "@/assets/cyrela/vista-praia-belas.jpeg";
import imgVistaNovaCarlosGomes from "@/assets/cyrela/vista-nova-carlos-gomes.jpeg";
import imgVistaMeninoDeus from "@/assets/cyrela/vista-menino-deus.jpeg";
import imgTheArch from "@/assets/cyrela/the-arch.jpeg";
import imgSkylineParqueMoinhos from "@/assets/cyrela/skyline-parque-moinhos.jpeg";
import imgPrimeWallig from "@/assets/cyrela/prime-wallig.jpeg";
import imgPrimeAltosGermania from "@/assets/cyrela/prime-altos-germania.jpeg";
import imgBoaVistaCountryClub from "@/assets/cyrela/boa-vista-country-club.jpeg";
import imgArbo from "@/assets/cyrela/arbo.jpeg";
import imgThePark from "@/assets/cyrela/the-park.jpeg";
import imgGardenHaus from "@/assets/cyrela/garden-haus.jpeg";
import imgVistaNovaCarlosGomes2d from "@/assets/cyrela/vista-nova-carlos-gomes-2d.jpeg";
import imgTheArch2d from "@/assets/cyrela/the-arch-2d.jpeg";
import imgPrimeWish from "@/assets/cyrela/prime-wish.jpeg";
import imgAtmosferaAirDuplex from "@/assets/cyrela/atmosfera-air-duplex.jpeg";
import imgConnectPartenon from "@/assets/cyrela/connect-partenon.jpeg";
import imgPrimeWallig2d from "@/assets/cyrela/prime-wallig-2d.jpeg";
import imgBoaVistaCountryClub2d from "@/assets/cyrela/boa-vista-country-club-2d.jpeg";
import imgArbo2d from "@/assets/cyrela/arbo-2d.jpeg";
import imgVintage from "@/assets/cyrela/vintage.jpeg";
import imgTheArch1d from "@/assets/cyrela/the-arch-1d.jpeg";
import imgFloat from "@/assets/cyrela/float.jpeg";
import imgConnectJoaoWallig1d from "@/assets/cyrela/connect-joao-wallig-1d.jpeg";
import imgAtmosferaAir1d from "@/assets/cyrela/atmosfera-air-1d.jpeg";

/* ═══════════════════════════════════════════
   DATA
   ═══════════════════════════════════════════ */

type Empreendimento = {
  nome: string;
  tipologia: string;
  bairro: string;
  fase: string;
  unidade: string;
  metragem?: string;
  valor: string;
  imagem?: string;
};

const CATEGORIAS: Record<string, {
  label: string;
  emoji: string;
  empreendimentos: Empreendimento[];
}> = {
  studios: {
    label: "Studios / Compactos",
    emoji: "🏢",
    empreendimentos: [
      { nome: "Connect João Wallig", tipologia: "Studio", bairro: "Passo D'Areia", fase: "Pronto", unidade: "314", valor: "R$ 299.328", imagem: imgConnectJoaoWallig },
      { nome: "JP Redenção", tipologia: "Studio", bairro: "Cidade Baixa", fase: "Pronto", unidade: "317", valor: "R$ 324.111", imagem: imgJpRedencao },
      { nome: "Félix Moinhos", tipologia: "Studio", bairro: "Moinhos de Vento", fase: "Em construção · Entrega 2028", unidade: "322", valor: "R$ 352.578", imagem: imgFelixMoinhos },
      { nome: "Vista Praia de Belas", tipologia: "Studio", bairro: "Menino Deus / Praia de Belas", fase: "Em construção", unidade: "204", valor: "R$ 308.860", imagem: imgVistaPraiaBelas },
      { nome: "Vista Nova Carlos Gomes", tipologia: "Studio", bairro: "Petrópolis", fase: "Em construção", unidade: "210", valor: "R$ 380.332", imagem: imgVistaNovaCarlosGomes },
      { nome: "Vista Menino Deus", tipologia: "Studio", bairro: "Menino Deus", fase: "Em construção", unidade: "208", valor: "R$ 404.611", imagem: imgVistaMeninoDeus },
      { nome: "The Arch", tipologia: "Studio", bairro: "Bela Vista", fase: "Pronto para morar", unidade: "316", valor: "R$ 365.705", imagem: imgTheArch },
      { nome: "Skyline Parque Moinhos", tipologia: "Studio", bairro: "Moinhos de Vento", fase: "Pronto para morar", unidade: "217", valor: "R$ 373.742", imagem: imgSkylineParqueMoinhos },
      { nome: "Connect Partenon", tipologia: "Studio", bairro: "Partenon", fase: "Pronto para morar", unidade: "1813", valor: "R$ 315.080", imagem: imgConnectPartenon },
    ],
  },
  "1dorm": {
    label: "1 Dormitório",
    emoji: "🛏️",
    empreendimentos: [
      { nome: "Connect João Wallig", tipologia: "1 dormitório", bairro: "Passo D'Areia", fase: "Pronto para morar", unidade: "419", metragem: "43 m²", valor: "R$ 431.820", imagem: imgConnectJoaoWallig1d },
      { nome: "Atmosfera Air", tipologia: "1 dormitório", bairro: "Menino Deus", fase: "Pronto para morar", unidade: "608", metragem: "56 m²", valor: "R$ 627.186", imagem: imgAtmosferaAir1d },
      { nome: "Float Residences", tipologia: "1 dormitório", bairro: "Petrópolis", fase: "Pronto para morar", unidade: "1605", metragem: "43 m²", valor: "R$ 569.320", imagem: imgFloat },
      { nome: "Vintage Senior Residence", tipologia: "1 dormitório", bairro: "Petrópolis", fase: "Pronto para morar", unidade: "806", metragem: "37 m²", valor: "R$ 484.386", imagem: imgVintage },
      { nome: "The Arch", tipologia: "1 dormitório", bairro: "Bela Vista", fase: "Pronto para morar", unidade: "203", metragem: "45 m²", valor: "R$ 679.127", imagem: imgTheArch1d },
    ],
  },
  "2dorms": {
    label: "2 Dormitórios",
    emoji: "🏠",
    empreendimentos: [
      { nome: "Prime Wish", tipologia: "2 dormitórios", bairro: "São Geraldo", fase: "Pronto para morar", unidade: "203", metragem: "56 m²", valor: "R$ 429.460", imagem: imgPrimeWish },
      { nome: "Prime Wallig", tipologia: "2 dormitórios", bairro: "Passo D'Areia", fase: "Pronto para morar", unidade: "1504", metragem: "56 m²", valor: "R$ 513.428", imagem: imgPrimeWallig2d },
      { nome: "Boa Vista Country Club", tipologia: "2 dormitórios", bairro: "Boa Vista", fase: "Pronto para morar", unidade: "207", metragem: "70 m²", valor: "R$ 725.103", imagem: imgBoaVistaCountryClub2d },
      { nome: "Vista Nova Carlos Gomes", tipologia: "2 dormitórios", bairro: "Petrópolis", fase: "Em construção", unidade: "402", metragem: "68 m²", valor: "R$ 847.254", imagem: imgVistaNovaCarlosGomes2d },
      { nome: "Arbo", tipologia: "2 dormitórios", bairro: "Higienópolis", fase: "Em construção", unidade: "303", metragem: "68 m²", valor: "R$ 811.918", imagem: imgArbo2d },
      { nome: "Boa Vista Country Club", tipologia: "2 dormitórios", bairro: "Boa Vista", fase: "Pronto", unidade: "1008", metragem: "69 m²", valor: "R$ 812.752", imagem: imgBoaVistaCountryClub },
      { nome: "The Arch", tipologia: "2 dormitórios", bairro: "Bela Vista", fase: "Pronto para morar", unidade: "501", metragem: "70 m²", valor: "R$ 1.075.358", imagem: imgTheArch2d },
    ],
  },
  "3dorms": {
    label: "3 Dormitórios",
    emoji: "🏡",
    empreendimentos: [
      { nome: "Prime Wallig", tipologia: "3 dormitórios", bairro: "Passo D'Areia", fase: "Pronto para morar", unidade: "1210", metragem: "67 m²", valor: "R$ 610.448", imagem: imgPrimeWallig },
      { nome: "Prime Altos do Germânia", tipologia: "3 dormitórios", bairro: "Passo D'Areia", fase: "Pronto para morar", unidade: "1509", metragem: "67 m²", valor: "R$ 583.064", imagem: imgPrimeAltosGermania },
      { nome: "Boa Vista Country Club", tipologia: "3 dormitórios", bairro: "Boa Vista", fase: "Pronto para morar", unidade: "201", metragem: "93 m²", valor: "R$ 1.022.390", imagem: imgBoaVistaCountryClub },
      { nome: "Arbo", tipologia: "3 dormitórios", bairro: "Higienópolis", fase: "Em construção", unidade: "201", metragem: "106 m²", valor: "R$ 1.308.645", imagem: imgArbo },
    ],
  },
  "3suites": {
    label: "3 Suítes",
    emoji: "👑",
    empreendimentos: [
      { nome: "The Park", tipologia: "3 suítes", bairro: "Rio Branco", fase: "Pronto para morar", unidade: "704 ART", metragem: "144 m²", valor: "R$ 1.991.456", imagem: imgThePark },
      { nome: "Garden Haus", tipologia: "3 suítes", bairro: "Jardim Europa", fase: "Pronto para morar", unidade: "403", metragem: "159 m²", valor: "R$ 2.854.137", imagem: imgGardenHaus },
    ],
  },
  duplex: {
    label: "Duplex",
    emoji: "🏰",
    empreendimentos: [
      { nome: "Atmosfera Air", tipologia: "Duplex", bairro: "Menino Deus", fase: "Pronto para morar", unidade: "1707", metragem: "98 m²", valor: "R$ 1.358.368", imagem: imgAtmosferaAirDuplex },
    ],
  },
};

const SCRIPTS = {
  studios: `Oi {{nome}}! Tudo bem?\n\nEstou com oportunidades da Mega da Cyrela até 30/04, com studios em localizações muito fortes de Porto Alegre e condições especiais de campanha. Tenho opções a partir de R$ 299 mil. Quer que eu te mande as melhores?`,
  "1dorm": `Oi {{nome}}! Tudo bem?\n\nEstou com oportunidades incríveis da Seleção Cyrela até 30/04, com apartamentos de 1 dormitório em localizações premium de Porto Alegre — Menino Deus, Petrópolis, Bela Vista. Tenho opções a partir de R$ 431 mil prontas para morar. Quer que eu te mostre?`,
  "2dorms": `Oi {{nome}}! Passando porque a Mega da Cyrela está com ótimas oportunidades até 30/04 para 2 dormitórios em regiões muito procuradas. Tem opções prontas e em construção, com condições especiais e possibilidade de parcelamento direto. Quer que eu te mostre as melhores unidades?`,
  "3dorms": `{{nome}}, estou com uma seleção muito boa da Mega da Cyrela para 3 dormitórios, inclusive oportunidades prontas e outras em construção em bairros fortes de Porto Alegre. Posso te mandar as unidades mais alinhadas ao teu perfil?`,
  "3suites": `Oi {{nome}}! Estou com uma seleção premium da Mega da Cyrela até 30/04, com unidades de 3 suítes em Rio Branco, Jardim Europa e outras regiões nobres. São oportunidades especiais de campanha. Quer que eu te envie as melhores opções?`,
  duplex: `Oi {{nome}}! Tenho uma oportunidade especial da Seleção Cyrela — um duplex de 98 m² no Menino Deus, pronto para morar, com condições exclusivas da campanha até 30/04. Quer que eu te envie os detalhes?`,
};

const OBJECOES = [
  { q: "Vou esperar", a: "A campanha Mega da Cyrela é por tempo limitado — até 30 de abril! As condições de taxas especiais, parcelamento direto e estudo de dação são exclusivas desta ação. Esperar pode significar perder a unidade selecionada e as condições diferenciadas." },
  { q: "Quero comparar", a: "Ótimo! Na própria campanha temos empreendimentos de studios até 3 suítes, em diferentes bairros e faixas de preço. Posso montar um comparativo para você com as melhores opções alinhadas ao seu perfil, com todos os detalhes e condições." },
  { q: "Não sei se consigo financiar", a: "A Mega da Cyrela oferece taxas de financiamento especiais a partir de 10,63% com a Caixa, além de parcelamento direto em até 240x com ato de 30%, parcelas lineares e sem reforços. Temos condições para diferentes perfis!" },
  { q: "Preciso vender meu imóvel", a: "A campanha aceita estudo de dações! Imóveis quitados e prontos em Porto Alegre e condomínios no litoral, com avaliação de até 40% do novo negócio. Podemos analisar juntos se seu imóvel se enquadra." },
  { q: "Não quero decidir agora", a: "Entendo perfeitamente. Mas as unidades selecionadas para a Mega da Cyrela são limitadas e a campanha encerra em 30 de abril. Posso reservar um horário para você conhecer sem compromisso — assim você decide com segurança." },
];

/* ═══════════════════════════════════════════
   COUNTDOWN
   ═══════════════════════════════════════════ */

function CountdownTimer() {
  const target = new Date("2026-04-30T23:59:59").getTime();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const diff = Math.max(0, target - now);
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);

  return (
    <div className="flex gap-2 mt-2">
      {[
        { v: d, l: "dias" },
        { v: h, l: "horas" },
        { v: m, l: "min" },
        { v: s, l: "seg" },
      ].map((t) => (
        <div key={t.l} className="text-center">
          <div className="bg-[#1a3d2e] border border-[#d4af37]/30 rounded-lg px-3 py-1.5 min-w-[48px]">
            <span className="text-lg font-black text-[#d4af37]">{String(t.v).padStart(2, "0")}</span>
          </div>
          <span className="text-[9px] text-white/40 mt-0.5 block">{t.l}</span>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════
   CARD COMPONENT
   ═══════════════════════════════════════════ */

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text);
  toast.success("Copiado!");
}

function EmpreendimentoCard({ emp, selected, onToggle, onOpen }: { emp: Empreendimento; selected: boolean; onToggle: () => void; onOpen: () => void }) {
  const gerarMsg = () => {
    let msg = `🏠 *${emp.nome}* — Mega da Cyrela 2026\n`;
    msg += `📍 ${emp.bairro}\n`;
    msg += `🛏 ${emp.tipologia}`;
    if (emp.metragem) msg += ` · ${emp.metragem}`;
    msg += `\n`;
    msg += `🏗 ${emp.fase}\n`;
    msg += `💰 A partir de *${emp.valor}* — Un. ${emp.unidade}\n`;
    msg += `📅 Condições exclusivas até 30/04!\n`;
    msg += `\nQuer saber mais? Me chama! 😊`;
    return msg;
  };

  return (
    <Card className={`overflow-hidden hover:shadow-lg transition-all duration-200 border-[#1a3d2e]/20 group relative ${selected ? "ring-2 ring-[#d4af37] border-[#d4af37]" : ""}`}>
      <div className="absolute top-2 left-2 z-10" onClick={(e) => e.stopPropagation()}>
        <Checkbox checked={selected} onCheckedChange={onToggle} className="bg-white/90 border-2" />
      </div>
      <div className="absolute top-2 right-2 z-10 flex gap-1" onClick={(e) => e.stopPropagation()}>
        <button onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(gerarMsg())}`, "_blank")} className="bg-emerald-500 text-white rounded-full p-1.5 shadow-lg hover:bg-emerald-600 transition-colors" title="WhatsApp">
          <Phone className="h-3 w-3" />
        </button>
        <button onClick={() => copyToClipboard(gerarMsg())} className="bg-white/90 text-slate-700 rounded-full p-1.5 shadow-lg hover:bg-white transition-colors" title="Copiar">
          <Copy className="h-3 w-3" />
        </button>
      </div>

      {emp.imagem ? (
        <div className="relative h-36 cursor-pointer" onClick={onOpen}>
          <img src={emp.imagem} alt={emp.nome} className="w-full h-full object-cover" />
          <Badge className="absolute bottom-2 left-2 text-[9px] py-0 bg-[#0d3320] text-white border-0" >{emp.fase}</Badge>
        </div>
      ) : (
        <div className="relative h-36 bg-gradient-to-br from-[#0d3320] to-[#1a5c3a] flex items-center justify-center cursor-pointer" onClick={onOpen}>
          <Building2 className="h-10 w-10 text-[#d4af37]/30" />
          <Badge className="absolute bottom-2 left-2 text-[9px] py-0 bg-white/20 text-white border-0">{emp.fase}</Badge>
        </div>
      )}

      <CardContent className="p-3 space-y-1 cursor-pointer" onClick={onOpen}>
        <h4 className="font-bold text-sm leading-tight truncate">{emp.nome}</h4>
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <MapPin className="h-3 w-3 shrink-0" /> {emp.bairro}
        </div>
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <Home className="h-3 w-3 shrink-0" /> {emp.tipologia}{emp.metragem ? ` · ${emp.metragem}` : ""}
        </div>
        <div className="text-[10px] text-muted-foreground">Un. {emp.unidade}</div>
        <div className="pt-1.5 border-t border-border/30">
          <p className="text-sm font-bold text-[#d4af37]">{emp.valor}</p>
        </div>
      </CardContent>
    </Card>
  );
}

/* ═══════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════ */

export default function MegaCyrela() {
  const navigate = useNavigate();
  const catKeys = Object.keys(CATEGORIAS);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("studios");
  const [selectedEmps, setSelectedEmps] = useState<Set<string>>(new Set());
  const [showVitrineDialog, setShowVitrineDialog] = useState(false);
  const [vitrineTitle, setVitrineTitle] = useState("Mega da Cyrela 2026");
  const [vitrineMsg, setVitrineMsg] = useState("");
  const [creatingVitrine, setCreatingVitrine] = useState(false);
  const [vitrineLink, setVitrineLink] = useState<string | null>(null);
  const [detailEmp, setDetailEmp] = useState<Empreendimento | null>(null);

  const toggleEmp = (key: string) => {
    setSelectedEmps((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const allEmps = catKeys.flatMap((k) =>
    CATEGORIAS[k].empreendimentos.map((emp) => ({ ...emp, categoria: CATEGORIAS[k].label }))
  );
  const empKey = (emp: Empreendimento) => `${emp.nome}-${emp.tipologia}-${emp.unidade}`;
  const selectedEmpData = allEmps.filter((emp) => selectedEmps.has(empKey(emp)));

  const sharePageLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success("Link da página copiado!");
  };

  return (
      <div className="space-y-5 pb-24">
        {/* ═══ HERO ═══ */}
        <div className="relative rounded-xl overflow-hidden p-5 md:p-8" style={{ background: "linear-gradient(135deg, #0a1f14 0%, #0d3320 40%, #1a5c3a 100%)" }}>
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "url('data:image/svg+xml,%3Csvg width=\"60\" height=\"60\" viewBox=\"0 0 60 60\" xmlns=\"http://www.w3.org/2000/svg\"%3E%3Cpath d=\"M30 5 L55 30 L30 55 L5 30Z\" fill=\"none\" stroke=\"%23d4af37\" stroke-width=\"0.5\"/%3E%3C/svg%3E')", backgroundSize: "60px 60px" }} />
          <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-[#d4af37]/5 to-transparent" />
          <div className="relative z-10 space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className="bg-[#d4af37] text-[#0a1f14] border-0 text-xs font-bold px-3">⚽ SELEÇÃO CYRELA</Badge>
              <Badge variant="outline" className="border-[#d4af37]/30 text-[#d4af37]/80 text-[10px]">Até 30 de Abril</Badge>
              <Badge variant="outline" className="border-white/20 text-white/50 text-[10px]">Os melhores endereços · As maiores oportunidades</Badge>
            </div>
            <h1 className="text-2xl md:text-4xl font-black text-white leading-tight">
              Mega da Cyrela <span className="text-[#d4af37]">2026</span>
            </h1>
            <p className="text-white/60 text-sm leading-relaxed max-w-lg">
              Os melhores endereços, as maiores oportunidades. Studios, 2 dormitórios, 3 dormitórios e 3 suítes em Porto Alegre com <strong className="text-[#d4af37]">taxas especiais</strong>, <strong className="text-[#d4af37]">parcelamento direto</strong> e <strong className="text-[#d4af37]">estudo de dação</strong>.
            </p>

            <div className="flex gap-2 flex-wrap">
              {["Taxas especiais", "Parcelamento direto", "Estudo de dação", "Seleção campeã"].map((b) => (
                <Badge key={b} variant="outline" className="border-[#d4af37]/40 text-[#d4af37] text-[10px] bg-[#d4af37]/5">{b}</Badge>
              ))}
            </div>

            <CountdownTimer />

            <div className="flex gap-2 pt-1 flex-wrap">
              <Button size="sm" className="gap-1.5 bg-[#d4af37] hover:bg-[#c49b2f] text-[#0a1f14] border-0 font-bold" onClick={() => window.open("https://www.cyrela.com.br", "_blank")}>
                <ExternalLink className="h-3.5 w-3.5" /> Site Oficial
              </Button>
              <Button size="sm" className="gap-1.5 bg-white/10 hover:bg-white/20 text-white border border-white/20" onClick={() => navigate("/oferta-ativa")}>
                <Zap className="h-3.5 w-3.5" /> Iniciar Oferta Ativa
              </Button>
              <Button size="sm" className="gap-1.5 bg-white/10 hover:bg-white/20 text-white border border-white/20" onClick={() => navigate("/pipeline-leads")}>
                <Target className="h-3.5 w-3.5" /> Meu Pipeline
              </Button>
              <Button size="sm" className="gap-1.5 bg-white/10 hover:bg-white/20 text-white border border-white/20" onClick={() => {
                const el = document.getElementById("cyrela-categorias");
                el?.scrollIntoView({ behavior: "smooth" });
              }}>
                <Building2 className="h-3.5 w-3.5" /> Ver Seleções
              </Button>
              <Button size="sm" className="gap-1.5 bg-white/10 hover:bg-white/20 text-white border border-white/20" onClick={sharePageLink}>
                <Share2 className="h-3.5 w-3.5" /> Enviar Página
              </Button>
            </div>
          </div>
        </div>

        {/* ═══ KPIs ═══ */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {[
            { icon: Building2, value: "18", label: "Empreendimentos", color: "text-[#d4af37]" },
            { icon: Home, value: "4", label: "Faixas de tipologia", color: "text-emerald-500" },
            { icon: Percent, value: "10,63%", label: "Taxa a partir de", color: "text-blue-500" },
            { icon: Trophy, value: "4% + 2%", label: "Bateu-Levou", color: "text-purple-500" },
          ].map((s) => (
            <Card key={s.label} className="p-3 border-border/50 text-center">
              <s.icon className={`h-5 w-5 mx-auto mb-1 ${s.color}`} />
              <p className={`text-lg md:text-xl font-black ${s.color}`}>{s.value}</p>
              <p className="text-[10px] text-muted-foreground leading-tight">{s.label}</p>
            </Card>
          ))}
        </div>

        <p className="text-xs text-muted-foreground text-center px-4 leading-relaxed max-w-2xl mx-auto">
          A campanha reúne empreendimentos em Porto Alegre com oportunidades em studios, 2 dormitórios, 3 dormitórios e 3 suítes. Financiamento especial, parcelamento direto em até 240x e estudo de dações conforme condições da campanha.
        </p>

        {/* ═══ COMO VENDER ═══ */}
        <Card className="border-[#1a5c3a]/30 bg-[#0d3320]/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Target className="h-4 w-4 text-[#d4af37]" /> Como Vender na Mega da Cyrela
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              { icon: Users, text: "Identificar rapidamente a tipologia ideal para o cliente" },
              { icon: Clock, text: "Usar a escassez da campanha — válida até 30 de abril" },
              { icon: Percent, text: "Reforçar taxas especiais e parcelamento direto em até 240x" },
              { icon: HandCoins, text: "Explorar dação para destravar clientes que precisam vender seu imóvel" },
              { icon: MapPin, text: "Levar cliente para visita / decorado / obra" },
              { icon: MessageSquare, text: "Usar as vitrines prontas para WhatsApp" },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-2">
                <div className="w-5 h-5 rounded-full bg-[#d4af37]/10 flex items-center justify-center shrink-0 mt-0.5">
                  <item.icon className="h-3 w-3 text-[#d4af37]" />
                </div>
                <p className="text-xs text-foreground/80">{item.text}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* ═══ PLANO DE JOGO ═══ */}
        <div className="grid md:grid-cols-3 gap-3">
          <Card className="border-[#1a5c3a]/30 bg-gradient-to-br from-[#0d3320]/5 to-transparent">
            <CardContent className="p-4 space-y-2">
              <div className="w-10 h-10 rounded-xl bg-[#d4af37]/10 flex items-center justify-center">
                <Percent className="h-5 w-5 text-[#d4af37]" />
              </div>
              <h4 className="text-sm font-bold">Taxas de Financiamento Especiais</h4>
              <p className="text-[11px] text-muted-foreground leading-relaxed">A partir de 10,63% com a Caixa, consultar empreendimentos participantes.</p>
            </CardContent>
          </Card>
          <Card className="border-[#1a5c3a]/30 bg-gradient-to-br from-[#0d3320]/5 to-transparent">
            <CardContent className="p-4 space-y-2">
              <div className="w-10 h-10 rounded-xl bg-[#d4af37]/10 flex items-center justify-center">
                <CreditCard className="h-5 w-5 text-[#d4af37]" />
              </div>
              <h4 className="text-sm font-bold">Parcelamento Direto</h4>
              <p className="text-[11px] text-muted-foreground leading-relaxed">Em até 240x. Ato de 30%, parcelas lineares, sem reforços. IPCA + 12% a.a.</p>
            </CardContent>
          </Card>
          <Card className="border-[#1a5c3a]/30 bg-gradient-to-br from-[#0d3320]/5 to-transparent">
            <CardContent className="p-4 space-y-2">
              <div className="w-10 h-10 rounded-xl bg-[#d4af37]/10 flex items-center justify-center">
                <HandCoins className="h-5 w-5 text-[#d4af37]" />
              </div>
              <h4 className="text-sm font-bold">Estudo de Dações</h4>
              <p className="text-[11px] text-muted-foreground leading-relaxed">Porto Alegre e condomínios no litoral. Até 40% do novo negócio, mediante avaliação, somente imóveis quitados e prontos.</p>
            </CardContent>
          </Card>
        </div>

        {/* ═══ PREMIAÇÃO ═══ */}
        <Card className="border-[#d4af37]/30 overflow-hidden" style={{ background: "linear-gradient(135deg, #0d3320 0%, #1a5c3a 100%)" }}>
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-[#d4af37]" />
              <h3 className="text-lg font-black text-white">Premiação</h3>
            </div>

            <div className="bg-white/10 rounded-xl p-4 border border-[#d4af37]/20">
              <p className="text-white/80 text-sm mb-2">👕 Todas as vendas ganharão <strong className="text-[#d4af37]">camiseta oficial da seleção brasileira</strong></p>
              <div className="bg-[#d4af37]/20 rounded-lg p-3 text-center">
                <p className="text-2xl font-black text-[#d4af37]">4% + 2% bateu-levou</p>
                <p className="text-white/60 text-xs mt-1">Garantido em todas as vendas da campanha</p>
              </div>
            </div>

            <div className="bg-white/10 rounded-xl p-4 border border-[#d4af37]/20 space-y-2">
              <div className="flex items-center gap-2">
                <Plane className="h-4 w-4 text-[#d4af37]" />
                <p className="text-sm font-bold text-white">Premiação Especial — Sorteio</p>
              </div>
              <p className="text-white/70 text-xs leading-relaxed">
                Sorteio para você e um acompanhante na <strong className="text-[#d4af37]">Copa do Mundo</strong>!
              </p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  "✈️ Passagens para os EUA",
                  "🎫 Ingressos 1ª fase",
                  "🏨 Hospedagem",
                  "💰 R$ 10 mil para despesas",
                ].map((item) => (
                  <div key={item} className="bg-white/5 rounded-lg p-2 text-[11px] text-white/80">{item}</div>
                ))}
              </div>
              <p className="text-[10px] text-white/40 italic">* Consultar regulamento</p>
            </div>
          </CardContent>
        </Card>

        {/* ═══ BUSCA ═══ */}
        <div className="relative" id="cyrela-categorias">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar empreendimento ou bairro..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-border bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#d4af37]/30"
          />
        </div>

        {/* ═══ TABS POR TIPOLOGIA ═══ */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="w-full flex-wrap h-auto gap-1 bg-muted/50 p-1">
            {catKeys.map((k) => (
              <TabsTrigger key={k} value={k} className="text-[11px] flex-1 min-w-[60px] gap-1 py-2">
                <span>{CATEGORIAS[k].emoji}</span>
                <span className="hidden sm:inline">{CATEGORIAS[k].label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {catKeys.map((k) => {
            const cat = CATEGORIAS[k];
            const q = search.toLowerCase().trim();
            const emps = q ? cat.empreendimentos.filter((e) => e.nome.toLowerCase().includes(q) || e.bairro.toLowerCase().includes(q)) : cat.empreendimentos;
            return (
              <TabsContent key={k} value={k} className="space-y-4 mt-0">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-[#d4af37]" />
                      {cat.label} ({emps.length})
                    </h3>
                    <Button
                      variant="ghost" size="sm" className="text-[11px] gap-1 h-7"
                      onClick={() => {
                        const allKeys = emps.map(empKey);
                        const allSelected = allKeys.every((n) => selectedEmps.has(n));
                        setSelectedEmps((prev) => {
                          const next = new Set(prev);
                          allKeys.forEach((n) => allSelected ? next.delete(n) : next.add(n));
                          return next;
                        });
                      }}
                    >
                      <CheckSquare className="h-3 w-3" />
                      {emps.every((e) => selectedEmps.has(empKey(e))) ? "Desmarcar todos" : "Selecionar todos"}
                    </Button>
                  </div>
                  {emps.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-8">Nenhum empreendimento encontrado para "{search}"</p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                      {emps.map((emp, i) => (
                        <EmpreendimentoCard
                          key={i}
                          emp={emp}
                          selected={selectedEmps.has(empKey(emp))}
                          onToggle={() => toggleEmp(empKey(emp))}
                          onOpen={() => setDetailEmp(emp)}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Script da tipologia */}
                <Card className="border-[#1a5c3a]/20">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-emerald-500" /> Script — {cat.label}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <pre className="text-xs whitespace-pre-wrap bg-muted/50 p-3 rounded-lg font-sans leading-relaxed text-foreground/80">
                      {SCRIPTS[k as keyof typeof SCRIPTS]}
                    </pre>
                    <Button variant="outline" size="sm" className="mt-2 gap-1.5" onClick={() => copyToClipboard(SCRIPTS[k as keyof typeof SCRIPTS])}>
                      <Copy className="h-3 w-3" /> Copiar Script
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>
            );
          })}
        </Tabs>

        {/* ═══ QUEBRA DE OBJEÇÕES ═══ */}
        <Card className="border-[#d4af37]/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-[#d4af37]" /> Quebra de Objeções
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              {OBJECOES.map((obj, i) => (
                <AccordionItem key={i} value={`obj-${i}`}>
                  <AccordionTrigger className="text-xs font-semibold hover:no-underline py-3">
                    "{obj.q}"
                  </AccordionTrigger>
                  <AccordionContent>
                    <p className="text-xs text-foreground/80 leading-relaxed">{obj.a}</p>
                    <Button variant="ghost" size="sm" className="mt-2 gap-1 text-[10px] h-6" onClick={() => copyToClipboard(obj.a)}>
                      <Copy className="h-3 w-3" /> Copiar
                    </Button>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>

        {/* ═══ AÇÕES RÁPIDAS ═══ */}
        <Card className="border-[#1a5c3a]/20 bg-[#0d3320]/5">
          <CardContent className="p-4">
            <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
              <Zap className="h-4 w-4 text-[#d4af37]" /> Ações Rápidas do Corretor
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs justify-start" onClick={() => navigate("/oferta-ativa")}>
                <Phone className="h-3.5 w-3.5" /> Iniciar Oferta Ativa
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs justify-start" onClick={() => navigate("/pipeline-leads")}>
                <Target className="h-3.5 w-3.5" /> Abrir Pipeline
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs justify-start" onClick={() => navigate("/agenda-visitas?nova=1")}>
                <MapPin className="h-3.5 w-3.5" /> Agendar Visita
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs justify-start" onClick={() => navigate("/scripts")}>
                <FileText className="h-3.5 w-3.5" /> Ver Mais Scripts
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs justify-start" onClick={sharePageLink}>
                <Share2 className="h-3.5 w-3.5" /> Enviar Página
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs justify-start" onClick={() => {
                if (selectedEmps.size > 0) { setVitrineLink(null); setShowVitrineDialog(true); }
                else toast.info("Selecione empreendimentos para criar uma vitrine");
              }}>
                <Link2 className="h-3.5 w-3.5" /> Copiar Link Vitrine
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* ═══ FLOATING SELECTION BAR ═══ */}
        {selectedEmps.size > 0 && (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-[#0d3320] text-white rounded-2xl shadow-2xl px-4 py-3 flex items-center gap-3 max-w-lg w-[calc(100%-2rem)] animate-in slide-in-from-bottom-4">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="w-8 h-8 rounded-full bg-[#d4af37] flex items-center justify-center shrink-0">
                <span className="text-sm font-bold text-[#0a1f14]">{selectedEmps.size}</span>
              </div>
              <span className="text-sm font-medium truncate">
                {selectedEmps.size === 1 ? "1 oferta selecionada" : `${selectedEmps.size} ofertas selecionadas`}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button size="sm" className="gap-1.5 text-xs bg-emerald-500 hover:bg-emerald-600 text-white border-0" onClick={() => {
                let msg = `⚽ *Mega da Cyrela 2026* — Ofertas selecionadas:\n\n`;
                selectedEmpData.forEach((emp) => {
                  msg += `🏠 *${emp.nome}* — ${emp.bairro}\n`;
                  msg += `🛏 ${emp.tipologia}`;
                  if (emp.metragem) msg += ` · ${emp.metragem}`;
                  msg += `\n💰 ${emp.valor}\n\n`;
                });
                msg += `📅 Condições válidas até 30/04!\nMe chama para saber mais! 😊`;
                window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
              }}>
                <Send className="h-3 w-3" /> WhatsApp
              </Button>
              <Button size="sm" className="gap-1.5 text-xs bg-[#d4af37] hover:bg-[#c49b2f] text-[#0a1f14] border-0" onClick={() => { setVitrineLink(null); setShowVitrineDialog(true); }}>
                <Link2 className="h-3 w-3" /> Criar Vitrine
              </Button>
            </div>
          </div>
        )}

        {/* ═══ DETAIL MODAL ═══ */}
        <Dialog open={!!detailEmp} onOpenChange={(open) => !open && setDetailEmp(null)}>
          <DialogContent className="max-w-md">
            {detailEmp && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-[#d4af37]" /> {detailEmp.nome}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  {detailEmp.imagem && (
                    <img src={detailEmp.imagem} alt={detailEmp.nome} className="w-full h-48 object-cover rounded-lg" />
                  )}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-muted/50 rounded-lg p-2"><span className="text-muted-foreground">Tipologia:</span> <strong>{detailEmp.tipologia}</strong></div>
                    <div className="bg-muted/50 rounded-lg p-2"><span className="text-muted-foreground">Bairro:</span> <strong>{detailEmp.bairro}</strong></div>
                    <div className="bg-muted/50 rounded-lg p-2"><span className="text-muted-foreground">Fase:</span> <strong>{detailEmp.fase}</strong></div>
                    <div className="bg-muted/50 rounded-lg p-2"><span className="text-muted-foreground">Unidade:</span> <strong>{detailEmp.unidade}</strong></div>
                    {detailEmp.metragem && <div className="bg-muted/50 rounded-lg p-2"><span className="text-muted-foreground">Metragem:</span> <strong>{detailEmp.metragem}</strong></div>}
                    <div className="bg-[#d4af37]/10 rounded-lg p-2 border border-[#d4af37]/20"><span className="text-muted-foreground">Valor:</span> <strong className="text-[#d4af37]">{detailEmp.valor}</strong></div>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3 text-xs space-y-1">
                    <p className="font-semibold">Condições da campanha:</p>
                    <ul className="text-muted-foreground space-y-0.5">
                      <li>• Taxas de financiamento a partir de 10,63%</li>
                      <li>• Parcelamento direto em até 240x</li>
                      <li>• Estudo de dação — até 40% do negócio</li>
                      <li>• Válido até 30 de abril de 2026</li>
                    </ul>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button size="sm" className="gap-1.5 text-xs bg-emerald-500 hover:bg-emerald-600 text-white" onClick={() => {
                      let msg = `🏠 *${detailEmp.nome}* — Mega da Cyrela 2026\n📍 ${detailEmp.bairro}\n🛏 ${detailEmp.tipologia}`;
                      if (detailEmp.metragem) msg += ` · ${detailEmp.metragem}`;
                      msg += `\n🏗 ${detailEmp.fase}\n💰 ${detailEmp.valor} — Un. ${detailEmp.unidade}\n📅 Condições até 30/04!\n\nQuer saber mais? 😊`;
                      window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
                    }}>
                      <Phone className="h-3.5 w-3.5" /> WhatsApp
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => navigate("/pipeline-leads")}>
                      <Target className="h-3.5 w-3.5" /> Pipeline
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => navigate("/agenda-visitas?nova=1")}>
                      <Calendar className="h-3.5 w-3.5" /> Agendar Visita
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => navigate("/oferta-ativa")}>
                      <Zap className="h-3.5 w-3.5" /> Oferta Ativa
                    </Button>
                  </div>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* ═══ VITRINE DIALOG ═══ */}
        <Dialog open={showVitrineDialog} onOpenChange={setShowVitrineDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Share2 className="h-5 w-5 text-[#d4af37]" /> Criar Vitrine Mega da Cyrela
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Título</label>
                <Input value={vitrineTitle} onChange={(e) => setVitrineTitle(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Mensagem (opcional)</label>
                <Textarea value={vitrineMsg} onChange={(e) => setVitrineMsg(e.target.value)} rows={3} placeholder="Ex: Oi João, separei essas ofertas da Mega da Cyrela..." />
              </div>
              <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                <p className="text-xs font-semibold">{selectedEmps.size} ofertas selecionadas:</p>
                <div className="flex flex-wrap gap-1">
                  {selectedEmpData.slice(0, 8).map((emp) => (
                    <Badge key={empKey(emp)} variant="secondary" className="text-[10px]">{emp.nome}</Badge>
                  ))}
                  {selectedEmpData.length > 8 && <Badge variant="outline" className="text-[10px]">+{selectedEmpData.length - 8}</Badge>}
                </div>
              </div>
              {vitrineLink && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 space-y-2">
                  <p className="text-xs font-semibold text-emerald-700">✅ Vitrine criada!</p>
                  <div className="flex items-center gap-2">
                    <Input value={vitrineLink} readOnly className="text-xs h-8 flex-1" />
                    <Button size="sm" variant="outline" className="h-8 px-2" onClick={() => { navigator.clipboard.writeText(vitrineLink); toast.success("Link copiado!"); }}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <a href={`https://wa.me/?text=${encodeURIComponent(`${vitrineMsg || vitrineTitle}\n\nConfira: ${vitrineLink}`)}`} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" className="w-full gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white mt-1">
                      <Phone className="h-3.5 w-3.5" /> Enviar via WhatsApp
                    </Button>
                  </a>
                </div>
              )}
            </div>
            <DialogFooter>
              {!vitrineLink && (
                <Button
                  onClick={async () => {
                    setCreatingVitrine(true);
                    try {
                      const { data: { user } } = await (supabase.auth as any).getUser();
                      if (!user) { toast.error("Faça login"); return; }
                      // Convert relative image paths to absolute URLs so they work on the public vitrine domain
                      const origin = "https://uhomeia.lovable.app";
                      const toAbsoluteUrl = (path: string) => {
                        if (!path) return "";
                        if (path.startsWith("http://") || path.startsWith("https://")) return path;
                        return `${origin}${path.startsWith("/") ? "" : "/"}${path}`;
                      };
                      const dadosCustom = selectedEmpData.map((emp) => ({
                        nome: emp.nome, bairro: emp.bairro, tipologia: emp.tipologia,
                        metragem: emp.metragem, fase: emp.fase, valor: emp.valor,
                        unidade: emp.unidade, imagem: toAbsoluteUrl(emp.imagem), categoria: emp.categoria,
                      }));
                      const { data, error } = await supabase
                        .from("vitrines")
                        .insert({ created_by: user.id, titulo: vitrineTitle, mensagem_corretor: vitrineMsg || null, tipo: "mega_cyrela", dados_custom: dadosCustom as any })
                        .select("id").single();
                      if (error) throw error;
                      const link = getVitrineShareUrl(data.id);
                      setVitrineLink(link);
                      navigator.clipboard.writeText(link);
                      toast.success("Vitrine criada! Link copiado.");
                    } catch (err) { console.error(err); toast.error("Erro ao criar vitrine"); }
                    finally { setCreatingVitrine(false); }
                  }}
                  disabled={creatingVitrine || selectedEmps.size === 0}
                  className="gap-1.5 bg-[#d4af37] hover:bg-[#c49b2f] text-[#0a1f14]"
                >
                  {creatingVitrine ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Link2 className="h-4 w-4" /> Criar Vitrine</>}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
    </div>
  );
}
