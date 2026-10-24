"use client"

import { useActionState } from "react"
import { Button } from "@/components/ui/button"
import { FieldError } from "@/components/ui/field"
import { acceptInvite } from "./actions"

export function AcceptButton({ inviteId, organizationName }: { inviteId: string; organizationName: string }) {
  const [state, formAction, pending] = useActionState(() => acceptInvite(inviteId), undefined)
  return (
    <form action={formAction} className="flex flex-col gap-3">
      {state?.error ? <FieldError>{state.error}</FieldError> : null}
      <Button type="submit" disabled={pending}>
        Entrar na {organizationName}
      </Button>
    </form>
  )
}
