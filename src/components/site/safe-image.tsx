import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Fills its (relatively positioned) parent with an image. Same-origin uploads and https
 * URLs go through next/image; anything else falls back to a plain <img>.
 */
export function SafeImage({ src, alt, className, sizes = "(max-width: 768px) 100vw, 50vw", priority }: { src: string; alt: string; className?: string; sizes?: string; priority?: boolean }) {
  const optimizable = src.startsWith("/") || src.startsWith("https://");
  if (optimizable) {
    return <Image src={src} alt={alt} fill sizes={sizes} priority={priority} className={cn("object-cover", className)} />;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className={cn("absolute inset-0 h-full w-full object-cover", className)} loading={priority ? "eager" : "lazy"} />;
}
