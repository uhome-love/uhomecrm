import { useState } from "react";
import { Play } from "lucide-react";

export default function VideoLite({ id }: { id: string }) {
  const [play, setPlay] = useState(false);
  const [thumbOk, setThumbOk] = useState(true);
  return (
    <div className="relative mx-[18px] aspect-video overflow-hidden rounded-[14px] bg-gradient-to-br from-[hsl(var(--lp-navy))] to-[hsl(var(--lp-navy-2))]">
      {play ? (
        <iframe
          className="absolute inset-0 h-full w-full"
          src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&playsinline=1&rel=0`}
          title="Filme Casa Tua Canoas"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
        />
      ) : (
        <button type="button" onClick={() => setPlay(true)} className="absolute inset-0 h-full w-full" aria-label="Assistir ao vídeo">
          {thumbOk && (
            <img
              src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`}
              alt=""
              className="h-full w-full object-cover opacity-90"
              onError={() => setThumbOk(false)}
            />
          )}
          <span className="absolute inset-0 m-auto grid h-16 w-16 place-items-center rounded-full bg-[hsl(var(--lp-blue))] text-[hsl(var(--lp-white))] shadow-lg">
            <Play className="h-7 w-7 translate-x-0.5 fill-current" />
          </span>
        </button>
      )}
    </div>
  );
}
