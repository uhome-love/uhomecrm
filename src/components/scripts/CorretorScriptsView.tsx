import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Copy, FileText, MessageCircle, Mail, Users, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";

export default function CorretorScriptsView() {
  const { user } = useAuth();
  const [filterEmp, setFilterEmp] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Get team_member record to find gerente_id
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

  // Fetch team scripts from my gerente
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

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  if (!teamMember) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <Users className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
          <p className="text-sm">Você não está vinculado a nenhum time.</p>
          <p className="text-xs mt-1">Entre em contato com seu gerente.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" /> Scripts do Meu Time
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
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
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
            <p className="text-sm">Nenhum script disponível no momento.</p>
            <p className="text-xs mt-1">Seu gerente ainda não publicou scripts para o time.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((s: any) => {
            const isExpanded = expandedId === s.id;
            return (
              <Card key={s.id} className="border-primary/20">
                <CardContent className="p-0">
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : s.id)}
                    className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/10 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm text-foreground">{s.titulo}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-[10px]">{s.empreendimento}</Badge>
                        {s.campanha && <Badge variant="secondary" className="text-[10px]">{s.campanha}</Badge>}
                      </div>
                    </div>
                    {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </button>

                  {isExpanded && (
                    <div className="border-t border-border p-4 space-y-3">
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
                </CardContent>
              </Card>
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
          <span className="text-xs font-semibold text-foreground">{label}</span>
        </div>
        <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={onCopy}>
          <Copy className="h-3 w-3" /> Copiar
        </Button>
      </div>
      <p className="text-xs text-muted-foreground whitespace-pre-line bg-muted/50 p-2.5 rounded-lg border border-border leading-relaxed">
        {text}
      </p>
    </div>
  );
}
