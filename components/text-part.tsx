import ReactMarkdown from "react-markdown"
import remarkBreaks from "remark-breaks"
import remarkGfm from "remark-gfm"

// An agent's reply, as markdown; a single line break stays a break, as in a chat.
export function TextPart({ text }: { text: string }) {
  return (
    <div className="typeset typeset-docs">
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>{text}</ReactMarkdown>
    </div>
  )
}
