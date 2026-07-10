import { useState, useMemo, useRef, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth, setMonth } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trophy, TrendingUp, Building2, CalendarDays, Search, CheckCircle,
  Crown, Loader2, ChevronDown, Target, Megaphone, Wallet, Pencil, Check, X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { fmtMoney } from "@/lib/fmtMoney";
import { resolveFormName } from "@/lib/metaFormIdMap";
import { toast } from "sonner";

const formatCurrency = (v: number) => fmtMoney(v, "short");
const formatVgvExact = (v: number) => fmtMoney(v, "exact");

function getInitials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join("");
}

interface VendaRow {
  id: string;
  nome_cliente: string;
  empreendimento: string | null;
  unidade: string | null;
  vgv_final: number | null;
  vgv_estimado: number | null;
  data_assinatura: string | null;
  corretor_id: string | null;
  gerente_id: string | null;
  fase: string | null;
  created_at: string | null;
  pipeline_lead_id: string | null;
}

interface PartnerInfo {
  auth_user_ids: string[];
  fator_split: number;
}

interface ProfileInfo {
  id: string;
  nome: string;
  avatar_url: string | null;
  avatar_gamificado_url: string | null;
}

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

/* ═══════ Célula de comissão editável ═══════ */
function ComissaoCell({
  value, editable, onSave, compact,
}: { value: number | null; editable: boolean; onSave: (v: number) => Promise<void>; compact?: boolean }) {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  const start = () => {
    setRaw(value != null && value > 0 ? String(value).replace(".", ",") : "");
    setEditing(true);
  };

  const commit = async () => {
    const parsed = Number(raw.replace(/\./g, "").replace(",", "."));
    if (isNaN(parsed)) { setEditing(false); return; }
    setSaving(true);
    try {
      await onSave(parsed);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1 justify-end">
        <span className="text-[11px] text-muted-foreground">R$</span>
        <input
          ref={inputRef}
          value={raw}
          onChange={e => setRaw(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
          placeholder="0,00"
          className="w-[92px] text-[12px] text-right px-2 h-[28px] bg-white dark:bg-white/5 border border-primary/40 rounded-[7px] outline-none text-foreground"
        />
        <button onClick={commit} disabled={saving} className="text-success-500 hover:bg-success-500/10 rounded p-1">
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={13} />}
        </button>
        <button onClick={() => setEditing(false)} className="text-muted-foreground hover:bg-muted rounded p-1"><X size={13} /></button>
      </div>
    );
  }

  const hasValue = value != null && value > 0;
  return (
    <button
      onClick={editable ? start : undefined}
      disabled={!editable}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[7px] px-2 py-1 transition-colors",
        editable ? "hover:bg-primary/10 cursor-pointer" : "cursor-default",
        compact && "text-[12px]",
      )}
      title={editable ? "Clique para editar sua comissão" : undefined}
    >
      {hasValue ? (
        <span className="text-[12px] font-bold text-primary">{fmtMoney(value!, "exact", { decimals: 2 })}</span>
      ) : (
        <span className={cn("text-[11px]", editable ? "text-primary/70 font-medium" : "text-muted-foreground italic")}>
          {editable ? "+ preencher" : "—"}
        </span>
      )}
      {editable && <Pencil size={10} className="text-muted-foreground" />}
    </button>
  );
}

/* ═══════ Bloco de meta mensal ═══════ */
function MetaBlock({
  titulo, meta, atingido, editable, onSave, faturamento, faturamentoLabel,
}: {
  titulo: string; meta: number; atingido: number; editable: boolean;
  onSave: (v: number) => Promise<void>; faturamento: number; faturamentoLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [raw, setRaw] = useState("");
  const [saving, setSaving] = useState(false);
  const pct = meta > 0 ? Math.min(100, Math.round((atingido / meta) * 100)) : 0;

  const commit = async () => {
    const parsed = Number(raw.replace(/\./g, "").replace(",", "."));
    if (isNaN(parsed)) { setOpen(false); return; }
    setSaving(true);
    try { await onSave(parsed); setOpen(false); } finally { setSaving(false); }
  };

  return (
    <div className="bg-card border border-border rounded-[12px] p-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Target size={15} className="text-primary" />
          <h2 className="text-[13px] font-bold text-foreground">{titulo}</h2>
        </div>
        {editable && (
          <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) setRaw(meta > 0 ? String(meta).replace(".", ",") : ""); }}>
            <PopoverTrigger asChild>
              <button className="text-[11px] font-medium px-2.5 py-1 rounded-[7px] border border-border hover:bg-primary/5 text-primary flex items-center gap-1">
                <Pencil size={11} /> Editar meta
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-56 p-3">
              <label className="text-[11px] font-medium text-muted-foreground">Meta de VGV do mês (R$)</label>
              <div className="flex items-center gap-1.5 mt-1.5">
                <input
                  autoFocus value={raw} onChange={e => setRaw(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") commit(); }}
                  placeholder="0,00"
                  className="flex-1 text-[13px] px-2.5 h-[32px] bg-white dark:bg-white/5 border border-border rounded-[8px] outline-none focus:border-primary text-foreground"
                />
                <button onClick={commit} disabled={saving} className="h-[32px] px-3 bg-primary text-white rounded-[8px] text-[12px] font-semibold flex items-center gap-1">
                  {saving ? <Loader2 size={12} className="animate-spin" /> : "Salvar"}
                </button>
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Progresso meta */}
        <div className="sm:col-span-2">
          <div className="flex items-baseline justify-between mb-1.5">
            <span className="text-[13px] font-black text-emerald-500">{formatVgvExact(atingido)}</span>
            <span className="text-[11px] text-muted-foreground">
              meta {meta > 0 ? formatCurrency(meta) : "não definida"}
            </span>
          </div>
          <div className="h-2.5 rounded-full bg-muted/60 overflow-hidden">
            <motion.div
              initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6 }}
              className={cn("h-full rounded-full", pct >= 100 ? "bg-emerald-500" : "bg-primary")}
            />
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">
            {meta > 0 ? `${pct}% da meta atingida` : "Defina uma meta para acompanhar o progresso"}
          </p>
        </div>

        {/* Faturamento em comissões */}
        <div className="rounded-[10px] bg-primary/5 border border-primary/15 p-3 flex flex-col justify-center">
          <div className="flex items-center gap-1.5 mb-0.5">
            <Wallet size={12} className="text-primary" />
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{faturamentoLabel}</span>
          </div>
          <p className="text-[18px] font-[800] text-primary leading-none">{fmtMoney(faturamento, "exact", { decimals: 2 })}</p>
        </div>
      </div>
    </div>
  );
}

export default function VendasRealizadas() {
  const { user } = useAuth();
  const { isAdmin, isGestor } = useUserRole();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear] = useState(new Date().getFullYear());
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [periodMode, setPeriodMode] = useState<"mes" | "ano">("mes");
  const [activeTab, setActiveTab] = useState<"vendas" | "origens">("vendas");

  const mesStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}`;

  const dateRange = useMemo(() => {
    if (periodMode === "ano") {
      return { start: `${selectedYear}-01-01`, end: `${selectedYear}-12-31`, label: `Ano de ${selectedYear}` };
    }
    const target = setMonth(new Date(selectedYear, 0, 1), selectedMonth);
    return {
      start: format(startOfMonth(target), "yyyy-MM-dd"),
      end: format(endOfMonth(target), "yyyy-MM-dd"),
      label: `${MESES[selectedMonth]} ${selectedYear}`,
    };
  }, [selectedMonth, selectedYear, periodMode]);

  const { data, isLoading } = useQuery({
    queryKey: ["vendas-realizadas", user?.id, isAdmin, isGestor, dateRange.start, dateRange.end],
    enabled: !!user,
    queryFn: async () => {
      let profileId: string | null = null;
      if (!isAdmin) {
        const { data: p } = await supabase.from("profiles").select("id").eq("user_id", user!.id).maybeSingle();
        profileId = p?.id || null;
      }

      let extraPartnerRows: VendaRow[] = [];

      let query = supabase.from("negocios")
        .select("id, nome_cliente, empreendimento, unidade, vgv_final, vgv_estimado, data_assinatura, corretor_id, gerente_id, fase, created_at, pipeline_lead_id")
        .eq("fase", "vendido")
        .gte("data_assinatura", dateRange.start)
        .lte("data_assinatura", dateRange.end)
        .order("data_assinatura", { ascending: false });

      if (!isAdmin && !isGestor && profileId) {
        query = query.eq("corretor_id", profileId);
        const { data: partnerDeals } = await supabase.from("v_kpi_negocios")
          .select("id").eq("auth_user_id", user!.id).eq("fase", "vendido")
          .gte("data_assinatura", dateRange.start).lte("data_assinatura", dateRange.end).eq("is_parceria", true);
        const partnerDealIds = (partnerDeals || []).map(d => d.id as string);
        if (partnerDealIds.length > 0) {
          const { data: extraDeals } = await supabase.from("negocios")
            .select("id, nome_cliente, empreendimento, unidade, vgv_final, vgv_estimado, data_assinatura, corretor_id, gerente_id, fase, created_at, pipeline_lead_id")
            .in("id", partnerDealIds).eq("fase", "vendido");
          extraPartnerRows = (extraDeals || []) as VendaRow[];
        }
      } else if (isGestor && !isAdmin) {
        const { data: teamMembers } = await supabase.from("team_members").select("user_id").eq("gerente_id", user!.id);
        const tmUserIds = (teamMembers || []).map(tm => tm.user_id).filter(Boolean) as string[];
        const allTeamAuthIds = [...tmUserIds];
        if (user?.id && !allTeamAuthIds.includes(user.id)) allTeamAuthIds.push(user.id);

        const { data: teamProfiles } = await supabase.from("profiles").select("id").in("user_id", allTeamAuthIds);
        const teamProfileIds = (teamProfiles || []).map(p => p.id);
        if (profileId && !teamProfileIds.includes(profileId)) teamProfileIds.push(profileId);

        const { data: partnerDeals } = await supabase.from("v_kpi_negocios")
          .select("id").in("auth_user_id", allTeamAuthIds).eq("fase", "vendido")
          .gte("data_assinatura", dateRange.start).lte("data_assinatura", dateRange.end).eq("is_parceria", true);
        const partnerDealIds = (partnerDeals || []).map(d => d.id as string);

        if (teamProfileIds.length > 0) query = query.in("corretor_id", teamProfileIds);

        if (partnerDealIds.length > 0) {
          const { data: extraDeals } = await supabase.from("negocios")
            .select("id, nome_cliente, empreendimento, unidade, vgv_final, vgv_estimado, data_assinatura, corretor_id, gerente_id, fase, created_at, pipeline_lead_id")
            .in("id", partnerDealIds).eq("fase", "vendido");
          extraPartnerRows = (extraDeals || []) as VendaRow[];
        }
      }

      const { data: vendas } = await query;
      let rows = (vendas || []) as VendaRow[];

      if (extraPartnerRows.length > 0) {
        const existingIds = new Set(rows.map(r => r.id));
        for (const pr of extraPartnerRows) {
          if (!existingIds.has(pr.id)) { rows.push(pr); existingIds.add(pr.id); }
        }
        rows.sort((a, b) => (b.data_assinatura || "").localeCompare(a.data_assinatura || ""));
      }

      const dealIds = rows.map(v => v.id);
      let parceriaSet = new Set<string>();
      let parceriaPartners: Record<string, PartnerInfo> = {};
      if (dealIds.length > 0) {
        const { data: kpiRows } = await supabase.from("v_kpi_negocios")
          .select("id, auth_user_id, pipeline_lead_id, is_parceria, fator_split")
          .eq("is_parceria", true).in("id", dealIds);
        (kpiRows || []).forEach(r => {
          const plId = r.pipeline_lead_id;
          if (!plId) return;
          parceriaSet.add(plId);
          if (!parceriaPartners[plId]) parceriaPartners[plId] = { auth_user_ids: [], fator_split: Number(r.fator_split || 0.5) };
          if (r.auth_user_id && !parceriaPartners[plId].auth_user_ids.includes(r.auth_user_id)) {
            parceriaPartners[plId].auth_user_ids.push(r.auth_user_id);
          }
        });
      }

      const corretorProfileIds = new Set(rows.map(v => v.corretor_id).filter(Boolean) as string[]);
      const partnerAuthUserIds = new Set<string>();
      Object.values(parceriaPartners).forEach(p => p.auth_user_ids.forEach(id => partnerAuthUserIds.add(id)));

      const profileIds = [...corretorProfileIds];
      const authIds = [...partnerAuthUserIds];

      const [profilesRes, authProfilesRes, profileIdMapRes, comissoesRes] = await Promise.all([
        profileIds.length > 0
          ? supabase.from("profiles").select("id, nome, avatar_url, avatar_gamificado_url").in("id", profileIds)
          : { data: [] },
        authIds.length > 0
          ? supabase.from("profiles").select("id, user_id, nome, avatar_url, avatar_gamificado_url").in("user_id", authIds)
          : { data: [] },
        profileIds.length > 0
          ? supabase.from("profiles").select("id, user_id").in("id", profileIds)
          : { data: [] },
        dealIds.length > 0
          ? supabase.from("venda_comissoes").select("negocio_id, user_id, valor").in("negocio_id", dealIds)
          : { data: [] },
      ]);

      let profileMap: Record<string, ProfileInfo> = {};
      (profilesRes.data || []).forEach(p => { profileMap[p.id] = p as ProfileInfo; });

      let authProfileMap: Record<string, ProfileInfo> = {};
      (authProfilesRes.data || []).forEach((p: any) => {
        if (p.user_id) authProfileMap[p.user_id] = { id: p.id, nome: p.nome, avatar_url: p.avatar_url, avatar_gamificado_url: p.avatar_gamificado_url };
      });

      let profileIdToAuthId: Record<string, string> = {};
      (profileIdMapRes.data || []).forEach((p: any) => { if (p.user_id) profileIdToAuthId[p.id] = p.user_id; });

      let comissaoMap: Record<string, number> = {};
      ((comissoesRes as any).data || []).forEach((c: any) => {
        comissaoMap[`${c.negocio_id}:${c.user_id}`] = Number(c.valor || 0);
      });

      // Origens
      let origemMap: Record<string, { origem: string | null; origem_detalhe: string | null; empreendimento_lead: string | null; created_at_lead: string | null }> = {};
      const pipelineLeadIds = rows.map(v => v.pipeline_lead_id).filter(Boolean) as string[];
      if (pipelineLeadIds.length > 0) {
        const { data: plData } = await supabase
          .from("pipeline_leads").select("id, origem, origem_detalhe, empreendimento, created_at").in("id", pipelineLeadIds);
        (plData || []).forEach((pl: any) => {
          origemMap[pl.id] = { origem: pl.origem, origem_detalhe: pl.origem_detalhe, empreendimento_lead: pl.empreendimento, created_at_lead: pl.created_at };
        });
      }

      return { vendas: rows, profiles: profileMap, authProfiles: authProfileMap, parceriaSet: [...parceriaSet], parceriaPartners, origemMap, profileIdToAuthId, comissaoMap };
    },
  });

  const vendas = data?.vendas || [];
  const profiles = data?.profiles || {};
  const authProfiles = data?.authProfiles || {};
  const parceriaLeadIds = new Set(data?.parceriaSet || []);
  const parceriaPartners = data?.parceriaPartners || {};
  const origemMap = data?.origemMap || {};
  const profileIdToAuthId = data?.profileIdToAuthId || {};
  const comissaoMap = data?.comissaoMap || {};

  // ═══ Resolução dinâmica de nomes de formulário/campanha Meta ═══
  // Coleta origem_detalhe que são IDs numéricos ainda não resolvidos pelo mapa estático.
  const unresolvedFormIds = useMemo(() => {
    const ids = new Set<string>();
    Object.values(origemMap).forEach((info) => {
      const raw = info?.origem_detalhe ? String(info.origem_detalhe).trim() : "";
      if (!raw) return;
      // Se resolveFormName devolver o genérico "Formulário Meta", o ID não está mapeado.
      if (/^\d{6,}$/.test(raw) && resolveFormName(raw) === "Formulário Meta") ids.add(raw);
    });
    return [...ids];
  }, [origemMap]);

  const { data: dynamicFormNames } = useQuery({
    queryKey: ["meta-form-names", unresolvedFormIds.sort().join(",")],
    enabled: unresolvedFormIds.length > 0,
    staleTime: 1000 * 60 * 60,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("resolve-meta-forms", {
        body: { ids: unresolvedFormIds },
      });
      if (error) {
        console.warn("[VendasRealizadas] resolve-meta-forms falhou:", error.message);
        return {} as Record<string, string | null>;
      }
      return (data?.names || {}) as Record<string, string | null>;
    },
  });

  // Resolve o nome de exibição da campanha: mapa estático → cache/Meta → ID cru.
  const resolveDetalhe = useMemo(() => {
    const dyn = dynamicFormNames || {};
    return (raw: string | null | undefined): string | null => {
      if (!raw) return null;
      const trimmed = String(raw).trim();
      if (!trimmed) return null;
      const staticName = resolveFormName(trimmed);
      if (staticName && staticName !== "Formulário Meta") return staticName;
      const dynName = dyn[trimmed];
      if (dynName) return dynName;
      // Sem nome real conhecido: mostra o ID cru para rastreio manual na Meta.
      if (/^\d{6,}$/.test(trimmed)) return `Meta #${trimmed}`;
      return staticName || trimmed;
    };
  }, [dynamicFormNames]);

  // ═══ Metas ═══
  const { data: metaPessoal } = useQuery({
    queryKey: ["meta-pessoal", user?.id, mesStr],
    enabled: !!user && periodMode === "mes",
    queryFn: async () => {
      const { data } = await supabase.from("corretor_metas_mensais").select("meta_vgv").eq("user_id", user!.id).eq("mes", mesStr).maybeSingle();
      return Number(data?.meta_vgv || 0);
    },
  });

  const { data: metaEquipe } = useQuery({
    queryKey: ["meta-equipe", user?.id, mesStr],
    enabled: !!user && isGestor && !isAdmin && periodMode === "mes",
    queryFn: async () => {
      const { data } = await supabase.from("ceo_metas_mensais").select("meta_vgv_assinado").eq("gerente_id", user!.id).eq("mes", mesStr).maybeSingle();
      return Number(data?.meta_vgv_assinado || 0);
    },
  });

  const { data: metaEmpresa } = useQuery({
    queryKey: ["meta-empresa", mesStr],
    enabled: !!user && periodMode === "mes",
    queryFn: async () => {
      const { data } = await supabase.from("empresa_metas_mensais").select("meta_vgv").eq("mes", mesStr).maybeSingle();
      return Number(data?.meta_vgv || 0);
    },
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return vendas;
    const s = search.toLowerCase();
    return vendas.filter(v =>
      v.nome_cliente?.toLowerCase().includes(s) ||
      v.empreendimento?.toLowerCase().includes(s) ||
      (v.corretor_id && profiles[v.corretor_id]?.nome?.toLowerCase().includes(s))
    );
  }, [vendas, search, profiles]);

  const totalVGV = filtered.reduce((s, v) => s + (v.vgv_final || v.vgv_estimado || 0), 0);
  const totalVendas = filtered.length;
  const ticketMedio = totalVendas > 0 ? totalVGV / totalVendas : 0;

  // Dono (auth id) de cada venda
  const ownerAuthId = (v: VendaRow): string | null => (v.corretor_id ? profileIdToAuthId[v.corretor_id] || null : null);

  // Faturamento (soma das comissões visíveis no período)
  const faturamento = useMemo(() => {
    let total = 0;
    filtered.forEach(v => {
      Object.keys(comissaoMap).forEach(k => { if (k.startsWith(`${v.id}:`)) total += comissaoMap[k]; });
    });
    return total;
  }, [filtered, comissaoMap]);

  const pendentesComissao = useMemo(() => {
    return filtered.filter(v => {
      const oid = ownerAuthId(v);
      if (!oid) return false;
      return !(comissaoMap[`${v.id}:${oid}`] > 0);
    }).length;
  }, [filtered, comissaoMap, profileIdToAuthId]);

  async function saveComissao(negocioId: string, valor: number) {
    if (!user) return;
    const { error } = await supabase.from("venda_comissoes")
      .upsert({ negocio_id: negocioId, user_id: user.id, valor }, { onConflict: "negocio_id,user_id" });
    if (error) { toast.error("Erro ao salvar comissão"); return; }
    toast.success("Comissão salva");
    qc.invalidateQueries({ queryKey: ["vendas-realizadas"] });
  }

  async function saveMetaPessoal(valor: number) {
    if (!user) return;
    const { error } = await supabase.from("corretor_metas_mensais")
      .upsert({ user_id: user.id, mes: mesStr, meta_vgv: valor }, { onConflict: "user_id,mes" });
    if (error) { toast.error("Erro ao salvar meta"); return; }
    toast.success("Meta salva");
    qc.invalidateQueries({ queryKey: ["meta-pessoal"] });
  }

  async function saveMetaEquipe(valor: number) {
    if (!user) return;
    const { error } = await supabase.from("ceo_metas_mensais")
      .upsert({ gerente_id: user.id, mes: mesStr, meta_vgv_assinado: valor }, { onConflict: "gerente_id,mes" });
    if (error) { toast.error("Erro ao salvar meta da equipe"); return; }
    toast.success("Meta da equipe salva");
    qc.invalidateQueries({ queryKey: ["meta-equipe"] });
  }

  async function saveMetaEmpresa(valor: number) {
    const { error } = await supabase.from("empresa_metas_mensais")
      .upsert({ mes: mesStr, meta_vgv: valor }, { onConflict: "mes" });
    if (error) { toast.error("Erro ao salvar meta da empresa"); return; }
    toast.success("Meta da empresa salva");
    qc.invalidateQueries({ queryKey: ["meta-empresa"] });
  }

  // Ranking (split-aware) — inclui faturamento por vendedor
  const corretorRanking = useMemo(() => {
    const map: Record<string, { nome: string; avatar: string | null; vgv: number; count: number; comissao: number }> = {};
    const add = (authId: string, nome: string, avatar: string | null, vgv: number, comissao: number) => {
      if (!map[authId]) map[authId] = { nome: nome || "Corretor", avatar: avatar || null, vgv: 0, count: 0, comissao: 0 };
      map[authId].vgv += vgv; map[authId].count += 1; map[authId].comissao += comissao;
    };
    filtered.forEach(v => {
      const vgv = v.vgv_final || v.vgv_estimado || 0;
      const parceria = v.pipeline_lead_id ? parceriaPartners[v.pipeline_lead_id] : null;
      if (parceria && parceria.auth_user_ids.length >= 2) {
        const split = parceria.fator_split || 0.5;
        parceria.auth_user_ids.forEach(authId => {
          const p = authProfiles[authId];
          add(authId, p?.nome || "Corretor", p?.avatar_gamificado_url || p?.avatar_url || null, vgv * split, comissaoMap[`${v.id}:${authId}`] || 0);
        });
        return;
      }
      const cId = v.corretor_id;
      if (!cId) return;
      const p = profiles[cId];
      const authId = profileIdToAuthId[cId] || cId;
      add(authId, p?.nome || "Corretor", p?.avatar_gamificado_url || p?.avatar_url || null, vgv, comissaoMap[`${v.id}:${authId}`] || 0);
    });
    return Object.entries(map).sort((a, b) => b[1].vgv - a[1].vgv);
  }, [filtered, profiles, authProfiles, parceriaPartners, profileIdToAuthId, comissaoMap]);

  const medalEmojis = ["🥇", "🥈", "🥉"];

  // Origens analytics — agrupado por CAMPANHA específica (origem + formulário/detalhe)
  const origemAnalytics = useMemo(() => {
    const byCampanha: Record<string, { origem: string; campanha: string | null; count: number; vgv: number; empreendimentos: Set<string> }> = {};
    const detailRows: { cliente: string; empreendimento: string | null; vgv: number; origem: string; detalhe: string | null; dataAssinatura: string | null; dataEntrada: string | null; corretor: string }[] = [];
    filtered.forEach(v => {
      const plId = v.pipeline_lead_id;
      const info = plId ? origemMap[plId] : null;
      const origem = info?.origem || "Não identificado";
      const detalhe = resolveDetalhe(info?.origem_detalhe);
      const vgv = v.vgv_final || v.vgv_estimado || 0;
      const corr = v.corretor_id ? profiles[v.corretor_id] : null;
      const key = `${origem}||${detalhe || ""}`;
      if (!byCampanha[key]) byCampanha[key] = { origem, campanha: detalhe, count: 0, vgv: 0, empreendimentos: new Set() };
      byCampanha[key].count++; byCampanha[key].vgv += vgv;
      if (v.empreendimento) byCampanha[key].empreendimentos.add(v.empreendimento);
      detailRows.push({ cliente: v.nome_cliente, empreendimento: v.empreendimento, vgv, origem, detalhe, dataAssinatura: v.data_assinatura, dataEntrada: info?.created_at_lead || null, corretor: corr?.nome || "—" });
    });
    const sorted = Object.values(byCampanha)
      .map((d) => ({ ...d, empreendimentos: [...d.empreendimentos] }))
      .sort((a, b) => b.vgv - a.vgv);
    return { breakdown: sorted, details: detailRows, totalVGV };
  }, [filtered, origemMap, profiles, totalVGV, resolveDetalhe]);


  if (isLoading) {
    return <div className="flex items-center justify-center min-h-[400px]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  // Config do bloco de meta conforme papel
  const metaConfig = isAdmin
    ? { titulo: "Meta da empresa", meta: metaEmpresa || 0, editable: true, onSave: saveMetaEmpresa, label: "Faturamento (comissões)" }
    : isGestor
      ? { titulo: "Meta da equipe", meta: metaEquipe || 0, editable: true, onSave: saveMetaEquipe, label: "Faturamento do time" }
      : { titulo: "Minha meta do mês", meta: metaPessoal || 0, editable: true, onSave: saveMetaPessoal, label: "Meu faturamento" };

  const KPIS = [
    { label: "Vendas", value: String(totalVendas), color: "text-[#6366f1]", border: "border-l-[#6366f1]" },
    { label: "VGV total", value: formatCurrency(totalVGV), color: "text-success-500", border: "border-l-success-500" },
    { label: "Ticket médio", value: formatCurrency(ticketMedio), color: "text-primary", border: "border-l-primary" },
    { label: metaConfig.label, value: fmtMoney(faturamento, "short"), color: "text-amber-500", border: "border-l-amber-500" },
  ];

  return (
    <div className="bg-background p-4 sm:p-6 -m-6 min-h-full space-y-4">
      {/* ═══════ HEADER ═══════ */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="w-7 h-7 rounded-[7px] bg-primary flex items-center justify-center shrink-0">
          <TrendingUp size={13} strokeWidth={1.5} className="text-white" />
        </div>
        <div className="min-w-0">
          <h1 className="text-[16px] font-bold tracking-[-0.3px] text-foreground leading-none">Vendas realizadas</h1>
          <p className="text-[11px] text-muted-foreground mt-0.5">{dateRange.label}</p>
        </div>

        <div className="flex-1" />

        {/* Mês / Ano */}
        <div className="flex items-center gap-0.5 bg-white dark:bg-white/5 border border-border dark:border-white/10 rounded-[8px] p-0.5 shrink-0">
          {(["mes", "ano"] as const).map(mode => (
            <button key={mode} onClick={() => setPeriodMode(mode)}
              className={cn("text-[11px] font-medium px-3 py-1 rounded-[6px] transition-all",
                periodMode === mode ? "bg-primary text-white" : "text-neutral-500 hover:text-foreground dark:hover:text-white")}>
              {mode === "mes" ? "Mês" : "Ano"}
            </button>
          ))}
        </div>

        {periodMode === "mes" && (
          <Popover open={showMonthPicker} onOpenChange={setShowMonthPicker}>
            <PopoverTrigger asChild>
              <button className="h-[32px] px-3 bg-white dark:bg-white/5 border border-border dark:border-white/10 rounded-[8px] text-[12px] font-medium text-foreground flex items-center gap-1.5 shrink-0">
                <CalendarDays size={13} /> {MESES[selectedMonth]} <ChevronDown size={12} />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-2" align="end">
              <div className="grid grid-cols-3 gap-1">
                {MESES.map((mes, i) => (
                  <button key={mes} onClick={() => { setSelectedMonth(i); setShowMonthPicker(false); }}
                    className={cn("text-xs py-2 px-1 rounded-lg font-medium transition-all",
                      selectedMonth === i ? "bg-primary text-white" : "hover:bg-muted text-foreground",
                      i > new Date().getMonth() && selectedYear >= new Date().getFullYear() ? "opacity-40 pointer-events-none" : "")}>
                    {mes.slice(0, 3)}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>

      {/* ═══════ KPIs ═══════ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {KPIS.map(kpi => (
          <div key={kpi.label} className={cn("bg-card border border-border border-l-[3px] rounded-[10px] p-3", kpi.border)}>
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide truncate">{kpi.label}</p>
            <p className={cn("text-[22px] font-[800] leading-none mt-1 tracking-[-0.5px]", kpi.color)}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* ═══════ META MENSAL (só no modo mês) ═══════ */}
      {periodMode === "mes" && (
        <MetaBlock
          titulo={metaConfig.titulo}
          meta={metaConfig.meta}
          atingido={totalVGV}
          editable={metaConfig.editable}
          onSave={metaConfig.onSave}
          faturamento={faturamento}
          faturamentoLabel={metaConfig.label}
        />
      )}

      {/* ═══════ TABS ═══════ */}
      <div className="flex items-center gap-1">
        <button onClick={() => setActiveTab("vendas")}
          className={cn("text-[12px] font-medium px-3 py-1.5 rounded-[8px] transition-all flex items-center gap-1.5",
            activeTab === "vendas" ? "bg-primary text-white" : "text-neutral-500 bg-white dark:bg-white/5 border border-border dark:border-white/10 hover:text-foreground")}>
          <Trophy size={13} /> Vendas
        </button>
        {(isAdmin || isGestor) && (
          <button onClick={() => setActiveTab("origens")}
            className={cn("text-[12px] font-medium px-3 py-1.5 rounded-[8px] transition-all flex items-center gap-1.5",
              activeTab === "origens" ? "bg-primary text-white" : "text-neutral-500 bg-white dark:bg-white/5 border border-border dark:border-white/10 hover:text-foreground")}>
            <Megaphone size={13} /> Origens & Campanhas
          </button>
        )}
      </div>

      {activeTab === "vendas" && (
        <div className="space-y-4">
          {/* RANKING */}
          {(isAdmin || isGestor) && corretorRanking.length > 1 && (
            <div className="bg-card border border-border rounded-[12px] p-4">
              <div className="flex items-center gap-2 mb-3">
                <Crown size={15} className="text-amber-500" />
                <h2 className="text-[13px] font-bold text-foreground">Ranking de vendedores</h2>
              </div>
              <div className="space-y-1.5">
                {corretorRanking.map(([id, r], i) => (
                  <div key={id} className="flex items-center gap-3 p-2.5 rounded-[10px] bg-accent/30 border border-border/40">
                    <span className="text-base w-6 text-center shrink-0">{medalEmojis[i] || `${i + 1}º`}</span>
                    {r.avatar ? (
                      <img src={r.avatar} alt={r.nome} className="h-8 w-8 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs shrink-0">{getInitials(r.nome)}</div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-foreground truncate">{r.nome}</p>
                      <p className="text-[10px] text-muted-foreground">{r.count} venda{r.count > 1 ? "s" : ""}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[13px] font-black text-emerald-500">{formatVgvExact(r.vgv)}</p>
                      {r.comissao > 0 && <p className="text-[10px] font-bold text-primary">💰 {fmtMoney(r.comissao, "short")}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* LISTA */}
          <div className="bg-card border border-border rounded-[12px] p-4">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <h2 className="text-[13px] font-bold text-foreground flex items-center gap-1.5">📋 Lista de vendas</h2>
                <Badge variant="outline" className="text-[10px]">{filtered.length}</Badge>
                {pendentesComissao > 0 && (
                  <span className="text-[10px] text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full font-medium">
                    {pendentesComissao} sem comissão
                  </span>
                )}
              </div>
              <div className="relative w-full max-w-[260px]">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input placeholder="Buscar cliente, empreend..." value={search} onChange={e => setSearch(e.target.value)}
                  className="text-[12px] pl-8 pr-3 h-[32px] w-full bg-white dark:bg-white/5 border border-border dark:border-white/10 rounded-[8px] focus:border-primary transition-all outline-none text-foreground placeholder:text-muted-foreground" />
              </div>
            </div>

            {filtered.length === 0 ? (
              <div className="text-center py-12">
                <span className="text-4xl mb-3 block">🎯</span>
                <p className="text-muted-foreground text-sm font-medium">Nenhuma venda no período</p>
                <p className="text-[11px] text-muted-foreground mt-1">Continue focando que a próxima vem! 💪</p>
              </div>
            ) : (
              <>
                {/* ─── Desktop table ─── */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/40">
                        <th className="text-left py-2.5 px-3 text-[10px] text-muted-foreground font-medium">Cliente</th>
                        <th className="text-left py-2.5 px-3 text-[10px] text-muted-foreground font-medium">Empreendimento</th>
                        {(isAdmin || isGestor) && <th className="text-left py-2.5 px-3 text-[10px] text-muted-foreground font-medium">Corretor</th>}
                        <th className="text-right py-2.5 px-3 text-[10px] text-muted-foreground font-medium">VGV</th>
                        <th className="text-center py-2.5 px-3 text-[10px] text-muted-foreground font-medium">Data</th>
                        <th className="text-right py-2.5 px-3 text-[10px] text-muted-foreground font-medium">Comissão</th>
                      </tr>
                    </thead>
                    <tbody>
                      <AnimatePresence>
                        {filtered.map((v, i) => {
                          const vgv = v.vgv_final || v.vgv_estimado || 0;
                          const corr = v.corretor_id ? profiles[v.corretor_id] : null;
                          const oid = ownerAuthId(v);
                          const editable = !!oid && oid === user?.id;
                          const comissaoVal = oid ? (comissaoMap[`${v.id}:${oid}`] ?? null) : null;
                          return (
                            <motion.tr key={v.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.02 * i }}
                              className="border-b border-border/20 hover:bg-accent/40 transition-colors">
                              <td className="py-3 px-3">
                                <div className="flex items-center gap-2">
                                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500 shrink-0"><CheckCircle className="h-3.5 w-3.5" /></div>
                                  <div>
                                    <p className="text-[13px] font-semibold text-foreground">{v.nome_cliente}</p>
                                    {v.unidade && <p className="text-[10px] text-muted-foreground">Un. {v.unidade}</p>}
                                  </div>
                                </div>
                              </td>
                              <td className="py-3 px-3">
                                <div className="flex items-center gap-1.5">
                                  <Building2 className="h-3 w-3 text-muted-foreground" />
                                  <span className="text-xs text-foreground">{v.empreendimento || "—"}</span>
                                </div>
                              </td>
                              {(isAdmin || isGestor) && (
                                <td className="py-3 px-3">
                                  {(() => {
                                    const parceria = v.pipeline_lead_id ? parceriaPartners[v.pipeline_lead_id] : null;
                                    if (parceria && parceria.auth_user_ids.length >= 2) {
                                      const p1 = authProfiles[parceria.auth_user_ids[0]];
                                      const p2 = authProfiles[parceria.auth_user_ids[1]];
                                      return (
                                        <div className="flex items-center gap-1">
                                          <div className="flex -space-x-1.5">
                                            {[p1, p2].map((p, idx) => p && (
                                              <Avatar key={idx} className="h-5 w-5 border border-background">
                                                {(p.avatar_gamificado_url || p.avatar_url) && <img src={p.avatar_gamificado_url || p.avatar_url!} className="h-5 w-5 rounded-full object-cover" />}
                                                <AvatarFallback className="text-[7px] bg-primary/10 text-primary">{getInitials(p.nome)}</AvatarFallback>
                                              </Avatar>
                                            ))}
                                          </div>
                                          <span className="text-xs text-foreground">{p1?.nome?.split(" ")[0]} ↔ {p2?.nome?.split(" ")[0]}</span>
                                        </div>
                                      );
                                    }
                                    return corr ? (
                                      <div className="flex items-center gap-1.5">
                                        <Avatar className="h-5 w-5">
                                          {(corr.avatar_gamificado_url || corr.avatar_url) && <img src={corr.avatar_gamificado_url || corr.avatar_url!} className="h-5 w-5 rounded-full object-cover" />}
                                          <AvatarFallback className="text-[8px] bg-primary/10 text-primary">{getInitials(corr.nome)}</AvatarFallback>
                                        </Avatar>
                                        <span className="text-xs text-foreground">{corr.nome.split(" ")[0]}</span>
                                      </div>
                                    ) : <span className="text-xs text-muted-foreground italic">—</span>;
                                  })()}
                                </td>
                              )}
                              <td className="py-3 px-3 text-right">
                                <span className="text-[13px] font-black text-emerald-500">{formatVgvExact(vgv)}</span>
                                {v.pipeline_lead_id && parceriaLeadIds.has(v.pipeline_lead_id) && (() => {
                                  const splitPct = parceriaPartners[v.pipeline_lead_id!]?.fator_split;
                                  return <p className="text-[9px] font-bold text-violet-500 mt-0.5">🤝 Parceria {splitPct ? `${Math.round(splitPct * 100)}%` : "50%"}</p>;
                                })()}
                              </td>
                              <td className="py-3 px-3 text-center">
                                <span className="text-xs text-muted-foreground">{v.data_assinatura ? format(new Date(v.data_assinatura + "T12:00:00"), "dd/MM/yy") : "—"}</span>
                              </td>
                              <td className="py-3 px-3 text-right">
                                <ComissaoCell value={comissaoVal} editable={editable} onSave={(val) => saveComissao(v.id, val)} />
                              </td>
                            </motion.tr>
                          );
                        })}
                      </AnimatePresence>
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-border/60">
                        <td colSpan={isAdmin || isGestor ? 3 : 2} className="py-3 px-3 text-[13px] font-bold text-foreground">Total — {filtered.length} venda{filtered.length !== 1 ? "s" : ""}</td>
                        <td className="py-3 px-3 text-right text-[13px] font-black text-emerald-500">{formatVgvExact(totalVGV)}</td>
                        <td></td>
                        <td className="py-3 px-3 text-right text-[12px] font-bold text-primary">{fmtMoney(faturamento, "exact", { decimals: 2 })}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* ─── Mobile cards ─── */}
                <div className="md:hidden space-y-2">
                  {filtered.map((v) => {
                    const vgv = v.vgv_final || v.vgv_estimado || 0;
                    const corr = v.corretor_id ? profiles[v.corretor_id] : null;
                    const oid = ownerAuthId(v);
                    const editable = !!oid && oid === user?.id;
                    const comissaoVal = oid ? (comissaoMap[`${v.id}:${oid}`] ?? null) : null;
                    return (
                      <div key={v.id} className="rounded-[10px] border border-border bg-accent/20 p-3">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500 shrink-0"><CheckCircle className="h-3 w-3" /></div>
                            <div className="min-w-0">
                              <p className="text-[13px] font-semibold text-foreground truncate">{v.nome_cliente}</p>
                              <p className="text-[10px] text-muted-foreground truncate">{v.empreendimento || "—"}{v.unidade ? ` · Un. ${v.unidade}` : ""}</p>
                            </div>
                          </div>
                          <span className="text-[13px] font-black text-emerald-500 shrink-0">{formatVgvExact(vgv)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/40">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {(isAdmin || isGestor) && corr && <span className="text-[11px] text-muted-foreground truncate">{corr.nome.split(" ")[0]}</span>}
                            <span className="text-[10px] text-muted-foreground">{v.data_assinatura ? format(new Date(v.data_assinatura + "T12:00:00"), "dd/MM/yy") : "—"}</span>
                          </div>
                          <ComissaoCell value={comissaoVal} editable={editable} onSave={(val) => saveComissao(v.id, val)} compact />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Rodapé motivacional */}
          {totalVendas > 0 && (
            <div className="rounded-[14px] p-5 text-center bg-gradient-to-br from-emerald-500/5 via-amber-500/5 to-blue-500/5 border border-border/40">
              <p className="text-3xl mb-2">🎉</p>
              <p className="text-lg font-black text-foreground">{totalVendas === 1 ? "1 venda realizada!" : `${totalVendas} vendas realizadas!`}</p>
              <p className="text-sm text-muted-foreground mt-1">VGV acumulado de <span className="font-bold text-emerald-500">{formatCurrency(totalVGV)}</span> — continue assim! 🚀</p>
            </div>
          )}
        </div>
      )}

      {/* ═══════ ORIGENS & CAMPANHAS ═══════ */}
      {activeTab === "origens" && (isAdmin || isGestor) && (
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-[12px] p-4">
            <div className="flex items-center gap-2 mb-4">
              <Megaphone size={15} className="text-primary" />
              <h2 className="text-[13px] font-bold text-foreground">Performance por origem</h2>
              <Badge variant="outline" className="text-[10px] ml-auto">{origemAnalytics.breakdown.length} origens</Badge>
            </div>
            {origemAnalytics.breakdown.length === 0 ? (
              <div className="text-center py-8"><p className="text-muted-foreground text-sm">Nenhuma venda com origem rastreada no período</p></div>
            ) : (
              <div className="space-y-3">
                {origemAnalytics.breakdown.map((item, i) => {
                  const pct = origemAnalytics.totalVGV > 0 ? (item.vgv / origemAnalytics.totalVGV) * 100 : 0;
                  const barColors = ["bg-primary", "bg-emerald-500", "bg-blue-500", "bg-amber-500", "bg-violet-500", "bg-rose-500"];
                  const barColor = barColors[i % barColors.length];
                  return (
                    <div key={`${item.origem}-${item.campanha ?? "sem"}-${i}`} className="rounded-[10px] border border-border/40 p-3.5 bg-accent/20">
                      <div className="flex items-center justify-between mb-2 flex-wrap gap-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={cn("h-3 w-3 rounded-full shrink-0", barColor)} />
                          <div className="flex flex-col min-w-0">
                            <span className="text-[13px] font-bold text-foreground truncate">{item.campanha || item.origem}</span>
                            {item.campanha && <span className="text-[10px] text-muted-foreground truncate">{item.origem}</span>}
                          </div>
                          <Badge variant="secondary" className="text-[9px] h-4 shrink-0">{item.count} venda{item.count > 1 ? "s" : ""}</Badge>
                        </div>
                        <div className="text-right">
                          <span className="text-[13px] font-black text-emerald-500">{formatVgvExact(item.vgv)}</span>
                          <span className="text-[10px] text-muted-foreground ml-1.5">({pct.toFixed(1)}%)</span>
                        </div>
                      </div>
                      <div className="h-2 rounded-full bg-muted/50 overflow-hidden mb-2">
                        <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6 }} className={cn("h-full rounded-full", barColor)} />
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {item.empreendimentos.slice(0, 5).map(emp => <span key={emp} className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">🏢 {emp}</span>)}
                        {item.empreendimentos.length > 5 && <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">+{item.empreendimentos.length - 5}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="bg-card border border-border rounded-[12px] p-4">
            <div className="flex items-center gap-2 mb-4">
              <Target size={15} className="text-primary" />
              <h2 className="text-[13px] font-bold text-foreground">Rastreio completo — Lead → Venda</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/40">
                    <th className="text-left py-2.5 px-3 text-[10px] text-muted-foreground font-medium">Cliente</th>
                    <th className="text-left py-2.5 px-3 text-[10px] text-muted-foreground font-medium">Empreendimento</th>
                    <th className="text-left py-2.5 px-3 text-[10px] text-muted-foreground font-medium">Origem</th>
                    <th className="text-left py-2.5 px-3 text-[10px] text-muted-foreground font-medium">Detalhe</th>
                    <th className="text-left py-2.5 px-3 text-[10px] text-muted-foreground font-medium">Corretor</th>
                    <th className="text-center py-2.5 px-3 text-[10px] text-muted-foreground font-medium">Entrada</th>
                    <th className="text-center py-2.5 px-3 text-[10px] text-muted-foreground font-medium">Assinatura</th>
                    <th className="text-right py-2.5 px-3 text-[10px] text-muted-foreground font-medium">VGV</th>
                  </tr>
                </thead>
                <tbody>
                  {origemAnalytics.details.map((row, i) => (
                    <tr key={i} className="border-b border-border/20 hover:bg-accent/40 transition-colors">
                      <td className="py-2.5 px-3 text-xs font-semibold text-foreground">{row.cliente}</td>
                      <td className="py-2.5 px-3 text-xs text-foreground">{row.empreendimento || "—"}</td>
                      <td className="py-2.5 px-3"><Badge variant="secondary" className="text-[10px]">{row.origem}</Badge></td>
                      <td className="py-2.5 px-3 text-xs text-muted-foreground">{row.detalhe || "—"}</td>
                      <td className="py-2.5 px-3 text-xs text-foreground">{row.corretor}</td>
                      <td className="py-2.5 px-3 text-center text-[10px] text-muted-foreground">{row.dataEntrada ? format(new Date(row.dataEntrada), "dd/MM/yy") : "—"}</td>
                      <td className="py-2.5 px-3 text-center text-[10px] text-muted-foreground">{row.dataAssinatura ? format(new Date(row.dataAssinatura + "T12:00:00"), "dd/MM/yy") : "—"}</td>
                      <td className="py-2.5 px-3 text-right text-xs font-black text-emerald-500">{formatVgvExact(row.vgv)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
