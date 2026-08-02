import { useEffect, useState } from "react";

const homiBust = "/images/homi-3d-bust.png";

const FRASES = [
  "Lendo seus números...",
  "Cruzando o pipeline...",
  "Montando a resposta...",
  "Conferindo as visitas...",
];

/** Estado "pensando" no padrão dos produtos de IA: shimmer de texto + anel de respiração no avatar. */
export default function ThinkingIndicator() {
  const [i, setI] = useState(0);

  useEffect(() => {
    const t = window.setInterval(() => setI((v) => (v + 1) % FRASES.length), 2600);
    return () => window.clearInterval(t);
  }, []);

  return (
    <div className="flex items-center gap-3 animate-fade-in">
      <span className="relative flex h-7 w-7 shrink-0 items-center justify-center">
        <span className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
        <img src={homiBust} alt="" aria-hidden className="relative h-7 w-7 rounded-full object-cover" />
      </span>
      <span
        key={i}
        className="animate-fade-in bg-[linear-gradient(90deg,hsl(var(--muted-foreground))_0%,hsl(var(--foreground))_50%,hsl(var(--muted-foreground))_100%)] bg-[length:200%_100%] bg-clip-text text-sm text-transparent"
        style={{ animation: "homi-shimmer 2s linear infinite" }}
      >
        {FRASES[i]}
      </span>
    </div>
  );
}
