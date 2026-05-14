import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/customClient";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

export default function OAuthGoogleCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [msg, setMsg] = useState("Conectando ao Google...");
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const code = params.get("code");
    const state = params.get("state");
    const error = params.get("error");

    if (error) {
      setStatus("error");
      setMsg(`Google retornou erro: ${error}`);
      return;
    }
    if (!code || !state) {
      setStatus("error");
      setMsg("Parâmetros inválidos no retorno do Google.");
      return;
    }

    (async () => {
      const { data, error: fnErr } = await supabase.functions.invoke("google-oauth-callback", {
        body: { code, state, redirect_origin: window.location.origin },
      });
      if (fnErr || !data?.success) {
        setStatus("error");
        setMsg(fnErr?.message || data?.error || "Falha ao concluir conexão");
        return;
      }
      setStatus("ok");
      setMsg(`Conectado como ${data.account_email}`);
      toast.success("Google Calendar conectado!");
      setTimeout(() => navigate("/integracoes", { replace: true }), 1500);
    })();
  }, [params, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="text-center space-y-4 max-w-md">
        {status === "loading" && <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary" />}
        {status === "ok" && <CheckCircle2 className="h-10 w-10 mx-auto text-emerald-600" />}
        {status === "error" && <XCircle className="h-10 w-10 mx-auto text-destructive" />}
        <p className="text-base">{msg}</p>
        {status === "error" && (
          <button onClick={() => navigate("/integracoes")} className="text-sm underline text-primary">
            Voltar para Integrações
          </button>
        )}
      </div>
    </div>
  );
}
