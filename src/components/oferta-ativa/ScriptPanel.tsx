import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Copy, FileText, MessageCircle, Mail, Pencil, Check, Users } from "lucide-react";
import { useOATemplates, type OALead } from "@/hooks/useOfertaAtiva";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

interface Props {
  empreendimento: string;
  lead?: OALead | null;
  compact?: boolean;
}

function buildDefaultScript(leadName: string, emp: string) {
  return `Olá, ${leadName}! Aqui é da Uhome, tudo bem?\n\nVi que você se interessou pelo ${emp}. Tenho informações atualizadas sobre valores e condições especiais.\n\nPosso te contar em 2 minutos?`;
}

function applyVars(text: string, leadName: string, emp: string) {
  return text.replace(/\{nome\}/g, leadName).replace(/\{empreendimento\}/g, emp);
}

export default function ScriptPanel({ empreendimento, lead, compact }: Props) {
  const { templates } = useOATemplates(empreendimento);
  const { user } = useAuth();
  const [editingScript, setEditingScript] = useState<"ligacao" | "whatsapp" | "email" | null>(null);

  // Fetch team scripts assigned by manager
  const { data: teamScript } = useQuery({
    queryKey: ["team-script-for-dialing", empreendimento, user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("team_scripts")
        .select("*")
        .eq("empreendimento", empreendimento)
        .eq("ativo", true)
        .order("created_at", { ascending: false })
        .limit(1);
      return (data && data.length > 0) ? data[0] : null;
    },
    enabled: !!user && !!empreendimento,
  });

  const leadName = lead?.nome || "{nome}";
  const emp = lead?.empreendimento || empreendimento;

  const scriptTemplate = templates.find(t => t.canal === "whatsapp" && t.tipo === "primeiro_contato");
  const emailTemplate = templates.find(t => t.canal === "email" && t.tipo === "primeiro_contato");

  // Priority: team script > template > default
  const defaultLigacao = teamScript?.script_ligacao
    ? applyVars(teamScript.script_ligacao, leadName, emp)
    : buildDefaultScript(leadName, emp);
  const defaultWhatsApp = teamScript?.script_whatsapp
    ? applyVars(teamScript.script_whatsapp, leadName, emp)
    : scriptTemplate
      ? scriptTemplate.conteudo.replace("{nome}", leadName).replace("{empreendimento}", emp)
      : `Olá ${leadName}! 😊\n\nVi que você se interessou pelo *${emp}*. Tenho novidades sobre condições exclusivas!\n\nPodemos conversar rapidinho?`;
  const defaultEmail = teamScript?.script_email
    ? applyVars(teamScript.script_email, leadName, emp)
    : emailTemplate
      ? emailTemplate.conteudo.replace("{nome}", leadName).replace("{empreendimento}", emp)
      : `Olá ${leadName},\n\nGostaria de apresentar mais detalhes sobre o ${emp}.\n\nTemos condições especiais. Podemos agendar uma conversa?\n\nAbraços,\nEquipe Uhome`;

  const [scriptLigacao, setScriptLigacao] = useState(defaultLigacao);
  const [scriptWhatsApp, setScriptWhatsApp] = useState(defaultWhatsApp);
  const [scriptEmail, setScriptEmail] = useState(defaultEmail);

  // Update scripts when lead or team script changes
  useEffect(() => {
    const ln = lead?.nome || "{nome}";
    const e = lead?.empreendimento || empreendimento;

    setScriptLigacao(teamScript?.script_ligacao
      ? applyVars(teamScript.script_ligacao, ln, e)
      : buildDefaultScript(ln, e));

    const wt = templates.find(t => t.canal === "whatsapp" && t.tipo === "primeiro_contato");
    setScriptWhatsApp(teamScript?.script_whatsapp
      ? applyVars(teamScript.script_whatsapp, ln, e)
      : wt ? wt.conteudo.replace("{nome}", ln).replace("{empreendimento}", e)
        : `Olá ${ln}! 😊\n\nVi que você se interessou pelo *${e}*. Tenho novidades sobre condições exclusivas!\n\nPodemos conversar rapidinho?`);

    const et = templates.find(t => t.canal === "email" && t.tipo === "primeiro_contato");
    setScriptEmail(teamScript?.script_email
      ? applyVars(teamScript.script_email, ln, e)
      : et ? et.conteudo.replace("{nome}", ln).replace("{empreendimento}", e)
        : `Olá ${ln},\n\nGostaria de apresentar mais detalhes sobre o ${e}.\n\nTemos condições especiais. Podemos agendar uma conversa?\n\nAbraços,\nEquipe Uhome`);

    setEditingScript(null);
  }, [lead?.id, leadName, emp, templates, teamScript]);

  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
  };

  const scripts = [
    { key: "ligacao" as const, label: "Script Ligação", icon: FileText, color: "text-emerald-600", borderColor: "border-emerald-500/20", value: scriptLigacao, setValue: setScriptLigacao },
    { key: "whatsapp" as const, label: "Script WhatsApp", icon: MessageCircle, color: "text-green-600", borderColor: "border-green-500/20", value: scriptWhatsApp, setValue: setScriptWhatsApp },
    { key: "email" as const, label: "Script E-mail", icon: Mail, color: "text-blue-500", borderColor: "border-blue-500/20", value: scriptEmail, setValue: setScriptEmail },
  ];

  return (
    <div className="space-y-3 h-full overflow-y-auto">
      {teamScript && (
        <div className="flex items-center gap-1.5 px-1">
          <Badge variant="secondary" className="text-[10px] gap-1">
            <Users className="h-3 w-3" /> Script do gerente: {teamScript.titulo}
          </Badge>
        </div>
      )}
      {scripts.map((s) => (
        <Card key={s.key} className={s.borderColor}>
          <CardContent className="p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <s.icon className={`h-4 w-4 ${s.color}`} />
                <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">{s.label}</h4>
              </div>
              <div className="flex items-center gap-1">
                {editingScript === s.key ? (
                  <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-success" onClick={() => { setEditingScript(null); toast.success("Script atualizado!"); }}>
                    <Check className="h-3 w-3" /> OK
                  </Button>
                ) : (
                  <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => setEditingScript(s.key)}>
                    <Pencil className="h-3 w-3" /> Editar
                  </Button>
                )}
                <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => copyText(s.value, s.label)}>
                  <Copy className="h-3 w-3" /> Copiar
                </Button>
              </div>
            </div>
            {editingScript === s.key ? (
              <Textarea
                value={s.value}
                onChange={(e) => s.setValue(e.target.value)}
                rows={compact ? 4 : 6}
                className="text-xs leading-relaxed resize-none font-mono"
                autoFocus
              />
            ) : (
              <p className="text-xs text-muted-foreground whitespace-pre-line leading-relaxed bg-muted/50 p-2.5 rounded-lg border border-border">
                {s.value}
              </p>
            )}
          </CardContent>
        </Card>
      ))}

      {/* CTA Final */}
      <Card className="border-primary/20">
        <CardContent className="p-3">
          <h4 className="text-xs font-bold text-primary uppercase tracking-wider mb-1.5">🎯 CTA Final</h4>
          <p className="text-xs text-muted-foreground italic bg-primary/5 p-2 rounded-lg">
            "Que tal agendar uma visita sem compromisso? Posso reservar o melhor horário para você!"
          </p>
        </CardContent>
      </Card>

      <div className="text-center">
        <Badge variant="outline" className="text-[10px]">{empreendimento}</Badge>
      </div>
    </div>
  );
}
