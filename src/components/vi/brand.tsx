import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export function Brand({ className, to = "/" }: { className?: string; to?: string }) {
  return (
    <Link to={to} className={cn("group inline-flex items-center gap-2.5", className)}>
      <span className="relative flex h-8 w-8 items-center justify-center rounded-[10px] bg-primary">
        <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
          <path
            d="M12 2.5 20 6v6.2c0 4.6-3.3 8-8 9.3-4.7-1.3-8-4.7-8-9.3V6l8-3.5Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            className="text-primary-foreground"
          />
          <path
            d="m8.6 12.2 2.4 2.4 4.4-4.7"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-accent"
          />
        </svg>
      </span>
      <span className="text-[15px] font-semibold tracking-tight">MyVisa</span>
    </Link>
  );
}