import { ConversationHome } from "@/components/conversation-home"

export const metadata = { title: "Conversas" }

// The list of conversations on a phone, or a prompt to pick one beside it on a computer.
export default function HomePage() {
  return <ConversationHome />
}
