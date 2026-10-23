import { signOut } from "@/app/(auth)/actions"
import { Chat } from "@/components/chat"
import { Button } from "@/components/ui/button"
import { agentName } from "@/lib/agent/prompt"
import { listMessages } from "@/lib/chat/conversation"
import { getOrganizationName, requireMember } from "@/lib/dal"

export default async function ChatPage() {
  const member = await requireMember()
  const [messages, organizationName] = await Promise.all([
    listMessages(member),
    getOrganizationName(member.organizationId),
  ])
  return (
    <main className="mx-auto flex h-svh max-w-2xl flex-col">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h1 className="font-medium">{agentName}</h1>
          <p className="text-sm text-muted-foreground">Secretária · {organizationName}</p>
        </div>
        <form action={signOut}>
          <Button type="submit" variant="ghost" size="sm">
            Sair
          </Button>
        </form>
      </header>
      <Chat messages={messages} agentName={agentName} />
    </main>
  )
}
