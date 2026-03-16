/**
 * WhatsAppLanding — Public landing page for WhatsApp/SMS/Email campaign links
 * Route: /wa
 * Captures URL params, registers click + upserts lead via campaign-sms-click edge function,
 * then redirects to WhatsApp.
 */
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";

const WHATSAPP_URL = "https://wa.me/5551992597097?text=Quero%20saber%20mais%20sobre%20o%20Melnick%20Day";
const EDGE_FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/campaign-sms-click`;

export default function WhatsAppLanding() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<"loading" | "redirecting">("loading");
  const called = useRef(false);

  useEffect(() => {
    if (called.current) return;
    called.current = true;

    const phone = searchParams.get("phone") || searchParams.get("telefone") || "";
    const nome = searchParams.get("nome") || searchParams.get("name") || "";
    const email = searchParams.get("email") || "";
    const origem = searchParams.get("origem") || "whatsapp_api";
    const campanha = searchParams.get("campanha") || "melnick_day_2026";
    const bloco = searchParams.get("bloco") || "";
    const utm_source = searchParams.get("utm_source") || origem;
    const utm_medium = searchParams.get("utm_medium") || "whatsapp";
    const utm_campaign = searchParams.get("utm_campaign") || campanha;

    const payload = {
      phone,
      nome,
      email,
      utm_source,
      utm_medium,
      utm_campaign,
      canal: origem.includes("email") ? "email" : origem.includes("sms") ? "sms" : "whatsapp",
      origem,
      campanha,
      bloco,
      user_agent: navigator.userAgent,
    };

    (async () => {
      try {
        const res = await fetch(EDGE_FN_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        console.info("[WA Landing] Response:", data);
      } catch (err) {
        console.error("[WA Landing] Error:", err);
      }

      setStatus("redirecting");
      setTimeout(() => {
        window.location.href = WHATSAPP_URL;
      }, 600);
    })();
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-center space-y-4 px-6">
        <div className="w-16 h-16 mx-auto rounded-full bg-green-500/20 flex items-center justify-center">
          <span className="text-3xl">💬</span>
        </div>
        <h1 className="text-2xl font-bold text-white">Melnick Day</h1>
        <p className="text-green-300 text-sm">
          {status === "loading" ? "Preparando seu atendimento..." : "Redirecionando para o WhatsApp..."}
        </p>
        <Loader2 className="h-6 w-6 animate-spin text-green-400 mx-auto" />
        <p className="text-xs text-white/40 mt-8">
          Caso não seja redirecionado,{" "}
          <a href={WHATSAPP_URL} className="text-green-400 underline">clique aqui</a>
        </p>
      </div>
    </div>
  );
}
