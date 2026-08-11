import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import AgendaEntrevistas from "@/components/rh/AgendaEntrevistas";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Phone, Mail, Users, Plus, CalendarDays, Megaphone, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/PageHeader";


/**
 * RecrutamentoKanban — kanban compartilhado entre a tela da RH (todos os
 * candidatos + criação + atribuição de gerente) e a tela do gerente
 * ("Meus Candidatos", só os candidatos com gerente_id = usuário logado).
 */

export const ETAPAS = [
  { key: "novo_lead", label: "Novo Lead", color: "#4969FF" },
  
  { key: "interessado", label: "Interessado", color: "#F59E0B" },
  { key: "entrevista_marcada", label: "Entrevista Marcada", color: "#F97316" },
  { key: "entrevista_realizada", label: "Entrevista Realizada", color: "#10B981" },
  { key: "contratado", label: "Contratado", color: "#22C55E" },
  { key: "sem_interesse", label: "Não Tem Interesse", color: "#EF4444" },
];

type Temperatura = "quente" | "morno" | "frio";

const TEMP_META: Record<Temperatura, { label: string; color: string; soft: string }> = {
  quente: { label: "QUENTE", color: "#E0533A", soft: "rgba(224, 83, 58, 0.12)" },
  morno: { label: "MORNO", color: "#E0982A", soft: "rgba(224, 152, 42, 0.12)" },
  frio: { label: "FRIO", color: "#7C8AA3", soft: "rgba(124, 138, 163, 0.14)" },
};

const TEMP_ORDER: Record<string, number> = { quente: 0, morno: 1, frio: 2 };

function normTemp(v?: string | null): Temperatura | null {
  const s = (v || "").toLowerCase();
  return s === "quente" || s === "morno" || s === "frio" ? (s as Temperatura) : null;
}

interface QuizRespostas {
  nome?: string;
  telefone?: string;
  vendas?: string;
  imobiliario?: string;
  disponibilidade?: string;
  regiao?: string;
  motivacao?: string;
  [k: string]: unknown;
}

export interface Candidato {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  origem: string | null;
  observacoes: string | null;
  etapa: string;
  created_at: string;
  temperatura?: string | null;
  respostas?: QuizRespostas | null;
  gerente_id?: string | null;
}

interface Gerente {
  user_id: string;
  nome: string;
  avatar_url: string | null;
}

function shorten(v: unknown, max = 22): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function miniTags(r?: QuizRespostas | null): string[] {
  if (!r) return [];
  return [shorten(r.vendas), shorten(r.imobiliario), shorten(r.disponibilidade)]
    .filter((x): x is string => !!x)
    .slice(0, 3);
}

function formatEntrevista(iso?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const f = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => f.find((p) => p.type === t)?.value ?? "";
  return `${get("day")}/${get("month")} às ${get("hour")}:${get("minute")}`;
}

function iniciais(nome?: string | null): string {
  const parts = (nome || "?").trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "?";
}

function TemperaturaBadge({ t }: { t: Temperatura }) {
  const m = TEMP_META[t];
  return (
    <span
      className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-bold tracking-wider"
      style={{ background: m.soft, color: m.color }}
    >
      {m.label}
    </span>
  );
}

function GerenteChip({ g, size = "sm" }: { g: Gerente; size?: "sm" | "md" }) {
  const px = size === "sm" ? "h-4 w-4" : "h-6 w-6";
  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
      <Avatar className={px}>
        {g.avatar_url && <AvatarImage src={g.avatar_url} alt={g.nome} />}
        <AvatarFallback className="text-[8px]">{iniciais(g.nome)}</AvatarFallback>
      </Avatar>
      {g.nome}
    </span>
  );
}

interface Props {
  /** 'rh' = todos os candidatos, cria e atribui gerente. 'gerente' = só os meus. */
  scope: "rh" | "gerente";
  title?: string;
  subtitle?: string;
}

export default function RecrutamentoKanban({ scope, title, subtitle }: Props) {
  const { user } = useAuth();
  const { isAdmin, isRh: hasRhRole, isDiretor: hasDiretorRole } = useUserRole();
  // Diretoria: acompanha em modo leitura (sem criar, atribuir ou mover)
  const readOnly = scope === "rh" && hasDiretorRole && !hasRhRole && !isAdmin;
  const isRh = scope === "rh" && !readOnly;
  const [tab, setTab] = useState<"kanban" | "agenda">("kanban");

  const [candidatos, setCandidatos] = useState<Candidato[]>([]);
  const [entrevistas, setEntrevistas] = useState<Record<string, string>>({});
  const [gerentes, setGerentes] = useState<Gerente[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailCandidate, setDetailCandidate] = useState<Candidato | null>(null);

  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [origem, setOrigem] = useState("whatsapp");
  const [observacoes, setObservacoes] = useState("");

  const gerenteById = useMemo(() => {
    const m: Record<string, Gerente> = {};
    for (const g of gerentes) m[g.user_id] = g;
    return m;
  }, [gerentes]);

  const fetchCandidatos = async () => {
    let q = supabase.from("rh_candidatos" as any).select("*").order("created_at", { ascending: false });
    if (scope !== "rh" && user?.id) q = q.eq("gerente_id", user.id);
    const { data, error } = await q;
    if (!error) setCandidatos((data || []) as unknown as Candidato[]);
  };

  const fetchEntrevistas = async () => {
    const { data, error } = await supabase
      .from("rh_entrevistas" as any)
      .select("candidato_id, data_entrevista, status")
      .eq("status", "agendada")
      .order("data_entrevista", { ascending: true });
    if (error) return;
    const map: Record<string, string> = {};
    for (const e of (data || []) as unknown as { candidato_id: string; data_entrevista: string }[]) {
      if (e.candidato_id && !map[e.candidato_id]) map[e.candidato_id] = e.data_entrevista;
    }
    setEntrevistas(map);
  };

  const fetchGerentes = async () => {
    // Fonte = papel real (user_roles): gestor e NÃO diretor
    const { data, error } = await supabase.rpc("get_gerentes_recrutamento" as any);
    if (error) return;
    const list = ((data || []) as any[])
      .filter((p) => p.user_id)
      .map((p) => ({ user_id: p.user_id as string, nome: (p.nome as string) || "Gerente", avatar_url: p.avatar_url ?? null }))
      .sort((a, b) => a.nome.localeCompare(b.nome));
    setGerentes(list);
  };


  useEffect(() => {
    fetchCandidatos();
    fetchEntrevistas();
    if (isRh) fetchGerentes();
    else fetchGerentes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, user?.id]);

  const handleAdd = async () => {
    if (!nome.trim()) { toast.error("Nome é obrigatório"); return; }
    const { error } = await supabase.from("rh_candidatos" as any).insert({
      nome: nome.trim(),
      telefone: telefone.trim() || null,
      email: email.trim() || null,
      origem,
      observacoes: observacoes.trim() || null,
      etapa: "novo_lead",
      created_by: user?.id,
    });
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success("Candidato adicionado!");
    setDialogOpen(false);
    setNome(""); setTelefone(""); setEmail(""); setOrigem("whatsapp"); setObservacoes("");
    fetchCandidatos();
  };

  const moveToEtapa = async (id: string, etapa: string) => {
    const { error } = await supabase.from("rh_candidatos" as any).update({ etapa, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) { toast.error("Erro ao mover"); return; }
    fetchCandidatos();
  };

  const atribuirGerente = async (id: string, gerenteId: string | null) => {
    const { error } = await supabase
      .from("rh_candidatos" as any)
      .update({ gerente_id: gerenteId, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) { toast.error("Erro ao atribuir gerente"); return; }
    toast.success(gerenteId ? "Gerente atribuído!" : "Atribuição removida");
    setDetailCandidate((c) => (c && c.id === id ? { ...c, gerente_id: gerenteId } : c));
    fetchCandidatos();

    // Notificação in-app para o gerente (silenciosa: nunca quebra a atribuição)
    if (gerenteId) {
      const nomeCand = candidatos.find((c) => c.id === id)?.nome || "Candidato";
      try {
        await supabase.rpc("criar_notificacao" as any, {
          p_user_id: gerenteId,
          p_tipo: "info",
          p_categoria: "recrutamento_atribuicao",
          p_titulo: "Novo candidato atribuído a você",
          p_mensagem: `${nomeCand} foi atribuído a você no funil de recrutamento.`,
          p_dados: { candidato_id: id, url: "/gerente/candidatos" },
          p_agrupamento_key: `recrutamento_atribuicao:${id}:${gerenteId}`,
        });
      } catch (e) {
        console.error("[recrutamento] falha ao notificar gerente", e);
      }
    }
  };

  const getCandidatosByEtapa = (etapa: string) =>
    candidatos
      .filter((c) => c.etapa === etapa)
      .sort((a, b) => {
        const ta = TEMP_ORDER[normTemp(a.temperatura) ?? ""] ?? 99;
        const tb = TEMP_ORDER[normTemp(b.temperatura) ?? ""] ?? 99;
        return ta - tb;
      });

  const detailTemp = normTemp(detailCandidate?.temperatura);
  const detailEntrevista = detailCandidate ? formatEntrevista(entrevistas[detailCandidate.id]) : null;
  const detailRespostas = detailCandidate?.respostas || null;
  const detailGerente = detailCandidate?.gerente_id ? gerenteById[detailCandidate.gerente_id] : null;

  return (
    <div className="bg-[#f0f0f5] dark:bg-[#0e1525] p-6 -m-6 h-full min-h-full flex flex-col gap-4 overflow-hidden">
      <PageHeader
        title={title ?? "Candidatos"}
        subtitle={subtitle ?? "Pipeline de recrutamento"}
        icon={<Users size={18} strokeWidth={1.5} />}
        actions={
          isRh ? (
            <Button onClick={() => setDialogOpen(true)} size="sm" className="bg-primary hover:bg-primary text-white gap-1 rounded-full shadow-sm">
              <Plus size={14} /> Novo Candidato
            </Button>
          ) : undefined
        }
      />

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as "kanban" | "agenda")}
        className="flex-1 min-h-0 flex flex-col"
      >
        <TabsList className="h-9 rounded-full bg-background/80 border border-border/60 p-1 shadow-sm self-start">
          <TabsTrigger
            value="kanban"
            className="rounded-full px-4 text-xs font-semibold data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-sm"
          >
            Kanban
          </TabsTrigger>
          <TabsTrigger
            value="agenda"
            className="rounded-full px-4 text-xs font-semibold data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-sm"
          >
            Agenda
          </TabsTrigger>
        </TabsList>

        <TabsContent value="agenda" className="mt-4 flex-1 min-h-0 overflow-y-auto scrollbar-thin">
          <AgendaEntrevistas
            candidatos={candidatos.map((c) => ({ id: c.id, nome: c.nome, etapa: c.etapa }))}
            onKanbanUpdate={() => { fetchCandidatos(); fetchEntrevistas(); }}
            readOnly={readOnly}
          />
        </TabsContent>

        <TabsContent value="kanban" className="mt-4 flex-1 min-h-0 data-[state=active]:flex flex-col">
          {/* Kanban — ocupa toda a altura; a rolagem horizontal fica no rodapé */}
          <div className="flex-1 min-h-0 flex gap-3 overflow-x-auto overflow-y-hidden scrollbar-thin pb-1">
            {ETAPAS.map((etapa) => {
              const items = getCandidatosByEtapa(etapa.key);
              return (
                <div
                  key={etapa.key}
                  className="min-w-[248px] max-w-[248px] flex-shrink-0 flex flex-col rounded-2xl border border-border/60 bg-background/70 dark:bg-white/[0.03] shadow-sm"
                >
                  <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border/50">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: etapa.color }} />
                    <span className="text-[11px] font-bold text-foreground uppercase tracking-wider truncate">{etapa.label}</span>
                    <span
                      className="ml-auto inline-flex items-center justify-center min-w-[22px] h-5 px-1.5 rounded-full text-[10px] font-bold"
                      style={{ background: `${etapa.color}1A`, color: etapa.color }}
                    >
                      {items.length}
                    </span>
                  </div>

                  <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin p-2.5 space-y-2.5">
                    {items.map((c) => {
                      const temp = normTemp(c.temperatura);
                      const tags = miniTags(c.respostas);
                      const entrevista = etapa.key === "entrevista_marcada" ? formatEntrevista(entrevistas[c.id]) : null;
                      const ger = c.gerente_id ? gerenteById[c.gerente_id] : null;
                      return (
                        <Card
                          key={c.id}
                          className="group cursor-pointer rounded-xl border-border/60 shadow-[0_1px_2px_rgba(16,24,40,0.05)] hover:shadow-[0_6px_18px_-6px_rgba(16,24,40,0.22)] hover:border-primary/35 transition-all bg-card overflow-hidden relative"
                          onClick={() => setDetailCandidate(c)}
                        >
                          {temp && (
                            <span
                              className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full"
                              style={{ background: TEMP_META[temp].color }}
                            />
                          )}
                          <CardContent className="p-3 pl-3.5 space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-[13px] font-semibold leading-snug text-foreground truncate">{c.nome}</p>
                              {temp && <TemperaturaBadge t={temp} />}
                            </div>

                            {(c.telefone || c.email) && (
                              <div className="space-y-1">
                                {c.telefone && (
                                  <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 truncate">
                                    <Phone className="h-3 w-3 shrink-0 opacity-70" /> {c.telefone}
                                  </p>
                                )}
                                {c.email && (
                                  <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 truncate">
                                    <Mail className="h-3 w-3 shrink-0 opacity-70" />
                                    <span className="truncate">{c.email}</span>
                                  </p>
                                )}
                              </div>
                            )}

                            {entrevista && (
                              <p className="inline-flex items-center gap-1.5 rounded-lg bg-primary/8 text-primary px-2 py-1 text-[11px] font-semibold">
                                <CalendarDays className="h-3 w-3" /> {entrevista}
                              </p>
                            )}

                            {tags.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {tags.map((t, i) => (
                                  <span
                                    key={i}
                                    className="rounded-md border border-border/60 bg-muted/50 px-1.5 py-0.5 text-[10px] leading-4 text-muted-foreground"
                                  >
                                    {t}
                                  </span>
                                ))}
                              </div>
                            )}

                            {(ger || c.origem) && (
                              <div className="flex items-center gap-2 flex-wrap pt-1.5 border-t border-border/50">
                                {ger && <GerenteChip g={ger} />}
                                {c.origem === "anuncio" ? (
                                  <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-medium">
                                    <Megaphone className="h-3 w-3" /> veio do anúncio
                                  </span>
                                ) : (
                                  c.origem && (
                                    <span className="ml-auto text-[10px] uppercase tracking-wide text-muted-foreground">
                                      {c.origem}
                                    </span>
                                  )
                                )}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}

                    {items.length === 0 && (
                      <div className="flex flex-col items-center justify-center text-center rounded-xl border border-dashed border-border/70 px-3 py-6 gap-1.5">
                        <Users size={18} strokeWidth={1.5} className="text-muted-foreground/60" />
                        <p className="text-[11px] font-medium text-muted-foreground">Nenhum candidato</p>
                        {isRh && (
                          <button
                            type="button"
                            onClick={() => setDialogOpen(true)}
                            className="text-[11px] font-semibold text-primary hover:underline"
                          >
                            Novo candidato
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>




      {/* Add Dialog (só RH) */}
      {isRh && (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>Novo Candidato</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label className="text-xs">Nome *</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} className="h-9" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Telefone</Label><Input value={telefone} onChange={(e) => setTelefone(e.target.value)} className="h-9" /></div>
                <div><Label className="text-xs">E-mail</Label><Input value={email} onChange={(e) => setEmail(e.target.value)} className="h-9" /></div>
              </div>
              <div>
                <Label className="text-xs">Origem</Label>
                <Select value={origem} onValueChange={setOrigem}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="indicacao">Indicação</SelectItem>
                    <SelectItem value="linkedin">LinkedIn</SelectItem>
                    <SelectItem value="site">Site</SelectItem>
                    <SelectItem value="outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Observações</Label><Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} className="h-16" /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button size="sm" onClick={handleAdd}>Adicionar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!detailCandidate} onOpenChange={() => setDetailCandidate(null)}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto scrollbar-thin p-0 gap-0 rounded-2xl">
          <DialogHeader className="px-6 pt-6 pb-5 border-b border-border/60 bg-muted/20 rounded-t-2xl">
            <DialogTitle asChild>
              <div className="flex items-center gap-3.5 text-left">
                <span
                  className="h-11 w-11 shrink-0 rounded-full flex items-center justify-center text-sm font-bold"
                  style={
                    detailTemp
                      ? { background: TEMP_META[detailTemp].soft, color: TEMP_META[detailTemp].color }
                      : { background: "hsl(var(--primary) / 0.12)", color: "hsl(var(--primary))" }
                  }
                >
                  {iniciais(detailCandidate?.nome)}
                </span>
                <div className="min-w-0 space-y-1">
                  <p className="text-lg font-semibold leading-tight text-foreground truncate">{detailCandidate?.nome}</p>
                  <div className="flex items-center gap-2">
                    {detailTemp && <TemperaturaBadge t={detailTemp} />}
                    {detailCandidate?.origem && (
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{detailCandidate.origem}</span>
                    )}
                  </div>
                </div>
              </div>
            </DialogTitle>
          </DialogHeader>
          {detailCandidate && (
            <div className="px-6 py-6 space-y-6">
              {/* Contato */}
              {(detailCandidate.telefone || detailCandidate.email) && (
                <section className="space-y-2">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Contato</p>
                  <div className="rounded-xl border border-border/60 bg-muted/25 divide-y divide-border/50">
                    {detailCandidate.telefone && (
                      <div className="flex items-center gap-3 px-4 py-3">
                        <Phone className="h-4 w-4 text-primary shrink-0" />
                        <span className="text-sm text-foreground">{detailCandidate.telefone}</span>
                      </div>
                    )}
                    {detailCandidate.email && (
                      <div className="flex items-center gap-3 px-4 py-3">
                        <Mail className="h-4 w-4 text-primary shrink-0" />
                        <span className="text-sm text-foreground break-all">{detailCandidate.email}</span>
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* Entrevista + origem */}
              {(detailEntrevista || detailCandidate.origem) && (
                <section className="rounded-xl border border-primary/25 bg-primary/[0.06] px-4 py-4 space-y-3">
                  {detailEntrevista && (
                    <div className="flex items-center gap-3">
                      <span className="h-9 w-9 rounded-full bg-primary/12 flex items-center justify-center shrink-0">
                        <CalendarDays className="h-4 w-4 text-primary" />
                      </span>
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Entrevista</p>
                        <p className="text-sm font-semibold text-foreground">{detailEntrevista}</p>
                      </div>
                    </div>
                  )}
                  {detailCandidate.origem && (
                    <Badge variant="outline" className="gap-1 rounded-full border-primary/40 text-primary bg-background/70">
                      <Megaphone className="h-3 w-3" /> {detailCandidate.origem}
                    </Badge>
                  )}
                </section>
              )}


              {/* Gerente */}
              {(detailGerente || isRh) && (
                <div className="rounded-xl border border-border/60 px-4 py-3 space-y-3">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <UserCheck className="h-3.5 w-3.5 text-primary" /> Gerente
                  </p>
                  {detailGerente && <GerenteChip g={detailGerente} size="md" />}
                  {isRh && (
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Atribuir a gerente</Label>
                      <Select
                        value={detailCandidate.gerente_id ?? "none"}
                        onValueChange={(v) => atribuirGerente(detailCandidate.id, v === "none" ? null : v)}
                      >
                        <SelectTrigger className="h-9"><SelectValue placeholder="Selecionar gerente" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Sem gerente</SelectItem>
                          {gerentes.map((g) => (
                            <SelectItem key={g.user_id} value={g.user_id}>{g.nome}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              )}

              {/* Respostas do quiz */}
              {detailRespostas && (
                <div className="space-y-3">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Respostas do quiz</p>
                  <div className="space-y-3">
                    {[
                      ["Vendas", detailRespostas.vendas],
                      ["Imobiliário", detailRespostas.imobiliario],
                      ["Disponibilidade", detailRespostas.disponibilidade],
                      ["Região", detailRespostas.regiao],
                      ["Motivação", detailRespostas.motivacao],
                    ].map(([label, value]) =>
                      value ? (
                        <div key={label as string} className="border-l-2 border-primary/40 pl-3">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label as string}</p>
                          <p className="text-sm text-foreground">{String(value)}</p>
                        </div>
                      ) : null
                    )}
                  </div>
                </div>
              )}

              {/* Observações */}
              {detailCandidate.observacoes && (
                <p className="text-sm text-muted-foreground bg-muted/40 rounded-xl px-4 py-3 whitespace-pre-wrap">
                  {detailCandidate.observacoes}
                </p>
              )}

              {/* Mover para etapa */}
              {!readOnly && (
              <div className="pt-4 border-t border-border/60 space-y-2">
                <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Mover para etapa</Label>
                <div className="flex flex-wrap gap-2">
                  {ETAPAS.filter((e) => e.key !== detailCandidate.etapa).map((e) => (
                    <Button
                      key={e.key} size="sm" variant="outline" className="text-xs h-8 rounded-full"
                      style={{ borderColor: e.color, color: e.color }}
                      onClick={() => { moveToEtapa(detailCandidate.id, e.key); setDetailCandidate(null); }}
                    >
                      {e.label}
                    </Button>
                  ))}
                </div>
              </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}
