// The person acting, as a member of their active organization. Every read and change is scoped to it.
export type Member = {
  id: string
  organizationId: string
  name: string
}

// Every organization runs on Brasília time for now.
export const organizationTimeZone = "America/Sao_Paulo"
