"use client"

import { useActionState } from "react"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { createClinic } from "./actions"

export function ClinicForm() {
  const [state, formAction, pending] = useActionState(createClinic, undefined)
  return (
    <form action={formAction}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="name">Nome da clínica</FieldLabel>
          <Input id="name" name="name" placeholder="Clínica Movimento" required />
        </Field>
        {state?.error ? <FieldError>{state.error}</FieldError> : null}
        <Button type="submit" disabled={pending}>
          Criar clínica
        </Button>
      </FieldGroup>
    </form>
  )
}
