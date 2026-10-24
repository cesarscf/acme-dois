// "@Lia" calls the agent named Lia. Names may have spaces; the longest name that fits wins, so
// "@Lia Souza" calls Lia Souza even when a Lia exists too.

type Named = { id: string; name: string }

const continuesName = /[\p{L}\p{N}_]/u

// Every agent called in the text, in the order they were called, each once.
export function mentionsIn<T extends Named>(text: string, agents: T[]): T[] {
  const lower = text.toLowerCase()
  const byLength = [...agents].sort((a, b) => b.name.length - a.name.length)
  const called: T[] = []
  for (let at = lower.indexOf("@"); at !== -1; at = lower.indexOf("@", at + 1)) {
    if (at > 0 && continuesName.test(lower[at - 1])) continue
    const after = lower.slice(at + 1)
    const agent = byLength.find(
      (candidate) =>
        after.startsWith(candidate.name.toLowerCase()) && !continuesName.test(after[candidate.name.length] ?? ""),
    )
    if (agent && !called.includes(agent)) called.push(agent)
  }
  return called
}

// The text before the caret, when it ends in a mention being written: what follows the @.
export function mentionBeingTyped(beforeCaret: string) {
  return /(?:^|[^\p{L}\p{N}_])@([^@\n]{0,40})$/u.exec(beforeCaret)?.[1]
}
