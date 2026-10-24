import { ChatSkeleton } from "@/components/chat-skeleton"

// Shown at once when the member opens a conversation, and prefetched with the list's links.
export default function Loading() {
  return <ChatSkeleton />
}
