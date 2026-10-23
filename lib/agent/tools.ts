import type Anthropic from "@anthropic-ai/sdk"
import { z } from "zod"
import {
  AgendaError,
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
import type { AgendaAction, ApprovalCard, Card, ReceiptCard } from "./cards"

// The agent changes the agenda as a member asks, each change in a Receipt with Undo. Cancelling is
// never one of them: it always waits for a member's Approval, whatever the model asks for.

export type ToolContext = {
  // Tools read and change the organization's data as the member the turn acts for.
  member: Member
  now: Date
  timeZone: string
}

// What a tool hands back: `output` goes to the model; a card, to the member.
export type ToolOutput = { output: unknown; card?: Card; action?: AgendaAction }

// A tool turning down its input with a reason the model can act on.
export class ToolRefusal extends Error {}

type Tool<Input extends z.ZodObject = z.ZodObject> = {
  name: string
  description: string
  input: Input
  run: (input: z.infer<Input>, context: ToolContext) => Promise<ToolOutput>
}

const defineTool = <Input extends z.ZodObject>(tool: Tool<Input>) => tool as unknown as Tool

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

const receipt = (title: string, detail: string): ReceiptCard => ({
  type: "receipt",
  title,
  detail,
  status: "applied",
})

const shownNote = "Mostrei ao membro num recibo com Desfazer."

const withWhom = (name: string | undefined) => (name ? `com ${name}` : "sem ninguém para atender")

export const findCustomersTool = defineTool({
  name: "find_customers",
  description:
    "Procura clientes da clínica pelo nome (ou lista todas, com query null). Devolve id e nome; use o id nas outras ferramentas.",
  input: z.object({ query: z.string().max(80).nullable() }),
  async run({ query }, { member }) {
    return { output: await listCustomers(member, query?.trim() || undefined) }
  },
})

export const createCustomerTool = defineTool({
  name: "create_customer",
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

export const createAppointmentTool = defineTool({
  name: "create_appointment",
  description:
    "Marca uma sessão para uma cliente. Sem member_id, quem atende é o membro que pediu. O membro vê a sessão num recibo com Desfazer.",
  input: z.object({
    customer_id: id,
    day,
    time,
    duration_minutes: z
      .int()
      .min(5)
      .max(480)
      .nullable()
      .describe(`A duração em minutos, ou null para ${defaultAppointmentMinutes}.`),
    kind: z.string().max(120).nullable().describe("O tipo, como Avaliação."),
    member_id: id.nullable().describe("Quem atende (id da equipe), ou null."),
  }),
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
      durationMinutes: input.duration_minutes ?? undefined,
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
  description:
    "Remarca uma sessão (o id vem de read_agenda) para outro dia e horário: a antiga é cancelada e uma nova fica no lugar. Sem member_id, quem atende continua o mesmo. O membro vê num recibo com Desfazer.",
  input: z.object({
    appointment_id: id,
    day,
    time,
    member_id: id.nullable().describe("Quem passa a atender, ou null."),
  }),
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
  description:
    "Define quem da equipe atende uma sessão (o id vem de read_agenda). O membro vê num recibo com Desfazer.",
  input: z.object({ appointment_id: id, member_id: id.describe("Quem passa a atender.") }),
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
  description:
    "Pede a um membro que confirme o cancelamento de uma sessão (o id vem de read_agenda). Você nunca cancela sozinha: o membro decide num card, e a decisão chega numa próxima mensagem. Para mudar o horário, use reschedule_appointment.",
  input: z.object({
    appointment_id: id,
    reason: z.string().max(200).nullable().describe("O motivo, se houver."),
  }),
  async run(input, { member, timeZone }) {
    const appointment = await findAppointment(member, input.appointment_id)
    if (!appointment) throw new ToolRefusal("Essa sessão não existe na agenda.")
    if (appointment.status !== "scheduled") throw new ToolRefusal("Essa sessão não está mais agendada.")
    const [customer, names] = await Promise.all([
      findCustomer(member, appointment.customerId),
      teamNames(member),
    ])
    const reason = input.reason?.trim()
    const card: ApprovalCard = {
      type: "approval",
      title: "Cancelar a sessão?",
      rows: [
        { label: "Cliente", value: customer?.name ?? "" },
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

export type ToolCall = { id: string; name: string; input: unknown }
export type Execution = { result: Anthropic.Beta.BetaToolResultBlockParam } & Omit<ToolOutput, "output">

export function createToolRegistry(tools: Tool[]) {
  const byName = new Map(tools.map((tool) => [tool.name, tool]))

  const error = (call: ToolCall, content: string): Execution => ({
    result: { type: "tool_result", tool_use_id: call.id, content, is_error: true },
  })

  return {
    // In a fixed order, so the cached prefix stays the same between calls.
    definitions: tools.map((tool): Anthropic.Beta.BetaTool => {
      const schema: Record<string, unknown> = z.toJSONSchema(tool.input)
      delete schema.$schema
      return {
        name: tool.name,
        description: tool.description,
        input_schema: schema as Anthropic.Beta.BetaTool.InputSchema,
      }
    }),

    // The model's input is checked against the tool's schema before the tool sees it.
    async execute(call: ToolCall, context: ToolContext): Promise<Execution> {
      const tool = byName.get(call.name)
      if (!tool) return error(call, `Não existe a ferramenta ${call.name}.`)
      const input = tool.input.safeParse(call.input)
      if (!input.success)
        return error(call, `Entrada inválida para ${call.name}: ${z.prettifyError(input.error)}`)
      try {
        const { output, ...shown } = await tool.run(input.data, context)
        return {
          result: { type: "tool_result", tool_use_id: call.id, content: JSON.stringify(output) },
          ...shown,
        }
      } catch (failure) {
        if (failure instanceof ToolRefusal || failure instanceof AgendaError)
          return error(call, failure.message)
        console.error(`Tool ${call.name} failed`, failure)
        return error(call, `A ferramenta ${call.name} falhou.`)
      }
    },
  }
}

export type ToolRegistry = ReturnType<typeof createToolRegistry>
