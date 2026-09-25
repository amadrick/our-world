import Image from "next/image";

/**
 * The admin's content layer: a softly blurred mosaic of place pictures,
 * so the glass chrome above has color to pick up. Without any, a quiet wash.
 */
export function ImageBackdrop({ images }: { images: string[] }) {
  if (images.length === 0) {
    return (
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 bg-map bg-[radial-gradient(60%_50%_at_15%_10%,#dfe8f0,transparent),radial-gradient(50%_45%_at_90%_35%,#e6ecdf,transparent),radial-gradient(55%_50%_at_40%_100%,#f1e7da,transparent)]"
      />
    );
  }
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-map">
      <div className="absolute -inset-32 grid grid-cols-4 blur-[72px] saturate-[1.5] sm:grid-cols-6">
        {images.slice(0, 24).map((src) => (
          <div key={src} className="relative aspect-[4/3]">
            <Image src={src} alt="" fill sizes="20vw" className="scale-150 object-cover" />
          </div>
        ))}
      </div>
      <div className="absolute inset-0 bg-white/30 dark:bg-black/45" />
    </div>
  );
}
