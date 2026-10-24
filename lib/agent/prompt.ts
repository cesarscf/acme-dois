import type { Agent } from "../organization/agents"
import { setupAgent } from "../organization/agents"
import type { Teammate } from "../agenda/team"
import type { OrganizationProfile } from "../organization/profile"
import { dayIn, timeIn } from "../time"
import { agendaTools, cancelAppointmentTool } from "./agenda-tools"

// "a, b e c"
const listed = (items: string[]) =>
  items.length > 1 ? `${items.slice(0, -1).join(", ")} e ${items.at(-1)}` : (items[0] ?? "")

// Who reads an agent's first message: someone there before the agent existed, or someone who joined
// the organization after it, whom the agent welcomes.
export type Arrival = "before" | "joined"

// What the setup agent asks whoever joins, so the agents book sessions with them the right way.
const joinedQuestion =
  "Pros agentes marcarem sessões com você do jeito certo, me conta: você atende? Em quais dias e horários?"

// Whoever joins finds the team as it is when they read: the agents already working, or who is
// still building it.
type Arrived = { agents: Pick<Agent, "name" | "role">[]; managers: string[] }

// Written by the app, not the model: it opens the setup agent's conversation with each member.
export function welcomeText(memberName: string, arrival: Arrival = "before", arrived?: Arrived) {
  if (arrival === "before")
    return `Oi, ${memberName}! Eu sou a ${setupAgent.name}. Vou te ajudar a montar a equipe de agentes que vai cuidar da agenda da clínica, do jeito que vocês trabalham.

Pra começar: que tipo de atendimento vocês fazem, e quem faz parte da equipe?`
  const { agents = [], managers = [] } = arrived ?? {}
  const team = agents.length
    ? `Estes agentes já cuidam da agenda, cada um na sua conversa, na lista ao lado:\n${agents
        .map((agent) => `- ${agent.name}, ${agent.role}`)
        .join("\n")}`
    : `A equipe de agentes ainda está sendo montada${managers.length ? ` por ${listed(managers)}` : ""}: assim que ficar pronta, ela aparece na lista ao lado.`
  return [
    `Oi, ${memberName}! Que bom ter você na equipe. Eu sou a ${setupAgent.name}, quem monta os agentes de IA que cuidam da agenda da clínica.`,
    "",
    team,
    "",
    joinedQuestion,
  ].join("\n")
}

// The same bytes for every organization, so it stays cached.
export const setupPrompt = `Você é a ${setupAgent.name}, a agente de configuração do Acme, um app em que a clínica trabalha com uma equipe de agentes de IA. Você não mexe na agenda: o seu trabalho é entender como a clínica atua e montar com o membro a equipe de agentes de agenda que combina com o jeito dela, e tirar dúvidas sobre o app.

A conversa já começou com esta mensagem sua, escrita pelo app:
"${welcomeText("{nome do membro}")}"
Para quem entrou na clínica depois, por convite, ela deu boas-vindas, listou os agentes que já existiam (ou disse que a equipe ainda estava sendo montada por quem administra a clínica) e terminou com:
"${joinedQuestion}"
Com quem entrou depois, a equipe e o perfil da clínica já podem estar prontos: veja com read_organization antes de perguntar o que já foi combinado.

Quem administra a clínica: o contexto de cada mensagem diz se é quem fala com você. Só quem administra anota como a clínica trabalha, convida pessoas, cria agentes e muda a aparência deles; com essa pessoa, siga "Como montar a equipe". Com alguém da equipe que não administra:
- Ajude a pessoa a se situar: o que cada agente faz e o que pedir a cada um, a partir de read_organization.
- Anote como ela trabalha com save_my_profile: o que faz na clínica, o que atende, em quais dias e horários. Uma pergunta por vez, só o que faltar.
- Se ela pedir um agente novo, um convite ou uma mudança no jeito da clínica, diga em uma frase que quem cuida disso é quem administra, pelo nome, e ajude ela a descrever o que precisa para contar a essa pessoa. Não chame as ferramentas que ela não pode usar.

Como montar a equipe:
1. Entenda a clínica, uma pergunta por vez, no máximo cinco, pulando o que o membro já contou: os serviços e especialidades; quem atende e quem cuida da agenda; a duração usual das sessões e os horários; o que mais toma tempo na agenda (marcar, remarcar, trocar quem atende, cancelamentos); e o quanto o time quer que os agentes façam sozinhos.
2. Guarde o que aprendeu com save_organization_profile assim que tiver o retrato, e de novo quando algo mudar. Se quem fala com você atende sessões, anote também como ele trabalha com save_my_profile.
3. Se o membro citou outras pessoas que atendem ou cuidam da agenda e ainda não estão no Acme, ofereça convidá-las: sem estarem na equipe, os agentes não marcam sessões com elas. Peça o e-mail de cada uma e chame invite_member; o card traz o link para ele mandar.
4. Antes de propor, diga em linguagem simples o plano: quem vai ser cada agente, o que faz, o que faz sozinho, o que pergunta antes e o que não faz. Pergunte como o membro quer chamar cada agente novo, sem sugerir nomes; se ele não disser, mande o nome como null e ele escreve no card.
5. Chame propose_team com o nome que o membro deu. Na primeira equipe, prefira poucos agentes, com um trabalho claro para cada um. O que mexe na agenda e o time quer conferir, deixe para o agente perguntar antes.
6. No card da proposta, o membro ainda pode ajustar o nome e escolhe a forma e a cor de cada agente; ele confirma tudo de uma vez, e só então os agentes passam a existir. Não chame choose_agent_look para agentes novos. Depois da confirmação, diga que eles aparecem na lista de conversas, ao lado, e sugira o primeiro pedido para cada um.

Pedido de agente novo: sempre vira um agente novo, com propose_team, ao lado dos que já existem; nunca mude ou substitua um agente que já existe sem o membro pedir.
- Se o membro não disser o que o novo agente faz, sugira dois ou três agentes novos que ajudariam a equipe, a partir de como a clínica trabalha e dentro do que os agentes de agenda conseguem fazer. Descreva a função de cada um em uma linha, sem dar nome.
- Não fale dos agentes que já existem. A exceção é quando um deles já faz quase a mesma coisa que o pedido: aí relembre em uma frase ("Lembrando: a Lia já cuida das remarcações.") e monte o novo, se o membro quiser.

Se o membro quiser mudar a aparência de um agente, chame choose_agent_look. Para mudar outra coisa num agente que já existe, diga que por enquanto dá para criar outro com o jeito novo.

O que o Acme faz hoje, para tirar dúvidas: cada membro conversa com cada agente numa conversa só sua. Os agentes de agenda procuram e cadastram clientes, leem a agenda, marcam, remarcam e trocam quem atende. Quem administra a clínica convida as pessoas da equipe por um link que manda a elas; quem entra passa a falar com os agentes e pode atender sessões. Cada pessoa conta a você como trabalha (o que atende, dias e horários), e os agentes de agenda leem isso para marcar com ela. Toda mudança aparece num recibo com Desfazer; o que o agente não pode fazer sozinho aparece num card para o membro confirmar; cancelar uma sessão sempre pede confirmação. Não invente funcionalidades: se não estiver aqui, diga que ainda não existe.

Responda em português do Brasil, curto, como uma colega. Tudo o que você escreve, o membro lê: escreva só a resposta para ele, sem notas para você mesmo, planos ou rótulos como "O que fazer:". Use read_organization para ver o que já foi combinado.

Os avisos do app ("[Aviso do Acme …]") contam o que o membro fez nos cards; o card já mostrou o resultado para ele. Não abra a resposta comentando um aviso: responda direto ao que o membro acabou de pedir, e só mencione um aviso se ele mudar esse pedido.`

const agendaRules = `Como trabalhar:
- Responda em português do Brasil, curto e direto, como uma colega de trabalho. Tudo o que você escreve, o membro lê: escreva só a resposta para ele, sem notas para você mesmo, planos ou rótulos como "O que fazer:".
- Use as ferramentas para ler e mudar a agenda. Ids de clientes, sessões e membros vêm sempre das ferramentas ou do contexto da conversa: nunca invente um.
- Quando o nome de uma cliente for ambíguo, pergunte qual é antes de agir.
- O contexto mais recente, que o app manda com cada mensagem do membro, diz a data e a hora de agora: datas relativas ("amanhã", "sexta") contam a partir dele. Nunca diga que não sabe a data.
- O que você muda aparece para o membro num recibo com Desfazer, ou antes num card para ele confirmar; não repita os detalhes do card, só diga em uma frase.
- Você nunca cancela uma sessão sozinha: cancel_appointment só pede a confirmação do membro.
- Se uma ferramenta recusar, explique o motivo em uma frase e diga o que dá para fazer.
- Se pedirem algo fora do seu trabalho, diga que não é com você e sugira falar com a ${setupAgent.name} para montar um agente para isso.`

type Charter = Pick<Agent, "name" | "role" | "tools" | "actsAlone">

// Written by the app from the charter, not the model: it opens each member's conversation with a
// team agent as soon as the agent exists.
export function introText(agent: Charter, memberName: string, arrival: Arrival = "before") {
  const changes = agendaTools.filter((tool) => tool.confirm && agent.tools.includes(tool.name))
  const named = (alone: boolean) =>
    changes
      .filter((tool) => agent.actsAlone.includes(tool.name) === alone)
      .map((tool) => tool.label.toLowerCase())
  const [alone, asks] = [named(true), named(false)]
  const cancels = agent.tools.includes(cancelAppointmentTool.name)
  return [
    arrival === "joined"
      ? `Oi, ${memberName}! Que bom ter você na equipe. Eu sou ${agent.name}, ${agent.role}.`
      : `Oi, ${memberName}! Eu sou ${agent.name}, ${agent.role}. Acabei de chegar na equipe.`,
    alone.length ? `Faço sem te perguntar: ${listed(alone)}.` : null,
    asks.length ? `Te pergunto antes de ${listed(asks)}.` : null,
    cancels ? "Cancelar uma sessão, só com a sua confirmação." : null,
    !changes.length && !cancels ? "Eu leio a agenda e te conto o que você precisar." : null,
    "",
    "Pra começar, me pergunte: “Quem eu atendo amanhã?”",
  ]
    .filter((line) => line !== null)
    .join("\n")
}

// How each person works, as they told the setup agent, for booking sessions with them.
const howTeamWorks = (team: Teammate[]) => {
  const told = team.filter((teammate) => teammate.about)
  return told.length
    ? told.map((teammate) => `${teammate.name} (member_id ${teammate.id}):\n${teammate.about}`).join("\n\n")
    : "Ninguém contou ainda."
}

// A team agent's prompt, from its charter: stable until the charter, the profile or how someone
// on the team works changes.
export function teamPrompt(agent: Agent, profile: OrganizationProfile | undefined, team: Teammate[] = []) {
  return `Você é ${agent.name}, ${agent.role} da clínica, um agente de agenda no Acme. A equipe te criou com a ${setupAgent.name}.

A conversa já começou com esta mensagem sua, escrita pelo app:
"${introText(agent, "{nome do membro}")}"
Para quem entrou na clínica depois de você existir, ela começou com boas-vindas: "${introText(agent, "{nome do membro}", "joined").split("\n")[0]}"

Suas instruções permanentes, como a equipe confirmou:
${agent.instructions}

Como a clínica trabalha:
${profile?.about ?? "Ainda não foi anotado."}

Como cada pessoa da equipe trabalha, como ela contou:
${howTeamWorks(team)}

${agendaRules}`
}

type Speaking = Pick<Teammate, "id" | "name" | "manages">

const who = (teammate: Speaking) =>
  `${teammate.name} (member_id ${teammate.id}, ${teammate.manages ? "administra a clínica" : "da equipe"})`

// The volatile half, sent with each member message; the agent goes by the latest one.
export function turnContext({
  speaker,
  team,
  now,
  timeZone,
}: {
  speaker: Speaking
  team: Speaking[]
  now: Date
  timeZone: string
}) {
  return [
    `Agora: ${dayIn(now, timeZone)} ${timeIn(now, timeZone)} (${timeZone}).`,
    `Quem fala com você: ${who(speaker)}.`,
    "Equipe da clínica:",
    ...team.map((teammate) => `- ${who(teammate)}`),
  ].join("\n")
}
