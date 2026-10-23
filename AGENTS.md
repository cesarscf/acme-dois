<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project conventions

- Code, domain terms and comments are in English; user-facing copy is pt-BR.
- The clinic is `organization` in code (as Better Auth names it); only the UI says "Clínica".
- Server Components by default; `"use client"` only where the browser is needed.
- Every read and change goes through a `Member` (`lib/member.ts`) and is scoped to its organization. Pages and Server Actions get it from `requireMember()` in `lib/dal.ts`.
- Agent tools live in `lib/agent/tools.ts`. A change the agent makes returns a receipt card with an undo action; cancelling only ever returns an approval card.
- The model transcript is append-only (prompt caching). Never edit or delete `transcript_entry` rows.
- Tests: `bun test`, against the `acme_test` database. Use `test/scripted-model.ts` instead of calling Claude.
- Commits follow Conventional Commits (`feat:`, `fix:`, `refactor:`, `test:`, `chore:`, `docs:`).
