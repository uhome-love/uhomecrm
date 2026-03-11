import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Building2, Phone, MessageSquare, Copy, ExternalLink, MapPin,
  Maximize2, Tag, Clock, ChevronDown, ChevronUp, Sparkles,
  Trophy, Plane, Users, Target, Star, TrendingUp, ShieldCheck,
  Car, FileText, Zap, ArrowRight, Gift, Search, DollarSign, Home,
  Share2, Link2, Loader2, CheckSquare, Send, ChevronLeft, ChevronRight
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

/* ═══════════════════════════════════════════
   DATA — Empreendimentos
   ═══════════════════════════════════════════ */

type Empreendimento = {
  nome: string;
  bairro: string;
  metragens: string;
  dorms: string;
  status: string;
  precoDe?: string;
  precoPor?: string;
  imagens?: string[];
  condicoes?: string;
  descontoMax?: string;
  unRef?: string;
  m2?: string;
  destaques?: string[];
};

const SEGMENTOS: Record<string, {
  label: string;
  emoji: string;
  cor: string;
  corBg: string;
  condicoes: string[];
  metodologia: string;
  empreendimentos: Empreendimento[];
}> = {
  mcmv: {
    label: "MCMV / Open",
    emoji: "🏠",
    cor: "text-emerald-700",
    corBg: "bg-emerald-500/10 border-emerald-200",
    condicoes: [
      "Financiamento de até 100%",
      "ITBI e Registro pagos pela Melnick",
      "Até 6 meses de aluguel garantido (até 1% do valor do imóvel)",
      "Cash Zero: possibilidade de comprar sem colocar R$1,00*",
      "⚠️ 5% de entrada reembolsável na assinatura do financiamento",
    ],
    metodologia: "NÃO REPRESADO — Vendas a partir de 05/03 até 18/03. A cada 4 vendas Open = 1 viagem sorteada entre os corretores.",
    empreendimentos: [
      { nome: "Open Major", bairro: "Marechal Rondon", metragens: "43 m²", dorms: "2 dorms", status: "Em obras", precoPor: "R$ 235.505", imagens: ["https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2026/03/03122722/open-major.png"] },
      { nome: "Open Alto Ipiranga", bairro: "Jardim Carvalho", metragens: "42 m²", dorms: "2 dorms", status: "Em obras", precoPor: "R$ 271.310", imagens: ["https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2026/03/03122643/Camada-20.png"] },
      { nome: "Open Bosque", bairro: "Passo d'Areia", metragens: "31 a 63 m²", dorms: "Até 3 dorms", status: "Em obras", precoPor: "R$ 240.582", imagens: ["https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2026/03/03122725/Retangulo-2.png"] },
    ],
  },
  compactos: {
    label: "Compactos / Investimento",
    emoji: "📊",
    cor: "text-cyan-700",
    corBg: "bg-cyan-500/10 border-cyan-200",
    condicoes: [
      "ITBI e Registro pagos pela Melnick",
      "Até 6 meses de aluguel garantido",
      "Até 100% financiados",
      "Descontos de até 33% VPL",
      "Linhas GO, Square e Investimento",
    ],
    metodologia: "NÃO REPRESADO — Studios, Lofts e 1 dorm comercial. Vendas a partir de 05/03. Vendeu, viajou!",
    empreendimentos: [
      { nome: "GO Cidade Baixa", bairro: "Cidade Baixa", metragens: "27 a 90 m²", dorms: "Studio a 3 dorms", status: "Pronto", precoDe: "R$ 497.462", precoPor: "R$ 338.274", descontoMax: "-32%", m2: "R$ 12.216/m²", imagens: ["https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2022/04/13134325/04-36-1.jpg","https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2022/04/13134338/07-35-1.jpg","https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2022/04/13134413/13-29-1.jpg","https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2022/04/13134539/33-13-1.jpg","https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2022/04/13134551/21-21-1.jpg"] },
      { nome: "Carlos Gomes Square", bairro: "Auxiliadora", metragens: "25 a 59 m²", dorms: "Lofts e 1 dorm", status: "Pronto", precoDe: "R$ 453.983", precoPor: "R$ 304.169", descontoMax: "-33%", m2: "R$ 12.211/m²", imagens: ["https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2022/04/28162833/DJI_20250512180934_0645_D-HDR.jpg","https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2022/04/28162726/CFF3260-HDR.jpg","https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2022/04/28162824/DJI_20250512180503_0590_D-HDR.jpg","https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2022/04/28162842/CFF3429-HDR.jpg","https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2022/04/28162739/CFF3346-HDR.jpg"] },
      { nome: "GO Rio Branco", bairro: "Rio Branco", metragens: "25 a 63 m²", dorms: "Studio a 2 dorms", status: "Pronto", precoDe: "R$ 554.032", precoPor: "R$ 448.766", descontoMax: "-19%", m2: "R$ 17.254/m²", imagens: ["https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2026/03/03122727/rio-granco.png"] },
      { nome: "GO 24", bairro: "Auxiliadora", metragens: "24 a 29 m²", dorms: "1 dorm", status: "Pronto", precoDe: "R$ 600.712", precoPor: "R$ 492.584", descontoMax: "-18%", m2: "R$ 20.313/m²", imagens: ["https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2022/04/14150218/DSC00790.webp"] },
      { nome: "Maxplaza", bairro: "Canoas, Centro", metragens: "34 a 47 m²", dorms: "1 dorm", status: "Pronto", precoDe: "R$ 427.360", precoPor: "R$ 367.530", descontoMax: "-14%", m2: "R$ 9.455/m²", imagens: ["https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2022/04/08143643/fachada-min-3.jpeg"] },
      { nome: "GO Bom Fim", bairro: "Bom Fim", metragens: "28 a 40 m²", dorms: "1 dorm", status: "Em obras", precoDe: "R$ 546.912", precoPor: "R$ 434.145", descontoMax: "-17%", m2: "R$ 15.505/m²", imagens: ["https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2023/05/14150148/JTL_02_Fachada_EF2_T-scaled.jpg"] },
      { nome: "GO Carlos Gomes", bairro: "Boa Vista", metragens: "25 m²", dorms: "Lofts", status: "Pronto", precoDe: "R$ 453.983", precoPor: "R$ 304.169", descontoMax: "-33%", m2: "R$ 12.211/m²", condicoes: "ITBI e Registro pagos · Até 100% Financiado · Aluguel Garantido", imagens: ["https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2022/03/14154149/DJI_20241204194812_0689_D-HDR.webp"] },
      { nome: "GO Home Design", bairro: "Bela Vista", metragens: "25 a 32 m²", dorms: "Lofts", status: "Entrega 2029", precoDe: "R$ 549.902", precoPor: "R$ 393.162", descontoMax: "-14%", m2: "R$ 15.376/m²", imagens: ["https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2025/07/03173727/CTN_01_Fachada_EF_v3-C-scaled.jpg"] },
      { nome: "Linked Teresópolis", bairro: "Glória", metragens: "35 a 53 m²", dorms: "Lofts e 1 dorm", status: "Pronto", precoDe: "R$ 524.902", precoPor: "R$ 461.914", imagens: ["https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2026/03/03122644/Camada-913.png"] },
      { nome: "Nilo Square Multistay", bairro: "Boa Vista", metragens: "24 a 64 m²", dorms: "1 dorm", status: "Entrega 2026", precoDe: "R$ 920.709", precoPor: "R$ 761.076", descontoMax: "-17%", m2: "R$ 26.969/m²", imagens: ["https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2022/05/12125610/12-1.jpg"] },
      { nome: "Nilo Square Hotel", bairro: "Boa Vista", metragens: "29 a 34 m²", dorms: "1 dorm", status: "Entrega 2026", precoDe: "R$ 305.069", precoPor: "R$ 259.309", descontoMax: "-15%", imagens: ["https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2022/05/12125610/12-1.jpg"] },
      { nome: "Square Garden Multistay", bairro: "Santa Cecília", metragens: "19 a 40 m²", dorms: "Loft e 1 dorm", status: "Entrega 2029", precoDe: "R$ 418.038", precoPor: "R$ 315.438", descontoMax: "-6%", m2: "R$ 16.135/m²", imagens: ["https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2025/09/25174954/GBM_03_Fachada_B_Ipiranga_EF2_T.jpg"] },
      { nome: "Reserva do Lago", bairro: "Petrópolis", metragens: "Até 406 m²", dorms: "Terrenos", status: "Pronto", precoPor: "R$ 148.500", imagens: ["https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2026/03/03122630/Camada-8.png"] },
    ],
  },
  medio: {
    label: "Médio Padrão",
    emoji: "🏢",
    cor: "text-blue-700",
    corBg: "bg-blue-500/10 border-blue-200",
    condicoes: [
      "10% de entrada",
      "Saldo em até 36x sem juros",
      "Descontos de até 32%",
    ],
    metodologia: "REPRESADO — 2D e 3D residencial. Vendas concentradas no Dia D (21/03). A partir de R$ 1M vendido = viagem.",
    empreendimentos: [
      { nome: "Supreme Altos do Central Parque", bairro: "Jardim do Salso", metragens: "59 a 70 m²", dorms: "2 e 3 dorms", status: "Pronto", precoDe: "R$ 657.169", precoPor: "R$ 499.448", imagens: ["https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2026/03/03122731/supreme.png"] },
      { nome: "Grand Park Lindóia", bairro: "São Sebastião", metragens: "56 a 81 m²", dorms: "2 e 3 dorms", status: "Pronto", precoDe: "R$ 622.810", precoPor: "R$ 485.792", imagens: ["https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2026/03/03122658/Camada-933.png"] },
      { nome: "Vida Viva Linked", bairro: "Teresópolis", metragens: "55 e 67 m²", dorms: "2 e 3 dorms", status: "Pronto", precoDe: "R$ 656.978", precoPor: "R$ 499.303", imagens: ["https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2026/03/03122656/Camada-932.png"] },
      { nome: "Grand Park Moinhos", bairro: "Canoas", metragens: "56 a 87 m²", dorms: "2 e 3 dorms", status: "Em obras", precoDe: "R$ 546.932", precoPor: "R$ 464.892", imagens: ["https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2022/06/31110805/Fotomontagem.webp"] },
      { nome: "High Garden Iguatemi", bairro: "Boa Vista", metragens: "102 a 125 m²", dorms: "Até 3 suítes", status: "Entrega 2029", precoDe: "R$ 1.649.477", precoPor: "R$ 1.099.722", descontoMax: "-8%", m2: "R$ 10.770/m²", condicoes: "Stand de Vendas", imagens: ["https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2026/03/03122629/Camada-7.png"] },
    ],
  },
  alto: {
    label: "Alto Padrão",
    emoji: "✨",
    cor: "text-amber-700",
    corBg: "bg-amber-500/10 border-amber-200",
    condicoes: [
      "Super avaliação de dação (imóvel no negócio acima do mercado)",
      "Carro como entrada",
      "Descontos exclusivos de até 36%",
      "Negociação direta com a diretoria",
      "Condições Ouro/Prata/Bronze por unidade",
    ],
    metodologia: "REPRESADO — Vendas concentradas no Dia D (21/03). A partir de R$ 1M vendido = viagem.",
    empreendimentos: [
      { nome: "SEEN Três Figueiras", bairro: "Três Figueiras", metragens: "149 e 169 m²", dorms: "3 a 4 suítes", status: "Entrega 2025", precoDe: "R$ 2.504.640", precoPor: "R$ 1.596.482", descontoMax: "-20%", m2: "R$ 10.650/m²", imagens: ["https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2025/09/14132308/EDU_04_Conceitual_B_EF.jpg","https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2025/09/14132311/EDU_07_Piscina-Externa_EF.jpg","https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2025/09/14132314/EDU_08_Playground_V2_EF2_T.jpg","https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2025/09/14132305/EDU_21_Living-APTO_148m_Living-Estendido_EF_T.jpg","https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2025/09/14132335/EDU_17_Piscina-Coberta_EF_T.jpg"] },
      { nome: "Gama, 1375", bairro: "Auxiliadora", metragens: "159 m²", dorms: "3 suítes", status: "Entrega 2028", precoDe: "R$ 2.429.859", precoPor: "R$ 1.707.589", descontoMax: "-9%", m2: "R$ 10.694/m²", imagens: ["https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2026/03/03122713/gama.png"] },
      { nome: "SEEN Boa Vista", bairro: "Boa Vista", metragens: "156 m²", dorms: "3 suítes", status: "Pronto", precoDe: "R$ 2.842.040", precoPor: "R$ 2.671.517", descontoMax: "-6%", m2: "R$ 17.125/m²", condicoes: "Apenas 2 un.", imagens: ["https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2026/03/03122625/Camada-4.png"] },
      { nome: "SEEN Menino Deus", bairro: "Menino Deus", metragens: "98 e 151 m²", dorms: "Até 3 suítes", status: "Entrega 2026", precoDe: "R$ 1.808.963", precoPor: "R$ 1.338.633", descontoMax: "-26%", m2: "R$ 13.604/m²", condicoes: "Decorado na Torre", imagens: ["https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2026/03/03122721/menino-deus.png"] },
      { nome: "High Garden Rio Branco", bairro: "Rio Branco", metragens: "123 e 143 m²", dorms: "3 suítes", status: "Entrega 2027", precoDe: "R$ 2.040.468", precoPor: "R$ 1.636.005", descontoMax: "-9%", m2: "R$ 13.227/m²", imagens: ["https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2026/03/03122716/high-garden.png"] },
      { nome: "Botanique Residence", bairro: "Petrópolis", metragens: "98 e 115 m²", dorms: "3 dorms", status: "Pronto", precoDe: "R$ 1.894.951", precoPor: "R$ 1.407.003", descontoMax: "-24%", m2: "R$ 14.267/m²", condicoes: "Apenas 5 un.", imagens: ["https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2022/03/09151921/CFF1685-scaled.webp","https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2022/03/09152201/DJI_20241108055959_0834_D-HDR-scaled.webp","https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2022/03/09152207/DJI_20241108060107_0849_D-HDR-scaled.webp","https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2022/03/09152404/CFF2096-HDR-scaled.webp","https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2022/03/09152147/DJI_20241108054339_0629_D-HDR.webp"] },
      { nome: "Yofi", bairro: "Bom Fim", metragens: "131 e 144 m²", dorms: "3 suítes", status: "Entrega 2027", precoDe: "R$ 2.307.445", precoPor: "R$ 1.645.058", descontoMax: "-24%", m2: "R$ 12.321/m²", imagens: ["https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2024/01/16161301/%C2%A9VISTA_03_EXT_ACESSO_FINAL-1_T-scaled.jpg","https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2024/01/16161444/%C2%A9VISTA_04_EXT_INSERCAO_DRONE_FINAL-2-2-scaled.jpg","https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2024/01/16162248/%C2%A9VISTA_20_INT_SACADA_APTO_PADRAO_FINAL_T-scaled.jpg","https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2024/01/16162907/%C2%A9VISTA_09_EXT_PISCINA_EXTERNA_FINAL_T-scaled.jpg","https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2024/01/16161819/%C2%A9VISTA_16_EXT_ROOFTOP_VISTA_FINAL-2_T-1-scaled.jpg"] },
      { nome: "Square Garden", bairro: "Santa Cecília", metragens: "93 a 119 m²", dorms: "3 dorms", status: "Entrega 2029", precoDe: "R$ 1.911.621", precoPor: "R$ 1.312.054", descontoMax: "-10%", m2: "R$ 10.980/m²", condicoes: "Stand de Vendas", imagens: ["https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2025/09/25174954/GBM_03_Fachada_B_Ipiranga_EF2_T.jpg"] },
      { nome: "Jazz Nova York", bairro: "Auxiliadora", metragens: "118 m²", dorms: "3 suítes", status: "Entrega 2027", precoDe: "R$ 2.065.289", precoPor: "R$ 1.628.005", descontoMax: "-7%", m2: "R$ 13.776/m²", imagens: ["https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2026/03/03122628/Camada-6.png"] },
      { nome: "GO Moinhos", bairro: "Moinhos de Vento", metragens: "106 m²", dorms: "3 dorms", status: "Em obras", precoDe: "R$ 1.890.885", precoPor: "R$ 1.543.682", imagens: ["https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2026/03/03122621/Camada-1.png"] },
      { nome: "Mirá - Zuckhan", bairro: "Petrópolis", metragens: "155 a 313 m²", dorms: "3 suítes", status: "2027", precoDe: "R$ 2.604.000", precoPor: "R$ 2.300.000", imagens: ["https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2026/03/03122641/Camada-18.png"] },
      { nome: "Season - TGD", bairro: "Rio Branco", metragens: "118 a 122 m²", dorms: "3 suítes", status: "2027", precoDe: "R$ 1.804.946", precoPor: "R$ 1.534.204", imagens: ["https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2025/09/14132308/EDU_04_Conceitual_B_EF.jpg"] },
    ],
  },
  altissimo: {
    label: "Altíssimo Padrão",
    emoji: "👑",
    cor: "text-purple-700",
    corBg: "bg-purple-500/10 border-purple-200",
    condicoes: [
      "Super avaliação de dação acima do mercado",
      "Carro como entrada",
      "Negociação direta com a diretoria",
      "Projetos assinados por arquitetos renomados",
      "Localizações definitivas de Porto Alegre",
    ],
    metodologia: "REPRESADO — Vendas concentradas no Dia D (21/03). A partir de R$ 1M vendido = viagem.",
    empreendimentos: [
      { nome: "Nilo Square Résidence", bairro: "Boa Vista", metragens: "176 e 216 m²", dorms: "3 suítes", status: "Em obras", imagens: ["https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2026/03/03122659/Camada-934.png"] },
      { nome: "Arte Cidade Nilo", bairro: "Bela Vista", metragens: "273 e 330 m²", dorms: "3 e 4 suítes", status: "Em obras", imagens: ["https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2026/03/03122700/Camada-935.png"] },
      { nome: "Arte Country Club", bairro: "Bela Vista", metragens: "246 a 321 m²", dorms: "3 e 4 suítes", status: "Em obras", imagens: ["https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2026/03/03122653/Camada-923.png"] },
      { nome: "Casa Moinhos", bairro: "Moinhos de Vento", metragens: "292 a 644 m²", dorms: "4 suítes", status: "Em obras", imagens: ["https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2023/06/11153412/HLR_02_Fachada_EF_V2_T.webp","https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2023/06/11153427/HLR_05_Guarita_Acesso_EF_T.webp","https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2023/06/11153443/HLR_06_Piscina_Externa_Deck_EF.webp","https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2023/06/11153508/HLR_07_Playground_EF2.webp","https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2023/06/11153533/HLR_08_Gourmet_Externo_EF4.webp"] },
      { nome: "Zayt", bairro: "Bela Vista", metragens: "490 a 540 m²", dorms: "4 suítes", status: "Em obras", imagens: ["https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2024/03/17175015/CRT_05_Conceitual_B_EF2_T-1-scaled.jpg","https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2024/03/01223031/CRT_24_Complexo_Quadras_EF2-1-scaled.jpg","https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2024/03/01223135/CRT_26_Apto_Living_B_EF_V2-scaled.jpg","https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2024/03/17175004/CRT_04_Conceitual_EF2-scaled.jpg","https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2024/03/17174833/CRT_06_Conceitual_C_EF2-scaled.jpg"] },
    ],
  },
};

/* ═══════════════════════════════════════════
   DATA — Scripts por Segmento
   ═══════════════════════════════════════════ */

const SCRIPTS: Record<string, { ligacao: string; followup: string[]; objecoes: string[] }> = {
  mcmv: {
    ligacao: `📞 ABERTURA
"Olá {{nome}}, tudo bem? Aqui é o {{corretor}} da UHome! Estou ligando porque temos uma oportunidade incrível no Melnick Day, dia 21 de março."

🔍 EXPLORAÇÃO
"Você já conhece os empreendimentos da linha Open da Melnick? São apartamentos novos com condição MCMV, financiamento de até 100% e ITBI/registro pagos pela construtora."

🏠 PRODUTO
"Temos unidades a partir de R$ 235 mil em regiões como Passo d'Areia e Jardim Carvalho. Parcelas que cabem no bolso e sem entrada!"

💰 DIFERENCIAL CHAVE
"No Melnick Day é Cash Zero: você compra sem colocar R$1,00. A Melnick paga ITBI, registro e ainda garante 6 meses de aluguel!"

📍 CONVITE PARA VISITA
"Que tal conhecer o decorado? Posso agendar para esta semana, antes do Melnick Day, assim você já chega preparado(a) para garantir sua unidade."

🎯 FECHAMENTO
"Vou te enviar os detalhes pelo WhatsApp. Qual o melhor horário para a visita?"`,
    followup: [
      `Oi {{nome}}! 😊 Passando para lembrar do Melnick Day (21/03). Temos unidades Open com financiamento de até 100% + ITBI e registro pagos. É Cash Zero! Quer que eu te mande as opções?`,
      `{{nome}}, vi que você se interessou por apartamentos econômicos. No Melnick Day: Cash Zero + 6 meses de aluguel garantido. Unidades a partir de R$ 235 mil. Bora garantir? 🏠`,
      `Oi {{nome}}! Ainda pensando no apê? As unidades Open do Melnick Day estão indo rápido — a partir de R$ 235 mil, financiamento até 100%. Posso te ajudar com a simulação? 📊`,
    ],
    objecoes: [
      `"Não tenho dinheiro para entrada" → "É Cash Zero! Financiamento de até 100%, ITBI e registro pagos pela Melnick. Você não precisa de nenhum valor de entrada!"`,
      `"Preciso pensar" → "Entendo! Mas as unidades Open são limitadas e por ordem de chegada. Posso reservar um horário para você conhecer o decorado sem compromisso?"`,
      `"Já tenho imóvel financiado" → "Muitos clientes usam o Melnick Day justamente para trocar! A Melnick avalia seu imóvel acima do mercado como entrada."`,
    ],
  },
  compactos: {
    ligacao: `📞 ABERTURA
"{{nome}}, aqui é {{corretor}} da UHome! Estou ligando porque o Melnick Day terá condições excepcionais para investidores — e achei que você deveria saber."

🔍 EXPLORAÇÃO
"Você investe pensando em renda mensal com aluguel ou valorização patrimonial a médio prazo?"

🏠 PRODUTO
"Temos studios e compactos a partir de R$ 148 mil, com descontos de até 33%, ITBI e registro pagos pela Melnick + 6 meses de aluguel garantido. São regiões como Bom Fim, Cidade Baixa, Carlos Gomes — alta demanda de locação."

📊 RENTABILIDADE
"O Carlos Gomes Square por exemplo: de R$ 453 mil por R$ 304 mil, já pronto! São R$ 12.211/m² num dos melhores endereços de POA."

📍 VISITA
"Posso te enviar a análise de rentabilidade e agendar uma visita ao decorado. O que acha?"

🎯 FECHAMENTO
"Qual perfil te interessa mais — studio ou 1 dorm? Vou reservar um horário para avançarmos."`,
    followup: [
      `Oi {{nome}}! 📊 No Melnick Day tem studios a partir de R$ 148 mil com ITBI pago + 6 meses de aluguel garantido. Descontos de até 33%! Quer ver as opções?`,
      `{{nome}}, separei compactos prontos em regiões com alta demanda de aluguel (Bom Fim, Cidade Baixa, Carlos Gomes). Condições exclusivas do Melnick Day (21/03). Posso te enviar? 🏢`,
      `Oi {{nome}}! Último lembrete: as unidades de investimento do Melnick Day costumam esgotar primeiro. Carlos Gomes Square com -33% OFF. Se quer garantir, me chama! ⏰`,
    ],
    objecoes: [
      `"Investimento imobiliário é arriscado" → "Entendo a preocupação. Por isso a Melnick garante 6 meses de aluguel + ITBI pago. É a maior construtora do Sul com +4.500 unidades vendidas no MeDay."`,
      `"Os preços já estão altos" → "Justamente por isso o Melnick Day: descontos de até 33% no VPL. O Carlos Gomes Square sai a R$ 12.211/m², abaixo do preço de mercado da região."`,
    ],
  },
  medio: {
    ligacao: `📞 ABERTURA
"Oi {{nome}}, aqui é o {{corretor}} da UHome! Tudo bem? Estou ligando sobre o Melnick Day, dia 21 de março — o maior evento imobiliário do Brasil."

🔍 EXPLORAÇÃO
"Percebi que você tem interesse em morar bem em Porto Alegre. Posso te perguntar: o que é mais importante pra você? Localização, tamanho do apartamento ou valor?"

🏠 PRODUTO
"Temos empreendimentos incríveis com até 32% de desconto! Por exemplo, o Supreme no Jardim do Salso saiu de R$ 657 mil por R$ 499 mil. Condição: 10% de entrada e saldo em até 36x sem juros."

💡 ARGUMENTO DE URGÊNCIA
"No Melnick Day tem a metodologia Ouro-Prata-Bronze: as melhores unidades com os maiores descontos (até 28% VPL) são vendidas primeiro. Quem chega antes, garante o melhor preço."

📍 CONVITE
"Quer conhecer o decorado antes do evento? Assim você já chega sabendo exatamente qual unidade reservar."

🎯 FECHAMENTO
"Vou te enviar pelo WhatsApp as opções que mais combinam com seu perfil. Pode ser?"`,
    followup: [
      `Oi {{nome}}! No Melnick Day (21/03) temos apartamentos de 2 e 3 dorms com até 32% OFF + entrada de 10% e saldo em 36x sem juros. Quer ver as opções? 🏠`,
      `{{nome}}, lembrete: as melhores unidades do Melnick Day são Lote Ouro — maiores descontos, por ordem de chegada! Que tal agendar uma visita ao decorado esta semana? 📍`,
      `Oi {{nome}}, ainda buscando seu apê? Separei 3 opções do Melnick Day que combinam com o que você procura. Posso te enviar com a simulação de parcelas? 😊`,
    ],
    objecoes: [
      `"10% de entrada é muito" → "Entendo! Mas o saldo é em 36x sem juros — bem diferente de financiamento bancário. E o desconto de até 32% compensa com folga a entrada."`,
      `"Quero esperar o mercado baixar" → "Os preços do MeDay já estão até 32% abaixo do valor real. Historicamente, após o evento os preços voltam ao normal. É a melhor janela do ano."`,
    ],
  },
  alto: {
    ligacao: `📞 ABERTURA
"{{nome}}, boa tarde! Aqui é {{corretor}} da UHome. Estou entrando em contato porque temos condições absolutamente excepcionais no Melnick Day para imóveis de alto padrão."

🤝 CONEXÃO
"Sei que para quem busca um imóvel desse perfil, o mais importante é a segurança do investimento e a qualidade de vida. Concordo totalmente."

🔍 EXPLORAÇÃO
"Você está buscando para moradia ou como oportunidade de investimento? Tem alguma região preferida em Porto Alegre?"

🏠 PRODUTO
"Temos o SEEN Três Figueiras com desconto de 36% — de R$ 2,5M por R$ 1,59M. E o Yofi no Bom Fim de R$ 2,3M por R$ 1,64M. Condições que a Melnick só libera uma vez por ano."

🚗 DIFERENCIAL EXCLUSIVO
"No Melnick Day você pode usar seu carro como entrada e recebe super avaliação de dação — o seu imóvel vale mais do que no mercado. Exemplo: imóvel de R$ 1M avaliado em R$ 900 mil (deságio de apenas 10%)."

📍 VISITA PRIVATIVA
"Posso organizar uma visita privativa ao empreendimento. Que tal esta semana?"

🎯 FECHAMENTO
"Vou preparar uma apresentação personalizada e te enviar. Qual o melhor canal?"`,
    followup: [
      `{{nome}}, boa tarde! O Melnick Day terá condições exclusivas para alto padrão: descontos de até 36% + carro como entrada + negociação direta com a diretoria. Posso agendar uma conversa? 🏢`,
      `{{nome}}, separei uma oportunidade: SEEN Três Figueiras de R$ 2,5M por R$ 1,59M no Melnick Day (21/03). Super avaliação na troca do seu imóvel atual. Quer a análise completa? 📊`,
      `Oi {{nome}}! As condições do Melnick Day são válidas apenas no dia 21/03. Unidades Lote Ouro (maior desconto) são reservadas primeiro. Se tem interesse, vamos nos organizar? ⏰`,
    ],
    objecoes: [
      `"Preciso vender meu imóvel antes" → "No MeDay a Melnick aceita seu imóvel como dação com super avaliação (deságio de apenas 10%). Você não precisa vender antes!"`,
      `"Desconto tão grande é suspeito" → "O MeDay é uma estratégia de vendas da Melnick há 15 edições. Já venderam 4.500 unidades e R$ 2,5 bilhões. Os descontos são reais e temporários."`,
      `"Vou pensar" → "Claro! Mas lembre que as unidades Ouro (maior desconto) acabam primeiro. Posso reservar uma para você avaliar sem compromisso?"`,
    ],
  },
  altissimo: {
    ligacao: `📞 ABERTURA
"{{nome}}, aqui é {{corretor}} da UHome. Preciso compartilhar algo exclusivo com você: o Melnick Day deste ano inclui empreendimentos de altíssimo padrão com condições que normalmente não são oferecidas ao mercado."

🤝 CONEXÃO
"São projetos como Casa Moinhos, Zayt e Arte Country Club — assinados por arquitetos renomados, em localizações definitivas de Porto Alegre."

🔍 EXPLORAÇÃO
"Para que eu possa te apresentar a opção mais adequada: você busca algo mais compacto e sofisticado ou uma metragem generosa? O que pensa sobre a região?"

🏠 PRODUTO
"O Casa Moinhos tem unidades de 292 a 644m² no coração de Moinhos de Vento. O Zayt oferece plantas de 490 a 540m² na Bela Vista. O Arte Country Club tem 3 e 4 suítes com até 321m²."

🚗 DIFERENCIAL
"Carro como entrada, super avaliação na dação e negociação direta com a diretoria da Melnick. São condições que existem apenas no Melnick Day."

📍 VISITA EXCLUSIVA
"Posso organizar uma apresentação exclusiva com material detalhado e tour pelo local. Quando seria conveniente?"

🎯 FECHAMENTO
"Vou enviar o book completo dos empreendimentos. Prefere por e-mail ou WhatsApp?"`,
    followup: [
      `{{nome}}, boa tarde. O Melnick Day incluirá projetos exclusivos como Casa Moinhos (292-644m²) e Zayt (490-540m²) em Moinhos de Vento e Bela Vista. Posso preparar uma apresentação? 🏛️`,
      `{{nome}}, gostaria de compartilhar os detalhes do Arte Country Club — 3 e 4 suítes com até 321m² na Bela Vista. Condições únicas: carro como entrada + super avaliação na troca. Interesse? ✨`,
      `{{nome}}, lembrete: os imóveis de altíssimo padrão no Melnick Day são limitados e por ordem de reserva. Se há interesse, sugiro agendarmos uma conversa esta semana. 📞`,
    ],
    objecoes: [
      `"Preciso ver pessoalmente" → "Com certeza! Posso organizar uma visita exclusiva esta semana. Vou preparar o material completo com plantas e acabamentos para você avaliar com calma."`,
      `"O valor é muito alto" → "Entendo. Justamente por isso o MeDay: a Melnick aceita carro + imóvel como entrada com super avaliação. A negociação é direta com a diretoria para adequar ao seu perfil."`,
    ],
  },
};

/* ═══════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════ */

function calcDesconto(de?: string, por?: string): string | null {
  if (!de || !por) return null;
  const parse = (s: string) => parseFloat(s.replace(/[^0-9.,]/g, "").replace(/\./g, "").replace(",", "."));
  const vDe = parse(de);
  const vPor = parse(por);
  if (!vDe || !vPor || vDe <= vPor) return null;
  return Math.round(((vDe - vPor) / vDe) * 100) + "%";
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text.replace(/\{\{nome\}\}/g, "[NOME]").replace(/\{\{corretor\}\}/g, "[SEU NOME]"));
  toast.success("Copiado para a área de transferência!");
}

/* ═══════════════════════════════════════════
   SUB-COMPONENTS
   ═══════════════════════════════════════════ */

function CountdownTimer() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);
  const eventDate = new Date("2026-03-21T09:00:00-03:00");
  const diff = eventDate.getTime() - now.getTime();
  if (diff <= 0) return <Badge className="bg-red-600 text-white border-0 animate-pulse">🔴 EVENTO HOJE!</Badge>;
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  return (
    <div className="flex items-center gap-3">
      {[{ v: days, l: "dias" }, { v: hours, l: "horas" }, { v: mins, l: "min" }].map((u) => (
        <div key={u.l} className="text-center">
          <div className="text-xl md:text-2xl font-black text-white">{u.v}</div>
          <div className="text-[10px] text-white/60 uppercase tracking-wider">{u.l}</div>
        </div>
      ))}
    </div>
  );
}

function ImageSlider({ images, alt, onToggle, desconto, status }: { images: string[]; alt: string; onToggle: () => void; desconto?: string | null; status: string }) {
  const [current, setCurrent] = useState(0);
  if (images.length === 0) {
    return (
      <div className="relative h-32 bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center cursor-pointer" onClick={onToggle}>
        <Building2 className="h-8 w-8 text-muted-foreground/30" />
      </div>
    );
  }
  return (
    <div className="relative h-32 group cursor-pointer" onClick={onToggle}>
      <img src={images[current]} alt={alt} className="w-full h-full object-cover" loading="lazy" />
      {images.length > 1 && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); setCurrent((p) => (p - 1 + images.length) % images.length); }}
            className="absolute left-1 top-1/2 -translate-y-1/2 bg-background/70 hover:bg-background/90 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity z-10"
            aria-label="Anterior"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setCurrent((p) => (p + 1) % images.length); }}
            className="absolute right-1 top-1/2 -translate-y-1/2 bg-background/70 hover:bg-background/90 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity z-10"
            aria-label="Próxima"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
          <div className="absolute bottom-7 left-1/2 -translate-x-1/2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {images.slice(0, 8).map((_, i) => (
              <span key={i} className={`w-1.5 h-1.5 rounded-full ${i === current ? "bg-primary" : "bg-background/60"}`} />
            ))}
          </div>
        </>
      )}
      {desconto && (
        <span className="absolute bottom-2 right-2 bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full z-10">
          -{typeof desconto === "string" && desconto.startsWith("-") ? desconto.slice(1) : desconto}
        </span>
      )}
      <Badge className="absolute bottom-2 left-2 text-[9px] py-0 z-10" variant="secondary">{status}</Badge>
    </div>
  );
}

function EmpreendimentoCard({ emp, segKey, selected, onToggle }: { emp: Empreendimento; segKey: string; selected: boolean; onToggle: () => void }) {
  const desconto = emp.descontoMax || calcDesconto(emp.precoDe, emp.precoPor);
  
  const gerarMsgWhatsApp = () => {
    let msg = `🏠 *${emp.nome}* — Melnick Day 2026\n`;
    msg += `📍 ${emp.bairro}\n`;
    msg += `📐 ${emp.metragens} · ${emp.dorms}\n`;
    if (emp.precoDe && emp.precoPor) msg += `💰 De ~${emp.precoDe}~ por *${emp.precoPor}*\n`;
    else if (emp.precoPor) msg += `💰 *${emp.precoPor}*\n`;
    if (desconto) msg += `🔥 Desconto de até ${typeof desconto === "string" && desconto.startsWith("-") ? desconto.slice(1) : desconto}\n`;
    msg += `📅 Condições exclusivas até 21/03!\n`;
    msg += `\nQuer saber mais? Me chama! 😊`;
    return msg;
  };

  return (
    <Card className={`overflow-hidden hover:shadow-lg transition-all duration-200 border-border/50 group relative ${selected ? "ring-2 ring-primary border-primary" : ""}`}>
      {/* Selection checkbox */}
      <div className="absolute top-2 left-2 z-10" onClick={(e) => e.stopPropagation()}>
        <Checkbox
          checked={selected}
          onCheckedChange={onToggle}
          className="bg-white/90 border-2"
        />
      </div>
      
      {/* Share button */}
      <div className="absolute top-2 right-2 z-10 flex gap-1" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => {
            const msg = gerarMsgWhatsApp();
            window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
          }}
          className="bg-emerald-500 text-white rounded-full p-1.5 shadow-lg hover:bg-emerald-600 transition-colors"
          title="Enviar por WhatsApp"
        >
          <Phone className="h-3 w-3" />
        </button>
        <button
          onClick={() => {
            copyToClipboard(gerarMsgWhatsApp());
          }}
          className="bg-white/90 text-slate-700 rounded-full p-1.5 shadow-lg hover:bg-white transition-colors"
          title="Copiar mensagem"
        >
          <Copy className="h-3 w-3" />
        </button>
      </div>

      {emp.imagens && emp.imagens.length > 0 ? (
        <ImageSlider images={emp.imagens} alt={emp.nome} onToggle={onToggle} desconto={desconto} status={emp.status} />
      ) : (
        <div className="relative h-32 bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center cursor-pointer" onClick={onToggle}>
          <Building2 className="h-8 w-8 text-muted-foreground/30" />
          {desconto && (
            <span className="absolute bottom-2 right-2 bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
              -{typeof desconto === "string" && desconto.startsWith("-") ? desconto.slice(1) : desconto}
            </span>
          )}
          <Badge className="absolute bottom-2 left-2 text-[9px] py-0" variant="secondary">{emp.status}</Badge>
        </div>
      )}
      <CardContent className="p-3 space-y-1 cursor-pointer" onClick={onToggle}>
        <h4 className="font-bold text-sm text-foreground leading-tight truncate">{emp.nome}</h4>
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <MapPin className="h-3 w-3 shrink-0" /> {emp.bairro}
        </div>
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <Maximize2 className="h-3 w-3 shrink-0" /> {emp.metragens} · {emp.dorms}
        </div>
        {emp.m2 && <div className="text-[10px] text-muted-foreground">{emp.m2}</div>}
        {emp.precoPor && (
          <div className="pt-1.5 border-t border-border/30">
            {emp.precoDe && <p className="text-[10px] text-muted-foreground line-through">{emp.precoDe}</p>}
            <p className="text-sm font-bold text-emerald-600">{emp.precoPor}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ScriptSection({ segKey }: { segKey: string }) {
  const script = SCRIPTS[segKey];
  const [showLigacao, setShowLigacao] = useState(false);
  const [showObjecoes, setShowObjecoes] = useState(false);
  if (!script) return null;

  return (
    <div className="space-y-3">
      {/* Script de ligação */}
      <Card className="border-border/50">
        <CardHeader className="pb-2 cursor-pointer select-none" onClick={() => setShowLigacao(!showLigacao)}>
          <CardTitle className="text-sm flex items-center gap-2">
            <Phone className="h-4 w-4 text-primary" />
            Script de Ligação Completo
            {showLigacao ? <ChevronUp className="h-4 w-4 ml-auto text-muted-foreground" /> : <ChevronDown className="h-4 w-4 ml-auto text-muted-foreground" />}
          </CardTitle>
        </CardHeader>
        {showLigacao && (
          <CardContent className="pt-0">
            <pre className="text-xs whitespace-pre-wrap bg-muted/50 p-3 rounded-lg font-sans leading-relaxed text-foreground/80 max-h-[400px] overflow-y-auto">
              {script.ligacao}
            </pre>
            <Button variant="outline" size="sm" className="mt-2 gap-1.5" onClick={() => copyToClipboard(script.ligacao)}>
              <Copy className="h-3 w-3" /> Copiar Script
            </Button>
          </CardContent>
        )}
      </Card>

      {/* Follow-ups WhatsApp */}
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-emerald-500" />
            Follow-ups WhatsApp ({script.followup.length} variações)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {script.followup.map((msg, i) => (
            <div key={i} className="bg-muted/50 rounded-lg p-3 flex items-start gap-2">
              <span className="text-[10px] font-bold text-muted-foreground mt-0.5 shrink-0">#{i + 1}</span>
              <p className="text-xs flex-1 text-foreground/80 leading-relaxed">{msg}</p>
              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => copyToClipboard(msg)}>
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Objeções */}
      {script.objecoes && script.objecoes.length > 0 && (
        <Card className="border-border/50 border-amber-200/50">
          <CardHeader className="pb-2 cursor-pointer select-none" onClick={() => setShowObjecoes(!showObjecoes)}>
            <CardTitle className="text-sm flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-amber-500" />
              Quebra de Objeções ({script.objecoes.length})
              {showObjecoes ? <ChevronUp className="h-4 w-4 ml-auto text-muted-foreground" /> : <ChevronDown className="h-4 w-4 ml-auto text-muted-foreground" />}
            </CardTitle>
          </CardHeader>
          {showObjecoes && (
            <CardContent className="space-y-2 pt-0">
              {script.objecoes.map((obj, i) => (
                <div key={i} className="bg-amber-50/50 border border-amber-100 rounded-lg p-3 flex items-start gap-2">
                  <p className="text-xs flex-1 text-foreground/80 leading-relaxed">{obj}</p>
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => copyToClipboard(obj)}>
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════ */

export default function MelnickDay() {
  const navigate = useNavigate();
  const segKeys = Object.keys(SEGMENTOS);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("mcmv");
  const [selectedEmps, setSelectedEmps] = useState<Set<string>>(new Set());
  const [showVitrineDialog, setShowVitrineDialog] = useState(false);
  const [vitrineTitle, setVitrineTitle] = useState("Ofertas Melnick Day 2026");
  const [vitrineMsg, setVitrineMsg] = useState("");
  const [creatingVitrine, setCreatingVitrine] = useState(false);
  const [vitrineLink, setVitrineLink] = useState<string | null>(null);

  const toggleEmp = (empName: string) => {
    setSelectedEmps((prev) => {
      const next = new Set(prev);
      if (next.has(empName)) next.delete(empName);
      else next.add(empName);
      return next;
    });
  };

  const allEmps = segKeys.flatMap((k) =>
    SEGMENTOS[k].empreendimentos.map((emp) => ({ ...emp, segmento: SEGMENTOS[k].label }))
  );

  const selectedEmpData = allEmps.filter((emp) => selectedEmps.has(emp.nome));

  return (
    <div className="space-y-5 pb-24">
      {/* ── HERO ── */}
      <div className="relative rounded-xl overflow-hidden bg-gradient-to-br from-[#0a1628] via-[#0d2137] to-[#1a3a5c] p-5 md:p-8">
        <div className="absolute inset-0 bg-[url('https://wordpress-melnick.s3.sa-east-1.amazonaws.com/wp-content/uploads/2026/03/03122610/banner.png')] bg-cover bg-center opacity-15" />
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-amber-500/5 to-transparent" />
        <div className="relative z-10 space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className="bg-amber-500 text-white border-0 text-xs font-bold px-3">📅 21 DE MARÇO</Badge>
            <Badge variant="outline" className="border-white/20 text-white/70 text-[10px]">15ª Edição</Badge>
            <Badge variant="outline" className="border-white/20 text-white/70 text-[10px]">O Maior Evento Imobiliário do Brasil</Badge>
          </div>
          <h1 className="text-2xl md:text-4xl font-black text-white leading-tight">
            Melnick Day 2026
          </h1>
          <p className="text-white/60 text-sm leading-relaxed max-w-lg">
            O dia que vai transformar a sua história. Descontos de até <strong className="text-amber-400">40%</strong>, carro como entrada, super avaliação de dação e negociação direta com a diretoria.
          </p>
          <CountdownTimer />
          <div className="flex gap-2 pt-1 flex-wrap">
            <Button size="sm" className="gap-1.5 bg-amber-500 hover:bg-amber-600 text-white border-0" onClick={() => window.open("https://www.melnick.com.br/melnickday/", "_blank")}>
              <ExternalLink className="h-3.5 w-3.5" /> Site Oficial
            </Button>
            <Button size="sm" className="gap-1.5 bg-white/15 hover:bg-white/25 text-white border border-white/30 backdrop-blur-sm" onClick={() => navigate("/oferta-ativa")}>
              <Zap className="h-3.5 w-3.5" /> Iniciar Oferta Ativa
            </Button>
            <Button size="sm" className="gap-1.5 bg-white/15 hover:bg-white/25 text-white border border-white/30 backdrop-blur-sm" onClick={() => navigate("/pipeline")}>
              <Target className="h-3.5 w-3.5" /> Meu Pipeline
            </Button>
          </div>
        </div>
      </div>

      {/* ── NÚMEROS HISTÓRICOS ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          { icon: Home, value: "4.500+", label: "Unidades Vendidas", color: "text-primary" },
          { icon: DollarSign, value: "R$ 2,5 BI", label: "em Vendas", color: "text-emerald-600" },
          { icon: Trophy, value: "R$ 125 MI", label: "em Comissões", color: "text-amber-500" },
          { icon: Users, value: "6.000+", label: "Pessoas em Filas", color: "text-purple-600" },
        ].map((s) => (
          <Card key={s.label} className="p-3 border-border/50 text-center">
            <s.icon className={`h-5 w-5 mx-auto mb-1 ${s.color}`} />
            <p className={`text-lg md:text-xl font-black ${s.color}`}>{s.value}</p>
            <p className="text-[10px] text-muted-foreground leading-tight">{s.label}</p>
          </Card>
        ))}
      </div>

      {/* ── COMO VENDER ── */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" /> Como Vender no Melnick Day
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {[
            { icon: Users, text: "Levar clientes para visitar as obras ANTES do evento" },
            { icon: MessageSquare, text: "Manter o cliente engajado até o Dia D (21/03)" },
            { icon: Star, text: "Entender a metodologia: Unidades Ouro (maior desconto) → Prata → Bronze" },
            { icon: Car, text: "Usar super avaliação de dação e carro como entrada como argumentos" },
            { icon: TrendingUp, text: "Focar nas Unidades Ouro — os maiores descontos acabam primeiro" },
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-2">
              <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                <item.icon className="h-3 w-3 text-primary" />
              </div>
              <p className="text-xs text-foreground/80">{item.text}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* ── METODOLOGIA OURO/PRATA/BRONZE ── */}
      <Card className="border-amber-200 overflow-hidden">
        <CardHeader className="pb-2 bg-gradient-to-r from-amber-50 to-yellow-50">
          <CardTitle className="text-sm flex items-center gap-2">
            <Star className="h-4 w-4 text-amber-500" /> Metodologia de Preços — Lote Ouro / Prata / Bronze
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-3">
          <div className="grid grid-cols-3 gap-2 mb-3">
            {[
              { lote: "🥇 Ouro", desc: "Maiores descontos", ex: "até -28% VPL", bg: "bg-amber-100 border-amber-300" },
              { lote: "🥈 Prata", desc: "Descontos intermediários", ex: "até -26% VPL", bg: "bg-gray-100 border-gray-300" },
              { lote: "🥉 Bronze", desc: "Descontos menores", ex: "até -24% VPL", bg: "bg-orange-100 border-orange-300" },
            ].map((l) => (
              <div key={l.lote} className={`rounded-lg border p-2.5 text-center ${l.bg}`}>
                <p className="text-xs font-bold">{l.lote}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{l.desc}</p>
                <p className="text-[10px] font-semibold mt-1">{l.ex}</p>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">
            ⚡ Unidades selecionadas com os maiores descontos são vendidas por <strong>ordem de chegada</strong>. Quem reserva primeiro, garante o Lote Ouro.
          </p>
        </CardContent>
      </Card>

      {/* ── ATRIBUTOS DA CAMPANHA ── */}
      <div className="grid grid-cols-2 gap-2">
        <Card className="p-3 border-border/50 space-y-1.5">
          <div className="flex items-center gap-1.5">
            <Car className="h-4 w-4 text-primary" />
            <span className="text-xs font-bold text-foreground">Carro no Negócio</span>
          </div>
          <p className="text-[10px] text-muted-foreground">Use seu carro como parte da entrada do imóvel.</p>
        </Card>
        <Card className="p-3 border-border/50 space-y-1.5">
          <div className="flex items-center gap-1.5">
            <Home className="h-4 w-4 text-amber-500" />
            <span className="text-xs font-bold text-foreground">Super Avaliação Dação</span>
          </div>
          <p className="text-[10px] text-muted-foreground">Seu imóvel avaliado acima do mercado. Ex: R$ 1M → R$ 900 mil (deságio de apenas 10%).</p>
        </Card>
        <Card className="p-3 border-border/50 space-y-1.5">
          <div className="flex items-center gap-1.5">
            <FileText className="h-4 w-4 text-emerald-500" />
            <span className="text-xs font-bold text-foreground">ITBI + Registro Pagos</span>
          </div>
          <p className="text-[10px] text-muted-foreground">Válido para linha Open e Investimento/Compactos.</p>
        </Card>
        <Card className="p-3 border-border/50 space-y-1.5">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-purple-500" />
            <span className="text-xs font-bold text-foreground">Aprovação Diretoria</span>
          </div>
          <p className="text-[10px] text-muted-foreground">Negociação direta com a diretoria no Dia D para fechar o negócio.</p>
        </Card>
      </div>

      {/* ── PREMIAÇÃO / VIAGEM ── */}
      <Card className="border-purple-200 bg-gradient-to-r from-purple-50/50 to-pink-50/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Plane className="h-4 w-4 text-purple-600" /> Premiação — Vendeu, Viajou! ✈️
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-foreground/80">
            +1.000 corretores viajaram nos últimos 4 anos (Maceió 2022, Cruzeiro 2023, Angra dos Reis 2024, Bahia 2025).
          </p>
          <div className="space-y-1.5">
            <div className="flex items-start gap-2 bg-white/60 rounded-lg p-2 border border-purple-100">
              <Gift className="h-4 w-4 text-purple-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-foreground">Não Represados (Compactos, Open, Comercial)</p>
                <p className="text-[10px] text-muted-foreground">Vendeu = viajou. Vendas de 05/03 a 18/03. Open: a cada 4 vendas da imobiliária = 1 viagem sorteada.</p>
              </div>
            </div>
            <div className="flex items-start gap-2 bg-white/60 rounded-lg p-2 border border-purple-100">
              <Trophy className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-foreground">Represados (2D, 3D Family, Residencial)</p>
                <p className="text-[10px] text-muted-foreground">Vendas concentradas no Dia D (21/03). A partir de R$ 1M vendido = viagem.</p>
              </div>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground italic">
            * Não válido para reversão de locação, dações e linha Open. Premiação em todos os produtos.
          </p>
        </CardContent>
      </Card>

      {/* ── BUSCA ── */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Buscar empreendimento ou bairro..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-border bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      {/* ── TABS POR SEGMENTO ── */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="w-full flex-wrap h-auto gap-1 bg-muted/50 p-1">
          {segKeys.map((k) => (
            <TabsTrigger key={k} value={k} className="text-[11px] flex-1 min-w-[60px] gap-1 py-2">
              <span>{SEGMENTOS[k].emoji}</span>
              <span className="hidden sm:inline">{SEGMENTOS[k].label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {segKeys.map((k) => {
          const seg = SEGMENTOS[k];
          const q = search.toLowerCase().trim();
          const emps = q ? seg.empreendimentos.filter((e) => e.nome.toLowerCase().includes(q) || e.bairro.toLowerCase().includes(q)) : seg.empreendimentos;
          return (
            <TabsContent key={k} value={k} className="space-y-4 mt-0">
              {/* Condições do segmento */}
              <Card className={`border ${seg.corBg}`}>
                <CardContent className="p-3">
                  <h4 className={`text-xs font-bold mb-1.5 flex items-center gap-1.5 ${seg.cor}`}>
                    <Tag className="h-3.5 w-3.5" /> Condições — {seg.label}
                  </h4>
                  <ul className="space-y-0.5">
                    {seg.condicoes.map((c, i) => (
                      <li key={i} className="text-[11px] text-foreground/70 flex items-start gap-1.5">
                        <span className="mt-1 w-1 h-1 rounded-full bg-current shrink-0" />
                        {c}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-2 pt-2 border-t border-border/30">
                    <p className="text-[10px] text-muted-foreground flex items-start gap-1">
                      <Sparkles className="h-3 w-3 shrink-0 mt-0.5" />
                      {seg.metodologia}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Empreendimentos */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-primary" />
                    Empreendimentos ({emps.length})
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-[11px] gap-1 h-7"
                    onClick={() => {
                      const allNames = emps.map((e) => e.nome);
                      const allSelected = allNames.every((n) => selectedEmps.has(n));
                      setSelectedEmps((prev) => {
                        const next = new Set(prev);
                        allNames.forEach((n) => allSelected ? next.delete(n) : next.add(n));
                        return next;
                      });
                    }}
                  >
                    <CheckSquare className="h-3 w-3" />
                    {emps.every((e) => selectedEmps.has(e.nome)) ? "Desmarcar todos" : "Selecionar todos"}
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
                        segKey={k}
                        selected={selectedEmps.has(emp.nome)}
                        onToggle={() => toggleEmp(emp.nome)}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Scripts */}
              <div>
                <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-emerald-500" />
                  Scripts de Venda — {seg.label}
                </h3>
                <ScriptSection segKey={k} />
              </div>
            </TabsContent>
          );
        })}
      </Tabs>

      {/* ── AÇÕES RÁPIDAS FOOTER ── */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4">
          <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" /> Ações Rápidas do Corretor
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs justify-start" onClick={() => navigate("/oferta-ativa")}>
              <Phone className="h-3.5 w-3.5" /> Iniciar Oferta Ativa
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs justify-start" onClick={() => navigate("/pipeline")}>
              <Target className="h-3.5 w-3.5" /> Abrir Pipeline
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs justify-start" onClick={() => navigate("/visitas")}>
              <MapPin className="h-3.5 w-3.5" /> Agendar Visita
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs justify-start" onClick={() => navigate("/scripts")}>
              <FileText className="h-3.5 w-3.5" /> Mais Scripts
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── FLOATING SELECTION BAR ── */}
      {selectedEmps.size > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-foreground text-background rounded-2xl shadow-2xl px-4 py-3 flex items-center gap-3 max-w-lg w-[calc(100%-2rem)] animate-in slide-in-from-bottom-4">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0">
              <span className="text-sm font-bold text-primary-foreground">{selectedEmps.size}</span>
            </div>
            <span className="text-sm font-medium truncate">
              {selectedEmps.size === 1 ? "1 oferta selecionada" : `${selectedEmps.size} ofertas selecionadas`}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              variant="secondary"
              className="gap-1.5 text-xs"
              onClick={() => {
                // Generate WhatsApp message with all selected
                let msg = `🔥 *Melnick Day 2026* — Ofertas selecionadas:\n\n`;
                selectedEmpData.forEach((emp) => {
                  msg += `🏠 *${emp.nome}* — ${emp.bairro}\n`;
                  msg += `📐 ${emp.metragens} · ${emp.dorms}\n`;
                  if (emp.precoPor) msg += `💰 ${emp.precoPor}`;
                  if (emp.precoDe) msg += ` (era ${emp.precoDe})`;
                  msg += `\n\n`;
                });
                msg += `📅 Condições válidas até 21/03!\nMe chama para saber mais! 😊`;
                window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
              }}
            >
              <Send className="h-3 w-3" /> WhatsApp
            </Button>
            <Button
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() => setShowVitrineDialog(true)}
            >
              <Link2 className="h-3 w-3" /> Criar Vitrine
            </Button>
          </div>
        </div>
      )}

      {/* ── VITRINE CREATION DIALOG ── */}
      <Dialog open={showVitrineDialog} onOpenChange={setShowVitrineDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="h-5 w-5 text-primary" />
              Criar Vitrine Melnick Day
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Título da vitrine</label>
              <Input
                value={vitrineTitle}
                onChange={(e) => setVitrineTitle(e.target.value)}
                placeholder="Ex: Ofertas exclusivas para você"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Mensagem personalizada (opcional)</label>
              <Textarea
                value={vitrineMsg}
                onChange={(e) => setVitrineMsg(e.target.value)}
                placeholder="Ex: Oi João, separei essas ofertas especiais do Melnick Day pensando no seu perfil..."
                rows={3}
              />
            </div>
            <div className="bg-muted/50 rounded-lg p-3 space-y-1">
              <p className="text-xs font-semibold text-foreground">{selectedEmps.size} ofertas selecionadas:</p>
              <div className="flex flex-wrap gap-1">
                {selectedEmpData.slice(0, 8).map((emp) => (
                  <Badge key={emp.nome} variant="secondary" className="text-[10px]">{emp.nome}</Badge>
                ))}
                {selectedEmpData.length > 8 && (
                  <Badge variant="outline" className="text-[10px]">+{selectedEmpData.length - 8}</Badge>
                )}
              </div>
            </div>

            {vitrineLink && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 space-y-2">
                <p className="text-xs font-semibold text-emerald-700">✅ Vitrine criada!</p>
                <div className="flex items-center gap-2">
                  <Input value={vitrineLink} readOnly className="text-xs h-8 flex-1" />
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 px-2"
                    onClick={() => {
                      navigator.clipboard.writeText(vitrineLink);
                      toast.success("Link copiado!");
                    }}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(`${vitrineMsg || vitrineTitle}\n\nConfira as ofertas: ${vitrineLink}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
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
                    const { data: { user } } = await supabase.auth.getUser();
                    if (!user) {
                      toast.error("Faça login para criar uma vitrine");
                      return;
                    }

                    const dadosCustom = selectedEmpData.map((emp) => ({
                      nome: emp.nome,
                      bairro: emp.bairro,
                      metragens: emp.metragens,
                      dorms: emp.dorms,
                      status: emp.status,
                      precoDe: emp.precoDe,
                      precoPor: emp.precoPor,
                      descontoMax: emp.descontoMax,
                      imagens: emp.imagens,
                      condicoes: emp.condicoes,
                      segmento: emp.segmento,
                      m2: emp.m2,
                    }));

                    const { data, error } = await supabase
                      .from("vitrines")
                      .insert({
                        created_by: user.id,
                        titulo: vitrineTitle,
                        mensagem_corretor: vitrineMsg || null,
                        tipo: "melnick_day",
                        dados_custom: dadosCustom as any,
                      })
                      .select("id")
                      .single();

                    if (error) throw error;
                    const link = `https://uhomesales.com/vitrine/${data.id}`;
                    setVitrineLink(link);
                    navigator.clipboard.writeText(link);
                    toast.success("Vitrine criada! Link copiado.");
                  } catch (err) {
                    console.error(err);
                    toast.error("Erro ao criar vitrine");
                  } finally {
                    setCreatingVitrine(false);
                  }
                }}
                disabled={creatingVitrine || selectedEmps.size === 0}
                className="gap-1.5"
              >
                {creatingVitrine ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Link2 className="h-4 w-4" />
                )}
                Gerar Link da Vitrine
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
