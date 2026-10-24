import { MessageActions } from "@/components/message-actions"
import { MessageCard } from "@/components/message-card"
import { TextPart } from "@/components/text-part"
import { Bubble, BubbleContent } from "@/components/ui/bubble"
import { Message, MessageContent } from "@/components/ui/message"
import type { ChatMessage as ChatMessageData } from "@/lib/chat/conversation"

export function ChatMessage({ agentId, message }: { agentId: string; message: ChatMessageData }) {
  if (message.author === "member")
    return (
      <Message align="end">
        <MessageContent>
          <Bubble align="end" variant="muted">
            <BubbleContent className="whitespace-pre-wrap">{message.text}</BubbleContent>
          </Bubble>
        </MessageContent>
      </Message>
    )

  return (
    <Message align="start">
      <MessageContent>
        {message.card ? (
          <MessageCard agentId={agentId} messageId={message.id} card={message.card} />
        ) : (
          <>
            <TextPart text={message.text ?? ""} />
            <MessageActions text={message.text ?? ""} />
          </>
        )}
      </MessageContent>
    </Message>
  )
}
