import { cn } from "@/lib/utils"

// A stand-in logo until Acme has its own: a circle in the brand's blue and the name beside it.
// In a collapsed sidebar only the circle stays, where it was.
export function AcmeLogo({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2", className)} aria-label="Acme">
      <span className="size-7 shrink-0 rounded-full bg-brand" />
      <span className="text-[19px] font-semibold tracking-tight whitespace-nowrap text-ink group-data-[collapsible=icon]:hidden">
        Acme
      </span>
    </span>
  )
}
