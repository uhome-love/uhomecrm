import * as React from "react";
import { BRAND_COLORS as C } from "./brandPaths";

/**
 * Avatar plano do Homi (cabeça de casa, tela escura, olhos ciano).
 * Use de 18 a 40px: botão "Perguntar ao Homi", fala do Homi, "com Homi IA".
 * A pose 3D fica para estado vazio e celebração, a partir de 72px.
 *
 * - circle: coloca o Homi dentro de um círculo branco (para fundos azuis, como o botão).
 * - ring: anel ciano quando o Homi tem um alerta.
 */

export interface HomiAvatarProps extends React.HTMLAttributes<HTMLSpanElement> {
  size?: number;
  circle?: boolean;
  ring?: boolean;
  title?: string;
}

export function HomiIcon({ size = 24, title }: { size?: number; title?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <path
        d="M32 5 L59 30 L55 30 L55 50 Q55 59 46 59 L18 59 Q9 59 9 50 L9 30 L5 30 Z"
        fill={C.blue}
        stroke={C.blue}
        strokeWidth={3}
        strokeLinejoin="round"
      />
      <rect x={43} y={9} width={7} height={14} rx={2} fill={C.blue} />
      <rect x={15} y={30} width={34} height={23} rx={8} fill={C.homiScreen} />
      <rect x={22.5} y={35} width={5} height={8} rx={2.5} fill={C.homiCyan} />
      <rect x={36.5} y={35} width={5} height={8} rx={2.5} fill={C.homiCyan} />
      <path
        d="M27.5 47 Q32 50 36.5 47"
        fill="none"
        stroke={C.homiCyan}
        strokeWidth={2.2}
        strokeLinecap="round"
      />
    </svg>
  );
}

export function HomiAvatar({
  size = 32,
  circle = true,
  ring = false,
  title = "Homi",
  style,
  ...rest
}: HomiAvatarProps) {
  if (!circle) return <HomiIcon size={size} title={title} />;
  return (
    <span
      role="img"
      aria-label={title}
      style={{
        width: size,
        height: size,
        borderRadius: 9999,
        background: "#FFFFFF",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flex: "none",
        boxShadow: ring
          ? "0 0 0 2px rgba(34,211,238,0.9), 0 4px 16px rgba(34,211,238,0.25)"
          : undefined,
        ...style,
      }}
      {...rest}
    >
      <HomiIcon size={Math.round(size * 0.72)} />
    </span>
  );
}

export default HomiAvatar;
