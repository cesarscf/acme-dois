import { z } from "zod"
import { listAgents, findAgent } from "../organization/agents"
import { findOrganizationProfile, saveOrganizationProfile } from "../organization/profile"
import { agendaTools, baseAgendaTools } from "./agenda-tools"
import type { ApprovalCard, ProposedAgent } from "./cards"
import { defineTool, ToolRefusal } from "./tool-registry"

// The setup agent's tools: it learns how the organization works and proposes the team of agenda
// agents that fits it. Creating agents always waits for a member's confirmation.

const toolNames = agendaTools.map((tool) => tool.name) as [string, ...string[]]
const confirmable = new Set(agendaTools.filter((tool) => tool.confirm).map((tool) => tool.name))
const labelOf = new Map(agendaTools.map((tool) => [tool.name, tool.label]))

const labels = (names: string[]) =>
  names.length ? names.map((name) => labelOf.get(name)).join(", ") : "nada"

export const saveOrganizationProfileTool = defineTool({
  name: "save_organization_profile",
  label: "Anotar como a clínica trabalha",
  description:
    "Guarda como a clínica trabalha, para todos os agentes lerem. Mande o retrato completo de novo a cada mudança: ele substitui o anterior.",
  input: z.object({
    about: z
      .string()
      .trim()
      .min(1)
      .max(2000)
      .describe(
        "Em tópicos curtos: serviços e especialidades, quem é a equipe e quem cuida da agenda, horários, como as sessões são marcadas e o que o time prefere que os agentes façam sozinhos.",
      ),
    appointment_minutes: z
      .int()
      .min(5)
      .max(480)
      .nullable()
      .describe("A duração usual de uma sessão, se o membro disse."),
  }),
  async run({ about, appointment_minutes }, { member }) {
    await saveOrganizationProfile(member, { about, appointmentMinutes: appointment_minutes })
    return {
      output: "Guardei. Mostrei ao membro num recibo.",
      card: {
        type: "receipt",
        title: "Anotei como a clínica trabalha",
        detail: about,
        status: "applied",
        undoable: false,
      },
    }
  },
})

export const readOrganizationTool = defineTool({
  name: "read_organization",
  label: "Ver a equipe de agentes",
  description:
    "Lê o que já está combinado: como a clínica trabalha e os agentes da equipe, com função, ferramentas e o que fazem sozinhos.",
  input: z.object({}),
  async run(_, { member }) {
    const [profile, agents] = await Promise.all([
      findOrganizationProfile(member.organizationId),
      listAgents(member),
    ])
    const team = await Promise.all(
      agents.filter((agent) => agent.kind === "team").map((agent) => findAgent(member, agent.id)),
    )
    return {
      output: {
        profile: profile ?? null,
        agents: team.flatMap((agent) =>
          agent
            ? [{ name: agent.name, role: agent.role, tools: agent.tools, acts_alone: agent.actsAlone }]
            : [],
        ),
      },
    }
  },
})

const proposedAgent = z.object({
  name: z.string().trim().min(1).max(40).describe("Um nome curto de pessoa, como Lia."),
  role: z.string().trim().min(1).max(80).describe("O cargo, como Secretária da agenda."),
  instructions: z
    .string()
    .trim()
    .min(1)
    .max(4000)
    .describe(
      "As instruções permanentes do agente, falando com ele: o que faz, para quem, como, e o que não faz. Adapte ao jeito da clínica.",
    ),
  tools: z.array(z.enum(toolNames)).min(1).describe("As ferramentas de agenda que ele usa."),
  acts_alone: z
    .array(z.enum(toolNames))
    .describe("Das ferramentas que mudam a agenda, as que ele usa sem perguntar antes."),
})

export const proposeTeamTool = defineTool({
  name: "propose_team",
  label: "Propor a equipe",
  description: `Propõe agentes de agenda para a clínica e mostra ao membro para confirmar; só passam a existir depois que ele confirmar. Ferramentas: ${agendaTools
    .map((tool) => `${tool.name} (${tool.label})`)
    .join(", ")}. Podem agir sozinhos só em: ${[...confirmable].join(", ")}.`,
  input: z.object({ agents: z.array(proposedAgent).min(1).max(5) }),
  async run({ agents }, { member }) {
    const taken = new Set((await listAgents(member)).map((agent) => agent.name.toLowerCase()))
    const proposed: ProposedAgent[] = agents.map((agent) => {
      if (taken.has(agent.name.toLowerCase()))
        throw new ToolRefusal(`Já existe um agente chamado ${agent.name}.`)
      const tools = [...new Set([...baseAgendaTools, ...agent.tools])]
      const alone = agent.acts_alone.filter((tool) => !confirmable.has(tool))
      if (alone.length)
        throw new ToolRefusal(`${agent.name} não pode usar ${alone.join(", ")} sem perguntar.`)
      const missing = agent.acts_alone.filter((tool) => !tools.includes(tool))
      if (missing.length)
        throw new ToolRefusal(`${agent.name} age sozinho em ${missing.join(", ")} sem ter a ferramenta.`)
      return { name: agent.name, role: agent.role, instructions: agent.instructions, tools, actsAlone: agent.acts_alone }
    })
    const card: ApprovalCard = {
      type: "approval",
      title: proposed.length === 1 ? "Criar este agente?" : "Montar esta equipe?",
      rows: proposed.map((agent) => {
        const asks = agent.tools.filter((tool) => confirmable.has(tool) && !agent.actsAlone.includes(tool))
        return {
          label: agent.name,
          value: `${agent.role}. Faz sozinho: ${labels(agent.actsAlone)}. Pergunta antes: ${labels(asks)}.`,
        }
      }),
      status: "pending",
    }
    return {
      output: "Mostrei a proposta num card. Não diga que criou: a decisão do membro chega depois.",
      card,
      action: { kind: "create_agents", agents: proposed },
    }
  },
})

export const setupTools = [saveOrganizationProfileTool, readOrganizationTool, proposeTeamTool]
