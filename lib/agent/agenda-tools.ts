import { z } from "zod"
import {
  assignAppointment,
  createAppointment,
  defaultAppointmentMinutes,
  findAppointment,
  listAppointments,
  rescheduleAppointment,
  restoreOf,
} from "../agenda/appointments"
import { createCustomer, findCustomer, listCustomers } from "../agenda/customers"
import { listTeam } from "../agenda/team"
import type { Member } from "../member"
import { appointmentLabel, dayRange, timeIn, zonedInstant } from "../time"
import type { ApprovalCard, ReceiptCard } from "./cards"
import { defineTool, type ToolContext, ToolRefusal } from "./tool-registry"

// A team agent changes the agenda as a member asks, each change in a Receipt with Undo, or first in
// an Approval for what its charter doesn't let it do alone. Cancelling always waits for a member,
// whatever the charter or the model says.

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("O dia, aaaa-mm-dd, no fuso da clínica.")
const time = z.string().regex(/^\d{2}:\d{2}$/).describe("O horário, HH:MM, no fuso da clínica.")
const id = z.uuid()

function startOf(input: { day: string; time: string }, { now, timeZone }: ToolContext) {
  const startsAt = zonedInstant(input.day, input.time, timeZone)
  if (Number.isNaN(startsAt.getTime())) throw new ToolRefusal("Dia ou horário inválido.")
  if (startsAt <= now) throw new ToolRefusal("Esse horário já passou.")
  return startsAt
}

async function teamNames(member: Member) {
  const team = await listTeam(member.organizationId)
  return new Map(team.map((teammate) => [teammate.id, teammate.name]))
}

async function teammate(member: Member, memberId: string) {
  const name = (await teamNames(member)).get(memberId)
  if (!name) throw new ToolRefusal(`${memberId} não é membro da equipe.`)
  return name
}

const receipt = (title: string, detail: string): ReceiptCard => ({
  type: "receipt",
  title,
  detail,
  status: "applied",
  undoable: true,
})

const shownNote = "Mostrei ao membro num recibo com Desfazer."

const withWhom = (name: string | undefined) => (name ? `com ${name}` : "sem ninguém para atender")

// A scheduled appointment of the organization, with its customer's name.
async function scheduled(member: Member, appointmentId: string) {
  const appointment = await findAppointment(member, appointmentId)
  if (!appointment) throw new ToolRefusal("Essa sessão não existe na agenda.")
  if (appointment.status !== "scheduled") throw new ToolRefusal("Essa sessão não está mais agendada.")
  const customer = await findCustomer(member, appointment.customerId)
  return { ...appointment, customer: customer?.name ?? "" }
}

export const findCustomersTool = defineTool({
  name: "find_customers",
  label: "Procurar clientes",
  description:
    "Procura clientes da clínica pelo nome (ou lista todas, com query null). Devolve id e nome; use o id nas outras ferramentas.",
  input: z.object({ query: z.string().max(80).nullable() }),
  async run({ query }, { member }) {
    return { output: await listCustomers(member, query?.trim() || undefined) }
  },
})

export const createCustomerTool = defineTool({
  name: "create_customer",
  label: "Cadastrar clientes",
  description:
    "Cadastra uma cliente nova na clínica. Antes, confira com find_customers que ela ainda não existe.",
  input: z.object({
    name: z.string().trim().min(1).max(120),
    phone: z.string().max(30).nullable().describe("O telefone, se o membro disse."),
  }),
  async run({ name, phone }, { member }) {
    const created = await createCustomer(member, { name, phone })
    return { output: { customer_id: created.id } }
  },
})

export const readAgendaTool = defineTool({
  name: "read_agenda",
  label: "Ler a agenda",
  description:
    "Lê as sessões de um dia na agenda da clínica: id, horário, cliente, duração, tipo, quem atende e situação (scheduled, done, missed, cancelled).",
  input: z.object({ day }),
  async run(input, { member, timeZone }) {
    const appointments = await listAppointments(member, dayRange(input.day, timeZone))
    return {
      output: {
        day: input.day,
        appointments: appointments.map((appointment) => ({
          id: appointment.id,
          time: timeIn(appointment.startsAt, timeZone),
          customer: appointment.customer,
          customer_id: appointment.customerId,
          duration_minutes: appointment.durationMinutes,
          kind: appointment.kind,
          attended_by: appointment.attendedBy,
          status: appointment.status,
        })),
      },
    }
  },
})

const minutesOf = (input: { duration_minutes: number | null }, context: ToolContext) =>
  input.duration_minutes ?? context.appointmentMinutes ?? defaultAppointmentMinutes

export const createAppointmentTool = defineTool({
  name: "create_appointment",
  label: "Marcar sessões",
  description:
    "Marca uma sessão para uma cliente. Sem member_id, quem atende é o membro que pediu. Sem duração, vale a da clínica.",
  input: z.object({
    customer_id: id,
    day,
    time,
    duration_minutes: z.int().min(5).max(480).nullable().describe("A duração em minutos, ou null."),
    kind: z.string().max(120).nullable().describe("O tipo, como Avaliação."),
    member_id: id.nullable().describe("Quem atende (id da equipe), ou null."),
  }),
  async confirm(input, context) {
    const startsAt = startOf(input, context)
    const customer = await findCustomer(context.member, input.customer_id)
    if (!customer) throw new ToolRefusal(`${input.customer_id} não é cliente da clínica.`)
    const attending = await teammate(context.member, input.member_id ?? context.member.id)
    return {
      title: "Marcar a sessão?",
      rows: [
        { label: "Cliente", value: customer.name },
        { label: "Quando", value: `${appointmentLabel(startsAt, context.timeZone)} (${minutesOf(input, context)} min)` },
        { label: "Atende", value: attending },
        ...(input.kind?.trim() ? [{ label: "Tipo", value: input.kind.trim() }] : []),
      ],
    }
  },
  async run(input, context) {
    const { member, timeZone } = context
    const startsAt = startOf(input, context)
    const customer = await findCustomer(member, input.customer_id)
    if (!customer) throw new ToolRefusal(`${input.customer_id} não é cliente da clínica.`)
    const memberId = input.member_id ?? member.id
    const created = await createAppointment(member, {
      customerId: customer.id,
      memberId,
      startsAt,
      durationMinutes: minutesOf(input, context),
      kind: input.kind,
    })
    const names = await teamNames(member)
    return {
      output: { appointment_id: created.id, note: shownNote },
      card: receipt(
        "Sessão marcada",
        `${customer.name}, ${appointmentLabel(startsAt, timeZone)}, ${withWhom(names.get(memberId))}.`,
      ),
      action: { kind: "undo", restores: [restoreOf(created, { status: "cancelled" })] },
    }
  },
})

export const rescheduleAppointmentTool = defineTool({
  name: "reschedule_appointment",
  label: "Remarcar sessões",
  description:
    "Remarca uma sessão (o id vem de read_agenda) para outro dia e horário: a antiga é cancelada e uma nova fica no lugar. Sem member_id, quem atende continua o mesmo.",
  input: z.object({
    appointment_id: id,
    day,
    time,
    member_id: id.nullable().describe("Quem passa a atender, ou null."),
  }),
  async confirm(input, context) {
    const startsAt = startOf(input, context)
    const appointment = await scheduled(context.member, input.appointment_id)
    const names = await teamNames(context.member)
    return {
      title: "Remarcar a sessão?",
      rows: [
        { label: "Cliente", value: appointment.customer },
        { label: "De", value: appointmentLabel(appointment.startsAt, context.timeZone) },
        { label: "Para", value: appointmentLabel(startsAt, context.timeZone) },
        { label: "Atende", value: names.get(input.member_id ?? appointment.memberId ?? "") ?? "Ninguém" },
      ],
    }
  },
  async run(input, context) {
    const { member, timeZone } = context
    const startsAt = startOf(input, context)
    const { cancelled, rebooked } = await rescheduleAppointment(member, input.appointment_id, {
      startsAt,
      ...(input.member_id && { memberId: input.member_id }),
    })
    const [customer, names] = await Promise.all([
      findCustomer(member, rebooked.customerId),
      teamNames(member),
    ])
    return {
      output: { appointment_id: rebooked.id, replaces: cancelled.id, note: shownNote },
      card: receipt(
        "Sessão remarcada",
        `${customer?.name}, de ${appointmentLabel(cancelled.startsAt, timeZone)} para ${appointmentLabel(startsAt, timeZone)}, ${withWhom(names.get(rebooked.memberId ?? ""))}.`,
      ),
      action: {
        kind: "undo",
        restores: [
          restoreOf(rebooked, { status: "cancelled" }),
          restoreOf(cancelled, { status: "scheduled" }),
        ],
      },
    }
  },
})

export const assignAppointmentTool = defineTool({
  name: "assign_appointment",
  label: "Trocar quem atende",
  description: "Define quem da equipe atende uma sessão (o id vem de read_agenda).",
  input: z.object({ appointment_id: id, member_id: id.describe("Quem passa a atender.") }),
  async confirm(input, context) {
    const appointment = await scheduled(context.member, input.appointment_id)
    return {
      title: "Trocar quem atende?",
      rows: [
        { label: "Cliente", value: appointment.customer },
        { label: "Sessão", value: appointmentLabel(appointment.startsAt, context.timeZone) },
        { label: "Passa a atender", value: await teammate(context.member, input.member_id) },
      ],
    }
  },
  async run(input, { member, timeZone }) {
    const { from, updated } = await assignAppointment(member, input.appointment_id, input.member_id)
    const [customer, names] = await Promise.all([
      findCustomer(member, updated.customerId),
      teamNames(member),
    ])
    return {
      output: { appointment_id: updated.id, note: shownNote },
      card: receipt(
        "Quem atende mudou",
        `${customer?.name}, ${appointmentLabel(updated.startsAt, timeZone)}, agora ${withWhom(names.get(input.member_id))}.`,
      ),
      action: { kind: "undo", restores: [restoreOf(updated, { memberId: from.memberId })] },
    }
  },
})

export const cancelAppointmentTool = defineTool({
  name: "cancel_appointment",
  label: "Pedir cancelamentos (sempre com confirmação)",
  description:
    "Pede a um membro que confirme o cancelamento de uma sessão (o id vem de read_agenda). Você nunca cancela sozinha: o membro decide num card, e a decisão chega numa próxima mensagem. Para mudar o horário, use reschedule_appointment.",
  input: z.object({
    appointment_id: id,
    reason: z.string().max(200).nullable().describe("O motivo, se houver."),
  }),
  async run(input, { member, timeZone }) {
    const appointment = await scheduled(member, input.appointment_id)
    const names = await teamNames(member)
    const reason = input.reason?.trim()
    const card: ApprovalCard = {
      type: "approval",
      title: "Cancelar a sessão?",
      rows: [
        { label: "Cliente", value: appointment.customer },
        { label: "Sessão", value: appointmentLabel(appointment.startsAt, timeZone) },
        { label: "Atende", value: names.get(appointment.memberId ?? "") ?? "Ninguém" },
        ...(reason ? [{ label: "Motivo", value: reason }] : []),
      ],
      status: "pending",
    }
    return {
      output: "Pedi a confirmação do membro num card. Não diga que cancelou: a decisão chega depois.",
      card,
      action: {
        kind: "cancel",
        appointmentId: appointment.id,
        updatedAt: appointment.updatedAt.toISOString(),
      },
    }
  },
})

export const agendaTools = [
  findCustomersTool,
  createCustomerTool,
  readAgendaTool,
  createAppointmentTool,
  rescheduleAppointmentTool,
  assignAppointmentTool,
  cancelAppointmentTool,
]

// Every team agent can find customers and read the agenda: the other tools take ids from them.
export const baseAgendaTools = [findCustomersTool.name, readAgendaTool.name]
