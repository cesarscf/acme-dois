import { AgentAvatar } from "@/components/agent-avatar"
import type { ConversationSummary } from "@/components/conversations"
import { GroupAvatar } from "@/components/group-avatar"
import { cn } from "@/lib/utils"

// A conversation as the list shows it, beside the chat or on a phone's own screen: its mascot or
// its group's, with a dot when something is unread, then its name, when it moved and its last
// message, or who is typing.

export function ConversationFace({
  conversation,
  unread,
  className,
}: {
  conversation: ConversationSummary
  unread: boolean
  className?: string
}) {
  return (
    <span className={cn("relative size-11 shrink-0", className)}>
      {/* Important, as the sidebar's buttons size every svg in them as an icon. */}
      {conversation.kind === "group" ? (
        <GroupAvatar looks={conversation.looks} className="size-full!" />
      ) : (
        <AgentAvatar look={conversation.looks[0]} size={44} className="size-full!" />
      )}
      {unread ? (
        <span className="absolute -top-0.5 -right-0.5 size-3 rounded-full bg-red-500 ring-2 ring-sidebar">
          <span className="sr-only">Mensagem nova</span>
        </span>
      ) : null}
    </span>
  )
}

export function ConversationText({
  conversation,
  typing,
  className,
}: {
  conversation: ConversationSummary
  typing: boolean
  className?: string
}) {
  return (
    <span className={cn("flex min-w-0 flex-1 flex-col gap-0.5", className)}>
      <span className="flex items-baseline gap-2">
        <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{conversation.name}</span>
        <span className="shrink-0 text-xs text-muted-foreground">{conversation.when}</span>
      </span>
      {typing ? (
        <span className="salte-shimmer truncate text-[13px]">Digitando...</span>
      ) : (
        <span className="truncate text-[13px] text-muted-foreground">{conversation.preview}</span>
      )}
    </span>
  )
}
