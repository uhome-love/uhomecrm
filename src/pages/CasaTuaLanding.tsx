/**
 * CasaTuaLanding — Landing page pública de captura para campanha Casa Tua Abril 2026.
 * Envia o lead para receive-landing-lead → CRM/Roleta.
 */
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Loader2, Home, CheckCircle, MapPin, Gift, AlertTriangle } from "lucide-react";

const EDGE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/receive-landing-lead`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export default function CasaTuaLanding() {
  const [params] = useSearchParams();
  const [form, setForm] = useState({ nome: params.get("nome") || "", telefone: params.get("phone") || "", email: params.get("email") || "" });
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const utm_source = params.get("utm_source") || params.get("origem") || "campanha_email_whatsapp";
  const utm_medium = params.get("utm_medium") || "landing";
  const utm_campaign = params.get("utm_campaign") || "casa_tua_abril_2026";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const nome = form.nome.trim();
    const telefone = form.telefone.replace(/\D/g, "");
    const email = form.email.trim();

    if (!nome) return setError("Preencha seu nome");
    if (telefone.length < 10) return setError("Telefone inválido");

    setSending(true);
    try {
      const res = await fetch(EDGE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: ANON_KEY },
        body: JSON.stringify({
          name: nome,
          phone: telefone,
          email: email || undefined,
          empreendimento: "Casa Tua",
          source: "landing_casa_tua_abril",
          campaign_name: "Copa Uhome + Encorp — Casa Tua Abril",
          platform: "Landing Page Casa Tua",
          utm_source,
          utm_medium,
          utm_campaign,
          message: "Interesse via landing page campanha abril",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Erro ao enviar");
      setDone(true);
    } catch (err: any) {
      setError(err.message || "Erro inesperado. Tente novamente.");
    } finally {
      setSending(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0c1e3a] to-[#1a365d] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center space-y-4 animate-in fade-in">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
          <h2 className="text-2xl font-bold text-gray-900">Recebemos seu interesse!</h2>
          <p className="text-gray-600">
            Em breve um dos nossos corretores vai entrar em contato com você para agendar sua visita ao <strong>Casa Tua</strong>.
          </p>
          <p className="text-sm text-gray-400">Uhome Inteligência Imobiliária</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0c1e3a] via-[#1a365d] to-[#0c1e3a]">
      {/* Hero */}
      <div className="text-center pt-8 pb-4 px-4">
        <div className="inline-block bg-[#f0c040]/20 border border-[#f0c040]/40 rounded-full px-4 py-1.5 mb-4">
          <span className="text-[#f0c040] text-sm font-semibold">🔥 Mês Abril | Copa Uhome + Encorp</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight mb-1">CASA TUA</h1>
        <p className="text-lg text-[#a8c8e8]">Zona Norte — Casas prontas com condições especiais</p>
      </div>

      {/* Cards de opções */}
      <div className="max-w-md mx-auto px-4 space-y-3 mb-4">
        <div className="bg-white/10 backdrop-blur border border-white/20 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <Home className="h-8 w-8 text-[#f0c040] flex-shrink-0" />
            <div>
              <p className="text-white font-bold text-lg">2 Dormitórios | 100m²</p>
              <p className="text-green-400 font-bold text-xl">R$ 499 mil <span className="text-sm text-white/60 font-normal">| 10% entrada</span></p>
            </div>
          </div>
        </div>

        <div className="bg-white/10 backdrop-blur border border-white/20 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <Home className="h-8 w-8 text-[#f0c040] flex-shrink-0" />
            <div>
              <p className="text-white font-bold text-lg">3 Dormitórios | 127m²</p>
              <p className="text-green-400 font-bold text-xl">R$ 599 mil <span className="text-sm text-white/60 font-normal">| 10% entrada</span></p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/40 rounded-xl p-3 text-center">
          <Gift className="h-5 w-5 text-amber-400 mx-auto mb-1" />
          <p className="text-amber-200 font-semibold text-sm">Comprou até 30 de abril — ganhou uma <strong className="text-white">ADEGA DE VINHOS</strong></p>
        </div>

        <div className="flex items-center justify-center gap-2 text-red-400">
          <AlertTriangle className="h-4 w-4" />
          <p className="text-sm font-semibold">Últimas casas promocionais</p>
        </div>
      </div>

      {/* Formulário */}
      <div className="max-w-md mx-auto px-4 pb-10">
        <div className="bg-white rounded-2xl shadow-2xl p-6 space-y-4">
          <div className="text-center">
            <h2 className="text-xl font-bold text-gray-900">Quero saber mais!</h2>
            <p className="text-sm text-gray-500">Preencha seus dados e um corretor entrará em contato</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Nome *</label>
              <input
                type="text"
                value={form.nome}
                onChange={(e) => setForm((p) => ({ ...p, nome: e.target.value }))}
                placeholder="Seu nome completo"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#1a365d] focus:border-transparent outline-none"
                maxLength={100}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Telefone *</label>
              <input
                type="tel"
                value={form.telefone}
                onChange={(e) => setForm((p) => ({ ...p, telefone: e.target.value }))}
                placeholder="(51) 99999-9999"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#1a365d] focus:border-transparent outline-none"
                maxLength={20}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">E-mail (opcional)</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                placeholder="seu@email.com"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#1a365d] focus:border-transparent outline-none"
                maxLength={255}
              />
            </div>

            {error && <p className="text-red-600 text-sm text-center">{error}</p>}

            <button
              type="submit"
              disabled={sending}
              className="w-full bg-[#25d366] hover:bg-[#1fb855] text-white font-bold py-3.5 rounded-lg text-base transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
              {sending ? "Enviando..." : "💬 Quero agendar minha visita"}
            </button>
          </form>

          <div className="flex items-center justify-center gap-1.5 text-gray-400 text-xs">
            <MapPin className="h-3.5 w-3.5" />
            <span>Zona Norte — Porto Alegre</span>
          </div>
        </div>

        <p className="text-center text-xs text-white/30 mt-4">Uhome Inteligência Imobiliária · uhome.com.br</p>
      </div>
    </div>
  );
}
