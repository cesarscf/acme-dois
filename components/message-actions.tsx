"use client"

import { CheckIcon, CopyIcon } from "lucide-react"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { MessageFooter } from "@/components/ui/message"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

export function MessageActions({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timeout = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(timeout)
  }, [copied])

  const label = copied ? "Copiado" : "Copiar"
  return (
    <MessageFooter className="px-0">
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={label}
              onClick={() => {
                navigator.clipboard
                  .writeText(text)
                  .then(() => setCopied(true))
                  .catch(() => {})
              }}
            />
          }
        >
          {copied ? <CheckIcon /> : <CopyIcon />}
        </TooltipTrigger>
        <TooltipContent>
          <p>{label}</p>
        </TooltipContent>
      </Tooltip>
    </MessageFooter>
  )
}
