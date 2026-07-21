import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Loader2,
  Link2,
  Search,
  CheckCircle2,
  X,
  Filter,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Canonico = { id: string; nome: string; segmento_id: string; ativo: boolean };
type Alias = {
  id: string;
  alias_raw: string;
  alias_norm: string;
  tipo: string;
  empreendimento_id: string;
};
type NaoMapeado = {
  alias: string;
  tipo: "campanha" | "conjunto" | "anuncio" | "formulario" | "empreendimento_texto";
  count: number;
};

const TIPO_LABEL: Record<string, string> = {
  campanha: "Campanha",
  conjunto: "Conjunto",
  anuncio: "Anúncio",
  formulario: "Formulário",
  empreendimento_texto: "Empreend. (texto)",
  origem_detalhe: "Origem",
};

const TIPO_COLUNA: Record<NaoMapeado["tipo"], string> = {
  campanha: "campanha",
  conjunto: "conjunto_anuncio",
  anuncio: "anuncio",
  formulario: "formulario",
  empreendimento_texto: "empreendimento",
};

export function MapeamentoMetaTab() {
  const [loading, setLoading] = useState(true);
  const [canonicos, setCanonicos] = useState<Canonico[]>([]);
  const [aliases, setAliases] = useState<Alias[]>([]);
  const [naoMapeados, setNaoMapeados] = useState<NaoMapeado[]>([]);
  const [busca, setBusca] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState<string>("todos");
  const [aba, setAba] = useState<"pendentes" | "mapeados">("pendentes");
  const [vincularAlvo, setVincularAlvo] = useState<NaoMapeado | null>(null);
  const [empreendimentoEscolhido, setEmpreendimentoEscolhido] = useState<string>("");
  const [salvando, setSalvando] = useState(false);

  const carregar = async () => {
    setLoading(true);

    const [{ data: canon }, { data: als }] = await Promise.all([
      supabase
        .from("empreendimentos_canonicos")
        .select("id, nome, segmento_id, ativo")
        .order("ordem", { ascending: true }),
      supabase
        .from("empreendimento_aliases")
        .select("id, alias_raw, alias_norm, tipo, empreendimento_id"),
    ]);
    setCanonicos((canon as Canonico[]) ?? []);
    setAliases((als as Alias[]) ?? []);

    // Buscar strings distintas dos últimos 30d
    const desde = new Date();
    desde.setDate(desde.getDate() - 30);
    const desdeIso = desde.toISOString();

    // Uma query por tipo, com agregação client-side (Supabase JS não suporta group by direto)
    const tipos: Array<{ tipo: NaoMapeado["tipo"]; col: string }> = [
      { tipo: "campanha", col: "campanha" },
      { tipo: "conjunto", col: "conjunto_anuncio" },
      { tipo: "anuncio", col: "anuncio" },
      { tipo: "formulario", col: "formulario" },
      { tipo: "empreendimento_texto", col: "empreendimento" },
    ];

    const acumulado: NaoMapeado[] = [];
    const aliasSet = new Set(
      ((als as Alias[]) ?? []).map((a) => `${a.tipo}::${a.alias_norm}`)
    );

    for (const { tipo, col } of tipos) {
      // Pega leads sem canônico OU strings novas — foco em não classificados
      const { data } = await supabase
        .from("pipeline_leads")
        .select(`${col}, empreendimento_canonico_id`)
        .gte("created_at", desdeIso)
        .not(col, "is", null)
        .limit(10000);

      const contagem = new Map<string, number>();
      (data ?? []).forEach((row: any) => {
        const raw = row[col];
        if (!raw || typeof raw !== "string") return;
        const norm = normalizar(raw);
        if (!norm) return;
        if (aliasSet.has(`${tipo}::${norm}`)) return;
        // Só sugere se o lead está SEM canônico ainda (aliases outros campos podem ter resolvido)
        if (row.empreendimento_canonico_id) return;
        contagem.set(raw, (contagem.get(raw) ?? 0) + 1);
      });
      contagem.forEach((count, alias) => {
        if (count >= 1) acumulado.push({ alias, tipo, count });
      });
    }

    acumulado.sort((a, b) => b.count - a.count);
    setNaoMapeados(acumulado);
    setLoading(false);
  };

  useEffect(() => {
    carregar();
  }, []);

  const pendentesFiltrados = useMemo(() => {
    const buscaN = normalizar(busca);
    return naoMapeados.filter((n) => {
      if (tipoFiltro !== "todos" && n.tipo !== tipoFiltro) return false;
      if (buscaN && !normalizar(n.alias).includes(buscaN)) return false;
      return true;
    });
  }, [naoMapeados, busca, tipoFiltro]);

  const mapeadosAgrupados = useMemo(() => {
    const map = new Map<string, Alias[]>();
    aliases.forEach((a) => {
      const arr = map.get(a.empreendimento_id) ?? [];
      arr.push(a);
      map.set(a.empreendimento_id, arr);
    });
    return map;
  }, [aliases]);

  async function confirmarVinculo() {
    if (!vincularAlvo || !empreendimentoEscolhido) return;
    setSalvando(true);
    const { error } = await supabase.rpc("vincular_alias_empreendimento", {
      p_alias: vincularAlvo.alias,
      p_tipo: vincularAlvo.tipo,
      p_empreendimento_id: empreendimentoEscolhido,
    });
    setSalvando(false);
    if (error) {
      toast.error("Falha ao vincular: " + error.message);
      return;
    }
    toast.success("Vinculado. Leads dos últimos 180d reprocessados.");
    setVincularAlvo(null);
    setEmpreendimentoEscolhido("");
    carregar();
  }

  async function removerAlias(id: string) {
    if (!confirm("Remover este vínculo? Leads serão reclassificados.")) return;
    const { error } = await supabase.rpc("remover_alias_empreendimento", {
      p_alias_id: id,
    });
    if (error) {
      toast.error("Falha: " + error.message);
      return;
    }
    toast.success("Vínculo removido.");
    carregar();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const totalPendentes = naoMapeados.reduce((s, n) => s + n.count, 0);

  return (
    <div className="space-y-4">
      {/* Header stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatCard
          label="Produtos canônicos"
          value={canonicos.length}
          hint="Cadastrados"
        />
        <StatCard
          label="Aliases mapeados"
          value={aliases.length}
          hint="Strings vinculadas a produtos"
        />
        <StatCard
          label="Leads sem classificar (30d)"
          value={totalPendentes}
          hint={`${pendentesFiltrados.length} textos distintos`}
          alert={totalPendentes > 0}
        />
      </div>

      {/* Abas */}
      <div className="flex items-center gap-2 border-b border-border">
        <button
          onClick={() => setAba("pendentes")}
          className={cn(
            "px-3 py-2 text-sm font-semibold border-b-2 transition",
            aba === "pendentes"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground"
          )}
        >
          Pendentes de vínculo
          {naoMapeados.length > 0 && (
            <Badge variant="destructive" className="ml-2 h-4 px-1.5 text-[10px]">
              {naoMapeados.length}
            </Badge>
          )}
        </button>
        <button
          onClick={() => setAba("mapeados")}
          className={cn(
            "px-3 py-2 text-sm font-semibold border-b-2 transition",
            aba === "mapeados"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground"
          )}
        >
          Já mapeados
        </button>
      </div>

      {aba === "pendentes" && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar texto…"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={tipoFiltro} onValueChange={setTipoFiltro}>
              <SelectTrigger className="w-[180px]">
                <Filter className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os tipos</SelectItem>
                {Object.entries(TIPO_LABEL).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {pendentesFiltrados.length === 0 ? (
            <div className="rounded-lg border border-border bg-card p-8 text-center">
              <CheckCircle2 className="h-10 w-10 mx-auto text-primary mb-2" />
              <p className="font-semibold">Tudo classificado</p>
              <p className="text-sm text-muted-foreground">
                Nenhum texto pendente nos últimos 30 dias.
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <div className="grid grid-cols-[1fr_120px_80px_120px] gap-2 px-3 py-2 bg-muted/50 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <div>Texto</div>
                <div>Tipo</div>
                <div className="text-right">Leads</div>
                <div className="text-right">Ação</div>
              </div>
              <div className="divide-y divide-border max-h-[600px] overflow-y-auto">
                {pendentesFiltrados.map((n, i) => (
                  <div
                    key={`${n.tipo}-${n.alias}-${i}`}
                    className="grid grid-cols-[1fr_120px_80px_120px] gap-2 px-3 py-2 items-center text-sm hover:bg-muted/30"
                  >
                    <div className="truncate font-medium" title={n.alias}>
                      {n.alias}
                    </div>
                    <div>
                      <Badge variant="outline" className="text-[10px]">
                        {TIPO_LABEL[n.tipo]}
                      </Badge>
                    </div>
                    <div className="text-right font-mono text-sm">{n.count}</div>
                    <div className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setVincularAlvo(n)}
                      >
                        <Link2 className="h-3 w-3 mr-1" /> Vincular
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {aba === "mapeados" && (
        <div className="space-y-2">
          {canonicos
            .filter((c) => c.ativo)
            .map((c) => {
              const arr = mapeadosAgrupados.get(c.id) ?? [];
              if (arr.length === 0) return null;
              return (
                <div
                  key={c.id}
                  className="rounded-lg border border-border bg-card p-3"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-semibold">{c.nome}</div>
                    <Badge variant="secondary">{arr.length} aliases</Badge>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {arr.map((a) => (
                      <div
                        key={a.id}
                        className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/30 px-2 py-1 text-xs"
                        title={`${TIPO_LABEL[a.tipo]}: ${a.alias_raw}`}
                      >
                        <span className="text-muted-foreground text-[10px] uppercase">
                          {TIPO_LABEL[a.tipo]}
                        </span>
                        <span className="max-w-[280px] truncate">
                          {a.alias_raw}
                        </span>
                        <button
                          onClick={() => removerAlias(a.id)}
                          className="text-muted-foreground hover:text-destructive"
                          aria-label="Remover"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {/* Modal vincular */}
      <Dialog
        open={!!vincularAlvo}
        onOpenChange={(o) => {
          if (!o) {
            setVincularAlvo(null);
            setEmpreendimentoEscolhido("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Vincular a um produto canônico</DialogTitle>
          </DialogHeader>
          {vincularAlvo && (
            <div className="space-y-3">
              <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
                <div className="text-xs text-muted-foreground uppercase mb-1">
                  {TIPO_LABEL[vincularAlvo.tipo]} · {vincularAlvo.count} leads
                </div>
                <div className="font-medium break-words">{vincularAlvo.alias}</div>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">
                  Empreendimento
                </label>
                <Select
                  value={empreendimentoEscolhido}
                  onValueChange={setEmpreendimentoEscolhido}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o produto…" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[320px]">
                    {canonicos
                      .filter((c) => c.ativo)
                      .map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.nome}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">
                Ao confirmar, todos os leads dos últimos 180 dias com esse texto
                serão reclassificados automaticamente.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setVincularAlvo(null);
                setEmpreendimentoEscolhido("");
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={confirmarVinculo}
              disabled={!empreendimentoEscolhido || salvando}
            >
              {salvando && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
              Vincular e reprocessar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  alert,
}: {
  label: string;
  value: number;
  hint?: string;
  alert?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border p-3",
        alert ? "border-warning/40 bg-warning/5" : "border-border bg-card"
      )}
    >
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold">{value.toLocaleString("pt-BR")}</div>
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

// Normaliza igual à função SQL public.normalize_alias (aproximado no JS)
function normalizar(s: string): string {
  if (!s) return "";
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
