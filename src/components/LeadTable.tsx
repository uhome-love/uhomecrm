import { useState, useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, MessageSquare, Mail, Phone, ChevronDown, ChevronUp, Home, MapPin, Clock, ExternalLink, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import type { Lead } from "@/types/lead";
import PriorityBadge from "@/components/PriorityBadge";
import { getDaysSinceContact, getTimeSinceContactLabel, getTimeSinceContactColor } from "@/lib/leadUtils";

interface LeadTableProps {
  leads: Lead[];
  onGenerateMessage: (lead: Lead) => void;
  loadingLeadId: string | null;
}

const PAGE_SIZE = 25;

function TimeBadge({ ultimoContato }: { ultimoContato: string }) {
  const days = getDaysSinceContact(ultimoContato);
  const label = getTimeSinceContactLabel(days);
  const color = getTimeSinceContactColor(days);
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ${color}`}>
      <Clock className="h-3 w-3" />
      {days !== null ? `${days}d` : label}
    </span>
  );
}

function buildWhatsAppLink(telefone: string, mensagem: string): string {
  let phone = telefone.replace(/\D/g, "");
  if (phone.length <= 11 && !phone.startsWith("55")) phone = "55" + phone;
  return `https://wa.me/${phone}?text=${encodeURIComponent(mensagem)}`;
}

export default function LeadTable({ leads, onGenerateMessage, loadingLeadId }: LeadTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    if (!search.trim()) return leads;
    const q = search.toLowerCase();
    return leads.filter(
      (l) =>
        l.nome.toLowerCase().includes(q) ||
        l.telefone?.toLowerCase().includes(q) ||
        l.email?.toLowerCase().includes(q) ||
        l.interesse?.toLowerCase().includes(q) ||
        l.corretor?.toLowerCase().includes(q) ||
        l.imovel?.codigo?.toLowerCase().includes(q)
    );
  }, [leads, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const paged = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  // Reset page when search or leads change
  const handleSearch = (val: string) => {
    setSearch(val);
    setPage(0);
  };

  const handleOpenWhatsApp = (lead: Lead) => {
    if (!lead.mensagemGerada) { toast.error("Gere a mensagem antes de enviar."); return; }
    if (!lead.telefone) { toast.error("Lead sem telefone cadastrado."); return; }
    window.open(buildWhatsAppLink(lead.telefone, lead.mensagemGerada), "_blank");
    toast.success(`WhatsApp aberto para ${lead.nome}!`);
  };

  return (
    <div className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
      {/* Search + pagination header */}
      <div className="flex items-center gap-3 p-3 border-b border-border bg-muted/30">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, telefone, interesse..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground ml-auto">
          <span>{filtered.length} leads</span>
          <span className="mx-1">•</span>
          <span>Página {safePage + 1} de {totalPages}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" disabled={safePage >= totalPages - 1} onClick={() => setPage(safePage + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="font-display font-semibold">Nome</TableHead>
            <TableHead className="font-display font-semibold">Interesse</TableHead>
            <TableHead className="font-display font-semibold">Contato</TableHead>
            <TableHead className="font-display font-semibold">Tempo s/ contato</TableHead>
            <TableHead className="font-display font-semibold">Prioridade</TableHead>
            <TableHead className="font-display font-semibold text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paged.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                {search ? "Nenhum lead encontrado para essa busca." : "Nenhum lead disponível."}
              </TableCell>
            </TableRow>
          ) : paged.map((lead) => (
            <motion.tr
              key={lead.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="group border-b border-border last:border-0 transition-colors hover:bg-muted/30"
            >
              <TableCell>
                <div>
                  <p className="font-medium text-foreground">{lead.nome}</p>
                  <p className="text-xs text-muted-foreground">{lead.origem}</p>
                  {lead.corretor && <p className="text-xs text-muted-foreground">👤 {lead.corretor}</p>}
                </div>
              </TableCell>
              <TableCell>
                {lead.imovel ? (
                  <div className="flex items-start gap-2">
                    {lead.imovel.imagem_thumb && (
                      <img src={lead.imovel.imagem_thumb} alt={lead.imovel.codigo} className="h-10 w-14 rounded object-cover shrink-0" />
                    )}
                    <div>
                      <p className="text-sm font-medium text-foreground flex items-center gap-1">
                        <Home className="h-3 w-3" /> {lead.imovel.codigo}
                      </p>
                      <p className="text-xs text-muted-foreground">{lead.imovel.tipo} • {lead.imovel.dormitorios}d • {lead.imovel.garagens}v</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-0.5">
                        <MapPin className="h-2.5 w-2.5" /> {lead.imovel.endereco_bairro}, {lead.imovel.endereco_cidade}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm text-foreground">{lead.interesse || "—"}</p>
                    <p className="text-xs text-muted-foreground">Último: {lead.ultimoContato}</p>
                  </div>
                )}
              </TableCell>
              <TableCell>
                <div className="flex flex-col gap-1">
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Mail className="h-3 w-3" /> {lead.email || "—"}
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Phone className="h-3 w-3" /> {lead.telefone || "—"}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <TimeBadge ultimoContato={lead.ultimoContato} />
              </TableCell>
              <TableCell>
                <PriorityBadge priority={lead.prioridade} />
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-2">
                  <Button size="sm" variant="outline" disabled={loadingLeadId === lead.id} onClick={() => onGenerateMessage(lead)} className="gap-1.5">
                    <Sparkles className={`h-3.5 w-3.5 ${loadingLeadId === lead.id ? "animate-pulse-soft" : ""}`} />
                    {lead.mensagemGerada ? "Regerar" : "Gerar IA"}
                  </Button>
                  {lead.mensagemGerada && (
                    <Button size="sm" variant="ghost" onClick={() => setExpandedId(expandedId === lead.id ? null : lead.id)}>
                      <MessageSquare className="h-3.5 w-3.5 mr-1" />
                      {expandedId === lead.id ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </Button>
                  )}
                </div>
                <AnimatePresence>
                  {expandedId === lead.id && lead.mensagemGerada && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="mt-3 overflow-hidden">
                      <div className="rounded-lg border border-border bg-muted/30 p-4 text-left">
                        <p className="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Mensagem gerada pela IA</p>
                        <p className="text-sm whitespace-pre-wrap text-foreground leading-relaxed">{lead.mensagemGerada}</p>
                        <div className="mt-3 flex gap-2">
                          <Button size="sm" className="gap-1.5 text-xs" onClick={() => handleOpenWhatsApp(lead)}>
                            <ExternalLink className="h-3 w-3" /> Enviar WhatsApp
                          </Button>
                          <Button size="sm" variant="outline" className="gap-1.5 text-xs">
                            <Mail className="h-3 w-3" /> E-mail
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </TableCell>
            </motion.tr>
          ))}
        </TableBody>
      </Table>

      {/* Bottom pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/20">
          <p className="text-xs text-muted-foreground">
            Mostrando {safePage * PAGE_SIZE + 1}–{Math.min((safePage + 1) * PAGE_SIZE, filtered.length)} de {filtered.length}
          </p>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="outline" className="h-7 text-xs" disabled={safePage === 0} onClick={() => setPage(0)}>
              Primeira
            </Button>
            <Button size="sm" variant="outline" className="h-7 w-7 p-0" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const start = Math.max(0, Math.min(safePage - 2, totalPages - 5));
              const p = start + i;
              if (p >= totalPages) return null;
              return (
                <Button key={p} size="sm" variant={p === safePage ? "default" : "outline"} className="h-7 w-7 p-0 text-xs" onClick={() => setPage(p)}>
                  {p + 1}
                </Button>
              );
            })}
            <Button size="sm" variant="outline" className="h-7 w-7 p-0" disabled={safePage >= totalPages - 1} onClick={() => setPage(safePage + 1)}>
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs" disabled={safePage >= totalPages - 1} onClick={() => setPage(totalPages - 1)}>
              Última
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
