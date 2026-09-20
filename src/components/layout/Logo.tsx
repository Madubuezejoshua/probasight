import Image from "next/image";

/**
 * ProbaSight brand marks.
 *
 * The mark is the supplied ProbaSight asset in `public/brand/`. It is rendered
 * through `next/image` rather than a raw <img>: the source file is 512x512 and
 * ~276 KB, which would otherwise be downloaded in full to paint a 28px header
 * icon on every page. Next serves a resized, modern-format derivative instead.
 *
 * `object-contain` inside a square box keeps the aspect ratio in all cases, so
 * the mark is never stretched or squashed regardless of the source dimensions.
 *
 * This is NOT a Panta mark. Panta attribution is a separate element rendered by
 * `src/components/common/PoweredByPanta.tsx`. See `public/brand/README.md`.
 */
const BRAND_MARK_SRC = "/brand/probasight-mark.png";

/** Rendered at 2x the largest display size (28px) so it stays sharp on retina. */
const MARK_INTRINSIC_PX = 64;

export function ProbaSightMark({
  className = "h-7 w-7",
  priority = false,
}: {
  className?: string;
  /** Set on the header mark, which is in the initial viewport on every page. */
  priority?: boolean;
}) {
  return (
    <Image
      src={BRAND_MARK_SRC}
      alt=""
      aria-hidden="true"
      width={MARK_INTRINSIC_PX}
      height={MARK_INTRINSIC_PX}
      priority={priority}
      className={`${className} object-contain`}
    />
  );
}

export function ProbaSightWordmark({ className }: { className?: string }) {
  return (
    <span className={className}>
      <span className="font-semibold tracking-tight text-[var(--color-text)]">Proba</span>
      <span className="font-semibold tracking-tight text-[var(--color-accent)]">Sight</span>
    </span>
  );
}
