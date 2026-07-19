import { OptimizedImage } from "@/components/common/OptimizedImage";
import type { MediaItem } from "@/types/models";
import { cn } from "@/lib/utils";

export function AlbumGrid({ media, onSelect }: { media: MediaItem[]; onSelect?: (i: number) => void }) {
  if (media.length === 0) return null;

  const layout =
    media.length === 1
      ? "grid-cols-1"
      : media.length === 2
        ? "grid-cols-2"
        : media.length === 3
          ? "grid-cols-3"
          : "grid-cols-2";

  return (
    <div className={cn("grid gap-1", layout)}>
      {media.slice(0, 4).map((m, i) => (
        <button
          key={m.id}
          onClick={() => onSelect?.(i)}
          className={cn(
            "relative overflow-hidden bg-secondary",
            media.length === 3 && i === 0 ? "row-span-2" : "aspect-square",
          )}
        >
          <OptimizedImage
            src={m.url}
            alt={m.alt_text ?? "album image"}
            className="h-full w-full object-cover"
          />
          {media.length > 4 && i === 3 && (
            <span className="absolute inset-0 flex items-center justify-center bg-black/60 text-lg font-semibold text-white">
              +{media.length - 4}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
