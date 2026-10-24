import { AuthForm } from "@/components/auth-form"
import { signUp } from "../actions"
import { openInvite } from "../invite"

export const metadata = { title: "Criar conta" }

export default async function SignUpPage({ searchParams }: PageProps<"/sign-up">) {
  return <AuthForm mode="sign-up" action={signUp} invite={await openInvite(searchParams)} />
}
