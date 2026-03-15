import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { format, isWeekend } from "date-fns";
import { useNavigate } from "react-router-dom";

const ENCERRA = new Date("2026-03-31T23:59:59");

export default function MelnickMetaBanner() {
  const { user } = useAuth();
  const { isGestor, isAdmin } = useUserRole();
  const [show, setShow] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user || !isGestor || new Date() > ENCERRA) { setShow(false); return; }
    const now = new Date();
    if (isWeekend(now) || now.getHours() < 17) { setShow(false); return; }

    const today = format(now, "yyyy-MM-dd");
    supabase
      .from("melnick_metas_diarias")
      .select("id")
      .eq("gerente_id", user.id)
      .eq("data", today)
      .maybeSingle()
      .then(({ data }) => { setShow(!data); });
  }, [user, isGestor]);

  // Listen for save event
  useEffect(() => {
    const handler = () => setShow(false);
    window.addEventListener("melnick-meta-saved", handler);
    return () => window.removeEventListener("melnick-meta-saved", handler);
  }, []);

  if (!show) return null;

  return (
    <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-2 flex items-center justify-between text-sm text-amber-300">
      <span>⏰ Você ainda não registrou as metas do Melnick Day hoje.</span>
      <button onClick={() => navigate("/melnick-metas")} className="underline font-semibold hover:text-amber-200">
        Registrar agora →
      </button>
    </div>
  );
}
