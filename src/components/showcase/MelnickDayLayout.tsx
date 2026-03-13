import { motion } from "framer-motion";
import CampaignHeader from "./CampaignHeader";
import PropertyCard from "./PropertyCard";
import ContactCTA from "./ContactCTA";
import FooterBranding from "./FooterBranding";
import type { ShowcaseData } from "./types";

interface Props {
  data: ShowcaseData;
}

/**
 * Layout: Seleção especial Melnick Day (campanha/oferta)
 * Campaign header + property grid + CTA
 */
export default function MelnickDayLayout({ data }: Props) {
  const { vitrine, corretor, imoveis } = data;

  const isMegaCyrela = vitrine.tipo === "mega_cyrela";
  const campaignName = isMegaCyrela ? "Mega da Cyrela 2026" : "Melnick Day 2026";

  const whatsappBase = corretor?.telefone
    ? `https://wa.me/55${corretor.telefone.replace(/\D/g, "")}`
    : null;

  const whatsappLink = whatsappBase
    ? `${whatsappBase}?text=${encodeURIComponent(`Olá ${corretor!.nome}! Vi as ofertas da ${campaignName} e quero mais informações!`)}`
    : null;

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 40%, #f1f5f9 100%)" }}>
      <CampaignHeader vitrine={vitrine} corretor={corretor} badgeText={isMegaCyrela ? "⚽ Seleção Cyrela 2026" : "Seleção Melnick Day 2026"} />

      {/* Property Grid */}
      <section className="max-w-6xl mx-auto px-4 sm:px-8 py-10 sm:py-16">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-10 sm:mb-14"
        >
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-blue-600/60 mb-2">Oportunidades exclusivas</p>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-800">
            {imoveis.length} empreendimento{imoveis.length !== 1 ? "s" : ""} selecionado{imoveis.length !== 1 ? "s" : ""}
          </h2>
          <div className="mt-4 mx-auto w-16 h-1 rounded-full" style={{ background: "linear-gradient(90deg, #3b82f6, #f59e0b)" }} />
        </motion.div>

        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {imoveis.map((item, idx) => (
            <PropertyCard
              key={idx}
              item={item}
              index={idx}
              variant="campaign"
              whatsappBase={whatsappBase}
              corretorNome={corretor?.nome}
            />
          ))}
        </div>
      </section>

      {/* CTA */}
      {corretor && whatsappLink && (
        <ContactCTA corretor={corretor} cor="#1e40af" whatsappLink={whatsappLink} variant="campaign" />
      )}

      <FooterBranding corretorNome={corretor?.nome} brandSuffix="Melnick Day 2026" />
    </div>
  );
}
