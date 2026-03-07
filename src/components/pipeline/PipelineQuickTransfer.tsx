import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { UserPlus, Shuffle, ChevronDown, Loader2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";

interface TeamMember {
  id: string;
  user_id: string | null;
  nome: string;
  equipe: string | null;
}

interface Props {
  leadId: string;
  leadNome: string;
  currentCorretorId: string | null;
  onTransferred: (corretorId: string, corretorNome: string) => void;
}

export default function PipelineQuickTransfer({ leadId, leadNome, currentCorretorId, onTransferred }: Props) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load team members on first open
  useEffect(() => {
    if (!showDropdown || members.length > 0) return;
    setLoading(true);
    supabase
      .from("team_members")
      .select("id, user_id, nome, equipe")
      .eq("status", "ativo")
      .order("nome")
      .then(({ data }) => {
        setMembers(data || []);
        setLoading(false);
      });
  }, [showDropdown]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!showDropdown) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showDropdown]);

  const handleTransfer = async (member: TeamMember) => {
    if (!member.user_id) {
      toast.error("Corretor não possui usuário vinculado");
      return;
    }
    setTransferring(true);
    const { error } = await supabase
      .from("pipeline_leads")
      .update({ corretor_id: member.user_id, updated_at: new Date().toISOString() })
      .eq("id", leadId);

    if (error) {
      toast.error("Erro ao transferir lead");
    } else {
      toast.success(`Lead transferido para ${member.nome}`);
      onTransferred(member.user_id, member.nome);
    }
    setTransferring(false);
    setShowDropdown(false);
  };

  const handleRoleta = async () => {
    // Get corretores on today's escala
    const today = new Date().toISOString().split("T")[0];
    const { data: escala } = await supabase
      .from("distribuicao_escala")
      .select("corretor_id")
      .eq("data", today)
      .eq("ativo", true);

    if (!escala || escala.length === 0) {
      toast.error("Nenhum corretor na escala hoje. Configure a escala diária.");
      return;
    }

    // Filter out current corretor
    const available = escala.filter(e => e.corretor_id !== currentCorretorId);
    if (available.length === 0) {
      toast.error("Nenhum outro corretor disponível na escala");
      return;
    }

    // Random pick (round-robin simplified)
    const picked = available[Math.floor(Math.random() * available.length)];

    setTransferring(true);
    const { error } = await supabase
      .from("pipeline_leads")
      .update({ corretor_id: picked.corretor_id, distribuido_em: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", leadId);

    if (error) {
      toast.error("Erro ao distribuir lead");
    } else {
      // Get corretor name
      const { data: profile } = await supabase
        .from("team_members")
        .select("nome")
        .eq("user_id", picked.corretor_id)
        .single();
      const nome = profile?.nome || "Corretor";
      toast.success(`Lead enviado para roleta → ${nome}`);
      onTransferred(picked.corretor_id, nome);

      // Log distribution
      await supabase.from("distribuicao_historico").insert({
        pipeline_lead_id: leadId,
        corretor_id: picked.corretor_id,
        acao: "roleta_rapida",
      });
    }
    setTransferring(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="flex items-center gap-0.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={(e) => { e.stopPropagation(); setShowDropdown(!showDropdown); }}
              className="p-1.5 rounded-md hover:bg-accent transition-colors"
              disabled={transferring}
            >
              {transferring ? (
                <Loader2 className="h-3.5 w-3.5 text-primary animate-spin" />
              ) : (
                <UserPlus className="h-3.5 w-3.5 text-primary" />
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">Transferir</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={(e) => { e.stopPropagation(); handleRoleta(); }}
              className="p-1.5 rounded-md hover:bg-accent transition-colors"
              disabled={transferring}
            >
              <Shuffle className="h-3.5 w-3.5 text-primary" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">Roleta</TooltipContent>
        </Tooltip>
      </div>

      {showDropdown && (
        <div
          className="absolute top-full right-0 mt-1 w-48 bg-popover border border-border rounded-lg shadow-xl z-50 overflow-hidden animate-scale-in"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-1.5 border-b border-border bg-muted/50">
            <p className="text-[10px] font-semibold text-muted-foreground">Transferir para:</p>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-3">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : members.length === 0 ? (
              <p className="text-[10px] text-muted-foreground px-3 py-2">Nenhum corretor encontrado</p>
            ) : (
              members.map((m) => (
                <button
                  key={m.id}
                  onClick={() => handleTransfer(m)}
                  disabled={m.user_id === currentCorretorId}
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-between"
                >
                  <span className="truncate font-medium">{m.nome}</span>
                  {m.equipe && (
                    <span className="text-[9px] text-muted-foreground shrink-0 ml-1">{m.equipe}</span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
