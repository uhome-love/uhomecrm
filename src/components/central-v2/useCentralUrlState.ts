import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { DEFAULT_SECTION, isCentralSection, type CentralSectionId } from "./sections";

export type CentralPeriodo = "hoje" | "semana" | "mes" | "trimestre" | "custom";

const PERIODOS: CentralPeriodo[] = ["hoje", "semana", "mes", "trimestre", "custom"];

function isPeriodo(v: string | null | undefined): v is CentralPeriodo {
  return !!v && PERIODOS.includes(v as CentralPeriodo);
}

export interface CentralUrlState {
  secao: CentralSectionId;
  periodo: CentralPeriodo;
  de?: string;
  ate?: string;
  equipe?: string;
  corretor?: string;
}

export function useCentralUrlState() {
  const [params, setParams] = useSearchParams();

  const state = useMemo<CentralUrlState>(() => {
    const rawSecao = params.get("secao");
    const rawPeriodo = params.get("periodo");
    return {
      secao: isCentralSection(rawSecao) ? rawSecao : DEFAULT_SECTION,
      periodo: isPeriodo(rawPeriodo) ? rawPeriodo : "mes",
      de: params.get("de") ?? undefined,
      ate: params.get("ate") ?? undefined,
      equipe: params.get("equipe") ?? undefined,
      corretor: params.get("corretor") ?? undefined,
    };
  }, [params]);

  const update = useCallback(
    (patch: Partial<CentralUrlState>) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          (Object.keys(patch) as Array<keyof CentralUrlState>).forEach((k) => {
            const v = patch[k];
            if (v === undefined || v === null || v === "") next.delete(k);
            else next.set(k, String(v));
          });
          return next;
        },
        { replace: true }
      );
    },
    [setParams]
  );

  return { state, update, params, setParams };
}
