import { MessageCircle, Phone } from "lucide-react";
import type { ShowcaseCorretor } from "./types";

interface ConsultantCardProps {
  corretor: ShowcaseCorretor;
  cor: string;
  whatsappLink: string | null;
  contextLabel?: string;
}

export default function ConsultantCard({ corretor, cor, whatsappLink, contextLabel = "Seleção para você" }: ConsultantCardProps) {
  return (
    <div className="space-y-5">
      {/* Corretor info */}
      <div className="flex items-center gap-4">
        {corretor.avatar_url ? (
          <img src={corretor.avatar_url} alt={corretor.nome}
            className="w-16 h-16 rounded-full border-3 object-cover shadow-lg"
            style={{ borderColor: `${cor}40` }}
          />
        ) : (
          <div className="w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-lg"
            style={{ background: `linear-gradient(135deg, ${cor}, ${cor}cc)` }}>
            {corretor.nome.charAt(0)}
          </div>
        )}
        <div>
          <p className="text-[11px] uppercase tracking-[0.15em] font-medium text-slate-400">{contextLabel}</p>
          <p className="text-lg font-bold text-slate-900">{corretor.nome}</p>
        </div>
      </div>

      <div className="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />

      {/* CTA WhatsApp */}
      {whatsappLink && (
        <a
          href={whatsappLink}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-3 w-full py-4 rounded-xl text-white font-bold text-base shadow-lg transition-all hover:shadow-xl hover:scale-[1.02]"
          style={{ backgroundColor: cor, boxShadow: `0 10px 25px -5px ${cor}40` }}
        >
          <MessageCircle className="h-5 w-5" />
          Falar com {corretor.nome.split(" ")[0]}
        </a>
      )}

      {corretor.telefone && (
        <a
          href={`tel:+55${corretor.telefone.replace(/\D/g, "")}`}
          className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-slate-200 text-slate-700 font-semibold text-sm hover:bg-slate-50 transition-colors"
        >
          <Phone className="h-4 w-4" style={{ color: cor }} />
          Ligar agora
        </a>
      )}

      <p className="text-xs text-slate-400 text-center">Atendimento personalizado para você</p>
    </div>
  );
}
