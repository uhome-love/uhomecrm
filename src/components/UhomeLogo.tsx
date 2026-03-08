import { cn } from "@/lib/utils";

interface UhomeLogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  showTagline?: boolean;
  className?: string;
}

const config = {
  sm: { icon: 32, textClass: "", taglineClass: "", layout: "flex-row", gap: "gap-0" },
  md: { icon: 36, textClass: "text-base", taglineClass: "text-[10px]", layout: "flex-row", gap: "gap-2" },
  lg: { icon: 64, textClass: "text-3xl", taglineClass: "text-sm", layout: "flex-col", gap: "gap-2" },
  xl: { icon: 120, textClass: "text-5xl", taglineClass: "text-base", layout: "flex-col", gap: "gap-3" },
};

function UhomeIcon({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0"
    >
      <circle cx="50" cy="50" r="48" fill="#6B7BF7" />
      <path
        d="M50 18 L22 42 L30 42 L30 72 L70 72 L70 42 L78 42 Z"
        fill="none"
        stroke="white"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <rect x="60" y="24" width="8" height="12" rx="1" fill="white" opacity="0.9" />
      <path
        d="M36 42 L36 60 Q36 70 50 70 Q64 70 64 60 L64 42"
        stroke="white"
        strokeWidth="5.5"
        fill="none"
        strokeLinecap="round"
      />
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

  return (
    <div
      className={cn(
        "flex items-center",
        isVertical ? "flex-col" : "flex-row",
        c.gap,
        className
      )}
    >
      <UhomeIcon size={c.icon} />
      <div className={cn(isVertical ? "text-center" : "flex flex-col")}>
        <span className={cn(c.textClass, "font-extrabold tracking-tight leading-tight")}>
          <span className="text-white">Uhome</span>
          <span style={{ color: "#D1D5DB" }}>Sales</span>
        </span>
        {showTagline && (
          <span className={cn(c.taglineClass, "leading-tight")} style={{ color: "#6B7280" }}>
            Powered by 🤖 Homi AI
          </span>
        )}
      </div>
    </div>
  );
}
