/**
 * LeadSearchModal — Modal to search and select a lead for property matching.
 */

import React, { useState, useCallback, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Loader2, User, Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import type { MatchedLead } from "@/hooks/useLeadMatch";

interface LeadSearchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (lead: MatchedLead) => void;
}

interface LeadResult {
  id: string;
  nome: string;
  telefone: string | null;
  etapa_nome: string | null;
  valor_min?: number | null;
  valor_max?: number | null;
  bairro_regiao?: string | null;
  dormitorios?: number | null;
}

export default function LeadSearchModal({ open, onOpenChange, onSelect }: LeadSearchModalProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LeadResult[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setResults([]);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const searchLeads = useCallback(async (term: string) => {
    if (!term || term.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const isPhone = /^\d+$/.test(term.replace(/\D/g, ""));
      let q = supabase
        .from("pipeline_leads")
        .select("id, nome, telefone, etapa_nome, objetivo_cliente, bairro_regiao, forma_pagamento")
        .limit(15);

      if (isPhone) {
        const digits = term.replace(/\D/g, "");
        q = q.ilike("telefone", `%${digits}%`);
      } else {
        q = q.ilike("nome", `%${term}%`);
      }

      const { data, error } = await q;
      if (error) throw error;
      setResults((data || []).map((d: any) => ({
        id: d.id,
        nome: d.nome,
        telefone: d.telefone,
        etapa_nome: d.etapa_nome,
        bairro_regiao: d.bairro_regiao,
      })));
    } catch (err) {
      console.error("Lead search error:", err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchLeads(value), 300);
  };

  const handleSelect = (lead: LeadResult) => {
    onSelect({
      id: lead.id,
      nome: lead.nome,
      telefone: lead.telefone,
      etapa: lead.etapa_nome,
      bairro_regiao: lead.bairro_regiao,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Selecionar Lead para Match</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={inputRef}
              placeholder="Buscar por nome ou telefone..."
              value={query}
              onChange={(e) => handleChange(e.target.value)}
              className="pl-9"
            />
            {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
          </div>

          <div className="max-h-[300px] overflow-y-auto space-y-1">
            {results.length === 0 && query.length >= 2 && !loading && (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum lead encontrado</p>
            )}
            {results.map((lead) => (
              <button
                key={lead.id}
                onClick={() => handleSelect(lead)}
                className={cn(
                  "w-full text-left px-3 py-2.5 rounded-lg transition-colors",
                  "hover:bg-muted/70 flex items-start gap-3 group"
                )}
              >
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <User className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{lead.nome}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {lead.telefone && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {lead.telefone}
                      </span>
                    )}
                    {lead.etapa_nome && (
                      <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                        {lead.etapa_nome}
                      </Badge>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
