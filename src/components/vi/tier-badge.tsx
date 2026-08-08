import { tierMeta } from "@/lib/taxonomy";
import { cn } from "@/lib/utils";

export function TierBadge({
  tier,
  className,
  showLabel = true,
}: {
  tier: number;
  className?: string;
  showLabel?: boolean;
}) {
  const meta = tierMeta(tier);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-none",
        className,
      )}
      style={{
        color: `var(--tier-${tier})`,
        borderColor: `color-mix(in oklch, var(--tier-${tier}) 35%, transparent)`,
        backgroundColor: `color-mix(in oklch, var(--tier-${tier}) 10%, transparent)`,
      }}
      title={meta.description}
    >
      <span className="font-mono">T{tier}</span>
      {showLabel && <span>{meta.short}</span>}
    </span>
  );
}