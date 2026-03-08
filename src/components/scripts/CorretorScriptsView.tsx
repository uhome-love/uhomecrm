import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Copy, FileText, MessageCircle, Mail, Users, Loader2, ChevronDown, ChevronUp, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

export default function CorretorScriptsView() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [filterEmp, setFilterEmp] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: teamMember } = useQuery({
    queryKey: ["my-team-member", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("team_members")
        .select("gerente_id, equipe")
        .eq("user_id", user!.id)
        .eq("status", "ativo")
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const { data: scripts, isLoading } = useQuery({
    queryKey: ["corretor-team-scripts", teamMember?.gerente_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_scripts")
        .select("*")
        .eq("gerente_id", teamMember!.gerente_id)
        .eq("ativo", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!teamMember?.gerente_id,
  });

  const filtered = scripts?.filter(s => filterEmp === "all" || s.empreendimento === filterEmp) || [];
  const empreendimentos = [...new Set((scripts || []).map(s => s.empreendimento))];

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
  };

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-blue-500" /></div>;

  if (!teamMember) {
    return (
      <div
        className="text-center"
        style={{
          border: "1px dashed rgba(0,0,0,0.1)",
          borderRadius: 16,
          padding: "60px 24px",
          background: "#FAFAFA",
        }}
      >
        <div style={{ fontSize: 48 }} className="mb-3">👥</div>
        <p className="font-semibold text-gray-600" style={{ fontSize: 18 }}>Você não está vinculado a nenhum time</p>
        <p className="text-gray-400 mt-2" style={{ fontSize: 14 }}>Entre em contato com seu gerente para ser adicionado.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-bold text-gray-800 flex items-center gap-2" style={{ fontSize: 20 }}>
          <Users className="h-5 w-5 text-blue-500" /> Scripts do Meu Time
        </h2>
        <p className="text-gray-400 mt-1" style={{ fontSize: 14 }}>
          Scripts criados pelo seu gerente para uso na operação
        </p>
      </div>

      {empreendimentos.length > 0 && (
        <Select value={filterEmp} onValueChange={setFilterEmp}>
          <SelectTrigger className="w-52"><SelectValue placeholder="Todos empreendimentos" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos empreendimentos</SelectItem>
            {empreendimentos.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
          </SelectContent>
        </Select>
      )}

      {filtered.length === 0 ? (
        <div
          className="text-center"
          style={{
            border: "1px dashed rgba(0,0,0,0.1)",
            borderRadius: 16,
            padding: "60px 24px",
            background: "#FAFAFA",
          }}
        >
          <div style={{ fontSize: 48 }} className="mb-3">📝</div>
          <p className="font-semibold text-gray-600" style={{ fontSize: 18 }}>
            Nenhum script disponível ainda
          </p>
          <p className="text-gray-400 mt-2 max-w-sm mx-auto" style={{ fontSize: 14 }}>
            Seu gerente ainda não publicou scripts para o time.
            <br />Enquanto isso, explore o Marketplace! 🚀
          </p>
          <button
            onClick={() => navigate("/marketplace")}
            className="mt-5 inline-flex items-center gap-2 font-semibold text-white"
            style={{
              background: "#2563EB",
              borderRadius: 8,
              padding: "10px 20px",
              fontSize: 14,
              transition: "background 0.2s",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "#1D4ED8"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "#2563EB"; }}
          >
            <ShoppingBag className="h-4 w-4" /> Ver Marketplace
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((s: any) => {
            const isExpanded = expandedId === s.id;
            return (
              <div
                key={s.id}
                style={{
                  borderRadius: 16,
                  border: "1px solid rgba(0,0,0,0.06)",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                  background: "#fff",
                  transition: "all 0.25s ease",
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.08)";
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.04)";
                }}
              >
                <button
                  onClick={() => setExpandedId(isExpanded ? null : s.id)}
                  className="w-full flex items-center gap-3 p-5 text-left"
                >
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-800" style={{ fontSize: 15 }}>{s.titulo}</h3>
                    <div className="flex items-center gap-2 mt-1.5">
                      <Badge variant="outline" className="text-[11px] font-medium">{s.empreendimento}</Badge>
                      {s.campanha && <Badge variant="secondary" className="text-[11px]">{s.campanha}</Badge>}
                    </div>
                  </div>
                  {isExpanded
                    ? <ChevronUp className="h-4 w-4 text-gray-400" />
                    : <ChevronDown className="h-4 w-4 text-gray-400" />
                  }
                </button>

                {isExpanded && (
                  <div className="border-t border-gray-100 p-5 space-y-3">
                    {s.script_ligacao && (
                      <ScriptBlock
                        icon={FileText} label="Script Ligação" color="text-emerald-600"
                        text={s.script_ligacao} onCopy={() => copy(s.script_ligacao, "Script Ligação")}
                      />
                    )}
                    {s.script_whatsapp && (
                      <ScriptBlock
                        icon={MessageCircle} label="Script WhatsApp" color="text-green-600"
                        text={s.script_whatsapp} onCopy={() => copy(s.script_whatsapp, "Script WhatsApp")}
                      />
                    )}
                    {s.script_email && (
                      <ScriptBlock
                        icon={Mail} label="Script E-mail" color="text-blue-500"
                        text={s.script_email} onCopy={() => copy(s.script_email, "Script E-mail")}
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ScriptBlock({ icon: Icon, label, color, text, onCopy }: {
  icon: any; label: string; color: string; text: string; onCopy: () => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Icon className={`h-3.5 w-3.5 ${color}`} />
          <span className="text-xs font-semibold text-gray-800">{label}</span>
        </div>
        <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={onCopy}>
          <Copy className="h-3 w-3" /> Copiar
        </Button>
      </div>
      <p
        className="text-gray-600 whitespace-pre-line leading-relaxed"
        style={{
          fontSize: 13,
          background: "#F9FAFB",
          padding: "12px 14px",
          borderRadius: 10,
          border: "1px solid rgba(0,0,0,0.06)",
        }}
      >
        {text}
      </p>
    </div>
  );
}
