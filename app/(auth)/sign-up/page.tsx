import { AuthForm } from "@/components/auth-form"
import { signUp } from "../actions"

export const metadata = { title: "Criar conta" }

export default function SignUpPage() {
  return <AuthForm mode="sign-up" action={signUp} />
}
