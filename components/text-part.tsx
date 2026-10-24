import { memo } from "react"
import ReactMarkdown from "react-markdown"
import remarkBreaks from "remark-breaks"
import remarkGfm from "remark-gfm"

// Made once, not on every render.
const plugins = [remarkGfm, remarkBreaks]

// An agent's reply, as markdown; a single line break stays a break, as in a chat. Parsed again
// only when the text changes, not each time the conversation refreshes or an agent starts typing.
export const TextPart = memo(function TextPart({ text }: { text: string }) {
  return (
    <div className="typeset typeset-docs">
      <ReactMarkdown remarkPlugins={plugins}>{text}</ReactMarkdown>
    </div>
  )
})
