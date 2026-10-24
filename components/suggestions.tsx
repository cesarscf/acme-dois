"use client"

import { Button } from "@/components/ui/button"

type Props = { suggestions: string[]; onSelect: (text: string) => void }

export function Suggestions({ suggestions, onSelect }: Props) {
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {suggestions.map((suggestion) => (
        <Button key={suggestion} variant="outline" size="sm" onClick={() => onSelect(suggestion)}>
          {suggestion}
        </Button>
      ))}
    </div>
  )
}
