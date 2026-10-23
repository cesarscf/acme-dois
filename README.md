# Cuida (acme-dois)

Uma versão mínima do `acme`: a clínica conversa com a **Lia**, uma agente de IA que cuida da agenda. Só há uma tela, o chat.

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

## Como funciona

```
app/page.tsx              chat (Server Component) → components/chat.tsx
app/actions.ts            Server Actions: enviar mensagem, agir num card
lib/dal.ts                sessão + membro da organization ativa (server-only)
lib/chat/conversation.ts  guarda mensagens e transcrição, aplica Desfazer/Confirmar
lib/agent/run-turn.ts     loop: modelo → ferramentas → modelo, até terminar
lib/agent/tools.ts        ferramentas de agenda e o registro que valida entradas (zod)
lib/agent/model.ts        a chamada à Messages API
lib/agenda/*              clientes, sessões e equipe, sempre no escopo da organization
```

Ferramentas da Lia: `find_customers`, `create_customer`, `read_agenda`, `create_appointment`, `reschedule_appointment`, `assign_appointment` e `cancel_appointment`.

- Cada mudança aparece num **recibo com Desfazer**. Desfazer só vale enquanto a sessão está como o recibo a deixou.
- **Cancelar nunca é automático**: a ferramenta só cria um card de confirmação; quem cancela é o membro. Se a sessão mudar antes, a confirmação não aplica nada.
- O que o membro decide num card entra na transcrição, e a Lia fica sabendo no turno seguinte.
- A transcrição só cresce, para reaproveitar o cache de prompt. O contexto de cada turno (agora, quem fala, equipe) vai numa mensagem `system` com `clear_at: "next_user_message"`.
- Recusas do modelo caem no fallback do servidor (`fallbacks: "default"`).

## O que ficou de fora do `acme`

Só a agenda, via chat. Sem tela de agenda, grupos, vários agentes, rotinas, mensagens preparadas, evoluções, orçamento de IA, push, login por telefone nem pseudônimos de clientes (aqui o modelo vê o nome da cliente).
