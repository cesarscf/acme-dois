import { z } from "zod"
import { findAgent, listAgents, updateAgentProfile } from "../organization/agents"
import {
  changeGroup,
  createGroup,
  findGroup,
  type Group,
  type GroupState,
  listGroups,
  mayManage,
} from "../organization/groups"
import { createInvite, listPendingInvites } from "../organization/invites"
import { type Member, manages } from "../member"
import { findOrganizationProfile, saveMemberProfile, saveOrganizationProfile } from "../organization/profile"
import { listTeam } from "../agenda/team"
import { agendaTools, baseAgendaTools } from "./agenda-tools"
import type { ProposedAgent, TeamCard } from "./cards"
import { type AgentLook, avatarColors, avatarShapes, nextLook } from "./look"
import { defineTool, ToolRefusal } from "./tool-registry"

// The setup agent's tools: it learns how the organization works and proposes the team of agenda
// agents that fits it, and does for the member what the app's screens do to groups and agents.
// Creating agents always waits for a member's confirmation; any other change comes back in a
// receipt with Undo.

const toolNames = agendaTools.map((tool) => tool.name) as [string, ...string[]]
const confirmable = new Set(agendaTools.filter((tool) => tool.confirm).map((tool) => tool.name))
const labelOf = new Map(agendaTools.map((tool) => [tool.name, tool.label]))

const labels = (names: string[]) =>
  names.length ? names.map((name) => labelOf.get(name)).join(", ") : "nada"

// Turns down what only who runs the organization does, naming whom the member can ask.
async function requireManager(member: Member, what: string) {
  if (manages(member)) return
  const managers = (await listTeam(member.organizationId)).filter((teammate) => teammate.manages)
  throw new ToolRefusal(
    `Só quem administra a clínica ${what}: ${managers.map((teammate) => teammate.name).join(", ")}. Diga isso ao membro e ajude ele a descrever o que precisa, para contar a essa pessoa.`,
  )
}

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
    await requireManager(member, "anota como a clínica trabalha")
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
    "Lê o que já está combinado: como a clínica trabalha; as pessoas da equipe (com member_id), quem administra e como cada uma trabalha; os convites pendentes; os agentes, com função, ferramentas e o que fazem sozinhos; e os grupos do membro, com quem está em cada um e se ele pode mudá-los.",
  input: z.object({}),
  async run(_, { member }) {
    const [profile, agents, people, invites, groups] = await Promise.all([
      findOrganizationProfile(member.organizationId),
      listAgents(member),
      listTeam(member.organizationId),
      listPendingInvites(member),
      listGroups(member).then((rows) => Promise.all(rows.map((row) => findGroup(member, row.id)))),
    ])
    const team = await Promise.all(
      agents.filter((agent) => agent.kind === "team").map((agent) => findAgent(member, agent.id)),
    )
    return {
      output: {
        profile: profile ?? null,
        people: people.map((person) => ({
          member_id: person.id,
          name: person.name,
          manages: person.manages,
          about: person.about,
        })),
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
        groups: groups.flatMap((group) =>
          group
            ? [
                {
                  id: group.id,
                  name: group.name,
                  general: group.general,
                  people: group.members.map((person) => person.name),
                  agents: group.agents.map((agent) => agent.name),
                  you_can_change: mayManage(member, group),
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
  look: z
    .object({ shape: z.enum(avatarShapes), color: z.enum(avatarColors) })
    .optional()
    .describe("A aparência que o membro já escolheu no app, exatamente como o aviso disse. Sem isso, o app escolhe uma."),
})

export const proposeTeamTool = defineTool({
  name: "propose_team",
  label: "Propor a equipe",
  description: `Propõe agentes de agenda para a clínica e mostra ao membro para confirmar; só passam a existir depois que ele confirmar. Ferramentas: ${agendaTools
    .map((tool) => `${tool.name} (${tool.label})`)
    .join(", ")}. Podem agir sozinhos só em: ${[...confirmable].join(", ")}.`,
  input: z.object({ agents: z.array(proposedAgent).min(1).max(5) }),
  async run({ agents }, { member }) {
    await requireManager(member, "cria agentes")
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
      // The look the member picked, or one the team isn't using, to keep or change in the card.
      const look = agent.look ?? nextLook(looks)
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
    await requireManager(member, "muda a aparência dos agentes")
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
    await requireManager(member, "convida pessoas")
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

export const saveMyProfileTool = defineTool({
  name: "save_my_profile",
  label: "Anotar como você trabalha",
  description:
    "Guarda como o membro que fala com você trabalha, para os agentes marcarem sessões com ele. Só a ficha dele: nunca a de outra pessoa. Mande a ficha completa de novo a cada mudança: ela substitui a anterior.",
  input: z.object({
    about: z
      .string()
      .trim()
      .min(1)
      .max(1000)
      .describe(
        "Em tópicos curtos, como o membro contou: o que ele faz na clínica, o que atende, em quais dias e horários, e o que os agentes precisam saber para marcar com ele.",
      ),
  }),
  async run({ about }, { member }) {
    await saveMemberProfile(member, about)
    return {
      output: "Guardei. Mostrei ao membro num recibo.",
      card: { type: "receipt", title: "Anotei como você trabalha", detail: about, status: "applied", undoable: false },
    }
  },
})

// "Ana, Bia e Lia", or "ninguém".
const listed = (names: string[]) =>
  names.length === 0 ? "ninguém" : names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} e ${names.at(-1)}`

const memberIds = (what: string) => z.array(z.string().min(1).max(64)).max(30).describe(what)
const agentIds = (what: string) => z.array(z.uuid()).max(30).describe(what)

const whoIsIn = (group: Group) =>
  `Pessoas: ${listed(group.members.map((person) => person.name))}. Agentes: ${listed(group.agents.map((agent) => agent.name))}.`

export const createGroupTool = defineTool({
  name: "create_group",
  label: "Criar grupos",
  description:
    "Cria um grupo de conversa com as pessoas e os agentes de agenda que o membro pedir (os ids vêm de read_organization); quem pede sempre entra. Num grupo, um agente só responde quando alguém escreve @ com o nome dele. Mostra o grupo num recibo com Desfazer.",
  input: z.object({
    name: z.string().trim().min(1).max(40).describe("O nome do grupo, como Recepção."),
    member_ids: memberIds("As pessoas da equipe, além de quem pede."),
    agent_ids: agentIds("Os agentes de agenda."),
  }),
  async run({ name, member_ids, agent_ids }, { member }) {
    const created = await createGroup(member, { name, memberIds: member_ids, agentIds: agent_ids })
    const group = (await findGroup(member, created.id))!
    return {
      output: { group_id: group.id, note: "Mostrei ao membro num recibo com Desfazer. O grupo já aparece na lista ao lado." },
      card: { type: "receipt", title: `Grupo ${group.name} criado`, detail: whoIsIn(group), status: "applied", undoable: true },
      action: { kind: "delete_group", groupId: group.id },
    }
  },
})

// What changed in a group, in words: its new name, who came in and who left.
function changeText(from: GroupState, to: GroupState, names: Map<string, string>) {
  const named = (list: string[]) => listed(list.map((id) => names.get(id) ?? "alguém"))
  const came = (before: string[], after: string[]) => after.filter((id) => !before.includes(id))
  const lines = [
    from.name !== to.name ? `Agora se chama ${to.name}.` : null,
    came(from.memberIds, to.memberIds).length ? `Entrou: ${named(came(from.memberIds, to.memberIds))}.` : null,
    came(to.memberIds, from.memberIds).length ? `Saiu: ${named(came(to.memberIds, from.memberIds))}.` : null,
    came(from.agentIds, to.agentIds).length ? `Agente que entrou: ${named(came(from.agentIds, to.agentIds))}.` : null,
    came(to.agentIds, from.agentIds).length ? `Agente que saiu: ${named(came(to.agentIds, from.agentIds))}.` : null,
  ]
  return lines.filter(Boolean).join(" ") || "Nada mudou."
}

export const changeGroupTool = defineTool({
  name: "change_group",
  label: "Mudar grupos",
  description:
    "Muda um grupo do membro (o id vem de read_organization): o nome, e quem entra ou sai, pessoas e agentes de agenda. Só quem criou o grupo ou administra a clínica muda um grupo, e o geral fica como está, sempre com todos. Mostra a mudança num recibo com Desfazer.",
  input: z.object({
    group_id: z.uuid(),
    name: z.string().trim().min(1).max(40).nullable().describe("O nome novo, ou null para manter."),
    add_member_ids: memberIds("Pessoas que entram."),
    remove_member_ids: memberIds("Pessoas que saem."),
    add_agent_ids: agentIds("Agentes que entram."),
    remove_agent_ids: agentIds("Agentes que saem."),
  }),
  async run(input, { member }) {
    const group = await findGroup(member, input.group_id)
    if (!group) throw new ToolRefusal("Esse grupo não existe, ou o membro não está nele.")
    const { from, to } = await changeGroup(member, group, {
      ...(input.name && { name: input.name }),
      addMemberIds: input.add_member_ids,
      removeMemberIds: input.remove_member_ids,
      addAgentIds: input.add_agent_ids,
      removeAgentIds: input.remove_agent_ids,
    })
    const [team, agents] = await Promise.all([listTeam(member.organizationId), listAgents(member)])
    const names = new Map([...team, ...agents].map((who) => [who.id, who.name]))
    return {
      output: "Mudei. Mostrei ao membro num recibo com Desfazer.",
      card: { type: "receipt", title: `Grupo ${to.name}`, detail: changeText(from, to, names), status: "applied", undoable: true },
      action: { kind: "restore_group", groupId: group.id, from, to },
    }
  },
})

export const changeAgentTool = defineTool({
  name: "change_agent",
  label: "Mudar o nome ou o cargo de um agente",
  description:
    "Muda o nome ou o cargo de um agente de agenda (o id vem de read_organization). O que ele faz não muda por aqui. Mostra a mudança num recibo com Desfazer.",
  input: z.object({
    agent_id: z.uuid(),
    name: z.string().trim().min(1).max(40).nullable().describe("O nome novo, ou null para manter."),
    role: z.string().trim().min(1).max(80).nullable().describe("O cargo novo, ou null para manter."),
  }),
  async run({ agent_id, name, role }, { member }) {
    await requireManager(member, "muda os agentes")
    const { from, to } = await updateAgentProfile(member, agent_id, {
      ...(name && { name }),
      ...(role && { role }),
    })
    const detail = [
      from.name !== to.name ? `Nome: ${from.name} → ${to.name}.` : null,
      from.role !== to.role ? `Cargo: ${from.role} → ${to.role}.` : null,
    ]
      .filter(Boolean)
      .join(" ")
    return {
      output: "Mudei. Mostrei ao membro num recibo com Desfazer.",
      card: { type: "receipt", title: `Agente ${to.name}`, detail: detail || "Nada mudou.", status: "applied", undoable: true },
      action: { kind: "restore_agent", agentId: agent_id, from, to },
    }
  },
})

export const setupTools = [
  saveOrganizationProfileTool,
  readOrganizationTool,
  proposeTeamTool,
  chooseAgentLookTool,
  inviteMemberTool,
  saveMyProfileTool,
  createGroupTool,
  changeGroupTool,
  changeAgentTool,
]
