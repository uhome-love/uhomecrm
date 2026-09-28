import { useRef, useState } from "react";
import { Play } from "lucide-react";
import videoAsset from "@/assets/casatua-canoas-tour.mp4.asset.json";
import posterAsset from "@/assets/casatua-canoas-tour-poster.jpg.asset.json";

/** Vídeo vertical (tour real da casa). Só baixa o vídeo ao tocar no play. */
export default function VideoLite() {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [posterOk, setPosterOk] = useState(true);

  const start = () => {
    setPlaying(true);
    requestAnimationFrame(() => ref.current?.play().catch(() => undefined));
  };

  return (
    <div className="relative mx-auto aspect-[9/16] w-[calc(100%-36px)] max-w-[340px] overflow-hidden rounded-[14px] bg-gradient-to-br from-[hsl(var(--lp-navy))] to-[hsl(var(--lp-navy-2))]">
      {playing ? (
        <video
          ref={ref}
          src={videoAsset.url}
          poster={posterAsset.url}
          className="absolute inset-0 h-full w-full object-cover"
          controls
          playsInline
          preload="auto"
        />
      ) : (
        <button type="button" onClick={start} className="absolute inset-0 h-full w-full" aria-label="Assistir ao vídeo">
          {posterOk && (
            <img src={posterAsset.url} alt="" className="h-full w-full object-cover" onError={() => setPosterOk(false)} />
          )}
          <span className="absolute inset-0 m-auto grid h-16 w-16 place-items-center rounded-full bg-[hsl(var(--lp-blue))] text-[hsl(var(--lp-white))] shadow-lg">
            <Play className="h-7 w-7 translate-x-0.5 fill-current" />
          </span>
        </button>
      )}
    </div>
  );
}
