import { useEffect, useState } from "react";
import { EVENTO_EFEITOS, efeitosLigados, isNatal } from "./config";

function prefereMenosMovimento(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/** ativo = período de Natal; efeitos = ativo + usuário não desligou; movimento = efeitos + sem "reduzir movimento". */
export function useNatal() {
  const ativo = isNatal();
  const [ligado, setLigado] = useState(efeitosLigados);
  const [menosMovimento, setMenosMovimento] = useState(prefereMenosMovimento);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const atualizar = () => setMenosMovimento(media.matches);
    atualizar();
    media.addEventListener("change", atualizar);
    return () => media.removeEventListener("change", atualizar);
  }, []);
  useEffect(() => {
    const h = () => setLigado(efeitosLigados());
    window.addEventListener(EVENTO_EFEITOS, h);
    return () => window.removeEventListener(EVENTO_EFEITOS, h);
  }, []);
  const efeitos = ativo && ligado;
  return { ativo, efeitos, movimento: efeitos && !menosMovimento };
}
