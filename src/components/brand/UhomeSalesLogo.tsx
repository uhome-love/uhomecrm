import * as React from "react";
import {
  BRAND_COLORS as C,
  FULL_BOX,
  HAT_BOX,
  SYMBOL,
  SYMBOL_BOX,
  WORD,
  WORD_TRANSFORM,
} from "./brandPaths";

/**
 * Logo do UhomeSales.
 *
 * - variant "full": símbolo da Uhome fazendo o papel do U + "HomeSales."
 * - variant "symbol": só o símbolo (sidebar recolhida, favicon, avatar).
 * - theme "light": fundo claro (padrão). "dark": tema escuro do CRM. "white": sobre azul ou foto.
 * - natal: coloca o gorro no símbolo. Use isNatalSeason() para ligar sozinho em dezembro.
 *
 * As cores são da marca e não mudam com o tema; o que muda é a variação (theme).
 */

export type LogoTheme = "light" | "dark" | "white";

export interface UhomeSalesLogoProps
  extends Omit<React.SVGProps<SVGSVGElement>, "children" | "height" | "width"> {
  variant?: "full" | "symbol";
  theme?: LogoTheme;
  natal?: boolean;
  /** Altura em px. A largura acompanha a proporção. Sidebar: 32. Login: 44. */
  height?: number;
  title?: string;
}

/** De 1º de dezembro a 6 de janeiro (Dia de Reis). */
export function isNatalSeason(date: Date = new Date()): boolean {
  const month = date.getMonth();
  const day = date.getDate();
  return month === 11 || (month === 0 && day <= 6);
}

const WORD_COLORS: Record<LogoTheme, { home: string; sales: string; dot: string }> = {
  light: { home: C.blue, sales: C.gray, dot: C.blue },
  dark: { home: C.white, sales: C.grayOnDark, dot: C.blue },
  white: { home: C.white, sales: C.white, dot: C.white },
};

function SymbolShape({ theme }: { theme: LogoTheme }) {
  if (theme === "white") {
    return (
      <path
        fill={C.white}
        fillRule="evenodd"
        d={SYMBOL.circle + SYMBOL.house + SYMBOL.inner + SYMBOL.u}
      />
    );
  }
  return (
    <>
      <path fill={C.blue} d={SYMBOL.circle} />
      <path fill={C.white} fillRule="evenodd" d={SYMBOL.house + SYMBOL.inner + SYMBOL.u} />
    </>
  );
}

function NatalHat() {
  return (
    <g transform="translate(338 352) rotate(-20) scale(.82)">
      <path
        d="M-70 40 C-60 -40 0 -95 90 -80 C140 -70 170 -30 178 20 C150 -5 120 -12 95 -2 C110 15 112 35 105 45 Z"
        fill={C.hatRed}
      />
      <path
        d="M-62 36 C-50 -30 -5 -78 70 -80 C40 -55 15 -15 10 38 Z"
        fill={C.hatShade}
        opacity={0.45}
      />
      <rect x={-92} y={28} width={215} height={44} rx={22} fill={C.hatFur} />
      <circle cx={182} cy={28} r={26} fill={C.hatFur} />
    </g>
  );
}

export function UhomeSalesLogo({
  variant = "full",
  theme = "light",
  natal = false,
  height = 32,
  title = "UhomeSales",
  ...rest
}: UhomeSalesLogoProps) {
  const box = variant === "full" ? FULL_BOX : SYMBOL_BOX;
  const x = natal ? HAT_BOX.x : box.x;
  const y = natal ? HAT_BOX.y : box.y;
  const w = box.x + box.w - x;
  const h = box.y + box.h - y;
  const width = Math.round((height * w) / h);
  const colors = WORD_COLORS[theme];

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`${x} ${y} ${w} ${h}`}
      height={height}
      width={width}
      role="img"
      aria-label={title}
      {...rest}
    >
      <SymbolShape theme={theme} />
      {natal && <NatalHat />}
      {variant === "full" && (
        <g transform={WORD_TRANSFORM}>
          <path fill={colors.home} d={WORD.home} />
          <path fill={colors.sales} d={WORD.sales} />
          <path fill={colors.dot} d={WORD.dot} />
        </g>
      )}
    </svg>
  );
}

export default UhomeSalesLogo;
