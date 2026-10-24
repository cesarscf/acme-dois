"use client"

import { ArrowUpIcon, LoaderCircleIcon } from "lucide-react"
import { type FormEvent, useState } from "react"
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupTextarea } from "@/components/ui/input-group"

type Props = { placeholder: string; isBusy: boolean; onSubmit: (text: string) => void }

export function PromptForm({ placeholder, isBusy, onSubmit }: Props) {
  const [input, setInput] = useState("")

  function handleSubmit(event?: FormEvent) {
    event?.preventDefault()
    const text = input.trim()
    if (!text || isBusy) return
    onSubmit(text)
    setInput("")
  }

  return (
    <form onSubmit={handleSubmit}>
      <InputGroup>
        <InputGroupTextarea
          aria-label={placeholder}
          placeholder={placeholder}
          className="p-3.5"
          maxLength={4000}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault()
              handleSubmit()
            }
          }}
        />
        <InputGroupAddon align="block-end">
          <InputGroupButton
            type="submit"
            size="icon-sm"
            variant="default"
            aria-label={isBusy ? "Aguardando a resposta" : "Enviar mensagem"}
            className="ml-auto"
            disabled={isBusy || !input.trim()}
          >
            {isBusy ? <LoaderCircleIcon className="animate-spin" /> : <ArrowUpIcon />}
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </form>
  )
}
