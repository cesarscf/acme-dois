import { z } from "zod"
import { listAgents, findAgent } from "../organization/agents"
import { createInvite, listPendingInvites } from "../organization/invites"
import { findOrganizationProfile, saveOrganizationProfile } from "../organization/profile"
import { listTeam } from "../agenda/team"
import { agendaTools, baseAgendaTools } from "./agenda-tools"
import type { ProposedAgent, TeamCard } from "./cards"
import { type AgentLook, nextLook } from "./look"
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
    "Lê o que já está combinado: como a clínica trabalha, as pessoas da equipe e os convites pendentes, e os agentes, com função, ferramentas e o que fazem sozinhos.",
  input: z.object({}),
  async run(_, { member }) {
    const [profile, agents, people, invites] = await Promise.all([
      findOrganizationProfile(member.organizationId),
      listAgents(member),
      listTeam(member.organizationId),
      listPendingInvites(member),
    ])
    const team = await Promise.all(
      agents.filter((agent) => agent.kind === "team").map((agent) => findAgent(member, agent.id)),
    )
    return {
      output: {
        profile: profile ?? null,
        people: people.map((person) => person.name),
        pending_invites: invites.map((invite) => invite.email),
        agents: team.flatMap((agent) =>
          agent
            ? [
                {
                  id: agent.id,
                  name: agent.name,
                  role: agent.role,
                  tools: agent.tools,
                  acts_alone: agent.actsAlone,
                },
              ]
            : [],
        ),
      },
    }
  },
})

const proposedAgent = z.object({
  name: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .nullable()
    .describe("O nome que o membro escolheu, ou null se ele ainda não disse: ele escreve no card. Nunca invente um nome."),
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
    const team = await listAgents(member)
    const taken = new Set(team.map((agent) => agent.name.toLowerCase()))
    const looks: AgentLook[] = team.map(({ shape, color }) => ({ shape, color }))
    const proposed: ProposedAgent[] = agents.map((agent) => {
      if (agent.name && taken.has(agent.name.toLowerCase()))
        throw new ToolRefusal(`Já existe um agente chamado ${agent.name}.`)
      const called = agent.name ?? agent.role
      const tools = [...new Set([...baseAgendaTools, ...agent.tools])]
      const alone = agent.acts_alone.filter((tool) => !confirmable.has(tool))
      if (alone.length)
        throw new ToolRefusal(`${called} não pode usar ${alone.join(", ")} sem perguntar.`)
      const missing = agent.acts_alone.filter((tool) => !tools.includes(tool))
      if (missing.length)
        throw new ToolRefusal(`${called} age sozinho em ${missing.join(", ")} sem ter a ferramenta.`)
      // A look the team isn't using, for the member to keep or change in the card.
      const look = nextLook(looks)
      looks.push(look)
      return {
        // Empty until the member names it in the card.
        name: agent.name ?? "",
        role: agent.role,
        instructions: agent.instructions,
        tools,
        actsAlone: agent.acts_alone,
        ...look,
      }
    })
    const card: TeamCard = {
      type: "team",
      title: proposed.length === 1 ? "Criar este agente?" : "Montar esta equipe?",
      agents: proposed.map((agent) => {
        const asks = agent.tools.filter((tool) => confirmable.has(tool) && !agent.actsAlone.includes(tool))
        return {
          name: agent.name,
          role: agent.role,
          shape: agent.shape,
          color: agent.color,
          details: [
            { label: "O que faz", value: agent.instructions },
            { label: "Sozinho", value: labels(agent.actsAlone) },
            { label: "Pergunta antes", value: labels(asks) },
          ],
        }
      }),
      status: "pending",
    }
    return {
      output:
        "Mostrei a proposta num card, onde o membro confere, ajusta o nome e escolhe a aparência de cada agente antes de confirmar. Não diga que criou: a decisão chega depois.",
      card,
      action: { kind: "create_agents", agents: proposed },
    }
  },
})

export const chooseAgentLookTool = defineTool({
  name: "choose_agent_look",
  label: "Escolher a aparência de um agente",
  description:
    "Mostra ao membro um card para escolher a forma e a cor do avatar de um agente da equipe (o id vem de read_organization). Ele escolhe no card, e a escolha chega numa próxima mensagem.",
  input: z.object({ agent_id: z.uuid() }),
  async run({ agent_id }, { member }) {
    const agent = await findAgent(member, agent_id)
    if (!agent || agent.kind !== "team") throw new ToolRefusal("Esse agente não é da equipe.")
    return {
      output: "Mostrei o card. Não diga qual foi a escolha: ela chega depois.",
      card: {
        type: "look",
        agentName: agent.name,
        look: { shape: agent.shape, color: agent.color },
        status: "pending",
      },
      action: { kind: "look", agentId: agent.id },
    }
  },
})

export const inviteMemberTool = defineTool({
  name: "invite_member",
  label: "Convidar alguém da equipe",
  description:
    "Convida uma pessoa da equipe para a clínica no Acme e mostra ao membro um card com o link do convite, para ele mandar a ela (por WhatsApp, por exemplo). O link vale 7 dias e só funciona com o e-mail convidado. Depois que ela entrar, os agentes podem marcar sessões com ela.",
  input: z.object({
    name: z.string().trim().min(1).max(80).describe("Como o membro chama a pessoa, como Joana."),
    email: z.email().describe("O e-mail da pessoa, que ela vai usar para entrar."),
  }),
  async run({ name, email }, { member }) {
    const invite = await createInvite(member, { email })
    return {
      output: `Convite criado para ${invite.email}. Mostrei o link num card para o membro mandar a ${name}.`,
      card: {
        type: "invite",
        name,
        email: invite.email,
        path: `/invites/${invite.id}`,
        expiresAt: invite.expiresAt.toISOString(),
        status: "sent",
      },
    }
  },
})

export const setupTools = [
  saveOrganizationProfileTool,
  readOrganizationTool,
  proposeTeamTool,
  chooseAgentLookTool,
  inviteMemberTool,
]
