import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, Users, CreditCard, Mail, BadgeCheck } from "lucide-react";

export default function CadastrosPage() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");

  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ["cadastros-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome, email, cpf, creci, cargo, telefone, avatar_url")
        .in("cargo", ["corretor", "gerente", "admin"])
        .order("cargo")
        .order("nome");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const filtered = profiles.filter((p) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      p.nome?.toLowerCase().includes(q) ||
      p.email?.toLowerCase().includes(q) ||
      p.cpf?.toLowerCase().includes(q) ||
      p.creci?.toLowerCase().includes(q) ||
      p.cargo?.toLowerCase().includes(q)
    );
  });

  const cargoColor = (cargo: string | null) => {
    switch (cargo) {
      case "admin": return "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300";
      case "gerente": return "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300";
      case "corretor": return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const cargoLabel = (cargo: string | null) => {
    switch (cargo) {
      case "admin": return "CEO / Admin";
      case "gerente": return "Gerente";
      case "corretor": return "Corretor";
      default: return cargo || "—";
    }
  };

  const missingFields = (p: typeof profiles[0]) => {
    const missing: string[] = [];
    if (!p.cpf) missing.push("CPF");
    if (!p.email) missing.push("Email");
    if (!p.creci) missing.push("CRECI");
    return missing;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Users className="h-6 w-6 text-primary" />
          Cadastros
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Dados cadastrais dos profissionais — utilizados para geração de pagadorias e contratos
        </p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, CPF, CRECI..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((p) => {
          const missing = missingFields(p);
          return (
            <Card key={p.id} className="relative overflow-hidden">
              {missing.length > 0 && (
                <div className="absolute top-0 left-0 right-0 h-1 bg-amber-400" />
              )}
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-sm font-semibold">{p.nome || "Sem nome"}</CardTitle>
                    <Badge variant="secondary" className={`mt-1 text-[10px] ${cargoColor(p.cargo)}`}>
                      {cargoLabel(p.cargo)}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className={p.cpf ? "text-foreground" : "text-muted-foreground italic"}>
                    {p.cpf || "CPF não cadastrado"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className={p.email ? "text-foreground" : "text-muted-foreground italic"}>
                    {p.email || "Email não cadastrado"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <BadgeCheck className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className={p.creci ? "text-foreground" : "text-muted-foreground italic"}>
                    {p.creci || "CRECI não cadastrado"}
                  </span>
                </div>

                {missing.length > 0 && (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-2">
                    ⚠️ Pendente: {missing.join(", ")}
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          Nenhum cadastro encontrado.
        </div>
      )}
    </div>
  );
}
