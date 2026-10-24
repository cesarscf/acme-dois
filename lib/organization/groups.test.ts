import { beforeEach, describe, expect, test } from "bun:test"
import { createOrganization, joinOrganization, resetDatabase } from "@/test/fixtures"
import { db } from "../db"
import { groupMessage } from "../db/schema"
import type { Member } from "../member"
import { type Agent, createAgents, findAgent } from "./agents"
import { changeGroup, createGroup, deleteNewGroup, findGroup, GroupError, listGroups, restoreGroup } from "./groups"

let ana: Member
let bia: Member
let joana: Member
let lia: Agent

beforeEach(async () => {
  await resetDatabase()
  ;[ana, bia] = await createOrganization("Ana", "Bia")
  joana = await joinOrganization(ana.organizationId, "Joana")
  const [created] = await createAgents(ana, [
    { name: "Lia", role: "Secretária", instructions: "Marca.", tools: ["read_agenda"], actsAlone: [], shape: "round", color: "#2f80ff" },
  ])
  lia = (await findAgent(ana, created.id))!
})

const recepcao = async (by: Member = joana) => {
  const created = await createGroup(by, { name: "Recepção", memberIds: [], agentIds: [] })
  return (await findGroup(by, created.id))!
}
const names = (group: { members: { name: string }[]; agents: { name: string }[] }) => [
  group.members.map((member) => member.name),
  group.agents.map((agent) => agent.name),
]

describe("changeGroup", () => {
  test("adds and removes people and agents, and says how the group was and is", async () => {
    const group = await recepcao()
    const { from, to } = await changeGroup(joana, group, { addMemberIds: [ana.id, bia.id], addAgentIds: [lia.id] })
    expect(from).toEqual({ name: "Recepção", memberIds: [joana.id], agentIds: [] })
    expect(to.memberIds).toEqual([ana.id, bia.id, joana.id].sort())
    expect(names((await findGroup(bia, group.id))!)).toEqual([["Ana", "Bia", "Joana"], ["Lia"]])

    await changeGroup(joana, (await findGroup(joana, group.id))!, { removeMemberIds: [bia.id], removeAgentIds: [lia.id] })
    expect(await findGroup(bia, group.id)).toBeUndefined()
    expect(names((await findGroup(joana, group.id))!)).toEqual([["Ana", "Joana"], []])
  })

  test("only whoever created it or runs the organization changes it, never the general group", async () => {
    const group = await recepcao()
    await changeGroup(joana, group, { addMemberIds: [bia.id] })
    const caio = await joinOrganization(ana.organizationId, "Caio")
    expect(changeGroup(caio, group, { addMemberIds: [caio.id] })).rejects.toThrow(GroupError)
    expect(await changeGroup(ana, group, { name: "Manhã" })).toMatchObject({ to: { name: "Manhã" } })
    const [general] = await listGroups(ana)
    expect(changeGroup(ana, (await findGroup(ana, general.id))!, { removeMemberIds: [bia.id] })).rejects.toThrow(
      "O geral tem sempre toda a equipe e todos os agentes, com esse nome.",
    )
  })

  test("keeps at least one person, and only the team and its agenda agents", async () => {
    const group = await recepcao()
    expect(changeGroup(joana, group, { removeMemberIds: [joana.id] })).rejects.toThrow("O grupo precisa de pelo menos uma pessoa.")
    const [setup] = await db.query.agent.findMany({ where: (agent, { eq }) => eq(agent.kind, "setup") })
    expect(changeGroup(joana, group, { addAgentIds: [setup.id] })).rejects.toThrow(GroupError)
    expect(changeGroup(joana, group, { addMemberIds: [crypto.randomUUID()] })).rejects.toThrow(GroupError)
  })
})

describe("restoreGroup", () => {
  test("puts the group back while it is as the change left it, even for who left it", async () => {
    const group = await recepcao(ana)
    await changeGroup(ana, group, { addMemberIds: [bia.id] })
    const change = await changeGroup(ana, (await findGroup(ana, group.id))!, { name: "Manhã", removeMemberIds: [ana.id] })
    expect(await restoreGroup(ana, group.id, change)).toBe("restored")
    expect((await findGroup(ana, group.id))!).toMatchObject({ name: "Recepção" })
    expect(await restoreGroup(ana, group.id, change)).toBe("stale")
  })

  test("is stale once the group changed again", async () => {
    const group = await recepcao()
    const change = await changeGroup(joana, group, { addMemberIds: [bia.id] })
    await changeGroup(joana, (await findGroup(joana, group.id))!, { addAgentIds: [lia.id] })
    expect(await restoreGroup(joana, group.id, change)).toBe("stale")
    expect(names((await findGroup(joana, group.id))!)).toEqual([["Bia", "Joana"], ["Lia"]])
  })
})

describe("deleteNewGroup", () => {
  test("undoes creating a group nobody wrote in yet", async () => {
    const group = await recepcao()
    await db.insert(groupMessage).values({ groupId: group.id, author: "member", memberId: joana.id, text: "Oi" })
    expect(await deleteNewGroup(joana, group.id)).toBe("stale")

    const empty = (await createGroup(joana, { name: "Tarde", memberIds: [], agentIds: [] })).id
    const caio = await joinOrganization(ana.organizationId, "Caio")
    expect(await deleteNewGroup(caio, empty)).toBe("stale")
    expect(await deleteNewGroup(joana, empty)).toBe("deleted")
    expect(await findGroup(joana, empty)).toBeUndefined()
  })
})
