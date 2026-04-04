import { memo, useEffect, useState } from "react";

function useModelViewer() {
  const [ready, setReady] = useState(typeof customElements !== "undefined" && !!customElements.get("model-viewer"));
  useEffect(() => {
    if (ready) return;
    import("@google/model-viewer")
      .then(() => setReady(true))
      .catch((err) => console.warn("model-viewer failed to load:", err));
  }, [ready]);
  return ready;
}

interface Avatar3DViewerProps {
  src: string;
  size: "lg" | "xl";
  className?: string;
}

function Avatar3DViewerInner({ src, size, className }: Avatar3DViewerProps) {
  const cameraOrbit = size === "xl" ? "0deg 90deg 2.8m" : "0deg 90deg 2.2m";
  const autoRotate = size === "xl";

  const props: any = {
    src,
    alt: "Avatar 3D",
    "camera-orbit": cameraOrbit,
    "camera-target": "0m 0.85m 0m",
    "field-of-view": "25deg",
    "auto-rotate": autoRotate || undefined,
    "rotation-per-second": "20deg",
    "interaction-prompt": "none",
    "shadow-intensity": "0",
    loading: "lazy",
    style: {
      width: "100%",
      height: "100%",
      background: "transparent",
      "--poster-color": "transparent",
    },
  };

  return (
    <div className={className} style={{ width: "100%", height: "100%", overflow: "hidden", borderRadius: "50%" }}>
      <model-viewer {...props} />
    </div>
  );
}

const Avatar3DViewer = memo(Avatar3DViewerInner);
export default Avatar3DViewer;
