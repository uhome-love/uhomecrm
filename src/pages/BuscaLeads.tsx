import { useState, useEffect, useCallback } from "react";
import { useBuscaLeads, BuscaFilters, BuscaLead, LeadTentativa } from "@/hooks/useBuscaLeads";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Search, Phone, User, Mail, Building2, Filter, X, CheckCircle2,
  Trash2, ArrowRightLeft, Lock, Unlock, ShieldAlert, Clock, History,
  AlertTriangle, Loader2, UserPlus,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

const STATUS_OPTIONS = [
  { value: "todos", label: "Todos" },
  { value: "na_fila", label: "Na fila" },
  { value: "em_cooldown", label: "Em cooldown" },
  { value: "aproveitado", label: "Aproveitado" },
  { value: "descartado", label: "Descartado" },
  { value: "bloqueado", label: "Bloqueado" },
  { value: "concluido", label: "Concluído" },
];

const STATUS_COLORS: Record<string, string> = {
  na_fila: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  em_cooldown: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  aproveitado: "bg-green-500/15 text-green-400 border-green-500/30",
  descartado: "bg-red-500/15 text-red-400 border-red-500/30",
  bloqueado: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  concluido: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
};

const RESULTADO_LABELS: Record<string, string> = {
  com_interesse: "✅ Com interesse",
  sem_interesse: "❌ Sem interesse",
  nao_atendeu: "📵 Não atendeu",
  numero_errado: "☎️ Número errado",
};

export default function BuscaLeads() {
  const { isAdmin } = useUserRole();
  const { results, isSearching, totalResults, buscar, fetchTentativas, executarAcao, fetchCorretores } = useBuscaLeads();

  // Search state
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [showFilters, setShowFilters] = useState(false);
  const [advFilters, setAdvFilters] = useState<BuscaFilters>({});

  // Detail modal
  const [selectedLead, setSelectedLead] = useState<BuscaLead | null>(null);
  const [tentativas, setTentativas] = useState<LeadTentativa[]>([]);
  const [loadingTentativas, setLoadingTentativas] = useState(false);

  // Action modal
  const [actionModal, setActionModal] = useState<{ acao: string; lead: BuscaLead } | null>(null);
  const [corretores, setCorretores] = useState<{ user_id: string; nome: string }[]>([]);
  const [selectedCorretor, setSelectedCorretor] = useState("");
  const [motivo, setMotivo] = useState("");
  const [executing, setExecuting] = useState(false);

  // Load corretores on mount
  useEffect(() => {
    fetchCorretores().then(setCorretores);
  }, [fetchCorretores]);

  const handleSearch = useCallback(() => {
    const filters: BuscaFilters = { ...advFilters };
    if (searchText.trim()) {
      // Auto-detect: if mostly digits, search by phone; otherwise by name
      const digits = searchText.replace(/\D/g, "");
      if (digits.length >= 4 && digits.length / searchText.replace(/\s/g, "").length > 0.6) {
        filters.telefone = searchText;
      } else if (searchText.includes("@")) {
        filters.email = searchText;
      } else {
        filters.nome = searchText;
      }
    }
    if (statusFilter !== "todos") filters.status = statusFilter;
    buscar(filters);
  }, [searchText, statusFilter, advFilters, buscar]);

  const openDetail = useCallback(async (lead: BuscaLead) => {
    setSelectedLead(lead);
    setLoadingTentativas(true);
    const t = await fetchTentativas(lead.id);
    setTentativas(t);
    setLoadingTentativas(false);
  }, [fetchTentativas]);

  const openAction = (acao: string, lead: BuscaLead) => {
    setActionModal({ acao, lead });
    setSelectedCorretor("");
    setMotivo(acao === "aproveitado" ? "Retorno WhatsApp pós ligação" : "");
  };

  const executeAction = async () => {
    if (!actionModal) return;
    const { acao, lead } = actionModal;

    // Pipeline inclusion — handled separately
    if (acao === "incluir_pipeline") {
      if (!selectedCorretor) {
        toast.error("Selecione o corretor");
        return;
      }
      setExecuting(true);
      try {
        // Get first stage
        const { data: stages } = await supabase
          .from("pipeline_stages")
          .select("id")
          .eq("pipeline_tipo", "leads")
          .eq("ativo", true)
          .order("ordem", { ascending: true })
          .limit(1);
        const stageId = stages?.[0]?.id;
        if (!stageId) {
          toast.error("Nenhum estágio configurado no pipeline");
          setExecuting(false);
          return;
        }

        const { error } = await supabase.from("pipeline_leads").insert({
          nome: lead.nome,
          telefone: lead.telefone,
          email: lead.email,
          empreendimento: lead.empreendimento,
          origem: lead.origem || "oferta_ativa",
          origem_detalhe: lead.campanha,
          corretor_id: selectedCorretor,
          stage_id: stageId,
          aceite_status: "aceito",
          aceito_em: new Date().toISOString(),
          observacoes: motivo || `Incluído via Busca de Leads (OA)`,
        });
        if (error) throw error;
        toast.success("✅ Lead incluído no pipeline do corretor!");
        setActionModal(null);
        setSelectedLead(null);
        handleSearch();
      } catch (err: any) {
        console.error(err);
        toast.error("Erro ao incluir no pipeline");
      }
      setExecuting(false);
      return;
    }

    if ((acao === "aproveitado" || acao === "transferir") && !selectedCorretor) {
      toast.error("Selecione o corretor");
      return;
    }
    setExecuting(true);
    const ok = await executarAcao(lead.id, acao, selectedCorretor || null, motivo);
    setExecuting(false);
    if (ok) {
      setActionModal(null);
      setSelectedLead(null);
      handleSearch(); // refresh results
    }
  };

  const formatDate = (d: string | null) => {
    if (!d) return "—";
    try { return format(new Date(d), "dd/MM/yy HH:mm", { locale: ptBR }); }
    catch { return d; }
  };

  const isReservado = (lead: BuscaLead) => {
    return lead.em_atendimento_por && lead.em_atendimento_ate && new Date(lead.em_atendimento_ate) > new Date();
  };

  const actionLabel: Record<string, string> = {
    aproveitado: "Marcar como Aproveitado",
    descartado: "Remover / Encerrar",
    transferir: "Transferir para Corretor",
    bloquear: "Bloquear (WhatsApp em andamento)",
    desbloquear: "Desbloquear Lead",
    quebrar_reserva: "Quebrar Reserva",
    incluir_pipeline: "Incluir no Pipeline de Leads",
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" />
            {isAdmin ? "Busca de Leads" : "Higienização"}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Busque, gerencie e higienize leads da Oferta Ativa
          </p>
        </div>
        {totalResults > 0 && (
          <Badge variant="secondary" className="text-xs">
            {totalResults} resultado{totalResults !== 1 ? "s" : ""}
          </Badge>
        )}
      </div>

      {/* Search Bar */}
      <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
        <CardContent className="p-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por telefone, nome ou email..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="pl-9 bg-background/50"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={() => setShowFilters(!showFilters)} variant="outline" size="icon">
              <Filter className="h-4 w-4" />
            </Button>
            <Button onClick={handleSearch} disabled={isSearching}>
              {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4 mr-1" />}
              Buscar
            </Button>
          </div>

          {showFilters && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 pt-3 border-t border-border/50">
              <div>
                <Label className="text-xs text-muted-foreground">Empreendimento</Label>
                <Input
                  placeholder="Ex: Villa..."
                  value={advFilters.empreendimento || ""}
                  onChange={(e) => setAdvFilters(f => ({ ...f, empreendimento: e.target.value }))}
                  className="mt-1 h-8 text-xs"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Origem</Label>
                <Input
                  placeholder="Ex: Facebook..."
                  value={advFilters.origem || ""}
                  onChange={(e) => setAdvFilters(f => ({ ...f, origem: e.target.value }))}
                  className="mt-1 h-8 text-xs"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Data início</Label>
                <Input
                  type="date"
                  value={advFilters.dataInicio || ""}
                  onChange={(e) => setAdvFilters(f => ({ ...f, dataInicio: e.target.value }))}
                  className="mt-1 h-8 text-xs"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Data fim</Label>
                <Input
                  type="date"
                  value={advFilters.dataFim || ""}
                  onChange={(e) => setAdvFilters(f => ({ ...f, dataFim: e.target.value }))}
                  className="mt-1 h-8 text-xs"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {results.length > 0 ? (
        <Card className="border-border/50">
          <CardContent className="p-0 overflow-auto max-h-[65vh]">
            <div className="min-w-[700px]">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="text-xs">Nome</TableHead>
                    <TableHead className="text-xs">Telefone</TableHead>
                    <TableHead className="text-xs">Produto</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs">Lista</TableHead>
                    <TableHead className="text-xs">Última interação</TableHead>
                    <TableHead className="text-xs text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((lead) => (
                    <TableRow
                      key={lead.id}
                      className="cursor-pointer hover:bg-muted/20 transition-colors"
                      onClick={() => openDetail(lead)}
                    >
                      <TableCell className="font-medium text-sm">
                        <div className="flex items-center gap-1.5">
                          {lead.nome}
                          {isReservado(lead) && (
                            <Lock className="h-3 w-3 text-orange-400" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs font-mono">
                        {lead.telefone || "—"}
                      </TableCell>
                      <TableCell className="text-xs">{lead.empreendimento || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] ${STATUS_COLORS[lead.status] || ""}`}>
                          {lead.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{lead.lista_nome}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(lead.ultima_tentativa || lead.updated_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs text-green-400 hover:text-green-300 hover:bg-green-500/10"
                            onClick={() => openAction("aproveitado", lead)}
                            disabled={lead.status === "aproveitado"}
                          >
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Aproveitar
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10"
                            onClick={() => openAction("descartado", lead)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : !isSearching && totalResults === 0 && (
        <Card className="border-border/50 bg-card/50">
          <CardContent className="py-16 text-center">
            <Search className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              Busque por telefone, nome ou email para encontrar leads
            </p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              A busca por telefone é o identificador principal
            </p>
          </CardContent>
        </Card>
      )}

      {/* ──── DETAIL MODAL ──── */}
      <Dialog open={!!selectedLead} onOpenChange={(o) => !o && setSelectedLead(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selectedLead && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-lg">
                  <User className="h-5 w-5 text-primary" />
                  {selectedLead.nome}
                  {isReservado(selectedLead) && (
                    <Badge variant="outline" className="text-orange-400 border-orange-500/30 text-[10px]">
                      <Lock className="h-3 w-3 mr-1" /> Reservado
                    </Badge>
                  )}
                </DialogTitle>
                <DialogDescription>Detalhes e ações do lead</DialogDescription>
              </DialogHeader>

              {/* Lead info */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-mono">{selectedLead.telefone || "—"}</span>
                </div>
                {selectedLead.telefone2 && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-mono">{selectedLead.telefone2}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>{selectedLead.email || "—"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>{selectedLead.empreendimento || "—"}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  Origem: {selectedLead.origem || "—"}
                </div>
                <div className="text-xs text-muted-foreground">
                  Lista: {selectedLead.lista_nome}
                </div>
                <div className="text-xs text-muted-foreground">
                  Tentativas: {selectedLead.tentativas_count}
                </div>
                <div>
                  <Badge variant="outline" className={`text-[10px] ${STATUS_COLORS[selectedLead.status] || ""}`}>
                    {selectedLead.status}
                  </Badge>
                </div>
              </div>

              {isReservado(selectedLead) && (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-orange-500/10 border border-orange-500/20 text-xs text-orange-300">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>
                    Lead reservado até {formatDate(selectedLead.em_atendimento_ate)}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="ml-auto h-6 text-[10px] text-orange-400 hover:bg-orange-500/20"
                    onClick={() => openAction("quebrar_reserva", selectedLead)}
                  >
                    Quebrar reserva
                  </Button>
                </div>
              )}

              {selectedLead.observacoes && (
                <div className="text-xs text-muted-foreground bg-muted/20 rounded-lg p-2.5">
                  📝 {selectedLead.observacoes}
                </div>
              )}

              <Separator />

              {/* Action buttons */}
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 text-white text-xs"
                  onClick={() => openAction("aproveitado", selectedLead)}
                  disabled={selectedLead.status === "aproveitado"}
                >
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Aproveitar e Atribuir
                </Button>
                {(isAdmin) && (
                  <Button
                    size="sm"
                    className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs"
                    onClick={() => openAction("incluir_pipeline", selectedLead)}
                  >
                    <UserPlus className="h-3.5 w-3.5 mr-1" /> Incluir no Pipeline
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs"
                  onClick={() => openAction("transferir", selectedLead)}
                >
                  <ArrowRightLeft className="h-3.5 w-3.5 mr-1" /> Transferir
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs text-orange-400 border-orange-500/30 hover:bg-orange-500/10"
                  onClick={() => openAction("bloquear", selectedLead)}
                  disabled={selectedLead.status === "bloqueado"}
                >
                  <Lock className="h-3.5 w-3.5 mr-1" /> Bloquear
                </Button>
                {selectedLead.status === "bloqueado" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs"
                    onClick={() => openAction("desbloquear", selectedLead)}
                  >
                    <Unlock className="h-3.5 w-3.5 mr-1" /> Desbloquear
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs text-red-400 border-red-500/30 hover:bg-red-500/10"
                  onClick={() => openAction("descartado", selectedLead)}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Encerrar
                </Button>
              </div>

              <Separator />

              {/* Attempt history */}
              <div>
                <h3 className="text-sm font-semibold flex items-center gap-2 mb-2">
                  <History className="h-4 w-4 text-primary" /> Histórico de Tentativas
                </h3>
                {loadingTentativas ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : tentativas.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-3">Nenhuma tentativa registrada</p>
                ) : (
                  <ScrollArea className="max-h-[200px]">
                    <div className="space-y-2">
                      {tentativas.map((t) => (
                        <div key={t.id} className="flex items-start gap-3 p-2.5 rounded-lg bg-muted/20 text-xs">
                          <div className="shrink-0 mt-0.5">
                            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium">{t.corretor_nome}</span>
                              <Badge variant="outline" className="text-[9px]">{t.canal}</Badge>
                              <span className="text-muted-foreground">
                                {RESULTADO_LABELS[t.resultado] || t.resultado}
                              </span>
                              <span className="text-muted-foreground/60 ml-auto">
                                {formatDate(t.created_at)}
                              </span>
                            </div>
                            {t.feedback && (
                              <p className="text-muted-foreground mt-1 truncate">{t.feedback}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ──── ACTION CONFIRMATION MODAL ──── */}
      <Dialog open={!!actionModal} onOpenChange={(o) => !o && setActionModal(null)}>
        <DialogContent className="max-w-md">
          {actionModal && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-base">
                  <ShieldAlert className="h-5 w-5 text-primary" />
                  {actionLabel[actionModal.acao]}
                </DialogTitle>
                <DialogDescription>
                  Lead: <strong>{actionModal.lead.nome}</strong> — {actionModal.lead.telefone || "sem telefone"}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3">
                {(actionModal.acao === "aproveitado" || actionModal.acao === "transferir" || actionModal.acao === "incluir_pipeline") && (
                  <div>
                    <Label className="text-xs">Corretor responsável</Label>
                    <Select value={selectedCorretor} onValueChange={setSelectedCorretor}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Selecionar corretor..." />
                      </SelectTrigger>
                      <SelectContent>
                        {corretores.map((c) => (
                          <SelectItem key={c.user_id} value={c.user_id}>
                            {c.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div>
                  <Label className="text-xs">Motivo / Observação</Label>
                  <Textarea
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    placeholder="Ex: Retorno WhatsApp pós ligação"
                    className="mt-1 h-20 text-sm"
                  />
                </div>
              </div>

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setActionModal(null)} disabled={executing}>
                  Cancelar
                </Button>
                <Button onClick={executeAction} disabled={executing}>
                  {executing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                  Confirmar
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
