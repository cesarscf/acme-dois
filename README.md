# Acme (acme-dois)

Uma versão mínima do `acme`: a clínica monta, conversando, uma equipe de agentes de IA que cuida da agenda. Só há uma tela, o chat, com a lista de agentes ao lado.

- **Next.js 16** (App Router, Server Actions, `proxy.ts`), shadcn/ui com o tema do template
- **Postgres** local via docker compose, **Drizzle ORM**
- **Better Auth** (e-mail e senha + plugin de organization)
- **SDK da Anthropic** (`claude-opus-5-5`) com loop de ferramentas próprio
- **bun test** contra um banco de teste de verdade

## Rodando

```bash
cp .env.example .env.local   # preencha BETTER_AUTH_SECRET e ANTHROPIC_API_KEY
bun install
bun run dev                  # sobe o Postgres, migra e abre http://localhost:3000
```

| Script | O que faz |
|---|---|
| `bun run dev` | Postgres + migrações + `next dev` |
| `bun run test` | Postgres + `bun test` (banco `acme_test`) |
| `bun run typecheck` / `bun run lint` | Tipos e ESLint |
| `bun run db:generate` / `bun run db:migrate` | Gera e aplica migrações do Drizzle |

## Acme Bot e a equipe

Toda organization nasce com a **Acme Bot**, a agente de configuração (hook `afterCreateOrganization`). Ela não mexe na agenda:

1. Abre a conversa com uma boas-vindas fixa, escrita pelo app.
2. Entende como a clínica trabalha, uma pergunta por vez, e guarda isso no **perfil da organization** (`save_organization_profile`). Todos os agentes leem esse perfil, e a duração usual das sessões vira o padrão ao marcar.
3. Propõe a equipe de agentes de agenda (`propose_team`). Cada agente vem com nome, cargo, instruções permanentes, as ferramentas que usa e as que usa sem perguntar. Os agentes só passam a existir quando o membro confirma o card.
4. Depois, tira dúvidas sobre o app e faz pelo membro o que as telas fazem: cria e muda grupos (nome, pessoas e agentes) e muda o nome, o cargo e a aparência dos agentes. Cada mudança volta num recibo com Desfazer.

Cada agente criado trabalha pela sua ficha. Ferramentas fora da ficha não chegam ao modelo, e quem tenta usá-las recebe uma recusa. O que ele não faz sozinho vira um card **Confirmar**, e só depois da confirmação a ação é aplicada, com recibo e Desfazer. Cancelar sempre pede confirmação, e nenhum agente pode ganhar autonomia para isso.

## Novo agente

Quem administra a clínica também cria agentes pelo **+** (Novo agente): escolhe o nome, a forma e a cor num diálogo, e a Acme Bot continua na conversa com ele, perguntando o que o agente vai fazer. A proposta chega no card de sempre, já com esse nome e essa aparência, e o agente só existe depois da confirmação.

## Painel do agente

Clicar no nome do agente, no topo da conversa, abre o painel dele ao lado, como no Grok: o mascote, o nome, o cargo e as abas **Detalhes** (o que pode usar, o que faz sem perguntar, o que pergunta antes e as instruções) e **Grupos** (os seus grupos em que ele está). Quem administra a clínica muda ali o nome e o cargo de um agente de agenda, e a aparência de qualquer agente pelo lápis sobre o mascote.

## Grupos

Além da conversa de cada membro com cada agente, a equipe conversa em grupos. O **#geral** nasce com a clínica e tem sempre toda a equipe e todos os agentes de agenda, inclusive quem chega depois. Qualquer membro cria outros grupos pelo **+** no topo da lista (Novo grupo), escolhendo as pessoas e os agentes; quem cria sempre está nele, e só quem está vê o grupo.

- **Um agente só responde quando é chamado com @nome.** Sem menção, é conversa entre pessoas. Se várias pessoas chamam, responde o primeiro agente do grupo mencionado; chamar um agente de fora do grupo (ou a Acme Bot) avisa quem escreveu que ele não vai ver.
- O agente age **em nome de quem o chamou**: recibos e cards de confirmação ficam visíveis para todo o grupo, mas só essa pessoa confirma, recusa ou desfaz.
- Clicar no nome do grupo, no topo, abre o **painel do grupo**: os agentes empilhados, o nome e as abas **Pessoas** e **Agentes**. Quem criou o grupo, ou administra a clínica, muda ali o nome e põe ou tira pessoas e agentes (ou pede à Acme Bot); o geral fica sempre com todos.
- Cada agente tem uma **transcrição por grupo**, separada das conversas diretas. A cada chamada ele lê o que o grupo disse desde a última resposta dele, com o nome de quem escreveu e "(para você)" no que deve responder. Um turno por vez por agente e grupo (advisory lock no Postgres).

## Como funciona

```
app/(chat)/layout.tsx              lista de agentes + conversa
app/(chat)/agents/[agentId]        uma conversa com um agente → components/chat.tsx
app/actions.ts                     Server Actions: enviar mensagem, agir num card
lib/dal.ts                         sessão + membro da organization ativa (server-only)
lib/chat/conversation.ts           mensagens e transcrição por membro e agente; aplica os cards
lib/chat/notices.ts                avisos de mudança na agenda para quem atende
lib/chat/groups.ts                 o que se diz nos grupos: mensagens, o turno do agente chamado e os cards
lib/chat/mentions.ts               quem foi chamado com @ numa mensagem
app/(chat)/groups/[groupId]        um grupo → components/group-chat.tsx
components/create-menu.tsx         o + da lista: Novo agente e Novo grupo, cada um num diálogo
components/agent-panel.tsx         o painel do agente, aberto pelo nome dele no topo da conversa
components/group-panel.tsx         o painel do grupo, do mesmo jeito (components/side-panel.tsx é a moldura dos dois)
lib/agent/run-turn.ts              loop: modelo → ferramentas → modelo, até terminar
lib/agent/tool-registry.ts         valida entradas (zod) e troca por um card de confirmação o que o agente não faz sozinho
lib/agent/agenda-tools.ts          ferramentas dos agentes de agenda
lib/agent/setup-tools.ts           ferramentas da Acme Bot
lib/agent/prompt.ts                boas-vindas, prompt da Acme Bot e prompt montado da ficha
lib/agent/model.ts                 a chamada à Messages API
lib/organization/*                 agentes, grupos (quem está em cada um) e perfil da organization
lib/agenda/*                       clientes, sessões e membros, sempre no escopo da organization
```

Ferramentas de agenda: `find_customers`, `create_customer`, `read_agenda`, `create_appointment`, `reschedule_appointment`, `assign_appointment` e `cancel_appointment`. Todo agente de agenda recebe as duas de leitura (`find_customers`, `read_agenda`), e só as três de mudança podem ser feitas sozinhas.

- Cada mudança aparece num **recibo com Desfazer**. Desfazer só vale enquanto a sessão está como o recibo a deixou.
- **Quem atende fica sabendo.** Quando um agente marca, remarca, troca quem atende, cancela ou desfaz a pedido de alguém, quem atende a sessão (antes e depois) recebe um aviso na própria conversa com aquele agente, escrito pelo app (`lib/chat/notices.ts`). Quem pediu não recebe, e sessões que já passaram não geram aviso. O aviso entra na transcrição do agente com quem foi avisado, então ele sabe do que se trata se a pessoa responder. A página aberta se atualiza a cada 15 segundos (`components/live-refresh.tsx`).
- **Cancelar nunca é automático**: a ferramenta só cria um card de confirmação; quem cancela é o membro. Se a sessão mudar antes, a confirmação não aplica nada.
- O que o membro decide num card entra na transcrição, e a Lia fica sabendo no turno seguinte.
- A transcrição só cresce, para reaproveitar o cache de prompt. O contexto de cada turno (agora, quem fala, equipe) vai numa mensagem `system` com `clear_at: "next_user_message"`.
- Recusas do modelo caem no fallback do servidor (`fallbacks: "default"`).

## O que ficou de fora do `acme`

Só a agenda, via chat. Sem tela de agenda, roteamento automático em grupos (sem @, ninguém responde), delegação entre agentes, edição do que um agente já criado faz (nome, cargo e aparência mudam pelo painel), rotinas, mensagens preparadas, evoluções, orçamento de IA, push, login por telefone nem pseudônimos de clientes (aqui o modelo vê o nome da cliente).
