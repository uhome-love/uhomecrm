import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Copy, FileText, MessageCircle, Pencil, Check, Users, BookOpen, ChevronDown } from "lucide-react";
import { useOATemplates, type OALead } from "@/hooks/useOfertaAtiva";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useNavigate } from "react-router-dom";

interface Props {
  empreendimento: string;
  lead?: OALead | null;
  compact?: boolean;
  darkMode?: boolean;
}

function buildDefaultScript(leadName: string, emp: string) {
  return `Olá, ${leadName}! Aqui é da Uhome, tudo bem?\n\nVi que você se interessou pelo ${emp}. Tenho informações atualizadas sobre valores e condições especiais.\n\nPosso te contar em 2 minutos?`;
}

function applyVars(text: string, leadName: string, emp: string) {
  return text.replace(/\{nome\}/g, leadName).replace(/\{empreendimento\}/g, emp);
}

export default function ScriptPanel({ empreendimento, lead, compact, darkMode }: Props) {
  const { templates } = useOATemplates(empreendimento);
  const { user } = useAuth();
  const navigate = useNavigate();
  const [editingScript, setEditingScript] = useState<"ligacao" | "whatsapp" | null>(null);

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

  // Fetch marketplace scripts for selector
  const { data: marketplaceScripts = [] } = useQuery({
    queryKey: ["marketplace-scripts-for-selector"],
    queryFn: async () => {
      const { data } = await supabase
        .from("marketplace_items")
        .select("id, titulo, conteudo, categoria")
        .eq("status", "aprovado")
        .in("categoria", ["script_ligacao", "whatsapp"])
        .order("total_usos", { ascending: false })
        .limit(10);
      return data || [];
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  const leadName = lead?.nome || "{nome}";
  const emp = lead?.empreendimento || empreendimento;

  const scriptTemplate = templates.find(t => t.canal === "whatsapp" && t.tipo === "primeiro_contato");

  const defaultLigacao = teamScript?.script_ligacao
    ? applyVars(teamScript.script_ligacao, leadName, emp)
    : buildDefaultScript(leadName, emp);
  const defaultWhatsApp = teamScript?.script_whatsapp
    ? applyVars(teamScript.script_whatsapp, leadName, emp)
    : scriptTemplate
      ? scriptTemplate.conteudo.replace("{nome}", leadName).replace("{empreendimento}", emp)
      : `Olá ${leadName}! 😊\n\nVi que você se interessou pelo *${emp}*. Tenho novidades sobre condições exclusivas!\n\nPodemos conversar rapidinho?`;

  const [scriptLigacao, setScriptLigacao] = useState(defaultLigacao);
  const [scriptWhatsApp, setScriptWhatsApp] = useState(defaultWhatsApp);
  const [activeScriptName, setActiveScriptName] = useState<Record<string, string>>({
    ligacao: teamScript ? teamScript.titulo : "Script padrão",
    whatsapp: teamScript ? teamScript.titulo : "Script padrão",
  });

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

    setEditingScript(null);
    setActiveScriptName({
      ligacao: teamScript ? teamScript.titulo : "Script padrão",
      whatsapp: teamScript ? teamScript.titulo : "Script padrão",
    });
  }, [lead?.id, leadName, emp, templates, teamScript]);

  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
  };

  const handleSelectScript = (key: "ligacao" | "whatsapp", item: any) => {
    const content = applyVars(item.conteudo, leadName, emp);
    if (key === "ligacao") setScriptLigacao(content);
    else setScriptWhatsApp(content);
    setActiveScriptName(prev => ({ ...prev, [key]: item.titulo }));
    toast.success(`Script "${item.titulo}" aplicado!`);
  };

  const cardBg = darkMode ? "#161B22" : undefined;
  const cardBorder = darkMode ? "1px solid rgba(255,255,255,0.08)" : undefined;
  const textColor = darkMode ? "text-white" : "text-foreground";
  const mutedColor = darkMode ? "text-neutral-400" : "text-muted-foreground";
  const scriptBg = darkMode ? "rgba(255,255,255,0.04)" : undefined;

  const scripts = [
    { key: "ligacao" as const, label: "Script Ligação", icon: FileText, iconColor: darkMode ? "text-emerald-400" : "text-emerald-600", value: scriptLigacao, setValue: setScriptLigacao, category: "script_ligacao", switchLabel: "Trocar script" },
    { key: "whatsapp" as const, label: "Script WhatsApp", icon: MessageCircle, iconColor: darkMode ? "text-green-400" : "text-green-600", value: scriptWhatsApp, setValue: setScriptWhatsApp, category: "whatsapp", switchLabel: "Trocar mensagem" },
  ];

  return (
    <div className="space-y-3">
      {teamScript && (
        <div className="flex items-center gap-1.5 px-1">
          <span className={`text-[10px] px-2 py-0.5 rounded ${darkMode ? "bg-white/5 text-neutral-400" : "bg-muted text-muted-foreground"}`}>
            <Users className="h-3 w-3 inline mr-1" /> Script do gerente: {teamScript.titulo}
          </span>
        </div>
      )}
      {scripts.map((s) => {
        const filteredMarketplace = marketplaceScripts.filter(m => m.categoria === s.category);
        return (
          <div key={s.key} className="rounded-xl p-3 space-y-2" style={{ background: cardBg, border: cardBorder }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <s.icon className={`h-4 w-4 ${s.iconColor}`} />
                <h4 className={`text-xs font-bold uppercase tracking-wider ${textColor}`}>{s.label}</h4>
              </div>
              <div className="flex items-center gap-1">
                {editingScript === s.key ? (
                  <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-emerald-400" onClick={() => { setEditingScript(null); toast.success("Script atualizado!"); }}>
                    <Check className="h-3 w-3" /> OK
                  </Button>
                ) : (
                  <Button size="sm" variant="ghost" className={`h-7 text-xs gap-1 ${mutedColor} hover:${textColor}`} onClick={() => setEditingScript(s.key)}>
                    <Pencil className="h-3 w-3" /> Editar
                  </Button>
                )}
                <Button size="sm" variant="ghost" className={`h-7 text-xs gap-1 ${mutedColor} hover:${textColor}`} onClick={() => copyText(s.value, s.label)}>
                  <Copy className="h-3 w-3" /> Copiar
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="ghost" className={`h-7 text-xs gap-1 ${mutedColor} hover:${textColor}`}>
                      <BookOpen className="h-3 w-3" /> {s.switchLabel} <ChevronDown className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64">
                    <DropdownMenuItem className="text-xs gap-2" onClick={() => {
                      if (s.key === "ligacao") setScriptLigacao(defaultLigacao);
                      else setScriptWhatsApp(defaultWhatsApp);
                      setActiveScriptName(prev => ({ ...prev, [s.key]: "Script padrão" }));
                    }}>
                      <Check className={`h-3 w-3 ${activeScriptName[s.key] === "Script padrão" ? "opacity-100" : "opacity-0"}`} />
                      Script padrão (atual)
                    </DropdownMenuItem>
                    {filteredMarketplace.map(item => (
                      <DropdownMenuItem key={item.id} className="text-xs gap-2" onClick={() => handleSelectScript(s.key, item)}>
                        <Check className={`h-3 w-3 ${activeScriptName[s.key] === item.titulo ? "opacity-100" : "opacity-0"}`} />
                        {item.titulo}
                      </DropdownMenuItem>
                    ))}
                    {filteredMarketplace.length > 0 && <DropdownMenuSeparator />}
                    <DropdownMenuItem className="text-xs gap-2" onClick={() => navigate("/marketplace")}>
                      📚 Ver marketplace completo →
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            {editingScript === s.key ? (
              <Textarea
                value={s.value}
                onChange={(e) => s.setValue(e.target.value)}
                rows={compact ? 4 : 6}
                className={`text-xs leading-relaxed resize-none font-mono ${darkMode ? "bg-black/30 border-white/10 text-neutral-200" : ""}`}
                autoFocus
              />
            ) : (
              <p
                className={`text-xs whitespace-pre-line leading-relaxed p-2.5 rounded-lg ${mutedColor}`}
                style={darkMode ? { background: scriptBg, border: "1px solid rgba(255,255,255,0.06)" } : { background: "hsl(var(--muted) / 0.5)" }}
              >
                {s.value}
              </p>
            )}
          </div>
        );
      })}

      {/* CTA Final */}
      <div className="rounded-xl p-3" style={{ background: darkMode ? "rgba(59,130,246,0.06)" : undefined, border: darkMode ? "1px solid rgba(59,130,246,0.15)" : undefined }}>
        <h4 className={`text-xs font-bold uppercase tracking-wider mb-1.5 ${darkMode ? "text-blue-400" : "text-primary"}`}>🎯 CTA Final</h4>
        <p className={`text-xs italic p-2 rounded-lg ${darkMode ? "text-neutral-400" : "text-muted-foreground"}`} style={darkMode ? { background: "rgba(59,130,246,0.04)" } : { background: "hsl(var(--primary) / 0.05)" }}>
          "Que tal agendar uma visita sem compromisso? Posso reservar o melhor horário para você!"
        </p>
      </div>
    </div>
  );
}
