import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTypesenseSearch } from "@/hooks/useTypesenseSearch";

export interface AISearchTag {
  key: string;
  label: string;
  category: string;
}

export interface AISearchResult {
  filters: any;
  filter_by: string;
  text_query: string;
  explicacao: string;
  sugestao_alternativa: string | null;
  perfil: string | null;
  tags: AISearchTag[];
}

export interface AIPropertyResult {
  item: any;
  score: number; // 0-100 compatibility score
}

export function useAISearch() {
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<AISearchResult | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiProperties, setAiProperties] = useState<AIPropertyResult[]>([]);
  const [aiTotal, setAiTotal] = useState(0);
  const [aiSearchTime, setAiSearchTime] = useState<number | null>(null);
  const { search: typesenseSearch } = useTypesenseSearch();

  const abortRef = useRef<AbortController | null>(null);

  /**
   * Calculate compatibility score for each property based on AI filters
   */
  const calculateScore = useCallback((item: any, filters: any): number => {
    let score = 50; // base score
    let totalFactors = 0;
    let matchedFactors = 0;

    // Tipo match
    if (filters.tipos?.length) {
      totalFactors++;
      const itemTipo = (item.tipo || "").toLowerCase();
      if (filters.tipos.some((t: string) => itemTipo.includes(t))) {
        matchedFactors++;
        score += 10;
      }
    }

    // Bairro match
    if (filters.bairros?.length) {
      totalFactors++;
      const itemBairro = (item.bairro || "").toLowerCase();
      if (filters.bairros.some((b: string) => b.toLowerCase() === itemBairro)) {
        matchedFactors++;
        score += 15;
      } else {
        score -= 5;
      }
    }

    // Dormitorios match
    if (filters.dormitorios?.length) {
      totalFactors++;
      const dorms = Number(item.dormitorios);
      if (filters.dormitorios.includes(String(dorms))) {
        matchedFactors++;
        score += 10;
      } else if (filters.dormitorios.some((d: string) => Math.abs(dorms - Number(d)) <= 1)) {
        matchedFactors += 0.5;
        score += 5;
      }
    }

    // Valor match
    if (filters.valor_max) {
      totalFactors++;
      const valor = Number(item.valor_venda) || 0;
      if (valor > 0 && valor <= filters.valor_max) {
        matchedFactors++;
        // Bonus for being well within budget
        const ratio = valor / filters.valor_max;
        if (ratio >= 0.6 && ratio <= 0.95) score += 8;
        else score += 4;
      } else if (valor > filters.valor_max) {
        const overshoot = (valor - filters.valor_max) / filters.valor_max;
        if (overshoot <= 0.15) score += 2; // slightly over budget
        else score -= 10;
      }
    }

    if (filters.valor_min) {
      totalFactors++;
      const valor = Number(item.valor_venda) || 0;
      if (valor >= filters.valor_min) {
        matchedFactors++;
        score += 3;
      }
    }

    // Suites
    if (filters.suites_min) {
      totalFactors++;
      const suites = Number(item.suites) || 0;
      if (suites >= filters.suites_min) {
        matchedFactors++;
        score += 5;
      }
    }

    // Vagas
    if (filters.vagas_min) {
      totalFactors++;
      const vagas = Number(item.vagas) || 0;
      if (vagas >= filters.vagas_min) {
        matchedFactors++;
        score += 5;
      }
    }

    // Area
    if (filters.area_min) {
      totalFactors++;
      const area = Number(item.area_privativa) || 0;
      if (area >= filters.area_min) {
        matchedFactors++;
        score += 3;
      }
    }

    // Em obras
    if (filters.em_obras) {
      totalFactors++;
      const situacao = (item.situacao || "").toLowerCase();
      if (situacao.includes("obra") || situacao.includes("planta") || situacao.includes("lançamento")) {
        matchedFactors++;
        score += 5;
      }
    }

    // Normalize to 0-100
    if (totalFactors > 0) {
      const matchRatio = matchedFactors / totalFactors;
      score = Math.round(Math.min(99, Math.max(40, score + matchRatio * 20)));
    }

    return Math.min(99, Math.max(40, score));
  }, []);

  const searchWithAI = useCallback(async (query: string) => {
    if (!query || query.trim().length < 3) return;

    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setAiLoading(true);
    setAiError(null);
    setAiResult(null);
    setAiProperties([]);
    setAiTotal(0);
    setAiSearchTime(null);

    const startTime = Date.now();

    try {
      // Step 1: AI interprets the query
      const { data, error: fnErr } = await supabase.functions.invoke("ai-search-imoveis", {
        body: { query: query.trim() },
      });

      if (controller.signal.aborted) return;

      if (fnErr || data?.error) {
        const errorMsg = data?.error || fnErr?.message || "Erro na busca inteligente";
        setAiError(errorMsg);
        setAiLoading(false);
        return;
      }

      const aiData = data as AISearchResult;
      setAiResult(aiData);

      // Step 2: Search Typesense with AI-generated filters
      const result = await typesenseSearch({
        q: aiData.text_query || "*",
        page: 1,
        per_page: 48,
        filter_by: aiData.filter_by || undefined,
      });

      if (controller.signal.aborted) return;

      const elapsed = Date.now() - startTime;
      setAiSearchTime(elapsed);

      if (result && result.data.length > 0) {
        // Map and score results
        const scored = result.data.map((doc: any) => ({
          item: {
            ...doc,
            codigo: doc.codigo || doc.id,
            titulo_anuncio: doc.titulo,
            empreendimento_nome: doc.empreendimento,
            endereco_bairro: doc.bairro,
            endereco_cidade: doc.cidade,
            endereco_logradouro: doc.endereco,
            valor_venda: doc.valor_venda,
            valor_locacao: doc.valor_locacao,
            area_privativa: doc.area_privativa,
            garagens: doc.vagas,
            suites: doc.suites,
            banheiros: doc.banheiros,
            dormitorios: doc.dormitorios,
            valor_condominio: doc.valor_condominio,
            situacao: doc.situacao,
            latitude: doc.latitude,
            longitude: doc.longitude,
            _fotos_normalized: doc.fotos?.length ? doc.fotos : doc.foto_principal ? [doc.foto_principal] : [],
            _fotos_full: doc.fotos_full?.length ? doc.fotos_full : doc.fotos?.length ? doc.fotos : doc.foto_principal ? [doc.foto_principal] : [],
            imagens: (doc.fotos || []).map((url: string, i: number) => ({
              link_thumb: url,
              link: doc.fotos_full?.[i] || url,
              link_large: doc.fotos_full?.[i] || url,
            })),
          },
          score: calculateScore(doc, aiData.filters),
        }));

        // Sort by score descending
        scored.sort((a: AIPropertyResult, b: AIPropertyResult) => b.score - a.score);
        setAiProperties(scored);
        setAiTotal(result.total);
      } else {
        // No results — try relaxed search (remove some filters)
        const relaxedResult = await typesenseSearch({
          q: aiData.text_query || "*",
          page: 1,
          per_page: 24,
        });

        if (relaxedResult && relaxedResult.data.length > 0) {
          const scored = relaxedResult.data.map((doc: any) => ({
            item: {
              ...doc,
              codigo: doc.codigo || doc.id,
              titulo_anuncio: doc.titulo,
              empreendimento_nome: doc.empreendimento,
              endereco_bairro: doc.bairro,
              endereco_cidade: doc.cidade,
              endereco_logradouro: doc.endereco,
              valor_venda: doc.valor_venda,
              area_privativa: doc.area_privativa,
              garagens: doc.vagas,
              suites: doc.suites,
              dormitorios: doc.dormitorios,
              _fotos_normalized: doc.fotos?.length ? doc.fotos : doc.foto_principal ? [doc.foto_principal] : [],
              imagens: (doc.fotos || []).map((url: string) => ({ link_thumb: url, link: url })),
            },
            score: calculateScore(doc, aiData.filters),
          }));
          scored.sort((a: AIPropertyResult, b: AIPropertyResult) => b.score - a.score);
          setAiProperties(scored);
          setAiTotal(relaxedResult.total);
          // Update explicacao to note relaxed search
          setAiResult({
            ...aiData,
            explicacao: aiData.explicacao + " Não encontrei resultados exatos, mas trouxe alternativas próximas.",
          });
        } else {
          setAiProperties([]);
          setAiTotal(0);
        }
      }
    } catch (e: any) {
      if (e?.name === "AbortError" || controller?.signal?.aborted) return;
      console.error("AI search error:", e);
      setAiError("Erro na busca inteligente. Tente novamente.");
    } finally {
      if (!controller.signal.aborted) setAiLoading(false);
    }
  }, [typesenseSearch, calculateScore]);

  const clearAISearch = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
    setAiResult(null);
    setAiProperties([]);
    setAiError(null);
    setAiTotal(0);
    setAiSearchTime(null);
  }, []);

  const removeTag = useCallback((tagKey: string) => {
    setAiResult(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        tags: prev.tags.filter(t => t.key !== tagKey),
      };
    });
  }, []);

  return {
    searchWithAI,
    clearAISearch,
    removeTag,
    aiLoading,
    aiResult,
    aiError,
    aiProperties,
    aiTotal,
    aiSearchTime,
  };
}
