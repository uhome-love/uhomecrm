import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate, useLocation } from "react-router-dom";
import { X, Phone, ExternalLink, Clock, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface BannerLead {
  id: string;
  nome: string;
  telefone: string | null;
  empreendimento: string | null;
  origem: string | null;
  created_at: string;
}

const MAX_BANNERS = 3;
const AUTO_CLOSE_MS = 300_000; // 5 minutes
const SLA_TOTAL_SEC = 300;

export default function NewLeadBanner() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [banners, setBanners] = useState<BannerLead[]>([]);
  const [isOnline, setIsOnline] = useState(true);
  const dismissedRef = useRef<Set<string>>(new Set());
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Check if corretor is online
  useEffect(() => {
    if (!user) return;
    const checkOnline = async () => {
      const { data } = await supabase
        .from("corretor_disponibilidade")
        .select("status")
        .eq("user_id", user.id)
        .maybeSingle();
      setIsOnline(data?.status !== "offline");
    };
    checkOnline();
    const ch = supabase
      .channel("disp-banner")
      .on("postgres_changes", { event: "*", schema: "public", table: "corretor_disponibilidade", filter: `user_id=eq.${user.id}` }, () => checkOnline())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  const dismissBanner = useCallback(async (leadId: string) => {
    dismissedRef.current.add(leadId);
    const timer = timersRef.current.get(leadId);
    if (timer) { clearTimeout(timer); timersRef.current.delete(leadId); }
    setBanners(prev => prev.filter(b => b.id !== leadId));

    // Mark as visualizado in notifications
    if (user) {
      await supabase.from("notifications").insert({
        user_id: user.id,
        titulo: "Novo Lead Recebido",
        mensagem: `Lead atribuído via roleta`,
        tipo: "lead_atribuido",
        categoria: "leads",
        dados: { pipeline_lead_id: leadId },
      }).then(() => {});
    }
  }, [user]);

  const scheduleAutoClose = useCallback((leadId: string) => {
    const timer = setTimeout(() => dismissBanner(leadId), AUTO_CLOSE_MS);
    timersRef.current.set(leadId, timer);
  }, [dismissBanner]);

  // Listen for new leads assigned to this user
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("new-lead-banner")
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "pipeline_leads",
        filter: `corretor_id=eq.${user.id}`,
      }, (payload) => {
        const newRow = payload.new as any;
        const oldRow = payload.old as any;
        // Only trigger when corretor_id was just set (was null or different)
        if (oldRow?.corretor_id === newRow?.corretor_id) return;
        if (dismissedRef.current.has(newRow.id)) return;

        const lead: BannerLead = {
          id: newRow.id,
          nome: newRow.nome || "Novo Lead",
          telefone: newRow.telefone,
          empreendimento: newRow.empreendimento,
          origem: newRow.origem,
          created_at: newRow.created_at || new Date().toISOString(),
        };

        setBanners(prev => {
          if (prev.find(b => b.id === lead.id)) return prev;
          const updated = [lead, ...prev].slice(0, MAX_BANNERS);
          return updated;
        });
        scheduleAutoClose(lead.id);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      timersRef.current.forEach(t => clearTimeout(t));
      timersRef.current.clear();
    };
  }, [user, scheduleAutoClose]);

  // Don't render if offline, no banners, or already on aceite page
  const isOnAceitePage = location.pathname.includes("/aceite");
  if (!isOnline || banners.length === 0 || isOnAceitePage) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] flex flex-col items-center gap-2 pt-2 px-4 pointer-events-none">
      {banners.map((lead, idx) => {
        // Check if user is on this lead's page
        const isOnLeadPage = location.pathname.includes(lead.id);
        if (isOnLeadPage) return null;

        return (
          <BannerItem
            key={lead.id}
            lead={lead}
            index={idx}
            onDismiss={() => dismissBanner(lead.id)}
            onNavigate={() => {
              navigate(`/pipeline?lead=${lead.id}`);
              dismissBanner(lead.id);
            }}
          />
        );
      })}
    </div>
  );
}

function BannerItem({
  lead,
  index,
  onDismiss,
  onNavigate,
}: {
  lead: BannerLead;
  index: number;
  onDismiss: () => void;
  onNavigate: () => void;
}) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const createdAt = new Date(lead.created_at).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - createdAt) / 1000));
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [lead.created_at]);

  const remaining = Math.max(0, SLA_TOTAL_SEC - elapsed);
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const isUrgent = remaining < 60;

  const initial = lead.nome?.charAt(0)?.toUpperCase() || "?";

  return (
    <div
      className="pointer-events-auto w-full max-w-lg animate-slide-in-from-top rounded-xl border border-primary/30 bg-card/98 backdrop-blur-xl shadow-2xl shadow-primary/10 transition-all"
      style={{ animationDelay: `${index * 80}ms`, animationFillMode: "both" }}
    >
      <div className="flex items-start gap-3 p-3 sm:p-4">
        {/* Avatar */}
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-sm">
          {initial}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <Badge className="bg-primary/15 text-primary border-primary/30 text-[10px] font-bold uppercase tracking-wider">
              Novo Lead!
            </Badge>
            <span className="text-sm font-semibold text-foreground truncate">{lead.nome}</span>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {lead.empreendimento && <span className="truncate">{lead.empreendimento}</span>}
            {lead.empreendimento && lead.origem && <span>·</span>}
            {lead.origem && <span className="truncate">{lead.origem}</span>}
          </div>

          <div className="flex items-center gap-3 pt-1">
            <div className={`flex items-center gap-1 font-mono text-xs font-bold ${isUrgent ? "text-destructive animate-pulse" : "text-amber-500"}`}>
              <Clock className="h-3 w-3" />
              SLA: {mins}:{secs.toString().padStart(2, "0")}
            </div>

            <div className="flex items-center gap-1.5 ml-auto">
              {lead.telefone && (
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1 px-2" asChild>
                  <a href={`tel:${lead.telefone}`}>
                    <Phone className="h-3 w-3" />
                    Ligar
                  </a>
                </Button>
              )}
              <Button size="sm" className="h-7 text-xs gap-1 px-2" onClick={onNavigate}>
                <ExternalLink className="h-3 w-3" />
                Ver Lead
              </Button>
            </div>
          </div>
        </div>

        {/* Close button */}
        <button
          onClick={onDismiss}
          className="shrink-0 rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
