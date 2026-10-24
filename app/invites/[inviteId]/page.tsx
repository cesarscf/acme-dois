import Link from "next/link"
import { notFound } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getSession } from "@/lib/dal"
import { findInvite } from "@/lib/organization/invites"
import { AcceptButton } from "./accept-button"
import { switchAccount } from "./actions"

export const metadata = { title: "Convite" }

export default async function InvitePage({ params }: PageProps<"/invites/[inviteId]">) {
  const { inviteId } = await params
  const [invite, session] = await Promise.all([findInvite(inviteId), getSession()])
  if (!invite) notFound()

  const title = `${invite.inviterName} te convidou para a ${invite.organizationName}`
  let body: React.ReactNode
  if (!invite.open)
    body = (
      <>
        <CardDescription>
          {invite.status === "accepted"
            ? "Este convite já foi usado."
            : `Este convite não vale mais. Peça um novo a ${invite.inviterName}.`}
        </CardDescription>
        <Button render={<Link href="/" />} nativeButton={false} variant="outline">
          Ir para o Acme
        </Button>
      </>
    )
  else if (!session)
    body = (
      <>
        <CardDescription>
          Entre com <b className="text-foreground">{invite.email}</b> para fazer parte da equipe e conversar com os
          agentes da clínica.
        </CardDescription>
        <Button render={<Link href={`/sign-up?invite=${invite.id}`} />} nativeButton={false}>
          Criar conta
        </Button>
        <Button render={<Link href={`/sign-in?invite=${invite.id}`} />} nativeButton={false} variant="outline">
          Já tenho conta
        </Button>
      </>
    )
  else if (session.user.email.toLowerCase() !== invite.email)
    body = (
      <>
        <CardDescription>
          Você entrou com <b className="text-foreground">{session.user.email}</b>, mas o convite é para{" "}
          <b className="text-foreground">{invite.email}</b>.
        </CardDescription>
        <form action={switchAccount.bind(null, invite.id)}>
          <Button type="submit" variant="outline" className="w-full">
            Entrar com {invite.email}
          </Button>
        </form>
      </>
    )
  else
    body = (
      <>
        <CardDescription>Aceite para entrar na equipe e conversar com os agentes da clínica.</CardDescription>
        <AcceptButton inviteId={invite.id} organizationName={invite.organizationName} />
      </>
    )

  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">{body}</CardContent>
      </Card>
    </main>
  )
}
