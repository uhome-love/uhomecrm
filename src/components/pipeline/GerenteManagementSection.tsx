import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Shield, UserPlus, UserMinus, HelpCircle, Zap, Users } from "lucide-react";
import type { PipelineLead } from "@/hooks/usePipeline";

const MODO_OPTIONS = [
  { value: "corretor_conduz", label: "Corretor conduz", description: "Corretor gerencia sozinho", icon: "👤" },
  { value: "corretor_gerente", label: "Corretor + Gerente", description: "Trabalham juntos", icon: "👥" },
  { value: "gerente_conduz", label: "Gerente conduz", description: "Gerente assume o lead", icon: "🎯" },
];

interface Props {
  lead: PipelineLead;
  onUpdate: (id: string, updates: Partial<PipelineLead>) => void;
}

export default function GerenteManagementSection({ lead, onUpdate }: Props) {
  const { user } = useAuth();
  const { isGestor, isAdmin, isCorretor } = useUserRole();
  const [gerentes, setGerentes] = useState<{ user_id: string; nome: string }[]>([]);
  const [gerenteNome, setGerenteNome] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      // Load available gerentes
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("role", ["gestor", "admin"]);
      if (!roles || roles.length === 0) return;
      const ids = roles.map(r => r.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, nome")
        .in("user_id", ids);
      setGerentes(profiles || []);
      if (lead.gerente_id) {
        const g = profiles?.find(p => p.user_id === lead.gerente_id);
        setGerenteNome(g?.nome || null);
      }
    })();
  }, [lead.gerente_id]);

  const handleSetGerente = async (gerenteId: string) => {
    setSaving(true);
    const { error } = await supabase
      .from("pipeline_leads")
      .update({
        gerente_id: gerenteId,
        modo_conducao: lead.modo_conducao === "corretor_conduz" ? "corretor_gerente" : lead.modo_conducao,
      } as any)
      .eq("id", lead.id);
    if (error) { toast.error("Erro ao adicionar gerente"); setSaving(false); return; }
    const g = gerentes.find(g => g.user_id === gerenteId);
    setGerenteNome(g?.nome || null);
    onUpdate(lead.id, { gerente_id: gerenteId, modo_conducao: "corretor_gerente" });
    toast.success(`Gerente ${g?.nome || ""} adicionado ao negócio`);
    setSaving(false);
  };

  const handleRemoveGerente = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("pipeline_leads")
      .update({ gerente_id: null, modo_conducao: "corretor_conduz" } as any)
      .eq("id", lead.id);
    if (error) { toast.error("Erro ao remover gerente"); setSaving(false); return; }
    setGerenteNome(null);
    onUpdate(lead.id, { gerente_id: null, modo_conducao: "corretor_conduz" });
    toast.success("Gerente removido do negócio");
    setSaving(false);
  };

  const handleRequestSupport = async () => {
    if (!user) return;
    setSaving(true);
    // Notify all managers
    const gerenteIds = gerentes.map(g => g.user_id);
    for (const gid of gerenteIds) {
      await supabase.from("notifications").insert({
        user_id: gid,
        categoria: "pipeline",
        tipo: "solicitar_apoio",
        titulo: "🆘 Corretor solicita apoio",
        mensagem: `Corretor solicitou apoio no negócio com ${lead.nome} (${lead.empreendimento || "N/A"})`,
        dados: { lead_id: lead.id, nome: lead.nome, empreendimento: lead.empreendimento },
      });
    }
    toast.success("Solicitação de apoio enviada aos gerentes!");
    setSaving(false);
  };

  const handleChangeModo = async (modo: string) => {
    const { error } = await supabase
      .from("pipeline_leads")
      .update({ modo_conducao: modo } as any)
      .eq("id", lead.id);
    if (error) { toast.error("Erro ao alterar modo"); return; }
    onUpdate(lead.id, { modo_conducao: modo });
    toast.success("Modo de condução atualizado");
  };

  const currentModo = MODO_OPTIONS.find(m => m.value === lead.modo_conducao) || MODO_OPTIONS[0];
  const showComplexityAlert = lead.complexidade_score >= 40 && !lead.gerente_id;

  return (
    <div className="rounded-lg border border-border p-3 space-y-3">
      <h4 className="text-[11px] font-bold text-foreground flex items-center gap-1.5">
        <Users className="h-3.5 w-3.5 text-primary" /> Responsabilidade do Negócio
      </h4>

      {/* Complexity alert */}
      {showComplexityAlert && (
        <div className="text-[10px] bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 rounded-md p-2 flex items-start gap-1.5">
          <Zap className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Sugestão: Adicionar gerente ao negócio</p>
            <p className="mt-0.5 opacity-80">
              Score de complexidade: {lead.complexidade_score}/100
              {(lead.valor_estimado || 0) >= 500000 ? " · Valor alto" : ""}
            </p>
          </div>
        </div>
      )}

      {/* Modo de condução */}
      <div>
        <Label className="text-[10px] text-muted-foreground">Modo de condução</Label>
        <div className="flex gap-1.5 mt-1">
          {MODO_OPTIONS.map(m => (
            <button
              key={m.value}
              onClick={() => handleChangeModo(m.value)}
              disabled={!isGestor && !isAdmin && m.value === "gerente_conduz"}
              className={`flex-1 text-center px-2 py-2 rounded-md text-[10px] font-medium border-2 transition-all ${
                lead.modo_conducao === m.value
                  ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                  : "bg-card text-muted-foreground border-gray-200 hover:border-blue-300 hover:bg-blue-50 dark:border-gray-700 dark:hover:border-blue-500/40 dark:hover:bg-blue-950/20"
              } disabled:opacity-40`}
            >
              <span className="block text-sm mb-0.5">{m.icon}</span>
              <span className="block font-semibold">{m.label}</span>
              <span className="block text-[9px] mt-0.5 opacity-70">{m.description}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Gerente info */}
      <div className="space-y-2">
        {lead.gerente_id && gerenteNome ? (
          <div className="flex items-center justify-between bg-accent/50 rounded-md px-3 py-2">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-amber-600" />
              <div>
                <p className="text-xs font-semibold text-foreground">{gerenteNome}</p>
                <p className="text-[10px] text-muted-foreground">Gerente responsável</p>
              </div>
            </div>
            {(isGestor || isAdmin) && (
              <Button variant="ghost" size="sm" className="h-6 text-[10px] text-destructive hover:text-destructive" onClick={handleRemoveGerente} disabled={saving}>
                <UserMinus className="h-3 w-3 mr-1" /> Remover
              </Button>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {(isGestor || isAdmin) ? (
              <Select onValueChange={handleSetGerente}>
                <SelectTrigger className="h-8 text-xs flex-1">
                  <SelectValue placeholder="Adicionar gerente..." />
                </SelectTrigger>
                <SelectContent>
                  {gerentes.map(g => (
                    <SelectItem key={g.user_id} value={g.user_id}>{g.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-[10px] text-muted-foreground italic">Sem gerente atribuído</p>
            )}
          </div>
        )}

        {/* Solicitar apoio button (for corretores) */}
        {isCorretor && !lead.gerente_id && (
          <Button
            variant="outline"
            size="sm"
            className="w-full h-8 text-xs gap-1.5 border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-950/30"
            onClick={handleRequestSupport}
            disabled={saving}
          >
            <HelpCircle className="h-3.5 w-3.5" />
            Solicitar apoio do gerente
          </Button>
        )}
      </div>
    </div>
  );
}
