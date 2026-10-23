import { redirect } from "next/navigation"
import { requireMember } from "@/lib/dal"
import { listAgents } from "@/lib/organization/agents"

// Everyone lands on the setup agent, which opens with the welcome.
export default async function HomePage() {
  const [setup] = await listAgents(await requireMember())
  redirect(`/agents/${setup.id}`)
}
