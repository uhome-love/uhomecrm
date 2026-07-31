import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Phone, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * Faixa discreta exibida apenas para quem está sem telefone no perfil.
 * Sem o número, o corretor não recebe o aviso de novo lead no WhatsApp.
 */
export default function TelefoneFaltandoBanner() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(
    () => typeof window !== "undefined" && sessionStorage.getItem("uhome_tel_banner_dismissed") === "1"
  );

  const { data: telefone } = useQuery({
    queryKey: ["profile-telefone", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("telefone")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return (data?.telefone ?? "") as string;
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  const digits = (telefone ?? "").replace(/\D/g, "");
  if (dismissed || telefone === undefined || digits.length >= 10) return null;

  return (
    <div className="flex items-center gap-3 border-b border-amber-300/60 bg-amber-50 px-4 py-2 text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-200">
      <Phone className="h-4 w-4 shrink-0" />
      <p className="flex-1 text-xs">
        Cadastre seu WhatsApp nas configurações — sem o número você não recebe o aviso de novo lead.
      </p>
      <Button
        size="sm"
        className="h-7 text-xs"
        onClick={() => navigate("/configuracoes?secao=perfil")}
      >
        Cadastrar agora
      </Button>
      <button
        aria-label="Dispensar aviso"
        className="rounded p-1 hover:bg-amber-100 dark:hover:bg-amber-900/40"
        onClick={() => {
          sessionStorage.setItem("uhome_tel_banner_dismissed", "1");
          setDismissed(true);
        }}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
