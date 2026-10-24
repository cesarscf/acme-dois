import { AuthForm } from "@/components/auth-form"
import { signIn } from "../actions"
import { openInvite } from "../invite"

export const metadata = { title: "Entrar" }

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  return <AuthForm mode="sign-in" action={signIn} invite={await openInvite(searchParams)} />
}
