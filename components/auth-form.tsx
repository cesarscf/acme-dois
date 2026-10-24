"use client"

import Link from "next/link"
import { useActionState } from "react"
import type { AuthState } from "@/app/(auth)/actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

type Props = {
  mode: "sign-in" | "sign-up"
  action: (state: AuthState, formData: FormData) => Promise<AuthState>
  // Opened from an invite: the email is the invited one, and they go back to the invite after.
  invite?: { id: string; email: string; organizationName: string }
}

const copy = {
  "sign-in": {
    title: "Entrar",
    description: "Entre para falar com a equipe da sua clínica.",
    submit: "Entrar",
    other: { href: "/sign-up", label: "Ainda não tem conta? Criar conta" },
  },
  "sign-up": {
    title: "Criar conta",
    description: "Comece criando sua conta.",
    submit: "Criar conta",
    other: { href: "/sign-in", label: "Já tem conta? Entrar" },
  },
} as const

export function AuthForm({ mode, action, invite }: Props) {
  const [state, formAction, pending] = useActionState(action, undefined)
  const text = copy[mode]
  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>{text.title}</CardTitle>
        <CardDescription>
          {invite ? `Para entrar na equipe da ${invite.organizationName}, use ${invite.email}.` : text.description}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction}>
          {invite ? <input type="hidden" name="invite" value={invite.id} /> : null}
          <FieldGroup>
            {mode === "sign-up" ? (
              <Field>
                <FieldLabel htmlFor="name">Nome</FieldLabel>
                <Input id="name" name="name" autoComplete="name" required />
              </Field>
            ) : null}
            <Field>
              <FieldLabel htmlFor="email">E-mail</FieldLabel>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                defaultValue={invite?.email}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="password">Senha</FieldLabel>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
                required
              />
            </Field>
            {state?.error ? <FieldError>{state.error}</FieldError> : null}
            <Button type="submit" disabled={pending}>
              {text.submit}
            </Button>
            <Link href={invite ? `${text.other.href}?invite=${invite.id}` : text.other.href} className="text-center text-sm text-muted-foreground underline-offset-4 hover:underline">
              {text.other.label}
            </Link>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}
