/**
 * useMetasSSOT — metas do mês (VGV, visitas realizadas, leads, negócios) + pace de dias úteis.
 *
 * Fonte:
 *   ceo_metas_mensais     → meta por gerente/equipe (mes = 'YYYY-MM')
 *   empresa_metas_mensais → fallback de VGV global quando não há metas por equipe
 *   feriados              → descontados do cálculo de dias úteis (BRT)
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { endOfMonth, startOfMonth, format, isAfter, isBefore, isSameDay } from "date-fns";

export interface MetasMes {
  meta_vgv: number;
  meta_visitas_realizadas: number;
  meta_leads: number;
  meta_vendas: number;
  fonte: "equipe" | "soma_equipes" | "empresa" | "nenhuma";
}

const ZERO: MetasMes = {
  meta_vgv: 0,
  meta_visitas_realizadas: 0,
  meta_leads: 0,
  meta_vendas: 0,
  fonte: "nenhuma",
};

export function useMetasSSOT(referencia: Date, gerenteId?: string | null) {
  const mes = format(startOfMonth(referencia), "yyyy-MM");

  return useQuery({
    queryKey: ["metas-ssot", mes, gerenteId ?? null],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<MetasMes> => {
      let q = supabase
        .from("ceo_metas_mensais")
        .select("gerente_id, meta_vgv_assinado, meta_visitas_realizadas, meta_leads, meta_negocios")
        .eq("mes", mes);
      if (gerenteId) q = q.eq("gerente_id", gerenteId);

      const { data } = await q;
      const linhas = data ?? [];

      if (linhas.length > 0) {
        const soma = linhas.reduce(
          (acc, l) => ({
            meta_vgv: acc.meta_vgv + Number(l.meta_vgv_assinado || 0),
            meta_visitas_realizadas: acc.meta_visitas_realizadas + Number(l.meta_visitas_realizadas || 0),
            meta_leads: acc.meta_leads + Number(l.meta_leads || 0),
            meta_vendas: acc.meta_vendas + Number(l.meta_negocios || 0),
          }),
          { meta_vgv: 0, meta_visitas_realizadas: 0, meta_leads: 0, meta_vendas: 0 }
        );
        return { ...soma, fonte: gerenteId ? "equipe" : "soma_equipes" };
      }

      if (!gerenteId) {
        const { data: emp } = await supabase
          .from("empresa_metas_mensais")
          .select("meta_vgv")
          .eq("mes", mes)
          .maybeSingle();
        if (emp?.meta_vgv) return { ...ZERO, meta_vgv: Number(emp.meta_vgv), fonte: "empresa" };
      }

      return ZERO;
    },
  });
}

export interface PaceMes {
  /** 0-1 — fração de dias úteis já decorridos (mês passado = 1) */
  fracao: number;
  uteisDecorridos: number;
  uteisTotal: number;
  mesCorrente: boolean;
}

/** Dias úteis do mês (seg–sex, descontando feriados cadastrados) + quanto já passou em BRT. */
export function usePaceMes(referencia: Date) {
  const inicio = startOfMonth(referencia);
  const fim = endOfMonth(referencia);
  const chave = format(inicio, "yyyy-MM");

  return useQuery({
    queryKey: ["pace-mes", chave],
    staleTime: 30 * 60_000,
    queryFn: async (): Promise<PaceMes> => {
      const { data } = await supabase
        .from("feriados")
        .select("data")
        .gte("data", format(inicio, "yyyy-MM-dd"))
        .lte("data", format(fim, "yyyy-MM-dd"));
      const feriados = new Set((data ?? []).map((f) => String(f.data)));

      // "hoje" em BRT
      const hojeBrt = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
      const mesCorrente = hojeBrt >= inicio && hojeBrt <= fim;

      let total = 0;
      let decorridos = 0;
      for (let d = new Date(inicio); !isAfter(d, fim); d.setDate(d.getDate() + 1)) {
        const dow = d.getDay();
        const iso = format(d, "yyyy-MM-dd");
        if (dow === 0 || dow === 6 || feriados.has(iso)) continue;
        total++;
        if (!mesCorrente ? isBefore(d, hojeBrt) : isBefore(d, hojeBrt) || isSameDay(d, hojeBrt)) decorridos++;
      }

      const uteisDecorridos = mesCorrente ? Math.min(decorridos, total) : total;
      return {
        fracao: total > 0 ? uteisDecorridos / total : 1,
        uteisDecorridos,
        uteisTotal: total,
        mesCorrente,
      };
    },
  });
}
