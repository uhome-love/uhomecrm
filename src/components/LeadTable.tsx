import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkles, MessageSquare, Mail, Phone, ChevronDown, ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { Lead } from "@/types/lead";

interface LeadTableProps {
  leads: Lead[];
  onGenerateMessage: (lead: Lead) => void;
  loadingLeadId: string | null;
}

function PriorityBadge({ priority }: { priority?: Lead["prioridade"] }) {
  if (!priority) return <Badge variant="outline">Pendente</Badge>;
  const config = {
    alta: { label: "Alta", className: "bg-priority-high/10 text-priority-high border-priority-high/20" },
    media: { label: "Média", className: "bg-priority-medium/10 text-priority-medium border-priority-medium/20" },
    baixa: { label: "Baixa", className: "bg-priority-low/10 text-priority-low border-priority-low/20" },
  };
  const c = config[priority];
  return <Badge variant="outline" className={c.className}>{c.label}</Badge>;
}

export default function LeadTable({ leads, onGenerateMessage, loadingLeadId }: LeadTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="font-display font-semibold">Nome</TableHead>
            <TableHead className="font-display font-semibold">Interesse</TableHead>
            <TableHead className="font-display font-semibold">Contato</TableHead>
            <TableHead className="font-display font-semibold">Prioridade</TableHead>
            <TableHead className="font-display font-semibold text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {leads.map((lead) => (
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
                </div>
              </TableCell>
              <TableCell>
                <p className="text-sm text-foreground">{lead.interesse}</p>
                <p className="text-xs text-muted-foreground">Último: {lead.ultimoContato}</p>
              </TableCell>
              <TableCell>
                <div className="flex flex-col gap-1">
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Mail className="h-3 w-3" /> {lead.email}
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Phone className="h-3 w-3" /> {lead.telefone}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <PriorityBadge priority={lead.prioridade} />
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={loadingLeadId === lead.id}
                    onClick={() => onGenerateMessage(lead)}
                    className="gap-1.5"
                  >
                    {loadingLeadId === lead.id ? (
                      <Sparkles className="h-3.5 w-3.5 animate-pulse-soft" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                    {lead.mensagemGerada ? "Regerar" : "Gerar IA"}
                  </Button>
                  {lead.mensagemGerada && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setExpandedId(expandedId === lead.id ? null : lead.id)
                      }
                    >
                      <MessageSquare className="h-3.5 w-3.5 mr-1" />
                      {expandedId === lead.id ? (
                        <ChevronUp className="h-3 w-3" />
                      ) : (
                        <ChevronDown className="h-3 w-3" />
                      )}
                    </Button>
                  )}
                </div>
                <AnimatePresence>
                  {expandedId === lead.id && lead.mensagemGerada && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="mt-3 overflow-hidden"
                    >
                      <div className="rounded-lg border border-border bg-muted/30 p-4 text-left">
                        <p className="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          Mensagem gerada pela IA
                        </p>
                        <p className="text-sm whitespace-pre-wrap text-foreground leading-relaxed">
                          {lead.mensagemGerada}
                        </p>
                        <div className="mt-3 flex gap-2">
                          <Button size="sm" className="gap-1.5 text-xs">
                            <Phone className="h-3 w-3" /> WhatsApp
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
    </div>
  );
}
