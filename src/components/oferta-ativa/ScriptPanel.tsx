import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Copy, FileText, MessageCircle, Pencil, Check, Users, BookOpen, ChevronDown, Building2 } from "lucide-react";
import { useOATemplates, type OALead } from "@/hooks/useOfertaAtiva";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const EMPREENDIMENTOS = [
  "Alfa", "Orygem", "Las Casas", "Casa Tua", "Lake Eyre", "Open Bosque",
  "Casa Bastian", "Shift", "Seen Menino Deus", "Me Day",
  "Alto Lindóia", "Terrace", "Duetto", "Salzburg", "Melnick Day",
  "Boa Vista Country Club",
];

interface Props {
  empreendimento: string;
  lead?: OALead | null;
  compact?: boolean;
  darkMode?: boolean;
  scriptFilter?: "ligacao" | "whatsapp";
  hideCta?: boolean;
  onEmpChange?: (emp: string) => void;
}

function buildGenericScript(leadName: string) {
  return `Olá, ${leadName}! Aqui é da Uhome, tudo bem?\n\nEstou entrando em contato porque temos empreendimentos com condições especiais que podem te interessar.\n\nPosso te contar em 2 minutos?`;
}

function buildEmpScript(leadName: string, emp: string) {
  return `Olá, ${leadName}! Aqui é da Uhome, tudo bem?\n\nVi que você se interessou pelo ${emp}. Tenho informações atualizadas sobre valores e condições especiais.\n\nPosso te contar em 2 minutos?`;
}

function applyVars(text: string, leadName: string, emp: string) {
  return text.replace(/\{nome\}/g, leadName).replace(/\{empreendimento\}/g, emp);
}

export default function ScriptPanel({ empreendimento, lead, compact, darkMode, scriptFilter, hideCta, onEmpChange }: Props) {
  const { templates } = useOATemplates(empreendimento);
  const { user } = useAuth();
  const [editingScript, setEditingScript] = useState<"ligacao" | "whatsapp" | null>(null);
  const [scriptMode, setScriptMode] = useState<"generico" | "personalizado">("generico");

  const { data: teamScripts = [] } = useQuery({
    queryKey: ["team-scripts-for-dialing", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("team_scripts")
        .select("*")
        .eq("ativo", true)
        .order("created_at", { ascending: false })
        .limit(20);
      return data || [];
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  const teamScript = teamScripts.find(s => s.empreendimento === empreendimento) || null;

  const { data: marketplaceScripts = [] } = useQuery({
    queryKey: ["marketplace-scripts-for-selector"],
    queryFn: async () => {
      const { data } = await supabase
        .from("marketplace_items")
        .select("id, titulo, conteudo, categoria")
        .eq("status", "aprovado")
        .in("categoria", ["script_ligacao", "whatsapp"])
        .order("total_usos", { ascending: false })
        .limit(20);
      return data || [];
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  const leadName = lead?.nome || "{nome}";
  const emp = empreendimento;

  const scriptTemplate = templates.find(t => t.canal === "whatsapp" && t.tipo === "primeiro_contato");

  const getDefaultLigacao = (mode: "generico" | "personalizado") => {
    if (teamScript?.script_ligacao) return applyVars(teamScript.script_ligacao, leadName, emp);
    return mode === "personalizado" ? buildEmpScript(leadName, emp) : buildGenericScript(leadName);
  };

  const getDefaultWhatsApp = () => {
    if (teamScript?.script_whatsapp) return applyVars(teamScript.script_whatsapp, leadName, emp);
    if (scriptTemplate) return scriptTemplate.conteudo.replace("{nome}", leadName).replace("{empreendimento}", emp);
    return `Olá ${leadName}! 😊\n\nTemos empreendimentos com condições exclusivas que podem te interessar!\n\nPodemos conversar rapidinho?`;
  };

  const [scriptLigacao, setScriptLigacao] = useState(getDefaultLigacao("generico"));
  const [scriptWhatsApp, setScriptWhatsApp] = useState(getDefaultWhatsApp());
  const [activeScriptName, setActiveScriptName] = useState<Record<string, string>>({
    ligacao: teamScript ? teamScript.titulo : "Script genérico",
    whatsapp: teamScript ? teamScript.titulo : "Script genérico",
  });

  useEffect(() => {
    setScriptLigacao(getDefaultLigacao(scriptMode));
    setScriptWhatsApp(getDefaultWhatsApp());
    setEditingScript(null);
    setActiveScriptName({
      ligacao: teamScript ? teamScript.titulo : scriptMode === "personalizado" ? `Script · ${emp}` : "Script genérico",
      whatsapp: teamScript ? teamScript.titulo : "Script genérico",
    });
  }, [lead?.id, leadName, emp, templates, teamScript, scriptMode]);

  const handleModeSwitch = (mode: "generico" | "personalizado") => {
    setScriptMode(mode);
  };

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

  const allScripts = [
    { key: "ligacao" as const, label: "Script Ligação", icon: FileText, iconColor: "text-emerald-500", value: scriptLigacao, setValue: setScriptLigacao, category: "script_ligacao", switchLabel: "Trocar script" },
    { key: "whatsapp" as const, label: "Script WhatsApp", icon: MessageCircle, iconColor: "text-green-500", value: scriptWhatsApp, setValue: setScriptWhatsApp, category: "whatsapp", switchLabel: "Trocar mensagem" },
  ];
  const scripts = scriptFilter ? allScripts.filter(s => s.key === scriptFilter) : allScripts;

  return (
    <div className="space-y-3">
      {/* Empreendimento selector + mode toggle */}
      {onEmpChange && (
        <div className="px-3 pt-3 space-y-2">
          <div className="flex items-center gap-2">
            <Building2 className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--arena-text-muted)" }} />
            <select
              value={emp}
              onChange={e => onEmpChange(e.target.value)}
              className="flex-1 text-sm rounded-md px-2 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
              style={{
                background: "var(--arena-bg-from)",
                border: "1px solid var(--arena-card-border)",
                color: "var(--arena-text)",
                height: 30,
              }}
            >
              <option value="" disabled>Selecionar empreendimento...</option>
              {EMPREENDIMENTOS.map(e => (
                <option key={e} value={e}>{e}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => handleModeSwitch("generico")}
              className="flex-1 text-[10px] font-semibold rounded-md py-1 transition-all"
              style={{
                background: scriptMode === "generico" ? "rgba(6,182,212,0.15)" : "transparent",
                border: scriptMode === "generico" ? "1px solid rgba(6,182,212,0.3)" : "1px solid var(--arena-card-border)",
                color: scriptMode === "generico" ? "#22D3EE" : "var(--arena-text-muted)",
              }}
            >
              📋 Genérico
            </button>
            <button
              onClick={() => handleModeSwitch("personalizado")}
              className="flex-1 text-[10px] font-semibold rounded-md py-1 transition-all"
              style={{
                background: scriptMode === "personalizado" ? "rgba(34,197,94,0.15)" : "transparent",
                border: scriptMode === "personalizado" ? "1px solid rgba(34,197,94,0.3)" : "1px solid var(--arena-card-border)",
                color: scriptMode === "personalizado" ? "#86EFAC" : "var(--arena-text-muted)",
              }}
            >
              🏠 {emp}
            </button>
          </div>
        </div>
      )}

      {teamScript && (
        <div className="flex items-center gap-1.5 px-1">
          <span className="text-[10px] px-2 py-0.5 rounded bg-muted text-muted-foreground">
            <Users className="h-3 w-3 inline mr-1" /> Script do gerente: {teamScript.titulo}
          </span>
        </div>
      )}
      {scripts.map((s) => {
        const filteredMarketplace = marketplaceScripts.filter(m => m.categoria === s.category);
        return (
          <div key={s.key} className="rounded-xl p-3 space-y-2" style={{ background: "var(--arena-card-bg)", border: "1px solid var(--arena-card-border)" }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <s.icon className={`h-4 w-4 ${s.iconColor}`} />
                <h4 style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", whiteSpace: "nowrap", color: "var(--arena-text)" }} className="uppercase">{s.label}</h4>
              </div>
              <div className="flex items-center gap-1">
                {editingScript === s.key ? (
                  <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-emerald-400" onClick={() => { setEditingScript(null); toast.success("Script atualizado!"); }}>
                    <Check className="h-3 w-3" /> OK
                  </Button>
                ) : (
                  <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground" onClick={() => setEditingScript(s.key)}>
                    <Pencil className="h-3 w-3" /> Editar
                  </Button>
                )}
                <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground" onClick={() => copyText(s.value, s.label)}>
                  <Copy className="h-3 w-3" /> Copiar
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground">
                      <BookOpen className="h-3 w-3" /> {s.switchLabel} <ChevronDown className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-72 max-h-80 overflow-y-auto">
                    <DropdownMenuItem className="text-xs gap-2" onClick={() => {
                      if (s.key === "ligacao") setScriptLigacao(getDefaultLigacao(scriptMode));
                      else setScriptWhatsApp(getDefaultWhatsApp());
                      setActiveScriptName(prev => ({ ...prev, [s.key]: "Script padrão" }));
                    }}>
                      <Check className={`h-3 w-3 ${activeScriptName[s.key] === "Script padrão" ? "opacity-100" : "opacity-0"}`} />
                      Script padrão
                    </DropdownMenuItem>

                    {teamScripts.length > 0 && <DropdownMenuSeparator />}
                    {teamScripts.length > 0 && (
                      <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">👥 Scripts do Time</p>
                    )}
                    {teamScripts.map(ts => (
                      <DropdownMenuItem key={ts.id} className="text-xs gap-2" onClick={() => {
                        const content = applyVars(s.key === "ligacao" ? (ts.script_ligacao || "") : (ts.script_whatsapp || ""), leadName, emp);
                        if (content) {
                          if (s.key === "ligacao") setScriptLigacao(content);
                          else setScriptWhatsApp(content);
                          setActiveScriptName(prev => ({ ...prev, [s.key]: ts.titulo }));
                          toast.success(`Script "${ts.titulo}" aplicado!`);
                        } else {
                          toast.error(`Script "${ts.titulo}" não tem conteúdo para ${s.label}`);
                        }
                      }}>
                        <Check className={`h-3 w-3 ${activeScriptName[s.key] === ts.titulo ? "opacity-100" : "opacity-0"}`} />
                        <span className="truncate">{ts.titulo}</span>
                        <span className="text-[10px] text-muted-foreground ml-auto">{ts.empreendimento}</span>
                      </DropdownMenuItem>
                    ))}

                    {filteredMarketplace.length > 0 && <DropdownMenuSeparator />}
                    {filteredMarketplace.length > 0 && (
                      <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">📚 Marketplace</p>
                    )}
                    {filteredMarketplace.map(item => (
                      <DropdownMenuItem key={item.id} className="text-xs gap-2" onClick={() => handleSelectScript(s.key, item)}>
                        <Check className={`h-3 w-3 ${activeScriptName[s.key] === item.titulo ? "opacity-100" : "opacity-0"}`} />
                        <span className="truncate">{item.titulo}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            {editingScript === s.key ? (
              <Textarea
                value={s.value}
                onChange={(e) => s.setValue(e.target.value)}
                rows={compact ? 4 : 6}
                className="text-xs leading-relaxed resize-none font-mono bg-muted/50 border-border"
                autoFocus
              />
            ) : (
              <p
                className="whitespace-pre-line p-2.5 rounded-lg"
                style={{ background: "var(--arena-subtle-bg)", border: "1px solid var(--arena-card-border)", fontSize: "15px", lineHeight: 1.7, color: "var(--arena-text)" }}
              >
                {s.value}
              </p>
            )}
          </div>
        );
      })}

      {!hideCta && (!scriptFilter || scriptFilter === "ligacao") && (
        <div className="rounded-xl p-3" style={{ background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.15)" }}>
          <h4 style={{ fontSize: "13px", fontWeight: 700, letterSpacing: "0.12em" }} className="uppercase mb-1.5 text-blue-600 dark:text-blue-400">🎯 CTA Final</h4>
          <p style={{ fontSize: "15px", fontStyle: "italic", color: "var(--arena-text)" }} className="p-2 rounded-lg font-medium">
            "Que tal agendar uma visita sem compromisso? Posso reservar o melhor horário para você!"
          </p>
        </div>
      )}
    </div>
  );
}
