import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { UhomeSalesLogo, type LogoTheme } from "@/components/brand/UhomeSalesLogo";
import { HomiAvatar } from "@/components/brand/HomiAvatar";
import { useNatal } from "@/natal/useNatal";

interface UhomeLogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  /** Mostra "com Homi IA" embaixo do logo. */
  showTagline?: boolean;
  /** Força a variação; sem isso acompanha o tema claro/escuro do CRM. */
  theme?: LogoTheme;
  className?: string;
}

const HEIGHT = { sm: 32, md: 30, lg: 44, xl: 64 } as const;

function useTemaEscuro() {
  const [dark, setDark] = useState(() =>
    typeof document !== "undefined" && document.documentElement.classList.contains("dark"),
  );
  useEffect(() => {
    const el = document.documentElement;
    const obs = new MutationObserver(() => setDark(el.classList.contains("dark")));
    obs.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

/** Logo oficial UhomeSales (marca 2026). O gorro aparece junto com os efeitos de Natal. */
export default function UhomeLogo({ size = "md", showTagline = false, theme, className }: UhomeLogoProps) {
  const dark = useTemaEscuro();
  const { efeitos } = useNatal();
  const tema: LogoTheme = theme ?? (dark ? "dark" : "light");
  const vertical = size === "lg" || size === "xl";

  return (
    <div className={cn("inline-flex", vertical ? "flex-col items-center" : "flex-col items-start", className)}>
      <UhomeSalesLogo
        variant={size === "sm" ? "symbol" : "full"}
        height={HEIGHT[size]}
        theme={tema}
        natal={efeitos}
      />
      {showTagline && size !== "sm" && (
        <span
          className={cn("mt-1.5 inline-flex items-center gap-1.5 text-sm", tema === "white" ? "text-primary-foreground/80" : "text-muted-foreground")}
        >
          com <HomiAvatar size={18} circle={false} /> <span className="font-semibold">Homi IA</span>
        </span>
      )}
    </div>
  );
}
