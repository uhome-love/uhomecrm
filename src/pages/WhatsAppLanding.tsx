/**
 * WhatsAppLanding — Public landing page for WhatsApp/SMS/Email campaign links
 * Route: /wa and /wa/*
 * Captures URL params from BOTH query string (?phone=X) AND path segments (/wa/phone=X&nome=Y)
 * since Meta templates may construct URLs in either format.
 * Registers click + upserts lead via campaign-sms-click edge function,
 * then redirects to WhatsApp.
 */
import { useEffect, useRef, useState } from "react";
import { useSearchParams, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";

const WHATSAPP_URL = "https://wa.me/5551992597097?text=Quero%20saber%20mais%20sobre%20o%20Melnick%20Day";
const EDGE_FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/campaign-sms-click`;

/**
 * Parse params from both query string and path segments.
 * Meta template URLs may produce:
 *   /wa?phone=X&nome=Y  (query-based — if template URL is "https://domain/wa?{{1}}")
 *   /wa/phone=X&nome=Y  (path-based — if template URL is "https://domain/wa/{{1}}")
 */
function useAllParams(): URLSearchParams {
  const [searchParams] = useSearchParams();
  const location = useLocation();

  // If we have query params, use them directly
  if (searchParams.toString()) return searchParams;

  // Otherwise, try to parse from path: /wa/phone=X&nome=Y
  const pathAfterWa = location.pathname.replace(/^\/wa\/?/, "");
  if (pathAfterWa && pathAfterWa.includes("=")) {
    // Decode and parse as query string
    try {
      return new URLSearchParams(decodeURIComponent(pathAfterWa));
    } catch {
      return new URLSearchParams(pathAfterWa);
    }
  }

  return searchParams;
}

export default function WhatsAppLanding() {
  const params = useAllParams();
  const [status, setStatus] = useState<"loading" | "redirecting">("loading");
  const called = useRef(false);

  useEffect(() => {
    if (called.current) return;
    called.current = true;

    const phone = params.get("phone") || params.get("telefone") || "";
    const nome = params.get("nome") || params.get("name") || "";
    const email = params.get("email") || "";
    const origem = params.get("origem") || "whatsapp_api";
    const campanha = params.get("campanha") || "melnick_day_2026";
    const bloco = params.get("bloco") || "";
    const send_id = params.get("send_id") || "";
    const batch_id = params.get("batch_id") || "";
    const utm_source = params.get("utm_source") || origem;
    const utm_medium = params.get("utm_medium") || "whatsapp";
    const utm_campaign = params.get("utm_campaign") || campanha;

    const payload: Record<string, string> = {
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

    // Critical: pass send_id and batch_id for exact click attribution
    if (send_id) payload.send_id = send_id;
    if (batch_id) payload.batch_id = batch_id;

    console.info("[WA Landing] Params captured:", { phone, nome, campanha, origem, send_id, batch_id, path: location.pathname, search: location.search });

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
  }, [params]);

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
