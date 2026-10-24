import { MessageActions } from "@/components/message-actions"
import { MessageCard } from "@/components/message-card"
import { MemberBubble } from "@/components/salte"
import { TextPart } from "@/components/text-part"
import type { ChatMessage as ChatMessageData } from "@/lib/chat/conversation"
import { organizationTimeZone } from "@/lib/member"
import { timeIn } from "@/lib/time"

// The agent writes without a bubble, like Salte; the member, in a white one.
export function ChatMessage({ agentId, message }: { agentId: string; message: ChatMessageData }) {
  if (message.author === "member") return <MemberBubble>{message.text}</MemberBubble>
  if (message.card)
    return (
      <div className="flex flex-col gap-3">
        <MessageCard agentId={agentId} messageId={message.id} card={message.card} />
      </div>
    )
  return (
    <div className="text-ink">
      <TextPart text={message.text ?? ""} />
      <MessageActions text={message.text ?? ""} time={timeIn(message.createdAt, organizationTimeZone)} />
    </div>
  )
}
