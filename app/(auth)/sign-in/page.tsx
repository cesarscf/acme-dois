import { AuthForm } from "@/components/auth-form"
import { signIn } from "../actions"

export const metadata = { title: "Entrar" }

export default function SignInPage() {
  return <AuthForm mode="sign-in" action={signIn} />
}
