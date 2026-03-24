import { cn } from "@/lib/utils";

interface UhomeLogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  showTagline?: boolean;
  className?: string;
}

const config = {
  sm: { icon: 32, mascot: 0, textClass: "", taglineClass: "", taglineIcon: 0 },
  md: { icon: 36, mascot: 28, textClass: "text-base", taglineClass: "text-[10px]", taglineIcon: 10 },
  lg: { icon: 64, mascot: 48, textClass: "text-3xl", taglineClass: "text-sm", taglineIcon: 14 },
  xl: { icon: 120, mascot: 80, textClass: "text-5xl", taglineClass: "text-base", taglineIcon: 18 },
};

function UhomeIcon({ size }: { size: number }) {
  const id = `glow-${size}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0"
    >
      <defs>
        {/* Sphere gradient — deep blue center to dark edge */}
        <radialGradient id={`sphere-${id}`} cx="40%" cy="35%" r="55%">
          <stop offset="0%" stopColor="#1E40AF" />
          <stop offset="50%" stopColor="#1E3A8A" />
          <stop offset="100%" stopColor="#0C1445" />
        </radialGradient>
        {/* Glow filter */}
        <filter id={`glow-f-${id}`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Outer glow */}
      <circle cx="50" cy="50" r="49" fill="none" stroke="#3B82F6" strokeWidth="1" opacity="0.3" />

      {/* Main sphere */}
      <circle cx="50" cy="50" r="47" fill={`url(#sphere-${id})`} />

      {/* Specular highlight */}
      <ellipse cx="38" cy="32" rx="18" ry="12" fill="white" opacity="0.06" />

      {/* House + U icon with glow */}
      <g filter={`url(#glow-f-${id})`}>
        {/* House roof */}
        <path
          d="M50 20 L23 44 L31 44 L31 70 L69 70 L69 44 L77 44 Z"
          fill="none"
          stroke="white"
          strokeWidth="3.5"
          strokeLinejoin="round"
          opacity="0.95"
        />
        {/* Chimney */}
        <rect x="61" y="26" width="7" height="11" rx="1.5" fill="white" opacity="0.85" />
        {/* U letter */}
        <path
          d="M37 44 L37 59 Q37 69 50 69 Q63 69 63 59 L63 44"
          stroke="white"
          strokeWidth="5"
          fill="none"
          strokeLinecap="round"
          opacity="0.95"
        />
      </g>
    </svg>
  );
}

/** Tiny Homi AI icon for tagline */
function HomiTaglineIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="inline-block align-middle" style={{ marginTop: -1 }}>
      {/* Body */}
      <rect x="5" y="10" width="14" height="11" rx="4" fill="#4F46E5" />
      {/* Head / hood */}
      <path d="M12 2 L5 9 L19 9 Z" fill="#4F46E5" />
      <rect x="6" y="7" width="12" height="6" rx="2" fill="#4F46E5" />
      {/* Face visor */}
      <rect x="7.5" y="8" width="9" height="5" rx="2" fill="#0F172A" />
      {/* Eyes */}
      <circle cx="10" cy="10.5" r="1.2" fill="#22D3EE" />
      <circle cx="14" cy="10.5" r="1.2" fill="#22D3EE" />
      {/* Smile */}
      <path d="M10.5 12.5 Q12 13.5 13.5 12.5" stroke="#22D3EE" strokeWidth="0.6" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export default function UhomeLogo({ size = "md", showTagline = false, className }: UhomeLogoProps) {
  const c = config[size];

  if (size === "sm") {
    return (
      <div className={cn("inline-flex items-center justify-center", className)}>
        <UhomeIcon size={c.icon} />
      </div>
    );
  }

  const isVertical = size === "lg" || size === "xl";
  const mascotSize = c.mascot;

  return (
    <div
      className={cn(
        "flex items-center",
        isVertical ? "flex-col" : "flex-row",
        isVertical ? "gap-2" : "gap-2",
        className
      )}
    >
      {/* Sphere + Mascot composite */}
      <div className="relative shrink-0" style={{ width: c.icon, height: c.icon }}>
        <UhomeIcon size={c.icon} />
        {mascotSize > 0 && (
          <img
            src="/images/homi-mascot-official.png"
            alt=""
            className="absolute object-contain pointer-events-none"
            style={{
              width: mascotSize,
              height: mascotSize,
              bottom: isVertical ? -mascotSize * 0.15 : -mascotSize * 0.1,
              left: isVertical ? "50%" : -mascotSize * 0.15,
              transform: isVertical ? "translateX(-50%)" : "none",
            }}
          />
        )}
      </div>

      {/* Text block */}
      <div className={cn(isVertical ? "text-center" : "flex flex-col")}>
        <span className={cn(c.textClass, "font-extrabold tracking-tight leading-tight")}>
          <span style={{ color: "#d1d5db", fontWeight: 800 }}>Uhome</span>
          <span style={{ color: "#4F46E5", fontWeight: 800 }}>Sales</span>
        </span>
        {showTagline && (
          <span className={cn(c.taglineClass, "leading-tight flex items-center", isVertical ? "justify-center" : "")} style={{ color: "#a1a1aa", fontSize: 11, gap: 4 }}>
            Powered by <HomiTaglineIcon size={c.taglineIcon} /> Homi AI
          </span>
        )}
      </div>
    </div>
  );
}
