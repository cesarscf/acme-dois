# Cuida (acme-dois)

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
4. Depois, tira dúvidas sobre o app.

Cada agente criado trabalha pela sua ficha. Ferramentas fora da ficha não chegam ao modelo, e quem tenta usá-las recebe uma recusa. O que ele não faz sozinho vira um card **Confirmar**, e só depois da confirmação a ação é aplicada, com recibo e Desfazer. Cancelar sempre pede confirmação, e nenhum agente pode ganhar autonomia para isso.

## Como funciona

```
app/(chat)/layout.tsx              lista de agentes + conversa
app/(chat)/agents/[agentId]        uma conversa com um agente → components/chat.tsx
app/actions.ts                     Server Actions: enviar mensagem, agir num card
lib/dal.ts                         sessão + membro da organization ativa (server-only)
lib/chat/conversation.ts           mensagens e transcrição por membro e agente; aplica os cards
lib/agent/run-turn.ts              loop: modelo → ferramentas → modelo, até terminar
lib/agent/tool-registry.ts         valida entradas (zod) e troca por um card de confirmação o que o agente não faz sozinho
lib/agent/agenda-tools.ts          ferramentas dos agentes de agenda
lib/agent/setup-tools.ts           ferramentas da Acme Bot
lib/agent/prompt.ts                boas-vindas, prompt da Acme Bot e prompt montado da ficha
lib/agent/model.ts                 a chamada à Messages API
lib/organization/*                 agentes e perfil da organization
lib/agenda/*                       clientes, sessões e membros, sempre no escopo da organization
```

Ferramentas de agenda: `find_customers`, `create_customer`, `read_agenda`, `create_appointment`, `reschedule_appointment`, `assign_appointment` e `cancel_appointment`. Todo agente de agenda recebe as duas de leitura (`find_customers`, `read_agenda`), e só as três de mudança podem ser feitas sozinhas.

- Cada mudança aparece num **recibo com Desfazer**. Desfazer só vale enquanto a sessão está como o recibo a deixou.
- **Cancelar nunca é automático**: a ferramenta só cria um card de confirmação; quem cancela é o membro. Se a sessão mudar antes, a confirmação não aplica nada.
- O que o membro decide num card entra na transcrição, e a Lia fica sabendo no turno seguinte.
- A transcrição só cresce, para reaproveitar o cache de prompt. O contexto de cada turno (agora, quem fala, equipe) vai numa mensagem `system` com `clear_at: "next_user_message"`.
- Recusas do modelo caem no fallback do servidor (`fallbacks: "default"`).

## O que ficou de fora do `acme`

Só a agenda, via chat. Sem tela de agenda, grupos, delegação entre agentes, edição de um agente já criado, rotinas, mensagens preparadas, evoluções, orçamento de IA, push, login por telefone nem pseudônimos de clientes (aqui o modelo vê o nome da cliente).
