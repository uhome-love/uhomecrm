/**
 * MelnickDayLanding — Public landing page for Brevo SMS campaign
 * 
 * Captures URL params, registers click/lead via edge function,
 * then redirects to WhatsApp. Shows brief loading state.
 */
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";

const WHATSAPP_URL = "https://wa.me/5551992597097?text=Quero%20saber%20mais%20Melnick%20Day";
const EDGE_FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/campaign-sms-click`;

export default function MelnickDayLanding() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<"loading" | "redirecting" | "error">("loading");
  const called = useRef(false);

  useEffect(() => {
    if (called.current) return;
    called.current = true;

    const phone = searchParams.get("phone") || searchParams.get("telefone") || "";
    const nome = searchParams.get("nome") || searchParams.get("name") || "";
    const email = searchParams.get("email") || "";
    const utm_source = searchParams.get("utm_source") || "brevo";
    const utm_medium = searchParams.get("utm_medium") || "sms";
    const utm_campaign = searchParams.get("utm_campaign") || "melnick_day_poa_2026";

    const payload = {
      phone,
      nome,
      email,
      utm_source,
      utm_medium,
      utm_campaign,
      canal: "brevo",
      origem: "SMS_MELNICK_DAY",
      campanha: "MELNICK_DAY_POA_2026",
      user_agent: navigator.userAgent,
    };

    const processClick = async () => {
      try {
        const res = await fetch(EDGE_FN_URL, {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        console.info("[MelnickDay SMS] Response:", data);
      } catch (err) {
        console.error("[MelnickDay SMS] Error:", err);
      }

      // Always redirect, even if the API call failed
      setStatus("redirecting");
      setTimeout(() => {
        window.location.href = WHATSAPP_URL;
      }, 800);
    };

    processClick();
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-center space-y-4 px-6">
        <div className="w-16 h-16 mx-auto rounded-full bg-orange-500/20 flex items-center justify-center">
          <span className="text-3xl">🔥</span>
        </div>
        <h1 className="text-2xl font-bold text-white">
          Melnick Day
        </h1>
        <p className="text-orange-300 text-sm">
          {status === "loading" && "Preparando seu atendimento..."}
          {status === "redirecting" && "Redirecionando para o WhatsApp..."}
          {status === "error" && "Redirecionando..."}
        </p>
        <Loader2 className="h-6 w-6 animate-spin text-orange-400 mx-auto" />
        <p className="text-xs text-white/40 mt-8">
          Caso não seja redirecionado,{" "}
          <a href={WHATSAPP_URL} className="text-orange-400 underline">
            clique aqui
          </a>
        </p>
      </div>
    </div>
  );
}
