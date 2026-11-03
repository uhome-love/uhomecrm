import { useEffect } from "react";
import "./natal.css";
import { useNatal } from "./useNatal";

/** Liga a classe .tema-natal no <html> durante o período de Natal e mostra a faixa de luzes. */
export function FaixaLuzesNatal() {
  const { ativo, efeitos, movimento } = useNatal();
  useEffect(() => {
    const el = document.documentElement;
    if (ativo) el.classList.add("tema-natal");
    else el.classList.remove("tema-natal");
    return () => el.classList.remove("tema-natal");
  }, [ativo]);
  if (!efeitos) return null;
  return <div aria-hidden className={`natal-luzes${movimento ? " natal-piscar" : ""}`} />;
}

/** Gorro pequeno inclinado sobre logo/foto. O pai precisa ser `relative`. */
export function GorroNatal({ className = "" }: { className?: string }) {
  const { efeitos } = useNatal();
  if (!efeitos) return null;
  return (
    <img
      src="/natal/gorro_3d.png"
      alt=""
      aria-hidden
      className={`pointer-events-none absolute -rotate-[15deg] select-none ${className}`}
    />
  );
}
