// The person acting, as a member of their active clinic. Every read and change is scoped to it.
export type Member = {
  id: string
  organizationId: string
  name: string
}

// Every clinic runs on Brasília time for now.
export const clinicTimeZone = "America/Sao_Paulo"
