import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getSession } from "@/lib/dal"
import { OrganizationForm } from "./organization-form"

export const metadata = { title: "Sua clínica" }

export default async function OnboardingPage() {
  const session = await getSession()
  if (!session) redirect("/sign-in")
  if (session.session.activeOrganizationId) redirect("/")
  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Olá, {session.user.name}</CardTitle>
          <CardDescription>Crie sua clínica para começar a trabalhar com a Lia.</CardDescription>
        </CardHeader>
        <CardContent>
          <OrganizationForm />
        </CardContent>
      </Card>
    </main>
  )
}
