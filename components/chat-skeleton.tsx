import { Skeleton } from "@/components/ui/skeleton"
import { SidebarTrigger } from "@/components/ui/sidebar"

// What a conversation looks like while it loads, shown the moment the member clicks it: the
// header, a few messages and the composer, in the places the real ones will take.
export function ChatSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-canvas" aria-busy="true" aria-label="Carregando a conversa">
      <header className="flex h-16 shrink-0 items-center gap-2 border-b border-line bg-surface px-4 lg:px-6">
        <SidebarTrigger className="text-sub" />
        <div className="flex items-center gap-2.5 py-1 pl-1">
          <Skeleton className="size-[34px] rounded-full" />
          <span className="flex flex-col gap-1.5">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-2.5 w-20" />
          </span>
        </div>
      </header>
      <div className="mx-auto flex w-full max-w-[760px] flex-1 flex-col justify-end gap-4 overflow-hidden px-6 pb-6">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3.5 w-3/4" />
          <Skeleton className="h-3.5 w-1/2" />
        </div>
        <Skeleton className="h-10 w-2/5 self-end rounded-[20px]" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3.5 w-2/3" />
          <Skeleton className="h-3.5 w-1/3" />
        </div>
      </div>
      <div className="mx-auto w-full max-w-[760px] shrink-0 px-4 pb-5 lg:px-6">
        <Skeleton className="h-[92px] w-full rounded-[22px]" />
      </div>
    </div>
  )
}
