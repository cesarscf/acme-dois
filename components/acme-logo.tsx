import { cn } from "@/lib/utils"

// A stand-in logo until Acme has its own: a circle in the brand's blue and the name beside it.
export function AcmeLogo({ markOnly = false, className }: { markOnly?: boolean; className?: string }) {
  return (
    <span className={cn("flex items-center gap-2", className)} aria-label="Acme">
      <span className="size-7 shrink-0 rounded-full bg-brand" />
      {markOnly ? null : <span className="text-[19px] font-semibold tracking-tight text-ink">Acme</span>}
    </span>
  )
}
